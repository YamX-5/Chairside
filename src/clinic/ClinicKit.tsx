import { memo, useMemo } from 'react'
import { Color, DoubleSide, Mesh, MeshStandardMaterial } from 'three'
import { C } from './theme3d'
import { useOptionalGLTF } from './useOptionalGLTF'

const BASE = import.meta.env.BASE_URL

/**
 * The clinic assembled from CC0 kit pieces (Kenney Furniture Kit, public
 * domain) instead of hand-coded primitives — Phase 0 Gate A.
 *
 * The kit is modular on a 1-unit grid, so the room is composed in code and no
 * Blender step is needed to get a look test. Two facts make this work:
 *
 *  1. Every model is UNTEXTURED with only 1-4 materials, and
 *  2. those materials are named SEMANTICALLY — wood, woodDark, metal, carpet,
 *     glass, plant, _defaultMat.
 *
 * So "strip the original materials and re-shade to one palette" — the single
 * highest-leverage art step — becomes a name→colour lookup rather than manual
 * work on 25 models. The kit's own palette (orange pine, red upholstery) is
 * discarded entirely; only its geometry is kept.
 */

/** 1 kit unit = 2 m, so 4 wall tiles span the existing 8 m room. */
const SCALE = 2
/** Room half-extent in KIT units. */
const H = 2
/** Wall height in kit units (measured from the kit's own wall mesh). */
const WALL_H = 1.29

/** Kit material name → our palette. This is the art direction, in one place. */
const PALETTE: Record<string, number> = {
  _defaultMat: C.wall,
  wood: C.wood,
  woodDark: C.woodDark,
  metal: C.metal,
  metalLight: 0xdfe4e7,
  metalMedium: C.metal,
  metalDark: 0x93a3a6,
  carpet: C.teal,
  carpetBlue: C.tealDeep,
  carpetDarker: C.tealDeep,
  carpetWhite: C.white,
  fur: C.white,
  plant: C.leaf,
  glass: C.window,
  lamp: 0xfff1d6,
}

type Vec3 = [number, number, number]

/**
 * Load a kit piece and re-shade it. `override` retargets a specific material
 * name for this instance only — the floor and the walls both ship as "wood",
 * but only one of them should read as honey.
 */
function useKit(name: string, override?: Record<string, number>) {
  const gltf = useOptionalGLTF(`${BASE}models/kit/${name}.glb`)

  return useMemo(() => {
    if (!gltf) return null
    const scene = gltf.scene.clone(true)
    scene.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as MeshStandardMaterial
      const key = src?.name ?? ''
      const hex = override?.[key] ?? PALETTE[key]
      if (hex === undefined) return

      const isGlass = key === 'glass'
      const isLamp = key === 'lamp'
      mesh.material = new MeshStandardMaterial({
        color: new Color(hex),
        roughness: isGlass ? 0.1 : 0.72,
        metalness: 0,
        transparent: isGlass,
        opacity: isGlass ? 0.35 : 1,
        side: isGlass ? DoubleSide : undefined,
        emissive: new Color(isLamp ? 0xfff1d6 : 0x000000),
        emissiveIntensity: isLamp ? 1.1 : 0,
      })
    })
    return scene
  }, [gltf, override])
}

function Kit({
  name,
  position,
  rotation,
  override,
}: {
  name: string
  position: Vec3
  rotation?: Vec3
  override?: Record<string, number>
}) {
  const scene = useKit(name, override)
  if (!scene) return null
  return <primitive object={scene} position={position} rotation={rotation ?? [0, 0, 0]} />
}

/** The floor ships as "wood" but should read as pale warm stone, not honey. */
const FLOOR_OVERRIDE = { wood: C.floor }
/** Wall panels are _defaultMat; their trim is wood and stays honey (the dado). */
const WALL_OVERRIDE = { _defaultMat: C.wall }

