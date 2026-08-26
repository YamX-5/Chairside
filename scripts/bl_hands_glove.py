"""Build public/models/hands.glb — cartoon hands wearing medical nitrile gloves.

There is no rigged surgical-glove model on Sketchfab; the only ones that exist
are static props with no armature. So the glove is authored here on top of a
rigged hand: a nitrile-blue body plus a rolled bead at the wrist, which is what
an exam glove actually is.

The cuff is exported as its OWN object named "Cuff", skinned to the wrist bones,
so the game shows it for gloves-on and hides it for gloves-off without swapping
models. That matters more than it sounds — multiplayer means other players see
whether you gloved up.

WHY THERE ARE ALMOST NO bpy.ops CALLS HERE
  Operators run against whatever context Blender happens to be in. Arriving over
  the addon's socket there is no 3D viewport, no active-object guarantee, and no
  mode guarantee, so mode_set / primitive_torus_add / object.join do not merely
  fail — they take Blender down with them, which looks from the outside like
  "connecting closed Blender". Everything below uses the data API instead:
  pose bones can be rotated in object mode, and a torus is just trigonometry.

NOTHING IS ASSUMED. The curl axis is measured — the script poses the fingers
about each axis in turn and keeps whichever actually folds the fingertips toward
the wrist. Guessing an axis is how the cabinet doors swung through a wall.

Run against a scene containing only the imported model (bl_fresh.py first).
"""
import bpy
import math
import mathutils
import os
import re

# Adult hand length, wrist crease to the tip of the middle finger. 50th-percentile
# male is 189 mm and female 172 mm; 185 mm reads as an adult without being either.
#
# MEASURED FROM THE BONES, NOT THE BOUNDING BOX. A bounding box depends on the
# pose the artist happened to save — splayed fingers and a relaxed hand give
# different boxes for the same hand, so normalising by box size makes the scale
# depend on something that has nothing to do with scale.
HAND_LENGTH = 0.185
OUT = r"D:/My Apps/study-game/public/models/hands.glb"
NITRILE = (0.31, 0.51, 0.78, 1.0)   # matches C.glove 0x4f83c8
CUFF_COL = (0.24, 0.41, 0.66, 1.0)  # matches C.gloveCuff 0x3d68a8

FINGER_WORDS = ("index", "middle", "ring", "pinky", "little", "thumb")


def finger_segment(name):
    """Port of src/clinic/fingerBones.ts, so Blender and the game agree.

    Returns segment 1-3, or None when the bone is not a bendable phalanx — end
    tips and palm metacarpals both look like fingers and are both wrong to turn.
    """
    low = name.lower()
    if "end" in low or "palm" in low:
        return None
    for word in FINGER_WORDS:
        if word in low:
            after = low[low.index(word) + len(word):]
            m = re.match(r"^[._-]?(\d{1,2})", after)
            if not m:
                return None
            seg = int(m.group(1))
            return seg if 1 <= seg <= 3 else None
    return None


print("[1] inspecting scene")
# Work on what the import ADDED, identified against bl_mark.py's before-list.
# Nothing in the scene is deleted — see bl_mark.py for why clearing it crashed.
try:
    with open(r"D:/My Apps/study-game/blender/.before", encoding="utf8") as fh:
        before = set(fh.read().split("\n"))
except OSError:
    before = set()
fresh = [o for o in bpy.data.objects if o.name not in before]
print(f"    {len(fresh)} new objects since the mark")

meshes = [o for o in fresh if o.type == "MESH" and o.name != "Cuff"]
arms = [o for o in fresh if o.type == "ARMATURE"]
if not meshes:
    raise SystemExit("nothing imported")
if not arms:
    raise SystemExit("no armature — this model cannot animate its fingers")
arm = arms[0]

joints = [b for b in arm.data.bones if finger_segment(b.name)]
tips = [b for b in arm.data.bones if finger_segment(b.name) == 3]
print(f"    {len(meshes)} meshes, {len(arm.data.bones)} bones, {len(joints)} finger joints")
print(f"    sample: {', '.join(sorted(b.name for b in joints)[:8])}")
if len(joints) < 10:
    raise SystemExit(f"only {len(joints)} finger joints — not enough to pose a hand")


def wrist_of(bone):
    """Walk up from a finger to the first bone that is neither finger nor palm."""
    b = bone.parent
    while b is not None and (finger_segment(b.name) or "palm" in b.name.lower()):
        b = b.parent
    return b


