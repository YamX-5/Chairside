# CHAIRSIDE — the graphics upgrade path

*One path, startable Monday. Every number below marked **[verified here]** was measured on this machine during this session against the real files; everything else is labelled.*

---

## 1. The honest diagnosis

It is not "low poly." Your geometry is fine. Ranked by how much each one costs you visually:

**#1 — There is no occlusion anywhere in the scene.** [verified here] I parsed all 28 shipped GLBs: every single one carries `POSITION, NORMAL, TEXCOORD_0` and nothing else. Zero `COLOR_0`. Zero images. Zero shadow-casting lights in `src/clinic`. `ContactShadows` is frozen at one frame under the chair only. So the *only* shading variation in your entire frame is the N·L term from two directional lights. Nothing gets darker where it tucks into something else — not under the chin, not in the armpit, not where the chair column meets the floor, not in the corner where two walls meet. That single absence is the largest share of "hand-coded." It is what every good stylised game has and yours doesn't.

**#2 — The palette has a value collapse.** [verified here, computed from `theme3d.ts`] Perceived luminance (0.299R + 0.587G + 0.114B) of the four surfaces that fill most of every frame: ceiling `0xfcf8f3` = **97.5%**, wall `0xf4ece1` = **93.0%**, floor `0xeee5d8` = **90.3%**, wallWarm `0xefe3d3` = **89.7%**. A **7.8-point spread**, all four sitting in the top 11% of the value range. Desaturate a screenshot and the room is a near-uniform pale grey field. There is no floor/wall/ceiling structure for anything to sit inside. (Correction to the research you were handed: it reported this as "3%" — the correct figure is a 7.8-point spread. Still a bug, just a properly stated one.) Your patient is fine against it (skin `0xd9a276` = 68.0%, a 25-point separation); it's the *room's own* internal structure that is missing.

**#3 — Uniform surface treatment.** Every material in the scene is the same material with a different hex. `ClinicKit.tsx:74` builds every kit piece as `MeshStandardMaterial({ roughness: 0.72, metalness: 0 })`. `PatientRig.tsx:164`, `DentalChair.tsx:41`, `InstrumentTray.tsx:47` all build `MeshLambertMaterial({ color: hex })`. Stainless steel, cream plaster, teal vinyl, honey wood and human skin are shaded identically. Nothing reads as a *material*, only as a *colour*. This is why the instruments read as grey shapes rather than steel.

**#4 — Geometry density is mismatched to the lighting model, which is why #1 is currently impossible.** [verified here] The entire 64 m² floor is **16 tiles × 12 triangles = 192 triangles**. A wall tile is 12 triangles. Flat-shaded low-poly needs vertices *where the light changes*; on a 12-triangle floor there is literally nowhere for a contact shadow to land. This is not a reason to skip baking — it's a step in the recipe.

**#5 — The draw-call structure is an art constraint disguised as a perf number.** [verified here] `wall.glb` is **12 triangles across 3 materials** — 3 draw calls for 12 triangles, 4 tris per call. Counting `ClinicKit.tsx`: 16 floor tiles (16 calls) + 16 wall tiles (50 calls) + ceiling (1) + 17 props (44 calls) = **~111 of your 157 draw calls are the room**. Because colour lives in the *material*, nothing can merge — and that same fact is why nothing can share a bake.

**#6 — Instruments have no bevels.** [verified here] `build_dental_chair.py:78` and `build_patient.py:37` both already define and apply `bevel_mesh()` at `BEVEL = 0.006`, clamped to `min(sx,sy,sz)*0.22`. `build_instruments.py` `box()` (line 65) and `cyl()` (line 88) do **not**. 932 triangles of razor-edged steel. (Correction: the research you were handed said the *patient* lacks bevels. It doesn't — the patient is now 964 tris, already bevelled. Only the instruments are missing it.)

**#7 — Composition.** `WALK_SPEED = 2.6` m/s across an 8 m room crosses the space in 3 seconds, which reads as skating. `dpr={isTouch ? [1, 1.25] : [1, 1.5]}` (`ClinicExperience.tsx:154`) is rendering up to 2.25× the fragments you need on an Iris Xe.

**#8 — Dead weight.** [verified here] Every GLB ships `TEXCOORD_0` and there are zero images in the entire project. You are paying bytes for UVs nothing samples.

---

## 2. The art-direction decision: **stay stylised — "baked flat"**

Stay flat-shaded low-poly. Add the two techniques the style is load-bearing on and which you currently ship neither of: **occlusion baked into vertex colours**, and **a palette with real value structure**. Render the baked geometry unlit.

**Why not semi-real, on hardware.** A 2048² RGBA8 texture with mips is 21.3 MB resident in VRAM regardless of file size — PNG/JPEG decode to uncompressed on upload. A five-map PBR set is ~80 MB uncompressed, ~20 MB as KTX2/BC1. You have ~2 GB *shared* with the CPU and an 8 GB machine; a sane resident-GPU budget is ~128 MB. Six Substance materials would eat all of it before a character loads. And `MeshStandardMaterial` with normal + roughness + AO maps is roughly 4–6× the fragment cost of `MeshBasicMaterial` on a GPU whose actual bottleneck is 25–35 GB/s of shared bandwidth — the exact bandwidth you just bought back by deleting the 29-pass post stack.

