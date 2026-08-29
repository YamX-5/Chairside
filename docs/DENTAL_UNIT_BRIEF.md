# Dental Treatment Unit — Asset Brief for AI 3D Generation / Modeller

**Target consumer:** browser dental-simulation game, three.js / react-three-fiber, glTF 2.0 (`.glb`), low-poly stylised. Topology and naming outrank beauty. A gorgeous single-mesh unit is worthless; a plain one with correctly separated, correctly named, correctly-originned parts is the whole deliverable.

**Configuration committed to (do not mix):** chair-mounted, **over-the-patient (traditional / hanging-tube) delivery**, right-handed default, **cuspidor present**, unit-mounted light on a post. Over-the-patient with a hanging-tube tray is the single most representative choice if only one configuration is built (A-dec 300 mount list; Planmeca Compact i5 console configurations). Cuspidor is present because the target user is a Jordan-facing dental student and that is what they trained on — but note it is optional equipment in reality (Dentsply Sirona Intego lists "Water unit without cuspidor" as an option).

---

## 1. THE PROMPT

Paste this block into Meshy / Rodin / Tripo, or hand it to a human modeller.

```
A complete dental treatment unit for a stylised clinic video game. Clean low-poly,
flat solid colours, no photoreal detail, no decals, no logos, no text, no bump or
normal maps, no scratches or wear. Smooth-shaded with hard edges only where a
silhouette needs one. Think a clean cartoon dental surgery, not a CAD render.

Real-world scale, metres, Y up, grounded on the floor at Y=0.

THE MACHINE IS FIVE BOLTED-TOGETHER SUB-ASSEMBLIES, NOT ONE MOULDED OBJECT.
Build them as five distinct clusters of geometry that read as separately
manufactured items:

1. PATIENT CHAIR. A single floor-mounted pedestal base, roughly 0.75 m x 0.43 m
   footprint, rising to a lift column. On top: a seat pan, a long thin backrest, a
   small headrest, two folding armrests, and a toeboard at the foot end. Overall
   length reclined about 1.95 m; width over armrests about 0.65 m. Seat top sits
   0.45 m off the floor in the delivered pose (real range 0.35 m to 0.80 m,
   A-dec 300 spec: 349 mm low / 800 mm high). THE BACKREST IS DELIBERATELY THIN —
   about 25 to 32 mm through the pad (A-dec 300/400) — because the operator tucks
   their knees under it. Do not model a fat armchair back. The headrest is a small
   separate pad on a slim neck, about 0.25 m long, that slides and hinges.

2. DOCTOR'S DELIVERY SYSTEM, over the patient's chest. A vertical post about
   50 mm diameter rising from the chair base on the operator's side; a horizontal
   rigid boom about 0.28 m long; a longer counterbalanced flex arm about 0.58 m;
   a short rigid arm; then the control head. Total horizontal reach about 0.86 m
   from the post (DCI 34-inch flex arm published spec: 34 in reach, 11 in rigid
   arm, 23 in vertical travel). The control head is a flat wedge-shaped box about
   0.36 m wide, 0.20 m deep, 0.08 m thick, with a flat rectangular touchpad
   recessed in its top face and a horizontal grab handle across its front edge.
   Slung UNDER the front edge of the control head is a row of FIVE separate open
   C-shaped instrument cradles, evenly spaced, each holding one instrument
   NOSE-DOWN, with the hoses hanging in a loose loop below the head. Do not fuse
   the cradles into one bar. To one side, on its own short arm below the head,
   a flat rectangular bracket tray about 0.37 m x 0.29 m (Diplomat Model One
   published: 290 x 370 mm, 1 kg capacity).

3. ASSISTANT'S ARM, on the opposite side of the chair from the delivery arm,
   mounted to the chair back. A short horizontal arm carrying a small control pad
   and THREE holders: a high-volume suction, a saliva ejector, and a second
   air-water syringe. One empty fourth holder position.

4. OPERATING LIGHT. A vertical pole rising from the unit body BESIDE the chair at
   the head end — lateral to the patient, not directly behind the headrest — up
   past shoulder height, curving over; then a horizontal arm reaching across over
   the patient; then a yoke; then the light head. The light head is a flattened
   rounded rectangle about 0.35 m x 0.25 m with a plain flat lens face and two
   small removable stick handles on its underside. It hangs about 0.70 m above the
   patient's mouth (A-dec published focal distance 27.6 in / 700 mm; also the
   ISO 9680 test distance).

5. UNIT BODY AND CUSPIDOR, a low column standing beside the chair at the head end
   on the assistant's side. It carries the light pole, a swing-out cuspidor bowl
   about 0.30 m across with a rim about 0.78 m off the floor, a small cup-filler
   spout, and a self-contained water bottle (a plain 0.7 litre cylinder) clipped
   to the delivery arm or the body.

PLUS, loose on the floor near the chair base: a foot control — a low round disc
pedal about 0.15 m across on a shallow housing, with a small toggle lever on its
face, on a flexible cable running to the unit base.

INSTRUMENTS. Five separate handheld tools hanging in the five delivery cradles,
each a distinct silhouette:
  - High-speed air turbine: slim one-piece pen-shaped body ending in a small
    fixed angled head with a tiny bur sticking out; about 0.14 m long including
    its coupler.
  - Low-speed motor with contra-angle: noticeably fatter and longer than the
    high-speed, a straight cylindrical motor body with a visibly separate
    angled nose-cone screwed onto it; about 0.19 m long.
  - Air-water syringe: a straight slim body with a thin curved metal nozzle
    pulling out of its nose, and TWO small round buttons side by side on its
    top — never one button, never a trigger. About 0.17 m long.
  - Ultrasonic scaler: pen-shaped, slightly thicker than the high-speed, with a
    fine curved tip.
  - Curing light: a pistol-less wand with a wider barrel and a short angled
    clear light-guide rod at the tip.
On the assistant's arm: a high-volume evacuator (a thick straight valve body with
a wide 11 mm bore rigid tube tip) and a saliva ejector (a slim valve body with a
thin flexible ribbed tube).

COLOUR: off-white / light warm grey plastic shells; mid-grey upholstery on chair
pads; chrome-grey metal for posts, arms and instrument bodies; near-black for
grips, hoses and the pedal; one accent colour for touchpad faces and instrument
colour bands; white for the light lens. Six flat colours total, no gradients.

EXPLICITLY DO NOT: merge the instruments into the delivery head; merge the
cradles into a single bar; merge the arm segments into one solid; model an air
compressor or vacuum pump anywhere near the chair (those live in a separate plant
room — show only hoses and a drain emerging at the chair base); add a stool
(stools are separate assets); add photoreal panel lines, screws, vents or text.
```

