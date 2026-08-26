import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { DoubleSide, Group, Quaternion, Vector3 } from 'three'
import type { CaseCore, ChannelId, Fact } from '../ingest/channels'

/**
 * The case, as paper you hold.
 *
 * The side panel this replaces was the same mistake as the full-screen overlay:
 * the moment the student needed information, they stopped being in a clinic and
 * started reading a webpage. A dentist reads a chart. So the history, the
 * radiographs and the treatment plan are pages of a physical document held in
 * front of the camera, and you flip between them.
 *
 * It follows the camera rather than being parented to it, because the camera is
 * also being written by Player (movement) and ReactingPatient (shake). Copying
 * its transform once per frame composes with both; parenting would fight them.
 */

export type Page = 'history' | 'imaging' | 'plan'

const PAGES: { id: Page; label: string }[] = [
  { id: 'history', label: 'History' },
  { id: 'imaging', label: 'Imaging' },
  { id: 'plan', label: 'Plan' },
]

const PAPER_W = 0.52
const PAPER_H = 0.68

const INK = '#2a2015'
const FAINT = '#8a7863'
const PAPER = '#f7f1e6'

/** Reused every frame — allocating in useFrame is a GC stutter. */
const camPos = new Vector3()
const camQuat = new Quaternion()
const offset = new Vector3()

interface Props {
  core: CaseCore
  open: boolean
  page: Page
  onPage: (p: Page) => void
  tabled: Set<string>
  onReveal: (factId: string) => void
  diagnosisId: string | null
  siteFDI: string | null
  procedureId: string | null
  onDiagnosis: (id: string) => void
  onSite: (t: string) => void
  onProcedure: (id: string) => void
  unlockedProcedureIds: string[]
  onCommit: () => void
  ready: boolean
}

function Row({
  y,
  label,
  selected,
  dim,
  onClick,
  size = 0.019,
}: {
  y: number
  label: string
  selected?: boolean
  dim?: boolean
  onClick?: () => void
  size?: number
}) {
  const [hover, setHover] = useState(false)
  return (
    <group position={[0, y, 0.002]}>
      <mesh
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <planeGeometry args={[PAPER_W - 0.06, 0.036]} />
        <meshBasicMaterial
          color={selected ? INK : hover && onClick ? '#e6dbc8' : PAPER}
          transparent
          opacity={selected ? 1 : hover && onClick ? 1 : 0}
        />
      </mesh>
      <Text
        position={[-(PAPER_W - 0.08) / 2, 0, 0.001]}
        anchorX="left"
        anchorY="middle"
        fontSize={size}
        maxWidth={PAPER_W - 0.09}
        color={selected ? PAPER : dim ? FAINT : INK}
        outlineWidth={0}
      >
        {label}
      </Text>
    </group>
  )
}

