import { memo, useContext, createContext, type ReactNode, type Ref } from 'react'
import { type ThreeElements } from '@react-three/fiber'
import { RoundedBox, Environment, Lightformer, ContactShadows } from '@react-three/drei'
import type { Mesh, Texture } from 'three'
import { C, EYE_HEIGHT, ROOM_HALF } from './theme3d'
import { DOORWAY, DOORWAY_HEIGHT, DOORWAY_WIDTH } from './layout'
import { useOptionalTexture } from './useOptionalTexture'

const BASE = import.meta.env.BASE_URL

/**
 * AI-generated surface textures, dropped into public/textures. Shared through a
 * context so every material can pick one up without prop-drilling, and each
 * falls back to its flat colour when the file isn't there.
 */
interface ClinicTex {
  wall: Texture | null
  floor: Texture | null
  wood: Texture | null
  fabric: Texture | null
}
const TexCtx = createContext<ClinicTex>({ wall: null, floor: null, wood: null, fabric: null })

/** meshStandardMaterial that maps a loaded texture when present (white base so
 *  the texture shows its true colour), else the flat fallback colour. */
function Tex({
  kind,
  color,
  ...rest
}: { kind: keyof ClinicTex; color: number } & Omit<
  ThreeElements['meshStandardMaterial'],
  'color' | 'map' | 'ref' | 'args'
>) {
  const t = useContext(TexCtx)[kind]
  // Tint the texture by the palette colour (both share the family), which keeps
  // the warm/teal saturation instead of the bright IBL washing a white base out.
  return <meshStandardMaterial color={color} map={t ?? undefined} {...rest} />
}

/**
 * The clinic, built from primitives. No downloaded assets — this runs with zero
 * credits and zero network. Every piece here is a documented swap point: when
 * real GLBs exist, replace the group's children with <primitive
 * object={gltf.scene} /> and the layout/collision stays valid.
 *
 * The look is carried by three cheap, offline-safe levers (see the plan's
 * Tier 1): image-based lighting from Lightformers, frozen contact shadows for
 * grounding, and rounded edges so surfaces catch a highlight instead of reading
 * as flat cardboard.
 */

const H = 2.8 // ceiling height
const W = ROOM_HALF * 2

/**
 * A box with softened edges. Every hard cube in the room went through here —
 * a beveled edge catches the environment light and instantly reads as
 * "moulded plastic / finished wood" rather than "gray-box primitive". The
 * radius is auto-clamped so thin slabs (a laptop lid) stay valid.
 */
function Box({
  args,
  radius,
  children,
  ref,
  ...props
}: {
  args: [number, number, number]
  radius?: number
  children?: ReactNode
  // React 19 passes ref as a normal prop; typing it as drei's Mesh ref keeps
  // the forward to <RoundedBox> type-clean (the drawer needs it).
  ref?: Ref<Mesh>
} & Omit<ThreeElements['mesh'], 'args' | 'children' | 'ref'>) {
  const min = Math.min(args[0], args[1], args[2])
  const r = radius ?? Math.max(0.006, Math.min(0.03, min * 0.28))
  return (
    <RoundedBox ref={ref} args={args} radius={r} smoothness={3} creaseAngle={0.5} {...props}>
      {children}
    </RoundedBox>
  )
}

/** The honey-wood dado rail that runs around the room in the reference. */
function Dado({ length, position, rotationY = 0 }: {
  length: number
  position: [number, number, number]
  rotationY?: number
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      <Box args={[length, 0.84, 0.06]} position={[0, 0.42, 0]} radius={0.02}>
        <Tex kind="wood" color={C.wood} roughness={0.6} envMapIntensity={0.7} />
      </Box>
      <Box args={[length, 0.07, 0.09]} position={[0, 0.87, 0.01]} radius={0.03}>
        <meshStandardMaterial color={C.woodDark} roughness={0.55} envMapIntensity={0.8} />
      </Box>
    </group>
  )
}

