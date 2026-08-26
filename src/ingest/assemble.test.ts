import assert from 'node:assert/strict'
import { assembleDay } from './assemble'
import { buildQuestionBank } from '../game/questionBank'
import { maxTreatPoints } from '../game/scoring'
import type { Blueprint, GeneratedCase, TopicItems } from './schemas'

/**
 * Everything downstream of the network call, exercised on a fixture shaped
 * exactly like real generator output. This is where a schema mismatch between
 * the wire format and the game's ClinicDay would surface — the API call itself
 * cannot catch it, because the model's output is valid on its own terms.
 */

const PAGE_1 =
  'Stage III periodontitis is defined by interdental clinical attachment loss of 5 mm or more, ' +
  'with bone loss extending to the middle third of the root.'
const PAGE_2 =
  'Grade C indicates rapid progression: the ratio of radiographic bone loss to age exceeds 1.0. ' +
  'Smoking ten or more cigarettes per day is a grade modifier.'

const deck = {
  fileName: 'perio-lecture.pdf',
  pages: [
    { page: 1, text: PAGE_1 },
    { page: 2, text: PAGE_2 },
  ],
}

const blueprint: Blueprint = {
  subject: 'Periodontology',
  title: 'Staging and Grading',
  citations: ['2018 EFP/AAP classification'],
  caseScenario: 'A 38-year-old smoker with generalised attachment loss.',
  topics: [
    { id: 'staging', title: 'Staging', objective: 'Assign a stage', pages: [1], itemCount: 2 },
    { id: 'grading', title: 'Grading', objective: 'Assign a grade', pages: [2], itemCount: 1 },
  ],
}

function topic(id: string, items: TopicItems['items']): { topic: { id: string; title: string }; result: TopicItems } {
  return { topic: { id, title: id }, result: { teachingChunk: `Teaching text for ${id}.`, items } }
}

const topics = [
  topic('staging', [
    {
      id: 'staging-0',
      stem: 'A patient has interdental CAL of 6 mm with bone loss to the middle third. What is the stage?',
      options: [
        { text: 'Stage III', isCorrect: true, rationale: 'CAL of 5 mm or more with mid-third bone loss.' },
        { text: 'Stage II', isCorrect: false, rationale: 'Stage II tops out at 4 mm of attachment loss.' },
        { text: 'Stage IV', isCorrect: false, rationale: 'Stage IV additionally requires masticatory dysfunction.' },
      ],
      explanation: 'Stage is set by the worst interdental CAL.',
      difficulty: 'moderate',
      cognitive: 'application',
      sourcePage: 1,
      sourceQuote: 'interdental clinical attachment loss of 5 mm or more',
    },
    {
      // Fabricated quote — must be caught and dropped by the source gate.
      id: 'staging-1',
      stem: 'What probing depth mandates immediate surgery?',
      options: [
        { text: '8 mm', isCorrect: true, rationale: 'Invented.' },
        { text: '4 mm', isCorrect: false, rationale: 'Invented.' },
        { text: '2 mm', isCorrect: false, rationale: 'Invented.' },
      ],
      explanation: 'Not in the deck.',
      difficulty: 'hard',
      cognitive: 'recall',
      sourcePage: 1,
      sourceQuote: 'Immediate surgery is mandated once probing depth reaches eight millimetres.',
    },
  ]),
  topic('grading', [
    {
      id: 'grading-0',
      stem: 'A 40-year-old has 45% bone loss and smokes 15 a day. What grade?',
      options: [
        { text: 'Grade C', isCorrect: true, rationale: 'Ratio above 1.0 and a smoking modifier.' },
        { text: 'Grade B', isCorrect: false, rationale: 'Grade B ends at a ratio of 1.0.' },
        { text: 'Grade A', isCorrect: false, rationale: 'Grade A is slow progression, below 0.25.' },
      ],
      explanation: '45 divided by 40 is above 1.0, and smoking modifies upward.',
      difficulty: 'hard',
      cognitive: 'analysis',
      sourcePage: 2,
      sourceQuote: 'the ratio of radiographic bone loss to age exceeds 1.0',
    },
  ]),
]

