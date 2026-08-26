import { MeshReflectorMaterial } from '@react-three/drei'
import { MIRROR } from './layout'

/**
 * A real mirror on the clinic wall.
 *
 * WHAT IT WILL AND WILL NOT SHOW YOU
 * ----------------------------------
 * This is a genuine planar reflection, not a picture of one: `MeshReflectorMaterial`
 * renders the scene a second time from the mirrored camera, so what you see in it
 * is the actual room, live, including anything that moves.
 *
 * It will NOT show you a person. There is no player body in this game — the
 * player is a camera with a pair of hands parented to it (see Hands.tsx), which
 * is the standard first-person trick and completely invisible from any angle but
 * your own. Walk up to this and you will see the operatory behind you and your
 * own gloved hands, floating. Giving it a reflection worth looking at means
 * building a player character first, which is its own piece of work.
 *
 * It is still worth having now: a mirror is the fastest way to see the half of
 * the room that is behind you, which is exactly where the bookcase, the door and
 * the cabinet ended up.
 *
 * COST: reflections are a second render pass. `resolution` is deliberately
 * modest and `mixBlur` deliberately high — a soft, slightly dim clinic mirror
 * costs a fraction of a sharp one and reads more like real glass anyway. On a
 * phone this is the single most expensive thing in the room, so it is the first
 * thing to drop if the frame rate needs it.
 */
export function Mirror() {
  return (
    <group position={[MIRROR.x, MIRROR.y, MIRROR.z]} rotation={[0, MIRROR.yaw, 0]}>
      {/* The glass. */}
      <mesh>
        <planeGeometry args={[MIRROR.w, MIRROR.h]} />
        <MeshReflectorMaterial
          resolution={512}
          mirror={0.82}
          mixBlur={1.1}
          mixStrength={2.2}
          blur={[240, 90]}
          depthScale={0.4}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.2}
          metalness={0.55}
          roughness={0.42}
          color="#c8d2d8"
        />
      </mesh>

      {/* A brushed frame, so it reads as a fitting rather than a hole in the
          wall. Slightly proud of the glass on every side. */}
      <mesh position={[0, 0, -0.012]}>
        <boxGeometry args={[MIRROR.w + 0.05, MIRROR.h + 0.05, 0.025]} />
        <meshStandardMaterial color="#9aa4ad" roughness={0.35} metalness={0.6} />
      </mesh>
    </group>
  )
}