---

## 2. PARTS AND NAMING TABLE

**Naming rule, non-negotiable.** three.js rewrites names on load: `PropertyBinding.sanitizeNodeName` runs `name.replace(/\s/g,'_').replace(/[\[\]\.:\/]/g,'')` (three@0.185.1, `three.core.js:52645`), then `GLTFLoader.createUniqueName` (`GLTFLoader.js:3703`) silently appends `_1`, `_2` on any collision — **no warning, no error**. A colliding lookup returns the *first* node for both call sites, so two pieces of code silently drive one mesh. Therefore:

- Characters allowed: `A-Z a-z 0-9 _ -` only. **No spaces, no `. : / [ ]`.**
- Assert `sanitize(name) === name` for every node, not merely that sanitized names are unique.
- Names must be unique across **nodes, meshes, cameras, lights and scenes** — one shared registry.
- Give mesh datablocks a different name from their object (object `TOOL_highspeed`, mesh data `MESH_highspeed`) so the two namespaces cannot overlap.
- `SOCKET_` is already taken in this codebase (`SOCKET_Pelvis`, `SOCKET_tray`, `SOCKET_hand_R`) meaning "thing attaches here". Instrument holders use **`REST_`**.

| Node name | Type | Parent | What the game does with it |
|---|---|---|---|
| `UNIT_root` | empty | scene | Single handle for placing/scaling the whole unit. |
| `CHAIR_base` | mesh | `UNIT_root` | Static pedestal. Anchors the whole rig; must sit on Y=0. |
| `CHAIR_swivel` | empty | `CHAIR_base` | Yaw of the whole chair on its base, ±30°. |
| `CHAIR_lift` | empty | `CHAIR_swivel` | Y-translate joint, 0.35→0.80 m seat height. |
| `CHAIR_seat` | mesh | `CHAIR_lift` | Seat pan. Rides the lift. |
| `CHAIR_back` | mesh | `CHAIR_seat` | Backrest. Pitch joint; the patient's spine root parents here so reclining the chair reclines the patient for free. |
| `CHAIR_headrest` | mesh | `CHAIR_back` | Separate pitch + slide. Chin-up for maxillary, chin-down for mandibular — a second DOF from the backrest. |
| `CHAIR_armrest_L` / `CHAIR_armrest_R` | mesh | `CHAIR_seat` | Swing clear for patient entry/exit. |
| `CHAIR_toeboard` | mesh | `CHAIR_seat` | Feet-up emergency pose (syncope: feet 10–15° up, head level with thorax). |
| `CHAIR_touchpad` | mesh | `CHAIR_back` | Click surface for chair presets. |
| `ARM_post` | mesh | `CHAIR_base` | Static 50 mm post the delivery arm rides. |
| `ARM_yaw` | empty | `ARM_post` | Primary swing of the arm over the patient's chest. |
| `ARM_rigid` | mesh | `ARM_yaw` | Rigid boom, 0.28 m. |
| `ARM_knuckle_rear` | empty | `ARM_rigid` | Pitch. The single driven height value. |
| `ARM_flex` | mesh | `ARM_knuckle_rear` | Counterbalanced flex link, 0.58 m. |
| `ARM_knuckle_front` | empty | `ARM_flex` | Pitch, driven as `-rear` so the head never tilts. |
| `ARM_short` | mesh | `ARM_knuckle_front` | Short rigid arm. |
| `ARM_head_yaw` | empty | `ARM_short` | Aims the head without moving the arm. |
| `CONTROL_head` | mesh | `ARM_head_yaw` | The delivery head shell. Parent of everything below. |
| `CONTROL_touchpad` | mesh | `CONTROL_head` | Click target; shows active-instrument settings. |
| `CONTROL_handle` | mesh | `CONTROL_head` | Grab-to-reposition target; also a barriered surface in the asepsis pass. |
| `CONTROL_cradle_1` … `CONTROL_cradle_5` | mesh | `CONTROL_head` | Five separate holder cradles, each with its own pitch pivot. Occupancy gates instrument arming. |
| `REST_syringe_airwater` | empty | `CONTROL_cradle_1` | Rest transform for that tool. Snap-to on put-back. |
| `REST_highspeed` | empty | `CONTROL_cradle_2` | " |
| `REST_slowspeed` | empty | `CONTROL_cradle_3` | " |
| `REST_scaler` | empty | `CONTROL_cradle_4` | " |
| `REST_curinglight` | empty | `CONTROL_cradle_5` | " |
| `TRAY_arm` | mesh | `CONTROL_head` | Own yaw joint where it meets the head. |
| `TRAY_holder` | mesh | `TRAY_arm` | Second yaw joint under the tray. |
| `TRAY_surface` | mesh | `TRAY_holder` | 370×290 mm flat plate; loose instruments parent here and ride along. |
| `TOOL_highspeed` | mesh | `REST_highspeed` at rest | Pickable. Turbine; 200k–400k rpm, low torque, coolant mandatory. |
| `TOOL_highspeed_bur` | mesh | `TOOL_highspeed` | Swappable child. |
| `TOOL_slowspeed` | mesh | `REST_slowspeed` | Pickable. Motor body. |
| `TOOL_slowspeed_nose` | mesh | `TOOL_slowspeed` | Detachable contra-angle / prophy angle — a real visible joint. |
| `TOOL_slowspeed_bur` | mesh | `TOOL_slowspeed_nose` | Swap diamond ↔ rubber cup. |
| `TOOL_syringe_airwater` | mesh | `REST_syringe_airwater` | Pickable. Always live — button-operated, not pedal-gated. |
| `TOOL_syringe_tip` | mesh | `TOOL_syringe_airwater` | Detaches: this is the autoclavable part, the body stays on the tubing (DentalEZ/Forest 0097-548 Rev D). |
| `TOOL_scaler` | mesh | `REST_scaler` | Pickable. |
| `TOOL_scaler_tip` | mesh | `TOOL_scaler` | " |
| `TOOL_curinglight` | mesh | `REST_curinglight` | Pickable. Cordless in reality — safe to lift off entirely. |
| `TOOL_curinglight_guide` | mesh | `TOOL_curinglight` | " |
| `ASSIST_arm` | mesh | `CHAIR_back` | Assistant's station. Chair-back mount (A-dec 551). Own horizontal DOF. |
| `ASSIST_touchpad` | mesh | `ASSIST_arm` | Reduced control set: chair, bowl rinse, cup fill, light. Doubles as the arm's positioning handle. |
| `REST_hve` / `REST_ejector` / `REST_syringe_assist` | empty | `ASSIST_arm` | Three occupied holders. |
| `REST_assist_spare` | empty | `ASSIST_arm` | Fourth position, empty by default. |
| `TOOL_hve` | mesh | `REST_hve` | Pickable. Valve body — reprocessed, stays. |
| `TOOL_hve_tip` | mesh | `TOOL_hve` | 11 mm bore rigid tube (A-dec published valve-opening dia; 15 mm large-bore variant). **Single-use — goes in the bin, not the autoclave.** |
| `TOOL_ejector` | mesh | `REST_ejector` | Pickable. |
| `TOOL_ejector_tip` | mesh | `TOOL_ejector` | 6 mm bore flexible ribbed tube (A-dec). Single-use. |
| `TOOL_syringe_assist` | mesh | `REST_syringe_assist` | Second 3-way syringe. |
| `TOOL_syringe_assist_tip` | mesh | `TOOL_syringe_assist` | " |
| `UNIT_body` | mesh | `UNIT_root` | Column beside the chair, head end, assistant side. Static. |
| `UNIT_waterbottle` | mesh | `ARM_flex` *or* `UNIT_body` | 0.7 L (A-dec Self-Contained Water System IFU: 0.7 L or 2 L). Waterline-tablet beat. |
| `CUSP_yaw` | empty | `UNIT_body` | Bowl swing, ±45°. |
| `CUSP_bowl` | mesh | `CUSP_yaw` | Rinse destination for the 20–30 s post-patient flush (CDC 2003 guidelines §VIII.A.4). |
| `CUSP_screen` | mesh | `CUSP_bowl` | Removable bowl screen — lift-out node (A-dec IFU: "always install the bowl screen"). |
| `CUSP_cupfill` | mesh | `UNIT_body` | Cup-filler spout. |
| `CUSP_rinse` | mesh | `CUSP_bowl` | Bowl rinse spout (a spout, **not** a rim ring). |
| `UNIT_solidscollector` | mesh | `ASSIST_arm` | Separate suction-system node, **not** part of the cuspidor — it filters HVE/SE waste (A-dec: "Do not empty the solids collector screen into the cuspidor"). |
| `LIGHT_pole` | mesh | `UNIT_body` | Static vertical mast. |
| `LIGHT_arm_yaw` | empty | `LIGHT_pole` | Arm swings about the pole. |
| `LIGHT_arm_lower` | mesh | `LIGHT_arm_yaw` | |
| `LIGHT_elbow` | empty | `LIGHT_arm_lower` | Counterbalance joint. |
| `LIGHT_arm_upper` | mesh | `LIGHT_elbow` | |
| `LIGHT_yoke` | empty | `LIGHT_arm_upper` | Head yaw. |
| `LIGHT_head` | mesh | `LIGHT_yoke` | Tilt + diagonal. Casts the ~95×145 mm pool. |
| `LIGHT_handle_L` / `LIGHT_handle_R` | mesh | `LIGHT_head` | **Detachable** — autoclavable on removable-LED heads (DentalEZ/Forest: "LED removable L-style light handles"). Not detachable on halogen heads; we build the LED variant. |
| `FOOT_base` | mesh | `UNIT_root` | Loose on the floor. |
| `FOOT_disc` | mesh | `FOOT_base` | Depresses/tilts about a central pivot — pressure on *any part* of the disc works. Analog 0–1, not boolean. |
| `FOOT_toggle` | mesh | `FOOT_disc` | Wet/dry toggle, two states, blue-dot decal side = water on (A-dec Cascade IFU 85.2639.00 Rev F). |