export function CasePapers(props: Props) {
  const { core, open, page, tabled } = props
  const root = useRef<Group>(null)
  const { camera } = useThree()

  const byChannel = useMemo(() => {
    const m = new Map<ChannelId, Fact[]>()
    for (const f of core.facts) {
      const list = m.get(f.channel) ?? []
      list.push(f)
      m.set(f.channel, list)
    }
    return m
  }, [core])

  const teeth = useMemo(() => {
    const s = new Set<string>()
    for (const f of core.facts) if (f.tooth) s.add(f.tooth)
    s.add(core.groundTruth.siteFDI)
    return [...s].sort()
  }, [core])

  useFrame(() => {
    const g = root.current
    if (!g || !open) return

    camera.getWorldPosition(camPos)
    camera.getWorldQuaternion(camQuat)

    offset.set(0, -0.16, -0.62)
    offset.applyQuaternion(camQuat)
    g.position.copy(camPos).add(offset)
    g.quaternion.copy(camQuat)
    g.rotateX(-0.32)
  })

  // Nothing at all until it is asked for. The earlier "stowed at the hip" state
  // meant a sheet of paper permanently floating in the corner of the view,
  // which reads as a rendering bug rather than as carrying a chart.
  if (!open) return null

  const facts = page === 'history' ? byChannel.get('RECORDS') ?? [] : byChannel.get('IMAGING') ?? []

  return (
    <group ref={root} renderOrder={999}>
      {/* The sheet. depthTest off so it is never buried in the chair or a wall. */}
      <mesh>
        <planeGeometry args={[PAPER_W, PAPER_H]} />
        <meshBasicMaterial color={PAPER} side={DoubleSide} depthTest={false} transparent opacity={0.97} />
      </mesh>

      {(
        <>
          {/* Tabs, on the paper itself — not browser chrome. */}
          <group position={[0, PAPER_H / 2 - 0.036, 0.002]}>
            {PAGES.map((p, i) => (
              <group key={p.id} position={[(i - 1) * 0.16, 0, 0]}>
                <mesh
                  onClick={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation()
                    props.onPage(p.id)
                  }}
                >
                  <planeGeometry args={[0.15, 0.036]} />
                  <meshBasicMaterial color={page === p.id ? INK : '#e6dbc8'} depthTest={false} />
                </mesh>
                <Text position={[0, 0, 0.001]} fontSize={0.018} color={page === p.id ? PAPER : INK}>
                  {p.label}
                </Text>
              </group>
            ))}
          </group>

          <Text
            position={[0, PAPER_H / 2 - 0.082, 0.002]}
            fontSize={0.021}
            color={INK}
            maxWidth={PAPER_W - 0.06}
          >
            {core.title.en}
          </Text>

          {/* ---------------------------------------------- history / imaging */}
          {/* SOLO SHOWS EVERYTHING. Hiding findings behind a tap is the co-op
              rule — in single player there is no teammate to withhold from, and
              a chart where every line reads "tap to read" is an empty chart.
              Tapping still marks a fact as read, which is what feeds the
              "you never looked at this" flashcards. */}
          {page !== 'plan' &&
            facts.map((f, i) => (
              <Row
                key={f.id}
                y={PAPER_H / 2 - 0.14 - i * 0.062}
                label={`${f.tooth ? f.tooth + '  ' : ''}${f.value}`}
                dim={!tabled.has(f.id)}
                size={0.0155}
                onClick={() => props.onReveal(f.id)}
              />
            ))}

          {/* A stand-in for the film until the real image is bound. Better an
              honest placeholder than a drawn radiograph, which would teach
              students to read pathology that is not there. */}
          {page === 'imaging' && (
            <group position={[0, -PAPER_H / 2 + 0.14, 0.002]}>
              <mesh>
                <planeGeometry args={[0.2, 0.16]} />
                <meshBasicMaterial color="#1b1b1e" depthTest={false} />
              </mesh>
              <Text position={[0, 0, 0.001]} fontSize={0.012} color="#7d8288" maxWidth={0.18}>
                radiograph
              </Text>
            </group>
          )}

          {/* ---------------------------------------------------------- plan */}
          {page === 'plan' && (
            <>
              <Row y={PAPER_H / 2 - 0.13} label="DIAGNOSIS" dim size={0.013} />
              {core.options.diagnoses.map((d, i) => (
                <Row
                  key={d.id}
                  y={PAPER_H / 2 - 0.163 - i * 0.038}
                  label={d.en}
                  size={0.0155}
                  selected={props.diagnosisId === d.id}
                  onClick={() => props.onDiagnosis(d.id)}
                />
              ))}

              <Row y={PAPER_H / 2 - 0.375} label="TOOTH" dim size={0.013} />
              <group position={[0, PAPER_H / 2 - 0.412, 0.002]}>
                {teeth.map((t, i) => (
                  <group key={t} position={[(i - (teeth.length - 1) / 2) * 0.08, 0, 0]}>
                    <mesh
                      onClick={(e: ThreeEvent<MouseEvent>) => {
                        e.stopPropagation()
                        props.onSite(t)
                      }}
                    >
                      <planeGeometry args={[0.07, 0.034]} />
                      <meshBasicMaterial
                        color={props.siteFDI === t ? INK : '#e6dbc8'}
                        depthTest={false}
                      />
                    </mesh>
                    <Text position={[0, 0, 0.001]} fontSize={0.017} color={props.siteFDI === t ? PAPER : INK}>
                      {t}
                    </Text>
                  </group>
                ))}
              </group>

              <Row y={PAPER_H / 2 - 0.46} label="PROCEDURE" dim size={0.013} />
              {props.diagnosisId ? (
                core.options.procedures
                  .filter((p) => props.unlockedProcedureIds.includes(p.id))
                  .map((p, i) => (
                    <Row
                      key={p.id}
                      y={PAPER_H / 2 - 0.492 - i * 0.038}
                      label={`${p.en}${p.irreversible ? '   ⚠ irreversible' : ''}`}
                      size={0.0155}
                      selected={props.procedureId === p.id}
                      onClick={() => props.onProcedure(p.id)}
                    />
                  ))
              ) : (
                <Row
                  y={PAPER_H / 2 - 0.492}
                  label="Write a diagnosis first — it decides what you may do"
                  dim
                  size={0.014}
                />
              )}

              {/* Commit, on the page, like signing the plan. */}
              <group position={[0, -PAPER_H / 2 + 0.05, 0.003]}>
                <mesh
                  onClick={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation()
                    if (props.ready) props.onCommit()
                  }}
                >
                  <planeGeometry args={[PAPER_W - 0.08, 0.05]} />
                  <meshBasicMaterial color={props.ready ? INK : '#d5c8b2'} depthTest={false} />
                </mesh>
                <Text position={[0, 0, 0.001]} fontSize={0.02} color={props.ready ? PAPER : '#9c8b74'}>
                  {props.ready ? 'TREAT' : 'complete the plan'}
                </Text>
              </group>
            </>
          )}
        </>
      )}
    </group>
  )
}
