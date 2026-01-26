import { proxy } from 'valtio';

export type OnePathPhase = 'menu' | 'playing' | 'cleared' | 'gameover' | 'shop';
export type OnePathMode = 'levels' | 'endless';

export type OnePathWall = {
  id: string;
  maxHp: number;
  hp: number;
  broken: boolean;
  unbreakable?: boolean;
};

export type OnePathSegment = {
  id: string;
  origin: { x: number; z: number };
  dir: { x: number; z: number };
  lenNeg: number;
  lenPos: number;
  exit: number | null;
  walls: { neg: OnePathWall; pos: OnePathWall };
};

export type OnePathGem = {
  id: string;
  x: number;
  z: number;
  collected: boolean;
};

export type OnePathLevel = {
  id: string;
  level: number;
  mode: OnePathMode;

  // A deterministic "course" represented as a chain of oscillation segments.
  // The ball oscillates between two walls on the current segment and can turn
  // at a perpendicular intersection placed between those walls.
  segments: OnePathSegment[];
  gems: OnePathGem[];
  goal: { segIndex: number; offset: number };

  // gameplay tuning
  speed: number;
  turnRadius: number;
  snapRadius: number;
  bridgeWidth: number;
  baseHeight: number;
  deckHeight: number;
};

export type OnePathSkin = {
  id: string;
  name: string;
  cost: number;
  color: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
};

type SaveData = {
  bestLevel: number;
  level: number;
  selectedLevel: number;
  gems: number;
  selectedSkin: string;
  unlockedSkins: string[];
  endlessBest: number;
};

const SAVE_KEY = 'oscillate_save_v1';

