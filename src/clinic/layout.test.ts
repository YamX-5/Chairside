import assert from 'node:assert/strict'
import {
  blocked,
  nearestInteractable,
  nearestSeat,
  CHAIR_POS,
  COLLIDERS,
  INTERACTABLES,
  LAPTOP,
  SEAT_LOCAL,
  SEAT_WORLD,
  SEATS,
  SPAWN,
  PROPS,
  XRAY_DOCK,
} from './layout'
import { forwardFromYaw } from './movement'
import { BOUND, PLAYER_RADIUS, ROOM_HALF } from './theme3d'

/**
 * The room's spatial rules, tested headless. The render loop can't be unit
 * tested, but everything that decides where the player may stand and what they
 * can reach is pure — so it gets tested rather than eyeballed.
 */

// The player must spawn somewhere legal, or the first frame is inside a wall.
assert.ok(
  Math.abs(SPAWN.x) < BOUND && Math.abs(SPAWN.z) < BOUND,
  'spawn is inside the room bounds',
)
assert.equal(
  blocked(SPAWN.x, SPAWN.z, PLAYER_RADIUS),
  false,
  'spawn is not inside furniture',
)

// Open floor in the middle of the room is walkable.
assert.equal(blocked(0, 1.5, PLAYER_RADIUS), false)

// Every collider blocks at its own centre.
for (const b of COLLIDERS) {
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  assert.equal(
    blocked(cx, cz, PLAYER_RADIUS),
    true,
    `collider centre (${cx}, ${cz}) must block`,
  )
}

// The radius actually pads: a point just outside a collider edge still blocks.
{
  const b = COLLIDERS[0]
  const justOutside = b.maxX + PLAYER_RADIUS * 0.5
  const cz = (b.minZ + b.maxZ) / 2
  assert.equal(blocked(justOutside, cz, PLAYER_RADIUS), true, 'radius pads the box')
  // ...and the pad ENDS somewhere. Step INTO the room (+Z) rather than along
  // the wall (+X): in a 4.8 m operatory the next unit along the wall is right
  // there, so stepping sideways lands inside the autoclave and the assertion
  // fails on a floor plan that is actually correct.
  const intoRoom = b.maxZ + PLAYER_RADIUS + 0.35
  assert.equal(
    blocked((b.minX + b.maxX) / 2, intoRoom, PLAYER_RADIUS),
    false,
    'clear beyond the pad',
  )
}

// Every interactable must be reachable: there has to be at least one standable
// spot inside its radius, or the prompt can never fire.
for (const it of INTERACTABLES) {
  let reachable = false
  for (let a = 0; a < 32 && !reachable; a++) {
    for (let r = 0.4; r <= it.radius - 0.05 && !reachable; r += 0.15) {
      const x = it.x + Math.cos((a / 32) * Math.PI * 2) * r
      const z = it.z + Math.sin((a / 32) * Math.PI * 2) * r
      if (Math.abs(x) > BOUND || Math.abs(z) > BOUND) continue
      if (blocked(x, z, PLAYER_RADIUS)) continue
      if (nearestInteractable(x, z) === it.id) reachable = true
    }
  }
  assert.ok(reachable, `interactable "${it.id}" has a standable spot in range`)
}

// Far from everything, nothing is prompted.
//
// SEARCHED, not typed. This used to assert on the point (0, 3.5), which sat in
// open floor in the 8 m room and inside the far WALL once the room shrank to
// 4.8 m -- so it kept passing while testing nothing. Ask the layout where the
// open floor actually is.
{
  let open: { x: number; z: number } | null = null
  for (let i = 0; i <= 48 && !open; i++) {
    for (let j = 0; j <= 48 && !open; j++) {
      const x = -BOUND + (i / 48) * 2 * BOUND
      const z = -BOUND + (j / 48) * 2 * BOUND
      if (blocked(x, z, PLAYER_RADIUS)) continue
      if (INTERACTABLES.some((it) => Math.hypot(it.x - x, it.z - z) <= it.radius)) continue
      open = { x, z }
    }
  }
  assert.ok(open, 'the room has floor you can stand on that prompts nothing')
  assert.equal(nearestInteractable(open!.x, open!.z), null, 'no prompt in open floor')
}

