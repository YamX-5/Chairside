import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Canvas } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { NoToneMapping } from 'three'
import { RoomModel } from './RoomModel'
import { ReactingPatient } from './ReactingPatient'
import { DentalChair } from './DentalChair'
import { GloveBox } from './GloveBox'
import { ClinicProps } from './ClinicProps'
import { CasePapers, type Page } from './CasePapers'
import { DeskScreen, type DayPhase, type StudyTab } from './DeskScreen'
import { Player } from './Player'
import { DevProbe } from './DevProbe'
import { CameraFocus } from './CameraFocus'
import { InstrumentTray } from './InstrumentTray'
import { RadiographViewer } from './RadiographViewer'
import { canShoot, type Film } from './radiograph'
import { Hands } from './Hands'
import { promptFor } from './prompts'
import { StudyWindow } from './StudyWindow'
import { TouchControls } from './TouchControls'
import { Mirror } from './Mirror'
import { FullscreenButton } from './Fullscreen'
import { ScreenProjector } from './ScreenProjector'
import { useLocale } from '../locales/LocaleContext'
import { useRef as useRefAlias } from 'react'
import { expectedInstrumentFor, INSTRUMENT_BY_ID, type InstrumentId } from './instruments'
import {
  breachesFor,
  consequenceFor,
  requiresAnaesthesia,
  BREACH_TEXT,
  type SafetyBreach,
} from './protection'
import { DURATION } from './reaction'
import { attachKeyboard, isTouchDevice, resetInput } from './input'
import {
  CABINET_DOOR_IDS,
  INSTRUMENT_DRAWER,
  DRAWER_PROMPT_OPENS,
  LAPTOP,
  SCREEN_ANCHOR,
  nearestSeat,
  SEAT_BY_ID,
  SPAWN,
  type InteractableId,
} from './layout'
import { CORE } from '../ingest/caseFixture'
import { classify, isProcedureUnlocked, type Verdict } from '../ingest/classify'
import { cardsFromOutcome, type StudyCard } from '../ingest/studyCards'

/**
 * The vertical slice, played from inside the room.
 *
 * Three things this exists to fix, all of which made earlier versions read as
 * "a quiz with a 3D background":
 *
 *  - You can WALK. Fixed cameras are why the room felt like wallpaper.
 *  - The case is PAPER IN YOUR HANDS, not a sidebar. A dentist reads a chart.
 *  - The room never disappears. Deciding, waiting and the consequence all
 *    happen in the same continuous view.
 *
 * Deliberately no post-processing here: the flat-shaded style does not need it,
 * and on this hardware it is the single most expensive thing in the frame.
 */

type Phase = 'deciding' | 'holding' | 'reacting' | 'debrief'

/**
 * How long she takes to walk from the doorway to the chair.
 *
 * Deliberately unhurried. At 3.4s she scurried; a person crossing a small room
 * and settling into a chair takes their time, and the walk-in is the beat that
 * makes the clinic feel like it opened.
 */
const WALK_IN_SECONDS = 6.5

export interface ClinicCaseProps {
  /**
   * Leave the clinic and go back to the tablet.
   *
   * Optional so `#play` keeps working as a standalone dev harness with no
   * shell around it.
   */
  onExit?: () => void
  /**
   * The film for this encounter, taken from the student's own lecture deck.
   *
   * A PROP rather than a field on `CORE`, and that is deliberate. The clinic
   * plays a `CaseCore`; the pipeline generates a `ClinicDay` full of
   * `PatientCase`s; the two schemas are still unmapped (nothing calls
   * commitDay). Adding `radiograph` to both would duplicate the field and
   * guarantee they drift. Threading it in as a prop puts it at the exact seam
   * the eventual mapping has to cross.
   *
   * Undefined today, which is honest: the X-ray reports "no film on file"
   * rather than showing an invented one.
   */
  radiograph?: Film
}

