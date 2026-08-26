# COMPLETENESS CRITIQUE — CHAIRSIDE BUILD DOCUMENT

**Verification note:** the web-search budget was exhausted early, so I could only direct-fetch a handful of pages. I confirmed 4 load-bearing claims (Gemini pricing/data-use, Gemini availability in Jordan, Cloudflare DO free tier, Play UGC policy) and found the YC facts the document never checked. The other ~40 pricing/licensing/effect-size numbers in the synthesis remain **unverified by me** — see item 24.

---

## TIER 1 — Existential to the stated goal

### 1. The document targets a YC application and never checks a single YC fact. The two that matter are disqualifying-shaped.

**Verified from ycombinator.com:**
- The batch **takes place in person at YC's campus in San Francisco**, opening with a 3-day in-person retreat plus regular SF meetups, and YC "expect[s] the founders to commit to working **full-time** on their company during the batch and afterwards."
- **The Fall 2026 deadline (July 27) has passed.** Fall 2026 runs Oct–Dec in SF; decisions went out by Aug 28. Today is Aug 19, 2026. "Two months from now" lands you at ~Oct 19 — which is *during* a batch you can't join. The next targets are Winter 2027 or Early Decision.
- YC accepts solo founders but states plainly you are "more likely to succeed with a co-founder."

**Why it matters:** He is a dentistry student in Jordan. Dentistry is a 5-year program with clinic rotations you cannot suspend for three months without losing the year. Every hour of the 8-week plan is spent on product; zero is spent on the question a partner will ask in the first two minutes: *"Can you be in San Francisco full-time in January, and are you dropping out?"* No amount of ragdoll polish answers that.

**Do:** Before week 1 — (a) name the actual batch and deadline and put it at the top of the plan; (b) write the two-sentence answer to relocation and to "why solo"; (c) confirm whether his faculty permits deferral. If the honest answer is "I can't relocate," the entire plan should be re-pointed at a different milestone (revenue, a university pilot, a different accelerator with remote batches), because YC-as-written is not compatible with his current life.

---

### 2. Copyright of uploaded lecture material is completely absent — and the document's single biggest cost lever is also its single biggest legal exposure.

The word "copyright" appears nowhere. §3.1 proposes: *"Content-hash cache the extracted deck text. The same lecture uploaded by 40 classmates costs one generation… this is your single biggest cost lever."*

Stated plainly, that design is: Student A uploads Professor X's copyrighted slides; Chairside stores derived content plus **verbatim `sourceQuote` spans** (required by `verify.ts`); Chairside then serves that derived-and-quoted material to 39 other students who never had a copy. That is systematic reproduction *and* distribution of one identifiable rightsholder's work, at cohort scale, by a commercial entity. Jordan is not a fair-use jurisdiction, and even in the US the "we cache it for everyone" fact pattern is the worst version of this analysis. The rightsholder is a professor at his own school — precisely the person he needs as an institutional champion.

Compounding items nobody covered:
- **DMCA §512 safe harbor requires designating an agent with the US Copyright Office** via their online system (paper designations no longer accepted) and keeping it current; without it the safe harbor is unavailable. This becomes live the moment YC gives him a Delaware C-corp.
- **The demo video.** §8 week 7 says record "upload PDF → …". If that PDF is a professor's real slides and the video is public, that is a public reproduction, on the internet, attached to his name.
- **"8–12 pre-baked demo cases committed to the repo."** If derived from copyrighted lectures, that is redistribution in a git repo.
- **University AUPs.** The synthesis correctly flags that Gemini's free tier trains on submitted data (verified: free tier = "Content used to improve our products"; paid = "Content **not** used"). It misses the mirror-image problem: many universities' own policies prohibit students uploading course materials to third-party AI services *at all*. That is a direct blocker on the exact channel he wants.

