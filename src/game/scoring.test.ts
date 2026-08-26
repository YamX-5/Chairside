import assert from 'node:assert/strict'
import {
  DECISION_POINTS,
  coinsEarned,
  maxPrepPoints,
  maxTreatPoints,
  outcomeTier,
  starsFor,
  treatRatio,
} from './scoring'
import { perioStaging } from '../content/days/perio-staging'

// Ratio clamps and guards against divide-by-zero.
assert.equal(treatRatio(0, 0), 0)
assert.equal(treatRatio(200, 400), 0.5)
assert.equal(treatRatio(500, 400), 1, 'clamped to 1')
assert.equal(treatRatio(-50, 400), 0, 'clamped to 0')

// Tier boundaries — exact edges matter, they decide the star count.
assert.equal(outcomeTier(1), 'success')
assert.equal(outcomeTier(0.85), 'success', '0.85 is the success edge')
assert.equal(outcomeTier(0.8499), 'partial')
assert.equal(outcomeTier(0.5), 'partial', '0.5 is the partial edge')
assert.equal(outcomeTier(0.4999), 'failure')
assert.equal(outcomeTier(0), 'failure')

assert.equal(starsFor('success'), 3)
assert.equal(starsFor('partial'), 2)
assert.equal(starsFor('failure'), 1)

// Coins: score/10 floored, plus a tier bonus.
assert.equal(coinsEarned(0, 'failure'), 0)
assert.equal(coinsEarned(555, 'failure'), 55)
assert.equal(coinsEarned(555, 'partial'), 75)
assert.equal(coinsEarned(555, 'success'), 105)

// Real content: the demo perio day has 3 prep chunks and 4 decisions.
assert.equal(maxPrepPoints(perioStaging), 3 * 60)
assert.equal(maxTreatPoints(perioStaging), 4 * DECISION_POINTS.best)

// A perfect run of the perio day must land on 'success'.
const perfect = treatRatio(maxTreatPoints(perioStaging), maxTreatPoints(perioStaging))
assert.equal(outcomeTier(perfect), 'success')

// All-acceptable answers (50%) must NOT read as success.
const allAcceptable = treatRatio(
  perioStaging.treat.cases[0].decisions.length * DECISION_POINTS.acceptable,
  maxTreatPoints(perioStaging),
)
assert.equal(outcomeTier(allAcceptable), 'partial')

console.log('scoring.test.ts — all assertions passed')
