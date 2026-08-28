import { Bone, Object3D, Quaternion, Vector3 } from 'three'
import { boneSide, parseFingerBone } from './fingerBones'

/**
 * Reading a loaded hand model: which bones bend, how big it is, how many hands.
 *
 * Split out of Hands.tsx so it can be tested against the REAL asset through the
 * REAL loader. That is not fussiness — the first version of this passed every
 * check and still did nothing, because three's GLTFLoader rewrites node names on
 * the way in and none of the matching survived it. See NAME SANITISING below.
 */

/**
 * How long the hand is on screen, wrist to fingertip.
 *
 * DELIBERATELY UNDER LIFE SIZE. A 50th-percentile adult hand is 172-189 mm, and
 * this was 145 mm. In a first-person view held close to the camera an anatomical
 * hand reads as enormous — it fills the lower third of the frame and everything
 * it holds looks like a toy. The reference for this game's hands is the low-poly
 * stylised kind: small, slim, unmistakably a cartoon hand rather than a
 * shrunken real one.
 *
 * SIZE IS ONLY HALF OF IT. Scaling a chunky hand down gives a small chunky hand
 * — a child's fist. The slimness is a PROPORTION and lives in the mesh, done in
 * Blender by scripts/bl_hands_slim.py: thickness 65.3 -> 48.3 mm, width
 * 135.9 -> 122.3 mm, length untouched because this constant owns length and two
 * things scaling it is how numbers end up disagreeing.
 */
export const HAND_LENGTH = 0.125

/**
 * How far each joint of a finger closes when you grip, as a fraction of a full
 * fist. The knuckle leads and the tip follows — a hand that bends all three
 * equally looks like a claw.
 */
const CURL: Record<number, number> = { 1: 0.52, 2: 0.72, 3: 0.58 }

/** The thumb closes across the palm, not into it, so it curls less. */
const THUMB_SCALE = 0.45

/** Index of the middle finger in parseFingerBone's ordering. */
const MIDDLE = 1

export interface Joint {
  bone: Bone
  rest: Quaternion
  /** 0 index … 3 pinky, 4 thumb — drives the per-finger phase offset. */
  finger: number
  /** How much of a full fist this joint contributes. */
  curl: number
}

export function collectJoints(root: Object3D): Joint[] {
  const joints: Joint[] = []
  root.traverse((o) => {
    if (!(o as Bone).isBone) return
    const parsed = parseFingerBone(o.name)
    if (!parsed) return
    const curl = CURL[parsed.segment]
    if (curl === undefined) return
    joints.push({
      bone: o as Bone,
      rest: o.quaternion.clone(),
      finger: parsed.finger,
      curl: parsed.finger === 4 ? curl * THUMB_SCALE : curl,
    })
  })
  return joints
}

/** True when the asset already contains both hands and must not be mirrored. */
export function isPair(root: Object3D): boolean {
  const sides = new Set<string>()
  root.traverse((o) => {
    if (!(o as Bone).isBone || !parseFingerBone(o.name)) return
    const side = boneSide(o.name)
    if (side) sides.add(side)
  })
  return sides.size > 1
}

/** The rolled bead at the wrist, built as its own object by the Blender script. */
export const isCuff = (o: Object3D) => o.name.toLowerCase().startsWith('cuff')

/**
 * Measure the loaded hand, wrist to fingertip, in whatever units it arrived in.
 *
 * NAME SANITISING — the trap this function exists to survive.
 *   three's GLTFLoader runs every node name through PropertyBinding
 *   .sanitizeNodeName, which strips the characters [].:/ because they are
 *   reserved for animation track binding. A bone authored as "f_middle.03.R_011"
 *   reaches the scene as "f_middle03R_011".
 *
 *   So nothing here may match on a literal dotted name. An earlier version tested
 *   name.startsWith('f_middle.03'), which is true of the file and false of every
 *   object three hands back. It matched nothing, returned null, and the hands
 *   silently rendered at the file's own 72 mm — a quarter size, with no error.
 *   parseFingerBone tolerates the missing separators, so identify joints through
 *   it rather than by name.
 *
 * Returns null when the model has no recognisable middle finger, which the caller
 * must treat as "do not scale" rather than as zero.
 */
function locate(root: Object3D): { wrist: Object3D; tip: Object3D } | null {
  // <primitive> transforms only fold into matrixWorld during render, so nothing
  // below is meaningful until the matrices are current.
  root.updateWorldMatrix(true, true)

  let wrist: Object3D | null = null
  let distal: Object3D | null = null
  root.traverse((o) => {
    if (!(o as Bone).isBone) return
    const parsed = parseFingerBone(o.name)
    if (parsed) {
      if (parsed.finger === MIDDLE && parsed.segment === 3) distal = o
      return
    }
    // The wrist is the first non-finger bone; "hand" or "wrist" names it in
    // every convention we support.
    if (!wrist && /^(hand|wrist|mixamorig)?[_.]?(hand|wrist)/i.test(o.name)) wrist = o
  })
  if (!wrist || !distal) return null

  // The distal bone's origin is the BASE of the last segment. Its child is the
  // "_end" tip bone, and skipping it loses the whole distal phalanx — about
  // 25 mm on an adult hand, which would scale everything ~15% too large.
  const tip = (distal as Object3D).children.find((c) => (c as Bone).isBone) ?? distal
  return { wrist, tip }
}

