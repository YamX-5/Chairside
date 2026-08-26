import assert from 'node:assert/strict'
import {
  ALL_CHANNELS,
  type CaseCore,
  type ChannelId,
  type CommitTriad,
} from './channels'
import {
  assertHandsNeverHoldProtocol,
  auditSplit,
  dealCase,
  forbiddenDisclosures,
  loadBearingReach,
  seatChannels,
  seatsFor,
  SplitError,
} from './split'
import { classify, isProcedureUnlocked } from './classify'
import { CORE } from './caseFixture'

// ---------------------------------------------------------------------------
// The invariant: hands never hold the protocol
// ---------------------------------------------------------------------------

for (const count of [1, 2, 3] as const) {
  assertHandsNeverHoldProtocol(count) // must not throw
}

{
  // Prove the guard actually fires rather than being decorative.
  const bad = { S1: ['CHAIR', 'PROTOCOL'] as ChannelId[], S2: ['RECORDS', 'IMAGING'] as ChannelId[] }
  let threw = false
  try {
    for (const [seat, channels] of Object.entries(bad)) {
      if (channels.includes('CHAIR') && channels.includes('PROTOCOL')) {
        throw new SplitError(`Seat ${seat} holds both`)
      }
    }
  } catch {
    threw = true
  }
  assert.ok(threw, 'a CHAIR+PROTOCOL seat must be rejected')
}

// ---------------------------------------------------------------------------
// The deal
// ---------------------------------------------------------------------------

{
  const packets = dealCase(CORE, 3)
  assert.deepEqual(Object.keys(packets).sort(), ['S1', 'S2', 'S3'])

  // Every fact reaches exactly one seat in the 3-player map.
  const seen = new Map<string, number>()
  for (const seat of seatsFor(3)) {
    for (const f of packets[seat].facts) seen.set(f.id, (seen.get(f.id) ?? 0) + 1)
  }
  for (const f of CORE.facts) {
    assert.equal(seen.get(f.id), 1, `fact ${f.id} should reach exactly one seat, got ${seen.get(f.id) ?? 0}`)
  }
}

// ---------------------------------------------------------------------------
// THE WIRE-LEAK TEST — the one that actually protects the design
// ---------------------------------------------------------------------------

for (const count of [2, 3] as const) {
  const packets = dealCase(CORE, count)

  for (const seat of seatsFor(count)) {
    const mine = seatChannels(count, seat)
    const wire = JSON.stringify(packets[seat])

    // Strings this seat is entitled to see. A secret that also appears in one of
    // the seat's OWN facts is not evidence of a leak — two facts can legitimately
    // cite the same sentence from the deck, and flagging that would train us to
    // ignore the test.
    const entitled = new Set(
      packets[seat].facts.flatMap((own) => forbiddenDisclosures(own)),
    )

    for (const f of CORE.facts) {
      if (mine.includes(f.channel)) continue

      // Structural: the foreign fact must be absent entirely, not merely redacted.
      assert.ok(
        !packets[seat].facts.some((own) => own.id === f.id),
        `${count}P seat ${seat} received foreign fact ${f.id}`,
      )

      // Substring: nothing about it may survive anywhere in the payload. Short
      // strings are skipped because `"yes"` or `"7mm"` collide by coincidence —
      // which is precisely why the structural assertion above exists as well.
      for (const secret of forbiddenDisclosures(f)) {
        if (secret.length < 8 || entitled.has(secret)) continue
        assert.ok(
          !wire.includes(secret),
          `${count}P seat ${seat} wire payload leaked "${secret.slice(0, 40)}..." from ${f.id}`,
        )
      }
    }

    // Ground truth must never reach any seat, in any form.
    assert.ok(!wire.includes('groundTruth'), `seat ${seat} received a groundTruth key`)
    assert.ok(
      !wire.includes(CORE.groundTruth.correctProcedureId) ||
        CORE.options.procedures.some((p) => p.id === CORE.groundTruth.correctProcedureId),
      'correct procedure id may only appear as one option among many',
    )
  }
}

