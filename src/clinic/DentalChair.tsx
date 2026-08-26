import { memo, useEffect, useMemo } from 'react'
import { useOptionalGLTF } from './useOptionalGLTF'
import { applyBakedLighting } from './bakedMaterial'
// Position comes from layout.ts, which owns the floor plan. Keeping it here as
// well is exactly how the collider and the interaction zone drifted away from
// the chair and made the patient unreachable.
import { CHAIR_FACING, CHAIR_POS } from './layout'

/**
 * The dental chair, and the single source of truth for where the patient sits.
 *
 * The room previously used a Kenney lounge recliner as a stand-in, which is
 * exactly as convincing as it sounds. This one is built by
 * scripts/build_dental_chair.py: pedestal, seat, reclined backrest, headrest,
 * armrests, leg rest, overhead operating light, instrument tray and spittoon.
 *
 * CHAIR_POS and SEAT_LOCAL live here rather than in the patient, because the
 * patient's position is a property OF THE CHAIR. Splitting them across two files
 * is what produced a patient sitting on the floor in one build and wedged
 * sideways across the arms in the next.
 */

const BASE = import.meta.env.BASE_URL

export const DentalChair = memo(function DentalChair() {
  const gltf = useOptionalGLTF(`${BASE}models/dental_chair.glb`)
  const scene = useMemo(() => gltf?.scene.clone(true) ?? null, [gltf])

  useEffect(() => {
    if (!scene) return
    // The chair ships pre-lit: key, fill, hemisphere, occlusion and two bounces
    // of GI are baked into COLOR_0, so it renders unlit and cheaper than the
    // Lambert this replaces. The operating light's lens was detected as
    // emissive during the bake and kept at full brightness rather than being
    // darkened by the room's occlusion.
    applyBakedLighting(scene)
  }, [scene])

  if (!scene) return null
  return <primitive object={scene} position={CHAIR_POS} rotation={[0, CHAIR_FACING, 0]} />
})
