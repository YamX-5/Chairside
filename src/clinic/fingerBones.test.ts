import assert from 'node:assert/strict'
import { boneSide, parseFingerBone } from './fingerBones'

let failures = 0
function check(name: string, fn: () => void) {
  try {
    fn()
  } catch (e) {
    failures++
    console.error(`  FAIL ${name}\n    ${(e as Error).message}`)
  }
}

// The rig actually shipping in public/models/hands.glb.
check('reads Rigify names as exported by Sketchfab', () => {
  assert.deepEqual(parseFingerBone('f_index.01.R_027'), { finger: 0, segment: 1 })
  assert.deepEqual(parseFingerBone('f_middle.02.R_017'), { finger: 1, segment: 2 })
  assert.deepEqual(parseFingerBone('f_ring.03.L_043'), { finger: 2, segment: 3 })
  assert.deepEqual(parseFingerBone('f_pinky.01.L_033'), { finger: 3, segment: 1 })
  assert.deepEqual(parseFingerBone('thumb.03.L_050'), { finger: 4, segment: 3 })
})

// So that swapping the asset does not mean editing Hands.tsx.
check('reads the other common conventions', () => {
  assert.deepEqual(parseFingerBone('mixamorig:RightHandIndex2'), { finger: 0, segment: 2 })
  assert.deepEqual(parseFingerBone('LeftHandThumb3'), { finger: 4, segment: 3 })
  assert.deepEqual(parseFingerBone('index_01_r'), { finger: 0, segment: 1 })
  assert.deepEqual(parseFingerBone('Bip01_L_Finger42'), null) // no finger word
})

check('treats "little" as the pinky', () => {
  assert.deepEqual(parseFingerBone('f_little.02.R'), { finger: 3, segment: 2 })
})

// Rotating an end bone snaps the mesh; it carries no geometry of its own.
check('rejects end/tip bones', () => {
  assert.equal(parseFingerBone('f_index.03.R_end_057'), null)
  assert.equal(parseFingerBone('f_pinky.03.R_end_053'), null)
  assert.equal(parseFingerBone('mixamorig:RightHandIndex4'), null)
})

// Rotating a metacarpal splays the whole hand instead of bending one finger.
check('rejects palm/metacarpal bones', () => {
  assert.equal(parseFingerBone('palm_index.R_026'), null)
  assert.equal(parseFingerBone('palm_pinky.L_032'), null)
})

check('rejects everything that is not a finger', () => {
  assert.equal(parseFingerBone('hand.R_010'), null)
  assert.equal(parseFingerBone('forearm.L_08'), null)
  assert.equal(parseFingerBone('_rootJoint'), null)
  assert.equal(parseFingerBone('clavicle.R_01'), null)
})

// The exporter's trailing number is not a segment index. Reading it would give
// every joint a nonsense segment and break the knuckle-leads-tip-follows curl.
check('does not mistake the exporter suffix for a segment', () => {
  assert.deepEqual(parseFingerBone('f_index.01.R_027'), { finger: 0, segment: 1 })
  assert.equal(parseFingerBone('f_index.R_027'), null)
})

// A one-hand asset is mirrored for the other side. Mirroring a pair gives four
// hands, so the two cases have to be told apart reliably.
check('reads which hand a bone belongs to', () => {
  assert.equal(boneSide('f_index.01.R_027'), 'R')
  assert.equal(boneSide('thumb.01.L_048'), 'L')
  assert.equal(boneSide('mixamorig:RightHandIndex2'), 'R')
  assert.equal(boneSide('LeftHandThumb3'), 'L')
  assert.equal(boneSide('index_01_r'), 'R')
  assert.equal(boneSide('hand_l'), 'L')
})

// "ring" starts with an r; a loose pattern calls every ring finger right-handed.
check('does not read the r of "ring" as the right hand', () => {
  assert.equal(boneSide('f_ring.01.L_041'), 'L')
  assert.equal(boneSide('ring1'), null)
  assert.equal(boneSide('Index1'), null)
})

if (failures) {
  console.error(`${failures} failing`)
  process.exit(1)
}
console.log('fingerBones: all checks passed')
