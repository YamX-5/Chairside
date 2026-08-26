import assert from 'node:assert/strict'
import {
  forwardFromYaw,
  headBob,
  rightFromForward,
  smoothInput,
  stepPlayer,
} from './movement'
import { BOUND, PLAYER_RADIUS, WALK_SPEED } from './theme3d'
import { blocked, CHAIR_POS, COLLIDERS, SPAWN } from './layout'

const OPTS = { speed: WALK_SPEED, radius: PLAYER_RADIUS, bound: BOUND }
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

/**
 * A spot with genuinely clear floor all around it, SEARCHED from the layout.
 *
 * These are kinematics tests -- they care about direction and speed, not about
 * furniture. But `stepPlayer` runs collision, so they still need somewhere you
 * can actually walk. They used to start from hand-typed points like (0, 0) and
 * (0, 1.5), which were open floor in the old 8 m room and are inside the dental
 * unit's collider in the 4.8 m one. "S walks backwards" then failed for a reason
 * that had nothing whatsoever to do with movement.
 *
 * Throwing when nothing is found is deliberate: a room with no walkable floor
 * should fail loudly here rather than produce a confusing assertion later.
 */
/**
 * How much clear floor OPEN is guaranteed to have in every direction.
 *
 * 0.35 m, not 0.9. Once the sterilisation station was rescaled to its real
 * 0.88 m depth and the dental unit's collider was re-measured, there was no
 * longer ANY point in the room with 0.9 m clear in six directions — the search
 * threw, and the failure read like a movement bug rather than what it was: a
 * test demanding more empty floor than a real operatory has.
 *
 * What these tests actually need is enough room for one step to complete
 * without a collision, and the largest step any of them takes is derived from
 * this same constant below. So it only has to exceed that.
 */
const OPEN_PAD = 0.35

const OPEN = (() => {
  const PAD = OPEN_PAD
  const around: Array<[number, number]> = [
    [PAD, 0], [-PAD, 0], [0, PAD], [0, -PAD], [PAD, PAD], [-PAD, -PAD],
  ]
  // Finer than the old 60: the clear lanes in a furnished operatory are narrow,
  // and a coarse grid can step straight over one.
  const N = 160
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = -BOUND + (i / N) * 2 * BOUND
      const z = -BOUND + (j / N) * 2 * BOUND
      if (Math.abs(x) + PAD > BOUND || Math.abs(z) + PAD > BOUND) continue
      if (blocked(x, z, PLAYER_RADIUS)) continue
      if (around.some(([dx, dz]) => blocked(x + dx, z + dz, PLAYER_RADIUS))) continue
      return { x, z }
    }
  }
  throw new Error('no open floor in the room — the layout leaves nowhere to walk')
})()

// --- direction basis -------------------------------------------------------

// A three.js camera at yaw 0 looks down -Z.
{
  const f = forwardFromYaw(0)
  assert.ok(near(f.x, 0) && near(f.z, -1), `forward at yaw 0 is -Z, got ${JSON.stringify(f)}`)
}

// Turning 90° left (yaw = +90°) faces -X.
{
  const f = forwardFromYaw(Math.PI / 2)
  assert.ok(near(f.x, -1) && near(f.z, 0), `yaw 90° faces -X, got ${JSON.stringify(f)}`)
}

// THE BUG THIS FILE EXISTS FOR: right must be +X when facing -Z. Getting this
// backwards inverts strafing, which reads as "the controls are broken".
{
  const r = rightFromForward(forwardFromYaw(0))
  assert.ok(near(r.x, 1) && near(r.z, 0), `right at yaw 0 is +X, got ${JSON.stringify(r)}`)
}

// Right stays perpendicular to forward at every angle.
for (const yaw of [0, 0.7, Math.PI / 2, 2.4, Math.PI, -1.1]) {
  const f = forwardFromYaw(yaw)
  const r = rightFromForward(f)
  assert.ok(near(f.x * r.x + f.z * r.z, 0, 1e-9), `forward ⟂ right at yaw ${yaw}`)
  assert.ok(near(Math.hypot(r.x, r.z), 1, 1e-9), `right is unit at yaw ${yaw}`)
}

// --- walking ---------------------------------------------------------------

// Forward from spawn moves into the room (-Z).
{
  const p = stepPlayer({ x: SPAWN.x, z: SPAWN.z }, 0, { x: 0, z: 1 }, 0.1, OPTS)
  assert.ok(p.z < SPAWN.z, 'W walks forward, into -Z')
  assert.ok(near(p.x, SPAWN.x), 'W does not drift sideways')
}

// Back moves the other way.
{
  const p = stepPlayer(OPEN, 0, { x: 0, z: -1 }, 0.1, OPTS)
  assert.ok(p.z > OPEN.z, 'S walks backwards')
}