**Why not semi-real, on tone.** This is a 2–3 player hidden-info comedy. Photoreal fights you twice: it costs what you don't have, and a realistic face in pain reads as *distressing*, not funny. Separately, the dental-education literature's complaint about the flagship VR trainers is never shading — it's missing *cues*: water, blood, saliva, soft tissue, patient interaction. A dental school forgives stylisation instantly and never forgives an illegible calculus deposit.

**This is a craft upgrade, not a retreat.** The register you picked was chosen because it was free. It stays because it is *correct* — but you have been shipping it without its two essential techniques. COCOON was nominated for Best Visual Art at GDC, IGF and DICE on deliberately minimal geometry plus vertex-painted data feeding a custom shader. The gap between you and that is not assets. It is the shading and grade layer, and it costs zero download bytes.

**Concrete style contract from here on:**
- Colour lives on **vertices** (`COLOR_0`), never in the material.
- Baked geometry renders `MeshBasicMaterial({ vertexColors: true })` — never lit twice.
- Unbaked, moving objects (instruments, hands) get **matcaps**, not PBR.
- One key light direction. No shadow maps, ever.
- Textures: none, unless a specific thing demands one, and then ≤1024² and one map.

---

## 3. The single biggest win this week: **bake the light into the mesh**

Not Mixamo. Not Substance. **Bake ambient occlusion into `COLOR_0` and render unlit.**

**Why this one.** It fixes deficiency #1 (the largest), enables the fix for #2 and #5 in the same pass, costs **zero download bytes and zero VRAM**, makes the game *faster* (`MeshBasicMaterial` is cheaper per fragment than the `MeshLambertMaterial` you run today), touches **no** animation contract, is executable by an agent with no viewport, and is revertable by re-running one script. It is also the only item on any list that makes both the picture and the frame time better at once.

### It works. I proved it end-to-end on this machine.

[verified here] Full run on the real `public/models/patient.glb` plus an 8×8 m room floor:

```
patient tris after simple-subdiv L1 : 964 -> 5,784
floor tris (8x8 m, simple-subdiv L5): 2,048   (32x32 grid, ~25 cm quads)
AO bake, 24 objects / 7,832 tris    : {'FINISHED'}  839 ms
export (meshopt)                    : 146,084 bytes
GLB attrs                           : POSITION, NORMAL, COLOR_0   (no TEXCOORD_0, no images)
```

A sub-second bake. That is a tight enough loop for an agent to iterate blind.

### The two traps that would each have cost a day — both hit, both solved here

**Trap A — `scene.render.engine = 'CYCLES'` works under `--factory-startup`, but the engine enum lies about it.** [verified here] `bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items` returns `['BLENDER_EEVEE']` only, even after `addon_utils.enable('cycles')`. The direct assignment still succeeds. **Do not gate on the enum** — just assign and catch. (`'BLENDER_EEVEE_NEXT'` does raise; the identifier is `'BLENDER_EEVEE'`.)

**Trap B — `export_all_vertex_colors=True` is NOT enough. The bake silently does not ship.** [verified here] First run: bake returned `{'FINISHED'}` in 217 ms with a real 0.000→1.000 AO gradient in the attribute — and the exporter emitted:

```
WARNING: The active Vertex Color will not be exported,
         as it is not used in the node tree of the material
```

The GLB came out with `POSITION, NORMAL` and no `COLOR_0`. This is exactly the "the bake didn't work" failure with no error anywhere.

**The fix, verified:** the colour attribute must be referenced by a `ShaderNodeVertexColor` wired into the material's node tree.

```python
vc = nt.nodes.new('ShaderNodeVertexColor')
vc.layer_name = 'Col'                      # must match the attribute name exactly
nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
```
After that: `attrs POSITION,NORMAL,COLOR_0`. [verified here]

**Trap B2 — exactly ONE colour attribute per mesh.** [verified here] The glTF *importer* leaves a colour attribute behind. Adding mine on top produced `COLOR_0, COLOR_1` and 18 warnings. three.js reads `COLOR_0` and you have no control over which one that is. Always:
```python
for ca in list(obj.data.color_attributes): obj.data.color_attributes.remove(ca)
obj.data.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER')
```
`domain='CORNER'`, not `'POINT'` — per-vertex cannot hold a hard colour break across an edge, which is the entire point of flat-shaded low-poly.

**Trap C — `bpy.ops.object.bake` operates on everything SELECTED.** A leftover light gives `RuntimeError: Object "Sun" is not a mesh`. Deselect all, then select meshes only, then set an active mesh.

### The week's deliverable, in five steps

**Step 1 (1 hour) — fix the palette first, so you judge the bake against a fair baseline.**
Edit `src/clinic/theme3d.ts`. Keep the hue family; open the values. Target ≥25 points of luminance between floor and ceiling:
```
ceiling  0xfcf8f3  97.5%   keep
wall     0xf4ece1  93.0%   keep
wallWarm 0xe8d9c6  ~85%    push down (was 89.7)
floor    0xcbb9a4  ~74%    push down hard (was 90.3)
```
Verification anyone can do: screenshot, desaturate in any image tool. It must read as three distinct greys, not one.

