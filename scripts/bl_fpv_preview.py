"""Render what the PLAYER sees: the hands, placed exactly as the game places them.

The browser pane in this environment will not composite, so screenshots of the
running game are not available. This is the substitute, and it is an honest one:
the placement is not retyped here, it is read from blender/.hand_placement.json,
which scripts/emit_hand_placement.mts produces by calling the same placeHand()
the component calls, against the same shipped .glb, through the same loader.

COORDINATES. The game is Y-up and Blender is Z-up, so everything is built inside
a "GameRoot" empty carrying a +90 degree rotation about X. Inside that empty the
axes ARE the game's, and every number from the JSON drops in untouched — no
per-value conversion to get wrong. glTF is Y-up too, so the importer's own
conversion is discarded on the imported root: GameRoot supplies it instead.

The camera sits at the origin looking down -Z with the game's vertical field of
view, because the game's hand group rides the camera with an identity transform.
So camera space IS what the player sees.
"""
import bpy
import json
import math
import mathutils

DATA = r"D:/My Apps/study-game/blender/.hand_placement.json"
INSTRUMENTS = r"D:/My Apps/study-game/public/models/instruments.glb"
FOV_Y_DEG = 72  # ClinicCase's camera

with open(DATA, encoding="utf8") as fh:
    P = json.load(fh)
print(f"hands scale {P['scale']:.3f}, mirrored={P['mirrored']}")


def import_into(path, parent, location, quat, scale, mirror=False):
    """Import a .glb and place it in GAME coordinates under `parent`.

    THE IMPORTER'S CONVERSION IS CANCELLED, NOT OVERWRITTEN. Blender's glTF
    importer does not reliably put its Y-up-to-Z-up rotation on the object you
    get back — it may sit on a child empty — so clearing the root's transform
    leaves a stray 90 degrees somewhere below and the model faces the wrong way.
    The first version of this did exactly that and rendered the hands pointing
    their fingertips at the camera.

    Instead the import is left completely untouched and hung under an "unconvert"
    empty carrying the inverse rotation. Whatever the importer did to the chain,
    the net is identity, and the placement empty above it is then free to speak
    pure game coordinates.
    """
    before = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=path)
    fresh = [o for o in bpy.data.objects if o.name not in before]

    place = bpy.data.objects.new("Placed", None)
    bpy.context.scene.collection.objects.link(place)
    place.parent = parent
    place.rotation_mode = "QUATERNION"
    place.location = location
    place.rotation_quaternion = quat
    place.scale = (-scale if mirror else scale, scale, scale)

    unconvert = bpy.data.objects.new("Unconvert", None)
    bpy.context.scene.collection.objects.link(unconvert)
    unconvert.parent = place
    unconvert.rotation_mode = "XYZ"
    unconvert.rotation_euler = (math.radians(-90), 0, 0)

    for r in [o for o in fresh if o.parent is None]:
        r.parent = unconvert
        r.matrix_parent_inverse = mathutils.Matrix.Identity(4)

    return fresh


scene = bpy.context.scene
game = bpy.data.objects.get("GameRoot")
if not game:
    game = bpy.data.objects.new("GameRoot", None)
    scene.collection.objects.link(game)
game.rotation_mode = "XYZ"
game.rotation_euler = (math.radians(90), 0, 0)
game.location = (0, 0, 0)

# three stores quaternions xyzw; Blender wants wxyz.
qx, qy, qz, qw = P["quaternion"]
quat = mathutils.Quaternion((qw, qx, qy, qz))
pos = mathutils.Vector(P["position"])

def pose_fingers(objs, angle, axis):
    """Bend the fingers the way the game bends them at rest.

    Without this the preview shows the model's RIG pose — fingers splayed flat —
    which is how a hand is modelled and not how one ever looks on a person. The
    preview would then be judging a pose the player never sees.
    """
    import re

    words = ("index", "middle", "ring", "pinky", "little", "thumb")
    arms = [o for o in objs if o.type == "ARMATURE"]
    posed = 0
    for arm in arms:
        for pb in arm.pose.bones:
            low = pb.name.lower()
            if "end" in low or "palm" in low:
                continue
            if not any(w in low for w in words):
                continue
            m = re.search(r"(?:index|middle|ring|pinky|little|thumb)[._-]?(\d)", low)
            if not m:
                continue
            pb.rotation_mode = "XYZ"
            e = [0.0, 0.0, 0.0]
            for i, a in enumerate(axis):
                e[i] = angle * a
            pb.rotation_euler = e
            posed += 1
    print(f"posed {posed} finger joints at {angle:.2f} rad")


