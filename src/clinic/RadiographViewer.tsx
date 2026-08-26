import { useEffect, type CSSProperties } from 'react'
import { useLocale } from '../locales/LocaleContext'
import { filmView, XRAY_TEXT, type Film } from './radiograph'

/**
 * The film, full screen, over the top of the clinic.
 *
 * A radiograph is looked AT, not glanced at past a chair leg — so this is a
 * flat DOM overlay rather than a plane in the 3D scene. It also means the image
 * is shown at whatever resolution the student's own lecture had, with no
 * texture compression in the way.
 *
 * When the deck had no usable film this renders the reason instead of a
 * picture. See radiograph.ts for why that matters more than it looks like it
 * does: a student who memorises invented pathology carries it into a real
 * mouth.
 */
export function RadiographViewer({
  radiograph,
  onClose,
}: {
  radiograph: Film | undefined | null
  onClose: () => void
}) {
  const { c, isRtl } = useLocale()
  const view = filmView(radiograph)

  // Escape closes the film, and must NOT bubble: the clinic's own Escape
  // handler leaves the room entirely, so without stopping it here, closing a
  // radiograph would walk the player out of the surgery.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  return (
    <div style={S.backdrop} dir={isRtl ? 'rtl' : 'ltr'} onClick={onClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        <div style={S.title}>{c(XRAY_TEXT.title)}</div>

        {view.kind === 'film' ? (
          <>
            <img
              src={view.src}
              alt={c(view.shows)}
              style={S.film}
              // A film that fails to decode must not leave a broken-image icon
              // sitting where a diagnosis is supposed to come from.
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
            <div style={S.caption}>{c(view.shows)}</div>
            {view.page != null && (
              <div style={S.cite}>
                {c(XRAY_TEXT.fromPage).replace('{n}', String(view.page))}
              </div>
            )}
          </>
        ) : (
          <div style={S.empty}>
            <div style={S.emptyHead}>{c(XRAY_TEXT.noFilm)}</div>
            <div style={S.emptyWhy}>{c(XRAY_TEXT.noFilmWhy)}</div>
          </div>
        )}

        <button type="button" style={S.close} onClick={onClose}>
          {c(XRAY_TEXT.close)}
        </button>
      </div>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(8, 9, 11, 0.86)',
    backdropFilter: 'blur(3px)',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.7rem',
    maxWidth: 'min(92vw, 780px)',
    maxHeight: '90vh',
    padding: '1.1rem 1.3rem 1.3rem',
    borderRadius: 14,
    background: '#15171b',
    border: '1px solid #2b2f36',
    boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
  },
  title: {
    fontSize: '0.74rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#8b929b',
  },
  film: {
    maxWidth: '100%',
    maxHeight: '64vh',
    objectFit: 'contain',
    // Radiographs are viewed on a black box, not on a page.
    background: '#000',
    borderRadius: 6,
    border: '1px solid #2b2f36',
  },
  caption: {
    fontSize: '0.95rem',
    color: '#e7eaee',
    textAlign: 'center',
    maxWidth: '52ch',
    lineHeight: 1.45,
  },
  cite: { fontSize: '0.78rem', color: '#7d848d' },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    alignItems: 'center',
    padding: '2.4rem 1rem',
    maxWidth: '46ch',
    textAlign: 'center',
  },
  emptyHead: { fontSize: '1.02rem', color: '#e7eaee' },
  emptyWhy: { fontSize: '0.85rem', color: '#868d96', lineHeight: 1.5 },
  close: {
    marginTop: '0.2rem',
    padding: '0.5rem 1.5rem',
    borderRadius: 8,
    border: '1px solid #3a4049',
    background: '#22262c',
    color: '#e7eaee',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
}
