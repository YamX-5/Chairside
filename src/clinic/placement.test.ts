import assert from 'node:assert/strict'
import { join } from 'node:path'
import {
  BRACKET_TRAY,
  CABINET_POS,
  CABINET_SHELF,
  CHAIR_POS,
  DESK_POS,
  DESK_TOP_Y,
  DESK_YAW,
  DOORWAY,
  GLOVE_MOUNT_Y,
  INTERACTABLES,
  MONITOR_POS,
  SCREEN_ANCHOR,
  SHELF_BOARDS,
  UPPER_CABINET_MIN_Y,
  WORKTOP_Y,
  XRAY_DOCK,
  COLLIDERS,
  MIRROR,
  PROPS,
  blocked,
} from './layout'
import { BOUND, PLAYER_RADIUS, ROOM_HALF } from './theme3d'
import { TRAY_INSTRUMENTS, trayLayout } from './instruments'
import { horizontalSurfaces, measureGlb, overlaps, type Measured } from './glbMeasure'

/**
 * Does one thing actually rest on / clear another?
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every spatial bug this project has shipped was RELATIONAL, and every one of
 * them passed the suite. A box of masks on the roof of a cabinet, an X-ray
 * driven through the shelf above it, a laptop sunk into a desk, an instrument
 * tray inside the operator's stool, a glove box a metre outside the building.
 * `layout.test.ts` checks positions against the room, and `propScale.test.ts`
 * checks each asset's own size — but nothing compared two things to each other,
 * so "this rests on that" was never once verified.
 *
 * These assertions read the real .glb files and compare world-space boxes.
 */

const MODELS = join(process.cwd(), 'public', 'models')
const P = (f: string) => join(MODELS, f)

/** A prop's geometry moved into the room: position, then yaw about Y. */
function placed(
  m: Measured,
  pos: readonly [number, number, number],
  yaw: number,
): { lo: number[]; hi: number[] } {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const cx of [m.lo[0], m.hi[0]]) {
    for (const cy of [m.lo[1], m.hi[1]]) {
      for (const cz of [m.lo[2], m.hi[2]]) {
        const p = [pos[0] + cx * c + cz * s, pos[1] + cy, pos[2] - cx * s + cz * c]
        for (let i = 0; i < 3; i++) {
          if (p[i] < lo[i]) lo[i] = p[i]
          if (p[i] > hi[i]) hi[i] = p[i]
        }
      }
    }
  }
  return { lo, hi }
}

// ---------------------------------------------------------------------------
// 1. The instrument tray is not inside the operator's stool
// ---------------------------------------------------------------------------

{
  const stoolGlb = measureGlb(P('props/doctors_chair.glb'))
  assert.ok(stoolGlb, 'doctors_chair.glb has no geometry')
  const stool = placed(
    stoolGlb!,
    [CHAIR_POS[0] - 0.85, 0, CHAIR_POS[2] - 0.05],
    -Math.PI / 2,
  )

  // The row of instruments laid out on the bracket, plus a little slack for the
  // width of each tool.
  const xs = trayLayout(TRAY_INSTRUMENTS.length)
  const halfRun = Math.max(...xs.map(Math.abs)) + 0.06
  const tray = {
    lo: [BRACKET_TRAY.x - halfRun, BRACKET_TRAY.y - 0.03, BRACKET_TRAY.z - 0.12],
    hi: [BRACKET_TRAY.x + halfRun, BRACKET_TRAY.y + 0.12, BRACKET_TRAY.z + 0.12],
  }

  assert.ok(
    !overlaps(tray, stool),
    `the instrument tray (x ${tray.lo[0].toFixed(2)}..${tray.hi[0].toFixed(2)}) is inside ` +
      `the operator stool (x ${stool.lo[0].toFixed(2)}..${stool.hi[0].toFixed(2)}, ` +
      `y ${stool.lo[1].toFixed(2)}..${stool.hi[1].toFixed(2)}) — instruments render ` +
      `inside its cushion`,
  )

  // And it rests on the unit's real bracket, rather than floating.
  const unit = measureGlb(P('dental_chair.glb'))!
  const bracket = unit.nodes.find((n) => n.name.includes('Object_14'))
  assert.ok(bracket, 'the dental unit has no Object_14 — the bracket tray BRACKET_TRAY sits on')
  const bracketTopWorld = CHAIR_POS[1] + bracket!.hi[1]
  assert.ok(
    Math.abs(BRACKET_TRAY.y - bracketTopWorld) < 0.02,
    `BRACKET_TRAY.y is ${BRACKET_TRAY.y} but the unit's bracket tops out at ` +
      `${bracketTopWorld.toFixed(3)} — the instruments are ` +
      `${(BRACKET_TRAY.y - bracketTopWorld).toFixed(3)} m off it`,
  )
}

