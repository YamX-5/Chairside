import { useEffect, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { AnimationClip, Group } from 'three'

/**
 * Load a .glb that MIGHT NOT EXIST yet, without crashing or suspending.
 *
 * The whole Phase 0 plan is "drop a real asset in and see if it looks right",
 * so the scene has to render identically whether the file is there or not —
 * primitives today, real geometry the moment a .glb lands. drei's `useGLTF`
 * throws through Suspense on a missing file, which is exactly what we can't
 * have here (same reasoning as useOptionalTexture.ts).
 *
 * The dev server answers a missing path with index.html at HTTP 200, so a bare
 * status check is not enough — we probe the content-type first. This is the
 * same trap that hung the transition-clip <video> earlier in the project.
 */

export interface LoadedGLTF {
  scene: Group
  animations: AnimationClip[]
}

// Module-level cache: a model (or a known-missing null) is fetched once.
const cache = new Map<string, LoadedGLTF | null>()
const inflight = new Map<string, Promise<LoadedGLTF | null>>()

function looksLikeModel(contentType: string | null): boolean {
  if (!contentType) return false
  const t = contentType.toLowerCase()
  // Vite serves .glb as model/gltf-binary; some static hosts use octet-stream.
  return t.includes('model/') || t.includes('octet-stream') || t.includes('gltf')
}

async function load(url: string): Promise<LoadedGLTF | null> {
  try {
    const head = await fetch(url, { method: 'HEAD' })
    if (!head.ok || !looksLikeModel(head.headers.get('content-type'))) return null
  } catch {
    return null
  }

  return new Promise<LoadedGLTF | null>((resolve) => {
    new GLTFLoader().load(
      url,
      (gltf) => resolve({ scene: gltf.scene as Group, animations: gltf.animations }),
      undefined,
      () => resolve(null),
    )
  })
}

export function useOptionalGLTF(url: string | null): LoadedGLTF | null {
  const [model, setModel] = useState<LoadedGLTF | null>(() =>
    url && cache.has(url) ? cache.get(url)! : null,
  )

  useEffect(() => {
    if (!url) {
      setModel(null)
      return
    }
    if (cache.has(url)) {
      setModel(cache.get(url)!)
      return
    }

    let alive = true
    let pending = inflight.get(url)
    if (!pending) {
      pending = load(url).then((result) => {
        cache.set(url, result)
        inflight.delete(url)
        return result
      })
      inflight.set(url, pending)
    }
    pending.then((result) => {
      if (alive) setModel(result)
    })

    return () => {
      alive = false
    }
  }, [url])

  return model
}
