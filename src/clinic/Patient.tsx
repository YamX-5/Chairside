import { memo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { C } from './theme3d'

/**
 * Placeholder patient — a seated low-poly figure in the dental chair.
 *
 * SWAP POINT: this is the one component to replace when the Higgsfield
 * character GLBs exist. `multi_image_to_3d` with the 4-view turnaround from
 * CHARACTER_SHEETS.md returns a rigged GLB; render it here with
 * `<primitive object={useGLTF(url).scene} />` at the same position and the rest
 * of the room, collision and interaction code is untouched.
 */

export interface PatientProps {
  /** Dominant garment colour — the per-patient token from CHARACTER_SHEETS.md. */
  color?: number
  /** Telegraphs the case before the student opens it. */
  mood?: 'calm' | 'anxious' | 'in-pain'
}

export const Patient = memo(function Patient({
  color = 0xe7b7b0,
  mood = 'anxious',
}: PatientProps) {
  const root = useRef<Group>(null)

  // Idle breathing. Mutating the ref keeps React out of the render loop.
  useFrame((state) => {
    if (!root.current) return
    const t = state.clock.elapsedTime
    const rate = mood === 'in-pain' ? 2.4 : mood === 'anxious' ? 1.7 : 1.1
    root.current.position.y = Math.sin(t * rate) * 0.012
  })

  // In pain leans into the hand at the jaw; calm sits back.
  const headTilt = mood === 'in-pain' ? 0.22 : mood === 'anxious' ? 0.1 : 0.0

  return (
    <group ref={root} position={[1.6, 0, -0.2]}>
      {/* thighs along the seat */}
      <mesh position={[0, 0.78, 0.25]} rotation-x={0.08}>
        <boxGeometry args={[0.42, 0.2, 0.85]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* lower legs hanging toward the foot of the chair */}
      <mesh position={[0, 0.6, 0.78]} rotation-x={0.9}>
        <boxGeometry args={[0.38, 0.18, 0.5]} />
        <meshStandardMaterial color={0x33405c} roughness={0.85} />
      </mesh>
      {/* torso, reclined with the backrest */}
      <mesh position={[0, 1.02, -0.42]} rotation-x={0.45}>
        <capsuleGeometry args={[0.24, 0.5, 4, 10]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* arms resting at the sides */}
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={i} position={[x, 0.95, -0.3]} rotation-x={0.4}>
          <capsuleGeometry args={[0.075, 0.5, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ))}
      {/* head on the headrest */}
      <mesh position={[0, 1.32, -0.86]} rotation-x={0.45 + headTilt}>
        <sphereGeometry args={[0.19, 12, 10]} />
        <meshStandardMaterial color={C.skin} roughness={0.9} />
      </mesh>
      {/* hair cap */}
      <mesh position={[0, 1.4, -0.92]} rotation-x={0.45 + headTilt}>
        <sphereGeometry args={[0.196, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={0x2b2119} roughness={0.95} />
      </mesh>
      {/* a hand at the jaw when the tooth is the problem */}
      {mood === 'in-pain' && (
        <mesh position={[0.19, 1.24, -0.72]}>
          <sphereGeometry args={[0.085, 8, 6]} />
          <meshStandardMaterial color={C.skin} roughness={0.9} />
        </mesh>
      )}
    </group>
  )
})
