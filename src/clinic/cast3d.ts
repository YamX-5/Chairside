/**
 * Which body each patient wears, and how tall they stand.
 *
 * WHY THIS IS NOT IN src/game/cast.ts
 * -----------------------------------
 * cast.ts is game data — names, ages, moods, the line of blurb shown in the
 * waiting area. It has no idea a 3D clinic exists and should keep it that way.
 * This is the clinic's own lookup, keyed by the id cast.ts already owns, so the
 * roster stays the single source of who the patients ARE.
 *
 * THE MODELS
 * ----------
 * Quaternius "Animated Men / Women Characters" (Feb 2019), CC0 1.0 — public
 * domain, no attribution required, no share-alike, commercial use fine. That is
 * the cleanest licence available and the reason these replaced the Mixamo
 * character, whose licence is tied to an Adobe account.
 *
 * Every file carries the SAME 42-bone skeleton and the same four clips, verified
 * against three's own loader by scripts/check_cast_glb.mjs. So the rig is
 * written once and the outfit is a filename.
 */

/**
 * How tall a character stands IN THE FILE, in glTF units.
 *
 * Quaternius authored these at roughly 4.7 units, not metres. The two packs
 * differ — the men are 4% taller than the women before any scaling — so a single
 * divisor would make every woman in the clinic slightly too tall.
 *
 * Measured through the MESH bounding box, not the skeleton. Those are not the
 * same number: the head bone sits below the top of the skull, so the skeleton
 * measures 4.617 / 4.772 while the silhouette measures 4.655 / 4.839. Standing
 * height means the top of the head, so the mesh is the right one — a 1.4%
 * difference, which is a centimetre and a half on a grown adult.
 *
 * patientAsset.test.ts re-measures both numbers from every shipped file, so they
 * cannot drift away from the assets.
 */
export const MODEL_UNITS = {
  female: 4.655,
  male: 4.839,
} as const

export type CastSex = keyof typeof MODEL_UNITS

export interface CastLook {
  /** File under public/models/cast, without the .glb. */
  model: string
  sex: CastSex
  /**
   * Standing height in metres.
   *
   * This is what makes eight characters built from two meshes read as eight
   * people. It is also the only handle on age we have: the pack has no child
   * mesh, so Omar is an adult body at a child's height. That is a compromise and
   * it is written down rather than hidden — an 8-year-old has a proportionally
   * larger head and shorter limbs, and scaling does not give you that.
   */
  height: number
}

export const CAST_LOOKS: Record<string, CastLook> = {
  // Layla, 24 — dental anxiety.
  'patient-1': { model: 'female_casual', sex: 'female', height: 1.63 },
  // Omar, 8 — first filling. See the note on `height`: adult body, child scale.
  'patient-2': { model: 'male_casual', sex: 'male', height: 1.3 },
  // Abu Khaled, 68 — asking about dentures.
  'patient-3': { model: 'male_longsleeve', sex: 'male', height: 1.68 },
  // Yousef, 45 — three nights without sleep.
  'patient-4': { model: 'male_shirt', sex: 'male', height: 1.74 },
  // Khala Nadia, 55 — bleeding gums.
  'patient-5': { model: 'female_dress', sex: 'female', height: 1.57 },
  // Rami, 19 — braces review. Shares Omar's outfit; 42 cm of height apart.
  'patient-6': { model: 'male_casual', sex: 'male', height: 1.72 },
  // Sara, 31 — whitening before a wedding.
  'patient-7': { model: 'female_alternative', sex: 'female', height: 1.66 },
  // Mr Haddad, 50 — cracked a tooth, checks his watch. The clinic's one wired
  // case at the moment. 1.70 rather than 1.76: at his old height he read as
  // looming over the chair, and these are stylised proportions with a large
  // head, so they carry more visual weight per metre than a realistic figure.
  'patient-8': { model: 'male_suit', sex: 'male', height: 1.7 },
}

/** The patient the clinic runs when nothing else is chosen. */
export const DEFAULT_PATIENT_ID = 'patient-8'

export function lookFor(patientId: string): CastLook {
  // Never undefined: a missing entry would render nobody at all, and an empty
  // chair is a much worse failure than the wrong shirt.
  return CAST_LOOKS[patientId] ?? CAST_LOOKS[DEFAULT_PATIENT_ID]
}

/** Uniform scale that takes a file-unit character to their real height. */
export function castScale(look: CastLook): number {
  return look.height / MODEL_UNITS[look.sex]
}

/**
 * The clips every cast file carries, and what each one actually is.
 *
 * The NAMES do not say — "Sitting" runs 8.38 s and "Standing" runs 0.88 s, which
 * could as easily have been a sitting idle and a standing idle. Measured with
 * scripts/probe_cast_clips.mjs by comparing each clip's first and last pose:
 *
 *   Idle      4.21s  LOOP        standing, arms down
 *   Walk      1.08s  LOOP        walk cycle, IN PLACE — the Hips position track
 *                                is CONSTANT in all four clips, so the whole
 *                                performance is rotation and nothing slides
 *   Sitting   8.38s  TRANSITION  stand -> seated in 0.4 s, then 8 s of settling
 *   Standing  0.88s  TRANSITION  seated -> stood, and it ends where Sitting starts
 *
 * The pack has NO seated idle. Sitting is played once and clamped on its last
 * frame; the breathing and head life in PatientRig are added on top of that held
 * pose, which is exactly what the two-layer rig was built to do.
 */
export const CLIPS = {
  idle: 'Idle',
  walk: 'Walk',
  sit: 'Sitting',
  stand: 'Standing',
} as const

/** How far into `Sitting` she is actually seated, in seconds. Measured. */
export const SIT_SETTLES_AT = 0.4

/**
 * Extra yaw so the character faces the way the CHAIR says it faces.
 *
 * MEASURED, in Blender, off the seated pose — not guessed, because guessing a
 * 180 is how you ship it wrong twice. In the Sitting pose the mesh spans
 * y -0.529..1.219 in Blender: the body reaches forward along +Y. The glTF
 * exporter converts Blender (x, y, z) to (x, z, -y), so +Y becomes -Z and the
 * character faces -Z at yaw 0.
 *
 * CHAIR_FACING is 0 and documents itself as "feet point +Z, toward the door". So
 * the character was pointing at the sterilising run with his back to the room —
 * "he is facing the cabinet, it should be facing the outer door".
 *
 * This lives HERE and not in CHAIR_FACING because it is a property of the MESH,
 * not of the furniture. Swap in a character authored facing +Z and this is the
 * one number that changes; the chair does not move.
 */
export const CAST_FACING_OFFSET = Math.PI

/**
 * How high the pelvis sits above the model's origin in the seated pose, in FILE
 * units, and where the feet end up. Both measured off male_suit.glb.
 *
 * The point of writing them down: the sit is a real sit. The pelvis drops from
 * 1.959 standing to 1.102 seated while the feet stay planted at 0.054 — the legs
 * rotate and the body lowers onto them. At a 1.70 m character that is a pelvis
 * 0.387 m off the floor, and the chair's cushion is at 0.370 m. He fits the
 * chair as authored, with his feet on the floor.
 *
 * Which is why the rig anchors him at FLOOR level and not on the cushion. Lifting
 * him onto the seat — correct for the old Mixamo clip, whose sit was authored
 * around its origin — put his feet at cushion height and his pelvis 0.40 m above
 * that, hovering over the chair with his legs out. That is the "he is standing
 * up in the chair" report.
 */
export const SEATED_PELVIS_UNITS = 1.1021
export const SEATED_FEET_UNITS = 0.0542
