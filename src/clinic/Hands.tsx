import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { Group } from 'three'
import { C } from './theme3d'
import { moveInput } from './input'

/**
 * First-person gloved hands, held low in the view.
 *
 * The shape has to READ as a hand, not a paw — the trick is separated fingers
 * with a bend at the knuckle (a straight stub looks like a mitten; a bent
 * two-segment finger looks like a finger). Palm is a flat rounded slab, not a
 * sphere, and the four fingers fan out and point away from the camera so you
 * see the back of the hand the way you would looking down at your own.
 *
 * Parented to nothing: the group copies the camera transform each frame, because
 * three.js only renders a camera's children if the camera is in the scene graph
 * and r3f's default camera is not.
 */

const GLOVE = C.glove
const SKIN = C.skin

/** One finger: a proximal segment plus a shorter distal segment bent down. */
function Finger({
  x,
  spread,
  length = 1,
  gloved,
}: {
  x: number
  spread: number
  length?: number
  gloved: boolean
}) {
  return (
    <group position={[x, 0, -0.045]} rotation={[-0.12, spread, 0]}>
      {/* proximal */}
      <RoundedBox
        args={[0.019, 0.02, 0.05 * length]}
        radius={0.009}
        smoothness={3}
        position={[0, 0, -0.025 * length]}
      >
        <meshStandardMaterial color={gloved ? GLOVE : SKIN} roughness={0.5} envMapIntensity={0.7} />
      </RoundedBox>
      {/* distal, bent down at the knuckle — the cue that says "finger" */}
      <RoundedBox
        args={[0.017, 0.018, 0.038 * length]}
        radius={0.008}
        smoothness={3}
        position={[0, -0.008, -0.065 * length]}
        rotation={[0.55, 0, 0]}
      >
        <meshStandardMaterial color={gloved ? GLOVE : SKIN} roughness={0.5} envMapIntensity={0.7} />
      </RoundedBox>
    </group>
  )
}

function OneHand({ side, gloved }: { side: number; gloved: boolean }) {
  // side: +1 right, -1 left. Thumb sits on the inner edge of each hand.
  return (
    <group position={[0.23 * side, -0.30, -0.52]} rotation={[0.5, 0.14 * -side, 0.14 * side]}>
      {/* forearm in the glove sleeve, receding down toward the camera */}
      <mesh position={[0, -0.02, 0.13]} rotation-x={1.15}>
        <capsuleGeometry args={[0.043, 0.17, 6, 14]} />
        <meshStandardMaterial color={gloved ? GLOVE : SKIN} roughness={0.55} envMapIntensity={0.7} />
      </mesh>
      {/* a sliver of bare wrist above the cuff, so it's a gloved HAND not a mitt */}
      <mesh position={[0, 0.02, 0.19]} rotation-x={1.15}>
        <cylinderGeometry args={[0.041, 0.041, 0.03, 14]} />
        <meshStandardMaterial color={SKIN} roughness={0.85} />
      </mesh>
      {/* glove cuff — a slightly fatter ring at the wrist */}
      <mesh position={[0, 0.0, 0.075]} rotation-x={1.15}>
        <cylinderGeometry args={[0.05, 0.047, 0.04, 16]} />
        <meshStandardMaterial color={gloved ? GLOVE : SKIN} roughness={0.5} envMapIntensity={0.8} />
      </mesh>
      {/* palm — a flat rounded slab, wider than it is thick */}
      <RoundedBox args={[0.092, 0.03, 0.1]} radius={0.014} smoothness={4} position={[0, 0, -0.01]}>
        <meshStandardMaterial color={gloved ? GLOVE : SKIN} roughness={0.5} envMapIntensity={0.75} />
      </RoundedBox>
      {/* four fingers off the front edge, gently fanned */}
      <Finger gloved={gloved} x={-0.033} spread={0.16} length={0.92} />
      <Finger gloved={gloved} x={-0.011} spread={0.05} length={1.05} />
      <Finger gloved={gloved} x={0.011} spread={-0.05} length={1.0} />
      <Finger gloved={gloved} x={0.033} spread={-0.16} length={0.82} />
      {/* thumb — off the inner side, angled up and across the palm */}
      <group
        position={[-0.052 * side, 0.004, 0.02]}
        rotation={[0.1, 0.9 * side, 0.7 * side]}
      >
        <RoundedBox args={[0.021, 0.021, 0.045]} radius={0.01} smoothness={3} position={[0, 0, -0.022]}>
          <meshStandardMaterial color={gloved ? GLOVE : SKIN} roughness={0.5} envMapIntensity={0.7} />
        </RoundedBox>
        <RoundedBox
          args={[0.019, 0.019, 0.032]}
          radius={0.009}
          smoothness={3}
          position={[0, -0.004, -0.055]}
          rotation={[0.5, 0, 0]}
        >
          <meshStandardMaterial color={gloved ? GLOVE : SKIN} roughness={0.5} envMapIntensity={0.7} />
        </RoundedBox>
      </group>
    </group>
  )
}

/**
 * @param gloved Bare hands when false. The clinic tracks gloving as a real
 * safety decision, so the player has to be able to SEE which it is — a prompt
 * that says "take the gloves off" while your hands look identical either way
 * teaches nothing.
 */
export function Hands({ gloved = true }: { gloved?: boolean }) {
  const group = useRef<Group>(null)
  const bob = useRef(0)

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const moving = Math.abs(moveInput.x) + Math.abs(moveInput.z) > 0.05
    bob.current += delta * (moving ? 9 : 1.6)
    const amp = moving ? 0.02 : 0.006

    g.position.copy(state.camera.position)
    g.quaternion.copy(state.camera.quaternion)
    // Low and slightly forward: the hands frame the bottom of the view.
    g.translateY(-0.34 + Math.sin(bob.current) * amp)
    g.translateZ(-0.32)
    g.rotateZ(Math.sin(bob.current * 0.5) * (moving ? 0.03 : 0.01))
  })

  return (
    <group ref={group} scale={0.95}>
      <OneHand side={-1} gloved={gloved} />
      <OneHand side={1} gloved={gloved} />
    </group>
  )
}
