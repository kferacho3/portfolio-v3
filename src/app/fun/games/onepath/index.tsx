'use client'

import * as React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import { clearFrameInput, useInputRef } from '../../hooks/useInput'
import * as THREE from 'three'

import { onePathState, type OnePathLevel } from './state'

export { onePathState }

/**
 * OnePath
 * A one-touch timing game inspired by "The Walls" by Ketchapp & mauigo games (Marius Gerlich).
 * This is a fresh, original implementation + level generator built for this codebase.
 */

const COLORS = {
  bg: '#ffffff',
  wall: '#6b4cff',
  wallDark: '#563be8',
  floor: '#8a6bff',
  obstacle: '#64e7ff',
  gem: '#ffd35a',
  portalGlow: '#61e9ff',
  ink: '#111111',
  inkSoft: 'rgba(0,0,0,0.65)',
}

type RunStatus = {
  // simulation
  t: number
  x: number
  z: number
  vx: number
  speed: number
  targetSide: -1 | 1
  alive: boolean
  cleared: boolean
  // feedback
  wobble: number
  lastTapAt: number
  perfectFlash: number
  gemsThisRun: number
}

function useOnMount(fn: () => void) {
  React.useEffect(() => {
    fn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

function formatLevel(n: number) {
  return `${n}`
}

function Overlay() {
  const snap = useSnapshot(onePathState)

  const topText = (() => {
    if (snap.phase === 'playing') return formatLevel(snap.level)
    return ''
  })()

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute inset-0 select-none" style={{ pointerEvents: 'auto' }}>
      {/* top score/level */}
      <div className="absolute top-6 left-0 right-0 flex items-start justify-center">
        <div className="text-black text-6xl font-black tracking-tight" style={{ opacity: topText ? 1 : 0 }}>
          {topText}
        </div>
      </div>

      {/* bottom HUD */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-full bg-black/5 px-4 py-2 text-black/70">
          <div className="text-sm">
            <span className="font-semibold text-black/80">Gems</span> {snap.gems}
          </div>
          <div className="h-4 w-px bg-black/10" />
          <div className="text-sm">
            <span className="font-semibold text-black/80">Best</span> {snap.bestLevel}
          </div>
        </div>
      </div>

      {/* screens */}
      {snap.phase === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(520px,92vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <div className="text-4xl font-black text-black">OnePath</div>
            <div className="mt-2 text-black/70">
              Tap to switch sides. Thread the gaps. Reach the gate.
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/5 p-4">
                <div className="text-sm font-semibold text-black/80">Goal</div>
                <div className="mt-1 text-sm text-black/60">Clear levels by dodging wall-blocks.</div>
              </div>
              <div className="rounded-2xl bg-black/5 p-4">
                <div className="text-sm font-semibold text-black/80">Tip</div>
                <div className="mt-1 text-sm text-black/60">Switch early—your ball slides, it doesn’t teleport.</div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-xs text-black/40 leading-relaxed">
                Inspired by <span className="font-semibold text-black/50">The Walls</span> — Ketchapp × mauigo games
                (Marius Gerlich).
              </div>
              <button
                className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                onClick={() => onePathState.start()}
              >
                Tap to Start
              </button>
            </div>
          </div>
        </div>
      )}

      {snap.phase === 'cleared' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(520px,92vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <div className="text-4xl font-black text-black">
              LEVEL {snap.level} <span className="text-black/70">CLEARED!</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-black/70">
              <div className="rounded-xl bg-black/5 px-3 py-2">
                +{snap.lastRunGems} gems
              </div>
              <div className="text-sm">
                Total: <span className="font-semibold text-black/80">{snap.gems}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                onClick={() => onePathState.next()}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {snap.phase === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(520px,92vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <div className="text-4xl font-black text-black">Oof.</div>
            <div className="mt-2 text-black/70">Tap again and take another run.</div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-sm text-black/60">
                Level <span className="font-semibold text-black/80">{snap.level}</span> • Best{' '}
                <span className="font-semibold text-black/80">{snap.bestLevel}</span>
              </div>
              <button
                className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                onClick={() => onePathState.retry()}
              >
                Tap to Retry
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Html>
  )
}

function Scene() {
  const snap = useSnapshot(onePathState)
  const inputRef = useInputRef()
  const run = React.useRef<RunStatus>({
    t: 0,
    x: 0,
    z: 0,
    vx: 0,
    speed: 2.8,
    targetSide: 1,
    alive: true,
    cleared: false,
    wobble: 0,
    lastTapAt: -999,
    perfectFlash: 0,
    gemsThisRun: 0,
  })

  const levelRef = React.useRef<OnePathLevel>(onePathState.buildLevel(onePathState.level))

  const resetRun = React.useCallback((level: OnePathLevel) => {
    const r = run.current
    r.t = 0
    r.x = 0
    r.z = -2.2
    r.vx = 0.0
    r.speed = level.speed
    r.targetSide = 1
    r.alive = true
    r.cleared = false
    r.wobble = 0
    r.lastTapAt = -999
    r.perfectFlash = 0
    r.gemsThisRun = 0

    // reset gem collection
    level.gems.forEach((g) => (g.collected = false))
  }, [])

  React.useEffect(() => {
    // when phase changes, ensure run/level are correct
    if (snap.phase === 'menu') {
      levelRef.current = onePathState.buildLevel(onePathState.level)
      resetRun(levelRef.current)
    }
    if (snap.phase === 'playing') {
      levelRef.current = onePathState.buildLevel(onePathState.level)
      resetRun(levelRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase, snap.level])

  // light camera follow
  function CameraRig() {
    const { camera } = useThree()
    useFrame((_, dt) => {
      const lvl = levelRef.current
      const r = run.current
      const target = new THREE.Vector3(r.x * 0.2, 0.25, r.z + 2.2)
      const desired = new THREE.Vector3(3.6, 5.2, r.z + 6.8)
      desired.x += r.x * 0.4

      camera.position.lerp(desired, 1 - Math.exp(-3.5 * dt))
      ;(camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.damp((camera as THREE.PerspectiveCamera).fov, 45, 3, dt)
      ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()

      camera.lookAt(target)
    })
    return null
  }

  // floor/walls
  const geom = React.useMemo(() => {
    const corridorW = 1.8
    const wallT = 0.28
    const wallH = 1.15
    const floorH = 0.14
    return { corridorW, wallT, wallH, floorH }
  }, [])

  // materials
  const mats = React.useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.wall), roughness: 0.72, metalness: 0.05 })
    const wallDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.wallDark), roughness: 0.72, metalness: 0.05 })
    const floor = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.floor), roughness: 0.82, metalness: 0.02 })
    const obstacle = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.obstacle), roughness: 0.25, metalness: 0.0, emissive: new THREE.Color('#2ad8ff'), emissiveIntensity: 0.35 })
    const gem = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.gem), roughness: 0.25, metalness: 0.1, emissive: new THREE.Color('#ffcc3a'), emissiveIntensity: 0.25 })
    const ball = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a1a1a'), roughness: 0.3, metalness: 0.2 })
    const portal = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), roughness: 0.4, metalness: 0.1 })
    const portalAlt = new THREE.MeshStandardMaterial({ color: new THREE.Color('#101010'), roughness: 0.4, metalness: 0.1 })
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.portalGlow), transparent: true, opacity: 0.55 })
    return { wall, wallDark, floor, obstacle, gem, ball, portal, portalAlt, glow }
  }, [])

  // shared geometries
  const geoms = React.useMemo(() => {
    const wallGeom = new THREE.BoxGeometry(1, 1, 1)
    const floorGeom = new THREE.BoxGeometry(1, 1, 1)
    const obstacleGeom = new THREE.BoxGeometry(0.54, 0.34, 0.42)
    const ballGeom = new THREE.SphereGeometry(0.13, 24, 24)
    const gemGeom = new THREE.OctahedronGeometry(0.12, 0)
    const portalSegGeom = new THREE.BoxGeometry(0.09, 0.09, 0.2)
    const glowGeom = new THREE.RingGeometry(0.32, 0.52, 48)
    return { wallGeom, floorGeom, obstacleGeom, ballGeom, gemGeom, portalSegGeom, glowGeom }
  }, [])

  const ballRef = React.useRef<THREE.Mesh>(null)
  const groupRef = React.useRef<THREE.Group>(null)
  const portalRef = React.useRef<THREE.Group>(null)
  const particlesRef = React.useRef<THREE.Points>(null)

  // particles geometry
  const particleGeom = React.useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 90
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 0.55 + Math.random() * 0.35
      const y = (Math.random() - 0.5) * 0.6
      positions[i * 3 + 0] = Math.cos(a) * r
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(a) * r
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  const particleMat = React.useMemo(() => {
    return new THREE.PointsMaterial({ color: new THREE.Color(COLORS.portalGlow), size: 0.045, transparent: true, opacity: 0.85, depthWrite: false })
  }, [])

  // tap handling + simulation
  useFrame((state, dt) => {
    const input = inputRef.current
    const r = run.current
    const lvl = levelRef.current

    const tap = input.pointerJustDown || input.justPressed.has(' ') || input.justPressed.has('Enter')

    if (snap.phase === 'menu') {
      if (tap) onePathState.start()
      clearFrameInput(inputRef)
      return
    }

    if (snap.phase === 'cleared') {
      if (tap) onePathState.next()
      clearFrameInput(inputRef)
      return
    }

    if (snap.phase === 'gameover') {
      if (tap) onePathState.retry()
      clearFrameInput(inputRef)
      return
    }

    if (snap.phase !== 'playing') {
      clearFrameInput(inputRef)
      return
    }

    // playing
    r.t += dt
    r.perfectFlash = Math.max(0, r.perfectFlash - dt * 2.0)
    r.wobble = Math.max(0, r.wobble - dt * 3.0)

    if (tap && r.alive && !r.cleared) {
      r.targetSide = (r.targetSide === 1 ? -1 : 1) as -1 | 1
      r.lastTapAt = r.t
      r.wobble = 1.0
    }

    // movement along z
    r.z += r.speed * dt

    // lateral slide toward target side (not instant -> adds timing)
    const halfW = geom.corridorW * 0.5
    const sideX = (halfW - 0.22) * r.targetSide
    // exponential approach
    r.x = THREE.MathUtils.damp(r.x, sideX, 9.0, dt)

    // tiny bob
    const y = 0.18 + Math.sin(r.t * 10) * 0.01

    // collision with obstacles
    if (r.alive && !r.cleared) {
      for (const ob of lvl.obstacles) {
        if (ob.hit) continue
        const dz = Math.abs(r.z - ob.z)
        if (dz < 0.22) {
          // obstacle occupies near its side; you survive if you're on the opposite side sufficiently
          const safeSide = -ob.side
          const safeX = (halfW - 0.22) * safeSide
          const distToSafe = Math.abs(r.x - safeX)
          const fail = distToSafe > 0.24 // too close to obstacle side
          if (fail) {
            ob.hit = true
            r.alive = false
            onePathState.fail()
            break
          } else {
            // reward: if extremely clean, flash "perfect"
            if (distToSafe < 0.05) r.perfectFlash = 1.0
          }
        }
      }
    }

    // collect gems
    if (r.alive && !r.cleared) {
      for (const g of lvl.gems) {
        if (g.collected) continue
        const dz = Math.abs(r.z - g.z)
        const dx = Math.abs(r.x - g.x)
        if (dz < 0.25 && dx < 0.22) {
          g.collected = true
          r.gemsThisRun += 1
        }
      }
    }

    // cleared?
    if (r.alive && !r.cleared && r.z > lvl.length) {
      r.cleared = true
      onePathState.clear(r.gemsThisRun)
    }

    // update ball
    if (ballRef.current) {
      ballRef.current.position.set(r.x, y, r.z)
      ballRef.current.rotation.y = r.t * 2.2
    }

    // update portal
    if (portalRef.current) {
      portalRef.current.position.set(0, 0.24, lvl.length + 0.7)
      portalRef.current.rotation.y += dt * 0.55
      portalRef.current.rotation.x = Math.sin(r.t * 0.7) * 0.15
    }

    if (particlesRef.current) {
      particlesRef.current.position.set(0, 0.25, lvl.length + 0.7)
      particlesRef.current.rotation.y += dt * 0.85
      particlesRef.current.rotation.x += dt * 0.25
    }

    // subtle screen-shake (via group wobble)
    if (groupRef.current) {
      const wob = r.wobble
      groupRef.current.rotation.z = Math.sin(r.t * 22) * 0.01 * wob
      groupRef.current.rotation.x = Math.sin(r.t * 18) * 0.008 * wob
    }

    clearFrameInput(inputRef)
  })

  const lvl = levelRef.current
  const len = lvl.length

  return (
    <>
      <CameraRig />

      <group ref={groupRef}>
        {/* background */}
        <color attach="background" args={[COLORS.bg]} />

        {/* simple lights */}
        <ambientLight intensity={0.85} />
        <directionalLight position={[6, 10, 5]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <directionalLight position={[-6, 6, -2]} intensity={0.55} />

        {/* floor */}
        <mesh
          geometry={geoms.floorGeom}
          material={mats.floor}
          position={[0, geom.floorH * 0.5, len * 0.5]}
          scale={[geom.corridorW, geom.floorH, len + 6]}
          receiveShadow
        />

        {/* walls */}
        <mesh
          geometry={geoms.wallGeom}
          material={mats.wall}
          position={[-geom.corridorW * 0.5 - geom.wallT * 0.5, geom.wallH * 0.5, len * 0.5]}
          scale={[geom.wallT, geom.wallH, len + 6]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={geoms.wallGeom}
          material={mats.wallDark}
          position={[geom.corridorW * 0.5 + geom.wallT * 0.5, geom.wallH * 0.5, len * 0.5]}
          scale={[geom.wallT, geom.wallH, len + 6]}
          castShadow
          receiveShadow
        />

        {/* obstacles */}
        {lvl.obstacles.map((ob) => {
          const halfW = geom.corridorW * 0.5
          const x = (halfW - 0.12) * ob.side
          return (
            <mesh
              key={ob.id}
              geometry={geoms.obstacleGeom}
              material={mats.obstacle}
              position={[x, 0.28, ob.z]}
              castShadow
            />
          )
        })}

        {/* gems */}
        {lvl.gems.map((g) => (
          <mesh
            key={g.id}
            geometry={geoms.gemGeom}
            material={mats.gem}
            position={[g.x, 0.42, g.z]}
            rotation={[0.4, g.spin, 0]}
          />
        ))}

        {/* portal */}
        <group ref={portalRef}>
          {Array.from({ length: 18 }).map((_, i) => {
            const a = (i / 18) * Math.PI * 2
            const r = 0.44
            const x = Math.cos(a) * r
            const y = Math.sin(a) * r
            const mat = i % 2 === 0 ? mats.portal : mats.portalAlt
            return (
              <mesh
                key={i}
                geometry={geoms.portalSegGeom}
                material={mat}
                position={[x, y + 0.15, 0]}
                rotation={[0, a, 0]}
                castShadow
              />
            )
          })}
          <mesh geometry={geoms.glowGeom} material={mats.glow} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} />
        </group>

        <points ref={particlesRef} geometry={particleGeom} material={particleMat} />

        {/* ball */}
        <mesh ref={ballRef} geometry={geoms.ballGeom} material={mats.ball} castShadow />

        {/* tiny "perfect" flash plane (cheap but satisfying) */}
        <PerfectFlash run={run} />
      </group>
    </>
  )
}

