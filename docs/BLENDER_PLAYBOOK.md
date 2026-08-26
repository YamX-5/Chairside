I verified the key claims and built/ran the library on the actual assets. Everything below is measured on this machine today.

---

# Chairside 3D Playbook
### Programmatic asset authoring for an agent that cannot see a viewport

Every number in this document was measured on `D:\Tools\blender-5.2.0-windows-x64\blender.exe` (Blender 5.2.0 LTS) against the shipped `patient.glb` and `dental_chair.glb`, on this laptop, today. Working code is at `C:\Users\LENOVO\AppData\Local\Temp\claude\D--My-Apps-ideas\10b26901-3464-4173-9d9c-86cf942208e2\scratchpad\pb\` (`measure.py`, `drive.py`, `sheet.py`, `contact_sheet.png`).

---

## 1. The verdict on the current approach

**The architecture is right. The verification is absent. Do not rewrite the build scripts — wrap them in measurement.**

### What is genuinely fine, and should not change

**Imperative Python emitting named objects is the correct tool.** Not a compromise, not a beginner's choice. The named-part hierarchy — `Pelvis → Chest → Neck → Head → {Hair, EyeL, EyeR, Nose, Jaw → Mouth}` — *is* the animation API that `PatientRig.tsx` drives. Every alternative modelling system was evaluated and every one destroys it: a Geometry Nodes modifier evaluates to **one** object with **one** mesh (verified: a GN stool exported as `nodes=['Stool'] meshes=1`); OpenSCAD exports STL only, no scene graph; libfive/SDF gives you dual-contoured triangles you don't control; `gltf-transform join` on the real `patient.glb` reported `Removed types... Mesh (22), Node (22), Primitive (23)` and collapsed all 22 names into one. The named hierarchy requirement eliminates every candidate except "imperative code that emits named objects."

**Object-parenting instead of an armature is aesthetically legitimate and correct here.** It shipped in Tomb Raider (1996), MGS and Resident Evil. Rigid parts on a flat-shaded low-poly figure have no skin deformation for skinning to preserve. The docstring's reasoning — "a day of scripting vs a fortnight of rigging I would get wrong" — is sound.

**`obj.parent = parent` (build_patient.py:103, build_dental_chair.py:86) is the correct form, and I need to settle a contradiction about it.** Two separate investigations reached opposite verdicts. Here is the resolution:

Bare `.parent =` leaves `matrix_parent_inverse` at identity, so `child_world = parent_world @ child_local`. That is *exactly right* when the child's `joint=` is authored as a **local offset from the parent's origin** — which is what both build scripts do. The operator `bpy.ops.object.parent_set(keep_transform=False)` — despite the flag name — *always* writes `matrix_parent_inverse = parent.matrix_world.inverted()`, after which `child.location` silently lies about where the child is, and any later normalisation makes it jump.

> **The rule that unifies both findings: a world-space number must never reach a `joint=` or `.location` argument.** The double-offset bug happens the moment you measure something in world space and paste the result into a local slot. Route world coordinates through `put_world()` (§3), which back-solves the local transform for you. Then keep bare `.parent =` and add `assert_identity_parent_inverse()` as a guard.

Three more things already correct and worth defending: `mat.diffuse_color = col` alongside the BSDF socket (Workbench reads `diffuse_color`, not the socket — headless renders come out grey otherwise); `srgb_to_linear()` on the palette; and box origins placed at the joint so rotation pivots correctly.

### What is actively costing time — nothing in this list is a modelling problem

The scripts write **200+ hand-typed numeric literals** and read back **zero**. Neither file calls `bpy.context.view_layer.update()` or touches `matrix_world` even once. There is no mechanism by which they *could* know they were wrong. That is the entire disease; the six bugs are symptoms.

| Bug | Mechanical cause | Status today (measured) |
|---|---|---|
| **Hair enclosed the face like a helmet** | `Head` has non-uniform object scale `(1.0, 1.10, 1.16)`, which multiplies into every child. `Hair`'s authored `(1.04, 0.96, 0.78)` becomes world `(1.04, 1.056, 0.9048)` — the intended *shallower* Y silently inverts to *wider*. No `assert_encloses`. | **Still live.** `'Hair' escapes 'Head' on X by (0.0038, 0.0038) m` |
| **Legs ran straight, she read as lying flat** | Thigh and shin near-collinear. No assertion on knee angle, and a single 3/4 render is the one view where this is invisible. | Fixed by hand (`rot=(-1.44,…)` then `(0.86,…)`), unguarded |
| **Backrest reclined further than the patient** | `BACK_RECLINE = 0.26` in one file, `Chest rot -0.24` in another, held together by a comment claiming they match. Two files share **zero** code — each redefines `srgb_to_linear`, `rgba`, `material`, `box` independently. | **Still live.** `'Chest' and 'Backrest' differ by 1.146 deg` — reduced from a visible gap to an invisible one |
| **Spittoon floating in the lap** | No clearance assertion. | Genuinely fixed: `clearance(Spittoon, ThighR) = +0.4255 m` |
| **Tray at jaw height, slicing the chin** | `z = 0.74` with the comment "her head is at ~1.05". The `~` is the bug. | **Moved, not fixed.** `clearance(Tray, Jaw) = +0.2322` ✓ but `clearance(Tray, Chest) = -0.1068` — the tray, its arm and all three instruments are now **inside her chest** |
| **Patient at double offset / on the floor / rotated 90°** | `SEAT_TOP` typed in Python and retyped as `SEAT_LOCAL` in `layout.ts`. And: her origin sits **0.3529 m above her own lowest point** — any code assuming origin == floor contact puts her through the floor. | **`CHAIR_HALF_X = 0.42` is wrong today.** Measured chair: game-frame `x = [-0.575, 0.800]`, `z = [-0.555, 0.709]`. The spittoon overhangs the collider by 38 cm on +X |

**Full sweep of the two shipped assets, seated exactly as `layout.ts` places them: 68 interpenetrating pairs, 21 of them patient↔chair.** Worst offenders:

```
ShinL   x LegRest      28 faces   depth (0.208, 0.312, 0.298)
ShinR   x LegRest      24 faces   depth (0.208, 0.312, 0.298)
Chest   x TrayArm      20 faces   depth (0.145, 0.112, 0.240)
Chest   x Tray         12 faces   depth (0.290, 0.107, 0.191)
Pelvis  x Column       11 faces   depth (0.290, 0.200, 0.020)
Chest   x Instrument0  10 faces   Chest x Instrument1  10 faces
```

**That sweep took 12 milliseconds.** Six render-adjust cycles cost hours and still shipped these. The check that finds them costs 12 ms and names each one with part names and penetration depth.

**The render-and-squint loop is not slow, it is blind.** Every bug on that list is angle-dependent, and one camera angle was being rendered. Measured cost of the *sixth* view in a warm process: **60 ms.**

---

## 2. The fastest fixes, cheapest first

| # | Fix | Time | Prevents |
|---|---|---|---|
| 1 | **`obj.data.name = name`** in `ico()` and `cyl()` | 2 min | Mesh datablocks currently ship as `Icosphere.005` / `Cylinder.003`. glTF *node* names are fine so the game works — but Blender's glTF importer names re-imported objects after the **mesh**, so 7 of 23 parts lose their identity when you audit your own GLB. This blocks every other verification step. Do it first. |
| 2 | **Render six orthographic views, not one** | 1 hr, `sheet.py` is done | Measured: view 1 = 3985 ms (one-time GPU warmup), views 2–6 = **60, 59, 60, 59, 62 ms**. You already pay the 4 s. **The five extra views cost 300 ms.** Would have caught legs-lying-flat, the backrest gap, and the tray/chest penetration on cycle one. Use `BLENDER_WORKBENCH`, `shading.color_type='RANDOM'`, `show_object_outline=True` — random per-object colours with outlines are *better* than a beauty render for QA because every part is visually separable. |
| 3 | **`sync()` before every measurement** | 10 min | `obj.location = (5,0,0)` then `obj.matrix_world.translation` reads `(0,0,0)`. Verified in my own self-test: pre-sync `(0.0, 0.0, 0.0)`, post-sync `(3.0, 0.0, 6.0)`. Cost of the sync at 50 objects: 0.5 ms. There is no performance argument for skipping it. This is the precondition for everything in §3. |
| 4 | **`require()` around every `bpy.ops` call** | 10 min, 16 call sites | Operators return a **set**, not an exception. `bpy.ops.object.transform_apply(location=True)` with nothing selected returns `{'CANCELLED'}` and does nothing, silently. Only `poll()` failure raises. The quiet mode is the dangerous one. |
| 5 | **One shared `rig_constants.py`** holding `SEAT_TOP`, `RECLINE` | 20 min | Kills the `0.26` vs `0.24` bug at the root. Both build scripts currently share zero lines of code. |
| 6 | **Build both assets in ONE Blender launch** | 20 min | Measured bare launch: **1789 / 1938 / 1874 ms**. One driver calling both builders halves full-rebuild wall time immediately, with no API knowledge required. |
| 7 | **The assertion pass** (§3) | half a day | All 21 cross-asset penetrations. Runs in 12 ms forever after. |
| 8 | **`fake-bpy-module` + mypy pre-flight** | 30 min | `python.exe -m pip install --target ./tc fake-bpy-module mypy` into Blender's bundled Python (3.13.13, pip 26.0.1, at `D:\Tools\blender-5.2.0-windows-x64\5.2\python\bin\python.exe` — the system Python's pip is broken here). Catches `primitive_icosphere_add` → *did you mean* `primitive_ico_sphere_add`, and `subdivision=` → `subdivisions=`, in **1041 ms warm** versus a 4500 ms Blender round-trip. Add a narrowing helper rather than blanket ignores: `def mesh_of(o) -> bpy.types.Mesh: assert isinstance(o.data, bpy.types.Mesh); return o.data`. |

### Two traps that will cost a day each if you don't know them

**`obj.dimensions` ignores rotation.** Measured: a cube scaled `(1,2,0.5)` and rotated 0.4 rad on X reports `dimensions = (2.0, 4.0, 1.0)` while its true world AABB is `(2.0, 4.074, 2.479)` — the Z extent understated by **148%**. Almost every part in this project is rotated. Never use `dimensions`; always `matrix_world @ bound_box`.

**glTF import sets `rotation_mode = 'QUATERNION'`, so writing `rotation_euler` is a silent no-op.** Verified today: after importing `patient.glb` and writing `Jaw.rotation_euler[0] += 0.62`, `matrix_world` changed → **`False`**. After `Jaw.rotation_mode = 'XYZ'`, same write → **`True`, delta = -0.0390 m**. Any animation-range QA harness that skips `unlock_rotation()` returns a confident **PASS for every pose** because nothing ever moved. This is the worst possible failure mode for an agent that verifies by reading numbers.

---

## 3. Measurement instead of literals

This is the whole answer. The library is written, run, and verified — `…\scratchpad\pb\measure.py`, 8 sections, ~250 lines. Drop it in `scripts/` and `import measure as M` from both build scripts.

### The core: everything is a world-space AABB

```python
def _corners(o):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(dg)              # modifier-aware; bounds are wrong without it
    return [ev.matrix_world @ Vector(c) for c in ev.bound_box]   # bound_box is LOCAL

