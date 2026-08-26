# CHAIRSIDE — Build Document

*Synthesis of 9 research dimensions into one buildable plan. Written for: solo dentistry student, 8GB/2GB-VRAM laptop, zero budget, ~2 months to a YC application.*

---

## 1. The verdict on the vision

### Short answer

**The design is real and defensible. The version you described is not buildable in 2 months. The version that wins the YC application is smaller than you think and you already have 70% of it.**

Every individual system you named has a known, cheap implementation path. The problem is not any one system — it's that you named eleven of them. Below is the scope line, drawn hard.

### What is genuinely novel (and it is narrower than "first of its kind")

Run your four components against the landscape and every single one already ships, **including in dentistry**:

- **Upload your own lecture → AI case:** Neural Consult, $24.99/mo, has a dedicated `/dentistry` page, does flashcards + INBDE items + an AI clinical case simulator. This is steps 1–4 of your loop, commercially, today.
- **Multiplayer hidden-information medical education:** Team Up! (Erasmus MC, JMIR Serious Games 2022) — 4 players, each privately receives case information they must relay. Shipped on both app stores.
- **Co-op physics comedy medical sim:** Clay Clinic (6p, "physics-driven patient handling," "one bad diagnosis creates a new emergency for the whole team"), General Practice (4p), Night Shift Hospital, Healing Spree. All 2025–26.
- **AI virtual patients as a YC thesis:** SimCare AI (S24, raised $2M with Drive Capital) and Soma Lab (S24). The partner reading your application has probably already sat in a partner meeting on this category.

Every *pair* exists too. The four-way conjunction appears not to exist — but "nobody combined four existing things" is a weak claim.

**The claim that survives:** every hidden-information medical game on earth uses *hand-authored* scenarios. A human designer decided which player learns the glucose level. You would **derive the split automatically from an arbitrary uploaded PDF, with a deterministic verifier proving the case is solvable from the union of packets and unsolvable from any single one.** That is a real, hard, unsolved generation problem, it's demoable in 30 seconds, and it's the only thing here that isn't trivially refutable.

Delete "first of its kind" from every document you own. It dies to one search.

### What survives into the 8-week build

| System | Ships | Why |
|---|---|---|
| Lecture PDF → case pipeline | ✅ (you have 70%) | Existing `src/ingest/` |
| **Information split + deterministic split verifier** | ✅ **build first** | This IS the claim |
| Server-enforced hidden info (Durable Object) | ✅ | ~3–5 days, free tier |
| Commit-then-execute gate | ✅ | Server-side, ~2 days |
| 2-player asymmetric co-op | ✅ | The realistic config anyway |
| Single-player (diegetic working-memory constraint) | ✅ | Not "co-op with the constraint removed" |
| One seated ragdoll patient, motor-stiffness collapse | ✅ | You skip bipedal balance entirely |
| **3** consequence set-pieces (not 6–8) | ✅ | Error classes C, E, F |
| Waiting-room panic (kinematic NPCs + dose/threshold contagion) | ✅ | ~12 floats, deterministic, no netcode |
| Juice pass (hitstop, trauma shake, blood, gibberish audio) | ✅ | ~4 days total |
| 90-second PEARLS debrief → flashcard → FSRS | ✅ | Non-negotiable, see §6 |
| Diegetic documents (troika text on 3D planes) | ✅ | Zero new dependencies |

### What gets cut, explicitly

| Cut | Reason | When it comes back |
|---|---|---|
| **Rive** | Free plan cannot export `.riv` since 2025-10-20. $9/mo. 17-star ecosystem, zero r3f bindings, nobody has published the click-through-UV path you need. `troika-three-text` is already in your `node_modules` and solves text + crispness + Arabic RTL in one move. | v1.1, optional, card bodies only |
| **3-player as a launch target** | Build the 4-channel model; 3P is a mapping change, not a feature. Playtest 2P first — it's two roommates, it's the real config, and it's where the split most easily collapses. | Week 7, one afternoon |
| **Voice chat** | Keep Talking and Nobody Explodes has none and nobody complains. It's the single most likely thing to eat a week on mobile-audio edge cases, and none of that week demonstrates anything novel. Ship over Discord. | v1.1 (Cloudflare TURN, ~free) |
| **Active-ragdoll PID / balance** | The patient is *seated*. You need "held together, then not," which is one scalar. Bipedal balance is 80% of active-ragdoll work and buys you nothing. | Never |
| **Ragdoll waiting-room crowd** | Kinematic bodies on scripted flee splines, one instanced draw call. Physics on 8 NPCs kills your frame budget for zero comedy gain. | Never |
| **Mobile as first-class** | The 3-player physics scene is a *desktop-web demo* with a genuinely playable reduced phone profile. A scene at 60fps on your laptop runs ~30fps on a 2-year-old Android and ~20fps after five minutes of thermal throttling. | Reduced tier ships W6 |
| **Play Store TWA / iOS** | Distribution, not product. Also: Rive/Emscripten WASM needs `wasm-unsafe-eval` in CSP, which is a submission-time surprise you don't want. | Post-YC |
| **Custom characters (Meshy/RPM)** | Ready Player Me is **dead** (Netflix acquisition, shut down 2026-01-31; both domains now fail DNS). Meshy free tier is CC BY 4.0 + *public* assets. Use Mixamo + Quaternius CC0. | Never needed |
| **Error classes A, B, D as bespoke set-pieces** | Six authored set-pieces at ~4 days each is 24 days you do not have. | Post-YC |
| **LettuceDetect / NLI groundedness** | Your ordered-word-overlap ≥0.75 gate is good enough for the demo. The in-browser model is a 60–150MB download that dies on a Jordanian mobile connection on first run. | v1.2 |

### The honest scope line

> **YC demo:** one lecture PDF, uploaded live, becomes a case that two players on two laptops solve *only by talking to each other*, where the server proves neither could solve it alone; a wrong commit makes a low-poly patient collapse out of the chair while the camera holds on the tooth; a right commit gets a five-second thank-you; then a 90-second debrief turns the mistake into a scheduled flashcard. Recorded on your laptop. 8–12 pre-baked cases so it never touches the network live.
>
> **The full dream:** 3-player with voice, six error classes, Rive-animated diegetic charts, mobile-native, six-figure institutional deployment. That's 2027.

---

## 2. The architecture

### 2.1 What you already have (verified, keep)

```
react 19.2.7 · three 0.185.1 · @react-three/fiber 9.6.1 · @react-three/drei 10.7.7
vite · typescript · zod · pdfjs-dist 6.1.200 · vite-plugin-pwa 1.3.0
postprocessing 6.39.3 · motion 12.42.2 · troika-three-text 0.52.4 (via drei)
```

**Reused unchanged:**
- `src/ingest/pipeline.ts`, `prompts.ts`, `client.ts`, `verify.ts` (+ tests)
- `src/clinic/movement.ts` + `movement.test.ts`, `Player.tsx`, `TouchControls.tsx`, `input.ts`, `layout.ts`
- Save system, EN/AR locales + RTL, PWA shell, Kenney CC0 room GLBs

