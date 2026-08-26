import type { Object3D } from 'three'
import { findBone } from './boneNames'

/**
 * Logical part -> Mixamo bone, under the name it was AUTHORED with.
 *
 * Kept out of PatientRig.tsx so it can be tested against the real .glb: that
 * component imports react-three-fiber, which does not load outside a browser,
 * and this is exactly the code that most needs a test against the real asset.
 *
 * Blender's glTF exporter preserves `mixamorig:` verbatim — but three's loader
 * does not, so these names never match anything in the scene and have to go
 * through findBone. The authored names stay here because they are what you see
 * in Blender and in the file.
 */
export const BONES = {
  hips: 'mixamorig:Hips',
  chest: 'mixamorig:Spine2',
  neck: 'mixamorig:Neck',
  head: 'mixamorig:Head',
  upperArmL: 'mixamorig:LeftArm',
  upperArmR: 'mixamorig:RightArm',
  forearmL: 'mixamorig:LeftForeArm',
  forearmR: 'mixamorig:RightForeArm',
  thighL: 'mixamorig:LeftUpLeg',
  thighR: 'mixamorig:RightUpLeg',
  shinL: 'mixamorig:LeftLeg',
  shinR: 'mixamorig:RightLeg',
} as const

export type RigParts = Partial<Record<keyof typeof BONES | 'eyes', Object3D>>

export function findParts(root: Object3D): RigParts {
  const out: RigParts = {}
  for (const [key, bone] of Object.entries(BONES)) {
    // findBone, NOT getObjectByName. three strips the colon out of
    // "mixamorig:Hips" on load, so a direct lookup on the authored name finds
    // nothing — for every bone, silently. See boneNames.ts.
    out[key as keyof typeof BONES] = findBone(root, bone)
  }
  // Bone-parented in Blender and deliberately NOT skinned, so its scale is free
  // for the blink. A skinned mesh cannot be squashed this way — the skinning
  // matrices rewrite the object transform every frame.
  out.eyes = findBone(root, 'Eyes')
  return out
}
