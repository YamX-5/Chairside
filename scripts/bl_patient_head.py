"""Give the patient a real head.

She ships as Mixamo's default "Beta" body — a grey, faceless mannequin. This
swaps in the Sketchfab "Patient Head" (Ng Jun Wei, CC BY 4.0), sized and skinned
to the existing rig so all five animations keep working untouched.

HOW THE HEAD IS ATTACHED, AND WHY NOT BONE-PARENTING
  Blender's bone parenting hangs a child off the bone's TAIL, not its head, and
  writes a matrix_parent_inverse that makes .location lie about where the object
  is. It also exports to glTF as a node hanging off a joint rather than as part
  of the skin.

  Instead the head is SKINNED: every vertex gets weight 1.0 to mixamorigHead and
  an Armature modifier drives it. That is the same trick the glove cuff uses, it
  exports as one skinned mesh, and it follows the animation with no special case.

SIZED FROM THE HEAD IT REPLACES, not from a guess. The old head's vertices are
measured before they are deleted, and the new one is scaled and centred onto that
box — so a different body or a different head still lands correctly.

Run after downloading the head, against a scene marked by bl_mark.py.
"""
import bpy
import bmesh
import mathutils
import os

PATIENT = r"D:/My Apps/study-game/public/models/patient.glb"
OUT = r"D:/My Apps/study-game/public/models/patient.glb"
HEAD_BONE = "mixamorig:Head"
TARGET_FACES = 900  # flat-shaded low-poly; the body is ~7k for a whole person


def sanitize(name):
    for ch in "[]./:":
        name = name.replace(ch, "")
    return name


# --- 1. what is already here is the downloaded head ---------------------------
try:
    with open(r"D:/My Apps/study-game/blender/.before", encoding="utf8") as fh:
        before = set(fh.read().split("\n"))
except OSError:
    before = set()

head_objs = [o for o in bpy.data.objects if o.name not in before and o.type == "MESH"]
if not head_objs:
    raise SystemExit("no downloaded head in the scene — download it first")
print(f"[1] head: {len(head_objs)} meshes, "
      f"{sum(len(o.data.polygons) for o in head_objs)} faces")

