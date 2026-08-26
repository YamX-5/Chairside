import assert from 'node:assert/strict'
import {
  describeFilmBank,
  filmInstruction,
  resolveFilm,
  type FilmCandidate,
  type FilmChoice,
} from './filmChoice'
import type { Deck } from './pdf'

/**
 * Only the pure parts — chooseFilm itself needs a model call. The format of the
 * catalogue and the wording of the binding instruction are exactly where silent
 * drift produces cases whose radiograph shows something else entirely, so they
 * are the parts worth pinning down.
 */

const deck: Deck = {
  fileName: 'endodontics.pdf',
  pages: [
    { page: 1, text: 'Endodontic diagnosis — course objectives' },
    { page: 7, text: 'Radiographic interpretation' },
    {
      page: 12,
      text: 'Fig 4. Periapical radiolucency associated with the mesial root of tooth 46, consistent with chronic apical periodontitis.',
    },
    { page: 18, text: '' },
  ],
}

const films: FilmCandidate[] = [
  { page: 7, width: 400, height: 500, annotated: false },
  { page: 12, width: 620, height: 480, annotated: false },
  { page: 18, width: 300, height: 400, annotated: true },
]

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

{
  const bank = describeFilmBank(deck, films)

  // Every film must be listed with its page, or the model cannot choose one.
  for (const f of films) {
    assert.ok(bank.includes(`page ${f.page}`), `film on page ${f.page} missing from the bank`)
  }

  // The slide text is the only evidence of what a film shows.
  assert.ok(
    bank.includes('Periapical radiolucency'),
    'the describing slide text must reach the model',
  )

  // An annotated film must be flagged — the answer may be drawn on it.
  assert.ok(bank.includes('WARNING'), 'annotated films must carry a warning')
  const afterPage18 = bank.slice(bank.indexOf('page 18'))
  assert.ok(afterPage18.includes('WARNING'), 'the warning must attach to the annotated film')
  assert.ok(
    !bank.slice(bank.indexOf('page 12'), bank.indexOf('page 18')).includes('WARNING'),
    'a clean film must not be warned about',
  )

  // A slide with no text must say so rather than appearing blank, which reads
  // as an empty field the model may hallucinate into.
  assert.ok(bank.includes('no text'), 'a textless slide must be labelled')
}

{
  assert.equal(
    describeFilmBank(deck, []),
    'No radiographs were found in this deck.',
    'an empty bank must be stated plainly, not returned as an empty string',
  )
}

{
  // Slide text is truncated so a wall-of-text slide cannot crowd out the others.
  const wordy: Deck = {
    fileName: 'x.pdf',
    pages: [{ page: 3, text: 'A'.repeat(5000) }],
  }
  const bank = describeFilmBank(wordy, [{ page: 3, width: 400, height: 500, annotated: false }], {
    maxChars: 100,
  })
  assert.ok(bank.length < 400, `expected truncation, got ${bank.length} chars`)
}

// ---------------------------------------------------------------------------
// Resolving the choice
// ---------------------------------------------------------------------------

assert.equal(resolveFilm(films, 12)?.page, 12)
assert.equal(resolveFilm(films, null), null, 'declining to choose must resolve to null')
assert.equal(resolveFilm(films, 99), null, 'a page with no film must not resolve')

// ---------------------------------------------------------------------------
// The binding instruction
// ---------------------------------------------------------------------------

{
  const chosen: FilmChoice = {
    page: 12,
    shows: 'periapical radiolucency at the mesial root apex',
    toothFDI: '46',
    reasoning: 'the slide names both the finding and the tooth',
  }
  const text = filmInstruction(chosen)

  assert.ok(text.includes('page 12'), 'must name the page the film came from')
  assert.ok(text.includes('periapical radiolucency'), 'must state what the film shows')
  assert.ok(text.includes('46'), 'must state the tooth when known')

  // The load-bearing constraint: the model must not add findings that are not
  // in the picture the student is actually looking at.
  assert.ok(
    text.includes('Do not invent additional'),
    'must forbid inventing findings absent from the film',
  )
}

{
  // A film whose slide names no tooth must not produce a dangling sentence.
  const noTooth: FilmChoice = {
    page: 12,
    shows: 'widened periodontal ligament space',
    toothFDI: null,
    reasoning: 'slide names the finding but not the tooth',
  }
  const text = filmInstruction(noTooth)
  assert.ok(!text.includes('The tooth involved is'), 'must omit the tooth line entirely')
  assert.ok(!text.includes('\n\n\n'), 'must not leave a blank hole where the tooth line was')
  assert.ok(text.includes('widened periodontal ligament space'))
}

{
  // No film is a normal outcome and must produce a case that does not pretend
  // the student can see an image.
  const none: FilmChoice = { page: null, shows: '', toothFDI: null, reasoning: 'nothing usable' }
  const text = filmInstruction(none)
  assert.ok(text.includes('No radiograph is available'))
  assert.ok(
    text.includes('written report'),
    'imaging must degrade to a report, not vanish or be faked',
  )
  assert.ok(!text.includes('page null'), 'must not leak a null page into the prompt')
}

console.log('filmChoice.test.ts — all assertions passed')
