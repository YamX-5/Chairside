import type { Deck } from './pdf'
import type { GeneratedItem } from './schemas'

/**
 * Source verification — the deterministic half of quality control.
 *
 * The review committee is another model and can be wrong in the same direction
 * as the writer. This check cannot be: it looks for the quoted sentence in the
 * actual extracted text. An item whose quote is not in the deck was invented,
 * whatever the reviewer thought of it.
 */

/** Normalise for comparison: PDF extraction mangles whitespace and quote marks. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fraction of the quote's words that appear in order in the page text.
 * A strict substring test fails on ligatures and hyphenation that PDF text
 * extraction introduces, so this measures ordered word overlap instead.
 */
export function quoteOverlap(quote: string, pageText: string): number {
  const q = normalise(quote).split(' ').filter(Boolean)
  if (q.length === 0) return 0
  const hay = normalise(pageText).split(' ')

  let matched = 0
  let cursor = 0
  for (const word of q) {
    const found = hay.indexOf(word, cursor)
    if (found !== -1) {
      matched++
      cursor = found + 1
    }
  }
  return matched / q.length
}

export const QUOTE_THRESHOLD = 0.75

export interface VerifiedItem {
  item: GeneratedItem
  /** Best overlap found, on the cited page or its immediate neighbours. */
  overlap: number
  verified: boolean
  /** The page the quote actually matched, which may differ from the cited one. */
  matchedPage: number | null
}

/**
 * Check a quote against the cited page and the two either side — decks split
 * sentences across slides, and an off-by-one citation is a nuisance, not a
 * fabrication.
 */
export function verifyItem(item: GeneratedItem, deck: Deck): VerifiedItem {
  let best = 0
  let bestPage: number | null = null

  for (const offset of [0, -1, 1, -2, 2]) {
    const page = deck.pages.find((p) => p.page === item.sourcePage + offset)
    if (!page) continue
    const overlap = quoteOverlap(item.sourceQuote, page.text)
    if (overlap > best) {
      best = overlap
      bestPage = page.page
    }
    if (best >= 1) break
  }

  return {
    item,
    overlap: best,
    verified: best >= QUOTE_THRESHOLD,
    matchedPage: bestPage,
  }
}

export function verifyAll(items: GeneratedItem[], deck: Deck): VerifiedItem[] {
  return items.map((item) => verifyItem(item, deck))
}

/** The difficulty spread actually achieved, for the import report. */
export function difficultyMix(items: GeneratedItem[]): Record<string, number> {
  const mix: Record<string, number> = { easy: 0, moderate: 0, hard: 0, brutal: 0 }
  for (const item of items) mix[item.difficulty] = (mix[item.difficulty] ?? 0) + 1
  return mix
}

/**
 * Two items testing the same fact waste the student's time. Flags near-identical
 * stems so the assembler can drop one.
 */
export function findDuplicates(items: GeneratedItem[]): string[] {
  const dupes: string[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (quoteOverlap(items[i].stem, items[j].stem) > 0.85) {
        dupes.push(items[j].id)
      }
    }
  }
  return dupes
}
