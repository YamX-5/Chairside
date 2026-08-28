import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Group, Object3D, Quaternion, Vector3 } from 'three'
import { useOptionalGLTF } from './useOptionalGLTF'
import { applyBakedLighting } from './bakedMaterial'
import { BRACKET_TRAY, CABINET_SHELF, DRAWER_SHELF, XRAY_DOCK } from './layout'
import { GRIP_TARGET, gripQuaternion } from './handsRig'
import {
  CLOSET_INSTRUMENTS,
  DRAWER_INSTRUMENTS,
  INSTRUMENTS,
  SHELF_INSTRUMENTS,
  TRAY_INSTRUMENTS,
  trayLayout,
  type InstrumentId,
} from './instruments'

/**
 * The instrument tray, and whatever is currently in your hand.
 *
 * Two jobs in one component because they share one loaded GLB: the tray clones
 * each instrument by name and lays them out, and the held one is another clone
 * of the same node parented to the camera.
 *
 * Every instrument's origin is its GRIP (see build_instruments.py), so "hold
 * this" is a fixed offset from the camera and nothing else. That was designed
 * in deliberately — the chair and the patient each cost three debugging rounds
 * because their origins were arbitrary and every placement became a guess.
 */

const BASE = import.meta.env.BASE_URL

/**
 * The set-up tray, ON the dental unit's own bracket tray.
 *
 * Both of these used to be CHAIR_POS minus a hand-picked literal, and so did
 * the operator's stool — three things hung off one anchor by three different
 * numbers, with nothing comparing them. The tray landed 36% inside the stool's
 * leather cushion: the mirror, explorer and suction rendered INSIDE it, and the
 * syringe and handpiece had no surface beneath them at all.
 *
 * The unit already ships a bracket tray (`Object_14`, measured top y 0.906), so
 * there is nothing to invent — instruments now lie on the real one, 1 cm proud.
 */
const TRAY: [number, number, number] = [BRACKET_TRAY.x, BRACKET_TRAY.y + 0.01, BRACKET_TRAY.z]

/** The glass cabinet's middle shelf, measured off closet.glb. */
const CLOSET: [number, number, number] = [CABINET_SHELF.x, CABINET_SHELF.y, CABINET_SHELF.z]

/** Turns an instrument's local +Z onto the direction the fingers point. */
const GRIP_ROT = gripQuaternion()

const camPos = new Vector3()
const camQuat = new Quaternion()
const held = new Vector3()

/**
 * One pickable instrument, wherever it is stored.
 *
 * MODULE SCOPE, deliberately. This used to be declared inside InstrumentTray's
 * body, which gives it a new function identity on every render — so React
 * unmounted and remounted every instrument each time ANY state changed. Hovering
 * sets state, so moving the mouse across the tray tore down the very subtree the
 * pointer was over: onPointerOut never matched its onPointerOver, and a click
 * arriving between the two landed on a component that no longer existed. The
 * tray looked alive and swallowed every click.
 */
function Pickable({
  inst,
  x,
  node,
  enabled,
  hovered,
  onHover,
  onPick,
  onBlocked,
}: {
  inst: (typeof INSTRUMENTS)[number]
  x: number
  node: Object3D | undefined
  enabled: boolean
  hovered: boolean
  onHover: (id: InstrumentId | null) => void
  onPick: (id: InstrumentId) => void
  /** Clicked while locked — the caller explains why. */
  onBlocked: (id: InstrumentId) => void
}) {
  if (!node) return null
  // Hover responds even when picking is locked. Gating the lift on `enabled`
  // made a not-yet-live tray look dead rather than locked.
  const lifted = hovered
  return (
    <group
      position={[x, lifted ? 0.03 : 0, 0]}
      // NO ROTATION. Every instrument in instruments.glb runs along its LOCAL
      // +Z from the grip (build_instruments.py), which is already flat-on-the-
      // tray once the group is placed. This used to be [-PI/2, 0, 0], which
      // stood that long axis UP: the five tools rose 0.17 m off the delivery
      // head like fence posts, and the suction and handpiece hoses hung
      // through it. That is the "handpieces are sitting above the unit" bug.
      //
      // It also made them unpickable. Standing upright put their boxes inside
      // the delivery arm's own mesh (Object_13, y 0.706..1.212); r3f sorts hits
      // by distance and the arm is nearer, carries no handler, and swallowed
      // the click. Lying flat they sit 26-50 mm proud of the bracket, clear of
      // it.
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onHover(inst.id)
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // A LOCKED INSTRUMENT MUST SAY SO. Clicking one before the plan is
        // committed used to do nothing at all — no pick, no message, no sound —
        // which is indistinguishable from the game being broken. It is the
        // single most-reported problem with this tray: "I can't hold any
        // instruments."
        if (!enabled) {
          e.stopPropagation()
          onBlocked(inst.id)
          return
        }
        e.stopPropagation()
        onPick(inst.id)
      }}
    >
      <primitive object={node} />
      {/* An invisible slab gives each instrument a click target far bigger
          than its 6 mm handle. Raycasting a thin cylinder is the reason the
          buttons felt hard.
          three raycasts invisible objects fine — it tests layers, never
          `visible` — so this really is hittable.
          The long side is Z because that is the instrument's own long axis; it
          used to be sized for the rotated frame and stood up as a 7 cm column. */}
      <mesh visible={false}>
        <boxGeometry args={[0.07, 0.07, 0.34]} />
      </mesh>
    </group>
  )
}

