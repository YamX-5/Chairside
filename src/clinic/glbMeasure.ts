/**
 * Measure a .glb the way a renderer sees it: WORLD space, node transforms applied.
 *
 * WHY THIS IS SHARED CODE AND NOT A SNIPPET IN ONE TEST
 * ----------------------------------------------------
 * Two separate measuring mistakes have already shipped from this project.
 *
 * The first: reading `accessors[POSITION].min/max` and calling it the size. That
 * is the LOCAL extent. Every asset Blender exports carries its scale in the node
 * hierarchy, so that number reported a stool at 15,596 metres and then reported
 * the identical figure after a correct re-export, because the vertex data
 * legitimately never moved.
 *
 * The second: measuring a whole prop's front face per height band. On the
 * sterilisation station every band came back at the same z, because one merged
 * mesh (all nineteen drawer pulls, `Material_002-material.008`) spans the entire
 * run from y 0.06 to 1.15 and is the frontmost thing in every band. The answer
 * looked consistent, which is exactly why it was believed. Per-NODE boxes are
 * the only way to ask "where is that particular panel".
 *
 * So: one reader, used by the tests and by `npm run measure`. No file measures
 * geometry its own way.
 */

import { readFileSync } from 'node:fs'

export type Mat = number[]

export interface NodeBox {
  name: string
  /** World-space min corner, glTF axes: x right, y up, z toward the viewer. */
  lo: [number, number, number]
  hi: [number, number, number]
  size: [number, number, number]
}

export interface Measured {
  size: [number, number, number]
  lo: [number, number, number]
  hi: [number, number, number]
  nodes: NodeBox[]
}

function identity(): Mat {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

/** Column-major 4x4, glTF convention. */
function mul(a: Mat, b: Mat): Mat {
  const out = new Array<number>(16).fill(0)
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
  name?: string
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
  const m = new Array<number>(16).fill(0)
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) m[c * 4 + r] = rot[c * 3 + r] * s[c]
  }
  m[12] = tx
  m[13] = ty
  m[14] = tz
  m[15] = 1
  return m
}

export function readGltfJson(path: string): Record<string, unknown> {
  const buf = readFileSync(path)
  if (buf.subarray(0, 4).toString('ascii') !== 'glTF') {
    throw new Error(`${path} is not a binary .glb`)
  }
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

/**
 * World-space bounds of the whole file, plus a box per named mesh node.
 *
 * Returns null when the file carries no positioned geometry at all — a caller
 * that wants that to be fatal should say so itself, because "no geometry" is a
 * legitimate answer for, say, a lights-only .glb.
 */
export function measureGlb(path: string): Measured | null {
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

  const lo: [number, number, number] = [Infinity, Infinity, Infinity]
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  const out: NodeBox[] = []
  let any = false

  const stack: [number, Mat][] = roots.map((i) => [i, identity()])
  while (stack.length) {
    const [idx, parent] = stack.pop()!
    const node = nodes[idx]
    if (!node) continue
    const world = mul(parent, nodeMatrix(node))

    if (node.mesh != null) {
      const nlo: [number, number, number] = [Infinity, Infinity, Infinity]
      const nhi: [number, number, number] = [-Infinity, -Infinity, -Infinity]
      let hit = false
      for (const prim of meshes[node.mesh]?.primitives ?? []) {
        const acc = accessors[prim.attributes?.POSITION]
        if (!acc?.min || !acc?.max) continue
        // All eight corners: rotation turns a local axis-aligned box into a
        // non-axis-aligned one, so min/max alone under-reports.
        for (const cx of [acc.min[0], acc.max[0]]) {
          for (const cy of [acc.min[1], acc.max[1]]) {
            for (const cz of [acc.min[2], acc.max[2]]) {
              const p = [
                world[0] * cx + world[4] * cy + world[8] * cz + world[12],
                world[1] * cx + world[5] * cy + world[9] * cz + world[13],
                world[2] * cx + world[6] * cy + world[10] * cz + world[14],
              ]
              for (let i = 0; i < 3; i++) {
                if (p[i] < nlo[i]) nlo[i] = p[i]
                if (p[i] > nhi[i]) nhi[i] = p[i]
                if (p[i] < lo[i]) lo[i] = p[i]
                if (p[i] > hi[i]) hi[i] = p[i]
              }
              hit = true
              any = true
            }
          }
        }
      }
      if (hit) {
        out.push({
          name: node.name ?? `node_${idx}`,
          lo: [...nlo] as [number, number, number],
          hi: [...nhi] as [number, number, number],
          size: [nhi[0] - nlo[0], nhi[1] - nlo[1], nhi[2] - nlo[2]],
        })
      }
    }
    for (const c of node.children ?? []) stack.push([c, world])
  }

  if (!any) return null
  return {
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    lo: [...lo] as [number, number, number],
    hi: [...hi] as [number, number, number],
    nodes: out,
  }
}

/**
 * The horizontal surfaces in a model, as (top, thickness) pairs.
 *
 * "Wide, deep and thin" is the whole heuristic: a shelf board, a worktop and a
 * desk slab all match it, and a door panel or a carcass side does not. Used to
 * answer "what can something stand on, and how much room is above it" without
 * anybody typing a shelf height by hand again.
 */
export function horizontalSurfaces(
  m: Measured,
  opts: { minWidth?: number; minDepth?: number; maxThickness?: number } = {},
): { top: number; thickness: number; lo: NodeBox['lo']; hi: NodeBox['hi'] }[] {
  const minWidth = opts.minWidth ?? 0.3
  const minDepth = opts.minDepth ?? 0.12
  const maxThickness = opts.maxThickness ?? 0.06
  return m.nodes
    .filter(
      (n) =>
        n.size[0] >= minWidth && n.size[2] >= minDepth && n.size[1] <= maxThickness,
    )
    .map((n) => ({ top: n.hi[1], thickness: n.size[1], lo: n.lo, hi: n.hi }))
    .sort((a, b) => a.top - b.top)
}

/** Do two world-space boxes overlap by more than `eps` on all three axes? */
export function overlaps(
  a: { lo: number[]; hi: number[] },
  b: { lo: number[]; hi: number[] },
  eps = 0.001,
): boolean {
  for (let i = 0; i < 3; i++) {
    if (Math.min(a.hi[i], b.hi[i]) - Math.max(a.lo[i], b.lo[i]) <= eps) return false
  }
  return true
}
