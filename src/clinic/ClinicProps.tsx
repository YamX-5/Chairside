import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Object3D } from 'three'
import { useOptionalGLTF } from './useOptionalGLTF'
import { applyBakedLighting } from './bakedMaterial'
import { PROPS, stoolPose, type Prop } from './layout'
import { Openables } from './Openables'

/**
 * The downloaded clinic props — sterilizer, x-ray, storage, the operator's stool.
 *
 * Every position comes from `PROPS` in layout.ts, which is also what the
 * lighting bake reads. One table, two consumers: the occlusion baked into a
 * prop was computed at the exact spot it is drawn, so a prop cannot end up lit
 * for somewhere it no longer stands.
 *
 * Each prop loads through `useOptionalGLTF`, so a missing file leaves a hole
 * rather than crashing the scene — these are large downloads and a partial
 * install must still boot.
 */

const BASE = import.meta.env.BASE_URL

function OneProp({
  prop,
  openIds,
  onToggleOpenable,
}: {
  prop: Prop
  openIds: ReadonlySet<string>
  onToggleOpenable: (id: string) => void
}) {
  /** The one prop that moves at runtime. See `stoolPose` in layout.ts. */
  const rolls = prop.id === 'doctors_chair'
  const gltf = useOptionalGLTF(`${BASE}models/props/${prop.id}.glb`)
  const scene = useMemo(() => gltf?.scene.clone(true) ?? null, [gltf])
  const group = useRef<Object3D>(null)

  // The stool follows the player who is sitting on it.
  //
  // Driven from a module-level pose rather than React state on purpose: this
  // changes every frame while someone is rolling, and re-rendering the whole
  // prop tree at 60 Hz is the one thing you must never do in r3f. The hook is
  // unconditional — hooks always are — and does nothing for the other props.
  useFrame(() => {
    if (!rolls || !group.current) return
    group.current.position.set(stoolPose.x, prop.pos[1], stoolPose.z)
  })

  useEffect(() => {
    if (!scene) return
    // Static props carry their full lighting baked in and render unlit; movers
    // carry occlusion only and take their directional light live.
    applyBakedLighting(scene, { moves: prop.moves })
  }, [scene, prop.moves])

  if (!scene) return null
  return (
    <>
      <primitive
        ref={group}
        object={scene as Object3D}
        position={prop.pos}
        rotation={[0, prop.yaw, 0]}
      />
      {/* Parts of a prop that open. `scene` is a per-prop CLONE, which is what
          makes it safe for Openables to re-parent nodes inside it — doing that
          to the cached original would corrupt every consumer. */}
      {(prop.id === 'sterilization_centre' || prop.id === 'closet') && (
        <Openables
          scene={scene}
          prop={prop.id}
          openIds={openIds}
          onToggle={onToggleOpenable}
        />
      )}
    </>
  )
}

export const ClinicProps = memo(function ClinicProps({
  openIds = EMPTY,
  onToggleOpenable = () => {},
}: {
  /** Which individual drawers and doors are currently open. */
  openIds?: ReadonlySet<string>
  onToggleOpenable?: (id: string) => void
}) {
  return (
    <>
      {PROPS.map((p) => (
        <OneProp
          key={p.id}
          prop={p}
          openIds={openIds}
          onToggleOpenable={onToggleOpenable}
        />
      ))}
    </>
  )
})

/** Stable identity, or every render looks like a new set to the children. */
const EMPTY: ReadonlySet<string> = new Set()
