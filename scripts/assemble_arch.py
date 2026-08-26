"""
Assemble the scanned teeth into two dental arches that actually occlude.

Takes the per-tooth GLBs from build_teeth.py and lays them along an elliptical
arch, upper against lower.

WHY THE FIRST VERSION CAME OUT WRONG
------------------------------------
It reused the fixed `ANGLES` table from build_mouth.py — hand-tuned angular
positions that were correct for BOXES of known width. Real teeth have different
widths, so fixed angles left gaps between the incisors and drove the molars into
each other. It also placed every tooth at z = 0, so the two arches occupied the
same space instead of biting together.

Both are fixed by measuring instead of tabulating:

1. POSITIONS ARE WALKED, NOT LOOKED UP. Starting at the midline, each tooth
   advances along the arch by half the previous crown's mesiodistal width plus
   half its own. Neighbours therefore touch at their contact points, which is
   what a real arch does, whatever the individual teeth measure.

   Distance along an ellipse is not proportional to the parameter t, so the walk
   integrates arc length numerically rather than pretending it is.

2. THE OCCLUSAL PLANE IS REAL. Lower crowns point up and stop at z = 0; upper
   crowns point down and stop just above it. The gap is the bite opening, so
   the jaw can hinge without the teeth starting interpenetrated.
"""
import math
import os
import sys
import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_GLB = argv[0], argv[1]

# Arch radii, from build_mouth.py: ~55 mm across, ~50 mm deep for an adult.
ARCH_W, ARCH_D = 0.0275, 0.026
# Bite opening at rest. Not zero: teeth that start touching interpenetrate the
# moment the jaw bone rotates by even a degree.
BITE_GAP = 0.0015
# Contact tightness. 1.0 = crowns exactly touching; slightly under closes the
# visible seams, because a decimated scan's widest point is not its contact point.
CONTACT = 0.92


def ellipse_step(t, distance, steps=64):
    """Advance the arch parameter by a real arc-length distance.

    On an ellipse, equal steps in t are NOT equal steps along the curve — the
    parameter moves fastest where the curve is flattest. Walking teeth by t
    directly is what bunches the molars and spreads the incisors.
    """
    if distance <= 0:
        return t
    remaining, cur = distance, t
    dt = distance / (ARCH_W + ARCH_D) / steps
    for _ in range(steps * 8):
        speed = math.hypot(ARCH_W * math.cos(cur), ARCH_D * math.sin(cur))
        if speed < 1e-9:
            break
        seg = speed * dt
        if seg >= remaining:
            return cur + dt * (remaining / seg)
        remaining -= seg
        cur += dt
    return cur


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in set(bpy.data.objects) - before if o.type == "MESH"]


bpy.ops.wm.read_factory_settings(use_empty=True)

root = bpy.data.objects.new("MouthRig", None)
bpy.context.collection.objects.link(root)
maxilla = bpy.data.objects.new("Maxilla", None)
maxilla.parent = root
bpy.context.collection.objects.link(maxilla)
# Named `Jaw` so PatientRig's existing lookup finds it verbatim and the
# jaw-open animation survives unchanged.
jaw = bpy.data.objects.new("Jaw", None)
jaw.parent = root
bpy.context.collection.objects.link(jaw)

# --- collect every tooth, keyed by FDI ---------------------------------------
teeth = {}
for f in sorted(os.listdir(SRC)):
    if not f.endswith(".glb"):
        continue
    for o in load(os.path.join(SRC, f)):
        name = o.name.split(".")[0]
        if len(name) == 3 and name.startswith("T") and name[1:].isdigit():
            teeth[name] = o

bpy.context.view_layer.update()


def local_bbox(o):
    co = [v.co for v in o.data.vertices]
    lo = mathutils.Vector((min(c.x for c in co), min(c.y for c in co),
                           min(c.z for c in co)))
    hi = mathutils.Vector((max(c.x for c in co), max(c.y for c in co),
                           max(c.z for c in co)))
    return lo, hi


placed, missing = [], []

for q in (1, 2, 3, 4):
    upper = q in (1, 2)
    # Quadrants 1 and 4 are the patient's RIGHT, which is -X in the head's frame.
    side = -1 if q in (1, 4) else 1
    t = 0.0
    prev_half = 0.0
    for pos in range(1, 9):
        name = f"T{q}{pos}"
        o = teeth.get(name)
        if o is None:
            missing.append(name)
            # Still advance, so a gap stays a gap instead of shifting the arch.
            t = ellipse_step(t, 0.008 * CONTACT)
            prev_half = 0.004
            continue

        lo, hi = local_bbox(o)
        md = max(hi.x - lo.x, hi.y - lo.y)     # mesiodistal, after upright()
        half = md / 2

        # Walk to this tooth's centre: out by the previous half-width plus ours.
        t = ellipse_step(t, (prev_half + half) * CONTACT)
        prev_half = half

        x = side * ARCH_W * math.sin(t)
        y = -ARCH_D * math.cos(t)              # -Y is forward, toward the lips

        o.name = name
        o.parent = maxilla if upper else jaw
        # Crowns face the occlusal plane, and the CROWN TIP is what lands on it.
        if upper:
            # Flip so the crown points down, then drop the tip to the plane.
            o.rotation_euler = (math.pi, 0.0, -side * t * 0.35)
            z = BITE_GAP + hi.z
        else:
            o.rotation_euler = (0.0, 0.0, -side * t * 0.35)
            z = -hi.z
        o.location = (x, y, z)
        placed.append(name)

print("PLACED|%d" % len(placed))
print("MISSING|%s" % (", ".join(sorted(missing)) if missing else "(none)"))

bpy.context.view_layer.update()
pts = [o.matrix_world @ mathutils.Vector(c)
       for o in bpy.data.objects if o.type == "MESH" for c in o.bound_box]
lo = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
print("ARCHSIZE|%.1f x %.1f x %.1f mm"
      % ((hi.x - lo.x) * 1000, (hi.y - lo.y) * 1000, (hi.z - lo.z) * 1000))

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=True,
    export_texcoords=False,
    export_normals=True,
)

tris = 0
for o in bpy.data.objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
print("ARCH|%d teeth, %d tris" % (len(placed), tris))
print("ARCH_OK")
