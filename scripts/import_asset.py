"""
Turn any downloaded 3D asset into a Chairside-ready GLB.

WHY THIS EXISTS
---------------
The models in this game are boxes, and boxes are why the clinic reads as
amateur. The fix is real geometry from a real library -- Substance 3D Community
Assets, Sketchfab, Poly Haven, Quaternius, Poly Pizza. But every one of those
ships assets that are wrong for this game in the same four ways:

  1. Wrong scale.     Exporters disagree about units; a chair arrives 100x too
                      big or 0.01x too small, and "looks fine in the viewport"
                      is not a unit.
  2. Wrong origin.    Assets are centred on their bounding box, so they sink
                      half-way through the floor when placed at y=0.
  3. Too heavy.       A photoreal dental unit is 80k-400k triangles and carries
                      4K PBR maps. The whole game budget is 8-15 MB.
  4. Wrong palette.   Twelve assets from six authors is twelve colour schemes.
                      Re-shading everything to ONE palette is the single
                      highest-leverage art step there is -- it is what makes a
                      kit-bash read as one art-directed set instead of a pile of
                      downloads.

This script fixes all four, then hands off to bake_vertex_light.py, which throws
the textures away entirely and bakes lighting into vertex colours. Net result: a
photoreal source model becomes a small, unlit, palette-correct mesh that matches
everything else in the room.

The 4K maps never ship. That is what makes real assets affordable here.

Usage:
    blender --background --factory-startup --python import_asset.py -- \
        <in.(glb|gltf|fbx|obj|dae|blend)> <out.glb> [--height M] [--tris N]
        [--palette] [--yaw RAD] [--name PREFIX]

    --height  target size in metres along the asset's tallest axis (default:
              leave the scale alone)
    --tris    triangle budget; decimates only if over it (default 4000)
    --palette re-shade every material to the nearest theme3d.ts colour
    --yaw     rotate about Z before export, for assets authored facing the wrong
              way (degrees)
    --name    rename all objects with this prefix, so parts stay addressable
"""
import os
import sys
import math
import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
IN_PATH, OUT_GLB = argv[0], argv[1]


def flag(name, default=None, cast=str):
    if name in argv:
        i = argv.index(name)
        if cast is bool:
            return True
        return cast(argv[i + 1])
    return default


HEIGHT = flag("--height", None, float)
TRIS = flag("--tris", 4000, int)
PALETTE = "--palette" in argv
YAW = math.radians(flag("--yaw", 0.0, float))
PREFIX = flag("--name", None, str)

# src/clinic/theme3d.ts -- the ONE palette. Anything imported gets mapped into
# it, which is what makes six authors look like one art director.
PALETTE_HEX = {
    "wall": 0xF4ECE1, "wallWarm": 0xE8D9C6, "ceiling": 0xFCF8F3,
    "floor": 0xCBB9A4, "skirting": 0xC99A63,
    "wood": 0xC99A63, "woodDark": 0xA87A45, "woodLight": 0xDCB387,
    "teal": 0x6DC5BC, "tealDeep": 0x4FA79E,
    "white": 0xFBF8F4, "metal": 0xCFD4D8, "skin": 0xD9A276,
    "glove": 0x6F9FE0, "window": 0xFFF6E2, "cork": 0xD9B98C,
    "star": 0xF5C249, "leaf": 0x5FA361, "pot": 0xC4764F,
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h):
    r, g, b = ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


PALETTE_LIN = {k: lin(v)[:3] for k, v in PALETTE_HEX.items()}


# Palette entries with no meaningful hue. A grey source must land in here and
# nowhere else -- the first version let a blue-grey (0x93A3A6) match `leaf`,
# because dark-grey is closer in LIGHTNESS to a mid green than to light metal.
# That is how an imported chair grows green legs.
NEUTRALS = ("white", "metal", "wall", "wallWarm", "ceiling", "floor")


