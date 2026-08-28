import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { NoToneMapping } from 'three'
import { PostFX } from './PostFX'
import type { ClinicDay } from '../content/schema'
import { useLocale } from '../locales/LocaleContext'
import { Prep, type PrepResult } from '../screens/Prep'
import { Treat, type TreatResult } from '../screens/Treat'
import { DayClose, type DaySummary } from '../screens/DayClose'
import { RoomModel } from './RoomModel'
import { Patient3D } from './Patient3D'
import { Player } from './Player'
import { Hands } from './Hands'
import { DevProbe } from './DevProbe'
import { TouchControls } from './TouchControls'
import { attachKeyboard, isTouchDevice, resetInput } from './input'
import type { InteractableId } from './layout'

interface Props {
  day: ClinicDay
  coins: number
  streak: number
  /** App owns persistence; the clinic just reports what happened. */
  onFinish: (dayId: string, prep: PrepResult, treat: TreatResult) => DaySummary
  onExit: () => void
}

type Mode = 'roam' | 'study' | 'solve' | 'close'

const EMPTY_PREP: PrepResult = { score: 0, missed: [] }

export default function ClinicExperience({
  day,
  coins,
  streak,
  onFinish,
  onExit,
}: Props) {
  const { t, c } = useLocale()
  const [mode, setMode] = useState<Mode>('roam')
  const [near, setNear] = useState<InteractableId | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [studied, setStudied] = useState(false)

  const nearestRef = useRef<InteractableId | null>(null)
  const prepRef = useRef<PrepResult | null>(null)
  const isTouch = useRef(isTouchDevice()).current

  const roaming = mode === 'roam'

  const activate = useCallback((id: InteractableId | null) => {
    if (!id) return
    switch (id) {
      case 'study':
        setMode('study')
        break
      case 'solve':
        setMode('solve')
        break
      case 'drawer':
        setDrawerOpen((open) => !open)
        break
      case 'board':
        setToast(null)
        // Re-set on the next tick so repeated presses re-trigger the fade.
        window.setTimeout(() => setToast('board'), 0)
        break
    }
  }, [])

  // Movement and interact keys are live only while roaming — an open overlay
  // owns the keyboard otherwise.
  useEffect(() => {
    if (!roaming) return
    return attachKeyboard({ onInteract: () => activate(nearestRef.current) })
  }, [roaming, activate])

  /**
   * Escape is a de-escalation ladder, never a quit key. After pointer lock the
   * reflex to press Escape is universal, and losing a half-finished day to it
   * would be infuriating: close the panel, then release the mouse, and only
   * leave the clinic once there is nothing left to back out of.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Escape') return
      if (mode !== 'roam') {
        if (mode !== 'close') setMode('roam')
        return
      }
      if (document.pointerLockElement) {
        document.exitPointerLock()
        return
      }
      onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, onExit])

  useEffect(() => resetInput, [])

  // Pointer lock is the desktop "I'm in the world" signal.
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  useEffect(() => {
    if (!roaming && document.pointerLockElement) document.exitPointerLock()
  }, [roaming])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  function finishStudy(result: PrepResult) {
    prepRef.current = result
    setStudied(true)
    setMode('roam')
  }

  function finishSolve(result: TreatResult) {
    const s = onFinish(day.id, prepRef.current ?? EMPTY_PREP, result)
    setSummary(s)
    setMode('close')
  }

  const promptLabel =
    near === 'study'
      ? studied ? t('promptStudyAgain') : t('promptStudy')
      : near === 'solve'
        ? t('promptSolve')
        : near === 'drawer'
          ? drawerOpen ? t('promptDrawerClose') : t('promptDrawerOpen')
          : near === 'board'
            ? t('promptBoard')
            : null

  const patientMood = studied ? 'anxious' : 'in-pain'

  return (
    <div className="clinic-root">
      <Canvas
        // Phones get the cheaper profile: first-person redraws most of the room
        // every frame, so resolution and MSAA are the first things to trade.
        // Pinned to 1. Windows display scaling at 150% makes devicePixelRatio
        // 1.5, so [1, 1.5] was rendering 2880x1620 — 4.7 megapixels — on an
        // Iris Xe, for 2.25x the fragment cost of 1.0. Lethal Company, the
        // register this game is in, renders at a fixed 860x520 and the crunch
        // reads as art direction.
        dpr={1}
        camera={{ fov: 72, near: 0.1, far: 60 }}
        // NoToneMapping: the post-processing ToneMapping effect owns ACES now,
        // so the renderer must NOT also tone-map or the frame double-maps and
        // washes out. antialias off — SMAA in the composer does the AA.
        gl={{
          antialias: false,
          toneMapping: NoToneMapping,
          powerPreference: 'high-performance',
        }}
        // Behind an opaque overlay there is nothing to animate. 'demand' (not
        // 'never') keeps invalidate() and the dev probe working.
        frameloop={roaming ? 'always' : 'demand'}
      >
        {/* Warm and bright, matching the reference clips. A dark background
            bleeds through at the room edges and instantly reads as a different,
            colder game.
            Authored as a hex STRING, not a float triple: three reads
            new THREE.Color(r,g,b) as already-linear (no sRGB conversion), which
            rendered the background washed-out and lighter than the fog. A hex
            string goes through setStyle -> sRGB -> converted, so background and
            fog are now the same cream. */}
        <color attach="background" args={['#f2e9dc']} />
        <fog attach="fog" args={[0xf2e9dc, 16, 34]} />
        <RoomModel drawerOpen={drawerOpen} />
        <Patient3D mood={patientMood} />
        <Hands />
        <Player
          paused={!roaming}
          isTouch={isTouch}
          nearestRef={nearestRef}
          onNearChange={setNear}
        />
        {roaming && !isTouch && <PointerLockControls />}
        <PostFX isTouch={isTouch} />
        <DevProbe />
      </Canvas>

      {roaming && (
        <div className="clinic-hud">
          <div className="hud-top">
            <span className="pill">🔥 {streak}</span>
            <span className="pill">🪙 {coins}</span>
            <span className="pill hud-day">{c(day.title)}</span>
            <button className="lang-btn" onClick={onExit}>
              {t('exitClinic')}
            </button>
          </div>

          {!isTouch && <div className={`crosshair ${near ? 'crosshair-hot' : ''}`} />}

          {promptLabel && !isTouch && (
            <div className="clinic-prompt">
              <kbd>E</kbd> {promptLabel}
            </div>
          )}

          {!isTouch && !locked && (
            <div className="clinic-hint">
              <div className="clinic-hint-card">
                <strong>{t('clickToLook')}</strong>
                <p className="muted">{t('moveHint')}</p>
              </div>
            </div>
          )}

          {isTouch && (
            <TouchControls
              promptLabel={promptLabel}
              onInteract={() => activate(nearestRef.current)}
              // This harness has no chart — it is the free-roam room, not the
              // case. Null rather than a no-op so the button is absent instead
              // of present and dead, which is the exact failure the in-world
              // monitor's CALL THE PATIENT button was.
              onChart={null}
              chartOpen={false}
              chartLabel=""
            />
          )}

          {toast === 'board' && (
            <div className="clinic-toast">
              {t('boardReading', { streak, coins })}
            </div>
          )}
        </div>
      )}

      {mode !== 'roam' && (
        <div className="clinic-overlay">
          <div className="clinic-overlay-inner">
            {mode === 'study' && <Prep day={day} onDone={finishStudy} />}
            {mode === 'solve' && <Treat day={day} onDone={finishSolve} />}
            {mode === 'close' && summary && (
              <DayClose day={day} summary={summary} onBack={onExit} />
            )}
            {mode !== 'close' && (
              <button
                className="btn btn-ghost"
                style={{ marginBlockStart: 12 }}
                onClick={() => setMode('roam')}
              >
                {t('backToRoom')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
