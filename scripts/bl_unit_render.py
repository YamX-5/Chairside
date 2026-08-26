"""Render the dental unit with candidate nodes picked out in colour.

The probe gives boxes; boxes do not tell you which part is the handpiece holder
and which is the tray arm. Colouring the candidates and looking at them does.

Renders the most recently imported dental_chair copy, so run bl_unit_probe.py
first. Highlighted nodes come from HIGHLIGHT below — edit and re-run to test a
different guess.
"""
import bpy
import mathutils

HIGHLIGHT = {
    "Object_15": (0.90, 0.10, 0.10, 1),  # wide bar across the front
    "Object_5": (0.10, 0.80, 0.20, 1),   # small upright, front centre
    "Object_16": (0.10, 0.30, 0.95, 1),  # thin stub, far left
    "Object_17": (0.95, 0.80, 0.10, 1),  # tiny cap above it
    "Object_14": (0.85, 0.20, 0.85, 1),  # known: the bracket tray
}

# Import our own copy and work on exactly that.
#
# Picking the "newest" copy out of a scene by name suffix does not work: repeated
# imports produce a MIX of suffixes (.002 on some nodes, .004 on others) because
# each name is deduplicated independently. Taking the highest matched one mesh
# out of fourteen. A before/after set difference is exact.
before = {o.name for o in bpy.data.objects}
bpy.ops.import_scene.gltf(filepath=r"D:/My Apps/study-game/public/models/dental_chair.glb")
unit = [o for o in bpy.data.objects if o.name not in before and o.type == "MESH"]
if not unit:
    raise SystemExit("nothing imported")
print(f"{len(unit)} meshes imported")


def mat(name, colour, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = colour
    b.inputs["Roughness"].default_value = rough
    return m


plain = mat("UnitPlain", (0.62, 0.64, 0.66, 1), 0.6)
for o in unit:
    o.data.materials.clear()
    picked = next((k for k in HIGHLIGHT if f"{k}." in o.name or o.name.endswith(k)), None)
    o.data.materials.append(mat(f"hl_{picked}", HIGHLIGHT[picked], 0.35) if picked else plain)
    if picked:
        print(f"  highlighted {o.name} as {picked}")

# --- studio, built here rather than assumed ----------------------------------
sc = bpy.context.scene
try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = 900
sc.render.resolution_y = 700
sc.render.film_transparent = False
if not sc.world:
    sc.world = bpy.data.worlds.new("Studio")
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.30, 0.32, 0.36, 1)
    bg.inputs[1].default_value = 1.2

for name, energy, loc, rot in (
    ("UnitKey", 400, (2.0, -2.4, 2.6), (0.8, 0.1, 0.62)),
    ("UnitFill", 120, (-2.2, -1.8, 1.4), (1.15, 0, -0.9)),
):
    li = bpy.data.objects.get(name)
    if not li:
        li = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        sc.collection.objects.link(li)
    li.data.energy = energy
    li.data.size = 2.5
    li.location = loc
    li.rotation_euler = rot
    li.hide_render = False

cam = bpy.data.objects.get("Cam")
if not cam:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    sc.collection.objects.link(cam)
cam.data.lens = 50
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

for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = o not in unit
    if o.type == "LIGHT" and o.name not in {"UnitKey", "UnitFill"}:
        o.hide_render = True

dg = bpy.context.evaluated_depsgraph_get()
lo = mathutils.Vector((1e9, 1e9, 1e9))
hi = mathutils.Vector((-1e9, -1e9, -1e9))
for o in unit:
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    for v in me.vertices:
        w = ev.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
    ev.to_mesh_clear()
c = (lo + hi) / 2
tgt.location = c
d = max(hi - lo) * 1.5

# Two angles: the operator's side, and from above the patient looking down at
# where the handpieces should hang.
for name, loc in (
    ("unit_side", (c.x + d * 0.55, c.y - d * 0.75, c.z + d * 0.30)),
    ("unit_top", (c.x + d * 0.25, c.y - d * 0.45, c.z + d * 0.85)),
):
    cam.location = loc
    sc.render.filepath = rf"D:/My Apps/study-game/blender/renders/{name}.png"
    bpy.ops.render.render(write_still=True)
    print(f"rendered {name}")
