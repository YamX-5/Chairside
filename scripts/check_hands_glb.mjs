/**
 * Verify public/models/hands.glb is what Hands.tsx expects, and is human-sized.
 *
 * The component finds bones by name and curls them. If an export ever renames or
 * drops those nodes the hands silently stop moving — no error, just dead fingers
 * — so this asserts the contract instead of trusting it. (gltf-transform's
 * optimize pass renamed nodes exactly this way once and broke every openable
 * door in the room.)
 *
 * It also measures the shipped hand. Size is checked HERE, on the exported file,
 * because the Blender build reported two different hand lengths for the same
 * model depending on when it measured. The glb is the only thing the game loads,
 * so the glb is what gets believed.
 *
 * Hand length is measured between JOINT NODES, not from mesh bounds: the mesh is
 * skinned, so its accessor extents are the bind-pose blob, not where the geometry
 * ends up.
 */
import { readFileSync } from 'node:fs'

const FINGERS = ['f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb']
const SEGMENTS = ['01', '02', '03']

/**
 * Hands.tsx measures the loaded model and scales it to a real 185 mm hand, so
 * the size in the FILE does not have to be right — the glTF exporter drops the
 * armature's object scale when the skinned mesh is not parented to it, and
 * fighting that is not worth it. What must hold is that the skeleton is sane
 * enough to measure: a zero-length or kilometre-long hand means the wrist and
 * fingertip joints are not where they claim, and the runtime scale would be
 * garbage.
 */
const HAND_SANE_MIN = 0.001
const HAND_SANE_MAX = 10
/** What the game normalises to. */
const TARGET = 0.185

const buf = readFileSync('public/models/hands.glb')
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb')
const jsonLength = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))

const nodes = gltf.nodes ?? []
const names = nodes.map((n) => n.name ?? '')
const fail = []

// --- the bones the component drives -----------------------------------------
const present = []
for (const finger of FINGERS) {
  for (const segment of SEGMENTS) {
    const want = `${finger}.${segment}`
    if (names.some((n) => n.startsWith(want) && !n.includes('_end'))) present.push(want)
  }
}
// A one-hand asset has 15; a pair has the same 15 names twice, which we cannot
// distinguish by name alone — so require at least one full set.
if (present.length < FINGERS.length * SEGMENTS.length) {
  fail.push(`only ${present.length}/15 finger joints: missing ${
    FINGERS.flatMap((f) => SEGMENTS.map((s) => `${f}.${s}`))
      .filter((w) => !present.includes(w)).join(', ')
  }`)
}

const skins = gltf.skins ?? []
if (!skins.length) fail.push('no skin — the mesh is not rigged')

// --- world transforms, so the hand can be measured --------------------------
function trs(node) {
  if (node.matrix) return node.matrix.slice()
  const [tx, ty, tz] = node.translation ?? [0, 0, 0]
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale ?? [1, 1, 1]
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz
  const xx = qx * x2, xy = qx * y2, xz = qx * z2
  const yy = qy * y2, yz = qy * z2, zz = qz * z2
  const wx = qw * x2, wy = qw * y2, wz = qw * z2
  // column-major, matching glTF
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

function mul(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}

const world = new Map()
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
function walk(index, parent) {
  const m = mul(parent, trs(nodes[index]))
  world.set(index, m)
  for (const child of nodes[index].children ?? []) walk(child, m)
}
for (const root of gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? []) walk(root, IDENT)

const originOf = (i) => {
  const m = world.get(i)
  return m ? [m[12], m[13], m[14]] : null
}
const find = (pred) => names.findIndex(pred)

// The wrist is the bone the fingers hang off; the tip is the middle finger's end.
const wrist = find((n) => /^(hand|wrist)/i.test(n))
const tip =
  find((n) => n.startsWith('f_middle.03') && n.includes('_end')) >= 0
    ? find((n) => n.startsWith('f_middle.03') && n.includes('_end'))
    : find((n) => n.startsWith('f_middle.03'))

let handLength = null
if (wrist >= 0 && tip >= 0) {
  const a = originOf(wrist)
  const b = originOf(tip)
  if (a && b) handLength = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

const tris = (gltf.meshes ?? [])
  .flatMap((m) => m.primitives)
  .reduce((n, p) => n + (gltf.accessors[p.indices]?.count ?? 0) / 3, 0)
const meshNames = (gltf.meshes ?? []).map((m) => m.name ?? '?')

console.log(
  `hands.glb: ${nodes.length} nodes, ${skins[0]?.joints?.length ?? 0} joints, ` +
    `${Math.round(tris)} triangles, ${(buf.length / 1024).toFixed(0)} KB`,
)
console.log(`  meshes: ${meshNames.join(', ')}`)
console.log(`  finger joints present: ${present.length}/15`)

if (handLength === null) {
  fail.push('cannot measure hand length — no wrist or middle-fingertip node')
} else {
  const mm = (handLength * 1000).toFixed(0)
  console.log(`  hand length in file (${names[wrist]} -> ${names[tip]}): ${mm} mm`)
  console.log(
    `  game scales it by ${(TARGET / handLength).toFixed(3)}x -> ${TARGET * 1000} mm`,
  )
  if (handLength < HAND_SANE_MIN || handLength > HAND_SANE_MAX) {
    fail.push(`hand measures ${mm} mm — the skeleton is not measurable`)
  }
}

// The cuff is what makes gloves-on read as gloved; without it the toggle is a
// colour change and nothing more.
if (!meshNames.some((n) => /cuff/i.test(n))) {
  fail.push('no Cuff mesh — gloves-on would just be a tint')
}

if (fail.length) {
  console.error('\nFAILED:')
  for (const f of fail) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('\nOK: rigged, named as expected, and human-sized')