def nearest_palette(rgb):
    """Pick the palette FAMILY by hue and chroma; let lightness ride along.

    Lightness must not choose the family. The palette is a small fixed set, so
    a dark version of a colour is usually absent from it -- and if lightness
    dominates the metric, the search happily crosses hues to find a match at the
    right brightness. Family is decided by hue and saturation, and the source's
    own light/dark structure is preserved afterwards by `shift_value`.
    """
    src = mathutils.Color(rgb)
    h1, s1, v1 = src.hsv
    candidates = NEUTRALS if s1 < 0.12 else PALETTE_LIN.keys()
    best, best_d = None, 1e9
    for name in candidates:
        h2, s2, v2 = mathutils.Color(PALETTE_LIN[name]).hsv
        dh = min(abs(h1 - h2), 1 - abs(h1 - h2)) * 2.0
        # A desaturated colour has no reliable hue, so scale the hue term by how
        # much chroma either side actually has.
        dh *= min(s1, s2) * 4.0
        d = dh * dh + 0.5 * (s1 - s2) ** 2 + 0.15 * (v1 - v2) ** 2
        if d < best_d:
            best, best_d = name, d
    return best


def shift_value(name, rgb):
    """The palette colour, nudged toward the source's own lightness.

    Keeps the part-to-part contrast the original artist authored -- a dark base
    under a light seat stays darker -- while still landing inside the palette.
    """
    _, _, v1 = mathutils.Color(rgb).hsv
    out = mathutils.Color(PALETTE_LIN[name])
    h2, s2, v2 = out.hsv
    out.hsv = (h2, s2, max(0.06, min(1.0, v2 + (v1 - v2) * 0.55)))
    return (out.r, out.g, out.b)


bpy.ops.wm.read_factory_settings(use_empty=True)

ext = os.path.splitext(IN_PATH)[1].lower()
if ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=IN_PATH)
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=IN_PATH)
elif ext == ".obj":
    # Blender 4.x+ renamed the fast C++ importer; keep the legacy name working.
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=IN_PATH)
    else:
        bpy.ops.import_scene.obj(filepath=IN_PATH)
elif ext == ".dae":
    bpy.ops.wm.collada_import(filepath=IN_PATH)
elif ext == ".blend":
    with bpy.data.libraries.load(IN_PATH) as (src, dst):
        dst.objects = src.objects
    for o in dst.objects:
        if o is not None:
            bpy.context.collection.objects.link(o)
else:
    raise SystemExit(f"UNSUPPORTED: {ext}")

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("NO_MESHES: the importer produced no geometry")

for o in bpy.data.objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
tris_in = sum(len(o.data.loop_triangles) for o in meshes)
print(f"imported: {len(meshes)} meshes, {tris_in} tris, "
      f"{len(bpy.data.materials)} materials, {len(bpy.data.images)} images")


def world_bbox():
    pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
    lo = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts),
                           min(p.z for p in pts)))
    hi = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts),
                           max(p.z for p in pts)))
    return lo, hi


lo, hi = world_bbox()
size = hi - lo
print(f"source size: {size.x:.3f} x {size.y:.3f} x {size.z:.3f} m")

# Root objects only. Children follow their parents.
#
# THIS IS THE BUG THAT SHIPPED. The old code set `o.scale` and `o.location` on
# every MESH, which are LOCAL values -- for a parented hierarchy the parent's
# transform still applies on top, so the numbers mean nothing. Flat exports came
# out fine, which is exactly why it looked like it worked; the ones with a root
# node did not. Measured afterwards: doctors_chair 420 x 444 m, shelf 20.6 m,
# the dental chair 135 m and sunk 53 m into the floor.
#
# Transforming each ROOT's matrix_world scales and moves the whole tree with it.
roots = [o for o in bpy.data.objects if o.parent is None]
print(f"hierarchy: {len(roots)} root object(s), "
      f"{len(bpy.data.objects)} objects total")


