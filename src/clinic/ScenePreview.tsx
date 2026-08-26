import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { NoToneMapping, type PerspectiveCamera } from 'three'
import { RoomModel } from './RoomModel'
import { Patient3D } from './Patient3D'
import { PostFX } from './PostFX'
import { useOptionalGLTF } from './useOptionalGLTF'

const BASE = import.meta.env.BASE_URL

/**
 * Phase 0 look test — NOT part of the game.
 *
 * Open with `#preview`. Renders just the room and the patient with the game's
 * real post-processing, so the frame can be judged beside the Higgsfield
 * reference clip. The plan's two gates (does the room look right / does the
 * character look like she belongs in it) are answered here, before any pipeline
 * gets built around them.
 *
 * The status readout matters: without it there is no way to tell a beautiful
 * real asset from the primitive fallback, and we'd be evaluating the wrong
 * thing.
 */

/**
 * Slow push-in, the shot the reference clips use.
 *
 * Stays INSIDE the room for the whole move — starting outside meant the camera
 * flew through the near wall and the doorway frame filled the middle of frame.
 * The target is the treatment chair at world (1.5, 0, 0.7).
 */
function CameraPush({ active }: { active: boolean }) {
  const t = useRef(0)
  useFrame((state, delta) => {
    if (!active) return
    t.current = Math.min(t.current + delta, 14)
    const k = t.current / 14
    const cam = state.camera as PerspectiveCamera
    cam.position.set(-0.2 + k * 0.3, 1.58, 3.3 - k * 1.35)
    cam.lookAt(1.45, 0.95, 0.6)
  })
  return null
}

export default function ScenePreview() {
  const [orbit, setOrbit] = useState(false)
  const room = useOptionalGLTF(`${BASE}models/clinic.glb`)
  const kit = useOptionalGLTF(`${BASE}models/kit/wall.glb`)
  const patient = useOptionalGLTF(`${BASE}models/patient.glb`)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#14100a' }}>
      <Canvas
        camera={{ fov: 55, near: 0.1, far: 60, position: [0.6, 1.62, 4.2] }}
        gl={{ antialias: false, toneMapping: NoToneMapping, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        {/* Lights the CHARACTER. A baked room is unlit and ignores these — which
            is exactly the Gate B question: does she sit in the room, or on top
            of it? */}
        <Environment resolution={256} frames={1} environmentIntensity={0.5}>
          <color attach="background" args={['#8f7f62']} />
          <Lightformer form="rect" intensity={3} color="#fff0d2" position={[-4, 3, -3]} scale={[8, 5, 1]} target={[0, 1, 0]} />
          <Lightformer form="rect" intensity={0.8} color="#dce6ff" position={[5, 2, 3]} scale={[5, 4, 1]} target={[0, 1, 0]} />
        </Environment>
        {/* Warm key from the window wall (-X/-Z corner), so the room has one
            clear light direction instead of flat ambient — the cheapest thing
            that separates "lit scene" from "grey-box with colour". */}
        <hemisphereLight args={[0xfff6ea, 0xcbb79b, 0.28]} />
        <directionalLight position={[-4, 4.5, -4]} intensity={2.1} color={0xfff0d4} />
        <directionalLight position={[4, 2, 4]} intensity={0.35} color={0xd8e4ff} />

        <RoomModel drawerOpen={false} />
        <Patient3D mood="anxious" phase="seated" />

        <CameraPush active={!orbit} />
        {orbit && <OrbitControls target={[1.4, 1.0, -0.3]} />}
        <PostFX isTouch={false} />
      </Canvas>

      <div
        style={{
          position: 'absolute', insetBlockStart: 12, insetInlineStart: 12,
          background: 'rgba(255,252,246,0.9)', color: '#2a2015',
          font: '13px/1.5 system-ui', padding: '10px 14px', borderRadius: 12,
          boxShadow: '0 4px 14px rgba(60,40,15,.2)',
        }}
      >
        <strong>Phase 0 look test</strong>
        <div>Room: {room ? '✅ clinic.glb (baked)' : kit ? '✅ CC0 kit' : '⚠️ fallback primitives'}</div>
        <div>Patient: {patient ? '✅ patient.glb' : '⚠️ fallback billboard'}</div>
        <button onClick={() => setOrbit((o) => !o)} style={{ marginBlockStart: 8, cursor: 'pointer' }}>
          {orbit ? 'Use push-in shot' : 'Free look'}
        </button>
      </div>
    </div>
  )
}
