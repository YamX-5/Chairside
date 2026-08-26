import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { MutableRefObject } from 'react'

/**
 * Keeps a world point's position on screen, in CSS pixels, in a ref.
 *
 * The study window is DOM and lives outside the `<Canvas>`, but it has to grow
 * out of the monitor — which means knowing where the monitor IS on screen. Only
 * something inside the Canvas can see the camera, so this sits in the scene,
 * renders nothing, and writes the projected point into a ref the DOM reads.
 *
 * A REF, not state: the projection changes every time the player turns their
 * head, and setting React state at 60 Hz to move one panel's origin would
 * re-render the whole clinic. The DOM only ever reads it at the moment the
 * window opens or closes.
 */

const v = new Vector3()

export function ScreenProjector({
  point,
  out,
}: {
  point: readonly [number, number, number]
  out: MutableRefObject<{ x: number; y: number } | null>
}) {
  const { camera, size } = useThree()

  useFrame(() => {
    v.set(point[0], point[1], point[2]).project(camera)
    // Behind the camera projects to a mirrored point in front of it, which would
    // fly the window out of the wrong side of the screen. Report null instead
    // and let the window fall back to growing from the centre.
    if (v.z > 1) {
      out.current = null
      return
    }
    out.current = {
      x: (v.x * 0.5 + 0.5) * size.width,
      y: (-v.y * 0.5 + 0.5) * size.height,
    }
  })

  return null
}