def aabb(o):
    sync()                                 # matrix_world is stale until you flush
    cs = _corners(o)
    lo = Vector((min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs)))
    hi = Vector((max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs)))
    return lo, hi

def top(o): return aabb(o)[1].z
def front(o): return aabb(o)[0].y          # she faces -Y in Blender
def ctr(o): lo, hi = aabb(o); return (lo + hi) / 2

def gap(a, b):
    """Signed separation per axis. Negative = overlap by that many metres.
       Two boxes intersect iff all three are negative."""
    alo, ahi = aabb(a); blo, bhi = aabb(b)
    return Vector(tuple(max(blo[i]-ahi[i], alo[i]-bhi[i]) for i in range(3)))

def clearance(a, b): return max(gap(a, b))   # >0 separated, <=0 interpenetrating
```

### Placement: state the intent, let Blender solve the local number

`put_world` assigns `matrix_world` and lets Blender back-solve `.location` through the whole parent chain — including any parent inverse. This is what makes world-space numbers safe.

```python
def put_world(o, v):
    sync(); m = o.matrix_world.copy(); m.translation = Vector(v)
    o.matrix_world = m; touch()

def shift_world(o, d):
    sync(); o.matrix_world = Matrix.Translation(Vector(d)) @ o.matrix_world; touch()

def sit_on(o, z, clear=0.0):   shift_world(o, (0, 0, z + clear - bottom(o)))
def stack(child, base, clear=0.0): sit_on(child, top(base), clear)
def in_front_of(o, other, clear):
    shift_world(o, (0, (front(other) - clear) - back(o), 0))
```

Verified self-test — a child of a parent that was itself moved, with a stale depsgraph:

```
SELFTEST world_after_sync: (3.0, 0.0, 6.0)
SELFTEST stack(child, base, clear=0.05) -> bottom(C)=1.5500 top(P)=1.5000 gap=0.0500
SELFTEST resulting c.location (Blender solved it): (0.0, 0.0, 0.75)
```

You said `gap = 0.05`. You got `0.0500`. You never computed `0.75`.

The chair script currently hand-computes four different offsets from one datum — `SEAT_TOP - SEAT_THICK/2`, `SEAT_TOP - 0.04`, `SEAT_TOP + 0.11`, `SEAT_TOP - 0.055` — each an opportunity for the sign error that put the spittoon in her lap.

### Assertions: the build fails instead of exporting something wrong

```python
class LayoutError(AssertionError): pass

