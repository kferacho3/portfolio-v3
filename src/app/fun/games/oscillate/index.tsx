'use client'

import * as React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import * as THREE from 'three'

import { clearFrameInput, useInputRef } from '../../hooks/useInput'
import { onePathState, type OnePathLevel } from './state'

export { onePathState as oscillateState } from './state'

/**
 * OnePath
 * Inspired by "The Walls" (Ketchapp × mauigo games / Marius Gerlich).
 * Original implementation for this codebase.
 */

const COLORS = {
  bg: '#ffffff',
  wall: '#6b4cff',
  wallDark: '#563be8',
  deck: '#8a6bff',
  pillar: '#64e7ff',
  gem: '#ffd35a',
  portalGlow: '#61e9ff',
}

type RunStatus = {
  // sim
  t: number
  seg: number
  s: number // distance along current segment (0..len)
  dir: -1 | 1
  y: number
  vy: number
  alive: boolean
  cleared: boolean

  // scoring / feedback
  gemsThisRun: number
  wobble: number
  perfectFlash: number
  missFlash: number
  lastTapAt: number
}

function useOnMount(fn: () => void) {
  React.useEffect(() => {
    fn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
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
    <div className="absolute inset-0 select-none">
      {/* top level */}
      <div className="absolute top-6 left-0 right-0 flex items-start justify-center pointer-events-none">
        <div className="text-black text-7xl font-black tracking-tight" style={{ opacity: topText ? 1 : 0 }}>
          {topText}
        </div>
      </div>

      {/* bottom HUD */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-3 rounded-full bg-black/5 px-4 py-2 text-black/70">
          <div className="text-sm">
            <span className="font-semibold text-black/80">Gems</span> {snap.gems}
          </div>
          <div className="h-4 w-px bg-black/10" />
          <div className="text-sm">
            <span className="font-semibold text-black/80">Best</span>{' '}
            {snap.mode === 'levels' ? snap.bestLevel : snap.endlessBest}
          </div>
          <div className="h-4 w-px bg-black/10" />
          <div className="text-sm">
            <span className="font-semibold text-black/80">Skin</span> {snap.selectedSkin}
          </div>
        </div>
      </div>

      {/* MENU */}
      {snap.phase === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(560px,92vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl font-black text-black">OnePath</div>
                <div className="mt-2 text-black/70">
                  Bounce between walls. Tap <span className="font-semibold text-black/80">right on the wall</span> to
                  turn.
                </div>
              </div>
              <button
                className="rounded-2xl bg-black/5 px-4 py-2 text-sm font-semibold text-black/70 hover:bg-black/10"
                onClick={() => onePathState.openShop()}
              >
                Shop
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/5 p-4">
                <div className="text-sm font-semibold text-black/80">How it works</div>
                <div className="mt-1 text-sm text-black/60">
                  The ball oscillates between two end-walls. Tap near the correct wall to switch to the next bridge.
                </div>
              </div>
              <div className="rounded-2xl bg-black/5 p-4">
                <div className="text-sm font-semibold text-black/80">Twist</div>
                <div className="mt-1 text-sm text-black/60">
                  Shorter distance = tighter timing. Bounce too much and walls can break.
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-black/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-black/80">Select Level</div>
                  <div className="text-sm text-black/60">Levels are permanent + deterministic.</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="h-10 w-10 rounded-xl bg-white/80 text-black font-black hover:bg-white"
                    onClick={() => onePathState.selectLevel(Math.max(1, snap.selectedLevel - 1))}
                  >
                    –
                  </button>
                  <div className="min-w-[64px] text-center text-2xl font-black text-black">{snap.selectedLevel}</div>
                  <button
                    className="h-10 w-10 rounded-xl bg-white/80 text-black font-black hover:bg-white"
                    onClick={() => onePathState.selectLevel(snap.selectedLevel + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-black/40 leading-relaxed">
                Inspired by <span className="font-semibold text-black/50">The Walls</span> — Ketchapp × mauigo games
                (Marius Gerlich).
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                  onClick={() => onePathState.startEndless()}
                >
                  Endless
                </button>
                <button
                  className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                  onClick={() => onePathState.start()}
                >
                  Play
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOP */}
      {snap.phase === 'shop' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(720px,94vw)] rounded-3xl bg-white/95 p-6 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-black text-black">Ball Shop</div>
                <div className="mt-1 text-sm text-black/60">Spend gems to unlock new balls.</div>
              </div>
              <button
                className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white"
                onClick={() => onePathState.closeShop()}
              >
                Done
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-black/70">
                Gems: <span className="font-semibold text-black">{snap.gems}</span>
              </div>
              <button
                className="rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/10"
                onClick={() => onePathState.awardGems(25)}
                title="Dev helper"
              >
                +25 gems
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {snap.skins.map((s) => {
                const unlocked = snap.unlockedSkins.includes(s.id)
                const selected = snap.selectedSkin === s.id
                const affordable = unlocked || snap.gems >= s.cost
                return (
                  <button
                    key={s.id}
                    className={`rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                      selected ? 'border-black bg-black/5' : 'border-black/10 bg-white'
                    } ${affordable ? 'hover:bg-black/5' : 'opacity-60'}`}
                    onClick={() => {
                      if (unlocked) onePathState.selectSkin(s.id)
                      else onePathState.unlockSkin(s.id)
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full border border-black/10"
                        style={{ background: s.color }}
                      />
                      <div className="min-w-0">
                        <div className="font-black text-black truncate">{s.name}</div>
                        <div className="text-xs text-black/60">
                          {unlocked ? (selected ? 'Selected' : 'Unlocked') : `${s.cost} gems`}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 text-xs text-black/40">
              Tip: You earn gems by clearing levels. (Ad rewards not wired here — but the button exists.)
            </div>
          </div>
        </div>
      )}

      {/* CLEARED */}
      {snap.phase === 'cleared' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(560px,92vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <div className="text-4xl font-black text-black">
              LEVEL {snap.level} <span className="text-black/70">CLEARED!</span>
            </div>

            <div className="mt-3 flex items-center gap-3 text-black/70">
              <div className="rounded-xl bg-black/5 px-3 py-2">+{snap.lastRunGems} gems</div>
              <div className="text-sm">
                Total: <span className="font-semibold text-black/80">{snap.gems}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                onClick={() => onePathState.goMenu()}
              >
                Menu
              </button>
              <button
                className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                onClick={() => onePathState.retry()}
              >
                Replay
              </button>
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

      {/* GAMEOVER */}
      {snap.phase === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(560px,92vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <div className="text-4xl font-black text-black">Missed.</div>
            <div className="mt-2 text-black/70">Tap exactly when the ball hits the wall to turn.</div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-sm text-black/60">
                {snap.mode === 'levels' ? (
                  <>
                    Level <span className="font-semibold text-black/80">{snap.level}</span> • Best{' '}
                    <span className="font-semibold text-black/80">{snap.bestLevel}</span>
                  </>
                ) : (
                  <>
                    Endless <span className="font-semibold text-black/80">{snap.level}</span> • Best{' '}
                    <span className="font-semibold text-black/80">{snap.endlessBest}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                  onClick={() => onePathState.goMenu()}
                >
                  Menu
                </button>
                <button
                  className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                  onClick={() => onePathState.retry()}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Scene() {
  const snap = useSnapshot(onePathState)
  const inputRef = useInputRef()

  const levelRef = React.useRef<OnePathLevel>(onePathState.buildLevel(onePathState.level, onePathState.mode))

  const run = React.useRef<RunStatus>({
    t: 0,
    seg: 0,
    s: 0,
    dir: 1,
    y: 1,
    vy: 0,
    alive: true,
    cleared: false,
    gemsThisRun: 0,
    wobble: 0,
    perfectFlash: 0,
    missFlash: 0,
    lastTapAt: -999,
  })

  const ballRef = React.useRef<THREE.Mesh>(null)
  const groupRef = React.useRef<THREE.Group>(null)
  const portalRef = React.useRef<THREE.Group>(null)
  const particlesRef = React.useRef<THREE.Points>(null)

  const CONST = React.useMemo(() => {
    const BASE_H = 0.95
    const DECK_H = 0.14
    const BALL_R = 0.13
    const PILLAR_W = 0.34
    const PILLAR_H = 0.55
    return { BASE_H, DECK_H, BALL_R, PILLAR_W, PILLAR_H }
  }, [])

  const mats = React.useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.wall), roughness: 0.72, metalness: 0.05 })
    const wallDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.wallDark), roughness: 0.72, metalness: 0.05 })
    const deck = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.deck), roughness: 0.82, metalness: 0.02 })
    const pillar = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.pillar), roughness: 0.25, metalness: 0.0, emissive: new THREE.Color('#2ad8ff'), emissiveIntensity: 0.35 })
    const gem = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.gem), roughness: 0.25, metalness: 0.1, emissive: new THREE.Color('#ffcc3a'), emissiveIntensity: 0.25 })
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.portalGlow), transparent: true, opacity: 0.55 })
    const portalA = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), roughness: 0.4, metalness: 0.1 })
    const portalB = new THREE.MeshStandardMaterial({ color: new THREE.Color('#101010'), roughness: 0.4, metalness: 0.1 })
    return { wall, wallDark, deck, pillar, gem, glow, portalA, portalB }
  }, [])

  // ball skin material depends on selected skin
  const ballMat = React.useMemo(() => {
    const skin = snap.skins.find((s) => s.id === snap.selectedSkin) ?? snap.skins[0]
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skin.color),
      roughness: skin.roughness,
      metalness: skin.metalness,
    })
    if (skin.emissive) {
      m.emissive = new THREE.Color(skin.emissive)
      m.emissiveIntensity = skin.emissiveIntensity ?? 0.25
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.selectedSkin, snap.skins])

  const geoms = React.useMemo(() => {
    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    const ball = new THREE.SphereGeometry(CONST.BALL_R, 24, 24)
    const gem = new THREE.OctahedronGeometry(0.12, 0)
    const portalSeg = new THREE.BoxGeometry(0.09, 0.09, 0.2)
    const glow = new THREE.RingGeometry(0.32, 0.52, 48)
    return { unitBox, ball, gem, portalSeg, glow }
  }, [CONST.BALL_R])

  // portal particles
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

  const resetRun = React.useCallback((lvl: OnePathLevel) => {
    // reset mutable level state
    lvl.nodes.forEach((n) => {
      n.hp = n.maxHp
      n.broken = false
    })
    lvl.gems.forEach((g) => (g.collected = false))

    const r = run.current
    r.t = 0
    r.seg = 0
    r.s = 0.12
    r.dir = 1
    r.alive = true
    r.cleared = false
    r.gemsThisRun = 0
    r.wobble = 0
    r.perfectFlash = 0
    r.missFlash = 0
    r.lastTapAt = -999

    r.y = CONST.BASE_H + CONST.DECK_H + CONST.BALL_R
    r.vy = 0
  }, [CONST.BALL_R, CONST.BASE_H, CONST.DECK_H])

  React.useEffect(() => {
    // Build level on entry to playing/menu to keep deterministic.
    if (snap.phase === 'menu' || snap.phase === 'playing') {
      levelRef.current = onePathState.buildLevel(onePathState.level, onePathState.mode)
      resetRun(levelRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase, snap.level, snap.mode])

  // Helper: get current segment endpoints & dir
  function getSeg(lvl: OnePathLevel, segIndex: number) {
    const aIdx = lvl.path[segIndex]
    const bIdx = lvl.path[segIndex + 1]
    const a = lvl.nodes[aIdx]
    const b = lvl.nodes[bIdx]
    const ax = a.x
    const az = a.z
    const bx = b.x
    const bz = b.z
    const dx = bx - ax
    const dz = bz - az
    const len = Math.sqrt(dx * dx + dz * dz)
    const ux = dx / len
    const uz = dz / len
    return { aIdx, bIdx, ax, az, bx, bz, dx, dz, len, ux, uz }
  }

  function attemptTurn(lvl: OnePathLevel) {
    const r = run.current
    if (!r.alive || r.cleared) return

    // you can only turn on the "forward" wall (the end of the segment in path order)
    const seg = getSeg(lvl, r.seg)
    const px = seg.ax + seg.ux * r.s
    const pz = seg.az + seg.uz * r.s

    const distToB = Math.hypot(seg.bx - px, seg.bz - pz)

    const turnWindow = lvl.turnRadius
    const snapWindow = turnWindow * 1.25

    const isLastSeg = r.seg >= lvl.path.length - 2
    if (isLastSeg) return

    if (distToB <= turnWindow) {
      // perfect feedback scales with how tight your timing was
      r.perfectFlash = Math.max(r.perfectFlash, 1 - distToB / turnWindow)
      r.wobble = Math.max(r.wobble, 0.7)

      // snap to the wall, then rotate onto the next segment (perpendicular)
      r.seg += 1
      r.s = 0
      r.dir = 1
      r.lastTapAt = r.t
      return
    }

    // Slight forgiveness: if you're extremely close, still allow but no perfect.
    if (distToB <= snapWindow) {
      r.seg += 1
      r.s = 0
      r.dir = 1
      r.wobble = Math.max(r.wobble, 0.35)
      r.lastTapAt = r.t
      return
    }

    // Mistimed tap => fall.
    r.alive = false
    r.missFlash = 1
    r.vy = -2.2
    onePathState.fail()
  }

  function hitNode(lvl: OnePathLevel, nodeIdx: number) {
    const n = lvl.nodes[nodeIdx]
    if (n.broken) return
    n.hp -= 1
    if (n.hp <= 0) {
      n.broken = true
      // breaking a wall means you fall
      const r = run.current
      r.alive = false
      r.missFlash = 1
      r.vy = -2.2
      onePathState.fail()
    }
  }

  // camera follow
  function CameraRig() {
    const { camera } = useThree()
    useFrame((_, dt) => {
      const lvl = levelRef.current
      const r = run.current

      // compute ball world position
      const seg = getSeg(lvl, clamp(r.seg, 0, lvl.path.length - 2))
      const px = seg.ax + seg.ux * r.s
      const pz = seg.az + seg.uz * r.s

      const target = new THREE.Vector3(px, r.y, pz)

      // isometric-ish offset
      const desired = new THREE.Vector3(px + 4.4, 6.2, pz + 4.9)

      camera.position.lerp(desired, 1 - Math.exp(-3.4 * dt))
      ;(camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.damp((camera as THREE.PerspectiveCamera).fov, 45, 3, dt)
      ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
      camera.lookAt(target)
    })
    return null
  }

  // simulation
  useFrame((_, dt) => {
    const input = inputRef.current
    const tap = input.pointerJustDown || input.justPressed.has(' ') || input.justPressed.has('Enter')

    // We *don't* treat every tap as a game action while menus are open.
    // Buttons handle navigation to avoid accidental starts / continues.
    if (snap.phase !== 'playing') {
      const lvl = levelRef.current
      const r = run.current

      r.t += dt
      r.perfectFlash = Math.max(0, r.perfectFlash - dt * 2.0)
      r.missFlash = Math.max(0, r.missFlash - dt * 2.5)
      r.wobble = Math.max(0, r.wobble - dt * 3.0)

      const baseY = CONST.BASE_H + CONST.DECK_H + CONST.BALL_R
      const y = baseY + Math.sin(r.t * 8) * 0.008

      const seg = getSeg(lvl, clamp(r.seg, 0, lvl.path.length - 2))
      const px = seg.ax + seg.ux * r.s
      const pz = seg.az + seg.uz * r.s

      if (ballRef.current) {
        ballRef.current.position.set(px, y, pz)
        ballRef.current.rotation.y = r.t * 1.6
      }

      const endIdx = lvl.path[lvl.path.length - 1]
      const end = lvl.nodes[endIdx]
      if (portalRef.current && end) {
        portalRef.current.position.set(end.x, CONST.BASE_H + CONST.DECK_H + 0.18, end.z)
        portalRef.current.rotation.y += dt * 0.55
        portalRef.current.rotation.x = Math.sin(r.t * 0.7) * 0.15
      }

      if (particlesRef.current && end) {
        particlesRef.current.position.set(end.x, CONST.BASE_H + CONST.DECK_H + 0.2, end.z)
        particlesRef.current.rotation.y += dt * 0.85
        particlesRef.current.rotation.x += dt * 0.25
      }

      if (groupRef.current) {
        const wob = r.wobble * 0.25
        groupRef.current.rotation.z = Math.sin(r.t * 22) * 0.01 * wob
        groupRef.current.rotation.x = Math.sin(r.t * 18) * 0.008 * wob
      }

      clearFrameInput(inputRef)
      return
    }

    const lvl = levelRef.current
    const r = run.current

    r.t += dt
    r.perfectFlash = Math.max(0, r.perfectFlash - dt * 2.0)
    r.missFlash = Math.max(0, r.missFlash - dt * 2.5)
    r.wobble = Math.max(0, r.wobble - dt * 3.0)

    if (tap) attemptTurn(lvl)

    // gravity after death
    if (!r.alive) {
      r.vy -= 7.5 * dt
      r.y += r.vy * dt
    } else {
      // keep ball at deck height with tiny bob
      const baseY = CONST.BASE_H + CONST.DECK_H + CONST.BALL_R
      r.y = baseY + Math.sin(r.t * 10) * 0.01
    }

    // segment movement
    if (r.alive && !r.cleared) {
      const seg = getSeg(lvl, r.seg)
      r.s += r.dir * lvl.speed * dt

      // exit reached?
      const isLastSeg = r.seg === lvl.path.length - 2
      if (isLastSeg && r.s >= seg.len) {
        r.cleared = true
        onePathState.clear(r.gemsThisRun)
        clearFrameInput(inputRef)
        return
      }

      // bounce on walls
      if (r.s <= 0) {
        r.s = 0
        r.dir = 1
        hitNode(lvl, seg.aIdx)
        r.wobble = Math.max(r.wobble, 0.25)
      } else if (r.s >= seg.len) {
        r.s = seg.len
        r.dir = -1
        hitNode(lvl, seg.bIdx)
        r.wobble = Math.max(r.wobble, 0.25)
      }

      // gem collection
      const px = seg.ax + seg.ux * r.s
      const pz = seg.az + seg.uz * r.s
      for (const g of lvl.gems) {
        if (g.collected) continue
        const d = Math.hypot(g.x - px, g.z - pz)
        if (d < 0.22) {
          g.collected = true
          r.gemsThisRun += 1
          r.perfectFlash = Math.max(r.perfectFlash, 0.25)
        }
      }

      // if you fall below the deck, end (safety)
      if (r.y < -8) {
        r.y = -8
      }

      // update ball mesh
      if (ballRef.current) {
        ballRef.current.position.set(px, r.y, pz)
        ballRef.current.rotation.y = r.t * 2.2
        ballRef.current.rotation.x = r.t * 1.3
      }

      // portal positioning
      const endIdx = lvl.path[lvl.path.length - 1]
      const end = lvl.nodes[endIdx]
      if (portalRef.current) {
        portalRef.current.position.set(end.x, CONST.BASE_H + CONST.DECK_H + 0.18, end.z)
        portalRef.current.rotation.y += dt * 0.55
        portalRef.current.rotation.x = Math.sin(r.t * 0.7) * 0.15
      }

      if (particlesRef.current) {
        particlesRef.current.position.set(end.x, CONST.BASE_H + CONST.DECK_H + 0.18, end.z)
        particlesRef.current.rotation.y += dt * 0.85
        particlesRef.current.rotation.x += dt * 0.25
      }

      // wobble
      if (groupRef.current) {
        const wob = r.wobble
        groupRef.current.rotation.z = Math.sin(r.t * 22) * 0.01 * wob
        groupRef.current.rotation.x = Math.sin(r.t * 18) * 0.008 * wob
      }
    } else {
      // still update ball when dead (so it falls)
      const seg = getSeg(lvl, clamp(r.seg, 0, lvl.path.length - 2))
      const px = seg.ax + seg.ux * r.s
      const pz = seg.az + seg.uz * r.s
      if (ballRef.current) {
        ballRef.current.position.set(px, r.y, pz)
        ballRef.current.rotation.y = r.t * 2.2
        ballRef.current.rotation.x = r.t * 1.3
      }
    }

    clearFrameInput(inputRef)
  })

  const lvl = levelRef.current

  // Create a material for highlighting the next segment (perpendicular path)
  const nextSegmentDeckMat = React.useMemo(() => {
    return new THREE.MeshStandardMaterial({ 
      color: new THREE.Color(COLORS.deck), 
      roughness: 0.6, 
      metalness: 0.05,
      emissive: new THREE.Color(COLORS.portalGlow),
      emissiveIntensity: 0.2
    })
  }, [])

  // precompute segment meshes - ALL segments are always visible
  const segmentMeshes = lvl.edges.map((e, idx) => {
    const a = lvl.nodes[e.a]
    const b = lvl.nodes[e.b]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.sqrt(dx * dx + dz * dz)
    const midX = (a.x + b.x) * 0.5
    const midZ = (a.z + b.z) * 0.5
    const angle = Math.atan2(dz, dx)

    const baseScale = new THREE.Vector3(len, CONST.BASE_H, lvl.bridgeWidth)
    const deckScale = new THREE.Vector3(len, CONST.DECK_H, lvl.bridgeWidth * 0.92)

    // Alternate slight shade per segment for depth
    const baseMat = idx % 2 === 0 ? mats.wall : mats.wallDark

    return (
      <group key={e.id} position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
        <mesh geometry={geoms.unitBox} material={baseMat} position={[0, CONST.BASE_H * 0.5, 0]} scale={baseScale} castShadow receiveShadow />
        <mesh geometry={geoms.unitBox} material={mats.deck} position={[0, CONST.BASE_H + CONST.DECK_H * 0.5, 0]} scale={deckScale} castShadow receiveShadow />
      </group>
    )
  })

  // Component to highlight the next segment (perpendicular path)
  function NextSegmentHighlight() {
    const ref = React.useRef<THREE.Group>(null)
    const meshRef = React.useRef<THREE.Mesh>(null)
    
    useFrame(() => {
      if (!ref.current || !meshRef.current) return
      const r = run.current
      if (snap.phase !== 'playing' || !r.alive || r.cleared) {
        ref.current.visible = false
        return
      }
      
      const currentSegIndex = clamp(r.seg, 0, lvl.edges.length - 1)
      const nextSegIndex = currentSegIndex < lvl.edges.length - 1 ? currentSegIndex + 1 : -1
      
      if (nextSegIndex < 0 || nextSegIndex >= lvl.edges.length) {
        ref.current.visible = false
        return
      }
      
      const e = lvl.edges[nextSegIndex]
      const a = lvl.nodes[e.a]
      const b = lvl.nodes[e.b]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.sqrt(dx * dx + dz * dz)
      const midX = (a.x + b.x) * 0.5
      const midZ = (a.z + b.z) * 0.5
      const angle = Math.atan2(dz, dx)

      ref.current.position.set(midX, 0, midZ)
      ref.current.rotation.set(0, -angle, 0)
      
      // Update scale based on segment length
      meshRef.current.scale.set(len, CONST.DECK_H * 1.15, lvl.bridgeWidth * 0.96)
      
      ref.current.visible = true
    })
    
    return (
      <group ref={ref} visible={false}>
        <mesh 
          ref={meshRef}
          geometry={geoms.unitBox} 
          material={nextSegmentDeckMat} 
          position={[0, CONST.BASE_H + CONST.DECK_H * 0.5, 0]} 
          castShadow 
          receiveShadow 
        />
      </group>
    )
  }

  return (
    <>
      <CameraRig />

      <group ref={groupRef}>
        <color attach="background" args={[COLORS.bg]} />

        <ambientLight intensity={0.9} />
        <directionalLight position={[7, 11, 6]} intensity={1.25} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <directionalLight position={[-6, 6, -2]} intensity={0.55} />

        {/* segments */}
        {segmentMeshes}

        {/* Highlight next segment (perpendicular path) */}
        <NextSegmentHighlight />

        {/* pillars / walls (nodes) */}
        {lvl.nodes.map((n) => {
          const hp01 = clamp(n.hp / n.maxHp, 0, 1)
          const y = CONST.BASE_H + CONST.DECK_H + CONST.PILLAR_H * 0.5
          const scaleY = CONST.PILLAR_H * (0.85 + hp01 * 0.15)
          const visible = !n.broken
          return (
            <mesh
              key={n.id}
              geometry={geoms.unitBox}
              material={mats.pillar}
              position={[n.x, y, n.z]}
              scale={[CONST.PILLAR_W, scaleY, CONST.PILLAR_W]}
              visible={visible}
              castShadow
            />
          )
        })}

        {/* gems */}
        {lvl.gems.map((g) => (
          <mesh
            key={g.id}
            geometry={geoms.gem}
            material={mats.gem}
            position={[g.x, CONST.BASE_H + CONST.DECK_H + 0.38, g.z]}
            rotation={[0.4, (parseInt(g.id.split('_').pop() || '0', 10) * 0.9) % (Math.PI * 2), 0]}
            visible={!g.collected}
          />
        ))}

        {/* portal */}
        <group ref={portalRef}>
          {Array.from({ length: 18 }).map((_, i) => {
            const a = (i / 18) * Math.PI * 2
            const r = 0.44
            const x = Math.cos(a) * r
            const y = Math.sin(a) * r
            const mat = i % 2 === 0 ? mats.portalA : mats.portalB
            return (
              <mesh
                key={i}
                geometry={geoms.portalSeg}
                material={mat}
                position={[x, y + 0.15, 0]}
                rotation={[0, a, 0]}
                castShadow
              />
            )
          })}
          <mesh geometry={geoms.glow} material={mats.glow} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} />
        </group>

        <points ref={particlesRef} geometry={particleGeom} material={particleMat} />

        {/* ball */}
        <mesh ref={ballRef} geometry={geoms.ball} material={ballMat} castShadow />

        {/* feedback planes */}
        <PerfectFlash run={run} />
        <MissFlash run={run} />
      </group>
    </>
  )
}

function PerfectFlash({ run }: { run: React.MutableRefObject<RunStatus> }) {
  const ref = React.useRef<THREE.Mesh>(null)
  const mat = React.useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0 }), [])
  const geo = React.useMemo(() => new THREE.PlaneGeometry(2.2, 0.35), [])

  useFrame(() => {
    if (!ref.current) return
    const r = run.current
    mat.opacity = r.perfectFlash * 0.65
    if (!ref.current.parent) return
    // place slightly above ball
    const p = ref.current.parent.getObjectByName('__ball') as THREE.Object3D | undefined
    void p
    // we don't rely on it; Scene positions this plane via lookAt trick
    ref.current.position.set(0, 1.35, 0)
  })

  return <mesh ref={ref} geometry={geo} material={mat} />
}

function MissFlash({ run }: { run: React.MutableRefObject<RunStatus> }) {
  const ref = React.useRef<THREE.Mesh>(null)
  const mat = React.useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#111111'), transparent: true, opacity: 0 }), [])
  const geo = React.useMemo(() => new THREE.PlaneGeometry(2.8, 2.8), [])

  useFrame((state) => {
    if (!ref.current) return
    const r = run.current
    mat.opacity = r.missFlash * 0.22
    ref.current.position.copy(state.camera.position)
    ref.current.lookAt(state.camera.position.clone().add(state.camera.getWorldDirection(new THREE.Vector3())))
    ref.current.translateZ(-2.2)
  })

  return <mesh ref={ref} geometry={geo} material={mat} />
}

export default function Oscillate() {
  useOnMount(() => onePathState.load())

  return (
    <>
      <Scene />
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="fixed inset-0 pointer-events-auto select-none">
          <Overlay />
        </div>
      </Html>
    </>
  )
}
