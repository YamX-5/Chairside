import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LocaleProvider } from './locales/LocaleContext'
import './ui/theme.css'

// Phase 0 look test, opened with #preview. Kept out of the game entirely so it
// can never affect normal play, and lazy so three.js isn't in the main bundle.
const ScenePreview = lazy(() => import('./clinic/ScenePreview'))

// The solo case loop, opened with #case. Runs on the fixture case so the
// commit-then-consequence-then-cards flow can be judged before generation is
// wired to it. Lazy for the same reason: it must not weigh on normal startup.
const CasePlay = lazy(() => import('./screens/CasePlay'))

// Every consequence, fireable on demand, opened with #react. Timing has to be
// judged by eye — the tests prove the curves are sane, not that a scream is funny.
const ReactionLab = lazy(() => import('./clinic/ReactionLab'))

// The vertical slice, opened with #play: the case happens INSIDE the clinic,
// the room never disappears behind an overlay, and the patient reacts to the
// verdict in 3D. This is the shape the real game takes.
const ClinicCase = lazy(() => import('./clinic/ClinicCase'))

type Route = 'app' | 'preview' | 'case' | 'react' | 'play'

function routeFor(hash: string): Route {
  if (hash === '#preview') return 'preview'
  if (hash === '#case') return 'case'
  if (hash === '#react') return 'react'
  if (hash === '#play') return 'play'
  return 'app'
}

const ROUTES: { route: Route; label: string }[] = [
  { route: 'play', label: '▶ Play' },
  { route: 'app', label: 'Game' },
  { route: 'react', label: 'Reactions' },
  { route: 'case', label: 'Case' },
  { route: 'preview', label: 'Room' },
]

/**
 * Dev-only switcher.
 *
 * Typing `#react` into the address bar is a reliable way to end up on the wrong
 * screen and conclude the feature is broken. `import.meta.env.DEV` is statically
 * replaced at build time, so this whole block is dropped from production.
 */
function DevNav({ route }: { route: Route }) {
  if (!import.meta.env.DEV) return null
  return (
    <div
      style={{
        position: 'fixed', insetBlockStart: 8, insetInlineEnd: 8, zIndex: 9999,
        display: 'flex', gap: 4, padding: 4, borderRadius: 10,
        background: 'rgba(20,16,10,.82)', backdropFilter: 'blur(6px)',
        font: '12px/1 system-ui',
      }}
    >
      {ROUTES.map((r) => (
        <button
          key={r.route}
          onClick={() => {
            window.location.hash = r.route === 'app' ? '' : `#${r.route}`
          }}
          style={{
            padding: '6px 10px', borderRadius: 7, cursor: 'pointer', font: 'inherit',
            border: 0,
            background: route === r.route ? '#f4ece0' : 'transparent',
            color: route === r.route ? '#2a2015' : '#cdbfa9',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Reacting to hashchange (rather than reading the hash once at startup) means a
 * route can be mounted without a full page load — which is the only way to
 * inspect the canvas under automation, where the WebGL context has to be
 * created after the environment is prepared.
 */
function Root() {
  const [route, setRoute] = useState<Route>(() => routeFor(window.location.hash))

  useEffect(() => {
    // 'hashchange' does NOT fire when the hash is cleared to empty from a button,
    // so the switcher's "Game" would silently do nothing. Poll as a backstop —
    // dev-only, and cheap next to a 3D scene.
    const onHash = () => setRoute(routeFor(window.location.hash))
    window.addEventListener('hashchange', onHash)
    const poll = import.meta.env.DEV ? window.setInterval(onHash, 250) : undefined
    return () => {
      window.removeEventListener('hashchange', onHash)
      if (poll) window.clearInterval(poll)
    }
  }, [])

  return (
    <>
      <DevNav route={route} />
      {route === 'app' ? (
        <App />
      ) : (
        <Suspense fallback={<div className="centered"><p className="muted">Loading…</p></div>}>
          {route === 'preview' && <ScenePreview />}
          {route === 'case' && <CasePlay />}
          {route === 'react' && <ReactionLab />}
          {route === 'play' && <ClinicCase />}
        </Suspense>
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <Root />
    </LocaleProvider>
  </StrictMode>,
)
