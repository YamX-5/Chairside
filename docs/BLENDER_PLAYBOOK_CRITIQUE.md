I have enough verified evidence. Here is the audit.

---

# Adversarial review: Chairside 3D Playbook

Everything below was re-tested on the actual install (`D:\Tools\blender-5.2.0-windows-x64\blender.exe`, `5.2.0 LTS`, hash `fbe6228777e7`, built 2026-07-14, bundled Python 3.13.13) against the shipped GLBs. Probe scripts: `C:\Users\LENOVO\AppData\Local\Temp\claude\D--My-Apps-ideas\10b26901-3464-4173-9d9c-86cf942208e2\scratchpad\audit\p1.py` … `p7.py`.

**Headline:** the playbook's *measurements* are honest and reproducible — I re-derived its timings, its AABBs and its BVH costs and they hold. Its *mechanisms* have four holes, two of which mean the plan silently does nothing and one of which re-introduces a bug the codebase already fixed and documented. The thesis ("add measurement, not a modelling system") is right. The implementation as written would not gate anything.

---

## P0 — Will not work, or will break something that works

### 1. The build gate does not fail the build. Blender exits 0 on an uncaught exception.

**Claim** (§7, from studio-practice): *"Blender exits non-zero on an uncaught exception, so `blender --background --python build.py` becomes a gate you can wire into `npm scripts`."*

**Measured — false on this build:**
```
EXIT_CODE_ON_UNCAUGHT_EXCEPTION=0
EXIT_CODE_ON_SUCCESS=0
```
The traceback prints (`AssertionError: LayoutError: tray in chest`) and Blender still returns 0.

**Why it matters:** this is load-bearing for the entire document. Every `raise LayoutError(...)` in §3, the whole of Hour 2, and "the build now refuses to export a broken GLB" all depend on it. As specified, `npm run build` would print a scary traceback and ship the broken GLB anyway. Worse for an agent: a non-zero exit is the only signal an automated loop reads.

**Do instead** — verified working:
```
blender.exe --background --python-exit-code 1 --python build_all.py
```
→ exit 1 on failure, 0 on success. Bare `sys.exit(3)` also propagates (`= 3`). Add the flag to the npm script, and assert the exit code in CI/`npm test`. One flag; without it the other 8 hours of work are decorative.

### 2. The flagship "proof it replaces guessing" fix is broken. It detaches the tray from its arm and leaves the arm inside the patient.

The playbook's showcase (§3, *"Exactly the two requested clearances. First try. No render."*) is presented as the proof of the whole method. I ran its exact code on the real GLBs with the patient seated per `layout.ts`:

```
BEFORE  clearance(Tray,   Chest) = -0.1068     <- the bug it fixes
BEFORE  clearance(TrayArm,Chest) = -0.1118     <- the bug it does NOT fix
BEFORE  Tray <-> TrayArm         =  0.0012     <- they are joined

AFTER   clearance(Tray,   Chest) = +0.0800  ok
AFTER   clearance(Tray,   ThighL)= +0.0600  ok
AFTER   Tray <-> TrayArm         = +0.1418     <- TRAY NOW FLOATS 14 cm OFF ITS ARM
AFTER   clearance(TrayArm,Chest) = -0.1118     <- ARM STILL BURIED IN HER CHEST
```

Cause: `Tray` and `TrayArm` are **siblings**, both parented to `DentalChair` (`build_dental_chair.py` — `cyl("TrayArm", root, …)`, `box("Tray", root, …)`). `shift_world(tray, …)` moves the tray and its three instrument children; the arm stays put.

**Why it matters far beyond one bug:** this is the playbook's own thesis failing in its own demo. It satisfied the two clearances it asserted and destroyed a third relationship nobody asserted — then declared victory *without rendering*, which is precisely the failure mode §4 warns about ("assertions catch what you'd have to look hard for, the sheet catches what assertions were told to ignore") before §4 discards it with "Assert *before* you render… the numeric pass is ~1400× cheaper."

