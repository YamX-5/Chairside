import { z } from 'zod'

/**
 * Wire schemas for the generation calls. These are English-only and flat —
 * deliberately easier for the model to satisfy than the game's own bilingual
 * ClinicDay schema. The pipeline maps them into ClinicDay afterwards, so the
 * model never has to think about the game's data model.
 *
 * Each Zod schema is paired with the JSON Schema sent as `output_config.format`.
 * They must describe the same shape; `assembleDay.test.ts` checks that.
 */

export const BlueprintTopic = z.object({
  id: z.string(),
  title: z.string(),
  /** What the student must be able to DO — drives item cognitive level. */
  objective: z.string(),
  pages: z.array(z.number().int().positive()).min(1),
  itemCount: z.number().int().min(1).max(8),
})
export type BlueprintTopic = z.infer<typeof BlueprintTopic>

export const Blueprint = z.object({
  subject: z.string(),
  title: z.string(),
  /** The clinical standards or sources the deck itself relies on. */
  citations: z.array(z.string()),
  topics: z.array(BlueprintTopic).min(1).max(12),
  caseScenario: z.string(),
})
export type Blueprint = z.infer<typeof Blueprint>

export const BLUEPRINT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', description: 'The academic subject, e.g. "Periodontology"' },
    title: { type: 'string', description: 'Short title for this lecture, 2-5 words' },
    citations: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Guidelines, classifications or textbooks the deck relies on, e.g. "2018 EFP/AAP classification". Empty array if the deck cites none.',
    },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'kebab-case slug' },
          title: { type: 'string' },
          objective: {
            type: 'string',
            description: 'What the student must be able to do, starting with a verb',
          },
          pages: { type: 'array', items: { type: 'integer' } },
          itemCount: {
            type: 'integer',
            description: 'Items this topic deserves, proportional to the deck emphasis',
          },
        },
        required: ['id', 'title', 'objective', 'pages', 'itemCount'],
        additionalProperties: false,
      },
    },
    caseScenario: {
      type: 'string',
      description:
        'The single most clinically consequential scenario in this deck, in 2-3 sentences. Becomes the patient encounter.',
    },
  },
  required: ['subject', 'title', 'citations', 'topics', 'caseScenario'],
  additionalProperties: false,
} as const

const OPTION_FIELDS = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    isCorrect: { type: 'boolean' },
    rationale: {
      type: 'string',
      description:
        'For a wrong option: the reasoning that leads a prepared student here, and precisely what makes it wrong. For the correct option: why it is correct.',
    },
  },
  required: ['text', 'isCorrect', 'rationale'],
  additionalProperties: false,
} as const

export const GeneratedItem = z.object({
  id: z.string(),
  stem: z.string(),
  options: z
    .array(
      z.object({
        text: z.string(),
        isCorrect: z.boolean(),
        rationale: z.string(),
      }),
    )
    .min(3)
    .max(5),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'brutal']),
  cognitive: z.enum(['recall', 'application', 'analysis', 'synthesis']),
  sourcePage: z.number().int().positive(),
  sourceQuote: z.string(),
})
export type GeneratedItem = z.infer<typeof GeneratedItem>

export const TopicItems = z.object({
  teachingChunk: z.string(),
  items: z.array(GeneratedItem).min(1),
})
export type TopicItems = z.infer<typeof TopicItems>

export const TOPIC_ITEMS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    teachingChunk: {
      type: 'string',
      description:
        'The material for this topic rewritten as 3-5 sentences a student reads before the questions. Transformed prose, never a slide dump. No bullet points.',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          stem: {
            type: 'string',
            description:
              'The question. Above recall level, opens with a clinical vignette. Must pass the cover-the-options test.',
          },
          options: { type: 'array', items: OPTION_FIELDS },
          explanation: {
            type: 'string',
            description: 'Why the key is right, written to a student who got it wrong.',
          },
          difficulty: { type: 'string', enum: ['easy', 'moderate', 'hard', 'brutal'] },
          cognitive: {
            type: 'string',
            enum: ['recall', 'application', 'analysis', 'synthesis'],
          },
          sourcePage: { type: 'integer' },
          sourceQuote: {
            type: 'string',
            description: 'A sentence copied VERBATIM from the deck supporting the key.',
          },
        },
        required: [
          'id',
          'stem',
          'options',
          'explanation',
          'difficulty',
          'cognitive',
          'sourcePage',
          'sourceQuote',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['teachingChunk', 'items'],
  additionalProperties: false,
} as const

export const ReviewVerdict = z.object({
  itemId: z.string(),
  verdict: z.enum(['keep', 'revise', 'cut']),
  flaw: z.string(),
  revised: GeneratedItem.nullable(),
})

export const ReviewResult = z.object({
  verdicts: z.array(ReviewVerdict),
})
export type ReviewResult = z.infer<typeof ReviewResult>

export const REVIEW_JSON_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          verdict: { type: 'string', enum: ['keep', 'revise', 'cut'] },
          flaw: {
            type: 'string',
            description:
              'The specific failure mode found, or "none" for a keep. Name the flaw, do not summarise the item.',
          },
          revised: {
            anyOf: [
              TOPIC_ITEMS_JSON_SCHEMA.properties.items.items,
              { type: 'null' },
            ],
            description: 'The corrected item in full when verdict is "revise", otherwise null.',
          },
        },
        required: ['itemId', 'verdict', 'flaw', 'revised'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
} as const

export const GeneratedCase = z.object({
  patientName: z.string(),
  patientAge: z.number().int().positive(),
  avatar: z.string(),
  chiefComplaint: z.string(),
  history: z.string(),
  findings: z.array(z.string()).min(2),
  decisions: z
    .array(
      z.object({
        id: z.string(),
        prompt: z.string(),
        difficulty: z.enum(['easy', 'moderate', 'hard', 'brutal']),
        sourcePage: z.number().int().positive(),
        sourceQuote: z.string(),
        options: z
          .array(
            z.object({
              text: z.string(),
              quality: z.enum(['best', 'acceptable', 'poor']),
              feedback: z.string(),
            }),
          )
          .min(3)
          .max(5),
      }),
    )
    .min(3)
    .max(6),
  outcomeSuccess: z.string(),
  outcomePartial: z.string(),
  outcomeFailure: z.string(),
})
export type GeneratedCase = z.infer<typeof GeneratedCase>

export const CASE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    patientName: { type: 'string', description: 'A plausible name for a patient in Jordan' },
    patientAge: { type: 'integer' },
    avatar: { type: 'string', description: 'A single emoji representing the patient' },
    chiefComplaint: { type: 'string', description: "The patient's own words, in quotes" },
    history: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          prompt: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'moderate', 'hard', 'brutal'] },
          sourcePage: { type: 'integer' },
          sourceQuote: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                quality: { type: 'string', enum: ['best', 'acceptable', 'poor'] },
                feedback: {
                  type: 'string',
                  description:
                    'Written to the student in second person: the consequence for this patient.',
                },
              },
              required: ['text', 'quality', 'feedback'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'prompt', 'difficulty', 'sourcePage', 'sourceQuote', 'options'],
        additionalProperties: false,
      },
    },
    outcomeSuccess: { type: 'string' },
    outcomePartial: { type: 'string' },
    outcomeFailure: { type: 'string' },
  },
  required: [
    'patientName',
    'patientAge',
    'avatar',
    'chiefComplaint',
    'history',
    'findings',
    'decisions',
    'outcomeSuccess',
    'outcomePartial',
    'outcomeFailure',
  ],
  additionalProperties: false,
} as const
