import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { Box3, Vector3, type Bone, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BONES, findParts } from './patientBones'
import { sanitizeBoneName } from './boneNames'
import { CAST_LOOKS, CLIPS, MODEL_UNITS, castScale } from './cast3d'

/**
 * Load EVERY shipped cast GLB through the SAME loader the game uses, and check
 * the rig can actually find its bones.
 *
 * WHY THIS EXISTS
 *   findParts used root.getObjectByName on the authored bone name. three's
 *   GLTFLoader strips [].:/ from every node name, so the lookup returned
 *   undefined — for every bone, with no error. Everything built on the rig
 *   quietly stopped: no breathing, no head life, no reactions, and no
 *   root-motion stripping, which is what drove the old patient through the
 *   floor.
 *
 *   Nothing that reads the .glb can catch that, because the file really does
 *   contain the authored name. Only the loader disagrees. It bit the Mixamo
 *   character through "mixamorig:Hips" and it bites this pack through
 *   "UpperArm.L" — a different character, a different separator, the same bug.
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

async function load(file: string) {
  const buf = readFileSync(file)
  return await new Promise<any>((resolve, reject) => {
    new GLTFLoader().parse(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      '',
      resolve,
      reject,
    )
  })
}

// Every look in the table must have a file, or that patient renders as nothing.
const models = [...new Set(Object.values(CAST_LOOKS).map((l) => l.model))].sort()
for (const m of models) {
  check(`${m}.glb ships`, () => {
    assert.ok(
      existsSync(`public/models/cast/${m}.glb`),
      `CAST_LOOKS points at ${m}, which is not in public/models/cast`,
    )
  })
}

check('the sanitiser matches what the loader does', () => {
  assert.equal(sanitizeBoneName('UpperArm.L'), 'UpperArmL')
  assert.equal(sanitizeBoneName('mixamorig:Hips'), 'mixamorigHips')
})

for (const model of models) {
  const path = `public/models/cast/${model}.glb`
  if (!existsSync(path)) continue
  const gltf = await load(path)
  const scene: Object3D = gltf.scene
  const look = Object.values(CAST_LOOKS).find((l) => l.model === model)!

  check(`${model}: the loader really does strip the dot`, () => {
    const names: string[] = []
    scene.traverse((o) => {
      if ((o as Bone).isBone) names.push(o.name)
    })
    assert.ok(names.length > 20, `only ${names.length} bones`)
    assert.ok(
      names.includes('UpperArmL') && !names.includes('UpperArm.L'),
      'expected sanitised bone names in the loaded scene',
    )
  })

  // THE REGRESSION. Every one of these being undefined is what broke her.
  check(`${model}: findParts resolves every bone the rig drives`, () => {
    const parts = findParts(scene)
    const missing = Object.keys(BONES).filter((k) => !parts[k as keyof typeof BONES])
    assert.deepEqual(missing, [], `unresolved bones: ${missing.join(', ')}`)
  })

  check(`${model}: origin at the feet, and MODEL_UNITS is honest`, () => {
    scene.updateWorldMatrix(true, true)
    const box = new Box3().setFromObject(scene)
    // Her group is anchored at the seat, so the walk-in has to know where her
    // feet are relative to her origin. If a future export re-origins her, the
    // drop applied in PatientRig is wrong and she walks through the air.
    assert.ok(
      Math.abs(box.min.y) < 0.05 * MODEL_UNITS[look.sex],
      `model base is at y ${box.min.y.toFixed(3)}, expected the floor`,
    )
    // The scale constant must match the file it describes. These are authored at
    // ~4.6 UNITS, not metres, and the two packs differ by 3.4% — so a stale
    // constant here does not fail loudly, it just makes every woman in the
    // clinic the wrong height.
    const size = box.getSize(new Vector3())
    assert.ok(
      Math.abs(size.y - MODEL_UNITS[look.sex]) < 0.05,
      `${model} measures ${size.y.toFixed(3)} units tall but MODEL_UNITS.` +
        `${look.sex} says ${MODEL_UNITS[look.sex]} — update cast3d.ts`,
    )
  })

  check(`${model}: every clip the rig asks for exists`, () => {
    const names = gltf.animations.map((c: any) => c.name)
    for (const want of Object.values(CLIPS)) {
      assert.ok(names.includes(want), `no "${want}" clip; have ${names.join(', ')}`)
    }
  })

  // WHY PatientRig STILL STRIPS THE HIPS TRANSLATION.
  //
  // The Mixamo character carried incoherent travel in its hips position track —
  // 170 units into y on Walking — and stripping it was a FIX. This pack does
  // not: every position track is constant, the sit is achieved purely by
  // rotation, and the strip is now a no-op. It is kept as a guard, not a fix,
  // and this assertion is what says so. If a future asset reintroduces travel
  // this passes and the guard is earning its keep again.
  check(`${model}: hips carry no travel, so the strip is a guard not a fix`, () => {
    const walk = gltf.animations.find((c: any) => c.name === CLIPS.walk)
    const track = walk?.tracks.find(
      (t: any) => /hips/i.test(t.name) && t.name.endsWith('.position'),
    )
    if (!track) return
    // PER AXIS, over time. Sweeping min/max across the flat values array mixes
    // x, y and z together, so a bone parked at a constant (0, -0.163, 0) reports
    // a spread of 0.163 and looks like travel. That is what this assertion first
    // reported, and it was measuring the wrong thing, not finding a real bob.
    let moved = 0
    const n = track.values.length / 3
    for (let axis = 0; axis < 3; axis += 1) {
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < n; i += 1) {
        const v = track.values[i * 3 + axis]
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
      moved = Math.max(moved, hi - lo)
    }
    assert.ok(
      moved < 0.01,
      `Walk hips move ${moved.toFixed(3)} units on one axis — this pack was ` +
        `supposed to be in-place. Re-check the stripping in PatientRig.`,
    )
  })
}

// The scale has to land on the height the table asks for. This is arithmetic,
// but it is the arithmetic that decides whether a patient is a person or a
// three-storey giant standing in the operatory.
check('castScale produces the intended standing height', () => {
  for (const [id, look] of Object.entries(CAST_LOOKS)) {
    const got = castScale(look) * MODEL_UNITS[look.sex]
    assert.ok(
      Math.abs(got - look.height) < 1e-9,
      `${id} scales to ${got.toFixed(3)} m, wanted ${look.height}`,
    )
    assert.ok(
      look.height > 1.2 && look.height < 2.0,
      `${id} is ${look.height} m tall, which is not a person`,
    )
  }
})

if (failures) {
  console.error(`${failures} failing`)
  process.exit(1)
}
console.log(
  `patientAsset: ${models.length} cast models, ` +
    `${Object.keys(BONES).length} bones each, ` +
    `${Object.keys(CLIPS).length} clips each, all checks passed`,
)