def assert_encloses(outer, inner, margin=0.0):
    olo, ohi = aabb(outer); ilo, ihi = aabb(inner)
    for i in range(3):
        under = olo[i] + margin - ilo[i]; over = ihi[i] - (ohi[i] - margin)
        if under > EPS or over > EPS:
            raise LayoutError("'%s' escapes '%s' on %s by (%.4f, %.4f) m"
                % (inner.name, outer.name, "XYZ"[i], max(0,under), max(0,over)))

def assert_clear(a, b, min_gap=0.0):
    c = clearance(a, b)
    if c < min_gap - EPS:
        raise LayoutError("'%s' and '%s' clear by %.4f m, need %.4f m (per-axis %s)"
            % (a.name, b.name, c, min_gap, tuple(round(v,4) for v in gap(a,b))))

def assert_rests_on(o, surface, tol=0.005): ...
def assert_parallel(a, b, tol_deg=0.5):      # the recline bug, as one line
    ang = math.degrees(local_z(a).angle(local_z(b)))
    if ang > tol_deg: raise LayoutError(...)
def assert_identity_parent_inverse(): ...    # guards the double-offset class
```

Run against the shipped assets, unmodified:

```
RECLINE FAIL: 'Chest' and 'Backrest' differ by 1.146 deg, tolerance 0.500
HAIR   FAIL: 'Hair' escapes 'Head' on X by (0.0038, 0.0038) m
```

Two bugs that survived six rounds of eyeball QA, named in milliseconds.

### Interpenetration: `BVHTree.overlap` with an AABB prefilter

```python
def _bvh(o):
    dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg)
    me = ev.to_mesh(); mw = ev.matrix_world
    t = BVHTree.FromPolygons([mw @ v.co for v in me.vertices],
                             [p.vertices[:] for p in me.polygons], all_triangles=False)
    ev.to_mesh_clear(); return t      # FromPolygons ignores matrix_world — pre-transform

def hits(objs, min_depth=0.002):
    # AABB prefilter first: on 46 objects it cuts 1035 pairs to ~78
    ...
    return sorted(out, key=lambda t: -t[2])

def assert_no_new_hits(objs, allow, label=""):
    """`allow` = whitelist of contacts that are SUPPOSED to happen,
       as a set of frozenset({'A','B'}). Anything else fails the build."""
```

**Measured: 46 objects, 12 ms.** The whitelist is what turns this from noise into a regression gate — `ThighL x SeatPan` is a person sitting down, `Chest x TrayArm` is a metal pole through a torso, and only you can tell the machine which is which. Derive part of it automatically: skip parent↔child pairs (the hierarchy survives GLB export intact, verified).

### Sweep the animation range, not the rest pose

Rest-pose clearance is not safety. The extremes are all literals in `PatientRig.tsx`: jaw `+ jawOpen*0.62` (line 233), head pitch `+ pose.pitch*0.55` (230), upper arms `- brace*0.42` (237–238), forearms `= -brace*0.5` (239–240), walk thighs `± swing*0.5` (279–280), shins `- max(0,∓swing)*0.55` (283–284).

```python
def unlock_rotation():                       # MANDATORY after any glTF import
    for o in bpy.data.objects: o.rotation_mode = 'XYZ'
    touch()

def sweep(part, axis, values, objs, allow, label=""):
    base = part.rotation_euler[axis]
    try:
        for v in values:
            part.rotation_euler[axis] = base + v; touch()
            assert_no_new_hits(objs, allow, "%s @ %s%+0.2f rad" % (label, part.name, v))
    finally:
        part.rotation_euler[axis] = base; touch(); sync()
```

### The manifest: measured numbers cross into TypeScript as data

`build_dental_chair.py:190` already does `print("SEAT_TOP:", SEAT_TOP)` with the comment *"The number PatientRig needs. Printing it beats guessing it."* Right instinct, one step short — a human still retypes it into `layout.ts`. Emit JSON and let TypeScript import it.

```python
def to_game(v):
    """Blender (x,y,z) -> three.js (x, z, -y). Matches export_yup=True."""
    return [round(v[0],5), round(v[2],5), round(-v[1],5)]

def manifest(path, root, landmarks=None, extra=None):
    lo, hi = aabb_tree(root)
    doc = {"generated_by": "measure.manifest - do not hand-edit",
           "bounds_game": {"min": to_game(lo), "max": to_game(hi)},
           "parts": {o.name: {...} for o in _descendants(root) if o.type=='MESH'},
           "landmarks": {...}}
    json.dump(doc, open(path,"w"), indent=2)
```

Then in `layout.ts`: `import chair from '../../public/models/dental_chair.meta.json'` (needs `resolveJsonModule` in tsconfig), and `CHAIR_HALF_X` becomes `Math.max(-chair.bounds_game.min[0], chair.bounds_game.max[0])`. `layout.test.ts` already exists — assert against the manifest there.

`layout.ts` already documents this exact failure mode in its own header. The manifest is the mechanism that makes it structurally impossible rather than a warning.

**Sockets are the same idea at part level.** Verified round-trip: an Empty named `SOCKET_Pelvis` at `z=0.46` survives GLB export as `{"name":"SOCKET_Pelvis","translation":[0,0.46,0]}` with the Y-up conversion applied for you, and `export_extras=True` carries custom properties into `node.extras` → `object.userData` in three.js. So the Blender script — the only thing that can *measure* where the chin actually is — emits `SOCKET_tray` 80 mm in front of it, and three.js does `chair.getObjectByName('SOCKET_tray')` instead of carrying a literal that drifts.

### Proof it replaces guessing: I fixed the tray by computation

```python
lap_z  = max(top(O["ThighL"]), top(O["ThighR"]))     # 0.6119
chest_y = front(O["Chest"])                           # -0.1068
shift_world(tray, (0, (chest_y - 0.08) - back(tray),
                      (lap_z + 0.06) - bottom(tray)))
```

```
BEFORE: clearance(Tray, Chest) = -0.1068 m   (the tray is inside her)
AFTER:  clearance(Tray, Chest) = +0.0800 m
        clearance(Tray, ThighL) = +0.0600 m
