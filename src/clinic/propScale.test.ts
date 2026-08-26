import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_SCALE_TOL,
  PROP_SCALES,
  PROP_SCALE_BY_ID,
  scaleOk,
} from './propScale'
import { PROPS } from './layout'

const PROPS_DIR = join(process.cwd(), 'public', 'models', 'props')

// ---------------------------------------------------------------------------
// A minimal glTF reader that measures in WORLD space.
//
// The tempting shortcut is accessors[POSITION].min/max, which glTF precomputes.
// That is wrong for anything whose scale lives in the node hierarchy — which is
// every asset Blender exports, because the exporter writes object transforms as
// node TRS and leaves vertex data alone. Measuring that way reported a stool at
// 15,596 metres and then reported the SAME number after a correct re-export,
// because the vertex data legitimately never moved. Compose the matrices.
// ---------------------------------------------------------------------------

type Mat = number[]

function identity(): Mat {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

/** Column-major 4x4, glTF convention. */
function mul(a: Mat, b: Mat): Mat {
  const out = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      out[c * 4 + r] = s
    }
  }
  return out
}

interface GltfNode {
  matrix?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
  mesh?: number
  children?: number[]
}

function nodeMatrix(n: GltfNode): Mat {
  if (n.matrix) return [...n.matrix]
  const [tx, ty, tz] = n.translation ?? [0, 0, 0]
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1]
  const s = n.scale ?? [1, 1, 1]
  const rot = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ]
  const m = new Array(16).fill(0)
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) m[c * 4 + r] = rot[c * 3 + r] * s[c]
  }
  m[12] = tx
  m[13] = ty
  m[14] = tz
  m[15] = 1
  return m
}

function readGltfJson(path: string): Record<string, unknown> {
  const buf = readFileSync(path)
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'glTF', `${path} is not a .glb`)
  let off = 12
  while (off < buf.length) {
    const len = buf.readUInt32LE(off)
    const kind = buf.readUInt32LE(off + 4)
    if (kind === 0x4e4f534a) {
      return JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8'))
    }
    off += 8 + len
  }
  throw new Error(`${path} has no JSON chunk`)
}

interface Measured {
  size: [number, number, number]
  baseY: number
}

function measure(path: string): Measured | null {
  const js = readGltfJson(path) as {
    nodes?: GltfNode[]
    meshes?: { primitives: { attributes: Record<string, number> }[] }[]
    accessors?: { min?: number[]; max?: number[] }[]
    scenes?: { nodes?: number[] }[]
    scene?: number
  }
  const nodes = js.nodes ?? []
  const meshes = js.meshes ?? []
  const accessors = js.accessors ?? []
  const roots = js.scenes?.[js.scene ?? 0]?.nodes ?? nodes.map((_, i) => i)

  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  let any = false

  const stack: [number, Mat][] = roots.map((i) => [i, identity()])
  while (stack.length) {
    const [idx, parent] = stack.pop()!
    const node = nodes[idx]
    if (!node) continue
    const world = mul(parent, nodeMatrix(node))
    if (node.mesh != null) {
      for (const prim of meshes[node.mesh]?.primitives ?? []) {
        const acc = accessors[prim.attributes?.POSITION]
        if (!acc?.min || !acc?.max) continue
        for (const cx of [acc.min[0], acc.max[0]]) {
          for (const cy of [acc.min[1], acc.max[1]]) {
            for (const cz of [acc.min[2], acc.max[2]]) {
              const p = [
                world[0] * cx + world[4] * cy + world[8] * cz + world[12],
                world[1] * cx + world[5] * cy + world[9] * cz + world[13],
                world[2] * cx + world[6] * cy + world[10] * cz + world[14],
              ]
              for (let i = 0; i < 3; i++) {
                if (p[i] < lo[i]) lo[i] = p[i]
                if (p[i] > hi[i]) hi[i] = p[i]
              }
              any = true
            }
          }
        }
      }
    }
    for (const c of node.children ?? []) stack.push([c, world])
  }

  if (!any) return null
  return { size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], baseY: lo[1] }
}

// ---------------------------------------------------------------------------
// The table itself
// ---------------------------------------------------------------------------

{
  const ids = new Set(PROP_SCALES.map((p) => p.id))
  assert.equal(ids.size, PROP_SCALES.length, 'prop scale ids must be unique')

  for (const p of PROP_SCALES) {
    assert.ok(p.longest > 0, `${p.id} needs a positive size`)
    assert.ok(p.longest < 6, `${p.id} at ${p.longest} m does not fit in a 4.8 m room`)
    // The whole point of the file. A size with no human attached to it is a
    // guess, and guesses are what put a suitcase-sized box of masks on a bench.
    assert.ok(
      p.because.trim().length > 20,
      `${p.id} has no stated human reason for its size`,
    )
  }
}

// Every prop actually placed in the room must have a declared size.
for (const prop of PROPS) {
  assert.ok(
    PROP_SCALE_BY_ID.has(prop.id),
    `prop '${prop.id}' is placed in the room but has no entry in PROP_SCALES — ` +
      `say what a human does with it and how big that makes it`,
  )
}

// ---------------------------------------------------------------------------
// The shipped files must match
// ---------------------------------------------------------------------------

{
  let checked = 0
  const missing: string[] = []

  for (const spec of PROP_SCALES) {
    const path = join(PROPS_DIR, `${spec.id}.glb`)
    if (!existsSync(path)) {
      missing.push(spec.id)
      continue
    }
    const m = measure(path)
    assert.ok(m, `${spec.id}.glb has no geometry`)
    const longest = Math.max(...m!.size)
    const tol = spec.tol ?? DEFAULT_SCALE_TOL
    assert.ok(
      scaleOk(spec.id, longest),
      `${spec.id}.glb is ${longest.toFixed(3)} m, expected ${spec.longest} m ` +
        `(±${Math.round(tol * 100)}%) — ${spec.because}`,
    )

    // Grounded at its own origin, so `position` in layout.ts means what it says.
    // An asset whose base floats or sinks makes every placement a guess.
    assert.ok(
      Math.abs(m!.baseY) < 0.02,
      `${spec.id}.glb sits at baseY ${m!.baseY.toFixed(3)} — it must be grounded at 0`,
    )
    checked++
  }

  assert.ok(checked > 0, 'no prop models were measured — is public/models/props populated?')

  // Missing files are reported, not silently skipped: a prop listed in the room
  // whose .glb never downloaded is exactly the failure that leaves a hole in
  // the scene and no error anywhere.
  const placedButMissing = missing.filter((id) => PROPS.some((p) => p.id === id))
  assert.deepEqual(
    placedButMissing,
    [],
    `these props are placed in the room but have no .glb on disk: ${placedButMissing.join(', ')}`,
  )

  console.log(
    `propScale.test.ts — ${checked} models measured against human-scale sizes` +
      (missing.length ? `, ${missing.length} not on disk (${missing.join(', ')})` : '') +
      ', all assertions passed',
  )
}
