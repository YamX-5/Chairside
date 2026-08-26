/**
 * Normalise a .glb in place: real-world size, centred on X/Z, grounded at Y=0.
 *
 *   node scripts/normalize_glb.mjs <file.glb> --height 0.45
 *   node scripts/normalize_glb.mjs <file.glb> --width  0.44
 *   node scripts/normalize_glb.mjs <file.glb> --longest 0.115
 *
 * WHY THIS EXISTS
 * ---------------
 * Every prop in this room has to be correctly sized on disk, because
 * `ClinicProps` applies no scale at all — whatever the .glb says IS the size in
 * the room. Until now the only way to fix an asset was a Blender round trip:
 * open, import, scale, ground, re-export. That is slow, needs a GUI running,
 * and each pass is a chance to disturb something else.
 *
 * A glTF stores its transforms as node TRS, so the whole job is one JSON edit:
 * wrap the scene's roots in a new root carrying the right scale and offset. The
 * binary buffer is untouched and copied through byte for byte, so no vertex data
 * is ever resampled, re-quantised, or lost.
 *
 * It does NOT rotate. Orientation is a judgement about which way a thing faces,
 * which belongs in `PROPS.yaw` where a human can read it.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const file = args[0]
if (!file) {
  console.error('usage: normalize_glb.mjs <file.glb> [--height M | --width M | --longest M]')
  process.exit(1)
}
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : null
}

const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

function readGlb(path) {
  const buf = readFileSync(path)
  if (buf.subarray(0, 4).toString('ascii') !== 'glTF') throw new Error(`${path} is not a .glb`)
  const chunks = []
  let off = 12
  while (off < buf.length) {
    const len = buf.readUInt32LE(off)
    const type = buf.readUInt32LE(off + 4)
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) })
    off += 8 + len
  }
  const jsonChunk = chunks.find((c) => c.type === JSON_CHUNK)
  const binChunk = chunks.find((c) => c.type === BIN_CHUNK)
  return { json: JSON.parse(jsonChunk.data.toString('utf8')), bin: binChunk?.data ?? null }
}

function writeGlb(path, json, bin) {
  let jsonBytes = Buffer.from(JSON.stringify(json), 'utf8')
  // glTF requires every chunk to be 4-byte aligned; JSON pads with SPACES and
  // BIN with zeroes. Padding with the wrong byte makes strict loaders reject it.
  while (jsonBytes.length % 4) jsonBytes = Buffer.concat([jsonBytes, Buffer.from(' ')])
  let binBytes = bin
  if (binBytes) {
    while (binBytes.length % 4) binBytes = Buffer.concat([binBytes, Buffer.from([0])])
  }
  const total =
    12 + 8 + jsonBytes.length + (binBytes ? 8 + binBytes.length : 0)
  const out = Buffer.alloc(total)
  out.write('glTF', 0, 'ascii')
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  let off = 12
  out.writeUInt32LE(jsonBytes.length, off)
  out.writeUInt32LE(JSON_CHUNK, off + 4)
  jsonBytes.copy(out, off + 8)
  off += 8 + jsonBytes.length
  if (binBytes) {
    out.writeUInt32LE(binBytes.length, off)
    out.writeUInt32LE(BIN_CHUNK, off + 4)
    binBytes.copy(out, off + 8)
  }
  writeFileSync(path, out)
}

// --- world-space bounds, node transforms composed -------------------------
function identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] }
function mul(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  return o
}
function nodeMatrix(n) {
  if (n.matrix) return [...n.matrix]
  const [tx, ty, tz] = n.translation ?? [0, 0, 0]
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1]
  const s = n.scale ?? [1, 1, 1]
  const rot = [
    1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w),
    2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w),
    2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y),
  ]
  const m = new Array(16).fill(0)
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c*4+r] = rot[c*3+r] * s[c]
  m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1
  return m
}

function bounds(json) {
  const nodes = json.nodes ?? []
  const meshes = json.meshes ?? []
  const accessors = json.accessors ?? []
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? nodes.map((_, i) => i)
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  const stack = roots.map((i) => [i, identity()])
  while (stack.length) {
    const [idx, parent] = stack.pop()
    const node = nodes[idx]
    if (!node) continue
    const world = mul(parent, nodeMatrix(node))
    if (node.mesh != null) {
      for (const prim of meshes[node.mesh]?.primitives ?? []) {
        const acc = accessors[prim.attributes?.POSITION]
        if (!acc?.min || !acc?.max) continue
        for (const cx of [acc.min[0], acc.max[0]])
          for (const cy of [acc.min[1], acc.max[1]])
            for (const cz of [acc.min[2], acc.max[2]]) {
              const p = [
                world[0]*cx + world[4]*cy + world[8]*cz + world[12],
                world[1]*cx + world[5]*cy + world[9]*cz + world[13],
                world[2]*cx + world[6]*cy + world[10]*cz + world[14],
              ]
              for (let i = 0; i < 3; i++) {
                if (p[i] < lo[i]) lo[i] = p[i]
                if (p[i] > hi[i]) hi[i] = p[i]
              }
            }
      }
    }
    for (const c of node.children ?? []) stack.push([c, world])
  }
  return { lo, hi, size: [hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]] }
}

// --- do it ------------------------------------------------------------------
const { json, bin } = readGlb(file)
const before = bounds(json)

const targetH = flag('--height')
const targetW = flag('--width')
const targetL = flag('--longest')
let k = 1
if (targetH) k = targetH / before.size[1]
else if (targetW) k = targetW / before.size[0]
else if (targetL) k = targetL / Math.max(...before.size)

const t = [
  -k * (before.lo[0] + before.hi[0]) / 2,
  -k * before.lo[1],
  -k * (before.lo[2] + before.hi[2]) / 2,
]

const sceneIndex = json.scene ?? 0
const scene = json.scenes[sceneIndex]
const newRoot = {
  name: '__normalized',
  scale: [k, k, k],
  translation: t,
  children: [...scene.nodes],
}
json.nodes.push(newRoot)
scene.nodes = [json.nodes.length - 1]

writeGlb(file, json, bin)
const after = bounds(json)
console.log(
  `${file}\n  ${before.size.map((n) => n.toFixed(3)).join(' x ')}` +
    `  ->  ${after.size.map((n) => n.toFixed(3)).join(' x ')} m` +
    `   baseY ${after.lo[1].toFixed(3)}   scale x${k.toFixed(3)}`,
)
