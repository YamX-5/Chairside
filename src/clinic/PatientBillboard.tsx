import { useMemo } from 'react'
import { Billboard } from '@react-three/drei'
import { DoubleSide } from 'three'
import { Patient, type PatientProps } from './Patient'
import { useOptionalTexture } from './useOptionalTexture'

/**
 * The patient in the chair, as a 2D sprite billboard when the art exists —
 * otherwise the primitive figure from Patient.tsx.
 *
 * A beautiful generated 2D character on a camera-facing plane, lit by the same
 * scene and grounded by the same shadow, reads far better than a sphere-and-
 * capsule blob and costs a single textured quad on a phone (the Octopath /
 * Paper Mario trick). Drop `public/sprites/patient-<mood>.png` (transparent,
 * front view "as the dentist sees them") and it appears; until then this is
 * exactly the old primitive patient.
 */

const BASE = import.meta.env.BASE_URL

// Aligned to the treatment chair in ClinicKit (world 1.5, 0, 0.7), at seated
// torso height. Keep this in step with Patient3D's SEAT.
const CHAIR_POS: [number, number, number] = [1.5, 0.95, 0.4]
const SPRITE_HEIGHT = 1.5

export function PatientBillboard({ mood = 'anxious' }: PatientProps) {
  const moodSprite = useOptionalTexture(`${BASE}sprites/patient-${mood}.png`, { srgb: true })
  const genericSprite = useOptionalTexture(`${BASE}sprites/patient.png`, { srgb: true })
  const tex = moodSprite ?? genericSprite

  const width = useMemo(() => {
    const img = tex?.image as { width?: number; height?: number } | undefined
    const aspect = img?.width && img?.height ? img.width / img.height : 0.7
    return SPRITE_HEIGHT * aspect
  }, [tex])

  // No art yet → keep the primitive patient exactly as before.
  if (!tex) return <Patient mood={mood} />

  return (
    <Billboard position={CHAIR_POS} follow lockX lockZ>
      <mesh>
        <planeGeometry args={[width, SPRITE_HEIGHT]} />
        {/* basic + toneMapped=false so the character keeps its own painted
            lighting; alphaTest cuts the transparent border cleanly. */}
        <meshBasicMaterial
          map={tex}
          transparent
          alphaTest={0.5}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  )
}
