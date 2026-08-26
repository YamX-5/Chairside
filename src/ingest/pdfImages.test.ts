import assert from 'node:assert/strict'
import {
  isPlausibleRadiograph,
  looksAnnotated,
  statsFromRGBA,
  type ImageStats,
} from './radiographDetect'

/**
 * Imports radiographDetect, NOT pdfImages: pdfjs touches DOMMatrix at module
 * load, so importing the extractor would drag a browser dependency into a plain
 * Node test run. The judgement logic is deliberately import-free for exactly
 * this reason — same split as movement.ts, and the maths is where the bugs are.
 */

/** Deterministic PRNG: a flaky image test is worse than no image test. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function build(
  width: number,
  height: number,
  pixel: (x: number, y: number, rand: () => number) => [number, number, number],
  seed = 42,
): Uint8ClampedArray {
  const rand = rng(seed)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y, rand)
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return data
}

const SIZE = 300

// A radiograph: grey (r === g === b) with real structure across the frame.
const radiograph = build(SIZE, SIZE, (x, y, rand) => {
  const band = 90 + 70 * Math.sin(x / 18) * Math.cos(y / 25)
  const v = Math.max(0, Math.min(255, band + rand() * 40 - 20))
  return [v, v, v]
})

// A clinical photo or a university logo: colour.
const colourful = build(SIZE, SIZE, (_x, _y, rand) => [
  120 + rand() * 60,
  40 + rand() * 30,
  30 + rand() * 20,
])

// A slide background that happens to be grey.
const flat = build(SIZE, SIZE, () => [128, 128, 128])

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

{
  const s = statsFromRGBA(radiograph, SIZE, SIZE)
  assert.equal(s.width, SIZE)
  assert.ok(s.meanChroma < 1, `greyscale must have ~zero chroma, got ${s.meanChroma}`)
  assert.ok(s.lumaStdDev > 18, `structured image should vary, got σ ${s.lumaStdDev}`)
}

{
  const s = statsFromRGBA(colourful, SIZE, SIZE)
  assert.ok(s.meanChroma > 40, `colour image should have high chroma, got ${s.meanChroma}`)
}

{
  const s = statsFromRGBA(flat, SIZE, SIZE)
  assert.ok(s.lumaStdDev < 1, `flat fill should have ~zero variance, got ${s.lumaStdDev}`)
  assert.ok(Math.abs(s.meanLuma - 128) < 1)
}

{
  // Sampling must not change the answer. If it did, the perf optimisation would
  // silently alter which images get accepted.
  const full = statsFromRGBA(radiograph, SIZE, SIZE, SIZE * SIZE)
  const sampled = statsFromRGBA(radiograph, SIZE, SIZE, 2000)
  assert.ok(
    Math.abs(full.meanLuma - sampled.meanLuma) < 6,
    `sampled mean ${sampled.meanLuma} should track full mean ${full.meanLuma}`,
  )
  assert.ok(
    Math.abs(full.lumaStdDev - sampled.lumaStdDev) < 6,
    `sampled σ ${sampled.lumaStdDev} should track full σ ${full.lumaStdDev}`,
  )
}

// ---------------------------------------------------------------------------
// The judgement
// ---------------------------------------------------------------------------

{
  const v = isPlausibleRadiograph(statsFromRGBA(radiograph, SIZE, SIZE))
  assert.ok(v.ok, `a greyscale structured image should pass: ${v.reason}`)
}

{
  const v = isPlausibleRadiograph(statsFromRGBA(colourful, SIZE, SIZE))
  assert.ok(!v.ok, 'a colour image must be rejected')
  assert.ok(v.reason.includes('coloured'), v.reason)
}

{
  const v = isPlausibleRadiograph(statsFromRGBA(flat, SIZE, SIZE))
  assert.ok(!v.ok, 'a flat grey block must be rejected')
  assert.ok(v.reason.includes('flat'), v.reason)
}

{
  // Slide-master logos and bullet glyphs are the most common thing in a deck.
  const icon = build(48, 48, (_x, _y, rand) => {
    const v = rand() * 255
    return [v, v, v]
  })
  const v = isPlausibleRadiograph(statsFromRGBA(icon, 48, 48))
  assert.ok(!v.ok, 'a 48x48 glyph must be rejected')
  assert.ok(v.reason.includes('too small'), v.reason)
}

{
  // A full-width banner strip across the top of a slide.
  const banner: ImageStats = { width: 1200, height: 200, meanChroma: 2, lumaStdDev: 40, meanLuma: 120 }
  const v = isPlausibleRadiograph(banner)
  assert.ok(!v.ok, 'a 6:1 banner is not an intraoral film')
  assert.ok(v.reason.includes('aspect'), v.reason)
}

{
  const blown: ImageStats = { width: 400, height: 500, meanChroma: 1, lumaStdDev: 25, meanLuma: 245 }
  assert.ok(!isPlausibleRadiograph(blown).ok, 'a near-white image must be rejected')

  const black: ImageStats = { width: 400, height: 500, meanChroma: 1, lumaStdDev: 25, meanLuma: 8 }
  assert.ok(!isPlausibleRadiograph(black).ok, 'a near-black image must be rejected')
}

{
  // Real intraoral films are portrait-ish or landscape-ish, both fine.
  for (const [w, h] of [
    [400, 500],
    [500, 400],
    [600, 400],
  ] as const) {
    const s: ImageStats = { width: w, height: h, meanChroma: 3, lumaStdDev: 42, meanLuma: 110 }
    assert.ok(isPlausibleRadiograph(s).ok, `${w}x${h} should be accepted`)
  }
}

// ---------------------------------------------------------------------------
// The answer printed on the film
// ---------------------------------------------------------------------------

{
  assert.ok(
    !looksAnnotated(radiograph, SIZE, SIZE),
    'a clean film must not be flagged as annotated',
  )
}

{
  // A red arrow burned into the bitmap over ~5% of the frame.
  const arrowed = build(SIZE, SIZE, (x, y, rand) => {
    const inArrow = y > SIZE * 0.45 && y < SIZE * 0.5 && x > SIZE * 0.2 && x < SIZE * 0.9
    if (inArrow) return [230, 20, 20]
    const v = 100 + rand() * 40
    return [v, v, v]
  })
  assert.ok(looksAnnotated(arrowed, SIZE, SIZE), 'a burned-in coloured arrow must be flagged')
}

{
  // White callout text is the other common giveaway.
  const captioned = build(SIZE, SIZE, (x, y, rand) => {
    const inText = y > SIZE * 0.85 && x % 7 < 4
    if (inText) return [255, 255, 255]
    const v = 90 + rand() * 40
    return [v, v, v]
  })
  assert.ok(looksAnnotated(captioned, SIZE, SIZE), 'burned-in white caption text must be flagged')
}

console.log('pdfImages.test.ts — all assertions passed')