**Explicitly SAFE TO MERGE into one mesh each:** chair pedestal + frame + fixed trim; fixed pipework; the control head shell's own panels and badges. **Explicitly MUST NOT MERGE:** anything in the table above with its own row.

**Hoses:** give each tool its own short low-segment hose node (8-sided cross-section on a 12-segment path is plenty) that hides with the tool, **or** omit hoses entirely and fake them with a runtime spline. Do not let the hose be the geometry that welds the tools together — that is exactly how the current asset became one 18,338-vertex island.

---

## 3. THE RIG

Every joint node is an **empty** whose origin sits **on its rotation axis**, with **identity local rotation and unit scale in the rest pose**. Rest pose = arm parked alongside the chair, head level, light stowed. Strict single-chain lineage: setting `ARM_yaw.rotation.y` must carry the head, cradles, tray and every holstered tool for free.

### Delivery arm

Chain: `CHAIR_base → ARM_post → ARM_yaw → ARM_rigid → ARM_knuckle_rear → ARM_flex → ARM_knuckle_front → ARM_short → ARM_head_yaw → CONTROL_head → CONTROL_cradle_N → REST_* → TOOL_*`

| Joint | Pivot location | Axis | Range | Provenance |
|---|---|---|---|---|
| `ARM_yaw` | On the post centreline, at the collar top | local **+Y** | −90° … +90°; 0° = parked alongside chair, +90° = over the chest | **Design clamp.** DCI sets this joint with bearing strips and a friction setscrew and publishes no angle; A-dec's 342 uses removable stop pins with no published angle. Clamp it, do not claim it is spec. |
| `ARM_knuckle_rear` | On the knuckle pin at the outboard end of `ARM_rigid` | local **+X** | −30° … +30° | **Derived.** A 0.584 m flex link swinging ±30° gives exactly 0.584 m of vertical head travel, matching DCI's published 23 in vertical travel for the 34-inch arm. |
| `ARM_knuckle_front` | On the knuckle pin at the far end of `ARM_flex`, **X axis exactly parallel to the rear knuckle's** | local **+X** | **Driven, not authored:** `front.rotation.x = -rear.rotation.x` | The two knuckles share one control rod (DCI PN 93065 Rev A). Never expose them as independent joints — a delivery head that visibly tilts as the arm rises reads as broken to any dentist, and the tray would not hold. The equal-and-opposite relation is a clean approximation of a spring-linked mechanism, not geometry DCI publishes. |
| `ARM_head_yaw` | On the short arm's swivel centreline | local **+Y** | −90° … +90° | Design clamp; A-dec documents a rotation-tension setscrew here but no angle. |
| `CONTROL_head` | Its own platform centre | local **+Y** | −45° … +45° | Design clamp; A-dec 500 IFU documents a control-head rotation-tension screw, no angle. |
| `CONTROL_cradle_1..5` | At each cradle's own pivot, **not** its centroid | local **+X** | −20° … +20° | Design clamp. A-dec 532: "you can independently adjust each handpiece holder"; **no angle range is published in any A-dec document** — do not put a number on screen. |
| `TRAY_arm` | Where it meets the head | local **+Y** | −120° … +120° | Design clamp. |
| `TRAY_holder` | Under the tray centre | local **+Y** | −180° … +180° | Design clamp. |

