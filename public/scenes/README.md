# Scene backgrounds (drop your Higgsfield renders here)

Full-screen cinematic backgrounds for the 2.5D clinic. Until a file exists, a
designed warm gradient fallback is used, so the game always looks intentional.

Expected filenames (landscape, ~1920×1080, JPG):

- `clinic.jpg` — the clinic interior, first-person / eye-level view (used for
  arrival + the mission notification + calling the patient in)
- `desk.jpg`  — the study desk / corner (used for the study + flashcards beats)
- `chair.jpg` — the dental chair area where the patient sits (used for the case)

These are exactly the kinds of renders already in your Higgsfield "Dental
Clinic Simulation" collection. Drop them in with these names and the scenes
become full render-quality.

## Movement (optional, big impact)

**Moving backgrounds** — "Turn to video" a render in Higgsfield and save the
clip next to the still with the same name + `.mp4`:

- `clinic.mp4`, `desk.mp4`, `chair.mp4` — the background gently moves (camera
  drift, light, breathing). Falls back to the still (Ken Burns) if absent.

**Walk-through transitions** — short first-person walk clips that play WHEN YOU
MOVE between scenes (like your reference clips). Names:

- `to-desk.mp4`   — walking to the study desk (mission → study)
- `to-clinic.mp4` — walking back as the patient is called (flashcards → waiting)
- `to-chair.mp4`  — approaching the dental chair (waiting → the case)

Missing walk clips just fall through to the built-in dolly transition, so add
them whenever you like. ~1–3 seconds each, landscape, muted.