const DEFAULT_SKINS: OnePathSkin[] = [
  {
    id: 'black',
    name: 'Classic',
    cost: 0,
    color: '#1a1a1a',
    roughness: 0.32,
    metalness: 0.18,
  },
  {
    id: 'pearl',
    name: 'Pearl',
    cost: 40,
    color: '#f5f5f5',
    roughness: 0.22,
    metalness: 0.08,
    emissive: '#ffffff',
    emissiveIntensity: 0.08,
  },
  {
    id: 'mint',
    name: 'Mint',
    cost: 70,
    color: '#7ef7d6',
    roughness: 0.28,
    metalness: 0.12,
    emissive: '#2ad8ff',
    emissiveIntensity: 0.15,
  },
  {
    id: 'sun',
    name: 'Sun',
    cost: 90,
    color: '#ffd35a',
    roughness: 0.2,
    metalness: 0.18,
    emissive: '#ffcc3a',
    emissiveIntensity: 0.16,
  },
  {
    id: 'nebula',
    name: 'Nebula',
    cost: 120,
    color: '#7b61ff',
    roughness: 0.35,
    metalness: 0.22,
    emissive: '#6b4cff',
    emissiveIntensity: 0.22,
  },
  {
    id: 'ruby',
    name: 'Ruby',
    cost: 160,
    color: '#ff4d6d',
    roughness: 0.26,
    metalness: 0.16,
    emissive: '#ff4d6d',
    emissiveIntensity: 0.18,
  },
  {
    id: 'chrome',
    name: 'Chrome',
    cost: 220,
    color: '#c8c8c8',
    roughness: 0.08,
    metalness: 0.85,
  },
];

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
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
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<SaveData>;

      if (typeof data.bestLevel === 'number')
        onePathState.bestLevel = Math.max(1, Math.floor(data.bestLevel));
      if (typeof data.level === 'number')
        onePathState.level = Math.max(1, Math.floor(data.level));
      if (typeof data.selectedLevel === 'number')
        onePathState.selectedLevel = Math.max(
          1,
          Math.floor(data.selectedLevel)
        );
      if (typeof data.gems === 'number')
        onePathState.gems = Math.max(0, Math.floor(data.gems));
      if (typeof data.endlessBest === 'number')
        onePathState.endlessBest = Math.max(0, Math.floor(data.endlessBest));
      if (typeof data.selectedSkin === 'string')
        onePathState.selectedSkin = data.selectedSkin;
      if (Array.isArray(data.unlockedSkins)) {
        const cleaned = Array.from(
          new Set(data.unlockedSkins.map((s) => String(s)))
        ).filter(Boolean);
        onePathState.unlockedSkins = cleaned;
      }
      if (!onePathState.unlockedSkins.includes('black'))
        onePathState.unlockedSkins = ['black', ...onePathState.unlockedSkins];
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
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  },

  // --- navigation ---
  goMenu: () => {
    onePathState.phase = 'menu';
    onePathState.save();
  },

  openShop: () => {
    onePathState.phase = 'shop';
  },

  closeShop: () => {
    onePathState.phase = 'menu';
  },

  setMode: (mode: OnePathMode) => {
    onePathState.mode = mode;
  },

  selectLevel: (n: number) => {
    const lvl = Math.max(1, Math.floor(n));
    onePathState.selectedLevel = lvl;
  },

  // --- game flow ---
  start: () => {
    onePathState.mode = 'levels';
    onePathState.level = onePathState.selectedLevel;
    onePathState.phase = 'playing';
  },

  startEndless: () => {
    onePathState.mode = 'endless';
    onePathState.level = 1;
    onePathState.phase = 'playing';
  },

  retry: () => {
    onePathState.phase = 'playing';
  },

  fail: () => {
    onePathState.phase = 'gameover';
    onePathState.save();
  },

  clear: (gemsCollected: number) => {
    onePathState.phase = 'cleared';
    onePathState.lastRunGems = gemsCollected;
    onePathState.gems += gemsCollected;

    if (onePathState.mode === 'levels') {
      onePathState.bestLevel = Math.max(
        onePathState.bestLevel,
        onePathState.level
      );
    } else {
      onePathState.endlessBest = Math.max(
        onePathState.endlessBest,
        onePathState.level
      );
    }

    onePathState.save();
  },

  next: () => {
    if (onePathState.mode === 'levels') {
      onePathState.level += 1;
      onePathState.selectedLevel = onePathState.level;
      onePathState.bestLevel = Math.max(
        onePathState.bestLevel,
        onePathState.level
      );
    } else {
      onePathState.level += 1;
      onePathState.endlessBest = Math.max(
        onePathState.endlessBest,
        onePathState.level
      );
    }
    onePathState.phase = 'playing';
    onePathState.save();
  },

  awardGems: (n: number) => {
    onePathState.gems += Math.max(0, Math.floor(n));
    onePathState.save();
  },

  // --- cosmetics ---
  canAfford: (skinId: string) => {
    const s = DEFAULT_SKINS.find((x) => x.id === skinId);
    if (!s) return false;
    if (onePathState.unlockedSkins.includes(skinId)) return true;
    return onePathState.gems >= s.cost;
  },

  unlockSkin: (skinId: string) => {
    const s = DEFAULT_SKINS.find((x) => x.id === skinId);
    if (!s) return;
    if (onePathState.unlockedSkins.includes(skinId)) return;
    if (onePathState.gems < s.cost) return;
    onePathState.gems -= s.cost;
    onePathState.unlockedSkins = [...onePathState.unlockedSkins, skinId];
    onePathState.selectedSkin = skinId;
    onePathState.save();
  },

  selectSkin: (skinId: string) => {
    if (!onePathState.unlockedSkins.includes(skinId)) return;
    onePathState.selectedSkin = skinId;
    onePathState.save();
  },

  // --- level generator ---
  // Deterministic: calling buildLevel(N) always returns the same layout for that level.
  buildLevel: (level: number, mode: OnePathMode = 'levels'): OnePathLevel => {
    const lvl = Math.max(1, Math.floor(level));
    const seed = mode === 'levels' ? lvl * 99991 : Date.now() >>> 0;
    const rnd = mulberry32(seed);

    // How many turns are required? Higher levels require more.
    const segments = clamp(3 + Math.floor(lvl * 1.15), 3, 22);

    // Shorter distance between "walls" => tougher timing.
    const baseLen = clamp(2.35 - lvl * 0.045, 1.05, 2.35);
    const lenJitter = 0.55;

    // Speed ramps with level, but keep it readable.
    const speed = 2.15 + Math.min(1.55, lvl * 0.07);

    // Turn window shrinks slightly with level.
    const turnRadius = clamp(0.26 - lvl * 0.0035, 0.17, 0.26);
    const snapRadius = turnRadius * 1.4;

    // Geometry tuning (used by renderer)
    const playerWidth = 0.26;
    const bridgeWidth = Math.min(0.9, playerWidth * 3);
    const baseHeight = 0.88;
    const deckHeight = 0.14;

    type Axis = 'x' | 'z';
    const maxSpan = 4.2;
    const minCoord = -maxSpan;
    const maxCoord = maxSpan;
    const minSide = clamp(baseLen * 0.45, 0.5, 0.95);
    const exitMargin = clamp(turnRadius * 2.35, 0.24, 0.6);
    const wallHits = 8;

    const eps = 1e-4;
    const segmentsOut: OnePathSegment[] = [];
    let origin = { x: 0, z: 0 };

    const getSegGeom = (seg: OnePathSegment) => {
      const x1 = seg.origin.x - seg.dir.x * seg.lenNeg;
      const z1 = seg.origin.z - seg.dir.z * seg.lenNeg;
      const x2 = seg.origin.x + seg.dir.x * seg.lenPos;
      const z2 = seg.origin.z + seg.dir.z * seg.lenPos;
      const axis: Axis = Math.abs(seg.dir.x) > 0.5 ? 'x' : 'z';
      return {
        axis,
        x1,
        z1,
        x2,
        z2,
        minX: Math.min(x1, x2),
        maxX: Math.max(x1, x2),
        minZ: Math.min(z1, z2),
        maxZ: Math.max(z1, z2),
      };
    };

    const intersectSegs = (
      a: ReturnType<typeof getSegGeom>,
      b: ReturnType<typeof getSegGeom>
    ) => {
      if (a.axis === b.axis) {
        if (a.axis === 'x') {
          if (Math.abs(a.z1 - b.z1) > eps) return null;
          if (a.maxX < b.minX - eps || b.maxX < a.minX - eps) return null;
          return { x: Math.max(a.minX, b.minX), z: a.z1 };
        }
        if (Math.abs(a.x1 - b.x1) > eps) return null;
        if (a.maxZ < b.minZ - eps || b.maxZ < a.minZ - eps) return null;
        return { x: a.x1, z: Math.max(a.minZ, b.minZ) };
      }

      const h = a.axis === 'x' ? a : b;
      const v = a.axis === 'x' ? b : a;
      const ix = v.x1;
      const iz = h.z1;
      if (ix < h.minX - eps || ix > h.maxX + eps) return null;
      if (iz < v.minZ - eps || iz > v.maxZ + eps) return null;
      return { x: ix, z: iz };
    };

    const isCandidateValid = (
      candidate: OnePathSegment,
      currentOrigin: { x: number; z: number }
    ) => {
      const candGeom = getSegGeom(candidate);
      for (let i = 0; i < segmentsOut.length; i++) {
        const other = segmentsOut[i];
        const otherGeom = getSegGeom(other);
        const inter = intersectSegs(candGeom, otherGeom);
        if (!inter) continue;
        const isPrev = i === segmentsOut.length - 1;
        const dist = Math.hypot(
          inter.x - currentOrigin.x,
          inter.z - currentOrigin.z
        );
        if (isPrev && dist <= eps * 10) continue;
        return false;
      }
      return true;
    };

    const getSpace = (
      axis: Axis,
      dir: { x: number; z: number },
      o: { x: number; z: number }
    ) => {
      if (axis === 'x') {
        if (dir.x > 0) {
          return { pos: maxCoord - o.x, neg: o.x - minCoord };
        }
        return { pos: o.x - minCoord, neg: maxCoord - o.x };
      }
      if (dir.z > 0) {
        return { pos: maxCoord - o.z, neg: o.z - minCoord };
      }
      return { pos: o.z - minCoord, neg: maxCoord - o.z };
    };

    const pickDir = (axis: Axis, o: { x: number; z: number }) => {
      let sign = axis === 'z' ? (rnd() < 0.78 ? 1 : -1) : rnd() < 0.5 ? 1 : -1;
      let dir = axis === 'x' ? { x: sign, z: 0 } : { x: 0, z: sign };
      const space = getSpace(axis, dir, o);
      if (space.pos < minSide * 1.2) {
        sign *= -1;
        dir = axis === 'x' ? { x: sign, z: 0 } : { x: 0, z: sign };
      }
      return dir;
    };

    for (let i = 0; i < segments; i++) {
      const axis: Axis = i % 2 === 0 ? 'z' : 'x';
      const isFirst = i === 0;
      const isLast = i === segments - 1;
      const maxHp = wallHits;
      const wallBase = {
        maxHp,
        hp: maxHp,
        broken: false,
        unbreakable: isFirst,
      };

      let built: OnePathSegment | null = null;
      for (let attempt = 0; attempt < 24; attempt++) {
        const dir = pickDir(axis, origin);
        const { pos: maxPos, neg: maxNeg } = getSpace(axis, dir, origin);

        const targetLen = baseLen * (1 - lenJitter * 0.5 + rnd() * lenJitter);
        const capPos = Math.max(0.2, maxPos - 0.1);
        const capNeg = Math.max(0.2, maxNeg - 0.1);
        const minWall = Math.min(minSide, capPos, capNeg);
        const total = clamp(targetLen, minWall * 2, capPos + capNeg);
        const bias = 0.35 + rnd() * 0.3;

        let lenPos = clamp(total * bias, minWall, capPos);
        let lenNeg = clamp(total - lenPos, minWall, capNeg);

        const used = lenPos + lenNeg;
        if (used < total) {
          const remaining = total - used;
          const addPos = Math.min(
            remaining,
            Math.max(0, maxPos - 0.1 - lenPos)
          );
          lenPos += addPos;
          lenNeg += Math.min(
            remaining - addPos,
            Math.max(0, maxNeg - 0.1 - lenNeg)
          );
        }

        let exit: number | null = null;
        if (!isLast) {
          const exitMin = -lenNeg + exitMargin;
          const exitMax = lenPos - exitMargin;
          exit = exitMax > exitMin ? exitMin + rnd() * (exitMax - exitMin) : 0;
        }

        const candidate: OnePathSegment = {
          id: `s_${lvl}_${i}`,
          origin: { x: origin.x, z: origin.z },
          dir: { x: dir.x, z: dir.z },
          lenNeg,
          lenPos,
          exit,
          walls: {
            neg: { id: `w_${lvl}_${i}_n`, ...wallBase },
            pos: { id: `w_${lvl}_${i}_p`, ...wallBase },
          },
        };

        if (isCandidateValid(candidate, origin)) {
          built = candidate;
          break;
        }
      }

      if (!built) {
        const dir = pickDir(axis, origin);
        const minWall = Math.min(minSide, 0.45);
        const lenPos = minWall;
        const lenNeg = minWall;
        let exit: number | null = null;
        if (!isLast) {
          const exitMin = -lenNeg + exitMargin;
          const exitMax = lenPos - exitMargin;
          exit = exitMax > exitMin ? exitMin + rnd() * (exitMax - exitMin) : 0;
        }
        built = {
          id: `s_${lvl}_${i}`,
          origin: { x: origin.x, z: origin.z },
          dir: { x: dir.x, z: dir.z },
          lenNeg,
          lenPos,
          exit,
          walls: {
            neg: { id: `w_${lvl}_${i}_n`, ...wallBase },
            pos: { id: `w_${lvl}_${i}_p`, ...wallBase },
          },
        };
      }

      segmentsOut.push(built);

      if (!isLast && built.exit !== null) {
        origin = {
          x: origin.x + built.dir.x * built.exit,
          z: origin.z + built.dir.z * built.exit,
        };
      }
    }

    const lastSeg = segmentsOut[segmentsOut.length - 1];
    let goalOffset = 0;
    if (lastSeg) {
      const goalMin = -lastSeg.lenNeg + exitMargin;
      const goalMax = lastSeg.lenPos - exitMargin;
      goalOffset =
        goalMax > goalMin ? goalMin + rnd() * (goalMax - goalMin) : 0;
    }

    // Gems: placed along some bridges, deterministic.
    const gems: OnePathGem[] = [];
    const gemCount = clamp(1 + Math.floor(lvl / 2), 1, 7);
    const usedSeg = new Set<number>();
    for (let i = 0; i < gemCount; i++) {
      let s = Math.floor(rnd() * segmentsOut.length);
      let attempts = 0;
      while (usedSeg.has(s) && attempts++ < 10)
        s = Math.floor(rnd() * segmentsOut.length);
      usedSeg.add(s);

      const seg = segmentsOut[s];
      const gemMargin = Math.max(0.28, turnRadius * 1.7);
      const gMin = -seg.lenNeg + gemMargin;
      const gMax = seg.lenPos - gemMargin;
      const t = gMax > gMin ? gMin + rnd() * (gMax - gMin) : 0;
      const gx = seg.origin.x + seg.dir.x * t;
      const gz = seg.origin.z + seg.dir.z * t;

      gems.push({ id: `g_${lvl}_${i}`, x: gx, z: gz, collected: false });
    }

    return {
      id: `${mode}_lvl_${lvl}`,
      level: lvl,
      mode,
      segments: segmentsOut,
      gems,
      goal: {
        segIndex: Math.max(0, segmentsOut.length - 1),
        offset: goalOffset,
      },
      speed,
      turnRadius,
      snapRadius,
      bridgeWidth,
      baseHeight,
      deckHeight,
    };
  },
});

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
