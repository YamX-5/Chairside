/**
 * The room's floor plan in metres, kept in one place so the geometry, the
 * collision boxes and the interaction zones can never drift apart.
 *
 * X runs left(-) to right(+), Z runs far(-) to near(+). The player enters at
 * the near edge facing -Z, looking into the room.
 *
 * These numbers are derived from ClinicKit, which lays the room out in KIT
 * UNITS at scale 2 — so every kit coordinate here is doubled. They previously
 * described the older hand-coded room and had drifted badly: the study trigger
 * sat at (-2.3, -2.6) while the desk is actually at (-3.8, -1.1), so walking to
 * the desk never once fired the prompt.
 */

import { ROOM_HALF } from './theme3d'

export interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// ---------------------------------------------------------------------------
// Furniture positions. THE SINGLE SOURCE OF TRUTH.
//
// Everything downstream — the collider, the interaction zone, where the chair
// mesh is drawn, where the patient sits — is DERIVED from these. Every placement
// bug in this project so far came from the same number being typed in two files
// and then drifting: the patient on the floor, the patient rotated ninety
// degrees, and the chair being moved without its collider or its "you are at
// the chair" trigger, which made the patient unreachable.
// ---------------------------------------------------------------------------

/** The dental chair: floor level, centred on its pedestal. */
// Moved +0.5 m off the back wall when the sterilisation station was rescaled to
// its real size. The station is 0.88 m deep, so its front edge is at z -1.47;
// at the old z -0.35 the gap to the chair was 0.39 m and PLAYER_RADIUS is 0.32,
// so nobody could walk between them. It is now 1.00 m.
export const CHAIR_POS: [number, number, number] = [0.7, 0, 0.15]

/** Which way it faces. 0 = her feet point +Z, toward the door. */
export const CHAIR_FACING = 0

/**
 * The cushion surface in the chair's own frame.
 *
 * MEASURED off the real chair model, never guessed — this one number decides
 * whether the patient sits in the chair or through the floor, and it has been
 * wrong before.
 *
 * Method (scripts/seat_probe.py): bucket every upward-facing polygon by height
 * and take the band with the greatest total area in the lower-middle of the
 * chair. Not the highest up-facing surface, which is the headrest, and not the
 * lowest, which is the base plate. The winning band was z = +0.485 with roughly
 * twice the area of any other, centred at (-0.08, -0.10) in Blender — which is
 * (-0.08, +0.10) in three.js, since Blender's +Y is three's -Z.
 */
// RE-MEASURED for the Ostem unit at its new 0.85 scale. Found by walking the
// `matress_seat` mesh's upward-facing faces (normal.z > 0.6) in Blender and
// taking the largest by area: 0.183 m2 at y 0.370, centred game (0.621, 0.365).
// The previous value belonged to a different chair model entirely, so it could
// not simply be scaled across.
export const SEAT_LOCAL: [number, number, number] = [-0.079, 0.37, 0.215]

/** Where the patient sits, in world space. Derived. */
export const SEAT_WORLD: [number, number, number] = [
  CHAIR_POS[0] + SEAT_LOCAL[0],
  CHAIR_POS[1] + SEAT_LOCAL[1],
  CHAIR_POS[2] + SEAT_LOCAL[2],
]

/**
 * The chair's footprint, as half-extents.
 *
 * Measured base plate is x[-0.35, +0.48], z[-0.35, +0.48]; the full silhouette
 * including the reclined back and leg rest reaches x[-0.64, +0.62]. This sits
 * between the two ON PURPOSE.
 *
 * Using the full silhouette would push the collider's near edge to x 0.96, and
 * the operator stands at x 0.65 — plus PLAYER_RADIUS that is 0.97, a one
 * centimetre overlap, and the treat trigger becomes unreachable. That exact
 * failure has now happened three times in this file (the desk trigger, the
 * waiting bench, the glove box), so it gets designed out rather than rediscovered.
 *
 * The overhanging parts are above knee height anyway; you can stand under them.
 */
// Measured off the exported unit, counting only geometry BELOW 1.2 m — you walk
// under the operating light arm, so including it would wall off a square metre
// of floor that is actually clear.
const CHAIR_HALF_X = 0.65
const CHAIR_MIN_Z = -0.62
const CHAIR_MAX_Z = 0.62

function boxAround(
  pos: [number, number, number],
  halfX: number,
  minZ: number,
  maxZ: number,
): Box {
  return {
    minX: pos[0] - halfX,
    maxX: pos[0] + halfX,
    minZ: pos[2] + minZ,
    maxZ: pos[2] + maxZ,
  }
}

// ---------------------------------------------------------------------------
// Measured constants — declared BEFORE anything derived from them.
//
// This file is read top to bottom at import time, so a constant used above its
// own declaration throws a TDZ error and takes the whole clinic with it. Four
// separate rounds of that happened while the room was being rebuilt, every one
// invisible to `tsc --noEmit` on the root config and caught only by
// `npm run typecheck`. Anything measured lives up here.
// ---------------------------------------------------------------------------

