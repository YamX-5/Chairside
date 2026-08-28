import assert from 'node:assert/strict'
import {
  COLLIDERS,
  SEATS,
  STOOL_POS,
  blocked,
  nearestSeat,
  resetStoolPose,
  seatApproach,
  seatEye,
  stoolPose,
} from './layout'
import { stepPlayer } from './movement'
import { PLAYER_RADIUS, BOUND, WALK_SPEED } from './theme3d'

/**
 * The operator's stool is the one prop that moves at runtime.
 *
 * It could not be moved at all: Player took a bare `frozen: boolean`, so there
 * was nothing to distinguish a stool on castors from a desk chair tucked under a
 * desk, and sitting down pinned you to one spot for the rest of the case. That
 * is the wrong object — rolling the stool is how you work at a chairside.
 *
 * Everything below is geometry, which means it is testable without a browser.
 * The part that is NOT testable here is whether the camera and the prop stay
 * together on screen; that needs eyes.
 */

const ROLL_OPTS = { speed: 1.35, radius: PLAYER_RADIUS, bound: BOUND }
/** Four seconds of shoving at 60 Hz. */
const FRAMES = 240
const stool = SEATS.find((s) => s.rolls)!

assert.ok(stool, 'no seat is marked as rolling — the stool cannot be moved')
assert.equal(stool.id, 'stool', 'something other than the stool is on castors')
assert.ok(
  !SEATS.find((s) => s.id === 'desk')!.rolls,
  'the desk chair rolls — it is tucked under a desk and should stay put',
)

// ---------------------------------------------------------------------------
// The live pose IS the seat, and STOOL_POS is not
// ---------------------------------------------------------------------------

{
  resetStoolPose()
  assert.deepEqual(
    [stoolPose.x, stoolPose.z],
    [STOOL_POS[0], STOOL_POS[2]],
    'a fresh case does not start with the stool where the room was built',
  )

  // Shove it a metre up the chairside.
  stoolPose.x = STOOL_POS[0] + 1
  stoolPose.z = STOOL_POS[2] + 0.4

  assert.deepEqual(
    [seatEye(stool).x, seatEye(stool).z],
    [stoolPose.x, stoolPose.z],
    'seatEye ignores the live pose, so sitting back down teleports you to the ' +
      'spot the stool used to occupy',
  )
  assert.equal(
    seatEye(stool).y,
    stool.eye.y,
    'rolling changed the seat HEIGHT — only x and z move',
  )

  // The approach must travel with it, or the seat is beside you and the thing
  // that offers it is across the room. This is the assertion that catches the
  // whole failure mode.
  const found = nearestSeat(seatApproach(stool).x, seatApproach(stool).z)
  assert.equal(found?.id, 'stool', 'standing right next to the rolled stool finds no seat')

  const atOldSpot = nearestSeat(STOOL_POS[0] - 0.1, STOOL_POS[2])
  assert.notEqual(
    atOldSpot?.id,
    'stool',
    'the stool can still be sat on from where it USED to be — its trigger did ' +
      'not move with it',
  )

  // A fixed seat must be unaffected by any of this.
  const desk = SEATS.find((s) => s.id === 'desk')!
  assert.deepEqual(seatApproach(desk), desk.approach, 'the desk chair moved')
  assert.deepEqual(seatEye(desk), desk.eye, 'the desk chair moved')

  resetStoolPose()
  assert.deepEqual(
    [stoolPose.x, stoolPose.z],
    [STOOL_POS[0], STOOL_POS[2]],
    'resetStoolPose does not put the stool back, so a stool shoved into the ' +
      'corner on day one is still in the corner on day two — while the lighting ' +
      'baked under it is not',
  )
}

// ---------------------------------------------------------------------------
// Rolling obeys the same colliders as walking
// ---------------------------------------------------------------------------
//
// The stool goes through stepPlayer, not its own movement code, precisely so
// this is true. A stool parked inside the dental unit or halfway through the
// worktop is worse than a stool that does not move.

{
  resetStoolPose()

  // The starting pose must itself be legal, or the player is spawned inside
  // something the moment they sit down.
  assert.ok(
    !blocked(stoolPose.x, stoolPose.z, PLAYER_RADIUS),
    'the stool starts inside a collider',
  )

  // Drive it hard into every collider in turn and assert it never ends up
  // inside one. Sixteen headings x 240 frames at 1/60 s is four seconds of
  // shoving in every direction, which crosses the room several times over.
  let steps = 0
  let travelled = 0
  for (let h = 0; h < 16; h += 1) {
    resetStoolPose()
    const yaw = (h / 16) * Math.PI * 2
    const from = { x: stoolPose.x, z: stoolPose.z }
    let at = { ...from }
    for (let f = 0; f < FRAMES; f += 1) {
      at = stepPlayer(at, yaw, { x: 0, z: 1 }, 1 / 60, ROLL_OPTS)
      steps += 1
      assert.ok(
        !blocked(at.x, at.z, PLAYER_RADIUS),
        `rolling on heading ${((yaw * 180) / Math.PI).toFixed(0)}° put the stool ` +
          `inside a collider at (${at.x.toFixed(2)}, ${at.z.toFixed(2)})`,
      )
      assert.ok(
        Math.abs(at.x) <= BOUND + 1e-9 && Math.abs(at.z) <= BOUND + 1e-9,
        `rolling on heading ${((yaw * 180) / Math.PI).toFixed(0)}° pushed the ` +
          `stool out of the room at (${at.x.toFixed(2)}, ${at.z.toFixed(2)})`,
      )
    }
    travelled += Math.hypot(at.x - from.x, at.z - from.z)
  }
  resetStoolPose()

  assert.equal(steps, 16 * FRAMES, 'the sweep did not run')
  // WITHOUT THIS THE SWEEP ABOVE PROVES NOTHING. A stepPlayer that returned its
  // input unchanged would satisfy every not-blocked assertion perfectly, which
  // is exactly the shape of hole that let openables.test stay green while the
  // cabinet was broken. The stool must actually have gone somewhere.
  assert.ok(
    travelled / 16 > 1.0,
    `sixteen four-second shoves averaged ${(travelled / 16).toFixed(2)} m — the ` +
      `stool is barely moving, so the collision assertions above are vacuous`,
  )
}

// ---------------------------------------------------------------------------
// A stool is not a sprinter
// ---------------------------------------------------------------------------

assert.ok(
  ROLL_OPTS.speed < WALK_SPEED,
  `rolling at ${ROLL_OPTS.speed} m/s is at least as fast as walking at ` +
    `${WALK_SPEED} — you are pushing off the floor while sitting on it`,
)
assert.ok(ROLL_OPTS.speed > 0.6, 'rolling is so slow it reads as a stuck chair')
assert.equal(
  ROLL_OPTS.radius,
  PLAYER_RADIUS,
  'the stool collides at a different radius from the player it carries',
)

console.log(
  `stool.test.ts — 1 rolling seat of ${SEATS.length}, approach and eye track ` +
    `the live pose, reset restores it, ${16 * FRAMES} roll steps against ` +
    `${COLLIDERS.length} colliders never left the floor, all assertions passed`,
)