function ArchedWindow() {
  // Rectangle plus a half-round head — the arch is the room's signature shape.
  return (
    <group position={[-ROOM_HALF + 0.06, 0, 0.4]} rotation-y={Math.PI / 2}>
      <mesh position={[0, 1.5, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial
          color={C.window}
          emissive={C.window}
          emissiveIntensity={1.5}
          roughness={1}
        />
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <circleGeometry args={[0.75, 20, 0, Math.PI]} />
        <meshStandardMaterial
          color={C.window}
          emissive={C.window}
          emissiveIntensity={1.5}
          roughness={1}
        />
      </mesh>
      {/* frame + glazing bars */}
      <mesh position={[0, 1.5, -0.03]}>
        <planeGeometry args={[1.68, 1.62]} />
        <meshStandardMaterial color={C.white} roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.25, -0.03]}>
        <circleGeometry args={[0.84, 20, 0, Math.PI]} />
        <meshStandardMaterial color={C.white} roughness={0.7} />
      </mesh>
      <Box args={[0.05, 1.5, 0.02]} position={[0, 1.5, 0.01]} radius={0.008}>
        <meshStandardMaterial color={C.white} roughness={0.6} />
      </Box>
      <Box args={[1.5, 0.05, 0.02]} position={[0, 1.5, 0.01]} radius={0.008}>
        <meshStandardMaterial color={C.white} roughness={0.6} />
      </Box>
    </group>
  )
}

/**
 * The +Z wall, with a doorway cut through it.
 *
 * A plane cannot have a hole, so the wall is three panels around the opening:
 * the run to each side, and the header above it. That is cheaper and sharper
 * than a THREE.Shape with a hole, which would triangulate the whole wall.
 *
 * MIND THE HANDEDNESS. The wall faces into the room, which means a half turn
 * about Y, and under that turn local +x points at world -x. Every panel below
 * is positioned in LOCAL x, so the doorway at world x = +1.25 sits at local
 * x = -1.25. Getting this backwards puts the door in the opposite corner and
 * looks almost right, which is the worst kind of wrong.
 */
function NearWall() {
  const half = W / 2
  const apertureHalf = DOORWAY_WIDTH / 2
  // world -> local
  const cx = -DOORWAY.x
  const left = cx - apertureHalf
  const right = cx + apertureHalf

  const panels: Array<{ w: number; h: number; x: number; y: number }> = [
    // the run either side of the opening, full height
    { w: left - -half, h: H, x: (-half + left) / 2, y: H / 2 },
    { w: half - right, h: H, x: (right + half) / 2, y: H / 2 },
    // the header above it
    {
      w: DOORWAY_WIDTH,
      h: H - DOORWAY_HEIGHT,
      x: cx,
      y: (H + DOORWAY_HEIGHT) / 2,
    },
  ]

  return (
    <group position={[0, 0, ROOM_HALF]} rotation-y={Math.PI}>
      {panels.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, 0]}>
          <planeGeometry args={[p.w, p.h]} />
          <Tex kind="wall" color={C.wall} roughness={0.95} />
        </mesh>
      ))}

      {/* Jambs and head, so the opening reads as a door and not a hole punched
          in the plaster. Set slightly proud of the wall, as a real casing is. */}
      {[left, right].map((x, i) => (
        <Box
          key={i}
          args={[0.06, DOORWAY_HEIGHT, 0.14]}
          position={[x, DOORWAY_HEIGHT / 2, -0.02]}
          radius={0.008}
        >
          <meshStandardMaterial color={C.wood} roughness={0.6} envMapIntensity={0.7} />
        </Box>
      ))}
      <Box
        args={[DOORWAY_WIDTH + 0.12, 0.06, 0.14]}
        position={[cx, DOORWAY_HEIGHT, -0.02]}
        radius={0.008}
      >
        <meshStandardMaterial color={C.wood} roughness={0.6} envMapIntensity={0.7} />
      </Box>

      {/* A darker void behind the opening, so it reads as somewhere rather than
          as a hole onto the skybox. */}
      <mesh position={[cx, DOORWAY_HEIGHT / 2, 0.06]}>
        <planeGeometry args={[DOORWAY_WIDTH, DOORWAY_HEIGHT]} />
        <meshBasicMaterial color={0x2a2622} />
      </mesh>
    </group>
  )
}