/**
 * The office desk's top surface.
 *
 * MEASURED off the shipped office_desk.glb, not guessed: bbox 1.316 x 0.750 x
 * 0.564 grounded at 0, with its slab node `Object_2` topping out at exactly
 * 0.750. The old comment on LAPTOP claimed 0.798 — a height this asset has
 * never had at its shipped scale, and which nothing had ever checked.
 */
export const DESK_TOP_Y = 0.75

/**
 * The laptop lid's height. Owned here because two files need it and one of them
 * was restating it.
 */
export const LAPTOP_LID_H = 0.195

/** How far the lid is tilted back, in radians. Matches SCREEN_ROT in DeskScreen. */
export const LAPTOP_TILT = 0.18

/** The desk's own position, so everything ON it is derived from one number. */
export const DESK_POS: [number, number, number] = [
  // Against the -X wall. office_desk.glb is 0.564 m deep and yawed a quarter
  // turn, so half its depth is what stands between its centre and the plaster.
  -ROOM_HALF + 0.564 / 2 + 0.04,
  0,
  0.3,
]

/** The desk faces into the room: you sit at +X of it and look back at -X. */
export const DESK_YAW = Math.PI / 2

/**
 * The monitor, at the back of the desk.
 *
 * MEASURED: monitor.glb is 0.600 x 0.450 x 0.159 m after normalisation, so at
 * yaw PI/2 it takes 0.159 m of the desk's depth. Set 0.16 m back from the desk's
 * centre it clears the wall and leaves the front of the top free for a keyboard.
 */
export const MONITOR_POS: [number, number, number] = [DESK_POS[0] - 0.16, DESK_TOP_Y, DESK_POS[2]]
export const MONITOR_YAW = DESK_YAW

/**
 * The centre of the monitor's picture, in world space.
 *
 * This is the point the study window grows out of and shrinks back into, and
 * where the in-world screen is drawn. 0.30 m above the monitor's foot is the
 * middle of the panel — the bottom 0.12 m of the model is stand.
 *
 * There is no laptop any more. The material is read on a screen you can
 * actually see, which a 0.195 m laptop lid rendered in world-space text was not.
 */
export const SCREEN_ANCHOR = {
  x: MONITOR_POS[0] + 0.082, // the picture is on the front face, not the centre
  y: DESK_TOP_Y + 0.3,
  z: MONITOR_POS[2],
}

/** The in-world screen's size, matching the monitor's panel. */
export const SCREEN_W = 0.52
export const SCREEN_H = 0.3

/** Alias, so nothing that used to sit "on the laptop" silently moves. */
export const LAPTOP = SCREEN_ANCHOR

/**
 * The bookcase's position. Named because XRAY_DOCK stands on it — the dock used
 * to restate these numbers, so moving the bookcase left the X-ray floating.
 */
export const BOOKCASE_POS: [number, number, number] = [
  -1.05,
  0,
  // Against the +Z wall; book_shelf.glb is 0.269 m deep.
  ROOM_HALF - 0.269 / 2 - 0.04,
]

/**
 * The glass cabinet's position. Named because the cabinet instruments sit on
 * its shelves. They used to be drawn in a primitive box derived from CHAIR_POS
 * instead, which is how they ended up 2.2 m away and buried in the station.
 */
export const CABINET_POS: [number, number, number] = [
  // Against the +X wall; closet.glb is 0.538 m deep and yawed a quarter turn.
  ROOM_HALF - 0.538 / 2 - 0.08,
  0,
  0.6,
]

/**
 * The sterilisation station's footprint, as ONE named box.
 *
 * Named and exported rather than written inline in COLLIDERS, because three
 * separate files need to know where its front face is and every one of them
 * used to guess. `GloveBox.tsx` carried `CABINET_FACE_Z = -3.1` — a value from
 * the old 8 x 8 m room — with a comment claiming it was "COLLIDERS' maxZ for
 * that box". It was not, and had not been for two room sizes, so the glove box
 * was rendering almost a metre outside the back wall.
 *
 * Measured off the exported asset: 3.92 m wide, 0.88 m deep, 2.13 m tall.
 */
// Against the -Z wall. The asset is 0.884 m deep, so its centre sits half of
// that off the plaster. PROPS reads this rather than restating it — the two used
// to be separate numbers kept equal by hand.
const STATION_ORIGIN_Z = -ROOM_HALF + 0.884 / 2 + 0.05

/**
 * Where things standing ON the worktop sit, front to back.
 *
 * Derived from the station, because they travel with it. When the room grew and
 * the station slid back to meet the new wall, hand-typed copies of this stayed
 * put and left the masks and the instrument tray hanging in mid-air in front of
 * the counter — with every test still green, because nothing asserted that a
 * prop resting on another prop moves with it.
 */
export const WORKTOP_ITEM_Z = STATION_ORIGIN_Z - 0.14

/**
 * The wall mirror.
 *
 * On the +X wall between the cabinet and the sterilising run, at the one stretch
 * of that wall with nothing standing against it. Hung so its centre is a little
 * above EYE_HEIGHT — a mirror you have to stoop to use is a mirror nobody uses.
 *
 * Derived from ROOM_HALF like every other wall fitting, so growing the room
 * takes it along instead of leaving it hanging in mid-air.
 */
