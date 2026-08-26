"""
Bake the clinic's lighting into vertex colours and re-export, unlit.

WHY
---
Measured across the 28 shipped GLBs: every one carried POSITION, NORMAL,
TEXCOORD_0 and nothing else. Zero COLOR_0, zero images, zero shadow-casting
lights. The only shading variation in the whole frame was the N.L term from two
directional lights, so nothing ever got darker where it tucked into something
else -- not under the chin, not where the chair column meets the floor, not in a
wall corner. That single absence is the biggest reason the scene read as
programmer art.

WHY FULL LIGHTING AND NOT JUST AO
---------------------------------
The first version baked ambient occlusion only. Rendered side by side it did add
contact darkening -- and it flattened everything else, because AO has no
directional term at all. The backrest lost the gradient that made it read as a
solid slab. A bake that removes more form than it adds is not an upgrade.

So this bakes DIFFUSE irradiance from a Cycles rig that mirrors the game's own
ClinicLighting() -- same key, same fill, same hemisphere colours -- with two
bounces of GI. That yields occlusion AND directional shading AND colour bleed in
one pass, for zero download bytes and zero VRAM.

The result renders with MeshBasicMaterial, which is CHEAPER per fragment than
the MeshLambertMaterial it replaces. The scene gets prettier and faster at once.

WHY THE PROXY ROOM
------------------
Baked in empty space, an asset floats: no contact shadow where its base meets
the floor, no warm bounce onto its undersides, and full unoccluded sky on every
upward face because there is no ceiling to block it. The chair's first bake had
exactly that tell.

So the bake happens inside a proxy shell of the real room -- 8x8 m, 2.8 m
ceiling, the palette's own floor/wall/ceiling colours from theme3d.ts -- with
the asset standing where layout.ts actually puts it. The shell casts, occludes
and bounces, then gets deleted before export. It never ships.

Usage:
    blender --background --factory-startup --python bake_vertex_light.py -- \
        <in.glb> <out.glb> [subdiv] [floor_lift] [x,y,z] [yaw]

    x,y,z  where the asset stands, in THREE.JS world coords (default origin)
    yaw    its Y rotation in radians (default 0)

THE FIVE TRAPS, all of which fail SILENTLY
------------------------------------------
A. `scene.render.engine = 'CYCLES'` works, but the engine enum does not list it
   even after enabling the addon. Assign directly; never gate on the enum.
B. Baking is not enough. Unless a ShaderNodeVertexColor is actually WIRED into
   the material's node tree, the glTF exporter drops COLOR_0 with only a
   warning, and you ship a file that looks identical to an unbaked one.
B2. Exactly ONE colour attribute per mesh. The glTF importer leaves one behind;
   adding another yields COLOR_0 and COLOR_1, and three.js reads whichever it
   feels like. Also CORNER domain, not POINT -- per-vertex cannot hold a hard
   colour break across an edge, which is the entire point of flat shading.
C. `bpy.ops.object.bake` operates on the SELECTION. A stray light in the
   selection raises "Object X is not a mesh" and the whole bake dies.
D. Wire the vertex-colour node AFTER baking, never before. Indirect light
   bounces off Base Color, so if Base Color is already the (still black) vertex
   attribute, every bounce returns zero and the GI silently disappears.
E. Bake into FLOAT_COLOR, not BYTE_COLOR. Irradiance from a sun runs well above
   1.0, and an 8-bit attribute clamps it on the way in -- every lit surface
   saturates to white and the entire directional term is gone before there is
   any chance to normalise. Measured on the chair: p98 and max both landed at
   exactly 1.000, which is what clipping looks like. Convert to BYTE_COLOR only
   after normalising, when the values genuinely are inside 0..1.
"""
import os
import sys
import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
IN_GLB, OUT_GLB = argv[0], argv[1]
SUBDIV = int(argv[2]) if len(argv) > 2 else 1
# Pure black reads as a hole rather than a shadow, and the art direction wants
# contact darkening, not absence.
FLOOR = float(argv[3]) if len(argv) > 3 else 0.30
PLACE = tuple(float(v) for v in argv[4].split(",")) if len(argv) > 4 else (0, 0, 0)
YAW = float(argv[5]) if len(argv) > 5 else 0.0
# Trap I: a MOVING object must not have directional light baked into it.
#
# The patient walks in, turns, and sits. Bake the key light into her body and
# the sun turns with her -- her lit side stays lit no matter which way she
# faces, which reads as deeply wrong the moment she rotates. Static furniture
# never moves, so for furniture the full bake is free realism.
#
# So movers get AO only: self-occlusion under the chin, in the armpits, between
# the legs. That deforms with the mesh and stays correct at any angle. They then
# render with MeshLambertMaterial({vertexColors:true}), which multiplies the
# baked occlusion by the runtime lighting -- so they still get real directional
# light, just computed live instead of frozen in.
AO_ONLY = "--ao" in argv
# Auto-derived AO radius works for a body or a cabinet, but not for a dense
# assembly. The mouth is 32 teeth packed inside gum collars: at the derived
# 17 mm every ray hits a neighbour and the whole arch bakes 90% black
# (measured p98 0.000, max 0.125). Its useful radius is the size of the GAPS,
# a couple of millimetres -- so allow an explicit override.
AO_DIST = float(argv[argv.index("--aodist") + 1]) if "--aodist" in argv else None