wrists = []
for b in joints:
    w = wrist_of(b)
    if w and all(w.name != x.name for x in wrists):
        wrists.append(w)
print(f"    wrists: {', '.join(w.name for w in wrists)}")


def world_bounds():
    dg = bpy.context.evaluated_depsgraph_get()
    lo = mathutils.Vector((1e9, 1e9, 1e9))
    hi = mathutils.Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
        ev.to_mesh_clear()
    return lo, hi


print("[2] normalising to a real hand length")
# Measure the REST pose, because the rest pose is what gets exported.
#
# This asset arrives in a saved pose with the fingers curled, and a curled hand
# measures shorter wrist-to-fingertip than the same hand straightened. Scaling
# against the imported pose shipped a 299 mm hand while reporting 185 mm — the
# script was not lying, it was measuring a different pose from the one exported.
for pb in arm.pose.bones:
    pb.rotation_mode = "XYZ"
    pb.rotation_euler = (0, 0, 0)
    pb.location = (0, 0, 0)
    pb.scale = (1, 1, 1)
bpy.context.view_layer.update()

lo, hi = world_bounds()
size = hi - lo
print(f"    imported at {size.x:.3f} x {size.y:.3f} x {size.z:.3f} m")

mid_tip = next((b for b in tips if "middle" in b.name.lower()), tips[0] if tips else None)


def measured_hand_length():
    """Wrist bone head to middle fingertip, in world metres."""
    if not mid_tip:
        return None
    w = wrist_of(mid_tip)
    if not w:
        return None
    head = arm.matrix_world @ arm.pose.bones[w.name].head
    tip = arm.matrix_world @ arm.pose.bones[mid_tip.name].tail
    return (tip - head).length


current = measured_hand_length()
if current and current > 1e-9:
    factor = HAND_LENGTH / current
    print(f"    hand measures {current * 1000:.0f} mm -> scaling to {HAND_LENGTH * 1000:.0f} mm")
else:
    # No usable middle finger: fall back to the box, and say so rather than
    # silently sizing the model by something meaningless.
    factor = (HAND_LENGTH * 1.15) / max(size) if max(size) > 0 else 1
    print("    WARNING: no middle-finger chain, falling back to bounding box")

# Only the imported roots. Scaling every root in the file would resize the whole
# clinic along with the hands.
for r in [o for o in fresh if o.parent is None or o.parent not in fresh]:
    r.scale = [s * factor for s in r.scale]
bpy.context.view_layer.update()
lo, hi = world_bounds()
size = hi - lo
after = measured_hand_length()
print(f"    normalised to {size.x:.3f} x {size.y:.3f} x {size.z:.3f} m"
      + (f", hand {after * 1000:.0f} mm" if after else ""))


# --- posing, without ever entering pose mode ---------------------------------
for pb in arm.pose.bones:
    pb.rotation_mode = "XYZ"


def pose(axis=0, angle=0.0):
    for pb in arm.pose.bones:
        e = [0.0, 0.0, 0.0]
        if finger_segment(pb.name):
            e[axis] = angle
        pb.rotation_euler = e
    bpy.context.view_layer.update()


def curl_score():
    """Mean fingertip-to-wrist distance. A real curl brings the tips in."""
    total, n = 0.0, 0
    for t in tips:
        w = wrist_of(t)
        if not w:
            continue
        pt = arm.matrix_world @ arm.pose.bones[t.name].tail
        pw = arm.matrix_world @ arm.pose.bones[w.name].head
        total += (pt - pw).length
        n += 1
    return total / max(n, 1)


print("[3] measuring which axis curls a finger")
pose()
rest_score = curl_score()
best = None
for axis in (0, 1, 2):
    for sign in (1, -1):
        pose(axis, math.radians(45) * sign)
        s = curl_score()
        print(f"      {'XYZ'[axis]}{'+' if sign > 0 else '-'}: tips {s * 1000:6.1f} mm")
        if best is None or s < best[2]:
            best = (axis, sign, s)
pose()
CURL_AXIS, CURL_SIGN, best_score = best
print(f"    rest {rest_score * 1000:.1f} mm -> best {'XYZ'[CURL_AXIS]}"
      f"{'+' if CURL_SIGN > 0 else '-'} at {best_score * 1000:.1f} mm")
if best_score >= rest_score * 0.95:
    raise SystemExit("no axis folds the fingers inward — this rig is not usable")


print("[4] measuring wrists and building the cuff")


