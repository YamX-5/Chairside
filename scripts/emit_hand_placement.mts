/**
 * Compute the hands' final placement and write it where Blender can read it.
 *
 * The point is that the preview must show what the GAME shows, not an
 * approximation of it. So the numbers come from the same placeHand() the
 * component calls, run against the same shipped .glb through the same loader —
 * not retyped into a Python script where they would drift the first time either
 * side changed.
 *
 *   npx tsx scripts/emit_hand_placement.mts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Object3D } from 'three'
import {
  CURL_AXIS,
  FINGER_DIR,
  GRIP_TARGET,
  HAND_LENGTH,
  REST_CURL,
  WRIST_TARGET,
  isPair,
  placeHand,
} from '../src/clinic/handsRig'

const buf = readFileSync('public/models/hands.glb')
const gltf = await new Promise<any>((resolve, reject) => {
  new GLTFLoader().parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    '',
    resolve,
    reject,
  )
})

const scene: Object3D = gltf.scene
const place = placeHand(scene)

const out = {
  // Everything below is in CAMERA space: the game's group rides the camera with
  // an identity transform, so camera space is exactly what the player sees.
  glb: 'public/models/hands.glb',
  mirrored: !isPair(scene),
  scale: place.scale,
  measured: place.measured,
  handLength: HAND_LENGTH,
  position: place.position.toArray(),
  quaternion: place.quaternion.toArray(),
  wristTarget: WRIST_TARGET.toArray(),
  gripTarget: GRIP_TARGET.toArray(),
  fingerDir: FINGER_DIR.clone().normalize().toArray(),
  restCurl: REST_CURL,
  curlAxis: CURL_AXIS.toArray(),
}

writeFileSync('blender/.hand_placement.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
