/**
 * What is actually IN each Quaternius clip?
 *
 *     node scripts/probe_cast_clips.mjs
 *
 * The names do not say. "Sitting" runs 8.38 s and "Standing" runs 0.88 s, which
 * could mean a long sitting idle and a short stand-up transition, or a sit-down
 * transition and a standing idle — and wiring the walk-in to the wrong one gives
 * a patient who lowers herself into the chair after she is already in it.
 *
 * A clip is a transition if its first and last frames differ; it is a loop if
 * they match. That is measurable, so measure it rather than guessing from the
 * name. Hips height answers "does she end up lower than she started", which is
 * the specific question the arrival sequence needs.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const FILE = process.argv[2] ?? 'public/models/cast/female_casual.glb'
const raw = readFileSync(join(process.cwd(), FILE))
const gltf = await new GLTFLoader().parseAsync(
  raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  '',
)

const sample = (track, i) => {
  const n = track.getValueSize()
  return Array.from(track.values.slice(i * n, i * n + n))
}
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]))

/**
 * How far the whole skeleton moves between two frames, in radians summed over
 * every rotating bone. Position tracks in this pack are CONSTANT — the sit is
 * achieved purely by rotation, with the pelvis staying put — so rotation is the
 * only place the answer can be.
 */
const poseAt = (clip, time) => {
  const out = {}
  for (const t of clip.tracks) {
    if (!/\.quaternion$/.test(t.name)) continue
    // Evaluate by TIME through the track's own interpolant, not by frame index.
    // Indexing was wrong: `times.length` differs per track (a bone that never
    // moves gets two keys), so index 0 and index n-1 meant different moments for
    // different bones, and the first track found happened to be a constant one —
    // which is why every clip reported "2 frames".
    out[t.name] = Array.from(t.createInterpolant().evaluate(time))
  }
  return out
}
const poseDiff = (a, b) => {
  let sum = 0
  for (const k of Object.keys(a)) {
    if (!b[k]) continue
    // Angle between two unit quaternions: 2*acos(|dot|).
    const d = Math.abs(a[k].reduce((s, v, i) => s + v * b[k][i], 0))
    sum += 2 * Math.acos(Math.min(1, d))
  }
  return sum
}

const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]))

for (const clip of gltf.animations) {
  const keys = Math.max(...clip.tracks.map((t) => t.times.length))
  const gap = poseDiff(poseAt(clip, 0), poseAt(clip, clip.duration))
  console.log(
    `${clip.name.padEnd(9)} ${clip.duration.toFixed(2)}s ${String(keys).padStart(4)} keys  ` +
      `first->last ${gap.toFixed(2)} rad  ${gap < 1.0 ? 'LOOP' : 'TRANSITION'}`,
  )
}

// Which clip does each one START and END in the pose of? That is what says
// whether Standing is a sit->stand transition or a standing idle.
console.log('\nhow each clip lines up with the others (rad, lower = same pose):')
const names = gltf.animations.map((c) => c.name)
process.stdout.write('             ' + names.map((n) => n.padStart(10)).join('') + '\n')
for (const a of names) {
  const row = names.map((b) => {
    const d = poseDiff(poseAt(clips[a], clips[a].duration), poseAt(clips[b], 0))
    return d.toFixed(2).padStart(10)
  })
  process.stdout.write(`${a.padEnd(9)} end ` + row.join('') + '\n')
}

// WHEN does the sit finish? 8.38 s is far too long to be just lowering into a
// chair, so the tail is probably a seated hold. Sampling the distance from the
// clip's own final pose says where the movement stops and the hold begins —
// which is the frame the arrival sequence should clamp at.
console.log('\nSitting: distance from its own end pose, every 0.4 s')
const sit = clips.Sitting
const end = poseAt(sit, sit.duration)
let row = ''
for (let t = 0; t <= sit.duration + 1e-6; t += 0.4) {
  row += `${t.toFixed(1)}s=${poseDiff(poseAt(sit, t), end).toFixed(2)}  `
}
console.log(row)
