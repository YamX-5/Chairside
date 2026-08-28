"""
How many handpieces are on the delivery bar, and where is each one?

    blender --background --python scripts/probe_handpieces.py -- public/models/dental_chair.glb

The whole bar ships as ONE mesh — dental_unit__Object_15, 18,338 vertices — so
there is no node per handpiece to hang a click target on, and the game has a
single invisible 1.102 m box over the lot. "I cannot actually hold any of it";
about eight of them, four a side.

Separating by LOOSE PARTS is how you recover the individual holders from a merged
mesh: each handpiece is its own connected island of geometry, whatever the
exporter named it. This reports every island big enough to be a tool, in the
GAME's axes, so each one can get its own target sized from the model.

Islands are sorted along X — the way they sit on the bar — so the output reads
left to right exactly as the player sees them.
"""

import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC = argv[0]
TARGET = 'dental_unit__Object_15'


def log(*a):
    print('[hp]', *a)


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=SRC)

obj = bpy.data.objects.get(TARGET)
if obj is None:
    names = [o.name for o in bpy.data.objects if o.type == 'MESH']
    raise SystemExit('[hp] FATAL: no %s. meshes: %s' % (TARGET, names))

# Everything else out of the way, so separate() cannot touch it.
for o in list(bpy.data.objects):
    if o is not obj:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.context.view_layer.objects.active = obj
obj.select_set(True)

# SEPARATE BY LOOSE PARTS. Edit mode is required; it is safe here because this is
# a fresh --background process with one object in it, not the shared GUI scene.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')

parts = [o for o in bpy.data.objects if o.type == 'MESH']
log('%d loose parts' % len(parts))

dg = bpy.context.evaluated_depsgraph_get()
rows = []
for o in parts:
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    if not me.vertices:
        ev.to_mesh_clear()
        continue
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for v in me.vertices:
        w = ev.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
    n = len(me.vertices)
    ev.to_mesh_clear()

    # blender (x, y, z) -> game (x, z, -y)
    glo = Vector((lo.x, lo.z, -hi.y))
    ghi = Vector((hi.x, hi.z, -lo.y))
    size = ghi - glo
    rows.append((o.name, n, glo, ghi, size))

# Left to right along the bar, which is the game's X.
rows.sort(key=lambda r: r[2].x)

BIG = 0.03  # anything under 30 mm in every direction is a screw, not a tool
log('--- islands at least %d mm across ---' % int(BIG * 1000))
for name, n, glo, ghi, size in rows:
    if max(size) < BIG:
        continue
    log(
        '%-30s %6d v  x %7.3f..%7.3f  y %6.3f..%6.3f  z %7.3f..%7.3f  '
        'size %.3f x %.3f x %.3f  centre (%.3f, %.3f, %.3f)'
        % (
            name, n, glo.x, ghi.x, glo.y, ghi.y, glo.z, ghi.z,
            size.x, size.y, size.z,
            (glo.x + ghi.x) / 2, (glo.y + ghi.y) / 2, (glo.z + ghi.z) / 2,
        )
    )

small = sum(1 for r in rows if max(r[4]) < BIG)
log('(%d islands smaller than %d mm not listed)' % (small, int(BIG * 1000)))
