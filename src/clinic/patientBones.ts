import type { Object3D } from 'three'
import { findBone } from './boneNames'

/**
 * Logical part -> Quaternius bone, under the name it was AUTHORED with.
 *
 * Kept out of PatientRig.tsx so it can be tested against the real .glb: that
 * component imports react-three-fiber, which does not load outside a browser,
 * and this is exactly the code that most needs a test against the real asset.
 *
 * THE DOTS ARE THE WHOLE PROBLEM. This rig names its sides "UpperArm.L" and
 * "Foot.R", and three's GLTFLoader runs PropertyBinding.sanitizeNodeName over
 * every node on the way in, which strips [].:/ — so the scene contains
 * "UpperArmL" and a direct getObjectByName on the authored name finds nothing,
 * for every limb, silently. That exact trap ate four separate bugs in this
 * project. The authored names stay here because they are what you see in
 * Blender and in the file; findBone does the sanitising.
 *
 * WHAT THIS RIG DOES NOT HAVE
 * ---------------------------
 * Spine2 and an Eyes plate. Quaternius runs Hips -> Abdomen -> Torso -> Neck ->
 * Head with no second spine bone, so `chest` is Torso; and the eyes are painted
 * into the head mesh rather than modelled, so there is no bone to squash for a
 * blink. `eyes` therefore stays optional and the blink simply does not run —
 * which is why every use of it in PatientRig is already guarded.
 */
export const BONES = {
  hips: 'Hips',
  // No Spine2 in this rig — Hips -> Abdomen -> Torso -> Neck -> Head. Torso is
  // the bone the breath rotates, and the highest one below the neck.
  chest: 'Torso',
  neck: 'Neck',
  head: 'Head',
  upperArmL: 'UpperArm.L',
  upperArmR: 'UpperArm.R',
  forearmL: 'LowerArm.L',
  forearmR: 'LowerArm.R',
  thighL: 'UpperLeg.L',
  thighR: 'UpperLeg.R',
  shinL: 'LowerLeg.L',
  shinR: 'LowerLeg.R',
} as const

export type RigParts = Partial<Record<keyof typeof BONES | 'eyes', Object3D>>

export function findParts(root: Object3D): RigParts {
  const out: RigParts = {}
  for (const [key, bone] of Object.entries(BONES)) {
    // findBone, NOT getObjectByName. three strips the DOT out of "UpperArm.L"
    // on load, so a direct lookup on the authored name finds nothing — for every
    // limb, silently. See boneNames.ts.
    out[key as keyof typeof BONES] = findBone(root, bone)
  }
  // Absent from the Quaternius rig, which paints the eyes into the head mesh.
  // Left in place because it costs one lookup and the blink is already written:
  // drop in a model that HAS an eye plate and it starts working again.
  out.eyes = findBone(root, 'Eyes')
  return out
}
