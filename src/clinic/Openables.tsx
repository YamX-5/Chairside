import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Box3, Group, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { OPENABLES, openableId, type Openable } from './layout'
import { DURATIONS, advance, leap, slip } from './motion'

/**
 * Makes the parts of a prop that should move, move: drawers slide, doors swing.
 *
 * WHY THE PIVOT IS BUILT FROM THE PROP ROOT AND NOT THE LEAF'S PARENT
 * ------------------------------------------------------------------
 * Both props are Sketchfab exports of Z-up models, so every leaf hangs under
 * glTF's Z-up-to-Y-up correction node — a -90 degree rotation about X. Inside
 * that parent's space, **+Z is world UP and +Y is world depth**.
 *
 * The first version of this file measured the hinge in world space, wrote the
 * result into `pivot.position.z`, and animated `pivot.rotation.y`. Every one of
 * those is the wrong axis under that correction: the pivot was driven to the
 * floor, doors swung about a HORIZONTAL axis — Door_00's leading edge ended up
 * at x -3.68, through a wall that is at -3.0 — and drawers slid straight UP.
 * On screen a door "just went to the far left", which is exactly what a panel
 * rotating about the wrong axis does.
 *
 * So the basis comes from the PROP ROOT: the pivot is given the prop's own
 * orientation, and after that its local +Y is world up and its local +Z faces
 * out of the front of the prop, whatever the asset's native axes were. A future
 * prop that is not a Z-up export needs no special case.
 *
 * THE MATRICES MUST BE FRESH. `<primitive>` carries prop.pos and prop.yaw, and
 * three.js only folds those into matrixWorld during render. Without an explicit
 * `updateWorldMatrix` the FIRST openable of each prop is measured in model space
 * and the rest in world space — because `Object3D.attach()` refreshes ancestors
 * as a side effect, so measuring the second one happens to be correct. In dev,
 * StrictMode's second mount hides this entirely; a production build does not.
 *
 * ONE OPENABLE CAN BE SEVERAL MESHES. The glass cabinet's doors are a wooden
 * frame and a separate glass pane; hinging each on its own bounding box gives
 * them different pivots and swings the glass out of its frame. The pivot is
 * computed from the UNION of the group's nodes.
 *
 * MUTATES THE SCENE GRAPH, so it must only ever run against a CLONE of the
 * loaded glTF. `ClinicProps` clones per prop, which is what makes that safe.
 */

/**
 * How far each openable currently is along its travel, 0 shut to 1 open.
 *
 * Mutable and module-level for the reason input.ts and stoolPose are: it changes
 * every frame while something is moving, and React state at that rate re-renders
 * the whole scene.
 *
 * It exists so a drawer's CONTENTS can ride the drawer. They used to be drawn at
 * the fully-open position and simply appear the moment it was opened — "it's not
 * even accurate, it's just popping up". Now they slide out with the front.
 */
export const openableProgress = new Map<string, number>()

const UP = new Vector3(0, 1, 0)
const _swing = new Quaternion()

interface Rig {
  spec: Openable
  id: string
  pivot: Group
  /** Orientation when shut — the prop's basis, not the leaf's. */
  base: Quaternion
  /** Parent-local position when shut, so closing is exact. */
  rest: Vector3
  /** Parent-local direction a drawer travels, one unit per metre. */
  slide: Vector3
  /** Eased 0..1, per part. */
  t: number
}

/**
 * The invisible box you click to work a drawer or door.
 *
 * Expressed in the PIVOT's own space and rendered as a child of it, so it swings
 * and slides with the part. It used to be a world-space box captured once, in
 * the CLOSED position, and never moved again — which broke both directions:
 *
 *   - a door swung 90 degrees left its target hanging in the doorway, so every
 *     click aimed at the shelf behind it hit the door instead and shut it. Since
 *     the handler calls stopPropagation and r3f stops dispatch at the first
 *     stopped hit, nothing in the cabinet could ever be picked up.
 *   - a drawer pulled 0.32 m out could only be closed by clicking the empty air
 *     where it used to be.
 */
interface HitBox {
  id: string
  /** The pivot this rides on, so the target follows the part. */
  pivot: Group
  centre: [number, number, number]
  size: [number, number, number]
}