# src/clinic/theme3d.ts: ROOM_HALF = 4, and Room.tsx: const H = 2.8
ROOM_HALF, ROOM_H = 4.0, 2.8
C_FLOOR, C_WALL, C_CEIL = 0xCBB9A4, 0xF4ECE1, 0xFCF8F3

ATTR = "Col"           # what ships: 8-bit, one byte per channel
BAKE_ATTR = "Bake"     # scratch: 32-bit float, so the bake cannot clip
SENTINEL = 7777.0     # positive: a negative sentinel is clamped away on write


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h):
    r, g, b = ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def three_to_blender(v):
    """three.js is Y-up, Blender is Z-up: (x, y, z) -> (x, -z, y)."""
    x, y, z = v
    return (x, -z, y)


def enable_cycles():
    """Trap A: assign, don't ask."""
    import addon_utils
    try:
        addon_utils.enable("cycles", default_set=False)
    except Exception:
        pass
    try:
        bpy.context.scene.render.engine = "CYCLES"
        return True
    except Exception as e:
        print("CYCLES_UNAVAILABLE:", e)
        return False


def is_emissive(obj):
    """Does this part emit light of its own?

    Trap H: the operating light's lens does. Baked, it reads ~4.4 while the
    darkest lit surface reads ~0.5, so a percentile taken over ALL corners is
    pinned to the lamp -- and the normalisation then divides the entire asset by
    a number that has nothing to do with how lit it is. Symptom: the bake looks
    identical no matter what you change, including deleting every light and
    sealing the asset inside a windowless box. Which is exactly what happened.
    """
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "EMISSION":
                if node.inputs["Strength"].default_value > 0:
                    return True
            elif node.type == "BSDF_PRINCIPLED":
                s = node.inputs.get("Emission Strength")
                c = node.inputs.get("Emission Color") or node.inputs.get("Emission")
                if s is not None and s.default_value > 0 and c is not None \
                        and max(c.default_value[:3]) > 0:
                    return True
    return False


def albedo_of(obj):
    """The part's authored base colour, in linear, straight off the BSDF."""
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                c = node.inputs["Base Color"].default_value
                return (c[0], c[1], c[2])
    return (1.0, 1.0, 1.0)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN_GLB)

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
print("imported meshes:", len(meshes))

albedo = {o.name: albedo_of(o) for o in meshes}
emissive = {o.name for o in meshes if is_emissive(o)}
if emissive:
    print("emissive parts (excluded from the white point):", sorted(emissive))

# --- 1. give the lighting somewhere to land --------------------------------
# Flat-shaded low-poly needs vertices where the light changes. A 12-triangle
# wall has nowhere for a contact shadow to sit. SIMPLE subdivision adds density
# without rounding anything -- never Catmull-Clark, which would destroy the hard
# edges the whole art direction rests on.
if SUBDIV > 0:
    for o in meshes:
        mod = o.modifiers.new(name="light_density", type="SUBSURF")
        mod.subdivision_type = "SIMPLE"
        mod.levels = SUBDIV
        mod.render_levels = SUBDIV
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)

