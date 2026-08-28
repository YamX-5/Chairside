import { measureGlb } from '../src/clinic/glbMeasure'
const m = measureGlb('public/models/props/eto_sterilizer.glb')!
const f = (v: number) => v.toFixed(3)
console.log(`bbox x ${f(m.lo[0])}..${f(m.hi[0])}  y ${f(m.lo[1])}..${f(m.hi[1])}  z ${f(m.lo[2])}..${f(m.hi[2])}`)
console.log(`size ${f(m.hi[0]-m.lo[0])} x ${f(m.hi[1]-m.lo[1])} x ${f(m.hi[2]-m.lo[2])}`)
for (const n of m.nodes.slice(0, 14)) {
  console.log(`  ${n.name.slice(0,30).padEnd(30)} x ${f(n.lo[0])}..${f(n.hi[0])}  z ${f(n.lo[2])}..${f(n.hi[2])}`)
}