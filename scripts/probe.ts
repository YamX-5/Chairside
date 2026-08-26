/**
 * Ad-hoc layout inspector: `npm run measure`
 *
 * Prints the derived floor plan and flags anything a test might not — a prop
 * that has moved away from its collider, an interactable you cannot stand at.
 */
import {
  BOOKCASE_POS,
  CABINET_POS,
  CHAIR_POS,
  COLLIDERS,
  DESK_POS,
  INTERACTABLES,
  PROPS,
  SPAWN,
  STATION,
  blocked,
} from '../src/clinic/layout'
import { BOUND, PLAYER_RADIUS, ROOM_HALF } from '../src/clinic/theme3d'

const f = (n: number) => n.toFixed(2)

console.log(`ROOM_HALF ${ROOM_HALF}   walkable BOUND ${f(BOUND)}   (${ROOM_HALF * 2} x ${ROOM_HALF * 2} m)`)
console.log('')
console.log('wall props (derived):')
console.log('  DESK_POS     ', DESK_POS.map(f).join(', '))
console.log('  CABINET_POS  ', CABINET_POS.map(f).join(', '))
console.log('  BOOKCASE_POS ', BOOKCASE_POS.map(f).join(', '))
console.log('  CHAIR_POS    ', CHAIR_POS.map(f).join(', '))
console.log('  STATION      ', `x ${f(STATION.minX)}..${f(STATION.maxX)}  z ${f(STATION.minZ)}..${f(STATION.maxZ)}`)

console.log('\ncolliders:')
for (const b of COLLIDERS) {
  const outside =
    b.minX < -ROOM_HALF - 0.01 || b.maxX > ROOM_HALF + 0.01 ||
    b.minZ < -ROOM_HALF - 0.01 || b.maxZ > ROOM_HALF + 0.01
  console.log(
    `   x ${f(b.minX)}..${f(b.maxX)}  z ${f(b.minZ)}..${f(b.maxZ)}` + (outside ? '   <- outside the room' : ''),
  )
}

console.log('\nprops vs their collider (does anything now float free?):')
for (const p of PROPS) {
  const inside = COLLIDERS.some(
    (b) => p.pos[0] >= b.minX - 0.3 && p.pos[0] <= b.maxX + 0.3 &&
           p.pos[2] >= b.minZ - 0.3 && p.pos[2] <= b.maxZ + 0.3,
  )
  console.log(`   ${p.id.padEnd(22)} (${f(p.pos[0])}, ${f(p.pos[2])})` + (inside ? '' : '   <- NO collider near it'))
}

console.log('\ninteractables:')
for (const i of INTERACTABLES) {
  const bad = blocked(i.x, i.z, PLAYER_RADIUS)
  const oob = Math.abs(i.x) > BOUND || Math.abs(i.z) > BOUND
  console.log(
    `   ${i.id.padEnd(8)} (${f(i.x)}, ${f(i.z)})` +
      (bad ? '   <- BLOCKED, cannot stand here' : '') +
      (oob ? '   <- outside the walkable area' : ''),
  )
}
console.log(`\nSPAWN (${f(SPAWN.x)}, ${f(SPAWN.z)})` + (blocked(SPAWN.x, SPAWN.z, PLAYER_RADIUS) ? '   <- BLOCKED' : '   ok'))