// Standing in a zone prompts THAT zone, not something across the room.
// Derived per interactable, so moving one cannot leave a stale coordinate here.
for (const it of INTERACTABLES) {
  assert.equal(nearestInteractable(it.x, it.z), it.id, `standing on "${it.id}" prompts it`)
}

// Overlapping ranges resolve to the closer one.
{
  const study = INTERACTABLES.find((i) => i.id === 'study')!
  const solve = INTERACTABLES.find((i) => i.id === 'solve')!
  const nearStudy = nearestInteractable(study.x + 0.2, study.z + 0.4)
  assert.equal(nearStudy, 'study', 'closest wins')
  const nearSolve = nearestInteractable(solve.x - 0.2, solve.z + 0.5)
  assert.equal(nearSolve, 'solve', 'closest wins on the other side')
}

// Nothing swallows the spot you stand on to reach the portable X-ray.
//
// THE ASSERTION THAT WOULD HAVE CAUGHT IT. A 'board' zone sat 0.75 m in front of
// the bookcase with a 0.85 m radius, so it covered every standable cell there —
// including the one you reach the X-ray from. Worse, interact() had no 'board'
// branch, so the prompt that won was one that could never do anything: walk up,
// be told "Check your reputation", press E, nothing happens, forever.
for (const it of INTERACTABLES) {
  if (it.id === 'xray') continue
  const d = Math.hypot(it.x - XRAY_DOCK.x, it.z - XRAY_DOCK.z)
  assert.ok(
    d > it.radius,
    `interactable "${it.id}" (radius ${it.radius}) contains XRAY_DOCK — it is ` +
      `${d.toFixed(2)} m away, so it wins the prompt there and the X-ray ` +
      `cannot be picked up`,
  )
}

// Every interactable must have a branch that does something. A prompt with no
// handler is worse than no prompt: it tells the player an action exists.
{
  const HANDLED = new Set(['study', 'solve', 'drawer', 'gloves', 'xray', 'door'])
  for (const it of INTERACTABLES) {
    assert.ok(
      HANDLED.has(it.id),
      `interactable "${it.id}" has no branch in ClinicCase.interact() — pressing ` +
        `E there does nothing, which reads as a broken game`,
    )
  }
}

// No two interactables sit on top of each other — that would make one of them
// unreachable no matter where the player stands.
for (let i = 0; i < INTERACTABLES.length; i++) {
  for (let j = i + 1; j < INTERACTABLES.length; j++) {
    const a = INTERACTABLES[i]
    const b = INTERACTABLES[j]
    const d = Math.hypot(a.x - b.x, a.z - b.z)
    assert.ok(d > 1.0, `"${a.id}" and "${b.id}" are ${d.toFixed(2)}m apart`)
  }
}

// ---------------------------------------------------------------------------
// Reachability. This is the test that was missing.
//
// The chair was moved without moving its collider or its interaction zone, so
// the "you are at the chair" trigger ended up nearly two metres away and the
// patient could not be interacted with at all. Nothing caught it: the code
// typechecked, the tests passed, and the room rendered fine. An interaction
// point you cannot stand on is a dead feature, and it is trivially checkable.
// ---------------------------------------------------------------------------

for (const it of INTERACTABLES) {
  assert.ok(
    !blocked(it.x, it.z, PLAYER_RADIUS),
    `interactable "${it.id}" is at (${it.x}, ${it.z}), which is inside furniture — ` +
      'the player can never stand there, so it can never fire',
  )

  assert.ok(
    Math.abs(it.x) <= BOUND && Math.abs(it.z) <= BOUND,
    `interactable "${it.id}" is outside the walkable room bounds`,
  )

  // And standing there must actually register it, rather than some other
  // interactable that happens to be closer.
  assert.equal(
    nearestInteractable(it.x, it.z),
    it.id,
    `standing on "${it.id}" resolves to a different interactable`,
  )
}

