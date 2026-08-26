/**
 * Where is the patient model's origin, and where do her hips sit in each clip?
 *
 * PatientRig anchors her whole group at SEAT_WORLD (y = 0.37) and never changes
 * the height, so she is at seat height while WALKING across the room too. Whether
 * that floats her or buries her depends entirely on where the model's root is
 * relative to her feet — which is a fact about the asset, not something to guess.
 *
 *   npx tsx scripts/probe_patient.mts
 */
import { readFileSync } from 'node:fs'
import { Box3, Vector3, type Bone, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

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
scene.updateWorldMatrix(true, true)

const box = new Box3().setFromObject(scene)
const size = box.getSize(new Vector3())
console.log(`rest bbox: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)} m`)
console.log(`  y spans ${box.min.y.toFixed(3)} .. ${box.max.y.toFixed(3)}`)
console.log(
  box.min.y > -0.02 && box.min.y < 0.05
    ? '  -> origin is AT HER FEET (floor level)'
    : '  -> origin is NOT at her feet',
)

let hips: Object3D | null = null
scene.traverse((o) => {
  if ((o as Bone).isBone && /hips|pelvis/i.test(o.name) && !hips) hips = o
})
if (hips) {
  const p = (hips as Object3D).getWorldPosition(new Vector3())
  console.log(`hips bone "${(hips as Object3D).name}" rest y = ${p.y.toFixed(3)} m`)
}

console.log(`\n${gltf.animations.length} clips:`)
for (const clip of gltf.animations) {
  // The hips position track is the only one that moves the body vertically.
  const track = clip.tracks.find((t: any) => /hips|pelvis/i.test(t.name) && t.name.endsWith('.position'))
  if (!track) {
    console.log(`  ${clip.name.padEnd(16)} ${clip.duration.toFixed(2)}s  (no hips position track)`)
    continue
  }
  const axis = (o: number) => {
    const v: number[] = []
    for (let i = o; i < track.values.length; i += 3) v.push(track.values[i])
    return v
  }
  const [xs, ys, zs] = [axis(0), axis(1), axis(2)]
  const rng = (v: number[]) => `${Math.min(...v).toFixed(2)}..${Math.max(...v).toFixed(2)}`
  console.log(`  ${clip.name.padEnd(16)} ${clip.duration.toFixed(2)}s  ${track.values.length / 3} keys`)
  console.log(`      x ${rng(xs)}   y ${rng(ys)}   z ${rng(zs)}`)
  console.log(`      first key (${xs[0].toFixed(2)}, ${ys[0].toFixed(2)}, ${zs[0].toFixed(2)})`)
  console.log(
    `      last  key (${xs.at(-1)!.toFixed(2)}, ${ys.at(-1)!.toFixed(2)}, ${zs.at(-1)!.toFixed(2)})`,
  )
}
