"""
A STATIC Quaternius prop, FBX -> GLB, in a fresh background Blender.

    blender --background --python scripts/fbx_prop_to_glb.py -- <in.fbx> <out.glb> [metres]

Separate from fbx_to_glb.py on purpose. That script REQUIRES four named animation
clips and aborts without them, which is right for a character and nonsense for an
axe. Bolting a mode flag onto it would mean the character path could silently
take the prop branch, and this project has been bitten enough times by a check
that quietly did not run.

If `metres` is given, the prop is scaled so its LONGEST dimension is that many
metres and the transform is applied, so the GLB is in real-world units and needs
no runtime scale. Static props have no armature and no animation, so applying a
scale here is safe — the reason the characters are scaled at runtime instead is
that rescaling an armature means rescaling every location f-curve with it.
"""

import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]
TARGET = float(argv[2]) if len(argv) > 2 else None


def log(*a):
    print('[prop]', *a)


def bounds():
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for m in [o for o in bpy.data.objects if o.type == 'MESH']:
        for c in m.bound_box:
            w = m.matrix_world @ Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    return lo, hi


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

if hasattr(bpy.ops.wm, 'fbx_import'):
    bpy.ops.wm.fbx_import(filepath=SRC)
else:
    bpy.ops.import_scene.fbx(filepath=SRC)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
log('meshes', [o.name for o in meshes])
if not meshes:
    raise SystemExit('[prop] FATAL: %s imported no mesh' % SRC)

lo, hi = bounds()
size = hi - lo
log('imported size x %.4f y %.4f z %.4f' % (size.x, size.y, size.z))

if TARGET:
    longest = max(size)
    if longest <= 0:
        raise SystemExit('[prop] FATAL: %s has zero size' % SRC)
    k = TARGET / longest
    log('scaling by %.5f so the longest side is %.3f m' % (k, TARGET))
    for o in bpy.data.objects:
        if o.parent is None:
            o.scale = o.scale * k
    bpy.context.view_layer.update()

    # Apply it, so the GLB carries no object-level scale for the runtime to
    # rediscover. Selection must be explicit: transform_apply acts on selected
    # objects, and --background starts with nothing selected.
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    lo, hi = bounds()
    size = hi - lo
    log('FINAL size x %.4f y %.4f z %.4f' % (size.x, size.y, size.z))

# GROUND IT. propScale.test asserts every prop's base sits at y 0, and it is
# right to: a prop whose origin is buried in the middle of its own mesh has to be
# nudged by hand at every placement, and that nudge is exactly the kind of number
# that ends up living in two files and disagreeing with itself.
#
# Quaternius authors these centred, so the axe arrived 176 mm below its origin
# and the test failed on the first run rather than after someone noticed an axe
# sunk into a shelf.
log('base at z %.4f before grounding' % lo.z)
if abs(lo.z) > 1e-6:
    for o in bpy.data.objects:
        if o.parent is None:
            o.location.z -= lo.z
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    lo, hi = bounds()
    log('base at z %.4f after grounding' % lo.z)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format='GLB',
    use_selection=True,
    export_animations=False,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
)
log('wrote', DST)
