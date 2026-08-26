import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocale } from '../locales/LocaleContext'
import { studyMaterial, type StudyMaterial } from './studyContent'
import type { CaseCore } from '../ingest/channels'

/**
 * The study window — the material, at a size you can actually read.
 *
 * WHY THIS IS DOM AND NOT 3D TEXT
 * -------------------------------
 * The morning's notes used to be drawn as `<Text>` on a 0.195 m plane inside the
 * scene, and the camera leaned in to read them. That is a lovely idea and it did
 * not work: the type was a few millimetres tall in world units, every layout
 * value had to be a fraction of the panel, and the button that ENDS the morning
 * — the only way to open the clinic and reach the patient — was a 3D hit target
 * most players never found. The whole game was gated behind text nobody could
 * read.
 *
 * So the monitor keeps showing a screen in-world, and the material comes OUT of
 * it: this window flies from the monitor's position up to a real, crisp,
 * scrollable panel. Minimising sends it back to the same point. The world never
 * disappears behind it — the panel is a window on the desk, not a menu.
 *
 * It is DOM on purpose, and the AI-generated study UX that replaces this later
 * will be far easier to build here than in world-space text.
 */

export type StudyTab = 'summary' | 'cards'

export function StudyWindow({
  core,
  open,
  origin,
  tab,
  onTab,
  cardIndex,
  onCardIndex,
  onFinish,
  onMinimise,
  finished,
}: {
  core: CaseCore
  open: boolean
  /**
   * Where on screen the monitor is, in CSS pixels — the window grows out of
   * this point. Null falls back to growing from the centre, which is what
   * happens if the monitor is off-camera when you open it.
   */
  origin: { x: number; y: number } | null
  tab: StudyTab
  onTab: (t: StudyTab) => void
  cardIndex: number
  onCardIndex: (i: number) => void
  /** Ends the morning and opens the clinic. */
  onFinish: () => void
  onMinimise: () => void
  /** True once the morning is over, so the button stops offering it again. */
  finished: boolean
}) {
  const { c, isRtl } = useLocale()
  const [material, setMaterial] = useState<StudyMaterial | null>(null)
  const [flipped, setFlipped] = useState(false)
  // Rendered one frame BEFORE the open transform is applied, so the browser has
  // a "closed" state to transition from. Setting both in one commit animates
  // nothing at all.
  const [entered, setEntered] = useState(false)
  const raf = useRef(0)

  useEffect(() => setMaterial(studyMaterial(core)), [core])

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    raf.current = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf.current)
  }, [open])

  // A new card always shows its front. Leaving it flipped means the next card
  // opens with its answer already given away.
  useEffect(() => setFlipped(false), [cardIndex])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onMinimise()
      }
    }
    // Capture: the clinic's own Escape handler walks the player out of the room,
    // so this has to claim the key before it gets there.
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [open, onMinimise])

  if (!open || !material) return null

  const cards = material.cards
  const card = cards[Math.min(cardIndex, cards.length - 1)]

  // The closed pose: shrunk to nothing, sitting on the monitor.
  const dx = origin ? origin.x - window.innerWidth / 2 : 0
  const dy = origin ? origin.y - window.innerHeight / 2 : 0
  const closedTransform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.04)`
  const openTransform = 'translate(-50%, -50%) scale(1)'

  return (
    <div style={S.backdrop} dir={isRtl ? 'rtl' : 'ltr'}>
      <div
        style={{
          ...S.panel,
          transform: entered ? openTransform : closedTransform,
          opacity: entered ? 1 : 0,
        }}
      >
        {/* ------------------------------------------------------- title bar */}
        <div style={S.bar}>
          <span style={S.barDot} />
          <span style={S.barTitle}>{c(material.title)}</span>
          <button
            type="button"
            style={S.minimise}
            onClick={onMinimise}
            title="Minimise back to the monitor"
            aria-label="Minimise"
          >
            ▁
          </button>
        </div>

        {/* ----------------------------------------------------------- tabs */}
        <div style={S.tabs}>
          {(['summary', 'cards'] as StudyTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTab(t)}
              style={{ ...S.tab, ...(tab === t ? S.tabOn : null) }}
            >
              {t === 'summary'
                ? c(TEXT.summary)
                : `${c(TEXT.cards)} ${cardIndex + 1}/${cards.length}`}
            </button>
          ))}
        </div>

        {/* --------------------------------------------------------- body */}
        <div style={S.body}>
          {tab === 'summary' ? (
            <>
              <p style={S.lead}>{c(material.reasoning)}</p>
              <p style={S.note}>{c(TEXT.summaryNote)}</p>
            </>
          ) : (
            <div style={S.cardWrap}>
              <div style={S.cardFront}>{card.front}</div>
              {flipped ? (
                <>
                  <div style={S.cardBack}>{card.back}</div>
                  <div style={S.cardSource}>{card.source}</div>
                </>
              ) : (
                <button type="button" style={S.reveal} onClick={() => setFlipped(true)}>
                  {c(TEXT.reveal)}
                </button>
              )}
              <div style={S.cardNav}>
                <button
                  type="button"
                  style={S.navBtn}
                  onClick={() => onCardIndex((cardIndex - 1 + cards.length) % cards.length)}
                >
                  ‹ {c(TEXT.prev)}
                </button>
                <button
                  type="button"
                  style={S.navBtn}
                  onClick={() => onCardIndex((cardIndex + 1) % cards.length)}
                >
                  {c(TEXT.next)} ›
                </button>
              </div>
            </div>
          )}
        </div>

        {/* -------------------------------------------------------- footer */}
        <div style={S.footer}>
          <span style={S.hint}>{c(TEXT.escHint)}</span>
          {!finished && (
            <button type="button" style={S.finish} onClick={onFinish}>
              {c(TEXT.finish)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Bilingual pairs, colocated. Same reasoning as BREACH_TEXT in protection.ts:
 * these strings appear only in the clinic, and a string whose halves live in
 * two distant files is a string that ships in one language.
 */
const TEXT = {
  summary: { en: 'Summary', ar: 'الملخّص' },
  cards: { en: 'Cards', ar: 'البطاقات' },
  reveal: { en: 'Show the answer', ar: 'أظهر الإجابة' },
  next: { en: 'Next', ar: 'التالي' },
  prev: { en: 'Back', ar: 'السابق' },
  finish: { en: 'Done — open the clinic', ar: 'انتهيت — افتح العيادة' },
  escHint: { en: 'Esc or ▁ puts it back on the monitor', ar: 'زر Esc أو ▁ يعيدها إلى الشاشة' },
  summaryNote: {
    en: 'This is the reasoning the day turns on. The cards drill the details you will be asked for.',
    ar: 'هذا هو المنطق الذي يقوم عليه اليوم. البطاقات تدرّبك على التفاصيل التي ستُسأل عنها.',
  },
} as const

const S: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 55,
    // Deliberately NOT a dimmer: the room stays visible behind the window, so
    // reading at the desk still feels like being in the clinic.
    pointerEvents: 'none',
  },
  panel: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 'min(76vw, 880px)',
    maxHeight: '78vh',
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'auto',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#11161d',
    border: '1px solid #2a323d',
    boxShadow: '0 30px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
    transition: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease-out',
    willChange: 'transform, opacity',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.55rem 0.7rem 0.55rem 0.9rem',
    background: '#0c1015',
    borderBottom: '1px solid #222a34',
  },
  barDot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: '#6dc5bc',
    boxShadow: '0 0 8px #6dc5bc',
  },
  barTitle: {
    flex: 1,
    fontSize: '0.85rem',
    color: '#aeb9c6',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  minimise: {
    width: 30,
    height: 24,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 5,
    border: '1px solid #2f3945',
    background: '#171d25',
    color: '#cfd8e3',
    cursor: 'pointer',
    fontSize: '0.8rem',
    lineHeight: 1,
  },
  tabs: { display: 'flex', gap: 2, padding: '0.5rem 0.7rem 0', background: '#0c1015' },
  tab: {
    padding: '0.4rem 0.95rem',
    border: 'none',
    borderRadius: '7px 7px 0 0',
    background: 'transparent',
    color: '#7d8b9b',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  tabOn: { background: '#11161d', color: '#e8eff6' },
  body: { padding: '1.3rem 1.5rem', overflowY: 'auto', flex: 1 },
  lead: { margin: 0, fontSize: '1.02rem', lineHeight: 1.62, color: '#e2eaf2' },
  note: { marginTop: '1.1rem', fontSize: '0.83rem', lineHeight: 1.55, color: '#78859a' },
  cardWrap: { display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' },
  cardFront: {
    fontSize: '1.22rem',
    lineHeight: 1.5,
    color: '#f0f5fa',
    textAlign: 'center',
    maxWidth: '54ch',
  },
  cardBack: {
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#b9dfd9',
    textAlign: 'center',
    maxWidth: '58ch',
    padding: '0.9rem 1.1rem',
    borderRadius: 9,
    background: 'rgba(109,197,188,0.08)',
    border: '1px solid rgba(109,197,188,0.22)',
  },
  cardSource: { fontSize: '0.78rem', color: '#6c7b8c' },
  reveal: {
    padding: '0.5rem 1.4rem',
    borderRadius: 8,
    border: '1px solid #35414f',
    background: '#1a212a',
    color: '#dce6f0',
    fontSize: '0.92rem',
    cursor: 'pointer',
  },
  cardNav: { display: 'flex', gap: '0.6rem', marginTop: '0.3rem' },
  navBtn: {
    padding: '0.4rem 1rem',
    borderRadius: 7,
    border: '1px solid #2c3543',
    background: '#151b23',
    color: '#aab7c5',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.7rem 1rem',
    borderTop: '1px solid #222a34',
    background: '#0c1015',
  },
  hint: { fontSize: '0.76rem', color: '#66727f' },
  finish: {
    padding: '0.5rem 1.2rem',
    borderRadius: 8,
    border: '1px solid #6dc5bc',
    background: 'rgba(109,197,188,0.14)',
    color: '#8fe0d7',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
