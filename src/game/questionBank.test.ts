import assert from 'node:assert/strict'
import { seededShuffle } from './questionBank'

const items = [1, 2, 3, 4, 5, 6, 7, 8]

// Deterministic: same seed, same order.
assert.deepEqual(seededShuffle(items, 42), seededShuffle(items, 42))

// Different seeds generally differ.
assert.notDeepEqual(seededShuffle(items, 1), seededShuffle(items, 999))

// Never loses or duplicates elements.
const shuffled = seededShuffle(items, 7)
assert.equal(shuffled.length, items.length)
assert.deepEqual([...shuffled].sort((a, b) => a - b), items)

// Never mutates the input.
assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7, 8])

// Edge cases
assert.deepEqual(seededShuffle([], 5), [])
assert.deepEqual(seededShuffle(['only'], 5), ['only'])
assert.equal(seededShuffle(items, 0).length, items.length, 'seed 0 must not hang')

console.log('questionBank.test.ts — all assertions passed')
