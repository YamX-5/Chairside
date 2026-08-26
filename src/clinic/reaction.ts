import type { ConsequencePrimitive } from '../ingest/channels'

/**
 * What the patient does when your decision reaches them.
 *
 * Pure maths: primitive + elapsed seconds in, a pose and some effect intensities
 * out. No three.js, no React, so the curves can be tested headless — and the
 * curves are the whole thing. A reaction that reads as "broken" rather than
 * "funny" is almost always a timing problem, not a rendering one.
 *
 * The shape every reaction follows, borrowed from animation practice:
 *
 *   ANTICIPATION (0 – 0.2s)  a small movement the OPPOSITE way. Eyes widen,
 *                            shoulders draw back. This is what makes an impact
 *                            land; without it motion reads as a glitch.
 *   IMPACT       (at 0.2s)   the peak, on one frame.
 *   SETTLE       (0.2s – end) decay, with overshoot where it suits the gag.
 */

export interface ReactionPose {
  /** Metres, relative to the patient's resting position. */
  offsetY: number
  offsetZ: number
  /** Radians. */
  pitch: number
  roll: number
  /** 0–1. Camera shake amplitude BEFORE squaring. */
  trauma: number
  /** 0–1. Drives the DOM overlay, not a shader — cheapest possible. */
  blood: number
  /** 0–1. One-frame white pop on impact. */
  flash: number
  /**
   * 0–1, how far the jaw drops. The model has a separate hinged Jaw for this:
   * a patient who screams with a closed mouth is the exact "broken rather than
   * funny" failure the whole reaction system exists to avoid.
   */
  jawOpen: number
  /** 0–1. Shoulders rise and arms grip the rests. Reads as bracing. */
  brace: number
  done: boolean
}

const REST: ReactionPose = {
  offsetY: 0,
  offsetZ: 0,
  pitch: 0,
  roll: 0,
  trauma: 0,
  blood: 0,
  flash: 0,
  jawOpen: 0,
  brace: 0,
  done: true,
}

/** How long each reaction runs, in seconds. */
export const DURATION: Record<ConsequencePrimitive, number> = {
  patient_calm: 1.2,
  procedure_success: 5, // deliberately the LONGEST — see the note in settle()
  patient_flinch: 1.1,
  generic_flinch: 1.1,
  patient_wince_vocal: 1.6,
  patient_scream: 2.4,
  patient_bleed: 3.2,
  patient_thrash: 2.8,
  patient_bolts: 2.6,
  waiting_room_unrest: 2,
  waiting_room_panic: 3,
  tray_erupts: 2,
  assistant_recoil: 1.4,
}

const ANTICIPATION = 0.2

/** Ease-out for settling. Fast at first, then creeping — reads as weight. */
function decay(k: number): number {
  return Math.max(0, 1 - k) ** 2
}

