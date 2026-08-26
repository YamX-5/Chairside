import type { BiText } from '../content/schema'

export type Locale = 'en' | 'ar'

/**
 * English is the study language, so it is both the content and the fallback.
 * Arabic renders only where it was actually written.
 */
export function pickText(text: BiText, locale: Locale): string {
  if (locale === 'ar' && text.ar) return text.ar
  return text.en
}
