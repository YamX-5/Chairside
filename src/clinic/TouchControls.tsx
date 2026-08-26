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
}

export function TouchControls({ promptLabel, onInteract }: Props) {
  const stickBase = useRef<HTMLDivElement>(null)
  const stickKnob = useRef<HTMLDivElement>(null)
  const movePointer = useRef<number | null>(null)
  const lookPointer = useRef<number | null>(null)
  const lookLast = useRef({ x: 0, y: 0 })

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
    }
    function onMove(e: PointerEvent) {
      if (e.pointerId !== lookPointer.current) return
      touchLook.dx += e.clientX - lookLast.current.x
      touchLook.dy += e.clientY - lookLast.current.y
      lookLast.current = { x: e.clientX, y: e.clientY }
    }
    function onUp(e: PointerEvent) {
      if (e.pointerId !== lookPointer.current) return
      lookPointer.current = null
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
      <div ref={stickBase} className="stick-base">
        <div ref={stickKnob} className="stick-knob" />
      </div>
      {promptLabel && (
        <button className="touch-interact" onClick={onInteract}>
          {promptLabel}
        </button>
      )}
    </>
  )
}
