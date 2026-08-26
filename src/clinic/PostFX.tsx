import {
  EffectComposer,
  Bloom,
  HueSaturation,
  BrightnessContrast,
  Vignette,
  SMAA,
  ToneMapping,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * The grade pass. Order matters — effects composite top-to-bottom, and the tone
 * map MUST be last and MUST be the only one: the <Canvas> renderer is set to
 * NoToneMapping precisely so ACES is applied here once, not twice.
 *
 * WHAT WAS REMOVED, AND WHY — this stack was the reason the game felt slow, and
 * it was never the triangles or the draw calls (157 draw calls / 4,366 tris is
 * two orders of magnitude inside budget for any GPU made this decade).
 *
 *   N8AO           needed `enableNormalPass`, which is a FULL SECOND RENDER of
 *                  the whole scene with a normal-material override — every mesh
 *                  submitted twice, plus a full-res normal buffer. On desktop
 *                  that made submission 314 draw calls, not 157. The old comment
 *                  in this file correctly called it "the single most expensive
 *                  thing in the stack" and then enabled it on exactly the
 *                  hardware that cannot afford it.
 *   DepthOfField   ~4 more fullscreen passes sampling the depth buffer, for a
 *                  lens effect on a flat-shaded low-poly scene that is not
 *                  trying to look like a photograph.
 *
 * And `mipmapBlur` with no `levels` defaults to 8, which runs a downsample AND
 * an upsample loop — 16 passes for bloom alone. Pinned to 4.
 *
 * Every pass is RGBA16F (8 bytes/px) because @react-three/postprocessing
 * defaults `frameBufferType` to HalfFloatType. At ~29 passes that was ~163 MB of
 * resident render targets and ~21 GB/s of bandwidth at 60fps — against an Iris
 * Xe that realistically reaches 25-35 GB/s in total, shared with the CPU. The
 * post stack wanted most of the memory bandwidth before a triangle was drawn.
 */
export function PostFX({ isTouch }: { isTouch: boolean }) {
  return (
    <EffectComposer
      // SMAA does the anti-aliasing, so MSAA is off (it would just double the
      // cost). No normal pass: nothing left in the stack needs one, and it cost
      // a second full scene render.
      multisampling={0}
      enableNormalPass={false}
    >
      {/* Only the emissive lamp/window (HDR, luminance > 1) blooms — a soft
          glow around the light sources, nothing else.
          `levels={4}`: the default of 8 is 16 passes for bloom alone. */}
      <Bloom mipmapBlur levels={4} luminanceThreshold={1} intensity={0.5} radius={0.7} />
      {/* Warm, gently saturated mids + a soft contrast curve — the "storybook"
          grade that stops the frame reading as flat. These are all `Effect`-type
          and merge into ONE fragment shader, so the whole grade costs about one
          pass. */}
      <HueSaturation saturation={0.1} />
      <BrightnessContrast brightness={0.0} contrast={0.07} />
      <Vignette offset={0.32} darkness={0.42} />
      {/* EffectComposer types its children as Element, so a `&&` that can yield
          `false` does not typecheck — hence the empty fragment. */}
      {!isTouch ? <SMAA /> : <></>}
      {/* ACES, exactly once, LAST. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
