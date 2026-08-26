"""
Turn the University of Dundee tooth scans into Chairside's FDI-named tooth set.

WHAT THESE ARE
--------------
Sketchfab user `DundeeDental` (University of Dundee) publishes every permanent
tooth individually scanned WITH ITS ROOT, CC Attribution, downloadable. That is
the thing no procedural model can fake: pull tooth 46 and what comes out is a
real mandibular first molar with two real roots.

They replace the box teeth from build_mouth.py, which were rectangles with a
darker cap for cusps.

THE PROBLEM: THEY ARE NOT IN A SHARED SCALE
-------------------------------------------
Each was scanned and exported independently, so their units disagree. Measured
straight out of the download:

    t_mand_first_molar        1.352 x 1.653 x 1.977
    t_mand_central_incisor    0.240 x 0.384 x 0.891

A 2.2x length ratio between a molar and an incisor, when anatomically they are
within a couple of millimetres of each other. Dropped into the mouth as-is, the
arch would be a joke.

THE FIX: SCALE EACH ONE TO WHEELER
----------------------------------
`build_mouth.py` already carries Wheeler's odontometric table — real mesiodistal,
buccolingual and crown-height figures for all 32 positions, which is what made
the box arch read as an arch rather than a fence. The same numbers rescale the
scans.

Method: of a tooth's three bounding-box dimensions, the LARGEST is its long axis
(crown plus root) and the other two are mesiodistal and buccolingual. The wider
of those two is mesiodistal. Scale uniformly so that dimension matches Wheeler.

Uniform, deliberately — a non-uniform fit to all three numbers would squash the
root, and the root is the entire reason for using scans.

MIRRORING
---------
Dundee publishes one tooth per TYPE; FDI needs left and right. The contralateral
is a mirror, so each scan is emitted twice, once with X negated. That is
anatomically correct: contralateral teeth genuinely are mirror images.

Usage:
    blender --background --factory-startup --python build_teeth.py -- \\
        <src_dir> <out.glb> [--tris 1200]
"""
import math
import os
import sys
import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_GLB = argv[0], argv[1]
TRIS = int(argv[argv.index("--tris") + 1]) if "--tris" in argv else 1200
# Process ONE scan per Blender process.
#
# Importing all sixteen into a single scene crashes Blender with a C++ exception
# on a 7.8 GB machine: each is a photogrammetry scan of 43k-96k triangles with a
# 4K texture, and nothing frees the previous one. A single tooth runs fine, so
# the driver loops processes instead of files.
ONLY = argv[argv.index("--only") + 1] if "--only" in argv else None

# Wheeler's, straight from build_mouth.py: (mesiodistal, buccolingual, height)
# in metres, keyed by FDI position 1..8.
UPPER = {
    1: (0.0086, 0.0072, 0.0105), 2: (0.0066, 0.0064, 0.0090),
    3: (0.0077, 0.0080, 0.0100), 4: (0.0071, 0.0092, 0.0085),
    5: (0.0067, 0.0092, 0.0082), 6: (0.0102, 0.0113, 0.0077),
    7: (0.0098, 0.0112, 0.0074), 8: (0.0089, 0.0105, 0.0070),
}
LOWER = {
    1: (0.0053, 0.0060, 0.0090), 2: (0.0059, 0.0065, 0.0093),
    3: (0.0069, 0.0076, 0.0110), 4: (0.0071, 0.0078, 0.0086),
    5: (0.0071, 0.0082, 0.0080), 6: (0.0111, 0.0105, 0.0077),
    7: (0.0106, 0.0102, 0.0070), 8: (0.0099, 0.0098, 0.0068),
}

# file stem -> (arch, FDI position). Quadrants are derived by mirroring.
SCANS = {
    "t_max_central_incisor":  ("U", 1), "t_max_lateral_incisor": ("U", 2),
    "t_max_canine":           ("U", 3), "t_max_first_premolar":  ("U", 4),
    "t_max_second_premolar":  ("U", 5), "t_max_first_molar":     ("U", 6),
    "t_max_second_molar":     ("U", 7), "t_max_third_molar":     ("U", 8),
    "t_mand_central_incisor": ("L", 1), "t_mand_lateral_incisor":("L", 2),
    "t_mand_canine":          ("L", 3), "t_mand_first_premolar": ("L", 4),
    "t_mand_second_premolar": ("L", 5), "t_mand_first_molar":    ("L", 6),
    "t_mand_second_molar":    ("L", 7), "t_mand_third_molar":    ("L", 8),
}
# FDI quadrants: 1 upper-right, 2 upper-left, 3 lower-left, 4 lower-right.
QUADS = {"U": (1, 2), "L": (4, 3)}



