import { useMemo, useState, type CSSProperties } from 'react'
import { CORE } from '../ingest/caseFixture'
import { classify, isProcedureUnlocked, type Verdict } from '../ingest/classify'
import { cardsFromOutcome, type StudyCard } from '../ingest/studyCards'
import type { CaseCore, ChannelId, Fact } from '../ingest/channels'

/**
 * The solo loop, end to end: read the case, commit an answer, live with it.
 *
 * Solo is not co-op with the constraint removed — it is the single-player game.
 * Everything is visible, it grades on-device with no model call, and it works
 * offline. Co-op is these same screens with a server dealing the documents out
 * instead of showing them all.
 *
 * Opened with #case. Runs on the hand-written fixture case so the loop can be
 * judged before generation is wired to it.
 */

const CHANNEL_LABEL: Record<ChannelId, string> = {
  CHAIR: 'The patient',
  RECORDS: 'Chart & history',
  IMAGING: 'Radiographs',
  PROTOCOL: 'Clinical protocol',
}

/** Teeth the case actually has data for, plus the answer. Never a bare 32-way guess. */
function candidateTeeth(core: CaseCore): string[] {
  const seen = new Set<string>()
  for (const f of core.facts) if (f.tooth) seen.add(f.tooth)
  seen.add(core.groundTruth.siteFDI)
  return [...seen].sort()
}

type Phase = 'reading' | 'holding' | 'resolved'

