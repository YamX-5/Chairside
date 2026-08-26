"""
Build the instrument set.

EVERY instrument's origin is at its GRIP — the point the hand closes around,
with the working tip pointing along -Y (which becomes +Z after the glTF Y-up
conversion, matching the patient and the chair).

That is deliberate and it is the lesson from the chair: if the origin is
arbitrary, every downstream placement becomes a guessed offset, and guessed
offsets are what produced a patient on the floor and a tray through a chin.
With the grip at the origin, "hold this" is parenting to a hand transform and
nothing else.

All instruments are built at the origin, overlapping. The game clones them by
name and positions them; overlap inside the GLB costs nothing.
"""
import sys
import math
import bmesh
import bpy

OUT = sys.argv[sys.argv.index("--") + 1]

# Same reasoning as the chair and the patient: a razor edge catches no light.
# These are small hand-held objects seen close up, so the chamfer is finer.
BEVEL = 0.0035


def bevel_mesh(mesh, offset=BEVEL, segments=1):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.bevel(
        bm,
        geom=list(bm.verts) + list(bm.edges),
        offset=offset,
        segments=segments,
        affect="EDGES",
        clamp_overlap=True,
        profile=0.5,
    )
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

STEEL = 0xC9D0D6
STEEL_DARK = 0x8E9AA3
HANDLE = 0x3E4A57
MIRROR = 0xE8F2F7
BUR = 0xB8BEC4
SYRINGE_BODY = 0xDDE4EA
SYRINGE_FLUID = 0xBFE3D6
WOOD = 0xA87A45
BLADE = 0xD5DBE0
GRIP_RED = 0xB8503F


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
    b.inputs["Roughness"].default_value = 0.6
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.0
    m.diffuse_color = col
    _mats[key] = m
    return m


