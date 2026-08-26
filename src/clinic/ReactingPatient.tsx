import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group, PerspectiveCamera } from 'three'
import { Patient, type PatientProps } from './Patient'
import { PatientRig } from './PatientRig'
import { DURATION, poseAt, shakeAt, type ReactionPose } from './reaction'
import type { ConsequencePrimitive } from '../ingest/channels'

/**
 * The patient, reacting to what you just did to them.
 *
 * This is the piece that turns a quiz into a game: until a decision produces
 * visible motion, the 3D room is wallpaper behind a multiple-choice question.
 *
 * Two deliberate choices about how it is wired:
 *
 * - Nothing here calls setState per frame. The pose is written straight onto
 *   the object3D and the screen effects onto a DOM node's inline style, so a
 *   reaction costs zero React renders. State-per-frame is the standard way r3f
 *   scenes fall off a cliff on the hardware this has to run on.
 * - The camera shake is applied on TOP of whatever owns the camera, and undone
 *   the next frame, so it composes with first-person look instead of fighting
 *   it. Anything that assigns absolute rotation would stutter against Player.
 */

export interface ReactingPatientProps extends PatientProps {
  /** What to play. null means idle. */
  primitive: ConsequencePrimitive | null
  /** Change this to (re)start the reaction, even for the same primitive. */
  triggerId: number
  /** Overlay node for blood and flash. Styled directly — never re-rendered. */
  fxRef?: RefObject<HTMLDivElement | null>
  onDone?: () => void
  /** 0 = at the doorway, 1 = settled in the chair. Passed through to the rig. */
  arrival?: number
}

export function ReactingPatient({
  primitive,
  triggerId,
  fxRef,
  onDone,
  arrival = 1,
  ...patient
}: ReactingPatientProps) {
  // The wrapper sits at the ORIGIN and applies only the reaction offset.
  //
  // Patient.tsx positions itself in the chair — it is the documented GLB swap
  // point, and that position is part of its contract. Giving this wrapper the
  // same position too stacked the two, putting the patient at double the
  // intended offset: off to the side of the room, half out of frame, apparently
  // floating. Reaction offsets are DELTAS, never absolute placement.
  const position: [number, number, number] = [0, 0, 0]
  const root = useRef<Group>(null)
  const start = useRef<number | null>(null)
  const finished = useRef(false)
  const seed = useRef(1)
  const camShake = useRef({ pitch: 0, yaw: 0, roll: 0 })
  // Handed to the rig so it can drive jaw, arms and head per frame without a
  // React render. A ref rather than state for exactly that reason.
  const livePose = useRef<ReactionPose | null>(null)
  const { camera } = useThree()

  // A new trigger restarts the clock. Varying the seed means the same mistake
  // twice feels the same without looking frame-identical.
  useEffect(() => {
    if (!primitive) return
    start.current = null
    finished.current = false
    seed.current = (triggerId % 97) + 1
  }, [primitive, triggerId])

  useFrame((state, delta) => {
    const cam = camera as PerspectiveCamera

    // Undo last frame's shake first, so it never accumulates and never fights
    // whoever else is writing camera rotation.
    cam.rotation.x -= camShake.current.pitch
    cam.rotation.y -= camShake.current.yaw
    cam.rotation.z -= camShake.current.roll
    camShake.current = { pitch: 0, yaw: 0, roll: 0 }

    const group = root.current
    if (!group) return

    if (!primitive) {
      group.position.set(...position)
      group.rotation.set(0, 0, 0)
      livePose.current = null
      if (fxRef?.current) fxRef.current.style.opacity = '0'
      return
    }

    if (start.current === null) start.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - start.current
    const pose = poseAt(primitive, t, seed.current)
    livePose.current = pose

    // The rig applies offsetY/offsetZ/pitch/roll to its OWN wrapper, so this
    // group must not apply them again — that is the double-transform bug that
    // put the patient at twice her intended offset the first time round.
    group.position.set(...position)
    group.rotation.set(0, 0, 0)

    // Screen effects, written straight to the DOM node.
    if (fxRef?.current) {
      const el = fxRef.current
      const red = pose.blood
      const white = pose.flash
      el.style.opacity = String(Math.max(red, white))
      el.style.background = white > red
        ? `rgba(255,255,255,${white * 0.55})`
        : `radial-gradient(ellipse at 50% 45%, rgba(140,10,10,0) 25%, rgba(150,12,12,${red * 0.9}) 100%)`
    }

    if (pose.trauma > 0) {
      const s = shakeAt(pose.trauma, state.clock.elapsedTime, seed.current)
      cam.rotation.x += s.pitch
      cam.rotation.y += s.yaw
      cam.rotation.z += s.roll
      camShake.current = s
    }

    if (!finished.current && t >= (DURATION[primitive] ?? 1)) {
      finished.current = true
      onDone?.()
    }

    // Keep the frame loop alive while a reaction plays, in case the scene is
    // running on demand.
    if (!finished.current) state.invalidate()
    void delta
  })

  return (
    <group ref={root} position={position}>
      {/* The rig when the model is present; the original primitive figure when
          it is not, so a missing GLB degrades to something rather than a hole. */}
      <PatientRig
        poseRef={livePose}
        mood={patient.mood}
        arrival={arrival}
        fallback={<Patient {...patient} />}
      />
    </group>
  )
}