def wrist_frame(wrist):
    """World-space head, unit axis and length of a wrist bone."""
    head = arm.matrix_world @ wrist.head_local
    tail = arm.matrix_world @ wrist.tail_local
    d = tail - head
    return head, d.normalized(), d.length


def wrist_radius(wrist):
    """Measure the mesh around the wrist rather than assuming a size."""
    head, axis, span = wrist_frame(wrist)
    radii = []
    for o in meshes:
        if wrist.name not in o.vertex_groups:
            continue
        gi = o.vertex_groups[wrist.name].index
        for v in o.data.vertices:
            if not any(g.group == gi and g.weight > 0.5 for g in v.groups):
                continue
            p = o.matrix_world @ v.co
            along = (p - head).dot(axis)
            if -0.05 * span <= along <= 0.22 * span:
                radii.append((p - (head + axis * along)).length)
    if not radii:
        return None
    radii.sort()
    # 80th percentile, so one stray vertex cannot inflate the cuff
    return radii[int(len(radii) * 0.8)]


def add_torus(verts, faces, groups, centre, axis, R, r, wrist_name, M=20, N=8):
    """A torus is trigonometry — no operator, no context, no crash."""
    up = mathutils.Vector((0, 0, 1))
    if abs(axis.dot(up)) > 0.9:
        up = mathutils.Vector((0, 1, 0))
    u = axis.cross(up).normalized()
    v = axis.cross(u).normalized()
    base = len(verts)
    for i in range(M):
        th = 2 * math.pi * i / M
        out = u * math.cos(th) + v * math.sin(th)
        ring = centre + out * R
        for j in range(N):
            ph = 2 * math.pi * j / N
            verts.append(ring + out * (r * math.cos(ph)) + axis * (r * math.sin(ph)))
            groups.append(wrist_name)
    for i in range(M):
        for j in range(N):
            a = base + i * N + j
            b = base + i * N + (j + 1) % N
            c = base + ((i + 1) % M) * N + (j + 1) % N
            d = base + ((i + 1) % M) * N + j
            faces.append((a, b, c, d))


cuff_verts, cuff_faces, cuff_groups = [], [], []
for wrist in wrists:
    R = wrist_radius(wrist)
    if R is None:
        print(f"      {wrist.name}: no weighted verts, skipping cuff")
        continue
    head, axis, span = wrist_frame(wrist)
    # Sit the bead just proximal of the wrist, where a real glove cuff ends.
    centre = head + axis * (0.05 * span)
    add_torus(cuff_verts, cuff_faces, cuff_groups, centre, axis,
              R * 1.06, R * 0.22, wrist.name)
    print(f"      {wrist.name}: radius {R * 1000:.1f} mm -> cuff")

cuff = None
if cuff_verts:
    me = bpy.data.meshes.new("Cuff")
    me.from_pydata([tuple(v) for v in cuff_verts], [], cuff_faces)
    me.validate(verbose=False)
    # from_pydata leaves the mesh without edge or loop data, and a UV layer is
    # never created for you. The glTF exporter reads all three and dies with
    # "foreach_get sequence length mismatch" if any is missing — an error that
    # names neither the mesh nor the attribute, so it is worth doing up front.
    me.update(calc_edges=True)
    uv = me.uv_layers.new(name="UVMap")
    for i, loop in enumerate(me.loops):
        v = me.vertices[loop.vertex_index].co
        uv.data[i].uv = (v.x * 4 % 1.0, v.z * 4 % 1.0)
    for p in me.polygons:
        p.use_smooth = True
    print(f"    cuff mesh: {len(me.vertices)} verts, {len(me.polygons)} faces, "
          f"{len(me.loops)} loops, {len(me.uv_layers)} uv layers")
    cuff = bpy.data.objects.new("Cuff", me)
    bpy.context.scene.collection.objects.link(cuff)
    # Verts are already world space and the object sits at the origin, so the
    # armature modifier binds correctly without any parenting.
    for wname in {g for g in cuff_groups}:
        vg = cuff.vertex_groups.new(name=wname)
        vg.add([i for i, g in enumerate(cuff_groups) if g == wname], 1.0, "REPLACE")
    mod = cuff.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    print(f"    cuff: {len(cuff_verts)} verts, {len(cuff_faces)} faces")


print("[5] materials")


