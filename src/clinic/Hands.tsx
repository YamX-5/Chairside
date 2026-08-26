import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { Group } from 'three'
import { C } from './theme3d'
import { moveInput } from './input'

/**
 * First-person gloved hands, held low in the view.
 *
 * THE FINGERS MOVE, and that is most of the work here. A pair of rigid hands
 * pinned to the camera reads as a prop glued to the lens; the thing that makes
 * them read as YOUR hands is that the fingers are never quite still and never
 * quite in unison. Each finger runs its own phase offset, so the idle animation
 * is a slow uneven ripple rather than four sticks moving as one.
 *
 * Three poses, blended continuously:
 *   open   — walking around, fingers relaxed and slightly splayed
 *   grip   — something is in your hand, so they curl round it
 *   reach  — standing at something you can interact with; the index lifts, the
 *            way a hand does a moment before it takes hold of something
 *
 * SHAPE: the trick is separated fingers with a bend at the knuckle. A straight
 * stub looks like a mitten; a bent two-segment finger looks like a finger. Palm
 * is a flat rounded slab, not a sphere, and the fingers point away from the
 * camera so you see the back of your own hand.
 *
 * Parented to nothing: the group copies the camera transform each frame, because
 * three.js only renders a camera's children if the camera is in the scene graph
 * and r3f's default camera is not.
 */

const GLOVE = C.glove
const SKIN = C.skin

/** How far each finger is along the hand, and how long it is. Index → little. */
const FINGERS = [
  { x: -0.033, spread: 0.16, length: 0.92 },
  { x: -0.011, spread: 0.05, length: 1.05 },
  { x: 0.011, spread: -0.05, length: 1.0 },
  { x: 0.033, spread: -0.16, length: 0.82 },
] as const

interface Joints {
  knuckle: Group | null
  tip: Group | null
}

function Finger({
  x,
  spread,
  length,
  gloved,
  joints,
}: {
  x: number
  spread: number
  length: number
  gloved: boolean
  joints: Joints
}) {
  const mat = (
    <meshStandardMaterial
      color={gloved ? GLOVE : SKIN}
      roughness={0.5}
      envMapIntensity={0.7}
    />
  )
  return (
    <group position={[x, 0, -0.045]} rotation={[0, spread, 0]}>
      {/* The knuckle joint. Rotating THIS curls the whole finger, which is what
          a knuckle does — rotating the segment instead makes it slide. */}
      <group ref={(g) => { joints.knuckle = g }} rotation={[-0.12, 0, 0]}>
        <RoundedBox
          args={[0.019, 0.02, 0.05 * length]}
          radius={0.009}
          smoothness={3}
          position={[0, 0, -0.025 * length]}
        >
          {mat}
        </RoundedBox>

        {/* The second joint, at the far end of the first segment. */}
        <group ref={(g) => { joints.tip = g }} position={[0, -0.004, -0.05 * length]} rotation={[0.55, 0, 0]}>
          <RoundedBox
            args={[0.017, 0.018, 0.038 * length]}
            radius={0.008}
            smoothness={3}
            position={[0, 0, -0.019 * length]}
          >
            {mat}
          </RoundedBox>
        </group>
      </group>
    </group>
  )
}

function OneHand({
  side,
  gloved,
  joints,
  thumbRef,
}: {
  side: number
  gloved: boolean
  joints: Joints[]
  thumbRef: { current: Group | null }
}) {
  const mat = (
    <meshStandardMaterial
      color={gloved ? GLOVE : SKIN}
      roughness={0.5}
      envMapIntensity={0.7}
    />
  )
  return (
    <group position={[0.23 * side, -0.30, -0.52]} rotation={[0.5, 0.14 * -side, 0.14 * side]}>
      {/* forearm in the glove sleeve, receding toward the camera */}
      <mesh position={[0, -0.02, 0.13]} rotation-x={1.15}>
        <capsuleGeometry args={[0.043, 0.17, 6, 14]} />
        <meshStandardMaterial
          color={gloved ? GLOVE : SKIN}
          roughness={0.55}
          envMapIntensity={0.7}
        />
      </mesh>
      {/* a sliver of bare wrist above the cuff, so it reads as a gloved HAND
          rather than a mitt */}
      <mesh position={[0, 0.02, 0.19]} rotation-x={1.15}>
        <cylinderGeometry args={[0.041, 0.041, 0.03, 14]} />
        <meshStandardMaterial color={SKIN} roughness={0.85} />
      </mesh>
      {/* glove cuff — a slightly fatter ring at the wrist */}
      <mesh position={[0, 0, 0.075]} rotation-x={1.15}>
        <cylinderGeometry args={[0.05, 0.047, 0.04, 16]} />
        <meshStandardMaterial
          color={gloved ? GLOVE : SKIN}
          roughness={0.5}
          envMapIntensity={0.8}
        />
      </mesh>
      {/* palm */}
      <RoundedBox args={[0.092, 0.03, 0.1]} radius={0.014} smoothness={4} position={[0, 0, -0.01]}>
        {mat}
      </RoundedBox>

      {FINGERS.map((f, i) => (
        <Finger
          key={i}
          x={f.x}
          spread={f.spread}
          length={f.length}
          gloved={gloved}
          joints={joints[i]}
        />
      ))}

      {/* thumb — off the inner side, angled up and across the palm. Its own
          group so it can close across the fingers when you grip. */}
      <group ref={thumbRef} position={[-0.052 * side, 0.004, 0.02]} rotation={[0.1, 0.9 * side, 0.7 * side]}>
        <RoundedBox args={[0.021, 0.021, 0.045]} radius={0.01} smoothness={3} position={[0, 0, -0.022]}>
          {mat}
        </RoundedBox>
        <RoundedBox
          args={[0.019, 0.019, 0.032]}
          radius={0.009}
          smoothness={3}
          position={[0, -0.004, -0.055]}
          rotation={[0.5, 0, 0]}
        >
          {mat}
        </RoundedBox>
      </group>
    </group>
  )
}