export const MIRROR = {
  x: ROOM_HALF - 0.03,
  y: 1.55,
  z: -1.7,
  /** Facing -X, back into the room. */
  yaw: -Math.PI / 2,
  w: 0.8,
  h: 1.1,
}

/**
 * The EtO gas cart, on the floor against the +X wall.
 *
 * Its footprint is 0.84 m square, chamber door included — the door swings, and
 * a collider that ignored it would let you walk through it.
 */
export const ETO_POS: [number, number, number] = [ROOM_HALF - 0.42 - 0.06, 0, -0.95]

export const STATION = {
  minX: -1.96,
  maxX: 1.96,
  minZ: -ROOM_HALF,
  // Measured half-depth forward of its own origin, which is itself derived from
  // the wall. Nothing in this box is a coordinate anyone typed.
  maxZ: STATION_ORIGIN_Z + 0.884 / 2,
} as const

/**
 * The station's real surfaces, as offsets from the prop's own origin.
 *
 * MEASURED PER NODE off sterilization_centre.glb. Not from STATION, which is a
 * BOUNDING box — this file already learned once (see WORKTOP_Y) that a bounding
 * box is not a surface, and then made the same mistake again in Z: the previous
 * values were `STATION.maxZ` and `STATION.maxZ - 0.05`, which put the upper
 * cabinet "face" 439 mm proud of the actual doors.
 *
 * The bounding box's front face is not any real panel either. It is the merged
 * drawer-pull mesh, which spans the whole run from y 0.06 to 1.15 and is the
 * frontmost thing at every height — which is exactly why a per-height-band scan
 * reported one consistent front face and was believed.
 */

/** The drawer fronts — what you stand in front of and pull. */
export const STATION_FACE_Z = STATION_ORIGIN_Z + 0.324

/** The glazed upper cabinet doors. */
export const STATION_UPPER_FACE_Z = STATION_ORIGIN_Z - 0.062

/**
 * The back panel behind the worktop, between the counter and the wall units.
 * Anything bolted to the run at working height mounts HERE — it is the only
 * vertical surface in that band.
 */
export const STATION_SPLASHBACK_Z = STATION_ORIGIN_Z - 0.44

/**
 * Where the upper cabinets begin. Measured: the lowest carcass sits at 1.117.
 * The gap between WORKTOP_Y and this is the only band on the run where
 * something can stand on the counter or hang on the wall without fouling them.
 */
export const UPPER_CABINET_MIN_Y = 1.117

/**
 * Where the glove dispenser bolts to the splashback.
 *
 * Inside the WORKTOP_Y..UPPER_CABINET_MIN_Y band. It used to be 1.24, which is
 * above 1.117 and therefore inside the wall units.
 */
export const GLOVE_MOUNT_Y = 1.02

/** Furniture the player cannot walk through. Kit position x2, plus footprint. */
export const COLLIDERS: Box[] = [
  // EVERY box here is derived from the prop it belongs to, and every wall prop
  // from ROOM_HALF. Growing the room from 4.8 m to 6.0 m moved the desk, the
  // cabinet and the bookcase to the new walls while these boxes stayed at the
  // old ones — furniture you could walk through, and open floor you could not —
  // and all 26 suites stayed green. Hence: no literals.

  STATION,

  // Derived from CHAIR_POS. Deliberately tight — an oversized chair collider
  // plus the player radius is what stopped anyone getting near the patient.
  boxAround(CHAIR_POS, CHAIR_HALF_X, CHAIR_MIN_Z, CHAIR_MAX_Z),

  // The desk. office_desk.glb is 1.316 x 0.564 and yawed a quarter turn, so its
  // width runs along Z and its depth along X.
  {
    minX: -ROOM_HALF,
    maxX: DESK_POS[0] + 0.564 / 2,
    minZ: DESK_POS[2] - 1.316 / 2,
    maxZ: DESK_POS[2] + 1.316 / 2,
  },

  // The glass cabinet. closet.glb is 1.284 x 0.538.
  {
    minX: CABINET_POS[0] - 0.538 / 2,
    maxX: ROOM_HALF,
    minZ: CABINET_POS[2] - 1.284 / 2,
    maxZ: CABINET_POS[2] + 1.284 / 2,
  },

  // The EtO gas cart.
  {
    minX: ETO_POS[0] - 0.42,
    maxX: ETO_POS[0] + 0.42,
    minZ: ETO_POS[2] - 0.42,
    maxZ: ETO_POS[2] + 0.42,
  },

  // The bookcase. Shallow at 0.269 m, so the approach in front of it stays clear
  // of PLAYER_RADIUS and the portable X-ray on top stays reachable.
  {
    minX: BOOKCASE_POS[0] - 1.11 / 2,
    maxX: BOOKCASE_POS[0] + 1.11 / 2,
    minZ: BOOKCASE_POS[2] - 0.269 / 2,
    maxZ: ROOM_HALF,
  },
]


