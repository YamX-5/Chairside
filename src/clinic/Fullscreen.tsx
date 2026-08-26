import { useCallback, useEffect, useState } from 'react'

/**
 * Fullscreen toggle, for the phone.
 *
 * A browser on a phone spends a third of the screen on its own address bar and
 * navigation, and a first-person game rendered into the strip that is left reads
 * as a postage stamp. Fullscreen is the single largest visual improvement
 * available on mobile and it costs one API call.
 *
 * NOT AVAILABLE EVERYWHERE, and the button says so by disappearing: iOS Safari
 * still refuses `requestFullscreen` on anything that is not a <video>. Rendering
 * a button that silently does nothing is worse than rendering none, so the
 * capability is probed rather than assumed.
 */

interface FsElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}
interface FsDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsElement
  return typeof el.requestFullscreen === 'function' ||
    typeof el.webkitRequestFullscreen === 'function'
}

export function FullscreenButton() {
  const [on, setOn] = useState(false)
  const [supported] = useState(fullscreenSupported)

  useEffect(() => {
    const doc = document as FsDocument
    const sync = () => setOn(!!(document.fullscreenElement ?? doc.webkitFullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  const toggle = useCallback(async () => {
    const el = document.documentElement as FsElement
    const doc = document as FsDocument
    try {
      if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
        await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
      } else {
        await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.())
        // Landscape is the right orientation for a first-person room. Best
        // effort: the lock throws on desktop and on iOS, and a refused
        // orientation must not take the fullscreen with it.
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (o: string) => Promise<void>
        }
        try {
          await orientation?.lock?.('landscape')
        } catch {
          /* not supported here; fullscreen still applied */
        }
      }
    } catch {
      /* refused — the button simply does nothing rather than throwing */
    }
  }, [])

  if (!supported) return null

  return (
    <button
      type="button"
      className="fullscreen-toggle"
      onClick={toggle}
      aria-label={on ? 'Leave fullscreen' : 'Go fullscreen'}
      title={on ? 'Leave fullscreen' : 'Go fullscreen'}
    >
      {on ? '⤡' : '⤢'}
    </button>
  )
}
