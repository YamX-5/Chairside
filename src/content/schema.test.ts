import assert from 'node:assert/strict'
import { ALL_DAYS } from './index'
import { ClinicDay } from './schema'
import { buildQuestionBank } from '../game/questionBank'

// Every shipped day parses. (index.ts already parses on import; this asserts
// the registry is non-empty so a silent empty array can't pass as "valid".)
assert.ok(ALL_DAYS.length >= 2, 'at least two clinic days are registered')

/**
 * English is mandatory — it is the study language and the fallback for every
 * untranslated string. Arabic is optional, but when present it must be real
 * Arabic rather than a copy-pasted English placeholder.
 */
function assertContentText(node: unknown, path: string) {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((v, i) => assertContentText(v, `${path}[${i}]`))
    return
  }
  const obj = node as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.includes('en') || keys.includes('ar')) {
    assert.equal(typeof obj.en, 'string', `${path}.en must be a string`)
    assert.ok((obj.en as string).trim().length > 0, `${path}.en is empty`)
    if (obj.ar !== undefined) {
      assert.equal(typeof obj.ar, 'string', `${path}.ar must be a string`)
      assert.ok((obj.ar as string).trim().length > 0, `${path}.ar is empty`)
      assert.ok(
        /[؀-ۿ]/.test(obj.ar as string),
        `${path}.ar contains no Arabic characters`,
      )
    }
    return
  }
  for (const k of keys) assertContentText(obj[k], `${path}.${k}`)
}

for (const day of ALL_DAYS) {
  assertContentText(day, day.id)

  // Exactly one correct answer per micro-question (schema enforces; assert anyway).
  for (const chunk of day.prep.chunks) {
    const correct = chunk.question.options.filter((o) => o.isCorrect)
    assert.equal(correct.length, 1, `${day.id}/${chunk.id} needs exactly 1 correct option`)
  }

  // Exactly one 'best' decision option, and clinical days cite their standards.
  for (const c of day.treat.cases) {
    for (const d of c.decisions) {
      const best = d.options.filter((o) => o.quality === 'best')
      assert.equal(best.length, 1, `${day.id}/${c.id}/${d.id} needs exactly 1 best option`)
    }
  }
  assert.ok(day.citations.length > 0, `${day.id} must cite its clinical standards`)
}

// English-only content is valid: Arabic is an add-on, not a gate on shipping.
{
  const englishOnly = ClinicDay.parse({
    ...ALL_DAYS[0],
    title: { en: 'English-only day' },
  })
  assert.equal(englishOnly.title.ar, undefined)
}

// ...but a day with no English at all is not content.
assert.throws(
  () => ClinicDay.parse({ ...ALL_DAYS[0], title: { ar: 'عربية فقط' } }),
  'Arabic without English must be rejected',
)

// Bad content is rejected — the Phase 2 LLM gate must actually be a gate.
assert.throws(
  () => ClinicDay.parse({ ...ALL_DAYS[0], schemaVersion: 2 }),
  'wrong schemaVersion must be rejected',
)
assert.throws(
  () =>
    ClinicDay.parse({
      ...ALL_DAYS[0],
      prep: {
        ...ALL_DAYS[0].prep,
        chunks: [
          {
            ...ALL_DAYS[0].prep.chunks[0],
            question: {
              ...ALL_DAYS[0].prep.chunks[0].question,
              options: ALL_DAYS[0].prep.chunks[0].question.options.map((o) => ({
                ...o,
                isCorrect: true,
              })),
            },
          },
        ],
      },
    }),
  'multiple correct answers must be rejected',
)

// The derived question bank covers every prep question and every decision.
const bank = buildQuestionBank(ALL_DAYS)
const expected = ALL_DAYS.reduce(
  (n, d) =>
    n +
    d.prep.chunks.length +
    d.treat.cases.reduce((m, c) => m + c.decisions.length, 0),
  0,
)
assert.equal(bank.length, expected, 'question bank covers all questions')
assert.equal(new Set(bank.map((q) => q.id)).size, bank.length, 'bank ids are unique')
for (const q of bank) {
  assert.equal(
    q.options.filter((o) => o.isCorrect).length,
    1,
    `bank question ${q.id} must have exactly one correct option`,
  )
}

console.log(`schema.test.ts — ${ALL_DAYS.length} days, ${bank.length} questions, all assertions passed`)
