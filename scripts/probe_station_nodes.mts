/**
 * What parts does the sterilisation station actually have?
 *
 * The layout defines ONE openable drawer and seven doors, with a comment saying
 * Drawer_00 is "the one genuine drawer front". Before promising working drawers
 * under the bench, check whether separate drawer geometry exists at all — a
 * merged front cannot be animated no matter what the layout says.
 *
 *   npx tsx scripts/probe_station_nodes.mts
 */
import { measureGlb } from '../src/clinic/glbMeasure'

for (const file of ['props/sterilization_centre.glb', 'props/closet.glb']) {
  const m = measureGlb(`public/models/${file}`)
  if (!m) {
    console.log(`${file}: no geometry`)
    continue
  }
  const f = (v: number) => v.toFixed(3)
  console.log(`\n=== ${file} — ${m.nodes.length} nodes ===`)
  console.log(`bbox x ${f(m.lo[0])}..${f(m.hi[0])}  y ${f(m.lo[1])}..${f(m.hi[1])}  z ${f(m.lo[2])}..${f(m.hi[2])}`)

  // Anything whose name hints at a moving part.
  const moving = m.nodes.filter((n) => /draw|door|handle|pull|knob|front/i.test(n.name))
  console.log(`\n  named as moving parts (${moving.length}):`)
  for (const n of moving) {
    console.log(
      `    ${n.name.padEnd(34)} x ${f(n.lo[0])}..${f(n.hi[0])}  y ${f(n.lo[1])}..${f(n.hi[1])}  z ${f(n.lo[2])}..${f(n.hi[2])}`,
    )
  }

  // Base units live below the worktop. A FRONT is thin in z and wide in x — a
  // carcass is deep. That difference is what decides whether a node can be
  // animated as a drawer or door at all.
  console.log(`\n  below-worktop nodes, grouped into columns:`)
  const below = m.nodes
    .filter((n) => n.lo[1] < 0.9 && n.hi[1] > 0.1)
    .map((n) => ({
      name: n.name,
      x: [n.lo[0], n.hi[0]] as const,
      y: [n.lo[1], n.hi[1]] as const,
      depth: n.hi[2] - n.lo[2],
      w: n.hi[0] - n.lo[0],
      h: n.hi[1] - n.lo[1],
      z: [n.lo[2], n.hi[2]] as const,
    }))
    .filter((n) => n.depth < 0.12 && n.w > 0.1 && n.h > 0.05)
    .sort((a, b) => a.x[0] - b.x[0] || a.y[0] - b.y[0])

  let col = -99
  for (const n of below) {
    if (Math.abs(n.x[0] - col) > 0.02) {
      col = n.x[0]
      console.log(`\n    --- column x ${f(n.x[0])}..${f(n.x[1])} ---`)
    }
    const kind = n.h < 0.3 ? 'DRAWER' : 'door  '
    console.log(
      `      ${kind} ${n.name.slice(0, 26).padEnd(26)} y ${f(n.y[0])}..${f(n.y[1])}` +
        `  h ${f(n.h)}  depth ${f(n.depth)}  z ${f(n.z[0])}..${f(n.z[1])}`,
    )
  }
}
