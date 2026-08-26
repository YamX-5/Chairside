import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { ClinicDay } from '../content/schema'
import { useLocale } from '../locales/LocaleContext'
import { Prep, type PrepResult } from './Prep'
import { Treat, type TreatResult } from './Treat'
import { DayClose, type DaySummary } from './DayClose'
import { Flashcards } from './Flashcards'
import { patientForCase } from '../game/cast'

/**
 * The cinematic, scene-based clinic — the real direction.
 *
 * No primitive 3D. Each beat is a full-screen scene (rendered backgrounds drop
 * into public/scenes/*.jpg; a designed warm gradient stands in until then) with
 * the actual generated patient character composited on top. The player moves
 * beat-to-beat through Yaman's loop:
 *   arrive → mission → study → flashcards → patient called → case → close
 *
 * NOTE: no `AnimatePresence mode="wait"` — it deadlocks under React 19
 * StrictMode (see SOLUTIONS.md). Each beat is a keyed, enter-only motion.div.
 */

/**
 * Walk-through transition. Plays scenes/<clip>.mp4 fullscreen (a first-person
 * walk you generate in Higgsfield), then lands in the next beat. A missing clip
 * errors instantly and just falls through to the scene's own dolly-in.
 */
function TransitionClip({ src, onDone }: { src: string; onDone: () => void }) {
  const done = useRef(false)
  const [ready, setReady] = useState(false)
  const finish = () => {
    if (!done.current) {
      done.current = true
      onDone()
    }
  }
  return (
    <motion.div
      className="cine-transition"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <video
        className="cine-transition-video"
        style={{ opacity: ready ? 1 : 0 }}
        src={src}
        autoPlay
        muted
        playsInline
        onCanPlay={() => setReady(true)}
        onEnded={finish}
        onError={finish}
      />
      <button className="cine-skip-trans" onClick={finish}>
        {'⏭'}
      </button>
    </motion.div>
  )
}

interface Props {
  day: ClinicDay
  coins: number
  streak: number
  onFinish: (dayId: string, prep: PrepResult, treat: TreatResult) => DaySummary
  onExit: () => void
}

type Beat = 'arrive' | 'study' | 'flashcards' | 'waiting' | 'case' | 'close'

const BASE = import.meta.env.BASE_URL

/**
 * The moving background. Three layers, best available wins:
 *  1. scenes/<name>.mp4 — a looping video (real movement) — "Turn to video"
 *     your render in Higgsfield and drop it in.
 *  2. scenes/<name>.jpg — a still with a slow Ken Burns drift so it breathes.
 *  3. the designed --scene-* gradient (also gently drifts).
 * Missing files simply fall through — nothing breaks.
 */
function SceneBackground({ name, fallbackVar }: { name: string; fallbackVar: string }) {
  const [noVideo, setNoVideo] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  return (
    <div className="cine-bg" style={{ background: `var(${fallbackVar})` }}>
      <div
        className="cine-bg-img"
        style={{ backgroundImage: `url("${BASE}scenes/${name}.jpg")` }}
      />
      {!noVideo && (
        // Invisible until it can actually play, so a MISSING clip never shows
        // as a black box over the scene.
        <video
          className="cine-bg-video"
          style={{ opacity: videoReady ? 1 : 0 }}
          autoPlay
          loop
          muted
          playsInline
          onCanPlay={() => setVideoReady(true)}
          onError={() => setNoVideo(true)}
          src={`${BASE}scenes/${name}.mp4`}
        />
      )}
    </div>
  )
}

