import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { NoToneMapping } from 'three'
import { RoomModel } from './RoomModel'
import { ReactingPatient } from './ReactingPatient'
import { PostFX } from './PostFX'
import { DURATION } from './reaction'
import type { ConsequencePrimitive } from '../ingest/channels'

/**
 * Reaction lab — opened with #react.
 *
 * Every consequence, fireable on demand, so the timing can be judged by eye
 * rather than by reading a curve. The unit tests prove the maths is sane; only
 * a person can say whether a scream is funny or just broken, and that judgement
 * needs a button, not a screenshot.
 *
 * Not part of the game. It exists so the reaction set can be tuned before it is
 * wired to real decisions.
 */

interface Entry {
  primitive: ConsequencePrimitive
  label: string
  note: string
  tone: 'good' | 'bad' | 'chaos'
}

const REACTIONS: Entry[] = [
  { primitive: 'procedure_success', label: 'Correct', note: 'settles, then thanks you', tone: 'good' },
  { primitive: 'patient_calm', label: 'Calm', note: 'just breathing', tone: 'good' },
  { primitive: 'patient_flinch', label: 'Flinch', note: 'small, quick', tone: 'bad' },
  { primitive: 'patient_wince_vocal', label: 'Wince', note: 'that hurt', tone: 'bad' },
  { primitive: 'patient_scream', label: 'Scream', note: 'you hit the pulp', tone: 'bad' },
  { primitive: 'patient_bleed', label: 'Bleed', note: 'screen fills red', tone: 'bad' },
  { primitive: 'patient_thrash', label: 'Thrash', note: 'flailing, decaying', tone: 'chaos' },
  { primitive: 'patient_bolts', label: 'Bolts', note: 'out of the chair, gone', tone: 'chaos' },
  { primitive: 'tray_erupts', label: 'Tray erupts', note: 'instruments everywhere', tone: 'chaos' },
  { primitive: 'assistant_recoil', label: 'Assistant recoils', note: 'small shake', tone: 'chaos' },
]

export default function ReactionLab() {
  const [active, setActive] = useState<ConsequencePrimitive | null>(null)
  const [trigger, setTrigger] = useState(0)
  const fxRef = useRef<HTMLDivElement>(null)

  function fire(p: ConsequencePrimitive) {
    setActive(p)
    setTrigger((n) => n + 1)
  }

  return (
    <div style={S.root}>
      <Canvas
        camera={{ fov: 58, near: 0.1, far: 60, position: [0.1, 1.5, 2.4] }}
        gl={{ antialias: false, toneMapping: NoToneMapping, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={['#f2e9dc']} />
        <fog attach="fog" args={[0xf2e9dc, 16, 34]} />
        <Environment resolution={256} frames={1} environmentIntensity={0.5}>
          <Lightformer form="rect" intensity={3} color="#fff0d2" position={[-4, 3, -3]} scale={[8, 5, 1]} />
          <Lightformer form="rect" intensity={0.8} color="#dce6ff" position={[5, 2, 3]} scale={[5, 4, 1]} />
        </Environment>
        <hemisphereLight args={[0xfff6ea, 0xcbb79b, 0.3]} />
        <directionalLight position={[-4, 4.5, -4]} intensity={2} color={0xfff0d4} />

        <RoomModel drawerOpen={false} />
        <ReactingPatient
          primitive={active}
          triggerId={trigger}
          fxRef={fxRef}
          mood="anxious"
          onDone={() => setActive(null)}
        />

        <OrbitControls target={[1.5, 1, 0]} />
        <PostFX isTouch={false} />
      </Canvas>

      {/* Blood and flash: a DOM overlay, not a shader. Zero draw calls, runs on
          the compositor, survives a GPU-bound frame, and a "reduce gore" toggle
          can swap it for a cartoon splat without touching the 3D at all. */}
      <div ref={fxRef} style={S.fx} />

      <div style={S.panel}>
        <strong style={S.title}>Reaction lab</strong>
        <p style={S.hint}>Fire a consequence and watch. Drag to orbit.</p>
        <div style={S.grid}>
          {REACTIONS.map((r) => (
            <button
              key={r.primitive}
              onClick={() => fire(r.primitive)}
              style={{ ...S.btn, ...TONE[r.tone], ...(active === r.primitive ? S.btnOn : {}) }}
            >
              <span style={S.btnLabel}>{r.label}</span>
              <span style={S.btnNote}>{r.note}</span>
              <span style={S.btnTime}>{DURATION[r.primitive]}s</span>
            </button>
          ))}
        </div>
        <p style={S.hint}>
          Note the correct outcome runs <strong>longer</strong> than any failure — if failing is
          the fun part, players farm failure and stop learning.
        </p>
      </div>
    </div>
  )
}

const TONE: Record<Entry['tone'], React.CSSProperties> = {
  good: { borderColor: '#8fbf9f' },
  bad: { borderColor: '#d99b8a' },
  chaos: { borderColor: '#c9a86a' },
}

const S: Record<string, React.CSSProperties> = {
  root: { position: 'fixed', inset: 0, background: '#14100a' },
  fx: {
    position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0, zIndex: 5,
    transition: 'opacity 90ms linear',
  },
  panel: {
    position: 'absolute', insetBlockEnd: 12, insetInlineStart: 12, insetInlineEnd: 12,
    maxInlineSize: 720, margin: '0 auto', zIndex: 10,
    background: 'rgba(255,252,246,.94)', borderRadius: 14, padding: '12px 14px',
    boxShadow: '0 6px 20px rgba(40,25,10,.28)', font: '14px/1.45 system-ui', color: '#2a2015',
  },
  title: { fontSize: 15 },
  hint: { margin: '4px 0 8px', fontSize: 12, color: '#6b5b46' },
  grid: { display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))' },
  btn: {
    display: 'grid', gap: 1, textAlign: 'start', padding: '8px 10px', cursor: 'pointer',
    background: '#fff', border: '1.5px solid #ddd', borderRadius: 10, font: 'inherit',
  },
  btnOn: { background: '#2a2015', color: '#fff' },
  btnLabel: { fontWeight: 600, fontSize: 13 },
  btnNote: { fontSize: 11, opacity: 0.7 },
  btnTime: { fontSize: 10, opacity: 0.5 },
}