/** Deterministic pseudo-noise. Math.random() per frame reads as jitter, not shake. */
function noise(t: number, seed: number): number {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/**
 * The pose at time `t` seconds after the reaction fired.
 *
 * `seed` varies the noise per playthrough so a repeated mistake does not
 * reproduce frame-for-frame — the same event should feel the same, not look
 * identical.
 */
export function poseAt(
  primitive: ConsequencePrimitive,
  t: number,
  seed = 1,
): ReactionPose {
  const duration = DURATION[primitive] ?? 1.1
  if (t < 0) return REST
  if (t >= duration) return { ...REST, done: true }

  // Wind-up: everything moves slightly the wrong way first.
  const anticipating = t < ANTICIPATION
  const windUp = anticipating ? Math.sin((t / ANTICIPATION) * Math.PI) : 0

  // 0 at impact, 1 at the end.
  const k = anticipating ? 0 : (t - ANTICIPATION) / (duration - ANTICIPATION)
  // MUST be zero during the wind-up. decay(0) is 1, so leaving it live would
  // apply the full impact value while the patient is still winding up — the two
  // cancel, the anticipation vanishes, and every reaction reads as a glitch.
  const d = anticipating ? 0 : decay(k)
  // Flash is one sharp pop at impact only.
  const flash = !anticipating && t < ANTICIPATION + 0.09 ? 1 - (t - ANTICIPATION) / 0.09 : 0

  const base: ReactionPose = { ...REST, done: false }

  switch (primitive) {
    case 'patient_calm':
      // Breathing out. Present so "nothing happened" is still SOMETHING.
      return { ...base, offsetY: Math.sin(t * 2.2) * 0.006 }

    case 'procedure_success':
      // The reward beat, and it is LONGER than any failure on purpose.
      //
      // If failure is loud and success is a line of text, players optimise for
      // failure and the teaching collapses. So the correct outcome gets the
      // slow, unhurried, non-interactive moment — Peggle's trick.
      return {
        ...base,
        offsetY: Math.sin(t * 1.4) * 0.008,
        // A single slow nod at the two-second mark: recognition, then thanks.
        pitch: t > 2 && t < 2.9 ? Math.sin((t - 2) * Math.PI) * 0.11 : 0,
      }

    case 'patient_flinch':
    case 'generic_flinch':
      return {
        ...base,
        offsetY: -windUp * 0.012 + d * 0.045,
        pitch: -windUp * 0.03 + d * 0.16,
        trauma: d * 0.28,
        flash: flash * 0.25,
        jawOpen: d * 0.18,
        brace: d * 0.45,
      }

    case 'patient_wince_vocal':
      return {
        ...base,
        offsetY: -windUp * 0.014 + d * 0.06,
        pitch: -windUp * 0.04 + d * 0.24,
        roll: d * noise(t * 3, seed) * 0.05,
        trauma: d * 0.4,
        flash: flash * 0.35,
        jawOpen: d * 0.45,
        brace: d * 0.7,
      }

    case 'patient_scream':
      return {
        ...base,
        offsetY: -windUp * 0.03 + d * 0.14,
        offsetZ: d * 0.06,
        pitch: -windUp * 0.06 + d * 0.42,
        roll: d * noise(t * 9, seed) * 0.12,
        trauma: d * 0.85,
        flash,
        // Held wide, then closing — a scream sustains, it does not blip.
        jawOpen: Math.min(1, d * 1.5),
        brace: Math.min(1, d * 1.4),
      }

    case 'patient_bleed':
      // The patient barely moves. The horror is the screen filling up, which is
      // a DOM overlay costing zero draw calls — and swappable for a cartoon
      // splat by a "reduce gore" toggle without touching this file.
      return {
        ...base,
        offsetY: -windUp * 0.01 + d * 0.05,
        pitch: d * 0.18,
        trauma: d * 0.35,
        // Ramp over ~0.9s, hold, then clear in the last third.
        blood: anticipating ? 0 : Math.min(1, (t - ANTICIPATION) / 0.9) * (1 - Math.max(0, k - 0.66) / 0.34),
        flash: flash * 0.5,
        jawOpen: d * 0.3,
        brace: d * 0.85,
      }

    case 'patient_thrash': {
      // Oscillation that decays. The comedy is in the flailing, not the endpoint.
      //
      // Phased on (t - ANTICIPATION) with cos, so the first swing peaks exactly
      // AT impact. A raw sin(t) lands wherever its phase happens to be, which
      // half the time sends the first movement the same way as the wind-up and
      // kills the snap.
      const wobble = Math.cos((t - ANTICIPATION) * 22) * d
      return {
        ...base,
        offsetY: -windUp * 0.03 + Math.abs(wobble) * 0.1,
        offsetZ: wobble * 0.05,
        pitch: -windUp * 0.05 + wobble * 0.3,
        roll: Math.sin(t * 17 + seed) * d * 0.28,
        trauma: d * 0.75,
        flash: flash * 0.4,
        jawOpen: Math.abs(wobble) * 0.7,
        brace: d,
      }
    }

    case 'patient_bolts': {
      // Up and out of the chair. Rises fast, then leaves.
      const rise = Math.min(1, Math.max(0, (t - ANTICIPATION) / 0.55))
      return {
        ...base,
        offsetY: -windUp * 0.04 + rise * 0.55,
        offsetZ: rise * rise * 1.6,
        pitch: -windUp * 0.06 - rise * 0.5,
        roll: noise(t * 6, seed) * 0.08 * rise,
        trauma: anticipating ? 0 : Math.max(0, 0.7 - k),
        flash: flash * 0.6,
        jawOpen: rise * 0.55,
        brace: rise,
      }
    }

    case 'tray_erupts':
      // The patient is fine. The instruments are not.
      return { ...base, offsetY: d * 0.02, trauma: d * 0.6, flash: flash * 0.5 }

    case 'assistant_recoil':
      return { ...base, trauma: d * 0.3, flash: flash * 0.2 }

    case 'waiting_room_unrest':
      return { ...base, trauma: d * 0.15 }

    case 'waiting_room_panic':
      return { ...base, trauma: d * 0.45 }

    default:
      return { ...base, offsetY: d * 0.03, pitch: d * 0.12, trauma: d * 0.25 }
  }
}

/**
 * Camera shake offset for a trauma level.
 *
 * Squaring is what makes small hits feel small: linear trauma makes a flinch
 * and a scream feel the same. Rotation only — translating a first-person camera
 * reads as nausea rather than impact.
 */
export function shakeAt(trauma: number, t: number, seed = 1): { pitch: number; yaw: number; roll: number } {
  const amount = trauma * trauma
  return {
    pitch: noise(t * 27, seed) * amount * 0.02,
    yaw: noise(t * 31, seed + 1) * amount * 0.02,
    // Roll is the axis everyone omits and the one that actually sells an impact.
    roll: noise(t * 23, seed + 2) * amount * 0.026,
  }
}