export type InteractableId =
  | 'study'
  | 'solve'
  | 'drawer'
  | 'board'
  | 'door'
  | 'gloves'
  | 'xray'

export interface Interactable {
  id: InteractableId
  /** Where the thing is; the prompt shows when the player is within radius. */
  x: number
  z: number
  radius: number
}

/**
 * Standing positions, not object positions: each is where the player stands to
 * use the thing, which is in FRONT of it rather than inside its collider.
 */
export const INTERACTABLES: Interactable[] = [
  // In front of the laptop, clear of the desk collider (maxX -1.72) by more
  // than PLAYER_RADIUS.
  // In front of the desk, clear of it by more than PLAYER_RADIUS.
  { id: 'study', x: DESK_POS[0] + 0.95, z: DESK_POS[2], radius: 1.1 },
  {
    // DERIVED: the operator's position, at the patient's left where a
    // right-handed dentist stands. Typed independently of CHAIR_POS once, this
    // ended up two metres from the chair and the patient was unreachable.
    id: 'solve',
    // 1.15 m out, not 0.95. When the unit was re-measured its half-width grew
    // from 0.50 to 0.65, and 0.95 - 0.65 = 0.30 is less than PLAYER_RADIUS —
    // the operator's own spot was inside the chair's collider, so the prompt
    // could never fire. Offsets from a body must clear it by the player radius.
    x: CHAIR_POS[0] - 1.15,
    // Pulled toward the patient's head: the 11 o'clock position a right-handed
    // operator actually works from, rather than level with her hips.
    z: CHAIR_POS[2] - 0.45,
    radius: 1.1,
  },
  // The doorway in the near wall — and where the patient walks in from.
  { id: 'door', x: 1.25, z: ROOM_HALF - 0.9, radius: 0.9 },
  // In front of the station's LEFT drawer bank. It was at x 1.75, which is now
  // inside the EtO cart's footprint — an interactable you cannot stand at is an
  // interactable that does not exist.
  { id: 'drawer', x: -1.3, z: STATION.maxZ + 0.45, radius: 0.8 },
  // The portable X-ray, on top of the bookcase. Replaces the 'board' zone that
  // used to be here: that one had no branch in interact() — a prompt that could
  // never do anything — and its 0.85 m radius covered every spot you could stand
  // on to reach the X-ray, so the device could not be picked up at all.
  //
  // The cork board itself stays as scenery. Not everything on a wall needs to be
  // a verb.
  { id: 'xray', x: BOOKCASE_POS[0], z: BOOKCASE_POS[2] - 0.269 / 2 - 0.42, radius: 0.6 },
  // The glove box, on the sterilising run — where you actually glove up.
  // Clear of the station collider (maxZ -1.47) by more than PLAYER_RADIUS.
  { id: 'gloves', x: 0.35, z: STATION.maxZ + 0.45, radius: 0.5 },
]

/**
 * Interactables by id, so anything that needs one place in the room can DERIVE
 * it instead of retyping the coordinates. The doorway used to be typed twice;
 * the two copies drifted 2.14 m apart and only one of them was ever tested.
 */
export const INTERACTABLE_BY_ID = new Map(INTERACTABLES.map((i) => [i.id, i]))

/**
 * The Sketchfab props, and where each one stands.
 *
 * THE SINGLE SOURCE OF TRUTH for prop placement — the same table drives the
 * lighting bake (so occlusion is computed where the object actually stands) and
 * the runtime placement. Two copies of a position is the bug that has cost this
 * project more time than any other.
 *
 * Every entry is checked against COLLIDERS by layout.test.ts: a prop that
 * intersects furniture, or floats outside the room, fails the suite rather than
 * shipping and being noticed in a screenshot three weeks later.
 *
 * `y` is the BASE of the object. import_asset.py grounds every asset so its
 * lowest point sits at y = 0, which is why a prop on the floor is y = 0 and a
 * prop on the counter is the counter height.
 */
export interface Prop {
  /** File stem in public/models/props/. */
  id: string
  pos: [number, number, number]
  /** Y rotation, radians. */
  yaw: number
  /** True for anything the player picks up or that moves — AO-only bake. */
  moves?: boolean
  /**
   * This prop IS the geometry of an existing collider.
   *
   * Most floor props must NOT sit inside a collider — you would walk into an
   * invisible box. But a prop that REPLACES procedural furniture is supposed to
   * occupy that furniture's collider exactly: the sterilising bench is the sink
   * run, so it belongs inside the sink run's box. Without this distinction the
   * placement test cannot tell "correctly furnishing a collider" from
   * "accidentally buried in one", and it flagged the bench as a bug.
   */
  fills?: boolean
}