**Do instead:** add the missing invariant class the playbook never proposes — **attachment/connectivity assertions**, not just clearance ones:
```python
def assert_attached(a, b, max_gap=0.005):
    if clearance(a, b) > max_gap:
        raise LayoutError("'%s' floats %.4f m off '%s'" % (a.name, clearance(a,b), b.name))
```
Declare the support graph once (`Tray→TrayArm→TrayPost`, `Spittoon→SpittoonNeck→SpittoonArm`, `LightLens→LightHead→LightArm→LightPost`) and assert it after every move. Clearance assertions alone are one-sided: they can only push things apart. And keep the render in the loop as a *veto*, not a formality — the 300 ms for five extra views is the cheapest insurance in the document.

Better still: reparent the delivery unit into a real chain (`TrayPost → TrayArm → Tray → Instrument*`) so moving the arm carries the tray. The chair is built as a flat sibling list under `root`; that is the actual structural defect.

### 3. The `CHAIR_HALF_X` "fix" re-introduces a bug the codebase already fixed and documented.

The playbook's measurement is correct — I re-derived it by hand from `build_dental_chair.py`: chair spans Blender x `[-0.575, +0.800]` (`Spittoon` at x=0.70 r=0.10 → 0.80; `TrayArm` rotated `(0,1.5708,0)`, depth 0.55 at x=-0.30 → -0.575). So `CHAIR_HALF_X = 0.42` does not describe the mesh.

But the prescription — `CHAIR_HALF_X = Math.max(-min[0], max[0])` → **0.80** — nearly doubles the player collider, and `layout.ts` says in the source:

> *"Deliberately tight — an oversized chair collider plus the player radius is what stopped anyone getting near the patient."*

**Why it matters:** `CHAIR_HALF_X` is not a stale measurement, it's a tuned gameplay value that solved a known bug. "Derive, don't retype" is the right principle applied to the wrong constant. The overhang is a thin spittoon arm at hip height that a player should walk under/past, not collide with. Shipping this makes the patient unreachable again — the exact regression the comment memorialises.

**Do instead:** emit the manifest (that part is good) but derive the collider from the **seat/base footprint** (`SeatPan`, `Base`, `Column`), not the full-asset AABB. Or add `COL_` proxy Empties in the build script — the playbook proposes `COL_` prefixes in §7 but never connects them to this. Keep a deliberate, commented gameplay margin either way, and have `layout.test.ts` assert *"collider ⊆ full bounds"* rather than *"collider == full bounds"*.

### 4. `assert_encloses(head, hair)` is a false-positive generator, and the hair-helmet bug is **not** still live.

The playbook's table says: *Hair enclosed the face like a helmet → **Still live.** `'Hair' escapes 'Head' on X by (0.0038, 0.0038) m`.*

Measured on the shipped `patient.glb`, **all three axes** (the playbook only reports X because `assert_encloses` raises on the first failing axis, i=0):
```
HEAD_AABB  (-0.1189, -0.0150, 0.4970) .. (0.1189, 0.2657, 0.7924)
HAIR_AABB  (-0.1226,  0.0262, 0.5780) .. (0.1226, 0.2925, 0.8075)
HAIR_ESCAPE X under=0.0038 over=0.0038
HAIR_ESCAPE Y under=0.0000 over=0.0268   <- 7x the reported X figure
HAIR_ESCAPE Z under=0.0000 over=0.0151
FRONT_Y  Head front=-0.0150  Hair front=+0.0262  EyeL front=-0.0093
```

Two things follow:

- **The helmet bug is fixed.** The hair's frontmost point is **41 mm behind** the head's frontmost point, and the eyes sit in front of the hair. The hair cannot occlude the face. The escapes are on +Y (back of skull) and +Z (crown) — which is what correctly authored hair *must* do.
- **The assertion is wrong for the invariant it claims to guard.** Any hair sitting on a crown escapes the head AABB upward and backward. `assert_encloses(head, hair)` will fail on every correct version, forever. Hard-coding it as a Hour-2 gate means a permanently red build whose only "fix" is shrinking the hair back into a skullcap — regressing the art to reintroduce the bug.

**Do instead:** assert the property that actually broke — face-region occlusion, on the facing axis only:
```python
assert front(hair) > front(head) + 0.02   # hair stays behind the face plane
assert front(hair) > front(eyeL)          # never in front of the eyes
```
Directional, one-sided, and it passes today (correctly) while catching the original regression.

