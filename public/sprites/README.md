# Character sprites (drop generated art here)

Transparent-background PNGs of characters, rendered on camera-facing billboards
in the 3D clinic. See `GENERATION_BRIEF.md` in the project root for the exact
prompts and sizes to generate on the Higgsfield website.

Expected filenames (the game looks for these; missing files fall back to the
primitive figure automatically — nothing breaks):

- `patient-anxious.png` — patient in the chair, before treatment
- `patient-in-pain.png` — patient before you've studied / doing badly
- `patient-relieved.png` — optional, after a good decision
- `patient.png` — generic fallback if a mood-specific one is absent

Requirements: transparent background, front view "as the dentist sees them",
portrait framing, ~900×1200px. The plane auto-sizes to the image aspect ratio.