// The tooth number is the join key: no seat may DEDUCE the site from its own
// packet alone.
//
// The subtle failure this guards is not a leaked field — it is a packet whose
// tooth-indexed facts all point at one tooth. That seat reads its own chart,
// sees findings for exactly one tooth, and concludes that must be the one. The
// data was never "leaked"; the distribution gave it away.
{
  const packets = dealCase(CORE, 3)
  const chairSeat = seatsFor(3).find((s) => seatChannels(3, s).includes('CHAIR'))!
  const protocolSeat = seatsFor(3).find((s) => seatChannels(3, s).includes('PROTOCOL'))!
  assert.ok(chairSeat !== protocolSeat, 'CHAIR and PROTOCOL must be different seats')

  for (const seat of seatsFor(3)) {
    if (seat === chairSeat) continue // CHAIR is *supposed* to know; it reads the mouth
    const teeth = new Set(packets[seat].facts.filter((f) => f.tooth !== null).map((f) => f.tooth))
    if (teeth.size === 0) continue // holds only case-level facts, learns nothing — fine
    assert.ok(
      teeth.size > 1,
      `seat ${seat} sees tooth-indexed facts for only ${[...teeth][0]} — it can deduce the site without asking`,
    )
    assert.ok(
      teeth.has(CORE.groundTruth.siteFDI),
      `seat ${seat} must hold data for the affected tooth, among others`,
    )
  }
}

// And the audit must reject a case that omits the distractors.
{
  const noDistractors: CaseCore = {
    ...CORE,
    facts: CORE.facts.filter((f) => f.tooth === null || f.tooth === CORE.groundTruth.siteFDI),
  }
  const audit = auditSplit(noDistractors, 3)
  assert.ok(!audit.ok, 'a case with findings only for the affected tooth must fail the audit')
  assert.ok(
    audit.problems.some((p) => p.includes('gives away the site')),
    `expected a site-giveaway problem, got: ${audit.problems.join('; ')}`,
  )
}

