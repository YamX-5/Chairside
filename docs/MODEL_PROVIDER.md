# CHAIRSIDE: what actually needs a model, and what DeepSeek really costs

I read the codebase before answering. Everything below points at a real file, a real published price, or a real policy document.

---

## 1. What needs AI and what doesn't

Your pipeline makes exactly **five kinds of model call** (`src/ingest/pipeline.ts`), 18 calls on a typical deck: 1 blueprint + 8 topic-writing + 8 review + 1 film choice + 1 case. Everything else in the repo is plain code.

| Part of the product | File | Model call today? | Does it genuinely need one? |
|---|---|---|---|
| Read the lecture, decide what it teaches (blueprint) | `pipeline.ts` → `BLUEPRINT_SYSTEM` | Yes | **Yes.** No rule turns arbitrary slide text into a weighted topic list. |
| Write NBME items with homogeneous distractors | `pipeline.ts` → `ITEM_SYSTEM` | Yes (8 calls) | **Yes — this is the only irreducible one.** Writing a distractor that is *the mistake a prepared student actually makes* is not a template operation. |
| Review committee over its own items | `pipeline.ts` → `REVIEW_SYSTEM` | Yes (8 calls) | **Half.** `verify.ts` already does the deterministic half properly (quote must appear in the deck at ≥0.75 ordered word overlap). Most remaining NBME violations are mechanically detectable: longest-option cue, "all/none of the above", negative stems, absolute qualifiers, duplicate options, option-length variance. Only "does this lead-in pass the cover-the-options test" needs judgement. **This is 8 of your 18 calls — the cheapest thing you can cut.** |
| Which radiograph the case is built around | `filmChoice.ts` | Yes | **Mostly no.** The model can't see pixels — you already told it so in your own comment. Its entire input is the page number and the slide text on that page. A keyword scorer (FDI regex + radiographic vocabulary + figure captions) gets most of this. |
| Write the patient case + ground truth | `pipeline.ts` → `CASE_SYSTEM` | Yes | **Yes, for an arbitrary uploaded deck.** No, for a case you authored — see §2. |
| Is this bitmap a radiograph? | `radiographDetect.ts` | No | No. Mean chroma + luma std-dev. Correct call. |
| The information split into packets | `split.ts` / `channels.ts` | No | No. |
| Is the split actually solvable / actually hidden? | `verifySplit.ts` | No — but it takes an injected `SoloSolver` | The referee is deterministic; the *solver* it needs would be a model in production. For authored templates you can write an exact rules-based solver, making the whole check free and offline. |
| Grading the commit (`classify.ts`) | `classify.ts` | No | No, and it must never be. Your own comment is right: "A generated case can be wrong; a generated *verdict* would be unfixable." |
| Scoring, error classes, patient reactions | `scoring.ts`, `reaction.ts` | No | No. |
| Flashcards from your mistakes | `studyCards.ts` | No | No — assembled from fields the case already carries. |
| Source verification | `verify.ts` | No | No. |
| Deck → `ClinicDay`, dedupe, validation gate | `assemble.ts` | No | No. |

**The honest summary: one call type out of five is irreducible.** Everything else is either deterministic already, or could be with work you're capable of doing yourself.

---

## 2. The zero-AI game

### The thing you may not have noticed

`src/screens/CasePlay.tsx` — the solo hidden-information loop, the commit gate, the error classification, the patient reaction, the flashcards-from-your-mistake — **imports `CORE` from `caseFixture.ts`**. A hand-written case. It runs today, offline, with no API key, no network call, no cost.

Meanwhile the generation pipeline produces `GeneratedCase` → `ClinicDay`, which feeds the *quiz* screens. **Nothing in the repo converts a generated case into a `CaseCore`.** Your channels file even says so: "The generation JSON Schema for CaseCore lands here when the pipeline is wired."

So the best part of Chairside — the part nobody else has — is **already the zero-AI part**. The AI currently feeds the more ordinary part.