**Behaviour split to honour in code, not geometry:** height (the knuckle pitch) is spring-counterbalanced and brake-held — it stays exactly where you leave it and needs a deliberate release (A-dec 500 IFU 86.0607.00 Rev L p.5: "The integrated brake maintains the vertical position of the control head… The brake does not restrict side-to-side movement"; release is a press-and-hold button on the 500, a capacitive grip sensor on the 532/533). Yaw is a tensioned friction joint: noticeable breakaway resistance, damped travel, **dead stop with no coast or rebound** — not a light glide. Brake hold capacity is model-specific: 8 lb / 3.6 kg on the A-dec 500, 4 lb / 1.8 kg on the 300 Pro. Do not teach one figure.

### Light arm

Chain: `UNIT_body → LIGHT_pole → LIGHT_arm_yaw → LIGHT_arm_lower → LIGHT_elbow → LIGHT_arm_upper → LIGHT_yoke → LIGHT_head`

| Joint | Pivot location | Axis | Range | Provenance |
|---|---|---|---|---|
| `LIGHT_arm_yaw` | Top of the pole, on its centreline | **+Y** | −120° … +120° | Design clamp. |
| `LIGHT_elbow` | Arm counterbalance joint | **+Y** | −90° … +90° | Design clamp. |
| `LIGHT_yoke` | Head yaw axis, through the yoke | **+Y** | −270° … +270° (**540° total**) | A-dec 500 LED brochure 85601700 p.7, "rotate the light 1.5 times". A-dec's copy is ambiguous whether that is total or each way — pick 540 total and say so. **Attribute to A-dec**: Midmark publishes 350°, Planmeca and KaVo publish no figure. |
| `LIGHT_head` tilt | Yoke pin | **+X** | −60° … +60° (**120° total**) | Same brochure. Bounded — not free. |
| `LIGHT_head` diagonal | Third oblique axis at the head | **+Z** | −40° … +40° (**80° total**) | Same brochure. This is A-dec's oblique third axis, **not** a free roll about the beam axis. Do not model it as unbounded. |