def flat(name, colour, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = colour
    b.inputs["Roughness"].default_value = rough
    return m


glove_mat = flat("Nitrile", NITRILE, 0.42)
cuff_mat = flat("NitrileCuff", CUFF_COL, 0.48)
for o in meshes:
    o.data.materials.clear()
    o.data.materials.append(glove_mat)
if len(meshes) == 1:
    meshes[0].name = "Hands"
if cuff:
    cuff.data.materials.append(cuff_mat)


print("[5b] orientation, reported in glTF space for Hands.tsx")
# export_yup rewrites Blender's Z-up into glTF's Y-up, so what the game sees is
# gltf(x, y, z) = blender(x, z, -y). Reporting it here means the placement in
# Hands.tsx is read off a measurement instead of found by trial and error.
def to_gltf(v):
    return mathutils.Vector((v.x, v.z, -v.y))


if mid_tip:
    # Linking the cuff object invalidates cached matrices; without this the
    # armature's matrix_world can still be the pre-scale one and every figure
    # below is quietly wrong.
    bpy.context.view_layer.update()
    w = wrist_of(mid_tip)
    head = arm.matrix_world @ arm.pose.bones[w.name].head
    tip = arm.matrix_world @ arm.pose.bones[mid_tip.name].tail
    point = to_gltf((tip - head).normalized())
    print(f"    wrist at gltf {tuple(round(c, 3) for c in to_gltf(head))}")
    print(f"    fingers point gltf {tuple(round(c, 3) for c in point)}")
    print(f"    hand length {(tip - head).length * 1000:.0f} mm")


print("[6] rendering")
renderable = meshes + ([cuff] if cuff else [])
for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = o not in renderable


def ensure_studio():
    """Build the camera and lights if this scene has none — the file the user
    happens to have open is not required to be the audition scene."""
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = 800
    sc.render.resolution_y = 800
    sc.render.film_transparent = False

    if not sc.world:
        sc.world = bpy.data.worlds.new("Studio")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.32, 0.34, 0.38, 1)
        bg.inputs[1].default_value = 1.1

    for name, energy, sz, loc, rot in (
        ("HandKey", 220, 2.0, (1.2, -1.6, 1.8), (0.75, 0.1, 0.55)),
        ("HandFill", 70, 3.0, (-1.6, -1.2, 0.9), (1.2, 0, -0.9)),
    ):
        light = bpy.data.objects.get(name)
        if not light:
            light = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
            sc.collection.objects.link(light)
        light.data.energy = energy
        light.data.size = sz
        light.location = loc
        light.rotation_euler = rot
        light.hide_render = False

    cam = bpy.data.objects.get("Cam")
    if not cam:
        cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
        sc.collection.objects.link(cam)
    cam.data.lens = 55
    tgt = bpy.data.objects.get("Tgt")
    if not tgt:
        tgt = bpy.data.objects.new("Tgt", None)
        sc.collection.objects.link(tgt)
    for cn in list(cam.constraints):
        cam.constraints.remove(cn)
    tc = cam.constraints.new("TRACK_TO")
    tc.target = tgt
    tc.track_axis = "TRACK_NEGATIVE_Z"
    tc.up_axis = "UP_Y"
    sc.camera = cam
    # Room lights would wash the studio out; the hands are lit on their own.
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.name not in {"HandKey", "HandFill"}:
            o.hide_render = True


ensure_studio()


def shoot(label):
    lo, hi = world_bounds()
    s = hi - lo
    ctr = (lo + hi) / 2
    cam = bpy.data.objects["Cam"]
    bpy.data.objects["Tgt"].location = ctr
    d = max(s) * 1.7
    cam.location = (ctr.x + d * 0.30, ctr.y - d * 0.80, ctr.z + d * 0.35)
    bpy.context.scene.render.filepath = (
        rf"D:/My Apps/study-game/blender/renders/hands_{label}.png"
    )
    bpy.ops.render.render(write_still=True)
    print(f"    {label}: {s.x:.3f} x {s.y:.3f} x {s.z:.3f} m")


pose()
shoot("rest_34")
pose(CURL_AXIS, math.radians(50) * CURL_SIGN)
shoot("curl")
pose()


print("[7] exporting")
for o in bpy.data.objects:
    try:
        o.select_set(o in renderable or o is arm)
    except Exception:
        pass
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True, export_yup=True,
    export_skins=True, export_animations=False, export_materials="EXPORT",
    export_apply=False,
)
print(f"    exported {os.path.getsize(OUT) / 1024:.0f} KB")
print(f"    CURL_AXIS={'xyz'[CURL_AXIS]} sign={CURL_SIGN}  <-- set in Hands.tsx")

bpy.ops.wm.save_as_mainfile(filepath=r"D:/My Apps/study-game/blender/hands.blend")
print("[8] saved blender/hands.blend")