// Counts disclose volume, not content.
{
  const packets = dealCase(CORE, 3)
  for (const seat of seatsFor(3)) {
    const mine = seatChannels(3, seat)
    for (const channel of ALL_CHANNELS) {
      const count = packets[seat].otherChannelFactCounts[channel]
      if (mine.includes(channel)) {
        assert.equal(count, undefined, `seat ${seat} should not get a count for its own ${channel}`)
      } else {
        const actual = CORE.facts.filter((f) => f.channel === channel).length
        assert.equal(count, actual, `seat ${seat} count for ${channel}`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The audit: a split that looks fine but is decorative
// ---------------------------------------------------------------------------

{
  const clean = auditSplit(CORE, 3)
  assert.ok(clean.ok, `well-formed split should audit clean, got: ${clean.problems.join('; ')}`)
}

{
  // Put every load-bearing fact in one channel. The split now proves nothing.
  const collapsed: CaseCore = {
    ...CORE,
    facts: CORE.facts.map((f) => (f.loadBearing ? { ...f, channel: 'RECORDS' as const } : f)),
  }
  const audit = auditSplit(collapsed, 3)
  assert.ok(!audit.ok, 'a split where one seat sees every load-bearing fact must fail the audit')
  assert.ok(
    audit.problems.some((p) => p.includes('solve the case alone')),
    `expected a solvable-alone problem, got: ${audit.problems.join('; ')}`,
  )
}

{
  // A contraindication pointing at a fact nobody holds means class C can never fire.
  const orphaned: CaseCore = {
    ...CORE,
    groundTruth: {
      ...CORE.groundTruth,
      contraindications: [{ factId: 'f-does-not-exist', blocksProcedureIds: ['p-extraction'] }],
    },
  }
  const audit = auditSplit(orphaned, 3)
  assert.ok(!audit.ok, 'an orphaned contraindication must fail the audit')
}

{
  const reach = loadBearingReach(CORE, 3)
  const total = CORE.facts.filter((f) => f.loadBearing).length
  for (const seat of seatsFor(3)) {
    assert.ok(reach[seat].visible < total, `seat ${seat} must not see every load-bearing fact`)
    assert.equal(reach[seat].total, total)
  }
}

// ---------------------------------------------------------------------------
// Classification — every error class, in precedence order
// ---------------------------------------------------------------------------

function at(diagnosisId: string, siteFDI: string, procedureId: string): CommitTriad {
  return { diagnosisId, siteFDI, procedureId }
}

// C wins over everything else that also applies: extraction here is ALSO
// irreversible-on-reversible and ALSO not the indicated procedure, but the
// contraindication is the teachable failure and the co-op payoff.
{
  const v = classify(at('d-reversible-pulpitis', '46', 'p-extraction'), CORE)
  assert.equal(v.errorClass, 'C_CONTRAINDICATION_IGNORED', v.reason)
  assert.deepEqual(v.violatedFactIds, ['f-warfarin'])
}

// E: irreversible procedure on a case that was manageable reversibly.
{
  const v = classify(at('d-reversible-pulpitis', '46', 'p-rct'), CORE)
  assert.equal(v.errorClass, 'E_IRREVERSIBLE_ON_REVERSIBLE', v.reason)
}

// A: wrong diagnosis, right tooth.
{
  const v = classify(at('d-cracked-tooth', '46', 'p-pulp-cap'), CORE)
  assert.equal(v.errorClass, 'A_WRONG_DX_RIGHT_SITE', v.reason)
}

// A also absorbs "both wrong" — the diagnosis is the upstream error.
{
  const v = classify(at('d-cracked-tooth', '47', 'p-pulp-cap'), CORE)
  assert.equal(v.errorClass, 'A_WRONG_DX_RIGHT_SITE', v.reason)
  assert.ok(v.reason.includes('47'), 'reason should name the tooth actually treated')
}

// B: right diagnosis, wrong tooth. This is the one the FDI mechanic exists to cause.
{
  const v = classify(at('d-reversible-pulpitis', '47', 'p-pulp-cap'), CORE)
  assert.equal(v.errorClass, 'B_RIGHT_DX_WRONG_SITE', v.reason)
}

// D: right call, wrong tool — only checked when instrument context is supplied.
{
  const correct = at('d-reversible-pulpitis', '46', 'p-pulp-cap')
  const v = classify(correct, CORE, { instrumentId: 'i-axe', expectedInstrumentId: 'i-slow-handpiece' })
  assert.equal(v.errorClass, 'D_WRONG_INSTRUMENT', v.reason)

  const noCtx = classify(correct, CORE)
  assert.equal(noCtx.errorClass, 'F_CORRECT', 'omitting instrument context must skip the D check')
}

// F: everything right.
{
  const v = classify(at('d-reversible-pulpitis', '46', 'p-pulp-cap'), CORE)
  assert.equal(v.errorClass, 'F_CORRECT', v.reason)
  assert.deepEqual(v.violatedFactIds, [])
}

// A malformed commit must not crash a live round.
{
  const v = classify(at('d-reversible-pulpitis', '46', 'p-does-not-exist'), CORE)
  assert.equal(v.errorClass, 'A_WRONG_DX_RIGHT_SITE')
  assert.ok(v.reason.includes('Unknown procedure'))
}

// Right diagnosis and tooth, but a procedure that is neither indicated nor
// irreversible — still wrong, and must not fall through to F.
{
  const v = classify(at('d-reversible-pulpitis', '46', 'p-monitor'), CORE)
  assert.notEqual(v.errorClass, 'F_CORRECT', 'only the indicated procedure may score as correct')
}

// ---------------------------------------------------------------------------
// The commit gate
// ---------------------------------------------------------------------------

assert.ok(isProcedureUnlocked(CORE, 'd-reversible-pulpitis', 'p-pulp-cap'))
assert.ok(!isProcedureUnlocked(CORE, 'd-reversible-pulpitis', 'p-extraction'), 'gate must block extraction')
assert.ok(isProcedureUnlocked(CORE, 'd-irreversible-pulpitis', 'p-rct'))
assert.ok(!isProcedureUnlocked(CORE, 'd-unknown', 'p-pulp-cap'), 'unknown diagnosis unlocks nothing')

console.log('split.test.ts — all assertions passed')