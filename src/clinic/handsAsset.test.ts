import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Bone, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SkeletonUtils } from 'three-stdlib'
import {
  FINGER_DIR,
  WRIST_TARGET,
  collectJoints,
  handScale,
  isCuff,
  isPair,
  placeHand,
  rigFrame,
} from './handsRig'
import { parseFingerBone } from './fingerBones'

/**
 * Load the SHIPPED hands.glb through the SAME loader the game uses, and check
 * the rig code actually finds anything in it.
 *
 * WHY THIS EXISTS AND scripts/check_hands_glb.mjs IS NOT ENOUGH.
 *   That script parses the file's own JSON, so it sees the authored node names.
 *   The game never sees those. three's GLTFLoader rewrites every name through
 *   PropertyBinding.sanitizeNodeName, stripping [].:/ — so "f_middle.03.R_011"
 *   becomes "f_middle03R_011".
 *
 *   The first version of measureHand matched on 'f_middle.03'. Against the file
 *   it looks right; against the loader it matches nothing, returns null, and the
 *   hands render at the file's raw 72 mm instead of 185 mm. No error, no warning,
 *   just quarter-size hands. Every file-level check passed the whole time.
 *
 *   So the only check worth having is one that goes through the loader.
 */

let failures = 0
function check(name: string, fn: () => void) {
  try {
    fn()
  } catch (e) {
    failures++
    console.error(`  FAIL ${name}\n    ${(e as Error).message}`)
  }
}

const buf = readFileSync('public/models/hands.glb')
const gltf = await new Promise<any>((resolve, reject) => {
  // parse() takes the bytes directly — no network, no DOM.
  new GLTFLoader().parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    '',
    resolve,
    reject,
  )
})

const scene = gltf.scene
const bones: string[] = []
scene.traverse((o: any) => {
  if ((o as Bone).isBone) bones.push(o.name)
})

check('the asset loads and has a skeleton', () => {
  assert.ok(bones.length > 10, `only ${bones.length} bones`)
})

// The whole point: prove the names really are sanitised, so that if a future
// three release stops doing it, this test says so rather than silently passing.
check('bone names arrive without the authored dots', () => {
  assert.ok(
    bones.some((b) => /^f_middle\d/.test(b)),
    `expected sanitised names, got e.g. ${bones.slice(0, 4).join(', ')}`,
  )
})

check('every finger joint is still recognised after sanitising', () => {
  const found = bones.map(parseFingerBone).filter(Boolean)
  // 5 fingers x 3 phalanges for one hand.
  assert.ok(found.length >= 15, `only ${found.length} finger joints in ${bones.length} bones`)
})

check('collectJoints returns drivable joints', () => {
  const joints = collectJoints(scene)
  assert.ok(joints.length >= 15, `only ${joints.length} joints`)
  // Every finger index 0-4 must be represented, or part of the hand is dead.
  const fingers = new Set(joints.map((j) => j.finger))
  assert.deepEqual([...fingers].sort(), [0, 1, 2, 3, 4])
})

// THE REGRESSION. measureHand returning null is not a crash — it silently
// leaves the hands a quarter of the size they should be.
check('the hand can be measured, and is scaled to a real one', () => {
  const { scale, measured } = handScale(scene)
  assert.notEqual(measured, null, 'measureHand found no wrist or fingertip')
  assert.ok(
    measured! > 0.001 && measured! < 10,
    `implausible measurement ${measured} m`,
  )
  const rendered = measured! * scale
  assert.ok(
    Math.abs(rendered - 0.185) < 1e-6,
    `hand renders at ${(rendered * 1000).toFixed(1)} mm, expected 185 mm`,
  )
  assert.notEqual(scale, 1, 'scale fell back to 1 — the measurement was ignored')
})

// A single-hand asset gets mirrored. If isPair wrongly says true, one hand is
// missing; if it wrongly says false on a pair, you get four.
check('this asset is one hand, so the game mirrors it', () => {
  assert.equal(isPair(scene), false)
})

check('the cuff ships as its own object, so gloves-off can hide it', () => {
  const cuffs: string[] = []
  scene.traverse((o: any) => {
    if (o.isMesh && isCuff(o)) cuffs.push(o.name)
  })
  assert.ok(cuffs.length > 0, 'no Cuff mesh — gloves-on would just be a tint')
})

// PLACEMENT. The rig root is not the wrist — on this asset they are 152 mm
// apart, and positioning the root put the two wrists a metre apart, outside the
// frustum. Rebuild the transform the component applies and check where the
// wrist and fingers actually end up.
check('the wrist lands on target and the fingers point where aimed', () => {
  const hand = SkeletonUtils.clone(scene) as Object3D
  const place = placeHand(hand)

  // Same as <primitive position quaternion scale> under the camera-riding group.
  hand.position.copy(place.position)
  hand.quaternion.copy(place.quaternion)
  hand.scale.setScalar(place.scale)
  hand.updateWorldMatrix(true, true)

  const frame = rigFrame(hand)
  assert.notEqual(frame, null, 'no rig frame after placement')

  // rigFrame reports in the model's own space; convert to the parent space the
  // component places it in, which is camera space.
  const wristWorld = hand.localToWorld(frame!.wrist.clone())
  const off = wristWorld.distanceTo(WRIST_TARGET)
  assert.ok(off < 1e-3, `wrist landed ${(off * 1000).toFixed(1)} mm from target`)

  // Hands must sit inside a normal field of view, not out past the shoulders.
  assert.ok(
    Math.abs(wristWorld.x) < 0.3,
    `wrist ${Math.abs(wristWorld.x).toFixed(3)} m off centre — mirrored, that is ` +
      `${(Math.abs(wristWorld.x) * 2).toFixed(2)} m between the two`,
  )
  assert.ok(wristWorld.z < 0, 'wrist is behind the camera')

  // And the fingers point forward, not across the view or back at the eye.
  const aimed = frame!.finger.clone().transformDirection(hand.matrixWorld).normalize()
  const want = FINGER_DIR.clone().normalize()
  const dot = aimed.dot(want)
  assert.ok(dot > 0.999, `fingers point ${aimed.toArray()}, wanted ${want.toArray()}`)
  assert.ok(aimed.z < -0.5, 'fingers do not point away from the camera')
})

if (failures) {
  console.error(`${failures} failing`)
  process.exit(1)
}
console.log(`handsAsset: all checks passed (${bones.length} bones)`)
