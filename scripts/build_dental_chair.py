"""
Build a dental chair, because the room has been using a lounge recliner.

Origin is at FLOOR level, centred on the pedestal. She is built facing -Y in
Blender (which becomes +Z after the glTF Y-up conversion), exactly like the
patient — so chair and patient take the same rotation in the game and can never
drift out of alignment again.

SEAT_TOP is exported in the printout: it is the number PatientRig needs, and
guessing it is what put her dangling off the front edge of the sofa.
"""
import sys
import bmesh
import bpy

OUT = sys.argv[sys.argv.index("--") + 1]

# Width of the chamfer put on every hard edge, in metres.
#
# This is the single highest-return art change available in a flat-shaded
# low-poly style, and the reason hand-built geometry reads as programmer art
# without it: nothing in the real world has a perfectly sharp edge, so a razor
# edge catches no light and every surface meets its neighbour in a dead line.
# One bevel segment gives each silhouette edge a sliver that picks up the key
# light and separates the faces. A cube goes 12 -> 44 triangles, which at this
# scale is nothing.
BEVEL = 0.006

# --- palette, from src/clinic/theme3d.ts -----------------------------------
UPHOLSTERY = 0x4FA79E   # tealDeep — clinical, matches the room
UPHOLSTERY_HI = 0x6DC5BC
METAL = 0xCFD4D8
METAL_DARK = 0x93A3A6
LIGHT_HEAD = 0xF2F4F6
LIGHT_LENS = 0xFFF6E2
TRAY = 0xDFE4E7

SEAT_TOP = 0.46          # cushion surface height, metres
# MUST match the patient's torso recline (Chest rot -0.24 in build_patient.py).
# At 0.42 the backrest leaned further back than she did and left a visible gap
# behind her shoulders — she looked like she was sitting forward in a deckchair.
BACK_RECLINE = 0.26


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(h):
    r, g, b = ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


bpy.ops.wm.read_factory_settings(use_empty=True)
_mats = {}


def material(hex_value, emissive=False):
    key = f"m_{hex_value:06X}{'_e' if emissive else ''}"
    if key in _mats:
        return _mats[key]
    mat = bpy.data.materials.new(key)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    col = rgba(hex_value)
    bsdf.inputs["Base Color"].default_value = col
    bsdf.inputs["Roughness"].default_value = 0.85
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    if emissive and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = col
        bsdf.inputs["Emission Strength"].default_value = 1.4
    mat.diffuse_color = col
    _mats[key] = mat
    return mat


