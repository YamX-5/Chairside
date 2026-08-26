import assert from 'node:assert/strict'
import { CORE } from './caseFixture'
import { classify } from './classify'
import { cardsFromOutcome, isError, mergeCards, type StudyCard } from './studyCards'
import type { CommitTriad } from './channels'

function at(diagnosisId: string, siteFDI: string, procedureId: string): CommitTriad {
  return { diagnosisId, siteFDI, procedureId }
}

const CORRECT = at('d-reversible-pulpitis', '46', 'p-pulp-cap')
const EXTRACTED = at('d-reversible-pulpitis', '46', 'p-extraction') // fires class C
const ROOT_CANAL = at('d-reversible-pulpitis', '46', 'p-rct') // fires class E

// ---------------------------------------------------------------------------
// A clean run still earns something
// ---------------------------------------------------------------------------

{
  const verdict = classify(CORRECT, CORE)
  assert.ok(!isError(verdict.errorClass))

  const cards = cardsFromOutcome(CORE, verdict)
  assert.equal(cards.length, 1, 'a correct play earns the takeaway and nothing else')
  assert.equal(cards[0].origin, 'takeaway')
  assert.equal(cards[0].priority, 'normal', 'getting it right should not schedule aggressively')
  assert.equal(cards[0].sourcePage, CORE.debrief.takeawayCard.sourcePage)
}

// ---------------------------------------------------------------------------
// The mistake becomes the card
// ---------------------------------------------------------------------------

{
  const verdict = classify(EXTRACTED, CORE)
  assert.equal(verdict.errorClass, 'C_CONTRAINDICATION_IGNORED')

  const cards = cardsFromOutcome(CORE, verdict)
  const origins = cards.map((c) => c.origin)

  assert.ok(origins.includes('takeaway'))
  assert.ok(origins.includes('consequence'), 'the consequence must produce a card')
  assert.ok(origins.includes('missed-fact'), 'the ignored contraindication must produce a card')

  // The consequence card must carry the authored lesson VERBATIM. This is the
  // sentence that ties the memory of the bleeding to the rule that prevents it;
  // paraphrasing it here would quietly sever that link.
  const consequenceCard = cards.find((c) => c.origin === 'consequence')!
  assert.equal(consequenceCard.back.en, CORE.consequences.C_CONTRAINDICATION_IGNORED.teachesFact)
  assert.ok(consequenceCard.back.en.includes('INR'), 'expected the anticoagulant lesson')

  // The card about the fact nobody read out must cite the real lecture page.
  const warfarinCard = cards.find((c) => c.id.includes('f-warfarin'))!
  assert.ok(warfarinCard, 'the violated fact must yield a card')
  assert.equal(warfarinCard.sourcePage, 9, 'must cite the page the fact came from')
  assert.ok(warfarinCard.back.en.includes('warfarin'))

  // Everything born from a mistake is scheduled aggressively.
  assert.ok(cards.every((c) => c.priority === 'high'), 'error cards must all be high priority')
}

{
  // A different mistake must teach a different lesson, not the same generic one.
  const cVerdict = classify(EXTRACTED, CORE)
  const eVerdict = classify(ROOT_CANAL, CORE)
  assert.equal(eVerdict.errorClass, 'E_IRREVERSIBLE_ON_REVERSIBLE')

  const cBack = cardsFromOutcome(CORE, cVerdict).find((x) => x.origin === 'consequence')!.back.en
  const eBack = cardsFromOutcome(CORE, eVerdict).find((x) => x.origin === 'consequence')!.back.en

  assert.notEqual(cBack, eBack, 'different errors must produce different cards')
  assert.ok(eBack.includes('irritant'), 'the RCT error should teach the vital-pulp lesson')
}

// ---------------------------------------------------------------------------
// Facts that were dealt but never tabled
// ---------------------------------------------------------------------------

{
  const verdict = classify(ROOT_CANAL, CORE)

  // Nothing tabled: the student should be shown what they never asked for.
  const blind = cardsFromOutcome(CORE, verdict, new Set())
  const blindMissed = blind.filter((c) => c.origin === 'missed-fact')
  assert.ok(blindMissed.length > 0, 'untabled load-bearing facts must yield cards')

  // Everything tabled: they saw it all, so there is nothing to surface.
  const allSeen = new Set(CORE.facts.map((f) => f.id))
  const thorough = cardsFromOutcome(CORE, verdict, allSeen)
  assert.equal(
    thorough.filter((c) => c.origin === 'missed-fact').length,
    0,
    'a team that tabled everything must not be told they missed facts',
  )

  // A thorough team still earns the takeaway and the consequence lesson.
  assert.ok(thorough.length >= 2)
}

{
  // The cap matters more than it looks: a pile of reviews a student will not do
  // is worse than no pile, because it turns the habit into something to avoid.
  const verdict = classify(ROOT_CANAL, CORE)
  const cards = cardsFromOutcome(CORE, verdict, new Set())
  assert.ok(
    cards.filter((c) => c.origin === 'missed-fact').length <= 2,
    `missed-fact cards must be capped at 2, got ${cards.filter((c) => c.origin === 'missed-fact').length}`,
  )
}

// ---------------------------------------------------------------------------
// Ids are stable, so replays do not duplicate
// ---------------------------------------------------------------------------

{
  const verdict = classify(EXTRACTED, CORE)
  const first = cardsFromOutcome(CORE, verdict)
  const second = cardsFromOutcome(CORE, verdict)
  assert.deepEqual(
    first.map((c) => c.id),
    second.map((c) => c.id),
    'the same outcome must produce the same card ids',
  )

  const ids = new Set(first.map((c) => c.id))
  assert.equal(ids.size, first.length, 'no duplicate ids within one outcome')
}

// ---------------------------------------------------------------------------
// Merging into the existing pile
// ---------------------------------------------------------------------------

{
  const correct = cardsFromOutcome(CORE, classify(CORRECT, CORE))
  const wrong = cardsFromOutcome(CORE, classify(EXTRACTED, CORE))

  const merged = mergeCards(correct, wrong)
  const ids = new Set(merged.map((c) => c.id))
  assert.equal(ids.size, merged.length, 'merging must not duplicate')

  // Getting the same case wrong later is a stronger signal — the shared card
  // must be promoted, not left at its original priority.
  const takeaway = merged.find((c) => c.origin === 'takeaway')!
  assert.equal(takeaway.priority, 'high', 'a later failure must promote the takeaway card')

  // ...but a later SUCCESS must not demote a card earned by failing.
  const back = mergeCards(wrong, correct)
  assert.equal(
    back.find((c) => c.origin === 'takeaway')!.priority,
    'high',
    'getting it right later must not erase that you once got it wrong',
  )
}

{
  const empty: StudyCard[] = []
  const earned = cardsFromOutcome(CORE, classify(CORRECT, CORE))
  assert.deepEqual(mergeCards(empty, earned), earned, 'merging into an empty pile is identity')
  assert.deepEqual(mergeCards(earned, []), earned, 'merging nothing changes nothing')
}

console.log('studyCards.test.ts — all assertions passed')
