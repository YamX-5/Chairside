"""Render any prop from four sides, so its FRONT can be identified by eye.

Which way a prop faces is not in its bounding box — a square cabinet looks the
same from every side to a measurement. The sterilisation cart is exactly that
case: 0.843 m square, and the only way to know which face carries the chamber
door is to look at it.

Reads the prop name from blender/.orbit so the caller can pick one without
regenerating this file. Views are labelled by the GAME axis the camera sits on,
so the answer converts straight into a yaw.
"""
import bpy
import math
import mathutils

try:
    with open(r"D:/My Apps/study-game/blender/.orbit", encoding="utf8") as fh:
        PROP = fh.read().strip()
except OSError:
    PROP = "eto_sterilizer"

PATH = rf"D:/My Apps/study-game/public/models/props/{PROP}.glb"

before = {o.name for o in bpy.data.objects}
bpy.ops.import_scene.gltf(filepath=PATH)
fresh = [o for o in bpy.data.objects if o.name not in before]
meshes = [o for o in fresh if o.type == "MESH"]
if not meshes:
    raise SystemExit(f"nothing imported from {PATH}")
print(f"{PROP}: {len(meshes)} meshes")

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
c = (lo + hi) / 2
size = hi - lo
print(f"  {size.x:.3f} x {size.y:.3f} x {size.z:.3f} m")

sc = bpy.context.scene
try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = 500
sc.render.resolution_y = 600
sc.render.film_transparent = False
if not sc.world:
    sc.world = bpy.data.worlds.new("W")
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.38, 0.40, 0.44, 1)
    bg.inputs[1].default_value = 1.5

key = bpy.data.objects.get("OrbitKey")
if not key:
    key = bpy.data.objects.new("OrbitKey", bpy.data.lights.new("OrbitKey", "AREA"))
    sc.collection.objects.link(key)
key.data.energy = 300
key.data.size = 4
key.location = (c.x + 2, c.y - 2, c.z + 2.5)
key.rotation_euler = (0.7, 0, 0.6)
key.hide_render = False

cam = bpy.data.objects.get("OrbitCam")
if not cam:
    cam = bpy.data.objects.new("OrbitCam", bpy.data.cameras.new("OrbitCam"))
    sc.collection.objects.link(cam)
cam.data.lens = 50
tgt = bpy.data.objects.get("OrbitTgt")
if not tgt:
    tgt = bpy.data.objects.new("OrbitTgt", None)
    sc.collection.objects.link(tgt)
tgt.location = c
for cn in list(cam.constraints):
    cam.constraints.remove(cn)
tc = cam.constraints.new("TRACK_TO")
tc.target = tgt
tc.track_axis = "TRACK_NEGATIVE_Z"
tc.up_axis = "UP_Y"
sc.camera = cam

for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = o not in meshes
    if o.type == "LIGHT" and o.name != "OrbitKey":
        o.hide_render = True

d = max(size) * 2.1
# Blender is Z-up and the game is Y-up, so the game's +Z (toward the door) is
# Blender's -Y. Each view is named for the GAME axis the camera stands on.
views = {
    "gameZpos": (c.x, c.y - d, c.z + d * 0.18),
    "gameZneg": (c.x, c.y + d, c.z + d * 0.18),
    "gameXpos": (c.x + d, c.y, c.z + d * 0.18),
    "gameXneg": (c.x - d, c.y, c.z + d * 0.18),
}
for name, loc in views.items():
    cam.location = loc
    sc.render.filepath = rf"D:/My Apps/study-game/blender/renders/orbit_{PROP}_{name}.png"
    bpy.ops.render.render(write_still=True)
    print(f"  rendered {name}")
