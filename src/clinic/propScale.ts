/**
 * How big every prop is, and WHY — pinned to what a person does with it.
 *
 * THE RULE THIS FILE ENFORCES
 * ---------------------------
 * Before a prop goes in the room, say what a human does with it, and let that
 * fix the size. A box of masks is 195 mm because you pull one out with two
 * fingers. A worktop is 900 mm because you stand at it. A handpiece is 190 mm
 * because you hold it like a pen. Nothing here is "about right" — every number
 * has a person attached to it.
 *
 * WHY IT EXISTS
 * -------------
 * The box of masks shipped at 570 mm across: nearly three times life size, wide
 * as a carry-on suitcase, sitting on a worktop. The instrument tray shipped at
 * 510 mm. Neither was caught, because nothing in the codebase had an opinion
 * about how big anything was supposed to be — the .glb said what it said, and
 * `ClinicProps` applies no scale at all, so whatever a Sketchfab author happened
 * to export became the truth.
 *
 * `propScale.test.ts` reads the real .glb files off disk and checks them against
 * this table, so a mis-scaled asset fails the suite instead of quietly making
 * the room look like a doll's house with one giant object in it.
 *
 * MEASURED ON THE LONGEST DIMENSION, deliberately. A model's aspect ratio is
 * the author's business — some mask boxes are drawn flat-packed, some upright —
 * but its overall size against a human hand is ours.
 */

export interface PropScale {
  /** Basename under public/models/props, without .glb. */
  id: string
  /** Longest real-world dimension, in metres. */
  longest: number
  /**
   * The human action that fixes the number. If you cannot write this line, you
   * do not yet know how big the thing should be.
   */
  because: string
  /**
   * Fractional tolerance. 0.3 by default: generous, because scanned assets
   * include handles, bases and cables that a catalogue dimension does not —
   * but still tight enough to catch the 3x error that started this file.
   */
  tol?: number
}

export const PROP_SCALES: PropScale[] = [
  // --- things you stand or sit at ------------------------------------------
  {
    id: 'office_desk',
    longest: 1.32,
    because: 'you sit at it — worktop height is 0.73–0.76 m and it is about a person and a half wide',
  },
  {
    id: 'doctors_chair',
    longest: 0.54,
    because:
      'the seat, not a guess at the silhouette: this asset has no backrest, so its ' +
      'tallest point IS the cushion top (Object_leather black_0 ends the bbox), and ' +
      'scaling the bbox sets the seat height directly. 0.54 m comes from the work ' +
      'itself — a supine patient\'s mouth sits near 0.77 m and a seated operator\'s ' +
      'elbow is ~0.23 m above the seat, and you treat at elbow height. It was 0.85, ' +
      'which put the cushion at hip height while SEATS.stool sat the eye at 1.18 — ' +
      'the player rendered inside the stool',
  },
  {
    id: 'sterilization_centre',
    longest: 3.92,
    // The size that matters here is NOT the longest dimension. This is a
    // composite suite — base drawers, worktop, upper wall cabinets — and it is
    // scaled so its WORKTOP lands at 0.90 m. Scaling it by its bounding box to
    // 0.90 m (which is what shipped) shrank the whole suite to worktop height,
    // put the real worktop at 0.38 m, and left three props standing on the roof
    // of the upper cabinets. See WORKTOP_Y in layout.ts.
    because:
      'you stand at it to scrub and pack — worktop at 0.90 m fixes the scale, ' +
      'and at that scale the run is 3.9 m of cabinetry along the wall with the ' +
      'upper doors at eye level',
  },
  {
    id: 'closet',
    longest: 1.95,
    because: 'you open its doors and reach the top shelf without a step — so it stops just under 2 m',
  },
  {
    id: 'book_shelf',
    longest: 1.8,
    because: 'a floor bookcase you take a book off without reaching over your head — top shelf at eye level',
  },
  // Kept measurable but no longer placed: the wall-shelf asset's boards render
  // as black shards, so book_shelf replaced it. Left in the table so that if
  // anyone puts it back, its size is still checked.
  {
    id: 'shelf',
    longest: 1.1,
    because: 'wall-mounted above head-height clutter; you reach its lowest board at chest height',
  },

  // --- floor-standing equipment ----------------------------------------------
  {
    id: 'eto_sterilizer',
    longest: 1.3,
    because:
      'a WHEELED EtO gas cart, not a benchtop unit — castors on the floor, ' +
      'ethylene-oxide cylinders on the deck, control panel at chest height. ' +
      'It was catalogued at 0.55 m and stood on a worktop; at its real height ' +
      'it does not fit under wall cabinets at all, which is the geometry saying ' +
      'it belongs on the floor',
  },
  {
    id: 'masks_disposable',
    longest: 0.195,
    because: 'a 50-mask dispenser box — you pull one out with two fingers, so it is hand-width, not desk-width',
  },
  {
    id: 'dental_misc',
    longest: 0.28,
    because: 'an instrument tray you carry in one hand from the bench to the chair',
  },
  {
    id: 'books_variety',
    longest: 0.37,
    because: 'a short row of textbooks — as wide as a spread hand, standing about a forearm tall',
  },

  {
    id: 'monitor',
    longest: 0.6,
    because:
      'a desktop monitor you read sitting down — about 24 inches across, its ' +
      'panel near eye level once it stands on a 0.75 m desk',
  },
  {
    id: 'keyboard',
    longest: 0.44,
    because: 'a full-size keyboard — both hands rest on it shoulder-width apart',
  },
  {
    id: 'mouse',
    longest: 0.115,
    because: 'a mouse — one palm covers it, so it is hand-length, not forearm-length',
  },

  // --- things you pick up ----------------------------------------------------
  {
    id: 'portable_xray',
    longest: 0.36,
    because: 'held at arm’s length and aimed one-handed — a Nomad-class handheld is ~0.29 m plus its cradle',
  },
  {
    id: 'drill',
    longest: 0.19,
    because: 'a handpiece held like a pen, between finger and thumb',
  },
  { id: 'pieza_b', longest: 0.19, because: 'a handpiece, held like a pen' },
  { id: 'pieza_c', longest: 0.19, because: 'a handpiece, held like a pen' },
  {
    id: 'syringe',
    longest: 0.15,
    because: 'a dental syringe — one hand wraps the barrel, thumb through the ring',
  },

  // --- fabric of the room ----------------------------------------------------
  {
    id: 'floor_tile',
    longest: 0.6,
    because: 'a 600 mm floor tile — the size you actually buy, and about one stride',
  },
  {
    id: 'window1',
    longest: 1.4,
    because: 'a window you look out of standing up — sill at hip height, head above eye level',
  },
  {
    id: 'window_blind',
    longest: 1.4,
    because: 'it covers window1, so it is the same size by definition',
  },
]

export const PROP_SCALE_BY_ID = new Map(PROP_SCALES.map((p) => [p.id, p]))

/** Default tolerance, exported so the test and any tooling agree on one number. */
export const DEFAULT_SCALE_TOL = 0.3

/** Does a measured longest-dimension pass for this prop? */
export function scaleOk(id: string, measuredLongest: number): boolean {
  const spec = PROP_SCALE_BY_ID.get(id)
  if (!spec) return true // not every file in the folder is placed in the room
  const tol = spec.tol ?? DEFAULT_SCALE_TOL
  return Math.abs(measuredLongest - spec.longest) <= spec.longest * tol
}
