import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { ClinicDay, DecisionQuality } from '../content/schema'
import { useLocale } from '../locales/LocaleContext'
import { DECISION_POINTS } from '../game/scoring'
import { seededShuffle } from '../game/questionBank'
import { patientForCase, portraitUrl, type Mood } from '../game/cast'
import { popIn, slideVariants, springy } from '../ui/motion'

export interface TreatResult {
  score: number
  maxScore: number
  missed: { prompt: string; explanation: string; source: string }[]
}

interface Props {
  day: ClinicDay
  onDone: (result: TreatResult) => void
}

const QUALITY_CLASS: Record<DecisionQuality, string> = {
  best: 'correct',
  acceptable: 'acceptable',
  poor: 'wrong',
}

const QUALITY_FEEDBACK: Record<DecisionQuality, string> = {
  best: 'good',
  acceptable: 'mid',
  poor: 'bad',
}

/**
 * The face in the chair. Falls back to the case's emoji if the portrait is
 * missing — a generated day must never break because art wasn't sliced for it.
 */
function PatientFace({
  id,
  mood,
  fallback,
}: {
  id: string
  mood: Mood
  fallback: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="patient-avatar" aria-hidden>
        {fallback}
      </span>
    )
  }
  return (
    <img
      src={portraitUrl(id, mood)}
      alt=""
      className="patient-portrait"
      onError={() => setFailed(true)}
    />
  )
}

export function Treat({ day, onDone }: Props) {
  const { t, c, dir } = useLocale()
  const patientCase = day.treat.cases[0]
  // Deterministic and age-matched: the same day always shows the same face, so
  // a patient you remember is a case you remember.
  const cast = useMemo(
    () => patientForCase(day.id, patientCase.patient.age),
    [day.id, patientCase.patient.age],
  )

  const [briefed, setBriefed] = useState(false)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<TreatResult['missed']>([])

  const decision = patientCase.decisions[index]
  const total = patientCase.decisions.length
  const maxScore = total * DECISION_POINTS.best

  const options = useMemo(
    () => seededShuffle(decision.options, index + 13),
    [decision, index],
  )

  const answered = picked !== null
  const pickedOption = options.find((o) => o.id === picked)

  function choose(id: string) {
    if (answered) return
    const opt = options.find((o) => o.id === id)!
    setPicked(id)
    setScore((s) => s + DECISION_POINTS[opt.quality])
    if (opt.quality !== 'best') {
      const bestOption = options.find((o) => o.quality === 'best')!
      setMissed((m) => [
        ...m,
        {
          prompt: c(decision.prompt),
          explanation: c(bestOption.feedback),
          source: bestOption.sourceRef ? c(bestOption.sourceRef) : '',
        },
      ])
    }
  }

  function next() {
    if (index + 1 < total) {
      setIndex(index + 1)
      setPicked(null)
    } else {
      onDone({ score, maxScore, missed })
    }
  }

  if (!briefed) {
    return (
      <motion.div className="stack" variants={popIn} initial="enter" animate="center">
        <div className="card">
          <div className="section-title">
            {t('afternoon')} · {t('treatMission')}
          </div>
          <h1>{c(day.treat.missionTitle)}</h1>
        </div>

        <div className="card">
          <div className="patient-head">
            <PatientFace
              id={cast.id}
              mood="pain"
              fallback={patientCase.patient.avatar}
            />
            <div>
              <h2 style={{ margin: 0 }}>{c(patientCase.patient.name)}</h2>
              <div className="muted">{patientCase.patient.age}</div>
            </div>
          </div>

          <div style={{ marginBlockStart: 16 }}>
            <div className="section-title">{t('chiefComplaint')}</div>
            <p>{c(patientCase.chiefComplaint)}</p>
          </div>

          <div style={{ marginBlockStart: 16 }}>
            <div className="section-title">{t('history')}</div>
            <p className="muted">{c(patientCase.history)}</p>
          </div>

          <div style={{ marginBlockStart: 16 }}>
            <div className="section-title">{t('findings')}</div>
            <ul className="finding-list">
              {patientCase.findings.map((f, i) => (
                <li key={i}>{c(f)}</li>
              ))}
            </ul>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => setBriefed(true)}>
          {t('continueCase')}
        </button>
      </motion.div>
    )
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="patient-head">
          {/* The face answers back: relief when you chose well, pain when you
              didn't. It is the fastest feedback in the screen. */}
          <PatientFace
            id={cast.id}
            mood={
              !answered
                ? 'anxious'
                : pickedOption?.quality === 'best'
                  ? 'relieved'
                  : 'pain'
            }
            fallback={patientCase.patient.avatar}
          />
          <div style={{ flex: 1 }}>
            <div className="slot-title">{c(patientCase.patient.name)}</div>
            <div className="progress-track" style={{ marginBlockStart: 8 }}>
              <motion.div
                className="progress-fill"
                animate={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }}
                transition={springy}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Keyed remount rather than AnimatePresence — see the note in Prep.tsx. */}
      <motion.div
        key={decision.id}
        className="card"
        variants={slideVariants(dir)}
        initial="enter"
        animate="center"
        transition={springy}
      >
        <div className="section-title">{t('decisionOf', { n: index + 1, total })}</div>
        <h2>{c(decision.prompt)}</h2>

        <div className="option-list" style={{ marginBlockStart: 12 }}>
          {options.map((opt) => {
            let cls = 'option'
            if (answered && (opt.id === picked || opt.quality === 'best')) {
              cls += ` ${QUALITY_CLASS[opt.quality]}`
            }
            return (
              <button
                key={opt.id}
                className={cls}
                disabled={answered}
                onClick={() => choose(opt.id)}
              >
                {c(opt.label)}
              </button>
            )
          })}
        </div>

        {answered && pickedOption && (
          <motion.div
            className={`feedback ${QUALITY_FEEDBACK[pickedOption.quality]}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="feedback-title">
              {pickedOption.quality === 'best'
                ? `✅ ${t('correct')}`
                : `⚠️ ${t('notQuite')}`}
            </div>
            <p>{c(pickedOption.feedback)}</p>
            {pickedOption.sourceRef && (
              <div className="source-ref">
                {t('source')}: {c(pickedOption.sourceRef)}
              </div>
            )}
          </motion.div>
        )}

        {answered && (
          <button className="btn btn-primary" style={{ marginBlockStart: 14 }} onClick={next}>
            {index + 1 < total ? t('continueCase') : t('clinicClosed')}
          </button>
        )}
      </motion.div>
    </div>
  )
}
