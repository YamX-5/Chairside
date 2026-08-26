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
  MONITOR_POS,
  SCREEN_ANCHOR,
  SHELF_BOARDS,
  UPPER_CABINET_MIN_Y,
  WORKTOP_Y,
  XRAY_DOCK,
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

{
  assert.ok(
    GLOVE_MOUNT_Y > WORKTOP_Y && GLOVE_MOUNT_Y < UPPER_CABINET_MIN_Y,
    `the glove box mounts at ${GLOVE_MOUNT_Y}, which is not between the worktop ` +
      `(${WORKTOP_Y}) and the underside of the wall units (${UPPER_CABINET_MIN_Y}) — ` +
      `it is inside the cabinets`,
  )
}

console.log(
  'placement.test.ts — tray/stool, cabinet shelf, doorway, X-ray headroom, ' +
    'desk workstation and glove mount all checked against the shipped assets, ' +
    'all assertions passed',
)
