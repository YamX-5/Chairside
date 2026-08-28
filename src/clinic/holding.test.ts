import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { INSTRUMENTS, TRAY_INSTRUMENTS, UNIT_INSTRUMENTS, CLOSET_INSTRUMENTS, DRAWER_INSTRUMENTS } from './instruments'

/**
 * HOLDING AN INSTRUMENT MUST NOT BE GATED. Using one on the patient must be.
 *
 * This is a dentistry game. Picking up a tool is not a feature of it, it is the
 * whole verb. For several rounds the one thing a player could not do was hold
 * anything, and every time it was a different gate:
 *
 *   - the tray only rendered after the patient had been called AND her walk-in
 *     animation had finished, so before that there was no geometry in the room
 *     to click at all;
 *   - `enabled` required a committed plan, so clicking a visible instrument
 *     refused;
 *   - the plan could only be committed on the chart, and on a phone the chart
 *     could be opened but never closed, so `planned` could never become true.
 *
 * Each was defensible on its own. Together they made the game's core action
 * unreachable. The teaching intent — decide before you drill — belongs on the
 * verb that touches the patient, not on the verb that picks a tool off a bench.
 *
 * This is a SOURCE-LEVEL assertion, which is unusual here and deliberate. The
 * failure was never in a value a unit test could read; it was in which
 * conditions were wired to which JSX. So it reads the wiring.
 */

const clinic = readFileSync('src/clinic/ClinicCase.tsx', 'utf8')

// ---------------------------------------------------------------------------
// The tray must exist for the whole clinic day
// ---------------------------------------------------------------------------

{
  const mount = clinic.match(/\{\(day === 'clinic' \|\| day === 'done'\) && \(\s*<InstrumentTray/)
  assert.ok(
    mount,
    'InstrumentTray is no longer mounted for the whole clinic day. If it is ' +
      'gated on `called` or `arrival` again, there is no instrument geometry in ' +
      'the room until the patient has walked in — nothing to look at, nothing ' +
      'to click, and no message saying why.',
  )
}

// ---------------------------------------------------------------------------
// Picking up must not require a plan
// ---------------------------------------------------------------------------

{
  const enabled = clinic.match(/enabled=\{([^}]*)\}/)
  assert.ok(enabled, 'InstrumentTray lost its `enabled` prop entirely')
  assert.ok(
    !/planned/.test(enabled[1]),
    `InstrumentTray's enabled is \`${enabled[1].trim()}\`, which gates PICKING ` +
      `UP on a committed plan. Hold freely; the gate belongs on using it.`,
  )
}

// ---------------------------------------------------------------------------
// ...but treating the patient still must
// ---------------------------------------------------------------------------
//
// The lesson has to survive the fix, or this trade was a straight loss.

{
  assert.ok(
    /planned && heldId && nearestRef\.current === 'solve'/.test(clinic),
    'the treat-the-patient branch no longer requires a committed plan. Holding ' +
      'was ungated so the game is playable; putting a drill in someone\'s mouth ' +
      'without deciding anything first is the thing the game exists to teach ' +
      'against.',
  )
}

// ---------------------------------------------------------------------------
// Everything the player can see must be reachable from somewhere
// ---------------------------------------------------------------------------

{
  const buckets = [
    ['tray', TRAY_INSTRUMENTS],
    ['unit', UNIT_INSTRUMENTS],
    ['closet', CLOSET_INSTRUMENTS],
    ['drawer', DRAWER_INSTRUMENTS],
  ] as const
  const placed = new Set<string>()
  for (const [, list] of buckets) for (const i of list) placed.add(i.id)

  for (const inst of INSTRUMENTS) {
    if (inst.storage === 'shelf') continue // the X-ray, on its own dock
    assert.ok(
      placed.has(inst.id),
      `'${inst.id}' has storage '${inst.storage}' but appears in no rendered ` +
        `bucket, so it is in the table and not in the room`,
    )
  }
}

console.log(
  `holding.test.ts — tray mounts for the clinic day, pick-up ungated, ` +
    `treatment still gated on a plan, ${INSTRUMENTS.length} instruments all ` +
    `placed, all assertions passed`,
)
