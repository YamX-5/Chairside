import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AnimationMixer,
  Euler,
  Group,
  LoopOnce,
  Object3D,
  Quaternion,
  Vector3,
  type AnimationAction,
} from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { useOptionalGLTF } from './useOptionalGLTF'
import { applyBakedLighting } from './bakedMaterial'
import { findParts, type RigParts } from './patientBones'
import { CHAIR_FACING, DOORWAY, DOORWAY_ENTRY_Z, SEAT_WORLD } from './layout'
import { CAST_FACING_OFFSET, CLIPS, DEFAULT_PATIENT_ID, castScale, lookFor } from './cast3d'
import type { ReactionPose } from './reaction'

/**
 * The patient: a CC0 Quaternius character, animated by clip AND by code.
 *
 * The model is one of eight outfits over a shared 42-bone skeleton, carrying
 * four clips — Idle, Walk, Sitting, Standing. See cast3d.ts for which patient
 * wears which, how tall each stands, and what the clips actually contain.
 *
 * IT REPLACED A MIXAMO CHARACTER, for two reasons. The look: a realistically
 * proportioned human decimated to 7k triangles reads as a damaged human, not a
 * stylised one, and the rest of this room is deliberately cartoon. And the
 * licence: Mixamo's terms run through an Adobe account, where CC0 is public
 * domain outright — no attribution, no share-alike, nothing to resolve before
 * release.
 *
 * TWO LAYERS, AND THE ORDER BETWEEN THEM IS THE WHOLE TRICK
 * ---------------------------------------------------------
 * The mixer OVERWRITES every bone it has a track for, every frame. So the
 * procedural layer cannot write absolute rotations against a stored rest pose
 * the way the old box-person rig did — the mixer would simply overwrite them,
 * or they would overwrite the clip, depending on who ran last.
 *
 * Instead the procedural layer runs immediately AFTER `mixer.update()` in the
 * same callback, and ADDS to whatever the clip produced. Breathing, blinking,
 * head life and reactions then compose on top of the animation instead of
 * fighting it. That is also why the mixer is driven by hand rather than through
 * drei's useAnimations: this component needs to own the ordering, and splitting
 * it across two useFrame callbacks would put it at the mercy of priority
 * numbers — which in r3f also decide who owns the render loop.
 */

export interface PatientRigProps {
  /**
   * Live reaction pose, as a REF rather than a prop value.
   *
   * The pose changes every frame. Passing it as a value would re-render this
   * component 60 times a second and drag the whole React tree with it; a ref is
   * read inside useFrame and costs nothing.
   */
  poseRef: RefObject<ReactionPose | null>
  /** Drives resting breath rate and tension. */
  mood?: 'calm' | 'anxious' | 'in-pain'
  /** Rendered when the model is missing, so the scene never has a hole in it. */
  fallback?: ReactNode
  /**
   * Which patient is in the chair — chooses the body, the outfit and the height.
   *
   * An id rather than a filename, so the clinic never has to know what a
   * Quaternius file is called and cast3d.ts stays the only place that mapping
   * lives.
   */
  patientId?: string
  /**
   * 0 = at the doorway, 1 = settled in the chair. Anything between walks her in.
   *
   * A patient who blinks into the chair the instant you finish studying breaks
   * the room; one who walks in is the beat that makes the clinic feel like it
   * opened.
   */
  arrival?: number
}

const BASE = import.meta.env.BASE_URL

/**
 * Where she sits — IMPORTED from the chair, never typed here.
 *
 * Two builds went wrong because these numbers lived in two files: she rendered
 * on the floor beside the chair, then wedged sideways across its arms. Her seat
 * is a property of the chair, so the chair owns it.
 */
const SEAT = SEAT_WORLD
const FACING = CHAIR_FACING

/**
 * Where she is actually anchored: the FLOOR under the seat, not the cushion.
 *
 * She plants her own feet — measured at 0.054 file units in every clip, sitting
 * included — so the model belongs at floor level and the sit puts her pelvis on
 * the cushion by itself. See SEATED_PELVIS_UNITS in cast3d.ts.
 */
