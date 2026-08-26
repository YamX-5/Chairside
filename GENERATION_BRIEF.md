# Chairside — Asset Generation Brief

*You generate these on the Higgsfield website (unlimited on your plan). I wire, light, and phone-optimize them. The game already has a loader waiting — drop the files in the folders below with the exact filenames, tell me "assets are in", and I integrate + verify.*

**Two folders (already created):**
- Characters → `D:\My Apps\study-game\public\sprites\`
- Textures → `D:\My Apps\study-game\public\textures\`

**The look we're matching** (paste this style line into every prompt for consistency):
> *warm, soft, stylized 3D animated-film look (Pixar/Seedance style), muted cream-honey-teal palette, gentle soft lighting, clean and friendly, high quality.*

---

## Part A — Patient characters (biggest visual win — do these first)

These become the patient sitting in the dental chair. **Transparent background is essential.** Generate the **same character** across all three moods (use the site's character/"Soul" consistency feature, or reuse the same seed + description) so it's one person changing expression, not three different people.

**Settings for all three:** transparent background · portrait/vertical framing · full seated figure from about the knees up · front view, as if you're the dentist standing at the chair looking down slightly · ~900×1200 px · PNG.

### 1. `patient-anxious.png`
```
A young adult dental patient sitting slightly reclined in a dental chair, seen from the front as the dentist looking down at them, nervous but calm expression, hands in lap, wearing a simple casual shirt, warm soft stylized 3D animated-film look (Pixar/Seedance style), muted cream-honey-teal palette, gentle soft lighting, clean and friendly, high quality, full figure from the knees up, transparent background, no chair, no room, character only
```

### 2. `patient-in-pain.png`
```
The same young adult dental patient, sitting slightly reclined, one hand raised toward their jaw/cheek, wincing in mild tooth pain, front view as the dentist sees them, warm soft stylized 3D animated-film look (Pixar/Seedance style), muted palette, soft lighting, high quality, full figure from the knees up, transparent background, no chair, no room, character only
```

### 3. `patient-relieved.png` *(optional but great)*
```
The same young adult dental patient, relaxed and smiling with relief, sitting comfortably, front view, warm soft stylized 3D animated-film look (Pixar/Seedance style), muted palette, soft lighting, high quality, full figure from the knees up, transparent background, no chair, no room, character only
```

> Tip: if transparent background isn't offered, generate on a **flat plain green or white background** and tell me — I'll cut it out on my side. And keep the pose/framing similar across the three so the patient doesn't jump around when the expression changes.

---

## Part B — Surface textures (transforms the whole room)

These tile across the walls, floor, wood, and chair. **They must be SEAMLESS / TILEABLE** and shot **flat and straight-on with even lighting** — no baked shadows, no perspective, no objects, just the material.

**Settings for all:** square (1:1) · seamless / tileable · flat even top-down lighting · ~1024×1024 px · JPG.

### 4. `wall.jpg`
```
Seamless tileable texture of a smooth warm cream plaster wall, very subtle surface texture, flat even lighting, no shadows, no perspective, stylized clean 3D game art, muted warm palette, top-down flat view, high quality
```

### 5. `floor.jpg`
```
Seamless tileable texture of a pale warm stone or matte tile floor, subtle variation, flat even lighting, no shadows, no perspective, stylized clean low-poly game art, warm neutral palette, top-down flat view, high quality
```

### 6. `wood.jpg`
```
Seamless tileable texture of smooth honey-toned wood planks, soft gentle grain, matte finish, flat even lighting, no shadows, no perspective, stylized warm 3D game art, muted Pixar palette, top-down flat view, high quality
```

### 7. `fabric.jpg`
```
Seamless tileable texture of soft teal upholstery vinyl/leather (like a dental or medical chair), subtle sheen, flat even lighting, no shadows, no perspective, stylized clean 3D game art, teal color, top-down flat view, high quality
```

### 8. `cork.jpg` *(optional)*
```
Seamless tileable texture of a light cork noticeboard, fine natural speckle, flat even lighting, no shadows, no perspective, stylized clean 3D game art, warm tan palette, top-down flat view, high quality
```

---

## Part C — Backdrops *(optional, nice depth)*

### 9. `window.jpg` → save in `public\textures\`
```
A warm soft-focus view through a window of a sunny green garden / calm sky, stylized 3D animated-film look, warm golden light, muted palette, gentle bokeh, high quality, landscape
```
I'll map this behind the clinic's arched window so it looks like real daylight outside.

---

## When you're done

1. Save each file into the right folder with the **exact filename** above (lowercase, matching extension).
2. Missing/renamed files are fine — the game just falls back to what it has now, so partial sets work. Do as many or as few as you like.
3. Tell me **"assets are in"**. I then: wire the textures onto the room materials, size/place the patient billboard, compress everything to KTX2 so it stays fast on phones, and send you before/after captures.

*Priority order if you only do some: the 3 patient sprites (Part A) → `wood.jpg` + `wall.jpg` + `floor.jpg` (Part B) → the rest.*
