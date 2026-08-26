import { parseClinicDay, type ClinicDay } from './schema'

const STORAGE_KEY = 'clinic.library.v1'

/**
 * Generated clinic days, stored in this browser. They pass through the same
 * `parseClinicDay` gate on the way in AND on the way out — a save file edited
 * by hand, or written by an older version of the pipeline, must not be able to
 * crash the game.
 */
export function loadLibrary(): ClinicDay[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const days: ClinicDay[] = []
    for (const entry of parsed) {
      try {
        days.push(parseClinicDay(entry))
      } catch {
        // Skip the unreadable day rather than losing the whole library.
      }
    }
    return days
  } catch {
    return []
  }
}

export function saveToLibrary(day: ClinicDay): ClinicDay[] {
  const existing = loadLibrary().filter((d) => d.id !== day.id)
  const next = [...existing, day]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Quota exceeded — the day stays playable this session but won't persist.
  }
  return next
}

export function removeFromLibrary(dayId: string): ClinicDay[] {
  const next = loadLibrary().filter((d) => d.id !== dayId)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore — see above.
  }
  return next
}
