"""Record what is in the scene, so the next import can be identified by difference.

REPLACES THE OLD "clear the scene first" APPROACH, WHICH CRASHED BLENDER.
  Removing every object and then purging orphaned meshes/materials/images left
  Blender holding references to datablocks that no longer existed. It survived
  the purge itself and died on the NEXT import — which looked from the outside
  like "connecting closes Blender", because the crash landed on a later command.

  Deleting nothing removes that whole class of failure. It also fixes the reason
  the clearing existed: importing candidates on top of each other used to make
  object names ambiguous, and an earlier session spent half an hour 'fixing' a
  mesh that was never the one being rendered. A recorded before-list identifies
  the new objects exactly, however many models are already loaded.
"""
import bpy

MARK = r"D:/My Apps/study-game/blender/.before"

names = sorted(o.name for o in bpy.data.objects)
with open(MARK, "w", encoding="utf8") as fh:
    fh.write("\n".join(names))
print(f"marked {len(names)} existing objects")
