import bpy, sys, os, time, math
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure as M

MODELS = "D:/My Apps/study-game/public/models"
OUT = os.path.dirname(os.path.abspath(__file__))
S = 400

t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=MODELS + "/patient.glb")
pat = set(o.name for o in bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=MODELS + "/dental_chair.glb")
M.touch(); M.unlock_rotation()
M.put_world(bpy.data.objects["Patient"], (0.0, -0.02, 0.46))
M.sync()
print("SETUP_MS %d" % ((time.time() - t0) * 1000))

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
los = [M.aabb(o)[0] for o in meshes]; his = [M.aabb(o)[1] for o in meshes]
lo = Vector((min(v.x for v in los), min(v.y for v in los), min(v.z for v in los)))
hi = Vector((max(v.x for v in his), max(v.y for v in his), max(v.z for v in his)))
ctr = (lo + hi) / 2
span = max(hi - lo)

scn = bpy.context.scene
scn.render.engine = 'BLENDER_WORKBENCH'
sh = scn.display.shading
sh.light = 'STUDIO'; sh.color_type = 'RANDOM'
sh.show_cavity = True; sh.show_object_outline = True
scn.display.render_aa = 'FXAA'
scn.render.resolution_x = scn.render.resolution_y = S
scn.render.film_transparent = False
scn.render.image_settings.file_format = 'PNG'
scn.render.use_stamp = True
for f in ("date", "time", "render_time", "frame", "scene", "camera", "filename", "memory", "hostname"):
    setattr(scn.render, "use_stamp_" + f, False)
scn.render.use_stamp_note = True
scn.render.stamp_note_text = "ortho %.3f m across | grid n/a | FAILS=2" % (span * 1.15)
scn.render.stamp_font_size = 14

cam_d = bpy.data.cameras.new("qa"); cam_d.type = 'ORTHO'
cam_d.ortho_scale = span * 1.15
cam = bpy.data.objects.new("qa", cam_d)
bpy.context.collection.objects.link(cam)
scn.camera = cam

VIEWS = [("BACK", (0, 1, 0)), ("LEFT", (-1, 0, 0)), ("TOP", (0, 0, 1)),
         ("FRONT", (0, -1, 0)), ("RIGHT", (1, 0, 0)), ("HERO", (0.8, -0.9, 0.55))]
tiles, times = [], []
for name, d in VIEWS:
    v = Vector(d).normalized()
    cam.location = ctr + v * (span * 4)
    cam.rotation_euler = (-v).to_track_quat('-Z', 'Y').to_euler()
    M.touch(); M.sync()
    p = os.path.join(OUT, "v_%s.png" % name)
    scn.render.filepath = p
    t = time.time()
    bpy.ops.render.render(write_still=True)
    times.append(int((time.time() - t) * 1000))
    img = bpy.data.images.load(p)
    tiles.append(np.array(img.pixels[:], dtype=np.float32).reshape(S, S, 4))
    bpy.data.images.remove(img)

print("RENDER_MS_PER_VIEW", times)
t = time.time()
sheet = np.concatenate([np.concatenate(tiles[0:3], axis=1),
                        np.concatenate(tiles[3:6], axis=1)], axis=0)
out = bpy.data.images.new("sheet", width=S * 3, height=S * 2, alpha=True)
out.pixels = sheet.ravel().tolist()
out.file_format = 'PNG'
out.filepath_raw = os.path.join(OUT, "contact_sheet.png")
out.save()
print("STITCH_MS %d" % ((time.time() - t) * 1000))
print("TOTAL_MS %d" % ((time.time() - t0) * 1000))
print("SHEET_OK")