Two more facts that push the same direction:
- `assemble.ts`: "Maps generated **English-only** output". Your AI path ships no Arabic. Your two hand-written days (`perio-staging.ts`, `med-anaphylaxis.ts`) are fully bilingual. Right now, **authored content is the only bilingual content you have.**
- `vite-plugin-pwa` is already installed. A no-key build installs to a phone and works with no signal.

### (a) Ship a library of pre-made cases

**How far it gets you: all the way to a shippable, sellable product.** No key, no backend, no per-lecture cost, no rate limits, no PRC servers, no campus firewall problem, offline, instant. A professor can review every case before a student sees it — which is the only version a dental school will actually adopt, because "an AI wrote your exam questions" is a conversation you don't want and "Yaman wrote them against the 2018 EFP/AAP classification" is one you do.

**What it costs:** `caseFixture.ts` is **263 lines for one case** — 8+ facts across four channels, 2 obligations, 6 consequences, 5 diagnoses, 5 procedures, debrief with both success and failure patient perspectives. Plus Arabic. Realistically 3–5 hours per case with your own clinical review. Thirty cases ≈ a semester ≈ two focused weeks of work.

**Where it stops:** it isn't the pitch. "Upload your lecture" is the reason a student picks you over a question bank. And a fixed case is solved once — the second play is recall, not reasoning.

### (b) Parameterised templates (the roguelike idea)

**Your codebase is unusually well-shaped for this, and here's why it isn't wishful thinking:**

1. The tooth is already the join key, validated as FDI `/^[1-4][1-8]$/`. Permute `siteFDI` and every indexed fact, packet and radiograph follows automatically.
2. `classify.ts` is pure comparison against `groundTruth` — permutation **cannot** break grading.
3. `ConsequencePrimitive` is a **closed enum of 13 hand-authored animation states**. A permuted case physically cannot produce an unplayable animation.
4. **`verifySplit.ts` is a machine referee.** You can generate 500 permutations and automatically reject every one where a single seat can solve it alone, or where the union can't. Its `chanceBaseline` already conditions on how many teeth a packet reveals — the subtle bug is already handled.
5. For an authored skeleton you know the intended reasoning, so you can write an **exact deterministic `SoloSolver`**. That makes the referee free and offline. No model anywhere in the loop.

**What varies usefully:** tooth (and therefore the whole opening "which tooth are we on?" conversation, plus the distractor teeth), patient identity and history, *which* fact is the contraindication (warfarin / bisphosphonate / pregnancy / pacemaker / uncontrolled diabetes), which channel holds the load-bearing fact, the seat map, the diagnosis and procedure distractor sets, consequence severity.

**Where it stops, plainly: permutation varies the values, not the reasoning.** After four or five plays of the reversible-pulpitis skeleton, a student stops diagnosing and starts pattern-matching — "find the contraindication, avoid the irreversible option." Roguelikes get away with procedural levels because the challenge is tactical and regenerates. Here the challenge is a diagnosis, and there are a finite number of diagnoses. **One skeleton ≈ one teachable concept.** Permutation gives you maybe 5–10x the replay per skeleton before the shape is transparent; it never gives you a topic you didn't author.

**And it has a clinical trap you must build for.** Not every diagnosis is legal on every tooth: pericoronitis is essentially 18/28/38/48; there is no furcation involvement on a single-rooted 11–13/21–23/31–33/41–43; a pulp cap on a tooth with a periapical radiolucency is wrong. Each template needs a **legality table** (tooth class, root count, quadrant) and a per-permutation test, or you will ship a clinically wrong case to a student — which is worse than shipping no case. This is finite, testable work, and it is work *you specifically* are qualified to do.

### Verdict on the zero-AI game

**Yes, Chairside can ship and be fun with no model call at all.** You lose exactly two things: the "upload your own lecture" pitch, and unbounded content. You keep the co-op mechanic, the hidden-information split, the commit gate, the physics comedy, the flashcards, both locales, and offline play — and you gain a version with no API key, no privacy problem, no unit cost, and no campus-network blocker.

