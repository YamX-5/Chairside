# 3D models (drop .glb files here)

The scene loads these if present and silently falls back to the old primitive
geometry if not — so a partial set is fine and nothing ever breaks.

## Expected filenames

| File | What it is | Loaded by |
|---|---|---|
| `clinic.glb` | The whole dental operatory — room shell, chair, desk, cabinets, props. **Lighting baked into the textures.** | `src/clinic/RoomModel.tsx` |
| `patient.glb` | One rigged patient with animation clips (ideally `Walk_to_Sit` + `Chair_Sit_Idle`). | `src/clinic/Patient3D.tsx` |

## Requirements

- **Format:** `.glb` (binary glTF — single file, textures embedded).
- **Scale:** metres. The room is 8×8 m, ceiling 2.8 m; an adult patient is ~1.7 m.
- **Orientation:** Y-up, facing −Z (three.js convention).
- **`clinic.glb` must be BAKED** — lighting rendered into the texture. `RoomModel`
  converts its materials to unlit (`MeshBasicMaterial`) so the bake isn't lit a
  second time. If you drop an *unbaked* room, pass `baked={false}`.
- **`patient.glb` must keep its animations** — if you compress it, use **meshopt,
  not Draco**: Draco discards animation data.

## Where these come from (see LICENSES.md before shipping)

- **Room/props:** free CC0 libraries — Kenney Furniture Kit, Poly Pizza, Poly Haven.
  Strip the original materials and re-shade to ONE palette (cream / honey-wood /
  teal), then bake.
- **Patient:** a character render → Meshy/Tripo image-to-3D → auto-rig →
  animation clip (`Walk_to_Sit` is action id 60). Runs in the cloud, so this
  laptop's 2 GB GPU doesn't matter.

⚠️ Meshy's **free tier output is CC BY 4.0** (attribution required, models
public). Fine for testing; must be resolved before any commercial release.
