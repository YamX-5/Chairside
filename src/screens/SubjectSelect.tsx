import { motion } from 'motion/react'
import type { ClinicDay } from '../content/schema'
import { useLocale } from '../locales/LocaleContext'
import { sceneUrl, type Track } from '../game/cast'
import { listStagger, popIn } from '../ui/motion'

interface Props {
  days: ClinicDay[]
  track: Track
  onPick: (subject: string | null) => void
  onImport: () => void
}

export interface SubjectEntry {
  /** Matched against ClinicDay.subject.en — the stable key. */
  key: string
  label: { en: string; ar?: string }
  dayCount: number
}

/** Subjects are derived from the content that actually exists for this track. */
export function subjectsFor(days: ClinicDay[], track: Track): SubjectEntry[] {
  const map = new Map<string, SubjectEntry>()
  for (const day of days) {
    if ((day.track ?? 'dental') !== track) continue
    const key = day.subject.en
    const existing = map.get(key)
    if (existing) existing.dayCount++
    else map.set(key, { key, label: day.subject, dayCount: 1 })
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export function SubjectSelect({ days, track, onPick, onImport }: Props) {
  const { t, c } = useLocale()
  const subjects = subjectsFor(days, track)

  return (
    <motion.div className="stack" variants={listStagger} initial="enter" animate="center">
      <motion.div className="card" variants={popIn}>
        <div className="section-title">{t('chooseSubject')}</div>
        <h1>{track === 'dental' ? t('trackDental') : t('trackMedical')}</h1>
        <p className="muted">{t('chooseSubjectHint')}</p>
      </motion.div>

      {subjects.length === 0 && (
        <motion.div className="card" variants={popIn}>
          <div className="feedback mid">
            <div className="feedback-title">{t('noSubjects')}</div>
            <p>{t('noSubjectsHint')}</p>
          </div>
        </motion.div>
      )}

      {subjects.map((s) => (
        <motion.div key={s.key} variants={popIn}>
          <button className="card subject-card" onClick={() => onPick(s.key)}>
            <img src={sceneUrl(track)} alt="" className="subject-art" loading="lazy" />
            <span className="subject-body">
              <span className="slot-title">{c(s.label)}</span>
              <span className="slot-sub">{t('dayCount', { n: s.dayCount })}</span>
            </span>
          </button>
        </motion.div>
      ))}

      <motion.div variants={popIn}>
        <button className="btn btn-primary" onClick={onImport}>
          📄 {t('importTitle')}
        </button>
      </motion.div>

      {subjects.length > 0 && (
        <motion.div variants={popIn}>
          <button className="btn btn-ghost" onClick={() => onPick(null)}>
            {t('allSubjects')}
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}
