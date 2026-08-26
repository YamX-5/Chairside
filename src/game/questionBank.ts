import type { BiText, ClinicDay } from '../content/schema'

/**
 * Every question in a Clinic Day, flattened.
 *
 * DERIVED, never stored alongside the day — one source of truth, and one less
 * thing for the generator to keep consistent.
 *
 * Nothing in the UI consumes this yet: it exists as the substrate for the
 * RECALL / CLEAR queue (flagged and missed items returning as quick-fire active
 * recall), which is the next feature in the loop. `seededShuffle` below is used
 * today by both the PREP and TREAT screens to shuffle answer order.
 */
export interface BankQuestion {
  id: string
  prompt: BiText
  options: { id: string; label: BiText; isCorrect: boolean }[]
  explanation: BiText
}

export function buildQuestionBank(days: ClinicDay[]): BankQuestion[] {
  const out: BankQuestion[] = []

  for (const day of days) {
    for (const chunk of day.prep.chunks) {
      out.push({
        id: `${day.id}:${chunk.question.id}`,
        prompt: chunk.question.prompt,
        options: chunk.question.options,
        explanation: chunk.question.explanation,
      })
    }

    for (const c of day.treat.cases) {
      for (const d of c.decisions) {
        out.push({
          id: `${day.id}:${c.id}:${d.id}`,
          prompt: d.prompt,
          options: d.options.map((o) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.quality === 'best',
          })),
          explanation: d.options.find((o) => o.quality === 'best')!.feedback,
        })
      }
    }
  }

  return out
}

/** Deterministic shuffle so a given seed always produces the same run. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items]
  let s = seed || 1
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648
    const j = Math.abs(s) % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
