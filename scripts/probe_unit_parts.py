"""
What is actually ON the dental unit, and where?

    blender --background --python scripts/probe_unit_parts.py -- public/models/dental_chair.glb

"when I touch any handpiece, either the high speed, low speed, or the water pump,
the little one, I cannot actually hold any of it" — and there are about eight of
them, four a side.

The code has ONE click target: a single invisible 1.102 x 0.178 x 0.173 m box
over the whole delivery bar. So seven of the eight could never be touched even in
principle, and the one that could is a metre-wide slab that answers for a large
arc around the unit and then hands you a DIFFERENT tool — the one it gives you is
instruments.glb's `Handpiece` node, while what you see on the bar is this file's
geometry, which never disappears.

This lists every mesh with its own world box so each holder can get its own
target, sized and placed from the model rather than from a guess.

Prints in the GAME's axes (x right, y up, z toward the viewer), because that is
what layout.ts is written in: blender (x, y, z) -> game (x, z, -y).
"""

import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC = argv[0]


def log(*a):
    print('[unit]', *a)


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=SRC)

dg = bpy.context.evaluated_depsgraph_get()
rows = []
for o in [x for x in bpy.data.objects if x.type == 'MESH']:
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

    # blender -> game axes
    glo = Vector((lo.x, lo.z, -hi.y))
    ghi = Vector((hi.x, hi.z, -lo.y))
    size = ghi - glo
    rows.append((o.name, n, glo, ghi, size))

rows.sort(key=lambda r: -r[4].length)
log('%d meshes' % len(rows))
for name, n, glo, ghi, size in rows:
    log(
        '%-34s %6d v  game x %7.3f..%7.3f  y %6.3f..%6.3f  z %7.3f..%7.3f  '
        'size %.3f x %.3f x %.3f'
        % (name, n, glo.x, ghi.x, glo.y, ghi.y, glo.z, ghi.z, size.x, size.y, size.z)
    )
