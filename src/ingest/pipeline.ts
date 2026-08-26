import { currentModel, generate } from './client'
import { deckToText, pagesToText, type Deck } from './pdf'
import {
  BLUEPRINT_SYSTEM,
  CASE_SYSTEM,
  ITEM_SYSTEM,
  REVIEW_SYSTEM,
} from './prompts'
import {
  Blueprint,
  BLUEPRINT_JSON_SCHEMA,
  CASE_JSON_SCHEMA,
  GeneratedCase,
  REVIEW_JSON_SCHEMA,
  ReviewResult,
  TOPIC_ITEMS_JSON_SCHEMA,
  TopicItems,
  type GeneratedItem,
} from './schemas'
import { assembleDay, type AssembleReport } from './assemble'
import { chooseFilm, filmInstruction, type FilmCandidate, type FilmChoice } from './filmChoice'

export type Stage =
  | { name: 'reading' }
  | { name: 'blueprint' }
  | { name: 'writing'; done: number; total: number }
  | { name: 'reviewing'; done: number; total: number }
  | { name: 'film' }
  | { name: 'case' }
  | { name: 'assembling' }

export interface RunOptions {
  deck: Deck
  onStage: (stage: Stage) => void
  /** How many topic calls run at once. Keeps well inside per-minute limits. */
  concurrency?: number
  /**
   * Radiographs extracted from this same deck, from pdfImages.extractRadiographs.
   *
   * Optional: a deck with no films still produces a complete day, it just gets a
   * case whose imaging arrives as a written report instead of a picture.
   */
  radiographs?: FilmCandidate[]
}

export interface PipelineResult extends AssembleReport {
  /** Which film the case was built around, and why. null when none was usable. */
  film: FilmChoice | null
}

/** Run n promises at a time, preserving input order in the output. */
async function pooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

/**
 * The full generation run.
 *
 * The deck text is the cached prefix on every call, so a 60-page deck is billed
 * at full input price once and at cache-read rates for every topic after that.
 */
export async function runPipeline(opts: RunOptions): Promise<PipelineResult> {
  const { deck, onStage, concurrency = 3, radiographs = [] } = opts
  const fullText = deckToText(deck)
  const deckContext = `Here is the complete lecture deck, page by page.\n\n${fullText}`

  onStage({ name: 'blueprint' })
  const blueprint = await generate({
    system: BLUEPRINT_SYSTEM,
    cachedContext: deckContext,
    instruction:
      'Build the examination blueprint for this deck. Weight each topic by how much the deck itself emphasises it.',
    schema: BLUEPRINT_JSON_SCHEMA,
    effort: 'high',
    parse: (raw) => Blueprint.parse(raw),
  })

  const total = blueprint.topics.length
  let written = 0
  onStage({ name: 'writing', done: 0, total })

  const topicResults = await pooled(blueprint.topics, concurrency, async (topic) => {
    const focused = pagesToText(deck, topic.pages)
    const result = await generate({
      system: ITEM_SYSTEM,
      cachedContext: deckContext,
      instruction: [
        `Write ${topic.itemCount} items for this topic.`,
        ``,
        `TOPIC: ${topic.title}`,
        `OBJECTIVE: ${topic.objective}`,
        `PAGES: ${topic.pages.join(', ')}`,
        ``,
        `The relevant pages again, for precision:`,
        focused,
        ``,
        `Give each item an id starting with "${topic.id}-". Span the difficulty`,
        `range across the set — at least one item that requires genuine`,
        `multi-step reasoning, and do not pad with recall items you know are`,
        `too easy for this level.`,
      ].join('\n'),
      schema: TOPIC_ITEMS_JSON_SCHEMA,
      effort: 'xhigh',
      parse: (raw) => TopicItems.parse(raw),
    })
    written++
    onStage({ name: 'writing', done: written, total })
    return { topic, result }
  })

  let reviewed = 0
  onStage({ name: 'reviewing', done: 0, total })

  const reviewedTopics = await pooled(topicResults, concurrency, async (entry) => {
    const review = await generate({
      system: REVIEW_SYSTEM,
      cachedContext: deckContext,
      instruction: [
        `Review these items against the deck. Return one verdict per item.`,
        ``,
        JSON.stringify(entry.result.items, null, 2),
      ].join('\n'),
      schema: REVIEW_JSON_SCHEMA,
      effort: 'xhigh',
      parse: (raw) => ReviewResult.parse(raw),
    })

    const byId = new Map(review.verdicts.map((v) => [v.itemId, v]))
    const survivors: GeneratedItem[] = []
    for (const item of entry.result.items) {
      const verdict = byId.get(item.id)
      if (!verdict || verdict.verdict === 'keep') survivors.push(item)
      else if (verdict.verdict === 'revise' && verdict.revised)
        survivors.push({ ...verdict.revised, id: item.id })
      // 'cut' — and 'revise' with no replacement — drop out.
    }

    reviewed++
    onStage({ name: 'reviewing', done: reviewed, total })
    return { topic: entry.topic, result: { ...entry.result, items: survivors } }
  })

  // Image first, then the case around it. Generating the case and THEN looking
  // for a picture produces cases whose radiographic findings exist in no film
  // the student can be shown.
  onStage({ name: 'film' })
  const film = await chooseFilm({ deck, films: radiographs, deckContext })

  onStage({ name: 'case' })
  const patientCase = await generate({
    system: CASE_SYSTEM,
    cachedContext: deckContext,
    instruction: [
      `Write the patient encounter for this scenario:`,
      blueprint.caseScenario,
      ``,
      filmInstruction(film),
      ``,
      `The decisions must exercise the reasoning taught in this deck, in the`,
      `order the encounter actually unfolds.`,
    ].join('\n'),
    schema: CASE_JSON_SCHEMA,
    effort: 'xhigh',
    parse: (raw) => GeneratedCase.parse(raw),
  })

  onStage({ name: 'assembling' })
  const report = assembleDay({
    blueprint,
    topics: reviewedTopics,
    patientCase,
    deck,
    model: currentModel(),
  })

  return { ...report, film: film.page === null ? null : film }
}