// The chair's interaction point must be beside the chair, not merely somewhere
// legal. Derived from CHAIR_POS, so this asserts the derivation, not a literal.
{
  const solve = INTERACTABLES.find((i) => i.id === 'solve')!
  const reach = Math.hypot(solve.x - CHAIR_POS[0], solve.z - CHAIR_POS[2])
  assert.ok(
    reach < 1.4,
    `the operator stands ${reach.toFixed(2)}m from the chair — too far to work on anyone`,
  )
  assert.ok(
    reach > 0.5,
    `the operator stands ${reach.toFixed(2)}m from the chair — that is inside it`,
  )
}

// The patient's seat must be ON the chair, not merely near it.
{
  assert.equal(SEAT_WORLD[0], CHAIR_POS[0] + SEAT_LOCAL[0])
  assert.equal(SEAT_WORLD[2], CHAIR_POS[2] + SEAT_LOCAL[2])
  assert.ok(
    SEAT_WORLD[1] > 0.3 && SEAT_WORLD[1] < 0.8,
    `seat height ${SEAT_WORLD[1]} is not a plausible chair cushion — ` +
      'at 0 she sits on the floor, which is a bug this project has already shipped once',
  )
}

console.log(
  `layout.test.ts — ${COLLIDERS.length} colliders, ${INTERACTABLES.length} interactables, all assertions passed`,
)

/**
 * Every seat must FACE the thing it is named after.
 *
 * All three seat yaws shipped 180 degrees out of phase with forwardFromYaw and
 * this suite stayed green, because it never imported SEATS at all. The desk
 * chair faced away from the laptop, the operator's stool away from the patient,
 * and the waiting bench into a wall 0.6 m away.
 *
 * `Seat.yaw`'s own doc comment defines the convention (0 = looking -Z) and
 * movement.ts implements it; the DATA was wrong, not the consumer. So the test
 * is written against the consumer: point the seat's forward vector at its
 * subject and require a positive dot product.
 */
function seat(id: string) {
  const s = SEATS.find((x) => x.id === id)
  assert.ok(s, `seat '${id}' exists`)
  return s!
}

function facesToward(id: string, target: { x: number; z: number }, label: string) {
  const s = seat(id)
  const f = forwardFromYaw(s.yaw)
  const dx = target.x - s.eye.x
  const dz = target.z - s.eye.z
  const len = Math.hypot(dx, dz)
  assert.ok(len > 1e-6, `${label}: seat and target are not in the same place`)
  const dot = (f.x * dx + f.z * dz) / len
  assert.ok(
    dot > 0.5,
    `${label}: seat '${id}' faces (${f.x.toFixed(2)}, ${f.z.toFixed(2)}) but the ` +
      `target lies at (${(dx / len).toFixed(2)}, ${(dz / len).toFixed(2)}) — dot ${dot.toFixed(2)}`,
  )
}

// The desk chair must face the laptop, or sitting down shows you a wall and you
// have to spin 180 degrees to read the screen you just sat at.
facesToward('desk', { x: LAPTOP.x, z: LAPTOP.z }, 'desk chair -> laptop')

// The operator's stool must face the patient in the dental chair.
facesToward('stool', { x: CHAIR_POS[0], z: CHAIR_POS[2] }, 'stool -> patient')

// The waiting-bench facing check that used to live here went with the bench
// itself -- a 4.8 m operatory has no waiting area.
//
// It is NOT replaced with "no seat may face a wall": a desk pushed against a
// wall is supposed to face the wall, and that generalisation failed the desk
// immediately. What actually matters is that every seat points at the thing it
// exists for, which the facesToward() calls above assert one by one. So assert
// COVERAGE -- add a seat without saying what it must look at, and this fails.
{
  const CHECKED_FACING = new Set(['desk', 'stool'])
  for (const s of SEATS) {
    assert.ok(
      CHECKED_FACING.has(s.id),
      `seat '${s.id}' has no facesToward() assertion — say what it must look at`,
    )
  }
  assert.equal(CHECKED_FACING.size, SEATS.length, 'a facing check outlived its seat')
}