function Walls() {
  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[W, W]} />
        <Tex kind="floor" color={C.floor} roughness={0.7} envMapIntensity={0.5} />
      </mesh>

      {/* ceiling */}
      <mesh rotation-x={Math.PI / 2} position-y={H}>
        <planeGeometry args={[W, W]} />
        <meshStandardMaterial color={C.white} roughness={1} />
      </mesh>

      {/* far wall (-Z) */}
      <mesh position={[0, H / 2, -ROOM_HALF]}>
        <planeGeometry args={[W, H]} />
        <Tex kind="wall" color={C.wall} roughness={0.95} />
      </mesh>

      {/* near wall (+Z), faces inward — with the doorway cut out of it */}
      <NearWall />

      {/* left wall (-X) */}
      <mesh position={[-ROOM_HALF, H / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <Tex kind="wall" color={C.wall} roughness={0.95} />
      </mesh>

      {/* right wall (+X) */}
      <mesh position={[ROOM_HALF, H / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <Tex kind="wall" color={C.wall} roughness={0.95} />
      </mesh>

      {/* Honey-wood dado running around the room — the strongest single cue
          that makes the reference read as "warm clinic" and not "office". */}
      <Dado length={W} position={[0, 0, -ROOM_HALF + 0.04]} />
      {/* The near wall's run stops at each jamb — skirting does not cross a
          doorway, and running it through the opening is the detail that would
          give the cut-out away. */}
      {(() => {
        const jambL = DOORWAY.x - DOORWAY_WIDTH / 2
        const jambR = DOORWAY.x + DOORWAY_WIDTH / 2
        return (
          <>
            <Dado
              length={jambL + ROOM_HALF}
              position={[(-ROOM_HALF + jambL) / 2, 0, ROOM_HALF - 0.04]}
              rotationY={Math.PI}
            />
            <Dado
              length={ROOM_HALF - jambR}
              position={[(jambR + ROOM_HALF) / 2, 0, ROOM_HALF - 0.04]}
              rotationY={Math.PI}
            />
          </>
        )
      })()}
      <Dado length={W} position={[-ROOM_HALF + 0.04, 0, 0]} rotationY={Math.PI / 2} />
      <Dado length={W} position={[ROOM_HALF - 0.04, 0, 0]} rotationY={-Math.PI / 2} />

      <ArchedWindow />
    </group>
  )
}

/**
 * Where the noticeboard and calendar hang, in WORLD x on the +Z wall.
 *
 * That wall is busy: the bookcase carcass ends at x -0.495 and the doorway now
 * opens at 0.765, so the clear run between them is 1.26 m and the run right of
 * the door is 1.265 m. Nothing 1.62 m wide fits on it any more, which is why
 * the board is smaller than it was and the calendar hangs on its own.
 *
 * The board used to sit at x -1.05 — the bookcase's own x — with its lower
 * 435 mm buried inside the carcass, and centred at 1.90 m, above the player's
 * sightline. Height alone could not fix it: clearing a 1.80 m bookcase needs a
 * 2.335 m centre, which puts the top through the 2.8 m ceiling. It had to move
 * sideways.
 *
 * y is EYE_HEIGHT, not the 57-inch gallery convention. A first-person camera is
 * the only viewer here, so the thing to centre on is where the camera is.
 */
const BOARD = { x: 0.135, y: EYE_HEIGHT, w: 1.1, h: 0.73 }
const CALENDAR = { x: 2.35, y: 1.55, w: 0.6, h: 0.75 }

function WallPanel({ spot, children }: { spot: { x: number; y: number }; children: ReactNode }) {
  // A half turn so it faces INTO the room rather than into the plaster. Under
  // that turn local +x is world -x, so children lay out in local space and only
  // the group carries a world position.
  return (
    <group position={[spot.x, spot.y, ROOM_HALF - 0.06]} rotation={[0, Math.PI, 0]}>
      {children}
    </group>
  )
}

function ReputationBoard() {
  const cork = { w: BOARD.w - 0.12, h: BOARD.h - 0.12 }
  // Stars spread across the cork rather than at fixed offsets, so they stay put
  // if the board is ever resized again.
  const stars = [-0.3, -0.1, 0.1, 0.3].map((f) => f * cork.w)

  return (
    <>
      <WallPanel spot={BOARD}>
        {/* Cork noticeboard in a wood frame with gold stars — straight from the
            reference clip's reception wall. */}
        <Box args={[BOARD.w, BOARD.h, 0.05]} position={[0, 0, -0.02]} radius={0.02}>
          <meshStandardMaterial color={C.woodDark} roughness={0.55} envMapIntensity={0.8} />
        </Box>
        <Box args={[cork.w, cork.h, 0.06]} radius={0.01}>
          <meshStandardMaterial color={C.cork} roughness={0.95} />
        </Box>
        {stars.map((x, i) => (
          <Box
            key={i}
            args={[0.1, 0.1, 0.02]}
            position={[x, 0.13, 0.05]}
            rotation-z={Math.PI / 4}
            radius={0.01}
          >
            <meshStandardMaterial
              color={i < 2 ? C.star : 0xbda57f}
              roughness={0.4}
              metalness={0.3}
              envMapIntensity={1.2}
            />
          </Box>
        ))}
      </WallPanel>

      {/* Wall calendar, now on the far side of the doorway — the exam countdown
          lives here later. */}
      <WallPanel spot={CALENDAR}>
        <Box args={[CALENDAR.w, CALENDAR.h, 0.04]} radius={0.01}>
          <meshStandardMaterial color={C.white} roughness={0.85} />
        </Box>
      </WallPanel>
    </>
  )
}

/**
 * Image-based lighting built entirely from Lightformers, rendered once into an
 * environment map. No HDRI file, no network fetch — safe for the offline PWA,
 * and the single biggest lever on the "flat CG" look: it is what gives every
 * MeshStandardMaterial a real reflection to sample instead of pure matte.
 */
function Studio() {
  // environmentIntensity dials the whole IBL contribution: at 1 the props keep
  // their reflections but the warm surround floods everything toward white and
  // ACES desaturates the blown highlights. ~0.55 keeps the cream/honey/teal
  // reading as colours, not paper.
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.55}>
      {/* A mid-warm surround the props reflect — deliberately NOT near-white, or
          it acts as a giant fill light and washes the palette out. */}
      <color attach="background" args={['#8f7f62']} />
      {/* Warm key, from the window side. */}
      <Lightformer
        form="rect"
        intensity={2.6}
        color="#fff1d8"
        position={[-4, 3, 2]}
        scale={[7, 5, 1]}
        target={[0, 1, 0]}
      />
      {/* Cool fill, opposite, so shadows read blue not black. */}
      <Lightformer
        form="rect"
        intensity={0.9}
        color="#dce6ff"
        position={[5, 2, -3]}
        scale={[5, 4, 1]}
        target={[0, 1, 0]}
      />
      {/* Soft overhead sheet — the diffuse ceiling bounce, kept low so the
          ceiling doesn't blow out. */}
      <Lightformer
        form="rect"
        intensity={0.7}
        color="#ffffff"
        position={[0, 6, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[10, 10, 1]}
      />
    </Environment>
  )
}

/**
 * Memoised: HUD state (prompt, toast, pointer-lock) lives in the same component
 * that renders the Canvas, so without this every step toward a desk would
 * re-reconcile ~60 meshes at exactly the wrong moment.
 */
export const Room = memo(function Room() {
  // AI-generated textures (public/textures) — each is null until the file
  // exists, so the room renders textured or flat-coloured, never broken.
  const tex: ClinicTex = {
    wall: useOptionalTexture(`${BASE}textures/wall.jpg`, { srgb: true, repeat: [3, 1.2] }),
    floor: useOptionalTexture(`${BASE}textures/floor.jpg`, { srgb: true, repeat: [4, 4] }),
    wood: useOptionalTexture(`${BASE}textures/wood.jpg`, { srgb: true, repeat: [2, 1] }),
    fabric: useOptionalTexture(`${BASE}textures/fabric.jpg`, { srgb: true, repeat: [1, 1] }),
  }
  return (
    <TexCtx.Provider value={tex}>
    <group>
      <Studio />

      {/* One warm key + a low hemisphere. The IBL now carries the ambient and
          the reflections, so these are far dimmer than before — they only add
          a soft daylight direction and lift the fill. Still zero shadow-casting
          real lights: grounding comes from the frozen ContactShadows below,
          which is an order of magnitude cheaper on mobile than a shadow map. */}
      <hemisphereLight args={[0xfff8ee, 0xd9c6ad, 0.35]} />
      <directionalLight position={[-5, 4, 1.5]} intensity={1.4} color={0xfff2de} />

      {/* Frozen grounding shadow. `frames={1}` renders it exactly once and
          freezes — free forever after mount. `far` is tuned below furniture
          height so the ceiling and overhead lamp are excluded. Warm tint, not
          black, because a black shadow in a cream room reads as a hole. */}
      <ContactShadows
        position={[0, 0.012, 0]}
        scale={13}
        resolution={512}
        blur={2.6}
        opacity={0.42}
        far={2.2}
        frames={1}
        color="#4a3b2a"
      />

      <Walls />
      {/* FURNITURE COMES FROM PROPS NOW — see ClinicProps.tsx and layout.ts.
          <Desk/>, <DentalChair/>, <Bookshelf/>, <Bench/> and <Counter/> used to
          render here, alongside the real downloaded models, which is why the
          room showed four desks, two bookshelves and TWO dental chairs. The
          "old and bad" chair on screen was this one, standing next to the good
          one. Room.tsx is now the shell only: walls, window, dado, lighting and
          contact shadows — the things no downloaded asset provides. */}
      <ReputationBoard />
    </group>
    </TexCtx.Provider>
  )
})
