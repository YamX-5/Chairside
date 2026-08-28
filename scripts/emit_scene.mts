/**
 * Dump the clinic exactly as the CODE describes it, for Blender to render.
 *
 *     npx tsx scripts/emit_scene.mts > scene.json
 *
 * WHY THIS EXISTS
 * ---------------
 * Every fix this session was verified by measurement and by tests, and several
 * of them were still wrong on screen — a patient standing in the chair, a
 * patient walking in backwards, an entire instrument tray silently unmounted.
 * Measurements confirm a number. They do not confirm a PICTURE, and nobody had
 * looked at the picture.
 *
 * The browser pane here renders WebGL but cannot composite, so it cannot produce
 * a screenshot. Blender can. This emits the scene graph — every prop, its
 * position and yaw, the patient's placement and pose, and the player's eye — by
 * IMPORTING THE REAL MODULES, so the render is of what the game actually says,
 * not of a second description that can drift from it.
 *
 * It deliberately reads layout.ts / cast3d.ts rather than restating anything. If
 * a constant changes, the render changes with it.
 */
import {
  CHAIR_FACING,
  CHAIR_POS,
  DOORWAY,
  DOORWAY_ENTRY_Z,
  INTERACTABLES,
  PROPS,
  SEAT_WORLD,
  STOOL_POS,
  STOOL_YAW,
} from '../src/clinic/layout'
import { CAST_FACING_OFFSET, CLIPS, castScale, lookFor } from '../src/clinic/cast3d'
import { EYE_HEIGHT, ROOM_HALF } from '../src/clinic/theme3d'

const PATIENT_ID = 'patient-8'
const look = lookFor(PATIENT_ID)

/** Where the operator stands to work — the camera for the hero view. */
const solve = INTERACTABLES.find((i) => i.id === 'solve')!

const scene = {
  roomHalf: ROOM_HALF,
  props: PROPS.map((p) => ({
    id: p.id,
    file: `public/models/props/${p.id}.glb`,
    pos: p.pos,
    yaw: p.yaw,
  })),
  // The chair and the stool are not in PROPS on the same terms; state them from
  // their own constants so the render cannot disagree with the room.
  chair: { file: 'public/models/dental_chair.glb', pos: CHAIR_POS, yaw: CHAIR_FACING },
  stool: { pos: STOOL_POS, yaw: STOOL_YAW },
  patient: {
    file: `public/models/cast/${look.model}.glb`,
    // FLOOR level under the seat — she plants her own feet. This is the exact
    // expression PatientRig uses; if it is wrong there it is wrong here, which
    // is the point.
    pos: [SEAT_WORLD[0], 0, SEAT_WORLD[2]],
    yaw: CHAIR_FACING + CAST_FACING_OFFSET,
    scale: castScale(look),
    clip: CLIPS.sit,
    height: look.height,
  },
  doorway: { x: DOORWAY.x, z: DOORWAY_ENTRY_Z },
  cameras: {
    // FRAMED ON THE CHAIR from outside the furniture. The first attempt put the
    // operator camera at the operator's standing spot, which is 0.95 m from the
    // stool — so the shot was the inside of the stool. These sit back far enough
    // to see what is being judged.
    front: {
      from: [CHAIR_POS[0] + 0.15, 1.45, CHAIR_POS[2] + 2.6],
      to: [CHAIR_POS[0], 0.85, CHAIR_POS[2]],
    },
    side: {
      from: [CHAIR_POS[0] - 2.6, 1.5, CHAIR_POS[2] - 1.6],
      to: [CHAIR_POS[0], 0.8, CHAIR_POS[2]],
    },
    // Straight down: the one view where "is he ON the seat or beside it" and
    // "which way is he pointing" are both unambiguous.
    top: {
      from: [CHAIR_POS[0], 4.2, CHAIR_POS[2] + 0.01],
      to: [CHAIR_POS[0], 0, CHAIR_POS[2]],
    },
    // The whole room, from the far corner.
    room: {
      from: [-ROOM_HALF + 0.4, 2.4, ROOM_HALF - 0.4],
      to: [0.4, 0.9, -0.4],
    },
  },
}

process.stdout.write(JSON.stringify(scene, null, 2))
