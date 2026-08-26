import { z } from 'zod'

/**
 * Clinic Day content schema — schemaVersion 1.
 *
 * This file is the single contract for ALL content in the game:
 *  - Phase 0: hand-written day files must parse against it (see schema.test.ts)
 *  - Phase 2: the LLM that converts lecture PDFs must emit JSON matching it exactly
 *
 * Design rules (decided at plan review, 2026-07-21):
 *  - English is the study language. `en` is required, `ar` is an optional aid.
 *  - No derived data in content files (e.g. no flattened question bank —
 *    that's computed at load time in src/game/questionBank.ts).
 *  - Answer correctness lives on the option (isCorrect), never in an index,
 *    so options can be shuffled at render time.
 *  - Clinical decisions are graded best/acceptable/poor, not right/wrong.
 */

/**
 * English is the study language — dentistry and medicine are taught in English
 * here, so `en` is the content itself and `ar` is an optional aid. Missing
 * Arabic falls back to English at render time (see LocaleContext.c), which
 * means a new lecture only ever has to be written once.
 *
 * Arabic that IS written keeps clinical terms in English — a student who
 * revises "Stage III, Grade C" needs to meet those exact words, not a
 * translation of them.
 */
export const BiText = z.object({
  en: z.string().min(1),
  ar: z.string().min(1).optional(),
})
export type BiText = z.infer<typeof BiText>

/**
 * How hard the item is. A day should span the range — an exam that is all
 * `recall` teaches nothing and an exam that is all `brutal` just demoralises.
 */
export const Difficulty = z.enum(['easy', 'moderate', 'hard', 'brutal'])
export type Difficulty = z.infer<typeof Difficulty>

/**
 * What the item actually tests, in Bloom terms. `recall` items check a fact;
 * `application` puts it in a case; `analysis` requires comparing or ruling out;
 * `synthesis` requires assembling several facts into a judgement.
 */
export const Cognitive = z.enum(['recall', 'application', 'analysis', 'synthesis'])
export type Cognitive = z.infer<typeof Cognitive>

export const AnswerOption = z.object({
  id: z.string().min(1),
  label: BiText,
  isCorrect: z.boolean(),
  /**
   * Why a well-prepared student might still pick this — and what specifically
   * makes it wrong. This is what separates a real distractor from filler, so
   * generated items are required to carry it.
   */
  rationale: BiText.optional(),
})
export type AnswerOption = z.infer<typeof AnswerOption>

export const MicroQuestion = z
  .object({
    id: z.string().min(1),
    prompt: BiText,
    options: z.array(AnswerOption).min(2).max(5),
    explanation: BiText,
    /** Where in the source material this comes from, e.g. "Slide 12" */
    sourceRef: BiText,
    difficulty: Difficulty.optional(),
    cognitive: Cognitive.optional(),
    /**
     * A verbatim sentence from the source deck that supports the keyed answer.
     * Generated items must carry it: an item whose author cannot point at the
     * line it came from is the item most likely to be invented.
     */
    sourceQuote: z.string().optional(),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: 'A micro-question must have exactly one correct option',
  })
export type MicroQuestion = z.infer<typeof MicroQuestion>

export const PrepChunk = z.object({
  id: z.string().min(1),
  title: BiText,
  /** Short transformed content — never a raw slide dump. A few sentences max. */
  body: BiText,
  question: MicroQuestion,
})
export type PrepChunk = z.infer<typeof PrepChunk>

export const DecisionQuality = z.enum(['best', 'acceptable', 'poor'])
export type DecisionQuality = z.infer<typeof DecisionQuality>

export const DecisionOption = z.object({
  id: z.string().min(1),
  label: BiText,
  quality: DecisionQuality,
  /** Immediate consequence shown after choosing — the teaching moment. */
  feedback: BiText,
  sourceRef: BiText.optional(),
})
export type DecisionOption = z.infer<typeof DecisionOption>

export const DecisionPoint = z
  .object({
    id: z.string().min(1),
    prompt: BiText,
    options: z.array(DecisionOption).min(2).max(5),
    difficulty: Difficulty.optional(),
    cognitive: Cognitive.optional(),
    sourceQuote: z.string().optional(),
  })
  .refine((d) => d.options.filter((o) => o.quality === 'best').length === 1, {
    message: 'A decision point must have exactly one "best" option',
  })
export type DecisionPoint = z.infer<typeof DecisionPoint>

export const PatientCase = z.object({
  id: z.string().min(1),
  patient: z.object({
    name: BiText,
    age: z.number().int().positive(),
    /** Emoji or short glyph used as the avatar in v0.1 */
    avatar: z.string().min(1),
  }),
  chiefComplaint: BiText,
  history: BiText,
  findings: z.array(BiText).min(1),
  /**
   * The film for this encounter, when the source deck actually contained one.
   *
   * Optional on purpose. A hand-written day, or a deck whose images are all
   * logos and clinical photos, must still be playable -- the X-ray then reports
   * "no film on file" instead of showing a picture. We never DRAW a radiograph:
   * a student who learns to read pathology off invented pixels has been taught
   * something false, which is worse than being taught nothing.
   */
  radiograph: z
    .object({
      /** Object URL, data URL, or a path under public/. */
      src: z.string().min(1),
      /** What the deck's own text says this film shows. */
      shows: BiText,
      /** Page of the source deck, so the film can cite where it came from. */
      page: z.number().int().positive().optional(),
    })
    .optional(),
  decisions: z.array(DecisionPoint).min(3).max(6),
  /** Shown depending on the score ratio at the end of the encounter. */
  outcome: z.object({
    success: BiText,
    partial: BiText,
    failure: BiText,
  }),
})
export type PatientCase = z.infer<typeof PatientCase>

export const ClinicDay = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  subject: BiText,
  title: BiText,
  /** Which student track this day belongs to. Defaults to dental. */
  track: z.enum(['dental', 'medical']).optional(),
  /** True for hand-written demo content that must be visibly labeled in-game. */
  isDemo: z.boolean(),
  /** Present when the day was generated from an uploaded deck rather than written. */
  provenance: z
    .object({
      sourceFile: z.string(),
      pageCount: z.number().int().positive(),
      model: z.string(),
      /** Local YYYY-MM-DD. Stamped by the pipeline, not the model. */
      generatedOn: z.string(),
    })
    .optional(),
  /**
   * Clinical standards the content's logic relies on (house rule G2).
   * For LLM-generated days this instead records the source deck name.
   */
  citations: z.array(z.string()),
  prep: z.object({
    missionTitle: BiText,
    /** The in-story reason: why this material matters TODAY. */
    briefing: BiText,
    chunks: z.array(PrepChunk).min(1),
  }),
  treat: z.object({
    missionTitle: BiText,
    cases: z.array(PatientCase).min(1),
  }),
})
export type ClinicDay = z.infer<typeof ClinicDay>

/** Parse + validate a raw day object. Throws with readable errors on bad content. */
export function parseClinicDay(raw: unknown): ClinicDay {
  return ClinicDay.parse(raw)
}