/**
 * The parts of the sterilisation station that actually open.
 *
 * WHY THIS IS A TABLE AND NOT A COMPONENT DETAIL
 * ---------------------------------------------
 * The station is a CAD export: 75 meshes, hundreds of stray loose edges, and
 * every cabinet front merged into its carcass. Splitting it into per-drawer
 * objects is not tractable — sliding a carcass mesh pulls the whole cabinet out
 * of the run like a drawer the size of a fridge, which was tried and looked
 * exactly as bad as it sounds.
 *
 * But TWO kinds of part did survive as separate meshes: the glazed door panels
 * (0.01 m thin, material "Material.010") and one real drawer front (0.62 x
 * 0.25 x 0.06 m). Those were renamed to stable node names in Blender and
 * re-exported, and they are what this table addresses.
 *
 * Every hinge side and travel below was verified by applying the transform in
 * Blender and rendering it before a line of this was written — the doors swing
 * clear of each other and the drawer slides without passing through its carcass.
 */
export type OpenableKind = 'drawer' | 'door'

export interface Openable {
  /** Which prop's .glb these nodes live in. */
  prop: 'sterilization_centre' | 'closet'
  /**
   * The node names that move TOGETHER, set by the Blender export.
   *
   * A list, not one name, because a leaf is not always one mesh: the glass
   * cabinet's doors are a wooden frame plus a separate glass pane, and hinging
   * each on its own bounding box would give them different pivots and swing the
   * glass out of its frame.
   */
  nodes: string[]
  kind: OpenableKind
  /**
   * Which vertical edge a door is hinged on, looking at it from the room.
   * Doors hinge on the OUTER edge of their unit so they open away from each
   * other rather than colliding in the middle of the run.
   */
  hinge?: 'left' | 'right'
  /** Drawers: metres it slides out. Doors: radians it swings. */
  travel: number
  /**
   * Which stretch of the run it belongs to.
   *
   * You open the section you are standing at. A clinician reaching for a drawer
   * does not fling every cabinet in the room open at once, and staging it that
   * way looked like a poltergeist.
   */
  section: 'left' | 'mid' | 'right' | 'cabinet'
}

const DOOR_SWING = 1.31 // ~75 degrees — enough to see in, short of blocking the walkway

/**
 * A stable id for one openable: its first node name.
 *
 * Openables are addressed individually — the player opens ONE drawer, not every
 * cupboard in the room — so each needs a key that survives reordering the table.
 * The first node name is already unique (openables.test.ts asserts no node is
 * claimed twice) and is meaningful in a debugger, which an index is not.
 */
/**
 * The glass cabinet's two door leaves.
 *
 * Named because the cabinet instruments are gated on them: they are reachable
 * exactly when a door is open, which is what makes taking the axe a decision
 * rather than an accident.
 */
export const CABINET_DOOR_IDS = [
  'closet__LeftDoor_Wood049_2K_0',
  'closet__RightDoor_Wood049_2K_0',
] as const

export function openableId(o: Openable): string {
  return o.nodes[0]
}

export const OPENABLES: Openable[] = [
  // --- the sterilisation station -------------------------------------------
  // The one genuine drawer front, directly in front of the 'drawer' prompt.
  { prop: 'sterilization_centre', nodes: ['Drawer_00'], kind: 'drawer', travel: 0.32, section: 'left' },

  // Upper glazed doors, left to right along the run.
  { prop: 'sterilization_centre', nodes: ['Door_00'], kind: 'door', hinge: 'left', travel: DOOR_SWING, section: 'left' },
  { prop: 'sterilization_centre', nodes: ['Door_01'], kind: 'door', hinge: 'left', travel: DOOR_SWING, section: 'left' },
  { prop: 'sterilization_centre', nodes: ['Door_02'], kind: 'door', hinge: 'left', travel: DOOR_SWING, section: 'mid' },
  { prop: 'sterilization_centre', nodes: ['Door_03'], kind: 'door', hinge: 'right', travel: DOOR_SWING, section: 'mid' },
  { prop: 'sterilization_centre', nodes: ['Door_04'], kind: 'door', hinge: 'right', travel: DOOR_SWING, section: 'right' },
  // The tall end cabinet, upper and lower.
  { prop: 'sterilization_centre', nodes: ['Door_05'], kind: 'door', hinge: 'right', travel: DOOR_SWING, section: 'right' },
  { prop: 'sterilization_centre', nodes: ['Door_06'], kind: 'door', hinge: 'right', travel: DOOR_SWING, section: 'right' },

  // --- the glass cabinet the instruments live in ---------------------------
  // Frame and glass move as one leaf. These names come straight out of
  // closet.glb; the asset was authored with its doors already separate, so
  // unlike the station it needed no Blender pass.
  {
    prop: 'closet',
    nodes: ['closet__LeftDoor_Wood049_2K_0', 'closet__Glass.001_Glass_0'],
    kind: 'door',
    hinge: 'left',
    travel: DOOR_SWING,
    section: 'cabinet',
  },
  {
    prop: 'closet',
    nodes: ['closet__RightDoor_Wood049_2K_0', 'closet__Glass_Glass_0'],
    kind: 'door',
    hinge: 'right',
    travel: DOOR_SWING,
    section: 'cabinet',
  },
]

/**
 * The one part the 'drawer' prompt opens when you press E at the station.
 *
 * A specific part, not a "section". Opening a section flung the drawer and both
 * cupboards above it open together, which is not what reaching for a drawer
 * looks like. Everything else on the run is opened by clicking it.
 */
