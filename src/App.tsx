import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ALL_DAYS } from './content'
import { loadLibrary } from './content/library'
import { Shell } from './ui/Shell'
import { Tablet } from './screens/Tablet'
import { Prep, type PrepResult } from './screens/Prep'
import { Treat, type TreatResult } from './screens/Treat'
import { DayClose, type DaySummary } from './screens/DayClose'
import { Login } from './screens/Login'
import { SubjectSelect } from './screens/SubjectSelect'
import { useLocale } from './locales/LocaleContext'
import { applyDayCompletion, loadSave, writeProgress, type SaveData } from './game/save'
import { coinsEarned, outcomeTier, starsFor, treatRatio } from './game/scoring'
import { clearProfile, loadProfile, saveProfile, type Profile } from './game/profile'
import { localDateKey } from './game/dates'
import type { Track } from './game/cast'

// pdf.js and the Anthropic SDK are heavy — only importers pay for them.
const Import = lazy(() =>
  import('./screens/Import').then((m) => ({ default: m.Import })),
)
// The cinematic 2.5D clinic — scene-based, render-driven. Replaced the
// primitive first-person 3D (kept in clinic/ but no longer routed to).
// Parked, not deleted: it still holds the day/scoring wiring that ClinicCase
// has yet to grow, and public/scenes/ has none of the stills or clips it wants.
// const CinematicClinic = lazy(() => import('./screens/CinematicClinic'))
const ClinicCase = lazy(() => import('./clinic/ClinicCase'))

type Phase =
  | { name: 'subject' }
  | { name: 'tablet' }
  | { name: 'clinic'; dayId: string }
  | { name: 'prep'; dayId: string }
  | { name: 'treat'; dayId: string; prep: PrepResult }
  | { name: 'close'; dayId: string; summary: DaySummary }
  | { name: 'import' }

