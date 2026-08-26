import * as pdfjs from 'pdfjs-dist'
// Vite resolves this to a hashed asset URL; the worker must not be inlined or
// large PDFs block the main thread and freeze the UI mid-extraction.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface DeckPage {
  page: number
  text: string
}

export interface Deck {
  fileName: string
  pages: DeckPage[]
}

/**
 * Extract text page by page. Page numbers are carried through the whole
 * pipeline so every generated item can cite where it came from — a citation
 * the student can actually check is the difference between a study tool and a
 * plausible-sounding guess.
 */
export async function extractDeck(file: File): Promise<Deck> {
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pages: DeckPage[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    pages.push({ page: i, text })
    page.cleanup()
  }

  await doc.cleanup()
  return { fileName: file.name, pages }
}

/** The whole deck as one prompt-ready string with page markers. */
export function deckToText(deck: Deck): string {
  return deck.pages
    .filter((p) => p.text.length > 0)
    .map((p) => `[Page ${p.page}]\n${p.text}`)
    .join('\n\n')
}

/** Just the pages a blueprint topic points at, for focused item writing. */
export function pagesToText(deck: Deck, pageNumbers: number[]): string {
  const wanted = new Set(pageNumbers)
  return deck.pages
    .filter((p) => wanted.has(p.page) && p.text.length > 0)
    .map((p) => `[Page ${p.page}]\n${p.text}`)
    .join('\n\n')
}

/** Rough token estimate for cost display. Deliberately approximate. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

/**
 * A deck that extracts almost no text is a scanned image, not a text PDF —
 * worth catching early rather than sending an empty prompt to the model.
 */
export function looksScanned(deck: Deck): boolean {
  const total = deck.pages.reduce((n, p) => n + p.text.length, 0)
  return deck.pages.length > 0 && total / deck.pages.length < 80
}