// ---------------------------------------------------------------------------
// 2. The cabinet instruments sit on a shelf that actually exists
// ---------------------------------------------------------------------------

{
  const closet = measureGlb(P('props/closet.glb'))!
  const shelves = horizontalSurfaces(closet, { minWidth: 0.4, minDepth: 0.15 })
    .map((s) => s.top)
    .filter((y) => y > 0.2 && y < 1.7)
  assert.ok(shelves.length > 0, 'closet.glb has no interior shelves at all')

  const nearest = shelves.reduce((best, y) =>
    Math.abs(y - CABINET_SHELF.y) < Math.abs(best - CABINET_SHELF.y) ? y : best,
  )
  assert.ok(
    Math.abs(nearest - CABINET_SHELF.y) < 0.02,
    `CABINET_SHELF.y is ${CABINET_SHELF.y} but closet.glb's nearest shelf is at ` +
      `${nearest.toFixed(3)} — the instruments float or sink`,
  )

  // And the shelf is inside the cabinet it belongs to, not somewhere else.
  const cab = placed(closet, CABINET_POS, -Math.PI / 2)
  assert.ok(
    CABINET_SHELF.x > cab.lo[0] && CABINET_SHELF.x < cab.hi[0] &&
      CABINET_SHELF.z > cab.lo[2] && CABINET_SHELF.z < cab.hi[2],
    `CABINET_SHELF (${CABINET_SHELF.x}, ${CABINET_SHELF.z}) is outside the cabinet ` +
      `(x ${cab.lo[0].toFixed(2)}..${cab.hi[0].toFixed(2)}, ` +
      `z ${cab.lo[2].toFixed(2)}..${cab.hi[2].toFixed(2)})`,
  )
}

// ---------------------------------------------------------------------------
// 3. The patient walks in from inside the building
// ---------------------------------------------------------------------------

{
  assert.ok(
    Math.abs(DOORWAY.x) <= ROOM_HALF && Math.abs(DOORWAY.z) <= ROOM_HALF,
    `the patient's walk-in starts at (${DOORWAY.x}, ${DOORWAY.z}), outside a room ` +
      `whose walls are at +/-${ROOM_HALF}`,
  )
  assert.ok(
    Math.abs(DOORWAY.x) <= BOUND && Math.abs(DOORWAY.z) <= BOUND,
    `the doorway at (${DOORWAY.x}, ${DOORWAY.z}) is inside a wall`,
  )
  assert.equal(
    blocked(DOORWAY.x, DOORWAY.z, PLAYER_RADIUS),
    false,
    'the patient walks in through furniture',
  )
}

// ---------------------------------------------------------------------------
// 4a. The portable X-ray fits where it is docked
// ---------------------------------------------------------------------------

{
  const bs = measureGlb(P('props/book_shelf.glb'))!
  const boards = horizontalSurfaces(bs, { minWidth: 0.7, minDepth: 0.15 })
  const xray = measureGlb(P('props/portable_xray.glb'))!

  const i = SHELF_BOARDS.findIndex((y) => Math.abs(y - XRAY_DOCK.y) < 1e-6)
  assert.ok(
    i >= 0,
    `XRAY_DOCK.y (${XRAY_DOCK.y}) is a number of its own rather than one of ` +
      `SHELF_BOARDS — it cannot be resting on a board`,
  )
  assert.ok(
    Math.abs(boards[i].top - XRAY_DOCK.y) < 0.02,
    `SHELF_BOARDS[${i}] is ${XRAY_DOCK.y} but the asset's board ${i} tops out at ` +
      `${boards[i].top.toFixed(3)}`,
  )

  const above = boards[i + 1]
  // An open-topped dock is a legitimate answer, not a failure.
  const headroom = above ? above.top - above.thickness - XRAY_DOCK.y : Infinity
  assert.ok(
    xray.size[1] <= headroom,
    `the portable X-ray is ${xray.size[1].toFixed(3)} m tall but its board has ` +
      `${headroom.toFixed(3)} m of headroom — its top ` +
      `${(xray.size[1] - headroom).toFixed(3)} m is driven through the board above it`,
  )
}

// ---------------------------------------------------------------------------
// 4b. The workstation stands ON the desk, and the screen is inside the monitor
// ---------------------------------------------------------------------------

