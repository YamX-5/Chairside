import { parseClinicDay, type ClinicDay } from './schema'
import { perioStaging } from './days/perio-staging'
import { medAnaphylaxis } from './days/med-anaphylaxis'

/**
 * The content registry. In Phase 2 this is where LLM-generated days land
 * (parsed through the same `parseClinicDay` gate — no content skips validation).
 */
const RAW_DAYS: unknown[] = [perioStaging, medAnaphylaxis]

export const ALL_DAYS: ClinicDay[] = RAW_DAYS.map(parseClinicDay)

export function getDay(id: string): ClinicDay | undefined {
  return ALL_DAYS.find((d) => d.id === id)
}