**Do, this week, before any caching code:** (a) default the cache to **per-uploader scope**, and make cross-user sharing an explicit opt-in where the uploader attests they have the right to share; (b) cap any shipped `sourceQuote` at a short excerpt and never ship the deck text itself; (c) add an upload-time attestation and a takedown path; (d) register a DMCA agent when the entity exists; (e) for the demo, use a lecture he authored or one openly licensed — and separately, get **one professor to explicitly license his slides in writing**, which doubles as your first design partner.

---

### 3. The one surviving novelty claim is contradicted by the paper the document tells you to copy — and the verifier proves a property about LLMs, not students.

§3.4 says: *"Steal HiddenBench's methodology verbatim — it's the exact programmatic test."* §7.2 says: *"We are the first to automatically generate the information split… Nobody has generated asymmetry before; they have only authored it."*

Both sentences cannot be true. HiddenBench's construction pipeline *does* generate splits and *does* verify them programmatically — that is why you're copying it. A technical partner or academic advisor reading §3.4 and §7.2 together sees it immediately, and the "we're first" line dies exactly the way "first of its kind" was correctly killed on page 1. (I fetched AsymPuzl, arXiv:2512.03466 — it is synthetic *symbolic* puzzles, two agents, so it is a weaker threat than the raw findings implied. HiddenBench is the real one.)

Worse, the claim shifts populations. The verifier asks: *can an LLM solve this from one packet?* The pitch asserts: *no student can solve this alone.* The raw findings explicitly flag that the human property is untested. And an LLM (or a good student) carries dental priors: for a textbook presentation, one packet plus general knowledge is often enough, which is exactly the failure the ≤chance+5pp bound is supposed to catch. HiddenBench's own fix — deliberately biasing the *shared* information toward a wrong answer — **is banned by your own §4.7 ("never lie to the player")**. That tension is real and unresolved anywhere in the document.

Also, the chance arithmetic in §3.4 is wrong. It claims the triad gives `|dx| × 32 teeth × |proc| ≈ 800+` so "chance baseline collapses to near zero." But RECORDS and IMAGING packets are **indexed by tooth** (§3.3, §4.2) — the site leg is handed to the solo solver. Effective chance is ~1/(5×5) = **4%**, not 0.1%, so the passing bound is ~9%, an order of magnitude tighter than assumed.

**Do:** (a) rewrite the claim as *"first to auto-generate a verified information split over arbitrary user-supplied domain content, for education"* and expect the follow-up; (b) resolve the §3.4/§4.7 conflict explicitly — either accept that shared info may be *incomplete* but never *misleading*, and accept the verifier will be harder to pass, or state the exception; (c) recompute the chance baseline from the actual answer space *conditioned on the packet*; (d) **run the hidden-profile test on five human classmates once, in week 2.** It costs an afternoon and converts your central claim from an LLM benchmark artifact into a fact about students. Without it, the claim is refutable by a partner asking one question.

---

### 4. The 8-week plan is over capacity by roughly 2–3x **using the raw findings' own day estimates**, and the study is scheduled before the thing it studies exists.

Summing the effort numbers the research dimensions themselves supplied:

| Week | Scope, priced from raw findings | Est. days |
|---|---|---|
| 1 | schema 2 + split/verify 3–5 + classify 2 + router 1 + 40-item bank 3–5 + OSF | 11–15 |
| 2 | DO room 3–5 + reconnect 1–2 + token grammar (EN+AR) 6–10 | 10–17 |
| 3 | ragdoll 3–4 + bone-sync port 1–2 + motors 2–3 + affect 1–2 + set-piece ~4 + camera 2 | 13–17 |
| 4 | juice 3–4 + crowd 1–2 + gibberish 1 + Peggle beat 3–4 + 2 set-pieces ~8 | 16–19 |
| 5 | debrief 5–8 + FSRS 2–4 + scheduler 3–5 + DiegeticDoc 2–3 + tabling 3–5 + solo 4–7 + toggles 2–3 | 21–35 |
| 6 | cache/prebake 4–5 + mobile tier 3–5 + replay 3–5 + 3P + isomorphic 3–4 | 13–19 |
| | **Total** | **84–122 days** |

