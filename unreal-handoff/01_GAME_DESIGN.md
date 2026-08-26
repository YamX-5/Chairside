# Chairside — Game Design (Unreal rebuild)

*Corrected 2026-07-24, after playing the web prototype end-to-end and finding the real gap: there was no actual studying — just a short blurb, then straight to quiz questions. Section 3 below is the fix. Everything else carries forward decisions already validated in the web build.*

## 1. What this is

A student's own lecture material becomes patients they diagnose. You play a clinician: you walk into your clinic, get a case notification, go study at your desk (for real — read your slides, read a real summary, drill flashcards, quiz yourself), then a patient arrives with a hard exam-style case built from the same material, and you have to get the clinical reasoning right under time-appropriate pressure.

**Owner**: Yaman, dentistry student, solo founder ("Not Your AVG Dentist"). Studies dentistry/medicine in English; Arabic is his first language. Building with AI assistance, now moving the engine from web/react-three-fiber to Unreal.

**Non-negotiables carried forward from the web build:**
- **English is the study language.** Clinical terms, doses, staging/grading names, drug names — always in English, even in the Arabic UI. Arabic is a comprehension aid layered on top, never a replacement.
- **Every clinical fact must be true and citable.** No invented clinical logic. Every computed value or classification names its standard (e.g. 2018 EFP/AAP periodontitis staging, Löe-Silness index, Resuscitation Council anaphylaxis algorithm). See `03_CLINICAL_CONTENT_STANDARDS.md`.
- **Deterministic first.** Scoring, staging math, streaks, coins — plain rules, not an LLM. LLM/AI is used only for the one place natural language genuinely requires it: turning an uploaded lecture into study notes + questions + a case. That output is deterministically graded afterward.
- **A generated case is a suggestion, not gospel.** Anything produced from an uploaded deck carries a visible "generated from your notes — verify against your syllabus" label.
- **Runs offline once loaded** (this was a PWA requirement on web; on Unreal this becomes "no live network dependency at play time" — content generation is the only online step).

## 2. Audience & platform target

Primary: dental/medical students studying in English, worldwide, starting with Yaman's own coursework. Track selector at sign-in: **Dentistry** or **Medicine** (separate content pools, same engine and loop).

**Platform reality check (carried over from the web-to-Unreal decision):** Unreal has no browser build. Decide up front between:
- **Native app** (Windows/Mac desktop first, mobile later) — the practical default; matches "runs a real render pipeline."
- **Pixel Streaming** (cloud-GPU, streamed to a browser link) — keeps the original "just open a link" reach, but costs ~$1–2/GPU-hour per concurrent player. Only viable with funding or a small closed beta.

This decision changes packaging/distribution work in `04_UNREAL_RESEARCH_BRIEF.md` — pick before building UI navigation flows that assume one or the other.

## 3. THE FIX: a real Study Module (this is what was missing)

### What was wrong

The web prototype's "morning" beat showed a 2–4 sentence AI-written blurb per topic (`PrepChunk.body`, deliberately capped at "a few sentences" — see `src/content/schema.ts`), then went straight into a multiple-choice question. There was no way to:
- read the student's own slides as slides,
- read a real, complete, well-organized summary of the material (not a teaser),
- review before being quizzed,
- come back later and re-study without doing the quiz again.

That is not studying. That is a quiz with captions. The fix is a proper four-stage Study Module, done *before* the patient case, in this order:

### 3.1 — Read (the slides themselves)

The student's uploaded deck, shown as **actual slide images**, one per page, swipeable/scrollable — not just extracted text. This is the literal source material; nothing stands between the student and it.

- Each slide image sits next to (or below, on mobile) a **real, in-depth, structured summary** of that section of the deck — organized by heading, multi-paragraph where the material warrants it, written the way a professor's own typed lecture notes read: complete, not a teaser. Contrast with the old `PrepChunk.body`: that was 2–4 sentences; this is as long as the material needs, spanning several sections per topic if the deck does.
- Every summary section cites the exact slide(s) it's drawn from (`sourceRef`, e.g. "Slides 14–17") so the student can flip back and check it against the original.
- No question is asked yet. This stage has no score, no timer, no pressure — it exists purely so the student actually reads before being tested. (This mirrors what active-recall research calls "encoding" — you cannot skip straight to retrieval practice on material you never encoded.)