function PerfectFlash({ run }: { run: React.MutableRefObject<RunStatus> }) {
  const ref = React.useRef<THREE.Mesh>(null)
  const mat = React.useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0 }), [])
  const geo = React.useMemo(() => new THREE.PlaneGeometry(1.8, 0.3), [])

  useFrame((_, dt) => {
    if (!ref.current) return
    const r = run.current
    const a = r.perfectFlash
    mat.opacity = a * 0.75
    ref.current.position.set(0, 1.05, r.z + 1.2)
    ref.current.lookAt(0, 1.05, r.z + 2.2)
  })

  return (
    <mesh ref={ref} geometry={geo} material={mat}>
      {/* no text in 3D to keep deps minimal; the flash reads like a "perfect" ping */}
    </mesh>
  )
}

export default function OnePath() {
  const { camera, scene } = useThree()
  
  React.useEffect(() => {
    onePathState.load()
    // Setup camera
    camera.position.set(3.6, 5.2, 6.8)
    ;(camera as THREE.PerspectiveCamera).fov = 45
    camera.near = 0.1
    camera.far = 200
    camera.updateProjectionMatrix()
  }, [camera])

  return (
    <>
      <color attach="background" args={['#ffffff']} />
      <Scene />
      <Overlay />
    </>
  )
}