made = []
made += import_into(P["glb"].replace("public/", "D:/My Apps/study-game/public/"),
                    game, pos, quat, P["scale"])
pose_fingers(made, P.get("restCurl", 0.0), P.get("curlAxis", [0, 0, -1]))
if P["mirrored"]:
    # The game mirrors the single hand under a group scaled -1 on X, so the
    # placement mirrors with it: negate the position's x and the quaternion's
    # y and z, which is what conjugating a rotation by that reflection does.
    # Pose the SECOND import's own objects, not a slice of the combined list.
    # Without this the mirrored hand keeps the model's splayed rig pose while the
    # first is bent, and the pair renders asymmetric — which reads as the
    # mirroring maths being wrong when it is fine.
    second = import_into(
        P["glb"].replace("public/", "D:/My Apps/study-game/public/"),
        game,
        mathutils.Vector((-pos.x, pos.y, pos.z)),
        mathutils.Quaternion((qw, qx, -qy, -qz)),
        P["scale"],
        mirror=True,
    )
    pose_fingers(second, P.get("restCurl", 0.0), P.get("curlAxis", [0, 0, -1]))
    made += second

# --- a held instrument, at the grip the game now uses ------------------------
grip = mathutils.Vector(P["gripTarget"])
finger = mathutils.Vector(P["fingerDir"]).normalized()
# Same as gripQuaternion(): turn the instrument's local +Z onto the finger axis.
aim = mathutils.Vector((0, 0, 1)).rotation_difference(finger)
try:
    inst = import_into(INSTRUMENTS, game, grip, aim, 1.0)
    # Show one tool only, so the grip is legible.
    keep = None
    for o in inst:
        if o.type == "MESH" and "scaler" in o.name.lower():
            keep = o
    for o in inst:
        if o.type == "MESH":
            o.hide_render = keep is not None and o is not keep
    made += inst
    print(f"instrument: showing {keep.name if keep else 'all'}")
except Exception as e:  # noqa: BLE001 - the preview is still useful without it
    print(f"no instrument preview: {e}")

# --- camera and light ---------------------------------------------------------
cam = bpy.data.objects.get("FpvCam")
if not cam:
    cam = bpy.data.objects.new("FpvCam", bpy.data.cameras.new("FpvCam"))
    scene.collection.objects.link(cam)
cam.data.sensor_fit = "VERTICAL"
cam.data.angle_y = math.radians(FOV_Y_DEG)
cam.location = (0, 0, 0)
# Looks down -Z in GAME axes, which after GameRoot's rotation is +Y in Blender.
cam.rotation_mode = "XYZ"
cam.rotation_euler = (math.radians(90), 0, 0)
for c in list(cam.constraints):
    cam.constraints.remove(c)
scene.camera = cam

if not scene.world:
    scene.world = bpy.data.worlds.new("Fpv")
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.55, 0.5, 0.42, 1)
    bg.inputs[1].default_value = 1.4

key = bpy.data.objects.get("FpvKey")
if not key:
    key = bpy.data.objects.new("FpvKey", bpy.data.lights.new("FpvKey", "AREA"))
    scene.collection.objects.link(key)
key.data.energy = 200
key.data.size = 3
key.location = (0.6, -1.2, 1.4)
key.rotation_euler = (0.7, 0, 0.4)
key.hide_render = False

try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
# The phone is landscape; match it so the framing is the framing you get.
scene.render.resolution_x = 960
scene.render.resolution_y = 450
scene.render.film_transparent = False

for o in bpy.data.objects:
    if o.type == "MESH" and o not in made:
        o.hide_render = True
    if o.type == "LIGHT" and o.name != "FpvKey":
        o.hide_render = True

scene.render.filepath = r"D:/My Apps/study-game/blender/renders/fpv_hands.png"
bpy.ops.render.render(write_still=True)
print("rendered blender/renders/fpv_hands.png")