**Step 2 (5 minutes, possibly the largest frame-time win in the project) — cap the render scale.**
`ClinicExperience.tsx:154` is `dpr={isTouch ? [1, 1.25] : [1, 1.5]}`. Windows display scaling at 150% makes `window.devicePixelRatio = 1.5`, so you are rendering 2880×1620 = 4.7 MP on an Iris Xe. Check `window.devicePixelRatio` in the console; if it is >1, change to `dpr={isTouch ? [1, 1] : [1, 1]}` and measure. Lethal Company — the register you chose — renders at a fixed 860×520 and the resulting crunch is read as an art style.

**Step 3 (2 days) — the bake.** Per build script, before export:
1. Simple-subdivide so AO has somewhere to land. Patient: `SUBSURF`, `subdivision_type='SIMPLE'`, `levels=1` (964 → 5,784 tris [verified here]). Room floor: one 8×8 m plane at `levels=5` (2,048 tris [verified here]) replacing the 16 kit tiles. Walls: `levels=4`. **Never Catmull-Clark** — it rounds your hard edges and destroys the register.
2. Strip all colour attributes, create exactly one `BYTE_COLOR` / `CORNER` named `Col`.
3. Multiply the part's authored linear albedo by the vertex colour via a `MixRGB` MULTIPLY node into Base Color, with `ShaderNodeVertexColor(layer_name='Col')` as the second input.
4. Deselect all → select meshes → set active → `sc.render.bake.target='VERTEX_COLORS'` → `bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', use_clear=True)`.
5. Export (see §6).

Your build scripts already author colour in **linear** (`srgb_to_linear()` in all three), so the bake stays colour-coherent with `NoToneMapping` on the renderer + ACES in `PostFX`. Don't change that.

**Step 4 (1 hour, MUST land in the same commit as Step 3) — the runtime material swap.**
Four exact lines. If you ship the bake without these, the bake looks like it failed:

| File | Line | Now | Becomes |
|---|---|---|---|
| `src/clinic/PatientRig.tsx` | 164 | `new MeshLambertMaterial({ color: hex })` | `new MeshBasicMaterial({ vertexColors: true })` |
| `src/clinic/DentalChair.tsx` | 41 | `new MeshLambertMaterial({ color: hex, emissive })` | `new MeshBasicMaterial({ vertexColors: true })` + keep the emissive branch for the lamp lens |
| `src/clinic/InstrumentTray.tsx` | 47 | `new MeshLambertMaterial({ color: … })` | matcap — see Step 5 |
| `src/clinic/ClinicKit.tsx` | 74 | `new MeshStandardMaterial({ roughness: 0.72, … })` | `new MeshBasicMaterial({ vertexColors: true })` |

`RoomModel.tsx:71` already demonstrates the exact pattern to copy — it swaps to `MeshBasicMaterial` and its comment already documents the double-exposure trap. Note `three` multiplies `material.color × vertexColor`, so leave `color` at its white default.

**Step 5 (half a day) — matcaps on the instruments + bevels.**
Add `bevel_mesh()` to `build_instruments.py` `box()` and `cyl()` — a copy-paste of `build_dental_chair.py:78` with the same `min(BEVEL, min(sx,sy,sz)*0.22)` clamp. Then `MeshMatcapMaterial` with one 256² steel matcap (~15–40 KB): the instruments get real specular roll-off with no lights at all. Instruments are small, hand-held and view-locked, which is exactly where matcaps are right — never on walls or floors.

**Expected result at the end of the week:** every corner, seam, contact point and under-chin has soft darkening; the room has three readable value planes; steel reads as steel; draw calls fall (§4/§7); download is flat; frame time drops.

---

## 4. The character decision: **keep the hand-built patient. Mixamo is for the other players, later.**

### Decision

The patient stays hand-built and gets upgraded in place. This is not conservatism — it's the blocker.

**The blocker:** a Mixamo rig has no jaw bone and, worse, **no oral cavity, teeth or tongue**. Real-time character heads are shells with a sealed mouth line; nobody models an interior you never see. Rotate a jaw on one and you open a hole into an empty skull that backface culling lets you see straight through. In CHAIRSIDE the mouth interior is not decoration, it is the entire clinical payload. **No character generator will ever supply it.** Meanwhile your `reaction.ts` drives `jawOpen` on 7 of its 13 primitives and the file's own comment names a closed-mouth scream as the exact "broken rather than funny" failure the system exists to prevent.

**What you already have:** [verified here] `patient.glb` exports 24 nodes named `EyeL, EyeR, Hair, Mouth, Jaw, Nose, Head, Neck, HandL, ForearmL, UpperArmL, HandR, ForearmR, UpperArmR, Shoulders, Chest, FootL, ShinL, ThighL, FootR, ShinR, ThighR, Pelvis, Patient` — 964 triangles, already bevelled, with a working `Jaw` and a `Mouth`, driven by pure-maths curves that pass `reaction.test.ts` headless. That is an asset, not a liability. The correct move is to bake it (Step 3 above) and subdivide it, not to replace it.

