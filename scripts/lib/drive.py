import bpy, sys, os, time, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure as M
from mathutils import Vector

MODELS = "D:/My Apps/study-game/public/models"
t0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- SELF TEST of the placement helpers on synthetic geometry -------------
bpy.ops.mesh.primitive_cube_add(size=1.0)
p = bpy.context.active_object; p.name = "P"; p.location = (3, 0, 1)
bpy.ops.mesh.primitive_cube_add(size=0.4)
c = bpy.context.active_object; c.name = "C"; c.parent = p; c.location = (0, 0, 5)
M.touch()
print("SELFTEST stale_check  location_set_then_read_matrix_world:",
      tuple(round(v, 3) for v in c.matrix_world.translation), "(pre-sync, may be stale)")
M.sync()
print("SELFTEST world_after_sync:", tuple(round(v, 3) for v in c.matrix_world.translation))
M.stack(c, p, clear=0.05)
print("SELFTEST stack(child_of_moved_parent, base, clear=0.05) -> bottom(C)=%.4f top(P)=%.4f gap=%.4f"
      % (M.bottom(c), M.top(p), M.bottom(c) - M.top(p)))
print("SELFTEST resulting c.location (Blender solved it):",
      tuple(round(v, 4) for v in c.location))
try:
    M.require(bpy.ops.object.transform_apply(location=True), "transform_apply")
except M.LayoutError as e:
    print("SELFTEST require() caught:", e)
print("SELFTEST clearance(P,C) = %.4f" % M.clearance(p, c))
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- load the two SHIPPED assets -----------------------------------------
t1 = time.time()
bpy.ops.import_scene.gltf(filepath=MODELS + "/patient.glb")
pat_names = set(o.name for o in bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=MODELS + "/dental_chair.glb")
chair_names = set(o.name for o in bpy.data.objects) - pat_names
M.touch(); M.unlock_rotation(); M.sync()
print("IMPORT_MS %d  patient_objs=%d chair_objs=%d" %
      ((time.time() - t1) * 1000, len(pat_names), len(chair_names)))

O = bpy.data.objects
PAT = [O[n] for n in pat_names if O[n].type == 'MESH']
CHR = [O[n] for n in chair_names if O[n].type == 'MESH']

# ---- FACT 1: where is the patient's origin relative to her own body? ------
proot = O["Patient"] if "Patient" in O else O["Pelvis"]
lo, hi = M.aabb_tree(proot)
print("PATIENT_BOUNDS_BLENDER lo=%s hi=%s" %
      (tuple(round(v, 4) for v in lo), tuple(round(v, 4) for v in hi)))
print("PATIENT_ORIGIN_IS_ABOVE_HER_LOWEST_POINT_BY %.4f m" % (0.0 - lo.z))

croot = O["DentalChair"] if "DentalChair" in O else None
clo, chi = M.aabb_tree(croot)
print("CHAIR_BOUNDS_BLENDER lo=%s hi=%s" %
      (tuple(round(v, 4) for v in clo), tuple(round(v, 4) for v in chi)))
print("CHAIR_BOUNDS_GAME_XZ x=[%.3f, %.3f] z=[%.3f, %.3f]   layout.ts declares x=+/-0.42 z=[-0.55, 0.62]"
      % (clo.x, chi.x, -chi.y, -clo.y))

# ---- FACT 2: the recline pair -------------------------------------------
try:
    M.assert_parallel(O["Chest"], O["Backrest"], tol_deg=0.5)
    print("RECLINE ok")
except M.LayoutError as e:
    print("RECLINE FAIL:", e)

# ---- FACT 3: the hair helmet --------------------------------------------
try:
    M.assert_encloses(O["Head"], O["Hair"])
    print("HAIR ok")
except M.LayoutError as e:
    print("HAIR FAIL:", e)

# ---- FACT 4: seat the patient exactly as the game does -------------------
# layout.ts SEAT_LOCAL = [0, 0.46, 0.02] in three.js -> Blender (0, -0.02, 0.46)
M.put_world(proot, (0.0, -0.02, 0.46))
M.sync()
ALL = PAT + CHR
t2 = time.time()
h = M.hits(ALL)
sweep_ms = (time.time() - t2) * 1000
cross = [(a, b, n) for a, b, n in h
         if (a.name in pat_names) != (b.name in pat_names)]
print("SWEEP_MS %d  objects=%d  total_hits=%d  cross_asset_hits=%d"
      % (sweep_ms, len(ALL), len(h), len(cross)))
for a, b, n in cross[:12]:
    print("   CROSS %-12s x %-14s %3d faces  depth %s"
          % (a.name, b.name, n, tuple(round(-v, 3) for v in M.gap(a, b))))

# ---- FACT 5: named clearances -------------------------------------------
for a, b in (("Tray", "Chest"), ("Tray", "Jaw"), ("TrayArm", "Chest"),
             ("LegRest", "ShinL"), ("Spittoon", "ThighR"), ("Column", "Pelvis")):
    if a in O and b in O:
        print("CLEARANCE %-9s <-> %-7s = %+.4f m" % (a, b, M.clearance(O[a], O[b])))

# ---- FACT 6: compute the fix instead of guessing it ---------------------
tray = O["Tray"]; chest = O["Chest"]
lap_z = max(M.top(O["ThighL"]), M.top(O["ThighR"]))
target_z = lap_z + 0.06
target_back_y = M.front(chest) - 0.08
M.shift_world(tray, (0, target_back_y - M.back(tray), target_z - M.bottom(tray)))
print("TRAY_FIX lap_top=%.4f chest_front=%.4f -> clearance(Tray,Chest)=%+.4f clearance(Tray,ThighL)=%+.4f"
      % (lap_z, M.front(chest), M.clearance(tray, chest), M.clearance(tray, O["ThighL"])))

# ---- FACT 7: pose sweep, with and without the quaternion unlock ---------
jaw = O["Jaw"]
jaw.rotation_mode = 'QUATERNION'
before = M.aabb(jaw)[0].z
jaw.rotation_euler[0] += 0.62
M.touch(); M.sync()
print("QUAT_TRAP jaw moved when writing rotation_euler in QUATERNION mode:",
      abs(M.aabb(jaw)[0].z - before) > 1e-6)
jaw.rotation_mode = 'XYZ'
before = M.aabb(jaw)[0].z
jaw.rotation_euler[0] += 0.62
M.touch(); M.sync()
print("QUAT_FIX  jaw moved after rotation_mode='XYZ':",
      abs(M.aabb(jaw)[0].z - before) > 1e-6, "delta=%.4f" % (M.aabb(jaw)[0].z - before))

print("TOTAL_MS %d" % ((time.time() - t0) * 1000))
print("DRIVE_OK")
