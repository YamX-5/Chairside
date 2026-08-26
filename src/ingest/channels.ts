import { z } from 'zod'

/**
 * The hidden-information model: how one case becomes 2-3 packets that no single
 * player can solve alone.
 *
 * This is the part of Chairside that isn't already on the market. Every other
 * hidden-information medical game hand-authors its split — a designer decided
 * which player learns the glucose level. Here the split is derived from an
 * arbitrary uploaded lecture and then *verified*, which is why the verifier
 * (verifySplit.ts) matters as much as the splitter.
 *
 * Kept separate from schemas.ts because that file is specifically the wire
 * format for generation calls. This file is the runtime model: what the server
 * holds, what each seat receives, and how a commit is judged. The generation
 * JSON Schema for CaseCore lands here when the pipeline is wired.
 */

// ---------------------------------------------------------------------------
// Teeth
// ---------------------------------------------------------------------------

/**
 * FDI two-digit notation, permanent dentition: quadrant 1-4, tooth 1-8.
 * 32 teeth — 11-18, 21-28, 31-38, 41-48.
 *
 * This is the join key for the whole design, and it is deliberately the ONE
 * piece of information only the CHAIR seat can obtain (by looking in the mouth).
 * RECORDS and IMAGING are indexed by it. That forces "which tooth are we on?"
 * to be the first sentence of every case — which is KTaNE's serial-number trick,
 * and it happens to drill FDI notation, which students genuinely struggle with.
 */
export const ToothFDI = z.string().regex(/^[1-4][1-8]$/, 'FDI tooth code, e.g. "46"')
export type ToothFDI = z.infer<typeof ToothFDI>

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/**
 * The four information channels.
 *
 * The non-obvious rule: at least one channel must hold a TRANSFORMATION rather
 * than facts. If every seat holds facts, they read them aloud once, everything
 * is common ground inside a minute, and from then on the best student solves it
 * alone — the alpha-player failure mode. PROTOCOL holds the decision rules and
 * can see nothing, so its branches can only be resolved by measurements only
 * CHAIR can take. The dependence runs both ways, which is what keeps both seats
 * engaged.
 */
export const ChannelId = z.enum(['CHAIR', 'RECORDS', 'IMAGING', 'PROTOCOL'])
export type ChannelId = z.infer<typeof ChannelId>

export const ALL_CHANNELS: readonly ChannelId[] = ['CHAIR', 'RECORDS', 'IMAGING', 'PROTOCOL']

/** Channels that deal out readable Facts. CHAIR reads the live mouth instead. */
export const FACT_CHANNELS: readonly ChannelId[] = ['RECORDS', 'IMAGING', 'PROTOCOL']

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

/**
 * One atom of case information. Lives in exactly one channel, and its `value`
 * reaches exactly the seats holding that channel.
 */
export const Fact = z.object({
  id: z.string(),
  channel: ChannelId,
  /** null = case-level (e.g. "patient is on warfarin"), not tied to one tooth. */
  tooth: ToothFDI.nullable(),
  /** Revealed when the holder tables this fact. Not dealt to anyone else. */
  category: z.string(),
  /**
   * The correct clinical term for this finding ("periapical radiolucency").
   * Load-bearing: if the cheapest thing to say is the correct term, students
   * entrain on it instead of "dark spot at the root tip". The split doubles as
   * a vocabulary acquisition mechanism, which is a real bottleneck in
   * preclinical dental education.
   */
  label: z.string(),
  /** PRIVATE. Only ever serialised into the holding seat's packet. */
  value: z.string(),
  /** Required to reach the correct triad? Drives the split verifier's bounds. */
  loadBearing: z.boolean(),
  sourcePage: z.number().int().positive(),
  /** Checked by verify.ts at >= 0.75 ordered word-overlap against the deck. */
  sourceQuote: z.string(),
})
export type Fact = z.infer<typeof Fact>

/**
 * A task a channel cannot discharge alone.
 *
 * Possession alone is a weak forcing function — players sit on information they
 * don't know is relevant. An obligation makes the holder *ask*. Spaceteam's
 * lesson: give someone a job they can't finish without you.
 */