### 3.2 — Flashcards (active recall)

Short prompt → self-flip → see the answer + the one sentence of source it came from → **self-rate** ("got it" / "review again"). Weak cards return later in the same session (a simple leftover-queue, not full spaced-repetition scheduling for v1 — see Appendix A for the SRS upgrade path). This already exists in prototype form (`Flashcards.tsx`, built from `buildQuestionBank`) — carry the *behavior* forward, not the code.

### 3.3 — Quiz (NBME-style questions)

The existing rigor, unchanged: focused lead-in, vignette above recall level, homogeneous distractors built from real misconceptions, source-anchored. See `03_CLINICAL_CONTENT_STANDARDS.md` for the exact rules. This is timed/scored, unlike 3.1–3.2.

### 3.4 — (transition) → Patient case

Only after 3.1–3.3 does the mission notification for the afternoon patient fire. The case should feel like it *rewards* having actually studied — a student who skipped straight to the quiz (or skipped the whole module) should visibly struggle, because the case decisions require the same reasoning the notes/flashcards/quiz just drilled.

### Data shape this implies

`ClinicDay` gains two things beyond what the web schema had (see `02_CONTENT_SCHEMA.md` for the full shape):
- `slides: { page, imageRef, text }[]` — the rendered deck pages. **Only populated when a day is generated from an actual uploaded PDF.** Hand-authored demo days (no source deck) leave this empty — never fabricate slide images for content that didn't come from a real deck.
- `studyNotes: { sections: [{ heading, body, sourceRef }] }` — the real, complete summary, structured by heading. For the two existing demo days this has been mechanically derived from their existing `prep.chunks` (already-authored, already-cited content — see the export script) as a *starting shape*; a day generated from a real PDF should produce genuinely comprehensive notes, not a chunk-sized blurb.

### Why this wasn't obvious earlier

The original request explicitly said "not some shitty ass summary" — meaning: don't replace real studying with AI slop, don't dumb it down. That got mis-implemented as "skip the summary, go straight to hard questions." The actual ask was always **both**: real, rigorous studying material AND real, rigorous questions — not one instead of the other. This section fixes that.

## 4. The full loop (per Clinic Day)

```
Sign in (name, MetaHuman doctor character, track = Dentistry|Medicine)
  → Subject select (derived from whatever content exists for that track)
    → Tablet / schedule screen (today's clinic day, streak, coins)
      → Enter the clinic (first-person, walk to the desk)
        → Mission notification: "3pm referral booked — study before they arrive"
          → STUDY MODULE (3.1 Read → 3.2 Flashcards → 3.3 Quiz)
            → Patient called in, walks/sits in the chair
              → THE CASE: chief complaint, history, findings, then a sequence
                of clinical decisions (assess before diagnose, diagnose before
                treat), each graded best/acceptable/poor with in-the-moment
                feedback naming the consequence
                  → Day Close: score, coins, streak, stars, "what you missed"
                    review list with the source citation for each miss
                      → back to Tablet
```

Two entry paths into a day existed on web (full first-person vs. "classic" 2D/UI-only) — in Unreal this collapses to one path; the value of "classic mode" was *accessibility/performance fallback*, which Unreal's own graphics-quality settings should cover instead of a separate UI mode.

## 5. Screens / beats