function Shell() {
  const span = [-2, -1, 0, 1]
  return (
    <group>
      {span.map((x) =>
        [-1, 0, 1, 2].map((z) => (
          <Kit key={`f${x}_${z}`} name="floorFull" position={[x, 0, z]} override={FLOOR_OVERRIDE} />
        )),
      )}

      {/* far wall (-Z) — window in it, so the room has a daylight source */}
      {span.map((x) => (
        <Kit key={`nz${x}`} name={x === -1 ? 'wallWindow' : 'wall'} position={[x, 0, -H]} override={WALL_OVERRIDE} />
      ))}

      {/* near wall (+Z) — the doorway the patient walks in through */}
      {[2, 1, 0, -1].map((x) => (
        <Kit key={`pz${x}`} name={x === 1 ? 'wallDoorway' : 'wall'} position={[x, 0, H]} rotation={[0, Math.PI, 0]} override={WALL_OVERRIDE} />
      ))}

      {[2, 1, 0, -1].map((z) => (
        <Kit key={`nx${z}`} name="wall" position={[-H, 0, z]} rotation={[0, Math.PI / 2, 0]} override={WALL_OVERRIDE} />
      ))}
      {[-2, -1, 0, 1].map((z) => (
        <Kit key={`px${z}`} name="wall" position={[H, 0, z]} rotation={[0, -Math.PI / 2, 0]} override={WALL_OVERRIDE} />
      ))}

      {/* ceiling — the kit has no ceiling tile, and without one the room reads
          as an open box with a black void overhead. */}
      <mesh rotation-x={Math.PI / 2} position={[0, WALL_H, 0]}>
        <planeGeometry args={[H * 2, H * 2]} />
        <meshStandardMaterial color={C.ceiling} roughness={1} />
      </mesh>
    </group>
  )
}

/** Treatment side: the chair the patient sits in, plus the clinical furniture. */
function TreatmentBay() {
  return (
    <group>
      {/* The dental chair is NOT a kit model — it is built by
          scripts/build_dental_chair.py and rendered by DentalChair.tsx, which
          also owns the seat position. The lounge recliner that used to stand in
          here was, in the owner's words, not a dental chair. */}
      <Kit name="stoolBar" position={[1.35, 0, 0.45]} />
      <Kit name="sideTableDrawers" position={[1.55, 0, -0.35]} rotation={[0, -Math.PI / 2, 0]} />
      <Kit name="lampSquareCeiling" position={[0.75, WALL_H, 0.2]} />
      <Kit name="bathroomCabinet" position={[0.15, 0, -1.86]} />
      <Kit name="bathroomSink" position={[1.05, 0, -1.86]} />
      <Kit name="lampWall" position={[-1.94, 0.95, -0.6]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}

/** Study side: the desk where the morning review happens. */
function StudyCorner() {
  return (
    <group>
      <Kit name="desk" position={[-1.9, 0, -0.55]} rotation={[0, Math.PI / 2, 0]} />
      <Kit name="chairDesk" position={[-1.25, 0, -0.5]} rotation={[0, -Math.PI / 2, 0]} />
      <Kit name="laptop" position={[-1.72, 0.38, -0.5]} rotation={[0, Math.PI / 2, 0]} />
      <Kit name="books" position={[-1.75, 0.38, -0.95]} />
      <Kit name="bookcaseOpen" position={[-1.92, 0, 0.5]} rotation={[0, Math.PI / 2, 0]} />
      <Kit name="bookcaseClosedWide" position={[-1.92, 0, 1.6]} rotation={[0, Math.PI / 2, 0]} />
      <Kit name="bench" position={[1.9, 0, 1.4]} rotation={[0, -Math.PI / 2, 0]} />
      <Kit name="pottedPlant" position={[1.72, 0, -1.7]} />
      <Kit name="plantSmall1" position={[-1.9, 0.88, 0.5]} />
      <Kit name="rugRectangle" position={[0.1, 0.012, 0.9]} />
      <Kit name="trashcan" position={[-0.75, 0, -1.8]} />
    </group>
  )
}

export const ClinicKit = memo(function ClinicKit() {
  return (
    <group scale={SCALE}>
      <Shell />
      <TreatmentBay />
      <StudyCorner />
    </group>
  )
})
