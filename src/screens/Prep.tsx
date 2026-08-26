import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { ClinicDay } from '../content/schema'
import { useLocale } from '../locales/LocaleContext'
import { PREP_CORRECT_POINTS, PREP_WRONG_POINTS } from '../game/scoring'
import { seededShuffle } from '../game/questionBank'
import { slideVariants, springy } from '../ui/motion'

export interface PrepResult {
  score: number
  missed: { prompt: string; explanation: string; source: string }[]
}

interface Props {
  day: ClinicDay
  onDone: (result: PrepResult) => void
}

export function Prep({ day, onDone }: Props) {
  const { t, c, dir } = useLocale()
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<PrepResult['missed']>([])

  const chunk = day.prep.chunks[index]
  const total = day.prep.chunks.length

  // Shuffled per chunk so answer position is never a tell, but stable per render.
  const options = useMemo(
    () => seededShuffle(chunk.question.options, index + 7),
    [chunk, index],
  )

  const answered = picked !== null
  const pickedOption = options.find((o) => o.id === picked)
  const wasRight = pickedOption?.isCorrect === true

  function choose(id: string) {
    if (answered) return
    const opt = options.find((o) => o.id === id)!
    setPicked(id)
    if (opt.isCorrect) {
      setScore((s) => s + PREP_CORRECT_POINTS)
    } else {
      setScore((s) => s + PREP_WRONG_POINTS)
      setMissed((m) => [
        ...m,
        {
          prompt: c(chunk.question.prompt),
          explanation: c(chunk.question.explanation),
          source: c(chunk.question.sourceRef),
        },
      ])
    }
  }

  function next() {
    if (index + 1 < total) {
      setIndex(index + 1)
      setPicked(null)
    } else {
      onDone({ score, missed })
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="section-title">
          {t('morning')} · {t('prepMission')}
        </div>
        <h1>{c(day.prep.missionTitle)}</h1>
        <p className="muted">{c(day.prep.briefing)}</p>
        <div className="progress-track" style={{ marginBlockStart: 14 }}>
          <motion.div
            className="progress-fill"
            animate={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }}
            transition={springy}
          />
        </div>
      </div>

      {/*
        A keyed remount, not AnimatePresence: `mode="wait"` never resolves its
        exit here (React 19 StrictMode + Motion 12) and freezes the screen.
        Changing the key remounts the card and replays the enter animation.
      */}
      <motion.div
        key={chunk.id}
        className="card"
        variants={slideVariants(dir)}
        initial="enter"
        animate="center"
        transition={springy}
      >
        <div className="section-title">{t('chunkOf', { n: index + 1, total })}</div>
        <h2>{c(chunk.title)}</h2>
        <p className="muted">{c(chunk.body)}</p>

        <div style={{ marginBlockStart: 18 }}>
          <h2>{c(chunk.question.prompt)}</h2>
          <div className="option-list" style={{ marginBlockStart: 10 }}>
            {options.map((opt) => {
              let cls = 'option'
              if (answered) {
                if (opt.isCorrect) cls += ' correct'
                else if (opt.id === picked) cls += ' wrong'
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
        </div>

        {answered && (
          <motion.div
            className={`feedback ${wasRight ? 'good' : 'bad'}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="feedback-title">
              {wasRight ? `✅ ${t('correct')}` : `⚠️ ${t('notQuite')}`}
            </div>
            <p>{c(chunk.question.explanation)}</p>
            <div className="source-ref">
              {t('source')}: {c(chunk.question.sourceRef)}
            </div>
          </motion.div>
        )}

        {answered && (
          <button className="btn btn-primary" style={{ marginBlockStart: 14 }} onClick={next}>
            {index + 1 < total ? t('next') : t('seePatient')}
          </button>
        )}
      </motion.div>
    </div>
  )
}
