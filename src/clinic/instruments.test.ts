import assert from 'node:assert/strict'
import {
  CLOSET_INSTRUMENTS,
  DRAWER_INSTRUMENTS,
  UNIT_INSTRUMENTS,
  SHELF_INSTRUMENTS,
  type Instrument,
  type Storage,
  expectedInstrumentFor,
  INSTRUMENT_BY_ID,
  INSTRUMENTS,
  PROCEDURE_INSTRUMENT,
  TRAY_INSTRUMENTS,
  trayLayout,
} from './instruments'
import { CORE } from '../ingest/caseFixture'
import { classify } from '../ingest/classify'
import type { CommitTriad } from '../ingest/channels'

// ---------------------------------------------------------------------------
// The set itself
// ---------------------------------------------------------------------------

{
  const ids = new Set(INSTRUMENTS.map((i) => i.id))
  assert.equal(ids.size, INSTRUMENTS.length, 'instrument ids must be unique')

  const nodes = new Set(INSTRUMENTS.map((i) => i.node))
  assert.equal(nodes.size, INSTRUMENTS.length, 'GLB node names must be unique')

  for (const i of INSTRUMENTS) {
    assert.ok(i.label.length > 0, `${i.id} needs a label`)
    // Naming what each tool is FOR is the cheapest teaching in the game; an
    // instrument with no stated purpose is just a prop.
    assert.ok(i.use.length > 0, `${i.id} needs a stated purpose`)
  }
}

{
  // Exactly one absurd instrument. Two would make the joke a category rather
  // than a moment; none and the tray is a menu.
  const absurd = INSTRUMENTS.filter((i) => i.absurd)
  assert.equal(absurd.length, 1, 'expected exactly one absurd instrument')
  assert.equal(absurd[0].id, 'axe')

  // And it is NEVER on the set-up tray. Lying in a row with the mirror and the
  // probe, it reads as one of nine options; behind a cabinet door, taking it is
  // a decision the player made.
  assert.equal(absurd[0].storage, 'closet', 'the axe must live in the cabinet')
}

{
  // Every instrument is stored somewhere reachable.
  //
  // Checked against the BUCKETS, not a hand-typed list of storage names. The
  // list version silently failed the moment 'shelf' was added: the union type
  // accepted it, `SHELF_INSTRUMENTS` collected it, and the assertion still said
  // it could never be picked up. Derive the truth from the same place the
  // renderer reads it from.
  // Exhaustive by TYPE: adding a Storage variant without a bucket here is a
  // compile error, not a silent gap. That is deliberate — it caught 'drawer'
  // the moment it was added.
  const buckets: Record<Storage, readonly Instrument[]> = {
    tray: TRAY_INSTRUMENTS,
    closet: CLOSET_INSTRUMENTS,
    drawer: DRAWER_INSTRUMENTS,
    unit: UNIT_INSTRUMENTS,
    shelf: SHELF_INSTRUMENTS,
  }
  for (const i of INSTRUMENTS) {
    const bucket = buckets[i.storage]
    assert.ok(
      bucket && bucket.some((b) => b.id === i.id),
      `${i.id} is stored in "${i.storage}", which nothing renders — it can never be picked up`,
    )
  }
  const placed = Object.values(buckets).reduce((n, b) => n + b.length, 0)
  assert.equal(placed, INSTRUMENTS.length, 'every instrument must be in exactly one place')

  // The tray must carry the basics — a surgery where you fetch the mirror from
  // a cupboard is not a surgery.
  for (const id of ['mirror', 'probe', 'suction'] as const) {
    assert.equal(INSTRUMENT_BY_ID.get(id)!.storage, 'tray', `${id} belongs on the tray`)
  }
}

// ---------------------------------------------------------------------------
// Every procedure in the case must have an instrument, and vice versa
// ---------------------------------------------------------------------------

for (const p of CORE.options.procedures) {
  const inst = expectedInstrumentFor(p.id)
  assert.ok(
    inst !== null,
    `procedure "${p.id}" has no instrument mapped — the player could never perform it correctly`,
  )
  assert.ok(
    INSTRUMENT_BY_ID.has(inst!),
    `procedure "${p.id}" maps to "${inst}", which is not on the tray`,
  )
}

{
  // Nothing may require the axe, ever.
  for (const [proc, inst] of Object.entries(PROCEDURE_INSTRUMENT)) {
    assert.notEqual(inst, 'axe', `procedure "${proc}" requires an axe, which cannot be right`)
  }
}

assert.equal(expectedInstrumentFor(null), null)
assert.equal(expectedInstrumentFor('p-does-not-exist'), null, 'unknown procedure maps to nothing')

// ---------------------------------------------------------------------------
// The instrument actually changes the verdict — this is the whole point
// ---------------------------------------------------------------------------

function at(diagnosisId: string, siteFDI: string, procedureId: string): CommitTriad {
  return { diagnosisId, siteFDI, procedureId }
}

const CORRECT = at('d-reversible-pulpitis', '46', 'p-pulp-cap')

{
  // Right plan, right tool.
  const expected = expectedInstrumentFor('p-pulp-cap')!
  const v = classify(CORRECT, CORE, { instrumentId: expected, expectedInstrumentId: expected })
  assert.equal(v.errorClass, 'F_CORRECT', v.reason)
}

{
  // Right plan, the AXE. This is the moment the tray exists for.
  const expected = expectedInstrumentFor('p-pulp-cap')!
  const v = classify(CORRECT, CORE, { instrumentId: 'axe', expectedInstrumentId: expected })
  assert.equal(v.errorClass, 'D_WRONG_INSTRUMENT', v.reason)
  assert.ok(v.reason.includes('axe'), 'the verdict should name what they picked up')
}

{
  // Right plan, a plausible-but-wrong tool — forceps for a pulp cap.
  const expected = expectedInstrumentFor('p-pulp-cap')!
  const v = classify(CORRECT, CORE, { instrumentId: 'forceps', expectedInstrumentId: expected })
  assert.equal(v.errorClass, 'D_WRONG_INSTRUMENT', v.reason)
}

{
  // A wrong PLAN outranks a wrong tool. Handing someone the right forceps for
  // an extraction they should never have chosen is not an instrument error.
  const v = classify(
    at('d-reversible-pulpitis', '46', 'p-extraction'),
    CORE,
    { instrumentId: 'forceps', expectedInstrumentId: 'forceps' },
  )
  assert.equal(
    v.errorClass,
    'C_CONTRAINDICATION_IGNORED',
    'the contraindication must still win over the tool check',
  )
}

// ---------------------------------------------------------------------------
// Tray layout
// ---------------------------------------------------------------------------

{
  const xs = trayLayout(INSTRUMENTS.length)
  assert.equal(xs.length, INSTRUMENTS.length)

  // Centred, so adding an instrument does not shove the tray off its stand.
  const mid = (xs[0] + xs[xs.length - 1]) / 2
  assert.ok(Math.abs(mid) < 1e-9, `layout should be centred, midpoint was ${mid}`)

  // No two instruments may share a slot — the class of bug that put a spittoon
  // in someone's lap.
  for (let i = 1; i < xs.length; i++) {
    assert.ok(xs[i] > xs[i - 1], 'slots must be strictly increasing')
    assert.ok(xs[i] - xs[i - 1] > 0.03, 'slots must be far enough apart to click separately')
  }

  assert.deepEqual(trayLayout(1), [0], 'a single instrument sits centred')
}

console.log(`instruments.test.ts — ${INSTRUMENTS.length} instruments, all assertions passed`)
