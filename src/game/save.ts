import { z } from 'zod'
import { localDateKey, nextStreak } from './dates'

const STORAGE_KEY = 'clinic.save.v1'
const SAVE_VERSION = 1

const DayRecordSchema = z.object({
  dayId: z.string(),
  score: z.number().int().min(0).max(1_000_000),
  stars: z.number().int().min(0).max(3),
  completedOn: z.string(), // local YYYY-MM-DD
})

const SaveSchema = z.object({
  saveVersion: z.number().int(),
  coins: z.number().int().min(0).max(100_000_000),
  streak: z.number().int().min(0).max(100_000),
  lastPlayedDate: z.string().nullable(),
  completed: z.array(DayRecordSchema),
  upgrades: z.array(z.string()),
  locale: z.enum(['en', 'ar']),
})

export type DayRecord = z.infer<typeof DayRecordSchema>
export type SaveData = z.infer<typeof SaveSchema>

export const EMPTY_SAVE: SaveData = {
  saveVersion: SAVE_VERSION,
  coins: 0,
  streak: 0,
  lastPlayedDate: null,
  completed: [],
  upgrades: [],
  locale: 'en',
}

/**
 * A corrupt save must cost the player their progress, never the app: an
 * unvalidated shape here throws on every render and leaves a blank screen
 * with no way back.
 */
export function migrate(raw: unknown): SaveData {
  const parsed = SaveSchema.safeParse({ ...EMPTY_SAVE, ...(raw as object) })
  if (!parsed.success) return EMPTY_SAVE
  return { ...parsed.data, saveVersion: SAVE_VERSION }
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_SAVE
    return migrate(JSON.parse(raw))
  } catch {
    return EMPTY_SAVE
  }
}

/**
 * The locale is owned by LocaleProvider, which writes it independently — so
 * every other write must re-read it rather than persist its own stale copy,
 * or finishing a day silently flips the app back to English.
 */
export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Private-mode / quota failures must never break the game loop.
  }
}

export function writeProgress(data: SaveData): void {
  writeSave({ ...data, locale: loadSave().locale })
}

/** Pure: apply a finished Clinic Day to a save. Tested in save.test.ts. */
export function applyDayCompletion(
  save: SaveData,
  record: Omit<DayRecord, 'completedOn'>,
  today: string = localDateKey(),
  coins = 0,
): SaveData {
  const completedOn = today
  const previous = save.completed.filter((c) => c.dayId !== record.dayId)
  const best = save.completed.find((c) => c.dayId === record.dayId)

  return {
    ...save,
    coins: save.coins + coins,
    streak: nextStreak(save.streak, save.lastPlayedDate, completedOn),
    lastPlayedDate: completedOn,
    completed: [
      ...previous,
      {
        ...record,
        score: Math.max(record.score, best?.score ?? 0),
        stars: Math.max(record.stars, best?.stars ?? 0),
        completedOn,
      },
    ],
  }
}