Available: ~42–49 working days across six weeks, **before** the study (12–18 founder-days), grading 50 items, the demo video, the application, dental coursework, and DentiPlan.

Two structural problems on top of the arithmetic:

- **The study runs on a product that doesn't exist.** Week 2 = "recruit 40, baseline"; week 3 = session 1; week 4 = session 2; week 5 = session 3. But the debrief ships week 5, the consequence set-pieces weeks 3–4, FSRS week 5, solo mode week 5. So sessions 1–2 are students playing **the placeholder DOM UI**. The study's whole logic is "control = same AI content minus the game" — but in weeks 3–4 the treatment arm *is* the control arm with a room code. The primary outcome measures nothing.
- **IRB.** §9 trap 39 correctly names ethics timing as the #1 reason the study doesn't happen, then week 0 says "ask your faculty" and week 2 says "recruit 40, baseline." Two weeks is not an approval timeline anywhere.

**Do:** cut to a defensible core and say so. My proposed line: weeks 1–3 = split + verifier + DO enforcement + **one** consequence set-piece (class C) + the Peggle beat + the debrief. Weeks 4–5 = human hidden-profile test, 50-item accuracy grading, and **users** (item 5). Week 6 = demo + application. Drop the pre-registered RCT to a *pilot* with n≈12 and adherence-only outcomes, run after the product exists, and pre-register the full study for the following term. A pre-registered null on a half-built product is worse than no study.

---

### 5. There is no traction plan. The plan optimizes for a demo video and an RCT; YC indexes on users and growth.

Nowhere in 8 weeks is there a task called "get N dental students using this weekly." The closest is recruiting 40 classmates *as research subjects*, which is framed as science, not usage, and ends when the study ends. Meanwhile §6.2's own conclusion is that the honest pitch is **"we solve the adherence problem"** — a claim that is only credible with a retention curve.

**Do:** make "30 classmates using it in week N, D7 retention measured" an explicit week-4 deliverable with the same weight as the ragdoll. Recruit the study cohort and the user cohort as the same people. A real D7 number from 30 dental students beats every citation in the document.

---

### 6. Monetization, pricing, and payment rails are entirely absent.

Neural Consult is named as the closest competitor at $24.99/mo and there is no pricing response, no free/paid line, no institutional price, no unit economics beyond "$0.01–0.02 per lecture." For a Jordanian student market, willingness to pay is the whole question — and there is no named high-stakes exam in the Jordanian curriculum equivalent to the INBDE that Neural Consult sells against, which is precisely what would create urgency and price tolerance. Separately: **verify he can actually collect money** — Stripe's country support has historically excluded Jordan, which would force a merchant-of-record (Paddle/Lemon Squeezy) or a US entity.

**Do:** one page — free tier boundary, paid price, institutional price, the exam or grade the student is buying against, and the payment processor. Half a day; it is a guaranteed YC question.

---

### 7. The core loop requires two humans online simultaneously, and there is no cold-start, matchmaking, or async answer.

The document assumes "two roommates." Real usage is a student alone at 2am the night before an exam — which is when Neural Consult wins by default. §4.3's solo mode is offered as the answer, but §4.3 also concedes that if solo is easier, "every student plays solo, and your multiplayer thesis dies," and its proposed fix (one document at a time) is **trivially defeated by a screenshot or a pen**. It is a working-memory tax, not an information constraint, and it is unenforceable.

**Do:** decide explicitly which mode is the product and which is the demo. If solo is the product, the netcode in week 2 is demo work and should be priced as such. If co-op is the product, you need a matchmaking/lobby story, an async "leave a case for your study partner" mode, or a bot for the missing seat — none of which exists.

---

## TIER 2 — Specification defects that fail at integration

