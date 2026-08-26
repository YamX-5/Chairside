## Adversarial review — CHAIRSIDE graphics upgrade plan

Verified against the real files in `D:\My Apps\study-game`, `three@0.185.1` / `@react-three/fiber@9.6.1` in `node_modules`, and the Blender 5.2.0 install at `D:\Tools\blender-5.2.0-windows-x64\blender.exe`. Everything below marked **[measured]** was run in this session.

---

# TIER 0 — The plan is verified against a component that does not render

**0.1 `src/clinic/ClinicExperience.tsx` is dead code.** `src/main.tsx:113` mounts `ClinicCase`, lazily, and nothing anywhere imports `ClinicExperience` **[measured — grep across `src/`, `public/`, `index.html`, `vite.config.ts`]**. Four separate plan items are edits to a file the game never loads:

| Plan item | Reality in the mounted path |
|---|---|
| Step 2: "cap `dpr` at `ClinicExperience.tsx:154` — possibly the largest frame-time win in the project" | `src/clinic/ClinicCase.tsx:274` is **already `dpr={1}`**, with a comment explaining why. **The single highest-ROI item in the plan is a no-op.** |
| §7 row "Post-process passes ~11 today → ≤8"; Day 5 "drop `Bloom levels={4}` → `3`" | `PostFX` is imported **only** by `ClinicExperience`. `ClinicCase` mounts **zero** post-processing. The budget row, the ceiling, and the Day-5 trim are all fiction. |
| §5 "your existing `<Environment resolution={256} frames={1}>` Lightformer rig… Leave it. That saves you a day." | That `<Environment>` is at `src/clinic/Room.tsx:425`. `Room.tsx` is the **primitive fallback**, rendered only when `kit/wall.glb` is absent (`RoomModel.tsx:85`). The file exists. `Room.tsx` never renders. |
| §1 #1 "`ContactShadows` is frozen at one frame under the chair only" | Same file, `Room.tsx:492`. Also never renders. The correct statement is stronger than the plan's: there is **no contact shadow in the shipping scene at all**. |

**0.2 The consequence nobody noticed: the shipping game is never tone-mapped.** `ClinicCase.tsx` sets `gl={{ toneMapping: NoToneMapping }}` — correct *only* because `PostFX` was supposed to own ACES. With no `PostFX` mounted, the frame ships raw: no tone curve, no grade, no saturation lift, no vignette. That is plausibly a real share of "it looks hand-coded," and it is a one-line fix (either `toneMapping: ACESFilmicToneMapping` on the Canvas, or mount `<PostFX />` in `ClinicCase`). **This should be Day 1 hour 1, ahead of everything in the plan.**

**Action:** before any of this work starts, decide whether `ClinicExperience.tsx` + `PostFX.tsx` are being revived or deleted. Every number in §7 must be re-measured against `ClinicCase` with `window.__clinic.stats()`. The plan's own Gate 4 rule ("do not trust any estimate in this document over that readout") applies to the plan itself.

---

# TIER 1 — Ship-breaking: the Monday-to-Friday work produces a black-and-grey room

**1.1 The bake as specified renders the entire scene GREYSCALE.**
§3 step 4 / §6 step 5: `bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', use_clear=True)`. `use_clear` wipes the attribute and writes **pure AO** — a greyscale mask. Step 4's runtime table then says `new MeshBasicMaterial({ vertexColors: true })` with the explicit note *"leave `color` at its white default."* White × greyscale AO = **greyscale**. Skin, teal upholstery, honey wood, blue gown, red scaler grip — all gone.

The plan's "I proved it end-to-end" run only ever asserted `attrs POSITION, NORMAL, COLOR_0`. It verified that the attribute **exists**, never that it contains colour. That is exactly the class of blind-agent error the plan's own Gate 2 was invented to catch, and Gate 2 was not run on it.