Generalise the lesson: **AABB enclosure is almost never the invariant you mean.** Every `assert_encloses` in §3 needs re-derivation from the actual failure, not from box containment.

---

## P1 — Wrong or overstated facts

### 5. The #1-ranked fix is justified by a false claim. Object names *do* survive re-import.

Playbook fix #1: *"glTF node names are fine so the game works — but Blender's glTF importer names re-imported objects after the **mesh**, so 7 of 23 parts lose their identity when you audit your own GLB. **This blocks every other verification step. Do it first.**"*

Measured — re-imported `patient.glb`, all 24 object names intact:
```
['Chest','EyeL','EyeR','FootL','FootR','ForearmL','ForearmR','Hair','HandL','HandR',
 'Head','Jaw','Mouth','Neck','Nose','Patient','Pelvis','ShinL','ShinR','Shoulders',
 'ThighL','ThighR','UpperArmL','UpperArmR']
OBJ_VS_MESH  [('EyeL','Icosphere.002'), ('Hair','Icosphere.001'), ('Head','Icosphere'), …]
```
Only the **mesh datablock** names are generic. Every probe in this audit indexed by `O["Head"]`, `O["Hair"]`, `O["Tray"]` and worked. It blocks nothing.

**Why it matters:** it's a 2-minute cosmetic cleanup ranked above the things that actually gate correctness, in a 3-hour plan for someone with no time. Keep the fix (mesh names should match), demote it to a footnote, and delete the "do it first / blocks everything" framing.

### 6. There is a third shipped asset the playbook never mentions — and it is the biggest and newest.

`D:\My Apps\study-game\scripts\build_instruments.py` (modified 2026-08-21 00:02, newer than both scripts the playbook analyses) produces `public/models/instruments.glb` (82,684 B — larger than patient + chair combined). Measured on import: **46 objects, 37 meshes**, named `Mirror/MirrorHead/MirrorNeck/MirrorHandle`, `Probe/ProbeShank/ProbeTip`, `Scaler…`, `Syringe…`, `Forceps…`, `Handpiece…`, `Suction…`, `PerioProbe…`, `Bur`, `Needle`, `Axe…`.

It has the same named-contract dependency — `src/clinic/instruments.ts:26`: *"Node name in instruments.glb. Must match build_instruments.py exactly."* — and it is consumed by `InstrumentTray.tsx` in `ClinicCase.tsx`.

**Why it matters:**
- The "full sweep of the two shipped assets: 68 interpenetrating pairs" covers 2 of 3 assets and ~55% of the parts.
- The manifest/socket/naming-assert plan silently excludes the asset most in need of it: instruments are the things that get **held in a hand and put in a mouth**, i.e. the only assets whose clearances change every frame.
- The chair *also* contains `Instrument0/1/2` props while a real instrument set exists separately — a duplication/consistency question nobody has looked at.
- `build_instruments.py`'s docstring shows the author **already independently derived the socket principle** (*"EVERY instrument's origin is at its GRIP… if the origin is arbitrary, every downstream placement becomes a guessed offset"*). The playbook's framing — *"there is no mechanism by which they could know they were wrong"* — is unfair to the newest code and misreads the trajectory.

**Do instead:** make `build_all.py` cover three builders, and put the naming assert on all three name contracts.

### 7. There is no git repository. The determinism argument's payoff does not exist.

```
D:/My Apps/study-game: no .git
D:/My Apps:            no .git
D:/:                   no .git
```
(A `.gitignore` exists; `.git` does not.)

The playbook says GLB export is byte-deterministic (I have no reason to doubt it) *"which makes a `make`-style incremental asset build honest and **makes GLB diffs in git meaningful**"*, and §4 defends *"your most valuable property (deterministic, diffable, **committed** build scripts)"* against BlenderMCP.

**Why it matters:** nothing is committed. Determinism buys you nothing without version control, and the single highest-value reproducibility action for this project is `git init`, not a socket daemon. This is also the honest answer to the "assets becoming unrebuildable" question in the brief: today, one bad overwrite of `build_patient.py` loses the patient permanently, because the GLB cannot be decompiled back into a parameterised build script.

### 8. Nothing about version pinning or portability was considered — and there is a live 5.x API trap.