**What a swap would actually cost:** ~1.5 weeks dominated by authoring a mouth rig you'd have to build *anyway*, in exchange for a walk cycle that already reads acceptably. Wrong trade this month.

### Where Mixamo genuinely belongs — and the trigger

The game is now 2–3 player co-op. **The other players' avatars** are the right Mixamo target: they need locomotion and idles, they are seen at a distance, and *they do not need mouths*. Trigger the character pipeline when you build multiplayer avatars, not before.

### When you do it, here is the whole thing

**Which character.** Not a stock Mixamo mesh — they are semi-realistic with photographic textures and will read as a bug in a flat-shaded cream room, and they cost texture VRAM you don't have. Use **Quaternius Ultimate Modular Men / Ultimate Modular Women** (`quaternius.com/packs/ultimatemodularcharacters.html`): CC0, no attribution, already stylised, **ships glTF natively so there is no FBX conversion**, and each character splits into **4 swappable parts** — combinatorial patient/avatar variety from one small download. Then upload one to the **Mixamo auto-rigger** to get access to the 2,400-clip library. CC0 permits this; Mixamo clips are royalty-free commercial. (Stock Mixamo characters — Remy, Claire, Michelle, Ely — exist as a fallback but were not verified against the live library in this session; confirm on mixamo.com before committing.)

**Which clips.** Seven, not forty. `Walking` (In Place **ON**), `Sitting Down`, `Sitting Idle`, `Nervously Look Around`, `Hit Reaction`, `Stand Up`, one talk/fidget. Download: FBX Binary, Skin = **Without Skin**, FPS 30, Keyframe Reduction = uniform. **The In Place checkbox is the one that ruins the walk-in**: leave it off and the clip's root motion translates the character while your `walkIn` group is also translating her — she overshoots the chair by exactly double.

**Conversion.** Mixamo cannot export GLB. Blender round-trip, scriptable in the idiom you already use:
```
bpy.ops.import_scene.fbx(filepath=...)
bpy.ops.export_scene.gltf(filepath=..., export_format='GLB',
    export_animations=True, export_def_bones=True,
    export_meshopt_compression_enable=True)
```
Never Draco on a skinned character — Draco does not compress animation tracks, and animation is most of the new payload. `EXT_meshopt_compression` does. [verified here: both encoders are compiled into your Blender install and the meshopt path produced a valid GLB.]

**Exactly what changes in `PatientRig.tsx` (~60 lines; `reaction.ts`, `reaction.test.ts` and `ReactingPatient.tsx` need ZERO changes):**

1. **Bone names are not what you'd type.** [verified here at `node_modules/three/src/animation/PropertyBinding.js:185-187`] `sanitizeNodeName` is `name.replace(/\s/g,'_').replace(/[\[\]\.:\/]/g,'')` — the colon is **removed**, not replaced. `mixamorig:Head` arrives in three.js as **`mixamorigHead`**. The widely-repeated `mixamorig_Head` is wrong (that's the FBX path). Never hand-type these: run `scene.traverse(o => o.isBone && console.log(o.name))` once against the real GLB and paste the strings into a `const BONES = {…}` map.

2. **`scene.clone(true)` silently breaks skinning.** `PatientRig.tsx:140` currently does `gltf?.scene.clone(true)`. That is correct for the node hierarchy today and a trap the moment the mesh is skinned: the cloned `SkinnedMesh.skeleton` still points at the *original* bones, with no warning. Because `useOptionalGLTF` caches at module level and hands the same `gltf.scene` to every consumer, this is guaranteed, not incidental. Fix: `SkeletonUtils.clone(gltf.scene)` from `three/examples/jsm/utils/SkeletonUtils.js` — [verified here: present, 11,535 bytes, no new dependency]. Note it takes no `recursive` argument.

3. **Mixer ordering — do NOT use `useFrame` priority.** In r3f v9 the loop ends with `if (!state.internal.priority && state.gl.render) state.gl.render(...)`, and any subscriber with priority > 0 increments `internal.priority` — **your screen goes black and you are expected to call `gl.render()` yourself.** Also do not use drei's `useAnimations` (it registers its own `useFrame` and you lose ordering). Keep the **one** `useFrame` at default priority that already exists and make `mixer.update(delta)` its first statement. Ordering is then lexical and guaranteed.

4. **Procedural writes compose with a playing clip cleanly.** `AnimationMixer.update()` accumulates all actions, then applies all bindings, then it is done for the frame. Anything you assign to `bone.rotation` afterwards simply wins, and `updateMatrixWorld` (which r3f runs after all `useFrame` callbacks) picks it up. No fight, no drift — the mixer re-derives from the clip every frame rather than integrating. glTF clips bind `.quaternion` while your code writes `.rotation`; these stay coherent because `Object3D` installs `rotation._onChange` / `quaternion._onChange` sync, so **keep writing `.rotation` exactly as `reaction.ts` expects**. The one rule: change `=` to `+=` so your offsets layer on the clip's pose instead of replacing it.

