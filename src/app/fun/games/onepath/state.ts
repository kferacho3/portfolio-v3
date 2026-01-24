import { proxy } from 'valtio'

export type OnePathPhase = 'menu' | 'playing' | 'cleared' | 'gameover'

export type OnePathObstacle = {
  id: string
  z: number
  side: -1 | 1
  hit: boolean
}

export type OnePathGem = {
  id: string
  z: number
  x: number
  spin: number
  collected: boolean
}

export type OnePathLevel = {
  id: string
  level: number
  length: number
  speed: number
  obstacles: OnePathObstacle[]
  gems: OnePathGem[]
}

type SaveData = {
  bestLevel: number
  gems: number
  level: number
}

const SAVE_KEY = 'onepath_save_v1'

export const onePathState = proxy({
  // meta
  phase: 'menu' as OnePathPhase,

  // progression
  level: 1,
  bestLevel: 1,

  // currency
  gems: 0,
  lastRunGems: 0,

  // --- actions ---
  load: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as Partial<SaveData>
      if (typeof data.bestLevel === 'number') onePathState.bestLevel = Math.max(1, Math.floor(data.bestLevel))
      if (typeof data.gems === 'number') onePathState.gems = Math.max(0, Math.floor(data.gems))
      if (typeof data.level === 'number') onePathState.level = Math.max(1, Math.floor(data.level))
    } catch {
      // ignore
    }
  },

  save: () => {
    try {
      const data: SaveData = {
        bestLevel: onePathState.bestLevel,
        gems: onePathState.gems,
        level: onePathState.level,
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      // ignore
    }
  },

  start: () => {
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

    onePathState.bestLevel = Math.max(onePathState.bestLevel, onePathState.level)
    onePathState.save()
  },

  next: () => {
    onePathState.level += 1
    onePathState.bestLevel = Math.max(onePathState.bestLevel, onePathState.level)
    onePathState.phase = 'playing'
    onePathState.save()
  },

  // --- level generator ---
  buildLevel: (level: number): OnePathLevel => {
    const seed = level * 99991
    const rnd = mulberry32(seed)

    // The vibe: short, fast, crisp levels. More level = longer + more "required taps" (obstacles)
    const baseLen = 18
    const length = baseLen + level * 2.6
    const speed = 2.7 + Math.min(1.6, level * 0.07)

    // obstacles: alternate sides to force taps, with occasional doubles
    const obstacleCount = Math.min(18, 4 + Math.floor(level * 1.2))
    const obstacles: OnePathObstacle[] = []
    let side: -1 | 1 = rnd() > 0.5 ? 1 : -1

    for (let i = 0; i < obstacleCount; i++) {
      const z = 2.0 + (i + 1) * (length / (obstacleCount + 1))
      // occasionally keep same side to create "late swap" panic
      if (i > 0 && rnd() < 0.22) {
        // keep side
      } else {
        side = (side === 1 ? -1 : 1) as -1 | 1
      }
      obstacles.push({
        id: `ob_${level}_${i}`,
        z,
        side,
        hit: false,
      })
    }

    // gems: place near some obstacles but not all
    const gems: OnePathGem[] = []
    const gemCount = Math.max(1, Math.min(5, 1 + Math.floor(level / 3)))
    for (let i = 0; i < gemCount; i++) {
      const pick = obstacles[Math.floor(rnd() * obstacles.length)]
      const z = pick ? pick.z + (rnd() - 0.5) * 0.7 : 4 + rnd() * (length - 6)
      const x = (rnd() > 0.5 ? 1 : -1) * (0.2 + rnd() * 0.38)
      gems.push({
        id: `g_${level}_${i}`,
        z,
        x,
        spin: rnd() * Math.PI * 2,
        collected: false,
      })
    }

    return {
      id: `lvl_${level}`,
      level,
      length,
      speed,
      obstacles,
      gems,
    }
  },
})

function mulberry32(seed: number) {
  let t = seed >>> 0
  return function () {
    t += 0x6D2B79F5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