| Beat | Purpose | Notes for Unreal |
|---|---|---|
| Login / character select | Name + pick a MetaHuman doctor avatar → sets track | Doctor roster: see `05_ASSET_BRIEF.md` for the existing character reference sheets (Yaman, Miya = dental; Amr, Tala = medical) |
| Subject select | Pick what to study, or "everything" | Derived from available content, not hardcoded |
| Tablet / schedule | Home screen: today's day, streak🔥, coins🪙, import a new lecture | |
| Clinic arrival | First-person entry, mission notification | This is where "no movement" got flagged on web — in Unreal, real walking (not a 2.5D dolly-fake) solves that natively |
| **Study: Read** | Slides + real notes | New — see §3.1 |
| **Study: Flashcards** | Active recall | Existing behavior, carry forward |
| **Study: Quiz** | NBME-style MCQ | Existing behavior (`Prep` on web), carry forward |
| Patient called / seated | The MetaHuman patient walks in, sits, mood visible on their face | Mood should be a MetaHuman facial-expression state machine (anxious → relieved/pain based on how the case goes), not a static sprite |
| The Case | Vignette + sequential decisions | Existing behavior (`Treat` on web), carry forward |
| Day Close | Score, stars, coins, streak update, missed-items review | Deterministic scoring (§6) |
| Import | Upload a PDF → generation pipeline runs → new day appears | See `02_CONTENT_SCHEMA.md` §"Generation pipeline" |

## 6. Scoring (deterministic — port these numbers exactly)

```
DECISION_POINTS = { best: 100, acceptable: 50, poor: 0 }
PREP_CORRECT_POINTS = 60
PREP_WRONG_POINTS  = 10   // effort isn't zero even when wrong

treatRatio = earnedPoints / (numDecisions * 100)
outcomeTier =
    ratio >= 0.85 → "success"
    ratio >= 0.50 → "partial"
    else          → "failure"

coinsEarned = floor(totalScore / 10) + completionBonus
    completionBonus = success:50, partial:20, failure:0

starsFor(tier) = success:3, partial:2, failure:1   // never 0

streak: increments only if the gap since the last completed day is
        exactly 1 day; a missed day resets the streak to 1 (not 0);
        a same-day replay does not increment it.
```

`maxTreatPoints` = the number of decisions in **the first case only** — v1 plays exactly one case per day; if a day ever ships two cases, the scoring ceiling must be revisited or it will mis-tier every outcome.

Best-of-runs: replaying a day can only *raise* its recorded score/stars (`Math.max` against the previous best), never lower them.

## 7. Localization

- Every user-facing string ships in **English AND Arabic** in the same change, or a documented reason why not.
- Arabic is RTL. Clinical terms/numbers/doses stay in English inside Arabic sentences (this is already how the web content was authored — see any `ar` field in `02_content_export.json` for the pattern: prose translated, "Stage III, Grade C" left in English).
- English is the fallback when a string has no Arabic yet — never show a blank.

## 8. Art direction target

Warm, soft, stylized 3D — Pixar/Seedance style, not photoreal-clinical. Muted cream/honey-wood/teal palette, soft daylight, gentle bloom, shallow depth of field on the patient. Reference: the two style clips Yaman generated in Higgsfield (kept in the web repo's `study-game/reference/` folder — carry these over as the literal mood-board for lighting/material work in Unreal). MetaHuman + Lumen should get this look close to for-free with reasonable lighting setup; don't force a photoreal MetaHuman default — dial materials toward soft/matte.

## 9. What "done" looks like for a first Unreal vertical slice

1. Sign in → pick a MetaHuman doctor → land on the schedule.
2. Enter one clinic day, walk (real first-person movement) to the desk.
3. Mission notification fires.
4. Study module: view 2–3 real slide images with notes beside them → flip 3–5 flashcards → answer 3 quiz questions, all pulled from `02_content_export.json`.
5. Patient (MetaHuman) is called in, sits, chief complaint displays.
6. Walk through the 4 decisions of the `perio-staging` case, scored per §6.
7. Day Close screen shows the right tier/coins/stars for the score achieved.
8. Everything in English; Arabic strings present for the same content (pull from the `ar` fields in the export — they're already written).

If that slice looks and feels right, the loop is proven and the rest is content + polish, not more design decisions.

---

## Appendix A — deferred ideas (v2, not v1)

- Real spaced-repetition scheduling for flashcards (SM-2 or similar) instead of a same-session leftover queue.
- Multiplayer: friends studying/solving the same case together (mentioned early, never built on web — still a good idea, still v2).
- Second case per Clinic Day (needs the scoring-ceiling fix in §6 first).
- MetaHuman patient reacting with live dialogue/voice, not just facial expression state.
