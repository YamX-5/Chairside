import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bone, Group, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { C } from './theme3d'
import { boneSide, parseFingerBone } from './fingerBones'
import { useOptionalGLTF } from './useOptionalGLTF'
import { moveInput } from './input'

/**
 * First-person hands in medical nitrile gloves — a rigged model, not primitives.
 *
 * THE FINGERS MOVE, and that is most of the work here. A pair of rigid hands
 * pinned to the camera reads as a prop glued to the lens; what makes them read
 * as YOUR hands is that the fingers are never quite still and never quite in
 * unison. Each finger runs its own phase offset, so the idle is a slow uneven
 * ripple rather than four sticks moving as one.
 *
 * Three poses, blended continuously:
 *   open   — walking around, fingers relaxed
 *   grip   — something is in your hand, so they curl round it
 *   reach  — standing at something you can take; the index lifts, the way a
 *            hand does a moment before it takes hold of something
 *
 * GLOVES ON AND OFF are a real state, not a tint. Gloved is nitrile blue with
 * the rolled cuff shown; bare is skin with the cuff hidden. The cuff ships as
 * its own object in the glb (scripts/bl_hands_glove.py builds it) precisely so
 * this is a visibility flag rather than a second model. It has to hold up close:
 * in multiplayer other players can see whether you gloved up.
 *
 * ONE HAND OR TWO is detected, not assumed. Most hand assets ship a single hand
 * meant to be mirrored; some ship a pair. Mirroring a pair would give you four
 * hands, so boneSide decides. The mirrored copy sits under a group scaled -1 on
 * X rather than being scaled itself, so the placement mirrors with it and the
 * two hands are guaranteed symmetric. three.js flips winding order for a
 * negative-determinant matrix on its own, so the mirrored hand lights correctly.
 */

const BASE = import.meta.env.BASE_URL

/**
 * Which way a knuckle bends, in the bone's own space.
 *
 * MEASURED, NOT ASSUMED. scripts/bl_hands_glove.py poses the fingers about each
 * axis in turn and keeps whichever actually folds the fingertips toward the
 * wrist, then prints the answer. Assuming an axis is how the cabinet doors ended
 * up swinging through a wall.
 */
const CURL_AXIS = new Vector3(0, 0, -1)

/**
 * Adult hand length, wrist to the tip of the middle finger. 50th-percentile male
 * is 189 mm and female 172 mm; 185 mm reads as an adult without being either.
 */
const HAND_LENGTH = 0.185

/** Where one hand sits relative to the camera, and how it is turned. */
const HAND_POSITION: [number, number, number] = [0.13, -0.17, -0.3]
const HAND_ROTATION: [number, number, number] = [-1.15, 0.12, 0]

/**
 * Measure the loaded hand and scale it to a real one, rather than trusting the
 * file to arrive at the right size.
 *
 * The Blender build sizes the model correctly and still exports it wrong: the
 * skinned mesh is not parented to the armature, so the glTF exporter drops the
 * armature's object scale from the joint nodes and warns about it. Blender said
 * 185 mm, the glb measured 72 mm.
 *
 * Normalising here rather than chasing the exporter means the game is correct
 * for whatever the file happens to contain, and swapping the hand asset needs no
 * re-tuning. Measured off the BONES, so it does not depend on the pose the
 * artist saved — a curled hand has a smaller bounding box than the same hand at
 * rest, which is exactly how the 299 mm version got shipped.
 */
function measureHand(root: Object3D): number | null {
  // <primitive> transforms only fold into matrixWorld during render, so nothing
  // below is meaningful until the matrices are current.
  root.updateWorldMatrix(true, true)

  let wrist: Object3D | null = null
  let distal: Object3D | null = null
  let tip: Object3D | null = null
  root.traverse((o) => {
    if (!(o as Bone).isBone) return
    if (!wrist && /^(hand|wrist)/i.test(o.name)) wrist = o
    if (o.name.startsWith('f_middle.03') || /middlefinger?3/i.test(o.name)) {
      // The distal bone's origin is the base of the last segment; its "_end"
      // child is the actual fingertip, and skipping it loses ~25 mm.
      if (o.name.includes('_end')) tip = o
      else distal = o
    }
  })
  const far = tip ?? distal
  if (!wrist || !far) return null

  const a = new Vector3()
  const b = new Vector3()
  ;(wrist as Object3D).getWorldPosition(a)
  ;(far as Object3D).getWorldPosition(b)
  const d = a.distanceTo(b)
  return d > 1e-6 ? d : null
}

/**
 * How far each joint of a finger closes when you grip, as a fraction of a full
 * fist. The knuckle leads and the tip follows — a hand that bends all three
 * equally looks like a claw.
 */
const CURL: Record<number, number> = { 1: 0.52, 2: 0.72, 3: 0.58 }

/** The thumb closes across the palm, not into it, so it curls less. */
const THUMB_SCALE = 0.45

interface Joint {
  bone: Bone
  rest: Quaternion
  /** 0 index … 3 pinky, 4 thumb — drives the per-finger phase offset. */
  finger: number
  /** How much of a full fist this joint contributes. */
  curl: number
}

function collectJoints(root: Object3D): Joint[] {
  const joints: Joint[] = []
  root.traverse((o) => {
    if (!(o as Bone).isBone) return
    const parsed = parseFingerBone(o.name)
    if (!parsed) return
    const curl = CURL[parsed.segment]
    if (curl === undefined) return
    joints.push({
      bone: o as Bone,
      rest: o.quaternion.clone(),
      finger: parsed.finger,
      curl: parsed.finger === 4 ? curl * THUMB_SCALE : curl,
    })
  })
  return joints
}

