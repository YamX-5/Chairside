import type { BiText } from '../content/schema'

/**
 * The cast, sliced from the character sheets in "designs + characters".
 *
 * Portraits live in public/characters as <id>-<mood>.jpg (256px) plus a
 * <id>-body.jpg full-body. Regenerate them with scripts/slice-characters.ps1.
 */

export type Track = 'dental' | 'medical'
export type Mood = 'calm' | 'anxious' | 'pain' | 'relieved'

export const MOODS: Mood[] = ['calm', 'anxious', 'pain', 'relieved']

/** BASE_URL keeps these correct if the app is ever served from a subpath. */
export function portraitUrl(id: string, mood: Mood = 'calm'): string {
  return `${import.meta.env.BASE_URL}characters/${id}-${mood}.jpg`
}

export function bodyUrl(id: string): string {
  return `${import.meta.env.BASE_URL}characters/${id}-body.jpg`
}

export function sceneUrl(track: Track): string {
  return `${import.meta.env.BASE_URL}characters/scene-${track}.jpg`
}

export interface Doctor {
  id: string
  name: BiText
  track: Track
  /** Shown under the name when picking who you play as. */
  role: BiText
}

/** Playable characters. Choosing one is how the student picks their track. */
export const DOCTORS: Doctor[] = [
  {
    id: 'yaman',
    name: { en: 'Dr. Yaman', ar: 'د. يمان' },
    track: 'dental',
    role: { en: 'Dentist', ar: 'طبيب أسنان' },
  },
  {
    id: 'miya',
    name: { en: 'Dr. Miya', ar: 'د. ميّا' },
    track: 'dental',
    role: { en: 'Dentist', ar: 'طبيبة أسنان' },
  },
  {
    id: 'amr',
    name: { en: 'Dr. Amr', ar: 'د. عمرو' },
    track: 'medical',
    role: { en: 'Physician', ar: 'طبيب' },
  },
  {
    id: 'tala',
    name: { en: 'Dr. Tala', ar: 'د. تالا' },
    track: 'medical',
    role: { en: 'Physician', ar: 'طبيبة' },
  },
]

export function getDoctor(id: string): Doctor | undefined {
  return DOCTORS.find((d) => d.id === id)
}

export interface CastPatient {
  id: string
  name: BiText
  age: number
  /** The mood their sheet leads with — telegraphs the case before it opens. */
  defaultMood: Mood
  /** One line of who they are, shown in the waiting area. */
  blurb: BiText
}

/**
 * Patients, mapped to the sheets by their artwork (verified against
 * CHARACTER_SHEETS.md — the file order does not match the doc's P-numbers).
 */
export const PATIENTS: CastPatient[] = [
  {
    id: 'patient-1',
    name: { en: 'Layla', ar: 'ليلى' },
    age: 24,
    defaultMood: 'anxious',
    blurb: { en: 'Dental anxiety — has put this off for two years.', ar: 'قلق من طبيب الأسنان — أجّلت الزيارة سنتين.' },
  },
  {
    id: 'patient-2',
    name: { en: 'Omar', ar: 'عمر' },
    age: 8,
    defaultMood: 'anxious',
    blurb: { en: 'First filling. Brought his dinosaur for courage.', ar: 'أول حشوة. أحضر ديناصوره للشجاعة.' },
  },
  {
    id: 'patient-3',
    name: { en: 'Abu Khaled', ar: 'أبو خالد' },
    age: 68,
    defaultMood: 'calm',
    blurb: { en: 'Missing teeth; asking about dentures.', ar: 'فقدان أسنان؛ يسأل عن أطقم الأسنان.' },
  },
  {
    id: 'patient-4',
    name: { en: 'Yousef', ar: 'يوسف' },
    age: 45,
    defaultMood: 'pain',
    blurb: { en: 'Severe toothache, three nights without sleep.', ar: 'ألم شديد، ثلاث ليالٍ بلا نوم.' },
  },
  {
    id: 'patient-5',
    name: { en: 'Khala Nadia', ar: 'خالة نادية' },
    age: 55,
    defaultMood: 'calm',
    blurb: { en: 'Bleeding gums whenever she brushes.', ar: 'نزف لثوي كلما نظّفت أسنانها.' },
  },
  {
    id: 'patient-6',
    name: { en: 'Rami', ar: 'رامي' },
    age: 19,
    defaultMood: 'anxious',
    blurb: { en: 'Braces review. Talks with his hand over his mouth.', ar: 'مراجعة تقويم. يتحدث ويده على فمه.' },
  },
  {
    id: 'patient-7',
    name: { en: 'Sara', ar: 'سارة' },
    age: 31,
    defaultMood: 'calm',
    blurb: { en: 'Wants whitening before her sister’s wedding.', ar: 'تريد تبييضاً قبل عرس أختها.' },
  },
  {
    id: 'patient-8',
    name: { en: 'Mr. Haddad', ar: 'السيد حداد' },
    age: 50,
    defaultMood: 'anxious',
    blurb: { en: 'Cracked a tooth. Checks his watch every minute.', ar: 'كسر سناً. ينظر إلى ساعته كل دقيقة.' },
  },
]

export function getPatient(id: string): CastPatient | undefined {
  return PATIENTS.find((p) => p.id === id)
}

function hashOf(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Deterministic patient pick, so the same clinic day always seats the same
 * person — a patient who changes identity on reload breaks the fiction.
 */
export function patientForDay(dayId: string): CastPatient {
  return PATIENTS[hashOf(dayId) % PATIENTS.length]
}

/**
 * The face for a written case. Age is a clinical fact, not decoration: a
 * paediatric face on a Stage III periodontitis case teaches the wrong thing, so
 * the pick is restricted to the faces within a decade of the case's stated age
 * (widening only if nothing is close) and the hash only breaks the tie.
 */
export function patientForCase(dayId: string, age: number): CastPatient {
  const near = (window: number) =>
    PATIENTS.filter((p) => Math.abs(p.age - age) <= window)
  const pool = near(10).length ? near(10) : near(20).length ? near(20) : PATIENTS
  return pool[hashOf(dayId) % pool.length]
}
