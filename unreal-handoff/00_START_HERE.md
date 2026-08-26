# Chairside — Unreal Engine Handoff

*Written 2026-07-24. Everything needed to rebuild Chairside in Unreal Engine, without losing the web prototype's clinical rigor or design decisions. Hand this whole folder to whoever (or whatever — Cowork) does the Unreal research and build.*

## Why this folder exists

The web build (react-three-fiber) proved the concept but hit a real ceiling: primitive 3D geometry cannot match the Pixar/Seedance-style render quality the game is supposed to look like, and building it in code kept producing something that "wasn't close to what I wanted." Unreal + MetaHuman + Megascans is the right tool for that look. This folder carries forward the two things that ARE worth keeping from the web build:

1. **The clinical content** — real, cited, verified exam-quality cases and questions (§`02_content_export.json`).
2. **The game design** — corrected. Building the web version surfaced a real gap: there was no actual *studying* step, just a two-sentence blurb before a quiz question. That's fixed in the design below, before a single Unreal asset gets built.

## Read in this order

| # | File | What it's for |
|---|---|---|
| 1 | `01_GAME_DESIGN.md` | The complete, corrected design — read this first. Section 3 is the fix for "there's no studying." |
| 2 | `02_CONTENT_SCHEMA.md` + `02_content_export.json` | The actual clinical content (2 full days, verified cases + questions), as engine-neutral JSON ready to import into an Unreal DataTable. |
| 3 | `03_CLINICAL_CONTENT_STANDARDS.md` | The rules for writing MORE cases later (in Unreal or by hand) without losing rigor — NBME item-writing discipline, source citation, decision grading. |
| 4 | `04_UNREAL_RESEARCH_BRIEF.md` | The exact list of things to research before/while building — hand this straight to Cowork. |
| 5 | `05_ASSET_BRIEF.md` | What to still generate with Higgsfield (unlimited image/video) for use *inside* Unreal — MetaHuman reference photos, environment art, cutscenes — vs. what MetaHuman/Fab/Megascans already cover for free. |

## The one-sentence brief, if you only read one thing

**Chairside**: a student uploads their own lecture slides; the game turns them into (1) real structured study notes + the slides themselves, (2) active-recall flashcards, (3) an NBME-style quiz, and (4) a hard exam-case patient who sits down and has to be diagnosed and treated correctly — all wrapped in a first-person clinic you walk through, MetaHuman characters, cinematic lighting. Bilingual (English study language, Arabic aid, RTL). Every clinical fact is cited to a standard and to the exact slide it came from.
