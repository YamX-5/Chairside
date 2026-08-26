# Unreal Engine + MetaHuman Research Brief

*For Cowork (or whoever does the technical research/build). This is the complete list of things to look up and decide before/while building Chairside in Unreal. Organized by topic, each with concrete questions and suggested search terms — work through it roughly top to bottom; the early decisions (engine version, platform target) constrain the later ones.*

Read `01_GAME_DESIGN.md` and `02_CONTENT_SCHEMA.md` first — this brief assumes you know what's being built.

---

## 1. Engine version & project setup

- Current stable Unreal Engine version, and whether a newer preview/beta version is worth using for this project (check Lumen/MetaHuman maturity in each).
- **C++ vs. Blueprint-only** project — recommend Blueprint-first for iteration speed, with C++ only where Blueprint genuinely can't (e.g. performance-critical PDF/JSON parsing, if that ends up happening inside the engine rather than as an external tool).
- Confirm the **Unreal royalty/licensing terms** currently in effect (revenue threshold, percentage) — this affects nothing about *building* the game but matters before any monetization decision.
- Search: `"Unreal Engine [current version] release notes"`, `"Unreal Engine royalty terms 2026"`.

## 2. Platform & distribution decision (do this before building navigation UI)

Two real options, each with different implications for how "enter the clinic" → "walk around" → menus are built:

- **Native app** (Windows/Mac desktop, later mobile) — packaged download, no live server cost, full engine feature set.
- **Pixel Streaming** — cloud-GPU renders the game, streams video to a browser; keeps "here's a link" distribution but costs real money per concurrent player (~$1–2/GPU-hour is the ballpark from 2026 pricing — verify current numbers).
- Research: Pixel Streaming setup complexity, minimum GPU tier needed, and whether Epic or a third party (e.g. a managed Pixel Streaming host) is the practical route if this path is chosen.
- Research: **mobile packaging** requirements if targeting phones eventually — Lumen/Nanite mobile support maturity, expected build size, minimum device specs for MetaHuman rendering on mobile (this may be the deciding factor against mobile for v1).
- Search: `"Unreal Engine Pixel Streaming cost 2026"`, `"Unreal Engine mobile Lumen support"`, `"MetaHuman mobile performance"`.

## 3. MetaHuman — characters (doctor + patient)

- **Creation workflow**: MetaHuman Creator (web/cloud tool) vs. any local/offline creation path — current state of each.
- **Photo-to-MetaHuman**: whether a same-plane reference photo (like the character sheets in `05_ASSET_BRIEF.md`) can drive MetaHuman likeness creation directly, and what quality/angle requirements that needs.
- **Facial expression driving at runtime**: how to switch a MetaHuman's expression/mood (anxious → pain → relieved) driven by game state (not live performance capture) — likely via a Control Rig / Animation Blueprint blend between pre-authored expression poses or a small set of authored animations, triggered by a mood enum.
- **Import into an Unreal project**: current MetaHuman plugin/workflow for pulling a created character into the project (Quixel Bridge, or its current replacement).
- **Licensing**: confirm MetaHuman characters are free to use in a commercial project under current terms (this has changed over Unreal's history — verify, don't assume from older documentation).
- Search: `"MetaHuman Creator workflow 2026"`, `"MetaHuman Control Rig facial expression Blueprint"`, `"MetaHuman photo to likeness"`, `"MetaHuman license commercial use"`.

## 4. Environment art (the clinic itself)

