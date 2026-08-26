import type { CaseCore, Consequence, ErrorClass, Fact } from './channels'

/**
 * A hand-written case used by the split and verifier tests.
 *
 * Test-only — nothing in the app imports this. It exists so the split tests and
 * the verifier tests reason about the SAME case; two near-identical fixtures
 * drift, and then a test passes for a reason that no longer holds.
 *
 * The case: reversible pulpitis on tooth 46, manageable with a pulp cap. Chosen
 * because it exercises every error class cleanly, and because the patient is on
 * warfarin — which contraindicates extraction, lives in RECORDS, and therefore
 * makes "the team extracted" literal proof that somebody didn't share.
 */

export function fact(over: Partial<Fact> & Pick<Fact, 'id' | 'channel'>): Fact {
  // Defaults derive from the id so no two facts share a string. Identical
  // placeholder text across facts makes a leak test lie in both directions: it
  // false-positives when a seat legitimately holds one of the twins, and it
  // would mask a real leak of the other.
  return {
    tooth: null,
    category: `category for ${over.id}`,
    label: `label for ${over.id}`,
    value: `value for ${over.id}`,
    loadBearing: false,
    sourcePage: 4,
    sourceQuote: `Source sentence supporting ${over.id}.`,
    ...over,
  }
}

export const FACTS: Fact[] = [
  fact({
    id: 'f-warfarin',
    channel: 'RECORDS',
    category: 'medical history',
    label: 'anticoagulant therapy',
    value: 'Patient takes warfarin 5 mg daily; INR last checked 2.8',
    loadBearing: true,
    sourcePage: 9,
    sourceQuote: 'Anticoagulant therapy contraindicates elective extraction without INR review.',
  }),
  fact({
    id: 'f-cold-pain',
    channel: 'RECORDS',
    tooth: '46',
    category: 'symptom',
    label: 'provoked pain, rapid resolution',
    value: 'Sharp pain to cold, settles within ten seconds of stimulus removal',
    loadBearing: true,
    sourcePage: 5,
    sourceQuote:
      'Pain that resolves within seconds of stimulus removal suggests reversible pulpitis.',
  }),
  fact({
    id: 'f-no-percussion',
    channel: 'RECORDS',
    tooth: '46',
    category: 'examination',
    label: 'percussion negative',
    value: 'No tenderness to percussion',
  }),
  fact({
    id: 'f-caries-depth',
    channel: 'IMAGING',
    tooth: '46',
    category: 'radiographic finding',
    label: 'caries approximating pulp',
    value: 'Occlusal caries into inner dentine, not breaching the pulp chamber',
    loadBearing: true,
    sourcePage: 7,
    sourceQuote: 'Caries confined to dentine without pulpal exposure supports vital pulp therapy.',
  }),
  fact({
    id: 'f-no-periapical',
    channel: 'IMAGING',
    tooth: '46',
    category: 'radiographic finding',
    label: 'no periapical radiolucency',
    value: 'Periapical tissues normal; no radiolucency at either root apex',
    loadBearing: true,
    sourcePage: 7,
    sourceQuote:
      'Absence of periapical radiolucency argues against irreversible pulpal necrosis.',
  }),
  fact({
    id: 'f-lamina',
    channel: 'IMAGING',
    tooth: '46',
    category: 'radiographic finding',
    label: 'lamina dura intact',
    value: 'Lamina dura continuous',
  }),
  fact({
    id: 'f-rule-reversible',
    channel: 'PROTOCOL',
    category: 'decision rule',
    label: 'reversible vs irreversible pulpitis',
    value:
      'IF pain resolves within seconds of stimulus removal AND no periapical radiolucency THEN reversible pulpitis; manage with caries removal and vital pulp therapy',
    loadBearing: true,
    sourcePage: 12,
    sourceQuote: 'Reversible pulpitis is managed by removing the irritant and protecting the pulp.',
  }),
  fact({
    id: 'f-rule-anticoag',
    channel: 'PROTOCOL',
    category: 'decision rule',
    label: 'anticoagulant precaution',
    value: 'IF patient is anticoagulated THEN defer elective extraction pending INR review',
    loadBearing: true,
    sourcePage: 14,
    sourceQuote: 'Defer elective surgical procedures in anticoagulated patients pending INR review.',
  }),

  // --- distractors ---------------------------------------------------------
  // Findings for teeth that are NOT the answer. Without these, holding the chart
  // or the radiographs tells you which tooth matters, nobody has to ask CHAIR,
  // and the case stops being a hidden-information case. auditSplit enforces this.
  fact({
    id: 'f-perio-36',
    channel: 'RECORDS',
    tooth: '36',
    category: 'examination',
    label: 'probing depths within normal limits',
    value: 'Probing depths 2-3 mm circumferentially, no bleeding on probing',
  }),
  fact({
    id: 'f-restored-16',
    channel: 'RECORDS',
    tooth: '16',
    category: 'dental history',
    label: 'existing restoration',
    value: 'Amalgam restoration placed four years ago, asymptomatic',
  }),
  fact({
    id: 'f-img-36',
    channel: 'IMAGING',
    tooth: '36',
    category: 'radiographic finding',
    label: 'no pathology',
    value: 'Bone levels normal, no caries, periapical tissues unremarkable',
  }),
  fact({
    id: 'f-img-16',
    channel: 'IMAGING',
    tooth: '16',
    category: 'radiographic finding',
    label: 'restoration well adapted',
    value: 'Restoration margins well adapted, no recurrent caries',
  }),
]