export const Obligation = z
  .object({
    channel: ChannelId,
    /** e.g. "Confirm no anticoagulant risk on the affected tooth" */
    prompt: z.string(),
    resolvableFrom: z.array(ChannelId).min(1),
    satisfiedByFactIds: z.array(z.string()),
  })
  .refine((o) => o.resolvableFrom.some((c) => c !== o.channel), {
    message: 'An obligation resolvable from its own channel forces no conversation',
  })
export type Obligation = z.infer<typeof Obligation>

// ---------------------------------------------------------------------------
// The commit
// ---------------------------------------------------------------------------

/**
 * The team's answer, verified as a unit.
 *
 * Never confirm one leg at a time. Per-leg confirmation lets a team brute-force
 * by guess-and-check, which is Obra Dinn's rule of three and the reason it locks
 * three entries simultaneously. It also means no single seat holds the whole
 * answer: CHAIR knows the tooth, PROTOCOL knows what the findings imply.
 */
export const CommitTriad = z.object({
  diagnosisId: z.string(),
  siteFDI: ToothFDI,
  procedureId: z.string(),
})
export type CommitTriad = z.infer<typeof CommitTriad>

/**
 * How a commit went wrong. Ordering matters — see classify.ts.
 *
 * C is the co-op payoff: a contraindication was in someone's packet and never
 * got shared. The consequence literally proves a teammate stayed quiet.
 */
export const ErrorClass = z.enum([
  'A_WRONG_DX_RIGHT_SITE',
  'B_RIGHT_DX_WRONG_SITE',
  'C_CONTRAINDICATION_IGNORED',
  'D_WRONG_INSTRUMENT',
  'E_IRREVERSIBLE_ON_REVERSIBLE',
  'F_CORRECT',
])
export type ErrorClass = z.infer<typeof ErrorClass>

// ---------------------------------------------------------------------------
// Consequences
// ---------------------------------------------------------------------------

/**
 * CLOSED enum. The generator SELECTS from this list; it never invents a value.
 * Every entry corresponds to a hand-authored animation state, so an invented
 * value would be an unplayable case.
 *
 * `generic_flinch` is a mandatory fallback: unknown values degrade to it rather
 * than crashing the round.
 */
export const ConsequencePrimitive = z.enum([
  'patient_calm',
  'patient_flinch',
  'patient_wince_vocal',
  'patient_scream',
  'patient_bleed',
  'patient_thrash',
  'patient_bolts',
  'waiting_room_unrest',
  'waiting_room_panic',
  'tray_erupts',
  'assistant_recoil',
  'procedure_success',
  'generic_flinch',
])
export type ConsequencePrimitive = z.infer<typeof ConsequencePrimitive>

export const Consequence = z.object({
  primitive: ConsequencePrimitive,
  intensity: z.enum(['minor', 'moderate', 'severe']),
  targetTooth: ToothFDI.nullable(),
  delayMs: z.number().int().min(0).max(4000),
  /** e.g. patient_bolts -> waiting_room_panic. A free cascade, one field. */
  chainsTo: ConsequencePrimitive.nullable(),

  /**
   * The seductive-details guard, mechanised.
   *
   * Vivid detail that is *irrelevant* to the material measurably reduces recall.
   * Requiring the generator to state why this physical event follows from this
   * specific clinical error is what keeps the comedy load-bearing instead of
   * decorative — and a deterministic rule in consequence.ts rejects rationales
   * that don't name the actual diagnosis, site or procedure.
   */
  clinicalRationale: z.string().min(30),
  /** "If the student remembers only one thing from this, what did they learn?" */
  teachesFact: z.string().min(10),
})
export type Consequence = z.infer<typeof Consequence>

// ---------------------------------------------------------------------------
// The case
// ---------------------------------------------------------------------------

const Localised = z.object({ en: z.string(), ar: z.string().optional() })

export const GroundTruth = z.object({
  diagnosisId: z.string(),
  siteFDI: ToothFDI,
  correctProcedureId: z.string(),
  contraindications: z.array(
    z.object({
      factId: z.string(),
      blocksProcedureIds: z.array(z.string()),
    }),
  ),
  /** Whether the correct procedure is reversible — drives error class E. */
  reversible: z.boolean(),
})
export type GroundTruth = z.infer<typeof GroundTruth>

/**
 * The whole case. Lives ONLY on the server. No seat ever receives this object.
 */
