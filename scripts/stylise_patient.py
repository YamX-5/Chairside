"""
Turn the Mixamo mannequin into a Chairside character.

THE REFERENCE
-------------
Webfishing / Untitled Goose Game: flat-shaded low-poly, big head, big flat eyes,
solid blocks of muted colour, stiff limbs. The charm is in EXAGGERATION and
FLATNESS, not detail. A 49k-triangle anatomically-correct human is further from
that target than a 7k faceted one, so the pipeline decimates first and then
pushes the proportions.

Three moves get almost all of the way there, and none needs a texture:

  1. SCALE THE HEAD. Cartoon proportion is roughly a 1.35x head. This is done to
     the VERTICES, weighted by their head-bone influence -- not to the pose bone.
     A pose-bone scale would be overwritten the instant an animation plays,
     because Mixamo keys scale on all 65 bones in every clip.

  2. COLOUR BY BONE. Each vertex takes the colour of the bone it is most
     weighted to: head and hands become skin, spine and arms become the shirt,
     legs the trousers, feet the shoes. Weight data is already there for the
     skinning, so this gives clean flat colour blocks for free -- no UVs, no
     texture, no paint. Bones blend at the seams exactly where clothing would.

  3. GIVE HER EYES. Two white discs and two dark pupils, weighted 100% to the
     head bone so they ride along with every animation. In the reference these
     are the single strongest character-reading element -- far more than the
     body, which is mostly a silhouette.

Facing direction is measured, never assumed: the toe bone sits forward of the
ankle bone, so `toe - foot` is a reliable forward vector for any rig, however
the exporter happened to orient it.

Usage:
    blender --background --factory-startup --python stylise_patient.py -- \\
        <in.glb> <out.glb> [--head 1.35] [--eye 0.032]
"""
import sys
import bpy
import bmesh
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
IN_GLB, OUT_GLB = argv[0], argv[1]
HEAD_SCALE = float(argv[argv.index("--head") + 1]) if "--head" in argv else 1.35
EYE_R = float(argv[argv.index("--eye") + 1]) if "--eye" in argv else 0.032

SKIN = 0xD9A276        # theme3d.ts C.skin
SHIRT = 0x33405C       # the navy already used in Patient.tsx
TROUSERS = 0x2B3440
SHOES = 0x1A1410
HAIR = 0x2B2119        # Patient.tsx again
SCLERA = 0xFBF8F4      # C.white
PUPIL = 0x241C18

# Which bone paints which part. Matched as substrings against bone names, most
# specific first -- "LeftHandIndex1" must find HAND before it finds ARM.
BONE_COLOUR = [
    ("Toe", SHOES), ("Foot", SHOES),
    ("Leg", TROUSERS), ("Hips", TROUSERS),
    ("Hand", SKIN), ("Thumb", SKIN), ("Index", SKIN), ("Middle", SKIN),
    ("Ring", SKIN), ("Pinky", SKIN),
    ("ForeArm", SKIN),                       # short sleeves
    ("HeadTop", HAIR), ("Head", SKIN), ("Neck", SKIN),
    ("Arm", SHIRT), ("Shoulder", SHIRT), ("Spine", SHIRT),
]


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h):
    r, g, b = ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def colour_for_bone(name):
    for key, col in BONE_COLOUR:
        if key.lower() in name.lower():
            return col
    return SHIRT


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN_GLB)

rigs = [o for o in bpy.data.objects if o.type == "ARMATURE"]
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
if not rigs or not meshes:
    raise SystemExit(f"NO_RIG: {len(rigs)} armatures, {len(meshes)} meshes")
rig = rigs[0]
bpy.context.view_layer.update()

bones = {b.name: b for b in rig.data.bones}


def bone_world(name, tail=False):
    b = bones.get(name)
    if not b:
        return None
    return rig.matrix_world @ (b.tail_local if tail else b.head_local)


head_name = next((n for n in bones if n.endswith("Head")), None)
if not head_name:
    raise SystemExit("NO_HEAD_BONE: " + ", ".join(list(bones)[:8]))
head_pos = bone_world(head_name)

