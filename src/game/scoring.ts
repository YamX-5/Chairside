import type { ClinicDay, DecisionQuality } from '../content/schema'

/** Points a decision is worth by clinical quality. Deterministic — no AI. */
export const DECISION_POINTS: Record<DecisionQuality, number> = {
  best: 100,
  acceptable: 50,
  poor: 0,
}

export const PREP_CORRECT_POINTS = 60
export const PREP_WRONG_POINTS = 10 // you still read it; effort is not zero

export type OutcomeTier = 'success' | 'partial' | 'failure'

/** Ratio of earned to maximum treat points, 0..1. */
export function treatRatio(earned: number, maxPossible: number): number {
  if (maxPossible <= 0) return 0
  return Math.max(0, Math.min(1, earned / maxPossible))
}

export function outcomeTier(ratio: number): OutcomeTier {
  if (ratio >= 0.85) return 'success'
  if (ratio >= 0.5) return 'partial'
  return 'failure'
}

/**
 * v0.1 plays exactly one case per Clinic Day (see Treat.tsx), so the ceiling is
 * that case's — summing every case would mis-tier the outcome the moment a day
 * ships with two.
 */
export function maxTreatPoints(day: ClinicDay): number {
  return day.treat.cases[0].decisions.length * DECISION_POINTS.best
}

export function maxPrepPoints(day: ClinicDay): number {
  return day.prep.chunks.length * PREP_CORRECT_POINTS
}

/** Coins are score/10, rounded down, with a completion bonus. Deterministic. */
export function coinsEarned(totalScore: number, tier: OutcomeTier): number {
  const bonus = tier === 'success' ? 50 : tier === 'partial' ? 20 : 0
  return Math.floor(totalScore / 10) + bonus
}

/** Stars shown on the day-close screen, 1..3. */
export function starsFor(tier: OutcomeTier): number {
  return tier === 'success' ? 3 : tier === 'partial' ? 2 : 1
}
