'use client'

import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Html, OrthographicCamera } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { proxy, useSnapshot } from 'valtio'
import { useInputRef, clearFrameInput } from '../../hooks/useInput'
import { BALL_SKINS, state as persistState, load, save, addStars, setHighScore, unlockBall, setSelectedBall, canUnlockBall } from './state'

// -----------------------------
// Runtime (per-run) state
// -----------------------------
const run = proxy({
  score: 0,
  slow: false,
  speed: 4.2,
  starsThisRun: 0,
})

// -----------------------------
// Constants (tuned to feel like a Ketchapp-ish one-tapper)
// -----------------------------
const TRACK_WIDTH = 2.6
const TRACK_THICK = 0.12
const RAIL_WIDTH = 0.22
const SEG_LEN = 6
const SEG_COUNT = 26

const BALL_RADIUS = 0.25
const BALL_BOUNCE_SPEED = 2.65 // lateral speed

const BASE_SPEED = 4.2
const SPEED_RAMP = 0.045 // speed added per point

const SLOW_TARGET = 0.26 // time scale while holding
const SLOW_LERP = 9.5

const OBST_COUNT = 28
const OBST_THICK = 0.38
const OBST_HEIGHT = 0.36

const LOOK_AHEAD = 4.8
const RESPAWN_BEHIND = 8

const OBST_COLORS = ['#ff6b6b', '#ffe4b8', '#b6ffcc', '#cfd4dc']

type ObstacleKind = 'side' | 'center'

