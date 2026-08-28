import { FrontSide, MeshBasicMaterial, MeshLambertMaterial, type Object3D, type Side } from 'three'

/**
 * Swap every mesh under `root` to an unlit material that simply shows the
 * lighting already baked into its vertex colours.
 *
 * WHY UNLIT IS THE UPGRADE, NOT A DOWNGRADE
 * -----------------------------------------
 * Every shipped GLB used to carry POSITION, NORMAL and TEXCOORD_0 and nothing
 * else — no COLOR_0, no images, and not one shadow-casting light in the scene.
 * The only shading variation in the entire frame was the N·L term from two
 * directional lights, so nothing ever got darker where it tucked into something
 * else: not under the chin, not where the chair column meets the floor, not in
 * a corner. That absence is why the room read as programmer art.
 *
 * `scripts/bake_vertex_light.py` now bakes the real lighting — the same key,
 * fill and hemisphere colours this scene already uses, plus occlusion and two
 * bounces of GI — straight into COLOR_0. The mesh arrives pre-lit, so the
 * runtime does not need to light it at all.
 *
 * MeshBasicMaterial is CHEAPER per fragment than the MeshLambertMaterial it
 * replaces. The scene gets better looking and faster in the same change.
 *
 * `color` is deliberately left at its white default: three multiplies
 * `material.color × vertexColor`, and the albedo is already folded into the
 * vertex colour. Passing the GLB's original colour would multiply it in twice
 * and every surface would come out roughly its own square — dark, muddy, and
 * very confusing to debug.
 */
export interface BakedOptions {
  /**
   * Set for anything that MOVES — the patient, an instrument in hand.
   *
   * A static prop can have the sun baked into it, because it never turns. A
   * mover cannot: bake directional light into the patient and her lit side
   * stays lit whichever way she faces, so the sun appears to rotate with her
   * body. She walks in through the door, turns, and sits — it would be obvious.
   *
   * Movers are baked AO-only (see `--ao` in scripts/bake_vertex_light.py) and
   * rendered with Lambert, which multiplies the baked occlusion by the live
   * lighting. They keep real directional light, computed per frame at the angle
   * they are actually facing, and still gain the contact shadows under the chin
   * and between the teeth that the flat version never had.
   */
  moves?: boolean
}

export function applyBakedLighting(root: Object3D, opts: BakedOptions = {}): void {
  root.traverse((obj) => {
    const mesh = obj as {
      isMesh?: boolean
      material?: unknown
      geometry?: { attributes?: Record<string, unknown> }
    }
    if (!mesh.isMesh) return

    const mat = mesh.material as
      | {
          color?: { getHex(): number }
          emissive?: { getHex(): number }
          map?: unknown
          // Read so the swap can preserve them — see the fallback below.
          transparent?: boolean
          opacity?: number
          side?: Side
        }
      | undefined

    // A TEXTURED asset keeps its own material, untouched.
    //
    // This clause exists because its absence destroyed the Sketchfab assets. The
    // fallback below builds a fresh Lambert from `color` alone, which silently
    // drops the texture map — so a 16 MB sterilizer with nine maps rendered as a
    // flat grey lump, and it looked like the download had failed.
    //
    // These models arrive already textured and already lit-looking. There is
    // nothing to bake and nothing to improve; the correct action is to leave
    // them alone.
    if (mat?.map) return

    if (mesh.geometry?.attributes?.color) {
      mesh.material = opts.moves
        ? new MeshLambertMaterial({ vertexColors: true })
        : new MeshBasicMaterial({ vertexColors: true })
      return
    }

    // No COLOR_0 — this model has not been through the bake. Fall back to the
    // old lit path rather than rendering it pure white, so regenerating a model
    // and forgetting to bake it degrades to "looks like it used to" instead of
    // "looks broken".
    // TRANSPARENCY MUST SURVIVE THE SWAP. Rebuilding the material kept only
    // colour and emissive, so the glass cabinet's panes — authored alphaMode
    // BLEND with an alpha of 0.03 — came out as opaque pure white panels. A
    // glass cabinet you cannot see into is not a glass cabinet, and with one
    // door's pane also failing to hinge it read as a white slab standing in the
    // opening.
    mesh.material = new MeshLambertMaterial({
      color: mat?.color?.getHex?.() ?? 0xffffff,
      emissive: mat?.emissive?.getHex?.() ?? 0x000000,
      transparent: mat?.transparent ?? false,
      opacity: mat?.opacity ?? 1,
      side: mat?.side ?? FrontSide,
      // Transparent surfaces must not write depth, or they occlude whatever is
      // behind them — which for a cabinet pane is everything on the shelves.
      depthWrite: !mat?.transparent,
    })
  })
}

/** True when every mesh under `root` carries baked vertex colours. */
export function isFullyBaked(root: Object3D): boolean {
  let total = 0
  let baked = 0
  root.traverse((obj) => {
    const mesh = obj as {
      isMesh?: boolean
      geometry?: { attributes?: Record<string, unknown> }
    }
    if (!mesh.isMesh) return
    total += 1
    if (mesh.geometry?.attributes?.color) baked += 1
  })
  return total > 0 && baked === total
}
