import { useRef, useState } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { Euler, DoubleSide, Group } from 'three'
import { SCREEN_ANCHOR, SCREEN_H, SCREEN_W } from './layout'
import type { CaseCore } from '../ingest/channels'

/**
 * The screen's tilt, in YXZ order — and the order is the whole point.
 *
 * three's Euler defaults to XYZ, which composes Rx then Ry then Rz. With a 90
 * degree yaw in the middle, the -0.18 rad tilt is applied about the WORLD X
 * axis AFTER the yaw has already turned the screen — and world X is by then the
 * screen's own line of sight, so the intended backward lean lands as a rotation
 * of the picture within its own plane. Measured: 10.31 degrees of apparent roll
 * on the screen and every line of text on it, versus 0.00 in YXZ.
 *
 * Module-level so it is not reallocated every render.
 */
// Tilt IMPORTED, not typed: LAPTOP.y is computed from the same angle so the
// lid's lower edge lands exactly on the desk. Two copies would drift and the
// screen would sink into the wood again.
// A monitor stands upright: no lid, so no backward lean. The small -0.06 is
// the few degrees a real panel is tipped back on its stand.
const SCREEN_ROT = new Euler(-0.06, Math.PI / 2, 0, 'YXZ')

/**
 * The laptop screen. It never leaves the laptop — the camera leans in to read
 * it (see CameraFocus).
 *
 * EVERY size and position here is a fraction of the screen, never an absolute
 * metre value. The first version hard-coded offsets like `-h/2 + 0.10` while the
 * panel was 0.58 m tall; when the panel shrank back to the laptop's real 0.195 m
 * those offsets stayed put, so every row landed on top of every other row and
 * the text rendered three times too large. Proportional units make that
 * impossible.
 */

export type StudyTab = 'summary' | 'cards'
export type DayPhase = 'morning' | 'studying' | 'clinic' | 'done'

/** The laptop's actual lid. */
const W = SCREEN_W
// IMPORTED. layout.ts owns it, because LAPTOP.y is derived from it — this
// file restating 0.195 is how the two could disagree.
const H = SCREEN_H

// --- proportional type scale ------------------------------------------------
const ROW = H * 0.108 // one line of body text, including leading
const F_TITLE = H * 0.082
const F_BODY = H * 0.066
const F_SMALL = H * 0.056
const PAD = W * 0.05

const BG = '#12161c'
const INK = '#dfe8f2'
const DIM = '#7d8fa3'
const ACCENT = '#6dc5bc'

interface Props {
  core: CaseCore
  phase: DayPhase
  tab: StudyTab
  onTab: (t: StudyTab) => void
  cardIndex: number
  onCardIndex: (i: number) => void
  onFinish: () => void
  patientName: string
  waiting: boolean
  arriving: boolean
  onCall: () => void
}

/** A line of text on the screen. `y` is measured DOWN from the top edge. */
function Line({
  y,
  text,
  size = F_BODY,
  color = INK,
  onClick,
  boxed,
  width = W - PAD * 2,
}: {
  y: number
  text: string
  size?: number
  color?: string
  onClick?: () => void
  boxed?: boolean
  width?: number
}) {
  const [hover, setHover] = useState(false)
  const active = Boolean(onClick)
  return (
    <group position={[0, H / 2 - y, 0.004]}>
      {(boxed || active) && (
        <mesh
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onClick?.()
          }}
          onPointerOver={() => setHover(true)}
          onPointerOut={() => setHover(false)}
        >
          <planeGeometry args={[width, size * 1.9]} />
          <meshBasicMaterial
            color={hover && active ? ACCENT : '#1d242e'}
            transparent
            opacity={boxed || (hover && active) ? 1 : 0}
            depthTest={false}
          />
        </mesh>
      )}
      <Text
        position={[0, 0, 0.001]}
        fontSize={size}
        color={hover && active ? BG : color}
        maxWidth={width - PAD * 0.6}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        lineHeight={1.25}
      >
        {text}
      </Text>
    </group>
  )
}