# --- 1b. trim the bust off the head -------------------------------------------
#
# This scan is a HEAD AND SHOULDERS, not a head. Scaling the whole thing to the
# old head's height therefore shrinks the actual head and leaves the shoulder
# flare standing proud of the body as a white collar — which is exactly what the
# first attempt rendered.
#
# The cut is found from the model's own silhouette rather than a fixed fraction:
# walk up from the bottom in slices and stop at the narrowest one, which is the
# neck. Below that is bust, above it is head.
def trim_bust(objs):
    lo = mathutils.Vector((1e9, 1e9, 1e9))
    hi = mathutils.Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    height = hi.z - lo.z
    if height < 1e-9:
        return

    SLICES = 24
    widths = [0.0] * SLICES
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            k = min(int((w.z - lo.z) / height * SLICES), SLICES - 1)
            r = ((w.x - (lo.x + hi.x) / 2) ** 2 + (w.y - (lo.y + hi.y) / 2) ** 2) ** 0.5
            widths[k] = max(widths[k], r)

    # Look only in the lower half: the neck is below the head, and the chin can
    # otherwise read as a narrow slice.
    lower = widths[: SLICES // 2]
    neck = min(range(len(lower)), key=lambda i: lower[i] if lower[i] > 0 else 1e9)
    cut = lo.z + (neck + 0.5) / SLICES * height
    print(f"    silhouette narrowest at slice {neck}/{SLICES} -> cutting below z {cut:.4f}")

    for o in objs:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        doomed = [v for v in bm.verts if (o.matrix_world @ v.co).z < cut]
        if doomed:
            bmesh.ops.delete(bm, geom=doomed, context="VERTS")
        bm.to_mesh(o.data)
        bm.free()
        o.data.update()


trim_bust(head_objs)
print(f"    head after trim: {sum(len(o.data.polygons) for o in head_objs)} faces")

# --- 2. bring in the patient --------------------------------------------------
seen = {o.name for o in bpy.data.objects}
bpy.ops.import_scene.gltf(filepath=PATIENT)
patient = [o for o in bpy.data.objects if o.name not in seen]
arm = next((o for o in patient if o.type == "ARMATURE"), None)
body = [o for o in patient if o.type == "MESH"]
if not arm or not body:
    raise SystemExit("patient.glb has no armature or no mesh")
print(f"[2] patient: {len(body)} meshes, {len(arm.data.bones)} bones")

# three sanitises bone names on load, but Blender does not — the .glb still
# carries the colon, so match on both.
want = sanitize(HEAD_BONE)
bone = next((b for b in arm.data.bones if sanitize(b.name) == want), None)
if not bone:
    raise SystemExit(f"no {HEAD_BONE} bone; have {[b.name for b in arm.data.bones][:8]}")
print(f"    head bone: {bone.name}")

# --- 3. measure the old head, then remove it ----------------------------------
group_name = bone.name
lo = mathutils.Vector((1e9, 1e9, 1e9))
hi = mathutils.Vector((-1e9, -1e9, -1e9))
removed = 0

for o in body:
    if group_name not in o.vertex_groups:
        continue
    gi = o.vertex_groups[group_name].index
    doomed = []
    for v in o.data.vertices:
        # Dominant group only. A vertex the head merely influences is part of the
        # neck, and deleting those opens a hole no head will cover.
        best, best_w = None, 0.0
        for g in v.groups:
            if g.weight > best_w:
                best, best_w = g.group, g.weight
        if best == gi:
            doomed.append(v.index)
            w = o.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    if not doomed:
        continue
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in doomed], context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()
    removed += len(doomed)

if removed == 0:
    raise SystemExit("found no vertices dominated by the head bone")
size = hi - lo
centre = (lo + hi) / 2
print(f"[3] removed {removed} head verts; old head was "
      f"{size.x:.3f} x {size.y:.3f} x {size.z:.3f} m at z {centre.z:.3f}")

# --- 4. fit the new head onto that box ----------------------------------------
nlo = mathutils.Vector((1e9, 1e9, 1e9))
nhi = mathutils.Vector((-1e9, -1e9, -1e9))
for o in head_objs:
    for corner in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(corner)
        for i in range(3):
            nlo[i] = min(nlo[i], w[i])
            nhi[i] = max(nhi[i], w[i])
nsize = nhi - nlo
ncentre = (nlo + nhi) / 2
# Match HEIGHT: a head reads by its height, and matching the widest axis instead
# would let a wide-eared scan inflate the whole skull.
factor = size.z / nsize.z if nsize.z > 1e-9 else 1
print(f"    new head {nsize.x:.3f} x {nsize.y:.3f} x {nsize.z:.3f} -> scale {factor:.4f}")

for o in head_objs:
    o.scale = [s * factor for s in o.scale]
bpy.context.view_layer.update()
# Re-measure after scaling, then translate the centre onto the old head's.
nlo = mathutils.Vector((1e9, 1e9, 1e9))
nhi = mathutils.Vector((-1e9, -1e9, -1e9))
for o in head_objs:
    for corner in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(corner)
        for i in range(3):
            nlo[i] = min(nlo[i], w[i])
            nhi[i] = max(nhi[i], w[i])
# SIT IT ON THE NECK, do not centre it on the old box.
#
# Centring put the head floating above the shoulders with the neck stump showing
# below it. What has to line up is the BOTTOM: a head rests on a neck. So match
# lo.z and centre only x and y.
ncentre2 = (nlo + nhi) / 2
delta = mathutils.Vector((
    centre.x - ncentre2.x,
    centre.y - ncentre2.y,
    lo.z - nlo.z,
))
for o in head_objs:
    if o.parent is None:
        o.location = [a + b for a, b in zip(o.location, delta)]
