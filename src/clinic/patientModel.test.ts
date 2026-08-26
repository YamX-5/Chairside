/**
 * Contract test for public/models/patient.glb.
 *
 * The rig drives the model entirely by NAME — `root.getObjectByName('mixamorig:Head')`
 * and friends — and every write is guarded (`if (p.head) ...`). That means a
 * renamed bone, a missing clip or a lost skin does not throw: the patient simply
 * renders and never moves, which is exactly the failure that is hardest to spot
 * and easiest to ship.
 *
 * So the model's shape is asserted here rather than trusted.
 *
 * Run: npx tsx src/clinic/patientModel.test.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const GLB = resolve(HERE, '../../public/models/patient.glb')

/** The bones PatientRig.tsx looks up. Keep in sync with its BONES map. */
const REQUIRED_BONES = [
  'mixamorig:Hips',
  'mixamorig:Spine2',
  'mixamorig:Neck',
  'mixamorig:Head',
  'mixamorig:LeftArm',
  'mixamorig:RightArm',
  'mixamorig:LeftForeArm',
  'mixamorig:RightForeArm',
  'mixamorig:LeftUpLeg',
  'mixamorig:RightUpLeg',
  'mixamorig:LeftLeg',
  'mixamorig:RightLeg',
]

/** The clips PatientRig.tsx selects between. */
const REQUIRED_CLIPS = ['Walking', 'StandToSit', 'SittingIdle']

interface Gltf {
  nodes?: { name?: string; mesh?: number; children?: number[]; skin?: number }[]
  meshes?: { primitives: { attributes: Record<string, number> }[] }[]
  animations?: { name?: string; channels: unknown[] }[]
  skins?: { joints: number[] }[]
  images?: unknown[]
}

/** Pull the JSON chunk out of a binary glTF container. */
function readGlb(path: string): Gltf {
  const buf = readFileSync(path)
  if (buf.toString('utf8', 0, 4) !== 'glTF') throw new Error(`not a GLB: ${path}`)
  let off = 12
  while (off < buf.length) {
    const len = buf.readUInt32LE(off)
    const type = buf.readUInt32LE(off + 4)
    if (type === 0x4e4f534a) return JSON.parse(buf.toString('utf8', off + 8, off + 8 + len))
    off += 8 + len
  }
  throw new Error('no JSON chunk')
}

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`  ok   ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const g = readGlb(GLB)
const names = (g.nodes ?? []).map((n) => n.name ?? '')
const clips = (g.animations ?? []).map((a) => a.name ?? '')

console.log('patient.glb contract')

for (const bone of REQUIRED_BONES) {
  check(`bone ${bone}`, names.includes(bone))
}

for (const clip of REQUIRED_CLIPS) {
  check(`clip ${clip}`, clips.includes(clip))
}

check('is skinned', (g.skins?.length ?? 0) > 0, `skins=${g.skins?.length ?? 0}`)
check(
  'skin has all 65 joints',
  g.skins?.[0]?.joints.length === 65,
  `joints=${g.skins?.[0]?.joints.length}`,
)

const attrs = new Set(
  (g.meshes ?? []).flatMap((m) => m.primitives.flatMap((p) => Object.keys(p.attributes))),
)
check('has baked vertex colours (COLOR_0)', attrs.has('COLOR_0'))
check('has skin weights (JOINTS_0 + WEIGHTS_0)', attrs.has('JOINTS_0') && attrs.has('WEIGHTS_0'))
check('ships no textures', (g.images?.length ?? 0) === 0, `images=${g.images?.length ?? 0}`)

// The blink squashes Eyes.scale.z. A SKINNED mesh ignores its own object scale,
// because the skinning matrices rewrite the transform every frame — so if the
// eyes ever come back skinned, the blink silently stops working.
const eyeIdx = names.indexOf('Eyes')
check('Eyes node exists', eyeIdx >= 0)
if (eyeIdx >= 0) {
  const eyeNode = g.nodes![eyeIdx]
  check('Eyes is NOT skinned (else the blink cannot squash it)', eyeNode.skin === undefined)
  const parent = (g.nodes ?? []).find((n) => n.children?.includes(eyeIdx))
  check(
    'Eyes is parented to the head bone',
    parent?.name === 'mixamorig:Head',
    `parent=${parent?.name ?? 'none'}`,
  )
  const prim = g.meshes?.[eyeNode.mesh ?? -1]?.primitives[0]
  check('Eyes carry vertex colours', !!prim && 'COLOR_0' in prim.attributes)
}

// Every clip must key the bones the rig adds offsets to, or the procedural layer
// composes against an unposed skeleton.
for (const a of g.animations ?? []) {
  check(`clip ${a.name} has channels`, a.channels.length > 0, `channels=${a.channels.length}`)
}

console.log(failures === 0 ? '\nPASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
