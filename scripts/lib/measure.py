"""
measure.py - geometry measurement + assertions for headless Blender builds.

Blender frame: Z up, -Y is the direction the patient faces.
Game frame (three.js, after export_yup=True): (X, Y, Z) = blender(x, z, -y).
"""
import bpy, json, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

EPS = 1e-6


# --------------------------------------------------------------------------
# 1. Staleness. matrix_world is a LIE until the depsgraph is flushed.
# --------------------------------------------------------------------------
_dirty = True

def touch():
    global _dirty
    _dirty = True

def sync():
    global _dirty
    if _dirty:
        bpy.context.view_layer.update()
        _dirty = False


# --------------------------------------------------------------------------
# 2. Operator safety. bpy.ops returns a set; it does not raise on no-op.
# --------------------------------------------------------------------------
class LayoutError(AssertionError):
    pass

def require(result, what):
    if 'FINISHED' not in result:
        raise LayoutError("bpy.ops %s returned %s - it silently did nothing" % (what, result))
    touch()
    return result


# --------------------------------------------------------------------------
# 3. Measurement. Everything world-space, everything post-sync.
# --------------------------------------------------------------------------
def _corners(o):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(dg)
    mw = ev.matrix_world
    return [mw @ Vector(c) for c in ev.bound_box]

def aabb(o):
    """World-space (lo, hi) for one mesh object."""
    sync()
    cs = _corners(o)
    lo = Vector((min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs)))
    hi = Vector((max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs)))
    return lo, hi

def _descendants(o):
    out = [o]
    for c in o.children:
        out += _descendants(c)
    return out

def aabb_tree(o):
    """World AABB of o and every descendant. Use for whole assemblies."""
    sync()
    objs = [x for x in _descendants(o) if x.type == 'MESH']
    if not objs:
        raise LayoutError("no meshes under %s" % o.name)
    pairs = [aabb(x) for x in objs]
    los = [p[0] for p in pairs]; his = [p[1] for p in pairs]
    lo = Vector((min(v.x for v in los), min(v.y for v in los), min(v.z for v in los)))
    hi = Vector((max(v.x for v in his), max(v.y for v in his), max(v.z for v in his)))
    return lo, hi

def top(o):    return aabb(o)[1].z
def bottom(o): return aabb(o)[0].z
def front(o):  return aabb(o)[0].y     # she faces -Y
def back(o):   return aabb(o)[1].y
def left(o):   return aabb(o)[0].x
def right(o):  return aabb(o)[1].x

def ctr(o):
    lo, hi = aabb(o)
    return (lo + hi) / 2

def size(o):
    lo, hi = aabb(o)
    return hi - lo

def gap(a, b):
    """Signed separation per axis. Negative = the AABBs overlap on that axis
    by that many metres. Two boxes intersect iff all three are negative."""
    alo, ahi = aabb(a); blo, bhi = aabb(b)
    return Vector(tuple(max(blo[i] - ahi[i], alo[i] - bhi[i]) for i in range(3)))

def clearance(a, b):
    """One number. >0 = separated by that much. <=0 = interpenetrating."""
    return max(gap(a, b))


# --------------------------------------------------------------------------
# 4. Placement. State intent, let Blender solve the local transform.
# --------------------------------------------------------------------------
def put_world(o, v):
    """Move o so its ORIGIN lands at world v, whatever its parent chain does."""
    sync()
    m = o.matrix_world.copy()
    m.translation = Vector(v)
    o.matrix_world = m
    touch()

def shift_world(o, d):
    sync()
    o.matrix_world = Matrix.Translation(Vector(d)) @ o.matrix_world
    touch()

def sit_on(o, z, clear=0.0):
    """Drop/raise o until its lowest point is `clear` above z."""
    shift_world(o, (0, 0, z + clear - bottom(o)))

def stack(child, base, clear=0.0):
    sit_on(child, top(base), clear)

def in_front_of(o, other, clear):
    """Move o along -Y until its back face is `clear` in front of other."""
    shift_world(o, (0, (front(other) - clear) - back(o), 0))


# --------------------------------------------------------------------------
# 5. Assertions. The build FAILS instead of exporting something wrong.
# --------------------------------------------------------------------------
def assert_encloses(outer, inner, margin=0.0):
    olo, ohi = aabb(outer); ilo, ihi = aabb(inner)
    for i in range(3):
        under = olo[i] + margin - ilo[i]
        over  = ihi[i] - (ohi[i] - margin)
        if under > EPS or over > EPS:
            raise LayoutError(
                "'%s' escapes '%s' on %s by (%.4f, %.4f) m"
                % (inner.name, outer.name, "XYZ"[i], max(0, under), max(0, over)))

def assert_clear(a, b, min_gap=0.0):
    c = clearance(a, b)
    if c < min_gap - EPS:
        raise LayoutError("'%s' and '%s' clear by %.4f m, need %.4f m  (per-axis %s)"
                          % (a.name, b.name, c, min_gap,
                             tuple(round(v, 4) for v in gap(a, b))))

