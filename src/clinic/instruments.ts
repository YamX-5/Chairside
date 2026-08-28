/**
 * The instrument set — what is on the tray, and which one each procedure needs.
 *
 * This is what makes "wrong instrument" a real, gradeable mistake instead of a
 * label. `classify()` already has an error class for it (D_WRONG_INSTRUMENT);
 * until now nothing could ever produce one, because the player never touched a
 * tool. Committing a plan on paper and then never doing anything to the patient
 * is why the clinic did not feel like a game.
 *
 * Pure data, no three.js — so the mapping is testable headless.
 */

export type InstrumentId =
  | 'mirror'
  | 'probe'
  | 'perioProbe'
  | 'handpiece'
  | 'syringe'
  | 'forceps'
  | 'scaler'
  | 'suction'
  | 'axe'
  | 'xray'

/** Where an instrument lives when the room is at rest. */
export type Storage =
  /** Laid out on the delivery tray, in reach and in view. */
  | 'tray'
  /** Behind the cabinet door. Has to be opened before it can be taken. */
  | 'closet'
  /**
   * In a drawer under the sterilising bench, which is where clinical kit
   * actually lives between cases.
   *
   * The glass cabinet had been doing this job, which put the periodontal probe
   * on the same shelf as the axe — a joke item and three real instruments
   * behind one door. Separating them means the cabinet can be what it is for:
   * one deliberate, slightly ridiculous decision.
   */
  | 'drawer'
  /**
   * Hanging on the dental unit's own delivery bar, where it is modelled.
   *
   * The unit ships its handpieces as real geometry (Object_15) and the code used
   * to lay ANOTHER handpiece on the bracket tray beside them — two of the same
   * tool, one of them fake. That is the "there are handpieces above the
   * handpieces" report. Taking it off the unit is the real thing.
   */
  | 'unit'
  /**
   * Standing on the wall shelf by the door, on its charging cradle.
   *
   * A portable X-ray is not tray kit and it is not locked away -- it sits out
   * in the open on its dock, and you cross the room to fetch it. That walk is
   * the point: taking a radiograph should feel like a decision with a cost,
   * not a button next to the mirror.
   */
  | 'shelf'

export interface Instrument {
  id: InstrumentId
  /**
   * Stable node name. For tray and cabinet kit this must match a node in
   * instruments.glb exactly, as built by build_instruments.py. For an
   * instrument that ships its own `model`, it is just the unique id under
   * which the loaded scene is cached.
   */
  node: string
  /**
   * Path under public/models for instruments that are real scanned assets
   * rather than procedural geometry from instruments.glb.
   *
   * The portable X-ray is a textured Sketchfab model; rebuilding it as
   * primitives to fit one loader would throw away the only thing that makes it
   * read as real equipment.
   */
  model?: string
  label: string
  /** Shown when held, so picking one up teaches what it is for. */
  use: string
  /**
   * Never correct for anything, under any circumstances.
   *
   * It exists because a wrong-instrument error the player CHOSE is a teachable
   * moment, where one they could not have made is noise.
   */
  absurd?: boolean
  /**
   * A real clinic does not leave everything on the tray, and neither should
   * this. The set-up tray carries what the procedure needs; anything else —
   * and certainly anything absurd — lives behind a cabinet door, which has to
   * be opened deliberately. Finding the axe is then a decision, not an
   * accident of it being the ninth thing in a row.
   */
  storage: Storage
}

export const INSTRUMENTS: Instrument[] = [
  // The set-up tray: mirror, probe and suction are on every tray in every
  // surgery, plus whatever the day's work needs.
  { id: 'mirror', node: 'Mirror', label: 'Mouth mirror', use: 'See what you are doing', storage: 'tray' },
  { id: 'probe', node: 'Probe', label: 'Explorer', use: 'Feel for cavitation and soft dentine', storage: 'tray' },
  { id: 'suction', node: 'Suction', label: 'Suction', use: 'Keep the field dry and visible', storage: 'tray' },
  { id: 'syringe', node: 'Syringe', label: 'Anaesthetic syringe', use: 'Numb the tooth before you touch it', storage: 'tray' },
  { id: 'handpiece', node: 'Handpiece', label: 'Slow handpiece', use: 'Remove caries, prepare the tooth', storage: 'unit' },

  // Fetched from the cabinet when the plan calls for them.
  { id: 'perioProbe', node: 'PerioProbe', label: 'Periodontal probe', use: 'Measure pocket depths', storage: 'drawer' },
  { id: 'scaler', node: 'Scaler', label: 'Scaler', use: 'Remove calculus above and below the gum', storage: 'drawer' },
  { id: 'forceps', node: 'Forceps', label: 'Extraction forceps', use: 'Remove a tooth. Irreversible.', storage: 'drawer' },
  { id: 'axe', node: 'Axe', label: 'Axe', use: 'No.', absurd: true, storage: 'closet' },

  // On its cradle on the wall shelf. Diagnostic, not operative -- it is the one
  // instrument you use to LOOK rather than to do.
  {
    id: 'xray',
    node: 'PortableXray',
    model: 'props/portable_xray.glb',
    label: 'Portable X-ray',
    use: 'Take a radiograph — see the tooth you cannot see',
    storage: 'shelf',
  },
]

export const INSTRUMENT_BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]))

export const TRAY_INSTRUMENTS = INSTRUMENTS.filter((i) => i.storage === 'tray')
export const CLOSET_INSTRUMENTS = INSTRUMENTS.filter((i) => i.storage === 'closet')
export const DRAWER_INSTRUMENTS = INSTRUMENTS.filter((i) => i.storage === 'drawer')
export const UNIT_INSTRUMENTS = INSTRUMENTS.filter((i) => i.storage === 'unit')
export const SHELF_INSTRUMENTS = INSTRUMENTS.filter((i) => i.storage === 'shelf')

/**
 * The instrument each procedure actually requires.
 *
 * Lives here rather than in the case for now, because it is clinical fact
 * rather than case content: an extraction needs forceps whichever tooth it is.
 * When cases start being generated this should move into CaseCore so a
 * generated procedure can declare its own instrument.
 */
export const PROCEDURE_INSTRUMENT: Record<string, InstrumentId> = {
  'p-pulp-cap': 'handpiece',
  'p-restoration': 'handpiece',
  'p-monitor': 'mirror',
  'p-rct': 'handpiece',
  'p-extraction': 'forceps',
}

/** What the committed procedure needs, or null if unknown. */
export function expectedInstrumentFor(procedureId: string | null): InstrumentId | null {
  if (!procedureId) return null
  return PROCEDURE_INSTRUMENT[procedureId] ?? null
}

/**
 * Where each instrument sits on the tray, in the tray's own frame.
 *
 * Laid out along the tray's long axis. Computed rather than hand-placed so
 * adding an instrument cannot silently overlap another — the class of bug that
 * put a spittoon in someone's lap.
 */
export function trayLayout(count: number, spacing = 0.075): number[] {
  const span = (count - 1) * spacing
  return Array.from({ length: count }, (_, i) => -span / 2 + i * spacing)
}
