import { motion } from 'motion/react'
import type { ClinicDay } from '../content/schema'
import { useLocale } from '../locales/LocaleContext'
import type { OutcomeTier } from '../game/scoring'
import { listStagger, popIn, springy } from '../ui/motion'

export interface DaySummary {
  tier: OutcomeTier
  stars: number
  score: number
  coins: number
  streak: number
  missed: { prompt: string; explanation: string; source: string }[]
}

interface Props {
  day: ClinicDay
  summary: DaySummary
  onBack: () => void
}

export function DayClose({ day, summary, onBack }: Props) {
  const { t, c } = useLocale()
  const outcomeText = day.treat.cases[0].outcome[summary.tier]

  return (
    <motion.div className="stack" variants={listStagger} initial="enter" animate="center">
      <motion.div className="card" variants={popIn}>
        <div className="section-title">{t('clinicClosed')}</div>
        <motion.div
          className="stars"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...springy, delay: 0.1 }}
        >
          {'★'.repeat(summary.stars)}
          <span style={{ opacity: 0.25 }}>{'★'.repeat(3 - summary.stars)}</span>
        </motion.div>

        <div className="result-grid">
          <div className="result-cell">
            <div className="result-value">{summary.score}</div>
            <div className="result-label">{t('score')}</div>
          </div>
          <div className="result-cell">
            <div className="result-value">+{summary.coins}</div>
            <div className="result-label">{t('coinsEarned')}</div>
          </div>
          <div className="result-cell">
            <div className="result-value">🔥{summary.streak}</div>
            <div className="result-label">{t('streakNow')}</div>
          </div>
        </div>
      </motion.div>

      <motion.div className="card" variants={popIn}>
        <p>{c(outcomeText)}</p>
      </motion.div>

      <motion.div className="card" variants={popIn}>
        <div className="section-title">{t('reviewMissed')}</div>
        {summary.missed.length === 0 ? (
          <p className="muted">{t('nothingMissed')}</p>
        ) : (
          <div className="stack">
            {summary.missed.map((m, i) => (
              <div key={i} className="feedback mid">
                <div className="feedback-title">{m.prompt}</div>
                <p>{m.explanation}</p>
                {m.source && (
                  <div className="source-ref">
                    {t('source')}: {m.source}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div className="row" variants={popIn}>
        <button className="btn btn-primary" onClick={onBack}>
          {t('backToTablet')}
        </button>
      </motion.div>
    </motion.div>
  )
}