### 8. The `Packet` spec leaks the tooth number and the category, destroying two mechanics the document calls load-bearing.

§3.3: *"for every other channel, only `{id, channel, category, tooth}`."*

- §4.2 calls the FDI number "your serial number… only CHAIR can read the FDI number off the mouth… **the single highest-leverage mechanic transfer available to you**." But every packet ships every other channel's `tooth`. The opening "which tooth are we on?" conversation is dead on arrival.
- §6.5's forced tabling reveals "existence and category." But existence and category are already in every packet from the deal. Tabling reveals nothing.

**Do:** strip `tooth` from other-channel stubs (this is a one-line change and it restores §4.2), and decide whether `category` is dealt or revealed-on-tabling — it cannot be both.

### 9. The anxiety-meter — the fix for the dead execution phase — does not work in 2-player or solo, which are the two configurations you ship.

§5.4 assigns: CHAIR raises anxiety, **RECORDS is the only player who can lower it**, IMAGING can veto. §4.3 maps 2 players as **CHAIR+RECORDS / IMAGING+PROTOCOL** and says "playtest 2P first — it's the realistic config." So in 2P the person holding the drill is also the only person who can calm the patient. The mechanic that exists to give idle players a job gives the busy player two jobs. In solo it collapses entirely.

**Do:** either move the calming affordance to IMAGING+PROTOCOL in the 2P mapping, or design the execution-phase job assignment per-mapping rather than per-channel. This is a design decision, not a bug fix, and it should happen before week 3.

### 10. Camera ownership during a consequence is unspecified, and §5.5's rule is written as if the game were single-player.

§5.5 — called "the single most important decision in this section" — requires that **at the arousal peak the camera frames the tooth**. But the game is first-person with a player-owned camera (`Player.tsx` writes `camera.rotation` every frame), and §9 trap 16 explicitly warns that anything else grabbing the camera will fight that write. To frame the tooth you must take the camera from the player: that is a cutscene director, with a handoff, a restore, and a nausea toggle on mobile — none of which is specified.

Then: **in 2–3 player co-op, whose camera?** RECORDS is looking at a chart, not a mouth. If only CHAIR gets the framed shot, only CHAIR gets the encoding benefit the entire section is built on, and the other players get a distant scream. The learning mechanism the document leans hardest on is specified for one player.

**Do:** write the camera-authority contract (who owns rotation in each phase, how it hands off, how it restores) as part of week 3, and decide what RECORDS/IMAGING see at the arousal peak — probably their own diegetic document snapping to the offending finding, which is the same "central object" trick in their modality.

### 11. The SIMD physics alias and the SIMD feature-detect are mutually incompatible as written.

§2.2 prescribes a Vite `resolve.alias` rewriting `@dimforge/rapier3d-compat → @dimforge/rapier3d-simd-compat`, **and** a boot-time `WebAssembly.validate` probe with "dynamic-import the correct package." A `resolve.alias` is a build-time static rewrite of every matching specifier in the graph — including inside `@react-three/rapier`, and including your fallback import. The probe will compute `usesSimd = false` and change nothing; older Safari/iOS gets a hard WASM instantiation failure, which the document itself calls "not a graceful degrade."

**Do:** pick one. Either ship SIMD only and gate the clinic route behind the probe with an honest "this device can't run the clinic" message, or produce two builds, or patch `@react-three/rapier` to accept an injected rapier module. Whichever — test it on a real pre-16.4 iOS device before week 6, not at submission.

### 12. IMAGING — one of four channels, and the one whose fun is "reading a radiograph *is* the real clinical skill" — has no verified asset source.

The pipeline generates *text*. A radiograph is an *image*, and it must depict the specific tooth and pathology of a case generated from an arbitrary PDF. §2.3 answers "pdf.js → canvas → texture," which assumes the uploaded lecture happens to contain a radiograph matching the generated case's tooth and diagnosis. That will usually be false. The alternatives are all bad and none is discussed: a public dental radiograph dataset (licensing, and most are research-only), a stylized low-poly drawing (which destroys the "real clinical skill" claim in §4.1), or image generation (clinically wrong, and in a medical education product, indefensible).

