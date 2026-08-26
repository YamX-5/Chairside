import type { ConsequencePrimitive } from '../ingest/channels'

/**
 * Safety and comfort preconditions — gloves on, patient numb.
 *
 * These are the two things a student is told on day one and the two things a
 * game can make you FEEL rather than read: put a handpiece into an un-anaesthetised
 * tooth and the patient screams, and you will not forget again.
 *
 * Pure data and pure functions, no three.js, so the rules are testable headless
 * — same shape as instruments.ts.
 */

export type SafetyBreach =
  /** Patient contact without gloves. */
  | 'no_gloves'
  /** An invasive procedure started on a tooth that was never anaesthetised. */
  | 'no_anaesthesia'

/**
 * Which procedures require local anaesthesia.
 *
 * The line is whether the procedure reaches innervated tissue. Dentine contains
 * odontoblastic processes and fluid-filled tubules, so cutting it hurts
 * (Brännström's hydrodynamic theory); pulp is directly innervated; extraction is
 * surgical and involves the periodontal ligament and bone. Observation reaches
 * none of those.
 *
 * This mirrors standard operative practice: LA for operative, endodontic and
 * surgical treatment; no LA needed for examination.
 *
 * NOT a clinical authority — a game rule grounded in one. A real case can always
 * differ (a non-vital tooth may need no anaesthetic at all for endodontics), and
 * `overridden` in the result exists so the clinician stays in charge.
 */
export const NEEDS_ANAESTHESIA: Record<string, boolean> = {
  'p-extraction': true, // surgical: PDL, alveolar bone
  'p-rct': true, // pulpal access, unless the tooth is already non-vital
  'p-restoration': true, // cuts dentine
  'p-pulp-cap': true, // pulp is exposed by definition
  'p-monitor': false, // looking is not treating
}

/** Does this procedure reach innervated tissue? Unknown procedures assume yes. */
export function requiresAnaesthesia(procedureId: string | null): boolean {
  if (!procedureId) return false
  return NEEDS_ANAESTHESIA[procedureId] ?? true
}

export interface SafetyState {
  /** Gloves are on. */
  gloved: boolean
  /** The site has been anaesthetised. */
  anaesthetised: boolean
}

/**
 * Everything wrong with starting `procedureId` right now.
 *
 * Returned as a list rather than a first-failure, because both can be true at
 * once and the player should be told about both — hiding the second breach
 * until the first is fixed is how you teach one lesson per five minutes.
 */
export function breachesFor(
  state: SafetyState,
  procedureId: string | null,
): SafetyBreach[] {
  const out: SafetyBreach[] = []
  if (!procedureId) return out
  // Gloves are required for ALL patient contact, including an examination —
  // standard precautions do not scale with how invasive the procedure is.
  if (!state.gloved) out.push('no_gloves')
  if (requiresAnaesthesia(procedureId) && !state.anaesthetised) {
    out.push('no_anaesthesia')
  }
  return out
}

export interface BreachConsequence {
  primitive: ConsequencePrimitive
  intensity: 'minor' | 'moderate' | 'severe'
  /**
   * Shown to the player afterwards, so the pain teaches something.
   *
   * Bilingual at the source. A lesson that only exists in English is a lesson
   * half the intended audience cannot read.
   */
  lesson: { en: string; ar: string }
}

/**
 * What the breach does to the patient.
 *
 * Severity tracks the tissue involved, not drama for its own sake. Cutting
 * dentine without anaesthetic is sharp, brief pain; taking a tooth out of a live
 * socket is not — and a scream in a small clinic is heard in the waiting room,
 * which is why the severe case chains.
 *
 * `no_gloves` deliberately does NOT hurt the patient. It is a cross-infection
 * breach, invisible in the moment and serious later — so it is recorded and
 * marked, never turned into a yelp. Making it hurt would teach the wrong model.
 */
export function consequenceFor(
  breach: SafetyBreach,
  procedureId: string | null,
): BreachConsequence | null {
  if (breach === 'no_gloves') return null
  const severe = procedureId === 'p-extraction' || procedureId === 'p-rct'
  return severe
    ? {
        primitive: 'patient_scream',
        intensity: 'severe',
        lesson: {
          en:
            'You went into a live tooth. Local anaesthetic first — the pulp and ' +
            'periodontal ligament are innervated, and the patient felt all of it.',
          ar:
            'دخلت سنًا حيًا. التخدير الموضعي أولًا — اللب والرباط حول السني ' +
            'معصّبان، والمريض شعر بكل شيء.',
        },
      }
    : {
        primitive: 'patient_wince_vocal',
        intensity: 'moderate',
        lesson: {
          en:
            'Cutting dentine without anaesthetic hurts: the tubules carry fluid ' +
            'that moves when you cut, and that movement is what the nerve reads.',
          ar:
            'قطع العاج دون تخدير مؤلم: القنيات العاجية تحتوي سائلًا يتحرك عند ' +
            'القطع، وهذه الحركة هي ما يستشعره العصب.',
        },
      }
}

/** One-line prompts, EN and AR. Both locales or neither. */
export const BREACH_TEXT: Record<SafetyBreach, { en: string; ar: string }> = {
  no_gloves: {
    en: 'You touched the patient without gloves.',
    ar: 'لمست المريض دون قفازات.',
  },
  no_anaesthesia: {
    en: 'You started without anaesthetic.',
    ar: 'بدأت دون تخدير.',
  },
}
