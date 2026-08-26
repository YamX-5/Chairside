import Anthropic from '@anthropic-ai/sdk'
import { generateWithRepair, schemaInstruction } from './jsonRepair'

/**
 * One generation call, two providers.
 *
 * DeepSeek is the default because it is dramatically cheaper per lecture and its
 * context caching is automatic — which matters more here than anywhere else,
 * since the whole deck is re-sent as the prefix of every call in a run.
 * Anthropic stays available as the quality tier.
 *
 * The important difference is not price, it is SCHEMA ENFORCEMENT:
 *
 *   Anthropic  `output_config.format` constrains decoding. Malformed output is
 *              mechanically impossible.
 *   DeepSeek   `response_format: json_object` guarantees valid JSON but NOT a
 *              matching schema. Fields go missing and enums get invented.
 *
 * So on DeepSeek the schema is enforced on our side by jsonRepair: describe it
 * in the prompt, validate with Zod, and on failure show the model its own error
 * and ask again. Callers see one identical `generate()` either way.
 */

const KEY_STORAGE = 'clinic.apiKey.v1'
const PROVIDER_STORAGE = 'clinic.provider.v1'

export type Provider = 'deepseek' | 'anthropic'

export const MODELS: Record<Provider, string> = {
  // deepseek-chat is the non-reasoning model: far fewer output tokens, and this
  // pipeline already gets its "thinking" from a separate review-committee pass.
  deepseek: 'deepseek-chat',
  // Haiku, NOT Opus.
  //
  // This used to be Opus at $5/$25 per Mtok, which made the comparison
  // meaningless — the cheapest model on the market against the most expensive
  // one. Haiku 4.5 is $1/$5, roughly a fifth the cost, and it still gives
  // constrained decoding, so jsonRepair never has to run and item quality does
  // not take the "format tax" that hits weaker models hardest on exactly this
  // pipeline's hardest, most-constrained call.
  anthropic: 'claude-haiku-4-5-20251001',
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic (Claude)',
}

export const KEY_HINT: Record<Provider, string> = {
  deepseek: 'sk-…',
  anthropic: 'sk-ant-…',
}

export function getProvider(): Provider {
  try {
    const v = localStorage.getItem(PROVIDER_STORAGE)
    return v === 'anthropic' ? 'anthropic' : 'deepseek'
  } catch {
    return 'deepseek'
  }
}

export function setProvider(p: Provider): void {
  try {
    localStorage.setItem(PROVIDER_STORAGE, p)
  } catch {
    // Private mode — the choice just won't persist.
  }
}

/** Keys are stored per provider so switching back and forth doesn't lose one. */
function keyStorageFor(p: Provider): string {
  return `${KEY_STORAGE}.${p}`
}

export function getApiKey(provider: Provider = getProvider()): string | null {
  try {
    return localStorage.getItem(keyStorageFor(provider))
  } catch {
    return null
  }
}

export function setApiKey(key: string, provider: Provider = getProvider()): void {
  try {
    if (key) localStorage.setItem(keyStorageFor(provider), key)
    else localStorage.removeItem(keyStorageFor(provider))
  } catch {
    // Private mode — the key just won't persist between sessions.
  }
}

/**
 * The model the current provider will use. Stamped onto generated content.
 *
 * A function, not a const: a const is evaluated once at import, so switching
 * provider mid-session would keep stamping the old model's name onto output
 * that a different model actually wrote.
 */
export function currentModel(): string {
  return MODELS[getProvider()]
}

export interface GenerateOptions<T> {
  system: string
  /**
   * Deck text placed first so it is the cached prefix. Anthropic needs an
   * explicit cache_control marker; DeepSeek matches prefixes automatically, so
   * the same ordering earns the discount on both.
   */
  cachedContext: string
  /** The per-call instruction. Must come after the cached prefix. */
  instruction: string
  schema: Record<string, unknown>
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  maxTokens?: number
  parse: (raw: unknown) => T
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

/**
 * The key lives in this browser and is sent straight to the provider from the
 * page. Acceptable for a personal tool where the user supplies their own key;
 * NOT acceptable once published, because any script on the page can read it.
 * Shipping publicly means routing these calls through a small server.
 */
async function generateAnthropic<T>(opts: GenerateOptions<T>): Promise<T> {
  const apiKey = getApiKey('anthropic')
  if (!apiKey) throw new Error('NO_API_KEY')
  const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const stream = anthropic.messages.stream({
    model: MODELS.anthropic,
    max_tokens: opts.maxTokens ?? 32000,
    thinking: { type: 'adaptive' },
    output_config: {
      // Haiku rejects `effort` outright, so it is only sent on models that take
      // it. `format` is the part that matters here anyway: it compiles the JSON
      // Schema into a decoding grammar, which is why the DeepSeek repair loop
      // has no equivalent on this path.
      ...(MODELS.anthropic.includes('haiku') ? {} : { effort: opts.effort ?? 'high' }),
      format: { type: 'json_schema', schema: opts.schema },
    },
    system: [
      { type: 'text', text: opts.system },
      {
        type: 'text',
        text: opts.cachedContext,
        // 1h, not the 5-minute default. A run is 18 calls at concurrency 3 and
        // routinely outlives 5 minutes — the cache would expire mid-run and
        // every later call would silently pay the full uncached input price.
        // The 1h write costs 2x instead of 1.25x, and is paid once.
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: [{ role: 'user', content: opts.instruction }],
  })

  const message = await stream.finalMessage()

  if (message.stop_reason === 'refusal') throw new Error('The model declined this request.')
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Output was cut off — try a smaller page range.')
  }

  const text = message.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('No content returned.')

  return opts.parse(JSON.parse(text.text))
}

// ---------------------------------------------------------------------------
// DeepSeek (OpenAI-compatible; plain fetch, no SDK, no extra dependency)
// ---------------------------------------------------------------------------

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

async function callDeepSeek(
  apiKey: string,
  system: string,
  instruction: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELS.deepseek,
      max_tokens: maxTokens,
      // Low temperature: this is extraction and structured writing, not prose.
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: instruction },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 401) throw new Error('NO_API_KEY')
    if (res.status === 402) throw new Error('DeepSeek account has no credit remaining.')
    if (res.status === 429) throw new Error('Rate limited — wait a moment and try again.')
    throw new Error(`DeepSeek error ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[]
  }
  const choice = json.choices?.[0]
  if (choice?.finish_reason === 'length') {
    throw new Error('Output was cut off — try a smaller page range.')
  }
  const content = choice?.message?.content
  if (!content) throw new Error('No content returned.')
  return content
}

async function generateDeepSeek<T>(opts: GenerateOptions<T>): Promise<T> {
  const apiKey = getApiKey('deepseek')
  if (!apiKey) throw new Error('NO_API_KEY')

  // Deck FIRST so it is the cached prefix — DeepSeek matches prefixes
  // automatically, and cache hits are roughly a tenth the price of a miss.
  // Putting the (short, varying) schema text ahead of it would break every
  // single cache hit for the whole run.
  const system = [opts.cachedContext, opts.system, schemaInstruction(opts.schema)].join('\n\n')

  return generateWithRepair({
    call: (instruction) => callDeepSeek(apiKey, system, instruction, opts.maxTokens ?? 8000),
    parse: opts.parse,
    instruction: opts.instruction,
    maxAttempts: 3,
  })
}

// ---------------------------------------------------------------------------

/** One structured-output call, whichever provider is selected. */
export async function generate<T>(opts: GenerateOptions<T>): Promise<T> {
  return getProvider() === 'anthropic' ? generateAnthropic(opts) : generateDeepSeek(opts)
}
