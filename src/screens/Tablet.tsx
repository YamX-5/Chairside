import { motion } from 'motion/react'
import type { ClinicDay } from '../content/schema'
import { useLocale } from '../locales/LocaleContext'
import type { SaveData } from '../game/save'
import type { Profile } from '../game/profile'
import { getDoctor, portraitUrl } from '../game/cast'
import { listStagger, popIn } from '../ui/motion'

interface Props {
  days: ClinicDay[]
  save: SaveData
  profile: Profile
  /** Enter the first-person clinic — the main way to play a day. */
  onStartDay: (dayId: string) => void
  /** The tested 2D path, kept as a fallback for weak devices. */
  onStartClassic: (dayId: string) => void
  onImport: () => void
  onChangeSubject: () => void
  onSignOut: () => void
}

export function Tablet({
  days,
  save,
  profile,
  onStartDay,
  onStartClassic,
  onImport,
  onChangeSubject,
  onSignOut,
}: Props) {
  const { t, c } = useLocale()
  const doctor = getDoctor(profile.doctorId)

  return (
    <motion.div
      className="stack"
      variants={listStagger}
      initial="enter"
      animate="center"
    >
      <motion.div className="card" variants={popIn}>
        <div className="profile-strip">
          {doctor && (
            <img
              src={portraitUrl(doctor.id)}
              alt=""
              className="hud-avatar"
              loading="lazy"
            />
          )}
          <div className="profile-strip-body">
            <strong>{profile.displayName}</strong>
            <span className="muted">
              {profile.track === 'dental' ? t('trackDental') : t('trackMedical')}
              {profile.subject ? ` · ${profile.subject}` : ''}
            </span>
          </div>
          <div className="profile-strip-actions">
            <button className="btn btn-ghost" onClick={onChangeSubject}>
              {t('changeSubject')}
            </button>
            <button className="btn btn-ghost" onClick={onSignOut}>
              {t('signOut')}
            </button>
          </div>
        </div>
        <div className="section-title">{t('todaySchedule')}</div>
        <h1>{t('chooseDay')}</h1>
        <p className="muted">{t('tagline')}</p>
      </motion.div>

      {days.length === 0 && (
        <motion.div className="card" variants={popIn}>
          <div className="feedback mid">
            <div className="feedback-title">{t('noSubjects')}</div>
            <p>{t('noSubjectsHint')}</p>
          </div>
        </motion.div>
      )}

      {days.map((day) => {
        const record = save.completed.find((r) => r.dayId === day.id)
        return (
          <motion.div key={day.id} variants={popIn}>
            <button className="card slot" onClick={() => onStartDay(day.id)}>
              <span className="slot-icon" aria-hidden>
                {record ? '📋' : '🩺'}
              </span>
              <span className="slot-body">
                <span className="slot-title">{c(day.title)}</span>
                <span className="slot-sub">{c(day.subject)}</span>
                {day.isDemo && (
                  <span className="demo-badge" style={{ marginBlockStart: 8 }}>
                    {t('demoBadge')}
                  </span>
                )}
                {day.provenance && (
                  <span className="demo-badge" style={{ marginBlockStart: 8 }}>
                    {t('generatedBadge', { file: day.provenance.sourceFile })}
                  </span>
                )}
              </span>
              {record ? (
                <span className="slot-check">{'★'.repeat(record.stars)}</span>
              ) : (
                <span className="slot-time">{t('enterClinic')}</span>
              )}
            </button>
            <button
              className="btn btn-ghost slot-classic"
              onClick={() => onStartClassic(day.id)}
            >
              {t('classicMode')}
            </button>
          </motion.div>
        )
      })}

      <motion.div variants={popIn}>
        <button className="btn btn-primary" onClick={onImport}>
          📄 {t('importTitle')}
        </button>
      </motion.div>

    </motion.div>
  )
}
