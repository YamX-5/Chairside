import type { ReactNode } from 'react'
import { useLocale } from '../locales/LocaleContext'

interface Props {
  coins: number
  streak: number
  children: ReactNode
}

export function Shell({ coins, streak, children }: Props) {
  const { t, locale, setLocale } = useLocale()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            🦷
          </span>
          <span>{t('appName')}</span>
        </div>
        <div className="stat-pills">
          <span className="pill" title={t('streakLabel')}>
            🔥 {streak}
          </span>
          <span className="pill" title={t('coinsLabel')}>
            🪙 {coins}
          </span>
          <button
            className="lang-btn"
            onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
          >
            {t('language')}
          </button>
        </div>
      </header>
      {children}
    </div>
  )
}