Grepped the repo for any Blender version record in `*.md`, `*.json`, `*.ts`, `*.yml`: **zero hits.** `package.json` has 20 test files wired into `npm test` and **no asset-build script at all** — the GLB build is a manual, undocumented, unpinned step against an interpreter that lives outside the project at `D:\Tools`.

Concrete trap I hit while verifying:
```
SET_ENGINE BLENDER_WORKBENCH   OK
SET_ENGINE BLENDER_EEVEE       OK
SET_ENGINE BLENDER_EEVEE_NEXT  FAIL TypeError: enum "BLENDER_EEVEE_NEXT" not found
```
`BLENDER_EEVEE_NEXT` was the correct identifier in 4.2–4.5 and reverted to `BLENDER_EEVEE` in 5.x. An agent writing from training data will use the 4.x name and get a `TypeError`. (Also worth knowing: `RenderSettings.bl_rna.properties['engine'].enum_items` returns only `['BLENDER_EEVEE']` — the enum is dynamic, so introspection **under-reports** available engines. `BLENDER_WORKBENCH` and `CYCLES` are assignable despite not appearing. Do not let an agent "verify" engine availability that way and conclude Workbench is unavailable.)

Also confirmed: `GLTF_PARAM_COUNT = 111` on this build, not the 110 the playbook states — small, but it shows exporter surface drifts between point releases, which is exactly why the flag block should be pinned and asserted rather than remembered.

**Do instead**, all cheap:
- Record `bpy.app.version_string` + `bpy.app.build_hash` into every manifest, and assert it at build start (`if bpy.app.version[:2] != (5,2): raise`).
- Add `"assets": "\"D:/Tools/.../blender.exe\" --background --python-exit-code 1 --python scripts/build_all.py -- public/models"` to `package.json` so the build is discoverable and runnable.
- Put the Blender version + download URL in `README.md`. The portable install is 405 MB of untracked, unversioned toolchain on one laptop with no backup.
- `git init` and commit `scripts/` before anything else in the 3-hour plan.

### 9. The ISO 7494-1:2018 dimensions look fabricated, and the user's own rules forbid that.

Playbook: *"**ISO 7494-1:2018** governs the category: seat vertical travel 350–820 mm, backrest 520–600 mm wide × 760–1020 mm long, seat width 610–710 mm."*

ISO 7494-1:2018 exists and covers dental units and patient chairs, but its published scope is **general requirements and test methods** — construction/safety, instructions for use, technical descriptions, marking and packaging. It is not a dimensional-specification standard. Meanwhile the playbook's numbers map almost exactly onto generic vendor/blog ranges (backrest ~51–61 cm wide, 76–102 cm tall, seat depth ~45–56 cm). ISO's own page returned 403 to automated fetch, so I could not read the clause list — which is itself the point: **the playbook cites clause-level numbers from a paywalled standard nobody in this loop has opened.**

**Why it matters:** `D:\My Apps\CLAUDE.md` rule **G2** exists specifically for this — *"Every clinical computation cites its standard"* — and a false citation is worse than no citation, because it stops the check. It also props up a reassuring conclusion (*"Your `SEAT_TOP = 0.46` … legitimately inside spec"*) that is currently unsupported.

**Do instead:** drop the ISO attribution or buy/read the standard. The playbook's own better advice is two lines later and free: *"bring a tape measure to clinic once."* Yaman is a dentistry student standing next to real chairs — that is ground truth he can obtain today, and it is the only source in this document he can personally verify.

