"""
Merge the Mixamo downloads into one rigged, animated, low-poly patient.

WHAT MIXAMO GIVES YOU
---------------------
One download "With Skin" carries the mesh, the armature and one action. Every
other download is "Without Skin" -- armature and action only, no geometry, on an
identical skeleton. Measured on this set:

    Stand To Sit   2 meshes, 49,112 tris, 65 bones, frames 1..68   <- the skin
    Sitting Idle   0 meshes,      0 tris, 65 bones, frames 1..130
    Sit To Stand   0 meshes,      0 tris, 65 bones, frames 1..69
    Walking        0 meshes,      0 tris, 65 bones, frames 1..32
    Idle           0 meshes,      0 tris, 65 bones, frames 1..251

So the job is: keep the skinned one, steal the other four's actions onto its
armature, and export a single GLB carrying all five animations.

Every Mixamo action is named `Armature|mixamo.com|Layer0`, identically. Import
two and you cannot tell them apart, so each is renamed at the moment it is
imported -- the only point where its source file is still known.

WHY IT GETS DECIMATED SO HARD
-----------------------------
The target look is flat-shaded low-poly -- Webfishing, Untitled Goose Game. That
style is not "realistic but cheaper"; it is a different target, and 49k triangles
of anatomically-correct human is further from it than 7k of faceted one. Hard
decimation plus flat shading moves TOWARD the reference, not away from it. It
also happens to cost a fifth of the memory.

NO JAW BONE
-----------
The Mixamo skeleton has 65 bones and none of them is a jaw. The mouth rig built
by build_mouth.py carries its own `Jaw` node, and gets attached to the head bone
at runtime -- which is precisely why the mouth was authored separately.

Usage:
    blender --background --factory-startup --python build_patient.py -- \\
        <incoming_dir> <out.glb> [--tris N] [--height M]
"""
import os
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
IN_DIR, OUT_GLB = argv[0], argv[1]
TRIS = int(argv[argv.index("--tris") + 1]) if "--tris" in argv else 7000
HEIGHT = float(argv[argv.index("--height") + 1]) if "--height" in argv else 1.70

# The file carrying the mesh, and the clean name each action gets. Order matters
# only for readability -- SKIN_FILE must be imported first so its armature is
# the one everything else is retargeted onto.
SKIN_FILE = "Stand To Sit"
CLIPS = {
    "Stand To Sit": "StandToSit",
    "Sitting Idle": "SittingIdle",
    "Sit To Stand": "SitToStand",
    "Walking": "Walking",
    "Idle": "Idle",
}

bpy.ops.wm.read_factory_settings(use_empty=True)


def import_fbx(name):
    path = os.path.join(IN_DIR, f"{name}.fbx")
    if not os.path.exists(path):
        raise SystemExit(f"MISSING: {path}")
    before = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=True)
    return (list(set(bpy.data.objects) - before),
            list(set(bpy.data.actions) - before_actions))


# --- 1. the skinned character -------------------------------------------------
objs, acts = import_fbx(SKIN_FILE)
armatures = [o for o in objs if o.type == "ARMATURE"]
meshes = [o for o in objs if o.type == "MESH"]
if not armatures or not meshes:
    raise SystemExit(f"NO_RIG: {SKIN_FILE} has {len(armatures)} armatures, "
                     f"{len(meshes)} meshes -- is it the 'With Skin' download?")
rig = armatures[0]

for a in acts:
    a.name = CLIPS[SKIN_FILE]
    # Without a fake user, an action with no assigned owner is purged before
    # export and the animation silently vanishes from the GLB.
    a.use_fake_user = True
print(f"skin: {rig.name}, {len(meshes)} meshes, {len(rig.data.bones)} bones")

# --- 2. steal the other clips onto the same skeleton --------------------------
kept = [CLIPS[SKIN_FILE]]
for name in CLIPS:
    if name == SKIN_FILE:
        continue
    objs, acts = import_fbx(name)
    if not acts:
        print(f"  WARNING: {name} carried no action, skipped")
    for a in acts:
        a.name = CLIPS[name]
        a.use_fake_user = True
        kept.append(CLIPS[name])
    # The duplicate armature has done its job -- the action is now a free-
    # standing datablock keyed by bone NAME, and both skeletons use identical
    # names, so it applies to the original rig unchanged.
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    print(f"  + {name} -> {CLIPS[name]}")

# --- 3. normalise the scale ---------------------------------------------------
# Mixamo exports in centimetres. Left alone the character arrives ~100x too big,
# stands a hundred metres over the clinic, and every collider in layout.ts is
# meaningless.
bpy.context.view_layer.update()
zs = [(o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices]
span = max(zs) - min(zs)
if span < 1e-6:
    raise SystemExit("DEGENERATE: character has zero height")
k = HEIGHT / span
rig.scale = (rig.scale[0] * k, rig.scale[1] * k, rig.scale[2] * k)
bpy.context.view_layer.update()
print(f"height {span:.3f} -> {HEIGHT:.2f} m (scaled {k:.4f})")

# Bake the scale into the armature so the exported GLB needs no wrapper
# transform, and so bone translations in the animations scale with it.
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for m in meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# --- 4. decimate, keeping the skin weights -----------------------------------
for m in meshes:
    m.data.calc_loop_triangles()
tris_in = sum(len(m.data.loop_triangles) for m in meshes)
if tris_in > TRIS:
    ratio = TRIS / tris_in
    for m in meshes:
        mod = m.modifiers.new("budget", type="DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        # Decimate must run BEFORE the Armature modifier. Applied out of order
        # Blender warns "Applied modifier was not first" and the result is
        # computed against an already-deformed mesh.
        while m.modifiers.find(mod.name) > 0:
            with bpy.context.temp_override(object=m):
                bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.context.view_layer.objects.active = m
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for m in meshes:
        m.data.calc_loop_triangles()
    print(f"decimated {tris_in} -> "
          f"{sum(len(m.data.loop_triangles) for m in meshes)} tris")
else:
    print(f"tris {tris_in} already within budget {TRIS}")

# --- 5. flat shading ----------------------------------------------------------
# The whole look rests on faceted surfaces. Smooth normals on a 7k mesh read as
# a deflated balloon; flat normals read as deliberate low-poly.
for m in meshes:
    for p in m.data.polygons:
        p.use_smooth = False
    m.data.update()

# --- 6. export ----------------------------------------------------------------
# export_animation_mode='ACTIONS' emits one glTF animation per action. The
# default exports only the ACTIVE action, which would ship a five-clip character
# with exactly one clip and no error.
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_yup=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_bake_animation=True,
    export_skins=True,
    export_texcoords=False,
    export_normals=True,
    export_apply=False,      # never with an armature: it applies modifiers and
                             # destroys the Armature modifier binding
)

for m in meshes:
    m.data.calc_loop_triangles()
print("TRIS:", sum(len(m.data.loop_triangles) for m in meshes))
print("CLIPS:", ",".join(sorted(set(kept))))
print("BONES:", len(rig.data.bones))
print("PATIENT_OK")