def bevel_mesh(mesh, offset=BEVEL, segments=1):
    """Chamfer every edge. Skipped when the offset would swallow the shape."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.bevel(
        bm,
        geom=list(bm.verts) + list(bm.edges),
        offset=offset,
        segments=segments,
        affect="EDGES",
        clamp_overlap=True,  # thin parts silently keep their sharp edges
        profile=0.5,
    )
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def box(name, parent, joint, size, colour, centre=None, rot=(0, 0, 0), emissive=False,
        bevel=True):
    sx, sy, sz = size
    cx, cy, cz = centre if centre is not None else (0, 0, 0)
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    verts = [
        (cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz),
        (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
        (cx - hx, cy - hy, cz + hz), (cx + hx, cy - hy, cz + hz),
        (cx + hx, cy + hy, cz + hz), (cx - hx, cy + hy, cz + hz),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    if bevel:
        # Scale the chamfer to the smallest dimension so slim parts (the 2 cm
        # door panel, the 3 cm instruments) do not get eaten by it.
        bevel_mesh(mesh, min(BEVEL, min(sx, sy, sz) * 0.22))
    obj = bpy.data.objects.new(name, mesh)
    obj.location = joint
    obj.rotation_euler = rot
    obj.data.materials.append(material(colour, emissive))
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    for poly in mesh.polygons:
        poly.use_smooth = False
    return obj


def cyl(name, parent, joint, radius, depth, colour, verts_n=10, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts_n, radius=radius, depth=depth,
                                        location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.location = joint
    obj.rotation_euler = rot
    obj.data.materials.clear()
    obj.data.materials.append(material(colour))
    for poly in obj.data.polygons:
        poly.use_smooth = False
    if parent:
        obj.parent = parent
    return obj


root = bpy.data.objects.new("DentalChair", None)
bpy.context.collection.objects.link(root)

# --- pedestal ---------------------------------------------------------------
# Wide flat foot so it reads as a floor-mounted unit rather than furniture.
box("Base", root, (0, 0.05, 0.035), (0.46, 0.66, 0.07), METAL_DARK)
box("Column", root, (0, 0.06, 0.26), (0.24, 0.30, 0.40), METAL)

# --- seat -------------------------------------------------------------------
# The cushion. Its TOP is SEAT_TOP; everything else is measured from here.
SEAT_THICK = 0.11
box("SeatPan", root, (0, -0.02, SEAT_TOP - SEAT_THICK / 2), (0.54, 0.52, SEAT_THICK),
    UPHOLSTERY)

# --- backrest ---------------------------------------------------------------
# Hinged at the BACK edge of the cushion so reclining pivots correctly, which is
# also what lets the chair be laid flat later without rebuilding it.
back = box("Backrest", root, (0, 0.24, SEAT_TOP - 0.04), (0.50, 0.16, 0.82),
           UPHOLSTERY, centre=(0, 0, 0.41), rot=(-BACK_RECLINE, 0, 0))
box("Headrest", back, (0, 0, 0.80), (0.28, 0.14, 0.22), UPHOLSTERY_HI, centre=(0, -0.02, 0.08))

# --- armrests ---------------------------------------------------------------
# Wider than the seat: her shoulders are 0.42 across and her arms hang outside
# the torso, so armrests at +/-0.30 ran straight through them.
for side, x in (("L", -1), ("R", 1)):
    box(f"Armrest{side}", root, (x * 0.345, -0.02, SEAT_TOP + 0.11), (0.07, 0.44, 0.055),
        UPHOLSTERY_HI)
    box(f"ArmPost{side}", root, (x * 0.345, 0.12, SEAT_TOP + 0.03), (0.05, 0.05, 0.11), METAL)

# --- leg rest ---------------------------------------------------------------
# Angled down from the front of the cushion — this is the bit that makes a
# dental chair read as a dental chair rather than a stool.
# Shorter and shallower than the first pass, which ran a 0.62 m slab out past
# her feet at an angle her legs never touched.
box("LegRest", root, (0, -0.26, SEAT_TOP - 0.055), (0.50, 0.48, 0.09),
    UPHOLSTERY, centre=(0, -0.22, 0), rot=(0.34, 0, 0))

# --- operating light --------------------------------------------------------
# Post well BEHIND the backrest, arm reaching forward over her head. Placing the
# post beside the seat put a scaffolding pole through the shot.
cyl("LightPost", root, (0.40, 0.52, 0.90), 0.035, 1.80, METAL)
light_arm = cyl("LightArm", root, (0.40, 0.10, 1.78), 0.03, 0.90, METAL, rot=(1.5708, 0, 0))
head = box("LightHead", root, (0.10, -0.22, 1.66), (0.36, 0.22, 0.09), LIGHT_HEAD,
           rot=(0.55, 0, 0))
box("LightLens", head, (0, 0.02, -0.056), (0.30, 0.16, 0.02), LIGHT_LENS, emissive=True)

# --- delivery unit ----------------------------------------------------------
# Tray over her LAP, at working height — not at face level, where it was
# slicing through her chin.
cyl("TrayPost", root, (-0.46, 0.34, 0.55), 0.03, 1.10, METAL)
# z = 0.74 is over her LAP. At 0.98 it sat exactly at jaw height and sliced
# through her chin — her head is at ~1.05 with the seat at 0.46.
cyl("TrayArm", root, (-0.30, -0.02, 0.78), 0.025, 0.55, METAL, rot=(0, 1.5708, 0))
tray = box("Tray", root, (-0.06, -0.14, 0.74), (0.36, 0.28, 0.03), TRAY)
# Three instruments lying on it, so the tray is not a bare rectangle.
for i, dx in enumerate((-0.11, 0, 0.11)):
    box(f"Instrument{i}", tray, (dx, 0, 0.026), (0.022, 0.20, 0.022), METAL_DARK)

# --- spittoon ---------------------------------------------------------------
# Out to her side, clear of the chair. It was previously floating in her lap.
# Beside her hip and slightly BEHIND, not out in front where it read as
# floating in her lap from every angle a player actually stands at.
cyl("SpittoonArm", root, (0.50, 0.16, 0.42), 0.028, 0.84, METAL)
cyl("SpittoonNeck", root, (0.60, 0.10, 0.82), 0.022, 0.26, METAL, rot=(0.6, 1.5708, 0))
cyl("Spittoon", root, (0.70, 0.02, 0.80), 0.10, 0.07, LIGHT_HEAD, verts_n=12)

bpy.ops.export_scene.gltf(
    filepath=OUT + "/dental_chair.glb",
    export_format="GLB",
    export_apply=False,
    export_yup=True,
)

for o in bpy.data.objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
tris = sum(len(o.data.loop_triangles) for o in bpy.data.objects if o.type == "MESH")
parts = [o.name for o in bpy.data.objects if o.type == "MESH"]

print("PARTS:", len(parts))
print("TRIS:", tris)
# The number PatientRig needs. Printing it beats guessing it.
print("SEAT_TOP:", SEAT_TOP)
print("CHAIR_OK")
