import assert from 'node:assert/strict'
import { DURATION, poseAt, shakeAt } from './reaction'
import type { ConsequencePrimitive } from '../ingest/channels'

/**
 * The curves ARE the reaction. A patient that reads as "broken" instead of
 * "funny" is nearly always a timing bug, and timing bugs are invisible in a
 * screenshot — so they get asserted here rather than eyeballed.
 */

const ALL: ConsequencePrimitive[] = [
  'patient_calm', 'patient_flinch', 'patient_wince_vocal', 'patient_scream',
  'patient_bleed', 'patient_thrash', 'patient_bolts', 'waiting_room_unrest',
  'waiting_room_panic', 'tray_erupts', 'assistant_recoil', 'procedure_success',
  'generic_flinch',
]

/** Sample a reaction across its life. */
function sample(p: ConsequencePrimitive, steps = 60) {
  const d = DURATION[p]
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / (steps - 1)) * d
    return { t, pose: poseAt(p, t) }
  })
}

// ---------------------------------------------------------------------------
// Universal invariants — every reaction, no exceptions
// ---------------------------------------------------------------------------

for (const p of ALL) {
  assert.ok(DURATION[p] > 0, `${p} needs a duration`)

  // Before it fires and after it ends, the patient is at rest. Otherwise a
  // reaction leaves the patient permanently crooked in the chair.
  assert.equal(poseAt(p, -0.5).done, true, `${p} must rest before firing`)
  assert.equal(poseAt(p, DURATION[p] + 0.1).done, true, `${p} must finish`)
  assert.equal(poseAt(p, DURATION[p] + 0.1).offsetY, 0, `${p} must return to rest position`)
  assert.equal(poseAt(p, DURATION[p] + 0.1).trauma, 0, `${p} must stop shaking the camera`)

  for (const { t, pose } of sample(p)) {
    const at = `${p} @ ${t.toFixed(2)}s`
    assert.ok(Number.isFinite(pose.offsetY), `${at} offsetY not finite`)
    assert.ok(Number.isFinite(pose.pitch), `${at} pitch not finite`)
    assert.ok(pose.trauma >= 0 && pose.trauma <= 1, `${at} trauma ${pose.trauma} out of range`)
    assert.ok(pose.blood >= 0 && pose.blood <= 1, `${at} blood ${pose.blood} out of range`)
    assert.ok(pose.flash >= 0 && pose.flash <= 1, `${at} flash ${pose.flash} out of range`)
    // A patient who moves more than a metre has left the room, not reacted.
    assert.ok(Math.abs(pose.offsetY) < 1, `${at} offsetY ${pose.offsetY} implausible`)
  }
}

// ---------------------------------------------------------------------------
// Anticipation — the thing that separates "impact" from "glitch"
// ---------------------------------------------------------------------------

for (const p of ['patient_flinch', 'patient_scream', 'patient_thrash'] as const) {
  const wind = poseAt(p, 0.1) // mid-anticipation
  const impact = poseAt(p, 0.21) // just past impact

  assert.ok(wind.pitch < 0, `${p} must wind up the OPPOSITE way, got pitch ${wind.pitch}`)
  assert.ok(impact.pitch > 0, `${p} must swing through at impact, got ${impact.pitch}`)
  assert.ok(
    Math.abs(impact.pitch) > Math.abs(wind.pitch),
    `${p} impact must exceed the wind-up`,
  )
}

// ---------------------------------------------------------------------------
// Severity has to be legible: a flinch must not feel like a scream
// ---------------------------------------------------------------------------

{
  const peak = (p: ConsequencePrimitive) =>
    Math.max(...sample(p, 120).map((s) => s.pose.trauma))

  assert.ok(
    peak('patient_flinch') < peak('patient_wince_vocal'),
    'a flinch must be milder than a vocal wince',
  )
  assert.ok(
    peak('patient_wince_vocal') < peak('patient_scream'),
    'a wince must be milder than a scream',
  )
  assert.ok(peak('patient_calm') === 0, 'a calm patient must not shake the camera')
  assert.ok(peak('procedure_success') === 0, 'success must never shake the camera')
}

// ---------------------------------------------------------------------------
// Success is the LONGEST beat. This is the anti-optimisation rule.
// ---------------------------------------------------------------------------

{
  const failures: ConsequencePrimitive[] = [
    'patient_flinch', 'patient_wince_vocal', 'patient_scream', 'patient_thrash', 'patient_bolts',
  ]
  for (const f of failures) {
    assert.ok(
      DURATION.procedure_success > DURATION[f],
      `success (${DURATION.procedure_success}s) must outlast ${f} (${DURATION[f]}s) — ` +
        'if failing is more fun than succeeding, players farm failure and stop learning',
    )
  }

  // And it must actually DO something, or it is just a longer nothing.
  const nod = Math.max(...sample('procedure_success', 200).map((s) => Math.abs(s.pose.pitch)))
  assert.ok(nod > 0.05, `success needs a visible beat, peak pitch was ${nod}`)
}

// ---------------------------------------------------------------------------
// The jaw. A scream with a closed mouth is the "broken, not funny" failure.
// ---------------------------------------------------------------------------