bpy.context.view_layer.update()
print(f"    seated head on the neck, moved {delta.length:.3f} m")

# --- 4b. bring the eyes with it -----------------------------------------------
# The Mixamo body ships a separate `Eyes` mesh, deliberately unskinned so its
# scale is free for the blink (see PatientRig). Deleting the head's vertices does
# not touch it, so it stays where the OLD head was — two googly eyes hanging in
# the air beside the new face.
#
# Rather than delete it and lose blinking entirely, move it by the SAME relative
# position it held inside the old head. No assumption about which way she faces.
eyes = next((o for o in body if "eye" in o.name.lower()), None)
if eyes:
    ecentre = sum(
        (eyes.matrix_world @ mathutils.Vector(c) for c in eyes.bound_box),
        mathutils.Vector(),
    ) / 8
    # Where the eyes sat inside the old head, as a 0..1 fraction on each axis.
    frac = mathutils.Vector((
        (ecentre.x - lo.x) / size.x if size.x > 1e-9 else 0.5,
        (ecentre.y - lo.y) / size.y if size.y > 1e-9 else 0.5,
        (ecentre.z - lo.z) / size.z if size.z > 1e-9 else 0.5,
    ))
    nlo2 = nlo + delta
    nsize2 = nhi - nlo
    want = mathutils.Vector((
        nlo2.x + frac.x * nsize2.x,
        nlo2.y + frac.y * nsize2.y,
        nlo2.z + frac.z * nsize2.z,
    ))
    shift = want - ecentre
    eyes.location = [a + b for a, b in zip(eyes.location, shift)]
    bpy.context.view_layer.update()
    print(f"    moved {eyes.name} onto the new face, by {shift.length:.3f} m")
else:
    print("    no separate Eyes mesh found")

# --- 5. decimate, flatten, colour ---------------------------------------------
for o in head_objs:
    faces = len(o.data.polygons)
    if faces > TARGET_FACES:
        mod = o.modifiers.new("Decimate", "DECIMATE")
        mod.ratio = max(TARGET_FACES / faces, 0.02)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:
        p.use_smooth = False
    mat = bpy.data.materials.new("PatientSkin")
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.85, 0.64, 0.46, 1)
    b.inputs["Roughness"].default_value = 0.78
    o.data.materials.clear()
    o.data.materials.append(mat)
print(f"[5] head now {sum(len(o.data.polygons) for o in head_objs)} faces, flat-shaded")

# --- 6. skin it to the head bone ----------------------------------------------
for o in head_objs:
    # UNPARENT FIRST, KEEPING THE WORLD TRANSFORM.
    #
    # Order matters and getting it wrong is spectacular. Baking the transform and
    # THEN clearing the parent makes Blender recompute matrix_world from the
    # orphaned basis — which still holds the parent-inverse. The Sketchfab head's
    # import root has a scale near 0.001, so its inverse is a factor of a
    # thousand: the exported patient came out 172 m tall.
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw

    # Bake the transform into the mesh so the object sits at the origin, the way
    # a skinned mesh must.
    o.data.transform(o.matrix_world)
    o.matrix_world = mathutils.Matrix.Identity(4)
    o.vertex_groups.clear()
    vg = o.vertex_groups.new(name=group_name)
    vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    mod = o.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
print(f"[6] skinned to {group_name}")

# --- 7. export ----------------------------------------------------------------
keep = set(body) | set(head_objs) | {arm}
for o in bpy.data.objects:
    try:
        o.select_set(o in keep)
    except Exception:
        pass
bpy.context.view_layer.objects.active = body[0]
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True, export_yup=True,
    export_skins=True, export_animations=True, export_materials="EXPORT",
    export_apply=False,
)
print(f"[7] exported {os.path.getsize(OUT) / 1024:.0f} KB")