// ---------------------------------------------------------------------------
// You can stand up from every seat
// ---------------------------------------------------------------------------
//
// A seat's EYE position is where the camera is parked while sitting, and the
// player is released there when they stand. If it is inside a collider they are
// released INTO furniture — and stepPlayer used to refuse every direction from
// inside a box, so that was a permanent trap needing a page reload.
//
// The operator's stool was exactly this: its eye sat inside the patient chair's
// collider, because that collider was the chair's whole silhouette rather than
// its base. Only `s.approach` was ever checked, which is the spot you walk to
// BEFORE sitting — not where you end up.
{
  for (const s of SEATS) {
    assert.equal(
      blocked(s.eye.x, s.eye.z, PLAYER_RADIUS),
      false,
      `seat '${s.id}' seats the camera at (${s.eye.x.toFixed(2)}, ${s.eye.z.toFixed(2)}), ` +
        `inside a collider — standing up releases the player into furniture`,
    )
  }
}

// Every seat must be reachable: you have to be able to stand at its approach
// point, and that point has to actually trigger the seat.
for (const s of SEATS) {
  assert.equal(
    blocked(s.approach.x, s.approach.z, PLAYER_RADIUS),
    false,
    `seat '${s.id}' approach point is inside furniture`,
  )
  const found = nearestSeat(s.approach.x, s.approach.z)
  assert.equal(
    found?.id,
    s.id,
    `standing at seat '${s.id}' approach point finds '${found?.id ?? 'nothing'}'`,
  )
}

console.log(`seats: ${SEATS.length} checked, all facing their subject`)

/**
 * Every prop must be inside the room and clear of the furniture.
 *
 * The audit of the old kit room found the desk 0.56 m through a wall, the sink
 * 0.80 m below the floor and the only ceiling lamp entirely above the ceiling —
 * none of which any test could see, because nothing asserted placement. These
 * assertions exist so the same class of bug fails the suite instead of shipping.
 */
{
  // Was hardcoded to 4 -- the OLD room's half-width. After the shrink to 2.4
  // every prop-in-the-room assertion was checking against a boundary 1.6 m
  // outside the actual wall, so a prop buried in masonry still passed. Import
  // the real constant; never restate a dimension a module already owns.
  const CEILING = 2.8
  const seen = new Set<string>()

  for (const prop of PROPS) {
    const [x, y, z] = prop.pos

    assert.ok(!seen.has(prop.id), `prop '${prop.id}' is listed twice`)
    seen.add(prop.id)

    assert.ok(
      Math.abs(x) < ROOM_HALF && Math.abs(z) < ROOM_HALF,
      `prop '${prop.id}' at (${x}, ${z}) is outside the room`,
    )
    assert.ok(
      y >= 0 && y < CEILING,
      `prop '${prop.id}' base y=${y} is below the floor or above the ceiling`,
    )

    // A prop standing ON the floor must not be inside a collider — you would
    // walk into an invisible box, or the prop would grow out of the furniture.
    // Props with a raised base sit ON something, so their footprint is expected
    // to coincide with that furniture's collider.
    if (y === 0 && !prop.fills) {
      const inside = COLLIDERS.find(
        (b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ,
      )
      assert.equal(
        inside,
        undefined,
        `floor prop '${prop.id}' at (${x}, ${z}) is inside a collider` +
          (inside
            ? ` x[${inside.minX}..${inside.maxX}] z[${inside.minZ}..${inside.maxZ}]`
            : ''),
      )
    }
  }

  console.log(`props: ${PROPS.length} placed, all inside the room and clear`)
}
