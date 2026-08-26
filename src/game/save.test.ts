import assert from 'node:assert/strict'
import { EMPTY_SAVE, applyDayCompletion, migrate } from './save'

// First completion
const s1 = applyDayCompletion(EMPTY_SAVE, { dayId: 'd1', score: 400, stars: 2 }, '2026-07-21', 60)
assert.equal(s1.coins, 60)
assert.equal(s1.streak, 1)
assert.equal(s1.lastPlayedDate, '2026-07-21')
assert.equal(s1.completed.length, 1)

// Next calendar day extends the streak
const s2 = applyDayCompletion(s1, { dayId: 'd2', score: 300, stars: 2 }, '2026-07-22', 40)
assert.equal(s2.streak, 2)
assert.equal(s2.coins, 100)
assert.equal(s2.completed.length, 2)

// Replaying a day keeps the BEST score/stars, never downgrades
const s3 = applyDayCompletion(s2, { dayId: 'd1', score: 100, stars: 1 }, '2026-07-23', 10)
const d1 = s3.completed.find((c) => c.dayId === 'd1')!
assert.equal(d1.score, 400, 'best score retained')
assert.equal(d1.stars, 2, 'best stars retained')
assert.equal(s3.completed.length, 2, 'no duplicate record for d1')

// A replay with a better result does upgrade
const s4 = applyDayCompletion(s3, { dayId: 'd1', score: 900, stars: 3 }, '2026-07-24', 100)
const d1b = s4.completed.find((c) => c.dayId === 'd1')!
assert.equal(d1b.score, 900)
assert.equal(d1b.stars, 3)

// A missed day resets the streak to 1
const s5 = applyDayCompletion(s4, { dayId: 'd2', score: 500, stars: 3 }, '2026-07-28', 50)
assert.equal(s5.streak, 1, 'gap resets streak')

// Original save object is never mutated
assert.equal(EMPTY_SAVE.coins, 0)
assert.equal(EMPTY_SAVE.completed.length, 0)

// --- Corrupt saves must degrade to a fresh save, never crash the app ---

assert.deepEqual(migrate(null), EMPTY_SAVE)
assert.deepEqual(migrate('not an object'), EMPTY_SAVE)
assert.deepEqual(migrate({ completed: 'oops' }), EMPTY_SAVE, 'wrong type for completed')
assert.deepEqual(migrate({ coins: -5 }), EMPTY_SAVE, 'negative coins rejected')
assert.deepEqual(migrate({ locale: 'fr' }), EMPTY_SAVE, 'unknown locale rejected')
assert.deepEqual(
  migrate({ completed: [{ dayId: 'd1', score: 10, stars: 99, completedOn: '2026-07-21' }] }),
  EMPTY_SAVE,
  'out-of-range stars rejected — Tablet repeats a star glyph that many times',
)

// A valid save survives migration intact
const good = migrate({ ...EMPTY_SAVE, coins: 120, streak: 4, locale: 'ar' })
assert.equal(good.coins, 120)
assert.equal(good.streak, 4)
assert.equal(good.locale, 'ar')
assert.equal(good.saveVersion, 1)

// Unknown extra fields are dropped rather than carried forward
const trimmed = migrate({ ...EMPTY_SAVE, bogusField: true }) as Record<string, unknown>
assert.equal(trimmed.bogusField, undefined)

console.log('save.test.ts — all assertions passed')