Rest pose parks `LIGHT_head` **0.70 m above the patient's mouth**, aimed along the head's long axis, casting a soft-edged pool ~95 × 145 mm with the long axis running **across** the face (A-dec 500 LED spec: 3.8 × 5.7 in at 27.6 in focal distance; orientation is **inferred**, since no manufacturer states it — A-dec describes the field as "high by wide" and ISO 9680 requires rapid falloff toward the eyes).

### Chair

| Joint | Pivot | Axis | Range | Provenance |
|---|---|---|---|---|
| `CHAIR_swivel` | Base centreline | **+Y** | −30° … +30° (60° total) | A-dec 300 / 411 published. **A-dec-specific** — Midmark UltraComfort is 30° total, Belmont Eurus 210°, Planmeca 180°. |
| `CHAIR_lift` | — | **+Y translate** | seat top 0.35 m … 0.80 m | A-dec 300: 349 mm low, 800 mm high. Typical market band is 410–790 mm (Belmont Clesta II); the ~350 mm floor is essentially A-dec-only. |
| `CHAIR_back` | Seat/back hinge | **+X** | 0° (supine) … 90° (upright) above horizontal | Presets: upper arch **0°** fully supine, lower arch **~20°** (Henry Schein 10–20°; RDH 20–30°; UQ Dentistry teaches 45° semi-supine as a school-dependent variant, not an error). |
| `CHAIR_headrest` tilt | Neck pivot, **not** co-located with the headrest hinge | **+X** | −25° … +25° | **Design clamp** — no source publishes a headrest angular range. Drive it from the occlusal-plane target instead: maxillary occlusal plane ~15–20° behind vertical (chin up), mandibular ~30° above horizontal (chin down). |
| `CHAIR_headrest` glide | — | **+Z translate** | 0 … 0.10 m | Head slides until the occiput lines up with the top of the headrest (Henry Schein / A-dec). |
| `CHAIR_toeboard` | Foot-end hinge | **+X** | 0° … 15° | Syncope pose: head level with thorax, feet 10–15° up. **Not** full head-down Trendelenburg. |
| `CUSP_yaw` | Bowl arm hub on `UNIT_body` | **+Y** | −45° … +45° (90° total) | A-dec 461 Support Center published. Belmont Eurus S8 is also 90° total; Evogue is 180°; Planmeca 110°. |
| `FOOT_disc` | Centre of the disc | **+X and +Z tilt** | 0° … 6°, ~3 mm travel | Design value. The disc tilts about a **central** pivot — that is why pressure on any part of it works. Map travel to an analog 0–1, never a boolean. |

**No chair legrest knee joint.** On A-dec-class chairs the seat pan is rigid; the feet rise because the whole seat assembly tilts on the base. Knee-break legrests exist on some other makes — if one is wanted, label it a chair-specific option.

---

## 4. ORIGINS AND AXES

**This convention is already fixed by the consuming codebase. Match it; do not invent one.**

`src/clinic/handsRig.ts` `gripQuaternion()` is literally `setFromUnitVectors(new Vector3(0,0,1), FINGER_DIR)` — the runtime aims the tool's **local +Z** down the finger direction and applies no correction.

For **every** `TOOL_*` node:

