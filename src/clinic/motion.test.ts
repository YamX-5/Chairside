import assert from 'node:assert/strict'
import { DURATIONS, advance, bounceSettle, clamp01, leap, slip } from './motion'

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

// ---------------------------------------------------------------------------
// Both curves start and end exactly where they claim
// ---------------------------------------------------------------------------
//
// If an easing does not land on 1, a drawer stops just short of open forever and
// the gap is small enough that nobody diagnoses it — they just say it "feels
// wrong".

for (const [name, fn] of [['leap', leap], ['slip', slip], ['bounceSettle', bounceSettle]] as const) {
  assert.ok(near(fn(0), 0), `${name}(0) must be exactly 0, got ${fn(0)}`)
  assert.ok(near(fn(1), 1), `${name}(1) must be exactly 1, got ${fn(1)}`)
  // Out of range must not explode — dt spikes happen on a phone that just woke.
  assert.ok(near(fn(-3), 0), `${name} must clamp below 0`)
  assert.ok(near(fn(9), 1), `${name} must clamp above 1`)
}

// ---------------------------------------------------------------------------
// leap actually leaps, slip actually does not
// ---------------------------------------------------------------------------
//
// The whole point of having two curves is that they behave differently. If leap
// stopped overshooting it would silently become an expensive slip.

{
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i <= 200; i++) {
    const v = leap(i / 200)
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  assert.ok(min < -0.01, `leap should dip below 0 (anticipation), lowest was ${min.toFixed(4)}`)
  assert.ok(max > 1.01, `leap should overshoot past 1, highest was ${max.toFixed(4)}`)
  // But not absurdly — past about 25% it reads as broken rather than lively.
  assert.ok(max < 1.25, `leap overshoots ${max.toFixed(3)}, which reads as a glitch`)
  assert.ok(min > -0.25, `leap dips to ${min.toFixed(3)}, which reads as a glitch`)
}

{
  for (let i = 0; i <= 200; i++) {
    const v = slip(i / 200)
    assert.ok(
      v >= -1e-9 && v <= 1 + 1e-9,
      `slip must never leave 0..1 — it is the curve for arriving somewhere you ` +
        `must not bounce out of. Got ${v} at t=${i / 200}`,
    )
  }
  // And it must front-load its travel, or it is just a lerp.
  assert.ok(slip(0.25) > 0.6, `slip should be well past halfway at a quarter, got ${slip(0.25)}`)
}

// slip is monotonic: a chair you are settling into never goes back up.
{
  let prev = -Infinity
  for (let i = 0; i <= 200; i++) {
    const v = slip(i / 200)
    assert.ok(v >= prev - 1e-9, `slip went backwards at t=${i / 200}`)
    prev = v
  }
}

// ---------------------------------------------------------------------------
// advance() is frame-rate independent
// ---------------------------------------------------------------------------
//
// The old easing used a per-frame factor, which finishes sooner on a 120 Hz
// phone than a 30 Hz one. Two devices must take the same wall-clock time.

{
  const run = (dt: number) => {
    let t = 0
    let elapsed = 0
    while (t < 1 && elapsed < 5) {
      t = advance(t, 1, dt, 0.42)
      elapsed += dt
    }
    return elapsed
  }
  const fast = run(1 / 120)
  const slow = run(1 / 30)
  assert.ok(
    Math.abs(fast - slow) < 0.04,
    `open took ${fast.toFixed(3)}s at 120 Hz and ${slow.toFixed(3)}s at 30 Hz — ` +
      `the animation is tied to frame rate`,
  )
  assert.ok(Math.abs(fast - 0.42) < 0.05, `expected ~0.42s, got ${fast.toFixed(3)}s`)
}

// It closes as well as it opens, and never leaves the unit interval.
{
  let t = 1
  for (let i = 0; i < 500; i++) t = advance(t, 0, 1 / 60, 0.42)
  assert.equal(t, 0, 'advance must reach exactly 0, not approach it')
  let u = 0
  for (let i = 0; i < 500; i++) u = advance(u, 1, 1 / 60, 0.42)
  assert.equal(u, 1, 'advance must reach exactly 1, not approach it')
}

assert.equal(clamp01(-1), 0)
assert.equal(clamp01(2), 1)
assert.equal(clamp01(0.4), 0.4)

// ---------------------------------------------------------------------------
// The durations are of a piece
// ---------------------------------------------------------------------------

for (const [k, v] of Object.entries(DURATIONS)) {
  assert.ok(v > 0.15 && v < 1.2, `DURATIONS.${k} is ${v}s — outside what reads as a gesture`)
}
assert.ok(
  DURATIONS.stand < DURATIONS.sit,
  'standing up should be quicker than sitting down — it happens on every exit',
)

console.log(
  `motion.test.ts — leap overshoots, slip does not, advance is frame-rate ` +
    `independent, all assertions passed`,
)
