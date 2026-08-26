"""
Prepare a downloaded asset for the game while KEEPING what makes it look good.

WHY THIS EXISTS SEPARATELY FROM import_asset.py
-----------------------------------------------
`import_asset.py` targets a flat-shaded low-poly look: it decimates to a couple
of thousand triangles, samples the diffuse map into vertex colours and deletes
every image. On hand-made low-poly source that is the right trade.

On the Sketchfab assets it was a disaster. Measured on what actually shipped:

    eto_sterilizer   16.2 MB  ->  387 KB
    closet           10.9 MB  ->  167 KB
    carestream_xray   7.8 MB  ->  805 KB   (191,883 tris -> 7,047)
    all 56           415 MB   ->  5.7 MB

That is 73x compression, and it looked like it: the x-ray and the sterilizer
rendered as shattered white fragments, because 98% of the geometry AND all of
the texture detail were gone. The assets were chosen for their quality and then
had exactly that quality removed.

So this script keeps both:

  * TEXTURES STAY TEXTURES. Resized to 1K, which is the largest a 2 GB GPU can
    hold across a roomful of objects, but never sampled away or deleted.
  * GEOMETRY STAYS. Decimation only past a high ceiling, so a detailed model
    stays detailed and only genuinely absurd meshes get touched.

What it still does, because these are non-negotiable regardless of style:

  * NORMALISE SCALE. Sketchfab units are arbitrary -- these ranged from 0.165 to
    1128 for objects that are all roughly a metre.
  * GROUND AT y = 0, so a prop placed on the floor sits on the floor.
  * VERIFY ITS OWN OUTPUT. The previous pipeline shipped a 420-metre stool
    because nothing checked the result.

Usage:
    blender --background --factory-startup --python import_hq.py -- \\
        <in.glb> <out.glb> [--height M] [--tris N] [--tex N] [--yaw DEG]
"""
import os
import sys
import math
import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
IN_PATH, OUT_GLB = argv[0], argv[1]


def flag(name, default=None, cast=str):
    if name in argv:
        return cast(argv[argv.index(name) + 1])
    return default


HEIGHT = flag("--height", None, float)
# A ceiling, not a target. Most assets pass straight through untouched; only the
# genuinely absurd ones (400k+) get reduced, and even then to something detailed.
TRIS = flag("--tris", 50000, int)
# 1K per map. Twenty objects at 1K RGBA is ~80 MB of VRAM, which fits a 2 GB
# card alongside everything else. 2K would not.
TEX = flag("--tex", 1024, int)
YAW = math.radians(flag("--yaw", 0.0, float))

bpy.ops.wm.read_factory_settings(use_empty=True)

ext = os.path.splitext(IN_PATH)[1].lower()
if ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=IN_PATH)
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=IN_PATH)
elif ext == ".obj":
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=IN_PATH)
    else:
        bpy.ops.import_scene.obj(filepath=IN_PATH)
else:
    raise SystemExit(f"UNSUPPORTED: {ext}")

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("NO_MESHES")

for o in meshes:
    o.data.calc_loop_triangles()
tris_in = sum(len(o.data.loop_triangles) for o in meshes)
imgs_in = len(bpy.data.images)
print(f"imported: {len(meshes)} meshes, {tris_in} tris, {imgs_in} images")


def world_bbox():
    pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
    hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


# --- 1. decimate, BEFORE any transform ---------------------------------------
# Order is load-bearing: applying a DECIMATE modifier disturbs the transform on
# a parented hierarchy. Traced on carestream_xray -- 1.550 m base 0.000 before,
# 1.897 m base -0.344 immediately after, with nothing else touching it.
if tris_in > TRIS:
    ratio = TRIS / tris_in
    for o in meshes:
        m = o.modifiers.new("budget", type="DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.ratio = ratio
        # Keep UV seams intact -- the whole point here is that the texture still
        # maps correctly afterwards.
        m.use_dissolve_boundaries = False
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    for o in meshes:
        o.data.calc_loop_triangles()
    print(f"decimated {tris_in} -> {sum(len(o.data.loop_triangles) for o in meshes)}"
          f" tris (ceiling {TRIS})")
else:
    print(f"tris {tris_in} under the {TRIS} ceiling — geometry untouched")

# --- 2. scale and ground ------------------------------------------------------
# Root world-matrices, never per-mesh local values: children follow their
# parents, and setting local scale on a parented mesh is meaningless. That bug
# shipped a 420 x 444 metre stool.
roots = [o for o in bpy.data.objects if o.parent is None]


def apply_to_roots(mat):
    for r in roots:
        r.matrix_world = mat @ r.matrix_world
    bpy.context.view_layer.update()


bpy.context.view_layer.update()
lo, hi = world_bbox()
size = hi - lo
print(f"source size: {size.x:.3f} x {size.y:.3f} x {size.z:.3f} m")

if HEIGHT:
    tallest = max(size.x, size.y, size.z)
    if tallest < 1e-9:
        raise SystemExit("DEGENERATE")
    apply_to_roots(mathutils.Matrix.Scale(HEIGHT / tallest, 4))

lo, hi = world_bbox()
apply_to_roots(mathutils.Matrix.Translation(
    -mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
if YAW:
    apply_to_roots(mathutils.Matrix.Rotation(YAW, 4, "Z"))

# --- 3. cap texture resolution, keeping the textures --------------------------
# Resized, never removed. This is the whole difference from the old pipeline.
scaled = 0
for img in bpy.data.images:
    w, h = img.size
    if w == 0 or h == 0:
        continue
    if w > TEX or h > TEX:
        img.scale(min(w, TEX), min(h, TEX))
        scaled += 1
    # Pack, or the GLB references files that do not travel with it.
    try:
        if not img.packed_file:
            img.pack()
    except Exception:
        pass
print(f"textures: {len(bpy.data.images)} kept, {scaled} resized to {TEX}px")

# --- 4. export ----------------------------------------------------------------
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_yup=True,
    export_apply=False,
    export_texcoords=True,      # the maps are the point
    export_normals=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
)

# --- 5. verify ----------------------------------------------------------------
# The previous pipeline shipped seven broken props because nothing ever measured
# what it produced. Never again.
bpy.context.view_layer.update()
lo, hi = world_bbox()
size = hi - lo
kb = os.path.getsize(OUT_GLB) / 1024
print(f"size: {size.x:.3f} x {size.y:.3f} x {size.z:.3f} m  base z={lo.z:+.3f}"
      f"  file={kb:.0f} KB")

problems = []
if HEIGHT and abs(max(size) - HEIGHT) > HEIGHT * 0.02:
    problems.append(f"height {max(size):.3f} m, asked {HEIGHT:.3f} m")
if abs(lo.z) > 0.005:
    problems.append(f"base z={lo.z:+.3f}, should be 0")
if max(size) > 12.0:
    problems.append(f"largest dimension {max(size):.1f} m")
if problems:
    raise SystemExit("BAD_TRANSFORM: " + "; ".join(problems))

print("HQ_OK")
