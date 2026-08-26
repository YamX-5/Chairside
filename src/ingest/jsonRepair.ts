/**
 * Making a model that can't enforce a schema behave like one that can.
 *
 * Anthropic and Gemini support constrained decoding: you hand them a JSON
 * Schema and malformed output becomes mechanically impossible. DeepSeek's API
 * offers only `json_object` mode — the reply is guaranteed to be valid JSON, but
 * NOT guaranteed to match your schema. Fields go missing, enums get invented,
 * numbers arrive as strings.
 *
 * So the schema has to be enforced on our side: describe it in the prompt, parse
 * with Zod, and on failure send the model its own error and ask again. That loop
 * is the whole difference between "cheap model" and "cheap model that works".
 *
 * Pure and dependency-free so the retry behaviour is testable without a network.
 */

export class SchemaRetryError extends Error {
  // Plain fields rather than constructor parameter properties: the project sets
  // `erasableSyntaxOnly`, which forbids syntax that emits runtime code.
  readonly attempts: number
  readonly lastError: string

  constructor(message: string, attempts: number, lastError: string) {
    super(message)
    this.name = 'SchemaRetryError'
    this.attempts = attempts
    this.lastError = lastError
  }
}

/**
 * The instruction appended to the system prompt for providers without
 * constrained decoding.
 *
 * Stating the schema twice — as prose AND as JSON Schema — measurably helps.
 * Models follow an explicit "no prose, no code fences" instruction far more
 * reliably than they infer it.
 */
export function schemaInstruction(schema: Record<string, unknown>): string {
  return [
    'Reply with a single JSON object and nothing else.',
    'No prose before or after it. No markdown code fences.',
    'It MUST validate against this JSON Schema exactly:',
    '',
    JSON.stringify(schema, null, 2),
    '',
    'Every property listed in "required" must be present.',
    'Every "enum" value must be copied exactly from the list given — never invent one.',
    'Numbers must be JSON numbers, not strings. null means null, not the text "null".',
  ].join('\n')
}

/**
 * The follow-up sent after a reply fails validation.
 *
 * Including the model's OWN previous output matters: without it the model is
 * guessing what it did wrong, and tends to reproduce the same mistake.
 */
export function repairInstruction(previous: string, error: string): string {
  return [
    'Your previous reply did not match the schema.',
    '',
    'You replied:',
    previous.slice(0, 4000),
    '',
    'The validation error was:',
    error,
    '',
    'Reply again with the corrected JSON object only. Fix the error above and change nothing else.',
  ].join('\n')
}

/**
 * Strip the wrappers models add around JSON despite being told not to.
 *
 * Every one of these has been observed in the wild: fenced blocks, a language
 * tag, and a sentence of preamble before the object. Cheaper to handle here
 * than to burn a retry on.
 */
export function extractJson(raw: string): string {
  let text = raw.trim()

  // ```json ... ``` or ``` ... ```
  const fence = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/)
  if (fence) return fence[1].trim()

  // Preamble before the object: take from the first brace to the last.
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first > 0 && last > first) text = text.slice(first, last + 1)

  return text.trim()
}

export interface RetryOptions<T> {
  /** Sends `instruction` and returns the raw reply. */
  call: (instruction: string) => Promise<string>
  /** Throws on invalid input; its message is fed back to the model. */
  parse: (value: unknown) => T
  instruction: string
  maxAttempts?: number
}

/**
 * Call, validate, and on failure show the model its mistake and try again.
 */
export async function generateWithRepair<T>(opts: RetryOptions<T>): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3
  let instruction = opts.instruction
  let lastError = 'none'
  let lastRaw = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastRaw = await opts.call(instruction)

    try {
      return opts.parse(JSON.parse(extractJson(lastRaw)))
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      // Don't build a repair prompt we're never going to send.
      if (attempt < maxAttempts) {
        instruction = repairInstruction(lastRaw, lastError)
      }
    }
  }

  throw new SchemaRetryError(
    `Model failed to produce schema-valid JSON after ${maxAttempts} attempts`,
    maxAttempts,
    lastError,
  )
}
