/**
 * Generates the PWA icons with zero image dependencies.
 * Run: node scripts/make-icons.mjs
 *
 * Draws a rounded gradient tile with a white tooth silhouette (two crowns
 * meeting a tapered root pair) — same mark as the in-app brand chip.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { join } from 'node:path'

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size)
      raw[p++] = r
      raw[p++] = g
      raw[p++] = b
      raw[p++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const CYAN = [76, 201, 240]
const VIOLET = [157, 123, 255]
const WHITE = [238, 244, 255]

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

/** Tooth silhouette in normalised 0..1 space. */
function inTooth(nx, ny) {
  const x = (nx - 0.5) * 2 // -1..1
  const y = (ny - 0.5) * 2

  // Crown: two overlapping lobes across the top half.
  const lobe = (cx) => (x - cx) ** 2 / 0.30 ** 2 + (y + 0.28) ** 2 / 0.42 ** 2 <= 1
  if (lobe(-0.22) || lobe(0.22)) return true

  // Roots: two tapering legs below the crown.
  if (y > -0.1 && y < 0.62) {
    const taper = 0.20 * (1 - (y + 0.1) / 0.78)
    if (Math.abs(x + 0.20) < taper || Math.abs(x - 0.20) < taper) return true
  }
  return false
}

function pixel(x, y, size) {
  const nx = (x + 0.5) / size
  const ny = (y + 0.5) / size

  // Rounded-square mask
  const r = 0.22
  const dx = Math.max(Math.abs(nx - 0.5) - (0.5 - r), 0)
  const dy = Math.max(Math.abs(ny - 0.5) - (0.5 - r), 0)
  if (Math.hypot(dx, dy) > r) return [0, 0, 0, 0]

  if (inTooth(nx, ny)) return [...WHITE, 255]
  return [...mix(CYAN, VIOLET, (nx + ny) / 2), 255]
}

const outDir = join(process.cwd(), 'public')
mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), png(size, pixel))
  console.log(`wrote public/icon-${size}.png`)
}