**Reused with modification:**
- `src/ingest/schemas.ts` — schema migration in §3 (this is week 1)
- `src/clinic/PostFX.tsx` — split into desktop/mobile profiles (see trap #14)
- `src/clinic/Patient3D.tsx` — extend `PatientPhase` union, add the additive procedural layer
- `src/clinic/PatientBillboard.tsx` — demote to far-background set dressing only

**Explicitly NOT adopted:** `ecctrl` 2.0.1 (it's a third-person platformer/vehicle toolkit that would drag in `leva` and `zustand` to move a dentist 3 metres — your tested `movement.ts` is correct), `@react-three/cannon` (dead since 2023-08-17), `three.quarks` (1.16MB for one blood burst you can hand-roll in 80 lines), Rive, Lottie (three.js `LottieLoader` is removed in r186).

### 2.2 New dependencies — the complete list

```bash
# Physics
npm i @react-three/rapier@2.2.0
npm i @dimforge/rapier3d-simd-compat@0.19.2   # SIMD build, same version as the pinned compat

# Netcode
npm i partyserver partysocket
npm i -D wrangler

# Spaced repetition
npm i ts-fsrs                                  # MIT, zero runtime deps, client-side
```

That's it. Four packages.

**Vite alias for the SIMD physics build (2–5× speedup, +68KB):**

```ts
// vite.config.ts
resolve: {
  alias: {
    '@dimforge/rapier3d-compat': '@dimforge/rapier3d-simd-compat'
  }
}
```

**Guard it** — the SIMD build needs `wasm simd128` (Safari 16.4+, March 2023). A hard alias silently bricks older iPhones with a wasm instantiation failure, not a graceful degrade. Feature-detect at boot and dynamic-import:

```ts
// src/clinic/physicsLoader.ts
const SIMD_PROBE = new Uint8Array([0,97,115,109,1,0,0,0]); // minimal simd module bytes
export const usesSimd = WebAssembly.validate(SIMD_PROBE);
```

### 2.3 System-by-system stack

| System | Choice | Notes |
|---|---|---|
| **AI generation** | Gemini 3.1 Flash-Lite, **paid**, $0.25/$1.50 per MTok | ~$0.01–0.02 per full lecture→case run. **Not the free tier** — every Gemini free tier row is marked `data used for training: Yes`, which is disqualifying for third-party university lecture PDFs the moment you pitch a dental school. |
| **Structured output** | Gemini `response_schema` (constrained decoding) | Malformed JSON becomes mechanically impossible. MedGame measured 99.5–100% strict validity for commercial models vs 58–90% for open-source. Your `schemas.ts` already pairs Zod with a hand-written JSON Schema and tests that they agree — extend that pattern, don't replace it. |
| **Cheap verification calls** | Groq free (~30 RPM, Llama 3.1 8B, 14,400 req/day) or Cerebras (~1M tok/day) | Use for the solo-solver split check — input is already-generated text, not the student's PDF, so the training-data concern doesn't apply. |
| **Netcode / authority** | Cloudflare **Durable Objects** + PartyServer/PartySocket | One DO per room *is* an authoritative server addressed by room code. Free tier ≈ **18 hours/day of 3-player room time** (requests bind first: 3 players × 10 msg/s × 20:1 billing ratio → ~5,400 req/hr against 100k/day). Drop to 5Hz and it doubles. Overflow is $5/mo. |
| **Physics** | `@react-three/rapier` 2.2.0 (+ SIMD alias) | Peer deps are `react ^19`, `three >=0.159`, `@react-three/fiber ^9.0.4` — installs into your stack with zero version negotiation. v1 is the React 18 line; ignore every v1 tutorial. |
| **Diegetic text** | drei `<Text>` → troika SDF | **Already installed.** Resolution-independent, parses .ttf/.woff directly, generates SDF atlas in a worker, `direction="rtl"` is a first-class prop, handles Arabic joining. Solves runtime text + crispness + Arabic in one move, free. |
| **Card bodies / documents** | Plain three.js geometry + Canvas2D→`CanvasTexture` | Not Rive. See §9 trap #1. |
| **Radiographs** | pdf.js → canvas → `THREE.Texture` (static, one upload) | You already run pdfjs-dist 6.1.200. Pan/zoom via `texture.offset`/`repeat` (zero re-upload) or camera dolly. Set `anisotropy = gl.capabilities.getMaxAnisotropy()`. This is the one texture that deserves memory — render at 2–3× DPR, do **not** downscale to 512. |
| **Characters** | Mixamo (hero patient) + Quaternius CC0 (crowd) | Mixamo: free, royalty-free, unlimited commercial, no attribution — **but unsupported/maintenance mode**. Bulk-download this week. Quaternius ships GLB natively (no FBX→GLB conversion, no Blender round-trip — which matters, your Blender is blocked on a RAM upgrade). |
| **Crowd rendering** | 8 plain `SkinnedMesh`, cloned via `THREE.SkeletonUtils.clone()` | ~12k tris, 8 draw calls. Do **not** build a VAT pipeline — the CPU bone-matrix bottleneck is at 100–1000 meshes, not 8. That's a 2-week detour for a problem you don't have. |
| **Audio** | Web Audio gibberish (recorded yourself) + Sonniss GDC bundles + Kenney CC0 | See §5.6. Gibberish is simultaneously the funniest, cheapest, most bilingual **and** safest option. |
| **Spaced repetition** | `ts-fsrs` | FSRS-6 beats SM-2 in ~99.6% of collections on the open benchmark and hits the same retention with 20–30% fewer reviews. That's a feature the student *feels*. |
| **Post-processing** | Existing `postprocessing` 6.39.3, split profiles | pmndrs merges every `Effect`-type effect into ONE fragment shader via `EffectPass`. Adding ChromaticAberration + Noise + Vignette costs ~one pass. The expensive things are `Pass`-type: N8AO (needs a normal prepass), DepthOfField (depth sampling). |

### 2.4 The file map

```
src/
  ingest/
    schemas.ts        [MODIFY]  + ToothFDI, Fact, Channel, CommitTriad, Consequence, Obligation
    pipeline.ts       [MODIFY]  staged/streamed emitter + content-hash cache
    split.ts          [NEW]     the deal — full case → 4 channels
    split.test.ts     [NEW]     solvability + non-overlap assertions
    verifySplit.ts    [NEW]     solo-solver loop (union ≥80% / single ≤20%)
    consequence.ts    [NEW]     deterministic sanity rules over generated consequences
    classify.ts       [NEW]     committed triad vs ground truth → ErrorClass (NO LLM)
    classify.test.ts  [NEW]
  net/
    room.ts           [NEW]     PartyServer Durable Object: deal, gate, verdict, reconnect
    client.ts         [NEW]     PartySocket wrapper
    protocol.ts       [NEW]     shared wire types (imports from ingest/schemas.ts)
    deal.test.ts      [NEW]     asserts on the SERIALIZED payload, not the in-memory object
  clinic/
    affect.ts         [NEW]     3-float patient affect core + hysteresis FSM
    affect.test.ts    [NEW]
    crowdPanic.ts     [NEW]     Durupinar dose/threshold contagion, 10Hz tick
    crowdPanic.test.ts[NEW]
    ragdoll.tsx       [NEW]     11-body seated ragdoll + motor stiffness scalar K
    consequenceFx.tsx [NEW]     hitstop / trauma / blood / burst / duck hooks
    replayBuffer.ts   [NEW]     ring buffer of transforms for the instant replay
    DiegeticDoc.tsx   [NEW]     plane + troika <Text> + snap-to-flat on pickup
    Patient3D.tsx     [MODIFY]  + procedural additive layer, extended phase union
    Player.tsx        [MODIFY]  + trauma shake AFTER the rotation write
    PostFX.tsx        [MODIFY]  desktop/mobile profiles
  study/
    scheduler.ts      [NEW]     ts-fsrs wrapper + case-level re-encounter (~3 weeks)
    debrief.tsx       [NEW]     PEARLS 4-phase, ends in card creation
```

### 2.5 The one architectural rule that keeps everything cheap

**Split the network into two channels with different guarantees:**

- **Authoritative, rare, must be correct:** the dealt packets, the locked triad, the unlocked procedure allowlist, the verdict. Single-digit messages per case. Goes through the Durable Object.
- **Cosmetic, frequent, allowed to diverge:** positions at 5–10Hz with interpolation. Ragdolls, blood, debris, waiting-room panic — **never networked at all.** The server broadcasts one event `{event:'panic', seed:8823, severity:3}` and every client runs the same seeded local simulation.

Rapier JS is **not** cross-machine deterministic and `timeStep='vary'` explicitly breaks determinism, so lockstep is off the table. But nothing about the debris is scored, so nobody will ever notice. Networking ragdolls properly is a multi-week specialist problem that buys you literally zero gameplay value here.

**Corollary:** never derive scored state from local simulation. The server broadcasts the *outcome* as a fact; local physics merely illustrates it.

---

## 3. The AI pipeline, in detail

### 3.1 The stages

```
[LOCAL, INSTANT]
1. pdfjs text extraction              → show the outline within 2s
[STREAMED — student can start reading]
2. blueprint pass                     → topic list streams into UI
3. NBME item writing                  → existing (focused lead-in, cover-the-options, homogeneous distractors)
4. review committee pass              → existing
[BACKGROUND — "your clinic is ready" notification]
5. case generation                    → CaseCore with STRUCTURED GROUND TRUTH
6. channel split                      → 4 packets
7. split verification                 → solo-solver loop, regenerate on failure
8. consequence binding                → closed enum + deterministic sanity rules
9. source verification                → existing verify.ts (ordered word-overlap ≥0.75)
```

**Stage ordering is a UX decision, not a technical one.** Nobody waits 45–120 seconds staring at a spinner. Cards and quiz unlock the study loop immediately; the clinic arrives when it arrives.

**Content-hash cache the extracted deck text.** The same lecture uploaded by 40 classmates costs one generation. In a Jordanian dental cohort where everyone has identical slides, this is your single biggest cost lever — and it's free and deterministic. Version the cache key and allow force-regenerate (one bad upload otherwise poisons the whole class).

**Ship 8–12 pre-baked demo cases in the repo.** The first run and every YC demo must be instant and never touch the network.

> **Do this in week 1:** instrument the existing pipeline and paste real timings. The 45–120s figure is inferred from call count, not measured. You cannot design the UX around a number you haven't seen.

### 3.2 The schema

This is the migration. Everything downstream depends on it, so it goes first.

```ts
// src/ingest/schemas.ts — ADDITIONS

// ─────────────────────────────────────────────────────────
// The join key. This is KTaNE's serial number.
// Only the CHAIR channel can read it off the mouth in 3D.
// Every other channel is INDEXED by it.
// ─────────────────────────────────────────────────────────
export const ToothFDI = z.string().regex(/^[1-4][1-8]$/);   // 11..48, permanent dentition

export const ChannelId = z.enum(['CHAIR', 'RECORDS', 'IMAGING', 'PROTOCOL']);

// ─────────────────────────────────────────────────────────
// A single atom of case information. Lives in exactly one channel.
// ─────────────────────────────────────────────────────────
export const Fact = z.object({
  id:          z.string(),
  channel:     ChannelId,
  tooth:       ToothFDI.nullable(),   // null = case-level (e.g. "on warfarin")
  category:    z.string(),            // PUBLIC once tabled: "medical history"
  label:       z.string(),            // the CORRECT clinical term — seeds lexical entrainment
  value:       z.string(),            // PRIVATE — only the holder ever receives this
  loadBearing: z.boolean(),           // required for the correct triad?
  sourcePage:  z.number().int(),
  sourceQuote: z.string(),            // verified by verify.ts at ≥0.75 ordered word-overlap
});

// ─────────────────────────────────────────────────────────
// Spaceteam's lesson: obligation forces speech harder than possession.
// Each channel gets a TASK it cannot resolve alone.
// ─────────────────────────────────────────────────────────
export const Obligation = z.object({
  channel:            ChannelId,
  prompt:             z.string(),          // "Confirm no anticoagulant risk on the affected tooth"
  resolvableFrom:     z.array(ChannelId),  // MUST contain a channel other than `channel`
  satisfiedByFactIds: z.array(z.string()),
}).refine(o => o.resolvableFrom.some(c => c !== o.channel),
  { message: 'Obligation must require another channel' });

// ─────────────────────────────────────────────────────────
// Obra Dinn's rule of three. Never confirm one leg at a time —
// per-answer confirmation lets a 3-player team brute-force by guess-and-check.
// ─────────────────────────────────────────────────────────
export const CommitTriad = z.object({
  diagnosisId: z.string(),
  siteFDI:     ToothFDI,
  procedureId: z.string(),
});

export const ErrorClass = z.enum([
  'A_WRONG_DX_RIGHT_SITE',
  'B_RIGHT_DX_WRONG_SITE',
  'C_CONTRAINDICATION_IGNORED',   // ← the co-op payoff: proves somebody didn't share
  'D_WRONG_INSTRUMENT',
  'E_IRREVERSIBLE_ON_REVERSIBLE',
  'F_CORRECT',
]);

// ─────────────────────────────────────────────────────────
// CLOSED ENUM. The LLM SELECTS; it never invents.
// Every value here corresponds to a hand-authored animation state.
// ─────────────────────────────────────────────────────────
export const ConsequencePrimitive = z.enum([
  'patient_calm', 'patient_flinch', 'patient_wince_vocal', 'patient_scream',
  'patient_bleed', 'patient_thrash', 'patient_bolts',
  'waiting_room_unrest', 'waiting_room_panic',
  'tray_erupts', 'assistant_recoil',
  'procedure_success',
  'generic_flinch',                 // MANDATORY FALLBACK — unknown values degrade here, never crash
]);

export const Consequence = z.object({
  primitive:  ConsequencePrimitive,
  intensity:  z.enum(['minor', 'moderate', 'severe']),
  targetTooth: ToothFDI.nullable(),
  delayMs:    z.number().int().min(0).max(4000),
  chainsTo:   ConsequencePrimitive.nullable(),   // patient_bolts → waiting_room_panic, free cascade

  // ── THE SEDUCTIVE-DETAILS GUARD. Generator REFUSES to emit without these. ──
  clinicalRationale: z.string().min(30),  // WHY this physical event follows from THIS error
  teachesFact:       z.string().min(10),  // "If the student remembers only this, what did they learn?"
});

export const CaseCore = z.object({
  id:          z.string(),
  lectureHash: z.string(),
  title:       z.object({ en: z.string(), ar: z.string() }),

  // Structured ground truth — REQUIRED for deterministic classification with no LLM at play time
  groundTruth: z.object({
    diagnosisId:        z.string(),
    siteFDI:            ToothFDI,
    correctProcedureId: z.string(),
    contraindications:  z.array(z.object({
      factId: z.string(), blocksProcedureIds: z.array(z.string())
    })),
    reversible: z.boolean(),
  }),

  facts:       z.array(Fact).min(8),
  obligations: z.array(Obligation).min(2),

  options: z.object({
    diagnoses:  z.array(z.object({ id: z.string(), en: z.string(), ar: z.string() })).min(5),
    procedures: z.array(z.object({
      id: z.string(), en: z.string(), ar: z.string(), irreversible: z.boolean()
    })).min(5),
  }),

  // Commit-then-execute, encoded as data
  commitGate: z.object({
    unlocksProcedures: z.record(z.string(), z.array(z.string())),  // diagnosisId → allowed procedureIds
  }),

  consequences: z.record(ErrorClass, Consequence),

  debrief: z.object({
    causalChain:  z.object({ en: z.string(), ar: z.string() }),
    takeawayCard: z.object({
      front: z.object({ en: z.string(), ar: z.string() }),
      back:  z.object({ en: z.string(), ar: z.string() }),
      sourcePage: z.number().int(),
    }),
    patientPerspective: z.object({ en: z.string(), ar: z.string() }),  // the empathy safeguard
  }),

  splitReport: z.object({
    unionSolveRate:  z.number().min(0).max(1),   // must be ≥ 0.80
    maxSingleSolve:  z.number().min(0).max(1),   // must be ≤ chance + 0.05
    chanceBaseline:  z.number(),
    attempts:        z.number().int(),
  }),
});
```

### 3.3 The split (`src/ingest/split.ts`)

This is the function the whole pitch rests on.

**The four channels — and the invariant that makes it work:**

KTaNE's split is **not** "each player has a different fact." It's: the Defuser holds **mutable state** and the only hands; the Experts hold **immutable rules**. If you deal A=history, B=radiograph, C=chart, all three are fact-holders — they read aloud once, everything is common ground in 45 seconds, and from that moment the best student diagnoses alone. That's the alpha-player failure mode, guaranteed, and it's the split that demos well on a slide and dies in playtest.

**At least one channel must hold a TRANSFORMATION, not a fact.**

| Channel | Holds | Type |
|---|---|---|
| **CHAIR** | The live mouth in 3D. The only hands. **The only reader of the FDI tooth number.** | Mutable state |
| **RECORDS** | Perio chart, medical history, meds, vitals — **indexed by tooth number** | Facts |
| **IMAGING** | Radiographs — **indexed by tooth number** | Facts |
| **PROTOCOL** | The decision algorithm / diagnostic criteria | **Transformation** |

**Hard invariant: whoever holds the instruments never holds the protocol.**

Deal function shape:

```ts
export function dealCase(core: CaseCore, seats: SeatId[]): Record<SeatId, Packet>
```

`Packet` for a seat contains: the `Fact` objects for its channels **with `value` intact**; for every *other* channel, only `{id, channel, category, tooth}` — existence and category, no content. That asymmetry is deliberate (see §4.5).

### 3.4 The split verifier (`src/ingest/verifySplit.ts`)

Steal HiddenBench's methodology verbatim — it's the exact programmatic test.

```
FULL PROFILE:   one solver, all four packets  → must score ≥ 80%
HIDDEN PROFILE: one solver, ONE packet only   → must score ≤ chanceBaseline + 5pp
```

Fail either bound → regenerate the split (max 3 attempts, then flag the case for manual review, never ship silently).

**The trap nobody warns you about:** the ≤20% threshold assumes the solver can't guess. With 4 options, random chance is **25% — above the threshold — so the check is unpassable by construction.** Two fixes, use both:

1. Minimum 5 diagnoses and 5 procedures (already in the schema).
2. The commit is a **triad**, so the answer space is `|diagnoses| × 32 teeth × |procedures|` ≈ 800+. Chance baseline collapses to near zero and the bound becomes meaningful.

Run the solo-solver check with the **cheapest** model (Groq free tier / Flash-Lite) — the input is already-generated text, so there's no student-PDF privacy concern, and it costs nothing.

Keep this **strictly out of the critical path.** It's N+1 extra calls; run it in background and mark the case "verified" when it lands.

Empirical backdrop worth knowing: across 15 frontier models on 65 HiddenBench tasks, multi-agent accuracy with distributed info was **30.1%** vs **80.7%** single-agent with full info — a 50.6-point gap. Communication gain collapsed at 7 agents (+0.006). That is direct empirical support for capping at 2–3 players exactly as you designed.

### 3.5 The consequence binding + deterministic sanity pass (`src/ingest/consequence.ts`)

The LLM selects a primitive from the enum. Then **code**, not the prompt, enforces:

```ts
// Rule 1: correct outcomes may ONLY map to calm/success
if (errorClass === 'F_CORRECT' &&
    !['patient_calm','procedure_success'].includes(c.primitive)) reject();

// Rule 2: severity must scale with clinical severity
if (errorClass === 'E_IRREVERSIBLE_ON_REVERSIBLE' && c.intensity === 'minor') reject();

// Rule 3: clinicalRationale must name the actual clinical mechanism
if (!mentionsAny(c.clinicalRationale, [dxLabel, siteFDI, procedureLabel])) reject();

// Rule 4: unknown primitive → generic_flinch, never a crash
```

Rule 3 is the seductive-details guard mechanised. See §6.3.

### 3.6 The classifier (`src/ingest/classify.ts`) — no LLM, ever

At play time, classifying the committed triad against `groundTruth` is pure comparison. This is deterministic-first, it's testable, and it costs nothing:

```ts
export function classify(t: CommitTriad, gt: GroundTruth, instrumentId: string): ErrorClass
```

Order of checks: contraindication (C) → irreversibility (E) → diagnosis (A) → site (B) → instrument (D) → F.

**C is checked first on purpose.** It's the co-op payoff — the consequence literally proves somebody didn't share their card.

---

## 4. The hidden-information design

### 4.1 The channels, and why each is fun

**CHAIR — "I'm the only one who can touch anything, and I can't read."**

Sees: the patient, the mouth, the instruments, the live 3D scene. Owns all physical action.

**Deliberately does NOT see:** floating tooth-number labels (they must *count*), any numeric probing-depth readout (the probe reports to RECORDS, who reads it back), any pain indicator (they read the patient's face and body — which is exactly the low-poly animation work you're already doing).

Barotrauma's designers deleted the Pilot's battery/ammo HUD *specifically* so the Engineer would have to say it out loud. Every deletion is negative work and increases communication density. **Subtract data; never subtract feedback on the player's own actions.**

Fun because: it's the only seat with hands, it's where the comedy happens, and it's genuinely tense — you are about to do an irreversible thing to a person based entirely on what two other people told you.

**RECORDS — "I'm the memory, and the only one who can calm her down."**

Sees: perio chart, medical/behavioural history, medications, vitals — all indexed by FDI tooth number.

Fun because: during the execution phase, RECORDS is the **only** player who can lower the patient anxiety meter, by finding and reading the right item ("he's needle-phobic — topical first"). It's also where the contraindication lives, so RECORDS is the seat that can single-handedly save or doom the team.

**IMAGING — "I can see inside, and I'm two millimetres from the sinus."**

Sees: radiographs, indexed by tooth number, pannable/zoomable, genuinely hard to read.

Fun because: reading a radiograph *is* the real clinical skill, and it's the only channel with a veto — "stop, you're too close." Also the seat with the most legitimately ambiguous data.

**PROTOCOL — "I know the rules and I can't see anything."**

Sees: the decision algorithm. Branches read like `if probing depth >5mm AND bleeding on probing → …`.

Fun because — this is the Harris & Hancock finding — the dependence is **mutual, not one-way.** PROTOCOL's branches can only be resolved by live measurements only CHAIR can take. Neither can shortcut the other. Mutual dependence beats one-way dependence on connectedness and social engagement in both their studies.

### 4.2 The tooth number is your serial number

Steal KTaNE's edgework mechanic verbatim. Almost every KTaNE module's rule table is keyed off information only the Defuser can see, randomised per bomb, which forces a mandatory conversation **within seconds of the game starting, before any puzzle can be attempted.**

Only CHAIR can read the FDI number off the mouth. RECORDS and IMAGING are indexed by it. Therefore the first sentence of every case is necessarily *"which tooth are we on?"* — zero-ambiguity, low-cognitive-load, gets everyone talking in under five seconds, and it happens to drill FDI notation, which dental students genuinely struggle with.

**This is the single highest-leverage mechanic transfer available to you, and it costs a schema field.**

### 4.3 Scaling 1 / 2 / 3 players

Author **four channels always.** Never author different content per player count — that's a content-cost trap you cannot afford. Vary only the mapping.

| Players | Mapping | Invariant held? |
|---|---|---|
| 3 | CHAIR / RECORDS / IMAGING+PROTOCOL | ✅ hands ≠ protocol |
| **2** | CHAIR+RECORDS / IMAGING+PROTOCOL | ✅ hands ≠ protocol |
| 1 | All four — but **not simultaneously visible** | constraint becomes working memory |

**Playtest 2P first.** It's two roommates, it's the realistic config, and it's the one where the split most easily collapses into "you read me your stuff."

**Solo must not be "co-op with the constraint removed."** KTaNE ships no solo mode and that absence is deliberate — with the manual on a second monitor the game evaporates. If your solo mode shows all four channels at once, solo is strictly *easier* than co-op, every student plays solo, and your multiplayer thesis dies.

**Replace the social constraint with a diegetic one:** the chart, radiograph and protocol are physical objects on the desk. You hold **one at a time.** Picking up the protocol puts down the radiograph. You must remember, or put down the drill and walk back. Thematically perfect, reuses the diegetic-document work, and costs you nothing extra.

### 4.4 Enforcement — server-side, and tested on the wire

The whole point is that this is *enforced*, not hidden client-side. Three implementations that fail:

- **Playroom Kit** elects one participant as host; the host is a player's Chrome tab. If the full case exists anywhere for the host to be authoritative over, one of your players has it in devtools. Also: 10 unique users/day free tier.
- **Trystero / any P2P** — definitionally impossible. No server = no party that can hold a secret. (Great for *voice*, though: a 3-player mesh is 3 connections.)
- **Rune** — rollback prediction mathematically requires every client to simulate the whole game, which requires every client to have the whole state.

**What works: the Durable Object.**

```ts
// src/net/room.ts (sketch)
export class ClinicRoom extends Server {
  async onMessage(conn, raw) {
    const msg = Protocol.parse(raw);
    switch (msg.t) {
      case 'START': {
        const core = await this.loadCase(msg.caseId);          // FULL case, server-only, never sent whole
        const packets = dealCase(core, this.seats);
        for (const [seat, pkt] of Object.entries(packets))
          this.connFor(seat).send(JSON.stringify(pkt));         // ONE-TIME filtered deal
        await this.ctx.storage.put('packets', packets);         // hibernation-safe
        break;
      }
      case 'LOCK_PRIVATE':  // iRAT — each player's private triad, sealed
        await this.ctx.storage.put(`lock:${msg.seat}`, msg.triad);
        if (await this.allLocked()) this.broadcast({ t: 'REVEAL', locks: await this.allLocks() });
        break;
      case 'COMMIT_TEAM': { // tRAT — the team triad
        const allowed = core.commitGate.unlocksProcedures[msg.triad.diagnosisId] ?? [];
        this.unlocked = allowed;                                 // SERVER holds the allowlist
        this.broadcast({ t: 'UNLOCKED', procedures: allowed });
        break;
      }
      case 'PERFORM': {
        if (!this.unlocked.includes(msg.procedureId))            // ← THE GATE. Server-side. Non-negotiable.
          return conn.send(JSON.stringify({ t:'REJECT', reason:'not_unlocked' }));
        const cls = classify(this.teamTriad, core.groundTruth, msg.instrumentId);
        this.broadcast({ t:'VERDICT', errorClass: cls,
                         consequence: core.consequences[cls], seed: this.seed });
        break;
      }
    }
  }
}
```

**The test that matters** — assert on the serialized payload, not the in-memory object:

```ts
// src/net/deal.test.ts
const packets = dealCase(core, ['A','B']);
const wireA = JSON.stringify(packets.A);
for (const f of core.facts.filter(f => !seatChannels('A').includes(f.channel)))
  assert(!wireA.includes(f.value), `Seat A packet leaked fact ${f.id}`);
```

The failure mode here is boring and human: a dev convenience path that sends the full case "for debugging" and never gets removed. A test on the wire payload is the only thing that catches it.

**Room codes come free.** A DO is addressed by name, so `idFromName(roomCode)` routes every player to the same object worldwide with no matchmaking layer, no database, no lobby service. Use a Crockford-style alphabet (no I/L/O/U/0/1) — your players will read codes **aloud** to each other, and in an Arabic-speaking context Latin-letter ambiguity compounds.

**Reconnection:** keep a session token in DO storage, mark the seat `disconnected` rather than removing it, and on reconnect re-deal that player's **original** packet from storage. Two decisions to make explicitly: (a) a dropped player's slice must **never** be redistributed to survivors, or dropping becomes an exploit for seeing more of the case; (b) pause with a 60–90s grace window via a DO alarm — for a study tool, that's the humane choice.

### 4.5 Communication: structured tokens, not voice

You cannot assume mics — cost, dorm rooms, shared connections, speech accessibility. Three shipped grammars to steal from:

- **Hanabi:** a clue names exactly one colour *or* one number, must match ≥1 card, costs a token from a shared pool of 8. What you *didn't* say carries information.
- **The Crew:** each player holds ONE radio token for the whole mission; three placement positions. A three-symbol vocabulary is enough to coordinate an entire co-op campaign.
- **Magic Maze:** total speech ban plus one physical "Do Something!" pawn.

**Use The Crew's shape.** Budget of **3 consult tokens per case.** Spending one broadcasts ONE structured statement from a fixed clinical grammar:

```
[tooth 46] [pocket depth] [7mm]
[radiograph] [periapical radiolucency] [present]
```

Diegetically this is sliding a page across the desk.

**Non-token communication is limited to naming field labels without values** — "I have something on medical history." Which forces teammates to spend a token to ask. That's Hanabi's negative information, and it's also the hidden-profile fix (§6.5).

**The non-obvious efficacy claim this buys you:** barrier tasks produce **lexical entrainment** — over repeated rounds, pairs converge on shortened shared referring expressions (Krauss & Weinheimer's canonical example: "upside-down martini glass in a wire stand" → "martini"). If your token grammar supplies `periapical radiolucency` as the cheapest option, students entrain on the correct term instead of "dark spot at the root tip." Your asymmetric split is therefore a **vocabulary acquisition mechanism**, and vocabulary is a genuine bottleneck in preclinical dental education.

**Corollary you must not break:** if the grammar lets players type free text, they entrain on student slang. The correct clinical term must be the cheapest thing to say.

Every grammar token is a user-facing string and ships EN + AR from day one.

### 4.6 The alpha-player problem — five named counters

In a dental class, the top student **will** quarterback. Your first playtest looks great (they're chatty for the observer); your twentieth is one student narrating.

The canonical counters, and which you use:

1. **Information restriction** ✅ — the whole design.
2. **Execution complexity** ❌ — you can't afford it.
3. **Uniquity / per-player upkeep** ✅ — the anxiety meter (§5.4) gives every role a job during execution.
4. **Imperfect cooperation** ❌ — do NOT add a traitor role. A player optimising a private goal will deliberately teach teammates wrong clinical content, and it destroys the hypercorrection feedback signal.
5. **Roleplay** ✅ — free, they're literally playing dentist.

**Plus the strongest one, which is also the best-evidenced pedagogy in the whole document:** the **private individual commit before the team commit.** Each player privately seals a triad; all reveal simultaneously; disagreement triggers the discussion. The alpha player cannot pre-empt an answer that is already sealed.

This is Team-Based Learning's iRAT→tRAT sequence, which dental schools already run. Meta-analysis of 11 studies, 1,575 health-professions students: team RAT vs individual RAT **SMD = 2.027, 95% CI [1.657, 2.486]**. Naming TBL in your YC application makes the mechanic institutionally legible in a way "asymmetric co-op" never will.

(Honest caveat: that SMD partly reflects that groups mechanically outperform individuals on the same items. It's evidence the mechanic engages, not proof of durable learning. Don't overclaim it.)

### 4.7 Never lie to the player

The distinction is load-bearing: **misreading is the fun; deception by the game is not.**

KTaNE's first rule is that rules must be totally unambiguous — *"if players are forced to guess, or feel forced to guess, they're either going to be wrong and feel cheated, or be right and feel unsatisfied."* They removed capital O from serial numbers because it read as zero.

**A radiograph that is genuinely hard to read is NOT a red herring — it is the actual clinical skill.** The DATA may be ambiguous in the way real clinical data is ambiguous. The GAME's rules and feedback must never be.

**This constrains your ingest:** the review-committee pass needs a new check — *"is this decision unambiguously resolvable from the union of the split channels?"* Your LLM item-writer will happily generate a case where the correct answer requires a fact that landed in nobody's channel. That's an unwinnable round and it reads as the game cheating. The split verifier's `unionSolveRate ≥ 0.80` bound is what catches it.

---

## 5. The consequence system

### 5.1 The commit — four design moves, each from a shipped game

**1. Batch the verification (Obra Dinn).** Never confirm one leg at a time. Obra Dinn only locks in answers when three complete correct entries exist simultaneously, explicitly so players can't brute-force by guess-and-check. Your triad `{diagnosis, siteFDI, procedure}` verifies as a unit. In a 2–3 player game where players could otherwise spam options, this is what preserves the deduction — and no single player holds all three legs.

**2. Show the stake before the commit (Ace Attorney).** From *Justice For All* onward, the portion of the Confidence Gauge you're about to lose **glows orange before you commit**, and risky accusations glow bigger. Your commit panel shows, pre-commit: `IRREVERSIBLE — this extracts a tooth` vs `REVERSIBLE — this is a diagnostic step`. In co-op that glowing stake is also the social pressure device: everyone sees what the team is about to bet.

**3. Capture confidence.** A "how sure are you?" dial on the commit lever. This is not decoration — it is the variable that predicts whether the feedback sticks (§6.2). It's also a free difficulty signal and a free spaced-repetition scheduling input.

**4. The dread interval (Papers, Please).** After the team pulls the lever, **do not resolve.** Hold **2.5–4 seconds** of diegetic dead air — the chair whirs, the suction gurgles, the fluorescent buzzes — then resolve. That interval is where the metacognitive surprise loads. It costs one timer and some ambient audio and it is **the highest-value-per-hour item in this entire document.** Test at 3s; longer and three co-op players start talking over the beat.

### 5.2 The gate

The locked diagnosis maps to `commitGate.unlocksProcedures[diagnosisId]` — an allowlist held **on the server**. Anything outside that list is rejected before it reaches physics. No model call at play time, ever.

### 5.3 The wrong-answer chain — beat by beat

Trigger: server broadcasts `{t:'VERDICT', errorClass, consequence, seed}`.

```
t=0        ANTICIPATION — 150–250ms of AUTHORED keyframes.
           Eyes widen. Shoulders rise. Grip tightens on the armrest.
           ▸ This is what makes the audience laugh. Pure physics without
             anticipation reads as broken, not funny.

t=+200ms   IMPACT — one loud transient on the exact frame + HITSTOP.
           <Physics paused> for 80–120ms (5–7 frames @60). Rendering continues.
           ▸ It's a built-in prop. Do NOT use timeStep='vary' — the readme
             warns it causes instability and breaks determinism.

t=+320ms   COLLAPSE — lerp the global joint-motor stiffness K from 1 → 0 over ~250ms.
           Every spherical/revolute joint reads K. That single scalar IS your
           entire active-ragdoll system.
           Seed the ragdoll bodies from the CURRENT bone world transforms AND the
           animation's current bone velocities — the difference between a ragdoll
           that flops convincingly and one that looks dropped from rest.
           ▸ ONE-WAY ONLY. Animation → ragdoll is cheap. Ragdoll → animation
             (get-up blend) is where studios sink months and you never need it.

t=+320ms   TRAUMA SHAKE — in Player.tsx's existing useFrame, AFTER the rotation write.
           trauma -= dt*1.8;  shake = trauma²  (squaring is what makes small hits
           feel small); drive offset from Perlin with a SEPARATE SEED PER AXIS,
           never Math.random() per frame (random reads as jitter, noise reads as shake).
           3D → rotational only, cap ≤1.5°. Roll is the axis everyone omits and
           it's the one that sells impact.
           ▸ Do NOT use drei <CameraShake> — it takes the camera in its own useFrame
             and will fight your Player.tsx rotation write.

t=+400ms   BLOOD, three layers, three different cheapest answers:
           • SCREEN: a position:fixed pointer-events:none <div> with a pre-authored
             WebP, animated with motion@12. Zero draw calls, runs on the compositor
             thread, survives a GPU-bound frame, trivially art-directable, and
             swappable for a cartoon star-burst by a "reduce gore" toggle.
           • SURFACE: ONE <instancedMesh> of unit quads with polygonOffset, oriented
             by the contact normal from onCollisionEnter, ring-buffered at a hard
             cap of 24–48. NEVER DecalGeometry/drei <Decal> — each one rebuilds
             geometry, adds a draw call, and visibly replicates around corners
             (three.js #21187). Flat-shaded low-poly is the ONE art style where a
             flat oriented quad reads as correct.
           • AIRBORNE: hand-rolled instanced quads, 40–80, velocity+gravity in
             useFrame. Do not install three.quarks for this.

t=+500ms   TRAY ERUPTS — InstancedRigidBodies. ~20 instruments = 20 real dynamic
           bodies in ONE draw call. forEach over the ref array applying randomised
           impulses. Best effort-to-comedy ratio in the whole project.

t=+800ms   CONTAGION TICK (10Hz, not per-frame). ~12 floats, deterministic given
           the seed → runs identically on every client with zero netcode.

t=+2.5s    SET-PIECE THRESHOLD on a single global clinicChaos ∈ [0,1]:
           0.3 → one patient stands and edges toward the door
           0.6 → the receptionist shouts, the phone rings off the hook
           0.9 → full evacuation
```

**Contagion update rule (Durupinar dose/threshold, with the SOSa-SPSa "emotionally stable node"):**

```
dose_i += dt * Σ_{j∈radius r} w(d_ij) * expressivity_j * panic_j
dose_i -= dt * decay * dose_i
dose_i -= dt * Σ_{k∈staff} θ * calmAuthority_k * w(d_ik)     ← the immune node
w(d) = clamp(1 - d/r, 0, 1);   r ≈ 3m
threshold_i = 0.35 + 0.5 * neuroticism_i                      ← rolled once at spawn
if dose_i > threshold_i → panic_i = 1; play BOLT
```

The per-agent threshold is what makes propagation feel *authored* rather than uniform — the jumpy patient goes first, the stoic one holds out, and the moment the stoic one finally bolts is the payoff. `expressiveness` and `openness` (both ∈ [0.5, 1.5]) **are the entire personality system.**

**The staff/assistant as an immune node** (U-SOSPa-SPSOa's "emotionally stable group — professionals such as doctors") gives a player a mechanically real reason to leave the chair and go calm the waiting room. That's a second co-op job that isn't answering questions.

**Two tuning rules that matter more than the algorithm:**
- Tune so the wave takes **2.5–4 seconds** to cross the room. At 0.4s the player misses it entirely. The comedy is in the wave, not the endpoint.
- Stagger the flee latch with a per-agent reaction delay ~U(0.15s, 0.9s). Simultaneous reactions look like a bug; staggered reactions look like a crowd. **One line, and it's the difference between "cheap" and "alive."**

Expose `decay`, `threshold`, `r`, `ALARM` as dev-panel sliders on day one. Tuning is the whole job.

### 5.4 The patient anxiety meter — and why it saves the execution phase

Your loop is commit-then-execute. During execute, one player has the handpiece and two have nothing. That is the escape-room "linear bottleneck," the single most-cited failure in the genre.

**Fix that also generates the comedy:** patient anxiety is a live meter, not a global clock.

- **CHAIR's** actions raise it (idle time, wrong instrument pickups, painful steps).
- **RECORDS** is the only player who can lower it (reading the right history item).
- **IMAGING** is the only player who can call "stop, you're 2mm from the sinus."

All three are active. The meter is diegetic, readable, and *is* the trigger for the bolt-from-the-chair. It's also a soft, player-influenceable timer — which resolves the time-pressure question correctly:

> **Deliberation phase: untimed, but with a visible consult-token budget** (scarcity without a clock — a countdown on the diagnostic phase converts your study tool into a test-anxiety machine and suppresses exactly the peer explanation that produces the learning gain).
> **Execution phase: governed by the anxiety meter**, which is genuinely reducible.

A meter that only ever rises is a countdown with extra steps. It must be reducible or you've reintroduced the harm.

**The patient affect core** (`src/clinic/affect.ts`, ~120 lines, dependency-free, testable via `npx tsx`):

```ts
// 3 floats. Asymmetric approach is the whole trick.
target   = clamp(base + Σ stimulus, 0, 1)
arousal += clamp(target - arousal, -FALL*dt, +RISE*dt)   // RISE≈4.0/s, FALL≈0.08/s
// Fear arrives in 0.25s and leaves over 12s. That asymmetry is what makes a
// wrong move FEEL wrong rather than a number changing.

effective = raw * (1.4 - 0.6*trust)
// trust GATES whether arousal rises at all. A careful team gets slack; a team
// that already hurt her has a hair trigger. Genuine escalation, zero extra content.
```

FSM on top with **hysteresis** (Schmitt trigger, −0.08 offset downward): `CALM <0.25 → UNEASY → FLINCHING → SCREAMING → BOLTING >0.85`. Without hysteresis the patient visibly chatters at boundaries — this is a correctness requirement, not polish. **BOLTING is a latch**, not a threshold, or you get a patient frozen half-standing when arousal dips mid-transition.

### 5.5 The camera rule — the single most important decision in this section

Easterbrook's cue-utilisation hypothesis: high arousal **narrows** the scope of cues processed, focusing attention on details central to the source of arousal and **degrading memory for peripheral details.** Mather's object-based framework: arousal strengthens binding *within* an object.

**Therefore: at the arousal peak, the camera must be framing THE TOOTH, not the fleeing patient.**

Freeze on the tooth. Highlight the tooth. The chaos happens in the **periphery of the frame** — audible, visible, but not the subject.

If the central object is "a funny man ran out of a room," you have built an extremely effective machine for remembering the joke. If it's "the tooth I drilled," it works as designed.

This costs nothing to get right at the start and is expensive to retrofit into every set-piece later.

**Corollary:** arousal helps `this tooth → this outcome` and may actively *impair* `this tooth → the three-step reasoning chain that got us here`. **The reasoning chain belongs in the calm debrief screen, never in the loud moment.**

### 5.6 The right answer — Peggle's asymmetry, and it is not optional

Your instinct is correct: *if wrong is fun and right is boring, players optimise for wrong.* Peggle is the proof-by-construction of the fix. Its win state is deliberately disproportionate — slow-motion and a drum roll as the ball approaches the final peg, then fireworks and Ode to Joy across the whole screen.

Three structural lessons:

1. The success beat is **non-interactive.** You take the controls away and make the player watch. That's what signals "this is the important thing."
2. **Slow-motion is reserved for success** — inverting the usual action-game convention so it becomes the game's signature reward texture.
3. It is **longer** than the failure beat.

**Build: failure beat 2–3s. Success beat 5s.**

The thank-you sequence, five beats over ~7 seconds:

```
1. THE BEAT OF NOTHING (0.8–1.2s) — cut the drill audio HARD, drop to room tone,
   zero the procedural tremor, let breathing visibly slow.
   ▸ SILENCE IS THE REWARD. Most games skip this and lose 80% of the effect.
2. RECOGNITION (0.5s) — gaze target switches from the instrument to the dentist's FACE.
   One float. This is the moment the player feels seen.
3. GRATITUDE (1.5s) — small-smile blendshape + a two-syllable RISING-pitch gibberish
   warble + one head nod. Rising pitch reads as gratitude universally.
4. EXIT (3s) — stand, walk to the door, and ONE LOOK BACK before leaving.
   A backward glance is a single keyframe and it converts "NPC despawned" into "person left."
5. STING — two warm notes, major, ~1.2s. RESIST the trophy jingle. The register is
   relief, not victory.
```

Camera: a slow ~4s narrowing of FOV by 15–20% during beats 2–3, eased over 0.6s (faster reads as a bug), then release. Mix: duck everything but the patient by −12dB during beats 1–3 — **the mix does more work than the animation.**

Ship a skip after N successes, but never for first-time-correct on a NEW case.

### 5.7 The anti-optimisation rule

**Failure pays in STORIES. Success pays in every unit of scarce progression currency.**

Everything the player accumulates — case mastery, unlocked decks, streak, leaderboard — accrues **only** on correct commits. The spectacular failure gives narrative reward (a clip, a screenshot, a thing to retell) and **zero** progression.

If you ever find yourself adding "chaos points," the game is finished as an educational product.

Corollary for the pitch: your retention metric is *"correct-commit rate rises across sessions on the same lecture"* — and that metric is only meaningful if failure is uncompensated. Streamers and TikTok clips will feature failures almost exclusively; that's free marketing, don't let it mislead you into rewarding failure in the economy.

**Operational test for every wrong-answer outcome:** a player must be able to describe it to a friend in one sentence **that includes the clinical cause.**

> ✅ "We drilled a tooth that was already necrotic and the guy screamed and knocked the tray into the waiting room."
> ❌ "We lost 20 points."

Write the sentence first, then build the consequence to produce it.

### 5.8 The instant replay — your TikTok unit

During a consequence, sample position+quaternion of the ~12 ragdoll bodies + the instrument at 20Hz into a fixed ring buffer. **12 × 7 floats × 20Hz × 5s ≈ 34KB.** Nothing.

On replay: set bodies to `type="kinematicPosition"`, drive `setNextKinematicTranslation/Rotation` from the buffer, fly a different camera. Slow-motion is free (change playback rate). Freeze at the moment of contact, label the tooth, print the finding that was ignored.

**Anchor the annotation to a named bone/socket, not a world position** — the label must track the correct tooth across the replay or it teaches nothing.

This is also the single most shareable artefact the game can produce, which matters on a two-month runway.

### 5.9 The didactic voice speaks DURING the chaos

Bennett Foddy's narration plays *during* failure — calm academic voice delivering the teaching point exactly when the player has just lost an hour. Arousal is peaking, attention is captured, and per the hypercorrection mechanism that is precisely the window where corrective feedback lands hardest.

Your version: a deadpan supervising-consultant delivers the clinical explanation **while a patient sprints past the camera.**

Foddy also **capped** it — the narration exhausts and stops, because past a certain number of falls "you probably didn't want to be bothered anymore." Rotate lines; go quiet after N repeats of the same error rather than nagging.

**v1 is on-screen text in a diegetic speech bubble, not voice.** Two languages of voice acting is a recurring cost you don't have, and text is better for a student studying silently in a library — which is most of the actual usage.

---

## 6. What the learning science demands

Stated as build requirements. These are not theory; each is a ticket.

### 6.1 The debrief is not optional — it is half the product

Simulation education is emphatic: **the sim is the stimulus, the debrief is the intervention.**

The meta-analysis closest to your design (Rajendran et al., Cureus 2023, 6 RCTs, n=384) found simulated patient harm reliably elevated stress (pooled SMD 0.63) but improved knowledge retention in only **3 of 5** studies — and the authors attribute the retention benefit specifically to **the debriefing phase.**

**The enabling finding:** a 2026 systematic review and meta-analysis found **peer-led debriefing statistically non-inferior to instructor-led** across DASH and organised-debriefing measures. An RCT of 61 medical students found peer-led as effective as instructor-led on non-technical skills (p=0.147, n.s.). So you can ship a structured self/peer debrief with no faculty in the loop and stand on published equivalence data.

**BUILD: a 90-second PEARLS-shaped debrief phase.**

```
[0–10s]   REACTIONS — one-tap emoji/voice. Pure venting, NO analysis.
          ▸ Feels skippable to a developer optimising pace. It is the one
            phase the literature says not to cut — unvented affect
            contaminates the analysis phase.
[10–25s]  DESCRIPTION — the game states the case facts as a one-line
          auto-generated timeline. No discussion.
[25–70s]  ANALYSIS — ONE advocacy-inquiry prompt, deterministically selected
          from the decision log (highest-weighted logged error, no LLM):
          "I saw you committed to extraction before the anticoagulant check
           came back — I'm curious what led there?"
          ▸ ONE error, the highest-leverage one. Not all of them.
[70–90s]  SUMMARY — the take-home rule in one sentence + THE TAKEAWAY CARD
          ENTERS THE FSRS QUEUE IMMEDIATELY.
```

**The last act of every debrief is card creation.** That is what wires the debrief to the spacing engine and makes the two evidence bases compound instead of sitting side by side.

90s is aggressive (published debriefs run 2–3× scenario length). Treat it as the floor and A/B it.

**Also required in the debrief:** an attributable post-mortem showing each consult token spent, who spent it, what they broadcast, and where it diverged from source — anchored to `sourcePage`/`sourceQuote` via your existing `verify.ts`. This is your strongest demo beat: the game doesn't just say "wrong," it says *who was wrong, about what, and points at the slide.*

Frame it as **"where the information broke,"** not "who lost." Show the chain, not a culprit badge.

### 6.2 Retrieval practice + spacing — the strongest evidence you have

Spaced repetition in medical education: **SMD = 0.78, 95% CI [0.56, 0.99], p<0.0001, 13 studies, 21,415 learners.** That is larger, tighter and better-powered than any pooled game-based-learning estimate.

**The paper that IS your business case** — a national prospective study of 293 pediatric residents sent daily retrieval-practice questions by text found **no significant difference** vs control, because *"most participants answered very few, and many answered none at all."* The intervention was correct; the delivery was ignored.

> **The honest pitch is: "we solve the adherence problem of the best-evidenced study method."** Not "games teach better than lectures."

**BUILD:**
- `ts-fsrs` integration against your save system.
- **Case-level re-encounter at ~3 weeks, not 1 week.** The two-stage collaborative exam study found the retention benefit at a 23-day delay (χ²=4.37, p=0.037) and **nothing at 9 days** (χ²=0.71, p=0.40). If you re-test failed cases at one week you may measure nothing. Hypercorrection also decays: high-confidence errors *return* after a week.
- Expose target retention as "exam mode" vs "maintenance mode" rather than hiding the algorithm.
- **The product must be a habit.** Multi-session beats single-session by ~75% (knowledge SMD 0.76 vs 0.43 across 40 RCTs, n=8,764). Your metric is sessions-per-user-per-week, not minutes-in-session. A one-shot "upload → play once → done" loop is the single-session condition and it is the version most likely to produce a null result.

### 6.3 The seductive-details line — the biggest threat to your design

This is the finding most likely to be raised by a dental-school academic, and you currently have no answer.

- Overall meta-analytic effect of adding interesting-but-irrelevant material: **g = −0.33** (small-to-moderate **harm**).
- **In surgical skills:** a study in *Surgery* on laparoscopic suturing found the control group outperformed the seductive-details group on **both** the primary and transfer tasks (both p<0.05), with mediation analysis confirming increased mental workload as the mechanism.
- **In emotional clinical content specifically:** vignettes containing emotionally engaging malpractice information produced recall of **fewer** case-specific clinical details — **12.19% vs 19.43%, p=.007.** That is your screaming, bolting patient, in a published experiment.
- **Humour:** the irrelevant-humour group scored **worse than control** on transfer. Crucially, humour that was course-related but *cognitively non-functional* was **still harmful.** Topic-relatedness is not sufficient.

**THE RULE THAT SAVES IT — CAUSAL ISOMORPHISM:**

> Every comedic consequence must be a physical dramatisation of the **specific clinical error**, such that a player who remembers only the joke has thereby remembered the mechanism.

✅ The patient bolts **because** the team committed to extraction without checking the anaesthetic — the flight *is* the pain response. The memorable thing and the examinable thing are the same object.

❌ Patient screams AND bleeds AND thrashes AND the waiting room stampedes, identically, on every wrong answer. That is a generic punishment animation: peripheral, identical across errors, carries zero diagnostic information.

**BUILD REQUIREMENTS:**
1. `Consequence.clinicalRationale` (min 30 chars) and `Consequence.teachesFact` are **required schema fields**. The generator refuses to emit without them, and rule 3 in `consequence.ts` verifies the rationale names the actual diagnosis/site/procedure.
2. Consequences are **keyed to error class**, not to individual questions — six classes covers every generated case forever.
3. **Non-diagnostic slapstick is quarantined.** The axe, flying objects, generic ragdolls belong in the lobby, between rounds, and the failure-summary screen — **never on-screen during reasoning.** A 2026 study found *topic signals* (visually marking tangential content as thematically independent, e.g. in a distinct frame) "mitigated and possibly even offset" the penalty. A visually-quarantined "chaos cam" corner is defensible; chaos in the main viewport is not.
4. **The axe survives only if picking it up is itself a scored instrument-selection error (class D).** As a free-floating gag it costs you retention.

**The test to apply to every gag:** *"If a student remembers only this animation and nothing else, what clinical fact have they retained?"* If the answer is "that I got it wrong," cut it or move it.

### 6.4 Phase gating — one demanding channel at a time

You are stacking intrinsic load (clinical reasoning — irreducible and desirable), extraneous load (3D chaos, physics, hidden-info UI), and split attention (info across players + diegetic documents in perspective).

Evidence this isn't theoretical: the laparoscopic study's mediation showed *increased mental workload* was the mechanism; a 2026 study found realistic AI avatars caused split-attention with extraneous load **d = 0.66** — moderated by display size, negligible on small screens. So some risk self-limits on phone and *gets worse on desktop*, which is where your demo lives.

**BUILD: hard-gate the round.**

```
PHASE 1 · INFORMATION   physics FROZEN, camera locked, no timer, only documents interactive
PHASE 2 · COMMIT        everything else dimmed; private lock → simultaneous reveal → team triad
PHASE 3 · EXECUTE       chaos and physics live here. Reasoning is DONE, so load is cheap.
PHASE 4 · DEBRIEF       static, quiet, no motion
```

Your instinct will be to run these simultaneously for energy. **That is precisely the version that produces a null result.**

**Diegetic documents:** keep them diegetic to *pick up*, non-diegetic to *read*. On interaction, snap the document to a flat, full-frame, screen-space view. Reading a chart rendered in perspective inside a moving scene is textbook split attention.

Low-working-memory students are the most vulnerable to every one of these effects — and they are the students who most need the product and are most likely to churn. Phase gating protects exactly the users the business needs.

### 6.5 The hidden-profile failure mode

In the hidden-profile paradigm, groups where the correct answer requires pooling uniquely-held information **reliably fail** — they preferentially discuss what everyone already knows. Quantified: teams were **three times more likely** to discuss incidents commonly known to the majority. A VR/videoconference/face-to-face comparison found all three media replicated the bias equally, so richer presence doesn't fix it.

Left alone, your rounds will converge on whatever two players share and quietly discard the one card that cracks the case. That's a *fun* failure but a *learning* failure — and worse, it teaches that unshared data is ignorable.

**BUILD, two mechanisms:**

1. **Forced tabling.** The commit button stays locked until every player has explicitly *tabled* each of their cards. Do not rely on players volunteering — the entire literature says they will not. **But table EXISTENCE and CATEGORY only, not content.** "I have a radiograph" appears; describing it well is still a skill, and the "you didn't tell me!" moment survives.
2. **Shared external representation with visible empty slots.** A physical chart on the desk that fills in as facts are tabled, visible to all. The same study that found the 3× bias found visualization tools mitigated it. **Empty slots are the single cheapest intervention here** — they make unshared information *conspicuously absent* rather than invisible.

### 6.6 The pre-brief, the empathy safeguard, and the institutional switch

There is a 2026 paper in *Frontiers in Medicine* specifically about gamifying clinical suffering. It warns that translating patient pain into point systems raises profound ethical concerns and that gamification may worsen the documented empathy decline in medical training.

**It does not reject game-based learning.** It explicitly distinguishes harmful designs (competitive, rewards-driven) from beneficial ones (**cooperative, narrative-driven, perspective-taking**) and calls for structured reflection. Your co-op mode is on the correct side of the line it draws, and your debrief IS the safeguard it names as missing.

**BUILD:**
1. **Pre-brief screen** on first play, bilingual: this is a comedy about *decisions*, not a simulation of harming people. Cheap, evidence-backed psychological safety.
2. **NOBODY DIES.** Ever. Patients flee, scream, bleed comically, knock things over. The moment a patient dies, the register flips from slapstick to harm and takes both the comedy and the professional credibility with it. The bolt-out-the-door is a **social** failure — embarrassment and chaos — not a medical one.
3. **The joke targets the OPERATOR's incompetence, not the patient's suffering.** This is load-bearing. Surgeon Simulator's comedy is your own flailing hands; the patient is a prop in a joke about *you*. The instant the framing becomes "look at this person suffer," it's cruelty.
4. **Never map onto a vulnerable category** — no screaming children, no elderly patients in distress, no disability as punchline.
5. **Cap any distress state at ~4 seconds.** Slapstick is fast; pain that lingers becomes suffering.
6. **`debrief.patientPerspective`** — one line: *"the patient left in pain and did not rebook."* Cheap, it's the perspective-taking element the paper endorses, and it converts your strongest ethical objection into a documented design response.
7. **Ship a "Professional presentation" toggle** — full simulation, all failure consequences, comedy dialled down (no axe, muted vocalization, distress without bolting). ~2 days. It converts the biggest university objection into a non-issue and is a good YC answer to "how do you sell into schools?"

### 6.7 Low-poly is a pedagogical ASSET, and you should say so

A landmark review concluded there is a **minimal relationship between simulation fidelity and transfer of learning.** An RCT found high-fidelity produced no advantage over low-fidelity on knowledge or performance — the low-fidelity group scored significantly better on several sub-items — while high-fidelity induced **overconfidence**, "misconceived self-assessments in terms of actual abilities," which the authors call *"an adverse learning tool."*

> **YC line:** *"We chose low fidelity because the evidence says fidelity doesn't drive transfer and high fidelity drives overconfidence. Nobody finishes a flat-shaded comedy round believing they can now extract a molar."*

**The one hard boundary:** to avoid negative transfer on fine motor skills, a simulator must accurately reproduce the required movements. **Therefore CHAIRSIDE never presents itself as psychomotor training.** Cognitive and decisional claims only. Marketing the axe as "instrument practice" is exactly what the literature warns against.

### 6.8 Isomorphic items — your in-product efficacy metric

Smith et al. (Science, 2009) is the paper that justifies the whole product: students answered individually, discussed with neighbours, revoted, then answered an **isomorphic** question (same concept, different cover story) individually with no discussion. Performance on the isomorphic item improved — **including in groups where no student had initially chosen the correct answer.** That rules out copying.

Your item writer already produces NBME-style items with homogeneous distractors. Generating an **isomorphic twin per item** is a small extension and gives you a defensible in-product transfer metric.

(The 2011 follow-up: peer discussion *alone* is weaker than discussion followed by instructor explanation. Your debrief IS the instructor explanation. It is not polish, it is half the effect.)

---

## 7. The competitive truth

### 7.1 Name these four unprompted, in this order

A YC partner finds Neural Consult in 30 seconds. Naming it yourself converts a threat into evidence of rigour.

| Competitor | What it is | Your contrast |
|---|---|---|
| **Neural Consult** ($24.99/mo, `/dentistry`) | Upload dental lecture → flashcards + INBDE items + AI clinical case simulator. Text chat. Your steps 1–4, commercially, in your vertical. | Text-chat cases have no embodiment, no team, no consequence, no split. Their existence proves the AI-case layer is a **commodity**, not the invention. |
| **Team Up!** (Erasmus MC, JMIR Serious Games 2022) | 4 players, different roles, each privately receives case info they must relay. Shipped on both stores. | **Hand-authored** by a game studio for a fixed scenario set. You generate the split. |
| **Clay Clinic / General Practice** (2026, Steam) | 6p/4p chaotic co-op medical sim, "physics-driven patient handling," "one bad diagnosis creates a new emergency for the whole team." | These invent **fictional** medicine. You generate from the student's **actual graded curriculum**. Treat the genre as proof of demand and market timing. |
| **SimCare AI / Soma Lab** (both YC S24) | AI-simulated patient encounters, sold to institutions. SimCare raised $2M with Drive Capital. | Institutional OSCE-practice/compliance play. You're student-bought, content-your-own, embodied, social. **SimCare does not list dentistry** — the dental vertical is still open at YC. |

**Also be ready for, unprompted:**
- **Space Station 13** — a partner who plays games will raise it. Pre-empt: *"SS13 proved deep chaotic multiplayer medicine retains players for 20 years with zero budget and programmer art — it just was never real medicine and never anyone's actual curriculum."*
- **Keep Talking and Nobody Explodes** — will be named in the first 30 seconds. Have the narrowed claim ready.
- **YC's dental portfolio** (Denta, Avora, Toothy AI, Adravision, Rinse) is **entirely practice operations, zero dental education.** That's a usable line: *"YC has funded dental ops and med-ed sims. Nobody has funded dental education."*
- **Simodont / DentSim / Virteasy / SIMtoCARE** — six-figure institutional hardware teaching *manual psychomotor skill*, one student per box, bolted to a preclinical lab. Your cleanest win. **Do not state a dollar figure you can't source** — all are quote-only. Say "six-figure institutional hardware, quote-only."

### 7.2 The exact phrasing that survives

> Neural Consult ($24.99/mo) already turns a dental student's lecture into text AI cases. Team Up! (Erasmus MC, JMIR 2022) already proved hidden-information co-op teaches clinical teamwork — with hand-authored scenarios. Clay Clinic and General Practice already proved co-op medical chaos sells in 2026 — with fictional medicine.
>
> **We are the first to automatically generate the information split.** Upload any lecture, and the system partitions the case so that no single player can solve it alone, and verifies that property deterministically before the case is ever playable. Nobody has *generated* asymmetry before; they have only *authored* it.

Line by line, that survives a search.

**Rules for keeping it true:**
- Delete "first of its kind" from every document you own.
- The claim is only true while it stays specific. "First AI study game" or "first multiplayer med-ed game" is false again.
- Be ready for *"why can't Neural Consult ship this next quarter?"* The honest answer: the split itself is a prompt-engineering problem someone could copy in weeks. **The durable moat is the verified ingest pipeline + the dental curriculum wedge + distribution**, not the split. Say that. It reads as clear-eyed.

### 7.3 The number that will actually win

Nobody has published a dental-specific case-generation accuracy number. That is simultaneously your risk (unknown error rate on periodontal staging, caries classification) and your opportunity.

**Before you submit: personally grade 50 generated dental items against the source lectures and report the real number.** A founder-measured accuracy figure on his own domain is worth more in that application than every citation in this document.

The pitch line that survives scrutiny: *"every generated item is traced to a verbatim source span in the student's own lecture, and unverified items are flagged, not shipped"* — **not** "our AI produces clinically valid cases."

### 7.4 One diligence item you must do

**SimX markets itself as "the only patented platform designed for multiple learners to work as a team in the same space."** There are also granted US patents on asymmetric-information multiplayer sessions (**US 9,873,043** and **US 10,661,165**).

Your headline mechanic sits at that intersection. This is not a reason to stop — the claims are likely narrow and VR/co-located-specific, and you're a browser PWA with AI-generated content. **But read claim 1 of both patents yourself.** Google Patents, free, 1–2 days. A partner asking "has anyone patented this?" must not get a blank stare.

---

## 8. The 2-month plan

**Ordering principle: build the thing the claim rests on first, in the cheapest medium, before any 3D exists.**

The split verifier is pure TypeScript plus cheap model calls. If it doesn't work, nothing else matters. Do it in week 1 with a placeholder DOM UI.

### Week 0 (this week, before anything)

| Task | Why now |
|---|---|
| **Bulk-download every Mixamo clip you'll ever want. Commit the FBX.** | Free, royalty-free, unlimited commercial — but unsupported maintenance mode with no SLA. The licence grants perpetual use of what you've downloaded; it does not obligate Adobe to keep the servers up. Clips by name: Walking, Sitting, Sitting Idle, Sit To Stand, Standing Up, Terrified, Scared, Yelling, plus the reaction/flinch set. |
| **Ask your faculty about ethics approval for an in-course educational evaluation.** | This is the single most likely reason the study never happens. Many institutions treat in-course educational evaluation as exempt or expedited. Ask before building anything. |
| Download Quaternius Universal Base Characters + UAL2 (CC0, ships GLB). Download Sonniss GDC bundles. | Free, and the harvest is one afternoon. |
| Create `public/audio/LICENSES.json` (filename → source/license/author/url). | Costs nothing today, becomes an emergency during YC diligence. |
| Read US 9,873,043 and US 10,661,165 claim 1. | See §7.4. |
| **Instrument the existing pipeline and paste the real timings.** | You cannot design UX around an unmeasured number. |

### Week 1 — The claim, in TypeScript

- Schema migration: `ToothFDI`, `Fact`, `Obligation`, `CommitTriad`, `ErrorClass`, `ConsequencePrimitive`, `Consequence`, `CaseCore`. Keep the Zod↔JSON-Schema agreement test.
- `src/ingest/split.ts` + `split.test.ts` — the deal, non-overlap assertions.
- `src/ingest/verifySplit.ts` — solo-solver loop, ≥80% union / ≤chance+5pp single, max 3 regenerate attempts. Run on Groq free tier.
- `src/ingest/classify.ts` + `classify.test.ts` — deterministic triad→ErrorClass, no LLM.
- Model router with per-pass model choice + per-user token budget. Move off the free Gemini tier.
- **Study:** write the 40-item post-test bank and freeze it. Pre-register on OSF (free, one afternoon).

**Exit gate:** `npx tsc --noEmit` exits 0; `npx tsx src/ingest/split.test.ts` passes; you can point at a real `splitReport` for a real lecture.

### Week 2 — Enforcement, in DOM

- `src/net/room.ts` — Durable Object (SQLite storage class, hibernation-safe), deal, private lock, simultaneous reveal, team commit, procedure gate, verdict broadcast, reconnection with original-packet restore.
- `src/net/deal.test.ts` — the wire-payload leak test.
- Room codes (Crockford alphabet), PartySocket client, 2-player join.
- **Placeholder DOM UI only.** Two browser windows, two packets, a commit triad, a gate that rejects. No 3D.
- Consult tokens + structured statement grammar (EN + AR from the start).
- **Study:** recruit 40, baseline.

**Exit gate:** you and a friend on two laptops solve a case you cannot solve alone. That video alone is 60% of the YC demo.

### Week 3 — The ragdoll and the first set-piece

- Install Rapier + SIMD alias + feature-detect. Route-split the physics chunk (2.2MB before a triangle renders) and precache in the service worker.
- 11-body seated ragdoll: spherical at shoulders/hips/neck, **revolute at elbows and knees** (third arg is the hinge axis — this is the detail people skip, then wonder why the knee bends backwards). Mass ratio under 3:1 between adjacent bodies. `setAdditionalSolverIterations` on ragdoll bodies only, never global `numSolverIterations`.
- Port the bone-sync loop from `mattvb91/rapierjs-ragdoll` (read it, don't vendor it — no license file despite the README).
- Motor stiffness scalar K, animated 1→0.
- `src/clinic/affect.ts` + test.
- **ONE consequence set-piece end to end: class C (contraindication ignored)** — the co-op payoff. Anticipation → hitstop → collapse → tray erupts.
- **The camera rule, implemented:** at the arousal peak, frame the tooth.
- **Study: session 1.**

### Week 4 — Juice, crowd, and the reward

- `consequenceFx.tsx`: `useHitstop` (`<Physics paused>`), `useCameraTrauma` (in Player.tsx's useFrame, after the rotation write, trauma², Perlin per-axis, rotational only, ≤1.5°), `useDuck` (Web Audio GainNode — no native sidechain, drive from your event system), `useBurst`, `useBloodSplat` (DOM overlay + 24–48 instanced quads, ring-buffered).
- `crowdPanic.ts` + test. 5–8 kinematic NPCs on precomputed exit splines, one instancedMesh.
- Gibberish vocalization system (~60 lines Web Audio). Record your own bank on a phone mic in one afternoon. Always jitter playbackRate ±6% and gain ±10%; shuffle-bag, never `random()`; drive `mouthOpen` from an AnalyserNode RMS.
- **The Peggle beat.** Five beats, 7s, FOV narrowing, −12dB duck. Craft it at least as well as the chaos.
- Set-pieces E and F. `clinicChaos` threshold dispatcher.
- **Study: spaced session 2.**

### Week 5 — Pedagogy

- Debrief phase, 4 PEARLS beats, 90s, bilingual. Attributable post-mortem anchored to `sourcePage`/`sourceQuote`.
- `ts-fsrs` integration; takeaway card enters the queue at the end of every debrief.
- Case-level re-encounter scheduler at ~3 weeks.
- `DiegeticDoc.tsx` — plane + troika `<Text>` (pass an explicit `font` prop and self-host the woff; see trap #12), snap-to-flat on pickup.
- Forced tabling + shared fill-in chart with visible empty slots.
- Solo mode: one-document-at-a-time diegetic working memory.
- Pre-brief screen. Professional-presentation toggle.
- **Study: spaced session 3.**

### Week 6 — Make it real

- Content-hash cache + 8–12 pre-baked demo cases committed to the repo.
- Mobile reduced tier: dpr=1, drop Bloom+SMAA, keep Vignette+ToneMapping, add ChromaticAberration+Noise (all `Effect`-type, one merged pass), single ragdoll cap, ≤16 blood splats, 30fps accumulator cap with `<Physics timeStep={1/60} updateLoop='independent'>`.
- **Measure on a real mid-range Android.** Borrow one. This is the only number that matters.
- Instant replay ring buffer + annotation.
- 3-player mapping (one afternoon — the channel model already exists).
- Isomorphic item pairs.
- **Study: delayed post-test at 14 days.**

### Week 7 — The application

- Grade 50 generated dental items yourself against source lectures. **Report the real number.**
- Analyse the study. If null on learning, lead with adherence (co-primary).
- Record the demo video **on the laptop**. Beat order: upload PDF → two windows solve a case neither can solve alone → wrong commit → patient collapses while the camera holds on the tooth → 90-second debrief → the card appears in the queue.
- Competitive matrix slide: rows = Neural Consult / Team Up! / Clay Clinic / SimCare / Simodont; columns = your own content / AI-generated / hidden info / **auto-generated split** / embodied 3D / dental.
- Write the application with the narrowed claim. Rehearse naming all four competitors unprompted.

### Week 8 — Buffer

Everything runs late. This week is the buffer, not a plan. If it isn't late, use it on a second consequence set-piece and the 3-player playtest.

### The study, specified

**Design: pre-registered, within-subject, randomised, counterbalanced crossover.** Each student is their own control. This is the whole trick — it removes between-subject variance, collapsing required n from hundreds to dozens. There is a direct published template: Barhdaoui et al. (Anatomical Sciences Education 2026) used exactly this for spaced repetition in histopathology.

**Procedure:** two matched lecture topics from your own curriculum, each split into two content halves matched on item count and difficulty. Randomly assign each student to study one half via CHAIRSIDE and the other via control.

**THE CONTROL IS THE MOST IMPORTANT DECISION IN THE WHOLE STUDY.** It must be **the same AI-generated notes and flashcards delivered as a static document** — *not* "normal studying." Against normal studying you measure your ingest pipeline, which any competitor with an LLM also has, and the result is uninterpretable. Against same-content-no-game you isolate the **game** — the co-op, commit-then-execute, consequence, debrief loop — which is the only defensible moat.

**n:** paired t-test, α=.05, power .80, d=0.5 → 34 pairs. Recruit **40** to absorb ~15% attrition.

**Primary outcome:** blinded 40-item NBME-style post-test at **14 days**, drawn from a bank frozen before randomisation. Delayed, not immediate — immediate post-tests are where game studies get their inflated wins, and the delay is also where retrieval/spacing effects are *largest*, so it's both more honest and more likely to succeed.

**Co-primary (pre-register it):** adherence — D1/D7/D30 retention. Easier to move, it's the metric YC cares about more anyway, and it makes the study informative regardless of which way the learning delta falls.

**Secondary:** a ~20-item Script Concordance Test. Free, non-proprietary, machine-scorable; the "answer key" is generated by having ~10 clinicians take it. There's a dedicated dental call-to-action paper in the *European Journal of Dental Education* and prior use with 73 final-year dental students. **The 10-clinician panel is the rate-limiting step, not the items** — start recruiting it week 2.

**Cost: ~$0. Founder time: 12–18 days spread across 8 weeks.**

**What makes it credible to YC: the pre-registration.** A public OSF timestamp fixing hypothesis, n, and primary outcome *before* data collection is what separates "we ran a study" from "we found a number we liked." Costs nothing, takes an afternoon, and very few seed-stage edtech companies have one.

---

## 9. The traps

### Commercial / licensing

1. **Rive free plan cannot export `.riv` since 2025-10-20.** Cadet is $9/mo annual, $17/mo monthly. Runtimes are MIT and already-exported files keep working forever ("Rive files don't phone home"), so a pay-one-month-and-cancel harvest works — but you cannot iterate on the art afterward, which is exactly what you'd do for two months. **Also:** Hosted CDN assets are Voyager+ ($32/mo/seat) — never design around them. **Mitigation: cut Rive from v1.** troika + Canvas2D costs ~4–6 extra days of hand-written animation and is free forever with no vendor in it.
2. **Every Gemini free-tier row is marked `data used for training: Yes`.** For third-party university lecture PDFs that's an institutional-trust and IP problem the moment you pitch a dental school. Paid Flash-Lite is ~$0.01–0.02 per lecture. Also: free-tier rate limits are **per-project**, so one shared key bottlenecks the moment a handful of students upload simultaneously. **Do not put a specific free-tier RPD number in the application** — Google's docs no longer publish per-model free numbers and secondary sources vary wildly.
3. **Ready Player Me is dead.** Netflix acquisition, public shutdown 2026-01-31; both `readyplayer.me` and `docs.readyplayer.me` now fail DNS. It is the single most-recommended avatar pipeline in every pre-2026 three.js tutorial. Strike it.
4. **Mixamo is unsupported.** No announced shutdown, but no updates since the Adobe acquisition, a multi-day outage in June 2025, and support has described it as no longer supported. **Harvest, don't depend.**
5. **Meshy free tier is CC BY 4.0 AND public assets.** Ongoing attribution obligation plus your generated characters visible to anyone. Pro is $20/mo. If you generate-and-cancel, **verify with Meshy directly** that downloaded assets remain yours after downgrade — that term varies.
6. **AMASS aggregates datasets with per-dataset licences, many academic-only.** Skip it entirely. CMU mocap is safe but needs days of Blender retargeting for output worse than Mixamo. Classic week-eating rabbit hole.
7. **Piper's licence changed.** The MIT `rhasspy/piper` repo was archived Oct 2025; the maintained project is `OHF-Voice/piper1-gpl`, **GPL-3.0**. Only correct use is a build-time asset generator that bakes WAVs — never a runtime dependency. **ElevenLabs free tier has no commercial rights and requires attribution.** Coqui shut down Jan 2024; XTTS is CPML (non-commercial).
8. **Sonniss bundles prohibit AI/ML training on the audio.** Shipping it in a game is fine; don't feed it to anything.
9. **Freesound mixes CC0, CC-BY and CC-BY-NC.** Filter to CC0 only.
10. **SimX patent scope is unverified.** See §7.4.

### Technical

11. **`@react-three/rapier` 2.2.0 hard-pins `@dimforge/rapier3d-compat@0.19.2`** while upstream Rapier is at 0.20.0 (restructured into `dist/`). Wrapper release cadence is slow (last release 2025-11-03). The SIMD swap works precisely because `rapier3d-simd-compat` exists at exactly 0.19.2 with the same file layout — a real drop-in, not a version jump. But budget for eventually maintaining a fork.
12. **troika fetches fallback fonts from jsDelivr** unless you pin `font` and `unicodeFontsURL`. The hardcoded default is `https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data`. Offline, that fetch fails and the glyph silently doesn't render — and it will fail exactly for an Arabic character from a student's PDF, in a clinic basement. Always pass an explicit `font` prop pointing at a self-hosted woff precached in the service worker.
13. **`CanvasTexture`'s constructor default `minFilter` is `LinearMipmapLinearFilter`.** Every `needsUpdate = true` regenerates the whole mipmap chain — 2–3× cost for nothing. Set `generateMipmaps = false` and `minFilter = THREE.LinearFilter` on any per-frame texture. Also set `colorSpace = THREE.SRGBColorSpace` or your card art looks washed out against ACES.
14. **Your shipped `PostFX.tsx` contradicts the mobile budget.** It runs N8AO + DoF + Bloom(mipmapBlur) + HueSaturation + BrightnessContrast + Vignette + SMAA + ToneMapping, and the `isTouch` branch drops only N8AO and DoF — phones still pay for Bloom's mipmap chain and SMAA's two passes at dpr [1, 1.25]. The brief and the code disagree and the code is what runs.
15. **drei `<Html transform>` receives none of your post stack.** It's a DOM node over the canvas — no DoF falloff, no vignette, no ACES, no bloom. It reads as a browser sticker pasted onto a rendered image, the exact opposite of diegetic. There's also an unresolved bug where `occlude="blending"` + a postprocessing pass makes Html vanish entirely, and a long-standing transform-mode blurriness issue (drei #859). Html is right for menus and lobby, never for an object in the room.
16. **drei `<CameraShake>` will fight `Player.tsx`.** It takes the camera in its own useFrame; your touch branch writes `camera.rotation` every frame. Known failure mode (r3f discussion #1350). Write the shake yourself, after the rotation write.
17. **Never use `DecalGeometry` / drei `<Decal>`** — geometry rebuild per decal, extra draw call, visible corner replication (three.js #21187).
18. **`timeStep='vary'` in Rapier** — the readme explicitly warns it causes instability and "prevents the physics simulation from being fully deterministic." Keep `timeStep={1/60}` fixed and use `paused` for hitstop.
19. **Rapier JS is not cross-machine deterministic.** Lockstep is off the table. One authority runs the sim; broadcast ~40 body transforms at 15–20Hz (~1.1KB/tick, ~20KB/s per peer — trivially free) and interpolate on the others. Or, better, don't network the ragdolls at all.
20. **Durable Objects free tier requires the SQLite storage class** (key-value backend isn't on free). **WebSocket Hibernation resets in-memory state and re-runs the constructor** — anything you care about must be in DO storage, not a field. This bites people; budget half a day. Hibernation won't trigger during active play, so it saves you on idle/lobby, not gameplay. DO storage writes count against 100,000 rows/day — persist on join/leave/commit, not every tick.
21. **Physics is 2.2MB of JavaScript before a triangle renders.** The `-compat` packages base64-embed the wasm. Route-split so the study/flashcard/quiz half of the app never imports it. Expect a visible main-thread hitch of a few hundred ms on first clinic entry on mid Android — hide it behind the "patient walks in" beat, not a spinner.
22. **The SIMD build needs wasm simd128** (Safari 16.4 / iOS 16.4, March 2023). A hard alias silently bricks older iPhones with an instantiation failure.
23. **CSP:** Emscripten WASM fails under a CSP blocking `unsafe-eval`. You need `wasm-unsafe-eval`. Verify this against your TWA setup early, not at Play submission.
24. **three.js `LottieLoader` is removed in r186.** You're on r185, which already stripped the bundled library.
25. **`SkeletonUtils.clone()`, not `.clone()`** — plain clone does not correctly duplicate a skinned hierarchy.

### Performance

26. **Thermal throttling.** A scene at 60fps on your dev laptop typically runs ~30fps on a two-year-old Android and drops toward **~20fps after five minutes**. That's *before* physics wasm, ragdolls, blood, and networking. WebGPU would help materially but Safari/Firefox support is still incomplete in 2026, so WebGL2 is the target and you inherit its cost profile.
27. **Budgets to hold:** <100 draw calls, <150k on-screen tris, ≤60 active dynamic bodies, dpr=1 on touch, **zero real-time shadow maps** (flat-shaded low-poly with blob shadows is both correct art direction and cheapest), ≤150 live particles. Your actual worst frame is ~40 active dynamic bodies and <30 draw calls — comfortably inside. **What will actually cost you the frame is the post chain, transparent overdraw, dpr>1, and shadows.**
28. **Removing SMAA on flat-shaded low-poly at dpr 1 will look visibly jaggy.** Test before committing. `GlitchEffect` and `ShockWaveEffect` are the two most expensive members of the cheap-looking list — profile, don't assume.
29. **Camera shake in first-person on a handheld phone in a small room is a motion-sickness vector.** Cap magnitude lower than feels right on desktop, ship an accessibility toggle (you need it for the stores anyway).
30. **Instanced blood quads on curved surfaces (the face) will float or clip.** Accept it or z-offset per splat along the normal.

### Pedagogy / evidence

31. **The ≤20% hidden-profile threshold is below 25% random chance with 4 options** — unpassable by construction. Use ≥5 options and the triad commit.
32. **Irrelevant instructional humour scored WORSE than no humour.** Topic-relatedness is not sufficient — humour that was course-related but cognitively non-functional was still harmful. This is the finding most likely to be ignored because the irrelevant jokes are the funniest ones.
33. **Simulated patient harm reliably raises stress (SMD 0.63) but improves retention in only 3 of 5 studies, and only with a structured debrief.** Nobody dies.
34. **Do not lead with jigsaw.** The 2023 meta-analysis (g=0.77) has I²=91%, 9.3% negative effects, 60% underpowered studies, and a strong inverse sample-size/effect relationship — plus Stanczak et al. (2022), five well-powered experiments with an internal meta-analysis, found **no** benefit. Motivation, social relations and self-esteem were all non-significant. Lead with TBL and Smith 2009.
35. **The honest game-based-learning number is ~0.75, not 1.11.** Trim-and-fill for publication bias drops SMD 1.11 → 0.75 (CI 0.24–1.27), I²=85.4%, GRADE **low**. And 11 CPR RCTs showed **no** significant advantage on any outcome. Games win on reasoning, lose on precise psychomotor — which is your lane, but quote the adjusted figure with the CI. A partner who checks will find the trim-and-fill.
36. **Ability heterogeneity affects achievement NEGATIVELY for lower-performing students.** Mixing a weak student with strong ones can hurt the weak one. Consider ability-banded lobbies.
37. **Two-stage collaborative exam retention shows up at 23 days, NOT at 9 days**, and is concentrated in low and mid performers — high performers showed nothing at either interval. Great story for a dean ("lifts the bottom of the cohort"); bad story for "makes top students better." Don't tell that one.
38. **Errorful generation improved memory for ITEMS but not for ASSOCIATIONS.** The loud moment teaches the fact; the debrief must teach the reasoning.
39. **IRB timing is the #1 reason the study doesn't happen.** Ask this week.
40. **You cannot be blinded and you're recruiting your own classmates.** Demand characteristics and allegiance bias are unavoidable at this scale. State it as a limitation; don't pretend otherwise.
41. **n=34 detects d=0.5.** If the true game-vs-same-content effect is d=0.25 — entirely plausible, since the AI content is in *both* arms — the study is null. Decide in advance how you present a null. (Answer: the adherence co-primary.)

### Unverified assumptions — measure before you build on them

42. **Pipeline latency (45–120s)** is inferred from call count, not measured. Instrument it in week 1.
43. **The CanvasTexture ceiling (1 card fine, 2–3 practical, >4 costs frames)** is speculative. Moot if you cut Rive.
44. **Whether 2–3 simultaneous players each running a live 3D clinic in a mobile browser holds up has not been measured.** This is the single biggest unvalidated assumption in the design.
45. **iOS installed-PWA `getUserMedia`** has a long history of silently failing in standalone mode. The loudest primary sources are old Apple forum threads and 2026 secondary sources say "partially works (needs permissions)" without naming a fix version. **Needs a real iPhone.** Strong argument for deferring voice.
46. **Content-hash caching across users means one student's bad upload poisons the cache for the whole class.** Version the key, allow force-regenerate.
47. **The claim "humans coordinate better than LLM agents on these tasks" is untested for your case format.** The HiddenBench numbers are agent literature. Don't assert a human success rate in the application.

---

## Day 1, tomorrow

```bash
# 1. Harvest before it disappears
#    mixamo.com → download Walking, Sitting, Sitting Idle, Sit To Stand,
#    Standing Up, Terrified, Scared, Yelling + the reaction set. Commit the FBX.

# 2. Email your faculty about ethics approval for in-course educational evaluation.

# 3. Measure what you actually have
cd "D:\My Apps\study-game"
npx tsc --noEmit
# add console.time/timeEnd around each pass in src/ingest/pipeline.ts, run one real
# lecture, and paste the numbers into your notes. Do not design UX before this.

# 4. Start the schema migration in src/ingest/schemas.ts (§3.2).
#    ToothFDI first — everything downstream keys off it.
```

The three things that must be true by the end of week 2, in order of how much they matter:

1. `verifySplit.ts` reports a real `unionSolveRate ≥ 0.80` and `maxSingleSolve ≤ chance + 5pp` for a case generated from a lecture you actually sat through.
2. `deal.test.ts` proves seat A's serialized wire payload contains zero of seat B's fact values.
3. You and one friend, on two laptops, solve a case neither of you could solve alone.

Nothing in 3D matters until those three are recorded.