# --- 2. one colour attribute, CORNER domain, FLOAT (Traps B2 and E) --------
for o in meshes:
    me = o.data
    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    ca = me.color_attributes.new(name=BAKE_ATTR, type="FLOAT_COLOR",
                                 domain="CORNER")
    me.color_attributes.active_color_index = 0
    # Trap F: a fresh FLOAT_COLOR attribute is not zeroed, and a bake that
    # silently writes nowhere leaves whatever was in that memory behind. Read
    # back afterwards and it looks like a plausible distribution -- the first
    # version of this script "worked" for six runs while producing pure garbage,
    # including with every light deleted. Stamp a sentinel so a no-op bake is
    # impossible to mistake for a successful one.
    ca.data.foreach_set("color", [SENTINEL] * (len(ca.data) * 4))

# --- 3. rebuild ClinicLighting() in Cycles ----------------------------------
# src/clinic/RoomModel.tsx:
#   <hemisphereLight args={[0xfff6ea, 0xcbb79b, 0.55]} />
#   <directionalLight position={[-4, 4.5, -4]} intensity={1.7} color={0xfff0d4} />
#   <directionalLight position={[ 4, 2,    4]} intensity={0.4} color={0xd8e4ff} />
SKY, GROUND, HEMI_I = 0xFFF6EA, 0xCBB79B, 0.55
LIGHTS = (
    ("Key", (-4, 4.5, -4), 0xFFF0D4, 1.7),
    ("Fill", (4, 2, 4), 0xD8E4FF, 0.4),
)

world = bpy.data.worlds.new("Clinic")
bpy.context.scene.world = world
world.use_nodes = True
wnt = world.node_tree
for n in list(wnt.nodes):
    wnt.nodes.remove(n)
wout = wnt.nodes.new("ShaderNodeOutputWorld")
bg = wnt.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = HEMI_I
# A hemisphere light is sky above, ground below, blended by the up component of
# the incoming direction -- so drive a colour mix off the Z of the ray.
tex = wnt.nodes.new("ShaderNodeTexCoord")
sep = wnt.nodes.new("ShaderNodeSeparateXYZ")
rng = wnt.nodes.new("ShaderNodeMapRange")
rng.inputs["From Min"].default_value = -1.0
rng.inputs["From Max"].default_value = 1.0
mix = wnt.nodes.new("ShaderNodeMixRGB")
mix.inputs["Color1"].default_value = lin(GROUND)
mix.inputs["Color2"].default_value = lin(SKY)
wnt.links.new(tex.outputs["Normal"], sep.inputs["Vector"])
wnt.links.new(sep.outputs["Z"], rng.inputs["Value"])
wnt.links.new(rng.outputs["Result"], mix.inputs["Fac"])
wnt.links.new(mix.outputs["Color"], bg.inputs["Color"])
wnt.links.new(bg.outputs["Background"], wout.inputs["Surface"])

