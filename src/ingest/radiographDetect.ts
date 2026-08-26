/**
 * Deciding whether a bitmap is a radiograph — pure, no pdfjs, no canvas, no DOM.
 *
 * Kept free of imports so it runs under `tsx` in a plain Node process. The
 * extraction side (pdfImages.ts) needs a browser; the judgement side is where
 * the bugs live, so the judgement side is testable. Same split as movement.ts.
 */

export interface ImageStats {
  width: number
  height: number
  /** Mean |max(r,g,b) − min(r,g,b)| over sampled pixels, 0–255. */
  meanChroma: number
  /** Std-dev of luminance, 0–255. Flat blocks and gradients score low. */
  lumaStdDev: number
  meanLuma: number
}

/**
 * Does this bitmap look like a radiograph rather than a logo, a clinic photo,
 * or a decorative slide background?
 *
 * The load-bearing test is chroma. A radiograph is greyscale: red, green and
 * blue are equal at every pixel. Clinical photos, university crests and stock
 * imagery are not, and that single number separates them far more reliably than
 * size or aspect ratio ever will.
 */
export function isPlausibleRadiograph(s: ImageStats): { ok: boolean; reason: string } {
  if (s.width < 180 || s.height < 180) {
    return { ok: false, reason: `too small (${s.width}x${s.height}) — icon or bullet glyph` }
  }

  const aspect = s.width / s.height
  if (aspect < 0.4 || aspect > 2.5) {
    return { ok: false, reason: `aspect ${aspect.toFixed(2)} outside intraoral film range` }
  }

  if (s.meanChroma > 12) {
    return { ok: false, reason: `coloured (chroma ${s.meanChroma.toFixed(1)}) — not a radiograph` }
  }

  // A radiograph has structure. A flat grey rectangle or a smooth gradient is a
  // slide background that happens to be grey.
  if (s.lumaStdDev < 18) {
    return { ok: false, reason: `flat (σ ${s.lumaStdDev.toFixed(1)}) — background, not an image` }
  }

  if (s.meanLuma < 18 || s.meanLuma > 205) {
    return { ok: false, reason: `exposure ${s.meanLuma.toFixed(0)} — near-black or blown out` }
  }

  return { ok: true, reason: 'greyscale, structured, plausible intraoral film' }
}

/**
 * Compute stats from raw RGBA bytes, sampling rather than reading every pixel.
 *
 * A 2000x1500 film is 12 MB of RGBA; on the target hardware, walking all of it
 * for every image on every page of a 60-page deck is a visible stall. Every
 * statistic here is a mean or a variance, and both converge fast.
 */
export function statsFromRGBA(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  targetSamples = 4000,
): ImageStats {
  const pixels = width * height
  const step = Math.max(1, Math.floor(pixels / targetSamples))

  let n = 0
  let chromaSum = 0
  let lumaSum = 0
  let lumaSqSum = 0

  for (let p = 0; p < pixels; p += step) {
    const i = p * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    chromaSum += Math.max(r, g, b) - Math.min(r, g, b)
    // Rec. 601 luma — matches how the eye reads a grey image.
    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    lumaSum += luma
    lumaSqSum += luma * luma
    n++
  }

  if (n === 0) return { width, height, meanChroma: 0, lumaStdDev: 0, meanLuma: 0 }

  const meanLuma = lumaSum / n
  const variance = Math.max(0, lumaSqSum / n - meanLuma * meanLuma)

  return {
    width,
    height,
    meanChroma: chromaSum / n,
    lumaStdDev: Math.sqrt(variance),
    meanLuma,
  }
}

/**
 * Heuristic for "the answer is printed on this film".
 *
 * A teaching slide annotates its radiograph — an arrow at the lesion, a caption
 * naming it. Usually those are separate shapes drawn over the picture and don't
 * survive image extraction, but sometimes they are flattened into the bitmap.
 * Baked-in annotations are pure white or strong red over mid-grey, so a high
 * count of saturated pixels in an otherwise greyscale image is the tell.
 *
 * Advisory, not a filter: a false positive discards a good film, and for the
 * shipped demo set a human is checking anyway.
 */
export function looksAnnotated(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  targetSamples = 4000,
): boolean {
  const pixels = width * height
  const step = Math.max(1, Math.floor(pixels / targetSamples))

  let n = 0
  let saturated = 0

  for (let p = 0; p < pixels; p += step) {
    const i = p * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    // Strong colour, or a pixel pinned at pure white — neither occurs naturally
    // in a diagnostic film.
    if (chroma > 60 || (r > 250 && g > 250 && b > 250)) saturated++
    n++
  }

  return n > 0 && saturated / n > 0.02
}
