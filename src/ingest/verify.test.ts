import assert from 'node:assert/strict'
import { normalise, quoteOverlap, verifyItem, findDuplicates, QUOTE_THRESHOLD } from './verify'
import type { GeneratedItem } from './schemas'

const PAGE_TEXT =
  'Stage III periodontitis is defined by interdental clinical attachment loss of 5 mm or more, ' +
  'with radiographic bone loss extending to the middle third of the root and no more than four teeth lost.'

const deck = {
  fileName: 'perio.pdf',
  pages: [
    { page: 11, text: 'Introduction and course objectives.' },
    { page: 12, text: PAGE_TEXT },
    { page: 13, text: 'Grading estimates the rate of progression.' },
  ],
}

function item(over: Partial<GeneratedItem>): GeneratedItem {
  return {
    id: 'i1',
    stem: 'Stage this case.',
    options: [
      { text: 'Stage III', isCorrect: true, rationale: 'CAL is 6 mm.' },
      { text: 'Stage II', isCorrect: false, rationale: 'Tops out at 4 mm.' },
      { text: 'Stage IV', isCorrect: false, rationale: 'Needs masticatory dysfunction.' },
    ],
    explanation: 'CAL >= 5 mm with bone loss to the middle third.',
    difficulty: 'moderate',
    cognitive: 'application',
    sourcePage: 12,
    sourceQuote: 'Stage III periodontitis is defined by interdental clinical attachment loss of 5 mm or more',
    ...over,
  }
}

// Normalisation absorbs the punctuation and casing damage PDF extraction does.
assert.equal(normalise('Stage  III —  CAL ≥5 mm!'), 'stage iii cal 5 mm')
assert.equal(normalise('“quoted”'), "'quoted'")

// A verbatim quote scores 1.
assert.equal(quoteOverlap(PAGE_TEXT, PAGE_TEXT), 1)

// A quote that is genuinely present scores above threshold.
const real = quoteOverlap(item({}).sourceQuote, PAGE_TEXT)
assert.ok(real >= QUOTE_THRESHOLD, `real quote scored ${real}`)

// An invented quote must not pass — this is the anti-fabrication gate.
const invented = quoteOverlap(
  'Stage III requires a minimum of eight millimetres of probing depth in every sextant',
  PAGE_TEXT,
)
assert.ok(invented < QUOTE_THRESHOLD, `invented quote scored ${invented}`)

// Word order matters: the same words shuffled should not score as verbatim.
const shuffled = quoteOverlap('more or mm 5 of loss attachment clinical interdental', PAGE_TEXT)
assert.ok(shuffled < 1, 'shuffled words must not score as a verbatim match')

// Empty quote can never verify.
assert.equal(quoteOverlap('', PAGE_TEXT), 0)

// verifyItem accepts an accurate citation...
{
  const v = verifyItem(item({}), deck)
  assert.equal(v.verified, true)
  assert.equal(v.matchedPage, 12)
}

// ...tolerates an off-by-one page (decks split sentences across slides)...
{
  const v = verifyItem(item({ sourcePage: 13 }), deck)
  assert.equal(v.verified, true, 'neighbouring page should still verify')
  assert.equal(v.matchedPage, 12, 'reports where the quote actually is')
}

// ...and rejects a quote that appears nowhere in the deck.
{
  const v = verifyItem(
    item({ sourceQuote: 'Antibiotic prophylaxis is mandatory before every periodontal probing.' }),
    deck,
  )
  assert.equal(v.verified, false)
}

// A citation far from the real page fails rather than silently passing.
{
  const faraway = { ...deck, pages: [...deck.pages, { page: 40, text: 'Unrelated.' }] }
  const v = verifyItem(item({ sourcePage: 40 }), faraway)
  assert.equal(v.verified, false, 'quote must be near the cited page')
}

// Duplicate detection catches two items asking the same thing.
{
  const a = item({ id: 'a', stem: 'What determines the stage of periodontitis?' })
  const b = item({ id: 'b', stem: 'What determines the stage of periodontitis?' })
  const c = item({ id: 'c', stem: 'How is the grade calculated from bone loss and age?' })
  const dupes = findDuplicates([a, b, c])
  assert.deepEqual(dupes, ['b'], 'flags the later duplicate, keeps the first')
  assert.equal(findDuplicates([a, c]).length, 0, 'distinct stems are not duplicates')
}

console.log('verify.test.ts — all assertions passed')
