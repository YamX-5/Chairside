// Exports every ClinicDay into engine-neutral JSON for the Unreal handoff.
// Run: npx tsx scripts/export-unreal-content.mts
//
// This reads the SAME source-of-truth objects the web game plays (src/content),
// so the export can never drift from what was actually authored and verified.
// It adds a `studyNotes` block per day, built by RESTRUCTURING the prep chunks
// that already exist (heading + body, already human-authored and clinically
// cited) — it does not invent any new clinical content. `slides` is left empty
// with a documented shape: real slide images only get populated by running a
// deck through the (to-be-built) slide-render step of the ingest pipeline —
// never fabricated for content that was hand-written without a source deck.

import { writeFileSync } from 'node:fs'
import { ALL_DAYS } from '../src/content/index.ts'
import type { ClinicDay } from '../src/content/schema.ts'

function studyNotesFrom(day: ClinicDay) {
  return {
    title: day.prep.missionTitle,
    intro: day.prep.briefing,
    sections: day.prep.chunks.map((chunk) => ({
      id: chunk.id,
      heading: chunk.title,
      body: chunk.body,
      // The question stays linked so a "make a flashcard from this section"
      // step in Unreal can reuse the same fact instead of re-deriving it.
      linkedQuestionId: chunk.question.id,
      sourceRef: chunk.question.sourceRef,
    })),
  }
}

const EXPORT = {
  exportVersion: 1,
  exportedFrom: 'chairside-web (react-three-fiber build, retired)',
  note:
    'Engine-neutral content export for the Unreal Engine rebuild. Every field ' +
    'traces to src/content/days/*.ts — nothing here was invented for the export. ' +
    'See unreal-handoff/02_CONTENT_SCHEMA.md for what each field means and how ' +
    'to turn this into an Unreal DataTable.',
  days: ALL_DAYS.map((day: ClinicDay) => ({
    id: day.id,
    schemaVersion: day.schemaVersion,
    track: day.track ?? 'dental',
    subject: day.subject,
    title: day.title,
    isDemo: day.isDemo,
    citations: day.citations,
    provenance: day.provenance ?? null,

    // ── STUDY MODULE (the fixed design — see 01_GAME_DESIGN.md §3) ──
    // 1. slides: the actual source deck, page images + extracted text.
    //    Empty for hand-written demo days (no source PDF exists to render).
    //    A day generated from an uploaded deck MUST populate this.
    slides: [] as { page: number; imageRef: string | null; text: string }[],
    // 2. studyNotes: real, in-depth structured notes — not a 2-sentence blurb —
    //    derived here from the existing prep chunks (already authored content).
    studyNotes: studyNotesFrom(day),
    // 3. flashcards: derived 1:1 from the same chunks + case decisions, so the
    //    recall step drills the exact facts the notes and quiz both use.
    flashcardSourceQuestionIds: [
      ...day.prep.chunks.map((c) => c.question.id),
      ...day.treat.cases.flatMap((cs) => cs.decisions.map((d) => d.id)),
    ],
    // 4. quiz: the existing prep chunks, verbatim.
    prep: day.prep,
    // 5. case: the existing patient encounter, verbatim.
    treat: day.treat,
  })),
}

const outPath = new URL('../unreal-handoff/02_content_export.json', import.meta.url)
writeFileSync(outPath, JSON.stringify(EXPORT, null, 2) + '\n')
console.log(`wrote ${EXPORT.days.length} day(s) to unreal-handoff/02_content_export.json`)
for (const d of EXPORT.days) {
  console.log(`  - ${d.id}: ${d.studyNotes.sections.length} study sections, ` +
    `${d.prep.chunks.length} quiz items, ${d.treat.cases[0].decisions.length} case decisions`)
}
