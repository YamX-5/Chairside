import { useEffect, useRef } from 'react'
import { isRtlLayout, moveInput, touchLook } from './input'

/**
 * Phone controls: left thumb moves, right thumb looks. Written against pointer
 * events with explicit pointerId tracking so both thumbs work at once — the
 * single-touch shortcut breaks the moment you walk and look together, which is
 * most of the time in first person.
 */

const STICK_RADIUS = 52

interface Props {
  /** Shown as a tappable button when the player is next to something. */
  promptLabel: string | null
  onInteract: () => void
  /**
   * Open and close the chart. WITHOUT THIS THE GAME IS UNWINNABLE ON A PHONE.
   *
   * The chart was bound to the H key and nothing else. isTouchDevice() hides
   * every keyboard hint in the HUD, and this component's one button only ever
   * carried the proximity prompt — which never says "open the chart", because
   * the chart is not a place in the room, it is in your hands. So on a phone
   * `reading` could never become true, CasePapers never mounted, commitPlan was
   * never called, `planned` stayed false forever, and every instrument in the
   * game stayed locked with no way to unlock it.
   *
   * Null when the chart cannot be opened yet (the morning, or mid-treatment), so
   * the button is absent rather than present and inert.
   */
  onChart: (() => void) | null
  /** So the button can say close rather than guess. */
  chartOpen: boolean
  /** Bilingual label for the chart button, chosen by the caller. */
  chartLabel: string
  /**
   * Hide the movement stick.
   *
   * Set while an overlay owns the screen: you cannot walk with the chart up, so
   * a live-looking stick is a lie, and it sits under the same thumb that has to
   * reach the close button.
   */
  hideStick?: boolean
}

/**
 * How far a thumb may travel and still count as a tap, in CSS pixels.
 *
 * Roughly what a browser itself allows before it withholds the `click`, so the
 * camera stays still for exactly the gestures that will produce one. Smaller and
 * a steady tap still nudges the view; larger and the look feels like it sticks
 * before it starts.
 */
const TAP_SLOP = 9

