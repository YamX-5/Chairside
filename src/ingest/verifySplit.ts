import type { CaseCore, CommitTriad, Packet } from './channels'
import { classify } from './classify'
import { dealCase, seatsFor } from './split'

/**
 * The referee: does this split actually require more than one player?
 *
 * Two profiles, borrowed from the hidden-profile literature:
 *
 *   FULL   — a solver holding every packet must solve the case. If it can't,
 *            the case is unwinnable and will read to players as the game
 *            cheating, which is the one thing the design must never do.
 *   HIDDEN — a solver holding ONE packet must NOT solve it, beyond what
 *            guessing would achieve anyway.
 *
 * The second bound is the whole product claim. Anyone can assert "players see
 * different things"; demonstrating that no single player can finish alone, on a
 * case generated from a PDF nobody has seen, is the part that is hard.
 *
 * The solver is injected rather than imported so this runs in tests with a fake,
 * costs nothing, and never blocks a case on a network call.
 */

export type SoloSolver = (req: SolveRequest) => Promise<CommitTriad | null>

export interface SolveRequest {
  /** One packet for the hidden profile; all of them for the full profile. */
  packets: Packet[]
  options: CaseCore['options']
  /** Which attempt this is, so a solver can vary its answer. */
  attempt: number
}

export interface SplitReport {
  unionSolveRate: number
  maxSingleSolve: number
  chanceBaseline: number
  attempts: number
  passed: boolean
  problems: string[]
  /** Per-seat solve rates, so a failure names the seat that knows too much. */
  perSeat: Record<string, number>
}

export interface VerifyOptions {
  attempts?: number
  /** Union profile must reach this. */
  unionFloor?: number
  /** A single packet may exceed chance by at most this much. */
  chanceSlack?: number
}

const DEFAULTS = { attempts: 5, unionFloor: 0.8, chanceSlack: 0.05 }

/**
 * Probability of hitting the triad by guessing, GIVEN what a packet reveals.
 *
 * This conditioning is not a refinement — it is the difference between a check
 * that works and one that is unpassable or vacuous.
 *
 * The naive version assumes the solver must guess among all 32 teeth, which
 * makes chance ~0.1% and the bound trivially satisfiable. But RECORDS and
 * IMAGING facts are indexed BY tooth: a packet showing findings for exactly one
 * tooth has handed over the site leg, and real chance jumps to 1/(5x5) = 4%.
 * Score that against a 0.1% expectation and a broken split passes.
 *
 * (This is also why split.ts audits for distractor teeth — the two checks are
 * the same insight from opposite ends.)
 */
export function chanceBaseline(core: CaseCore, visible: Packet[]): number {
  const diagnoses = core.options.diagnoses.length
  const procedures = core.options.procedures.length

  const teethSeen = new Set(
    visible.flatMap((p) => p.facts).map((f) => f.tooth).filter((t): t is string => t !== null),
  )
  // No tooth-indexed facts at all → the solver is guessing among all permanent teeth.
  const teeth = teethSeen.size > 0 ? teethSeen.size : 32

  return 1 / (diagnoses * teeth * procedures)
}

async function solveRate(
  core: CaseCore,
  packets: Packet[],
  solver: SoloSolver,
  attempts: number,
): Promise<number> {
  let solved = 0
  for (let attempt = 0; attempt < attempts; attempt++) {
    const triad = await solver({ packets, options: core.options, attempt })
    if (!triad) continue
    // "Solved" means the deterministic classifier calls it correct — the same
    // judgement a real round uses. No separate grading path to drift out of sync.
    if (classify(triad, core).errorClass === 'F_CORRECT') solved++
  }
  return solved / attempts
}

export async function verifySplit(
  core: CaseCore,
  playerCount: 2 | 3,
  solver: SoloSolver,
  options: VerifyOptions = {},
): Promise<SplitReport> {
  const { attempts, unionFloor, chanceSlack } = { ...DEFAULTS, ...options }

  const packets = dealCase(core, playerCount)
  const seats = seatsFor(playerCount)
  const all = seats.map((s) => packets[s])

  const unionSolveRate = await solveRate(core, all, solver, attempts)

  const perSeat: Record<string, number> = {}
  for (const seat of seats) {
    perSeat[seat] = await solveRate(core, [packets[seat]], solver, attempts)
  }

  const maxSingleSolve = Math.max(...Object.values(perSeat))
  // Each seat is judged against the chance available to THAT seat: a packet that
  // narrows the tooth has a higher legitimate chance, and must clear a higher bar.
  const chance = Math.max(...seats.map((s) => chanceBaseline(core, [packets[s]])))
  const ceiling = chance + chanceSlack

  const problems: string[] = []

  if (unionSolveRate < unionFloor) {
    problems.push(
      `Union profile solved only ${(unionSolveRate * 100).toFixed(0)}% (need ${(unionFloor * 100).toFixed(0)}%) — ` +
        'the case may be unsolvable even with every packet, which reads to players as the game cheating',
    )
  }

  for (const [seat, rate] of Object.entries(perSeat)) {
    if (rate > ceiling) {
      problems.push(
        `Seat ${seat} solved ${(rate * 100).toFixed(0)}% alone, above the ${(ceiling * 100).toFixed(1)}% chance ceiling — ` +
          'that seat does not need its teammates',
      )
    }
  }

  return {
    unionSolveRate,
    maxSingleSolve,
    chanceBaseline: chance,
    attempts,
    passed: problems.length === 0,
    problems,
    perSeat,
  }
}
