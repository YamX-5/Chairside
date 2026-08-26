import { useEffect, useState } from 'react'
import { TextureLoader, SRGBColorSpace, RepeatWrapping, type Texture } from 'three'

/**
 * Load a texture that MIGHT NOT EXIST yet, without crashing.
 *
 * The art for this game is generated on the Higgsfield website and dropped into
 * `public/textures` / `public/sprites` over time. Until a file is there, this
 * hook returns null and the caller keeps its flat-colour / primitive fallback —
 * so the scene always renders, textured or not, and auto-upgrades the moment a
 * file appears. (drei's `useTexture` throws on a missing file via Suspense,
 * which is exactly what we can't have here.)
 */

// Module-level cache: a texture (or a known-missing null) is loaded once.
const cache = new Map<string, Texture | null>()

interface Opts {
  /** Colour/albedo maps are sRGB; data maps (normal/rough) would be linear. */
  srgb?: boolean
  /** Tiling repeat for a surface texture. Omit for a one-shot sprite. */
  repeat?: [number, number]
  anisotropy?: number
}

export function useOptionalTexture(url: string | null, opts: Opts = {}): Texture | null {
  const [tex, setTex] = useState<Texture | null>(() =>
    url && cache.has(url) ? cache.get(url)! : null,
  )

  useEffect(() => {
    if (!url) {
      setTex(null)
      return
    }
    if (cache.has(url)) {
      setTex(cache.get(url)!)
      return
    }
    let alive = true
    new TextureLoader().load(
      url,
      (t) => {
        if (opts.srgb) t.colorSpace = SRGBColorSpace
        if (opts.repeat) {
          t.wrapS = t.wrapT = RepeatWrapping
          t.repeat.set(opts.repeat[0], opts.repeat[1])
        }
        t.anisotropy = opts.anisotropy ?? 4
        cache.set(url, t)
        if (alive) setTex(t)
      },
      undefined,
      () => {
        // Missing / failed → remember null so we don't retry every mount.
        cache.set(url, null)
        if (alive) setTex(null)
      },
    )
    return () => {
      alive = false
    }
    // opts is spread into primitives below; url is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return tex
}
