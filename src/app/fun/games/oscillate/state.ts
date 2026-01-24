import { proxy } from 'valtio'

export type OnePathPhase = 'menu' | 'playing' | 'cleared' | 'gameover' | 'shop'
export type OnePathMode = 'levels' | 'endless'

export type OnePathNode = {
  id: string
  x: number
  z: number
  maxHp: number
  hp: number
  broken: boolean
}

export type OnePathEdge = {
  id: string
  a: number
  b: number
}

export type OnePathGem = {
  id: string
  x: number
  z: number
  collected: boolean
}

export type OnePathLevel = {
  id: string
  level: number
  mode: OnePathMode

  // A deterministic "course" represented as a chain of nodes.
  // The ball oscillates on the current edge (path[i] -> path[i+1]) until the player taps at the right moment
  // near the correct node to rotate 90° onto the next edge.
  path: number[]
  nodes: OnePathNode[]
  edges: OnePathEdge[]
  gems: OnePathGem[]

  // gameplay tuning
  speed: number
  turnRadius: number
  snapRadius: number
  bridgeWidth: number
  baseHeight: number
  deckHeight: number
}

export type OnePathSkin = {
  id: string
  name: string
  cost: number
  color: string
  roughness: number
  metalness: number
  emissive?: string
  emissiveIntensity?: number
}

type SaveData = {
  bestLevel: number
  level: number
  selectedLevel: number
  gems: number
  selectedSkin: string
  unlockedSkins: string[]
  endlessBest: number
}

const SAVE_KEY = 'onepath_save_v2'

const DEFAULT_SKINS: OnePathSkin[] = [
  { id: 'black', name: 'Classic', cost: 0, color: '#1a1a1a', roughness: 0.32, metalness: 0.18 },
  { id: 'pearl', name: 'Pearl', cost: 40, color: '#f5f5f5', roughness: 0.22, metalness: 0.08, emissive: '#ffffff', emissiveIntensity: 0.08 },
  { id: 'mint', name: 'Mint', cost: 70, color: '#7ef7d6', roughness: 0.28, metalness: 0.12, emissive: '#2ad8ff', emissiveIntensity: 0.15 },
  { id: 'sun', name: 'Sun', cost: 90, color: '#ffd35a', roughness: 0.2, metalness: 0.18, emissive: '#ffcc3a', emissiveIntensity: 0.16 },
  { id: 'nebula', name: 'Nebula', cost: 120, color: '#7b61ff', roughness: 0.35, metalness: 0.22, emissive: '#6b4cff', emissiveIntensity: 0.22 },
  { id: 'ruby', name: 'Ruby', cost: 160, color: '#ff4d6d', roughness: 0.26, metalness: 0.16, emissive: '#ff4d6d', emissiveIntensity: 0.18 },
  { id: 'chrome', name: 'Chrome', cost: 220, color: '#c8c8c8', roughness: 0.08, metalness: 0.85 },
]

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