def apply_to_roots(mat):
    for r in roots:
        r.matrix_world = mat @ r.matrix_world
    bpy.context.view_layer.update()




def _trace(tag):
    bpy.context.view_layer.update()
    _lo, _hi = world_bbox()
    print("TRACE %-12s %.3f x %.3f x %.3f  base z=%+.3f"
          % (tag, _hi.x - _lo.x, _hi.y - _lo.y, _hi.z - _lo.z, _lo.z))

# --- 1. decimate, BEFORE any transform ----------------------------------------
#
# Order matters, and this cost real time to find. Applying a DECIMATE modifier
# to a parented hierarchy DISTURBS the transform: traced on carestream_xray, the
# asset measured 1.550 m with its base at z=0.000 before the decimate and
# 1.897 m at z=-0.344 immediately after, with nothing else touching it.
#
# So decimate first on the raw import, then scale and ground. Once the transform
# is set, nothing later is allowed to move it.
for o in meshes:
    o.data.calc_loop_triangles()
tris_now = sum(len(o.data.loop_triangles) for o in meshes)
if tris_now > TRIS:
    ratio = TRIS / tris_now
    for o in meshes:
        m = o.modifiers.new("budget", type="DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    for o in meshes:
        o.data.calc_loop_triangles()
    tris_now = sum(len(o.data.loop_triangles) for o in meshes)
    print(f"decimated {tris_in} -> {tris_now} tris (budget {TRIS})")
else:
    print(f"tris {tris_now} already within budget {TRIS}")


# --- 2. scale -----------------------------------------------------------------
# RE-MEASURE first. Decimation changes the bounding box (measured on
# carestream_xray: 0.322 -> 0.394 m), so computing the scale factor from the
# pre-decimate reading overshoots -- it asked for 1.55 m and produced 1.897.
bpy.context.view_layer.update()
lo, hi = world_bbox()
size = hi - lo

if HEIGHT:
    tallest = max(size.x, size.y, size.z)
    if tallest < 1e-9:
        raise SystemExit("DEGENERATE: asset has zero size")
    k = HEIGHT / tallest
    apply_to_roots(mathutils.Matrix.Scale(k, 4))
    lo, hi = world_bbox()
    size = hi - lo
    print(f"scaled by {k:.4f} -> {size.x:.3f} x {size.y:.3f} x {size.z:.3f} m")

# --- 3. ground and centre -----------------------------------------------------
# Feet on the floor, centred in X/Y. Placement then comes from layout.ts alone,
# which is the whole reason the chair, its collider and its interaction point
# stopped drifting apart.
offset = mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
apply_to_roots(mathutils.Matrix.Translation(-offset))

if YAW:
    apply_to_roots(mathutils.Matrix.Rotation(YAW, 4, "Z"))

lo, hi = world_bbox()
print(f"grounded: z {lo.z:.3f}..{hi.z:.3f}, centred at "
      f"({(lo.x+hi.x)/2:.3f}, {(lo.y+hi.y)/2:.3f})")

# --- 4. flat shading and the one palette --------------------------------------
# Flat, because the art direction is faceted and because a hard edge is where a
# baked contact shadow becomes visible.
for o in meshes:
    for p in o.data.polygons:
        p.use_smooth = False

def diffuse_image(mat):
    """The image feeding Base Color, if there is one."""
    if not mat or not mat.use_nodes:
        return None
    bsdf = next((n for n in mat.node_tree.nodes
                 if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        link = next((l for l in mat.node_tree.links
                     if l.to_node is bsdf and l.to_socket.name == "Base Color"), None)
        if link and link.from_node.type == "TEX_IMAGE" and link.from_node.image:
            return link.from_node.image
    # Some exporters route Base Color through a mix or normal-map chain; fall
    # back to whatever image is present rather than giving up on the asset.
    #
    # NOTE: no `has_data` check. A glTF's images are PACKED and load lazily, so
    # has_data is False until something touches the pixels — gating on it made
    # every downloaded asset report "no usable diffuse image" and fall through to
    # a single flat colour. Measured on tool_cart, which carries
    # tool_cart_diff_1k and was still rejected.
    for node in mat.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image:
            n = node.image.name.lower()
            if any(k in n for k in ("nor", "rough", "arm", "metal", "spec", "disp", "ao")):
                continue          # not a colour map
            return node.image
    return None


def bake_texture_to_vertices(obj):
    """Sample the diffuse map per vertex, so the texture can then be thrown away.

    Snapping a whole material to one palette colour is fine for an asset built
    out of separate parts, but ruins a single-material photoreal model: the
    barber chair came back as one flat white silhouette, because ALL of its
    detail — the leather, the chrome, the footplate — lives in one texture, not
    in the material colour.

    Sampling the map at each vertex keeps that detail as vertex colour, which is
    the only channel this game ships. The 1-4K maps are then deleted and never
    reach the browser.

    Nearest-neighbour is deliberate: the mesh has just been decimated to a few
    thousand triangles, so bilinear filtering would be lost precision for real
    cost.
    """
    me = obj.data
    if not me.uv_layers:
        print(f"    {obj.name}: no UV layer -> cannot sample")
        return False
    uv = me.uv_layers.active
    if uv is None:
        print(f"    {obj.name}: no active UV layer")
        return False

    per_slot = {}
    for i, slot in enumerate(obj.material_slots):
        img = diffuse_image(slot.material)
        if img is None:
            continue
        w, h = img.size
        if w == 0 or h == 0:
            continue
        # Cap before reading. A 4K map is 67 million floats via foreach_get,
        # which crashes Blender outright rather than raising.
        if w > 512 or h > 512:
            img.scale(min(w, 512), min(h, 512))
            w, h = img.size
        buf = [0.0] * (w * h * 4)
        try:
            # Touching .pixels is what forces a packed image to decode.
            img.pixels.foreach_get(buf)
        except Exception as e:
            print(f"    {obj.name}: could not read {img.name}: {e}")
            continue
        per_slot[i] = (buf, w, h)
    if not per_slot:
        found = [(sl.material.name if sl.material else "-",
                  [n.image.name for n in (sl.material.node_tree.nodes if sl.material
                   and sl.material.use_nodes else []) if n.type == "TEX_IMAGE" and n.image])
                 for sl in obj.material_slots]
        print(f"    {obj.name}: no usable diffuse image. slots={found}")
        return False

    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    col = me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    me.color_attributes.active_color_index = 0

    out = [0.0] * (len(me.loops) * 4)
    for poly in me.polygons:
        got = per_slot.get(poly.material_index)
        for li in poly.loop_indices:
            o = li * 4
            if got is None:
                out[o] = out[o + 1] = out[o + 2] = 0.8
                out[o + 3] = 1.0
                continue
            buf, w, h = got
            u, v = uv.data[li].uv
            x = int((u % 1.0) * w)
            y = int((v % 1.0) * h)      # Blender images start at the BOTTOM row
            p = (y * w + x) * 4
            out[o] = buf[p]
            out[o + 1] = buf[p + 1]
            out[o + 2] = buf[p + 2]
            out[o + 3] = 1.0
    col.data.foreach_set("color", out)
    me.update()
    return True


def average_texture_colour(mat):
    """Mean colour of whatever image feeds Base Color.

    A downloaded asset carries its colour in a texture, not in the BSDF's flat
    value — which is usually left at default white. Reading the flat value alone
    therefore maps every textured asset to the same palette entry regardless of
    what it actually looks like. Averaging the diffuse map recovers the real
    colour before the map is thrown away.
    """
    if not mat.use_nodes:
        return None
    for node in mat.node_tree.nodes:
        if node.type != "TEX_IMAGE" or not node.image:
            continue
        img = node.image
        if not img.has_data or img.size[0] == 0:
            continue
        px = img.pixels[:]
        step = max(4, (len(px) // 4 // 4000) * 4)   # sample ~4k texels, no more
        n = 0
        acc = [0.0, 0.0, 0.0]
        for i in range(0, len(px) - 3, step):
            if px[i + 3] < 0.5:
                continue        # transparent texels are not this asset's colour
            acc[0] += px[i]
            acc[1] += px[i + 1]
            acc[2] += px[i + 2]
            n += 1
        if n:
            return (acc[0] / n, acc[1] / n, acc[2] / n)
    return None


# --- 4a. texture -> vertex colour (the default path) --------------------------
# Done BEFORE the materials are rebuilt, while the images and UVs still exist.
sampled = []
if not PALETTE:
    for o in meshes:
        if bake_texture_to_vertices(o):
            sampled.append(o.name)
    if sampled:
        print(f"sampled diffuse map into vertex colours: {len(sampled)} mesh(es)")

# Rebuild every material as a clean flat Principled.
#
# Deleting the images while leaving their Image Texture nodes wired in is a trap:
# a texture node with no image evaluates to BLACK, so Base Color goes black, and
# the whole asset bakes to pure zero irradiance. Measured on the barber chair —
# `min 0.000 p98 0.000 max 0.000`. Strip the tree instead of gutting it.
mapped = {}
for mat in bpy.data.materials:
    src = average_texture_colour(mat)
    if src is None and mat.use_nodes:
        bsdf = next((n for n in mat.node_tree.nodes
                     if n.type == "BSDF_PRINCIPLED"), None)
        src = tuple(bsdf.inputs["Base Color"].default_value[:3]) if bsdf else (0.8,) * 3
    src = src or (0.8, 0.8, 0.8)

    if PALETTE:
        name = nearest_palette(src)
        out = shift_value(name, src)
        mapped.setdefault(name, []).append(mat.name)
    else:
        out = src

    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    outp = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf.inputs["Base Color"].default_value = (*out, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.75
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], outp.inputs["Surface"])
    mat.diffuse_color = (*out, 1.0)

    # Where the texture was sampled into vertex colours, drive Base Color from
    # them instead of from a single flat value -- otherwise every asset with one
    # material comes back as one flat silhouette, which is what happened to the
    # barber chair. Also required for the glTF exporter to emit COLOR_0 at all.
    if sampled:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])

for name in sorted(mapped):
    print(f"  palette {name:10} <- {', '.join(mapped[name][:5])}")

# Only now are the textures unreferenced and safe to drop.
for img in list(bpy.data.images):
    bpy.data.images.remove(img)

if PREFIX:
    for i, o in enumerate(sorted(meshes, key=lambda x: x.name)):
        o.name = f"{PREFIX}{i:02d}"

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=True,
    export_texcoords=False,
    export_normals=True,
)
# --- 8. VERIFY THE OUTPUT ------------------------------------------------------
# The scaling bug shipped silently because nothing ever checked the result. A
# transform that reports success and produces a 420-metre stool is worse than
# one that fails, so the script now measures what it actually made and refuses
# to claim success if it is wrong.
bpy.context.view_layer.update()
lo, hi = world_bbox()
size = hi - lo
print(f"size: {size.x:.3f} x {size.y:.3f} x {size.z:.3f} m  base z={lo.z:+.3f}")

problems = []
if HEIGHT:
    got = max(size.x, size.y, size.z)
    if abs(got - HEIGHT) > HEIGHT * 0.02:
        problems.append(f"height {got:.3f} m, asked for {HEIGHT:.3f} m")
if abs(lo.z) > 0.005:
    problems.append(f"base sits at z={lo.z:+.3f}, should be 0")
if max(size) > 12.0:
    problems.append(f"largest dimension {max(size):.1f} m is bigger than the room")
if problems:
    raise SystemExit("BAD_TRANSFORM: " + "; ".join(problems))

print("IMPORT_OK")
