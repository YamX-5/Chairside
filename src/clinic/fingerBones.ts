/**
 * Recognise a finger joint from a bone name, whatever rig it came from.
 *
 * Every hand asset names its bones differently, and swapping asset should not
 * mean editing the animation code:
 *
 *   f_index.01.R_027          Rigify / MakeHuman, as exported by Sketchfab
 *   mixamorig:RightHandIndex2 Mixamo
 *   index_01_r                the common game-engine convention
 *   LeftHandThumb3            Unity humanoid
 *
 * Returns which finger it is and which segment along that finger, or null if the
 * bone is not a bendable phalanx at all.
 *
 * TWO KINDS OF BONE THAT MUST NOT MATCH, both of which look like fingers:
 *   - "_end" tips, which exist only to give the last phalanx a length and snap
 *     the mesh if rotated.
 *   - "palm_index", the metacarpal inside the hand. Rotating it splays the whole
 *     hand open rather than bending a finger.
 * The trailing numbers exporters append ("_027") are not segment indices either,
 * so the segment is only read immediately after the finger's own name.
 */

/** Index 0-3 are the fingers in ripple order; 4 is the thumb. */
export const FINGER_NAMES = ['index', 'middle', 'ring', 'pinky', 'thumb'] as const

export type FingerName = (typeof FINGER_NAMES)[number]

export interface FingerJoint {
  /** 0 index … 3 pinky, 4 thumb. Drives the per-finger phase offset. */
  finger: number
  /** 1 knuckle, 2 middle, 3 tip. */
  segment: number
}

/** Some rigs call the little finger "little" rather than "pinky". */
const ALIASES: Record<string, FingerName> = { little: 'pinky' }

export function parseFingerBone(name: string): FingerJoint | null {
  const lower = name.toLowerCase()

  // Tips exist to give the last phalanx a length. Rotating one snaps the mesh.
  if (lower.includes('_end') || lower.endsWith('end')) return null
  // Metacarpals splay the hand open instead of bending a finger.
  if (lower.includes('palm')) return null

  for (const [alias, real] of Object.entries(ALIASES)) {
    if (lower.includes(alias)) return read(lower, alias, FINGER_NAMES.indexOf(real))
  }
  for (let i = 0; i < FINGER_NAMES.length; i++) {
    if (lower.includes(FINGER_NAMES[i])) return read(lower, FINGER_NAMES[i], i)
  }
  return null
}

/**
 * Which hand a bone belongs to, or null when the name does not say.
 *
 * Used to tell a one-hand asset from a pair: a single hand gets mirrored for the
 * other side, and mirroring a model that already has both would give you four.
 *
 * The bare-letter forms have to be matched as whole tokens. "f_ring.01.R" is a
 * RIGHT ring finger, and a looser pattern reads the "r" of "ring" instead.
 */
export function boneSide(name: string): 'L' | 'R' | null {
  const lower = name.toLowerCase()
  if (lower.includes('right')) return 'R'
  if (lower.includes('left')) return 'L'
  if (/[._-]r(?:[._-]|$)/.test(lower)) return 'R'
  if (/[._-]l(?:[._-]|$)/.test(lower)) return 'L'
  return null
}

function read(lower: string, word: string, finger: number): FingerJoint | null {
  const after = lower.slice(lower.indexOf(word) + word.length)
  // The segment sits straight after the finger's name, optionally behind one
  // separator. Anything further along is the exporter's own numbering.
  const m = /^[._-]?(\d{1,2})/.exec(after)
  if (!m) return null
  const segment = Number(m[1])
  // 1-3 are the phalanges. A 4th is the fingertip, which is an end bone by
  // another name.
  if (segment < 1 || segment > 3) return null
  return { finger, segment }
}