for name, pos, colour, intensity in LIGHTS:
    ld = bpy.data.lights.new(name, type="SUN")
    ld.color = lin(colour)[:3]
    # three.js directional intensity is unitless; Cycles SUN strength is
    # irradiance. The exact factor does not matter because step 5 normalises --
    # what matters is that key and fill keep their 1.7 : 0.4 ratio.
    ld.energy = intensity * 3.0
    ld.angle = 0.09
    # Trap G: the key and fill must NOT cast shadows.
    #
    # three.js casts none -- no light in ClinicLighting() has `castShadow`, and
    # nothing in the scene has `receiveShadow`. More practically, both lights
    # sit OUTSIDE the room (y=4.5 against a 2.8 m ceiling), so a shadow-casting
    # proxy room blocks them completely and every asset bakes pitch black.
    #
    # With shadows off, the suns supply exactly the directional term the game
    # already has, while the proxy room still occludes the AMBIENT world light.
    # The bake is then strictly the current look plus the occlusion it lacks --
    # an addition with no regression.
    ld.use_shadow = False
    lo = bpy.data.objects.new(name, ld)
    p = three_to_blender(pos)
    lo.location = p
    lo.rotation_euler = (-mathutils.Vector(p)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(lo)

# --- 3b. the proxy room ------------------------------------------------------
# Built in the ASSET's local frame rather than the room's, so the exported mesh
# never moves and the GLB stays a drop-in replacement. The asset conceptually
# stands at PLACE with rotation YAW, so the room as the asset sees it is that
# transform inverted.
_off = mathutils.Vector(three_to_blender(PLACE))
_rot = mathutils.Matrix.Rotation(-YAW, 3, "Z")


def surface(name, corners, colour):
    # Corners arrive in ROOM coordinates and are baked into the mesh already
    # transformed into the asset's local frame. Doing the transform here rather
    # than with a parent empty keeps the shell independent of depsgraph
    # evaluation order, which is the kind of thing that silently produces a
    # correct-looking matrix_world and no actual occlusion.
    local = [tuple(_rot @ (mathutils.Vector(c) - _off)) for c in corners]
    me = bpy.data.meshes.new(name)
    me.from_pydata(local, [], [(0, 1, 2, 3)])
    me.validate()
    me.update()
    mat = bpy.data.materials.new(f"proxy_{name}")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = \
        lin(colour)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


R, H = ROOM_HALF, ROOM_H
shell = [
    surface("pFloor", [(-R, -R, 0), (R, -R, 0), (R, R, 0), (-R, R, 0)], C_FLOOR),
    surface("pCeil", [(-R, -R, H), (-R, R, H), (R, R, H), (R, -R, H)], C_CEIL),
    surface("pW1", [(-R, -R, 0), (-R, R, 0), (-R, R, H), (-R, -R, H)], C_WALL),
    surface("pW2", [(R, -R, 0), (R, -R, H), (R, R, H), (R, R, 0)], C_WALL),
    surface("pW3", [(-R, -R, 0), (-R, -R, H), (R, -R, H), (R, -R, 0)], C_WALL),
    surface("pW4", [(-R, R, 0), (R, R, 0), (R, R, H), (-R, R, H)], C_WALL),
]
bpy.context.view_layer.update()

if os.environ.get("BAKE_DEBUG"):
    # Render the bake scene itself. When a bake result looks wrong, the fastest
    # way to find out why is to photograph the scene it was computed in.
    dc = bpy.data.cameras.new("Debug")
    dc.lens = 24
    dcam = bpy.data.objects.new("Debug", dc)
    dcam.location = (-2.4, -3.0, 1.8)
    dcam.rotation_euler = (
        mathutils.Vector((0, 0, 0.7)) - mathutils.Vector(dcam.location)
    ).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(dcam)
    bpy.context.scene.camera = dcam
    enable_cycles()
    bpy.context.scene.cycles.samples = 24
    bpy.context.scene.render.resolution_x = 700
    bpy.context.scene.render.resolution_y = 560
    bpy.context.scene.render.filepath = os.environ["BAKE_DEBUG"]
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(dcam, do_unlink=True)
    print("DEBUG_RENDER:", os.environ["BAKE_DEBUG"])

# --- 4. bake irradiance (Traps C and D) -------------------------------------
if enable_cycles():
    sc = bpy.context.scene
    sc.cycles.samples = 128
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 2          # enough for one colour bleed, cheap
    sc.cycles.diffuse_bounces = 2
    sc.render.bake.target = "VERTEX_COLORS"
    sc.render.bake.use_pass_direct = True
    sc.render.bake.use_pass_indirect = True
    # Colour OFF: bake the LIGHT, not light-times-albedo. The albedo is folded
    # back in at step 5, which keeps the two separable and the result tunable.
    sc.render.bake.use_pass_color = False

    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]

    if AO_ONLY:
        # Trap J: AO distance must scale with the asset, not be a constant.
        #
        # At a fixed 0.5 m, every ray leaving a 5 cm mouth hits something, so
        # the whole model bakes fully occluded -- measured max 0.000, i.e. solid
        # black. Derive the radius from the asset's own size so a mouth, a
        # patient and a cabinet all get sensible contact darkening.
        _pts = [o.matrix_world @ mathutils.Vector(c)
                for o in meshes for c in o.bound_box]
        _span = max(max(p[i] for p in _pts) - min(p[i] for p in _pts)
                    for i in range(3))
        sc.world.light_settings.distance = AO_DIST or max(0.015, 0.25 * _span)
        print(f"asset span {_span:.3f} m -> AO distance "
              f"{sc.world.light_settings.distance:.3f} m")
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)
    else:
        bpy.ops.object.bake(type="DIFFUSE", target="VERTEX_COLORS",
                            use_clear=True)
    print("BAKED")
else:
    print("SKIPPED_BAKE")

