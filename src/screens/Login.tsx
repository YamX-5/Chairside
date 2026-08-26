import { useState } from 'react'
import { motion } from 'motion/react'
import { useLocale } from '../locales/LocaleContext'
import { DOCTORS, portraitUrl, bodyUrl, type Track } from '../game/cast'
import { listStagger, popIn } from '../ui/motion'

interface Props {
  onSignIn: (displayName: string, doctorId: string, track: Track) => void
}

/**
 * Sign-in doubles as character select: the doctor you pick IS your track, so
 * "dentist or physician" is a choice you make by looking at faces rather than
 * reading a dropdown.
 */
export function Login({ onSignIn }: Props) {
  const { t, c } = useLocale()
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string | null>(null)

  const doctor = DOCTORS.find((d) => d.id === picked)
  const ready = name.trim().length > 0 && doctor

  return (
    <motion.div className="stack" variants={listStagger} initial="enter" animate="center">
      <motion.div className="card login-hero" variants={popIn}>
        <div className="section-title">{t('appName')}</div>
        <h1>{t('loginTitle')}</h1>
        <p className="muted">{t('loginBlurb')}</p>
      </motion.div>

      <motion.div className="card" variants={popIn}>
        <div className="section-title">{t('yourName')}</div>
        <input
          className="text-input"
          value={name}
          maxLength={40}
          placeholder={t('yourNamePlaceholder')}
          onChange={(e) => setName(e.target.value)}
        />
      </motion.div>

      <motion.div className="card" variants={popIn}>
        <div className="section-title">{t('chooseCharacter')}</div>
        <p className="muted">{t('chooseCharacterHint')}</p>
        <div className="doctor-grid">
          {DOCTORS.map((d) => (
            <button
              key={d.id}
              className={`doctor-card ${picked === d.id ? 'picked' : ''}`}
              onClick={() => setPicked(d.id)}
            >
              <img
                src={portraitUrl(d.id, 'calm')}
                alt=""
                className="doctor-face"
                loading="lazy"
                width={128}
                height={128}
              />
              <span className="doctor-name">{c(d.name)}</span>
              <span className="doctor-role">{c(d.role)}</span>
              <span className={`track-chip track-${d.track}`}>
                {d.track === 'dental' ? t('trackDental') : t('trackMedical')}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {doctor && (
        <motion.div className="card doctor-preview" variants={popIn}>
          <img src={bodyUrl(doctor.id)} alt="" className="doctor-body" loading="lazy" />
          <div>
            <h2>{c(doctor.name)}</h2>
            <p className="muted">{c(doctor.role)}</p>
          </div>
        </motion.div>
      )}

      <motion.div variants={popIn}>
        <button
          className="btn btn-primary"
          disabled={!ready}
          onClick={() => doctor && onSignIn(name.trim(), doctor.id, doctor.track)}
        >
          {t('startShift')}
        </button>
      </motion.div>
    </motion.div>
  )
}