export function DeskScreen({
  core,
  phase,
  tab,
  onTab,
  cardIndex,
  onCardIndex,
  onFinish,
  patientName,
  waiting,
  arriving,
  onCall,
}: Props) {
  const root = useRef<Group>(null)
  const studying = phase === 'studying'

  const cards = [
    { front: core.debrief.takeawayCard.front.en, back: core.debrief.takeawayCard.back.en },
    ...core.facts
      .filter((f) => f.loadBearing && f.channel === 'PROTOCOL')
      .map((f) => ({ front: f.label, back: f.value })),
  ]
  const card = cards[Math.min(cardIndex, cards.length - 1)]

  return (
    <group ref={root} position={[SCREEN_ANCHOR.x, SCREEN_ANCHOR.y, SCREEN_ANCHOR.z]} rotation={SCREEN_ROT}>
      <mesh>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color={BG} side={DoubleSide} depthTest={false} />
      </mesh>

      {/* --------------------------------------------------- before study --- */}
      {phase === 'morning' && (
        <>
          <Line y={ROW * 1.2} text="MORNING" size={F_TITLE} color={ACCENT} />
          <Line y={ROW * 2.6} text="No patients yet." />
          <Line y={H - ROW * 1.3} text="[E] review the material" size={F_SMALL} color={DIM} />
        </>
      )}

      {/* ------------------------------------------------------- studying --- */}
      {studying && (
        <>
          <group position={[0, H / 2 - ROW * 1.0, 0.004]}>
            {(['summary', 'cards'] as StudyTab[]).map((t, i) => (
              <group key={t} position={[(i - 0.5) * (W * 0.44), 0, 0]}>
                <mesh
                  onClick={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation()
                    onTab(t)
                  }}
                >
                  <planeGeometry args={[W * 0.42, ROW * 1.5]} />
                  <meshBasicMaterial color={tab === t ? ACCENT : '#1d242e'} depthTest={false} />
                </mesh>
                <Text position={[0, 0, 0.001]} fontSize={F_SMALL} color={tab === t ? BG : INK}>
                  {t === 'summary' ? 'Summary' : `Cards ${cardIndex + 1}/${cards.length}`}
                </Text>
              </group>
            ))}
          </group>

          {tab === 'summary' ? (
            <>
              <Line y={ROW * 2.5} text={core.title.en} size={F_BODY} color={ACCENT} />
              <group position={[0, H / 2 - ROW * 4.8, 0.004]}>
                <Text
                  fontSize={F_SMALL}
                  color={INK}
                  maxWidth={W - PAD * 2}
                  textAlign="center"
                  anchorX="center"
                  anchorY="middle"
                  lineHeight={1.35}
                >
                  {core.debrief.causalChain.en}
                </Text>
              </group>
            </>
          ) : (
            <>
              <group position={[0, H / 2 - ROW * 2.9, 0.004]}>
                <Text
                  fontSize={F_BODY}
                  color={ACCENT}
                  maxWidth={W - PAD * 2}
                  textAlign="center"
                  anchorY="middle"
                  lineHeight={1.3}
                >
                  {card.front}
                </Text>
              </group>
              <group position={[0, H / 2 - ROW * 5.2, 0.004]}>
                <Text
                  fontSize={F_SMALL}
                  color={INK}
                  maxWidth={W - PAD * 2}
                  textAlign="center"
                  anchorY="middle"
                  lineHeight={1.3}
                >
                  {card.back}
                </Text>
              </group>
              <Line
                y={H - ROW * 2.6}
                text="next card"
                size={F_SMALL}
                width={W * 0.5}
                onClick={() => onCardIndex((cardIndex + 1) % cards.length)}
              />
            </>
          )}

          <Line y={H - ROW * 1.1} text="FINISHED — open the clinic" size={F_SMALL} boxed onClick={onFinish} />
        </>
      )}

      {/* ------------------------------------------------- clinic is open --- */}
      {(phase === 'clinic' || phase === 'done') && (
        <>
          <Line y={ROW * 1.2} text="TODAY'S LIST" size={F_SMALL} color={ACCENT} />
          <Line y={ROW * 2.7} text={`09:00  ${patientName}`} />
          <Line y={ROW * 4.0} text={core.title.en} size={F_SMALL} color={DIM} />

          {waiting ? (
            <Line y={H - ROW * 1.2} text="CALL THE PATIENT" size={F_SMALL} boxed onClick={onCall} />
          ) : (
            <Line
              y={H - ROW * 1.2}
              text={phase === 'done' ? 'seen' : arriving ? 'coming through' : 'in the chair'}
              size={F_SMALL}
              color={phase === 'done' ? ACCENT : DIM}
            />
          )}
        </>
      )}
    </group>
  )
}
