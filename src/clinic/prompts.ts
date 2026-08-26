/**
 * The big "press E to …" prompt, and every word it can say.
 *
 * WHY IT IS A MODULE AND NOT JSX
 * ------------------------------
 * The clinic's hints lived as inline JSX inside one enormous ternary in
 * `ClinicCase`'s HUD — English only, unreadable, and impossible to test. A
 * player standing in front of a drawer got a small grey sentence at the bottom
 * of the screen among four other clauses.
 *
 * Real games put ONE line in the middle of the view: the key, and the verb.
 * That is a rendering decision, but which verb is a data decision, and data is
 * testable. `promptFor()` is pure, so `prompts.test.ts` can assert that every
 * reachable state says something, in both locales.
 *
 * Bilingual pairs are colocated here rather than split across locales/en.ts and
 * ar.ts, matching BREACH_TEXT in protection.ts and XRAY_TEXT in radiograph.ts:
 * these strings only ever appear inside the 3D clinic, and a string whose two
 * halves live in distant files is a string that ships in one language.
 */

import type { InteractableId } from './layout'

export interface Bi {
  en: string
  ar: string
}

export interface PromptState {
  /** What the player is standing next to, or null. */
  near: InteractableId | null
  gloved: boolean
  /** An instrument is in hand. */
  holding: string | null
  /** The label of the held instrument, for the treat verb. */
  holdingLabel?: string
  anaesthetised: boolean
  /** True once this particular drawer is open. */
  drawerOpen: boolean
  /** Morning gate: nothing starts until the desk has been used. */
  studied: boolean
  /** She is in the chair and the plan is committed. */
  canTreat: boolean
}

/** Every fixed line the prompt can show. */
export const PROMPT_TEXT = {
  study: { en: 'Review this morning’s material', ar: 'راجع مادة هذا الصباح' },
  studyAgain: { en: 'Read your notes again', ar: 'اقرأ ملاحظاتك مرة أخرى' },
  glovesOn: { en: 'Put gloves on', ar: 'ارتدِ القفازات' },
  glovesOff: { en: 'Take the gloves off', ar: 'اخلع القفازات' },
  drawerOpen: { en: 'Open the drawer', ar: 'افتح الدرج' },
  drawerClose: { en: 'Close the drawer', ar: 'أغلق الدرج' },
  board: { en: 'Check your reputation', ar: 'تفقّد سمعتك' },
  takeXray: { en: 'Take the portable X-ray', ar: 'خذ جهاز الأشعة المحمول' },
  stowXray: { en: 'Put the X-ray back', ar: 'أعد جهاز الأشعة إلى مكانه' },
  door: { en: 'Leave the clinic', ar: 'غادر العيادة' },
  anaesthetise: { en: 'Give the anaesthetic', ar: 'أعطِ التخدير' },
  alreadyNumb: { en: 'She is already numb', ar: 'هي مخدّرة بالفعل' },
  radiograph: { en: 'Take a radiograph', ar: 'التقط صورة شعاعية' },
  needInstrument: { en: 'Take an instrument first', ar: 'خذ أداة أولاً' },
  deskFirst: { en: 'Study at the desk first', ar: 'ادرس على المكتب أولاً' },
  sit: { en: 'Sit down', ar: 'اجلس' },
  stand: { en: 'Stand up', ar: 'انهض' },
} as const

/** "Treat her with the mouth mirror" — the tool's own name is interpolated. */
export const TREAT_WITH: Bi = {
  en: 'Treat her with the {tool}',
  ar: 'عالجها باستخدام {tool}',
}

export function fill(text: Bi, vars: Record<string, string>): Bi {
  let en = text.en
  let ar = text.ar
  for (const [k, v] of Object.entries(vars)) {
    en = en.replaceAll(`{${k}}`, v)
    ar = ar.replaceAll(`{${k}}`, v)
  }
  return { en, ar }
}

/**
 * The one line to show in the middle of the screen, or null for nothing.
 *
 * Order matters and is deliberate: the most specific, most consequential action
 * available at this spot wins. Standing at the chair holding a syringe offers
 * the anaesthetic, not "treat her" — performing the committed procedure with an
 * anaesthetic needle is a mistake the prompt should not invite.
 */
export function promptFor(s: PromptState): Bi | null {
  switch (s.near) {
    case 'study':
      return s.studied ? PROMPT_TEXT.studyAgain : PROMPT_TEXT.study

    case 'gloves':
      return s.gloved ? PROMPT_TEXT.glovesOff : PROMPT_TEXT.glovesOn

    case 'drawer':
      return s.drawerOpen ? PROMPT_TEXT.drawerClose : PROMPT_TEXT.drawerOpen

    case 'board':
      return PROMPT_TEXT.board

    case 'xray':
      return s.holding === 'xray' ? PROMPT_TEXT.stowXray : PROMPT_TEXT.takeXray

    case 'door':
      return PROMPT_TEXT.door

    case 'solve': {
      // Nothing to do at the chair until the morning is done and she is planned.
      if (!s.studied) return PROMPT_TEXT.deskFirst
      if (!s.canTreat) return null
      if (!s.holding) return PROMPT_TEXT.needInstrument
      if (s.holding === 'syringe') {
        return s.anaesthetised ? PROMPT_TEXT.alreadyNumb : PROMPT_TEXT.anaesthetise
      }
      // The X-ray images; it never treats.
      if (s.holding === 'xray') return PROMPT_TEXT.radiograph
      return fill(TREAT_WITH, { tool: (s.holdingLabel ?? 'instrument').toLowerCase() })
    }

    default:
      return null
  }
}