**Do:** decide this in week 1, because it determines whether the four-channel split is achievable from arbitrary uploads at all. The pragmatic answer is probably: constrain generated cases to teeth/pathologies for which you have a small hand-curated, properly-licensed radiograph library, and be honest that the imaging channel is drawn from a fixed bank rather than from the student's PDF. That is a real limitation on the "from *your* lecture" claim and it should be known now, not in week 5.

### 13. Scanned / image-only lecture PDFs kill the pipeline, and there is no OCR path.

`pdfjs` text extraction returns nothing for slides exported as images or scanned handouts — extremely common. Every downstream stage fails, and `verify.ts` (word-overlap against extracted text) fails hardest. This is a first-session churn event for a meaningful fraction of users and it is not mentioned once.

**Do:** detect zero/low text yield at upload and either reject with a clear message or add an OCR fallback (Tesseract WASM in-browser is free and offline-compatible). Budget a day; it protects the whole funnel.

### 14. Uploaded PDFs are an untreated prompt-injection vector, and the shared cache turns one poisoned upload into a cohort-wide clinical-content incident.

A student uploads a PDF with hidden white text ("ignore previous instructions…"). That text flows into blueprint → item writing → case generation → consequence selection. §9 trap 46 notes cache poisoning only as a *quality* issue ("one bad upload"). It is an *adversarial* issue: with cross-user content-hash caching, one malicious or joke upload propagates generated clinical content to 40 classmates. In a medical education product, a case teaching a wrong contraindication is a safety event, not a bug.

**Do:** treat extracted PDF text as untrusted data, not instructions (delimit it, never concatenate into the system prompt); strip invisible/zero-opacity/off-page text at extraction; keep the closed-enum `ConsequencePrimitive` (already good) and extend the same discipline to diagnoses and procedures by validating against a fixed vocabulary; and per item 2, scope the cache per-uploader by default.

---

## TIER 3 — Whole modalities the document never opens

### 15. Accessibility is absent, and it is an institutional procurement blocker.

