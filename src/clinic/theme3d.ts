/**
 * 3D palette, matched to the reference video (reference/video-frames.jpg).
 *
 * The look is warm and bright, not clinical: cream walls, honey-wood joinery
 * and teal upholstery, lit by soft daylight through an arched window. Almost no
 * hard shadow anywhere — the reference reads as diffuse, airy and friendly, and
 * a dark room reads as a completely different game.
 */
/**
 * VALUE STRUCTURE, not just hue.
 *
 * The first palette had a measured luminance collapse: ceiling 97.5%, wall
 * 93.0%, floor 90.3% — a 7.8-point spread with all three sitting in the top 11%
 * of the range. Desaturate a screenshot and the room read as one uniform pale
 * grey field, with no floor/wall/ceiling structure for anything to sit inside.
 * That is a large part of why the scene looked flat regardless of the geometry.
 *
 * Floor and shaded walls are pushed down hard, keeping the same warm hue
 * family, to give roughly 25 points of separation between floor and ceiling.
 *
 * How to check: screenshot the room and desaturate it in any image tool. It must
 * read as three distinct greys, not one.
 */
export const C = {
  wall: 0xf4ece1, // warm cream — 93.0% luminance
  wallWarm: 0xe8d9c6, // shaded wall face — ~85%, was 89.7
  ceiling: 0xfcf8f3, // 97.5%, the lightest plane
  floor: 0xcbb9a4, // pale warm stone — ~74%, was 90.3
  skirting: 0xc99a63, // wood dado rail / skirting

  wood: 0xc99a63, // honey wood — doors, desks, shelving
  woodDark: 0xa87a45,
  woodLight: 0xdcb387,

  teal: 0x6dc5bc, // chair + bench upholstery
  tealDeep: 0x4fa79e,

  white: 0xfbf8f4,
  metal: 0xcfd4d8,
  skin: 0xd9a276,
  // Medical nitrile exam blue. Deeper and slightly violet next to the old
  // periwinkle, which read as a costume glove rather than a clinical one — and
  // it has to hold up close, because in multiplayer other people see your hands.
  glove: 0x4f83c8,
  /** The rolled bead at the wrist, darker than the glove it sits on. */
  gloveCuff: 0x3d68a8,
  window: 0xfff6e2,
  cork: 0xd9b98c,
  star: 0xf5c249,
  leaf: 0x5fa361,
  pot: 0xc4764f,
} as const

/** Player physics — eye height and speed tuned to feel like a person walking. */
export const EYE_HEIGHT = 1.62
export const WALK_SPEED = 2.6 // metres per second
export const PLAYER_RADIUS = 0.32

/**
 * Room is 6.0 x 6.0 metres, walls at ±3.0.
 *
 * Grown from 4.8 m. A real single operatory is 10-14 m2 and 4.8 m was chosen
 * for that, but the sterilisation station measures 3.92 x 0.88 m once its
 * worktop sits at a usable height — with a 1.95 m unit in the middle of the
 * room that left a lane too narrow to work in. 36 m2 is a teaching bay rather
 * than a private surgery, which is what a student actually trains in.
 *
 * It was 8 x 8 — 64 m², which is FOUR TIMES a real dental operatory (10-14 m²).
 * That single number was why the room read as random and empty: three separate
 * furniture arrangements all ended up huddled against one wall, because that is
 * the only way this much equipment relates to itself across that much floor.
 * The fix was never the arrangement.
 *
 * 36 m² is well above a real operatory, which is deliberate — this room also
 * carries the study desk and has to be walkable in first person.
 */
export const ROOM_HALF = 3.0
export const BOUND = ROOM_HALF - PLAYER_RADIUS - 0.05
