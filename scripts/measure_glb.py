"""
Measure a .glb the way a renderer sees it: WORLD space, node transforms applied.

WHY THIS EXISTS
---------------
The obvious way to measure a glTF is to read `accessors[POSITION].min/max`,
which the format helpfully precomputes. That number is a lie for any asset whose
scale lives in the node hierarchy rather than in the vertex data -- which is
most of them, and all of the ones exported from Blender, because the exporter
writes object transforms as node TRS and leaves the mesh data alone.

Measuring that way reported `doctors_chair` at 15,596 metres and then, after a
correct re-export, reported it at 15,596 metres again -- identical numbers for
a file that had genuinely changed, because the vertex data legitimately never
moved. An hour was nearly spent "fixing" an export that was already correct.

So: walk the scene graph, compose parent matrices, transform the eight corners
of every primitive's local bbox, and take the extent of that. Slower, correct.

Usage:
    python scripts/measure_glb.py public/models/props/*.glb
"""
import json
import struct
import sys
import glob
import os


def read_gltf_json(path: str) -> dict:
    with open(path, "rb") as f:
        data = f.read()
    if data[:4] != b"glTF":
        raise ValueError("not a binary glTF")
    off = 12
    while off < len(data):
        length, kind = struct.unpack_from("<II", data, off)
        if kind == 0x4E4F534A:  # 'JSON'
            return json.loads(data[off + 8 : off + 8 + length])
        off += 8 + length
    raise ValueError("no JSON chunk")


def mat_identity():
    return [1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0]


def mat_mul(a, b):
    """Column-major 4x4, glTF convention: result = a * b."""
    out = [0.0] * 16
    for c in range(4):
        for r in range(4):
            out[c * 4 + r] = sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
    return out


def node_matrix(node: dict):
    if "matrix" in node:
        return list(node["matrix"])
    t = node.get("translation", [0, 0, 0])
    r = node.get("rotation", [0, 0, 0, 1])  # xyzw
    s = node.get("scale", [1, 1, 1])
    x, y, z, w = r
    # rotation as a column-major 3x3, then scaled per axis
    rot = [
        1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
        2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
        2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
    ]
    m = [0.0] * 16
    for c in range(3):
        for r_ in range(3):
            m[c * 4 + r_] = rot[c * 3 + r_] * s[c]
    m[12], m[13], m[14] = t
    m[15] = 1.0
    return m


def apply(m, p):
    x, y, z = p
    return (
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    )


def measure(path: str):
    js = read_gltf_json(path)
    nodes = js.get("nodes", [])
    meshes = js.get("meshes", [])
    accessors = js.get("accessors", [])
    scenes = js.get("scenes", [{}])
    roots = scenes[js.get("scene", 0)].get("nodes", list(range(len(nodes))))

    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    seen_any = False

    stack = [(i, mat_identity()) for i in roots]
    while stack:
        idx, parent = stack.pop()
        node = nodes[idx]
        world = mat_mul(parent, node_matrix(node))
        if "mesh" in node:
            for prim in meshes[node["mesh"]]["primitives"]:
                pos = prim.get("attributes", {}).get("POSITION")
                if pos is None:
                    continue
                acc = accessors[pos]
                if "min" not in acc or "max" not in acc:
                    continue
                a, b = acc["min"], acc["max"]
                # all eight corners, because rotation makes the axis-aligned
                # local box a non-axis-aligned box in world space
                for cx in (a[0], b[0]):
                    for cy in (a[1], b[1]):
                        for cz in (a[2], b[2]):
                            wx, wy, wz = apply(world, (cx, cy, cz))
                            for i, v in enumerate((wx, wy, wz)):
                                lo[i] = min(lo[i], v)
                                hi[i] = max(hi[i], v)
                            seen_any = True
        for child in node.get("children", []):
            stack.append((child, world))

    if not seen_any:
        return None
    return [hi[i] - lo[i] for i in range(3)], lo


def main(argv):
    paths = []
    for a in argv:
        paths.extend(sorted(glob.glob(a)))
    if not paths:
        print("no files matched")
        return 1
    for p in paths:
        try:
            result = measure(p)
        except Exception as exc:
            print(f"  {os.path.basename(p):24s} ERROR {exc}")
            continue
        if result is None:
            print(f"  {os.path.basename(p):24s} no geometry")
            continue
        size, lo = result
        kb = os.path.getsize(p) / 1024
        flag = ""
        if max(size) > 6.0:
            flag = "  <-- too big for a room"
        elif abs(lo[1]) > 0.01:
            flag = f"  <-- not grounded (baseY {lo[1]:+.2f})"
        print(
            f"  {os.path.basename(p)[:-4]:24s} "
            f"{size[0]:6.2f} x {size[1]:6.2f} x {size[2]:6.2f} m  "
            f"baseY={lo[1]:+.3f}  {kb:7.0f} KB{flag}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
