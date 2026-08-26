import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useLocale } from '../locales/LocaleContext'
import { extractDeck, estimateTokens, looksScanned, type Deck } from '../ingest/pdf'
import { runPipeline, type Stage } from '../ingest/pipeline'
import {
  getApiKey,
  getProvider,
  KEY_HINT,
  PROVIDER_LABEL,
  setApiKey,
  setProvider,
  type Provider,
} from '../ingest/client'
import { saveToLibrary } from '../content/library'
import type { AssembleReport } from '../ingest/assemble'
import type { Track } from '../game/cast'
import { popIn } from '../ui/motion'

interface Props {
  /** Stamped onto the generated day so it lands in the right schedule. */
  track: Track
  onImported: () => void
  onBack: () => void
}

function stageLabel(stage: Stage): string {
  switch (stage.name) {
    case 'reading':
      return 'Reading the deck…'
    case 'blueprint':
      return 'Building the exam blueprint…'
    case 'writing':
      return `Writing items — topic ${stage.done} of ${stage.total}`
    case 'reviewing':
      return `Review committee — topic ${stage.done} of ${stage.total}`
    case 'film':
      return 'Choosing the radiograph…'
    case 'case':
      return 'Writing the patient encounter…'
    case 'assembling':
      return 'Checking every quote against the deck…'
  }
}