function retint(obj: Object3D) {
  // Instruments get picked up and swung around in front of the camera, so they
  // are movers: baked occlusion, live directional light.
  applyBakedLighting(obj, { moves: true })
}

interface Props {
  /** Null when empty-handed. */
  heldId: InstrumentId | null
  onPick: (id: InstrumentId) => void
  /** Told when a locked instrument is clicked, so the HUD can say why. */
  onBlocked: (id: InstrumentId) => void
  /** Instruments can only be picked up once a plan has been committed. */
  enabled: boolean
  /**
   * Cabinet contents are only reachable once its doors are open.
   *
   * There is no `onToggleCloset` any more: this component used to draw a
   * primitive cabinet door and own the click that opened it. The real cabinet
   * is a prop with real door meshes, so `Openables` carries that click now and
   * this component only reads the resulting state.
   */
  closetOpen: boolean
  /**
   * The instrument drawer is pulled out, so its contents are reachable.
   *
   * Same shape as closetOpen and for the same reason: Openables owns the click
   * that works the drawer, and this component only reads the result.
   */
  drawerOpen: boolean
}

export function InstrumentTray({
  heldId,
  onPick,
  onBlocked,
  enabled,
  closetOpen,
  drawerOpen,
}: Props) {
  const gltf = useOptionalGLTF(`${BASE}models/instruments.glb`)

  // Shelf kit ships as its own textured .glb rather than as a node inside
  // instruments.glb. There is exactly one such instrument today — the portable
  // X-ray — and radiograph.test.ts asserts that, which is what makes a single
  // top-level hook legitimate here instead of a hook in a loop. Add a second
  // shelf instrument and that test fails, which is the signal to split this
  // into a sub-component rather than to quietly widen the array.
  const shelfInst = SHELF_INSTRUMENTS[0] ?? null
  const shelfGltf = useOptionalGLTF(
    shelfInst?.model ? `${BASE}models/${shelfInst.model}` : null,
  )

  const [hover, setHover] = useState<InstrumentId | null>(null)
  const heldRef = useRef<Group>(null)
  const { camera } = useThree()

  // Clone each instrument once. Cloning per frame would allocate constantly;
  // cloning per render would lose the retinted materials.
  const nodes = useMemo(() => {
    if (!gltf) return null
    const out = new Map<InstrumentId, Object3D>()
    for (const inst of INSTRUMENTS) {
      const found = gltf.scene.getObjectByName(inst.node)
      if (!found) continue
      const clone = found.clone(true)
      clone.position.set(0, 0, 0)
      clone.rotation.set(0, 0, 0)
      retint(clone)
      out.set(inst.id, clone)
    }
    return out
  }, [gltf])

  // NOT retinted. `retint` exists to give procedural instrument geometry a
  // consistent palette; running it over a scanned asset would overwrite the
  // real texture maps that are the entire reason this model was chosen.
  const shelfNode = useMemo(() => {
    if (!shelfGltf) return null
    const clone = shelfGltf.scene.clone(true)
    clone.position.set(0, 0, 0)
    clone.rotation.set(0, 0, 0)
    return clone
  }, [shelfGltf])

  const heldNode = useMemo(() => {
    if (!heldId) return null
    if (shelfInst && heldId === shelfInst.id) {
      return shelfNode?.clone(true) ?? null
    }
    if (!nodes) return null
    return nodes.get(heldId)?.clone(true) ?? null
  }, [nodes, heldId, shelfInst, shelfNode])

  useEffect(() => {
    document.body.style.cursor = hover && enabled ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hover, enabled])

  useFrame(() => {
    const g = heldRef.current
    if (!g || !heldNode) return
    // Follow the camera rather than parent to it: Player and ReactingPatient
    // both write camera transforms, and parenting would fight them.
    camera.getWorldPosition(camPos)
    camera.getWorldQuaternion(camQuat)
    // IN THE HAND, not merely near it. GRIP_TARGET and the aim both come from
    // handsRig, so the instrument sits where the fingers close and points where
    // they point. This used to be its own camera-space offset that happened to
    // land beside the wrist — the tool floated next to the hand and the fingers
    // gripped empty air.
    held.copy(GRIP_TARGET).applyQuaternion(camQuat)
    g.position.copy(camPos).add(held)
    g.quaternion.copy(camQuat).multiply(GRIP_ROT)
  })

  if (!nodes) return null


  const trayX = trayLayout(TRAY_INSTRUMENTS.length)
  const closetX = trayLayout(CLOSET_INSTRUMENTS.length, 0.09)
  const drawerX = trayLayout(DRAWER_INSTRUMENTS.length, 0.11)

  return (
    <>
      {/* ------------------------------------------- the set-up tray -------
          No drawn slab: the dental unit HAS a bracket tray and the game was
          drawing a second one on top of the first. Yaw 0, not PI/2, because the
          real bracket is 0.38 m wide in X and only 0.25 m deep in Z — the old
          rotation laid a 0.30 m row of instruments along the narrow axis. */}
      <group position={TRAY}>
        {TRAY_INSTRUMENTS.map((inst, i) => (
          <Pickable
            key={inst.id}
            inst={inst}
            x={trayX[i]}
            // Undefined while it is in your hand, so it vanishes from the
            // tray but keeps its slot, so the others do not shuffle along.
            node={heldId === inst.id ? undefined : nodes.get(inst.id)}
            enabled={enabled}
            hovered={hover === inst.id}
            onHover={setHover}
            onPick={onPick}
            onBlocked={onBlocked}
          />
        ))}
      </group>

      {/* ------------------------------------------------ the cabinet ------
          The carcass and door that used to be drawn here are GONE. They were a
          primitive box duplicating the `closet` prop — a real glass-fronted
          cabinet with three modelled shelves standing 2.2 m away — and because
          the box was derived from CHAIR_POS it followed the chair when the chair
          moved and ended up 0.24 m inside the sterilisation station's drawer
          bank. It was also a closed `boxGeometry` with FrontSide material, so
          everything in it was invisible from every angle: you clicked a blank
          beige face and received an unseen periodontal probe.

          The instruments now sit on the real cabinet's measured middle shelf.
          Its doors are real meshes too, and open via OPENABLES. */}
      <group position={CLOSET} rotation={[0, CABINET_SHELF.yaw, 0]}>
        {/* Shelf contents. Only reachable with the door open — and the door is
            what makes taking the axe a decision rather than an accident. */}
        {closetOpen && (
          <group>
            {CLOSET_INSTRUMENTS.map((inst, i) => (
              <Pickable
                key={inst.id}
                inst={inst}
                x={closetX[i]}
                node={heldId === inst.id ? undefined : nodes.get(inst.id)}
                enabled={enabled}
                hovered={hover === inst.id}
                onHover={setHover}
                onPick={onPick}
            onBlocked={onBlocked}
              />
            ))}
          </group>
        )}
      </group>

      {/* ------------------------------------------- the bench drawer -----
          Where clinical kit actually lives between cases. It used to share the
          glass cabinet with the axe, which made the cabinet a junk drawer and
          the axe just the ninth thing in a row. Now the cabinet holds one
          absurd decision and the drawer holds the real instruments. */}
      <group position={[DRAWER_SHELF.x, DRAWER_SHELF.y, DRAWER_SHELF.z]}>
        {drawerOpen && (
          <group>
            {DRAWER_INSTRUMENTS.map((inst, i) => (
              <Pickable
                key={inst.id}
                inst={inst}
                x={drawerX[i]}
                node={heldId === inst.id ? undefined : nodes.get(inst.id)}
                enabled={enabled}
                hovered={hover === inst.id}
                onHover={setHover}
                onPick={onPick}
            onBlocked={onBlocked}
              />
            ))}
          </group>
        )}
      </group>

      {/* -------------------------------------------- the wall shelf ------ */}
      {/* The X-ray sits out in the open on its cradle, across the room. No
          door, no gate — the cost of a radiograph is the walk. */}
      {shelfInst && shelfNode && heldId !== shelfInst.id && (
        <group
          position={[XRAY_DOCK.x, XRAY_DOCK.y, XRAY_DOCK.z]}
          rotation={[0, XRAY_DOCK.yaw, 0]}
        >
          <primitive
            object={shelfNode}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation()
              if (enabled) onPick(shelfInst.id)
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation()
              setHover(shelfInst.id)
            }}
            onPointerOut={() => setHover((h) => (h === shelfInst.id ? null : h))}
          />
        </group>
      )}

      {/* ------------------------------------------------ what you hold ---- */}
      {heldNode && (
        <group ref={heldRef}>
          <primitive object={heldNode} />
        </group>
      )}
    </>
  )
}
