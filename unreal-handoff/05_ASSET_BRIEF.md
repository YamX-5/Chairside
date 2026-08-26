# Asset Brief — what to still generate vs. what Unreal covers for free

*Yaman has unlimited Higgsfield image/video generation but no 3D-model credits. MetaHuman + Fab/Megascans (both free) cover the 3D character/environment pipeline that Higgsfield can't reach directly. This brief says exactly what's still worth generating, and where the existing assets already on disk should be reused.*

## Already on disk — reuse these, don't regenerate

- **`D:\My Apps\ideas\designs + characters\`** — the original character reference sheets:
  - `Dr.Yaman (Dentist).png`, `Dr.Miya(Dentist).png`, `Dr.Amr.png`, `Dr.Tala.png` — the four playable doctor characters (2 dental, 2 medical — see `src/game/cast.ts` `DOCTORS` for the exact names/roles already written).
  - `Dental clinic.png`, `Medical Clinic.png` — environment mood-board renders.
  - Several unnamed `hf_*.png` — patient character sheets, sliced in the web build into 8 named patients (`src/game/cast.ts` `PATIENTS`: Layla 24, Omar 8, Abu Khaled 68, Yousef 45, Khala Nadia 55, Rami 19, Sara 31, Mr. Haddad 50 — ages matter, they're used to age-match a patient to a case's stated age, never seat a child on an adult case).
  - One `.mp4` — an early first-person walk-through style reference clip.
- **`D:\My Apps\study-game\reference\`** (if the web repo is kept around) — `video-frames.jpg` / `video2-frames.jpg`, extracted frames from Yaman's two style-reference Higgsfield clips. These are the literal art-direction target for lighting/material work (see `01_GAME_DESIGN.md` §8) — worth keeping as a moodboard even after the web repo is otherwise retired.
- **`public/textures/`** (web repo) — AI-generated flat surface textures (wall/floor/wood/fabric) generated during the web build. Useful as color/material *reference* for the Unreal materials, but Megascans real PBR materials (free via Fab) should replace them outright rather than importing the flat JPGs as final textures.

## Still worth generating (Higgsfield — unlimited, use it)

### 1. MetaHuman creation references
For each doctor + each patient needed, a clean **front-facing, neutral-expression, even-lit portrait** (the existing character sheets may already cover this — check before regenerating) works as a MetaHuman Creator / photo-to-MetaHuman input. If MetaHuman's photo-fit tool wants specific angles (confirm exact requirement in `04_UNREAL_RESEARCH_BRIEF.md` §3), generate:
- Front, 3/4-left, 3/4-right — same lighting, same neutral expression, same framing (shoulders-up).

### 2. Patient mood reference (for expression authoring)
For the patient(s) actually in use, a small set per mood — **anxious / in-pain / relieved / calm** — same character, same framing, different expression. These become the reference an animator (or you) matches when authoring the MetaHuman's blend-shape poses for each mood state. (The web build already generated `anxious`/`in-pain` sprites this way — reuse the same prompts, just for MetaHuman reference instead of a 2D sprite.)

### 3. Environment mood-board / concept art
Wide shots of the clinic — reception, the study desk corner, the treatment chair, the window view — in the target style (warm/soft/Pixar). These guide material/lighting choices in Unreal; they are NOT textures to import directly.

### 4. Optional: cutscene/transition video clips
If the "walk between beats" transition idea from the web build's design carries over conceptually (see `01_GAME_DESIGN.md` §4 — real first-person walking in Unreal likely replaces this need entirely, since you can just... walk), short first-person walk clips are lower priority now. Only generate these if Unreal's actual walking movement doesn't cover a specific desired beat-transition moment.

## What NOT to generate anymore

- **Flat character sprites** (the `patient-anxious.png` style 2D cutouts from the web build) — MetaHuman replaces this need entirely with a real 3D character.
- **Flat surface textures as finals** — Megascans/Fab materials are free and higher quality; only use Higgsfield textures as a color-reference moodboard.
- **Full-scene "final" renders expecting to use them as literal backgrounds** — that was the 2.5D web approach; Unreal renders the scene live, so a background image isn't needed for the main clinic space (still fine for e.g. a distant window view or a wall-poster prop).

## Prompt pattern (carry this style line into every generation)

> *warm, soft, stylized 3D animated-film look (Pixar/Seedance style), muted cream-honey-teal palette, gentle soft lighting, clean and friendly, high quality*

This is the same style line used throughout the web build's asset generation — keep it consistent so anything new generated matches what's already on disk.
