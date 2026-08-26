# Chairside — Graphics Roadmap (gray-box → studio-stylized)

*Written 2026-07-23. The honest plan for taking the r3f clinic toward a "$30k, made-by-a-studio" look — as a solo dev with AI, for as little money as possible. Engine stays react-three-fiber; the look is an art/lighting/animation problem, not a horsepower one.*

## The reframe

"$30k / major-corp" ≈ **2–3 months of one senior artist**. It buys **art, animation, and polish labor**, not technology. The engine is never the limiter — we already took the same gray-box room to the warm, lit, post-processed build for $0. And we're building **stylized, not photoreal** — the forgiving lane, where taste closes the gap, not GPU budget.

## The 6 levers, ranked by impact

| # | Lever | Why it's the "expensive" tell | Free? |
|---|---|---|---|
| 1 | **Animated characters** (breathe, blink, react to your answer) | Biggest cheap-vs-pro giveaway | Rig/animate free (Mixamo); model costs |
| 2 | **Baked GI lighting** (bounce + soft coloured shadows) | The "pre-rendered / film-lit" look | ✅ Blender, free (labor) |
| 3 | **Real modeled props + PBR/gradient textures** | Modeled bevels + one hero prop (dental unit) | ✅ CC0 / 💰 Synty ~$40 |
| 4 | **Sound design + music** | Wildly underrated; doubles perceived budget | ✅ mostly free |
| 5 | **Juice** (DOF, camera micro-moves, particles, transitions, haptics) | "Feel" between the big moments | ✅ free, code |
| 6 | **Cohesion / art direction** | Consistent palette/proportion/lighting | ✅ free — discipline |

5 of 6 are free or nearly free. Only bespoke **models** reliably cost money (and even those have ~$20/mo AI routes).

## Done so far ($0, verified)

- **Tier 1** — Lightformer IBL (offline-safe, zero network), frozen ContactShadows, RoundedBox edges, material pass.
- **Tier 2** — post FX: N8AO + Bloom + colour-grade + Vignette + SMAA + ACES (NoToneMapping on renderer so it maps once).
- **Hands** — rebuilt from blobs into readable gloved hands (flat palm + bent-knuckle fingers + thumb).
- **Colour bug fixed** — `<color>` float triple was linear, didn't match the fog; authored as sRGB.

## The phases (what · who · cost)

**Phase 1 — Patient becomes a real character.** *(highest impact)*
Character sheet → rigged GLB (Tripo/Meshy Pro ~$20, cancel after) → Mixamo idle/breathe/talk (free) → wire to existing mood states (`calm/anxious/pain/relieved`) so they react. *You run the sheet through the tool; I wire + shader.*

**Phase 2 — Bake the room in Blender.** *(biggest "studio" lever, $0)*
Assemble room in Blender, bake Cycles GI → lightmaps, ship unlit. Film-lit, near-zero runtime cost. *You (I guide) in Blender; I integrate.*

**Phase 3 — Real environment + hero prop.**
Free Quaternius/Kenney (CC0) filler + one bought dental-unit (Fab ~$10–30). Compress KTX2 + meshopt. *You grab packs; I convert/optimize/wire.*

**Phase 4 — Materials + colour grade.**
Gradient/PBR textures (kept clean — this style wants clean surfaces, not grunge), custom LUT. *Me.*

**Phase 5 — Sound + juice.**
Ambient bed, UI/instrument SFX, light score, patient vocal barks; DOF on focus, camera micro-moves, haptics, polished transitions. *Me; you approve audio.*

**Phase 6 — 60fps everywhere.**
Draw-call merge (needs the asset/texture-atlas approach to not hurt the look), LODs, texture compression, load polish. *Me.*

## Budget tiers

| Spend | What you get | ≈ studio |
|---|---|---|
| **$0** | CC0 + Blender bake + Mixamo + free sound + post | Indie-polished stylized. ~**70%** (with labor) |
| **~$50–100** | + Synty set + 1mo AI-3D + a hero prop | "Small studio made this." ~**85%** |
| **~$500–1.5k** | + commissioned hero chars + dental unit + SFX/score pass | "Funded studio made this." ~**90–95%** |
| **$30k** | a team iterating months across the whole game | last 5–10% + breadth a study app doesn't need |

**Solo+AI realistically hits ~90% of perceived quality for ~$100–500.** $30k buys breadth/iteration, not a look you can't reach.

## Recommended order for a solo study-game

1. **Phase 1 (living patient) + Phase 5 (sound)** first — biggest perceived jump per $/hour. ~$20 + a weekend.
2. **Phase 2 (baked room)** — the free "studio light" lever.
3. Everything else layered over time.

Don't chase photoreal, don't switch engines, don't buy Synty until patient + sound are done. The hard-solo parts are Blender (Phase 2) and character-animation cohesion.

## Reference

- Style targets: the two Seedance clips (warm, clean, stylized) — `reference/video-frames.jpg`, `reference/video2-frames.jpg`.
- Progression captures: `reference/room-view3.jpg` (before) → `tier1-final.jpg` → `tier2-A.jpg`/`tier2-B.jpg` → `hands-v2.jpg`.
- Verified 2026 facts behind this plan (versions, pricing, offline-safety): see the graphics-upgrade research in the session; key ones — @react-three/postprocessing 3.0.4 + postprocessing 6.39.3 support r3f v9/React 19/three r185; drei `<Environment>` with Lightformer children is offline-safe; Tripo/Meshy pricing and Mixamo status confirmed; Ready Player Me shut down Jan 2026.