def assert_rests_on(o, surface, tol=0.005):
    d = bottom(o) - top(surface)
    if abs(d) > tol:
        raise LayoutError("'%s' floats/sinks %.4f m relative to '%s' top"
                          % (o.name, d, surface.name))

def local_z(o):
    sync()
    m = o.matrix_world.to_3x3().normalized()
    return Vector((m[0][2], m[1][2], m[2][2])).normalized()

def assert_parallel(a, b, tol_deg=0.5):
    """The recline bug: two parts that must lean at the same angle."""
    ang = math.degrees(local_z(a).angle(local_z(b)))
    if ang > tol_deg:
        raise LayoutError("'%s' and '%s' differ by %.3f deg, tolerance %.3f"
                          % (a.name, b.name, ang, tol_deg))

def assert_identity_parent_inverse():
    I = Matrix.Identity(4)
    for o in bpy.data.objects:
        if o.parent and o.matrix_parent_inverse != I:
            raise LayoutError("'%s' has a non-identity matrix_parent_inverse - "
                              "its .location no longer describes where it is" % o.name)


# --------------------------------------------------------------------------
# 6. Interpenetration sweep. AABB prefilter, then exact triangle overlap.
# --------------------------------------------------------------------------
def _bvh(o):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    verts = [mw @ v.co for v in me.vertices]
    polys = [p.vertices[:] for p in me.polygons]
    t = BVHTree.FromPolygons(verts, polys, all_triangles=False)
    ev.to_mesh_clear()
    return t

def hits(objs, min_depth=0.002):
    """[(a, b, n_face_pairs)] for every genuinely interpenetrating pair."""
    sync()
    objs = [o for o in objs if o.type == 'MESH' and len(o.data.polygons)]
    boxes = {}
    for o in objs:
        boxes[o.name] = aabb(o)
    cand = []
    for i, a in enumerate(objs):
        for b in objs[i + 1:]:
            alo, ahi = boxes[a.name]; blo, bhi = boxes[b.name]
            if all(min(ahi[k], bhi[k]) - max(alo[k], blo[k]) > min_depth for k in range(3)):
                cand.append((a, b))
    trees = {}
    out = []
    for a, b in cand:
        for o in (a, b):
            if o.name not in trees:
                trees[o.name] = _bvh(o)
        ov = trees[a.name].overlap(trees[b.name])
        if ov:
            out.append((a, b, len(ov)))
    out.sort(key=lambda t: -t[2])
    return out

def assert_no_new_hits(objs, allow, label=""):
    """`allow` is the whitelist of contacts that are SUPPOSED to happen,
    as a set of frozenset({'A','B'}). Anything else fails the build."""
    bad = []
    for a, b, n in hits(objs):
        if frozenset((a.name, b.name)) not in allow:
            bad.append((a, b, n))
    if bad:
        lines = ["  %-14s x %-14s  %3d face pairs  depth %s"
                 % (a.name, b.name, n, tuple(round(-v, 3) for v in gap(a, b)))
                 for a, b, n in bad[:25]]
        raise LayoutError("%d undeclared intersections %s:\n%s"
                          % (len(bad), label, "\n".join(lines)))


# --------------------------------------------------------------------------
# 7. Sockets + manifest. Measured numbers cross to TypeScript as data.
# --------------------------------------------------------------------------
def socket(name, parent, world_pos):
    e = bpy.data.objects.new("SOCKET_" + name, None)
    e.empty_display_type = 'PLAIN_AXES'
    bpy.context.collection.objects.link(e)
    e.parent = parent
    touch(); sync()
    put_world(e, world_pos)
    return e

def to_game(v):
    """Blender (x, y, z) -> three.js (x, z, -y). Matches export_yup=True."""
    return [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]

def manifest(path, root, landmarks=None, extra=None):
    sync()
    lo, hi = aabb_tree(root)
    doc = {
        "generated_by": "measure.manifest - do not hand-edit",
        "bounds_game": {"min": to_game(lo), "max": to_game(hi)},
        "parts": {},
        "landmarks": {},
    }
    for o in _descendants(root):
        if o.type == 'MESH':
            a, b = aabb(o)
            doc["parts"][o.name] = {"min": to_game(a), "max": to_game(b)}
    for k, v in (landmarks or {}).items():
        doc["landmarks"][k] = to_game(v) if hasattr(v, "__len__") else round(v, 5)
    doc.update(extra or {})
    with open(path, "w") as f:
        json.dump(doc, f, indent=2)
    return doc


# --------------------------------------------------------------------------
# 8. Pose sweep. glTF import leaves everything in QUATERNION mode, so writing
#    rotation_euler is a silent no-op and the sweep returns a confident PASS.
# --------------------------------------------------------------------------
def unlock_rotation():
    for o in bpy.data.objects:
        o.rotation_mode = 'XYZ'
    touch()

def sweep(part, axis, values, objs, allow, label=""):
    base = part.rotation_euler[axis]
    try:
        for v in values:
            part.rotation_euler[axis] = base + v
            touch()
            assert_no_new_hits(objs, allow, "%s @ %s%+0.2f rad" % (label, part.name, v))
    finally:
        part.rotation_euler[axis] = base
        touch(); sync()