const patientCase: GeneratedCase = {
  patientName: 'Rami H.',
  patientAge: 38,
  avatar: '🧔',
  chiefComplaint: '"My gums bleed whenever I brush."',
  history: 'Smokes 15 cigarettes a day for 18 years.',
  findings: ['Interdental CAL 6 mm', 'Radiographic bone loss 45%'],
  outcomeSuccess: 'Rami leaves with a clear diagnosis and a cessation referral.',
  outcomePartial: 'Treated, but the notes will confuse the next clinician.',
  outcomeFailure: 'The wrong diagnosis is now on file.',
  decisions: [
    {
      id: 'd1',
      prompt: 'Stage this case.',
      difficulty: 'moderate',
      sourcePage: 1,
      sourceQuote: 'interdental clinical attachment loss of 5 mm or more',
      options: [
        { text: 'Stage III', quality: 'best', feedback: 'Correct — CAL of 6 mm with mid-third bone loss.' },
        { text: 'Stage II', quality: 'poor', feedback: 'Stage II cannot exceed 4 mm; you have understaged him.' },
        { text: 'Stage IV', quality: 'poor', feedback: 'He has no masticatory dysfunction.' },
      ],
    },
    {
      id: 'd2',
      prompt: 'Grade it.',
      difficulty: 'hard',
      sourcePage: 2,
      sourceQuote: 'Smoking ten or more cigarettes per day is a grade modifier',
      options: [
        { text: 'Grade C', quality: 'best', feedback: 'Correct — expect rapid progression.' },
        { text: 'Grade B', quality: 'acceptable', feedback: 'Close, but the smoking modifier pushes him to C.' },
        { text: 'Grade A', quality: 'poor', feedback: 'Grade A means slow progression; this is the opposite.' },
      ],
    },
    {
      id: 'd3',
      prompt: 'First step of therapy?',
      difficulty: 'easy',
      sourcePage: 1,
      sourceQuote: 'Stage III periodontitis is defined by interdental clinical attachment loss',
      options: [
        { text: 'Behaviour change and cessation support', quality: 'best', feedback: 'Correct — Step 1 builds the foundation.' },
        { text: 'Straight to surgery', quality: 'poor', feedback: 'You would be operating on an infected field.' },
        { text: 'Antibiotics alone', quality: 'poor', feedback: 'Without mechanical disruption the biofilm survives.' },
      ],
    },
  ],
}

const report = assembleDay({ blueprint, topics, patientCase, deck, model: 'claude-opus-4-8' })

// The fabricated item is dropped; the two supported items survive.
assert.equal(report.kept, 2, 'only source-verified items are kept')
assert.equal(report.droppedUnverified, 1, 'the invented item is dropped')
assert.equal(report.unverified[0].item.id, 'staging-1')

// The assembled day passes the game's own schema gate.
const day = report.day
assert.equal(day.schemaVersion, 1)
assert.equal(day.isDemo, false)
assert.equal(day.subject.en, 'Periodontology')
assert.equal(day.provenance?.sourceFile, 'perio-lecture.pdf')
assert.equal(day.provenance?.pageCount, 2)
assert.equal(day.provenance?.model, 'claude-opus-4-8')

// Item metadata survives the mapping — this is what the review UI reads.
assert.equal(day.prep.chunks.length, 2)
const firstQ = day.prep.chunks[0].question
assert.equal(firstQ.difficulty, 'moderate')
assert.equal(firstQ.cognitive, 'application')
assert.ok(firstQ.sourceQuote && PAGE_1.includes(firstQ.sourceQuote))
assert.equal(firstQ.sourceRef.en, 'Page 1')
assert.ok(firstQ.options.every((o) => o.rationale?.en), 'every option carries a rationale')

// The case maps across intact and is playable by the Treat screen's rules.
const c = day.treat.cases[0]
assert.equal(c.decisions.length, 3)
assert.equal(maxTreatPoints(day), 300, 'three decisions at 100 points each')
for (const d of c.decisions) {
  assert.equal(d.options.filter((o) => o.quality === 'best').length, 1)
}

// The question bank derives from the assembled day without extra work.
const bank = buildQuestionBank([day])
assert.equal(bank.length, 2 + 3, 'two surviving prep items plus three decisions')
for (const q of bank) {
  assert.equal(q.options.filter((o) => o.isCorrect).length, 1)
}

// Difficulty spread is reported from surviving items only.
assert.deepEqual(report.difficultyMix, { easy: 0, moderate: 1, hard: 1, brutal: 0 })

// A generated day carries a citation even when the deck names no standard.
{
  const noCite = assembleDay({
    blueprint: { ...blueprint, citations: [] },
    topics,
    patientCase,
    deck,
    model: 'claude-opus-4-8',
  })
  assert.ok(noCite.day.citations[0].includes('perio-lecture.pdf'))
}

console.log(
  `assemble.test.ts — ${report.kept} items kept, ${report.droppedUnverified} unverified dropped, all assertions passed`,
)