| Property | Value |
|---|---|
| Local origin `(0,0,0)` | At the **grip** — the point where the thumb/index web closes around the handle. Not the centroid, not the bounding-box centre, not world zero. |
| Working tip (bur, nozzle, light guide, suction bore) | Runs along **local +Z** from the origin. |
| Hose / cable exit | Toward **local −Z**. |
| Working head deflection (the side the angled head leans toward) | Toward **local +Y**. *(Derived from the existing `instruments.glb` geometry — the bur sits at +Y. Roll about Z is otherwise unspecified in the codebase; this brief fixes it here so it stops being a per-artist guess.)* |
| Local rotation in the delivered file | **Identity quaternion `[0,0,0,1]`**. |
| Local scale | **`[1,1,1]`**. |

**Blender-side instruction — state both ends or the artist will get it 90° wrong:**

> Author the working tip along **−Y in Blender**, head deflection toward **+Z in Blender**, grip at the Blender origin, and export with **Y-up ON** (`export_yup=True`). Blender's exporter maps `gltf(x, y, z) = blender(x, z, −y)`, so Blender −Y arrives as glTF +Z and Blender +Z arrives as glTF +Y. An artist told only "+Z forward" will author along Blender +Z, which exports to glTF +Y — a tool standing straight up like a fence post.

**The single most destructive Blender habit — name it explicitly:** **do not use Apply All Transforms (Ctrl+A).** It bakes each object's transform into its vertices and resets every origin to world zero. Applied to a delivery bar, all five tools end up sharing origin `(0,0,0)` and the grip contract is gone — **with no visual change in the viewport**, which is why it survives review. Instead: 3D cursor to the grip point → Object ▸ Set Origin ▸ Origin to 3D Cursor.

**`REST_*` empties must be authored with orientation, not just position.** Each is an empty at the tool's grip position in the holster, oriented so **+Z points the way the tool points while holstered** (nose-down for traditional cradles). Then put-back is `tool.position.copy(rest.position); tool.quaternion.copy(rest.quaternion)` and pick-up is a reparent — no per-tool magic offsets anywhere. **Export caveat:** some exporters drop childless empties. Keep each holstered `TOOL_*` parented to its `REST_*` so the empty has a child and survives, and verify each `REST_*` actually appears as a node in the GLB.

**Joint origins:** on the axis, never at the mesh centroid. `ARM_yaw` on the post centreline; both knuckle origins on their knuckle pins **with their X axes parallel** so the mirrored rotation cancels exactly; `ARM_head_yaw` on the short arm's swivel centreline; each cradle origin at its pivot, not its middle.

---

## 5. ACCEPTANCE CHECKLIST

Written to be run as a script against the delivered `.glb` before it is accepted. Red/green, no judgement calls.

**Naming**
1. For every node, mesh, camera, light and scene name `n`: `/^[A-Za-z0-9_-]+$/.test(n)` is true.
2. For every such name: `PropertyBinding.sanitizeNodeName(n) === n`.
3. All names in that combined set are unique. **No node in the loaded scene has a name ending `_1`…`_9` that was not authored that way.**
4. Every name in §2's table exists as a node. Report any missing.
5. No mesh datablock name equals its object name.

**Transforms and origins**
6. Every `TOOL_*` node: local rotation quaternion within 1e-4 of `[0,0,0,1]`; local scale within 1e-4 of `[1,1,1]`.
7. Every `TOOL_*` node origin lies **inside its own world-space AABB** and is **not** within 1 mm of world zero. (This is the check that catches an Apply-All-Transforms accident.)
8. Every `TOOL_*` origin is within 25 mm of the AABB face nearest the hose end — i.e. at the grip, not the middle. *(25 mm is a tolerance chosen here, not a sourced figure; the correct grip offset differs per instrument and should be measured in Blender against the actual mesh rather than asserted.)*
9. Every `REST_*` name exists as a node with a non-identity local transform.
10. `ARM_knuckle_rear` and `ARM_knuckle_front` local X axes are parallel within 0.5°.
11. **Parallelogram test:** set `ARM_knuckle_rear.rotation.x = +30°` and `ARM_knuckle_front.rotation.x = −30°`, update world matrices; `CONTROL_head` world quaternion must match its rest value within 1°. Repeat at −30/+30.
12. Every joint empty (`ARM_yaw`, `ARM_knuckle_*`, `ARM_head_yaw`, `LIGHT_*`, `CUSP_yaw`, `CHAIR_*`) has identity local rotation in the rest pose.

