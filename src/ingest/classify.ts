import type { CaseCore, CommitTriad, ErrorClass } from './channels'

/**
 * Judge a committed triad against the case's ground truth.
 *
 * Deliberately pure comparison — no model call at play time, ever. The judgement
 * is what the whole round scores on, so it has to be deterministic, testable and
 * instant. A generated case can be wrong; a generated *verdict* would be
 * unfixable.
 */

export interface CommitContext {
  /** The instrument actually picked up. Omit to skip the class-D check. */
  instrumentId?: string
  /** What the chosen procedure requires. Omit to skip the class-D check. */
  expectedInstrumentId?: string
}

export interface Verdict {
  errorClass: ErrorClass
  /** Which contraindication fired, for the debrief. Empty unless class C. */
  violatedFactIds: string[]
  /** Plain-English reason, for the debrief and for test failure messages. */
  reason: string
}

/**
 * Check order is a design decision, not an implementation detail.
 *
 * C is first because it is the co-op payoff. When a team ignores a
 * contraindication, the consequence proves somebody held a card and never
 * played it — that is the moment the hidden-information design justifies itself,
 * and it must win over any other label that also happens to apply.
 *
 * E is next because doing something irreversible to a patient who needed
 * something reversible is the most consequential ordinary mistake in dentistry,
 * and it should never be reported as merely "wrong diagnosis".
 *
 * A precedes B because a wrong diagnosis is upstream of a wrong site: if you
 * misdiagnosed, being on the wrong tooth as well is a symptom, not the error.
 */
export function classify(
  triad: CommitTriad,
  core: CaseCore,
  ctx: CommitContext = {},
): Verdict {
  const gt = core.groundTruth

  // --- C: a contraindication in someone's packet blocked this procedure ----
  const violated = gt.contraindications
    .filter((ci) => ci.blocksProcedureIds.includes(triad.procedureId))
    .map((ci) => ci.factId)

  if (violated.length > 0) {
    return {
      errorClass: 'C_CONTRAINDICATION_IGNORED',
      violatedFactIds: violated,
      reason: `Procedure ${triad.procedureId} is contraindicated by ${violated.join(', ')}`,
    }
  }

  // --- E: irreversible procedure where the correct one was reversible -----
  const chosen = core.options.procedures.find((p) => p.id === triad.procedureId)
  if (!chosen) {
    // An unknown procedure id cannot be scored. Treat as a wrong diagnosis
    // rather than throwing — a malformed commit must not kill a live round.
    return {
      errorClass: 'A_WRONG_DX_RIGHT_SITE',
      violatedFactIds: [],
      reason: `Unknown procedure ${triad.procedureId}`,
    }
  }

  if (chosen.irreversible && gt.reversible && triad.procedureId !== gt.correctProcedureId) {
    return {
      errorClass: 'E_IRREVERSIBLE_ON_REVERSIBLE',
      violatedFactIds: [],
      reason: `${triad.procedureId} is irreversible; this case was manageable reversibly`,
    }
  }

  // --- A / B: the diagnosis and the site ----------------------------------
  const dxRight = triad.diagnosisId === gt.diagnosisId
  const siteRight = triad.siteFDI === gt.siteFDI

  if (!dxRight) {
    return {
      errorClass: 'A_WRONG_DX_RIGHT_SITE',
      violatedFactIds: [],
      reason: siteRight
        ? `Right tooth (${triad.siteFDI}), wrong diagnosis`
        : `Wrong diagnosis, and wrong tooth (${triad.siteFDI} vs ${gt.siteFDI})`,
    }
  }

  if (!siteRight) {
    return {
      errorClass: 'B_RIGHT_DX_WRONG_SITE',
      violatedFactIds: [],
      reason: `Right diagnosis, wrong tooth: treated ${triad.siteFDI}, needed ${gt.siteFDI}`,
    }
  }

  // --- D: right call, wrong tool ------------------------------------------
  if (
    ctx.instrumentId !== undefined &&
    ctx.expectedInstrumentId !== undefined &&
    ctx.instrumentId !== ctx.expectedInstrumentId
  ) {
    return {
      errorClass: 'D_WRONG_INSTRUMENT',
      violatedFactIds: [],
      reason: `Correct plan, but picked up ${ctx.instrumentId} instead of ${ctx.expectedInstrumentId}`,
    }
  }

  // --- F: the procedure was also the right one ----------------------------
  if (triad.procedureId !== gt.correctProcedureId) {
    return {
      errorClass: 'A_WRONG_DX_RIGHT_SITE',
      violatedFactIds: [],
      reason: `Right diagnosis and tooth, but ${triad.procedureId} is not the indicated procedure`,
    }
  }

  return { errorClass: 'F_CORRECT', violatedFactIds: [], reason: 'Correct diagnosis, site and procedure' }
}

/**
 * The gate. A locked diagnosis unlocks only certain procedures.
 *
 * This runs server-side and is the reason commit-then-execute is real rather
 * than cosmetic: a client that asks to perform an unlocked procedure is refused,
 * not merely discouraged.
 */
export function isProcedureUnlocked(
  core: CaseCore,
  committedDiagnosisId: string,
  procedureId: string,
): boolean {
  const allowed = core.commitGate.unlocksProcedures[committedDiagnosisId] ?? []
  return allowed.includes(procedureId)
}