{
  const desk = measureGlb(P('props/office_desk.glb'))!
  assert.ok(
    Math.abs(desk.hi[1] - DESK_TOP_Y) < 0.01,
    `DESK_TOP_Y is ${DESK_TOP_Y} but office_desk.glb tops out at ` +
      `${desk.hi[1].toFixed(3)} — the number describes an asset that is not shipped`,
  )

  const deskBox = placed(desk, DESK_POS, DESK_YAW)

  // Everything on the workstation rests on the desk's top, not near it.
  for (const [name, pos] of [
    ['monitor', MONITOR_POS],
    ['keyboard', [DESK_POS[0] + 0.1, DESK_TOP_Y, DESK_POS[2]]],
    ['mouse', [DESK_POS[0] + 0.1, DESK_TOP_Y, DESK_POS[2] + 0.3]],
  ] as [string, readonly [number, number, number]][]) {
    assert.ok(
      Math.abs(pos[1] - DESK_TOP_Y) < 1e-9,
      `the ${name} sits at y ${pos[1]}, not on the desk top (${DESK_TOP_Y})`,
    )

    const m = measureGlb(P(`props/${name}.glb`))
    assert.ok(m, `props/${name}.glb is missing`)
    const box = placed(m!, pos, DESK_YAW)
    assert.ok(
      box.lo[0] > deskBox.lo[0] - 0.02 && box.hi[0] < deskBox.hi[0] + 0.02 &&
        box.lo[2] > deskBox.lo[2] - 0.02 && box.hi[2] < deskBox.hi[2] + 0.02,
      `the ${name} (x ${box.lo[0].toFixed(2)}..${box.hi[0].toFixed(2)}, ` +
        `z ${box.lo[2].toFixed(2)}..${box.hi[2].toFixed(2)}) hangs off the desk ` +
        `(x ${deskBox.lo[0].toFixed(2)}..${deskBox.hi[0].toFixed(2)}, ` +
        `z ${deskBox.lo[2].toFixed(2)}..${deskBox.hi[2].toFixed(2)})`,
    )
  }

  // The keyboard and the mouse must not be the same object in two places.
  const kb = placed(measureGlb(P('props/keyboard.glb'))!, [DESK_POS[0] + 0.1, DESK_TOP_Y, DESK_POS[2]], DESK_YAW)
  const ms = placed(measureGlb(P('props/mouse.glb'))!, [DESK_POS[0] + 0.1, DESK_TOP_Y, DESK_POS[2] + 0.3], DESK_YAW)
  assert.ok(!overlaps(kb, ms), 'the mouse is inside the keyboard')

  // The study window flies out of SCREEN_ANCHOR, so that point has to be on the
  // monitor's picture — not floating in front of it, and not inside its stand.
  const mon = placed(measureGlb(P('props/monitor.glb'))!, MONITOR_POS, DESK_YAW)
  assert.ok(
    SCREEN_ANCHOR.y > mon.lo[1] + 0.1 && SCREEN_ANCHOR.y < mon.hi[1],
    `SCREEN_ANCHOR.y ${SCREEN_ANCHOR.y} is not on the monitor's panel ` +
      `(${mon.lo[1].toFixed(2)}..${mon.hi[1].toFixed(2)})`,
  )
  assert.ok(
    SCREEN_ANCHOR.x >= mon.lo[0] - 0.02 && SCREEN_ANCHOR.x <= mon.hi[0] + 0.02,
    `SCREEN_ANCHOR.x ${SCREEN_ANCHOR.x} is off the monitor ` +
      `(${mon.lo[0].toFixed(2)}..${mon.hi[0].toFixed(2)})`,
  )
}

// ---------------------------------------------------------------------------
// 5. The glove dispenser is on a surface, in a band where it can exist
// ---------------------------------------------------------------------------

//
// A CENTRE POINT IS NOT A CHECK. This used to assert only that GLOVE_MOUNT_Y sat
// between the worktop and the wall units — and it passed while the dispenser's
// bottom was 5 mm BELOW the worktop, clipping through the counter, because
// GloveBox renders a 0.24 m body CENTRED on that value. Assert the body's real
// extent, derived from the same numbers the component renders.
{
  // Mirrors GloveBox.tsx: a 0.17 x 0.24 x 0.09 body tilted 0.14 rad about X,
  // centred on GLOVE_MOUNT_Y.
  const TILT = 0.14
  const [bw, bh, bd] = [0.17, 0.24, 0.09]
  const halfH = (bh / 2) * Math.cos(TILT) + (bd / 2) * Math.sin(TILT)
  const lo = GLOVE_MOUNT_Y - halfH
  const hi = GLOVE_MOUNT_Y + halfH

  assert.ok(
    lo > WORKTOP_Y,
    `the glove dispenser's base is at ${lo.toFixed(3)}, below the worktop at ` +
      `${WORKTOP_Y} — it is clipping through the counter`,
  )
  assert.ok(
    hi < UPPER_CABINET_MIN_Y,
    `the glove dispenser's top is at ${hi.toFixed(3)}, above the wall units at ` +
      `${UPPER_CABINET_MIN_Y} — it is inside the cabinets`,
  )
  // And the band has to be able to hold it at all. At UPPER_CABINET_MIN_Y =
  // 1.117 the band was 217 mm and no height could fit a 250 mm box, which is the
  // failure the old assertion could not express.
  assert.ok(
    UPPER_CABINET_MIN_Y - WORKTOP_Y > bh,
    `the splashback band is ${((UPPER_CABINET_MIN_Y - WORKTOP_Y) * 1000).toFixed(0)} mm ` +
      `and the dispenser is ${(bh * 1000).toFixed(0)} mm — it cannot fit at any height`,
  )
  // Width, too: it hangs between the station's two built-in shelf assemblies,
  // which leave the run from -0.325 to 0.128 clear.
  const spot = INTERACTABLES.find((i) => i.id === 'gloves')!
  assert.ok(
    spot.x - bw / 2 > -0.325 && spot.x + bw / 2 < 0.128,
    `the glove dispenser spans x ${(spot.x - bw / 2).toFixed(3)}..` +
      `${(spot.x + bw / 2).toFixed(3)}, outside the clear run -0.325..0.128 — ` +
      `it is inside a shelf`,
  )
}