export function Hands({
  gloved = true,
  /** Something is in your hand, so the fingers close around it. */
  holding = false,
  /**
   * Standing at something you could take. The index finger lifts — the small
   * anticipation a real hand makes just before it reaches for something.
   */
  reaching = false,
}: {
  gloved?: boolean
  holding?: boolean
  reaching?: boolean
}) {
  const group = useRef<Group>(null)
  const bob = useRef(0)
  const grip = useRef(0)
  const reach = useRef(0)

  // One joint record per finger per hand. Plain objects, not refs-in-state:
  // these are written by callback refs during render and read in useFrame, and
  // never drive a re-render.
  const left = useMemo<Joints[]>(() => FINGERS.map(() => ({ knuckle: null, tip: null })), [])
  const right = useMemo<Joints[]>(() => FINGERS.map(() => ({ knuckle: null, tip: null })), [])
  const leftThumb = useRef<Group | null>(null)
  const rightThumb = useRef<Group | null>(null)

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return

    const moving = Math.abs(moveInput.x) + Math.abs(moveInput.z) > 0.05
    bob.current += delta * (moving ? 9 : 1.6)
    const amp = moving ? 0.02 : 0.006

    // --- the hands as a whole, riding the camera --------------------------
    g.position.copy(state.camera.position)
    g.quaternion.copy(state.camera.quaternion)
    g.translateY(-0.34 + Math.sin(bob.current) * amp)
    g.translateZ(-0.32)
    g.rotateZ(Math.sin(bob.current * 0.5) * (moving ? 0.03 : 0.01))

    // --- pose blending -----------------------------------------------------
    // Eased, never snapped: a hand that closes instantly reads as a glitch, and
    // ~150 ms is about how long a real one takes.
    const k = 1 - Math.exp(-delta * 11)
    grip.current += ((holding ? 1 : 0) - grip.current) * k
    reach.current += ((reaching && !holding ? 1 : 0) - reach.current) * k

    const t = bob.current

    for (const hand of [left, right]) {
      for (let i = 0; i < hand.length; i++) {
        const j = hand[i]
        if (!j.knuckle || !j.tip) continue

        // Each finger on its own phase, so the idle is an uneven ripple rather
        // than four sticks moving in lockstep. That difference is most of what
        // makes a hand look alive.
        const phase = t * 0.9 + i * 0.8
        const idle = Math.sin(phase) * 0.045 + Math.sin(phase * 0.37) * 0.02
        const walk = moving ? Math.sin(t * 0.5 + i * 0.6) * 0.03 : 0

        // The index lifts when reaching; the others stay put.
        const lift = i === 0 ? reach.current * 0.34 : reach.current * 0.06

        j.knuckle.rotation.x = -0.12 - grip.current * 0.95 + idle + walk + lift
        // The far joint curls harder than the knuckle — that is what closes a
        // hand round an object rather than folding it flat.
        j.tip.rotation.x = 0.55 + grip.current * 0.75 + idle * 0.6 - lift * 0.5
      }
    }

    for (const thumb of [leftThumb.current, rightThumb.current]) {
      if (!thumb) continue
      // The thumb comes ACROSS the fingers to close the grip, and drifts on its
      // own slower phase when idle.
      thumb.rotation.x = 0.1 + grip.current * 0.55 + Math.sin(t * 0.6) * 0.03
    }
  })

  return (
    <group ref={group} scale={0.95}>
      <OneHand side={-1} gloved={gloved} joints={left} thumbRef={leftThumb} />
      <OneHand side={1} gloved={gloved} joints={right} thumbRef={rightThumb} />
    </group>
  )
}