export default function CinematicClinic({ day, coins, streak, onFinish, onExit }: Props) {
  const { t, c } = useLocale()
  const [beat, setBeat] = useState<Beat>('arrive')
  const [showMission, setShowMission] = useState(false)
  const [prep, setPrep] = useState<PrepResult | null>(null)
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [transTo, setTransTo] = useState<{ beat: Beat; clip: string } | null>(null)

  // Move to the next beat. If a real walk-through clip exists, play it first;
  // otherwise go straight to the scene (its own dolly-in). We PROBE the clip
  // because the dev server returns index.html (200) for a missing file, which
  // would otherwise hang a <video> forever.
  function go(next: Beat, clip: string) {
    const url = `${BASE}scenes/${clip}.mp4`
    fetch(url, { method: 'HEAD' })
      .then((r) => {
        if (r.ok && (r.headers.get('content-type') ?? '').includes('video')) {
          setTransTo({ beat: next, clip: url })
        } else {
          setBeat(next)
        }
      })
      .catch(() => setBeat(next))
  }

  const patient = useMemo(
    () => patientForCase(day.id, day.treat.cases[0].patient.age),
    [day],
  )

  // Mission notification slides in shortly after arrival — timer-driven so it
  // never depends on an animation-complete callback that might not fire.
  useEffect(() => {
    if (beat !== 'arrive') return
    setShowMission(false)
    const id = window.setTimeout(() => setShowMission(true), 650)
    return () => window.clearTimeout(id)
  }, [beat])

  function finishCase(treat: TreatResult) {
    setSummary(onFinish(day.id, prep ?? { score: 0, missed: [] }, treat))
    setBeat('close')
  }

  const pc = day.treat.cases[0]

  return (
    <div className="cine-root">
      <div className="cine-hud">
        <span className="cine-pill">🔥 {streak}</span>
        <span className="cine-pill">🪙 {coins}</span>
        <span className="cine-pill cine-day">{c(day.title)}</span>
        <button className="cine-leave" onClick={onExit}>
          {t('exitClinic')}
        </button>
      </div>

      {/* ── ARRIVE + mission notification ── */}
      {beat === 'arrive' && (
        <motion.div
          key="arrive"
          className="cine-scene"
          initial={{ opacity: 0, scale: 1.09 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <SceneBackground name="clinic" fallbackVar="--scene-clinic" />
          <div className="cine-vignette" />
          {showMission && (
            <motion.div
              className="mission-card"
              initial={{ y: -36, opacity: 0, scale: 0.92 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              <div className="mission-tag">📋 {t('treatMission')}</div>
              <h2>{c(day.treat.missionTitle)}</h2>
              <p className="muted">{c(day.subject)}</p>
              <button className="btn btn-primary" onClick={() => go('study', 'to-desk')}>
                {t('promptStudy')} →
              </button>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ── STUDY (desk) ── */}
      {beat === 'study' && (
        <motion.div
          key="study"
          className="cine-scene cine-scroll"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <SceneBackground name="desk" fallbackVar="--scene-desk" />
          <div className="cine-panel">
            <div className="cine-scene-tag">🪑 {t('morning')} · {t('promptStudy')}</div>
            <Prep day={day} onDone={(r) => { setPrep(r); setBeat('flashcards') }} />
          </div>
        </motion.div>
      )}

      {/* ── FLASHCARDS (active recall) ── */}
      {beat === 'flashcards' && (
        <motion.div
          key="flashcards"
          className="cine-scene cine-scroll"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <SceneBackground name="desk" fallbackVar="--scene-desk" />
          <div className="cine-panel">
            <Flashcards day={day} onDone={() => go('waiting', 'to-clinic')} />
          </div>
        </motion.div>
      )}

      {/* ── WAITING: patient is called in ── */}
      {beat === 'waiting' && (
        <motion.div
          key="waiting"
          className="cine-scene"
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <SceneBackground name="clinic" fallbackVar="--scene-clinic" />
          <div className="cine-vignette" />
          <motion.div
            className="mission-card"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
          >
            <div className="mission-tag">🩺 {t('afternoon')}</div>
            <h2>{c(pc.patient.name)}, {pc.patient.age}</h2>
            <p className="muted">{c(pc.chiefComplaint)}</p>
            <button className="btn btn-primary" onClick={() => go('case', 'to-chair')}>
              {t('promptSolve')} →
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* ── CASE: rendered patient seated, decisions as a bottom sheet ── */}
      {beat === 'case' && (
        <motion.div
          key="case"
          className="cine-scene cine-case"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <SceneBackground name="chair" fallbackVar="--scene-chair" />
          <div className="cine-vignette" />
          <motion.img
            key={patient.id}
            src={`${BASE}sprites/patient-in-pain.png`}
            alt=""
            className="cine-patient"
            initial={{ y: 130, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
          <div className="cine-case-panel">
            <Treat day={day} onDone={finishCase} />
          </div>
        </motion.div>
      )}

      {/* ── CLOSE ── */}
      {beat === 'close' && summary && (
        <motion.div
          key="close"
          className="cine-scene cine-scroll"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <SceneBackground name="clinic" fallbackVar="--scene-clinic" />
          <div className="cine-panel">
            <DayClose day={day} summary={summary} onBack={onExit} />
          </div>
        </motion.div>
      )}

      {/* Walk-through transition overlay (plays over the current scene). */}
      {transTo && (
        <TransitionClip
          src={transTo.clip}
          onDone={() => {
            setBeat(transTo.beat)
            setTransTo(null)
          }}
        />
      )}
    </div>
  )
}