export const onePathState = proxy({
  // ui
  phase: 'menu' as OnePathPhase,
  mode: 'levels' as OnePathMode,

  // progression
  level: 1, // current level being played
  selectedLevel: 1, // level picker on menu
  bestLevel: 1,
  endlessBest: 0,

  // currency
  gems: 0,
  lastRunGems: 0,

  // cosmetics
  selectedSkin: 'black',
  // A plain array is easier to persist and valtio reliably reacts to mutations.
  unlockedSkins: ['black'] as string[],

  skins: DEFAULT_SKINS,

  // --- persistence ---
  load: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as Partial<SaveData>

      if (typeof data.bestLevel === 'number') onePathState.bestLevel = Math.max(1, Math.floor(data.bestLevel))
      if (typeof data.level === 'number') onePathState.level = Math.max(1, Math.floor(data.level))
      if (typeof data.selectedLevel === 'number') onePathState.selectedLevel = Math.max(1, Math.floor(data.selectedLevel))
      if (typeof data.gems === 'number') onePathState.gems = Math.max(0, Math.floor(data.gems))
      if (typeof data.endlessBest === 'number') onePathState.endlessBest = Math.max(0, Math.floor(data.endlessBest))
      if (typeof data.selectedSkin === 'string') onePathState.selectedSkin = data.selectedSkin
      if (Array.isArray(data.unlockedSkins)) {
        const cleaned = Array.from(new Set(data.unlockedSkins.map((s) => String(s)))).filter(Boolean)
        onePathState.unlockedSkins = cleaned
      }
      if (!onePathState.unlockedSkins.includes('black')) onePathState.unlockedSkins = ['black', ...onePathState.unlockedSkins]
    } catch {
      // ignore
    }
  },

  save: () => {
    try {
      const data: SaveData = {
        bestLevel: onePathState.bestLevel,
        level: onePathState.level,
        selectedLevel: onePathState.selectedLevel,
        gems: onePathState.gems,
        endlessBest: onePathState.endlessBest,
        selectedSkin: onePathState.selectedSkin,
        unlockedSkins: [...onePathState.unlockedSkins],
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      // ignore
    }
  },

  // --- navigation ---
  goMenu: () => {
    onePathState.phase = 'menu'
    onePathState.save()
  },

  openShop: () => {
    onePathState.phase = 'shop'
  },

  closeShop: () => {
    onePathState.phase = 'menu'
  },

  setMode: (mode: OnePathMode) => {
    onePathState.mode = mode
  },

  selectLevel: (n: number) => {
    const lvl = Math.max(1, Math.floor(n))
    onePathState.selectedLevel = lvl
  },

  // --- game flow ---
  start: () => {
    onePathState.mode = 'levels'
    onePathState.level = onePathState.selectedLevel
    onePathState.phase = 'playing'
  },

  startEndless: () => {
    onePathState.mode = 'endless'
    onePathState.level = 1
    onePathState.phase = 'playing'
  },

  retry: () => {
    onePathState.phase = 'playing'
  },

  fail: () => {
    onePathState.phase = 'gameover'
    onePathState.save()
  },

  clear: (gemsCollected: number) => {
    onePathState.phase = 'cleared'
    onePathState.lastRunGems = gemsCollected
    onePathState.gems += gemsCollected

    if (onePathState.mode === 'levels') {
      onePathState.bestLevel = Math.max(onePathState.bestLevel, onePathState.level)
    } else {
      onePathState.endlessBest = Math.max(onePathState.endlessBest, onePathState.level)
    }

    onePathState.save()
  },

  next: () => {
    if (onePathState.mode === 'levels') {
      onePathState.level += 1
      onePathState.selectedLevel = onePathState.level
      onePathState.bestLevel = Math.max(onePathState.bestLevel, onePathState.level)
    } else {
      onePathState.level += 1
      onePathState.endlessBest = Math.max(onePathState.endlessBest, onePathState.level)
    }
    onePathState.phase = 'playing'
    onePathState.save()
  },

  awardGems: (n: number) => {
    onePathState.gems += Math.max(0, Math.floor(n))
    onePathState.save()
  },

  // --- cosmetics ---
  canAfford: (skinId: string) => {
    const s = DEFAULT_SKINS.find((x) => x.id === skinId)
    if (!s) return false
    if (onePathState.unlockedSkins.includes(skinId)) return true
    return onePathState.gems >= s.cost
  },

  unlockSkin: (skinId: string) => {
    const s = DEFAULT_SKINS.find((x) => x.id === skinId)
    if (!s) return
    if (onePathState.unlockedSkins.includes(skinId)) return
    if (onePathState.gems < s.cost) return
    onePathState.gems -= s.cost
    onePathState.unlockedSkins = [...onePathState.unlockedSkins, skinId]
    onePathState.selectedSkin = skinId
    onePathState.save()
  },

  selectSkin: (skinId: string) => {
    if (!onePathState.unlockedSkins.includes(skinId)) return
    onePathState.selectedSkin = skinId
    onePathState.save()
  },

  // --- level generator ---
  // Deterministic: calling buildLevel(N) always returns the same layout for that level.
  buildLevel: (level: number, mode: OnePathMode = 'levels'): OnePathLevel => {
    const lvl = Math.max(1, Math.floor(level))
    const seed = mode === 'levels' ? lvl * 99991 : (Date.now() >>> 0)
    const rnd = mulberry32(seed)

    // How many turns are required? Higher levels require more.
    const segments = clamp(3 + Math.floor(lvl * 1.15), 3, 22)

    // Shorter distance between "walls" => tougher timing.
    const baseLen = clamp(2.35 - lvl * 0.045, 1.05, 2.35)
    const lenJitter = 0.55

    // Speed ramps with level, but keep it readable.
    const speed = 2.15 + Math.min(1.55, lvl * 0.07)

    // Turn window shrinks slightly with level.
    const turnRadius = clamp(0.26 - lvl * 0.0035, 0.17, 0.26)
    const snapRadius = turnRadius * 1.4

    // Geometry tuning (used by renderer)
    const bridgeWidth = 0.92
    const baseHeight = 0.88
    const deckHeight = 0.14

    // Generate a clean path with guaranteed perpendicular segments.
    // Each segment alternates between horizontal (x-axis) and vertical (z-axis) movement
    // to ensure proper perpendicular connections.
    type Pt = { x: number; z: number }
    const pts: Pt[] = [{ x: 0, z: 0 }]

    const maxSpan = 4.1
    let x = 0
    let z = 0
    // Start with z-axis (forward/backward) to ensure first segment is visible
    let isHorizontal = false // false = z-axis (vertical in world), true = x-axis (horizontal in world)

    for (let i = 0; i < segments; i++) {
      // ALTERNATE between horizontal and vertical to ensure perpendicular paths
      isHorizontal = !isHorizontal

      const L = baseLen * (1 - lenJitter * 0.5 + rnd() * lenJitter)
      const step = Math.round(L * 1000) / 1000

      if (isHorizontal) {
        // Move along X-axis (left/right) - perpendicular to previous segment
        const dir = rnd() < 0.5 ? -1 : 1
        const nx = x + step * dir
        if (Math.abs(nx) > maxSpan) x -= step * dir
        else x = nx
      } else {
        // Move along Z-axis (forward/backward) - perpendicular to previous segment
        // Mostly forward, occasional back-step to create challenge
        const dir = rnd() < 0.88 ? 1 : -1
        z += step * dir
      }

      pts.push({ x, z })
    }

    // Normalize so the start is near the camera and the course is mostly in front.
    const minZ = Math.min(...pts.map((p) => p.z))
    const shiftZ = minZ < -0.5 ? -minZ + 0.2 : 0
    for (const p of pts) p.z += shiftZ

    // Nodes + edges
    const nodes: OnePathNode[] = pts.map((p, i) => {
      const maxHp = clamp(14 - Math.floor(lvl / 5), 8, 14)
      return {
        id: `n_${lvl}_${i}`,
        x: p.x,
        z: p.z,
        maxHp,
        hp: maxHp,
        broken: false,
      }
    })

    const edges: OnePathEdge[] = []
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ id: `e_${lvl}_${i}`, a: i, b: i + 1 })
    }

    // Gems: placed along some bridges, deterministic.
    const gems: OnePathGem[] = []
    const gemCount = clamp(1 + Math.floor(lvl / 2), 1, 7)
    const usedEdge = new Set<number>()
    for (let i = 0; i < gemCount; i++) {
      let e = Math.floor(rnd() * edges.length)
      let attempts = 0
      while (usedEdge.has(e) && attempts++ < 10) e = Math.floor(rnd() * edges.length)
      usedEdge.add(e)

      const a = nodes[edges[e].a]
      const b = nodes[edges[e].b]
      const t = 0.25 + rnd() * 0.5
      const gx = a.x + (b.x - a.x) * t
      const gz = a.z + (b.z - a.z) * t

      gems.push({ id: `g_${lvl}_${i}`, x: gx, z: gz, collected: false })
    }

    const path = nodes.map((_, i) => i)

    return {
      id: `${mode}_lvl_${lvl}`,
      level: lvl,
      mode,
      path,
      nodes,
      edges,
      gems,
      speed,
      turnRadius,
      snapRadius,
      bridgeWidth,
      baseHeight,
      deckHeight,
    }
  },
})

function mulberry32(seed: number) {
  let t = seed >>> 0
  return function () {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