export default function ClinicCase({ onExit, radiograph }: ClinicCaseProps = {}) {
  const [day, setDay] = useState<DayPhase>('morning')
  /**
   * Whether the desk panel is open, SEPARATE from what part of the day it is.
   *
   * These used to be the same thing: 'studying' was a DayPhase, so the panel
   * could only be opened during the morning. After the morning ended the desk
   * still offered "Read your notes again", the study branch in interact()
   * refused it because day was no longer 'morning', and the press fell through
   * to nearestSeat — which silently sat the player down, 0.378 m away, with the
   * prompt unchanged and no stated way to stand up on a phone. The button lied.
   */
  const [deskOpen, setDeskOpen] = useState(false)
  const [tab, setTab] = useState<StudyTab>('summary')
  const [cardIndex, setCardIndex] = useState(0)
  const [arrival, setArrival] = useState(0)
  const [called, setCalled] = useState(false)
  /** The plan is locked in; the tray is live. */
  const [planned, setPlanned] = useState(false)
  /**
   * Shown briefly when a locked instrument is clicked.
   *
   * The tray is deliberately dead until a plan is committed — you should decide
   * what you are doing before you pick up a drill. But it said so nowhere, so
   * the honest player experience was "I can't hold any instruments" with no clue
   * why. A rule you cannot see is a bug, whatever the code intends.
   */
  const [blockedNote, setBlockedNote] = useState(false)
  const [heldId, setHeldId] = useState<InstrumentId | null>(null)
  const [filmOpen, setFilmOpen] = useState(false)
  /**
   * Which individual drawers and doors are open, by node id.
   *
   * A SET, not a boolean. One flag per section meant pressing E at a drawer
   * threw the two cupboards above it open too.
   */
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set())
  const toggleOpenable = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  /** Gloves on. Required for ANY patient contact, examination included. */
  const [gloved, setGloved] = useState(false)
  // Reads a { en, ar } pair in the player's locale. The clinic's prompts are
  // bilingual pairs colocated in prompts.ts, not translation keys.
  const { c } = useLocale()
  /**
   * Where the monitor is on screen, in CSS pixels — the point the study window
   * grows out of. Written every frame by ScreenProjector inside the Canvas and
   * read only when the window opens, so turning your head costs no re-renders.
   */
  const screenPointRef = useRefAlias<{ x: number; y: number } | null>(null)
  /** The site has been anaesthetised with the syringe. */
  const [anaesthetised, setAnaesthetised] = useState(false)
  /** What was wrong at the moment treatment started, for the debrief. */
  const [breaches, setBreaches] = useState<SafetyBreach[]>([])
  /** Overrides the case's own reaction when the patient is hurt by a breach. */
  const [painPrimitive, setPainPrimitive] = useState<
    ReturnType<typeof consequenceFor> | null
  >(null)
  const [seatedId, setSeatedId] = useState<string | null>(null)
  /** The seat within reach, published by Player, so the prompt can offer it. */
  const [nearSeat, setNearSeat] = useState<string | null>(null)
  /** Live camera position, so `interact` can find the nearest seat. */
  const camPosRef = useRef({ x: SPAWN.x, z: SPAWN.z })
  const [reading, setReading] = useState(false)
  const [page, setPage] = useState<Page>('history')
  const [tabled, setTabled] = useState<Set<string>>(new Set())
  const [diagnosisId, setDiagnosisId] = useState<string | null>(null)
  const [siteFDI, setSiteFDI] = useState<string | null>(null)
  const [procedureId, setProcedureId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('deciding')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [cards, setCards] = useState<StudyCard[]>([])
  const [trigger, setTrigger] = useState(0)
  const [near, setNear] = useState<InteractableId | null>(null)

  const fxRef = useRef<HTMLDivElement>(null)
  const nearestRef = useRef<InteractableId | null>(null)
  // treat() is declared below and closes over current state; a ref keeps the
  // keyboard handler from capturing a stale copy of it.
  const treatRef = useRef<() => void>(() => {})
  const isTouch = useRef(isTouchDevice()).current

  const unlockedIds = useMemo(
    () =>
      diagnosisId
        ? CORE.options.procedures.filter((p) => isProcedureUnlocked(CORE, diagnosisId, p.id)).map((p) => p.id)
        : [],
    [diagnosisId],
  )

  const ready = diagnosisId !== null && siteFDI !== null && procedureId !== null
  const correct = verdict?.errorClass === 'F_CORRECT'
  const consequence = verdict ? CORE.consequences[verdict.errorClass] : null
  const studying = deskOpen
  const seated = seatedId ? SEAT_BY_ID.get(seatedId) ?? null : null
  // Seated still counts as roaming for input purposes minus movement — see
  // Player's `frozen` prop: you can look around from a chair, you just can't walk.
  const roaming = phase === 'deciding' && !reading && !studying

  /**
   * E — use the thing you are standing at. Never the chart.
   *
   * At the desk it opens the study screen; at the chair, holding an instrument,
   * it treats. The chart moved to its own key (H) because overloading E meant
   * you could not open the chart while standing anywhere useful.
   */
  const interact = useCallback(() => {
    // Stand up first — sitting owns E while you are in a chair, so there is
    // always one obvious way out.
    if (seatedId) {
      setSeatedId(null)
      return
    }
    // The desk. Returns BEFORE nearestSeat, which is what stops the press
    // falling through and seating the player. Guarded on not being seated and
    // on the encounter not being underway, so opening the panel can never fight
    // CameraFocus for the camera.
    if (nearestRef.current === 'study' && !seatedId && phase === 'deciding') {
      setDeskOpen((o) => !o)
      return
    }
    // The glove box. Works any time — you can glove up before she even arrives,
    // which is what a real operator does.
    if (nearestRef.current === 'gloves') {
      setGloved((g) => !g)
      return
    }

    // The sterilisation station. Also works any time: opening a drawer is not
    // a clinical act and gating it behind the encounter would just make the
    // room feel like scenery until the patient arrives.
    // The portable X-ray, off the top of the bookcase. Gated on the same
    // condition as the tray that renders it — hold an instrument the scene is
    // not drawing and you are holding nothing at all.
    if (nearestRef.current === 'xray' && called && arrival >= 1) {
      setHeldId((h) => (h === 'xray' ? null : 'xray'))
      return
    }

    if (nearestRef.current === 'drawer') {
      toggleOpenable(DRAWER_PROMPT_OPENS)
      return
    }

    if ((day === 'clinic' || day === 'done') && phase === 'deciding') {
      if (planned && heldId && nearestRef.current === 'solve') {
        // The syringe ANAESTHETISES; it does not treat. Checked before the
        // general treat branch, or picking up the syringe and pressing E would
        // perform the committed procedure with an anaesthetic needle.
        if (heldId === 'syringe') {
          setAnaesthetised(true)
          return
        }
        treatRef.current()
        return
      }
    }

    // Nothing else claimed E, so sit down if there is a seat here. Checked last
    // so a seat next to the tray never steals the pick-up.
    const seat = nearestSeat(camPosRef.current.x, camPosRef.current.z)
    if (seat) setSeatedId(seat.id)
  }, [day, phase, planned, heldId, seatedId])

  // The nudge clears itself. A message that stays put reads as an error state.
  useEffect(() => {
    if (!blockedNote) return
    const t = setTimeout(() => setBlockedNote(false), 2600)
    return () => clearTimeout(t)
  }, [blockedNote])

  /** H — the chart. Works anywhere in the room, because you carry it. */
  const toggleChart = useCallback(() => {
    if (phase !== 'deciding' || day === 'morning' || day === 'studying') return
    setReading((r) => !r)
  }, [phase, day])

  useEffect(() => {
    if (phase !== 'deciding') return
    return attachKeyboard({ onInteract: interact, onChart: toggleChart })
  }, [phase, interact, toggleChart])

  // Reading or studying releases the mouse so the pages and screen are
  // clickable — the same trade every game makes when an inventory opens.
  useEffect(() => {
    if ((reading || studying) && document.pointerLockElement) document.exitPointerLock()
  }, [reading, studying])

  /** Finishing the morning opens the clinic. She is not called in yet. */
  const finishStudy = useCallback(() => {
    // The panel STAYS open: the very next thing the player does is call her in,
    // and that button is in this same footer.
    setDay('clinic')
    setCalled(false)
    setArrival(0)
  }, [])

  /** Calling her in — the player's decision, made at the laptop. */
  const callPatient = useCallback(() => {
    setCalled(true)
    setArrival(0)
    const started = performance.now()
    const tick = () => {
      const k = Math.min(1, (performance.now() - started) / (WALK_IN_SECONDS * 1000))
      setArrival(k)
      if (k < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  useEffect(() => resetInput, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Escape' && reading) setReading(false)
      // Escape with nothing open leaves the clinic. Pointer lock swallows the
      // first Escape itself, so this only fires on the second press — which is
      // the browser's behaviour, not something to fight.
      else if (e.code === 'Escape' && !reading && !studying && onExit) onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reading, studying, onExit])

  /**
   * Committing the plan no longer resolves the case — it unlocks the tray.
   *
   * Deciding on paper and then never touching the patient is what made this
   * read as a quiz with a room around it. Now the plan gates which procedure is
   * legal, and the instrument is how you actually perform it — which is also
   * what finally makes D_WRONG_INSTRUMENT a mistake a player can make.
   */
  function commitPlan() {
    if (!ready) return
    setReading(false)
    setPlanned(true)
  }

  /** Using the held instrument on the patient. This is what resolves the case. */
  function treat() {
    if (!planned || !heldId) return

    // The X-ray is DIAGNOSTIC, not operative: it images the tooth, it does not
    // treat it. Intercepting here rather than letting it fall through to
    // classify() is the difference between "you took a radiograph" and
    // "D_WRONG_INSTRUMENT: you tried to fix a pulpitis with an X-ray gun".
    // Taking a film is never a mistake and never resolves the case.
    if (canShoot(heldId)) {
      setFilmOpen(true)
      return
    }

    // Snapshot what was wrong the moment treatment STARTED. Gloving up
    // afterwards does not un-touch the patient.
    const found = breachesFor({ gloved, anaesthetised }, procedureId)
    setBreaches(found)
    const pain = found.includes('no_anaesthesia')
      ? consequenceFor('no_anaesthesia', procedureId)
      : null
    setPainPrimitive(pain)

    setPhase('holding')

    // The dread interval. It costs nothing to stage now, because the room is
    // already on screen — you watch her while you wait to find out.
    window.setTimeout(() => {
      const v = classify(
        { diagnosisId: diagnosisId!, siteFDI: siteFDI!, procedureId: procedureId! },
        CORE,
        {
          instrumentId: heldId,
          expectedInstrumentId: expectedInstrumentFor(procedureId) ?? undefined,
        },
      )
      setVerdict(v)
      setCards(cardsFromOutcome(CORE, v, tabled))
      setPhase('reacting')
      setTrigger((n) => n + 1)

      // Debrief only AFTER the reaction finishes. Explaining over the top of the
      // scream turns a consequence back into a popup.
      // Pain wins the reaction. A correct extraction on an un-numbed tooth is
      // still a scream, and showing the case's polite `procedure_success` over
      // the top of it would teach that anaesthetic is optional.
      const prim = pain?.primitive ?? CORE.consequences[v.errorClass]?.primitive ?? 'generic_flinch'
      window.setTimeout(() => {
        setPhase('debrief')
        setDay('done') // the laptop list now reads "seen"
      }, (DURATION[prim] ?? 1.5) * 1000 + 400)
    }, 2600)
  }

  /** Back to the top of the day, not just the top of the case. */
  function reset() {
    setTabled(new Set())
    setDiagnosisId(null)
    setSiteFDI(null)
    setProcedureId(null)
    setVerdict(null)
    setCards([])
    setPage('history')
    setPhase('deciding')
    setDay('morning')
    setArrival(0)
    setCalled(false)
    setPlanned(false)
    setHeldId(null)
    setSeatedId(null)
    setGloved(false)
    setAnaesthetised(false)
    setBreaches([])
    setPainPrimitive(null)
    setCardIndex(0)
    setTab('summary')
  }

  treatRef.current = treat

  const activePrimitive =
    phase === 'reacting' || phase === 'debrief'
      ? painPrimitive?.primitive ?? consequence?.primitive ?? 'generic_flinch'
      : null

  const heldInstrument = heldId ? INSTRUMENT_BY_ID.get(heldId) : null
  const atChair = near === 'solve'

  /**
   * The single action available where the player is standing, in their own
   * language. Read by BOTH the desktop prompt and the touch button — a phone
   * showing a different verb from the keyboard would be two designs.
   */
  const activePrompt = promptFor({
    near,
    gloved,
    holding: heldId,
    holdingLabel: heldInstrument?.label,
    anaesthetised,
    drawerOpen: openIds.has(DRAWER_PROMPT_OPENS),
    studied: day !== 'morning',
    canTreat: planned && atChair,
    seat: nearSeat,
    seated: seatedId !== null,
  })

  return (
    <div className="clinic-root" style={S.root}>
      <Canvas
        // dpr 1: the flat-shaded look gains nothing from supersampling, and on
        // this hardware resolution is the cheapest thing to give back.
        dpr={1}
        // An explicit spawn position matters even though Player also sets it:
        // without one r3f defaults the camera to [0,0,5], and if anything stops
        // Player's effect running you are staring out of the room at nothing.
        camera={{ fov: 72, near: 0.1, far: 60, position: [0.2, 1.62, 3] }}
        gl={{ antialias: false, toneMapping: NoToneMapping, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#f2e9dc']} />
        <fog attach="fog" args={[0xf2e9dc, 16, 34]} />

        {/* Lighting now travels WITH the room (see ClinicLighting in
            RoomModel), so no scene can render an unlit clinic by forgetting to
            declare its own — which is what ClinicExperience was doing. */}
        <RoomModel drawerOpen={false} />
        <DentalChair />
        <GloveBox gloved={gloved} />
        <ClinicProps openIds={openIds} onToggleOpenable={toggleOpenable} />
        <Mirror />

        {/* Renders nothing; tracks where the monitor is on screen so the study
            window can fly out of it. */}
        <ScreenProjector
          point={[SCREEN_ANCHOR.x, SCREEN_ANCHOR.y, SCREEN_ANCHOR.z]}
          out={screenPointRef}
        />

        {/* Your own hands. Written months ago and mounted only by
            ClinicExperience — never by this screen, which is the one the game
            runs in, so the player has been a floating camera the whole time. */}
        {!studying && !reading && <Hands gloved={gloved} holding={!!heldId} reaching={near !== null} />}

        {/* No patient during the morning. The clinic opening is the whole point
            of the study step — she has to be genuinely absent before it. */}
        {called && (
          <ReactingPatient
            primitive={activePrimitive}
            triggerId={trigger}
            fxRef={fxRef}
            arrival={arrival}
            mood={phase === 'deciding' ? 'in-pain' : 'anxious'}
          />
        )}

        <Suspense fallback={null}>
          <DeskScreen
            core={CORE}
            phase={day}
            tab={tab}
            onTab={setTab}
            cardIndex={cardIndex}
            onCardIndex={setCardIndex}
            onFinish={finishStudy}
            patientName="Mr Haddad"
            waiting={(day === 'clinic' || day === 'done') && !called}
            arriving={called && arrival < 1}
          onCall={() => {}}
          />
        </Suspense>

        {/* Suspense INSIDE the canvas, around the papers specifically.
            drei's <Text> fetches a font, and anything that suspends with no
            boundary between it and the Canvas takes the whole scene down —
            which renders as a black screen with the DOM overlays still visible,
            because those are siblings of the Canvas rather than children.
            The room must never be hostage to a font. */}
        <Suspense fallback={null}>
          <CasePapers
            core={CORE}
            open={reading}
            page={page}
            onPage={setPage}
            tabled={tabled}
            onReveal={(id) => setTabled((prev) => new Set(prev).add(id))}
            diagnosisId={diagnosisId}
            siteFDI={siteFDI}
            procedureId={procedureId}
            onDiagnosis={(id) => {
              setDiagnosisId(id)
              setProcedureId(null) // the gate moved; the old choice may be locked
            }}
            onSite={setSiteFDI}
            onProcedure={setProcedureId}
            unlockedProcedureIds={unlockedIds}
            onCommit={commitPlan}
            ready={ready}
          />
        </Suspense>

        {/* The tray goes live once a plan is committed. Offering instruments
            before there is a plan invites poking at a patient for no reason,
            which is the opposite of the lesson. */}
        {called && arrival >= 1 && (
          <InstrumentTray
            heldId={heldId}
            onPick={setHeldId}
            onBlocked={() => setBlockedNote(true)}
            enabled={planned && phase === 'deciding'}
            closetOpen={CABINET_DOOR_IDS.some((id) => openIds.has(id))}
            drawerOpen={openIds.has(INSTRUMENT_DRAWER)}
          />
        )}

        {/* Leans the camera in to the laptop while studying, then puts the
            player back exactly where they were standing. */}
        <CameraFocus
          target={
            studying
              ? {
                  position: [LAPTOP.x + 0.42, LAPTOP.y + 0.06, LAPTOP.z + 0.02],
                  lookAt: [LAPTOP.x, LAPTOP.y, LAPTOP.z],
                  fov: 34,
                }
              : seated
                ? {
                    position: [seated.eye.x, seated.eye.y, seated.eye.z],
                    // Look one metre ahead along the seat's facing.
                    lookAt: [
                      seated.eye.x - Math.sin(seated.yaw),
                      seated.eye.y - 0.15,
                      seated.eye.z - Math.cos(seated.yaw),
                    ],
                    // Sitting moves you; it does not take your head.
                    free: true,
                  }
                : null
          }
        />

        <Player
          paused={!roaming}
          isTouch={isTouch}
          nearestRef={nearestRef}
          onNearChange={setNear}
          onNearSeatChange={setNearSeat}
          posRef={camPosRef}
          frozen={seatedId !== null}
        />
        {roaming && !isTouch && <PointerLockControls />}
        <DevProbe />
      </Canvas>

      <div ref={fxRef} style={S.fx} />

      {/* Fullscreen. Hidden where the browser refuses it (iOS Safari), because a
          button that silently does nothing is worse than no button. */}
      <FullscreenButton />

      {!reading && !studying && phase === 'deciding' && (
        <>
          <div style={S.crosshair} />

          {/* THE prompt. One line, middle of the screen, key and verb — the way
              every first-person game does it. The contextual sentence below
              still explains the day; this tells you what E does RIGHT NOW.
              Before this, "press E to pick up the mirror" was one clause among
              five in a small grey line at the bottom of the screen. */}
          {!isTouch && activePrompt && (
            <div style={S.bigPrompt}>
              <span style={S.bigKey}>E</span>
              <span>{c(activePrompt)}</span>
            </div>
          )}
          {/* Why that instrument would not come up. Shown on both desktop and
              touch — the locked tray is confusing on either. */}
          {blockedNote && (
            <div style={S.blocked}>
              {c({
                en: 'Commit a plan on the chart first — H',
                ar: 'التزم بخطة على البطاقة أولًا — H',
              })}
            </div>
          )}
          {!isTouch && <div style={S.hint}>
            {seated
              ? <>sitting on {seated.label} · <kbd style={S.kbd}>E</kbd> stand up</>
              : <><kbd style={S.kbd}>W A S D</kbd> move</>}
            {day === 'morning' &&
              (near === 'study'
                ? <> · <kbd style={S.kbd}>E</kbd> review this morning&rsquo;s material</>
                : <> · the desk first — nothing starts until you&rsquo;ve studied</>)}
            {/* The glove box speaks for itself wherever you are standing near it,
                and it works before the patient ever arrives. */}
            {near === 'gloves' && (
              <> · <kbd style={S.kbd}>E</kbd> {gloved ? 'take the gloves off' : 'put gloves on'}</>
            )}
            {near === 'drawer' && (
              <>
                {' '}· <kbd style={S.kbd}>E</kbd>{' '}
                {openIds.has(DRAWER_PROMPT_OPENS) ? 'close the drawer' : 'open the drawer'}
              </>
            )}
            {(day === 'clinic' || day === 'done') &&
              (!called
                ? <> · back to the laptop &mdash; call her in</>
                : arrival < 1
                  ? <> · she&rsquo;s coming in</>
                  : !planned
                    ? <> · <kbd style={S.kbd}>H</kbd> chart &amp; plan</>
                    : !heldId
                      ? <> · <kbd style={S.kbd}>E</kbd> take an instrument off the tray</>
                      : atChair
                        ? heldId === 'syringe'
                          // The syringe numbs; it never treats.
                          ? <> · <kbd style={S.kbd}>E</kbd> {anaesthetised ? 'she is already numb' : 'give the anaesthetic'}</>
                          // The X-ray images; it never treats either. Saying
                          // "treat her with the portable X-ray" would promise a
                          // consequence that deliberately cannot happen.
                          : heldId === 'xray'
                            ? <> · <kbd style={S.kbd}>E</kbd> take a radiograph</>
                            : <> · <kbd style={S.kbd}>E</kbd> treat her with the {heldInstrument?.label.toLowerCase()}</>
                        : <> · go to the chair</>)}
          </div>}

          {/* Two pips: gloves, and whether she is numb.
              Visible BEFORE you commit, so the mistake is always preventable
              rather than only explainable afterwards. */}
          {(day === 'clinic' || day === 'done') && called && (
            <div style={S.pips}>
              <span style={gloved ? S.pipOn : S.pipOff}>
                {gloved ? '✔' : '✕'} gloves
              </span>
              {requiresAnaesthesia(procedureId) && (
                <span style={anaesthetised ? S.pipOn : S.pipOff}>
                  {anaesthetised ? '✔' : '✕'} anaesthetic
                </span>
              )}
            </div>
          )}

          {/* What you are holding, and what it is for. Naming the instrument's
              purpose on pickup is the cheapest teaching in the whole game. */}
          {heldInstrument && (
            <div style={S.holding}>
              <strong>{heldInstrument.label}</strong>
              <span style={S.holdingUse}>{heldInstrument.use}</span>
              <button onClick={() => setHeldId(null)} style={S.putBack}>put it back</button>
            </div>
          )}
        </>
      )}

      {/* The film, over the top of everything. Rendered last so it sits above
          the HUD, and gated on nothing but the player having pressed E with the
          X-ray in hand — reviewing an image is never a mistake. */}
      {/* The morning's material, at a size you can read. It grows out of the
          monitor and shrinks back into it — the room stays visible behind, so
          reading at the desk still feels like standing in the clinic. */}
      <StudyWindow
        core={CORE}
        open={studying}
        origin={screenPointRef.current}
        tab={tab}
        onTab={setTab}
        cardIndex={cardIndex}
        onCardIndex={setCardIndex}
        onFinish={finishStudy}
        onMinimise={() => setDeskOpen(false)}
        day={day}
        called={called}
        arriving={arrival < 1}
        onCall={callPatient}
      />

      {filmOpen && (
        <RadiographViewer radiograph={radiograph} onClose={() => setFilmOpen(false)} />
      )}

      {/* Phones have no keyboard: a joystick to walk, and one button carrying
          the same verb the desktop prompt shows. Mounted here because #play is
          ClinicCase — ClinicExperience rendered these and #play never did, so
          the game has been unplayable on a phone rather than merely awkward. */}
      {isTouch && !reading && !studying && phase === 'deciding' && (
        <TouchControls
          promptLabel={activePrompt ? c(activePrompt) : null}
          onInteract={() => interact()}
        />
      )}

      {phase === 'holding' && <div style={S.strip}>the chair whirs, the suction gurgles…</div>}

      {phase === 'reacting' && (
        <div style={S.strip}>{correct ? 'She settles.' : 'That went badly.'}</div>
      )}

      {phase === 'debrief' && verdict && (
        <div style={S.debrief}>
          <strong style={{ color: correct ? '#7fd6a2' : '#ff9d84', fontSize: 16 }}>
            {/* A correct procedure done to an un-numbed patient is not a
                success, and must not be reported as one. */}
            {correct && breaches.length === 0
              ? 'She thanks you and leaves.'
              : correct
                ? 'The right treatment — but not like that.'
                : 'That went badly.'}
          </strong>
          <p style={S.small}>{verdict.reason}</p>

          {/* Safety and comfort, reported separately from the clinical verdict:
              they are a different axis, and merging them would let a correct
              diagnosis excuse hurting someone. */}
          {breaches.map((b) => (
            <p key={b} style={S.breach}>
              {BREACH_TEXT[b].en}
              {b === 'no_anaesthesia' && painPrimitive
                ? ' ' + painPrimitive.lesson.en
                : b === 'no_gloves'
                  ? ' Standard precautions apply to every patient contact,' +
                    ' including an examination — you cannot tell by looking who' +
                    ' carries what.'
                  : ''}
            </p>
          ))}
          {consequence && !correct && <p style={S.small}>{consequence.clinicalRationale}</p>}
          <p style={S.quote}>
            “{correct
              ? CORE.debrief.patientPerspective.success.en
              : CORE.debrief.patientPerspective.failure.en}”
          </p>
          <strong style={S.small}>{cards.length} card{cards.length === 1 ? '' : 's'} added</strong>
          {cards.slice(0, 3).map((c) => (
            <div key={c.id} style={S.card}>
              <span style={S.cardTag}>{c.origin} · p.{c.sourcePage}</span>
              <span>{c.back.en}</span>
            </div>
          ))}
          <button onClick={reset} style={S.again}>Again</button>
        </div>
      )}
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  // touchAction belongs on the class too (see .clinic-root), but stating it
  // here as well means an inline-styled copy of this screen cannot lose it again.
  root: { position: 'fixed', inset: 0, background: '#14100a', touchAction: 'none' },
  fx: { position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0, zIndex: 5, transition: 'opacity 90ms linear' },
  /**
   * Sits just below the crosshair, not at the bottom of the screen: your eyes
   * are already at the centre when you walk up to something, and a prompt you
   * have to look away to read is a prompt you miss.
   */
  bigPrompt: {
    position: 'absolute',
    left: '50%',
    top: 'calc(50% + 3.2rem)',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.55rem 1.15rem',
    borderRadius: 10,
    background: 'rgba(10, 12, 15, 0.62)',
    border: '1px solid rgba(255,255,255,0.14)',
    backdropFilter: 'blur(4px)',
    color: '#f2f6fa',
    fontSize: '1.28rem',
    fontWeight: 500,
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    textShadow: '0 1px 3px rgba(0,0,0,0.55)',
  },
  bigKey: {
    display: 'inline-grid',
    placeItems: 'center',
    minWidth: '2rem',
    height: '2rem',
    borderRadius: 6,
    background: '#f2f6fa',
    color: '#12161c',
    fontSize: '1.05rem',
    fontWeight: 700,
    boxShadow: '0 2px 0 rgba(0,0,0,0.35)',
  },
  crosshair: {
    position: 'absolute', insetBlockStart: '50%', insetInlineStart: '50%',
    inlineSize: 5, blockSize: 5, marginBlockStart: -2.5, marginInlineStart: -2.5,
    borderRadius: '50%', background: 'rgba(42,32,21,.55)', pointerEvents: 'none',
  },
  hint: {
    position: 'absolute', insetBlockEnd: 18, insetInlineStart: 0, inlineSize: '100%',
    textAlign: 'center', color: '#2a2015', font: '13px system-ui', pointerEvents: 'none',
  },
  kbd: {
    background: 'rgba(42,32,21,.1)', borderRadius: 5, padding: '2px 6px',
    font: '12px ui-monospace, monospace',
  },
  // Top-left, out of the way of the crosshair and the instrument card, because
  // these are glanceable state rather than something to read.
  pips: {
    position: 'absolute', insetBlockStart: 14, insetInlineStart: 14,
    display: 'flex', gap: 8, font: '12px system-ui', pointerEvents: 'none',
    zIndex: 6,
  },
  pipOn: {
    background: 'rgba(64,132,88,.92)', color: '#f2f7f2',
    borderRadius: 999, padding: '3px 10px',
  },
  pipOff: {
    background: 'rgba(150,58,48,.92)', color: '#fdf1ef',
    borderRadius: 999, padding: '3px 10px',
  },
  breach: {
    margin: '6px 0 0', padding: '7px 10px', borderRadius: 8,
    background: 'rgba(150,58,48,.22)', borderInlineStart: '3px solid #c0584a',
    color: '#ffd9d1', font: '13px system-ui', lineHeight: 1.45,
  },
  strip: {
    position: 'absolute', insetBlockEnd: 40, insetInlineStart: 0, inlineSize: '100%',
    textAlign: 'center', color: '#f4ece0', font: '15px system-ui',
    textShadow: '0 2px 12px rgba(0,0,0,.8)', zIndex: 6, pointerEvents: 'none',
  },
  debrief: {
    position: 'absolute', insetBlockEnd: 16, insetInlineStart: '50%', transform: 'translateX(-50%)',
    inlineSize: 'min(460px, 92vw)', zIndex: 10, display: 'grid', gap: 7, padding: '14px 16px',
    borderRadius: 14, background: 'rgba(22,18,12,.9)', backdropFilter: 'blur(10px)',
    color: '#f4ece0', font: '14px/1.5 system-ui',
  },
  small: { fontSize: 13, margin: 0, color: '#d6c9b5' },
  quote: { fontSize: 13, fontStyle: 'italic', color: '#c3b39c', borderInlineStart: '2px solid #6b5b46', paddingInlineStart: 9, margin: '2px 0' },
  card: { display: 'grid', gap: 2, fontSize: 12, padding: '7px 9px', borderRadius: 8, background: 'rgba(255,255,255,.06)' },
  cardTag: { fontSize: 10, color: '#a2917a', textTransform: 'uppercase', letterSpacing: '.04em' },
  again: { padding: 10, borderRadius: 9, border: 0, background: '#f4ece0', color: '#2a2015', fontWeight: 700, cursor: 'pointer', font: 'inherit', marginBlockStart: 4 },
  holding: {
    // Clears the touch interact button, which is also bottom-right and shows
    // the current prompt. At 54 the two stacked on top of each other — "Leave
    // the clinic" rendered straight through the held-instrument card, so
    // neither could be read or pressed.
    position: 'absolute', insetBlockEnd: 132, insetInlineEnd: 18, zIndex: 8,
    display: 'grid', gap: 3, justifyItems: 'end', textAlign: 'end',
    padding: '9px 12px', borderRadius: 11, background: 'rgba(22,18,12,.82)',
    color: '#f4ece0', font: '13px/1.4 system-ui', maxInlineSize: 240,
  },
  holdingUse: { fontSize: 12, color: '#c3b39c' },
  putBack: {
    marginBlockStart: 4, padding: '4px 9px', borderRadius: 7, border: 0,
    background: 'rgba(255,255,255,.14)', color: '#f4ece0', font: '12px system-ui',
    cursor: 'pointer',
  },
}