// ---------------------------------------------------------------------------
// 6. Every solid prop is inside a collider that actually covers it
// ---------------------------------------------------------------------------
//
// THE ASSERTION THAT WOULD HAVE CAUGHT THE RESIZE.
//
// When the room grew from 4.8 m to 6.0 m, the desk, the cabinet and the
// bookcase were derived from ROOM_HALF and moved to the new walls. Their
// COLLIDERS were still literals and stayed at the old ones — so there was
// furniture you could walk straight through and empty floor you could not
// cross, and all 26 suites passed. Nothing had ever compared a prop to the box
// that is supposed to represent it.
//
// `fills` marks a prop that IS a piece of furniture, as opposed to something
// small resting on one.

for (const prop of PROPS) {
  if (!prop.fills) continue

  const m = measureGlb(P(`props/${prop.id}.glb`))
  if (!m) continue // covered by propScale.test.ts; not this file's job

  const box = placed(m, prop.pos, prop.yaw)
  // The collider that best covers this prop's footprint.
  let best = 0
  let bestBox: (typeof COLLIDERS)[number] | null = null
  for (const b of COLLIDERS) {
    const ox = Math.min(box.hi[0], b.maxX) - Math.max(box.lo[0], b.minX)
    const oz = Math.min(box.hi[2], b.maxZ) - Math.max(box.lo[2], b.minZ)
    if (ox <= 0 || oz <= 0) continue
    const area = ox * oz
    if (area > best) {
      best = area
      bestBox = b
    }
  }

  const footprint = (box.hi[0] - box.lo[0]) * (box.hi[2] - box.lo[2])
  assert.ok(
    bestBox,
    `prop '${prop.id}' at (${prop.pos[0].toFixed(2)}, ${prop.pos[2].toFixed(2)}) has no ` +
      `collider overlapping it at all — you can walk straight through it`,
  )
  assert.ok(
    best / footprint > 0.6,
    `prop '${prop.id}' is only ${((best / footprint) * 100).toFixed(0)}% covered by its ` +
      `collider — the box and the furniture have drifted apart`,
  )
}

// ---------------------------------------------------------------------------
// 7. The mirror is on a wall, at a height you can use
// ---------------------------------------------------------------------------

{
  assert.ok(
    Math.abs(Math.abs(MIRROR.x) - ROOM_HALF) < 0.1,
    `the mirror at x ${MIRROR.x} is not against a wall (they are at +/-${ROOM_HALF})`,
  )
  assert.ok(
    Math.abs(MIRROR.z) < ROOM_HALF,
    `the mirror at z ${MIRROR.z} is past the end of its wall`,
  )
  // Its centre above eye height, its bottom edge below it: you should be able to
  // see your own face without crouching or standing on anything.
  assert.ok(
    MIRROR.y > 1.2 && MIRROR.y - MIRROR.h / 2 < 1.62,
    `a mirror centred at ${MIRROR.y} with a ${MIRROR.h} m face is not usable at ` +
      `eye height`,
  )
  // And nothing is parked in front of it.
  for (const b of COLLIDERS) {
    const inFront =
      MIRROR.z > b.minZ && MIRROR.z < b.maxZ && b.maxX > MIRROR.x - 0.6 && b.minX < MIRROR.x
    assert.ok(
      !inFront,
      `a collider (x ${b.minX.toFixed(2)}..${b.maxX.toFixed(2)}, ` +
        `z ${b.minZ.toFixed(2)}..${b.maxZ.toFixed(2)}) stands in front of the mirror`,
    )
  }
}

console.log(
  'placement.test.ts — tray/stool, cabinet shelf, doorway, X-ray headroom, ' +
    'desk workstation, glove mount and every solid prop vs its collider ' +
    'plus the mirror, checked against the shipped assets, ' +
    'all assertions passed',
)
