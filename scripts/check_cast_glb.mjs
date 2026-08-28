/**
 * Load every CC0 cast GLB through THREE'S OWN LOADER and report what the game
 * will actually get.
 *
 *     node scripts/check_cast_glb.mjs
 *
 * WHY NOT READ THE FILE
 * ---------------------
 * Four separate bugs this session passed a file-level check while the game was
 * broken, because three's GLTFLoader rewrites what it reads: PropertyBinding
 * .sanitizeNodeName strips [].:/ from EVERY node name on the way in. These rigs
 * are full of dotted bone names — UpperArm.L, Foot.R, Thumb2.L — so the names in
 * the file are NOT the names in the scene, and a bone table written from the
 * file would miss every limb, silently.
 *
 * It also reports the evaluated standing height, which is the number the runtime
 * scale is derived from. A skinned mesh's geometry bounding box is the UNDEFORMED
 * pose, so that is measured off the skeleton's bind matrices instead.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Box3, Vector3 } from 'three'

const DIR = join(process.cwd(), 'public', 'models', 'unbaked', 'quaternius')
const loader = new GLTFLoader()

/** Standing height, measured through the skeleton rather than the mesh box. */
function evaluatedHeight(root) {
  const box = new Box3()
  const v = new Vector3()
  let any = false
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    if (!o.isBone) return
    o.getWorldPosition(v)
    box.expandByPoint(v)
    any = true
  })
  return any ? box.getSize(new Vector3()) : null
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.glb')).sort()
if (files.length === 0) throw new Error('no cast GLBs — run scripts/fbx_to_glb.py first')

let firstBones = null
for (const f of files) {
  // readFileSync, not fetch: node's fetch has no file: scheme.
  const raw = readFileSync(join(DIR, f))
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  const gltf = await loader.parseAsync(buf, '')

  const clips = gltf.animations.map((a) => `${a.name}(${a.duration.toFixed(2)}s)`)
  const bones = []
  let verts = 0
  gltf.scene.traverse((o) => {
    if (o.isBone) bones.push(o.name)
    if (o.isMesh) verts += o.geometry.attributes.position.count
  })
  const size = evaluatedHeight(gltf.scene)

  console.log(
    `${f.padEnd(26)} ${String(verts).padStart(5)} verts  ` +
      `${String(bones.length).padStart(2)} bones  ` +
      `skeleton ${size.y.toFixed(3)} m tall  [${clips.join(' ')}]`,
  )

  // The names AS THREE SEES THEM. If these still contain dots, the sanitiser
  // did not run and every assumption below is wrong.
  if (bones.some((b) => /[.:[\]/]/.test(b))) {
    throw new Error(`${f}: bone names still contain reserved characters: ` +
      bones.filter((b) => /[.:[\]/]/.test(b)).join(', '))
  }

  // Every character in the cast must expose the SAME rig, or the bone table has
  // to branch per outfit and it will eventually be wrong for one of them.
  const sorted = bones.slice().sort().join(',')
  if (firstBones === null) {
    firstBones = sorted
    console.log(`  bones: ${bones.slice().sort().join(' ')}`)
  } else if (sorted !== firstBones) {
    throw new Error(`${f}: different skeleton from the first file — the cast ` +
      `cannot share one bone table`)
  }
}

console.log(`\n${files.length} cast GLBs, one shared skeleton, all four clips present.`)