{
  const peakJaw = (p: ConsequencePrimitive) =>
    Math.max(...sample(p, 160).map((s) => s.pose.jawOpen))

  assert.ok(peakJaw('patient_scream') > 0.8, `a scream must open the mouth wide, got ${peakJaw('patient_scream')}`)
  assert.ok(
    peakJaw('patient_flinch') < peakJaw('patient_wince_vocal'),
    'a silent flinch must open the jaw less than a vocal wince',
  )
  assert.ok(
    peakJaw('patient_wince_vocal') < peakJaw('patient_scream'),
    'a wince must open the jaw less than a scream',
  )

  // A scream SUSTAINS. If the jaw only blips open for a frame it reads as a
  // twitch — the mouth has to stay open through most of the reaction.
  const held = sample('patient_scream', 160).filter((s) => s.pose.jawOpen > 0.5).length
  assert.ok(held > 30, `a scream should hold the mouth open, only ${held}/160 samples were`)

  // Calm outcomes never open the jaw.
  for (const p of ['patient_calm', 'procedure_success'] as const) {
    assert.equal(peakJaw(p), 0, `${p} must not open the jaw`)
  }
}

{
  // Bracing — shoulders up, arms gripping — must scale with severity too.
  const peakBrace = (p: ConsequencePrimitive) =>
    Math.max(...sample(p, 160).map((s) => s.pose.brace))
  assert.ok(peakBrace('patient_flinch') < peakBrace('patient_scream'))
  assert.equal(peakBrace('procedure_success'), 0, 'a good outcome must not brace')

  for (const p of ALL) {
    for (const { pose } of sample(p)) {
      assert.ok(pose.jawOpen >= 0 && pose.jawOpen <= 1, `${p} jawOpen out of range`)
      assert.ok(pose.brace >= 0 && pose.brace <= 1, `${p} brace out of range`)
    }
  }
}

// ---------------------------------------------------------------------------
// Bleeding: the screen, not the patient
// ---------------------------------------------------------------------------

{
  const s = sample('patient_bleed', 200)
  const peakBlood = Math.max(...s.map((x) => x.pose.blood))
  assert.ok(peakBlood > 0.9, `bleed must actually fill the screen, peaked at ${peakBlood}`)

  // It has to clear, or the student plays the rest of the round through red.
  assert.ok(s[s.length - 1].pose.blood < 0.05, 'blood must clear before the reaction ends')

  // And no other reaction should bleed.
  for (const p of ALL) {
    if (p === 'patient_bleed') continue
    assert.equal(
      Math.max(...sample(p).map((x) => x.pose.blood)),
      0,
      `${p} must not draw blood`,
    )
  }
}

// ---------------------------------------------------------------------------
// Bolting leaves the chair, and goes forward not backward
// ---------------------------------------------------------------------------

{
  const s = sample('patient_bolts', 120)
  const peakY = Math.max(...s.map((x) => x.pose.offsetY))
  const peakZ = Math.max(...s.map((x) => x.pose.offsetZ))
  assert.ok(peakY > 0.4, `bolting must actually stand up, peaked at ${peakY}`)
  assert.ok(peakZ > 1, `bolting must move away from the chair, peaked at ${peakZ}`)

  // Rising must be monotonic while it happens — a patient who bobs on the way
  // up reads as a physics bug, not panic.
  const rising = s.filter((x) => x.t > 0.2 && x.t < 0.7).map((x) => x.pose.offsetY)
  for (let i = 1; i < rising.length; i++) {
    assert.ok(rising[i] >= rising[i - 1] - 1e-6, 'the rise out of the chair must not stutter')
  }
}

// ---------------------------------------------------------------------------
// Shake: squared, rotation-only, deterministic
// ---------------------------------------------------------------------------

{
  // Squaring is what makes a small hit feel small. Halving trauma must cut the
  // shake by much more than half.
  const big = shakeAt(1, 0.5)
  const half = shakeAt(0.5, 0.5)
  const ratio = Math.abs(half.roll) / Math.abs(big.roll)
  assert.ok(ratio < 0.3, `halved trauma should quarter the shake, ratio was ${ratio.toFixed(3)}`)

  // Math.abs because the noise term can yield -0, which strict equality treats
  // as distinct from 0 while every renderer treats it as identical.
  assert.equal(Math.abs(shakeAt(0, 1).pitch), 0, 'no trauma, no shake')
  assert.equal(Math.abs(shakeAt(0, 1).roll), 0, 'no trauma, no roll')

  // Deterministic: the same inputs must give the same frame, or shake becomes
  // per-frame jitter that reads as a broken renderer.
  assert.deepEqual(shakeAt(0.8, 1.23, 5), shakeAt(0.8, 1.23, 5))

  // Different seeds must differ, so a repeated mistake doesn't replay identically.
  assert.notDeepEqual(shakeAt(0.8, 1.23, 5), shakeAt(0.8, 1.23, 6))

  // Bounded — an unbounded shake ejects the camera through the wall.
  for (let t = 0; t < 3; t += 0.01) {
    const s = shakeAt(1, t)
    assert.ok(Math.abs(s.pitch) < 0.05 && Math.abs(s.roll) < 0.05, 'shake must stay small')
  }
}

console.log('reaction.test.ts — all assertions passed')