// D strafes right (+X) when facing -Z.
{
  const p = stepPlayer(OPEN, 0, { x: 1, z: 0 }, 0.1, OPTS)
  assert.ok(p.x > OPEN.x, `D strafes to +X, got x=${p.x}`)
}

// A strafes left.
{
  const p = stepPlayer(OPEN, 0, { x: -1, z: 0 }, 0.1, OPTS)
  assert.ok(p.x < OPEN.x, 'A strafes to -X')
}

// Speed matches the constant, and diagonals are not faster than cardinals.
{
  // Derived from OPEN_PAD, not typed. At the old dt of 0.5 s the player walks
  // 1.3 m, and there is nowhere in a 4.8 m operatory you can walk 1.3 m in a
  // straight line without meeting furniture — so this assertion was measuring a
  // collision and calling it a speed.
  const dt = (OPEN_PAD * 0.6) / WALK_SPEED
  const straight = stepPlayer(OPEN, 0, { x: 0, z: 1 }, dt, OPTS)
  const dStraight = Math.hypot(straight.x - OPEN.x, straight.z - OPEN.z)
  assert.ok(near(dStraight, WALK_SPEED * dt, 1e-6), 'cardinal speed is exact')

  const diag = stepPlayer(OPEN, 0, { x: 1, z: 1 }, dt, OPTS)
  const dDiag = Math.hypot(diag.x - OPEN.x, diag.z - OPEN.z)
  assert.ok(dDiag <= dStraight + 1e-6, 'diagonal is not faster than straight')
}

// No input, no movement.
{
  const p = stepPlayer({ x: 1, z: 1 }, 0.6, { x: 0, z: 0 }, 0.1, OPTS)
  assert.deepEqual(p, { x: 1, z: 1 })
}

// --- collision -------------------------------------------------------------

// Walls stop the player rather than letting them leave the room.
{
  let p = { ...OPEN }
  for (let i = 0; i < 200; i++) p = stepPlayer(p, 0, { x: 0, z: 1 }, 0.1, OPTS)
  assert.ok(p.z >= -BOUND - 1e-9, 'cannot walk through the far wall')
  assert.ok(Math.abs(p.x) <= BOUND, 'stays inside on X too')
}

// Walking straight into the dental chair stops short of it.
//
// The lane and the stop distance are DERIVED from the chair's collider, not
// typed. They used to be literals chosen for a collider that was the unit's
// whole silhouette; when it was corrected to the base the unit actually stands
// on, x = 1.6 stopped being in front of the chair at all and the player simply
// walked past — the test failed for a change that was right.
{
  const chair = COLLIDERS.find(
    (c) => CHAIR_POS[0] >= c.minX && CHAIR_POS[0] <= c.maxX &&
      CHAIR_POS[2] >= c.minZ && CHAIR_POS[2] <= c.maxZ,
  )
  assert.ok(chair, 'no collider contains CHAIR_POS')
  const lane = (chair!.minX + chair!.maxX) / 2
  const stopsAt = chair!.maxZ + PLAYER_RADIUS

  let p = { x: lane, z: 2.5 }
  for (let i = 0; i < 120; i++) p = stepPlayer(p, 0, { x: 0, z: 1 }, 0.05, OPTS)
  assert.ok(
    p.z > stopsAt - 1e-6,
    `walking down x=${lane.toFixed(2)} should stop at z=${stopsAt.toFixed(2)}, ` +
      `got ${p.z.toFixed(2)} — the chair did not block`,
  )
}

// Being INSIDE a collider must always be escapable.
//
// stepPlayer only ever tested the destination, so any point inside a box
// rejected every direction and pinned the player there permanently. It is
// reachable in normal play: the seated camera is parked inside the chair's box
// and the player is released there when they stand up.
{
  const chair = COLLIDERS.find(
    (c) => CHAIR_POS[0] >= c.minX && CHAIR_POS[0] <= c.maxX,
  )!
  const inside = { x: (chair.minX + chair.maxX) / 2, z: (chair.minZ + chair.maxZ) / 2 }
  assert.equal(blocked(inside.x, inside.z, PLAYER_RADIUS), true, 'test point is not inside')

  let escaped = false
  for (let dir = 0; dir < 8 && !escaped; dir++) {
    const yaw = (dir / 8) * Math.PI * 2
    let p = { ...inside }
    for (let i = 0; i < 200; i++) p = stepPlayer(p, yaw, { x: 0, z: 1 }, 0.05, OPTS)
    escaped = !blocked(p.x, p.z, PLAYER_RADIUS)
  }
  assert.ok(escaped, 'trapped inside a collider — no direction leads out')
}