**Scale and grounding** *(mirrors `src/clinic/propScale.ts` / `propScale.test.ts`, which measure the real `.glb` off disk in **world space** with node transforms applied — reading accessor `min`/`max` is what once "reported a stool at 15,596 metres")*
13. Whole-unit world AABB: `minY` within 0.02 m of 0; total height ≤ 2.10 m; footprint ≤ 2.10 × 1.10 m.
14. `CHAIR_seat` top face at 0.45 m ± 0.05 in the delivered rest pose.
15. Each `TOOL_*` longest world dimension within the default 0.3 fractional tolerance of its table entry: high-speed 0.14 m, slow-speed 0.19 m *(the repo's existing anchor: "a handpiece is 190 mm because you hold it like a pen" — note this fits a slow-speed motor + contra-angle; a bare high-speed turbine is nearer 0.10–0.11 m, 0.135–0.15 m with coupler, and neither figure has an external citation — verify against a catalogue before it becomes teaching content)*, syringe 0.17 m *(estimate)*, scaler 0.17 m *(estimate)*, curing light 0.22 m *(estimate)*, HVE 0.18 m *(estimate)*, ejector 0.16 m *(estimate)*.
16. `TRAY_surface` world dimensions 0.37 × 0.29 m ± 0.03 (Diplomat Model One published).
17. `LIGHT_head` sits 0.70 m ± 0.05 above the `CHAIR_headrest` mouth marker in the rest pose.
18. Every part carries a one-line "because" justification naming a human action, in the handover note. *(The repo's governing rule: "Before a prop goes in the room, say what a human does with it, and let that fix the size." `because` is a required field on `PropScale`.)*

**Geometry quality**
19. Total triangles ≤ **12,000**. *(The current chair is 26,706 tris / 54,923 verts / 2,320 KB. Half of that is the target.)*
20. **verts ÷ tris ≤ 1.2** across the whole file. *(The current chair is 2.06 — 96.9% of its triangles are flat-shaded, which is a global exporter default, not a style choice. Unique positions are 14,258 = 0.534 verts/tri, so it carries 3.85× the vertices it needs. Above 1.2 is a review trigger, not an automatic fail: a mesh with legitimate hard edges and many material splits can honestly sit at 1.3–1.5.)*
21. Secondary check: unique-position count within 1.2× of the accessor vertex count.
22. Every `TOOL_*` node is **one mesh with exactly one primitive and exactly one material**, ≤ 800 tris. *(Multiple materials on one object exports as multiple primitives; three.js then wraps them in a Group, so `getObjectByName` returns a Group with no `.material` and `intersect.object.name` reports `Name_1` instead of the part name — a second, silent way to lose the click target.)*
23. Material count ≤ **8** for the whole file. *(Material count ≈ draw-call count. The current chair spends 14 on one prop; the practical mid-range-phone ceiling for the whole scene is ~100–150 draw calls, and the scene also carries patient, hands, mouth, room and props.)*
24. No `TEXCOORD_1` on any primitive. *(The current chair ships two full UV sets with zero textures — 878,768 bytes, 37% of its file, that nothing samples.)*
25. `images.length === 0`; `COLOR_0` optional. *(Untextured flat colour is fine here. Note that textured assets **are** supported elsewhere in this project — `bakedMaterial.ts` has an explicit `if (mat?.map) return` guard, and 13 prop GLBs carry 114 embedded images — so "no textures ever" is not a house rule, it is this asset's spec.)*

**Format**
26. Single `.glb`. `extensionsRequired` contains no `KHR_draco_mesh_compression` and no `EXT_meshopt_compression`. **Ship uncompressed** — the project quantises with `KHR_mesh_quantization` via `scripts/compress_models.mjs`, which three.js reads natively; no Draco or meshopt decoder is configured anywhere (`useOptionalGLTF.ts` builds a bare `new GLTFLoader()`, and six node-side test/probe scripts do the same).
27. File ≤ 1.5 MB.
28. Not skinned. No `skins` array. *(A parented node chain avoids the quantisation problem that keeps `patient.glb` out of the compression targets.)*

**Integration**
29. The five delivery cradles' combined world AABB either falls inside the currently hard-coded pick volume — x −0.607…0.495, y 0.671…0.849, z 0.330…0.503, relative to `CHAIR_POS` in `src/clinic/layout.ts` `unitHolders()` — **or** the delivered file ships with its new measured extents so `unitHolders()` can be updated in the same change. A replacement unit whose bar sits elsewhere leaves three invisible click boxes floating in the wrong place, with no error and no visual cue.

---

## 6. IF THE TOOL CANNOT PRODUCE SEPARATE PARTS

Most current text-to-3D tools return **one fused mesh**. Assume this. Do not try to rescue a fused result with loose-parts separation: that is exactly how the existing asset failed — `dental_unit__Object_15`, 18,338 vertices, separates into **4,913 islands of three or four vertices**, under 4 verts per island, which is the signature of a triangulated CAD/marching-cubes tessellation with no shared topology at all. Loose-parts, merge-by-distance and material separation all fail on that.

**Fallback: order the pieces as separate generations, assemble in Blender.**

Run these as independent prompts, each producing its own mesh at its own scale, then import all of them into one Blender file, position, name, set origins, and export once:

| Generation | Prompt stub (append the style block from §1) | Target |
|---|---|---|
| 1 | "Low-poly stylised dental patient chair, pedestal base, thin backrest 25 mm, small hinged headrest, two folding armrests, toeboard. 1.95 m long, 0.65 m wide, seat 0.45 m high." | `CHAIR_*` |
| 2 | "Low-poly stylised dental delivery control head: a flat wedge box 0.36 × 0.20 × 0.08 m with a recessed rectangular touchpad on top and a horizontal grab bar across the front, no instruments." | `CONTROL_head` |
| 3 | "A single open C-shaped dental instrument cradle, 0.05 m wide, chrome grey." — generate once, duplicate five times in Blender. | `CONTROL_cradle_1..5` |
| 4 | Arm segments: model these **from primitives in Blender**, not generated. A cylinder and two boxes at the published lengths (0.28 m rigid, 0.58 m flex, 0.05 m post dia) beat anything a generator will return, and the joints have to be authored by hand anyway. | `ARM_*` |
| 5 | "Low-poly stylised dental operating light head: flattened rounded rectangle 0.35 × 0.25 m, plain flat white lens face, two small stick handles underneath." | `LIGHT_head` + handles |
| 6 | Light pole and arms: primitives in Blender. | `LIGHT_*` |
| 7 | "Low-poly stylised dental unit body column with a swing-out white ceramic rinse bowl 0.30 m across and a small cup-filler spout." | `UNIT_body`, `CUSP_*` |
| 8 | Each instrument **separately**, one generation each — do not ask for "a set of dental instruments", you will get them fused: high-speed turbine; low-speed motor with contra-angle; air-water syringe with two round buttons; ultrasonic scaler; curing light wand; HVE valve body; saliva ejector valve body. | `TOOL_*` |
| 9 | "Low-poly round foot pedal disc 0.15 m across on a shallow housing with a small toggle lever." | `FOOT_*` |

**Blender assembly order — do these in sequence:**

1. Import each piece. **Decimate / retopo to budget before anything else** (§5 items 19–21).
2. **Smooth-shade everything**, then add sharp edges only where a silhouette needs one. This is the step that does the work — it takes the current chair's class of mesh from 54,923 to ~14,682 vertices, about −73%. Merge-by-distance alone only gets −9.6%, because a weld cannot remove a normal split that already exists.
3. Set each object's origin deliberately: 3D cursor to the grip / joint axis → Set Origin ▸ Origin to 3D Cursor. **Never Ctrl+A.**
4. Build the parent chains from §3. Create the joint empties, position them on the axes, parent with **Keep Transform** so nothing shifts, then zero every joint's local rotation.
5. Create the `REST_*` empties at each cradle, oriented +Z along the holstered tool's nose. Parent each holstered `TOOL_*` under its `REST_*` so the empty survives export.
6. Rename objects **and mesh datablocks** per §2 (`TOOL_highspeed` / `MESH_highspeed`).
7. Assign materials: ≤ 8 total, one per pickable part. *(Tension to resolve explicitly: sharing a material across parts means a hover tint tints all of them. Either clone the material at runtime for the highlighted part, or give the seven `TOOL_*` parts their own material instances at author time. Pick one and record which.)*
8. Export: **GLB**, +Y Up **ON**, Normals **ON**, Tangents **OFF** (no normal maps), Images **None**, Compression **NONE**, Custom Properties **ON** if any part carries userData. `export_apply` **TRUE** if modifiers were used — the repo's own `build_instruments.py` sets it `False` only because it builds clean primitives with no modifiers; copying that flag blindly exports unmodified geometry.
9. Run the §5 checklist. Iterate against the checklist, not against the game.

**If even that fails,** the correct move is to build the delivery head and cradles from primitives directly — a low-poly stylised head plus five cradles is maybe 2–3k triangles and will be both smaller and vastly more useful than any 18k-vertex generated block. The parts that genuinely benefit from generation are the organic-ish shells: the chair upholstery, the light head, the unit body. Everything with a joint in it should be primitives.

---

### Flagged uncertainties, not smoothed over

- **Arm segment lengths** come from DCI's 34-inch flex arm (published: 34 in reach, 11 in rigid arm, 23 in vertical travel). The 0.58 m flex link is *derived by subtraction*, not published. No manufacturer publishes delivery-arm reach in plain text — A-dec's figures exist only as unlabelled callouts inside pre-installation CAD drawings.
- **Every joint angular range not explicitly attributed above is a design clamp, not a spec.** Manufacturers document tension screws and stop pins, not degrees. Do not surface any of these numbers to a student as equipment data.
- **Chair reclined length, width, cuspidor bowl diameter and rim height, and four of the seven instrument lengths** are estimates aggregated from supplier guides, not manufacturer datasheets. Confirm against one named unit's spec sheet before any of them appears on screen.
- **Light patch orientation** (long axis across the face) is inferred from A-dec's "high by wide" wording and ISO 9680's eye-protection requirement. No specification states it.
- **The 190 mm handpiece anchor** is an in-repo scale value inside a ±30% tolerance, with no external citation, and it conflates two instruments that differ by nearly 2×. Qualify it or verify it.
- **`propScale.test.ts` enforces size, not orientation.** A part delivered rotated 180° about Y passes clean. Treat `−Z forward` as a convention to follow, not a guardrail that will catch you. CI also triggers only on push to `main`, not on pull requests — a mis-scaled asset fails at deploy, not at review.