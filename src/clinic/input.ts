/**
 * Input state shared between the DOM controls and the render loop.
 *
 * These are module-level mutable objects on purpose: the render loop reads them
 * every frame, and routing them through React state would re-render the whole
 * tree 60 times a second (the one thing you must never do in r3f).
 */

export const moveInput = { x: 0, z: 0 } // x: strafe right+, z: forward+

/** Look deltas accumulated by the touch look-pad, consumed each frame. */
export const touchLook = { dx: 0, dy: 0 }

const held = new Set<string>()

const FORWARD = new Set(['KeyW', 'ArrowUp'])
const BACK = new Set(['KeyS', 'ArrowDown'])
const LEFT = new Set(['KeyA', 'ArrowLeft'])
const RIGHT = new Set(['KeyD', 'ArrowRight'])

function recompute() {
  let x = 0
  let z = 0
  for (const code of held) {
    if (FORWARD.has(code)) z += 1
    if (BACK.has(code)) z -= 1
    if (LEFT.has(code)) x -= 1
    if (RIGHT.has(code)) x += 1
  }
  moveInput.x = Math.max(-1, Math.min(1, x))
  moveInput.z = Math.max(-1, Math.min(1, z))
}

export interface KeyboardHandlers {
  /** E — use the thing you are standing at: pick up, open, operate. */
  onInteract: () => void
  /** H — the chart in your hands. Its own key so it works anywhere in the room. */
  onChart?: () => void
}

/**
 * Bindings use `event.code` (physical keys), never `event.key` — letter
 * bindings break on non-Latin keyboard layouts, and Arabic is a first-class
 * locale here.
 *
 * E and H are deliberately separate. Overloading one key with "pick up the
 * thing in front of you" AND "open the chart" meant the chart was unreachable
 * whenever you happened to be standing near anything else.
 */
export function attachKeyboard(handlers: KeyboardHandlers): () => void {
  function down(e: KeyboardEvent) {
    if (e.repeat) return
    if (e.code === 'KeyE' || e.code === 'Space') {
      handlers.onInteract()
      e.preventDefault()
      return
    }
    if (e.code === 'KeyH') {
      handlers.onChart?.()
      e.preventDefault()
      return
    }
    // Escape is deliberately NOT handled here — it is a de-escalation ladder
    // owned by the clinic, not a quit key.
    held.add(e.code)
    recompute()
  }
  function up(e: KeyboardEvent) {
    held.delete(e.code)
    recompute()
  }
  function blur() {
    held.clear()
    recompute()
  }

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    blur()
  }
}

export function resetInput(): void {
  held.clear()
  moveInput.x = 0
  moveInput.z = 0
  touchLook.dx = 0
  touchLook.dy = 0
}

/**
 * Touch devices get the joystick + look pad; desktop gets pointer lock.
 *
 * `'ontouchstart' in window` is true on any Windows laptop with a touchscreen,
 * which would rob those users of mouse-look. Only treat it as a touch device
 * when there is a coarse pointer and no fine one.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const fine = window.matchMedia('(pointer: fine)').matches
  return coarse && !fine
}

/** True when the document is in RTL, which mirrors the on-screen controls. */
export function isRtlLayout(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
}
