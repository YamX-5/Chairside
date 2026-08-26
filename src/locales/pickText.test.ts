import assert from 'node:assert/strict'
import { pickText } from './pickText'

const both = { en: 'Stage III', ar: 'المرحلة الثالثة (Stage III)' }
const englishOnly = { en: 'Stage III' }

assert.equal(pickText(both, 'en'), 'Stage III')
assert.equal(pickText(both, 'ar'), 'المرحلة الثالثة (Stage III)')

// The add-on model: untranslated content stays readable instead of blanking.
assert.equal(pickText(englishOnly, 'en'), 'Stage III')
assert.equal(pickText(englishOnly, 'ar'), 'Stage III')

// An empty Arabic string is treated as missing, not rendered as a blank line.
assert.equal(pickText({ en: 'Grade C', ar: '' }, 'ar'), 'Grade C')

console.log('pickText.test.ts — all assertions passed')
