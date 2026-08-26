# Chairside — v0.1

Your lecture material becomes patients. One real day = one **Clinic Day**: prep the material in the morning, treat the patient booked in the afternoon, close the clinic.

Built to the Phase 0 scope in `D:\My Apps\ideas\STUDY_GAME_CONCEPT.md`: hand-written content, zero AI, zero backend.

**English is the study language.** Dentistry and medicine are taught in English here, so English is the content and Arabic is an optional add-on layered on top: the UI is fully translated, and content can be written in English alone — untranslated strings simply render in English (`src/locales/pickText.ts`). Where Arabic content IS written, it keeps clinical terms and numbers in English — a student revising "Stage III, Grade C" or "0.5 mg of 1:1000 IM" needs to meet those exact words in the exam.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production PWA in dist/
npm run typecheck  # tsc --noEmit
npm test           # all deterministic game-logic tests
```

On your phone: run `npm run dev -- --host`, open the network URL, then "Add to Home Screen". It installs and runs offline.

## What exists in v0.1

| Piece | Where | Status |
|---|---|---|
| Tablet / schedule screen | `src/screens/Tablet.tsx` | Lists every clinic day, shows stars earned |
| PREP mission | `src/screens/Prep.tsx` | Chunk → micro-question → feedback + source slide |
| TREAT mission | `src/screens/Treat.tsx` | Patient briefing → 3–6 graded decisions → outcome |
| Day close | `src/screens/DayClose.tsx` | Stars, score, coins, streak, "what you missed" |
| Game logic | `src/game/` | Scoring, streaks, save format — all pure functions, all tested |
| Content | `src/content/` | Zod schema + two hand-written demo days |
| Bilingual | `src/locales/` | `en.ts` / `ar.ts`, `useLocale()`, direction-aware animation |

Progress lives in `localStorage` under `clinic.save.v1`. No accounts, no server.

## Adding a clinic day

1. Copy `src/content/days/perio-staging.ts` and rewrite it. Write `{ en: '...' }` and stop — Arabic is optional per string, so `{ en, ar }` is only for the places a translation genuinely helps.
2. Register it in `src/content/index.ts`.
3. Run `npm test` — `schema.test.ts` requires English everywhere, checks that any Arabic present actually contains Arabic characters, and rejects days with no citation.

Rules the schema enforces, so content can never quietly break the game:

- exactly one correct option per micro-question
- exactly one `best` option per decision (others are `acceptable` or `poor`)
- `schemaVersion: 1`, and every day must cite the clinical standard it relies on

## The first-person clinic (`src/clinic/`)

Tapping a day on the schedule enters the clinic in **first person** — walk to the desk to study, walk to the chair to see the patient. It wraps the Learning Engine rather than replacing it: the desk opens the same `Prep` screen and the chair the same `Treat` screen the 2D path uses, so scoring can never drift between them (both go through `commitDay` in `App.tsx`).

| Piece | File | Notes |
|---|---|---|
| Orchestrator | `ClinicExperience.tsx` | Canvas, HUD, overlays, the roam→study→solve→close machine |
| Controller | `Player.tsx` | Thin r3f adapter; the maths lives in `movement.ts` |
| Movement maths | `movement.ts` | Pure, unit-tested — forward/right basis, per-axis collision slide |
| Floor plan | `layout.ts` | Colliders + interaction zones in one place, unit-tested for reachability |
| Geometry | `Room.tsx`, `Patient.tsx` | Primitives in the `CHARACTER_SHEETS.md` palette |
| Phone controls | `TouchControls.tsx` | Thumbstick + look pad, RTL-aware |

**Controls.** Desktop: click to lock the pointer, WASD/arrows to walk, mouse to look, `E` to interact. Escape is a de-escalation ladder — it closes a panel, then releases the pointer, and only leaves the clinic when there's nothing left to back out of, so you can't lose a half-finished day to a reflex. Phones: left thumb walks, right thumb looks, tap the prompt to interact.

**Performance choices**, because first-person redraws most of the room every frame:
- Two dynamic lights, no shadow maps. The desk lamp is emissive geometry, not a light.
- `frameloop` drops to `demand` behind an overlay — a long quiz doesn't render the room underneath it.
- `Room` and `Patient` are memoised so HUD state changes don't re-reconcile ~60 meshes.
- Phones get `dpr` capped at 1.25 and MSAA off; desktop gets 1.5 and MSAA on.
- three.js is lazy-loaded (905 kB in its own chunk) — first paint stays at 113 kB gzipped.

**Swapping in real characters.** `Patient.tsx` is the single swap point. `multi_image_to_3d` takes the 4-view A-pose turnaround from `CHARACTER_SHEETS.md` and returns a rigged GLB; render it with `<primitive object={useGLTF(url).scene} />` at the same position and the layout, collision and interaction code is untouched.

**"Open without 3D"** on each day runs the original 2D flow — kept deliberately as a fallback for weak devices.

## Importing a lecture (the generator)

"Import a lecture" on the schedule screen turns a PDF into a playable clinic day. It is not a summarizer — it runs the workflow an exam committee runs:

1. **Read** — `src/ingest/pdf.ts` extracts text page by page, so every item can cite a page you can check. A scanned PDF is detected and rejected up front.
2. **Blueprint** — one pass over the whole deck produces the topic map, weighted by how much the deck itself emphasizes each topic, plus the learning objective and page range per topic.
3. **Write** — one call per topic, in parallel, against `src/ingest/prompts.ts`. That file is the product: focused lead-ins that pass the cover-the-options test, vignettes above recall level, homogeneous options, distractors built from real student errors with a stated rationale each, banned constructions (negative stems, "all of the above"), and a target difficulty spread of roughly 25/40/25/10 easy → brutal.
4. **Review** — a separate committee pass grades every item against eight named failure modes (unsupported key, multiple defensible answers, cueing, worthless distractor, …) and returns keep / revise / cut.
5. **Verify** — `src/ingest/verify.ts` is deterministic and does not trust either model: every item must quote a sentence that actually appears in your deck, checked by ordered word overlap against the cited page and its neighbours. Items that fail are **dropped, not shown**. Near-duplicate stems are dropped too.
6. **Assemble** — mapped onto `ClinicDay` and passed through the same `parseClinicDay` gate as hand-written content.

The deck text is the cached prompt prefix for every call, so a long lecture is billed at full input price once and at cache-read rates for each topic after that.

**The API key is stored in this browser and sent straight to Anthropic from the page.** That is fine for your own machine with your own key. It is not fine on a shared computer, and the import screen must move behind a small server before the app is published — any script on a public page can read a key held this way.

## Phase 2 (the bot) — the contract is already fixed

The LLM step converts a lecture PDF into JSON matching `src/content/schema.ts` exactly, and it passes through the same `parseClinicDay()` gate as hand-written content. Nothing else in the app changes: the engine has no idea whether a day was written by a human or generated.

The question bank is **derived** from clinic days at load time (`src/game/questionBank.ts`), never stored — so the model only ever has to produce one consistent copy of each question.

## Things that bit us, so they don't bite again

- **`AnimatePresence mode="wait"` freezes the screen** under React 19 StrictMode + Motion 12: the exit animation never resolves and the next screen never mounts. Screens use keyed remounts instead.
- **Direction-aware motion.** Motion animates `x`, not logical properties, so every horizontal offset is multiplied by `dir` from `useLocale()` — otherwise Arabic slides the wrong way.
- **Local dates, never UTC.** `localDateKey()` exists because `toISOString()` breaks streaks for anyone in Jordan finishing a day before 3 AM.
- **Arabic never goes inside a WebGL canvas.** Canvas text does not shape Arabic reliably — all text is DOM, layered over the 3D.
- **The arcade runner was deleted (2026-07-23).** It was a v0.1 side mode that v5 dropped; sitting on the schedule screen it competed with the clinic and got opened by mistake. Phaser went with it.

## Not in v0.1 (fast-follow, per the concept doc)

CLEAR queue, Audit Day, returning patients, syllabus → auto-scheduled season, accounts, leaderboards, 3D clinic hub.
