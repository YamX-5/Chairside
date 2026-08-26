import { memo, useEffect, useMemo } from 'react'
import { MeshBasicMaterial, Mesh, type Material } from 'three'
import { Room } from './Room'
import { ClinicKit } from './ClinicKit'
import { useOptionalGLTF } from './useOptionalGLTF'

const BASE = import.meta.env.BASE_URL

/**
 * The room's own lighting, so a lit room is not something a caller can forget.
 *
 * It was exactly that before: every light in the clinic lived in `Room.tsx`,
 * the primitive fallback — the branch that is NOT taken, because `kit/wall.glb`
 * exists and `clinic.glb` does not. So `<ClinicKit />` rendered with zero lights
 * in `ClinicExperience`, and MeshStandardMaterial with no lights and no envmap
 * renders black. `ClinicCase` only looked correct because it happened to
 * declare its own.
 *
 * Warm key from the window wall, cool bounce from the opposite side, and a
 * hemisphere fill so nothing goes fully black. Tuned for the flat-shaded look:
 * one clear light direction, almost no hard shadow.
 *
 * NOT rendered for a baked room — lighting baked geometry a second time
 * double-exposes it and throws away the reason for baking.
 */
export function ClinicLighting() {
  return (
    <>
      <hemisphereLight args={[0xfff6ea, 0xcbb79b, 0.55]} />
      <directionalLight position={[-4, 4.5, -4]} intensity={1.7} color={0xfff0d4} />
      <directionalLight position={[4, 2, 4]} intensity={0.4} color={0xd8e4ff} />
    </>
  )
}

/**
 * The clinic room: a real modelled .glb when one exists, otherwise the original
 * primitive room, unchanged.
 *
 * Drop `public/models/clinic.glb` and the scene upgrades with no code change —
 * that is the whole point of Phase 0 Gate A (prove the look before building a
 * pipeline around it).
 *
 * `baked` matters: if the room ships with lighting baked into its textures,
 * lighting it AGAIN at runtime double-exposes it and throws away the whole
 * reason for baking. In that case every material is swapped for an unlit
 * MeshBasicMaterial, which is also why a baked room costs almost nothing to
 * render on a phone.
 */
export const RoomModel = memo(function RoomModel({
  baked = true,
  preferKit = false,
}: {
  /**
   * Kept in the signature so callers need not change: the side-table drawer is
   * still an interaction, it simply no longer opens anything Room.tsx draws.
   */
  drawerOpen?: boolean
  baked?: boolean
  /**
   * Use the CC0 Kenney kit assembly instead of Room.tsx.
   *
   * Off by default: the kit's furniture placement assumes centre-origin models
   * but the kit ships corner-origin ones, so half of it intersects the walls and
   * floor. Flip this back on once ClinicKit's placement maths is fixed.
   */
  preferKit?: boolean
}) {
  const gltf = useOptionalGLTF(`${BASE}models/clinic.glb`)
  // Probe one kit piece to decide whether the CC0 kit room is available.
  const kitProbe = useOptionalGLTF(`${BASE}models/kit/wall.glb`)

  // Clone so React strict-mode double-mounts can't fight over one scene graph.
  const scene = useMemo(() => gltf?.scene.clone(true) ?? null, [gltf])

  useEffect(() => {
    if (!scene || !baked) return
    scene.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as Material & { map?: unknown; color?: unknown }
      // Keep the baked texture, drop the lighting response.
      mesh.material = new MeshBasicMaterial({
        map: (src as { map?: never }).map ?? null,
        color: (src as { color?: never }).color ?? 0xffffff,
        toneMapped: true,
      })
    })
  }, [scene, baked])

  // Preference order: one baked room > Room.tsx > the CC0 kit assembly.
  //
  // THE KIT USED TO WIN, AND IT PRODUCED A VISIBLE SWAP ON EVERY LOAD.
  //
  // `kitProbe` is an ASYNC load, so it is null on the first render and truthy a
  // moment later. The old order rendered <Room/> while it was null and then
  // replaced it with <ClinicKit/> once wall.glb arrived — so every single page
  // load showed the good room for an instant and then visibly downgraded to the
  // kit. That is the "first glance new, then it turns back to old" report, and
  // it had nothing to do with routing or hot reload.
  //
  // Room.tsx is also simply the better room: image-based lighting from
  // Lightformers, contact shadows, bevelled geometry and the dado rail — none of
  // which the kit has. The kit meanwhile places corner-origin models as if they
  // were centre-origin, which puts the desk 0.56 m through the wall, the sink
  // 0.80 m below the floor and the only ceiling lamp above the ceiling.
  //
  // The kit path is kept, not deleted — `preferKit` brings it back in one prop
  // once its placement maths is fixed.
  if (!scene) {
    if (preferKit && kitProbe) {
      return (
        <>
          <ClinicLighting />
          <ClinicKit />
        </>
      )
    }
    // Room.tsx declares its own lights, so it is left alone.
    return <Room />
  }

  // A baked room is already lit, in its textures. Do not light it again.
  return <primitive object={scene} />
})
