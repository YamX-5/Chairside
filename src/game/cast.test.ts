import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { DOCTORS, MOODS, PATIENTS, getDoctor, patientForCase, patientForDay } from './cast'
import { ALL_DAYS } from '../content'

// Every roster entry must have the art it claims. A missing file is a broken
// face in the clinic, and the fallback would hide it from view during dev.
for (const person of [...DOCTORS, ...PATIENTS]) {
  for (const mood of MOODS) {
    const file = `public/characters/${person.id}-${mood}.jpg`
    assert.ok(existsSync(file), `missing portrait: ${file}`)
  }
  assert.ok(
    existsSync(`public/characters/${person.id}-body.jpg`),
    `missing body: ${person.id}`,
  )
}

// Deterministic: the same day seats the same person, every reload.
for (const day of ALL_DAYS) {
  assert.equal(patientForDay(day.id).id, patientForDay(day.id).id)
  const age = day.treat.cases[0].patient.age
  assert.equal(patientForCase(day.id, age).id, patientForCase(day.id, age).id)
}

// Age is clinical, not decorative: an 8-year-old face must never front an
// adult periodontitis case.
for (const day of ALL_DAYS) {
  const age = day.treat.cases[0].patient.age
  const picked = patientForCase(day.id, age)
  assert.ok(
    Math.abs(picked.age - age) <= 20,
    `${day.id}: case age ${age} got ${picked.id} aged ${picked.age}`,
  )
}

// A case age with nobody within a decade still returns somebody rather than
// throwing — the fiction degrades, the screen does not.
assert.ok(patientForCase('made-up-day', 3).id)
assert.ok(patientForCase('made-up-day', 99).id)

// Every doctor the login screen offers is resolvable by id.
for (const d of DOCTORS) assert.equal(getDoctor(d.id)?.id, d.id)
assert.equal(getDoctor('nobody'), undefined)

console.log(
  `cast.test.ts — ${DOCTORS.length} doctors, ${PATIENTS.length} patients, ` +
    `${(DOCTORS.length + PATIENTS.length) * (MOODS.length + 1)} art files, all assertions passed`,
)
