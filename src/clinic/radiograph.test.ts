import assert from 'node:assert/strict'
import { canShoot, filmView, XRAY_TEXT } from './radiograph'
import { INSTRUMENT_BY_ID, SHELF_INSTRUMENTS } from './instruments'

// ---------------------------------------------------------------------------
// The film itself
// ---------------------------------------------------------------------------

{
  const v = filmView({
    src: 'blob:http://localhost/abc',
    shows: { en: 'Periapical radiolucency at 46', ar: 'شفافية حول الذروة عند 46' },
    page: 12,
  })
  assert.equal(v.kind, 'film')
  if (v.kind === 'film') {
    assert.equal(v.src, 'blob:http://localhost/abc')
    assert.equal(v.page, 12)
    // The caption is GENERATED from the deck, so `ar` is legitimately optional
    // — an English lecture yields an English-only caption and `c()` falls back.
    // This is the one bilingual string in the feature that is not required in
    // both locales, because we do not machine-translate a clinical finding.
    assert.equal(v.shows.ar, 'شفافية حول الذروة عند 46')
  }
}

{
  // The cases that must NOT throw and must NOT invent a picture. A generated
  // case is untrusted input; a crash mid-encounter is worse than a blank film.
  assert.equal(filmView(undefined).kind, 'empty', 'absent radiograph')
  assert.equal(filmView(null).kind, 'empty', 'null radiograph')
  assert.equal(
    filmView({ src: '', shows: { en: 'x', ar: 'x' } }).kind,
    'empty',
    'empty src is not a film',
  )
  assert.equal(
    filmView({ src: '   ', shows: { en: 'x', ar: 'x' } }).kind,
    'empty',
    'whitespace src is not a film',
  )
  assert.equal(
    filmView({ src: 123 as unknown as string, shows: { en: 'x', ar: 'x' } }).kind,
    'empty',
    'a non-string src must degrade to empty, not crash',
  )
}

// ---------------------------------------------------------------------------
// You have to be holding it
// ---------------------------------------------------------------------------

assert.equal(canShoot('xray'), true, 'holding the X-ray lets you shoot')
assert.equal(canShoot(null), false, 'empty-handed cannot shoot')
assert.equal(canShoot('mirror'), false, 'a mirror is not an X-ray')
assert.equal(canShoot('forceps'), false)

// ---------------------------------------------------------------------------
// The instrument is actually reachable
// ---------------------------------------------------------------------------

{
  const xray = INSTRUMENT_BY_ID.get('xray')
  assert.ok(xray, 'the xray instrument must exist')
  assert.equal(xray!.storage, 'shelf', 'the X-ray lives on the shelf, not the tray')
  assert.ok(xray!.model, 'the X-ray ships its own textured model')
  assert.ok(
    xray!.model!.endsWith('.glb'),
    `model should be a .glb path, got "${xray!.model}"`,
  )
  assert.equal(
    SHELF_INSTRUMENTS.length,
    1,
    'exactly one instrument on the shelf so far — the portable X-ray',
  )
  assert.equal(SHELF_INSTRUMENTS[0].id, 'xray')
}

// ---------------------------------------------------------------------------
// Both locales, always. House rule 4.
// ---------------------------------------------------------------------------

for (const [key, pair] of Object.entries(XRAY_TEXT)) {
  assert.ok(pair.en.trim().length > 0, `XRAY_TEXT.${key} is missing English`)
  assert.ok(pair.ar.trim().length > 0, `XRAY_TEXT.${key} is missing Arabic`)
  assert.notEqual(
    pair.en,
    pair.ar,
    `XRAY_TEXT.${key} has the same text in both locales — the Arabic was not written`,
  )
  // Arabic must actually be Arabic script, not a transliteration or a paste of
  // the English. This is the check that catches a forgotten translation that
  // someone filled in with placeholder text.
  assert.ok(
    /[؀-ۿ]/.test(pair.ar),
    `XRAY_TEXT.${key}.ar contains no Arabic script`,
  )
}

{
  // The interpolation token must survive in both locales, or the Arabic string
  // silently drops the page number.
  assert.ok(XRAY_TEXT.fromPage.en.includes('{n}'))
  assert.ok(XRAY_TEXT.fromPage.ar.includes('{n}'))
}

console.log(
  `radiograph.test.ts — ${Object.keys(XRAY_TEXT).length} bilingual strings, all assertions passed`,
)