One camera-shake toggle is the entire treatment. Missing: WCAG 2.2 AA, a VPAT (US institutional buyers routinely require one; EU public bodies require EN 301 549), keyboard-only operation of the diegetic 3D documents, colorblind-safe correct/wrong and blood signalling, captions for the gibberish vocalization — which is *diegetic information*, so a deaf student loses an entire feedback channel — and **photosensitive seizure risk** from `GlitchEffect` + chromatic aberration + screen flash + trauma shake (WCAG 2.3.1's three-flash threshold; also a store-review issue). §4.5 cites "speech accessibility" as a reason for token comms and then never follows through.

**Do:** a one-page accessibility statement plus four concrete items (reduce-motion honored, flash cap, captions for patient vocalizations, colorblind-safe verdict signalling) before any university conversation. It is cheap now and unbuildable later.

### 16. Store obligations are treated as last-mile distribution; the UGC ones are architectural.

**Verified from Google Play's UGC policy:** an app hosting user-generated content must require acceptance of terms of use before upload, perform "robust, effective, and ongoing UGC moderation," provide "an in-app system for reporting and blocking objectionable UGC and users," and provide in-app **user blocking** for one-on-one interactions. Chairside has both user uploads *and* 2–3 player interaction. Reporting/blocking backends are not a week-8 checkbox.

Also unexamined: IARC content rating for a game featuring blood, screaming, and an axe applied to a patient. A Mature rating would be awkward for institutional distribution and unlistable in some markets — worth knowing before the art direction is final, not after.

**Do:** add terms-acceptance-at-upload, a report button, and a block control to the week-2 DO work (the DO already owns sessions). Run the IARC questionnaire early — it is free and takes 20 minutes.

### 17. Privacy, data residency, and GDPR are absent.

The DO holds the full case server-side; PDFs transit Cloudflare and Google. No privacy policy, no DPA with Google (available on the paid tier — another reason paid is correct), no stated data location, no deletion path, no answer for an EU student using a globally-reachable PWA. The study also generates human-subjects research data with no data-management plan. FERPA is largely a US-institution obligation rather than his, but any US university pilot will ask.

**Do:** privacy policy + deletion endpoint + a one-line data-flow diagram. Half a day, and it is required for both app stores anyway.

### 18. Adherence is named as the co-primary outcome and the central pitch — and no analytics exists anywhere in the plan.

§6.2: "your metric is sessions-per-user-per-week." §8: "pre-register adherence — D1/D7/D30 retention." The dependency list has four packages, none of them analytics. The file map has no telemetry module. The 8-week plan has no analytics task. The claim the whole positioning rests on has no instrument.

**Do:** add a privacy-respecting analytics choice (PostHog free tier or self-hosted, or a minimal event table in the DO) to week 1, because retention data has to *start accruing* early to be worth anything by week 7.

---

## TIER 4 — Things the founder asked for that the document quietly removed or overstated

### 19. The slapstick is gone, and nobody says so plainly.

The founder's requirement #6 is "SLAPSTICK PHYSICS throughout: absurd wrong instruments (there is an axe), accidental hits, ragdolls, objects flying, chaos." The synthesis dissolves it across three places without ever stating the conclusion: §6.3 quarantines all non-diagnostic slapstick to "the lobby, between rounds, and the failure-summary screen — never on-screen during reasoning"; §6.3 further says the axe survives *only* as a class-D scored instrument error; and §1 **cuts class D**. So the axe is cut twice, and "chaos throughout" becomes "one authored set-piece in the execute phase, three total."

The reasoning is sound and well-evidenced. The problem is presentational: this is the founder's emotional core and the thing he thinks makes the game shareable, and he will discover it is gone in week 4 rather than deciding about it now.

**Do:** add an explicit "what your #6 becomes" paragraph. And note the genuine tension worth his decision: §5.7 says failure must be the shareable TikTok unit, while §6.3 says the funniest (non-diagnostic) material must be quarantined out of the main viewport. The marketing asset and the pedagogy are pulling in opposite directions and only he can price that trade.

### 20. The peer-debriefing evidence is overclaimed in a way a med-ed academic will catch instantly.

§6.1 moves from "peer-led debriefing is non-inferior to instructor-led" to "so you can ship a structured self/peer debrief **with no faculty in the loop** and stand on published equivalence data." Peer-led debriefing in those studies means a *trained human peer facilitator*, not a 90-second automated script with no facilitator at all. That is a different intervention, and the leap is exactly the kind of thing the dental-school academic he needs as a champion will flag.

**Do:** phrase it as "consistent with evidence that a non-expert facilitator suffices; our automated debrief is an untested extension we intend to evaluate." The document already models this honesty elsewhere (§4.6's SMD caveat); apply it here.

### 21. Two internal contradictions to resolve before they cost a day each.

- **§1 demo spec:** "one lecture PDF, uploaded live" and, one sentence later, "8–12 pre-baked cases so it never touches the network live." Which is it? (Resolvable: upload live, show extraction + blueprint streaming in ~5s, then cut to a pre-baked case — but say so.)
- **§6.4 diegetic documents:** "keep them diegetic to *pick up*, non-diegetic to *read*… snap the document to a flat, full-frame, screen-space view." A full-frame screen-space document is functionally the flat overlay §9 trap 15 spends a paragraph rejecting. The rejection of `<Html>` is still correct on other grounds, but the stated justification ("it will read as a browser sticker") no longer applies to the state you actually read in.

### 22. Art-pipeline consistency is asserted, not solved.

The style is "locked flat-shaded low-poly," the room is Kenney, the hero patient is Mixamo (not flat-shaded, not Kenney-styled, 65-bone `mixamorig` rig), and the crowd is Quaternius. Reconciling those — retint, decimate, decimate the crowd rig to ~20 bones — is Blender work, and the project's own task list has **Blender blocked on a RAM upgrade** (tasks #1 and #4). The document says Quaternius avoids "the Blender round-trip," which is true for Quaternius and false for the Mixamo hero.

**Do:** either accept the hero at full Mixamo rig and full fidelity mismatch for v1 (probably fine, one character), or resolve the RAM blocker in week 0. Say which.

### 23. Two smaller corrections.

- **Gemini price:** verified as **$0.25–$0.50** input / $1.50 output per MTok for Gemini 3.1 Flash-Lite (tiered, presumably by context length). The synthesis quotes only the $0.25 floor, so the "$0.01–0.02 per lecture" figure is a best case and could be ~2x on long decks. Immaterial to viability, but don't quote the floor in the application.
- **`deal.test.ts` is weaker than it looks.** `!wireA.includes(f.value)` is a raw substring check on serialized JSON: it will false-positive on any short or common value ("yes", "7mm", "none"), and it catches no semantic leakage (category names, tooth indices, array lengths). Add a structural assertion — the parsed packet's fact set for foreign channels must contain exactly the allowed key set — alongside the substring check.

---

## 24. What I could not verify, which the document presents as settled

The synthesis states roughly forty pricing, licensing, version, and availability facts with high confidence. I confirmed four:

- Gemini 3.1 Flash-Lite exists; free tier = "Content used to improve our products," paid = "not used." **Correct as stated.**
- Gemini API is available in Jordan. **Confirms a risk I suspected and it is not a problem.**
- Cloudflare DO free tier: 100,000 requests/day, 13,000 GB-s/day, SQLite-backend-only on free, 100,000 row writes/day, 20:1 incoming-WebSocket-message ratio. **All exactly as the synthesis states; the ~18 room-hours/day arithmetic holds.**
- Google Play UGC policy requirements. **As summarized in item 16.**

Everything else — Rive's $9/mo and the Oct 2025 export change, Mixamo's status, Ready Player Me's shutdown, Meshy's CC BY 4.0 free tier, `@react-three/rapier@2.2.0` pinning `rapier3d-compat@0.19.2`, `rapier3d-simd-compat@0.19.2` existing at the same layout, Piper's GPL relicense, Sonniss terms, Photon/Playroom/Colyseus pricing, `ts-fsrs`'s MIT license, and every meta-analytic effect size — is **unverified by me**. Most are low-consequence. Three are worth re-checking personally because a decision hangs on each: the `rapier3d-simd-compat@0.19.2` version-and-layout match (item 11 fails differently if it's wrong), Rive's export restriction (it's the entire justification for cutting Rive), and Meshy's post-downgrade asset ownership (the raw findings themselves flag it as unconfirmed).

---

## The three things I would change first

1. **Answer the YC relocation question this week**, in writing, before another line of code. If the answer is "I can't," re-point the entire plan.
2. **Make the cache per-uploader and get one professor to license his slides.** This removes the largest legal exposure and creates the first design partner in the same move.
3. **Run the hidden-profile test on five human classmates in week 2**, on the DOM placeholder. It costs an afternoon and it either validates or kills the only defensible claim in the document — and it is far better to learn that in week 2 than in week 7.

**Sources verified:** [YC FAQ](https://www.ycombinator.com/faq) · [YC Apply](https://www.ycombinator.com/apply) · [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Gemini available regions](https://ai.google.dev/gemini-api/docs/available-regions) · [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) · [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937) · [US Copyright Office DMCA agent directory](https://www.copyright.gov/dmca-directory/) · [AsymPuzl, arXiv:2512.03466](https://arxiv.org/abs/2512.03466)