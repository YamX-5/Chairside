/**
 * What does the dental unit actually stand on?
 *
 * Its collider was the whole bounding box — including the overhead light arm and
 * the delivery head, neither of which you can walk into. Inflated by
 * PLAYER_RADIUS that walls off several square metres of clear floor and pinches
 * the lane beside the chair to 80 mm, which is what "walking near the unit gets
 * me stuck" feels like.
 *
 * A collider should be the geometry at FLOOR level. This prints it.
 *
 *   npx tsx scripts/probe_unit_footprint.mts
 */
import { measureGlb } from '../src/clinic/glbMeasure'

const m = measureGlb('public/models/dental_chair.glb')
if (!m) throw new Error('dental_chair.glb has no geometry')

const f = (v: number) => v.toFixed(3)
console.log(`whole unit: x ${f(m.lo[0])}..${f(m.hi[0])}  y ${f(m.lo[1])}..${f(m.hi[1])}  z ${f(m.lo[2])}..${f(m.hi[2])}`)

// Anything whose lowest point is near the floor is something you would walk
// into. Anything starting higher is overhead — you walk under it.
const FLOOR = 0.05
const lo = [Infinity, Infinity, Infinity]
const hi = [-Infinity, -Infinity, -Infinity]

console.log(`\nnodes reaching the floor (lo.y < ${FLOOR}):`)
for (const n of m.nodes) {
  if (n.lo[1] >= FLOOR) continue
  console.log(
    `  ${n.name.padEnd(30)} x ${f(n.lo[0])}..${f(n.hi[0])}   z ${f(n.lo[2])}..${f(n.hi[2])}   top y ${f(n.hi[1])}`,
  )
  for (let i = 0; i < 3; i++) {
    lo[i] = Math.min(lo[i], n.lo[i])
    hi[i] = Math.max(hi[i], n.hi[i])
  }
}

console.log(`\noverhead only (never reaches the floor):`)
for (const n of m.nodes) {
  if (n.lo[1] < FLOOR) continue
  console.log(`  ${n.name.padEnd(30)} starts at y ${f(n.lo[1])}`)
}

console.log(`\nFLOOR FOOTPRINT, model-local — this is what the collider should be:`)
console.log(`  x ${f(lo[0])}..${f(hi[0])}    z ${f(lo[2])}..${f(hi[2])}`)
console.log(`  (${f(hi[0] - lo[0])} x ${f(hi[2] - lo[2])} m)`)
