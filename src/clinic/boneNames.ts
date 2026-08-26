import type { Object3D } from 'three'

/**
 * Find a bone by the name it was AUTHORED with, not the name three gives it.
 *
 * THE TRAP
 * --------
 * three's GLTFLoader runs every node name through PropertyBinding
 * .sanitizeNodeName, which strips the characters [].:/ because they are reserved
 * for animation track binding syntax. So a Mixamo skeleton authored as
 * "mixamorig:Hips" arrives in the scene as "mixamorigHips".
 *
 * `root.getObjectByName('mixamorig:Hips')` therefore returns undefined — for
 * every bone, silently. Nothing throws. The rig simply finds nothing and every
 * feature built on it stops: no root-motion stripping, no blinking, no
 * reactions. The patient walked in with her raw hips track intact, which drove
 * her through the floor.
 *
 * It cost two rigs before it was spotted, because the file really does contain
 * the authored name — so anything that inspects the .glb agrees with the code
 * and only the running game disagrees.
 *
 * Compare sanitised-to-sanitised and the authored names in the codebase stay
 * readable, whatever the loader does to them.
 */
const RESERVED = /[[\]./:]/g

export function sanitizeBoneName(name: string): string {
  return name.replace(RESERVED, '')
}

export function findBone(root: Object3D, authored: string): Object3D | undefined {
  const want = sanitizeBoneName(authored)
  // Exact match first: cheap, and correct when the name had nothing to strip.
  const direct = root.getObjectByName(authored) ?? root.getObjectByName(want)
  if (direct) return direct

  let found: Object3D | undefined
  root.traverse((o) => {
    if (!found && sanitizeBoneName(o.name) === want) found = o
  })
  return found
}