export function consequence(over: Partial<Consequence> = {}): Consequence {
  return {
    primitive: 'generic_flinch',
    intensity: 'moderate',
    targetTooth: '46',
    delayMs: 200,
    chainsTo: null,
    clinicalRationale:
      'Cutting into a vital pulp without adequate anaesthesia provokes sharp pain on tooth 46.',
    teachesFact: 'Vital pulp is exquisitely sensitive; confirm anaesthesia before entering dentine.',
    ...over,
  }
}

export const CONSEQUENCES = {
  A_WRONG_DX_RIGHT_SITE: consequence({ primitive: 'patient_wince_vocal' }),
  B_RIGHT_DX_WRONG_SITE: consequence({ primitive: 'patient_flinch', targetTooth: '47' }),
  C_CONTRAINDICATION_IGNORED: consequence({
    primitive: 'patient_bleed',
    intensity: 'severe',
    chainsTo: 'waiting_room_unrest',
    clinicalRationale:
      'Extracting tooth 46 in a patient anticoagulated on warfarin produces prolonged bleeding from the socket.',
    teachesFact: 'Review INR before elective extraction in anticoagulated patients.',
  }),
  D_WRONG_INSTRUMENT: consequence({ primitive: 'tray_erupts' }),
  E_IRREVERSIBLE_ON_REVERSIBLE: consequence({
    primitive: 'patient_scream',
    intensity: 'severe',
    clinicalRationale:
      'Opening tooth 46 for root canal treatment destroys a pulp that was still vital and salvageable.',
    teachesFact:
      'Reversible pulpitis is treated by removing the irritant, not by extirpating the pulp.',
  }),
  F_CORRECT: consequence({
    primitive: 'procedure_success',
    intensity: 'minor',
    clinicalRationale:
      'Caries removal and a protective liner on tooth 46 resolve the stimulus and allow the pulp to recover.',
    teachesFact: 'Removing the irritant lets a reversibly inflamed pulp heal.',
  }),
} as Record<ErrorClass, Consequence>

export const CORE: CaseCore = {
  id: 'case-perio-1',
  lectureHash: 'sha256:test',
  title: { en: 'The tooth that hurts to cold', ar: 'السن الذي يؤلم مع البرودة' },
  groundTruth: {
    diagnosisId: 'd-reversible-pulpitis',
    siteFDI: '46',
    correctProcedureId: 'p-pulp-cap',
    contraindications: [{ factId: 'f-warfarin', blocksProcedureIds: ['p-extraction'] }],
    reversible: true,
  },
  facts: FACTS,
  obligations: [
    {
      channel: 'RECORDS',
      prompt: 'Confirm which tooth is affected before checking anticoagulant risk',
      resolvableFrom: ['CHAIR'],
      satisfiedByFactIds: ['f-warfarin'],
    },
    {
      channel: 'PROTOCOL',
      prompt: 'Determine whether the pulpal inflammation is reversible',
      resolvableFrom: ['RECORDS', 'IMAGING'],
      satisfiedByFactIds: ['f-cold-pain', 'f-no-periapical'],
    },
  ],
  options: {
    diagnoses: [
      { id: 'd-reversible-pulpitis', en: 'Reversible pulpitis' },
      { id: 'd-irreversible-pulpitis', en: 'Irreversible pulpitis' },
      { id: 'd-periapical-abscess', en: 'Acute periapical abscess' },
      { id: 'd-cracked-tooth', en: 'Cracked tooth syndrome' },
      { id: 'd-hypersensitivity', en: 'Dentine hypersensitivity' },
    ],
    procedures: [
      { id: 'p-pulp-cap', en: 'Caries removal and indirect pulp cap', irreversible: false },
      { id: 'p-restoration', en: 'Restoration alone', irreversible: false },
      { id: 'p-monitor', en: 'Review in two weeks', irreversible: false },
      { id: 'p-rct', en: 'Root canal treatment', irreversible: true },
      { id: 'p-extraction', en: 'Extraction', irreversible: true },
    ],
  },
  commitGate: {
    unlocksProcedures: {
      'd-reversible-pulpitis': ['p-pulp-cap', 'p-restoration', 'p-monitor'],
      'd-irreversible-pulpitis': ['p-rct', 'p-extraction'],
    },
  },
  consequences: CONSEQUENCES,
  debrief: {
    causalChain: {
      en: 'Pain resolving in seconds plus no periapical radiolucency means the pulp was still vital.',
    },
    takeawayCard: {
      front: { en: 'Pain to cold that settles in seconds — reversible or irreversible pulpitis?' },
      back: { en: 'Reversible. Lingering pain beyond ~30 seconds suggests irreversible.' },
      sourcePage: 5,
    },
    patientPerspective: {
      success: { en: 'He came in worried about losing the tooth. He kept it.' },
      failure: {
        en: 'He came in with a tooth that could have been saved. He went home without it.',
      },
    },
  },
}