export const CaseCore = z.object({
  id: z.string(),
  lectureHash: z.string(),
  title: Localised,

  groundTruth: GroundTruth,

  facts: z.array(Fact).min(8),
  obligations: z.array(Obligation).min(2),

  /**
   * Public option lists — every seat sees these, or nobody could commit.
   *
   * Minimum 5 each is a correctness requirement, not a style preference: the
   * split verifier's "a solo solver must score at or near chance" bound is
   * unpassable if chance is high. With 4 options chance is 25%, above the
   * threshold, so the check can never pass.
   */
  options: z.object({
    diagnoses: z.array(z.object({ id: z.string() }).and(Localised)).min(5),
    procedures: z
      .array(z.object({ id: z.string(), irreversible: z.boolean() }).and(Localised))
      .min(5),
  }),

  /** diagnosisId -> procedures that diagnosis unlocks. The commit gate, as data. */
  commitGate: z.object({
    unlocksProcedures: z.record(z.string(), z.array(z.string())),
  }),

  consequences: z.record(ErrorClass, Consequence),

  debrief: z.object({
    causalChain: Localised,
    takeawayCard: z.object({
      front: Localised,
      back: Localised,
      sourcePage: z.number().int().positive(),
    }),
    /**
     * The empathy safeguard — the round ends on a person, not a punchline.
     *
     * Two variants, because one line cannot serve both outcomes: telling a
     * student "he kept the tooth" after they extracted it is worse than saying
     * nothing. The failure variant is the more important of the two — that is
     * the round where somebody was actually harmed, and it is the moment the
     * comedy has to land against a real consequence rather than replace it.
     */
    patientPerspective: z.object({ success: Localised, failure: Localised }),
  }),
})
export type CaseCore = z.infer<typeof CaseCore>

// ---------------------------------------------------------------------------
// Seats and packets
// ---------------------------------------------------------------------------

export const SeatId = z.enum(['S1', 'S2', 'S3'])
export type SeatId = z.infer<typeof SeatId>

/**
 * What one seat actually receives. This object is what goes on the wire, so
 * every field here is a deliberate disclosure decision.
 *
 * Note what is ABSENT and why:
 *  - `groundTruth` — obviously.
 *  - Any Fact belonging to a channel this seat does not hold.
 *  - The `tooth` of foreign facts. Leaking it would hand over the one piece of
 *    information only CHAIR can obtain, and kill the opening conversation.
 *  - The `category` of foreign facts. Categories are revealed by *tabling* a
 *    fact; dealing them means tabling reveals nothing anyone didn't already have.
 *
 * All a seat learns about other channels is how many facts they hold — enough
 * to know there is something to ask for, not enough to guess what.
 */
export const Packet = z.object({
  seat: SeatId,
  caseId: z.string(),
  title: Localised,
  channels: z.array(ChannelId).min(1),
  /** Full Facts, values intact, for this seat's channels only. */
  facts: z.array(Fact),
  obligations: z.array(Obligation),
  /**
   * channel -> fact count, for channels this seat does NOT hold. Existence and
   * volume only. Keyed loosely as string because only the foreign channels
   * appear, so an exhaustive Record would be the wrong shape.
   */
  otherChannelFactCounts: z.record(z.string(), z.number().int().nonnegative()),
  options: CaseCore.shape.options,
})
export type Packet = z.infer<typeof Packet>

/**
 * Seat -> channels, per player count.
 *
 * Author four channels always; vary only the mapping. Authoring different
 * content per player count is a content cost this project cannot carry.
 *
 * HARD INVARIANT, asserted in split.test.ts: whoever holds the instruments
 * (CHAIR) never holds the decision rules (PROTOCOL). Violate it and one seat
 * can both decide and act, which is single-player with extra steps.
 */
export const SEAT_MAPS: Record<1 | 2 | 3, Record<string, ChannelId[]>> = {
  // Solo sees everything, but see solo mode's diegetic one-document-at-a-time
  // constraint — solo must not be strictly easier than co-op, or nobody plays co-op.
  1: { S1: ['CHAIR', 'RECORDS', 'IMAGING', 'PROTOCOL'] },
  2: {
    S1: ['CHAIR', 'RECORDS'],
    S2: ['IMAGING', 'PROTOCOL'],
  },
  3: {
    S1: ['CHAIR'],
    S2: ['RECORDS'],
    S3: ['IMAGING', 'PROTOCOL'],
  },
}
