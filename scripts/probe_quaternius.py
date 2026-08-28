"""
What size is a Quaternius character, really?

    blender --background --python scripts/probe_quaternius.py -- <in.fbx>

The naive answer -- `matrix_world @ bound_box` -- said 4.62 m, which is not a
person. That is the SAME trap the gloved hands hid behind earlier: for a skinned
mesh the object's bounding box describes the geometry as authored, before the
armature deforms it, and the deformation is where the scale lives. Thresholds
applied to raw mesh coordinates are meaningless.

This reads the depsgraph-EVALUATED mesh instead -- the vertices as they will
actually be drawn -- and cross-checks against the head bone's world height,
which is a completely independent measurement. If those two disagree, neither is
trustworthy.
"""

import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC = argv[0]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

if hasattr(bpy.ops.wm, 'fbx_import'):
    bpy.ops.wm.fbx_import(filepath=SRC)
else:
    bpy.ops.import_scene.fbx(filepath=SRC, automatic_bone_orientation=True)

dg = bpy.context.evaluated_depsgraph_get()

for o in bpy.data.objects:
    print('[probe] object %-16s type %-9s scale %s' % (
        o.name, o.type, tuple(round(v, 5) for v in o.scale)))

for m in [o for o in bpy.data.objects if o.type == 'MESH']:
    ev = m.evaluated_get(dg)
    me = ev.to_mesh()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    n = 0
    for v in me.vertices:
        w = ev.matrix_world @ v.co
        n += 1
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
    # Read the counts BEFORE to_mesh_clear, or the struct is gone -- that is a
    # "StructRNA of type Mesh has been removed", not a null.
    tris = len(me.loop_triangles) if me.loop_triangles else len(me.polygons)
    ev.to_mesh_clear()
    print('[probe] EVALUATED %s: %d verts, %d faces' % (m.name, n, tris))
    print('[probe]   min %s' % (tuple(round(v, 4) for v in lo),))
    print('[probe]   max %s' % (tuple(round(v, 4) for v in hi),))
    print('[probe]   SIZE x %.4f y %.4f z %.4f  <- z is standing height' % (
        hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))

for a in [o for o in bpy.data.objects if o.type == 'ARMATURE']:
    print('[probe] armature %s scale %s' % (a.name, tuple(round(v, 5) for v in a.scale)))
    for want in ('Head', 'Hips', 'Foot.L', 'Neck'):
        b = a.data.bones.get(want)
        if b:
            w = a.matrix_world @ b.head_local
            print('[probe]   bone %-8s world z %.4f' % (want, w.z))
    print('[probe]   bones: %s' % ', '.join(sorted(b.name for b in a.data.bones)))
