"""
Build the mouth: two dental arches with all 32 teeth, individually named by FDI.

WHY THIS IS THE MOST IMPORTANT ASSET IN THE GAME
------------------------------------------------
No character generator will ever supply it. Real-time heads — Mixamo,
Quaternius, Character Creator — are sealed shells: no oral cavity, no teeth, no
tongue, because nobody models an interior you never see. Open their jaw and you
see through into an empty skull.

For Chairside the mouth interior IS the clinical payload. So the body can come
from anywhere and be swapped later; the mouth is authored here, versioned here,
and stays correct.

Every tooth is its own object named `T<FDI>` — T11..T18, T21..T28, T31..T38,
T41..T48. That means the game can address a single tooth by the exact code the
case data already uses (`ToothFDI` is `/^[1-4][1-8]$/`), so highlighting the
tooth under discussion, or showing caries on 46 specifically, is a name lookup
and nothing more.

FDI quadrants, viewed as the CLINICIAN sees them:
    1 = upper right    2 = upper left
    4 = lower right    3 = lower left
Position 1 is the central incisor at the midline, 8 is the third molar at the back.

Attaches to a head bone at runtime:
    skeleton.getBoneByName('mixamorigHead').add(mouthRig)
"""
import sys
import math
import bmesh
import bpy

OUT = sys.argv[sys.argv.index("--") + 1]

ENAMEL = 0xF2EDE2
ENAMEL_DEEP = 0xE4DACA   # occlusal surfaces, slightly darker so cusps read
GUM = 0xC4736B
GUM_DARK = 0xA85C56
TONGUE = 0xC0665F
PALATE = 0xD08A80
DARK = 0x2A1512          # the throat behind everything

# Adult arch: ~55 mm across, ~50 mm deep. Built at true scale in metres so it
# stays right when parented to a head of any size — scale the whole group once
# at attach time rather than guessing per-tooth sizes.
ARCH_W = 0.0275          # half-width
ARCH_D = 0.026           # depth from midline to back molar
BEVEL = 0.0004


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(h):
    r, g, b = ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


bpy.ops.wm.read_factory_settings(use_empty=True)
_mats = {}


def material(h):
    key = f"m_{h:06X}"
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    col = rgba(h)
    b.inputs["Base Color"].default_value = col
    b.inputs["Roughness"].default_value = 0.35   # enamel is glossy
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.3
    m.diffuse_color = col
    _mats[key] = m
    return m