export function TouchControls({
  promptLabel,
  onInteract,
  onChart,
  chartOpen,
  chartLabel,
  hideStick = false,
}: Props) {
  const stickBase = useRef<HTMLDivElement>(null)
  const stickKnob = useRef<HTMLDivElement>(null)
  const movePointer = useRef<number | null>(null)
  const lookPointer = useRef<number | null>(null)
  const lookLast = useRef({ x: 0, y: 0 })
  /** Where the thumb went down, so a tap can be told from a drag. */
  const lookStart = useRef({ x: 0, y: 0 })
  /** True once the thumb has travelled past TAP_SLOP and is really looking. */
  const dragging = useRef(false)

  useEffect(() => {
    const base = stickBase.current
    const knob = stickKnob.current
    if (!base || !knob) return

    const origin = { x: 0, y: 0 }

    function setKnob(dx: number, dy: number) {
      if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`
    }

    function onStickDown(e: PointerEvent) {
      if (movePointer.current !== null) return
      movePointer.current = e.pointerId
      const rect = base!.getBoundingClientRect()
      origin.x = rect.left + rect.width / 2
      origin.y = rect.top + rect.height / 2
      base!.setPointerCapture(e.pointerId)
      // The look pad listens on window; without this the same thumb both walks
      // and spins the camera.
      e.stopPropagation()
      e.preventDefault()
    }

    function onStickMove(e: PointerEvent) {
      if (e.pointerId !== movePointer.current) return
      let dx = e.clientX - origin.x
      let dy = e.clientY - origin.y
      const dist = Math.hypot(dx, dy)
      if (dist > STICK_RADIUS) {
        dx = (dx / dist) * STICK_RADIUS
        dy = (dy / dist) * STICK_RADIUS
      }
      setKnob(dx, dy)
      const nx = dx / STICK_RADIUS
      const ny = dy / STICK_RADIUS
      // Small deadzone so a resting thumb doesn't drift the player.
      moveInput.x = Math.abs(nx) < 0.15 ? 0 : nx
      moveInput.z = Math.abs(ny) < 0.15 ? 0 : -ny
      e.preventDefault()
    }

    function onStickUp(e: PointerEvent) {
      if (e.pointerId !== movePointer.current) return
      movePointer.current = null
      moveInput.x = 0
      moveInput.z = 0
      setKnob(0, 0)
    }

    base.addEventListener('pointerdown', onStickDown)
    base.addEventListener('pointermove', onStickMove)
    base.addEventListener('pointerup', onStickUp)
    base.addEventListener('pointercancel', onStickUp)
    return () => {
      base.removeEventListener('pointerdown', onStickDown)
      base.removeEventListener('pointermove', onStickMove)
      base.removeEventListener('pointerup', onStickUp)
      base.removeEventListener('pointercancel', onStickUp)
      moveInput.x = 0
      moveInput.z = 0
      // Leaving a stale delta here snaps the camera on the way back in.
      touchLook.dx = 0
      touchLook.dy = 0
    }
  }, [])

  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (lookPointer.current !== null) return
      // The thumb already driving the stick must never also steer the camera.
      if (e.pointerId === movePointer.current) return
      // The stick sits on the inline-start edge, which flips in Arabic — so the
      // look pad is whichever half the stick is NOT on.
      const onStickHalf = isRtlLayout()
        ? e.clientX > window.innerWidth / 2
        : e.clientX < window.innerWidth / 2
      if (onStickHalf) return
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('.stick-base')) return
      lookPointer.current = e.pointerId
      lookLast.current = { x: e.clientX, y: e.clientY }
      lookStart.current = { x: e.clientX, y: e.clientY }
      dragging.current = false
    }
    function onMove(e: PointerEvent) {
      if (e.pointerId !== lookPointer.current) return

      // A TAP MUST NOT TURN THE CAMERA. Until the thumb has travelled past the
      // slop, nothing is fed to the look at all.
      //
      // Without this, tapping a drawer just turned your head and never opened
      // it. r3f decides a click by re-raycasting from the CURRENT camera and
      // only firing if the object was also under the pointer at pointerdown — so
      // any camera movement in between makes the second ray miss. The gain makes
      // it worse than it sounds: at the shipped field of view a pixel of thumb
      // drift slides the target about two pixels across the screen, so a normal
      // thumb wobble is enough. Past the browser's own tap slop no click is
      // dispatched at all.
      if (!dragging.current) {
        const travel = Math.hypot(
          e.clientX - lookStart.current.x,
          e.clientY - lookStart.current.y,
        )
        if (travel < TAP_SLOP) return
        dragging.current = true
        // Resume from HERE, not from the touch-down point, or the camera jumps
        // by the whole slop distance the instant the drag is recognised.
        lookLast.current = { x: e.clientX, y: e.clientY }
        return
      }

      touchLook.dx += e.clientX - lookLast.current.x
      touchLook.dy += e.clientY - lookLast.current.y
      lookLast.current = { x: e.clientX, y: e.clientY }
    }
    function onUp(e: PointerEvent) {
      if (e.pointerId !== lookPointer.current) return
      lookPointer.current = null
      dragging.current = false
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <>
      <div
        ref={stickBase}
        className="stick-base"
        style={hideStick ? { display: 'none' } : undefined}
      >
        <div ref={stickKnob} className="stick-knob" />
      </div>
      {promptLabel && (
        <button className="touch-interact" onClick={onInteract}>
          {promptLabel}
        </button>
      )}
      {/* Sits ABOVE the interact button rather than beside it: the interact
          label can run to 42vw, and two variable-width pills on one row is how
          you get a chart button that jumps under the thumb. */}
      {onChart && (
        <button
          className="touch-interact touch-chart"
          onClick={onChart}
          aria-pressed={chartOpen}
        >
          {chartLabel}
        </button>
      )}
    </>
  )
}
