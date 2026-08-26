# Drop downloaded 3D assets here

Anything you download — Substance 3D Community Assets, Mixamo, Sketchfab,
Quaternius, Poly Pizza — goes in this folder. `.glb`, `.gltf`, `.fbx`, `.obj`,
`.dae` and `.blend` are all handled.

Then it goes through two scripts, in this order.

## 1. Normalise it

```
blender --background --factory-startup --python scripts/import_asset.py -- \
    assets/incoming/<file> assets/incoming/<name>_norm.glb \
    --height <metres> --tris 4000 --palette --name <Prefix>
```

Fixes the four things every downloaded asset gets wrong for this game: scale,
origin (feet on the floor, centred — placement belongs to `layout.ts` alone),
triangle budget, and palette. It also rebuilds every material as a flat
Principled and deletes the textures, because the bake replaces them.

Drop `--palette` when the asset's own colours are worth keeping.

## 2. Bake the lighting into it

STATIC props — furniture, cabinets, the chair:

```
blender --background --factory-startup --python scripts/bake_vertex_light.py -- \
    <norm.glb> public/models/<name>.glb 1 0.30 "<x,y,z>" <yaw>
```

MOVERS — anything that walks, turns, or gets picked up:

```
blender --background --factory-startup --python scripts/bake_vertex_light.py -- \
    <norm.glb> public/models/<name>.glb 1 0.35 "<x,y,z>" <yaw> --ao
```

The distinction matters. A static prop can have the sun baked in because it
never turns. Bake it into the patient and the sun turns with her body. Movers
get occlusion only and take their directional light live — pass
`{ moves: true }` to `applyBakedLighting` for those.

For dense assemblies (the mouth: 32 teeth inside gum collars) add
`--aodist 0.003`, or every ray hits a neighbour and the whole thing bakes black.

## 3. Log it

Add a row to `LICENSES.md` in the same change. Not later.
