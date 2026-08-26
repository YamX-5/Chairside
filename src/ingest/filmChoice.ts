import { z } from 'zod'
import { generate } from './client'
import type { Deck } from './pdf'

/**
 * Picking which radiograph the case is built around — BEFORE the case is written.
 *
 * The old order was: generate a case, then hunt for an image. That fails, because
 * a model asked to invent a case will invent pathology no photograph in the deck
 * shows, and then there is nothing to display. Reversing it makes every case
 * bindable by construction: choose a real film first, write the case around the
 * finding that is actually in it.
 *
 * The model cannot see pixels. What it CAN see is which page each film sits on,
 * and the slide text on that page is what describes it — "Fig 3. Periapical
 * radiolucency associated with tooth 46". So the page number is the join key
 * between an image and its meaning, exactly the way the FDI tooth number is the
 * join key between the channels.
 */

/**
 * Deliberately decoupled from pdfImages' browser `Candidate`: this module runs
 * in the pipeline and must not drag pdfjs (and therefore DOMMatrix) into a Node
 * process. The caller maps one to the other.
 */
export interface FilmCandidate {
  page: number
  width: number
  height: number
  /** The answer may be burned into the picture. Advisory, see radiographDetect. */
  annotated: boolean
}

export const FilmChoice = z.object({
  /** Page of the chosen film, or null if none is usable. */
  page: z.number().int().positive().nullable(),
  /** What the slide text says this film shows. Drives the generated case. */
  shows: z.string(),
  /** The FDI tooth the slide names, when it names one. */
  toothFDI: z.string().nullable(),
  reasoning: z.string(),
})
export type FilmChoice = z.infer<typeof FilmChoice>

export const FILM_CHOICE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    page: {
      type: ['integer', 'null'],
      description:
        'Page number of the film to build the case around. null if no listed film has a slide describing a finding worth a case.',
    },
    shows: {
      type: 'string',
      description:
        'The radiographic finding this film demonstrates, in the deck\'s own terms. Empty string if page is null.',
    },
    toothFDI: {
      type: ['string', 'null'],
      description:
        'The FDI tooth number the slide text names, e.g. "46". null if the slide does not name one.',
    },
    reasoning: {
      type: 'string',
      description: 'Why this film, or why none of them.',
    },
  },
  required: ['page', 'shows', 'toothFDI', 'reasoning'],
  additionalProperties: false,
} as const

/**
 * The catalogue shown to the model: every candidate film with the words printed
 * on its own slide.
 *
 * Pure and exported so it can be tested without a network call — the format is
 * load-bearing, since a model that cannot tell the films apart picks the first.
 */
export function describeFilmBank(
  deck: Deck,
  films: FilmCandidate[],
  opts: { maxChars?: number } = {},
): string {
  const maxChars = opts.maxChars ?? 700
  if (films.length === 0) return 'No radiographs were found in this deck.'

  const byPage = new Map(deck.pages.map((p) => [p.page, p.text]))

  return films
    .map((f) => {
      const text = (byPage.get(f.page) ?? '').slice(0, maxChars)
      const flags = f.annotated ? ' [WARNING: may have the answer drawn on it]' : ''
      return [
        `FILM on page ${f.page} (${f.width}x${f.height})${flags}`,
        `Slide text: ${text || '(this slide has no text)'}`,
      ].join('\n')
    })
    .join('\n\n')
}

/** Resolve the model's chosen page back to a candidate. */
export function resolveFilm(films: FilmCandidate[], page: number | null): FilmCandidate | null {
  if (page === null) return null
  return films.find((f) => f.page === page) ?? null
}

export const FILM_SYSTEM = `
You are choosing which radiograph a clinical case will be built around.

You cannot see the images. You are given a list of films found in the lecture,
each with the page it appears on and the text printed on that slide. The slide
text is your only evidence of what a film shows — a slide reading "Fig 4.
Periapical radiolucency at the apex of 46" tells you exactly what that film is,
while a slide reading "Radiographic interpretation" tells you nothing usable.

Choose the film whose slide describes a SPECIFIC, NAMED radiographic finding
that a student could be asked to identify. Prefer a slide that names the tooth.

Return null for the page when no film qualifies. That is a normal outcome, not
a failure — many lectures contain only decorative or unlabelled images, and a
case built on a film you cannot describe is a case with a picture nobody can
reason about. Guessing is worse than declining.

Never infer a finding the slide text does not state. If the slide says only
"periapical radiograph", you do not know what is wrong with it.
`.trim()

/**
 * Ask the model which film to build the case around.
 *
 * `deckContext` is passed through as the cached prefix so this call costs
 * cache-read rates rather than a second full-deck read.
 */
export async function chooseFilm(args: {
  deck: Deck
  films: FilmCandidate[]
  deckContext: string
}): Promise<FilmChoice> {
  const { deck, films, deckContext } = args

  if (films.length === 0) {
    return {
      page: null,
      shows: '',
      toothFDI: null,
      reasoning: 'No radiographs were extracted from this deck.',
    }
  }

  const choice = await generate({
    system: FILM_SYSTEM,
    cachedContext: deckContext,
    instruction: [
      'These are the radiographs found in this deck. Choose the one to build the case around.',
      '',
      describeFilmBank(deck, films),
    ].join('\n'),
    schema: FILM_CHOICE_JSON_SCHEMA,
    effort: 'high',
    parse: (raw) => FilmChoice.parse(raw),
  })

  // A page the model invented is worse than no film: it would bind the case to
  // an image that does not exist.
  if (choice.page !== null && !films.some((f) => f.page === choice.page)) {
    return {
      page: null,
      shows: '',
      toothFDI: null,
      reasoning: `Model chose page ${choice.page}, which holds no extracted film. Falling back to no film.`,
    }
  }

  return choice
}

/**
 * The instruction fragment that ties the generated case to the chosen film.
 *
 * Pure, so the wording is testable — this is the sentence that decides whether
 * the case matches the picture, and silent drift here produces cases whose
 * radiograph shows something else entirely.
 */
export function filmInstruction(choice: FilmChoice): string {
  if (choice.page === null) {
    return [
      'No radiograph is available for this case.',
      'Do NOT describe a radiographic finding as something the student can see.',
      'Any imaging information must be given as a written report, not as an image.',
    ].join('\n')
  }

  return [
    `This case is built around a real radiograph from page ${choice.page} of the deck.`,
    `That film shows: ${choice.shows}`,
    choice.toothFDI ? `The tooth involved is ${choice.toothFDI}.` : '',
    '',
    'The case MUST be consistent with that film. Do not invent additional',
    'radiographic findings the student would have to see in the image — the',
    'student is looking at this exact picture, and anything you add will not be',
    'there.',
  ]
    .filter(Boolean)
    .join('\n')
}