```

Exactly the two requested clearances. First try. No render. And when the thigh angle changes later, the tray follows instead of silently re-entering her chest.

### Two structural changes that remove whole bug classes

**Stop scaling objects; bake shape into vertices.** `Head` scale `(1.0, 1.10, 1.16)` distorts all five of its children. Replace `ico()`'s `obj.scale = scale` with `bmesh.ops.transform(bm, matrix=Matrix.Diagonal(scale).to_4x4(), verts=bm.verts)` so every object ships at scale `(1,1,1)` and local numbers mean what they say. `bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)` and `create_cone` replace the operator-based primitives entirely, removing the fragile `bpy.context.active_object` reads. Bonus: `bmesh.ops.bevel(..., offset=0.08, segments=1, affect='EDGES')` is the single highest-leverage art upgrade available in the R.E.P.O. register — a cube goes 12 → 44 tris and catches light on every silhouette edge. Beveling the ~16 boxes takes the patient from 452 to ~964 tris, which is nothing.

**Get real dimensions instead of inventing them.** You are a dentistry student guessing dental-chair measurements. A-dec publishes free dimensioned pre-installation drawings (doc 86074499, "Dental Equipment and Dental Furniture Dimensions"), Midmark publishes chair spec sheets (007-10048-00), and **ISO 7494-1:2018** governs the category: seat vertical travel 350–820 mm, backrest 520–600 mm wide × 760–1020 mm long, seat width 610–710 mm. Your `SEAT_TOP = 0.46` and armrests at ±0.345 (690 mm span) are legitimately inside spec. The numbers that cost render cycles — tray height, spittoon reach — are precisely the ones with no reference behind them. Or bring a tape measure to clinic once. Put the sourced values in a `REFERENCE_DIMENSIONS` block with the citation beside each, the way `CLAUDE.md` already demands for clinical computations.

---

## 4. The iteration loop

### Where the time actually goes (measured today)

| Stage | Cost |
|---|---|
| Bare `blender --background --python-expr "pass"` | **1789 / 1938 / 1874 ms** |
| Import both GLBs | 327 ms |
| Full measurement pass: 46-object BVH sweep + all assertions + tray fix | **540–597 ms total** |
| First `render.render()` in a process (GPU/shader warmup) | **3985 ms** |
| Every render after, 400 px Workbench | **59–62 ms** |
| Stitch 6 tiles to a sheet with numpy | 446 ms |
| Six-view contact sheet, in-process | 5605 ms |
| Same, wall clock including launch | 8416 ms |

**Correct mental model: launch ≈ 1.9 s, first render ≈ 4 s, every render after ≈ 0.06 s, and geometry checking is free.** Every optimisation follows from that. Do more work per process.

### Settled questions

- **`pip install bpy`: no.** Version 5.2.0 exists on PyPI (uploaded 2026-07-14) and matches your install exactly — but `Requires-Python: ==3.13.*` while your system Python is 3.10, it's a 328 MB wheel, and the historically unreliable part of the module build is precisely the Workbench render path that makes your loop fast. Blender's own bundled 3.13.13 cannot `import bpy` either (verified: `ModuleNotFoundError`) — the pip module is a separate build. The socket daemon below gives you the same benefits at zero install cost.
- **Workbench, always.** Measured on a 22-object scene at 512 px, steady state: Workbench 68–115 ms, EEVEE 517–522 ms (**8×**), Cycles CPU 32spp 3799–4414 ms (**55×**), Cycles OPTIX on the MX450 **6069–7160 ms — slower than CPU**, because the scene is tiny and PCIe upload dominates on a 2 GB mobile GPU. Also: never switch engines inside one process; EEVEE's first frame after Workbench measured **44,764 ms** versus 3440 ms in a clean process.
- **`bpy.ops.render.opengl` does not work headless.** It is the most-recommended "fast preview" optimisation on the internet and it hard-errors: `Cannot use OpenGL render in background mode (no opengl context)`. The `gpu` module offscreen path fails too. Do not chase it.
- **Draco: no.** Its decoder is `draco_decoder.wasm` 192,420 B + wrapper 58,456 B = **251 KB shipped**, to save **44 KB** across both assets. Meshopt's decoder is 29,256 B. At 40–50 KB per asset, compression is the wrong axis entirely — skip it until the model library passes ~2 MB.
- **BlenderMCP: no.** Both `ahujasid/blender-mcp` and the official `projects.blender.org/lab/blender_mcp` require a **live GUI session** — the addon refuses to start under `blender -b`. It would trade your most valuable property (deterministic, diffable, committed build scripts) for conversational scene mutation, on 8 GB RAM. The one thing worth stealing is API discovery, which is 8 lines headless: `bpy.ops.export_scene.gltf.get_rna_type()` enumerates all 110 parameters with types and defaults.

### The script shape

```python
# scripts/qa_sheet.py — six orthographic views, framed from measured bounds
scn.render.engine = 'BLENDER_WORKBENCH'
sh = scn.display.shading
sh.light = 'STUDIO'; sh.color_type = 'RANDOM'          # per-object colours = parts separable
sh.show_cavity = True; sh.show_object_outline = True
scn.display.render_aa = 'FXAA'
scn.render.resolution_x = scn.render.resolution_y = 400

# Burn the verdict INTO the image so the PNG is self-describing.
scn.render.use_stamp = True
for f in ("date","time","render_time","frame","scene","camera","filename","memory","hostname"):
    setattr(scn.render, "use_stamp_" + f, False)
scn.render.use_stamp_note = True
scn.render.stamp_note_text = "ortho %.3f m | FAILS=%d" % (span*1.15, n_fail)
# NOTE: default stamp colour is near-white — set scn.render.stamp_foreground dark
#       or it is unreadable on a light backdrop.

cam_d = bpy.data.cameras.new("qa"); cam_d.type = 'ORTHO'
cam_d.ortho_scale = span * 1.15                         # measured, never typed
for name, d in [("BACK",(0,1,0)), ("LEFT",(-1,0,0)), ("TOP",(0,0,1)),
                ("FRONT",(0,-1,0)), ("RIGHT",(1,0,0)), ("HERO",(0.8,-0.9,0.55))]:
    v = Vector(d).normalized()
    cam.location = ctr + v * (span * 4)
    cam.rotation_euler = (-v).to_track_quat('-Z','Y').to_euler()
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(p)
    tiles.append(np.array(img.pixels[:], dtype=np.float32).reshape(S, S, 4))

sheet = np.concatenate([np.concatenate(tiles[0:3],axis=1),
                        np.concatenate(tiles[3:6],axis=1)], axis=0)
