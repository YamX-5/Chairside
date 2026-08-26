/**
 * Ad-hoc measuring CLI: `npm run measure`
 *
 * Prints world-space boxes for the assets the room's placement depends on, so a
 * height is never typed from memory. Reads through src/clinic/glbMeasure.ts —
 * the same code the tests measure with.
 */
import { join } from 'node:path'
import { measureGlb } from '../src/clinic/glbMeasure'

const P = (f: string) => join(process.cwd(), 'public', 'models', f)
const f3 = (n: number) => n.toFixed(3)

for (const name of ['monitor', 'keyboard', 'mouse']) {
  const m = measureGlb(P(`props/${name}.glb`))!
  console.log(`\n=== ${name}.glb — ${m.size.map(f3).join(' x ')} m, baseY ${f3(m.lo[1])} ===`)
  for (const n of m.nodes) {
    console.log(
      '  ' + n.name.slice(0, 30).padEnd(30),
      f3(n.size[0]) + ' x ' + f3(n.size[1]) + ' x ' + f3(n.size[2]),
      ' y ' + f3(n.lo[1]) + '..' + f3(n.hi[1]),
      ' z ' + f3(n.lo[2]) + '..' + f3(n.hi[2]),
    )
  }
}