Sources: [ISO 7494-1:2018 catalogue entry](https://www.iso.org/standard/69100.html) · [EN ISO 7494-1:2018 scope](https://standards.iteh.ai/catalog/standards/cen/c215447d-159a-40fe-8319-755593349285/en-iso-7494-1-2018) · [generic dental chair dimension ranges](https://istardentalsupply.com/blogs/blog/dental-chair-dimensions)

---

## P2 — Real, but mis-ranked, under-caveated, or internally inconsistent

### 10. The unlit-room finding is correct, is the most valuable thing in the document, and is ranked last.

Verified the whole chain:
- `public/models/clinic.glb` absent, `public/models/kit/wall.glb` present → `RoomModel.tsx` returns `<ClinicKit />`.
- The `MeshBasicMaterial` swap in `RoomModel.tsx:44` is gated on `if (!scene || !baked) return` — with `clinic.glb` absent, `scene` is null, so **it never runs**. `ClinicKit.tsx:74` `new MeshStandardMaterial(...)` is what renders.
- Light/Environment element counts: `ClinicKit.tsx` **0**, `RoomModel.tsx` **0**, `ClinicExperience.tsx` **0**, `Room.tsx` **8**.
- `ClinicExperience.tsx` is the main game: `<Canvas>` L151, `<RoomModel>` L178, `<PostFX>` L188 — and no lights anywhere in the file.
- `ScenePreview.tsx`, `ReactionLab.tsx` and `ClinicCase.tsx` each define their own lights. So every look-test harness is lit and the shipped first-person scene is not.

That is a standard-material scene with zero light sources and no environment map. It should render black.

**Why the ranking matters:** the playbook puts this in §6 under *"Two landmines found in passing"* and as eyeball-item #1 — while `assert_parallel` on a **1.146°** backrest gap that the playbook itself calls *"reduced from a visible gap to an invisible one"* gets a slot in Hour 2. A possibly-black main scene outranks a 16 mm gap by any measure. Promote it to step zero of the 3-hour plan: two minutes to confirm, ~15 lines to fix.

### 11. `put_world` is safe for translation and silently lossy for rotation — which inverts the plan's ordering.

Verified. Translation-only (as §3 defines it) is exact:
```
PUT_WORLD asked (0.0,0.1,1.2) got (0.0,0.1,1.2) error=0.000000
```
But request a **rotated** world matrix on a child of a non-uniformly scaled, rotated parent — i.e. any of `Hair`, `EyeL`, `EyeR`, `Nose`, `Jaw` under `Head` scale `(1.0,1.10,1.16)` rot `0.22`:
```
PUT_WORLD_ROT max element error = 0.0437   (shear silently lost)
              requested scale (1,1,1) -> realised (1.0048,1.0039,1.0014)
              hair.scale became (0.9704, 0.9352, 0.868)
```
Blender decomposes `matrix_world` into loc/rot/scale and cannot represent the shear, so it approximates — ~2.5° of orientation error and a polluted `.scale` that then multiplies into anything parented below.

**Why it matters:** §3 sells `put_world` as the general "state the intent, let Blender solve it" primitive — *"This is what makes world-space numbers safe."* It is safe only for the translation case it happens to implement. The moment anyone extends it to orientation (aim the light at the mouth; align the tray to its arm — exactly the fix needed for finding #2), it degrades silently on the five parts with the worst parent.

**Do instead:** move *"Stop scaling objects; bake shape into vertices"* out of **"Week 3, optional"** and into Hour 1. It is a prerequisite for the placement layer, not a polish item. Until it lands, add `assert all(o.scale == (1,1,1) for o in ...)` before any `put_world` that carries rotation, and keep `put_world` translation-only by contract.

### 12. The whitelist recipe enshrines the bugs it is supposed to catch.

§3 says the whitelist turns the sweep *"from noise into a regression gate."* Hour 2 says: *"Build the contact whitelist from the 68-hit dump. Ten minutes."* Two lines later: *"Watch it fail on all 21 cross-asset penetrations. Good. That is the point."*

These are contradictory. A whitelist derived from the current dump whitelists `Chest × TrayArm` — the tray-in-chest bug — and the gate goes green on a broken asset. A whitelist derived from *intent* is a different, slower exercise.

**Do instead:** two lists, not one. `ALLOW` = declared-by-intent contacts (small, hand-written, e.g. buttocks/cushion, thigh/legrest). `KNOWN_BAD` = current defects, each with a one-line reason, which the gate reports as warnings and which must shrink. Never generate `ALLOW` from a dump.

I reproduced the sweep cost and it is as cheap as claimed — **46 objects, BVH build 7 ms, all-1035-pairs overlap 1 ms, 69 overlapping pairs.** That part of the argument is sound.

### 13. Hour 1 changes the geometry, then Hour 2 baselines against the old geometry.

Hour 1 sets a shared `RECLINE = 0.24`, deleting `BACK_RECLINE = 0.26`. That is a **geometry change to a shipped asset**, presented as a refactor (*"Kills the 0.26 vs 0.24 bug at the root"*). The chair's own comment records that this value was tuned by eye (*"At 0.42 the backrest leaned further back than she did and left a visible gap behind her shoulders"*). Hour 2 then builds the contact whitelist from a 68-hit dump measured on the **pre-change** geometry.

**Do instead:** freeze geometry during Hour 1 (extract the constant, keep the value at 0.26, note the mismatch), land the gate in Hour 2 against unchanged assets, then change `RECLINE` as its own commit with a render to confirm — which is also what *"one concern per commit"* in `CLAUDE.md` requires.

### 14. Effort estimates are optimistic in the two places that matter.

- *"Build the contact whitelist from the 68-hit dump. **Ten minutes.**"* — 68 pairs across 46 parts is ~9 s/pair, including deciding which of `ArmPostL`/`ArmrestL`/`UpperArmL`/`ForearmL` is which, for someone with minimal 3D experience and no viewport. Realistically 45–90 min, and it is the judgement-heavy step the playbook itself says only Yaman can do.
- Hour 3's *"layout.ts: import the JSON, replace `SEAT_LOCAL`, `CHAIR_HALF_X`, `CHAIR_MIN_Z`, `CHAIR_MAX_Z`… 15 min"* also needs a `tsconfig` change (`resolveJsonModule` is **not** currently set — verified) plus updating `layout.test.ts` (exists, 5,707 B, already in `npm test` — verified), plus re-tuning the collider after finding #3. Call it an hour.

The 3-hour plan is closer to a 6-hour plan, on 8 GB RAM with a 4-second cold render.

### 15. `color_type='RANDOM'` is separable but not *identifiable* — the one place "correct for a human, wrong for an agent" bites.

§2: *"random per-object colours with outlines are **better** than a beauty render for QA because every part is visually separable."* True for a human, who can cross-reference against the viewport. For an agent whose only channel is the PNG, random hash-assigned colours make parts distinguishable but **anonymous** — it can see *that* two blobs interpenetrate, not *which* two. The numeric pass names things; the sheet does not. Confirmed the settings are all valid on 5.2 (`RANDOM` present in `color_type`; `show_object_outline`, `show_cavity`, `light`, `render_aa=FXAA`, and all `stamp_*` attributes exist).

**Do instead:** the sheet's job is Yaman's aesthetic veto, not the agent's debugger — say so. If the agent must read it, render `color_type='MATERIAL'` for a look-check plus one `OBJECT`-coloured pass with a printed colour→name legend in the stamp note, or render the failing pair alone with everything else hidden.

### 16. `gltf-transform` is a new dependency, not a "free win today."

`node_modules/.bin` has no `gltf-transform` — it is **not installed**. The playbook's *"`gltf-transform palette in.glb out.glb` … Free win today. One command per asset. Add to the build script"* adds a toolchain dependency. `CLAUDE.md` non-negotiables #6/#7 require asking before installing packages. Same applies to `fake-bpy-module` + `mypy` in fix #8. Flag them as approval-gated, and note that a build script depending on `npx <package>` is a network dependency in an asset pipeline that currently has none.

---

## Verified correct — keep these, they survived hostile testing

Re-measured independently and confirmed:

| Claim | My measurement |
|---|---|
| `matrix_world` stale until `view_layer.update()` | `(0,0,0)` → `(5,0,0)` ✓ |
| bare `.parent =` leaves identity inverse; child world z = 1.5 | ✓ |
| `parent_set(keep_transform=False)` **still** writes `matrix_parent_inverse` `(0,0,-1)`, child world z = 0.5, `.location` still `(0,0,0.5)` | ✓ — the flag really is misleading; the playbook's resolution of the two contradictory findings is correct |
| `bpy.ops` returns `{'CANCELLED'}` silently, does not raise | ✓ `transform_apply` → `{'CANCELLED'}`, location unchanged |
| `obj.dimensions` ignores rotation | `(1.0, 2.0, 0.5)` vs true AABB `(1.0, 2.0368, 1.2394)` — Z understated 148% ✓ |
| glTF import forces `QUATERNION`; `rotation_euler` write is a no-op | `ALL_ROT_MODES {'QUATERNION'}`; matrix changed `False` → after `XYZ`, `True` ✓ **This is the most dangerous trap in the document and it is stated correctly.** |
| `bpy.ops.render.opengl` hard-errors headless | `RuntimeError: Cannot use OpenGL render in background mode` ✓ |
| Workbench: first render ~4 s, rest ~60 ms | `[4288, 61, 58, 61, 57, 65]` ms ✓ — six views really do cost ~300 ms more than one |
| BVH sweep is trivially cheap | 46 objects, build 7 ms + sweep 1 ms ✓ |
| Empty exports as socket with Y-up + extras | `('SOCKET_Pelvis', [0, 0.46, 0], {'role':'seat'})` ✓ |
| glTF export defaults | `export_apply=False`, `export_animations=True`, `export_extras=False`, `export_vertex_color='MATERIAL'`, `export_shared_accessors=False`, `export_skins=True` ✓ all as stated |
| Mesh datablocks unnamed for ico/cyl parts | 7 × `Icosphere.N` ✓ (`box()` already names its mesh — so the fix is only needed in `ico()`/`cyl()`, as stated) |
| Patient origin 0.3529 m above her lowest point | `PATIENT_LOWEST_Z = -0.3529` ✓ |
| `bpy` 5.2.0 on PyPI, `Requires-Python ==3.13.*`, win_amd64 ~330 MB | ✓ — and system Python here is **3.10.2** (`py -0p` lists only `-3.10-64`), Blender's bundled is 3.13.13. The "skip it" verdict is correct. |
| three.js r185 source claims | `WebGLRenderer.js:1702 info.autoReset` ✓; `WebGLRenderLists.js:13 a.material.id - b.material.id` ✓; `GLTFLoader.js:4829` srgb-linear warning ✓ (though it only fires when `workingColorSpace !== LinearSRGB`, i.e. never by default — the *conclusion* that COLOR_0 is linear is right, the citation is weaker than presented) |
| Draco vs meshopt decoder cost | `draco_decoder.wasm` 192,420 + wrapper 58,456 = 250,876 B vs `meshopt_decoder.module.js` 29,256 B ✓ |
| Bloom `levels` default 8 | `postprocessing/build/index.js:4096 levels = 8` ✓ |
| PostFX composition | `enableNormalPass={!isTouch}`, `<N8AO>`, `<DepthOfField>`, `<Bloom mipmapBlur>` with no `levels` ✓ |
| `layout.test.ts` exists and is wired into `npm test` | ✓ |
| PatientRig animation constants (jaw 0.62, pitch 0.55, brace 0.42, forearm 0.5) | ✓ |

The §5 "Geometry Nodes: no" verdict and the §7 "skip USD / Kitsu / Houdini / LODs / CadQuery" verdicts I did not re-test, but they are conservative (recommendations *not* to adopt), so being wrong is low-cost. The named-hierarchy argument that drives them is sound.

---

## Recommended re-ordering of the plan

1. **`git init` + commit `scripts/`.** Nothing else is safe without it. (~10 min)
2. **Confirm the room renders lit.** Two minutes of looking; possibly the whole "feels slow / looks wrong" complaint. (~15 min to fix)
3. **Add `--python-exit-code 1` and an `npm run assets` script.** Without this the gate is theatre. (~10 min)
4. **Extend the plan to `build_instruments.py` / `instruments.glb`.** (~20 min)
5. **Hour 1 as written, minus the RECLINE value change** — shared constants module, `obj.data.name`, one-launch driver, version assert into the manifest.
6. **Bake object scale into vertices** *before* building the placement layer, not in Week 3.
7. **Hour 2's gate — with direction-aware assertions (#4), attachment assertions (#2), and a two-list whitelist (#12).**
8. **Hour 3's manifest — with the collider derived from the seat footprint, not the full AABB (#3).**
9. Then the PostFX change as its own commit, then the daemon/bevels/skinning if ever.

**One-sentence version:** the playbook diagnoses correctly and measures honestly, but its gate exits 0, its showcase fix detaches the tray from its arm and leaves the arm in the patient's chest, its hair assertion fails on correct geometry while the bug it names is already fixed, and its collider fix restores a documented gameplay regression — so adopt the measurement layer, rewrite the four assertions it ships with, and put `git init` and `--python-exit-code 1` ahead of everything else.