def upright(obj):
    """Stand the tooth up: long axis to +Z, crown pointing +Z.

    MUST run before any measurement. The scans are arbitrarily oriented, so a
    tooth lying on its side has bounding-box dimensions in an order that has
    nothing to do with mesiodistal / buccolingual / length -- which made the
    Wheeler scaling pick the wrong axis and spread final lengths across
    11.6-46.2 mm when real teeth are 17-27 mm.

    Which end is the crown is also measured, not assumed: a crown is bulbous and
    a root tapers, so the end whose vertices spread wider is the crown. Nothing
    in a scan records that.
    """
    me = obj.data
    co = [v.co.copy() for v in me.vertices]
    if not co:
        return
    lo = mathutils.Vector((min(c.x for c in co), min(c.y for c in co),
                           min(c.z for c in co)))
    hi = mathutils.Vector((max(c.x for c in co), max(c.y for c in co),
                           max(c.z for c in co)))
    d = hi - lo
    axis = max(range(3), key=lambda i: d[i])
    if axis == 0:
        me.transform(mathutils.Matrix.Rotation(math.radians(90), 4, "Y"))
    elif axis == 1:
        me.transform(mathutils.Matrix.Rotation(math.radians(-90), 4, "X"))
    me.update()

    co = [v.co.copy() for v in me.vertices]
    zs = [c.z for c in co]
    zlo, zhi = min(zs), max(zs)
    span = zhi - zlo
    if span < 1e-9:
        return

    def spread(keep):
        pts = [c for c in co if keep(c.z)]
        if len(pts) < 3:
            return 0.0
        cx = sum(p.x for p in pts) / len(pts)
        cy = sum(p.y for p in pts) / len(pts)
        return sum(math.hypot(p.x - cx, p.y - cy) for p in pts) / len(pts)

    if spread(lambda z: z < zlo + span * 0.2) > spread(lambda z: z > zhi - span * 0.2):
        me.transform(mathutils.Matrix.Rotation(math.radians(180), 4, "X"))
        me.update()


def bbox(objs):
    pts = [o.matrix_world @ mathutils.Vector(c) for o in objs for c in o.bound_box]
    lo = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts),
                           min(p.z for p in pts)))
    hi = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts),
                           max(p.z for p in pts)))
    return lo, hi


def sample_texture(obj):
    """Bake the scan's photo texture into vertex colours, then drop the image.

    These are photogrammetry scans: ALL of their colour — enamel shade, stain,
    the darker root — lives in the texture, not in any material value. Discarding
    it without sampling would leave 32 identical white lumps.
    """
    me = obj.data
    if not me.uv_layers or not me.uv_layers.active:
        return False
    img = None
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for n in mat.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and n.image.size[0]:
                nm = n.image.name.lower()
                if any(k in nm for k in ("nor", "rough", "metal", "ao", "arm")):
                    continue
                img = n.image
                break
        if img:
            break
    if img is None:
        return False

    w, h = img.size
    # HARD LIMIT before touching .pixels.
    #
    # These are photogrammetry scans with 4K textures. 4096*4096*4 = 67 MILLION
    # floats, and foreach_get wants a Python list that size -- several GB, which
    # takes Blender down with a C++ exception rather than an error message.
    # 512 is far more resolution than a 1200-triangle mesh can carry anyway.
    LIMIT = 512
    if w > LIMIT or h > LIMIT:
        img.scale(min(w, LIMIT), min(h, LIMIT))
        w, h = img.size
    buf = [0.0] * (w * h * 4)
    try:
        img.pixels.foreach_get(buf)
    except Exception:
        return False

    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    col = me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    uv = me.uv_layers.active
    out = [0.0] * (len(me.loops) * 4)
    for li in range(len(me.loops)):
        u, v = uv.data[li].uv
        x = int((u % 1.0) * w)
        y = int((v % 1.0) * h)
        p = (y * w + x) * 4
        o = li * 4
        out[o], out[o + 1], out[o + 2], out[o + 3] = buf[p], buf[p + 1], buf[p + 2], 1.0
    col.data.foreach_set("color", out)
    me.update()
    return True