5. **Capture `Rest` AFTER `mixer.update(0)`**, not before, or you capture the T-pose and every offset is measured from the wrong origin. `mixer.update(0)` still applies bindings — the binding loop is unconditional — so a zero delta is the correct way to force a re-pose.

6. **Keep the `arrival` scalar authoritative — scrub, don't play.** `action.paused = true; action.time = (arrival * WALK_STRIDES * clip.duration) % clip.duration` locks feet to distance travelled, which is what prevents foot-sliding, and is deterministic. Reserve real `play()` + `crossFadeTo()` for the looping seated idle where nothing external owns the phase. `PatientRigProps.arrival` does not change, so `ReactingPatient.tsx` and everything above it needs no edit.

7. **The material loop at line 164 will delete a textured character's entire appearance** — it reads only `color.getHex()` and glTF sets `color` to white when a texture carries the colour, so you get a featureless white mannequin that looks like a load failure. Make it map-aware. Skinning needs no material flag in r185 (`WebGLPrograms` reads `object.isSkinnedMesh`), so `MeshBasicMaterial`/`MeshToonMaterial` skin fine.

**The jaw — the actual architecture.** Stop treating the mouth as part of the character. Ship **two** assets: the skinned body, and a separate hand-built **mouth rig GLB** (Jaw, upper/lower arches, tongue, palate) authored in the flat-shaded style your scripts already produce. Attach at load:
```ts
const head = skel.getBoneByName('mixamorigHead')
head.add(mouthRig)                       // bones are Object3Ds; .add() works
mouthRig.position.set(0, 0.06, 0.07)     // found once by eye, frozen in layout.ts
```
It inherits every head transform for free — clip-driven neck motion and your procedural sway both. `findParts` keeps looking up `'Jaw'` by name on the attached group with no sanitisation risk (no colon in the name), and `p.jaw.rotation.x = r.jawX + jawOpen * 0.62` survives **verbatim**. The anatomy that must be clinically correct stays authored by you and versioned separately from a third-party body you cannot edit — which also makes the body source swappable, so the character decision stops being irreversible.