export const DRAWER_PROMPT_OPENS = 'Drawer_00'

/**
 * The sterilisation station's worktop height — the surface things stand ON.
 *
 * THE BUG THIS CONSTANT EXISTS TO PREVENT
 * ---------------------------------------
 * sterilization_centre.glb is a COMPOSITE asset: base drawer cabinets, a worktop
 * with a sink, and glazed upper wall cabinets above it. The import pipeline
 * scaled it by its BOUNDING BOX height to 0.90 m, because 0.90 m is a worktop
 * height and the bounding box was mistaken for the worktop.
 *
 * That shrank the entire suite to 0.90 m tall. Its real worktop landed at
 * 0.38 m — knee height — and the masks, the instrument tray and the autoclave,
 * all placed at y 0.90, ended up standing on the ROOF of the upper cabinets.
 * Every test passed, because nothing in the codebase knew that one prop was
 * supposed to be resting on another.
 *
 * The general rule: for a composite asset, the number that matters is the height
 * of its FUNCTIONAL SURFACE, not of its bounding box. The station is now scaled
 * so this value is true, which makes it 3.92 x 0.88 x 2.13 m — drawers from
 * 0.15 to 0.90 (waist), upper cabinets from 1.20 to 2.13 (eye level).
 *
 * 0.90 m is the standard clinical worktop height: you stand at it to scrub,
 * pack and set trays.
 */
export const WORKTOP_Y = 0.9

/**
 * The bookcase's shelf heights, in metres off the floor.
 *
 * MEASURED, not chosen — walked out of book_shelf.glb's own meshes in Blender
 * by collecting every wide, deep, thin slab. Guessing a shelf height is how
 * things end up floating above a board or sunk through it, and neither is
 * visible until somebody renders it.
 *
 * This replaced a wall-mounted "floating shelves" asset whose boards rendered
 * as black shards — the model was simply bad, and no amount of normal
 * recalculation fixed it. Rendering it in Blender first is the only reason
 * that never reached the browser.
 */
export const SHELF_BOARDS = [0.048, 0.394, 0.742, 1.09, 1.439, 1.776] as const

/**
 * Where the portable X-ray stands on its charging cradle.
 *
 * The 1.09 m board: chest height when you walk up to it. A handheld X-ray you
 * have to reach over your head for is not a handheld X-ray, and one at ankle
 * height is worse.
 */
/**
 * The dental unit's bracket tray — where the instruments actually live.
 *
 * MEASURED off dental_chair.glb's own `Object_14` node: local x 0.269..0.651,
 * z -0.046..0.201, top at y 0.906. The unit ships with a bracket tray; the game
 * was drawing a second, invented one.
 *
 * That invented slab hung off CHAIR_POS by one literal while the operator's
 * stool hung off it by a different literal, and nothing compared the two. The
 * result: 36% of the tray's footprint was inside the stool's leather cushion —
 * mirror, explorer and suction rendered INSIDE it — while the syringe and
 * handpiece had no surface under them at all.
 */
export const BRACKET_TRAY = {
  x: CHAIR_POS[0] + (0.269 + 0.651) / 2,
  y: 0.906,
  z: CHAIR_POS[2] + (-0.046 + 0.201) / 2,
}

/**
 * The shelf inside the glass cabinet that the cabinet instruments sit on.
 *
 * MEASURED off closet.glb: interior shelves at y 0.490, 0.965 and 1.441, each
 * spanning local x -0.603..0.603, z -0.224..0.179. The middle one is at chest
 * height. The prop is yawed -PI/2, so its local x runs along world z.
 *
 * Before this, the cabinet instruments lived in a primitive box drawn by
 * InstrumentTray at an offset from CHAIR_POS — 2.2 m from the real cabinet,
 * sealed on all six sides so its contents were invisible, and 0.24 m buried in
 * the sterilisation station's drawer bank. Deriving it from CHAIR_POS is what
 * dragged it there when the chair moved.
 */
export const CABINET_SHELF = {
  x: CABINET_POS[0],
  y: 0.965,
  z: CABINET_POS[2],
  yaw: -Math.PI / 2,
  /** Usable run along the shelf, in metres. */
  span: 1.2,
}

export const XRAY_DOCK = {
  // DERIVED from the bookcase, which is the thing it stands on. These used to
  // restate book_shelf's own pos verbatim, so moving the bookcase left the
  // X-ray hanging in the air where the bookcase used to be.
  x: BOOKCASE_POS[0],
  z: BOOKCASE_POS[2],
  /**
   * The TOP of the bookcase — the only surface in it the device fits on.
   *
   * Measured: portable_xray.glb is 0.360 m tall, and every enclosed board in
   * book_shelf.glb has 0.314–0.325 m of headroom. It was docked on board 3,
   * where its top 34 mm was driven up through the board above it and through
   * two of the books already sitting there.
   *
   * This is a deliberate design call, not a board-index bump: 1.776 m is above
   * EYE_HEIGHT, so you look up at it rather than straight at it. The two
   * alternatives were the worktop — which fits, but stores equipment on a scrub
   * surface — and shrinking the device, which would be a lie about its size.
   */
  y: SHELF_BOARDS[5],
  yaw: Math.PI,
}

