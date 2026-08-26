import type { CaseCore, ErrorClass, Fact } from './channels'
import type { Verdict } from './classify'

/**
 * Turning a played case into flashcards.
 *
 * The loop this closes is the whole point of the product: you get it wrong, the
 * patient reacts, the debrief explains why, and the explanation becomes a card
 * that comes back at you days later. The card is generated from YOUR mistake and
 * cites YOUR lecture's page — not a generic deck someone else wrote.
 *
 * That is retrieval practice aimed by error, which is the best-evidenced pairing
 * in the learning literature: testing beats re-reading, and testing on the thing
 * you specifically got wrong beats testing on everything equally.
 *
 * Deterministic on purpose. No model call — the cards are assembled from fields
 * the case already carries, so they cost nothing, work offline, and cannot
 * hallucinate a fact the lecture never said.
 */

export interface Localised {
  en: string
  ar?: string
}

export type CardOrigin =
  /** The case's headline lesson. Every play produces this one. */
  | 'takeaway'
  /** The mechanism behind the consequence that just fired. */
  | 'consequence'
  /** A load-bearing fact that was in someone's packet and never got used. */
  | 'missed-fact'

export interface StudyCard {
  id: string
  caseId: string
  front: Localised
  back: Localised
  /** The page of the student's own lecture. Clickable, checkable. */
  sourcePage: number
  origin: CardOrigin
  /**
   * Cards born from a mistake are scheduled sooner than cards born from a
   * success. The scheduler consumes this; it is not a display field.
   */
  priority: 'high' | 'normal'
}

/** Was this outcome a mistake? F_CORRECT is the only one that isn't. */
export function isError(errorClass: ErrorClass): boolean {
  return errorClass !== 'F_CORRECT'
}

function factCard(core: CaseCore, fact: Fact, origin: CardOrigin): StudyCard {
  return {
    id: `${core.id}:${origin}:${fact.id}`,
    caseId: core.id,
    // Asking for the fact by its clinical label trains the term, not the phrasing.
    front: { en: `${core.title.en} — what was the ${fact.category}?` },
    back: { en: `${fact.label}: ${fact.value}` },
    sourcePage: fact.sourcePage,
    origin,
    priority: 'high',
  }
}

/**
 * Every card this play earned.
 *
 * @param core     the case, server-side
 * @param verdict  what the classifier said about the committed triad
 * @param seen     ids of facts the team actually tabled. Facts that stayed
 *                 hidden in a packet are the most valuable cards available —
 *                 they are precisely what the student did not know to ask for.
 */
export function cardsFromOutcome(
  core: CaseCore,
  verdict: Verdict,
  seen: ReadonlySet<string> = new Set(),
): StudyCard[] {
  const cards: StudyCard[] = []

  // 1. The takeaway. Always present, so a clean run still earns something.
  cards.push({
    id: `${core.id}:takeaway`,
    caseId: core.id,
    front: core.debrief.takeawayCard.front,
    back: core.debrief.takeawayCard.back,
    sourcePage: core.debrief.takeawayCard.sourcePage,
    origin: 'takeaway',
    priority: isError(verdict.errorClass) ? 'high' : 'normal',
  })

  // 2. The mechanism behind whatever just happened to the patient.
  //
  // `teachesFact` is authored as the single sentence a consequence exists to
  // teach — "review INR before elective extraction in anticoagulated patients".
  // Lifting it verbatim is what ties the memory of the bleeding to the rule that
  // would have prevented it.
  const consequence = core.consequences[verdict.errorClass]
  if (consequence && isError(verdict.errorClass)) {
    cards.push({
      id: `${core.id}:consequence:${verdict.errorClass}`,
      caseId: core.id,
      front: { en: `${core.title.en} — why did that happen?` },
      back: { en: consequence.teachesFact },
      sourcePage: core.debrief.takeawayCard.sourcePage,
      origin: 'consequence',
      priority: 'high',
    })
  }

  // 3. The contraindication nobody read out. This is the co-op lesson, and it
  //    only exists as a card because the classifier recorded which fact fired.
  for (const factId of verdict.violatedFactIds) {
    const fact = core.facts.find((f) => f.id === factId)
    if (fact) cards.push(factCard(core, fact, 'missed-fact'))
  }

  // 4. Load-bearing facts that were dealt but never tabled.
  //
  // Capped at two: a student who blunders through a case should not be handed
  // eight new cards. Reviews they will not do are worse than no reviews — the
  // pile becomes something to avoid, and the habit dies with it.
  if (isError(verdict.errorClass)) {
    const missed = core.facts
      .filter((f) => f.loadBearing && !seen.has(f.id) && !verdict.violatedFactIds.includes(f.id))
      .slice(0, 2)
    for (const fact of missed) cards.push(factCard(core, fact, 'missed-fact'))
  }

  // Same fact reachable by two routes should still yield one card.
  const unique = new Map(cards.map((c) => [c.id, c]))
  return [...unique.values()]
}

/**
 * Merge freshly-earned cards into the student's existing pile.
 *
 * Replaying a case must not duplicate its cards, but it MUST be able to promote
 * one to high priority: getting the same case wrong on a second attempt is a
 * stronger signal than getting it wrong once.
 */
export function mergeCards(existing: StudyCard[], earned: StudyCard[]): StudyCard[] {
  const byId = new Map(existing.map((c) => [c.id, c]))
  for (const card of earned) {
    const prior = byId.get(card.id)
    if (!prior) {
      byId.set(card.id, card)
    } else if (card.priority === 'high' && prior.priority !== 'high') {
      byId.set(card.id, { ...prior, priority: 'high' })
    }
  }
  return [...byId.values()]
}
