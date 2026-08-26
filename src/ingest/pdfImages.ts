import * as pdfjs from 'pdfjs-dist'
import {
  isPlausibleRadiograph,
  looksAnnotated,
  statsFromRGBA,
  type ImageStats,
} from './radiographDetect'

/**
 * Pull the radiographs out of the student's own lecture.
 *
 * This is the primary image source, and it beats any external bank for the
 * obvious reason: the case is generated from this deck, so an image from this
 * deck already matches it. No licensing burden either — the student uploaded
 * their own teaching material and gets it back. (The external bank still earns
 * its place for the SHIPPED demo cases, which cannot legally carry a professor's
 * copyrighted slides — see docs/RADIOGRAPH_SOURCING.md.)
 *
 * Why embedded image objects rather than rasterising the page: a teaching slide
 * annotates its radiograph — an arrow at the lesion, a caption naming it. Those
 * are usually separate vector shapes and text runs drawn OVER the picture, so
 * lifting the image object typically yields the clean film without the answer
 * written on it. Screenshotting the page would capture the giveaway.
 *
 * Not a guarantee: annotations flattened into the bitmap survive, which is what
 * `annotated` flags.
 */

export type { ImageStats } from './radiographDetect'
export { isPlausibleRadiograph, looksAnnotated, statsFromRGBA } from './radiographDetect'

export interface Candidate extends ImageStats {
  page: number
  /** Object URL for a PNG blob. Revoke when done. */
  url: string
  /** True if the answer may be burned into the picture. Advisory. */
  annotated: boolean
}

/** pdfjs resolves image objects asynchronously via a callback registry. */
function getObj(page: pdfjs.PDFPageProxy, name: string): Promise<unknown> {
  return new Promise((resolve) => {
    try {
      page.objs.get(name, resolve)
    } catch {
      resolve(null)
    }
  })
}

interface PdfImage {
  width: number
  height: number
  kind?: number
  data?: Uint8ClampedArray | Uint8Array
  bitmap?: ImageBitmap
}

/** Normalise pdfjs' several image representations into RGBA bytes on a canvas. */
function toCanvas(img: PdfImage): HTMLCanvasElement | null {
  const { width, height } = img
  if (!width || !height) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  // Newer pdfjs hands back an ImageBitmap when OffscreenCanvas is available.
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0)
    return canvas
  }

  if (!img.data) return null
  const src = img.data
  const out = ctx.createImageData(width, height)
  const dst = out.data
  const px = width * height

  // kind: 1 = GRAYSCALE_1BPP, 2 = RGB_24BPP, 3 = RGBA_32BPP
  if (img.kind === 3 || src.length === px * 4) {
    dst.set(src.subarray(0, px * 4))
  } else if (img.kind === 2 || src.length === px * 3) {
    for (let p = 0; p < px; p++) {
      dst[p * 4] = src[p * 3]
      dst[p * 4 + 1] = src[p * 3 + 1]
      dst[p * 4 + 2] = src[p * 3 + 2]
      dst[p * 4 + 3] = 255
    }
  } else if (src.length === px) {
    for (let p = 0; p < px; p++) {
      const v = src[p]
      dst[p * 4] = v
      dst[p * 4 + 1] = v
      dst[p * 4 + 2] = v
      dst[p * 4 + 3] = 255
    }
  } else {
    return null
  }

  ctx.putImageData(out, 0, 0)
  return canvas
}

function toBlobURL(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/png')
  })
}

/**
 * Every image in the deck that plausibly reads as a radiograph, with its page.
 *
 * The page number matters as much as the image: it lets the generator bind a
 * film to the slide that explains it, so the case, the citation and the picture
 * all come from the same place.
 */
export async function extractRadiographs(
  file: File,
  opts: { maxPerPage?: number } = {},
): Promise<Candidate[]> {
  const maxPerPage = opts.maxPerPage ?? 4
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const found: Candidate[] = []
  const seen = new Set<string>()

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    let onPage = 0

    try {
      const ops = await page.getOperatorList()

      for (let k = 0; k < ops.fnArray.length && onPage < maxPerPage; k++) {
        if (ops.fnArray[k] !== pdfjs.OPS.paintImageXObject) continue

        const name = ops.argsArray[k][0] as string
        // Slide masters repeat the same crest on every page; extract each once.
        if (typeof name !== 'string' || seen.has(name)) continue
        seen.add(name)

        const img = (await getObj(page, name)) as PdfImage | null
        if (!img) continue

        const canvas = toCanvas(img)
        if (!canvas) continue

        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) continue

        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const stats = statsFromRGBA(data, canvas.width, canvas.height)
        if (!isPlausibleRadiograph(stats).ok) continue

        const url = await toBlobURL(canvas)
        if (!url) continue

        found.push({
          ...stats,
          page: i,
          url,
          annotated: looksAnnotated(data, canvas.width, canvas.height),
        })
        onPage++
      }
    } catch {
      // A malformed page must not abandon the rest of the deck.
    }

    page.cleanup()
  }

  await doc.cleanup()
  return found
}