def box(name, parent, loc, size, colour, rot=(0, 0, 0)):
    sx, sy, sz = size
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    verts = [
        (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
        (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    # Clamped to the smallest dimension: a 1.2 mm needle must not be bevelled
    # out of existence.
    bevel_mesh(me, min(BEVEL, min(sx, sy, sz) * 0.22))
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


def cyl(name, parent, loc, r, d, colour, n=8, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=d, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.clear()
    o.data.materials.append(material(colour))
    for p in o.data.polygons:
        p.use_smooth = False
    if parent:
        o.parent = parent
    return o


def root(name):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    return e


# Handles run along -Y from the grip; tips are further -Y still.
LIE = (math.pi / 2, 0, 0)   # lay a cylinder along Y instead of Z

# --- mirror ----------------------------------------------------------------
m = root("Mirror")
cyl("MirrorHandle", m, (0, -0.05, 0), 0.006, 0.11, HANDLE, rot=LIE)
cyl("MirrorNeck", m, (0, -0.125, 0.006), 0.0035, 0.06, STEEL, rot=(1.25, 0, 0))
cyl("MirrorHead", m, (0, -0.155, 0.021), 0.017, 0.004, MIRROR, n=12, rot=(1.1, 0, 0))

# --- explorer / probe -------------------------------------------------------
p = root("Probe")
cyl("ProbeHandle", p, (0, -0.05, 0), 0.006, 0.11, HANDLE, rot=LIE)
cyl("ProbeShank", p, (0, -0.125, 0.004), 0.0025, 0.055, STEEL, rot=(1.35, 0, 0))
cyl("ProbeTip", p, (0, -0.148, 0.017), 0.0014, 0.028, STEEL_DARK, rot=(0.7, 0, 0))

# --- periodontal probe (banded, for measuring pockets) ----------------------
pp = root("PerioProbe")
cyl("PerioHandle", pp, (0, -0.05, 0), 0.006, 0.11, HANDLE, rot=LIE)
cyl("PerioShank", pp, (0, -0.13, 0.004), 0.0026, 0.07, STEEL, rot=(1.4, 0, 0))
for i in range(4):
    cyl(f"PerioBand{i}", pp, (0, -0.152 - i * 0.008, 0.012), 0.0032, 0.003, STEEL_DARK, rot=LIE)

# --- slow handpiece (the drill) ---------------------------------------------
h = root("Handpiece")
cyl("HandpieceGrip", h, (0, -0.045, 0), 0.011, 0.10, STEEL, rot=LIE)
cyl("HandpieceBody", h, (0, -0.115, 0.004), 0.0135, 0.055, STEEL_DARK, rot=(1.4, 0, 0))
cyl("HandpieceHead", h, (0, -0.145, 0.016), 0.011, 0.022, STEEL, n=10, rot=(1.2, 0, 0))
cyl("Bur", h, (0, -0.152, 0.031), 0.0016, 0.022, BUR, rot=(1.2, 0, 0))
# Hose, so it reads as plugged into the unit rather than a wand.
cyl("HandpieceHose", h, (0, 0.06, -0.004), 0.006, 0.13, HANDLE, rot=(1.62, 0, 0))

# --- syringe (local anaesthetic) --------------------------------------------
s = root("Syringe")
cyl("SyringeBarrel", s, (0, -0.055, 0), 0.011, 0.10, SYRINGE_BODY, rot=LIE)
cyl("SyringeFluid", s, (0, -0.055, 0), 0.008, 0.085, SYRINGE_FLUID, rot=LIE)
cyl("SyringePlunger", s, (0, 0.02, 0), 0.007, 0.05, STEEL, rot=LIE)
box("SyringeThumb", s, (0, 0.048, 0), (0.026, 0.006, 0.026), STEEL)
box("SyringeFinger", s, (0, -0.002, 0), (0.040, 0.006, 0.008), STEEL)
cyl("Needle", s, (0, -0.135, 0), 0.0012, 0.06, STEEL_DARK, rot=LIE)

# --- extraction forceps -----------------------------------------------------
f = root("Forceps")
for side, x in (("L", -1), ("R", 1)):
    box(f"ForcepsArm{side}", f, (x * 0.010, -0.03, 0), (0.010, 0.10, 0.016), STEEL,
        rot=(0, 0, x * 0.10))
    box(f"ForcepsBeak{side}", f, (x * 0.006, -0.105, 0), (0.009, 0.05, 0.012), STEEL_DARK,
        rot=(0, 0, x * -0.18))
cyl("ForcepsHinge", f, (0, -0.078, 0), 0.006, 0.03, STEEL_DARK, n=8, rot=(0, 1.5708, 0))

# --- scaler -----------------------------------------------------------------
sc = root("Scaler")
cyl("ScalerHandle", sc, (0, -0.05, 0), 0.007, 0.11, GRIP_RED, rot=LIE)
cyl("ScalerShank", sc, (0, -0.125, 0.005), 0.0026, 0.055, STEEL, rot=(1.3, 0, 0))
cyl("ScalerTip", sc, (0, -0.146, 0.020), 0.0018, 0.022, STEEL_DARK, rot=(0.55, 0, 0))

# --- suction ----------------------------------------------------------------
su = root("Suction")
cyl("SuctionTube", su, (0, -0.06, 0), 0.008, 0.13, SYRINGE_BODY, rot=LIE)
cyl("SuctionTip", su, (0, -0.14, 0.006), 0.007, 0.05, STEEL, rot=(1.45, 0, 0))
cyl("SuctionHose", su, (0, 0.07, -0.006), 0.009, 0.15, HANDLE, rot=(1.6, 0, 0))

# --- the axe ----------------------------------------------------------------
# Absolutely not a dental instrument. It is on the tray because picking it up
# and being stopped is funnier than never being offered it, and because "wrong
# instrument" is a real error class the game already grades (class D).
a = root("Axe")
cyl("AxeHandle", a, (0, -0.13, 0), 0.011, 0.34, WOOD, rot=LIE)
box("AxeHead", a, (0, -0.30, 0.012), (0.020, 0.075, 0.085), BLADE)
box("AxeEdge", a, (0, -0.335, 0.012), (0.006, 0.012, 0.095), STEEL, rot=(0, 0, 0))

bpy.ops.export_scene.gltf(
    filepath=OUT + "/instruments.glb",
    export_format="GLB",
    export_apply=False,
    export_yup=True,
)

for o in bpy.data.objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
tris = sum(len(o.data.loop_triangles) for o in bpy.data.objects if o.type == "MESH")
roots = [o.name for o in bpy.data.objects if o.type == "EMPTY"]

print("INSTRUMENTS:", ",".join(sorted(roots)))
print("TRIS:", tris)
print("INSTRUMENTS_OK")