export function Openables({
  scene,
  prop,
  openIds,
  onToggle,
}: {
  /** A CLONE of the prop's .glb. */
  scene: Object3D | null
  prop: Openable['prop']
  /** The ids currently open. Anything not in here eases shut. */
  openIds: ReadonlySet<string>
  /** Called with one openable's id when its click target is hit. */
  onToggle?: (id: string) => void
}) {
  const rigs = useRef<Rig[]>([])
  const [hits, setHits] = useState<HitBox[]>([])

  const active = useMemo(() => OPENABLES.filter((o) => o.prop === prop), [prop])

  useEffect(() => {
    if (!scene) return

    // Fold prop.pos / prop.yaw into matrixWorld before anything is measured.
    scene.updateWorldMatrix(true, true)
    const toProp = new Matrix4().copy(scene.matrixWorld).invert()
    const propQ = scene.getWorldQuaternion(new Quaternion())

    const built: Rig[] = []
    const boxes: HitBox[] = []

    for (const spec of active) {
      const found = spec.nodes
        .map((n) => scene.getObjectByName(n))
        .filter((n): n is Object3D => !!n)
      // A missing node is not fatal: the room must still render for anyone on an
      // older .glb from before the parts were named.
      if (!found.length) continue
      const parent = found[0].parent
      if (!parent) continue

      const box = new Box3()
      for (const n of found) box.expandByObject(n)

      // The same box in the PROP's frame, where +Y is up and +Z faces the room.
      const propBox = box.clone().applyMatrix4(toProp)

      const pivot = new Group()
      // Give the pivot the prop's orientation. After this its local axes mean
      // what they say regardless of the asset's native up-axis.
      pivot.quaternion
        .copy(parent.getWorldQuaternion(new Quaternion()))
        .invert()
        .multiply(propQ)

      // Hinge line: the outer vertical edge, at the front face, at the bottom.
      const hinge = new Vector3(
        spec.hinge === 'right' ? propBox.max.x : propBox.min.x,
        propBox.min.y,
        propBox.max.z,
      ).applyMatrix4(scene.matrixWorld)
      pivot.position.copy(parent.worldToLocal(hinge))

      parent.add(pivot)
      // attach(), not add(): it compensates for the pivot's own transform, so
      // the leaf stays exactly where it was rendering a frame ago.
      for (const n of found) pivot.attach(n)

      const pScale = parent.getWorldScale(new Vector3()).x || 1
      built.push({
        spec,
        id: openableId(spec),
        pivot,
        base: pivot.quaternion.clone(),
        rest: pivot.position.clone(),
        // The prop's +Z, expressed in parent space, scaled so travel is metres.
        slide: new Vector3(0, 0, 1).applyQuaternion(pivot.quaternion).multiplyScalar(1 / pScale),
        t: 0,
      })

      // The hit box in the PIVOT's frame, so it travels with the part.
      pivot.updateMatrixWorld(true)
      const local = box
        .clone()
        .applyMatrix4(new Matrix4().copy(pivot.matrixWorld).invert())
      const c = local.getCenter(new Vector3())
      const sz = local.getSize(new Vector3())
      boxes.push({
        id: openableId(spec),
        pivot,
        centre: [c.x, c.y, c.z],
        // Padded on the pivot's local +Z — the prop's FRONT, the face you aim
        // at. This used to pad world +Z regardless of the prop's yaw, so for a
        // rotated prop the target was widened sideways and the face you were
        // actually pointing at stayed as thin as the door panel.
        size: [Math.max(sz.x, 0.06), Math.max(sz.y, 0.06), Math.max(sz.z, 0.04) + 0.06],
      })
    }

    rigs.current = built
    setHits(onToggle ? boxes : [])

    return () => {
      // Put everything back, or a re-mount re-parents already-re-parented nodes
      // and the offsets compound.
      for (const rig of built) {
        const grandparent = rig.pivot.parent
        if (grandparent) {
          for (const child of [...rig.pivot.children]) grandparent.attach(child)
        }
        rig.pivot.removeFromParent()
      }
      rigs.current = []
      setHits([])
    }
  }, [scene, active, onToggle])

  useFrame((_, dt) => {
    if (!rigs.current.length) return


    for (const rig of rigs.current) {
      const open = openIds.has(rig.id)
      // Progress advances in real time, so a 120 Hz phone and a 30 Hz one take
      // the same wall-clock time. The old per-frame factor did not.
      rig.t = advance(rig.t, open ? 1 : 0, dt, DURATIONS.openable)

      // OPENING leaps: it pulls out fast and springs a little past where it is
      // going, the way a drawer you actually yank does.
      //
      // CLOSING slips, and the curve has to be MIRRORED to do it. `rig.t` runs
      // 1 -> 0 on the way shut, and slip is an ease-out — read directly it is
      // flat near 1 and steep near 0, so the drawer would creep away and then
      // slam. `1 - slip(1 - t)` puts the speed at the start and the settle at
      // the end, which is what closing a drawer actually feels like.
      const a = open ? leap(rig.t) : 1 - slip(1 - rig.t)

      // Publish how far along it is, so anything RIDING this part can follow.
      //
      // Module-level and mutable, the same trade input.ts and stoolPose make:
      // this changes every frame while a drawer moves, and routing it through
      // React state would re-render the scene at 60 Hz. Written for every
      // openable, not just drawers, so a door's contents could ride it too.
      openableProgress.set(rig.id, a)

      if (rig.spec.kind === 'drawer') {
        rig.pivot.position.copy(rig.rest).addScaledVector(rig.slide, rig.spec.travel * a)
      } else {
        // Post-multiplied, so UP is the PIVOT's local +Y — which is world up,
        // because the pivot carries the prop's basis. Assigning rotation.y here
        // would clobber that basis and put us back to swinging sideways.
        const dir = rig.spec.hinge === 'left' ? -1 : 1
        rig.pivot.quaternion
          .copy(rig.base)
          .multiply(_swing.setFromAxisAngle(UP, dir * rig.spec.travel * a))
      }
    }
  })

  if (!onToggle || !hits.length) return null
  return (
    <>
      {hits.map((h) => (
        // Portalled INTO the pivot, so the target swings and slides with the
        // part instead of staying where the part used to be. The Fragment
        // carries the list key — createPortal's third argument is r3f state,
        // not a key.
        <Fragment key={h.id}>
          {createPortal(
            <mesh
              position={h.centre}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation()
                onToggle(h.id)
              }}
            >
              <boxGeometry args={h.size} />
              {/* Transparent rather than `visible={false}`. Either would raycast
                  — three tests layers, not visibility — but an invisible mesh is
                  easy to mistake for a dead one, and a zero-opacity material
                  says "present but unseen" to the next reader. */}
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>,
            h.pivot,
          )}
        </Fragment>
      ))}
    </>
  )
}