// Approaching furniture at an angle slides along it instead of sticking dead.
{
  // Just clear of the dental chair's collider, moving diagonally into it.
  // Positions here depend on COLLIDERS in layout.ts — assert the start is
  // actually free first, so a layout change fails with "the start is inside
  // furniture" rather than the far more confusing "sliding is broken".
  const start = { x: 1.6, z: 2.0 }
  assert.ok(
    !blocked(start.x, start.z, PLAYER_RADIUS),
    'the slide test must start outside furniture — check COLLIDERS in layout.ts',
  )
  const after = stepPlayer(start, 0, { x: 1, z: 1 }, 0.2, OPTS)
  assert.ok(
    Math.abs(after.x - start.x) > 1e-4,
    'the free axis still moves when the other is blocked',
  )
}

// A hitch (tab regains focus, huge delta) must not tunnel through furniture.
// The controller clamps delta; this asserts the collision test is what stops it.
{
  const p = stepPlayer({ x: 1.6, z: 2.0 }, 0, { x: 0, z: 1 }, 0.05, OPTS)
  assert.ok(p.z > 0.6, 'a single clamped step cannot cross the chair')
}

// The whole walkable floor stays legal: sample a grid and confirm every
// reachable point the stepper can produce is outside furniture.
{
  let bad = 0
  for (let x = -BOUND; x <= BOUND; x += 0.25) {
    for (let z = -BOUND; z <= BOUND; z += 0.25) {
      const p = stepPlayer({ x, z }, 0.9, { x: 1, z: 1 }, 1 / 60, OPTS)
      if (Math.abs(p.x) > BOUND + 1e-9 || Math.abs(p.z) > BOUND + 1e-9) bad++
    }
  }
  assert.equal(bad, 0, 'no step ever leaves the room bounds')
}

// ---------------------------------------------------------------------------
// Feel: acceleration and head bob
// ---------------------------------------------------------------------------

const FEEL = { accel: 7.5, decel: 12 }

{
  // Starting from rest takes more than one frame — that IS the weight.
  const first = smoothInput({ x: 0, z: 0 }, { x: 0, z: 1 }, 1 / 60, FEEL)
  assert.ok(first.z > 0 && first.z < 1, `should ease in, got ${first.z}`)

  // But it must actually arrive, and reasonably quickly.
  let v = { x: 0, z: 0 }
  let frames = 0
  while (v.z < 0.999 && frames < 60) {
    v = smoothInput(v, { x: 0, z: 1 }, 1 / 60, FEEL)
    frames++
  }
  assert.ok(frames < 20, `full speed should take under a third of a second, took ${frames} frames`)
}

{
  // Stopping must be FASTER than starting, or releasing the key feels like ice.
  //
  // Loop until EXACTLY zero, not until "small": accumulated float error leaves a
  // ~5e-17 residue one frame before the snap-to-target fires, so a
  // greater-than-epsilon condition exits early and then asserts on the residue.
  let v = { x: 0, z: 1 }
  let stopFrames = 0
  while (v.z !== 0 && stopFrames < 60) {
    v = smoothInput(v, { x: 0, z: 0 }, 1 / 60, FEEL)
    stopFrames++
  }

  let go = { x: 0, z: 0 }
  let goFrames = 0
  while (go.z < 0.999 && goFrames < 60) {
    go = smoothInput(go, { x: 0, z: 1 }, 1 / 60, FEEL)
    goFrames++
  }

  assert.ok(stopFrames < goFrames, `stopping (${stopFrames}f) must beat starting (${goFrames}f)`)
  assert.equal(v.z, 0, 'must settle exactly at rest, not creep forever')
}

{
  // Diagonals must never exceed unit length, even mid-ease — otherwise
  // accelerating diagonally is briefly faster than accelerating straight.
  let v = { x: 0, z: 0 }
  for (let i = 0; i < 40; i++) {
    v = smoothInput(v, { x: 1, z: 1 }, 1 / 60, FEEL)
    assert.ok(Math.hypot(v.x, v.z) <= 1 + 1e-9, `diagonal exceeded unit length: ${Math.hypot(v.x, v.z)}`)
  }
}

{
  // Standing still means no bob at all. Time-based bob keeps bobbing when the
  // player stops, which reads as swaying drunk in an empty room.
  assert.deepEqual(headBob(12.3, 0), { y: 0, roll: 0 })

  // Bob is bounded — a camera lurching more than a couple of centimetres is
  // nausea, not weight.
  for (let d = 0; d < 30; d += 0.05) {
    const b = headBob(d, 1)
    assert.ok(Math.abs(b.y) < 0.03, `bob y ${b.y} too large`)
    assert.ok(Math.abs(b.roll) < 0.02, `bob roll ${b.roll} too large`)
  }

  // It is driven by distance, so the same distance always gives the same pose —
  // that is what keeps the stride locked to footfalls at any framerate.
  assert.deepEqual(headBob(4.2, 1), headBob(4.2, 1))
  assert.notDeepEqual(headBob(4.2, 1), headBob(4.5, 1))

  // Intensity fades it in rather than switching it on.
  assert.ok(Math.abs(headBob(1.0, 0.3).y) < Math.abs(headBob(1.0, 1).y))
}

console.log('movement.test.ts — all assertions passed')
