# Content Schema — how to read `02_content_export.json`

*This is the exact shape of `02_content_export.json`, field by field, so it can be turned into an Unreal DataTable (or a set of DataTables + a JSON-import step). The export was generated programmatically from the web game's own source-of-truth content files (`study-game/src/content/days/*.ts`) — nothing here is hand-transcribed, so it can't drift from what was actually authored and clinically verified.*

## Top level

```jsonc
{
  "exportVersion": 1,
  "exportedFrom": "chairside-web (react-three-fiber build, retired)",
  "note": "...",
  "days": [ /* ClinicDay objects, see below */ ]
}
```

`days` currently has **2 entries** — `perio-staging` (Dentistry) and `med-anaphylaxis` (Medicine). These are the only clinically-verified content that exists; everything else in the game (character rosters, scene names) was never tied to specific content and doesn't need export.

## A `ClinicDay` object

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable identifier, e.g. `"perio-staging"`. Use as the DataTable row name. |
| `track` | `"dental"` \| `"medical"` | Which student track this belongs to — the top-level content filter. |
| `subject` | `{en, ar?}` | e.g. `"Periodontology"`. `ar` is optional; fall back to `en` if absent. |
| `title` | `{en, ar?}` | Short display title for the schedule screen. |
| `isDemo` | bool | `true` for hand-written proof-of-concept content (both current days are `true`). A real student-generated day sets this `false`. |
| `citations` | string[] | The clinical standards this day's logic is built on, e.g. `"2018 EFP/AAP classification of periodontal diseases"`. Show these somewhere in the UI (a day genuinely traces to real medicine, not vibes). |
| `provenance` | object \| null | Present only for AI-generated days: `{sourceFile, pageCount, model, generatedOn}`. `null` for hand-written days. |
| `slides` | array (currently empty) | **Target shape**: `{page: number, imageRef: string \| null, text: string}[]` — the rendered deck pages. Empty for both current days because they were hand-written, not generated from an uploaded PDF (no source images exist to populate this honestly). See "Generation pipeline" below for how this gets filled for real content. |
| `studyNotes` | object | The real study-notes block — see below. |
| `flashcardSourceQuestionIds` | string[] | IDs of every question (both quiz + case decisions) that flashcards should be built from. Points at IDs inside `prep`/`treat` below rather than duplicating the question text — one source of truth. |
| `prep` | object | The quiz module: `{missionTitle: BiText, briefing: BiText, chunks: PrepChunk[]}`. |
| `treat` | object | The patient case: `{missionTitle: BiText, cases: PatientCase[]}`. v1 always has exactly 1 case per day. |

### `BiText` (appears everywhere)

```jsonc
{ "en": "required, the study-language text", "ar": "optional Arabic aid" }
```

Rule baked into every field of this shape across the whole export: **English is the source of truth; Arabic is optional and falls back to English when absent.** Clinical terms/numbers/drug names inside an `ar` string are deliberately left in English (e.g. `"...التصنيف — Stage III..."`) — that's not a translation bug, it's intentional (a student needs to recognize "Stage III" in the term itself, not a translated paraphrase of it).

### `studyNotes`

```jsonc
{
  "title": BiText,          // same as prep.missionTitle
  "intro": BiText,          // same as prep.briefing — why this matters today
  "sections": [
    {
      "id": "c1",
      "heading": BiText,     // e.g. "What stage measures"
      "body": BiText,        // the full explanatory text — READ THIS, not a teaser
      "linkedQuestionId": "c1q",  // the quiz question this section feeds into
      "sourceRef": BiText    // e.g. {"en": "Slide 12"} — where this came from
    },
    // ...
  ]
}
```

**Important:** for the two exported demo days, `sections[].body` is the *existing* `prep.chunks[].body` text verbatim — content that was already authored and already cited, just re-presented under the `studyNotes` name. It is **not yet the fuller, more complete notes** described in `01_GAME_DESIGN.md` §3.1 (multi-paragraph, spans the material fully). Treat the current export as the correct *shape* to build toward, not a finished example of the target depth. A day generated fresh from a real uploaded deck should produce genuinely long-form notes here, not chunk-sized blurbs.

### `PrepChunk` (inside `prep.chunks[]`)

```jsonc
{
  "id": "c1",
  "title": BiText,
  "body": BiText,           // short — this is the OLD 2-4 sentence blurb;
                             // studyNotes.sections is the new real-notes home
  "question": MicroQuestion
}
```

### `MicroQuestion`

```jsonc
{
  "id": "c1q",
  "prompt": BiText,
  "options": [
    { "id": "a", "label": BiText, "isCorrect": bool, "rationale"?: BiText },
    // 2-5 options, EXACTLY ONE has isCorrect: true
  ],
  "explanation": BiText,     // shown after answering, regardless of correctness
  "sourceRef": BiText,       // e.g. "Slide 12" — always present
  "difficulty"?: "easy"|"moderate"|"hard"|"brutal",
  "cognitive"?: "recall"|"application"|"analysis"|"synthesis",
  "sourceQuote"?: string     // verbatim sentence from the source deck (generated content only)
}
```