**Fix (also the cheapest):** bake AO only, and keep the albedo in the material — `new MeshBasicMaterial({ color: hex, vertexColors: true })`. three multiplies them. This preserves the existing palette pipeline (see 1.4) and needs no node-tree surgery at all.

**1.2 Unlit + AO-only is *flatter* than what ships today.**
Today every mesh is `MeshLambertMaterial` under `hemisphereLight` + two `directionalLight`s (`RoomModel.tsx:29-31`). The N·L term is the only shading variation in the frame — and it is real: adjacent faces of a box read at different values. Baking **AO only** and rendering `MeshBasicMaterial` deletes it. Every face of every box becomes one flat value, modulated only by crevice darkening.

The plan's own style contract says *"One key light direction"* — but its recipe bakes no light direction anywhere. §3 is internally contradictory, and as written it makes the picture worse on the axis it claims to fix. If you go unlit, the bake must be `COMBINED` (or `DIFFUSE` with direct+indirect) with the key light present in the Blender scene, not `type='AO'`.

**1.3 The 25 Kenney kit models have no `COLOR_0` — the room renders BLACK.**
**[measured — parsed all 28 shipped GLBs]**:

```
28 files | 511,184 bytes | 153 prims | 6,454 tris | 0 images
every single file: attrs = NORMAL, POSITION, TEXCOORD_0     (zero COLOR_0)
```

Step 4 swaps `ClinicKit.tsx:74` to `MeshBasicMaterial({ vertexColors: true })`. In three r185, a program that declares `USE_COLOR` against geometry with no `color` attribute hits `gl.disableVertexAttribArray` (`node_modules/three/src/renderers/webgl/WebGLBindingStates.js:292`) and falls through to `material.defaultAttributeValues`, which `MeshBasicMaterial` does not define (line 323). The generic attribute stays at its WebGL default `(0,0,0,1)`. **Result: black.** No error, no warning.

That is 67 shell draw calls + 44 prop draw calls = **111 of ~157 draw calls, black**, in the single commit the plan insists must not be split.

There is no script in the plan to bake the kit — `scripts/` changes are listed as `build_patient.py`, `build_dental_chair.py`, `build_instruments.py` only. And Gate 1's glob is `public/models/*.glb`, which does **not** match `public/models/kit/*.glb`, so the auditor would pass green while 25 files violate the contract it exists to enforce.

**1.4 "Colour lives on vertices, never in the material" destroys the best-designed piece of the existing pipeline.**
`ClinicKit.tsx:33-49` is a `material-name → hex` table, commented *"This is the art direction, in one place."* On top of it sit per-instance overrides (`FLOOR_OVERRIDE`, `WALL_OVERRIDE`, `ClinicKit.tsx:106-108`) that let the *same* Kenney `wood` material read as pale stone on the floor and honey on the dado. Kenney ships untextured, semantically-named materials specifically so this works.

Moving colour into vertices converts every palette change from *editing one table* into *re-baking 25 third-party GLBs in Blender*. That directly contradicts the plan's own Day 1 (palette iteration) and Day 0 (pick a reference, decide the grade in week 2). Keep colour in the material; put **only AO** in `COLOR_0`.

**1.5 `MeshBasicMaterial` has no `emissive`.**
**[measured — no `emissive` token in `node_modules/three/src/materials/MeshBasicMaterial.js`]**. Step 4's *"`MeshBasicMaterial({vertexColors:true})` + keep the emissive branch for the lamp lens"* cannot be written. It also silently drops, from `ClinicKit.tsx:74-83`: `emissive`/`emissiveIntensity: 1.1` on `lamp`, and `transparent` / `opacity: 0.35` / `DoubleSide` on `glass` (the window). The chair's `LightLens` (`build_dental_chair.py:187`, Emission Strength 1.4) goes dead too.

Knock-on: `PostFX`'s `Bloom luminanceThreshold={1}` blooms *only* those emissives. Remove them and Bloom has zero input — the right move is to delete Bloom, not drop it to `levels={3}`. (Moot today, per 0.1.)

