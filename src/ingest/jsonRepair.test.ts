import assert from 'node:assert/strict'
import {
  extractJson,
  generateWithRepair,
  repairInstruction,
  schemaInstruction,
  SchemaRetryError,
} from './jsonRepair'

/**
 * This is the module that lets a cheap model stand in for an expensive one, so
 * its failure behaviour matters more than its happy path. Every case here is a
 * malformed reply that has actually been observed from JSON-mode models.
 */

// ---------------------------------------------------------------------------
// Unwrapping what models actually send back
// ---------------------------------------------------------------------------

assert.equal(extractJson('{"a":1}'), '{"a":1}', 'clean JSON passes through')
assert.equal(extractJson('  {"a":1}  '), '{"a":1}', 'whitespace trimmed')

assert.equal(
  extractJson('```json\n{"a":1}\n```'),
  '{"a":1}',
  'fenced blocks are the single most common wrapper',
)
assert.equal(extractJson('```\n{"a":1}\n```'), '{"a":1}', 'untagged fences too')

assert.equal(
  extractJson('Here is the JSON you asked for:\n{"a":1}'),
  '{"a":1}',
  'preamble is stripped',
)
assert.equal(
  extractJson('Sure!\n{"a":1}\nLet me know if you need changes.'),
  '{"a":1}',
  'preamble AND postamble',
)

{
  // Nested braces must survive — first-to-last is the right slice, not first-to-first.
  const nested = '{"a":{"b":[1,2]},"c":"}"}'
  assert.equal(extractJson(`Result: ${nested}`), nested, 'nested objects survive')
}

// ---------------------------------------------------------------------------
// The prompts
// ---------------------------------------------------------------------------

{
  const schema = { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] }
  const text = schemaInstruction(schema)
  assert.ok(text.includes('"n"'), 'the schema itself must be in the prompt')
  assert.ok(text.includes('code fences'), 'must explicitly forbid fences')
  assert.ok(text.includes('enum'), 'must warn against invented enum values')
  assert.ok(text.includes('not strings'), 'must state numbers are numbers')
}

{
  const text = repairInstruction('{"n":"5"}', 'Expected number, received string')
  // Showing the model its own output is what stops it repeating the mistake.
  assert.ok(text.includes('{"n":"5"}'), 'must quote the previous reply back')
  assert.ok(text.includes('Expected number'), 'must quote the validation error')
}

{
  // A huge broken reply must not blow the context window on the retry.
  const huge = '{"x":"' + 'A'.repeat(50000) + '"}'
  assert.ok(repairInstruction(huge, 'bad').length < 5000, 'previous reply must be truncated')
}

// ---------------------------------------------------------------------------
// The retry loop
// ---------------------------------------------------------------------------

interface Shape { n: number }
function parseShape(v: unknown): Shape {
  const o = v as Record<string, unknown>
  if (typeof o?.n !== 'number') throw new Error('Expected number at "n"')
  return { n: o.n }
}

{
  // Happy path: one call, no retries.
  let calls = 0
  const out = await generateWithRepair({
    call: async () => { calls++; return '{"n":7}' },
    parse: parseShape,
    instruction: 'go',
  })
  assert.deepEqual(out, { n: 7 })
  assert.equal(calls, 1, 'a valid reply must not trigger a retry')
}

{
  // Recovers on the second attempt, and the retry must carry the repair prompt.
  const seen: string[] = []
  let calls = 0
  const out = await generateWithRepair({
    call: async (instruction) => {
      seen.push(instruction)
      calls++
      return calls === 1 ? '{"n":"7"}' : '{"n":7}'
    },
    parse: parseShape,
    instruction: 'go',
  })
  assert.deepEqual(out, { n: 7 })
  assert.equal(calls, 2)
  assert.equal(seen[0], 'go', 'first call sends the original instruction')
  assert.ok(seen[1].includes('did not match the schema'), 'second call is a repair prompt')
  assert.ok(seen[1].includes('{"n":"7"}'), 'repair prompt quotes the bad reply')
}

{
  // Fenced-but-valid must succeed on the FIRST attempt — burning a retry on a
  // wrapper we already know how to strip is pure wasted money.
  let calls = 0
  const out = await generateWithRepair({
    call: async () => { calls++; return '```json\n{"n":3}\n```' },
    parse: parseShape,
    instruction: 'go',
  })
  assert.deepEqual(out, { n: 3 })
  assert.equal(calls, 1, 'fences must not cost a retry')
}

{
  // Gives up rather than looping forever.
  let calls = 0
  await assert.rejects(
    generateWithRepair({
      call: async () => { calls++; return 'not json at all' },
      parse: parseShape,
      instruction: 'go',
      maxAttempts: 3,
    }),
    (err: unknown) => {
      assert.ok(err instanceof SchemaRetryError)
      assert.equal(err.attempts, 3)
      assert.ok(err.lastError.length > 0, 'must report what went wrong')
      return true
    },
  )
  assert.equal(calls, 3, 'must stop at maxAttempts, not keep going')
}

{
  // maxAttempts of 1 means no retry at all.
  let calls = 0
  await assert.rejects(
    generateWithRepair({
      call: async () => { calls++; return '{}' },
      parse: parseShape,
      instruction: 'go',
      maxAttempts: 1,
    }),
    SchemaRetryError,
  )
  assert.equal(calls, 1)
}

console.log('jsonRepair.test.ts — all assertions passed')
