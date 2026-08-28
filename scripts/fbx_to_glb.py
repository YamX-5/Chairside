"""
Quaternius FBX -> game-ready GLB, run in a FRESH background Blender per file.

    blender --background --python scripts/fbx_to_glb.py -- <in.fbx> <out.glb>

WHY BACKGROUND AND NOT THE SOCKET
---------------------------------
The blender-mcp socket addon shares one process with the open GUI scene, which
by this point holds 278 objects. Importing eight characters into it means
clearing datablocks between runs, and clearing datablocks is what crashed
Blender repeatedly earlier — not on the clear itself, on the NEXT import, which
made it look like connecting was the problem. A fresh process per file has no
residue to clear and cannot corrupt the scene that is open.

WHAT IT KEEPS
-------------
Of the eleven animations in the pack, four: Idle, Walk, Sitting, Standing. That
is the patient's whole life in this game — she walks in, sits, waits, stands up
and leaves. Clapping, Death, Punch, SwordSlash, Jump, RunningJump and Run are
dropped, which is most of the animation data in the file.

They are renamed on the way out. The FBX names them "HumanArmature|Female_Walk";
the game asks for "Walk" and should not have to know which pack or which sex the
mesh came from.
"""

import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]

# The four beats the clinic actually plays, in the order they happen.
KEEP = ('Idle', 'Walk', 'Sitting', 'Standing')


def log(*a):
    print('[fbx2glb]', *a)


# --- start from nothing -----------------------------------------------------
# --background gives us the default cube/camera/light. They would be exported.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# --- import -----------------------------------------------------------------
# Blender 5.x ships a new C++ importer (wm.fbx_import) alongside the old Python
# one (import_scene.fbx). Which exists depends on the build, so try both rather
# than pinning a version.
if hasattr(bpy.ops.wm, 'fbx_import'):
    bpy.ops.wm.fbx_import(filepath=SRC)
    log('imported via wm.fbx_import')
else:
    bpy.ops.import_scene.fbx(filepath=SRC, automatic_bone_orientation=True)
    log('imported via import_scene.fbx')

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
log('meshes', [o.name for o in meshes])
log('armatures', [(o.name, len(o.data.bones)) for o in arms])

# --- measure, before anything is touched ------------------------------------
# The number that matters is standing height in metres. Everything about the
# patient's placement -- the seat, the eye line, where the operator's hands
# reach -- is authored against a real human, so a character imported at 100x
# would not look wrong so much as be absent from frame.
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for m in meshes:
    for c in m.bound_box:
        w = m.matrix_world @ Vector(c)
        lo = Vector((min(lo[i], w[i]) for i in range(3)))
        hi = Vector((max(hi[i], w[i]) for i in range(3)))
size = hi - lo
log('bounds min %s max %s' % (tuple(round(v, 4) for v in lo), tuple(round(v, 4) for v in hi)))
log('SIZE x %.4f y %.4f z %.4f (blender Z is up)' % (size.x, size.y, size.z))

# --- actions ----------------------------------------------------------------
actions = list(bpy.data.actions)
log('actions in file:', [a.name for a in actions])

renamed = {}
for a in actions:
    # "HumanArmature|Female_Walk" -> "Walk". Split on the armature separator
    # first, then drop the sex prefix, so male and female files produce the same
    # four clip names and the game never has to branch on which mesh it loaded.
    tail = a.name.split('|')[-1]
    # Strip whatever prefix the pack uses. The women's pack says "Female_Walk"
    # and the men's says "Man_Walk" -- a hardcoded pair of prefixes silently
    # matched neither for the men, and the run failed loudly, which is the only
    # reason that was caught rather than shipping four empty male GLBs.
    if '_' in tail:
        tail = tail.split('_', 1)[1]
    if tail in KEEP:
        a.name = tail
        a.use_fake_user = True  # or the exporter cannot see an unassigned action
        renamed[tail] = a
    else:
        bpy.data.actions.remove(a)

missing = [k for k in KEEP if k not in renamed]
if missing:
    raise SystemExit('[fbx2glb] FATAL: %s has no %s animation' % (SRC, missing))
log('kept', sorted(renamed))

# --- export -----------------------------------------------------------------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    # One glTF animation per action, which is what three's AnimationMixer wants:
    # clips it can cross-fade by name. The default here bakes the whole timeline
    # into a single clip, and the patient would walk, sit, wait and stand up in
    # one unstoppable four-minute take.
    export_animation_mode='ACTIONS',
    export_skins=True,
    export_yup=True,
    export_apply=False,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
)
log('wrote', DST)