out = bpy.data.images.new("sheet", width=S*3, height=S*2, alpha=True)
out.pixels = sheet.ravel().tolist(); out.file_format='PNG'; out.save()
```

**Orthographic is not a style choice — it is the point.** Under an ortho camera with `ortho_scale` computed from the AABB, the image *is a ruler*: pixels map linearly to metres. Perspective hides alignment errors and makes distances unmeasurable. numpy is already bundled in Blender's Python (2.3.4) — no PIL, no external dependencies.

If you add a measurement grid, put it on a **backdrop plane behind the subject, rebuilt per view**. Building it as full-span slabs through the scene occludes the model completely and renders a flat coloured square. This was actually hit.

### The loop, in order

```
1. mypy pre-flight            ~1.0 s   catches operator typos textually
2. build both assets          ~2.5 s   ONE launch, two builders
3. assert                     ~0.01 s  fails the build, names the defect
4. contact sheet              ~4.4 s   confirmation, not debugging
5. export GLB + manifest      ~0.2 s
```

Assert *before* you render. The numeric pass is ~1400× cheaper than the visual one and it sees inside solids, where interpenetration lives.

### The evening project: a persistent daemon

Launch Blender once with `--background --python server.py`, bind a socket, block in an accept loop, `exec()` incoming source. In background mode there is **no UI event loop**, so you do *not* need the `bpy.app.timers` main-thread queue that GUI-mode MCP servers require. Warm the GPU with one throwaway 64 px render at startup so the 4 s warmup is paid before you ask it anything. Reset between runs with `bpy.ops.wm.read_factory_settings(use_empty=True)`.

Measured full iteration through a warm daemon — rebuild a 22-part rig, full geometric self-check, six-view sheet, GLB export: **1371–1541 ms** (build 215, check 8, sheet 1036, export 112). Idle RSS 424 MB. ~60 lines of server, ~12 of client, zero dependencies. Working implementation at `…\scratchpad\hl\blender_server.py` + `bl.py`.

Two gotchas that produce error messages pointing at the wrong thing: PowerShell 5.1's `Set-Content -Encoding utf8` writes a BOM, and `exec()` on it raises `SyntaxError: invalid non-printable character U+FEFF` on line 1 — read with `encoding='utf-8-sig'`. And keep the client in its own directory: CPython puts the script's directory at `sys.path[0]`, so a stray `socket.py` beside it shadows the stdlib and yields a baffling `ModuleNotFoundError: No module named 'bpy'`.

Finally, **GLB export is byte-deterministic** — same script, identical sha256 across three runs (`3fdc03f0bcb2ce2c…`, 18056 bytes), no embedded timestamp. That makes a `make`-style incremental asset build honest and makes GLB diffs in git meaningful. `lxsolutions/studio-foundation`'s `bforge` ("deterministic headless-Blender asset forge for AI agents", pushed 2026-08-18) independently landed on the same daemon + determinism + quality-gates design — worth reading as validation, not adopting (PolyForm Perimeter licence, requires `just`, large framework).

---

## 5. Geometry Nodes: **no**

Not "probably not." Not "later." No — and for a hard structural reason, not a taste one.

**A Geometry Nodes modifier evaluates to one `GeometrySet` on one object.** Every box, cylinder, instance and joined branch arrives at the exporter as a single evaluated mesh on a single node. Verified in your Blender 5.2.0: a GN group building a seat slab plus five instanced legs exported as `nodes=['Stool'] meshes=1` — one node, one mesh, **zero named parts**. The same four-part hand-built chain exported as `nodes=['Head','Neck','Chest','Pelvis','Rig'] meshes=4` with names intact.

The named hierarchy *is* the game's animation API. A GN-authored patient arrives in three.js as one static mesh called `Patient` with nothing to rotate.

Four supporting reasons, each independently sufficient:

1. **It silently exports an empty file with your current settings.** Both scripts use `export_apply=False`. With a GN modifier that serialises the *unevaluated* base mesh: a valid **172-byte GLB, zero meshes**, exporter logs a benign "Mesh has no primitives and will be omitted". Even with `export_apply=True`, GN *instances* — the main reason to use GN — are dropped unless you append a `GeometryNodeRealizeInstances` node. `export_gpu_instances=True` does not rescue them. For an agent that cannot see a viewport, "blank scene, green build log" is the worst possible failure mode.
2. **The Blender 5.x Python API for GN inputs is not the one in any tutorial or in training data.** The universal 4.x idiom `modifier["Socket_2"] = value` raises `TypeError: id properties not supported for this type`. The correct 5.2 form is `mod.properties.inputs['Socket_1']['value'] = 0.62` — sockets moved to a `GeometryNodesModifierInterface`, and each is an IDPropertyGroup with `{value, type, attribute_name}`; assigning the socket directly clobbers the group. Socket *names* aren't guessable either (Instance on Points outputs `Instances`, not `Geometry` — a `KeyError`, not a warning). Both were hit within 20 minutes of writing a trivial tree.
3. **The performance argument does not exist at this scale.** GN is genuinely ~250× faster than Python — *at 5,000 boxes*. Measured: Python 22 separate objects = 2.6 ms. Per-part GN modifiers (the only config that preserves names) = ~6.8 ms/part ≈ 150 ms for 22. **GN is 10× slower here.** Your build's wall clock is dominated by a 1.9 s launch, not by mesh construction.
4. **GN never touches object transforms.** The joint position — the thing every single bug was about — stays a hand-typed Python literal either way. GN would buy you parametric box *dimensions*, which were never the problem, at the cost of a second language and an opaque, un-diffable graph inside a `.blend`.

**The one place to revisit:** procedurally varied patients (different heights, builds, hair) from one definition. Even then, parameterised Python functions get you there with less machinery and stay readable in git. And if you ever *do* scatter hundreds of props, the numpy path (`foreach_set` with `dtype=np.float32`) gets Python within 6× of GN — 100,000 boxes / 800k verts in 1.18 s — while staying in one language.

**You are not missing a magic procedural tool. Keep writing Python.**

---

## 6. Draw calls

**Draw calls are not your bottleneck, and neither are triangles. The post-processing stack is.**

Verified counts: the room that actually renders is 111 draw calls / 3,462 triangles; adding `patient.glb` (23) and `dental_chair.glb` (23) gives **157 draw calls / 4,366 triangles**. That is two orders of magnitude inside budget for any GPU made this decade. 4,366 triangles is ~400 KB of vertex data.

### What is actually costing frames

I read `src/clinic/PostFX.tsx`. It composes **N8AO + DepthOfField + Bloom(mipmapBlur) + SMAA** plus a merged grade pass. Reading the installed `postprocessing` 6.39.3 source: `MipmapBlurPass` runs a downsample loop *and* an upsample loop over `levels` — line 56 passes no `levels` prop, so the default **8** gives **16 render passes for bloom alone**. SMAA = 3. N8AO ≈ 3. DoF ≈ 4. Plus RenderPass and NormalPass. **≈ 29 fullscreen passes.** `@react-three/postprocessing` defaults `frameBufferType` to `HalfFloatType`, so every one is RGBA16F at 8 bytes/px.

At 1920×1080 device pixels (1536×864 CSS at Windows 125% — your common case): one full-res RGBA16F target is 15.8 MB. Resident render-target memory ≈ **163 MB** against a 2 GB shared budget. Read+write bandwidth ≈ 365 MB/frame → **~21.4 GB/s at 60 fps**. An i5-1135G7's Iris Xe shares LPDDR4x-4266 with the CPU: ~68 GB/s theoretical *total*, realistically 25–35 GB/s reachable by the GPU. **The post stack wants most of your memory bandwidth before a single triangle is drawn.**

And line 30 is `enableNormalPass={!isTouch}`. `NormalPass` is a **full second scene render** with a normal-material override — every mesh, every frustum cull, submitted twice. It exists solely to feed N8AO. So on desktop your submission is **314 draw calls**, not 157, plus a second full geometry pass and another 15.8 MB buffer.

### Fix the instrument first — your measurement is broken

`WebGLRenderer.render()` line 1702: `if (this.info.autoReset === true) this.info.reset();`. EffectComposer calls `renderer.render()` ~29 times a frame. So `renderer.info.render.calls` after `composer.render()` reports whatever the **last fullscreen quad** did — typically 1. Your "~120 draw calls" is not measuring your scene.

```ts
// DevProbe.tsx
gl.info.autoReset = false                            // once, at setup
useFrame(() => gl.info.reset(), -1)                  // start of frame
useFrame(() => setStats({ calls: gl.info.render.calls,
                          tris: gl.info.render.triangles }), 1001)  // after composer
