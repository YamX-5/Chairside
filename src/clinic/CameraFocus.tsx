import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Euler, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { DURATIONS, advance, slip } from './motion'

/**
 * Leans the camera in to look at something, and puts it back afterwards.
 *
 * This exists so in-world screens stay in the world. The alternative — floating
 * a panel in front of the player — is a browser window wearing a 3D costume,
 * and it was the note that came back as "why the heck a floating window, not a
 * laptop".
 *
 * It saves the camera's own transform on entry and restores it on exit, so the
 * player is returned to exactly where they were standing and looking. Player
 * movement is paused while focused, so nothing else is writing the camera and
 * the two cannot fight.
 */

export interface FocusTarget {
  /** Where the camera goes. */
  position: [number, number, number]
  /** What it looks at. */
  lookAt: [number, number, number]
  /** Narrower FOV reads as leaning in rather than teleporting. */
  fov?: number
  /**
   * Keep the player's normal FOV and let them look around freely.
   *
   * Sitting is not the same gesture as leaning in to read a screen: you move to
   * the seat, but you still own your head. Focus targets with `free` set only
   * move the camera into place and then release rotation.
   */
  free?: boolean
}

const saved = {
  pos: new Vector3(),
  quat: new Quaternion(),
  fov: 72,
  valid: false,
}

const targetPos = new Vector3()
const targetQuat = new Quaternion()
const lookTarget = new Vector3()
const up = new Vector3(0, 1, 0)
const tmpEuler = new Euler()

/**
 * Move the remembered standing spot, without disturbing anything else about it.
 *
 * Exit restores `saved.pos`, which is where the player stood when they sat down.
 * That is right for a fixed chair and wrong for one on castors: roll the stool
 * two metres up the chairside, stand up, and you would be snapped back to where
 * the stool used to be — through the dental unit on the way.
 *
 * Player calls this every frame it rolls. Only x and z move; y stays at standing
 * eye height, which is exactly what standing up should restore.
 */
export function moveFocusOrigin(x: number, z: number): void {
  if (!saved.valid) return
  saved.pos.x = x
  saved.pos.z = z
}

export function CameraFocus({ target }: { target: FocusTarget | null }) {
  const k = useRef(0)
  /** Has a `free` target finished landing? See the snap in the free branch. */
  const settled = useRef(false)

  useFrame((state, delta) => {
    const cam = state.camera as PerspectiveCamera

    if (target && !saved.valid) {
      // Entering: remember exactly where the player was standing and looking.
      saved.pos.copy(cam.position)
      saved.quat.copy(cam.quaternion)
      saved.fov = cam.fov
      saved.valid = true
      settled.current = false
    }
    if (!target) settled.current = false

    const want = target ? 1 : 0
    // Nothing to do once fully settled at either end.
    //
    // A `free` target must also have LANDED. Without that clause this returns as
    // soon as k is within 0.001 of 1, which for the seated path can happen on
    // the very frame that skipped the rotation write — freezing the camera
    // mid-slerp, permanently, because nothing else ever writes roll back.
    if (
      Math.abs(k.current - want) < 0.001 &&
      (want === 1 || !saved.valid) &&
      (!target?.free || settled.current)
    ) {
      k.current = want
      return
    }
    // Clamp the frame delta, exactly as Player.tsx does.
    //
    // A backgrounded tab, a GC pause or a shader compile returns one enormous
    // delta. Unclamped, `delta * 4.5` saturates at 1 for anything over 222 ms,
    // so k leaps straight from wherever it was to 1.0 in a single step and the
    // whole easing is skipped. Slerping between two individually level
    // orientations passes through significant ROLL on the way, so being
    // abandoned partway through is what tilts the entire view.
    // Real time, not a per-frame factor: a 120 Hz phone and a 30 Hz one must
    // take the same wall-clock time to sit down. Sitting is slower than standing
    // — you lower yourself into a chair and you get out of it.
    k.current = advance(k.current, want, delta, want === 1 ? DURATIONS.sit : DURATIONS.stand)

    // SLIP, both ways, and never leap: this curve drives the CAMERA. Overshoot
    // on a viewpoint is what makes people motion-sick, so the springiness that
    // suits a drawer is exactly wrong here. Fast away from where you were, then
    // a long glide into the seat — weight without a bounce.
    const eased = slip(k.current)

    if (target) {
      targetPos.set(...target.position)
      lookTarget.set(...target.lookAt)
      // Build the look rotation without touching the camera, so the slerp below
      // is between two known states rather than an accumulating lookAt.
      tmpEuler.setFromQuaternion(
        targetQuat.setFromRotationMatrix(
          state.camera.matrixWorld.clone().lookAt(targetPos, lookTarget, up),
        ),
      )
      cam.position.lerpVectors(saved.pos, targetPos, eased)
      if (target.free) {
        // Move into the seat, but hand rotation back once settled so the player
        // can look around from it.
        if (k.current < 0.995) {
          cam.quaternion.slerpQuaternions(saved.quat, targetQuat, eased)
        } else if (!settled.current) {
          // LAND EXACTLY before releasing. Stopping at k = 0.995 leaves half a
          // percent of the swing unapplied, and since the swing carries roll,
          // that residue is a permanent tilt — PointerLockControls rebuilds only
          // pitch and yaw from the quaternion and preserves Z forever.
          cam.quaternion.copy(targetQuat)
          settled.current = true
        }
      } else {
        cam.quaternion.slerpQuaternions(saved.quat, targetQuat, eased)
        cam.fov = saved.fov + ((target.fov ?? 45) - saved.fov) * eased
        cam.updateProjectionMatrix()
      }
    } else if (saved.valid) {
      targetPos.copy(saved.pos)
      cam.position.lerpVectors(saved.pos, cam.position, eased)
      cam.quaternion.slerp(saved.quat, 1 - eased)
      cam.fov = saved.fov
      cam.updateProjectionMatrix()
      if (k.current < 0.01) {
        // Snap home and release, so the next focus captures a fresh origin.
        cam.position.copy(saved.pos)
        cam.quaternion.copy(saved.quat)
        saved.valid = false
      }
    }
  })

  return null
}