export const PROPS: Prop[] = [
  // EVERY position and height here was verified in Blender against the actual
  // exported .glb, not chosen on paper. The props on disk used to be raw
  // Sketchfab downloads -- doctors_chair measured 15,596 metres, shelf 66 m,
  // carestream_xray 226 m -- and ClinicProps applies NO scale, so the game was
  // placing kilometre-wide furniture at these coordinates. That, not styling,
  // is what made the room look random.

  // --- the operatory ---------------------------------------------------------
  { id: 'doctors_chair', pos: [CHAIR_POS[0] - 0.85, 0, CHAIR_POS[2] - 0.05], yaw: -Math.PI / 2 },

  // --- back wall: the sterilising run ----------------------------------------
  // 1.66 x 0.37 x 0.90 m, spanning x -0.53..1.13. Everything below sits ON it,
  // which is why their y is 0.90 and their x stays inside that span. The
  // autoclave used to sit at x 1.90 -- past the right-hand end of the bench,
  // floating at 0.90 m with nothing underneath it.
  { id: 'sterilization_centre', pos: [0, 0, STATION_ORIGIN_Z], yaw: 0, fills: true },
  // ON THE WORKTOP at exactly WORKTOP_Y. These three previously sat at y 0.9
  // which, on the mis-scaled station, was the ROOF of the upper cabinets — the
  // masks, the tray and the autoclave were all perched on top of the unit.
  // The counter is NOT clear all the way along: the sink breaks it at
  // x -0.76..-0.36 and the right-hand third is a raised section under the tall
  // end cabinet. Both x values below sit in a run that was measured clear, with
  // headroom checked against the upper cabinets above them.
  { id: 'masks_disposable', pos: [-1.6, WORKTOP_Y, WORKTOP_ITEM_Z], yaw: 0 },
  { id: 'dental_misc', pos: [-1.05, WORKTOP_Y, WORKTOP_ITEM_Z], yaw: 0 },

  // --- floor-standing equipment -------------------------------------------------
  // The EtO sterilizer is a WHEELED GAS CART, not a benchtop unit: castors, two
  // ethylene-oxide cylinders on the deck, control panel on top. It shipped at
  // 0.55 m tall standing on the worktop, which was wrong twice over — less than
  // half its real height, and on a surface it was never designed to sit on. At
  // its true 1.30 m it does not fit under the wall cabinets at all (they leave
  // 0.30 m), which is the geometry telling you it belongs on the floor.
  { id: 'eto_sterilizer', pos: ETO_POS, yaw: 0, fills: true },

  // --- left wall: the admin corner --------------------------------------------
  // The desk sits under LAPTOP (-2.02, 0.8, 0.3) so the laptop lands ON it.
  { id: 'office_desk', pos: DESK_POS, yaw: DESK_YAW, fills: true },
  // The workstation. Every y here is DESK_TOP_Y, not a number of its own — they
  // are ON the desk, and the desk owns how high its top is.
  { id: 'monitor', pos: MONITOR_POS, yaw: MONITOR_YAW, fills: true },
  { id: 'keyboard', pos: [DESK_POS[0] + 0.1, DESK_TOP_Y, DESK_POS[2]], yaw: DESK_YAW },
  { id: 'mouse', pos: [DESK_POS[0] + 0.1, DESK_TOP_Y, DESK_POS[2] + 0.3], yaw: DESK_YAW },

  // --- right wall: storage ------------------------------------------------------
  // A glass-fronted cabinet with real internal shelves — which is where the
  // cabinet instruments are meant to be seen.
  { id: 'closet', pos: CABINET_POS, yaw: -Math.PI / 2, fills: true },

  // --- near wall: the bookcase --------------------------------------------------
  // Floor-standing, 1.11 x 0.27 x 1.80 m, turned to face back into the room —
  // yaw Math.PI, or you get a blank back panel and a hidden X-ray. It brings
  // its own books, which is why the separate books_variety prop is gone.
  { id: 'book_shelf', pos: BOOKCASE_POS, yaw: Math.PI, fills: true },
]


/** Where the player spawns, and which way they face (radians, 0 = looking -Z). */
export const SPAWN = {
  // You start where you came in. Derived, so growing the room cannot spawn the
  // player inside a wall or halfway across the floor from the door.
  x: INTERACTABLE_BY_ID.get('door')!.x,
  z: INTERACTABLE_BY_ID.get('door')!.z - 0.2,
  yaw: 0,
}






// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

export interface Seat {
  id: string
  label: string
  /** Where you stand to sit down. */
  approach: { x: number; z: number }
  /** Where the eyes end up once seated. */
  eye: { x: number; y: number; z: number }
  /** Which way you face while sitting, radians. 0 = looking -Z. */
  yaw: number
}