```

### The fix, in order of payoff

1. **Delete `<N8AO />` and `<DepthOfField />` on all profiles, then set `enableNormalPass={false}`.** One-line change; halves draw submission 314→157, removes a full-res normal buffer and its depth texture. The file's own comment calls N8AO "the single most expensive thing in the stack" — and enables it on exactly the hardware that cannot afford it. **15 minutes to test. This should be the whole fix.**
2. **`<Bloom mipmapBlur levels={4} …/>`** — halves 16 passes to 8. If you drop HDR bloom entirely, add `frameBufferType={UnsignedByteType}` to the composer and every remaining buffer halves in size.
3. **Pin `dpr={[1, 1]}` on the Canvas.** Going 1.0 → 1.5 costs **2.25×** on every remaining pass. Cheapest lever you have.
4. **Share materials.** `ClinicKit.tsx` `useKit()` does `scene.traverse(… mesh.material = new MeshStandardMaterial({…}))` — **104 distinct material instances**. `WebGLRenderLists.js` `painterSortStable` sorts opaque objects by `a.material.id - b.material.id`, so 104 ids = 104 sort buckets and the renderer can group nothing. Worse, `GLTFLoader` already maintains its own material cache keyed on `vertex-colors:`/`flat-shading:` — the traverse actively throws away sharing you already had. (Programs *are* still shared via `acquireProgram(parameters, cacheKey)`, so this is not 104 shader compiles.) Nothing calls `.dispose()` on the discards either.
   ```ts
   const MATS = new Map<number, MeshLambertMaterial>()   // module scope
   mesh.material = MATS.get(hex) ?? MATS.set(hex, new MeshLambertMaterial({color: hex})).get(hex)!
   ```
   104 → ~14. Same bug in `DentalChair.tsx` and `RoomModel.tsx`.
5. **Instance the tiles.** 16 `floorFull` placements at 12 tris each = 16 draw calls for 192 triangles; 14 `wall` placements at 3 primitives each = **42 draw calls for 168 triangles**. That's ~6 triangles per draw call — the GPU is doing nothing but state setup. Replace the `span.map(...)` JSX loops in `Shell()` with `<instancedMesh args={[geometry, material, 16]}>` + `setMatrixAt`. 58 → 2. Or `gltf-transform instance in.glb out.glb --min 5` for `EXT_mesh_gpu_instancing`.

### Can vertex colours + merged geometry collapse the room?

**For the room: yes, and it's the right move.** Nothing in `ClinicKit` is animated by name — walls, floors, cabinets, bins. Merging is safe there.

- `gltf-transform palette in.glb out.glb` — its own help text targets *"scenes with many solid-colored materials (often found in CAD, architectural, or low-poly styles)"*, which is literally your art style. Run on the real `patient.glb` it merged 7 materials → 1 **while keeping every name**. Free win today.
- Then `join` the *kit pieces* (unanimated). Note `wall.glb` ships 3 primitives for 12 triangles — three materials for a flat panel.
- **The real R.E.P.O. trick is baking lighting into vertex colours**, then `new MeshBasicMaterial({ vertexColors: true })` — zero lighting math per fragment, no lights in the scene, and everything becomes mergeable. Plain vertex colours *without* a bake will look too flat (silhouettes read, form vanishes), so bake first; `MeshLambertMaterial + vertexColors + flatShading` is the no-bake middle ground.

**One gotcha that will cost you a cycle: linearise the palette before writing it.** Blender stores the float triple **verbatim** (wrote 0.85, 0.64, 0.46 → GLB contains 0.8469, 0.6376, 0.4621, pure quantisation). But glTF defines `COLOR_0` as **linear**, and three.js agrees (`GLTFLoader.js` warns `Converting vertex colors from "srgb-linear"`), while `new THREE.Color(0xc99a63)` *does* convert sRGB→linear. Write your `theme3d.ts` hex straight into the attribute and every surface renders darker and more saturated than today. `C.wood = 0xc99a63` = (0.788, 0.604, 0.388) sRGB → **(0.582, 0.323, 0.126) linear**. Write the second triple.

Also: `export_vertex_color` defaults to `MATERIAL` in 5.2, which only emits `COLOR_0` if the material contains a Color Attribute node — so painting vertex colours and exporting with defaults produces **no COLOR_0, silently**. Use `export_vertex_color='ACTIVE'`, `export_materials='NONE'`, `export_active_vertex_color_when_no_material=True`. And turn on `export_shared_accessors=True` (defaults False).

**For the characters: merging as a post-process is impossible; merging at authoring time is possible but is not a performance fix.** Proof from the real file — `gltf-transform join patient.glb` reported `Removed types... Mesh (22), Node (22), Primitive (23)` and collapsed all 22 names into one node called `Pelvis`. With `--keepNamed true`: names survive, **zero** draw calls saved, and the file grew 55.5 → 60.3 KB. Post-hoc merging and named-part animation are mutually exclusive.

The authoring-time route that gives both — verified end-to-end in your Blender 5.2 — is **rigid-bind skinning**: one bone per part at that part's pivot, every vertex of part *N* in vertex group *N* at weight **1.0**, Armature modifier, then `bpy.ops.object.join()` all 22 meshes. Export with `export_skins=True`. Result: `meshes=1 primitives(=DRAW CALLS)=1`, attributes `POSITION, NORMAL, JOINTS_0, WEIGHTS_0, COLOR_0`, and `JOINT NAMES: ArmL, ArmR, Head, LegL, LegR, Torso` — every part still addressable by name, as a bone. Runtime change is small: `scene.getObjectByName('Head')` → `skinnedMesh.skeleton.getBoneByName('Head')`, same procedural `.rotation` writes in `useFrame`. Weight 1.0 single-influence means no deformation artifacts; there is no weight painting to do blind.

**But be clear about why you'd do it: it saves 44 draw calls out of 157, in a scene where 157 is not the problem.** It's a legitimate day-3 cleanup and it unlocks glTF animation clips and Mixamo retargeting later. It is not the fix for "feels slow." Do items 1–3 above first and re-measure before spending a day on it.

### Two landmines found in passing

**The room that renders appears to have no lights at all.** `RoomModel.tsx:54` resolves `clinic.glb` → else kit probe → else primitive `Room`. There is no `clinic.glb` in `public/models`, and `kit/wall.glb` exists, so `<ClinicKit />` is what renders. I counted light/Environment elements per file: `ClinicKit.tsx` **0**, `RoomModel.tsx` **0**, `ClinicExperience.tsx` **0**, `Room.tsx` **10** — every light lives in the branch that is not taken. `MeshStandardMaterial` with no lights and no envmap renders black. **Verify this with your own eyes before acting** — bloom on the emissive `LightLens`, the cream `<color attach="background">` and fog may be masking it, and `ScenePreview.tsx` / `ReactionLab.tsx` both set up their own lighting, so a look-test there would look correct. If confirmed, lift `<Studio />`, the hemisphere/directional lights and `<ContactShadows frames={1} />` out of `Room.tsx` into `RoomModel.tsx`. Baking to vertex colours makes this bug permanently impossible.

**drei's `RoundedBox` is 1,004 triangles at your settings, not 12.** `Room.tsx` wraps it in a local `<Box>` helper used 30 times with `smoothness={3}`. Measured with three r185 in your `node_modules`: `smoothness=3` → 3,012 vertices / **1,004 triangles**, non-indexed, plus a `toCreasedNormals` CPU pass at mount. That's ~30,000 triangles in the fallback room. Not rendering today — but delete `public/models/kit/` and it silently becomes your scene. If you keep the fallback, pass `smoothness={1} bevelSegments={1}` (140 tris).

---

## 7. What studios do that transfers, and what does not

### Transfers — adopt these four

1. **Sockets.** Every studio solves "where does B attach to A" with named transform markers baked into the asset (Unreal sockets on `USceneComponent`; the whole modular-kit snapping ecosystem). The asset publishes its own connection geometry and nothing downstream retypes a coordinate. Verified working end-to-end on your install.
2. **Automated asset validation.** Unreal ships this as the Data Validation plugin (on by default; subclass `EditorValidatorBase`). `HugoMontanes/Blender_Asset_Validator` is a readable Blender reference: JSON presets driving naming regex, unapplied transforms, tri budget, n-gons, degenerate faces, empty material slots — and it **blocks export** until errors clear. A machine says no before a human looks. Blender exits non-zero on an uncaught exception, so `blender --background --python build.py` becomes a gate you can wire into `npm scripts` beside the existing `npx tsx layout.test.ts`.
3. **Turntables / multi-view sheets, never a single angle.** CAVE Academy ships an Asset Render Turntable Builder to standardise this across departments; Frame.io added automatic turntable generation for 3D review in June 2026. Nobody reviews an asset from one camera. Yours costs 300 ms extra.
4. **Naming conventions and budgets as asserted contracts.** `build_patient.py` already prints `NAMES:` — that output *is* the contract `PatientRig.tsx` depends on. Turn the print into an assert on the expected set, so renaming a part fails the build instead of silently breaking an animation in the browser. Same for `print("TRIS:", tris)` → a budget assert. Add `SOCKET_` / `COL_` prefixes so role is readable from the name.

Two more that are cheap: **constraints as the authoring-time solver** (`obj.constraints.new('COPY_ROTATION')` on the backrest targeting the chest — verified to bake correctly into the exported glTF as resolved TRS, with the constraint itself dropped, which is exactly what you want; **never use drivers**, they evaluate to zero in `--background` and export garbage), and **kitbash before you model** — `D:\My Apps\study-game\assets-src\kenney_furniture\` is already vendored, Kenney is CC0 with no attribution required, and every chair/cabinet/bin/shelf in `COLLIDERS` is a solved asset. Script only the dental-specific hero props.

For proportions without shipping anyone else's mesh: import **Quaternius Universal Base Characters** (CC0, low-poly, already glTF, quaternius.com/packs/universalbasecharacters.html), measure its segment lengths with `aabb()`, and use those as constants. You get a professional's proportions as *numbers*, which aren't copyrightable, and keep full authorship of the geometry. (Drillis & Contini via Winter Fig 4.1 works too: infer stature from one trusted segment, assert every other against the table. Run on the shipped patient it flags the head at **+40.7%** — which is deliberate chibi styling and belongs in an explicit `STYLE_OVERRIDES` dict, reviewed rather than accidental.)

### Does not transfer — deliberately skip

- **OpenUSD.** Genuinely the industry's answer to programmatic scene assembly, and AOUSD released the Core Specification in Dec 2025 with 45 members. But it solves a many-artists-many-departments problem you don't have, and **three.js does not import USD** — Don McCurdy has said the project added a USDZ *exporter* and is staying with glTF. You are already on the correct format. Revisit only if Chairside moves to Unreal *and* grows past one person.
- **Kitsu / Prism / ShotGrid / Attract.** Production tracking. Every function they provide — file naming, version numbering, stopping artists saving into the wrong folder, routing between departments — is already served by git plus a build script plus one person who is also the only department. Blender Studio's Asset Pipeline addon exists to let multiple artists edit the *same* `.blend` simultaneously (its launch post is titled "Stop Stepping On Toes"). You have no concurrency problem. The one thing worth your time is the free written docs at `studio.blender.org/tools/pipeline-overview/`, read once as a checklist.
- **Houdini and Geometry Nodes.** Node graphs optimised for variation and scale — 10,000 rocks, a forest, a city block. You build ~30 unique hand-designed 452-triangle props where every part is deliberate.
- **BlenderMCP.** Requires the GUI. Covered in §4.
- **LODs.** At 452 triangles an LOD chain costs more bytes in the GLB than it saves. three.js `LOD` is for 50k+ tri assets.
- **CadQuery / build123d / OpenSCAD.** B-rep kernels tessellate to a *deflection tolerance*, not a poly budget — you say `linear_deflection=0.001` and get whatever falls out, which is the opposite of controlling every triangle in a flat-shaded silhouette. And the LLM-writability data is against them: GrandpaCAD measured ~0.4 code errors per generation for OpenSCAD versus **1.4–1.7 for build123d** (3–4× worse), with CadQuery failing outright in up to half of scenarios. Meanwhile OpenSCAD, the most writable, exports STL/3MF only — no glTF, no scene graph. Right tool for a 3D-printed instrument holder, wrong for an animated character.
- **FBX.** You're on GLB. Stay.

### The lesson that actually transfers

Barnstorm VFX did *The Man in the High Castle* in Blender and their scripting layer was narrow and purposeful: a Python bridge that auto-built Cycles materials from Substance PBR maps. Blender Studio scripts asset versioning and rig generation. Tangent Animation built a full asset/production system for *Next Gen* — and shut down in 2021, laying off up to 400 people.

The consistent pattern: **they scripted the deterministic, repetitive, verifiable steps and left judgement to humans looking at renders. None of them tried to script judgement.**

The corollary for you: the agent should not be asked "does this look right" from a render. It should be asked to **satisfy assertions**. *You* judge the render. That restructures the loop from "agent guesses → renders → squints → repeat" into "agent satisfies machine-checkable constraints, build fails loudly if not, Yaman looks at one 6-view sheet at the end and gives one round of aesthetic notes." That is what collapses three cycles into one.

---

## 8. The 3-hour plan

Nothing here rewrites a build script. Everything wraps them.

### Hour 1 — make the assets measurable (0:00–1:00)

```
0:00  Copy scratchpad\pb\measure.py → D:\My Apps\study-game\scripts\measure.py
0:05  Add obj.data.name = name to ico() and cyl() in BOTH build scripts   [2 lines]
0:10  Create scripts/rig_constants.py:
          SEAT_TOP = 0.46
          RECLINE  = 0.24     # ONE number. Both scripts import it.
      Import it in both; delete BACK_RECLINE and the -0.24 literal.
