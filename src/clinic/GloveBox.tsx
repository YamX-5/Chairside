import { memo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { C } from './theme3d'
import { GLOVE_MOUNT_Y, INTERACTABLES, STATION_SPLASHBACK_Z } from './layout'

/**
 * The glove dispenser on the sink run.
 *
 * Wall-mounted where you actually glove up — beside the sink, after washing.
 * Position is DERIVED from the `gloves` interactable in layout.ts rather than
 * typed here, because every placement bug in this project came from the same
 * number living in two files: the trigger drifted from the object and the prompt
 * fired at thin air.
 *
 * The player stands at the interactable point; the box hangs on the cabinet face
 * in front of them, so it is visible from where the prompt appears.
 */

/**
 * What the dispenser is bolted to: the station's splashback, the back panel
 * between the worktop and the wall units.
 *
 * Third value in this slot, and the first that is a real surface. It was -3.1,
 * a coordinate from the original 8 x 8 m room, which put the box 0.7 m outside
 * the back wall. It was then "fixed" to `STATION.maxZ - 0.05` — derived from a
 * BOUNDING box, which on this asset is the merged drawer-pull mesh — leaving it
 * floating 0.79 m in front of the nearest real geometry, out over the worktop's
 * leading edge.
 *
 * The height moved too: 1.24 is above UPPER_CABINET_MIN_Y (1.117), i.e. inside
 * the wall units. GLOVE_MOUNT_Y sits in the band where a dispenser can exist.
 */
const CABINET_FACE_Z = STATION_SPLASHBACK_Z
const MOUNT_Y = GLOVE_MOUNT_Y

const spot = INTERACTABLES.find((i) => i.id === 'gloves')!

export const GloveBox = memo(function GloveBox({ gloved }: { gloved: boolean }) {
  return (
    <group position={[spot.x, MOUNT_Y, CABINET_FACE_Z + 0.015]}>
      {/* The dispenser body. Tilted forward slightly so the opening faces the
          room rather than the ceiling — that tilt is what makes it read as a
          dispenser and not a box screwed to a wall. */}
      <RoundedBox args={[0.17, 0.24, 0.09]} radius={0.012} smoothness={3} rotation={[0.14, 0, 0]}>
        <meshLambertMaterial color={C.tealDeep} />
      </RoundedBox>

      {/* The face plate, so the front reads as a separate panel. */}
      <RoundedBox
        args={[0.145, 0.2, 0.012]}
        radius={0.008}
        smoothness={3}
        position={[0, 0.004, 0.05]}
        rotation={[0.14, 0, 0]}
      >
        <meshLambertMaterial color={C.teal} />
      </RoundedBox>

      {/* The dispensing slot — a dark recess, not a painted line. */}
      <mesh position={[0, 0.062, 0.056]} rotation={[0.14, 0, 0]}>
        <boxGeometry args={[0.098, 0.026, 0.006]} />
        <meshBasicMaterial color={0x1c2a2b} />
      </mesh>

      {/* Two gloves pulled half out of the slot. Blue nitrile, the same colour
          the game already uses for gloves, so the box announces what it holds
          without a label — which also means it needs no translation. */}
      {[-0.022, 0.021].map((x, i) => (
        <mesh
          key={x}
          position={[x, 0.078 + i * 0.004, 0.058]}
          rotation={[0.14 + (i ? -0.22 : 0.26), 0, i ? 0.34 : -0.28]}
        >
          <boxGeometry args={[0.032, 0.05, 0.004]} />
          <meshLambertMaterial color={C.glove} />
        </mesh>
      ))}

      {/* A worn label strip. Flat colour, no text: text on a 3D prop is a
          localisation liability for something nobody reads. */}
      <mesh position={[0, -0.062, 0.057]} rotation={[0.14, 0, 0]}>
        <boxGeometry args={[0.092, 0.03, 0.004]} />
        <meshBasicMaterial color={gloved ? 0x5d8f6a : C.white} />
      </mesh>
    </group>
  )
})