---

## 3. DeepSeek: the verdict

**Refuted on both halves.**

### Cost: it stopped being cheapest four days ago

DeepSeek raised prices on **16 August 2026** and moved to peak/off-peak billing. The "off-peak discount" preserves the old rate; peak is double it. Peak hours are 01:00–04:00 and 06:00–10:00 UTC — which in Amman (UTC+3, no DST) is **04:00–07:00 and 09:00–13:00**. The 9am–1pm window is exactly when a student uploads the deck they just sat through. You cannot build a fixed-price subscription on a provider whose cost doubles depending on the clock.

And it isn't the floor anyway: **OpenAI's gpt-5-nano is cheaper on all three axes** — input $0.05 vs $0.22, cached input $0.005 vs $0.007, output $0.40 vs $0.66. Gemini 2.5 Flash-Lite (paid) also beats it. Your belief was true about 18 months ago.

### Quality: it cannot enforce your schema, and your own code already says so

This is the part that matters most for *this* codebase. From `client.ts`, written by you:

> `DeepSeek response_format: json_object guarantees valid JSON but NOT a matching schema. Fields go missing and enums get invented.`

That is exactly right, and it's why `jsonRepair.ts` exists with `maxAttempts: 3`. Anthropic and Gemini compile your JSON Schema into a decoding grammar — a schema-breaking token is mechanically impossible. DeepSeek has no `json_schema` response format at all; its `strict` mode is beta-endpoint-only, applies to tool-call arguments rather than the response, and **silently ignores `minItems`/`maxItems`/`minLength`/`maxLength`** — which is precisely how you encode "exactly 4 options" and "3 homogeneous distractors." There's an open reproducible bug in that mode emitting unparseable JSON; DeepSeek closed it "not planned."

Your repair loop mostly saves you: with 3 attempts, outright pipeline failure is rare (~0.2% per run). The real tax is three things the loop can't fix:
- **Latency.** 18 calls, each possibly re-running.
- **Cost drift.** ~5–15% more output tokens, eating the price gap.
- **Quality — the one that counts.** The repair loop fixes *shape*, not *content*. An item with heterogeneous distractors validates perfectly. The academic result ("The Format Tax", arXiv 2604.03616) is that schema constraints penalise weaker models disproportionately — so the cheap model takes its biggest hit on your hardest, most-constrained task. That's item writing, the one thing that can't be replaced with plain code.

One more: on MedHELM (Nature Medicine 2026, 121 clinical **generation** tasks — the closest proxy to authoring content), Gemini-3.5-Flash scores 0.642 and **DeepSeek R1 scores 0.485**. On Arabic medical tasks (MedArabiQ), DeepSeek V3 is behind Gemini and Claude. DeepSeek scores brilliantly on medical MCQ *answering* — that's the number people quote — but answering an item and authoring one are different jobs.

### The catch — and yes, there is one, and it's the business

**Your input is a named professor's copyrighted lecture deck, and you intend to sell to that professor's university.**

DeepSeek's own published documents:
- *"we directly collect, process and store your Personal Data in People's Republic of China"* — with uploaded files and prompts explicitly listed as collected data. No regional option.
- Training on inputs is the **default**; opting out is described as a right you must exercise. The Open Platform ToS §5.5 explicitly incorporates that same privacy policy — there is **no API carve-out**. (The "paid API doesn't train" claim circulating online traces to affiliate SEO sites, not to any DeepSeek document.)
- ToS §10.1–10.2: PRC law, Hangzhou courts. §3.3 puts the legal basis for sending your students' data on **you**.
- No Article 28 DPA, no zero-retention option, no SOC 2.

