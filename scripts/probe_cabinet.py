"""
Where is the INSIDE of the glass cabinet, in game coordinates?

    blender --background --python scripts/probe_cabinet.py -- public/models/props/closet.glb

Two things are in the wrong place and neither can be fixed by eye:

  - The first-aid kit renders on the wall OUTSIDE the cabinet.
  - The axe is laid along the cabinet's DEPTH rather than its width, so it
    overhangs the shelf and pokes through the closed doors.

Both were placed from CABINET_SHELF, which carries a shelf height and a span but
no INTERIOR box — nothing said how deep the usable space is or where its walls
are, so "inside the cabinet" was a guess both times.

This prints, per shelf, the usable interior box in the PROP'S OWN local frame and
in GAME axes (x right, y up, z toward the viewer; blender (x,y,z) -> (x,z,-y)).
The prop is yawed -PI/2 in the room, so its local X runs along world Z — which is
exactly the confusion that put the axe across the shelf instead of along it.
"""

import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC = argv[0]


def log(*a):
    print('[cab]', *a)


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=SRC)

dg = bpy.context.evaluated_depsgraph_get()


def game_box(o):
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    if not me.vertices:
        ev.to_mesh_clear()
        return None
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for v in me.vertices:
        w = ev.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
    ev.to_mesh_clear()
    # blender (x, y, z) -> game (x, z, -y)
    return Vector((lo.x, lo.z, -hi.y)), Vector((hi.x, hi.z, -lo.y))


parts = {}
for o in [x for x in bpy.data.objects if x.type == 'MESH']:
    b = game_box(o)
    if b:
        parts[o.name] = b

for name in sorted(parts):
    glo, ghi = parts[name]
    log(
        '%-40s x %7.3f..%7.3f  y %6.3f..%6.3f  z %7.3f..%7.3f'
        % (name, glo.x, ghi.x, glo.y, ghi.y, glo.z, ghi.z)
    )

# The interior is bounded by the carcass: Left/Right are the SIDES, Back is the
# back, Bottom is the floor. Shelves sit inside it.
log('--- derived interior ---')
side_names = [n for n in parts if 'Left_' in n or 'Right_' in n]
back = [n for n in parts if '__Back_' in n]
shelves = sorted(n for n in parts if 'Shelf' in n)

if side_names and back:
    lo_x = max(parts[n][1].x for n in side_names if parts[n][1].x < 0) if any(parts[n][1].x < 0 for n in side_names) else None
    log('sides: %s' % side_names)
    log('back : %s' % back)
log('shelves (%d): %s' % (len(shelves), shelves))
for n in shelves:
    glo, ghi = parts[n]
    log(
        '  %-38s TOP SURFACE y %.4f   x %7.3f..%7.3f  z %7.3f..%7.3f'
        % (n, ghi.y, glo.x, ghi.x, glo.z, ghi.z)
    )