- **Fab** (Epic's unified asset marketplace, successor to the Quixel Megascans bridge + Marketplace) — current state of free vs. paid content, and whether a dental-clinic-appropriate furniture/prop set exists or needs assembling from generic medical/office/furniture packs.
- **Megascans** surfaces/materials (still free via Fab) for walls, wood, fabric — these can directly replace the flat textures generated in the web build's Higgsfield pass (`study-game/public/textures/` if that folder still exists) with real PBR materials.
- **Lumen** (Unreal's real-time global illumination) — default setup needed to get the warm, soft, Pixar-style look described in `01_GAME_DESIGN.md` §8 without a manual light-baking pass. Look for "how to get a stylized/soft look with Lumen" rather than photoreal defaults.
- Search: `"Unreal Fab free assets 2026"`, `"Unreal Engine Lumen stylized lighting setup"`, `"Unreal Engine soft warm lighting tutorial"`.

## 5. Content pipeline — JSON → DataTable

- Current best method to import a JSON file (`02_content_export.json`) into Unreal DataTables — options to compare:
  - Convert JSON → CSV (flattened per `02_CONTENT_SCHEMA.md`'s recommended 5-table split) and use Unreal's built-in CSV DataTable import.
  - A custom Python/Blueprint utility that parses JSON directly into DataTable rows via the Editor Scripting / Python API.
  - A runtime JSON parser (Unreal's `FJsonSerializer`) that loads the export at runtime instead of pre-baking DataTables — simpler for iterating on content without re-importing, worth comparing against DataTables for this use case specifically.
- Confirm whether nested arrays-of-structs (e.g. a question's options) are supported cleanly in a single DataTable row, or whether they need a separate linked table (this determines the exact table split).
- Search: `"Unreal Engine import JSON to DataTable"`, `"Unreal Engine DataTable nested struct array"`, `"Unreal Engine runtime JSON parsing FJsonSerializer"`.

## 6. UI (UMG) — study screens, quiz, case decisions, RTL Arabic

- **UMG** (Unreal Motion Graphics) is the UI system — research current best practices for a card-based quiz/flashcard UI (similar to the web build's screens: a prompt, 2-5 answer buttons, a feedback panel).
- **Arabic RTL support in UMG** — this is a real, non-trivial thing to verify: does UMG natively mirror layout for RTL locales, and does its text rendering shape Arabic script correctly (Arabic requires contextual letter shaping, not just right-to-left ordering)? This is worth confirming early since it blocks the localization requirement in `01_GAME_DESIGN.md` §7.
- **Unreal's built-in localization system** (Localization Dashboard, string tables) vs. a custom bilingual-field approach (mirroring the web build's `{en, ar}` BiText pattern directly in the DataTables) — recommend evaluating both; the custom approach may be simpler given the content is already structured that way in the export.
- Search: `"Unreal Engine UMG Arabic RTL support"`, `"Unreal Engine Arabic localization text shaping"`, `"Unreal Engine Localization Dashboard workflow"`.

## 7. Displaying the slide images + notes (the new Study Module)

- How to display a scrollable/swipeable image gallery in UMG for the `slides[]` array (rendered deck pages) — likely an `Image` widget bound to a texture loaded from a file path or embedded as a texture asset.
- Whether to pre-import slide images as texture assets (import step per generated day) or load them at runtime from a content folder — affects how the "upload a new lecture" flow works end-to-end.
- Search: `"Unreal Engine UMG image gallery scroll box"`, `"Unreal Engine load texture from file runtime"`.

## 8. Video / cutscenes (using the Higgsfield-generated assets)

- **Media Framework** (Unreal's video playback system) for playing any Higgsfield-generated video clips (walk-throughs, scene establishing shots) as cutscenes or background elements, if that approach is still wanted for transitions between beats.
- Whether MP4/WebM (Higgsfield's typical export formats) need transcoding for Unreal's Media Framework, or play natively.
- Search: `"Unreal Engine Media Framework video playback tutorial"`, `"Unreal Engine supported video codecs Media Framework"`.

## 9. Save / progress system

- **SaveGame** objects (Unreal's built-in save-data system) for streak/coins/completed-days/best-scores — the deterministic scoring in `01_GAME_DESIGN.md` §6 needs a persistent store equivalent to the web build's `localStorage` save blob.
- Search: `"Unreal Engine SaveGame tutorial"`, `"Unreal Engine save system best practices"`.

## 10. Content generation pipeline (offline companion tool, not in-engine)

The "upload a PDF → get study notes + quiz + case" pipeline almost certainly should NOT run inside the Unreal Engine process — it needs an LLM API, a PDF-rendering library, and produces a JSON file that Unreal then imports (per §5 above). Research:

- Best current approach to run this as a **standalone companion tool** (a small web app, a CLI, or a desktop utility) that a student runs once per lecture, producing a JSON file dropped into the Unreal project's content folder.
- PDF → page-image rendering libraries (for the new `slides[]` requirement) — e.g. `pdf.js` (already used on web, browser/Node), `pdfium`, or a Python library (`pymupdf`/`fitz`) if the companion tool is Python-based.
- Whether this companion tool can literally be the retired web app's `Import` screen + pipeline, run standalone (outside the abandoned game UI) purely as a content-authoring tool, with the existing prompts in `study-game/src/ingest/prompts.ts` reused close to verbatim (they're engine-independent — just text + an LLM call).
- Search: `"pdf to image Python pymupdf"`, `"Claude API structured output JSON schema"` (the web build used Anthropic's API with `output_config.format` for structured JSON — same approach should carry over to whatever runs the companion tool).

## 11. Performance targets

- Rough triangle/draw-call/texture-memory budgets for the target platform(s) decided in §2 — Unreal's own profiling tools (`stat unit`, `stat gpu`) to check against once a vertical slice exists.
- MetaHuman-specific performance notes — a MetaHuman character is not free; confirm current guidance on how many can be on screen at once (likely just 1: the patient) without an optimization pass.
- Search: `"Unreal Engine MetaHuman performance optimization"`, `"Unreal Engine mobile performance budget"`.

---

## Suggested order of operations

1. Decide platform (§2) — this gates everything else.
2. Stand up a blank Unreal project, import ONE MetaHuman (§3), confirm it renders and can blend between two facial expressions.
3. Get the JSON content pipeline (§5) working end-to-end with `02_content_export.json` — even into a throwaway debug UI — before investing in polished UMG.
4. Build the Study Module UI (§7 + §6) since it's the part that was missing/broken in the web build — prove it first.
5. Build the case/decision UI (reuses the same UMG patterns as the quiz).
6. Environment art pass (§4) once the loop works with placeholder geometry.
7. Save system (§9), then video/cutscene polish (§8) last.