---

# TIER 2 — The promised result is not achievable by the described pipeline

**2.1 Per-asset bakes cannot produce inter-object occlusion — which is the thing Yaman is told to check with his own eyes.**
Verification bar #2: *"Look at where the chair column meets the floor… There must be visible darkening that was not there on Monday."* The floor lives in 16 instances of `kit/floorFull.glb`; the chair is `dental_chair.glb` from a separate script; both are positioned at runtime by `ClinicKit.tsx` / `DentalChair.tsx` from `layout.ts`. A bake inside `build_dental_chair.py` can only see the chair. **Self-occlusion is all you get.** The one contact the plan tells the owner to look for is the one contact it cannot deliver.

Same for the patient: `PatientRig` walks her from `DOORWAY` to `SEAT_WORLD` via `arrival` 0→1 (`PatientRig.tsx:250-284`). Nothing about her contact with the chair or floor is bakeable at all. Under-chin AO (bar #2's other half) *does* work — that's self-occlusion.

**2.2 Baking directional light into an animated character is wrong by construction.**
`PatientRig` writes `.rotation` on 16 named parts every frame. Bake the key light (required by 1.2) and a raised arm keeps its rest-pose shading. Bake AO and the jaw's contact band travels with the jaw when `p.jaw.rotation.x = r.jawX + jawOpen * 0.62` swings it 35° open — so the scream, the beat the whole reaction system exists for, opens a gap with *no* darkening while the baked shadow rides down on the moving part. The correct split is: bake the static room, keep the patient on a cheap lit material (Lambert or Toon). The plan applies one recipe to both.

**2.3 Gate 2 as specified will fail every bake it is supposed to protect.**
*"Fail if any view has >2% of the frame changed by >2%, or max channel diff >30%."* The purpose of the bake is to change the frame everywhere. This gate blocks the work. It is a useful *review artefact* (before/after contact sheet a human looks at) and a useless *pass/fail gate* for anything except decimation regressions.

**2.4 Merging is blocked by attribute mismatch, and the shared-material assumption is false.**
`BufferGeometryUtils.mergeGeometries` requires identical attribute sets. Post-bake authored GLBs would carry `POSITION/NORMAL/COLOR_0` (the plan sets `export_texcoords=False`) while the un-baked kit carries `POSITION/NORMAL/TEXCOORD_0`. Mixing returns `null`. And all four retint loops construct `new Mesh*Material(...)` **per mesh** — `PatientRig.tsx:164`, `DentalChair.tsx:41`, `InstrumentTray.tsx:47`, `ClinicKit.tsx:74` — so "share one material" is not free, it's a rewrite of four loops. The 157 → ~37 estimate assumes work that is not scheduled.

---

# TIER 3 — Breaks existing working systems

**3.1 The patient has no mouth interior. §4's central argument is factually wrong.**
`build_patient.py:190-192`:

```python
jaw = box("Jaw", head, (0, -0.030, -0.052), (0.115, 0.095, 0.055), SKIN, centre=(0, -0.028, -0.022))
box("Mouth", jaw, (0, -0.070, -0.024), (0.052, 0.018, 0.020), MOUTH, centre=(0, 0, 0))
```

`Mouth` is a **5.2 cm × 1.8 cm × 2.0 cm box** of `0x7A4A44`, ~80% buried inside the jaw box, protruding ~3.5 mm. No teeth, no tongue, no palate, no cavity. §4 states the blocker as *"Mixamo has no oral cavity… meanwhile your `patient.glb` exports… a working `Jaw` and a `Mouth`."* **Neither asset has an oral cavity.** The mouth rig must be authored either way, so the case for keeping the hand-built body collapses to "the walk cycle already reads acceptably" — a legitimate argument, but a far weaker one, and the plan should be honest that it is choosing on cost, not on a capability the current asset does not have. Everything else in §4 (attached mouth rig on the head bone, `SkeletonUtils`, name sanitisation, mixer ordering) is correct and should survive.

Second-order: an AO bake on that geometry drives `Mouth` toward zero and renders the mouth as a black slit — which may read fine, or may read as a hole. Nothing in Gate 1 or Gate 3 can tell you which.

**3.2 Matcaps erase instrument identity, and gameplay depends on it.**
`build_instruments.py:23-32` colour-codes by function: `GRIP_RED 0xB8503F` (scaler), `WOOD 0xA87A45` (axe handle), `HANDLE 0x3E4A57`, `SYRINGE_FLUID 0xBFE3D6`, `MIRROR 0xE8F2F7`, `BUR`, `BLADE`, `STEEL`/`STEEL_DARK`. One steel matcap on `InstrumentTray.tsx:47` makes nine functionally distinct tools identical grey. Picking the wrong one is a graded error class (`D_WRONG_INSTRUMENT`, per `instruments.ts:1-11`), and in a 2-3 player hidden-info co-op, players call instruments out loud — **legibility is a mechanic**. The plan's own `reference-bar` research warned matcaps break when the camera orbits; the plan overrules it with *"instruments are small, hand-held and view-locked"*, which is true of exactly one instrument. Five sit on the tray, four in the cabinet, both static in world space while the player walks around them.

If matcaps ship: held item only, and keep per-instrument `color` (`MeshMatcapMaterial` multiplies matcap × color).

**3.3 `Patient3D.tsx` is not in the plan's file list and loads the same GLB.**
`Patient3D.tsx:32` loads `patient.glb`, applies **no retint at all**, and hardcodes `SEAT = [1.5, 0, 0.4]` (line 11) — a second seat constant contradicting `layout.ts`'s derived `SEAT_WORLD` `[1.6, 0.46, -0.18]`, exactly the drift `layout.ts:22-31` was written to prevent. It is currently unreachable (only `ClinicExperience` mounts it), but it is the next file to break and it belongs in the audit.

**3.4 Five inline `<meshLambertMaterial>` meshes go black if the lights are "cleaned up".**
`InstrumentTray.tsx:157, 169, 183, 187` plus the tray slab. §5 argues the lights become redundant once everything is baked-unlit; act on that and these five go black. The plan's material table doesn't list them.

**3.5 §5's own follow-on work breaks `layout.ts`, which the plan promises will not change.**
Feeding the Substance Dental Seat spec (2.03 × 1.49 × 1.57 m) into `build_dental_chair.py` necessarily changes `SEAT_TOP` (printed at line 225, hand-copied into `layout.ts:43` as `SEAT_LOCAL`). That cascades to `SEAT_WORLD`, `CHAIR_HALF_X`/`CHAIR_MIN_Z`/`CHAIR_MAX_Z` colliders, the `solve` interactable, the `stool` seat, and `TRAY` in `InstrumentTray.tsx:30`. Same for re-authoring instruments from the 91-part breakdown: `InstrumentTray.tsx:82-83` does `clone.position.set(0,0,0); clone.rotation.set(0,0,0)` and relies entirely on the grip-at-origin convention documented in `build_instruments.py:4-14`. Bevels are safe (geometry-local); re-authoring is not.

**3.6 Fog at 3→9 m in the cream palette will undo Day 1.**
Current `<fog args={[0xf2e9dc, 16, 34]}>` (both `ClinicCase.tsx:282` and `ClinicExperience.tsx:177`) starts at 16 m in an 8 m room — it does nothing today. Day 5's 3→9 m fog is right in principle, but `0xf2e9dc` is the same cream as the wall (93% luminance). Fogging toward the wall colour flattens exactly the floor/wall/ceiling separation Day 1 created. Pick a fog colour distinct in value, or skip it.

---

# TIER 4 — Overstated, unverified, or wrong-in-detail

**4.1 The dpr arithmetic is wrong by 2.25×.** *"Windows display scaling at 150% makes `window.devicePixelRatio = 1.5`, so you are rendering 2880×1620 = 4.7 MP."* At 150% OS scaling on a 1080p panel the CSS viewport is ~1280×720 and dpr 1.5 puts the buffer back at 1920×1080 = **2.07 MP**. The *ratio* (2.25× vs dpr 1) is right; the absolute figure assumes a 2880×1620 panel. Moot per 0.1.

**4.2 "MeshBasicMaterial is cheaper, so frame time drops" is asserted, never measured** — on a scene of 4,366 visible triangles with no post-processing, where the plan itself says the bottleneck is draw-call submission. The direction is right; "the frame time drops" is a claim the plan demands measurement for from everyone else.

**4.3 `~18.6 bytes/triangle` is extrapolated from one sphere.** That sample carried `CORNER`-domain colours, which fully unshare vertices; bytes/tri is topology-dependent. Don't budget the 22,000-tri / ~410 KB target from it.

**4.4 Substance licence — the plan is stricter than the primary source, and its caveat is not in the current text.** The 2025-04-22 Product Specific Terms grant a *"worldwide, non-exclusive, limited, revocable, non-transferable, non-sublicensable… perpetual"* licence to use, copy, modify, and to distribute **as incorporated into a Larger Work or modified into a Modified Work**; "Larger Work" is defined as a new work incorporating an *unmodified* asset (a game qualifies), "Modified Work" as one created by modifying an asset. So **shipping decimated Substance geometry is permitted.** Reference-only is a *polycount* decision, not a licence necessity — say so, rather than implying the licence forces it. The plan's asserted caveat ("perpetual survival covers only uses made prior to the end of the subscription") does **not** appear in the 2025-04-22 text, which says "perpetual" flat; it appears to be inherited from the older 2024-06-18 doc or the enterprise PSLT. Do not put either summary in a YC application. And nobody — plan or research — flagged the clause that actually matters: **"revocable."**
Source: [Adobe Substance 3D Assets PST, 2025-04-22](https://wwwimages2.adobe.com/content/dam/cc/en/legal/servicetou/Adobe-Substance-3D-Assets-Product-Specific-Terms-20250422.pdf)

**4.5 Mixamo — the licence is fine; the *availability* is the risk, and the plan understates it.** Adobe's FAQ is explicit: free, royalty-free, unlimited commercial use, characters and animations usable in video games; the only bar is redistributing raw files as the product. No licence problem. But Mixamo has been in maintenance mode since a **June 2025 backend authentication failure Adobe has not fully repaired** — upload, download, account state and the auto-rigger all sit behind that identity layer and are intermittently unavailable through 2026. The plan schedules the auto-rigger as a hard prerequisite ("upload one to the Mixamo auto-rigger to get access to the 2,400-clip library") with no fallback. **Removing the dependency is nearly free:** Quaternius Ultimate Modular Men/Women already ship **24 animations and a humanoid-rig version**, CC0, native glTF — the plan cites the pack for its mesh and doesn't notice it already carries clips. Whatever you do take from Mixamo, pull it into the repo now and treat mixamo.com as a one-time download, never a build-time service.
Sources: [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) · [Quaternius Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html)

**4.6 The plan's "single most expensive trap" has a documented one-line fix it missed.** **[measured on this machine's Blender 5.2.0]**:

```
export_vertex_color  ENUM ['MATERIAL', 'ACTIVE', 'NAME', 'NONE']  default= MATERIAL
export_vertex_color_name  STRING  default= Color
export_all_vertex_colors  BOOLEAN  default= True
```

The default `'MATERIAL'` is precisely why the attribute was dropped — it exports only colours the material node tree references. `export_vertex_color='ACTIVE'` (or `'NAME'` + `export_vertex_color_name='Col'`) exports it with **no node-tree surgery at all**. The plan's `ShaderNodeVertexColor` + `MixRGB` rewiring (Appendix correction #3, billed as "the single most expensive trap in the plan") is unnecessary — *and it is what manufactures the greyscale bug in 1.1*, by making the albedo look like it lives in the attribute right before the AO bake wipes it.

**4.7 §7 numbers that do hold.** **[measured]** 3D payload = **511,184 bytes** across 28 files (plan says 511 KB ✓). GPU-resident textures ≈ 0 MB — **zero images in all 28 GLBs** ✓. Room draw-call arithmetic (16 floor + 50 wall + 1 ceiling + 44 props = 111) ✓. `patient.glb` and `dental_chair.glb` genuinely both 964 tris / 23 prims / 7 mats ✓ (Appendix #7 — keep that warning, it will trip someone).

---

# TIER 5 — Effort and sequencing

**5.1 "Days 2-3 — the bake" is a 2-3 week body of work as scoped.** It now has to also cover: a bake script for 25 third-party Kenney GLBs that has no build script today (1.3); a colour-preserving bake path (1.1); a light-carrying bake (1.2); an inter-object staging scene if bar #2 is to mean anything (2.1); a separate treatment for the animated patient (2.2); and the `contact_sheet.py` harness. For a solo dev whose agent cannot see a viewport and whose only visual feedback is a numpy diff of 256² EEVEE renders, that is not two days.

**5.2 "Day 4 — merge" cannot be one day.** It requires normalising attributes across 28 files (2.4), replacing the 16-tile kit floor — which is the grid `layout.ts:8-13` explicitly says its coordinates are derived from — and rewriting four per-mesh material loops.

**5.3 Day 0 does block, contrary to the plan.** Day 1 afternoon commits a palette, and Day 0 exists to choose the grade. Send the five links first.

---

# What survives, and what I'd actually do Monday

**Keep, verified correct:**
- `sanitizeNodeName` strips the colon, not underscores it — `mixamorig:Head` → `mixamorigHead`. **[measured — `node_modules/three/src/animation/PropertyBinding.js:3-4`]**
- `useFrame` priority **> 0** disables r3f's auto-render. **[measured — `@react-three/fiber/dist/events-b389eeca.esm.js:1121` and `:16060`]** Worth adding: `DevProbe.tsx:41` already subscribes at `-1`, and the guard is `priority > 0`, so it is safe — the plan should say so explicitly or someone will "fix" it.
- `SkeletonUtils.clone` vs `scene.clone(true)`; the module-level cache in `useOptionalGLTF.ts:25` makes the shared-skeleton failure guaranteed, not incidental.
- The missing meshopt decoder at `useOptionalGLTF.ts:44` — real, and the swallowed `() => resolve(null)` on line 48 makes it silent.
- The attached-mouth-rig-on-the-head-bone architecture. Best idea in the document. Just don't justify it with a mouth the patient doesn't have.
- Instrument bevels (`build_instruments.py` `box()`/`cyl()` genuinely lack `bevel_mesh`, unlike `build_dental_chair.py:78` and `build_patient.py:37`); palette value structure; "Substance is a spec source, not an asset store"; `CORNER` domain; exactly one colour attribute.

**Re-ordered first week, cheapest real wins first:**
1. **Hour 1** — resolve `ClinicExperience` vs `ClinicCase`, and get a tone map + grade onto the shipping frame. Currently there is none. Measure `window.__clinic.stats()` on `ClinicCase`, not on the dead component.
2. **Hour 2** — palette value structure in `theme3d.ts` (still correct, still the best effort/return in the plan), plus a fog colour that is *not* the wall colour.
3. **Half a day** — instrument bevels. Genuinely 30 lines, genuinely visible, zero risk to any contract.
4. **Then** — AO-only bake into `COLOR_0`, keeping `color` in the material (`new MeshBasicMaterial({ color: hex, vertexColors: true })`), using `export_vertex_color='ACTIVE'`, on the three authored assets **plus a new script for the 25 kit files**, staged in one Blender scene so floor/wall/chair contacts actually exist. Patient stays lit.
5. **Not this month** — merging, matcaps, Mixamo.