export function Import({ track, onImported, onBack }: Props) {
  const { t } = useLocale()
  const fileRef = useRef<HTMLInputElement>(null)

  const [provider, setProviderState] = useState<Provider>(() => getProvider())
  const [key, setKeyState] = useState(() => getApiKey() ?? '')
  const [deck, setDeck] = useState<Deck | null>(null)
  const [stage, setStage] = useState<Stage | null>(null)
  const [report, setReport] = useState<AssembleReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pickFile(file: File) {
    setError(null)
    setReport(null)
    setStage({ name: 'reading' })
    try {
      const extracted = await extractDeck(file)
      setDeck(extracted)
      if (looksScanned(extracted)) {
        setError(
          'This PDF has almost no selectable text — it looks like scanned images. Export it from PowerPoint or Word rather than scanning.',
        )
      }
    } catch {
      setError('Could not read that PDF.')
    } finally {
      setStage(null)
    }
  }

  async function run() {
    if (!deck) return
    setError(null)
    setReport(null)
    try {
      const result = await runPipeline({ deck, onStage: setStage })
      setReport(result)
      // The generator reads a lecture, not a curriculum — the track has to come
      // from who is signed in, or the day never shows up in their schedule.
      saveToLibrary({ ...result.day, track })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(
        message === 'NO_API_KEY'
          ? 'Add your Anthropic API key first.'
          : message,
      )
    } finally {
      setStage(null)
    }
  }

  const busy = stage !== null
  const pages = deck?.pages.length ?? 0
  const tokens = deck ? estimateTokens(deck.pages.map((p) => p.text).join(' ')) : 0

  return (
    <motion.div className="stack" variants={popIn} initial="enter" animate="center">
      <div className="card">
        <div className="section-title">Import</div>
        <h1>Turn a lecture into a clinic day</h1>
        <p className="muted">
          Upload a lecture PDF. It gets read as a whole, blueprinted the way an exam
          committee blueprints a paper, written up as exam items, reviewed for flaws,
          and every quote checked back against your slides before anything reaches the
          game.
        </p>
      </div>

      <div className="card">
        <div className="section-title">Model provider</div>
        <div style={{ display: 'flex', gap: 8, marginBlockEnd: 12, flexWrap: 'wrap' }}>
          {(['deepseek', 'anthropic'] as Provider[]).map((p) => (
            <button
              key={p}
              className="option"
              style={{
                flex: 1,
                minInlineSize: 140,
                cursor: 'pointer',
                outline: provider === p ? '2px solid currentColor' : 'none',
                opacity: provider === p ? 1 : 0.6,
              }}
              onClick={() => {
                setProvider(p)
                setProviderState(p)
                // Keys are stored per provider, so switching swaps the field
                // rather than wiping the key you just pasted for the other one.
                setKeyState(getApiKey(p) ?? '')
              }}
            >
              {PROVIDER_LABEL[p]}
              <div className="muted" style={{ fontSize: 12 }}>
                {p === 'deepseek'
                  ? '~$0.03/lecture off-peak, $0.06 at 9am–1pm Amman'
                  : 'Haiku 4.5 — ~$0.20/lecture, schema-enforced'}
              </div>
            </button>
          ))}
        </div>

        <div className="section-title">{PROVIDER_LABEL[provider]} API key</div>
        <input
          className="option"
          style={{ width: '100%' }}
          type="password"
          value={key}
          placeholder={KEY_HINT[provider]}
          onChange={(e) => {
            setKeyState(e.target.value)
            setApiKey(e.target.value, provider)
          }}
        />
        <div className="feedback mid" style={{ marginBlockStart: 12 }}>
          <div className="feedback-title">⚠️ Personal use only</div>
          <p>
            The key is stored in this browser and sent straight to {PROVIDER_LABEL[provider]} from
            this page. That is fine for your own machine with your own key. Do not put a key
            here on a shared computer, and this screen must move behind a small server
            before the app is published — anything running on a public page can read it.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Lecture PDF</div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void pickFile(file)
          }}
        />
        <button
          className="btn"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {deck ? `📄 ${deck.fileName}` : '📄 Choose a PDF'}
        </button>
        {deck && (
          <p className="muted" style={{ marginBlockStart: 10 }}>
            {pages} pages · roughly {tokens.toLocaleString()} tokens of text
          </p>
        )}
      </div>

      {error && (
        <div className="card">
          <div className="feedback bad">
            <div className="feedback-title">Stopped</div>
            <p>{error}</p>
          </div>
        </div>
      )}

      {stage && (
        <div className="card">
          <div className="section-title">Working</div>
          <p>{stageLabel(stage)}</p>
          <div className="progress-track" style={{ marginBlockStart: 12 }}>
            <motion.div
              className="progress-fill"
              animate={{
                width:
                  stage.name === 'writing' || stage.name === 'reviewing'
                    ? `${(stage.done / Math.max(stage.total, 1)) * 100}%`
                    : '100%',
              }}
            />
          </div>
          <p className="muted" style={{ marginBlockStart: 10 }}>
            This takes a few minutes on a full lecture. Item writing is the slow part —
            it is meant to be.
          </p>
        </div>
      )}

      {report && (
        <div className="card">
          <div className="section-title">Done</div>
          <h2>{report.day.title.en}</h2>
          <div className="result-grid">
            <div className="result-cell">
              <div className="result-value">{report.kept}</div>
              <div className="result-label">items kept</div>
            </div>
            <div className="result-cell">
              <div className="result-value">{report.droppedUnverified}</div>
              <div className="result-label">unverified</div>
            </div>
            <div className="result-cell">
              <div className="result-value">{report.droppedDuplicate}</div>
              <div className="result-label">duplicates</div>
            </div>
          </div>
          <p className="muted" style={{ marginBlockStart: 12 }}>
            Difficulty: {report.difficultyMix.easy} easy · {report.difficultyMix.moderate}{' '}
            moderate · {report.difficultyMix.hard} hard · {report.difficultyMix.brutal}{' '}
            brutal
          </p>
          {report.droppedUnverified > 0 && (
            <p className="muted" style={{ marginBlockStart: 8 }}>
              {report.droppedUnverified} item(s) quoted something not found in your
              slides and were dropped rather than shown to you.
            </p>
          )}
          <button
            className="btn btn-primary"
            style={{ marginBlockStart: 14 }}
            onClick={onImported}
          >
            Play it
          </button>
        </div>
      )}

      {!busy && (
        <div className="row">
          <button className="btn btn-ghost" onClick={onBack}>
            {t('backToTablet')}
          </button>
          <button className="btn btn-primary" disabled={!deck || !key} onClick={run}>
            Generate
          </button>
        </div>
      )}
    </motion.div>
  )
}
