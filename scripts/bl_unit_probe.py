"""Find the handpiece holders on the dental unit, by measuring the model.

The handpieces render ABOVE the unit instead of sitting in their holders. That is
a placement number, and placement numbers on this project are measured off the
asset rather than typed — the bracket tray, the seat cushion and the shelf boards
were all got wrong once by guessing, and each was fixed by reading the mesh.

Imports public/models/dental_chair.glb on its own and reports every node with its
world box, so the holder geometry can be identified by size and position instead
of by hoping a node is helpfully named.
"""
import bpy
import mathutils

MARK = r"D:/My Apps/study-game/blender/.before"
GLB = r"D:/My Apps/study-game/public/models/dental_chair.glb"

before = {o.name for o in bpy.data.objects}
bpy.ops.import_scene.gltf(filepath=GLB)
fresh = [o for o in bpy.data.objects if o.name not in before and o.type == "MESH"]
print(f"imported {len(fresh)} meshes")

dg = bpy.context.evaluated_depsgraph_get()
rows = []
for o in fresh:
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    if not me.vertices:
        ev.to_mesh_clear()
        continue
    lo = mathutils.Vector((1e9, 1e9, 1e9))
    hi = mathutils.Vector((-1e9, -1e9, -1e9))
    for v in me.vertices:
        w = ev.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
    # Read everything off the mesh BEFORE freeing it — to_mesh_clear invalidates
    # the datablock, and touching it afterwards raises "StructRNA has been
    # removed" rather than returning stale data.
    faces = len(me.polygons)
    ev.to_mesh_clear()
    s = hi - lo
    rows.append((o.name, lo, hi, s, faces))

# glTF is Y-up, Blender is Z-up: the importer rotates, so Blender Z is game Y and
# Blender -Y is game Z. Report in GAME axes so the numbers drop straight into
# layout.ts without a second conversion step.
def game(v):
    return (v.x, v.z, -v.y)


rows.sort(key=lambda r: -r[1].z)
print(f"{'node':28s} {'game x':>16s} {'game y':>16s} {'game z':>16s}   size")
for name, lo, hi, s, _ in rows:
    glo, ghi = game(lo), game(hi)
    xr = f"{min(glo[0], ghi[0]):.3f}..{max(glo[0], ghi[0]):.3f}"
    yr = f"{min(glo[1], ghi[1]):.3f}..{max(glo[1], ghi[1]):.3f}"
    zr = f"{min(glo[2], ghi[2]):.3f}..{max(glo[2], ghi[2]):.3f}"
    print(f"{name[:28]:28s} {xr:>16s} {yr:>16s} {zr:>16s}   "
          f"{s.x:.3f}x{s.z:.3f}x{s.y:.3f}")

# Candidates: small, tall-ish parts sitting high on the unit are holders/hoses.
print("\nnodes above game y 0.8, small footprint — holder candidates:")
for name, lo, hi, s, _ in rows:
    glo, ghi = game(lo), game(hi)
    top = max(glo[1], ghi[1])
    footprint = max(s.x, s.y)
    if top > 0.8 and footprint < 0.35:
        print(f"  {name[:30]:30s} top y {top:.3f}  footprint {footprint:.3f}  "
              f"x {min(glo[0], ghi[0]):.3f}..{max(glo[0], ghi[0]):.3f}  "
              f"z {min(glo[2], ghi[2]):.3f}..{max(glo[2], ghi[2]):.3f}")