Blinking: attach two skin-toned lid discs to the head bone alongside the mouth rig, scaled from 0. Reuses the same attachment architecture and keeps `blink.current` and the randomised-interval logic completely unchanged. (The clean answer is a `Blink` shape key — `GLTFLoader` populates `morphTargetDictionary` from `extras.targetNames`, and those are **not** sanitised — but it needs sculpting you don't have time for.)

---

## 5. Substance 3D Assets: **reference only. Ship zero Adobe triangles.**

Honest answer: **~0.5% of the library is usable to you, and none of it as shipped geometry.**

**Models: 0% shippable.** 8,627 models, median **43,254 triangles** — ten times your entire scene. Of 300 sampled, only 3 were under 5,000 tris and none under 2,000, despite 289 being labelled `low_poly` by Adobe (which means "quads, not subdivided, ready for Painter," not game LOD). A seven-prop Substance clinic is 209,148 triangles and 6.4 MB of raw GLB before a patient, a room or a texture — against a current **total 3D payload of 511 KB** [verified here: 80,692 + 69,244 + 82,684 + 278,564 bytes].

**Materials: 0%.** 12,594 of them, `.sbsar` only, no bitmap option ever. `.sbsar` is a compiled procedural graph — three.js cannot read it and there is no browser runtime. You have no Substance app installed. And a flat-shaded game wants vertex colours, not PBR sets. **The materials library is the wrong paradigm for your art direction even after you solve the tooling.** Skip entirely.

**HDRIs: 0%, and skip these too.** 99 of them at ~90 MB EXR each. The research you were handed recommended baking one to a small env map. **Disagree** — once the room, chair and patient are baked to `COLOR_0` and rendered `MeshBasicMaterial`, the environment map lights *nothing* except instruments and hands, and for those a matcap is cheaper and better. Your existing `<Environment resolution={256} frames={1}>` Lightformer rig is already offline-safe, costs one render, and works. Leave it. That saves you a day.

**What Substance is actually for: two objects, as geometry specs.** Dentistry is exactly **two** results in 23,468 assets:

- **Dental Seat** — 27,044 tris, **28 named sub-meshes**, verified real-world **2.03 × 1.49 × 1.57 m**, GLB 843 KB.
- **Dental Tools** — 66,302 tris, **91 sub-meshes**, 3.70 × 1.99 × 0.85 m, GLB 2.01 MB.

Download them, import headless in Blender, and **extract the hierarchy, per-part pivot origins and dimensions to JSON**. Feed that JSON to `build_dental_chair.py` and `build_instruments.py` as the spec. Your chair is currently 23 hand-authored parts; a 28-part breakdown with correct pivots and *verified clinical proportions* is exactly the shape your name-based rig already consumes — and it is the thing no free library gives you. You get the proportion fix at the source and you ship **not one Adobe triangle**, which is also the cleanest licence position available.

If the room needs dressing later, the same treatment applies to **Surgical Lamp 01** (43,270 tris) as an operating light and **Surgery Trolley 01** (20,712 tris) as a bracket table. Reference only.

**Licence.** The commercial-use-inside-a-larger-work reading is *forum-sourced, not EULA-verified*, and it carries a caveat the summary you were handed omitted: perpetual survival after cancellation covers **only uses made prior to the end of the subscription**. Read `Adobe-Substance-3D-Assets-Product-Specific-Terms` yourself (30 min) before the YC application makes any claim about your asset pipeline, and do not cite forum posts as your basis in investor material. Community Assets is a **separate** licence document and separate provenance risk — skip it entirely. The reference-only pipeline sidesteps all of this anyway.

---

## 6. The asset pipeline

Two lanes. Lane A ships bytes; Lane B never does.

### Lane A — authored asset → shipped GLB

```
D:\Tools\blender-5.2.0-windows-x64\blender.exe -b --factory-startup -noaudio --python scripts\build_patient.py
```
[verified here: `Blender 5.2.0 LTS, build date 2026-07-14`, Draco **and** MeshOptimizer bridges compiled in, numpy 2.3.4 bundled.] `--factory-startup` matters — it stops a user preference changing a bake result between machines.

Inside the script, after geometry, before export:

```python
# 1. engine — assign directly; the enum lies (verified)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'; sc.cycles.samples = 48; sc.cycles.use_denoising = False

# 2. give AO somewhere to land — SIMPLE, never Catmull-Clark
md = obj.modifiers.new('s', 'SUBSURF'); md.subdivision_type = 'SIMPLE'; md.levels = 1
bpy.context.view_layer.objects.active = obj          # modifier_apply needs ACTIVE
bpy.ops.object.modifier_apply(modifier='s')

# 3. exactly ONE colour attribute, CORNER domain
for ca in list(obj.data.color_attributes): obj.data.color_attributes.remove(ca)
obj.data.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER')

# 4. THE STEP EVERYONE MISSES — wire it into the node tree or it is not exported
vc  = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
mix = nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'
mix.inputs['Fac'].default_value = 1.0
mix.inputs['Color1'].default_value = (*linear_albedo, 1)
nt.links.new(vc.outputs['Color'], mix.inputs['Color2'])
nt.links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])

# 5. bake — SELECTION matters, a stray light aborts the whole run
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
sc.render.bake.target = 'VERTEX_COLORS'
bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', use_clear=True)

# 6. export
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB',
    export_all_vertex_colors=True,
    export_attributes=True,
    export_texcoords=False,                       # zero images in the project — free win
    export_apply=False,
    export_meshopt_compression_enable=True)       # NEVER draco on anything skinned
```
[All flag names verified against this Blender's `export_scene.gltf` RNA.] If you need decimation on a reference import: `decimate_type` enum is `['COLLAPSE','UNSUBDIV','DISSOLVE']` — the UI's "Planar" is `'DISSOLVE'` and `'PLANAR'` raises; `'UNSUBDIV'` is a **silent no-op on triangulated meshes** (which is how every download arrives), so guard it with `assert tris_after < tris_before * 0.95`.

### Lane B — Substance reference → JSON spec (ships nothing)

```
blender.exe -b --factory-startup -noaudio --python scripts/extract_spec.py -- dental_seat.glb specs/dental_seat.json
```
Walks the hierarchy and writes `{name, parent, pivot_world, dims, tris}` per object. `build_dental_chair.py` reads the JSON for proportions and part breakdown. No Adobe geometry enters `public/models/`.

### The verification step (this is what makes it agent-safe)

**Gate 1 — the GLB auditor.** Zero-dependency Node script, already written this session; it parses the GLB JSON chunk directly:
```
node scripts/audit-glb.mjs public/models/*.glb
```
Fails the build unless, per file: `COLOR_0` present · `TEXCOORD_0` absent · `images == 0` · triangles ≤ the per-asset budget · draw-call-relevant `prims` ≤ budget. It already produced, verbatim:
```
patient.glb |bytes 80692 |nodes 24 |prims 23 |tris 964 |mats 7 |imgs 0 |skins 0 |anims 0
            |attrs POSITION,NORMAL,TEXCOORD_0 |ext KHR_materials_specular
```

**Gate 2 — headless contact sheet.** Render 4 fixed angles at 256² in EEVEE (`sc.render.engine = 'BLENDER_EEVEE'`; ~434 ms/view warm), before and after, diff with the bundled numpy, composite to one PNG. **Fail if any view has >2% of the frame changed by >2%, or max channel diff >30%.** This is what catches damage a triangle count cannot — in the research pass it immediately exposed a flat-ratio decimation shattering the patient's head into a faceted lump.

**Gate 3 — `npm run typecheck` and `npm run test`** (`reaction.test.ts`, `layout.test.ts`, `movement.test.ts`, `instruments.test.ts` all currently in the suite). None of this week's work should change a single test result. If `reaction.test.ts` breaks, you've touched something you shouldn't have.

**Gate 4 — DevProbe, before and after every step.** `window.__clinic.stats()` in the console. It already correctly disables `gl.info.autoReset` and samples at priority -1, so it reports true pre-composer draw calls. Write the number down each time. Do not trust any estimate in this document over that readout.

**Runtime prerequisite — do this first or every result is invisible.** `src/clinic/useOptionalGLTF.ts` builds a bare `new GLTFLoader()` and its error callback is `() => resolve(null)`. A meshopt-compressed GLB will throw `setMeshoptDecoder must be called before loading compressed files`, be swallowed, and the primitive fallback renders — looking exactly like the file was never copied. [verified here: `node_modules/three/examples/jsm/libs/meshopt_decoder.module.js`, 29,256 bytes, present.] One line:
```ts
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
```
(Meshopt's decoder is 29 KB. Draco's is 344 KB and cannot compress animation — you would need ~9 assets of this size before Draco is ahead on total download, and never for a character. Meshopt everywhere.)

---

## 7. The budget — hold the work to these

Target: **i5-1135G7 / Iris Xe G7 80EU / 2 GB shared VRAM / 8 GB RAM / browser**, and student phones.

| Metric | Today [verified here] | End of this week | Hard ceiling |
|---|---|---|---|
| **Visible triangles** | 4,366 | ~22,000 | **150,000** |
| **Draw calls** | **157** | **≤50** | 80 desktop / **50 touch** |
| **GPU-resident textures** | ~0 MB | ~0.1 MB (matcaps) | **32 MB** |
| **Post-process passes** | ~11 (Bloom 8 + merged grade ~1 + SMAA + tonemap) | ≤8 | **8** |
| **Render-target memory** | ~16.6 MB/full-res RGBA16F target | unchanged | **64 MB** |
| **3D payload on disk** | **511 KB** | ≤900 KB | **2 MB** |
| **Total initial download** | — | — | **8 MB** (Poki's bar) |
| **Render scale (dpr)** | up to **1.5×** | **1.0×** | 1.0 desktop / 0.75 touch |
| **Shadow-casting lights** | 0 | **0** | **0 — permanently** |

Supporting arithmetic you can hold people to:
- One 1024² RGBA8 texture **with mips = 5.33 MB** of VRAM. 2048² = 21.3 MB. This is independent of file size — PNG/JPEG decode to uncompressed on upload. Never ship >1024², and prefer none.
- One full-res RGBA16F post target at 1920×1080 = **16.6 MB**. `@react-three/postprocessing` defaults to `HalfFloatType`. The removed 29-pass stack was ~163 MB resident and ~21 GB/s of bandwidth against a GPU that reaches 25–35 GB/s **shared with the CPU**.
- Meshopt-compressed baked geometry measures **~18.6 bytes/triangle** [verified here: 146,084 bytes for 7,832 tris]. So a 22,000-triangle scene is ~410 KB. Budget accordingly.
- Bake cost on this laptop: **839 ms for 24 objects / 7,832 triangles** at 48 Cycles CPU samples [verified here]. A full-scene bake is a few seconds. There is no reason to skip it "because it's slow."

Where the draw calls come from and where they go: room shell 67 + props 44 = 111 today. Merging by material (possible only once colour lives on vertices) takes the room to ~6. Chair: merge the ~18 static parts, keep `LightArm/LightHead/Tray/TrayArm` separate → ~5. Patient: merge `Hair/Nose/Mouth`→`Head`, `HandL`→`ForearmL`, `FootL`→`ShinL` etc. → 23 down to ~16 (never merge the 16 parts `PatientRig` drives by name — that destroys the contract). Instruments held ~5. **~37 total.** [estimate, from verified per-file primitive counts — confirm with DevProbe.]

---

## 8. This week, in order

**Day 0 — 20 minutes, does not block anything.** Send Yaman five links and make him pick ONE and say what he likes: `bruno-simon.com`, `slowroads.io`, `demos.littleworkshop.fr/infinitown`, the COCOON trailer, `A Short Hike`. "Upgrade the graphics" is unactionable; "make it look like Infinitown" is a spec. The week's work is correct regardless of his answer, which is why it doesn't block — but it will decide the *grade* in week 2. (Note: there is no Little Workshop game called "Isle of Lune"; their catalogue is Infinitown, TRACK, Digital Landscapes, Ricard League, Equinox.)

**Day 1 (morning) — measurement + two one-line fixes.**
Record `window.__clinic.stats()` and `window.devicePixelRatio`. Cap `dpr` to `[1,1]`. Wire `setMeshoptDecoder` into `useOptionalGLTF.ts`.
*Payoff:* possibly a 2.25× drop in fragment work for five minutes' work, and every later result becomes visible instead of silently falling back.

**Day 1 (afternoon) — palette value structure + instrument bevels.**
`theme3d.ts` floor and wallWarm pushed down ~15 points. Copy `bevel_mesh()` from `build_dental_chair.py:78` into `build_instruments.py` `box()`/`cyl()`.
*Payoff: **the largest visible change relative to effort in the whole plan.** Every screenshot changes before a single asset is touched. Instruments go from 932 to ~3,400 tris and their silhouettes start catching light.*

**Days 2–3 — the bake, plus the runtime material swap in the same commit.**
Subdivision pass, one `CORNER` colour attribute, `ShaderNodeVertexColor` wiring, Cycles AO bake, meshopt export. Then the four material lines: `PatientRig.tsx:164`, `DentalChair.tsx:41`, `InstrumentTray.tsx:47`, `ClinicKit.tsx:74`.
*Payoff: the #1 deficiency, gone. Contact darkening everywhere. And fragment cost goes **down**, because `MeshBasicMaterial` is cheaper than the Lambert and Standard you run today.*
*Risk: if these ship apart, the bake looks like a failure. One commit.*

**Day 4 — merge, now that colour has left the material.**
Replace the 16 floor tiles with one subdivided plane. Merge static room geometry by material with `BufferGeometryUtils.mergeGeometries`. Merge the static children of the patient into their animated parents. **Do not merge the 16 named parts `PatientRig` drives.**
*Payoff: 157 → ~37 draw calls [estimate]. Inside the ≤50 mobile guideline for the first time. Confirm with DevProbe, not with this document.*

**Day 5 — matcaps, fog, verification.**
One 256² steel matcap on `InstrumentTray`. A subtle warm interior fog from ~3 m to ~9 m (`scene.fog` is computed inside the fragment shader you already run — free, and it is the single cheapest depth cue there is; you already have `<fog args={[0xf2e9dc, 16, 34]} />` at `ClinicExperience.tsx:177`, tuned for a much bigger space). Drop `Bloom levels={4}` → `levels={3}` (8 passes → 6). Then run all four gates: GLB auditor, contact sheet, `npm run typecheck && npm run test`, DevProbe before/after.
*Payoff: steel reads as steel; the room gains depth; the whole thing is measured rather than asserted.*

**What Yaman must verify with his own eyes at the end of the week** — nothing in this document substitutes for these three:
1. Screenshot the room and **desaturate it**. It must read as three distinct greys (floor / wall / ceiling), not one field.
2. Look at where the chair column meets the floor and under the patient's chin. There must be visible darkening that was not there on Monday.
3. Read `window.__clinic.stats()` and confirm the draw-call number actually fell. If it didn't, the merge silently didn't happen.

---

## Appendix — corrections to the research you were handed

1. **`build_patient.py` already bevels.** `bevel_mesh()` at line 37, applied in `box()` at line 121 with the same `min(BEVEL, min(sx,sy,sz)*0.22)` clamp as the chair. The patient is 964 tris, not 452. Only `build_instruments.py` is missing bevels. [verified here]
2. **The palette spread is 7.8 luminance points (89.7%–97.5%), not "3%".** The bug is real; the stated magnitude was wrong. [verified here]
3. **`export_all_vertex_colors=True` alone does not export vertex colours.** Blender 5.2's glTF exporter silently drops the attribute with a WARNING unless a `ShaderNodeVertexColor` naming it is wired into the material node tree. This was not in any of the five research reports and it is the single most expensive trap in the plan. [verified here — hit it, then fixed it]
4. **The render-engine enum does not list `CYCLES` under `--factory-startup`** (it returns `['BLENDER_EEVEE']` only, even after `addon_utils.enable('cycles')`), but direct assignment `sc.render.engine = 'CYCLES'` succeeds. Do not gate on the enum. [verified here]
5. **The glTF importer leaves a colour attribute behind**, so adding one produces `COLOR_0` + `COLOR_1` and three.js reads whichever landed first. Remove all before creating one. [verified here]
6. **Skip the Substance HDRI bake.** Once geometry is baked and rendered `MeshBasicMaterial`, an env map lights nothing but instruments and hands, and matcaps beat it there. The existing `frames={1}` Lightformer rig stays. This saves a day the research recommended spending.
7. **`patient.glb` and `dental_chair.glb` are coincidentally both 964 tris / 23 primitives / 7 materials.** They are genuinely different files (node names confirmed distinct) — flagging it because it looks exactly like one build script overwriting the other, and it will trip someone. [verified here]
8. **Every shipped GLB carries `TEXCOORD_0` and the project has zero images.** `export_texcoords=False` is a free byte saving nobody flagged. [verified here]

**Files that change this week:** `src/clinic/theme3d.ts`, `src/clinic/useOptionalGLTF.ts`, `src/clinic/ClinicExperience.tsx`, `src/clinic/PatientRig.tsx`, `src/clinic/DentalChair.tsx`, `src/clinic/InstrumentTray.tsx`, `src/clinic/ClinicKit.tsx`, `src/clinic/PostFX.tsx`, `scripts/build_patient.py`, `scripts/build_dental_chair.py`, `scripts/build_instruments.py`, plus new `scripts/audit-glb.mjs`, `scripts/contact_sheet.py`, `scripts/extract_spec.py`.
**Files that do NOT change:** `src/clinic/reaction.ts`, `src/clinic/reaction.test.ts`, `src/clinic/ReactingPatient.tsx`, `src/clinic/layout.ts`. If a diff touches these, something has gone wrong.