bpy.ops.wm.read_factory_settings(use_empty=True)

mat = bpy.data.materials.new("tooth")
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
outp = nt.nodes.new("ShaderNodeOutputMaterial")
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Col"
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(bsdf.outputs["BSDF"], outp.inputs["Surface"])
bsdf.inputs["Roughness"].default_value = 0.35   # enamel is glossy

root = bpy.data.objects.new("Teeth", None)
bpy.context.collection.objects.link(root)

made, missing, report = [], [], []

for stem, (arch, pos) in sorted(SCANS.items()):
    if ONLY and stem != ONLY:
        continue
    path = os.path.join(SRC, stem + ".glb")
    if not os.path.exists(path):
        missing.append(stem)
        continue

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in set(bpy.data.objects) - before]
    meshes = [o for o in new if o.type == "MESH"]
    if not meshes:
        missing.append(stem + " (no mesh)")
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)
        continue

    bpy.context.view_layer.update()

    # --- join into one object -------------------------------------------------
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active

    sampled = sample_texture(obj)

    # --- decimate -------------------------------------------------------------
    obj.data.calc_loop_triangles()
    n = len(obj.data.loop_triangles)
    if n > TRIS:
        d = obj.modifiers.new("budget", type="DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = TRIS / n
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=d.name)

    # --- stand it up, THEN scale to Wheeler -----------------------------------
    upright(obj)
    co = [v.co for v in obj.data.vertices]
    ex = max(c.x for c in co) - min(c.x for c in co)
    ey = max(c.y for c in co) - min(c.y for c in co)
    # Now that Z is the long axis, the two horizontal spans really are
    # mesiodistal and buccolingual, and the wider one is mesiodistal.
    md_scan = max(ex, ey)
    md_real = (UPPER if arch == "U" else LOWER)[pos][0]
    k = md_real / md_scan if md_scan > 1e-9 else 1.0

    # Scale and centre by transforming the MESH DATA directly.
    #
    # `bpy.ops.object.transform_apply` can return CANCELLED without raising --
    # and did. The scale was set, measured (correctly, 20.7 mm), then never
    # baked, so every tooth exported at its raw scan size and the assembled arch
    # came out 3.5 METRES tall. A mesh transform cannot fail quietly.
    obj.data.transform(mathutils.Matrix.Diagonal((k, k, k, 1.0)))
    obj.scale = (1.0, 1.0, 1.0)
    obj.location = (0.0, 0.0, 0.0)
    obj.data.update()

    co = [v.co for v in obj.data.vertices]
    lo = mathutils.Vector((min(c.x for c in co), min(c.y for c in co),
                           min(c.z for c in co)))
    hi = mathutils.Vector((max(c.x for c in co), max(c.y for c in co),
                           max(c.z for c in co)))
    length_mm = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) * 1000
    obj.data.transform(mathutils.Matrix.Translation(-(lo + hi) / 2))
    obj.data.update()

    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj.data.calc_loop_triangles()
    tris = len(obj.data.loop_triangles)

    # --- emit both quadrants --------------------------------------------------
    qa, qb = QUADS[arch]
    for i, q in enumerate((qa, qb)):
        name = f"T{q}{pos}"
        if i == 0:
            t = obj
            t.name = name
        else:
            t = obj.copy()
            t.data = obj.data.copy()
            bpy.context.collection.objects.link(t)
            t.name = name
            # Contralateral teeth ARE mirror images, so a negative X scale is
            # anatomically right, not a shortcut.
            t.scale = (-1, 1, 1)
        t.parent = root
        made.append(name)

    report.append("%-24s -> T%d%d/T%d%d  x%.4f  %5.1f mm  %4d tris  vcol=%s"
                  % (stem, qa, pos, qb, pos, k, length_mm, tris,
                     "yes" if sampled else "NO"))

for r in report:
    print("T|" + r)
if missing:
    print("MISSING|" + ", ".join(missing))

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_yup=True,
    export_apply=True,          # bakes the mirror scale into the geometry
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=True,
    export_texcoords=False,
    export_normals=True,
)

total = 0
for o in bpy.data.objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
print("TEETH|%d emitted, %d tris total" % (len(made), total))
print("TEETH_OK")