/**
 * Somewhere to actually sit.
 *
 * Seated eye height is ~1.18 m against a standing 1.62 — a real difference you
 * feel, and the reason sitting at the desk makes the laptop readable without
 * any camera trickery.
 *
 * `approach` is where you stand to trigger it, and it must be walkable; the
 * reachability assertions in layout.test.ts cover these the same way they cover
 * the interactables, because a seat you cannot stand next to is a dead feature.
 */
export const SEATS: Seat[] = [
  {
    id: 'desk',
    label: 'the desk chair',
    approach: { x: -1.35, z: 0.3 },
    // Facing the desk: the laptop is at x -2.02, so look -X.
    //
    // forwardFromYaw is (-sin y, -cos y) — movement.ts:19. Looking -X therefore
    // needs sin(yaw) > 0, i.e. +PI/2. All three seats once carried the opposite
    // sign (the convention the kit ROTATIONS use), which put this seat 180
    // degrees from the laptop.
    eye: { x: -1.6, y: 1.18, z: 0.3 },
    yaw: Math.PI / 2,
  },
  {
    id: 'stool',
    label: "the operator's stool",
    approach: { x: CHAIR_POS[0] - 1.0, z: CHAIR_POS[2] - 0.05 },
    // Beside the chair, turned toward the patient — who is at +X from here, so
    // forward.x must be positive, which needs sin(yaw) < 0.
    // Seat 0.54 (see PROP_SCALES.doctors_chair) plus 0.77 sitting eye height —
    // 50th-percentile adult, eye above the seat surface. These two numbers must
    // move together: the eye was 1.18 against a cushion rendered at 0.85, so the
    // camera sat 310 mm below the seat it was supposed to be on.
    eye: { x: CHAIR_POS[0] - 0.72, y: 1.31, z: CHAIR_POS[2] - 0.05 },
    yaw: -Math.PI / 2,
  },
]

export const SEAT_BY_ID = new Map(SEATS.map((s) => [s.id, s]))

/** The nearest seat you could sit on from here, or null. */
export function nearestSeat(x: number, z: number, radius = 1.1): Seat | null {
  let best: Seat | null = null
  let bestDist = Infinity
  for (const s of SEATS) {
    const d = Math.hypot(s.approach.x - x, s.approach.z - z)
    if (d < radius && d < bestDist) {
      bestDist = d
      best = s
    }
  }
  return best
}

/**
 * The doorway in the near wall — where the patient walks in from.
 *
 * DERIVED from the 'door' interactable: the spot you stand at to use the door
 * is the spot she comes in through. There is no second doorway.
 *
 * It used to be `{ x: 2.0, z: 3.9 }` — a raw coordinate from the CC0 kit
 * (kit x1 x SCALE 2, kit z H x SCALE 2, inset 0.1) belonging to the original
 * 8 x 8 m room. ROOM_HALF is 2.4, so z 3.9 is a metre and a half OUTSIDE the
 * building. `PatientRig` builds her walk from this, so she spawned in the car
 * park, was depth-occluded by the near wall for the first second and a half,
 * then materialised out of the plaster mid-stride. The tested copy — the
 * interactable — was never the copy that was used.
 */
export const DOORWAY = {
  x: INTERACTABLE_BY_ID.get('door')!.x,
  z: INTERACTABLE_BY_ID.get('door')!.z,
}

/** True when the point is inside any collider, expanded by the player radius. */
export function blocked(x: number, z: number, radius: number): boolean {
  for (const b of COLLIDERS) {
    if (
      x > b.minX - radius &&
      x < b.maxX + radius &&
      z > b.minZ - radius &&
      z < b.maxZ + radius
    ) {
      return true
    }
  }
  return false
}

/**
 * How much being turned away from something costs it, in metres of equivalent
 * distance. Dead behind you costs twice this.
 *
 * Facing REORDERS candidates; it never extends reach. A zone you are not inside
 * stays out of range however squarely you look at it.
 */
const FACING_BIAS = 0.55

/**
 * The interactable you are addressing, or null.
 *
 * Takes heading into account, because pure distance produced prompts that
 * flip-flopped as you turned on the spot: standing between the drawer and the
 * glove box, whichever happened to be a few centimetres nearer won, regardless
 * of which one you were looking at.
 *
 * `yaw` is optional and must stay so — layout.test.ts calls this with two args.
 */
export function nearestInteractable(x: number, z: number, yaw?: number): InteractableId | null {
  // movement.ts's convention: forward at yaw 0 is -Z.
  const fx = yaw === undefined ? 0 : -Math.sin(yaw)
  const fz = yaw === undefined ? 0 : -Math.cos(yaw)
  let best: InteractableId | null = null
  let bestScore = Infinity
  for (const it of INTERACTABLES) {
    const dx = it.x - x
    const dz = it.z - z
    const d = Math.hypot(dx, dz)
    if (d >= it.radius) continue
    const score =
      yaw === undefined || d <= 1e-3
        ? d
        : d + (1 - ((dx / d) * fx + (dz / d) * fz)) * FACING_BIAS
    if (score < bestScore) {
      bestScore = score
      best = it.id
    }
  }
  return best
}