0:25  Create scripts/build_all.py — one launch, both builders, then export.
0:45  Run it. Confirm the two GLBs still load in the game.
```

**Payoff:** the 1.146° recline mismatch becomes structurally impossible, full rebuilds go from two launches (~5 s of pure startup) to one, and re-imported GLBs keep their part names so everything below is possible.

### Hour 2 — the gate (1:00–2:00)

```
1:00  In build_all.py, after construction, before export:
          M.assert_identity_parent_inverse()
          M.assert_encloses(head, hair)                        # the helmet
          M.assert_parallel(chest, backrest, tol_deg=0.5)      # the recline
          M.assert_clear(tray, chest, 0.08)                    # the tray
          M.assert_clear(tray, jaw,   0.15)
          M.assert_rests_on(pelvis, seat_pan, tol=0.01)
1:20  Build the contact whitelist from the 68-hit dump. Ten minutes of
      "buttocks in cushion = yes, pole through torso = no."
          ALLOW = {frozenset(("ThighL","SeatPan")), frozenset(("Pelvis","SeatPan")), ...}
1:40  M.assert_no_new_hits(ALL_PARTS, ALLOW)
      Watch it fail on all 21 cross-asset penetrations. Good. That is the point.
```

**Payoff:** the build now refuses to export a broken GLB. Cost per run: **12 ms.**

### Hour 3 — see it, and stop retyping numbers (2:00–3:00)

```
2:00  Copy scratchpad\pb\sheet.py → scripts/qa_sheet.py; call it from build_all.py.
      Six ortho views + stamped verdict, one PNG.  ~4.4 s in-process.
