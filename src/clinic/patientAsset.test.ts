import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, Vector3, type Bone, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BONES, findParts } from './patientBones'
import { sanitizeBoneName } from './boneNames'

/**
 * Load the SHIPPED patient.glb through the SAME loader the game uses, and check
 * the rig can actually find her bones.
 *
 * WHY THIS EXISTS
 *   findParts used root.getObjectByName('mixamorig:Hips'). three's GLTFLoader
 *   strips [].:/ from node names, so the scene contains "mixamorigHips" and that
 *   lookup returned undefined — for every bone, with no error. Everything built
 *   on the rig quietly stopped: no blinking, no breathing, no reactions, and no
 *   root-motion stripping, which is what drove her through the floor.
 *
 *   Nothing that reads the .glb could catch it, because the file really does
 *   contain the authored name. Only the loader disagrees.
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

const buf = readFileSync('public/models/patient.glb')
const gltf = await new Promise<any>((resolve, reject) => {
  new GLTFLoader().parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    '',
    resolve,
    reject,
  )
})
const scene: Object3D = gltf.scene

check('the loader really does strip the colon', () => {
  const names: string[] = []
  scene.traverse((o) => {
    if ((o as Bone).isBone) names.push(o.name)
  })
  assert.ok(names.length > 20, `only ${names.length} bones`)
  assert.ok(
    names.some((n) => n.startsWith('mixamorig') && !n.includes(':')),
    'expected sanitised bone names',
  )
  assert.equal(sanitizeBoneName('mixamorig:Hips'), 'mixamorigHips')
})

// THE REGRESSION. Every one of these being undefined is what broke her.
check('findParts resolves every bone the rig drives', () => {
  const parts = findParts(scene)
  const missing = Object.keys(BONES).filter((k) => !parts[k as keyof typeof BONES])
  assert.deepEqual(missing, [], `unresolved bones: ${missing.join(', ')}`)
})

// Her group is anchored at the seat, so the walk has to know where her feet are
// relative to her origin. If a future export re-origins her, the drop applied
// in PatientRig is wrong and she walks through the air again.
check('her origin is at her feet', () => {
  scene.updateWorldMatrix(true, true)
  const box = new Box3().setFromObject(scene)
  assert.ok(
    Math.abs(box.min.y) < 0.05,
    `model base is at y ${box.min.y.toFixed(3)}, expected the floor`,
  )
  const size = box.getSize(new Vector3())
  assert.ok(size.y > 1.4 && size.y < 2.0, `she is ${size.y.toFixed(2)} m tall`)
})

check('every clip the rig asks for exists', () => {
  const names = gltf.animations.map((c: any) => c.name)
  for (const want of ['Walking', 'StandToSit', 'SittingIdle']) {
    assert.ok(names.includes(want), `no "${want}" clip; have ${names.join(', ')}`)
  }
})

// The reason the hips translation is stripped wholesale rather than per-axis.
// If a future re-export fixes the clips, this fails and the stripping can be
// reconsidered instead of being cargo-culted forever.
check('the hips tracks still carry incoherent travel', () => {
  const extent = (clipName: string) => {
    const clip = gltf.animations.find((c: any) => c.name === clipName)
    const track = clip?.tracks.find(
      (t: any) => /hips/i.test(t.name) && t.name.endsWith('.position'),
    )
    if (!track) return 0
    let max = 0
    for (const v of track.values) max = Math.max(max, Math.abs(v))
    return max
  }
  // A hip bone sits under a metre off the floor. Tens of units is travel.
  assert.ok(
    extent('Walking') > 10,
    'Walking hips no longer carry large travel — re-check the stripping in PatientRig',
  )
})

if (failures) {
  console.error(`${failures} failing`)
  process.exit(1)
}
console.log('patientAsset: all checks passed')