# --- facing, measured ---------------------------------------------------------
foot = bone_world(next((n for n in bones if n.endswith("LeftFoot")), ""))
toe = bone_world(next((n for n in bones if "LeftToeBase" in n), ""))
if foot is None or toe is None:
    raise SystemExit("NO_FOOT_BONES: cannot measure which way she faces")
forward = (toe - foot)
forward.z = 0
forward.normalize()
up = mathutils.Vector((0, 0, 1))
right = forward.cross(up).normalized()
print(f"facing ({forward.x:+.2f}, {forward.y:+.2f}), "
      f"head at z={head_pos.z:.3f}")

# --- 1. scale the head, on the vertices --------------------------------------
scaled = 0
for m in meshes:
    vg = {g.index: g.name for g in m.vertex_groups}
    head_idx = [i for i, n in vg.items() if n == head_name or "HeadTop" in n]
    if not head_idx:
        continue
    inv = m.matrix_world.inverted()
    local_head = inv @ head_pos
    for v in m.data.vertices:
        w = sum(g.weight for g in v.groups if g.group in head_idx)
        if w <= 0.0:
            continue
        w = min(1.0, w)
        # Scale about the head joint, faded by influence so the neck does not
        # tear away from the shoulders.
        v.co = local_head + (v.co - local_head) * (1.0 + (HEAD_SCALE - 1.0) * w)
        scaled += 1
    m.data.update()
print(f"head: scaled {scaled} vertices by {HEAD_SCALE:.2f}")

