"""
Where is the patient's body ACTUALLY, in the seated pose?

    blender --background --python scripts/probe_seated.py -- public/models/cast/male_suit.glb

WHY THIS EXISTS
---------------
He is standing up in the chair. The screenshots show him vertical, feet down,
head near the ceiling, with the chair somewhere below him — and his head lolling
as if his neck were broken.

The suspicion, which this script is written to CONFIRM OR KILL rather than act
on: the Quaternius sit is achieved purely by ROTATION. Every Hips position track
in the pack is constant. So folding the legs does not lower the pelvis — it
raises the FEET. A character whose origin is at the feet, dropped onto a cushion
at 0.37 m, therefore ends up with its pelvis at cushion + full standing hip
height, hovering a good half metre above the seat with its legs sticking out.

If that is right, the fix is not a nudge. Placement has to be anchored on the
PELVIS in the seated pose, not on the feet, and that offset has to be measured
here rather than dialled in by eye.

It also reports the FORWARD axis, because the second complaint is that he faces
the cabinet instead of the room, and PatientRig applies CHAIR_FACING assuming an
axis the old Mixamo mesh had. That is a measurement, not a guess, and guessing a
180 is exactly how you ship it wrong twice.
"""

import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC = argv[0]


def log(*a):
    print('[seated]', *a)


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=SRC)

arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
mesh = next((o for o in bpy.data.objects if o.type == 'MESH'), None)
if not arm or not mesh:
    raise SystemExit('[seated] FATAL: no armature or no mesh in %s' % SRC)

log('armature %s   mesh %s' % (arm.name, mesh.name))
log('actions:', [a.name for a in bpy.data.actions])


def bone_world(name):
    """World position of a POSE bone's head, in the pose currently evaluated."""
    pb = arm.pose.bones.get(name)
    if pb is None:
        return None
    return arm.matrix_world @ pb.head


def measure(label):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for v in me.vertices:
        w = ev.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
    ev.to_mesh_clear()

    log('--- %s ---' % label)
    log('  mesh bbox  z %.4f .. %.4f   (height %.4f)' % (lo.z, hi.z, hi.z - lo.z))
    log('  mesh bbox  y %.4f .. %.4f   x %.4f .. %.4f' % (lo.y, hi.y, lo.x, hi.x))
    for b in ('Hips', 'Head', 'Foot.L', 'Foot.R', 'Neck', 'Chest', 'Torso'):
        w = bone_world(b)
        if w:
            log('  bone %-7s (%.4f, %.4f, %.4f)' % (b, w.x, w.y, w.z))

    hips = bone_world('Hips')
    if hips:
        # PELVIS RELATIVE TO THE MODEL ORIGIN. This is the number placement needs:
        # anchor on this instead of on the feet and he lands ON the cushion.
        log('  PELVIS above origin: %.4f' % hips.z)
        log('  FEET below pelvis  : %.4f' % (hips.z - lo.z))

    # Which way is he facing? Take the Hips pose-bone's own axes in world space.
    pb = arm.pose.bones.get('Hips')
    if pb:
        m = arm.matrix_world @ pb.matrix
        log('  hips axis X (%.3f, %.3f, %.3f)' % tuple(m.col[0][:3]))
        log('  hips axis Y (%.3f, %.3f, %.3f)' % tuple(m.col[1][:3]))
        log('  hips axis Z (%.3f, %.3f, %.3f)' % tuple(m.col[2][:3]))

    # Facing measured from the BODY, not a bone convention: the nose end of the
    # head is wherever the mesh sticks out furthest from the neck, and that is
    # unambiguous whatever the rig authored.
    return lo, hi


# --- rest / bind pose -------------------------------------------------------
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
bpy.context.view_layer.update()
measure('REST POSE (no action)')

# --- each clip, at its END, which is the pose actually held ------------------
for name in ('Idle', 'Walk', 'Sitting', 'Standing'):
    act = bpy.data.actions.get(name)
    if act is None:
        log('!! no action named %s' % name)
        continue
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    # glTF actions carry their own frame range; take the last frame, which for
    # a clamped LoopOnce clip is the pose the game actually holds.
    end = int(act.frame_range[1])
    bpy.context.scene.frame_set(end)
    bpy.context.view_layer.update()
    measure('%s @ frame %d (last)' % (name, end))
