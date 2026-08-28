"""
Make the first-person hands smaller and thinner, in the mesh.

    blender --background --python scripts/bl_hands_slim.py -- <in.glb> <out.glb> [thickness] [width]

WHY IN THE MESH AND NOT AS A SCALE
----------------------------------
HAND_LENGTH already scales the whole hand uniformly, and turning it down makes a
small CHUBBY hand — the proportions are unchanged, so it reads as a child's fist
rather than a slim one. The reference Yaman gave (the low-poly hands in "How To
Fish") are slim: long thin fingers, a flat palm, very little depth.

Thinness is a proportion, so it has to be done to the geometry. This squashes the
mesh on its own thinnest axis, about the palm centre, and narrows it slightly
across the knuckles — leaving LENGTH alone, because length is what HAND_LENGTH
owns and having two things scale it is how numbers end up disagreeing.

The axes are MEASURED, not assumed: the thin axis is whichever of the three has
the smallest extent, the long axis the largest. A re-export of the source with a
different orientation therefore cannot silently squash the fingers instead.
"""

import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]
THICK = float(argv[2]) if len(argv) > 2 else 0.74
WIDE = float(argv[3]) if len(argv) > 3 else 0.90


def log(*a):
    print('[slim]', *a)


# Clear EVERYTHING. select_all + delete leaves hidden objects behind, and this
# Blender's startup scene contributes an Icosphere that would be exported into
# the hands.
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

def glb_node_names(path):
    """Node names straight out of the .glb's own JSON chunk.

    THIS BLENDER INJECTS AN OBJECT ON EVERY glTF IMPORT — an Icosphere, from an
    add-on or the startup file. It survives clearing the scene beforehand
    because it does not exist yet, and it is 2.0 units across, so it DOMINATED
    the measured bounds: the first run of this script scaled the hands against
    the sphere's box and wrote a corrupt hands.glb. (Restored from backup; the
    shipped file is clean, 29 nodes and 2 meshes, read from the raw JSON.)

    So the only trustworthy answer to "what is in this file" is the file. Anything
    the importer leaves behind that the glTF does not name gets deleted.
    """
    import json
    import struct
    d = open(path, 'rb').read()
    ln = struct.unpack('<I', d[12:16])[0]
    js = json.loads(d[20:20 + ln].decode('utf-8'))
    return {n.get('name', '') for n in js.get('nodes', [])}


wanted = glb_node_names(SRC)
bpy.ops.import_scene.gltf(filepath=SRC)
for o in list(bpy.data.objects):
    if o.name not in wanted:
        log('dropping %r — not a node in the .glb' % o.name)
        bpy.data.objects.remove(o, do_unlink=True)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if not meshes:
    raise SystemExit('[slim] FATAL: no mesh in %s' % SRC)

# The hand is the SKINNED mesh. The cuff rides with it and must be squashed by
# exactly the same amount or it stops meeting the wrist.
skinned = [o for o in meshes if any(m.type == 'ARMATURE' for m in o.modifiers)]
log('meshes %s   skinned %s' % ([o.name for o in meshes], [o.name for o in skinned]))

targets = meshes  # cuff included, deliberately


def bounds(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    return lo, hi


lo, hi = bounds(targets)
size = hi - lo
log('before  x %.4f  y %.4f  z %.4f' % (size.x, size.y, size.z))

order = sorted(range(3), key=lambda i: size[i])
thin_axis, mid_axis, long_axis = order[0], order[1], order[2]
log('thin axis %d, width axis %d, length axis %d (measured, not assumed)'
    % (thin_axis, mid_axis, long_axis))

centre = (lo + hi) / 2

# Scale about the palm centre so the hand thins in place rather than drifting
# off the wrist. Vertices are edited in WORLD space and written back through the
# inverse of the object matrix, so an object with its own transform stays put.
for o in targets:
    inv = o.matrix_world.inverted()
    for v in o.data.vertices:
        w = o.matrix_world @ v.co
        w[thin_axis] = centre[thin_axis] + (w[thin_axis] - centre[thin_axis]) * THICK
        w[mid_axis] = centre[mid_axis] + (w[mid_axis] - centre[mid_axis]) * WIDE
        v.co = inv @ w
    o.data.update()

lo2, hi2 = bounds(targets)
size2 = hi2 - lo2
log('after   x %.4f  y %.4f  z %.4f' % (size2.x, size2.y, size2.z))
log('thickness %.4f -> %.4f (%.0f%%)' % (size[thin_axis], size2[thin_axis], 100 * THICK))
log('width     %.4f -> %.4f (%.0f%%)' % (size[mid_axis], size2[mid_axis], 100 * WIDE))
log('length    %.4f -> %.4f (UNCHANGED, HAND_LENGTH owns it)'
    % (size[long_axis], size2[long_axis]))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_skins=True,
    export_yup=True,
    export_apply=False,
)
log('wrote', DST)
