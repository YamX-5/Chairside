import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { C } from './theme3d'
import { CURL_AXIS, REST_CURL, collectJoints, isCuff, isPair, placeHand } from './handsRig'
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
 * meant to be mirrored; some ship a pair. Mirroring a pair would give four
 * hands. The mirrored copy sits under a group scaled -1 on X rather than being
 * scaled itself, so the placement mirrors with it and the two stay symmetric.
 * three.js flips winding order for a negative-determinant matrix on its own, so
 * the mirrored hand lights correctly.
 *
 * PLACEMENT IS ABOUT THE WRIST, and the offset from the rig's root to its wrist
 * is read from the model rather than typed. This asset's root sits 152 mm from
 * its own wrist, so an earlier version that positioned the ROOT at x = 0.13 put
 * the wrist at 0.52 — the two hands a full metre apart, outside the frustum.
 */

const BASE = import.meta.env.BASE_URL

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
    return {
      first,
      // A second, independently skinned copy for the other hand. Cloning the
      // first would share its skeleton and both hands would pose as one.
      second: pair ? null : (SkeletonUtils.clone(gltf.scene) as Object3D),
      // Scale, aim and position, all read off the model — see placeHand.
      ...placeHand(first),
    }
  }, [gltf])

  const joints = useMemo(() => {
    if (!rig) return []
    return [
      ...collectJoints(rig.first),
      ...(rig.second ? collectJoints(rig.second) : []),
    ]
  }, [rig])

  useEffect(() => {
    if (rig && rig.measured === null) {
      // Not fatal, but the hands will be whatever size the file happened to be.
      console.warn('[Hands] no wrist or fingertip found; shipping unscaled')
    }
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

    // The group rides the camera exactly. Everything about where the hands sit
    // lives in WRIST_TARGET, so there is one place to change it — an earlier
    // version also translated the group and the two offsets silently summed.
    g.position.copy(state.camera.position)
    g.quaternion.copy(state.camera.quaternion)
    g.translateY(Math.sin(bob.current) * amp)
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

      const close =
        (REST_CURL + grip.current * 1.5) * j.curl + (idle + walk) * j.curl - lift * j.curl
      j.bone.quaternion.copy(j.rest)
      j.bone.rotateOnAxis(CURL_AXIS, close)
    }
  })

  if (!rig) return null
  return (
    <group ref={group}>
      <primitive
        object={rig.first}
        position={rig.position}
        quaternion={rig.quaternion}
        scale={rig.scale}
      />
      {rig.second && (
        // Mirrored as a whole, so the placement mirrors too and the pair cannot
        // drift out of symmetry.
        <group scale={[-1, 1, 1]}>
          <primitive
            object={rig.second}
            position={rig.position}
            quaternion={rig.quaternion}
            scale={rig.scale}
          />
        </group>
      )}
    </group>
  )
}
