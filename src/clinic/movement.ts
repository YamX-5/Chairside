import { blocked } from './layout'

/**
 * The first-person movement step, as pure math.
 *
 * This lives outside the render loop on purpose: a `useFrame` body cannot be
 * unit tested, and "does strafing go the right way" is exactly the kind of bug
 * that is invisible in code review and obvious in a test.
 */

export interface Point {
  x: number
  z: number
}

/**
 * Camera-forward on the ground plane. A three.js camera at yaw 0 looks down -Z.
 */
export function forwardFromYaw(yaw: number): Point {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) }
}

/**
 * The player's right-hand direction. Rotating forward by -90° about +Y gives
 * (-f.z, f.x) — at yaw 0 that is +X, which is what pressing D must do.
 */
export function rightFromForward(f: Point): Point {
  return { x: -f.z, z: f.x }
}

export interface StepOptions {
  speed: number
  radius: number
  bound: number
}

/**
 * One movement step with wall clamping and furniture collision.
 *
 * Collision resolves each axis independently so walking into a desk at an angle
 * slides along it instead of sticking — sticking is what makes an FPS feel
 * broken.
 */
export function stepPlayer(
  pos: Point,
  yaw: number,
  input: Point,
  delta: number,
  opts: StepOptions,
): Point {
  const f = forwardFromYaw(yaw)
  const r = rightFromForward(f)

  let mx = f.x * input.z + r.x * input.x
  let mz = f.z * input.z + r.z * input.x

  // Diagonal input must not be faster than cardinal input.
  const len = Math.hypot(mx, mz)
  if (len > 1) {
    mx /= len
    mz /= len
  }
  if (len === 0) return { x: pos.x, z: pos.z }

  const step = opts.speed * delta
  const out = { x: pos.x, z: pos.z }

  const wantX = clamp(pos.x + mx * step, -opts.bound, opts.bound)
  if (!blocked(wantX, out.z, opts.radius)) out.x = wantX

  const wantZ = clamp(pos.z + mz * step, -opts.bound, opts.bound)
  if (!blocked(out.x, wantZ, opts.radius)) out.z = wantZ

  return out
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

// ---------------------------------------------------------------------------
// Feel
// ---------------------------------------------------------------------------

export interface FeelOptions {
  /** Units per second toward the wanted direction. */
  accel: number
  /** Units per second back toward rest. Higher than accel = crisp stops. */
  decel: number
}

/**
 * Ease the movement vector toward what the keys are asking for.
 *
 * Raw input snaps from 0 to 1 in a single frame, which is what makes a
 * first-person camera feel like it is sliding on ice rather than being carried
 * by a person. Smoothing the INPUT (rather than the position) means collision
 * and bounds still run on the eased value, so acceleration cannot push anyone
 * through a wall.
 *
 * Deceleration is deliberately faster than acceleration: taking a moment to get
 * going reads as weight, taking a moment to stop reads as a bug.
 */
export function smoothInput(
  current: Point,
  target: Point,
  delta: number,
  opts: FeelOptions,
): Point {
  const wanting = target.x !== 0 || target.z !== 0
  const rate = (wanting ? opts.accel : opts.decel) * delta

  const step = (c: number, t: number) => {
    const diff = t - c
    if (Math.abs(diff) <= rate) return t
    return c + Math.sign(diff) * rate
  }

  const out = { x: step(current.x, target.x), z: step(current.z, target.z) }

  // Smoothing two axes independently can overshoot the unit circle diagonally;
  // clamp so a diagonal is never faster than a cardinal.
  const len = Math.hypot(out.x, out.z)
  if (len > 1) {
    out.x /= len
    out.z /= len
  }
  return out
}

/** Vertical bob and roll for the camera, in metres and radians. */
export interface Bob {
  y: number
  roll: number
}

/**
 * Head bob, driven by DISTANCE WALKED rather than elapsed time.
 *
 * Time-based bob drifts out of sync with the stride whenever speed changes, and
 * keeps bobbing while standing still. Distance-based bob is locked to footfalls
 * for free and stops dead when the player does.
 *
 * `intensity` (0–1) fades the whole effect in with speed, so a nudge against a
 * wall does not produce a full stride.
 */
export function headBob(distance: number, intensity: number): Bob {
  const i = clamp(intensity, 0, 1)
  if (i <= 0) return { y: 0, roll: 0 }
  // ~2 bobs per stride: the vertical peak happens on each footfall.
  const phase = distance * 4.6
  return {
    y: Math.sin(phase) * 0.021 * i,
    // Roll runs at half frequency — one lean per stride, alternating feet.
    roll: Math.cos(phase * 0.5) * 0.007 * i,
  }
}
