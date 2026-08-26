import assert from 'node:assert/strict'
import {
  breachesFor,
  consequenceFor,
  requiresAnaesthesia,
  BREACH_TEXT,
  NEEDS_ANAESTHESIA,
} from './protection'
import { PROCEDURE_INSTRUMENT } from './instruments'

/**
 * The gloves-and-anaesthesia rules, tested headless.
 *
 * Run: npx tsx src/clinic/protection.test.ts
 */

// --- which procedures need anaesthetic --------------------------------------
assert.equal(requiresAnaesthesia('p-extraction'), true, 'extraction is surgical')
assert.equal(requiresAnaesthesia('p-rct'), true, 'endodontics enters the pulp')
assert.equal(requiresAnaesthesia('p-restoration'), true, 'restoration cuts dentine')
assert.equal(requiresAnaesthesia('p-pulp-cap'), true, 'the pulp is already exposed')
assert.equal(requiresAnaesthesia('p-monitor'), false, 'looking is not treating')

// No procedure committed yet is not a breach — it is simply not treatment.
assert.equal(requiresAnaesthesia(null), false)
assert.deepEqual(breachesFor({ gloved: false, anaesthetised: false }, null), [])

// An UNKNOWN procedure must assume anaesthetic is needed. A generated case can
// introduce a procedure id this table has never seen, and the safe default for
// "might reach a nerve" is yes.
assert.equal(requiresAnaesthesia('p-something-new'), true, 'unknown defaults to yes')

// --- every procedure the game can actually run is covered --------------------
// PROCEDURE_INSTRUMENT is the list of procedures a player can perform. If one is
// added there and not here, it silently falls through to the unknown default and
// nobody finds out until a patient screams during an examination.
for (const id of Object.keys(PROCEDURE_INSTRUMENT)) {
  assert.ok(
    id in NEEDS_ANAESTHESIA,
    `procedure '${id}' is performable but has no anaesthesia rule`,
  )
}

// --- breaches ----------------------------------------------------------------
assert.deepEqual(
  breachesFor({ gloved: true, anaesthetised: true }, 'p-extraction'),
  [],
  'gloved and numb is clean',
)
assert.deepEqual(
  breachesFor({ gloved: false, anaesthetised: true }, 'p-extraction'),
  ['no_gloves'],
)
assert.deepEqual(
  breachesFor({ gloved: true, anaesthetised: false }, 'p-extraction'),
  ['no_anaesthesia'],
)
// BOTH are reported, not just the first. One lesson at a time is one lesson per
// five minutes.
assert.deepEqual(
  breachesFor({ gloved: false, anaesthetised: false }, 'p-extraction'),
  ['no_gloves', 'no_anaesthesia'],
)

// Gloves are required even for examination — standard precautions do not scale
// with invasiveness.
assert.deepEqual(
  breachesFor({ gloved: false, anaesthetised: false }, 'p-monitor'),
  ['no_gloves'],
  'examination still needs gloves, but not anaesthetic',
)

// --- consequences -------------------------------------------------------------
// A cross-infection breach is invisible in the moment. It must NOT make the
// patient yelp, or the player learns the wrong causal model.
assert.equal(consequenceFor('no_gloves', 'p-extraction'), null, 'gloves do not hurt')

const ext = consequenceFor('no_anaesthesia', 'p-extraction')
assert.ok(ext)
assert.equal(ext.primitive, 'patient_scream')
assert.equal(ext.intensity, 'severe')

const rct = consequenceFor('no_anaesthesia', 'p-rct')
assert.ok(rct)
assert.equal(rct.primitive, 'patient_scream', 'pulpal access is severe')

const rest = consequenceFor('no_anaesthesia', 'p-restoration')
assert.ok(rest)
assert.equal(rest.primitive, 'patient_wince_vocal', 'dentine hurts, but less')
assert.equal(rest.intensity, 'moderate')

// Every consequence must teach something — a scream with no lesson is just noise.
for (const p of ['p-extraction', 'p-rct', 'p-restoration', 'p-pulp-cap']) {
  const c = consequenceFor('no_anaesthesia', p)
  assert.ok(c, `${p} has a consequence`)
  assert.ok(c.lesson.en.length > 40, `${p} lesson explains the mechanism`)
  // Both locales or neither — a lesson only half the audience can read is half
  // a lesson.
  assert.ok(c.lesson.ar.length > 20, `${p} lesson has Arabic`)
  assert.ok(/[؀-ۿ]/.test(c.lesson.ar), `${p} Arabic is actually Arabic`)
}

// --- bilingual, both locales or neither --------------------------------------
for (const [id, text] of Object.entries(BREACH_TEXT)) {
  assert.ok(text.en.length > 0, `${id} has English`)
  assert.ok(text.ar.length > 0, `${id} has Arabic`)
  assert.ok(/[؀-ۿ]/.test(text.ar), `${id} Arabic is actually Arabic`)
}

console.log(
  `protection.test.ts — ${Object.keys(NEEDS_ANAESTHESIA).length} procedures, ` +
    `${Object.keys(BREACH_TEXT).length} breaches, all assertions passed`,
)
