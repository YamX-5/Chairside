import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Box3, Group, Object3D, Vector3 } from 'three'
import { OPENABLES, openableId, type Openable } from './layout'

/**
 * Makes the parts of a prop that should move, move: drawers slide, doors swing.
 *
 * HOW IT WORKS, AND WHY IT LOOKS LIKE THIS
 * ----------------------------------------
 * Props ship as one .glb each. The parts that open are ordinary meshes inside
 * them with stable names — see OPENABLES in layout.ts for which parts, and why
 * only those.
 *
 * A door has to rotate about its HINGE, not about its own centre, and a glTF
 * node's origin is wherever the exporter happened to leave it. So on mount each
 * leaf is re-parented into a `Group` sitting on its hinge line, using
 * `Object3D.attach()` — which preserves the world transform, so nothing jumps
 * when it is adopted. Rotating that group then rotates the leaf about the hinge,
 * which is what a door does.
 *
 * ONE OPENABLE CAN BE SEVERAL MESHES. The glass cabinet's doors are a wooden
 * frame and a separate glass pane; hinging each on its own bounding box would
 * give them different pivots and the glass would swing out of its frame. The
 * pivot is computed from the UNION of the group's nodes, once.
 *
 * ONE AT A TIME. Each openable owns its own state and its own click target.
 * This used to be a single boolean for a whole section, so opening a drawer
 * flung the two cabinets above it open as well — a room-wide poltergeist rather
 * than someone reaching for a drawer.
 *
 * MUTATES THE SCENE GRAPH, so it must only ever run against a CLONE of the
 * loaded glTF. `ClinicProps` clones per prop, which is what makes that safe —
 * doing this to the cached original would re-parent nodes for every consumer and
 * React strict-mode's double mount would do it twice.
 */

interface Rig {
  spec: Openable
  id: string
  pivot: Group
  /** Where the pivot sits when shut, so closing is exact rather than approximate. */
  restZ: number
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
  /** Which prop's openables to drive. */
  prop: Openable['prop']
  /** The ids currently open. Anything not in here eases shut. */
  openIds: ReadonlySet<string>
  /**
   * Called with one openable's id when its click target is hit. Omit to make
   * the parts move but not be clickable (e.g. driven only by a key prompt).
   */
  onToggle?: (id: string) => void
}) {
  const rigs = useRef<Rig[]>([])
  const [hits, setHits] = useState<HitBox[]>([])

  const active = useMemo(() => OPENABLES.filter((o) => o.prop === prop), [prop])

  useEffect(() => {
    if (!scene) return
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

      const pivot = new Group()
      if (spec.kind === 'door') {
        // Hinge line: the outer vertical edge, on the room-facing side. Hinging
        // on the centre makes a door pivot through its own frame.
        const local = parent.worldToLocal(
          new Vector3(spec.hinge === 'left' ? box.min.x : box.max.x, 0, box.max.z),
        )
        pivot.position.set(local.x, 0, local.z)
      }

      parent.add(pivot)
      // attach(), not add(): it compensates for the pivot's own transform, so
      // the leaf stays exactly where it was rendering a frame ago.
      for (const n of found) pivot.attach(n)

      const id = openableId(spec)
      built.push({ spec, id, pivot, restZ: pivot.position.z, t: 0 })

      const c = box.getCenter(new Vector3())
      const sz = box.getSize(new Vector3())
      boxes.push({
        id,
        centre: [c.x, c.y, c.z],
        // Padded forward a little so the target is comfortable to hit without
        // swallowing clicks meant for whatever is stored behind it.
        size: [Math.max(sz.x, 0.05), Math.max(sz.y, 0.05), Math.max(sz.z, 0.03) + 0.05],
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
    // Ease toward each part's own target. A drawer that teleports open reads as
    // a glitch; one that takes a third of a second reads as a drawer.
    const k = 1 - Math.exp(-dt * 9)

    for (const rig of rigs.current) {
      const target = openIds.has(rig.id) ? 1 : 0
      rig.t += (target - rig.t) * k
      const a = rig.t
      if (rig.spec.kind === 'drawer') {
        rig.pivot.position.z = rig.restZ + rig.spec.travel * a
      } else {
        // Sign derived and then VERIFIED by applying the same rotation in
        // Blender and rendering it: a left-hinged leaf has its body at +X of the
        // hinge and must swing to +Z, which needs a negative rotation.
        const dir = rig.spec.hinge === 'left' ? -1 : 1
        rig.pivot.rotation.y = dir * rig.spec.travel * a
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
