import assert from 'node:assert/strict'
import { INTERACTABLES, blocked, nearestInteractable } from './layout'
import { PLAYER_RADIUS } from './theme3d'

/**
 * You must still be able to use a thing when you have walked right up to it.
 *
 * THE BUG THIS EXISTS FOR
 * -----------------------
 * `nearestInteractable` measured RANGE and FACING against the same point — the
 * STANDING SPOT, which is deliberately in front of the object rather than inside
 * its collider. So the facing test was applied to a point the player walks
 * THROUGH. Step forward until the collider stops you and you are past it, the
 * vector to it points behind you, `facing` computes to about -1, and the zone is
 * skipped.
 *
 * The result was that every zone in the room went dead over its last ~130 mm —
 * at exactly the position a player ends up in, because walking at something
 * until you stop is the most natural thing there is. Walk to the bookcase, press
 * E: nothing. Walk to the cabinet, press E: nothing.
 *
 * Facing is now measured to `look` (the object) and range to the standing spot.
 *
 * The walk here is DERIVED from the real colliders rather than written down, so
 * moving a prop cannot leave a stale coordinate passing.
 */

/** Yaw that faces (dx, dz). movement.ts: forward at yaw 0 is -Z. */
function yawToward(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz)
}

/**
 * Walk from `from` toward `to` until the colliders stop you.
 *
 * One-centimetre steps: the point of the test is the LAST place you can stand,
 * and that is where the old code failed.
 */
function walkInto(
  from: { x: number; z: number },
  to: { x: number; z: number },
): { x: number; z: number } {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const len = Math.hypot(dx, dz)
  if (len < 1e-9) return { ...from }
  let at = { ...from }
  for (let t = 0; t <= len; t += 0.01) {
    const next = { x: from.x + (dx / len) * t, z: from.z + (dz / len) * t }
    if (blocked(next.x, next.z, PLAYER_RADIUS)) break
    at = next
  }
  return at
}

const withLook = INTERACTABLES.filter((i) => i.look)
assert.ok(
  withLook.length >= 4,
  'no interactable declares `look` — the facing fix has been reverted, and every ' +
    'zone will die again the moment a player walks up to it',
)

for (const it of INTERACTABLES) {
  const target = it.look ?? { x: it.x, z: it.z }

  // 1. Standing ON the spot, looking at the thing, must work. This passed before
  //    the fix too — it is the baseline that proves the walk below is what
  //    changed, not the whole function.
  {
    const yaw = yawToward(target.x - it.x, target.z - it.z)
    const got = nearestInteractable(it.x, it.z, it.look ? yaw : undefined)
    assert.ok(
      got !== null,
      `standing exactly on the '${it.id}' spot and facing it resolves nothing`,
    )
  }

  if (!it.look) continue

  // 2. THE REGRESSION. Walk from the spot into the object until the collider
  //    stops you, keep looking at it, and the zone must still answer.
  const at = walkInto({ x: it.x, z: it.z }, target)
  const yaw = yawToward(target.x - at.x, target.z - at.z)
  const got = nearestInteractable(at.x, at.z, yaw)

  const moved = Math.hypot(at.x - it.x, at.z - it.z)
  assert.ok(
    moved > 0.02,
    `the walk toward '${it.id}' did not move — the collider is already on the ` +
      `standing spot, so this case proves nothing`,
  )
  assert.equal(
    got,
    it.id,
    `walked ${(moved * 1000).toFixed(0)} mm from the '${it.id}' spot up to the ` +
      `object, still looking straight at it, and nearestInteractable returned ` +
      `${got === null ? 'null' : `'${got}'`}. This is the "I press E and nothing ` +
      `happens" bug.`,
  )
}

// Facing must still REFUSE you when your back is turned. The gate exists because
// standing near something is not addressing it — walking past the glove box
// used to offer "put gloves on".
for (const it of withLook) {
  const target = it.look!
  const away = yawToward(it.x - target.x, it.z - target.z)
  assert.notEqual(
    nearestInteractable(it.x, it.z, away),
    it.id,
    `'${it.id}' still answers with your back to it — the facing gate is gone, ` +
      `not fixed`,
  )
}

console.log(
  `facing.test.ts — ${INTERACTABLES.length} interactables, ${withLook.length} with ` +
    `a look target, each reachable when walked right up to and each refused from ` +
    `behind, all assertions passed`,
)
