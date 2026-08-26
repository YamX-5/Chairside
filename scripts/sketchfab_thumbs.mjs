/**
 * Search Sketchfab and save thumbnails, so candidates can be judged by LOOK
 * before anything is downloaded into Blender.
 *
 *   node scripts/sketchfab_thumbs.mjs "fps hands rigged"
 *
 * The search endpoint is public — no token, and no Blender — which matters
 * because auditioning models one at a time through the addon is slow and, if the
 * addon dies, blocked entirely.
 *
 * Only licences that survive a commercial release are kept. CC-BY and CC0 are
 * fine with attribution; NonCommercial and ShareAlike are not, and filtering
 * them out here stops a good-looking model becoming a licensing problem later.
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const OK_LICENCE = /^(CC Attribution$|CC0|Public Domain|Free Standard)/i

const queries = process.argv.slice(2)
if (!queries.length) {
  console.error('usage: node scripts/sketchfab_thumbs.mjs "<query>" ["<query>" ...]')
  process.exit(1)
}

mkdirSync('blender/thumbs', { recursive: true })
const seen = new Set()

for (const q of queries) {
  const url =
    'https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=24' +
    `&q=${encodeURIComponent(q)}`
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`${q}: HTTP ${res.status}`)
    continue
  }
  const { results = [] } = await res.json()
  console.log(`\n=== ${q} — ${results.length} results ===`)

  for (const m of results) {
    const licence = m.license?.label ?? '?'
    if (!OK_LICENCE.test(licence)) continue
    if (seen.has(m.uid)) continue
    seen.add(m.uid)

    // biggest thumbnail available, so detail is visible
    const img = (m.thumbnails?.images ?? []).sort((a, b) => b.width - a.width)[0]
    const slug = m.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
    const file = `blender/thumbs/${slug}__${m.uid.slice(0, 8)}.jpg`
    if (img) {
      const buf = Buffer.from(await (await fetch(img.url)).arrayBuffer())
      writeFileSync(file, buf)
    }
    console.log(
      `  ${m.name.slice(0, 42).padEnd(42)} ${String(m.faceCount).padStart(7)} faces  ` +
        `${licence.slice(0, 18).padEnd(18)} anim=${m.animationCount ?? 0}`,
    )
    console.log(`      ${m.uid}  ${file}`)
  }
}
console.log(`\n${seen.size} usable-licence candidates saved to blender/thumbs/`)