Then the part that actually kills the sale: **US state executive orders ban DeepSeek by name and extend to public universities.** Virginia's covers "institutions of higher education"; New York's covers all of SUNY. Named implementations already exist at UVA, James Madison, William & Mary, George Mason, University at Buffalo, and Louisville. Italy's Garante limitation order (Jan 2025) is still in force. Germany reported DeepSeek to Apple and Google under DSA Art. 16. Korea's PIPC found DeepSeek sent **the actual content users typed into prompts** to a ByteDance affiliate without consent.

And Jordan's own PDPL No. 24 of 2023 restricts transfers to destinations without adequate protection — so this is a problem at home before it's an export problem.

Practical detail on top: DeepSeek routes overseas card payments through PayPal with no first-party card rail, which from Jordan is the option most likely to leave you unable to top up at 2am in exam season. Anthropic and Google both list Jordan as supported.

**DeepSeek's one genuine remaining advantage** is rate limits — 2,500 concurrent connections on V4-Flash, raised free on request. Nobody matches that. It doesn't outweigh the above.

---

## 4. What I'd actually do

**One recommendation: split the product at the line the code already draws.**

**Free tier — no API key, no backend, no cost.** Ship the authored case library plus parameterised permutation. Wire `CasePlay.tsx` to a real library instead of the test fixture, and build the permutation engine behind `verifySplit.ts` as your automated referee. This is your demo, your acquisition channel, your campus-wifi-safe build, your offline PWA, your only bilingual content, and the version a dental school can actually buy. **Ship this first — it needs nothing you don't already have.**

**Paid tier — "upload your own lecture."** Keep the pipeline. Four changes:

1. **Move the key server-side.** Your own comment says it: *"NOT acceptable once published, because any script on the page can read it."* It's also a hard gate — Anthropic's zero-data-retention doesn't support CORS, so browser-direct calls can never be ZDR-covered. A thin proxy unlocks ZDR, gives you an audit trail, and gives a university someone to contract with.
2. **Change the default from `deepseek` to `claude-haiku-4-5`.** Not Opus. Your `MODELS.anthropic` is currently `claude-opus-4-8` at $5/$25 — that's why DeepSeek looks necessary. The real comparison is DeepSeek vs Haiku, not DeepSeek vs Opus. Haiku 4.5 is $1/$5, gives you `output_config.format` constrained decoding, contractual no-training, Customer Content treated as Confidential Information, a copyright indemnity, clean Jordan billing, and an invoice a procurement office will accept.
   - **Two code specifics:** Haiku 4.5 **rejects `output_config.effort`** — drop that field on the Haiku path. And with 18 calls at concurrency 3, your run will likely exceed the 5-minute cache TTL; use `cache_control: { type: 'ephemeral', ttl: '1h' }` (2x write instead of 1.25x, paid once) and verify with `usage.cache_read_input_tokens`. If that field is zero, you're paying the uncached column.
3. **Benchmark Gemini 2.5 Flash-Lite (paid tier only) and gpt-5-nano on schema pass rate for the item-writing call.** If either clears ~95% first-pass with real quality, your annual bill at 60,000 lectures drops from ~$11,700 to under $1,100. **Never the Gemini free tier** — Google's own pricing table marks free-tier data usage "Yes."
4. **Delete the DeepSeek path**, or keep it strictly as your own local testing option that never touches your server. "Our product can be pointed at DeepSeek" is still a line item on a university security questionnaire.

**Then cut calls, not providers.** Replace the film-choice call with a keyword scorer, and replace most of the review pass with deterministic NBME linting. That takes 18 calls to ~10 and removes your two least-defensible model calls. Cutting calls beats switching providers within the cheap tier.

---

## 5. The numbers

**Assumptions, stated so you can check them:** 20,000-token deck (≈40 slides of extracted text) as the cached prefix on all 18 calls → 1 cache write (20k) + 17 cache reads (340k). 2,000 uncacheable tokens per call (system + schema text + instruction + focused pages) → 36,000 fresh input. 20,000 output tokens total. A 12-topic deck is 26 calls, so scale up ~1.4x.

