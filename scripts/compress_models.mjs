/**
 * Shrink the models the browser actually downloads.
 *
 *   node scripts/compress_models.mjs
 *
 * WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT
 * -----------------------------------------------
 * Textures are resized to 512 px and geometry is quantised (KHR_mesh_quantization,
 * which three.js reads natively — no extra loader).
 *
 * It does NOT re-encode textures to WebP or JPEG, which would be the far bigger
 * win: this machine's libvips build fails with "colourspace: parameter space not
 * set" on every encode. Left as the obvious next step rather than silently
 * skipped — the models are mostly 1024px PNGs, so a working encoder is worth
 * several megabytes.
 *
 * It also skips patient.glb on purpose. That model is SKINNED with five
 * animation clips, and quantising JOINTS/WEIGHTS is exactly the kind of lossy
 * change that produces a subtly broken rig nobody notices until she walks in
 * folded in half.
 */
import { execFileSync } from 'node:child_process'
import { statSync, renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const MODELS = join(process.cwd(), 'public', 'models')

// Only what the browser fetches. Everything else is dead weight in the repo,
// never downloaded, and not worth degrading.
const TARGETS = [
  'props/eto_sterilizer.glb',
  'props/closet.glb',
  'props/portable_xray.glb',
  'dental_chair.glb',
  'props/sterilization_centre.glb',
  'props/doctors_chair.glb',
  'props/dental_misc.glb',
  'props/masks_disposable.glb',
  'props/book_shelf.glb',
  'props/office_desk.glb',
  'mouth.glb',
  'instruments.glb',
]

const kb = (n) => (n / 1024).toFixed(0).padStart(6)
let before = 0
let after = 0

for (const rel of TARGETS) {
  const src = join(MODELS, rel)
  if (!existsSync(src)) {
    console.log(`  ${rel.padEnd(34)} missing, skipped`)
    continue
  }
  const sizeBefore = statSync(src).size
  // RELATIVE paths, run from the project root. On Windows this goes through a
  // shell, and the project lives under "D:\My Apps" — an unquoted absolute path
  // splits at the space and every single file fails.
  //
  // The output MUST end in .glb. Named it `<file>.glb.opt` once and
  // gltf-transform, seeing an unknown extension, wrote a .gltf JSON document
  // with every texture as a loose .png beside it — so the "compressed" model
  // came out at 29 KB from 4.2 MB and looked like a 99% win. It was the images
  // being written somewhere else. Same shape as the bug that flattened every
  // asset in this project once already.
  const relSrc = `public/models/${rel}`
  const relOut = `public/models/${rel.replace(/\.glb$/, '')}.opt.glb`
  const out = join(MODELS, rel.replace(/\.glb$/, '') + '.opt.glb')

  try {
    execFileSync(
      'npx',
      [
        '--yes',
        '@gltf-transform/cli@latest',
        'optimize',
        relSrc,
        relOut,
        '--compress', 'quantize',
        '--texture-compress', 'false',
        '--texture-size', '512',
      ],
      { stdio: 'pipe', cwd: process.cwd(), shell: process.platform === 'win32' },
    )
  } catch (e) {
    console.log(`  ${rel.padEnd(34)} FAILED: ${String(e.stderr ?? e.message).slice(0, 70)}`)
    before += sizeBefore
    after += sizeBefore
    continue
  }

  const sizeAfter = statSync(out).size
  // Never ship a "compressed" file that is bigger than what it replaced.
  if (sizeAfter >= sizeBefore) {
    console.log(`  ${rel.padEnd(34)} ${kb(sizeBefore)} KB  no gain, kept original`)
    before += sizeBefore
    after += sizeBefore
    continue
  }

  renameSync(out, src)
  before += sizeBefore
  after += sizeAfter
  const pct = ((1 - sizeAfter / sizeBefore) * 100).toFixed(0)
  console.log(`  ${rel.padEnd(34)} ${kb(sizeBefore)} -> ${kb(sizeAfter)} KB   -${pct}%`)
}

console.log(
  `\ntotal ${(before / 1024 / 1024).toFixed(1)} MB -> ${(after / 1024 / 1024).toFixed(1)} MB` +
    `  (-${((1 - after / before) * 100).toFixed(0)}%)`,
)
