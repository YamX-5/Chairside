import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { BOUND, EYE_HEIGHT, PLAYER_RADIUS, WALK_SPEED } from './theme3d'
import { nearestInteractable, nearestSeat, SPAWN, type InteractableId } from './layout'
import { moveInput, touchLook } from './input'
import { headBob, smoothInput, stepPlayer, type Point } from './movement'

const STEP_OPTS = { speed: WALK_SPEED, radius: PLAYER_RADIUS, bound: BOUND }
/** Getting going takes a beat; stopping does not. See smoothInput. */
const FEEL = { accel: 7.5, decel: 12 }

interface Props {
  paused: boolean
  isTouch: boolean
  /** Parent-owned so the keyboard handler and the touch button can read it. */
  nearestRef: RefObject<InteractableId | null>
  onNearChange: (id: InteractableId | null) => void
  /** The seat in reach, by id, so the prompt can offer to sit on it. */
  onNearSeatChange?: (id: string | null) => void
  /**
   * Mirrors the camera's ground position out to the parent every frame.
   *
   * A ref, not state: this changes 60 times a second and the parent only reads
   * it inside event handlers (e.g. "which seat am I standing next to?").
   */
  posRef?: RefObject<{ x: number; z: number }>
  /**
   * Seated: keep looking, stop walking.
   *
   * Different from `paused`, which surrenders the camera entirely. Sitting moves
   * you into a chair but leaves your head your own.
   */
  frozen?: boolean
}

const LOOK_SENSITIVITY = 0.0032
const PITCH_LIMIT = 1.2

// Reused across frames — allocating a Vector3 every frame is a GC stutter.
const forward = new Vector3()

export function Player({
  paused,
  isTouch,
  nearestRef,
  onNearChange,
  onNearSeatChange,
  posRef,
  frozen = false,
}: Props) {
  const camera = useThree((s) => s.camera)
  const yaw = useRef(SPAWN.yaw)
  const pitch = useRef(0)
  /** Eased movement vector, so walking has weight instead of snapping on. */
  const vel = useRef<Point>({ x: 0, z: 0 })
  /** Metres walked, which is what drives the bob — see headBob. */
  const walked = useRef(0)
  /** Last frame's bob, removed before the next is applied so it never stacks. */
  const lastSeat = useRef<string | null>(null)
  const bob = useRef({ y: 0, roll: 0 })

  // Spawn once, at eye height, facing into the room.
  useEffect(() => {
    camera.position.set(SPAWN.x, EYE_HEIGHT, SPAWN.z)
    camera.rotation.set(0, SPAWN.yaw, 0, 'YXZ')
  }, [camera])

  useFrame((_, rawDelta) => {
    // A backgrounded tab returns one enormous delta; clamping stops the player
    // teleporting through a wall on the first frame back.
    const delta = Math.min(rawDelta, 0.05)

    // Undo last frame's bob before anything else reads or writes the camera, so
    // it can never accumulate into a permanent drift.
    camera.position.y -= bob.current.y
    camera.rotation.z -= bob.current.roll
    bob.current = { y: 0, roll: 0 }

    if (paused) {
      // Drop any look delta accumulated while the overlay was up, or the camera
      // snaps the moment the player returns to the room.
      touchLook.dx = 0
      touchLook.dy = 0
      // Bleed off momentum too — returning from a menu mid-stride and drifting
      // is worse than a hard stop.
      vel.current = { x: 0, z: 0 }
      if (nearestRef.current !== null) {
        nearestRef.current = null
        onNearChange(null)
      }
      return
    }

    // Look. On desktop PointerLockControls owns the camera rotation, so we only
    // drive it ourselves in touch mode — doing both would fight.
    if (isTouch) {
      yaw.current -= touchLook.dx * LOOK_SENSITIVITY
      pitch.current -= touchLook.dy * LOOK_SENSITIVITY
      pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current))
      touchLook.dx = 0
      touchLook.dy = 0
      camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')
    }

    // Movement is on the ground plane: looking up must not slow you down.
    // Yaw comes from the camera itself so desktop (PointerLockControls owns the
    // rotation) and touch (we own it) go through one code path.
    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-6) return
    forward.normalize()
    const yawNow = Math.atan2(-forward.x, -forward.z)

    if (posRef) {
      posRef.current.x = camera.position.x
      posRef.current.z = camera.position.z
    }

    // Seated: CameraFocus owns position, so writing it here would fight. Look
    // still works because that is PointerLockControls, not this.
    if (frozen) {
      vel.current = { x: 0, z: 0 }
      return
    }

    vel.current = smoothInput(vel.current, moveInput, delta, FEEL)

    const from = { x: camera.position.x, z: camera.position.z }
    const next = stepPlayer(from, yawNow, vel.current, delta, STEP_OPTS)
    camera.position.set(next.x, EYE_HEIGHT, next.z)

    // Bob follows distance ACTUALLY covered, not intended — so walking into a
    // wall stops the stride instead of jogging on the spot.
    const moved = Math.hypot(next.x - from.x, next.z - from.z)
    walked.current += moved
    bob.current = headBob(walked.current, moved / (WALK_SPEED * delta || 1))
    camera.position.y += bob.current.y
    camera.rotation.z += bob.current.roll

    const near = nearestInteractable(camera.position.x, camera.position.z, yawNow)
    if (near !== nearestRef.current) {
      nearestRef.current = near
      onNearChange(near)
    }
    if (onNearSeatChange) {
      const seat = nearestSeat(camera.position.x, camera.position.z)?.id ?? null
      if (seat !== lastSeat.current) {
        lastSeat.current = seat
        onNearSeatChange(seat)
      }
    }
  })

  return null
}
