import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { moveInput, touchLook } from './input'

/**
 * Dev-only testing seam. Automated browser panes report `document.hidden`, so
 * requestAnimationFrame never fires and the render loop never ticks — the scene
 * mounts but nothing moves. This exposes the r3f state so a frame can be
 * stepped by hand and the controller verified.
 *
 * Stripped from production by the `import.meta.env.DEV` guard.
 */
export function DevProbe() {
  const state = useThree()
  /** Scene stats captured BEFORE post-processing clobbers renderer.info. */
  const real = useRef({ calls: 0, tris: 0, lines: 0, points: 0 })

  /**
   * Take the scene's real counts, not the composer's last blit.
   *
   * WebGLRenderer.render() begins with `if (this.info.autoReset) this.info.reset()`.
   * EffectComposer calls render() roughly 29 times a frame, so reading
   * `info.render.calls` after the composer reports whatever the LAST fullscreen
   * quad did — typically 1. Every draw-call number this probe reported before
   * today was measuring a post-processing blit, not the scene.
   *
   * Turning autoReset off and resetting manually at the top of the frame means
   * the counters accumulate across the whole frame; sampling at priority -1
   * (before r3f's render) captures the scene pass on its own.
   */
  useFrame(() => {
    const info = state.gl.info
    real.current = {
      calls: info.render.calls,
      tris: info.render.triangles,
      lines: info.render.lines,
      points: info.render.points,
    }
    info.reset()
  }, -1)

  useEffect(() => {
    // Must be off, or every internal render() call wipes the counters.
    state.gl.info.autoReset = false
    return () => {
      state.gl.info.autoReset = true
    }
  }, [state.gl])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    w.__clinic = {
      /** Run one frame: useFrame subscribers, then render. */
      step(dt = 1 / 60) {
        state.advance(performance.now() + dt * 1000)
      },
      /** Drive the controller as if keys or a thumbstick were held. */
      setMove(x: number, z: number) {
        moveInput.x = x
        moveInput.z = z
      },
      look(dx: number, dy: number) {
        touchLook.dx += dx
        touchLook.dy += dy
      },
      pos() {
        const p = state.camera.position
        return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) }
      },
      setPos(x: number, z: number) {
        state.camera.position.x = x
        state.camera.position.z = z
      },
      size() {
        return { w: state.size.width, h: state.size.height }
      },
      sceneObjects() {
        let n = 0
        state.scene.traverse(() => n++)
        return n
      },
      /**
       * The SCENE's draw calls, sampled before post-processing resets them.
       *
       * Reading state.gl.info.render.calls directly returns ~1 whenever an
       * EffectComposer is in play — see the useFrame above.
       */
      drawCalls() {
        return real.current.calls
      },
      triangles() {
        return real.current.tris
      },
      /** Everything the frame actually submitted, for a proper look. */
      stats() {
        return { ...real.current }
      },
      /**
       * World position of a named object.
       *
       * Added because "the model is in the scene" and "the model is where it
       * should be" are different claims, and only the first one is visible in a
       * draw-call count. The patient rendered on the floor next to the chair for
       * a whole build because nothing checked the second.
       */
      worldPos(name: string) {
        const obj = state.scene.getObjectByName(name)
        if (!obj) return null
        const v = obj.getWorldPosition(new Vector3())
        return { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) }
      },
      /** Names of everything in the scene, for finding what a model exported as. */
      names() {
        const out: string[] = []
        state.scene.traverse((o) => {
          if (o.name) out.push(o.name)
        })
        return out
      },
    }
    return () => {
      delete w.__clinic
    }
  }, [state])

  return null
}