Correctness lives on the option (`isCorrect: true`), never as an index — so options can be shuffled at render/display time without ever touching which one is right.

### `PatientCase` (inside `treat.cases[]`)

```jsonc
{
  "id": "p1",
  "patient": { "name": BiText, "age": number, "avatar": "emoji string, web-only" },
  "chiefComplaint": BiText,
  "history": BiText,
  "findings": BiText[],       // bulleted list, min 1
  "decisions": [ DecisionPoint, ... ],   // 3-6, in the order the encounter unfolds
  "outcome": { "success": BiText, "partial": BiText, "failure": BiText }
}
```

`patient.avatar` was a web-only emoji fallback (used before a real character was wired in) — **ignore it for Unreal**; the patient is a MetaHuman now (see `05_ASSET_BRIEF.md` for the character reference photos and mood mapping).

### `DecisionPoint`

```jsonc
{
  "id": "d1",
  "prompt": BiText,
  "options": [
    {
      "id": "a",
      "label": BiText,
      "quality": "best" | "acceptable" | "poor",   // EXACTLY ONE option is "best"
      "feedback": BiText,      // second-person, the consequence of THIS choice
      "sourceRef"?: BiText
    },
    // 2-5 options
  ]
}
```

This is the deterministic scoring input — see `01_GAME_DESIGN.md` §6 for how `quality` turns into points.

## Building the Unreal DataTable

Recommended split (one DataTable per row-struct, all keyed by `day.id` + a sub-id where needed):

1. **`DT_ClinicDays`** — one row per day: `id, track, subject, title, isDemo, citations, studyNotesTitle, studyNotesIntro, quizMissionTitle, quizBriefing, caseMissionTitle`.
2. **`DT_StudySections`** — one row per `studyNotes.sections[]` entry, keyed `"{dayId}_{sectionId}"`, with a lookup column back to `dayId`.
3. **`DT_QuizQuestions`** — one row per `prep.chunks[].question`, same keying pattern. Options as a nested struct array (Unreal supports struct arrays inside a row).
4. **`DT_Cases`** — one row per `treat.cases[]` entry (patient info + findings + outcome text).
5. **`DT_CaseDecisions`** — one row per decision, keyed `"{dayId}_{caseId}_{decisionId}"`.

A single JSON→DataTable CSV/JSON importer script (Python or a small Blueprint utility) can flatten the nested export into these five tables in one pass — see `04_UNREAL_RESEARCH_BRIEF.md` for exactly what to research on Unreal's JSON/DataTable import tooling.

## Generation pipeline (how new content gets made)

The web build's pipeline (kept conceptually, not code-for-code, since it called the Anthropic API from a browser — in Unreal this becomes an offline/companion-tool step, not in-engine):

1. **Extract** — read the uploaded PDF page by page: text (already implemented on web via pdf.js) AND a rendered image of each page (**not yet implemented anywhere** — this is the missing piece that fills `slides[]`; pdf.js/a PDF library can rasterize a page to an image at a chosen DPI).
2. **Blueprint** — an LLM call reads the whole deck and produces an "exam blueprint": the topics actually taught, weighted by how much the deck emphasizes each, plus the single most clinically consequential scenario (becomes the patient case).
3. **Write study notes** — NEW step (didn't exist on web) — an LLM call per topic produces the real, complete `studyNotes.sections` content: multi-paragraph, source-anchored, no invented facts, comprehensive rather than a teaser.
4. **Write quiz items** — an LLM call per topic, under strict NBME-style rules (see `03_CLINICAL_CONTENT_STANDARDS.md`), each item carrying a verbatim `sourceQuote` from the deck.
5. **Review committee** — a second LLM pass whose only job is to find flaws in step 4's items (unsupported answer, multiple defensible answers, cueing, banned constructions) and keep/revise/cut each one.
6. **Write the case** — one LLM call producing the patient encounter: chief complaint, history, findings, and a decision sequence in the order the encounter actually unfolds, each option graded best/acceptable/poor.
7. **Verify** — deterministic (no AI): for every `sourceQuote`, check it actually appears (ordered word-overlap ≥ 0.75) on the cited page or its immediate neighbors in the ACTUAL extracted deck text. Anything that fails is dropped, no exceptions — this is the anti-hallucination backstop that doesn't rely on the model grading itself.

Steps 2, 4, 5, 6 already existed and worked on web (`study-game/src/ingest/pipeline.ts`, `prompts.ts`, `verify.ts` — read these directly for the exact prompt text if reimplementing the pipeline as a standalone tool). Step 1's image rendering and step 3 (real study notes) are the two genuinely new pieces this redesign requires.