# --- 5. normalise, lift, and fold the albedo back in ------------------------
# After this the vertex colour IS the final shipped colour, so three.js renders
# it with MeshBasicMaterial({ vertexColors: true }) and a white material -- no
# lights, no per-fragment lighting maths.
#
# Normalising against a high percentile rather than the max keeps one stray
# blown-out corner from dragging the whole asset dark.
buffers = {}
allvals = []
for o in meshes:
    ca = o.data.color_attributes[BAKE_ATTR]
    buf = [0.0] * (len(ca.data) * 4)
    ca.data.foreach_get("color", buf)
    buffers[o.name] = buf
    if o.name not in emissive:
        allvals.extend(buf[0::4])

allvals.sort()
if allvals[0] == SENTINEL:
    raise SystemExit("BAKE_WROTE_NOTHING: every corner still holds the sentinel")
if any(v == SENTINEL for v in allvals):
    raise SystemExit("BAKE_PARTIAL: some corners still hold the sentinel")
# AO already lands in 0..1 by definition, so normalising it would only stretch
# whatever the darkest crevice happened to be.
white = 1.0 if AO_ONLY else (
    max(allvals[int(len(allvals) * 0.98)], 1e-6) if allvals else 1.0)
# Trap K: refuse to ship a black prop.
#
# Two small props on raised surfaces baked to min/p98/max all exactly 0.000 --
# no light reached them at all. Whatever the cause (degenerate normals after
# aggressive decimation is the prime suspect), the result would be a solid black
# object in the room, which is far worse than an unlit but correctly coloured
# one. So when the bake produces nothing, fall back to full albedo and SAY SO,
# rather than multiplying every vertex by zero and calling it done.
DEAD_BAKE = (not AO_ONLY) and bool(allvals) and allvals[-1] < 1e-6
if DEAD_BAKE:
    print("BAKE_PRODUCED_NO_LIGHT: falling back to flat albedo")

_p98 = allvals[int(len(allvals) * 0.98)] if allvals else 0.0
print(f"{'occlusion' if AO_ONLY else 'irradiance'}: min {allvals[0]:.3f}  "
      f"p98 {_p98:.3f}  max {allvals[-1]:.3f}"
      + ("" if AO_ONLY else f"  (white point {white:.3f})"))

for o in meshes:
    # Trap E: swap the float scratch attribute for the 8-bit one that ships.
    # Values are in 0..1 only AFTER normalising, so the conversion has to happen
    # here and not before the bake -- doing it earlier clamps every lit surface
    # to pure white and silently discards all the directional shading.
    me = o.data
    for old in list(me.color_attributes):
        me.color_attributes.remove(old)
    ca = me.color_attributes.new(name=ATTR, type="BYTE_COLOR", domain="CORNER")
    me.color_attributes.active_color_index = 0
    buf = buffers[o.name]
    r0, g0, b0 = albedo[o.name]
    # An emitter is not lit by the room -- it IS a light. Darkening it by the
    # room's occlusion would turn the operating lamp's lens grey.
    # DEAD_BAKE forces full albedo everywhere: see Trap K.
    lit = o.name not in emissive and not DEAD_BAKE
    for i in range(0, len(buf), 4):
        if lit:
            k = buf[i] / white
            if k > 1.0:
                k = 1.0
            k = FLOOR + (1.0 - FLOOR) * k
        else:
            k = 1.0
        buf[i] = r0 * k
        buf[i + 1] = g0 * k
        buf[i + 2] = b0 * k
        buf[i + 3] = 1.0
    ca.data.foreach_set("color", buf)
    o.data.update()

# --- 6. wire the attribute into every material (Trap B, in Trap D's order) --
for o in meshes:
    for slot in o.material_slots:
        mat = slot.material
        if not mat:
            continue
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = ATTR
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])

# --- 7. export --------------------------------------------------------------
# The proxy room did its job during the bake. It must not reach the GLB.
for o in shell:
    bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_apply=False,
    export_yup=True,
    # ACTIVE, not MATERIAL: the MATERIAL default only emits COLOR_0 when the
    # material contains a Color Attribute node, which is exactly the silent
    # failure this script exists to avoid.
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=True,
    # Nothing samples a UV any more, and TEXCOORD_0 was pure dead weight.
    export_texcoords=False,
    export_normals=True,
)

for o in bpy.data.objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
tris = sum(len(o.data.loop_triangles) for o in bpy.data.objects if o.type == "MESH")
print("TRIS:", tris)
print("BAKE_OK")