/** True when the asset already contains both hands and must not be mirrored. */
function isPair(root: Object3D): boolean {
  const sides = new Set<string>()
  root.traverse((o) => {
    if (!(o as Bone).isBone || !parseFingerBone(o.name)) return
    const side = boneSide(o.name)
    if (side) sides.add(side)
  })
  return sides.size > 1
}

/** The rolled bead at the wrist, built as its own object by the Blender script. */
const isCuff = (o: Object3D) => o.name.toLowerCase().startsWith('cuff')

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
  const gltf = useOptionalGLTF(`${BASE}models/hands.glb`)

  // SkeletonUtils.clone, NOT Object3D.clone — a plain clone copies the
  // SkinnedMesh but leaves it pointing at the original skeleton's bones, so the
  // model collapses the moment anything poses it. Same reason as PatientRig.
  const rig = useMemo(() => {
    if (!gltf) return null
    const first = SkeletonUtils.clone(gltf.scene) as Object3D
    const pair = isPair(first)
    const measured = measureHand(first)
    return {
      first,
      // A second, independently skinned copy for the other hand. Cloning the
      // first would share its skeleton and both hands would pose as one.
      second: pair ? null : (SkeletonUtils.clone(gltf.scene) as Object3D),
      /** Whatever the file shipped at, scaled to a real hand. */
      scale: measured ? HAND_LENGTH / measured : 1,
      measured,
    }
  }, [gltf])

  useEffect(() => {
    if (!rig) return
    if (rig.measured === null) {
      console.warn('[Hands] could not measure the hand; shipping it unscaled')
    }
  }, [rig])

  const joints = useMemo(() => {
    if (!rig) return []
    return [
      ...collectJoints(rig.first),
      ...(rig.second ? collectJoints(rig.second) : []),
    ]
  }, [rig])

  // Gloved or bare, decided here rather than trusting whatever the asset shipped
  // with, so both states are guaranteed to look right.
  useEffect(() => {
    if (!rig) return
    const skin = new MeshStandardMaterial({
      color: C.skin,
      roughness: 0.75,
      envMapIntensity: 0.6,
    })
    // Nitrile is a semi-matte rubber: no metalness, and rough enough that the
    // highlight is a soft band rather than a plastic glint.
    const nitrile = new MeshStandardMaterial({
      color: C.glove,
      roughness: 0.42,
      metalness: 0,
      envMapIntensity: 0.8,
    })
    const cuffMat = new MeshStandardMaterial({
      color: C.gloveCuff,
      roughness: 0.48,
      metalness: 0,
      envMapIntensity: 0.7,
    })

    for (const root of [rig.first, rig.second]) {
      root?.traverse((o) => {
        const mesh = o as Mesh
        if (!mesh.isMesh) return
        if (isCuff(mesh)) {
          // The cuff exists only when you are gloved.
          mesh.visible = gloved
          mesh.material = cuffMat
        } else {
          mesh.material = gloved ? nitrile : skin
        }
        // They ride the camera and are never occluded by the room.
        mesh.frustumCulled = false
        mesh.castShadow = false
      })
    }

    // Toggling gloves must not leak a material per toggle.
    return () => {
      skin.dispose()
      nitrile.dispose()
      cuffMat.dispose()
    }
  }, [rig, gloved])

  const group = useRef<Group>(null)
  const bob = useRef(0)
  const grip = useRef(0)
  const reach = useRef(0)

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return

    const moving = Math.abs(moveInput.x) + Math.abs(moveInput.z) > 0.05
    bob.current += delta * (moving ? 9 : 1.6)
    const amp = moving ? 0.02 : 0.006

    // --- the hands as a whole, riding the camera --------------------------
    g.position.copy(state.camera.position)
    g.quaternion.copy(state.camera.quaternion)
    g.translateY(-0.30 + Math.sin(bob.current) * amp)
    g.translateZ(-0.30)
    g.rotateZ(Math.sin(bob.current * 0.5) * (moving ? 0.03 : 0.01))

    // --- pose blending -----------------------------------------------------
    // Eased, never snapped: a hand that closes instantly reads as a glitch, and
    // ~150 ms is about how long a real one takes.
    const k = 1 - Math.exp(-delta * 11)
    grip.current += ((holding ? 1 : 0) - grip.current) * k
    reach.current += ((reaching && !holding ? 1 : 0) - reach.current) * k

    const t = bob.current
    for (const j of joints) {
      // Each finger on its own phase, so the idle is an uneven ripple rather
      // than four sticks in lockstep. That difference is most of what makes a
      // hand look alive.
      const phase = t * 0.9 + j.finger * 0.8
      const idle = Math.sin(phase) * 0.05 + Math.sin(phase * 0.37) * 0.025
      const walk = moving ? Math.sin(t * 0.5 + j.finger * 0.6) * 0.035 : 0
      // The index lifts when reaching; the others barely move.
      const lift = j.finger === 0 ? reach.current * 0.5 : reach.current * 0.08

      const close = grip.current * j.curl * 1.5 + (idle + walk) * j.curl - lift * j.curl
      j.bone.quaternion.copy(j.rest)
      j.bone.rotateOnAxis(CURL_AXIS, close)
    }
  })

  if (!rig) return null
  return (
    <group ref={group}>
      <primitive
        object={rig.first}
        position={HAND_POSITION}
        rotation={HAND_ROTATION}
        scale={rig.scale}
      />
      {rig.second && (
        // Mirrored as a whole, so the placement mirrors too and the pair cannot
        // drift out of symmetry.
        <group scale={[-1, 1, 1]}>
          <primitive
            object={rig.second}
            position={HAND_POSITION}
            rotation={HAND_ROTATION}
            scale={rig.scale}
          />
        </group>
      )}
    </group>
  )
}
