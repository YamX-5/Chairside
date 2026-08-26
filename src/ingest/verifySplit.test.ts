import assert from 'node:assert/strict'
import type { CaseCore, CommitTriad } from './channels'
import { CORE } from './caseFixture'
import { chanceBaseline, verifySplit, type SoloSolver } from './verifySplit'
import { dealCase } from './split'

/**
 * The solver is injected, so every case here runs headless, instantly, free.
 * A real run swaps in a cheap model; the pass/fail logic is identical either way.
 */

function correctTriad(core: CaseCore): CommitTriad {
  return {
    diagnosisId: core.groundTruth.diagnosisId,
    siteFDI: core.groundTruth.siteFDI,
    procedureId: core.groundTruth.correctProcedureId,
  }
}

/** Reasons only from what it was dealt. This is the behaviour we want to see. */
function honestSolver(core: CaseCore): SoloSolver {
  const needed = core.facts.filter((f) => f.loadBearing).map((f) => f.id)
  return async ({ packets }) => {
    const have = new Set(packets.flatMap((p) => p.facts).map((f) => f.id))
    return needed.every((id) => have.has(id)) ? correctTriad(core) : null
  }
}

/** Ignores the packets entirely — stands in for a leak, or for dental priors. */
function omniscientSolver(core: CaseCore): SoloSolver {
  return async () => correctTriad(core)
}

function hopelessSolver(): SoloSolver {
  return async () => null
}

// ---------------------------------------------------------------------------
// The chance baseline, conditioned on what a packet reveals
// ---------------------------------------------------------------------------

{
  const packets = dealCase(CORE, 3)
  const all = Object.values(packets)

  // 5 diagnoses x 5 procedures x the teeth actually visible.
  const union = chanceBaseline(CORE, all)
  assert.ok(
    Math.abs(union - 1 / (5 * 3 * 5)) < 1e-9,
    `union chance should be 1/75 across the three teeth in play, got ${union}`,
  )

  // A packet with no tooth-indexed facts is guessing among all 32 permanent teeth.
  const protocolOnly = all.find((p) => p.facts.every((f) => f.tooth === null))
  assert.ok(protocolOnly, 'expected a seat holding only case-level facts')
  assert.ok(
    Math.abs(chanceBaseline(CORE, [protocolOnly!]) - 1 / (5 * 32 * 5)) < 1e-9,
    'a packet revealing no tooth should face the full 32-tooth guess',
  )
}

{
  // THE CORRECTION THAT MATTERS. A packet whose facts all point at one tooth has
  // handed over the site leg: chance jumps from 0.125% to 4%. Score such a seat
  // against the naive 32-tooth baseline and a broken split sails through.
  const singleTooth: CaseCore = {
    ...CORE,
    facts: CORE.facts.filter((f) => f.tooth === null || f.tooth === CORE.groundTruth.siteFDI),
  }
  const packets = dealCase(singleTooth, 3)
  const imaging = Object.values(packets).find((p) => p.channels.includes('IMAGING'))!
  const chance = chanceBaseline(singleTooth, [imaging])
  assert.ok(
    Math.abs(chance - 1 / (5 * 1 * 5)) < 1e-9,
    `a one-tooth packet should face 1/25 chance, got ${chance}`,
  )
  assert.ok(chance > 0.03, 'and that is above the 5% slack, so the bound is meaningful')
}

// ---------------------------------------------------------------------------
// A well-formed split passes
// ---------------------------------------------------------------------------

for (const count of [2, 3] as const) {
  const report = await verifySplit(CORE, count, honestSolver(CORE))
  assert.equal(report.unionSolveRate, 1, `${count}P: union profile must solve the case`)
  assert.equal(report.maxSingleSolve, 0, `${count}P: no seat should solve alone`)
  assert.ok(report.passed, `${count}P split should pass: ${report.problems.join('; ')}`)
}

// ---------------------------------------------------------------------------
// A seat that knows too much is caught, and NAMED
// ---------------------------------------------------------------------------

{
  const report = await verifySplit(CORE, 3, omniscientSolver(CORE))
  assert.equal(report.unionSolveRate, 1)
  assert.equal(report.maxSingleSolve, 1, 'the omniscient solver solves from any single packet')
  assert.ok(!report.passed, 'a split solvable from one packet must fail')

  // The report has to say WHICH seat, or a failure is unactionable.
  assert.equal(Object.keys(report.perSeat).length, 3)
  for (const seat of Object.keys(report.perSeat)) {
    assert.ok(
      report.problems.some((p) => p.includes(seat)),
      `problems should name seat ${seat}`,
    )
  }
  assert.ok(report.problems.every((p) => p.includes('does not need its teammates')))
}

// ---------------------------------------------------------------------------
// An unsolvable case is caught too — that failure reads as the game cheating
// ---------------------------------------------------------------------------

{
  const report = await verifySplit(CORE, 3, hopelessSolver())
  assert.equal(report.unionSolveRate, 0)
  assert.ok(!report.passed)
  assert.ok(
    report.problems.some((p) => p.includes('unsolvable even with every packet')),
    `expected an unsolvable-union problem, got: ${report.problems.join('; ')}`,
  )
}

// ---------------------------------------------------------------------------
// The bounds are configurable, and actually applied
// ---------------------------------------------------------------------------

{
  // A solver that only sometimes succeeds should fail a strict union floor.
  let call = 0
  const flaky: SoloSolver = async ({ packets }) => {
    const isUnion = packets.length > 1
    call++
    return isUnion && call % 2 === 0 ? correctTriad(CORE) : null
  }
  const report = await verifySplit(CORE, 3, flaky, { attempts: 4, unionFloor: 0.9 })
  assert.ok(report.unionSolveRate < 0.9)
  assert.ok(!report.passed, 'a union rate below the floor must fail')
  assert.equal(report.attempts, 4, 'attempt count should be honoured')
}

{
  // Slack is what makes the hidden bound tolerant of lucky guesses rather than
  // brittle. With full slack, even an omniscient seat is accepted — proving the
  // knob is wired, not decorative.
  const report = await verifySplit(CORE, 3, omniscientSolver(CORE), { chanceSlack: 1 })
  assert.ok(report.passed, 'slack of 1.0 should admit any single-seat solve rate')
}

console.log('verifySplit.test.ts — all assertions passed')