type Obstacle = {
  id: number
  z: number
  kind: ObstacleKind
  side: -1 | 1 // only for side obstacles
  lenX: number
  color: string
  hasStar: boolean
  hasGift: boolean
  passed: boolean
  starCollected: boolean
  giftCollected: boolean
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeObstacle(id: number, z: number): Obstacle {
  const kind: ObstacleKind = Math.random() < 0.86 ? 'side' : 'center'
  const side: -1 | 1 = Math.random() < 0.5 ? -1 : 1
  const laneHalf = TRACK_WIDTH / 2 - RAIL_WIDTH - 0.06

  // Side blocks: from edge toward center. Center blocks: centered, forcing you to be on an edge.
  const lenX =
    kind === 'side'
      ? rand(laneHalf * 0.55, laneHalf * 1.22)
      : rand(laneHalf * 0.55, laneHalf * 0.9)

  // Pickups: mostly stars, occasionally gifts.
  const hasGift = Math.random() < 0.07
  const hasStar = !hasGift && Math.random() < 0.35

  return {
    id,
    z,
    kind,
    side,
    lenX,
    color: pick(OBST_COLORS),
    hasStar,
    hasGift,
    passed: false,
    starCollected: false,
    giftCollected: false,
  }
}

function obstacleXRange(o: Obstacle) {
  const laneHalf = TRACK_WIDTH / 2 - RAIL_WIDTH - 0.06
  if (o.kind === 'center') {
    const xMin = -o.lenX / 2
    const xMax = o.lenX / 2
    return { xMin, xMax }
  }
  if (o.side === -1) {
    const xMin = -laneHalf
    const xMax = -laneHalf + o.lenX
    return { xMin, xMax }
  }
  const xMax = laneHalf
  const xMin = laneHalf - o.lenX
  return { xMin, xMax }
}

function pickupX(o: Obstacle) {
  // Keep pickups tempting but not always free.
  if (o.kind === 'center') return 0
  // Put stars/gifts a bit away from the obstacle to encourage timing.
  const laneHalf = TRACK_WIDTH / 2 - RAIL_WIDTH - 0.06
  return o.side === -1 ? laneHalf * 0.45 : -laneHalf * 0.45
}

// -----------------------------
// Scene
// -----------------------------
function SlowMoScene() {
  const snap = useSnapshot(persistState)
  const inputRef = useInputRef()

  const cameraRef = useRef<THREE.OrthographicCamera>(null!)
  const ballRef = useRef<THREE.Mesh>(null!)
  const shadowRef = useRef<THREE.Mesh>(null!)
  const slowRingRef = useRef<THREE.Mesh>(null!)

  const segmentGroupRefs = useRef<(THREE.Group | null)[]>([])
  const obstacleGroupRefs = useRef<(THREE.Group | null)[]>([])
  const obstacleMeshRefs = useRef<(THREE.Mesh | null)[]>([])
  const starRefs = useRef<(THREE.Mesh | null)[]>([])
  const giftRefs = useRef<(THREE.Mesh | null)[]>([])

  const segments = useMemo(() => {
    return Array.from({ length: SEG_COUNT }, (_, i) => ({ id: i, z: i * SEG_LEN }))
  }, [])

  const obstacles = useMemo(() => {
    const arr: Obstacle[] = []
    let z = 7
    for (let i = 0; i < OBST_COUNT; i++) {
      z += rand(2.4, 4.1)
      arr.push(makeObstacle(i, z))
    }
    return arr
  }, [])

  const world = useRef({
    x: -1,
    z: 0,
    vx: BALL_BOUNCE_SPEED,
    timeScale: 1,
    farZ: 0,
  })

  // (re)start run
  useEffect(() => {
    if (snap.phase !== 'playing') return

    load()

    // reset runtime
    run.score = 0
    run.slow = false
    run.speed = BASE_SPEED
    run.starsThisRun = 0

    world.current.x = -((TRACK_WIDTH / 2 - RAIL_WIDTH - 0.06) - BALL_RADIUS)
    world.current.z = 0
    world.current.vx = BALL_BOUNCE_SPEED
    world.current.timeScale = 1

    // reset track
    segments.forEach((seg, i) => {
      seg.z = i * SEG_LEN
    })

    // reset obstacles
    let z = 7
    for (let i = 0; i < obstacles.length; i++) {
      z += rand(2.4, 4.1)
      const o = obstacles[i]
      const fresh = makeObstacle(o.id, z)
      Object.assign(o, fresh)
    }
    world.current.farZ = z

    // apply visuals to meshes after a tick
    requestAnimationFrame(() => {
      for (let i = 0; i < obstacles.length; i++) {
        syncObstacleVisual(i)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase])

  function syncObstacleVisual(i: number) {
    const o = obstacles[i]
    const group = obstacleGroupRefs.current[i]
    const block = obstacleMeshRefs.current[i]
    const star = starRefs.current[i]
    const gift = giftRefs.current[i]
    if (!group || !block) return

    group.position.set(0, 0, o.z)

    // Block size/position
    const { xMin, xMax } = obstacleXRange(o)
    const lenX = xMax - xMin
    const x = (xMin + xMax) / 2

    block.position.set(x, OBST_HEIGHT / 2, 0)
    block.scale.set(lenX, OBST_HEIGHT, OBST_THICK)

    const mat = block.material as THREE.MeshStandardMaterial
    mat.color.set(o.color)

    // Pickup positions
    if (star) {
      star.visible = o.hasStar && !o.starCollected
      star.position.set(pickupX(o), 0.45, 0)
    }
    if (gift) {
      gift.visible = o.hasGift && !o.giftCollected
      gift.position.set(pickupX(o), 0.42, 0)
    }
  }

  useFrame((_r3f, delta) => {
    const input = inputRef.current
    const cam = cameraRef.current

    if (snap.phase !== 'playing') {
      // Keep camera looking at track so menu/finish screens show the scene
      const lx = world.current.x
      const lz = Math.max(0, world.current.z) + LOOK_AHEAD
      cam.position.set(lx + 4.6, 5.5, lz - 4.6)
      cam.lookAt(lx, 0, lz)
      clearFrameInput(inputRef)
      return
    }

    // Smooth time scale: hold to slow
    const target = input.pointerDown ? SLOW_TARGET : 1
    world.current.timeScale = THREE.MathUtils.lerp(world.current.timeScale, target, 1 - Math.exp(-SLOW_LERP * delta))
    const worldDt = delta * world.current.timeScale

    run.slow = world.current.timeScale < 0.85

    // Speed ramps with score (feels like "leveling")
    run.speed = BASE_SPEED + run.score * SPEED_RAMP

    // Move forward (world time)
    world.current.z += run.speed * worldDt

    // Bounce sideways (real time, so slowing gives you more time to "line up")
    const laneHalf = TRACK_WIDTH / 2 - RAIL_WIDTH - 0.06
    const bound = laneHalf - BALL_RADIUS
    world.current.x += world.current.vx * delta
    if (world.current.x > bound) {
      world.current.x = bound
      world.current.vx *= -1
    }
    if (world.current.x < -bound) {
      world.current.x = -bound
      world.current.vx *= -1
    }

    // Update ball + shadow + slow ring
    ballRef.current.position.set(world.current.x, BALL_RADIUS + 0.02, world.current.z)
    shadowRef.current.position.set(world.current.x, 0.01, world.current.z)
    slowRingRef.current.position.set(world.current.x, BALL_RADIUS + 0.02, world.current.z)
    slowRingRef.current.scale.setScalar(run.slow ? 1.15 : 0.95)
    ;(slowRingRef.current.material as THREE.MeshBasicMaterial).opacity = run.slow ? 0.35 : 0.15

    // Camera follow
    cam.position.set(world.current.x + 4.6, 5.5, world.current.z - 4.6)
    cam.lookAt(world.current.x, 0.0, world.current.z + LOOK_AHEAD)

    // Recycle track segments
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (seg.z < world.current.z - SEG_LEN) {
        seg.z += SEG_COUNT * SEG_LEN
      }
      const g = segmentGroupRefs.current[i]
      if (g) g.position.z = seg.z
    }

    // Obstacle logic
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i]

      // score when passed
      if (!o.passed && world.current.z > o.z + 0.8) {
        o.passed = true
        run.score += 1
      }

      // pickups (stars)
      if (o.hasStar && !o.starCollected) {
        const dx = Math.abs(world.current.x - pickupX(o))
        const dz = Math.abs(world.current.z - o.z)
        if (dx < 0.38 && dz < 0.55) {
          o.starCollected = true
          run.starsThisRun += 1
          addStars(1)
          save()
          const star = starRefs.current[i]
          if (star) star.visible = false
        }
      }
      if (o.hasGift && !o.giftCollected) {
        const dx = Math.abs(world.current.x - pickupX(o))
        const dz = Math.abs(world.current.z - o.z)
        if (dx < 0.42 && dz < 0.6) {
          o.giftCollected = true
          const bonus = Math.floor(rand(4, 8))
          run.starsThisRun += bonus
          addStars(bonus)
          save()
          const gift = giftRefs.current[i]
          if (gift) gift.visible = false
        }
      }

      // collision
      const dz = Math.abs(world.current.z - o.z)
      if (dz < (OBST_THICK / 2 + BALL_RADIUS * 0.95)) {
        const { xMin, xMax } = obstacleXRange(o)
        const inX = world.current.x + BALL_RADIUS > xMin && world.current.x - BALL_RADIUS < xMax
        if (inX) {
          // finish run
          setHighScore(run.score)
          save()
          persistState.finish()
          return
        }
      }

      // Recycle obstacles behind
      if (o.z < world.current.z - RESPAWN_BEHIND) {
        world.current.farZ += rand(2.25, 4.0)
        const fresh = makeObstacle(o.id, world.current.farZ)
        Object.assign(o, fresh)
        syncObstacleVisual(i)
      }

      // Keep visuals synced (position only)
      const g = obstacleGroupRefs.current[i]
      if (g) g.position.z = o.z

      const star = starRefs.current[i]
      if (star && star.visible) {
        star.rotation.y += delta * 3.2
        star.rotation.x += delta * 2.2
      }
      const gift = giftRefs.current[i]
      if (gift && gift.visible) {
        gift.rotation.y += delta * 1.6
      }
    }
    
    clearFrameInput(inputRef)
  })

  const ballColor = useSnapshot(persistState).selectedBall

  return (
    <>
      <OrthographicCamera
        ref={cameraRef}
        makeDefault
        zoom={90}
        near={0.1}
        far={1000}
        position={[4.6, 5.5, -4.6]}
      />

      <color attach="background" args={['#0a76e8']} />

      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 4]} intensity={1.2} />

      {/* Track segments */}
      {segments.map((seg, i) => (
        <group
          key={seg.id}
          ref={(el) => {
            segmentGroupRefs.current[i] = el
          }}
          position={[0, 0, seg.z]}
        >
          {/* Floor */}
          <mesh position={[0, -TRACK_THICK / 2, SEG_LEN / 2]}>
            <boxGeometry args={[TRACK_WIDTH, TRACK_THICK, SEG_LEN]} />
            <meshStandardMaterial color="#3a3a3f" roughness={0.85} />
          </mesh>

          {/* Rails */}
          <mesh position={[-(TRACK_WIDTH / 2 - RAIL_WIDTH / 2), TRACK_THICK * 0.15, SEG_LEN / 2]}>
            <boxGeometry args={[RAIL_WIDTH, TRACK_THICK * 1.15, SEG_LEN]} />
            <meshStandardMaterial color="#34d3c7" roughness={0.55} />
          </mesh>
          <mesh position={[TRACK_WIDTH / 2 - RAIL_WIDTH / 2, TRACK_THICK * 0.15, SEG_LEN / 2]}>
            <boxGeometry args={[RAIL_WIDTH, TRACK_THICK * 1.15, SEG_LEN]} />
            <meshStandardMaterial color="#34d3c7" roughness={0.55} />
          </mesh>

          {/* subtle stripe every other segment */}
          {seg.id % 2 === 0 && (
            <mesh position={[0, 0.001, SEG_LEN / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[TRACK_WIDTH - RAIL_WIDTH * 2 - 0.12, 0.14]} />
              <meshBasicMaterial color="#ffffff" opacity={0.18} transparent />
            </mesh>
          )}
        </group>
      ))}

      {/* Obstacles + pickups */}
      {obstacles.map((o, i) => (
        <group
          key={o.id}
          ref={(el) => {
            obstacleGroupRefs.current[i] = el
          }}
          position={[0, 0, o.z]}
        >
          <mesh
            ref={(el) => {
              obstacleMeshRefs.current[i] = el
            }}
            position={[0, OBST_HEIGHT / 2, 0]}
            scale={[o.lenX, OBST_HEIGHT, OBST_THICK]}
            castShadow={false}
            receiveShadow={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={o.color} roughness={0.65} />
          </mesh>

          {/* Star */}
          <mesh
            ref={(el) => {
              starRefs.current[i] = el
            }}
            visible={o.hasStar && !o.starCollected}
            position={[pickupX(o), 0.45, 0]}
          >
            <octahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial color="#ffd36a" roughness={0.25} metalness={0.2} />
          </mesh>

          {/* Gift */}
          <mesh
            ref={(el) => {
              giftRefs.current[i] = el
            }}
            visible={o.hasGift && !o.giftCollected}
            position={[pickupX(o), 0.42, 0]}
          >
            <boxGeometry args={[0.22, 0.22, 0.22]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.1} />
          </mesh>
        </group>
      ))}

      {/* Ball */}
      <mesh ref={ballRef} position={[0, BALL_RADIUS, 0]}>
        <sphereGeometry args={[BALL_RADIUS, 28, 28]} />
        <meshStandardMaterial color={BALL_SKINS[ballColor]?.color ?? '#ffffff'} roughness={0.25} metalness={0.05} />
      </mesh>

      {/* Shadow */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[BALL_RADIUS * 1.15, 20]} />
        <meshBasicMaterial color="#000000" opacity={0.22} transparent />
      </mesh>

      {/* Slow ring */}
      <mesh ref={slowRingRef} rotation={[Math.PI / 2, 0, 0]} position={[0, BALL_RADIUS + 0.02, 0]}>
        <torusGeometry args={[BALL_RADIUS * 0.9, 0.05, 12, 32]} />
        <meshBasicMaterial color="#b6ffcc" opacity={0.15} transparent />
      </mesh>
    </>
  )
}

// -----------------------------
// HUD / Overlay
// -----------------------------
function SlowMoOverlay() {
  const snap = useSnapshot(persistState)
  const s = useSnapshot(persistState)
  const r = useSnapshot(run)

  const canUnlock = (id: number) => canUnlockBall(id)

  const handleTapStart = () => {
    if (snap.phase === 'menu') persistState.start()
  }

  const handleReplay = () => {
    if (snap.phase === 'finish') persistState.start()
  }

  const handleBackToMenu = () => {
    if (snap.phase === 'finish') persistState.backToMenu()
  }

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* Top HUD */}
      {snap.phase === 'playing' && (
        <div className="absolute top-4 left-0 right-0 flex items-center justify-center">
          <div className="px-5 py-2 rounded-full bg-black/25 text-white font-bold text-4xl tracking-wide">{r.score}</div>
        </div>
      )}

      {snap.phase === 'playing' && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="px-3 py-2 rounded-full bg-black/25 text-white font-semibold">★ {s.stars}</div>
          {r.slow && <div className="px-3 py-2 rounded-full bg-white/20 text-white font-semibold">SLOW</div>}
        </div>
      )}

      {/* Menu */}
      {snap.phase === 'menu' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-between p-6 pointer-events-auto cursor-pointer"
          onClick={handleTapStart}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTapStart(); } }}
          role="button"
          tabIndex={0}
          aria-label="Tap to start"
        >
          <div />

          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-6xl font-black text-white drop-shadow">SlowMo</div>
            <div className="text-white/90 text-lg max-w-sm">
              Hold to slow time. Let the ball bounce into the safe lane, then release.
            </div>
            <div className="text-white/80 text-sm">Collect ★ to unlock new balls.</div>
            <div className="text-white/70 text-xs">Inspired by “Slow Mo” (Ketchapp & WildBeep).</div>
          </div>

          <div className="w-full max-w-md flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            {/* Ball picker */}
            <div className="bg-black/25 rounded-2xl p-4">
              <div className="text-white font-semibold mb-3">Balls</div>
              <div className="flex gap-2 flex-wrap">
                {BALL_SKINS.map((b) => {
                  const unlocked = s.unlockedBallIds.includes(b.id)
                  const selected = s.selectedBall === b.id
                  const afford = canUnlock(b.id)

                  return (
                    <button
                      key={b.id}
                      className={`relative w-14 h-14 rounded-full border-2 ${selected ? 'border-white' : 'border-white/30'} ${unlocked ? '' : 'opacity-70'}`}
                      style={{ background: b.color }}
                      onClick={() => {
                        if (unlocked) {
                          setSelectedBall(b.id)
                          save()
                          return
                        }
                        if (afford) {
                          unlockBall(b.id)
                          setSelectedBall(b.id)
                          save()
                        }
                      }}
                      title={unlocked ? b.name : `${b.name} — ${b.cost}★`}
                    >
                      {!unlocked && (
                        <div className="absolute inset-0 rounded-full bg-black/35 flex items-center justify-center text-white text-xs font-bold">
                          {b.cost}★
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="text-white/80 text-sm mt-3">Stars: {s.stars}</div>
            </div>

            <div className="text-center text-white/90 font-semibold">TAP TO START</div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {snap.phase === 'finish' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
          <div className="text-white text-5xl font-black drop-shadow">Game Over</div>
          <div className="text-white/90 text-xl font-bold">Score: {r.score}</div>
          <div className="text-white/70">Best: {s.highScore}</div>
          <div className="text-white/80">★ +{r.starsThisRun} this run</div>

          <div className="pointer-events-auto flex gap-3 mt-4">
            <button
              className="px-6 py-3 rounded-xl bg-white text-black font-bold"
              onClick={handleReplay}
            >
              Replay
            </button>
            <button
              className="px-6 py-3 rounded-xl bg-black/40 text-white font-bold"
              onClick={handleBackToMenu}
            >
              Menu
            </button>
          </div>

          <div className="text-white/60 text-xs mt-4 text-center">
            Tip: hold SLOW longer to let the ball bounce to the other side.
          </div>
        </div>
      )}
    </div>
  )
}

export { state as slowMoState } from './state'

export default function SlowMo() {
  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <SlowMoScene />
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="fixed inset-0 pointer-events-auto select-none">
          <SlowMoOverlay />
        </div>
      </Html>
    </>
  )
}
