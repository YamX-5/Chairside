import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction } from 'three'
import { PatientBillboard } from './PatientBillboard'
import type { PatientProps } from './Patient'
import { useOptionalGLTF } from './useOptionalGLTF'

const BASE = import.meta.env.BASE_URL

/** The treatment chair in ClinicKit sits at world (1.5, 0, 0.7). */
const SEAT: [number, number, number] = [1.5, 0, 0.4]

export type PatientPhase = 'arriving' | 'seated'

/**
 * The patient as a real rigged, animated character when `public/models/
 * patient.glb` exists — otherwise the existing 2D billboard, unchanged.
 *
 * This is Phase 0 Gate B, the actual technical risk in the plan: the room's
 * lighting is baked and static, but the patient moves, so she can read as
 * pasted-on rather than standing in the room. Test this in isolation before
 * committing to asset production.
 *
 * Clips are matched by NAME rather than index because the generator names them
 * after the action (Walk_to_Sit, Chair_Sit_Idle_M/F), and a rig exported with a
 * different clip order would otherwise silently play the wrong animation.
 */
export function Patient3D({
  mood = 'anxious',
  phase = 'seated',
}: PatientProps & { phase?: PatientPhase }) {
  const gltf = useOptionalGLTF(`${BASE}models/patient.glb`)
  const scene = useMemo(() => gltf?.scene.clone(true) ?? null, [gltf])
  const mixer = useMemo(() => (scene ? new AnimationMixer(scene) : null), [scene])
  const current = useRef<AnimationAction | null>(null)

  useEffect(() => {
    if (!mixer || !gltf || gltf.animations.length === 0) return

    const find = (re: RegExp) =>
      gltf.animations.find((c) => re.test(c.name)) ?? null

    const clip =
      phase === 'arriving'
        ? find(/walk.*sit|sit.*transition/i) ?? gltf.animations[0]
        : find(/sit.*idle|idle/i) ?? gltf.animations[0]

    const next = mixer.clipAction(clip)
    // Sitting down happens once and holds; sitting still loops.
    if (phase === 'arriving') {
      next.setLoop(LoopOnce, 1)
      next.clampWhenFinished = true
    } else {
      next.setLoop(LoopRepeat, Infinity)
    }

    next.reset().fadeIn(0.35).play()
    const previous = current.current
    if (previous && previous !== next) previous.fadeOut(0.35)
    current.current = next

    return () => {
      next.fadeOut(0.2)
    }
  }, [mixer, gltf, phase])

  useFrame((_, delta) => {
    mixer?.update(delta)
  })

  useEffect(() => {
    return () => {
      mixer?.stopAllAction()
    }
  }, [mixer])

  if (!scene) return <PatientBillboard mood={mood} />

  return <primitive object={scene} position={SEAT} />
}