const FLOOR_UNDER_SEAT: [number, number, number] = [SEAT[0], 0, SEAT[2]]

/** Reused across frames — see the head block in the frame loop. */
const HEAD_TILT = new Euler(0, 0, 0, 'YXZ')
const HEAD_Q = new Quaternion()

/**
 * The doorway, expressed in the rotated frame she sits in.
 *
 * Her group is turned by FACING, so its local axes are turned too. Handing it a
 * raw world-space delta would walk her in from a direction ninety degrees off.
 * Rotating the delta by -FACING converts world into local, once, at module load.
 */
const DOOR_LOCAL = new Vector3(
  DOORWAY.x - SEAT[0],
  0,
  // The opening in the wall, not the spot you stand at to use the door. Those
  // are 0.9 m apart, and starting her at the standing spot popped her into
  // existence on open floor. From the aperture the wall occludes her first
  // stride, which is what makes it read as walking IN.
  DOORWAY_ENTRY_Z - SEAT[2],
).applyAxisAngle(new Vector3(0, 1, 0), -FACING)

/** Below this she is still crossing the room; above it she is sitting down. */
const SIT_STARTS_AT = 0.8

export function PatientRig({
  poseRef,
  mood = 'anxious',
  fallback = null,
  arrival = 1,
  patientId = DEFAULT_PATIENT_ID,
}: PatientRigProps) {
  const look = lookFor(patientId)
  const gltf = useOptionalGLTF(`${BASE}models/cast/${look.model}.glb`)
  const scale = castScale(look)

  // SkeletonUtils.clone, NOT Object3D.clone.
  //
  // A plain clone copies the SkinnedMesh objects but leaves them pointing at the
  // ORIGINAL skeleton's bones, so two patients on screen share one pose and a
  // single one can collapse into a heap the moment the mixer touches it. This is
  // the documented way to duplicate a skinned hierarchy.
  const scene = useMemo(
    () => (gltf ? (SkeletonUtils.clone(gltf.scene) as Object3D) : null),
    [gltf],
  )

  const parts = useRef<RigParts>({})
  const blink = useRef({ next: 2, closing: 0, restZ: 1 })
  const group = useRef<Group>(null)
  /** Carries her from the doorway to the chair; separate from the pose group. */
  const walkIn = useRef<Group>(null)
  const mixer = useRef<AnimationMixer | null>(null)
  const actions = useRef<Record<string, AnimationAction>>({})
  const current = useRef<string>('')
  const hipsRest = useRef<Vector3 | null>(null)
  // Read inside useFrame rather than closed over, so changing arrival does not
  // need to re-register the frame callback.
  const arrivalRef = useRef(arrival)
  arrivalRef.current = arrival

  useEffect(() => {
    if (!scene || !gltf) return
    parts.current = findParts(scene)

    // moves: she walks in, turns and sits, so she carries baked OCCLUSION
    // only and takes her directional light live. See bakedMaterial.ts.
    applyBakedLighting(scene, { moves: true })

    blink.current.restZ = parts.current.eyes?.scale.z ?? 1
    const hips = parts.current.hips
    hipsRest.current = hips ? hips.position.clone() : null

    const m = new AnimationMixer(scene)
    mixer.current = m
    actions.current = {}
    for (const clip of gltf.animations ?? []) {
      const action = m.clipAction(clip)
      if (clip.name === CLIPS.sit || clip.name === CLIPS.stand) {
        // SIT AND STAND ARE TRANSITIONS, NOT LOOPS — measured, not assumed; see
        // the table in cast3d.ts. Left on the default LoopRepeat, Sitting would
        // stand her back up and drop her into the chair again every 8.4 seconds,
        // forever, while the student is working in her mouth.
        //
        // clampWhenFinished holds the last frame, which for Sitting is the
        // seated pose. The pack ships no seated idle at all, so that held pose IS
        // the seated idle — and the breathing and head life below are added on
        // top of it, which is the whole reason this rig has two layers.
        action.setLoop(LoopOnce, 1)
        action.clampWhenFinished = true
      }
      actions.current[clip.name] = action
    }
    current.current = ''

    return () => {
      m.stopAllAction()
      m.uncacheRoot(scene)
      mixer.current = null
    }
  }, [scene, gltf])

  useFrame((state, delta) => {
    const p = parts.current
    const m = mixer.current
    const t = state.clock.elapsedTime
    const pose = poseRef.current
    const a = arrivalRef.current

    // --- 1. pick the clip -------------------------------------------------
    // Two clips, not three: Sitting already ends in the seated pose and holds
    // it, so there is nothing for a separate seated-idle clip to do.
    const want = a >= SIT_STARTS_AT ? CLIPS.sit : CLIPS.walk
    if (m && current.current !== want && actions.current[want]) {
      const next = actions.current[want]
      const prev = current.current ? actions.current[current.current] : null
      next.reset().play()
      if (prev) {
        // Crossfade rather than cut. A hard swap between two clips is the most
        // obviously game-engine thing a character can do.
        next.crossFadeFrom(prev, 0.25, false)
      }
      current.current = want
    }

    // --- 2. the mixer writes every bone it owns ---------------------------
    if (m) m.update(delta)

    // STRIP THE HIPS TRANSLATION ENTIRELY, on every clip.
    //
    // Every clip in this asset carries travel in its hips position track, and
    // not in a frame that is consistent between them — measured with
    // scripts/probe_patient.mts, Walking puts 170 units into y, StandToSit -48,
    // SittingIdle 45 into z, and sitting reads HIGHER than standing on all three
    // axes. There is no axis that means "up" across the set.
    //
    // This used to strip x and z and deliberately keep y "for the bob of the
    // walk", which kept the one component carrying the 170-unit travel. It never
    // showed, because the bone was never found to strip in the first place —
    // findParts looked up "mixamorig:Hips" and three had renamed it
    // "mixamorigHips". So the raw track ran untouched and drove her through the
    // floor.
    //
    // Where she is standing is the walkIn group's job. The clips are kept for
    // their bone ROTATIONS, which are what actually read as walking and sitting.
    if (p.hips && hipsRest.current) p.hips.position.copy(hipsRest.current)

    // --- 3. procedural layer, ADDED on top of the clip --------------------
    // Everything below is `+=`, never `=`. The mixer has already written this
    // frame's pose; these are offsets from it.

    // Breathing. Faster and shallower when she is in pain. This alone is most
    // of what separates "a model" from "a person sitting there".
    const rate = mood === 'in-pain' ? 2.5 : mood === 'anxious' ? 1.75 : 1.15
    const depth = mood === 'in-pain' ? 0.010 : 0.016
    const breath = Math.sin(t * rate) * depth
    if (p.chest) p.chest.rotation.x -= breath

    // Blinking. Randomised interval, not a metronome — a regular blink reads as
    // a machine. Squashes the bone-parented eye plate, which the mixer never
    // touches, so this needs no ordering care at all.
    blink.current.next -= delta
    if (blink.current.next <= 0) {
      blink.current.closing = 0.14
      // Anxious people blink more, which is free characterisation.
      blink.current.next = (mood === 'calm' ? 4.5 : 2.6) + ((t * 37) % 2.4)
    }
    if (p.eyes) {
      if (blink.current.closing > 0) {
        blink.current.closing = Math.max(0, blink.current.closing - delta)
        const k = 1 - Math.abs(blink.current.closing / 0.14 - 0.5) * 2 // 0→1→0
        p.eyes.scale.z = blink.current.restZ * (1 - k * 0.92)
      } else {
        p.eyes.scale.z = blink.current.restZ
      }
    }

    // Head life: two slow sines at different frequencies never visibly repeat,
    // which is the cheapest trick there is for "alive".
    const brace = pose?.brace ?? 0
    const idleYaw = Math.sin(t * 0.31) * 0.05 + Math.sin(t * 0.13) * 0.03
    const idlePitch = Math.sin(t * 0.23) * 0.025

    if (p.head) {
      // MULTIPLY A QUATERNION, do not add to Euler angles.
      //
      // `rotation.x +=` decomposes whatever the mixer just wrote into XYZ Euler
      // and adds to one component. That is fine when the base pose is near
      // identity and wrong when it is not — and the seated pose rotates the head
      // substantially, so the added pitch and yaw came out about the wrong axes
      // and compounded. On screen that is a head lolling off at an angle no neck
      // makes: "sometimes you see he has a broken neck".
      //
      // Composing in the bone's OWN frame is correct for any base pose, and it
      // is also what "nod" and "turn your head" actually mean.
      HEAD_TILT.set(
        idlePitch + (pose?.pitch ?? 0) * 0.55,
        idleYaw * (1 - brace),
        0,
        'YXZ',
      )
      HEAD_Q.setFromEuler(HEAD_TILT)
      p.head.quaternion.multiply(HEAD_Q)
    }

    // Bracing: arms pull in and grip.
    if (p.upperArmL) p.upperArmL.rotation.x -= brace * 0.42
    if (p.upperArmR) p.upperArmR.rotation.x -= brace * 0.42
    if (p.forearmL) p.forearmL.rotation.x -= brace * 0.5
    if (p.forearmR) p.forearmR.rotation.x -= brace * 0.5

    // Whole-body displacement from the reaction, applied to the wrapper so it
    // composes with everything above instead of overwriting it.
    const g = group.current
    if (g) {
      g.position.set(0, pose?.offsetY ?? 0, pose?.offsetZ ?? 0)
      g.rotation.set((pose?.pitch ?? 0) * 0.45, 0, pose?.roll ?? 0)
    }

    // --- 4. crossing the room ----------------------------------------------
    const walk = walkIn.current
    if (!walk) return
    if (a < 1) {
      // Ease-out: she slows as she reaches the chair rather than stopping dead.
      const e = 1 - (1 - a) * (1 - a)
      // DOOR_LOCAL is the doorway expressed in this group's own rotated frame —
      // the parent is turned to face the chair, so a raw world delta would send
      // her walking in from ninety degrees off.
      // Height, not just the floor plan. Her group is anchored at SEAT_WORLD,
      // which is 0.37 m up — the cushion. Her model's origin is at her FEET
      // (measured: the rest bbox spans y -0.001 .. 1.770), so holding her there
      // while she crosses the room walks her through the air. Drop her to the
      // floor for the walk and lift her onto the cushion as she sits.
      // NO VERTICAL RAMP ANY MORE. This used to lift her from the floor onto
      // the cushion as she sat, which was right for the Mixamo clip — its sit
      // was authored around the model's origin. The Quaternius sit is a REAL
      // sit: measured in Blender, the pelvis drops from 1.959 to 1.102 file
      // units while the feet stay planted at 0.054. Lifting him as well put his
      // feet at cushion height and his pelvis 0.40 m above that, hovering over
      // the chair with his legs sticking out — "he is standing up in the chair".
      // He plants his own feet in every clip, so he belongs on the floor in all
      // of them.
      walk.position.set(DOOR_LOCAL.x * (1 - e), 0, DOOR_LOCAL.z * (1 - e))
      // She turns to face the chair as she arrives, rather than gliding in
      // already-oriented like a chess piece.
      walk.rotation.y = (1 - e) * -0.9
    } else {
      walk.position.set(0, 0, 0)
      walk.rotation.y = 0
    }
  })

  if (!scene) return <>{fallback}</>

  // Outer group PLACES her in the chair; the inner group carries the reaction
  // offsets. Keeping them separate means a recoil rotates around her own body
  // rather than swinging her around the centre of the room.
  return (
    <group position={FLOOR_UNDER_SEAT} rotation={[0, FACING + CAST_FACING_OFFSET, 0]}>
      <group ref={walkIn}>
        <group ref={group}>
          {/* SCALE INNERMOST, deliberately.
              Quaternius authored these at ~4.6 glTF units, not metres, so
              unscaled she stands three times the height of the room. The
              walk-in group above translates in real metres — the doorway, the
              cushion height — so putting the scale outside it would multiply
              those distances by 0.37 and she would walk in from inside the
              dental chair. */}
          <group scale={scale}>
            <primitive object={scene} />
          </group>
        </group>
      </group>
    </group>
  )
}
