/**
 * The radiograph the portable X-ray shows — and, more importantly, what it
 * refuses to show.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * The film is the one asset in the game that a student could be genuinely
 * harmed by. Everything else — a wrong instrument, a missed anaesthetic — is a
 * mistake they make and get told about. A radiograph is different: they LOOK at
 * it and take away a visual memory of what pathology looks like. If the picture
 * is invented, that memory is false, and they will carry it into a real mouth.
 *
 * So the rule this module exists to enforce is: we show the film that came out
 * of the student's own lecture deck, or we show nothing and say so plainly. We
 * never draw one, never substitute a stock image, never "approximate" it.
 * `CasePapers.tsx` already had a black rectangle reading "radiograph" for
 * exactly this reason; this replaces the placeholder with the real image when
 * the deck actually contained one, and keeps the honest blank when it did not.
 *
 * Pure data, no three.js and no React — so the rules are testable headless.
 */

import type { BiText, PatientCase } from '../content/schema'

/** The film as it is carried on a case, once the pipeline has bound one. */
export type Film = NonNullable<PatientCase['radiograph']>

export type FilmView =
  /**
   * A real image from the student's own deck.
   *
   * `shows` is a BiText, whose `ar` is OPTIONAL — the caption is generated from
   * the deck, and a deck in English produces an English-only caption. `c()`
   * falls back to English for exactly this case. Typing it as a required pair
   * would be a lie about generated content, and `tsc -b` catches it.
   */
  | { kind: 'film'; src: string; shows: BiText; page?: number }
  /** The deck had no usable radiograph. Say so; do not improvise. */
  | { kind: 'empty' }

/**
 * What the viewer should render for this case.
 *
 * Deliberately total: an absent, malformed or empty-src radiograph all collapse
 * to `empty` rather than throwing, because a generated case is not trusted
 * input and a crash mid-encounter is worse than a blank film.
 */
export function filmView(radiograph: Film | undefined | null): FilmView {
  if (!radiograph) return { kind: 'empty' }
  const src = typeof radiograph.src === 'string' ? radiograph.src.trim() : ''
  if (!src) return { kind: 'empty' }
  return {
    kind: 'film',
    src,
    shows: radiograph.shows,
    page: radiograph.page,
  }
}

/**
 * Can the player view a film right now?
 *
 * Holding the X-ray is required. Not a technicality — it is the whole reason
 * the device sits across the room on a shelf instead of being a button on the
 * HUD. Fetching it is the cost of the image.
 */
export function canShoot(heldInstrumentId: string | null): boolean {
  return heldInstrumentId === 'xray'
}

/**
 * Every user-facing string this feature needs, in both locales.
 *
 * Colocated as bilingual pairs rather than added to `locales/en.ts` + `ar.ts`,
 * matching `BREACH_TEXT` in protection.ts: these strings only ever appear
 * inside the 3D clinic, and splitting them across two distant files is how a
 * string ends up shipping in English only.
 */
export const XRAY_TEXT = {
  take: {
    en: 'Take the portable X-ray',
    ar: 'خذ جهاز الأشعة المحمول',
  },
  putBack: {
    en: 'Put the X-ray back',
    ar: 'أعد جهاز الأشعة إلى مكانه',
  },
  shoot: {
    en: 'Take a radiograph',
    ar: 'التقط صورة شعاعية',
  },
  needIt: {
    en: 'You need the portable X-ray in your hand.',
    ar: 'تحتاج إلى جهاز الأشعة المحمول في يدك.',
  },
  title: {
    en: 'Radiograph',
    ar: 'صورة شعاعية',
  },
  noFilm: {
    en: 'No film on file for this patient.',
    ar: 'لا توجد صورة شعاعية في ملف هذا المريض.',
  },
  /** The honest reason, so a blank never reads as a bug. */
  noFilmWhy: {
    en: 'This lecture contained no usable radiograph, so none is shown. Nothing here is drawn or invented.',
    ar: 'لم تحتوِ هذه المحاضرة على صورة شعاعية صالحة، لذلك لا تُعرض أي صورة. لا شيء هنا مرسوم أو مُختلق.',
  },
  fromPage: {
    en: 'From page {n} of your lecture',
    ar: 'من صفحة {n} من محاضرتك',
  },
  close: {
    en: 'Close',
    ar: 'إغلاق',
  },
} as const

export type XrayTextKey = keyof typeof XRAY_TEXT
