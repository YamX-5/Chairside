import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
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

interface HitBox {
  id: string
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

      const c = box.getCenter(new Vector3())
      const sz = box.getSize(new Vector3())
      boxes.push({
        id: openableId(spec),
        centre: [c.x, c.y, c.z],
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
        <mesh
          key={h.id}
          position={h.centre}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onToggle(h.id)
          }}
        >
          <boxGeometry args={h.size} />
          {/* Invisible, but still raycast: `visible={false}` would stop it being
              hit at all, so it is a fully transparent material instead. */}
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}