export default function CasePlay() {
  const [tabled, setTabled] = useState<Set<string>>(new Set())
  const [diagnosisId, setDiagnosisId] = useState<string | null>(null)
  const [siteFDI, setSiteFDI] = useState<string | null>(null)
  const [procedureId, setProcedureId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('reading')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [cards, setCards] = useState<StudyCard[]>([])

  const teeth = useMemo(() => candidateTeeth(CORE), [])
  const byChannel = useMemo(() => {
    const map = new Map<ChannelId, Fact[]>()
    for (const f of CORE.facts) {
      const list = map.get(f.channel) ?? []
      list.push(f)
      map.set(f.channel, list)
    }
    return map
  }, [])

  // Commit-then-execute: the diagnosis gates which procedures are even offered.
  // Server-side in co-op; here it is the same function, run locally.
  const unlocked = useMemo(
    () =>
      diagnosisId
        ? CORE.options.procedures.filter((p) => isProcedureUnlocked(CORE, diagnosisId, p.id))
        : [],
    [diagnosisId],
  )

  const chosenProcedure = CORE.options.procedures.find((p) => p.id === procedureId)
  const ready = diagnosisId !== null && siteFDI !== null && procedureId !== null

  function reveal(factId: string) {
    setTabled((prev) => new Set(prev).add(factId))
  }

  function commit() {
    if (!ready) return
    setPhase('holding')

    // The dread interval. Do NOT resolve immediately — the pause between
    // committing and finding out is where the answer actually lands. Cheapest
    // high-value beat in the whole design.
    window.setTimeout(() => {
      const v = classify({ diagnosisId: diagnosisId!, siteFDI: siteFDI!, procedureId: procedureId! }, CORE)
      setVerdict(v)
      setCards(cardsFromOutcome(CORE, v, tabled))
      setPhase('resolved')
    }, 2800)
  }

  function reset() {
    setTabled(new Set())
    setDiagnosisId(null)
    setSiteFDI(null)
    setProcedureId(null)
    setVerdict(null)
    setCards([])
    setPhase('reading')
  }

  const correct = verdict?.errorClass === 'F_CORRECT'
  const consequence = verdict ? CORE.consequences[verdict.errorClass] : null

  return (
    <div style={S.page}>
      <header style={S.header}>
        <h1 style={S.title}>{CORE.title.en}</h1>
        <span style={S.badge}>solo · offline · graded on-device</span>
      </header>

      {phase === 'holding' && (
        <div style={S.holding}>
          <div style={S.holdingInner}>
            <p style={S.holdingText}>…</p>
            <p style={S.muted}>the chair whirs, the suction gurgles</p>
          </div>
        </div>
      )}

      <div style={S.columns}>
        {/* ------------------------------------------------ the case ------- */}
        <section style={S.panel}>
          <h2 style={S.h2}>The case</h2>
          <p style={S.muted}>
            Click a finding to read it. In co-op these are split between players — here you
            hold all of them.
          </p>

          {[...byChannel.entries()].map(([channel, facts]) => (
            <div key={channel} style={S.channel}>
              <h3 style={S.h3}>{CHANNEL_LABEL[channel]}</h3>
              {facts.map((f) => {
                const open = tabled.has(f.id)
                return (
                  <button
                    key={f.id}
                    onClick={() => reveal(f.id)}
                    disabled={phase !== 'reading'}
                    style={{ ...S.fact, ...(open ? S.factOpen : {}) }}
                  >
                    <span style={S.factHead}>
                      {f.tooth ? `Tooth ${f.tooth} · ` : ''}
                      {f.category}
                    </span>
                    <span style={open ? S.factValue : S.factHidden}>
                      {open ? f.value : 'tap to read'}
                    </span>
                    {open && <span style={S.pageRef}>p.{f.sourcePage}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </section>

        {/* ------------------------------------------------ the commit ----- */}
        <section style={S.panel}>
          <h2 style={S.h2}>Your call</h2>

          <label style={S.label}>Diagnosis</label>
          <select
            value={diagnosisId ?? ''}
            disabled={phase !== 'reading'}
            onChange={(e) => {
              setDiagnosisId(e.target.value || null)
              setProcedureId(null) // the gate changed; the old choice may be locked
            }}
            style={S.select}
          >
            <option value="">— choose —</option>
            {CORE.options.diagnoses.map((d) => (
              <option key={d.id} value={d.id}>{d.en}</option>
            ))}
          </select>

          <label style={S.label}>Tooth (FDI)</label>
          <div style={S.teeth}>
            {teeth.map((t) => (
              <button
                key={t}
                disabled={phase !== 'reading'}
                onClick={() => setSiteFDI(t)}
                style={{ ...S.tooth, ...(siteFDI === t ? S.toothOn : {}) }}
              >
                {t}
              </button>
            ))}
          </div>

          <label style={S.label}>Procedure</label>
          {!diagnosisId ? (
            <p style={S.gate}>Commit to a diagnosis first — it decides what you may do.</p>
          ) : (
            <select
              value={procedureId ?? ''}
              disabled={phase !== 'reading'}
              onChange={(e) => setProcedureId(e.target.value || null)}
              style={S.select}
            >
              <option value="">— choose —</option>
              {unlocked.map((p) => (
                <option key={p.id} value={p.id}>{p.en}</option>
              ))}
            </select>
          )}

          {/* Show the stake BEFORE the commit, not after. */}
          {chosenProcedure && (
            <p style={chosenProcedure.irreversible ? S.stakeBad : S.stakeOk}>
              {chosenProcedure.irreversible
                ? 'IRREVERSIBLE — you cannot undo this to a real patient'
                : 'Reversible — this can be revisited'}
            </p>
          )}

          {phase === 'reading' && (
            <button onClick={commit} disabled={!ready} style={{ ...S.commit, ...(ready ? {} : S.commitOff) }}>
              {ready ? 'Commit and treat' : 'Choose all three'}
            </button>
          )}

          {/* ------------------------------------------- the outcome ------- */}
          {phase === 'resolved' && verdict && (
            <div style={S.outcome}>
              <h3 style={{ ...S.h3, color: correct ? '#1f7a4d' : '#a3341f' }}>
                {correct ? 'The patient thanks you and leaves.' : 'That went badly.'}
              </h3>
              <p style={S.reason}>{verdict.reason}</p>

              {consequence && !correct && (
                <div style={S.consequence}>
                  <strong>{consequence.primitive.replace(/_/g, ' ')}</strong>
                  <p style={S.muted}>{consequence.clinicalRationale}</p>
                </div>
              )}

              <h3 style={S.h3}>Why</h3>
              <p style={S.reason}>{CORE.debrief.causalChain.en}</p>
              <p style={S.patient}>“{correct ? CORE.debrief.patientPerspective.success.en : CORE.debrief.patientPerspective.failure.en}”</p>

              <h3 style={S.h3}>{cards.length} card{cards.length === 1 ? '' : 's'} added to your deck</h3>
              {cards.map((c) => (
                <div key={c.id} style={S.card}>
                  <span style={S.cardTag}>{c.origin}{c.priority === 'high' ? ' · review soon' : ''}</span>
                  <strong>{c.front.en}</strong>
                  <span>{c.back.en}</span>
                  <span style={S.pageRef}>p.{c.sourcePage}</span>
                </div>
              ))}

              <button onClick={reset} style={S.commit}>Play again</button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  page: { minBlockSize: '100dvh', background: '#fbf7f0', color: '#2a2015', font: '15px/1.55 system-ui', padding: '20px' },
  header: { display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBlockEnd: 16 },
  title: { margin: 0, fontSize: 24 },
  badge: { fontSize: 12, background: '#e8ded0', padding: '3px 9px', borderRadius: 20, color: '#6b5b46' },
  columns: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' },
  panel: { background: '#fff', border: '1px solid #e4d9c8', borderRadius: 14, padding: 16 },
  h2: { margin: '0 0 4px', fontSize: 17 },
  h3: { margin: '16px 0 6px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b5b46' },
  muted: { color: '#6b5b46', fontSize: 13, margin: '0 0 8px' },
  channel: { marginBlockStart: 10 },
  fact: { display: 'grid', gap: 2, inlineSize: '100%', textAlign: 'start', background: '#faf6ef', border: '1px solid #e4d9c8', borderRadius: 10, padding: '9px 11px', marginBlockEnd: 6, cursor: 'pointer', font: 'inherit' },
  factOpen: { background: '#fff', borderColor: '#c9b79a' },
  factHead: { fontSize: 12, color: '#8a7863', textTransform: 'uppercase', letterSpacing: '.04em' },
  factValue: { color: '#2a2015' },
  factHidden: { color: '#b0a08a', fontStyle: 'italic' },
  pageRef: { fontSize: 11, color: '#8a7863' },
  label: { display: 'block', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6b5b46', marginBlockStart: 12, marginBlockEnd: 4 },
  select: { inlineSize: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid #d8c9b2', background: '#fff', font: 'inherit' },
  teeth: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tooth: { padding: '7px 12px', borderRadius: 9, border: '1px solid #d8c9b2', background: '#fff', cursor: 'pointer', font: 'inherit' },
  toothOn: { background: '#2a2015', color: '#fff', borderColor: '#2a2015' },
  gate: { fontSize: 13, color: '#8a7863', fontStyle: 'italic', margin: '4px 0' },
  stakeOk: { fontSize: 13, color: '#1f7a4d', marginBlockStart: 10 },
  stakeBad: { fontSize: 13, color: '#a3341f', fontWeight: 600, marginBlockStart: 10 },
  commit: { inlineSize: '100%', marginBlockStart: 16, padding: '12px', borderRadius: 11, border: 0, background: '#2a2015', color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer' },
  commitOff: { background: '#cdbfa9', cursor: 'not-allowed' },
  outcome: { marginBlockStart: 8 },
  reason: { margin: '0 0 8px' },
  consequence: { background: '#fdeee9', border: '1px solid #f0cfc4', borderRadius: 10, padding: '10px 12px', margin: '8px 0' },
  patient: { fontStyle: 'italic', color: '#6b5b46', borderInlineStart: '3px solid #e4d9c8', paddingInlineStart: 10, margin: '8px 0' },
  card: { display: 'grid', gap: 3, background: '#faf6ef', border: '1px solid #e4d9c8', borderRadius: 10, padding: '10px 12px', marginBlockEnd: 6 },
  cardTag: { fontSize: 11, color: '#8a7863', textTransform: 'uppercase', letterSpacing: '.04em' },
  holding: { position: 'fixed', inset: 0, background: 'rgba(20,16,10,.86)', display: 'grid', placeItems: 'center', zIndex: 10 },
  holdingInner: { textAlign: 'center', color: '#f4ece0' },
  holdingText: { fontSize: 40, letterSpacing: '.3em', margin: 0 },
}