2:20  M.manifest("public/models/dental_chair.meta.json", chair_root,
                 landmarks={"seat_top": M.top(seat_pan),
                            "seat_centre": M.ctr(seat_pan)})
      Same for the patient.
2:35  layout.ts: import the JSON. Replace SEAT_LOCAL, CHAIR_HALF_X,
      CHAIR_MIN_Z, CHAIR_MAX_Z with derived values.
      (tsconfig needs "resolveJsonModule": true)
2:50  Add an assertion to the existing layout.test.ts against the manifest.
      npx tsc --noEmit && npx tsx src/clinic/layout.test.ts
```

**Payoff:** `CHAIR_HALF_X` stops being wrong by 38 cm on +X. The chair can move and its collider follows. The class of bug that produced "patient at double offset / on the floor / rotated 90 degrees" has no remaining mechanism.

### Then, in priority order

**Same day (~1 hr):** fix the three defects the gate found, by computation, not by guessing — `LegRest` through both shins (-0.208 m), `TrayArm`/`Tray`/`Instrument0-2` through the chest (-0.112 m), `Column` through the pelvis (-0.020 m). The tray fix is already written and verified: `-0.1068 → +0.0800` in one pass.

**Same day (15 min, separate concern, separate commit):** comment out `<N8AO />` and `<DepthOfField />` in `PostFX.tsx`, set `enableNormalPass={false}`, `Bloom levels={4}`, `dpr={[1,1]}`. Fix `gl.info.autoReset` in `DevProbe.tsx` first so you can actually see the difference. This is the whole performance fix and it touches no geometry.

**Week 2 (half a day):** `unlock_rotation()` + `sweep()` across the ranges in `PatientRig.tsx` lines 227–284. Rest-pose clearance is not safety.

**Week 2 (30 min):** `fake-bpy-module` + mypy pre-flight, and `gltf-transform palette` on every asset.

**Week 3, optional:** the socket daemon (4.5 s → 1.4 s), bmesh with baked scale and 1-segment edge bevels, rigid-bind skinning. All three are real improvements. None are urgent.

---

## What Yaman must verify with his own eyes

1. **Does the clinic room render lit or black?** Code says `ClinicKit` is the branch taken and it has zero lights, zero `Environment`, and paints everything with `MeshStandardMaterial`. Bloom and the background colour may be masking it, and `ScenePreview` / `ReactionLab` have their own lighting so a look-test there would look fine. Two minutes to check in the actual game.
2. **Does deleting N8AO + DepthOfField fix "feels slow"?** The bandwidth arithmetic says yes, decisively. Comment out two lines, measure with a fixed `renderer.info`, and confirm before anyone spends a day on skinning.
3. **The whitelist is a judgement call only a dentist can make.** I can tell you `ThighL x SeatPan` overlaps by 4 cm. Whether that reads as "sitting in a chair" or "sinking into it" is yours.
4. **The chair dimensions against a real one.** You have a tape measure and a clinic. `SEAT_TOP = 0.46` and the 690 mm armrest span check out against ISO 7494-1:2018; the tray and spittoon numbers have no reference behind them at all.

---

**The one-sentence version:** nothing is wrong with imperative Python building named parts — the scripts write 200+ numbers and read back zero, and a 12-millisecond assertion pass finds bugs that six render cycles missed, so add measurement, not a modelling system.