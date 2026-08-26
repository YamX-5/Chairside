"""Render the patient so the head swap can be judged by eye, not by log lines.

Two views: a three-quarter of the whole figure, and a close-up of the head and
neck, because the join is where a head swap goes wrong — a head that is the right
size overall can still float off the neck or sink into the shoulders.
"""
import bpy
import mathutils

OUT = r"D:/My Apps/study-game/blender/renders"

sc = bpy.context.scene
seen = {o.name for o in bpy.data.objects}
bpy.ops.import_scene.gltf(filepath=r"D:/My Apps/study-game/public/models/patient.glb")
fresh = [o for o in bpy.data.objects if o.name not in seen]
meshes = [o for o in fresh if o.type == "MESH"]
if not meshes:
    raise SystemExit("nothing imported")
print(f"{len(meshes)} meshes, {sum(len(m.data.polygons) for m in meshes)} faces")

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
s = hi - lo
print(f"figure {s.x:.3f} x {s.y:.3f} x {s.z:.3f} m, top at z {hi.z:.3f}")

try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = 700
sc.render.resolution_y = 800
sc.render.film_transparent = False
if not sc.world:
    sc.world = bpy.data.worlds.new("W")
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.42, 0.44, 0.48, 1)
    bg.inputs[1].default_value = 1.3

key = bpy.data.objects.get("PtKey")
if not key:
    key = bpy.data.objects.new("PtKey", bpy.data.lights.new("PtKey", "AREA"))
    sc.collection.objects.link(key)
key.data.energy = 420
key.data.size = 3
key.location = (1.6, -2.2, 2.4)
key.rotation_euler = (0.75, 0, 0.62)
key.hide_render = False

cam = bpy.data.objects.get("PtCam")
if not cam:
    cam = bpy.data.objects.new("PtCam", bpy.data.cameras.new("PtCam"))
    sc.collection.objects.link(cam)
cam.data.lens = 60
tgt = bpy.data.objects.get("PtTgt")
if not tgt:
    tgt = bpy.data.objects.new("PtTgt", None)
    sc.collection.objects.link(tgt)
for c in list(cam.constraints):
    cam.constraints.remove(c)
tc = cam.constraints.new("TRACK_TO")
tc.target = tgt
tc.track_axis = "TRACK_NEGATIVE_Z"
tc.up_axis = "UP_Y"
sc.camera = cam

for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = o not in meshes
    if o.type == "LIGHT" and o.name != "PtKey":
        o.hide_render = True

c = (lo + hi) / 2
for name, target, dist in (
    ("patient_full", c, max(s) * 1.5),
    # The join: frame the top 0.45 m, which is head and shoulders.
    ("patient_head", mathutils.Vector((c.x, c.y, hi.z - 0.22)), 0.75),
):
    tgt.location = target
    cam.location = (target.x + dist * 0.42, target.y - dist * 0.85, target.z + dist * 0.16)
    sc.render.filepath = rf"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)
    print(f"rendered {name}")