def bevel_mesh(mesh, offset=BEVEL):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=offset,
                    segments=1, affect="EDGES", clamp_overlap=True, profile=0.5)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def box(name, parent, loc, size, colour, rot=(0, 0, 0), bevel=True):
    sx, sy, sz = size
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    verts = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
             (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
             (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if bevel:
        bevel_mesh(me, min(BEVEL, min(sx, sy, sz) * 0.2))
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(material(colour))
    bpy.context.collection.objects.link(o)
    if parent:
        o.parent = parent
    for p in me.polygons:
        p.use_smooth = False
    return o


def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    bpy.context.collection.objects.link(e)
    if parent:
        e.parent = parent
    return e


# ---------------------------------------------------------------------------
# Tooth shapes by position in the quadrant.
#
# Real crown dimensions, mesiodistal x buccolingual x height, in metres.
# Sourced from standard odontometric tables (Wheeler's) rather than guessed —
# the proportions are what make an arch read as teeth rather than a zip.
#   1 central incisor  2 lateral incisor  3 canine
#   4 first premolar   5 second premolar
#   6 first molar      7 second molar     8 third molar
# ---------------------------------------------------------------------------
UPPER = {
    1: (0.0086, 0.0072, 0.0105),
    2: (0.0066, 0.0064, 0.0090),
    3: (0.0077, 0.0080, 0.0100),
    4: (0.0071, 0.0092, 0.0085),
    5: (0.0067, 0.0092, 0.0082),
    6: (0.0102, 0.0113, 0.0077),
    7: (0.0098, 0.0112, 0.0074),
    8: (0.0089, 0.0105, 0.0070),
}
LOWER = {
    1: (0.0053, 0.0060, 0.0090),
    2: (0.0059, 0.0065, 0.0093),
    3: (0.0069, 0.0076, 0.0110),
    4: (0.0071, 0.0078, 0.0086),
    5: (0.0071, 0.0082, 0.0080),
    6: (0.0111, 0.0105, 0.0077),
    7: (0.0106, 0.0102, 0.0070),
    8: (0.0099, 0.0098, 0.0068),
}

# Cumulative angle along the arch. Anteriors sit close together near the midline
# and the arch turns sharply at the canine — the "canine eminence" — which is
# what stops a dental arch reading as a semicircle.
ANGLES = {1: 0.13, 2: 0.36, 3: 0.60, 4: 0.83, 5: 1.03, 6: 1.24, 7: 1.42, 8: 1.57}


def place(quadrant, pos, tooth_root, upper):
    """One tooth, at its FDI position on an elliptical arch."""
    dims = (UPPER if upper else LOWER)[pos]
    t = ANGLES[pos]
    # Quadrants 1 and 4 are the patient's RIGHT, which is -X in the head's frame.
    side = -1 if quadrant in (1, 4) else 1
    x = side * ARCH_W * math.sin(t)
    y = -ARCH_D * math.cos(t)          # -Y is forward, toward the lips
    z = 0.0

    name = f"T{quadrant}{pos}"
    yaw = -side * t * 0.35
    # Crowns tilt toward the midline and lean slightly inward; without this the
    # arch reads as a fence of identical posts.
    tooth = box(name, tooth_root, (x, y, z), dims,
                ENAMEL, rot=(0, 0, yaw))

    # Molars and premolars get an occlusal cap, slightly darker, so the biting
    # surface reads as cusped rather than as a flat-topped block.
    if pos >= 4:
        cap_z = dims[2] / 2 * (1 if upper else -1) * 0.82
        box(f"{name}_occ", tooth, (0, 0, cap_z),
            (dims[0] * 0.86, dims[1] * 0.86, dims[2] * 0.22), ENAMEL_DEEP)

    # A gum collar PER TOOTH, at the root end.
    #
    # The first version used one big rectangular slab per arch, which swallowed
    # the whole arch and left the teeth sticking out of its sides. Gingiva
    # follows the arch by definition, so building it from the same placement
    # maths as the teeth makes it follow for free — and it can never again be
    # the wrong shape for an arch it was not measured against.
    collar_z = dims[2] / 2 * (1 if upper else -1) * 0.86
    box(f"{name}_gum", tooth_root, (x, y, z + collar_z),
        (dims[0] * 1.10, dims[1] * 1.10, dims[2] * 0.46),
        GUM if upper else GUM_DARK, rot=(0, 0, yaw))
    return tooth


root = empty("MouthRig")

# The throat: a dark plate behind everything, so an open mouth reads as depth
# rather than as a hole through the head. Sized to the arch, not oversized.
box("Throat", root, (0, 0.016, 0.000), (0.034, 0.003, 0.030), DARK, bevel=False)

# --- upper (maxilla) — fixed to the skull ---------------------------------
upper_root = empty("Maxilla", root, (0, 0, 0.008))
# The palate fills the space INSIDE the arch. It must be narrower than the arch
# or it hides the teeth it is supposed to sit between.
box("PalateVault", upper_root, (0, -0.004, 0.005), (0.030, 0.028, 0.004), PALATE)
for q in (1, 2):
    for pos in range(1, 9):
        place(q, pos, upper_root, upper=True)

# --- lower (mandible) — THIS is what the jaw bone rotates ------------------
# Named `Jaw` so PatientRig's existing lookup (`by('Jaw')`) finds it verbatim
# and `p.jaw.rotation.x = r.jawX + jawOpen * 0.62` survives unchanged.
jaw = empty("Jaw", root, (0, 0.010, -0.004))
# Sits inside the lower arch, below the occlusal plane.
box("Tongue", jaw, (0, -0.006, -0.004), (0.026, 0.028, 0.006), TONGUE)
for q in (3, 4):
    for pos in range(1, 9):
        place(q, pos, jaw, upper=False)
# Lower arch sits below the upper; the jaw pivot is behind and above, at the
# condyle, so rotating it swings the chin down the way a real jaw opens.
jaw.location = (0, 0.010, -0.004)

bpy.ops.export_scene.gltf(
    filepath=OUT + "/mouth.glb",
    export_format="GLB",
    export_apply=False,
    export_yup=True,
)

for o in bpy.data.objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
tris = sum(len(o.data.loop_triangles) for o in bpy.data.objects if o.type == "MESH")
teeth = sorted(o.name for o in bpy.data.objects
               if o.name.startswith("T") and "_occ" not in o.name and len(o.name) == 3)

print("TEETH:", len(teeth))
print("FDI:", ",".join(teeth))
print("TRIS:", tris)
print("MOUTH_OK")
