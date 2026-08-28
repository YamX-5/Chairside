"""
Render the clinic AS THE CODE DESCRIBES IT, from scene.json.

    npx tsx scripts/emit_scene.mts > scene.json
    blender --background --python scripts/bl_scene_render.py -- scene.json out/

WHY
---
Several fixes this session were verified by measurement, passed every test, and
were still wrong on screen: a patient standing in the chair, a patient walking in
backwards, an entire instrument tray silently unmounted by a hooks-order
violation. A number being right is not a picture being right, and nobody had
looked at the picture.

The browser pane in this environment renders WebGL but cannot composite, so it
cannot produce a screenshot. Blender can. scene.json is emitted by importing the
game's own modules, so this renders what the CODE says — not a second description
that can drift away from it.

WHAT IT CANNOT SHOW, and this matters: anything that is a RUNTIME failure rather
than a placement one. The tray that vanished did so because React tore the
subtree down; the geometry and coordinates were fine. This harness would have
rendered it happily. It answers "is it in the right place, the right size, the
right way round" — not "does the game work".
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SCENE = argv[0]
OUT = argv[1] if len(argv) > 1 else 'out'
# scene.json sits AT the repo root, so one dirname, not two. Two put every
# lookup in the parent folder and every model reported missing.
ROOT = os.path.dirname(os.path.abspath(SCENE))

os.makedirs(OUT, exist_ok=True)
data = json.load(open(SCENE, encoding='utf-8'))


def log(*a):
    print('[scene]', *a)


# CLEAR THE FILE PROPERLY, not just what happens to be selectable.
#
# select_all + delete leaves behind anything hidden or in an excluded
# collection. This Blender's startup scene has an Icosphere that survived it, so
# the harness rendered a 0.35 m ball at the patient's feet and I very nearly
# reported it as a bug in the shipped asset. It was in the RENDERER. The .glb
# files are clean — checked through three's own loader, all seven, skinned
# character meshes only.
#
# A preview harness that invents faults is worse than no harness.
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)


def game_to_blender(p):
    """game (x, y up, z toward viewer) -> blender (x, -z, y)."""
    return Vector((p[0], -p[2], p[1]))


def place(path, pos, yaw, scale=1.0, label=''):
    """Import a .glb and put it where the game puts it."""
    full = os.path.join(ROOT, path.replace('/', os.sep))
    if not os.path.exists(full):
        log('MISSING %s (%s)' % (path, label))
        return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=full)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    # WRAP IN AN EMPTY, exactly as the game wraps the model in a scaled <group>.
    #
    # Setting position/rotation/scale on the imported root does not survive:
    # glTF actions carry OBJECT-level transform channels, so assigning the action
    # and calling frame_set drives the root's transform straight back to the
    # file's own values. The patient rendered at 4.34 m -- raw file units, scale
    # silently discarded -- with his pelvis at 1.10 instead of 0.387.
    #
    # An empty the action cannot touch holds the placement instead. That is also
    # the game's own structure, which is the point of this harness.
    bpy.ops.object.empty_add(location=(0, 0, 0))
    holder = bpy.context.active_object
    holder.name = 'holder_%s' % (label or 'prop')
    for r in roots:
        r.parent = holder
    holder.location = game_to_blender(pos)
    # A yaw about game +Y is a rotation about blender +Z, and the axis conversion
    # flips its sign.
    holder.rotation_mode = 'XYZ'
    holder.rotation_euler = (0, 0, -yaw)
    holder.scale = (scale, scale, scale)
    log('placed %-22s at %s yaw %.3f scale %.4f' % (label or path, [round(v, 3) for v in pos], yaw, scale))
    return roots


# --- the room ---------------------------------------------------------------
for p in data['props']:
    place(p['file'], p['pos'], p['yaw'], 1.0, p['id'])

place(data['chair']['file'], data['chair']['pos'], data['chair']['yaw'], 1.0, 'dental_chair')

# --- the patient, IN THE POSE THE GAME HOLDS --------------------------------
pat = data['patient']
roots = place(pat['file'], pat['pos'], pat['yaw'], pat['scale'], 'patient')
arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if arm is not None:
    act = bpy.data.actions.get(pat['clip'])
    if act:
        if arm.animation_data is None:
            arm.animation_data_create()
        arm.animation_data.action = act
        # The LAST frame: the clip is played once and clamped, so this is the
        # pose the player actually sees for the whole appointment.
        bpy.context.scene.frame_set(int(act.frame_range[1]))
        log('patient posed on %s at its last frame' % pat['clip'])
    else:
        log('!! no action %s; patient is in bind pose' % pat['clip'])
else:
    log('!! no armature found; patient not posed')

bpy.context.view_layer.update()

# --- MEASURE THE COMPOSED SCENE ---------------------------------------------
# A render under perspective cannot answer "is he on the seat" — the stool is
# nearer to the camera than the patient and reads as taller. Numbers can. This
# is the whole point of doing it in Blender: the scene is assembled exactly as
# the game assembles it, so the heights here are the heights on screen.
def world_box(objs):
    dg2 = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    found = False
    for o in objs:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg2)
        me = ev.to_mesh()
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
            found = True
        ev.to_mesh_clear()
    return (lo, hi) if found else None


def descendants(roots):
    out = []
    stack = list(roots or [])
    while stack:
        o = stack.pop()
        out.append(o)
        stack.extend(o.children)
    return out


# Drop anything in the patient's subtree that is not SKINNED. The .glb itself is
# clean — 44 nodes, one mesh, verified straight out of the raw glTF JSON — but
# something in this Blender session (an add-on, the startup file) contributes an
# Icosphere during import, and a harness that renders a ball at the patient's
# feet will get that reported as a game bug. It is not one.
_strays = [
    o for o in descendants(roots)
    if o.type == 'MESH' and not any(m.type == 'ARMATURE' for m in o.modifiers)
]
for o in _strays:
    log('harness: dropping stray %r (not in the .glb)' % o.name)
    bpy.data.objects.remove(o, do_unlink=True)
# REBUILD the root list. `roots` may itself hold one of the objects just removed,
# and walking a freed reference takes the whole run down without a traceback.
roots = [o for o in bpy.data.objects if o.parent and o.parent.name == 'holder_patient']

pat_objs = descendants(roots)
box = world_box(pat_objs)
if box:
    lo, hi = box
    # blender z is up
    log('PATIENT world height %.4f .. %.4f  (%.3f m tall)' % (lo.z, hi.z, hi.z - lo.z))
    log('PATIENT wants: feet at ~0, top at ~%.3f' % pat['height'])
    if abs(lo.z) > 0.06:
        log('!! FEET ARE AT %.3f, NOT ON THE FLOOR' % lo.z)
    if abs((hi.z - lo.z) - pat['height']) > 0.25:
        log('!! SEATED HEIGHT %.3f is far from the standing %.3f -- expected, he is sitting'
            % (hi.z - lo.z, pat['height']))
if arm is not None:
    pb = arm.pose.bones.get('Hips')
    if pb:
        w = arm.matrix_world @ pb.head
        log('PELVIS at world z %.4f   (the chair cushion is at 0.370)' % w.z)
        if abs(w.z - 0.370) > 0.12:
            log('!! PELVIS IS %.3f m FROM THE CUSHION -- he is not sitting on it' % (w.z - 0.370))

# --- a floor, so nothing floats ambiguously ---------------------------------
half = data['roomHalf']
bpy.ops.mesh.primitive_plane_add(size=half * 2, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = 'Floor'

# --- light and render settings ----------------------------------------------
bpy.ops.object.light_add(type='AREA', location=(0, -1.5, 2.6))
key = bpy.context.active_object
key.data.energy = 400
key.data.size = 3.0
bpy.ops.object.light_add(type='AREA', location=(2.0, 1.5, 2.4))
fill = bpy.context.active_object
fill.data.energy = 150
fill.data.size = 3.0

scene = bpy.context.scene
# Blender 4.2+ renamed EEVEE. Try the new id, fall back to the old, and do not
# probe the enum — bl_idname is a StringProperty and has no enum_items.
for engine in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
    try:
        scene.render.engine = engine
        log('render engine %s' % engine)
        break
    except TypeError:
        continue
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.film_transparent = False

cam_data = bpy.data.cameras.new('Cam')
cam_data.lens = 20  # wide, like the game's 72 degree fov
cam = bpy.data.objects.new('Cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def look_from(frm, to):
    f = game_to_blender(frm)
    t = game_to_blender(to)
    cam.location = f
    d = (t - f).normalized()
    # Blender cameras look down -Z with +Y up.
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


for name, c in data['cameras'].items():
    look_from(c['from'], c['to'])
    scene.render.filepath = os.path.join(OUT, 'clinic_%s.png' % name)
    bpy.ops.render.render(write_still=True)
    log('rendered %s -> %s' % (name, scene.render.filepath))

log('done')
