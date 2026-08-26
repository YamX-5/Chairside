"""Open the saved operatory and report what came in."""
import bpy
import os

PATH = r"D:/My Apps/study-game/blender/operatory.blend"

if not os.path.exists(PATH):
    raise SystemExit("MISSING: " + PATH)

bpy.ops.wm.open_mainfile(filepath=PATH)

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
tags = sorted({o.name.split("__")[0] for o in meshes if "__" in o.name})
print(f"opened {os.path.basename(PATH)}")
print(f"  {len(bpy.data.objects)} objects, {len(meshes)} meshes, {len(bpy.data.materials)} materials")
print("  props in the scene: " + ", ".join(tags))
