/**
 * Local calendar dates, never UTC.
 *
 * `toISOString()` would break the streak for anyone in Jordan (UTC+3) who
 * finishes a Clinic Day before 03:00 — the day would be filed as yesterday.
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Whole calendar days between two YYYY-MM-DD keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)
  return Math.round(ms / 86_400_000)
}

/**
 * Streak rule: finishing a day on the same date changes nothing; the next
 * calendar day extends the streak; any longer gap resets it to 1.
 */
export function nextStreak(
  currentStreak: number,
  lastPlayedDate: string | null,
  today: string,
): number {
  if (!lastPlayedDate) return 1
  const gap = daysBetween(lastPlayedDate, today)
  if (gap <= 0) return Math.max(currentStreak, 1)
  if (gap === 1) return currentStreak + 1
  return 1
}