export function measureHand(root: Object3D): number | null {
  const found = locate(root)
  if (!found) return null
  const a = found.wrist.getWorldPosition(new Vector3())
  const b = found.tip.getWorldPosition(new Vector3())
  const d = a.distanceTo(b)
  return d > 1e-6 ? d : null
}

/**
 * Where the wrist sits inside the model, and which way the fingers point — both
 * in the model's own space, before any scaling or placement.
 *
 * Placement has to be expressed about the WRIST, not the rig root. This asset's
 * root sits 152 mm from its own wrist, so positioning the root at x = 0.13 put
 * the wrist at 0.52 and the two wrists a metre apart. Reading the offset here
 * lets the caller say where the wrist goes and mean it.
 */
export function rigFrame(root: Object3D): { wrist: Vector3; finger: Vector3 } | null {
  const found = locate(root)
  if (!found) return null
  const wrist = root.worldToLocal(found.wrist.getWorldPosition(new Vector3()))
  const tip = root.worldToLocal(found.tip.getWorldPosition(new Vector3()))
  const finger = tip.sub(wrist).normalize()
  return { wrist, finger }
}

/** Scale that turns whatever the file shipped into a real adult hand. */
export function handScale(root: Object3D): { scale: number; measured: number | null } {
  const measured = measureHand(root)
  return { scale: measured ? HAND_LENGTH / measured : 1, measured }
}

/**
 * Where the RIGHT wrist sits in camera space: x to the side, y below the eye,
 * -z forward. Mirrored for the left.
 *
 * Hands rest a little over a quarter of a metre below eye level and about as far
 * in front — close enough to read as yours, far enough not to fill the view.
 */
export const WRIST_TARGET = new Vector3(0.265, -0.255, -0.40)

/**
 * Which way the fingers point in camera space: mostly forward, angled down and
 * slightly inward, as a hand does when held ready in front of you. Normalised on
 * use, so these are proportions rather than a unit vector.
 */
export const FINGER_DIR = new Vector3(-0.34, -0.26, -0.90)

/**
 * Rotation about the finger axis, which decides where the palm faces. Aiming the
 * fingers fixes their direction but leaves the roll around that axis free, so
 * this is the one number here that is a judgement rather than a measurement.
 */
export const PALM_ROLL = 0.55 + Math.PI

/**
 * Which way a knuckle bends, in the bone's own space.
 *
 * MEASURED, NOT ASSUMED. scripts/bl_hands_glove.py poses the fingers about every
 * axis in turn and keeps whichever actually folds the fingertips toward the
 * wrist. It is Z- for this asset. Assuming an axis is how the cabinet doors
 * ended up swinging through a wall.
 */
export const CURL_AXIS = new Vector3(0, 0, -1)

/**
 * How bent the fingers are when you are holding nothing.
 *
 * A hand at rest is NOT flat. Left at zero the model's own rest pose shows
 * through — fingers splayed open like a starfish, which is how a hand is
 * modelled for rigging and not how one ever looks on a person. Everything else
 * about the pose can be right and it will still read as a mannequin.
 */
export const REST_CURL = 0.36

/**
 * Where a HELD instrument's grip sits, in camera space — inside the right hand.
 *
 * DERIVED from the hand, not typed alongside it. The held instrument used to
 * have its own camera-space constant (0.19, -0.20, -0.34) sitting next to the
 * wrist's (0.17, -0.26, -0.32): two numbers describing the same thing, agreeing
 * by luck and drifting the moment either moved. The instrument floated NEAR the
 * hand rather than in it, and the fingers closed on air beside it.
 *
 * 55 mm from the wrist along the fingers is where a pen-grip instrument is
 * actually held — the web between thumb and index, not the palm.
 */
export const GRIP_TARGET = WRIST_TARGET.clone().add(
  FINGER_DIR.clone().normalize().multiplyScalar(0.055),
)

/**
 * How to turn an instrument so it lies along the fingers.
 *
 * Every instrument in instruments.glb runs along its LOCAL +Z from the grip, so
 * aiming that axis down FINGER_DIR points the working tip where the hand points.
 */
export function gripQuaternion(): Quaternion {
  return new Quaternion().setFromUnitVectors(
    new Vector3(0, 0, 1),
    FINGER_DIR.clone().normalize(),
  )
}

export interface Placement {
  position: Vector3
  quaternion: Quaternion
  scale: number
  measured: number | null
}

/**
 * Work out where to put the rig so its WRIST lands on target and its fingers
 * point where we want, at the size of a real hand.
 *
 * Every part is derived from the model. The rig root is not the wrist — on this
 * asset they are 152 mm apart — so positioning the root directly put the two
 * wrists a metre apart, well outside the frustum. Reading the offset instead
 * means a different hand asset drops in without new numbers.
 */
export function placeHand(
  root: Object3D,
  wristTarget: Vector3 = WRIST_TARGET,
  fingerDir: Vector3 = FINGER_DIR,
  palmRoll: number = PALM_ROLL,
): Placement {
  const { scale, measured } = handScale(root)
  const frame = rigFrame(root)
  const quaternion = new Quaternion()
  const position = wristTarget.clone()

  if (frame) {
    const aim = fingerDir.clone().normalize()
    // Turn the model's own finger axis onto the aim, then roll about the aim.
    quaternion.setFromUnitVectors(frame.finger, aim)
    quaternion.premultiply(new Quaternion().setFromAxisAngle(aim, palmRoll))
    // The root goes wherever it must for the wrist to land on target.
    position.sub(frame.wrist.clone().multiplyScalar(scale).applyQuaternion(quaternion))
  }

  return { position, quaternion, scale, measured }
}
