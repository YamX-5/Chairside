import assert from 'node:assert/strict'
import { PROMPT_TEXT, TREAT_WITH, fill, promptFor, type PromptState } from './prompts'
import { INTERACTABLES } from './layout'

const base: PromptState = {
  near: null,
  gloved: false,
  holding: null,
  anaesthetised: false,
  drawerOpen: false,
  studied: false,
  canTreat: false,
}
const at = (p: Partial<PromptState>): PromptState => ({ ...base, ...p })

// ---------------------------------------------------------------------------
// Every interactable in the room says SOMETHING
// ---------------------------------------------------------------------------
//
// The point of the file: a player who walks up to a thing and is told nothing
// concludes it is broken. 'solve' is the one legitimate exception — the chair
// is genuinely inert before the encounter starts, and inventing a verb for it
// would promise an action that does not exist.

for (const it of INTERACTABLES) {
  const p = promptFor(at({ near: it.id, studied: true, canTreat: true, holding: 'mirror', holdingLabel: 'Mouth mirror' }))
  assert.ok(p, `standing at '${it.id}' shows no prompt at all`)
}

// ---------------------------------------------------------------------------
// The verb matches the state, not just the place
// ---------------------------------------------------------------------------

assert.equal(promptFor(at({ near: 'gloves' })), PROMPT_TEXT.glovesOn)
assert.equal(promptFor(at({ near: 'gloves', gloved: true })), PROMPT_TEXT.glovesOff)

assert.equal(promptFor(at({ near: 'drawer' })), PROMPT_TEXT.drawerOpen)
assert.equal(promptFor(at({ near: 'drawer', drawerOpen: true })), PROMPT_TEXT.drawerClose)

assert.equal(promptFor(at({ near: 'study' })), PROMPT_TEXT.study)
assert.equal(promptFor(at({ near: 'study', studied: true })), PROMPT_TEXT.studyAgain)

// ---------------------------------------------------------------------------
// The chair: the prompt must never invite a mistake
// ---------------------------------------------------------------------------

{
  // The morning gate is explained rather than silent.
  assert.equal(promptFor(at({ near: 'solve' })), PROMPT_TEXT.deskFirst)

  // Studied but no plan yet: genuinely nothing to do here.
  assert.equal(promptFor(at({ near: 'solve', studied: true })), null)

  // Planned, empty-handed.
  assert.equal(
    promptFor(at({ near: 'solve', studied: true, canTreat: true })),
    PROMPT_TEXT.needInstrument,
  )

  // The syringe NUMBS. Offering "treat her with the anaesthetic syringe" would
  // invite performing the committed procedure with a needle.
  assert.equal(
    promptFor(at({ near: 'solve', studied: true, canTreat: true, holding: 'syringe' })),
    PROMPT_TEXT.anaesthetise,
  )
  assert.equal(
    promptFor(
      at({ near: 'solve', studied: true, canTreat: true, holding: 'syringe', anaesthetised: true }),
    ),
    PROMPT_TEXT.alreadyNumb,
  )

  // The X-ray IMAGES. Same reasoning.
  assert.equal(
    promptFor(at({ near: 'solve', studied: true, canTreat: true, holding: 'xray' })),
    PROMPT_TEXT.radiograph,
  )

  // Anything else names the tool you are actually holding.
  const p = promptFor(
    at({
      near: 'solve',
      studied: true,
      canTreat: true,
      holding: 'forceps',
      holdingLabel: 'Extraction forceps',
    }),
  )
  assert.ok(p && p.en.includes('extraction forceps'), `expected the tool named, got "${p?.en}"`)
  assert.ok(p && p.ar.includes('extraction forceps'), 'the Arabic line must interpolate too')
}

// ---------------------------------------------------------------------------
// Both locales, always. House rule 4.
// ---------------------------------------------------------------------------

for (const [key, pair] of Object.entries({ ...PROMPT_TEXT, TREAT_WITH })) {
  assert.ok(pair.en.trim().length > 0, `${key} is missing English`)
  assert.ok(pair.ar.trim().length > 0, `${key} is missing Arabic`)
  assert.notEqual(pair.en, pair.ar, `${key} has identical text in both locales`)
  assert.ok(/[؀-ۿ]/.test(pair.ar), `${key}.ar contains no Arabic script`)
}

// The interpolation token has to survive translation, or the Arabic line drops
// the tool's name silently.
assert.ok(TREAT_WITH.en.includes('{tool}'))
assert.ok(TREAT_WITH.ar.includes('{tool}'))

{
  const f = fill(TREAT_WITH, { tool: 'scaler' })
  assert.ok(!f.en.includes('{tool}') && !f.ar.includes('{tool}'), 'fill() left a token behind')
}

console.log(
  `prompts.test.ts — ${Object.keys(PROMPT_TEXT).length + 1} bilingual lines, ` +
    `every interactable prompts, all assertions passed`,
)
