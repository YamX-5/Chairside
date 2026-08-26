/**
 * What the morning's study session actually contains.
 *
 * WHY IT IS ITS OWN MODULE
 * ------------------------
 * Two things now display this material: the small screen ON the monitor in the
 * 3D room, and the large window that pops out of it when you sit down to read.
 * Deriving the card list twice is how the two would come to disagree about how
 * many cards there are — and the card counter is on one of them.
 *
 * Pure, no React and no three.js, so `studyContent.test.ts` can check the
 * derivation without a renderer.
 */

import type { CaseCore } from '../ingest/channels'

export interface Bi {
  en: string
  ar?: string
}

export interface StudyCard {
  id: string
  front: string
  back: string
  /**
   * Why this card is in the deck. Shown small under the answer — a flashcard
   * that cannot say where it came from is a flashcard a student cannot check.
   */
  source: string
}

export interface StudyMaterial {
  title: Bi
  /** The one-paragraph explanation of what went wrong and why. */
  reasoning: Bi
  cards: StudyCard[]
}

/**
 * Build the morning's material from the case.
 *
 * The takeaway card leads, because it is the single thing the day is trying to
 * teach; the load-bearing PROTOCOL facts follow, because those are the ones a
 * decision later in the day actually turns on. Facts that are neither are left
 * out on purpose — a revision deck padded with everything is a deck nobody
 * finishes.
 */
export function studyMaterial(core: CaseCore): StudyMaterial {
  const takeaway = core.debrief.takeawayCard
  const cards: StudyCard[] = [
    {
      id: 'takeaway',
      front: takeaway.front.en,
      back: takeaway.back.en,
      source: `Source: page ${takeaway.sourcePage}`,
    },
    ...core.facts
      .filter((f) => f.loadBearing && f.channel === 'PROTOCOL')
      .map((f) => ({
        id: f.id,
        front: f.label,
        back: f.value,
        source: f.category ? `${f.category}` : 'Protocol',
      })),
  ]

  return {
    title: core.title,
    reasoning: core.debrief.causalChain,
    cards,
  }
}
