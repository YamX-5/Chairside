import assert from 'node:assert/strict'
import { daysBetween, localDateKey, nextStreak } from './dates'

// localDateKey uses LOCAL calendar date — the whole point of the module.
{
  const d = new Date(2026, 6, 21, 1, 30) // 21 July 2026, 01:30 local
  assert.equal(localDateKey(d), '2026-07-21')
  // In Jordan (UTC+3) toISOString() would report 2026-07-20 here.
}

// Zero-padding
assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05')

// daysBetween
assert.equal(daysBetween('2026-07-21', '2026-07-22'), 1)
assert.equal(daysBetween('2026-07-21', '2026-07-21'), 0)
assert.equal(daysBetween('2026-07-31', '2026-08-01'), 1)
assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1) // 2026 not a leap year
assert.equal(daysBetween('2026-07-21', '2026-07-19'), -2)

// Streak rules
assert.equal(nextStreak(0, null, '2026-07-21'), 1, 'first ever day starts at 1')
assert.equal(nextStreak(3, '2026-07-20', '2026-07-21'), 4, 'next day extends')
assert.equal(nextStreak(3, '2026-07-21', '2026-07-21'), 3, 'same day is a no-op')
assert.equal(nextStreak(9, '2026-07-18', '2026-07-21'), 1, 'a gap resets to 1')
assert.equal(nextStreak(0, '2026-07-21', '2026-07-21'), 1, 'same day floors at 1')

console.log('dates.test.ts — all assertions passed')