**DeepSeek V4-Flash, off-peak** ($0.22 / $0.007 cached / $0.66, no write fee):
```
write   20,000 × $0.22/M  = $0.0044
read   340,000 × $0.007/M = $0.0024
fresh   36,000 × $0.22/M  = $0.0079
output  20,000 × $0.66/M  = $0.0132
                            ───────
                            $0.0279   (peak: $0.0558)
```

**Claude Haiku 4.5** ($1.00 in / $1.25 write / $0.10 read / $5.00 out):
```
write   20,000 × $1.25/M = $0.0250
read   340,000 × $0.10/M = $0.0340
fresh   36,000 × $1.00/M = $0.0360
output  20,000 × $5.00/M = $0.1000
                           ───────
                           $0.1950   (Batch API, −50% in+out: $0.0975)
```

**Gemini 2.5 Flash-Lite, paid** ($0.10 / $0.01 / $0.40):
```
0.020×$0.10 + 0.340×$0.01 + 0.036×$0.10 + 0.020×$0.40 = $0.0170
```

**gpt-5-nano** ($0.05 / $0.005 / $0.40): `$0.0010 + $0.0017 + $0.0018 + $0.0080 = $0.0125`

**Claude Opus 4.8 — what your code does today** ($5 / $6.25 write / $0.50 read / $25 out):
```
$0.125 + $0.170 + $0.180 + $0.500 = $0.975
× 1.3 (Opus 4.7+ tokenizer emits ~30% more tokens) = $1.2675
```

| Option | Per lecture | 12 lectures/mo | 60,000 lectures/yr | Enforces your schema? |
|---|---|---|---|---|
| gpt-5-nano | $0.0125 | $0.15 | $750 | Yes (Structured Outputs) |
| Gemini 2.5 Flash-Lite (paid) | $0.0170 | $0.20 | $1,020 | Yes (`responseSchema`) |
| **DeepSeek V4-Flash off-peak** | **$0.0279** | $0.33 | $1,674 | **No** |
| **DeepSeek V4-Flash peak (9am–1pm Amman)** | **$0.0558** | $0.67 | $3,348 | **No** |
| Claude Haiku 4.5 (Batch) | $0.0975 | $1.17 | $5,850 | Yes (grammar-constrained) |
| **Claude Haiku 4.5** | **$0.1950** | **$2.34** | **$11,700** | **Yes** |
| Claude Opus 4.8 (your current fallback) | $1.2675 | $15.21 | $76,050 | Yes |
| Zero-AI (library + templates) | **$0.00** | **$0.00** | **$0.00** | N/A |

**Three caveats that are load-bearing:**

- **Caching is worth more than the provider choice.** 360,000 of your 396,000 input tokens are the same deck re-sent. Without caching, DeepSeek goes $0.0279 → $0.1003 and Haiku goes $0.195 → $0.496. The prefix must be **byte-identical** across all 18 calls — one per-call timestamp or reordered JSON key in the prefix and the discount silently vanishes. Your `client.ts` already puts the deck first on both providers. That was the right call; verify it's actually working (`cache_read_input_tokens` on Anthropic, `prompt_cache_hit_tokens` on DeepSeek).
- **The 20,000 output figure excludes thinking tokens.** Your pipeline runs `effort: 'xhigh'` with adaptive thinking. Thinking bills as output. On a reasoning model, real output could be 2–4x that, which hits the Opus row hardest and is another reason not to leave Opus as the fallback tier.
- **At 12 lectures a month, the entire cheap tier spans $0.15 to $2.34 per student.** Against any realistic subscription price that is 95%+ gross margin either way. **Inference cost is not what decides this business.** Schema reliability and item quality are — and the free tier costs you nothing at all.

**Bottom line:** your instinct that most of this doesn't need AI is correct and the code already proves it. Your instinct that DeepSeek is cheapest and best is wrong on both counts — it lost the price crown four days ago, it can't enforce the schemas your codebase is built around, and it is banned by name at the exact institutions you want to sell to.