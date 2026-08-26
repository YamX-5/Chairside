/**
 * How things move — the easing curves that give the clinic a bit of character.
 *
 * WHY THESE AND NOT A LERP
 * ------------------------
 * Everything in this room used to ease with `1 - exp(-dt * k)`, which is a clean
 * exponential settle and completely characterless: it starts at full speed and
 * creeps to a stop. Real objects do the opposite. A drawer you pull comes out
 * fast and bounces slightly past where you meant; a chair you drop into catches
 * you and settles; a person standing up leans back a fraction first.
 *
 * Two curves, named for what they feel like:
 *
 *   LEAP  — anticipation then overshoot. Dips slightly the wrong way, springs
 *           past the target, settles back. For anything you PULL or push: a
 *           drawer sliding out, a door swinging open, standing up out of a seat.
 *
 *   SLIP  — no overshoot, a fast start that glides to a dead stop. For anything
 *           that ARRIVES somewhere it must not bounce out of: sitting down,
 *           a drawer closing, a door latching.
 *
 * Both take a normalised 0..1 progress and return a 0..1 (or slightly beyond,
 * for leap) position. They are pure functions of t, so `motion.test.ts` can
 * check the shape — that leap really does overshoot, that slip really does not,
 * and that both start and end exactly where they say.
 *
 * PURE, no three.js and no React.
 */

/** Clamp to the unit interval; every curve below assumes t is in range. */
export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/**
 * Anticipation, then overshoot, then settle.
 *
 * `back` controls how far it dips and overshoots. 1.7 is the classic
 * back-ease constant; anything past ~2.5 reads as broken rather than lively.
 */
export function leap(t: number, back = 1.7): number {
  const x = clamp01(t)
  // A back-ease in the first half and out in the second: the dip happens while
  // the object is still nearly closed, the overshoot as it arrives.
  const s = back * 1.525
  if (x < 0.5) {
    const u = 2 * x
    return 0.5 * (u * u * ((s + 1) * u - s))
  }
  const u = 2 * x - 2
  return 0.5 * (u * u * ((s + 1) * u + s) + 2)
}

/**
 * Fast away, gliding to a dead stop. No overshoot, ever.
 *
 * This is the curve for arriving somewhere: a body settling into a seat should
 * not bounce back out of it, and a drawer closing should not spring open again.
 */
export function slip(t: number): number {
  const x = clamp01(t)
  // Quintic ease-out: steeper start than a cubic, so it feels like it has
  // weight behind it, and a very long flat tail so the stop is invisible.
  const u = 1 - x
  return 1 - u * u * u * u * u
}

/**
 * A settle with a couple of decaying bounces — for something that lands.
 *
 * Used sparingly. It is the most cartoon of the three and reads as comedy, so
 * it belongs on props, not on the camera: bouncing somebody's viewpoint is how
 * you make a person motion-sick.
 */
export function bounceSettle(t: number, bounces = 2, damping = 6): number {
  const x = clamp01(t)
  if (x >= 1) return 1
  return 1 - Math.exp(-damping * x) * Math.cos(bounces * Math.PI * x)
}

/**
 * Advance a normalised progress value toward a target at a fixed duration.
 *
 * Frame-rate independent by construction: progress moves by dt/duration, so a
 * 120 Hz phone and a 30 Hz one take the same wall-clock time. The old code eased
 * by a per-frame factor, which is subtly faster on faster hardware.
 */
export function advance(current: number, target: 0 | 1, dt: number, duration: number): number {
  const step = dt / Math.max(duration, 1e-4)
  if (target === 1) return current + step >= 1 ? 1 : current + step
  return current - step <= 0 ? 0 : current - step
}

/** How long each gesture takes, in seconds. One table, so the room feels of a piece. */
export const DURATIONS = {
  /** A drawer or a door. Long enough to read as weight, short enough not to wait. */
  openable: 0.42,
  /** Dropping into a seat. */
  sit: 0.5,
  /** Getting up is quicker than sitting down, and it is on every stand-up. */
  stand: 0.36,
} as const
