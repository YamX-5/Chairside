import { z } from 'zod'

/**
 * Who is playing: their name, the character they chose, and therefore which
 * track (dental or medicine) and subject they are studying.
 *
 * Kept separate from the progress save so signing in as someone else, or
 * switching subject, never risks the streak and coin data.
 */

const STORAGE_KEY = 'clinic.profile.v1'

const ProfileSchema = z.object({
  version: z.literal(1),
  displayName: z.string().min(1).max(40),
  /** A doctor id from cast.ts — the character the student plays as. */
  doctorId: z.string().min(1),
  track: z.enum(['dental', 'medical']),
  /** Chosen subject, matched against ClinicDay.subject.en. Null = all. */
  subject: z.string().nullable(),
  createdOn: z.string(),
})

export type Profile = z.infer<typeof ProfileSchema>

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = ProfileSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Private mode — the session still works, it just won't be remembered.
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore.
  }
}