export default function App() {
  const { t } = useLocale()
  const [save, setSave] = useState<SaveData>(() => loadSave())
  const [phase, setPhase] = useState<Phase>({ name: 'tablet' })
  // Imported days sit alongside the built-in ones; imports first, since a day
  // built from your own lecture is the one you actually came to play.
  const [library, setLibrary] = useState(() => loadLibrary())
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())
  const allDays = [...library, ...ALL_DAYS]

  // The schedule only ever shows what this student is actually studying.
  const days = allDays.filter((d) => {
    if (!profile) return true
    if ((d.track ?? 'dental') !== profile.track) return false
    return profile.subject === null || d.subject.en === profile.subject
  })
  // Lookup spans every day so an in-progress day survives a subject change.
  const getDay = (id: string) => allDays.find((d) => d.id === id)

  function signIn(displayName: string, doctorId: string, track: Track) {
    const next: Profile = {
      version: 1,
      displayName,
      doctorId,
      track,
      subject: null,
      createdOn: localDateKey(),
    }
    setProfile(next)
    saveProfile(next)
    setPhase({ name: 'subject' })
  }

  function pickSubject(subject: string | null) {
    if (!profile) return
    const next = { ...profile, subject }
    setProfile(next)
    saveProfile(next)
    setPhase({ name: 'tablet' })
  }

  // Without history entries the Android back button exits the app from any
  // screen. Exactly ONE entry is held while away from the tablet — pushing one
  // per screen would leave dead entries that swallow later back presses.
  const awayFromTablet = useRef(false)

  const goTablet = useCallback(() => {
    setPhase({ name: 'tablet' })
    if (awayFromTablet.current) {
      awayFromTablet.current = false
      window.history.back()
    }
  }, [])

  useEffect(() => {
    if (phase.name === 'tablet') return
    if (!awayFromTablet.current) {
      awayFromTablet.current = true
      window.history.pushState({ inGame: true }, '')
    }
    const onPop = () => {
      awayFromTablet.current = false
      setPhase({ name: 'tablet' })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [phase.name])

  function persist(next: SaveData) {
    setSave(next)
    writeProgress(next)
  }

  /**
   * Scores a finished day, persists it, and returns the summary. Both the
   * first-person clinic and the classic 2D path go through here so the two can
   * never drift apart on scoring.
   */
  const commitDay = useCallback(
    (dayId: string, prep: PrepResult, treat: TreatResult): DaySummary => {
      const ratio = treatRatio(treat.score, treat.maxScore)
      const tier = outcomeTier(ratio)
      const stars = starsFor(tier)
      const total = prep.score + treat.score
      const coins = coinsEarned(total, tier)

      const next = applyDayCompletion(save, { dayId, score: total, stars }, undefined, coins)
      persist(next)

      return {
        tier,
        stars,
        score: total,
        coins,
        streak: next.streak,
        missed: [...prep.missed, ...treat.missed],
      }
    },
    // `save` is read fresh on each call; persist is stable enough for this use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save],
  )

  const day = 'dayId' in phase ? getDay(phase.dayId) : undefined

  // The clinic is full-bleed — it must not sit inside the padded app shell.
  if (phase.name === 'clinic' && day) {
    return (
      <Suspense
        fallback={
          <div className="centered">
            <p className="muted">{t('loading')}</p>
          </div>
        }
      >
        {/*
          The walkable 3D clinic IS the game.

          It used to route to CinematicClinic, a 2.5D beat machine — which meant
          <Player> was never mounted on the screen the app actually opens, so
          walking, sitting and every interaction were unreachable. `#play` was a
          dev tab nothing navigated to.

          KNOWN GAP, deliberately not faked: ClinicCase plays the fixture case
          from ingest/caseFixture, not `day`. ClinicDay (content/schema) and
          CaseCore (ingest/channels) are separate schemas with no mapping
          between them, so finishing a day does not score yet — `commitDay` is
          not called. Wiring that is real work, and inventing a fake result to
          keep the number moving would corrupt the save.
        */}
        <ClinicCase onExit={goTablet} />
      </Suspense>
    )
  }

  // Sign-in gates everything: the track decides which content even exists.
  if (!profile) {
    return (
      <Shell coins={save.coins} streak={save.streak}>
        <Login onSignIn={signIn} />
      </Shell>
    )
  }

  return (
    <Shell coins={save.coins} streak={save.streak}>
      <AnimatePresence>
        <motion.div
          key={phase.name + ('dayId' in phase ? phase.dayId : '')}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {phase.name === 'subject' && (
            <SubjectSelect
              days={allDays}
              track={profile.track}
              onPick={pickSubject}
              onImport={() => setPhase({ name: 'import' })}
            />
          )}

          {phase.name === 'tablet' && (
            <Tablet
              days={days}
              save={save}
              profile={profile}
              onStartDay={(dayId) => setPhase({ name: 'clinic', dayId })}
              onStartClassic={(dayId) => setPhase({ name: 'prep', dayId })}
              onImport={() => setPhase({ name: 'import' })}
              onChangeSubject={() => setPhase({ name: 'subject' })}
              onSignOut={() => {
                clearProfile()
                setProfile(null)
                setPhase({ name: 'tablet' })
              }}
            />
          )}

          {phase.name === 'import' && (
            <Suspense fallback={<div className="card muted">{t('loading')}</div>}>
              <Import
                track={profile.track}
                onImported={() => {
                  setLibrary(loadLibrary())
                  // A freshly imported lecture is almost never the subject that
                  // was already filtered for — dropping the filter is the only
                  // way the student reliably sees the day they just made.
                  pickSubject(null)
                  goTablet()
                }}
                onBack={goTablet}
              />
            </Suspense>
          )}

          {phase.name === 'prep' && day && (
            <Prep
              day={day}
              onDone={(prep) => setPhase({ name: 'treat', dayId: phase.dayId, prep })}
            />
          )}

          {phase.name === 'treat' && day && (
            <Treat
              day={day}
              onDone={(treat) =>
                setPhase({
                  name: 'close',
                  dayId: phase.dayId,
                  summary: commitDay(phase.dayId, phase.prep, treat),
                })
              }
            />
          )}

          {phase.name === 'close' && day && (
            <DayClose day={day} summary={phase.summary} onBack={goTablet} />
          )}
        </motion.div>
      </AnimatePresence>
    </Shell>
  )
}
