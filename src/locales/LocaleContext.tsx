import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, type TranslationKey } from './en'
import { ar } from './ar'
import type { BiText } from '../content/schema'
import { loadSave, writeSave } from '../game/save'
import { pickText, type Locale } from './pickText'

export type { Locale }

interface LocaleValue {
  locale: Locale
  setLocale: (l: Locale) => void
  /** Translate a UI key, with optional {placeholder} substitution. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  /** Read content text, falling back to English wherever Arabic is absent. */
  c: (text: BiText) => string
  /** +1 in LTR, -1 in RTL. Multiply every animated x offset by this. */
  dir: 1 | -1
  isRtl: boolean
}

const LocaleContext = createContext<LocaleValue | null>(null)

const DICTS = { en, ar } as const

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => loadSave().locale)

  useEffect(() => {
    const root = document.documentElement
    root.lang = locale
    root.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  // LocaleProvider is the only writer of `locale`; it read-modify-writes so a
  // concurrent progress save can't clobber the choice.
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    writeSave({ ...loadSave(), locale: l })
  }, [])

  const value = useMemo<LocaleValue>(() => {
    const dict = DICTS[locale]
    return {
      locale,
      setLocale,
      isRtl: locale === 'ar',
      dir: locale === 'ar' ? -1 : 1,
      t: (key, vars) => {
        let s: string = dict[key] ?? en[key]
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            s = s.replaceAll(`{${k}}`, String(v))
          }
        }
        return s
      },
      c: (text) => pickText(text, locale),
    }
  }, [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocale(): LocaleValue {
  const v = useContext(LocaleContext)
  if (!v) throw new Error('useLocale must be used inside LocaleProvider')
  return v
}