# --- 2. colour by dominant bone ----------------------------------------------
mat = bpy.data.materials.new("patient")
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
outp = nt.nodes.new("ShaderNodeOutputMaterial")
vcol = nt.nodes.new("ShaderNodeVertexColor")
vcol.layer_name = "Col"
nt.links.new(vcol.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(bsdf.outputs["BSDF"], outp.inputs["Surface"])
bsdf.inputs["Roughness"].default_value = 0.8

used = {}
for m in meshes:
    me = m.data
    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    ca = me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    me.color_attributes.active_color_index = 0

    gname = {g.index: g.name for g in m.vertex_groups}
    per_vert = {}
    for v in me.data.vertices if hasattr(me, "data") else me.vertices:
        best_w, best_g = -1.0, None
        for g in v.groups:
            if g.weight > best_w:
                best_w, best_g = g.weight, gname.get(g.group, "")
        col = colour_for_bone(best_g or "")
        per_vert[v.index] = lin(col)
        used[best_g or "?"] = col

    for poly in me.polygons:
        for li in poly.loop_indices:
            ca.data[li].color = per_vert[me.loops[li].vertex_index]

    me.materials.clear()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = False
    me.update()

names = {}
for bone, col in used.items():
    names.setdefault(f"#{col:06X}", []).append(bone)
for col in sorted(names):
    print(f"  {col} <- {len(names[col])} bones e.g. {', '.join(names[col][:3])}")

# --- 3. eyes ------------------------------------------------------------------
# One mesh holding all four pieces, weighted entirely to the head bone, so it
# rides every animation without any per-frame work at runtime.
head_top = bone_world(head_name, tail=True) or (head_pos + mathutils.Vector((0, 0, 0.2)))
head_h = (head_top - head_pos).length

# MEASURE the skull, do not infer it from the bone.
#
# Bone length says nothing about how far forward the face actually is, and the
# head was just scaled by HEAD_SCALE, which moved the surface but not the bone.
# Placing the eyes at a guessed multiple of bone length buried them inside the
# skull with only their outer crescents showing.
head_pts = []
for m in meshes:
    vg = {g.index: g.name for g in m.vertex_groups}
    idx = [i for i, n in vg.items() if n == head_name or "HeadTop" in n]
    if not idx:
        continue
    for v in m.data.vertices:
        if sum(g.weight for g in v.groups if g.group in idx) > 0.5:
            head_pts.append(m.matrix_world @ v.co)
if not head_pts:
    raise SystemExit("NO_HEAD_VERTS: nothing weighted to " + head_name)


def extent(vec):
    return max((p - head_pos).dot(vec) for p in head_pts)


half_w = max(abs((p - head_pos).dot(right)) for p in head_pts)
top = extent(up)
eye_h = top * 0.46                     # eye line sits below the crown
eye_x = half_w * 0.40

# How far forward the skull actually reaches AT the eye line — sampled in a band
# rather than at the centre, because an egg-shaped head falls away toward the
# sides and a single centre reading would still leave the outer edge sunk.
band = [p for p in head_pts
        if abs((p - head_pos).dot(up) - eye_h) < top * 0.22]
front = max(((p - head_pos).dot(forward) for p in band), default=extent(forward))

centre = head_pos + up * eye_h + forward * (front + 0.004)
print(f"skull: half-width {half_w:.3f}, top {top:.3f}, "
      f"face front {front:.3f} at eye line")

# Built as explicit vertex and face lists rather than with bmesh ops.
#
# `bmesh.ops.create_uvsphere` followed by slicing `bm.verts[start:]` needs the
# lookup table rebuilt first; without it the slice addresses stale entries and
# the offset lands on the wrong vertices — which shows up as the eyes shearing
# away from the head in long streaks. Explicit geometry has no such trap, and
# flat discs match the reference better than spheres anyway: those eyes read as
# flat painted ovals, not eyeballs.
verts, faces, cols = [], [], []


def disc(at, radius, colour, segments=12, squash=1.15):
    """A fan facing `forward`, standing slightly proud of the skull."""
    base = len(verts)
    verts.append(at)
    for i in range(segments):
        a = (i / segments) * 2.0 * 3.141592653589793
        import math as _m
        offset = (right * (_m.cos(a) * radius)
                  + up * (_m.sin(a) * radius * squash))
        verts.append(at + offset)
    for i in range(segments):
        faces.append((base, base + 1 + i, base + 1 + (i + 1) % segments))
    cols.extend([lin(colour)] * (segments + 1))
    return base


for side in (-1, 1):
    eye_at = centre + right * (side * eye_x)
    disc(eye_at, EYE_R, SCLERA)
    # The pupil sits a hair in front so it never z-fights with the sclera.
    disc(eye_at + forward * 0.0015, EYE_R * 0.44, PUPIL)

eye_mesh = bpy.data.meshes.new("Eyes")
eye_mesh.from_pydata([tuple(v) for v in verts], [], faces)
eye_mesh.validate()
eye_mesh.update()

eca = eye_mesh.color_attributes.new(name="Col", type="BYTE_COLOR",
                                    domain="CORNER")
for poly in eye_mesh.polygons:
    for li in poly.loop_indices:
        eca.data[li].color = cols[eye_mesh.loops[li].vertex_index]

for p in eye_mesh.polygons:
    p.use_smooth = False
eye_mesh.materials.append(mat)

eyes = bpy.data.objects.new("Eyes", eye_mesh)
bpy.context.collection.objects.link(eyes)

# Give the eyes the BODY mesh's exact transform and parenting, and express their
# vertices in that same local space.
#
# Building them in world space and then parenting to the armature applies the
# rig's transform a second time -- and the glTF importer's Y-up-to-Z-up
# correction lives in exactly that transform, so the eyes shear off to infinity
# as long streaks. Matching the body mesh means the Armature modifier treats
# them identically to every other vertex on the character, with no space maths
# of our own to get wrong.
# BONE-PARENTED, deliberately NOT skinned.
#
# PatientRig blinks by squashing the eye's scale.z (PatientRig.tsx:207-208).
# A skinned mesh cannot be scaled that way — the skinning matrices overwrite the
# object transform every frame, so the blink would silently do nothing. Bone
# parenting exports the eyes as an ordinary child node of the head joint, which
# rides every animation for free AND leaves scale.z free for the blink.
#
# Blender bone-parents to the bone's TAIL, not its head, and reassigning
# matrix_world afterwards does not reliably correct for it in background mode --
# the eyes end up floating a bone's length above the skull. So convert the
# vertices into the exact space Blender parents into, and leave both the object
# transform and the parent inverse at identity. Nothing left to get wrong.
_b = rig.data.bones[head_name]
_bone_space = (rig.matrix_world @ _b.matrix_local
               @ mathutils.Matrix.Translation((0.0, _b.length, 0.0)))
_to_bone = _bone_space.inverted()
for v in eye_mesh.vertices:
    v.co = _to_bone @ v.co
eye_mesh.update()

eyes.parent = rig
eyes.parent_type = "BONE"
eyes.parent_bone = head_name
eyes.matrix_parent_inverse = mathutils.Matrix.Identity(4)
eyes.matrix_basis = mathutils.Matrix.Identity(4)
bpy.context.view_layer.update()
print(f"eyes: 2 at radius {EYE_R:.3f} m, bone-parented to {head_name} "
      f"(not skinned, so scale.z blinking still works)")

# --- 4. multiply in ambient occlusion ----------------------------------------
# She MOVES, so only occlusion is baked, never directional light -- bake the key
# light into a character and the sun turns with her body when she stands up.
# The runtime renders her with MeshLambertMaterial({vertexColors:true}), which
# multiplies this baked occlusion by live lighting, so she keeps real
# directional light at whatever angle she is actually facing.
#
# Baked in the REST pose, which is standard: occlusion under the chin and inside
# the armpits deforms with the mesh and stays convincing through the clips.
def bake_ao():
    import addon_utils
    try:
        addon_utils.enable("cycles", default_set=False)
    except Exception:
        pass
    try:
        bpy.context.scene.render.engine = "CYCLES"
    except Exception as e:
        print("CYCLES_UNAVAILABLE:", e)
        return False

    targets = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in targets:
        me = o.data
        # Trap E: FLOAT, not BYTE -- an 8-bit attribute clamps the bake on the
        # way in. Trap B2: exactly one attribute at a time.
        if "AO" in [c.name for c in me.color_attributes]:
            me.color_attributes.remove(me.color_attributes["AO"])
        me.color_attributes.new(name="AO", type="FLOAT_COLOR", domain="CORNER")
        me.color_attributes.active_color_index = \
            me.color_attributes.find("AO")

    sc = bpy.context.scene
    sc.cycles.samples = 64
    sc.cycles.use_denoising = False
    sc.render.bake.target = "VERTEX_COLORS"
    sc.world = sc.world or bpy.data.worlds.new("W")
    # Trap J: the radius has to suit the subject. A person is ~1.7 m, so a
    # radius near a forearm's length gives contact darkening without the whole
    # figure going flat.
    sc.world.light_settings.distance = 0.25

    bpy.ops.object.select_all(action="DESELECT")
    for o in targets:                    # Trap C: bake acts on the SELECTION
        o.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)

    lo, hi = 1.0, 0.0
    for o in targets:
        me = o.data
        ao = me.color_attributes["AO"]
        col = me.color_attributes["Col"]
        n = len(ao.data)
        buf = [0.0] * (n * 4)
        ao.data.foreach_get("color", buf)
        base = [0.0] * (n * 4)
        col.data.foreach_get("color", base)
        for i in range(0, n * 4, 4):
            a = buf[i]
            lo, hi = min(lo, a), max(hi, a)
            # Lifted floor: full black reads as a hole, not a shadow.
            k = 0.42 + 0.58 * a
            base[i] *= k
            base[i + 1] *= k
            base[i + 2] *= k
        col.data.foreach_set("color", base)
        me.color_attributes.remove(me.color_attributes["AO"])
        me.color_attributes.active_color_index = me.color_attributes.find("Col")
        me.update()
    print(f"AO: {lo:.3f}..{hi:.3f} multiplied into the bone colours")
    return True


bake_ao()

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_yup=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_bake_animation=True,
    export_skins=True,
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=True,
    export_texcoords=False,
    export_normals=True,
    export_apply=False,
)

tris = 0
for m in [o for o in bpy.data.objects if o.type == "MESH"]:
    m.data.calc_loop_triangles()
    tris += len(m.data.loop_triangles)
print("TRIS:", tris)
print("STYLISE_OK")
