import { proxy } from 'valtio';

import { CONST } from './constants';
import { clamp, hash32, mulberry32, randInt, randRange } from './helpers';

export type OnePathPhase = 'menu' | 'playing' | 'cleared' | 'gameover' | 'shop';
export type OnePathMode = 'levels' | 'endless';
export type OnePathAxis = 'x' | 'z';

export type OnePathWall = {
  id: string;
  maxHp: number;
  hp: number;
  broken: boolean;
  unbreakable?: boolean;
};

export type OnePathGate = {
  offset: number;
  triggerStart: number;
  triggerEnd: number;
  requiredBounces: number;
  isOpen: boolean;
};

export type OnePathGem = {
  id: string;
  s: number;
  l: number;
  collected: boolean;
};

export type OnePathSegment = {
  id: string;
  axis: OnePathAxis;
  dir: -1 | 1;
  x: number;
  z: number;
  length: number;
  halfWidth: number;
  gate: OnePathGate | null;
  walls: { neg: OnePathWall; pos: OnePathWall };
  gems: OnePathGem[];
};

export type OnePathLevel = {
  id: string;
  level: number;
  mode: OnePathMode;
  seed: number;
  segments: OnePathSegment[];
  exit: { x: number; z: number; segIndex: number };

  // simulation tuning
  speed: number;
  lateralSpeed: number;
  tolerance: number;
  perfectTol: number;
  bridgeWidth: number;
  baseHeight: number;
  deckHeight: number;
  fallMargin: number;
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

type DifficultyProfile = {
  widthMin: number;
  widthMax: number;
  lengthMin: number;
  lengthMax: number;
  speed: number;
  lateralSpeed: number;
  triggerWindowMin: number;
  triggerWindowMax: number;
  trapChance: number;
  reqMin: number;
  reqMax: number;
  breakChance: number;
  breakMin: number;
  breakMax: number;
  gemChance: number;
};

const SAVE_KEY = 'oscillate_save_v2';

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

function getDifficulty(level: number, mode: OnePathMode): DifficultyProfile {
  const l = mode === 'endless' ? level + 10 : level;
  if (l <= 20) {
    return {
      widthMin: 2.2,
      widthMax: 2.8,
      lengthMin: 3.6,
      lengthMax: 4.9,
      speed: 3.6,
      lateralSpeed: 4.6,
      triggerWindowMin: 0.55,
      triggerWindowMax: 0.8,
      trapChance: 0.15,
      reqMin: 1,
      reqMax: 3,
      breakChance: 0.08,
      breakMin: 8,
      breakMax: 11,
      gemChance: 0.48,
    };
  }
  if (l <= 60) {
    return {
      widthMin: 1.8,
      widthMax: 2.2,
      lengthMin: 3.2,
      lengthMax: 4.5,
      speed: 4.5,
      lateralSpeed: 5.6,
      triggerWindowMin: 0.45,
      triggerWindowMax: 0.68,
      trapChance: 0.34,
      reqMin: 2,
      reqMax: 6,
      breakChance: 0.2,
      breakMin: 7,
      breakMax: 10,
      gemChance: 0.42,
    };
  }
  if (l <= 140) {
    return {
      widthMin: 1.4,
      widthMax: 1.8,
      lengthMin: 2.8,
      lengthMax: 4.1,
      speed: 5.3,
      lateralSpeed: 6.8,
      triggerWindowMin: 0.36,
      triggerWindowMax: 0.56,
      trapChance: 0.56,
      reqMin: 4,
      reqMax: 10,
      breakChance: 0.35,
      breakMin: 6,
      breakMax: 9,
      gemChance: 0.36,
    };
  }
  return {
    widthMin: 1.1,
    widthMax: 1.5,
    lengthMin: 2.5,
    lengthMax: 3.8,
    speed: 6.4,
    lateralSpeed: 7.8,
    triggerWindowMin: 0.3,
    triggerWindowMax: 0.5,
    trapChance: 0.7,
    reqMin: 6,
    reqMax: 14,
    breakChance: 0.44,
    breakMin: 5,
    breakMax: 8,
    gemChance: 0.3,
  };
}

function pointOnSegment(seg: OnePathSegment, s: number, l: number) {
  if (seg.axis === 'x') {
    return { x: seg.x + seg.dir * s, z: seg.z + l };
  }
  return { x: seg.x + l, z: seg.z + seg.dir * s };
}

function pickDirection(
  axis: OnePathAxis,
  cursor: { x: number; z: number },
  rand: () => number
): -1 | 1 {
  const limit = CONST.WORLD_LIMIT * 0.66;
  if (axis === 'x') {
    if (cursor.x > limit) return -1;
    if (cursor.x < -limit) return 1;
  } else {
    if (cursor.z > limit) return -1;
    if (cursor.z < -limit) return 1;
  }
  return rand() < 0.5 ? -1 : 1;
}

function estimateMaxBouncesToTrigger(
  triggerEnd: number,
  halfWidth: number,
  speed: number,
  lateralSpeed: number
) {
  const time = Math.max(0, triggerEnd) / Math.max(0.0001, speed);
  return Math.max(
    1,
    Math.floor((time * lateralSpeed) / Math.max(0.0001, halfWidth * 2)) + 1
  );
}

function buildWalls(
  level: number,
  segIndex: number,
  rand: () => number,
  diff: DifficultyProfile
) {
  const base: OnePathWall = {
    id: `w_${level}_${segIndex}`,
    maxHp: CONST.DEFAULT_BREAK_HP,
    hp: CONST.DEFAULT_BREAK_HP,
    broken: false,
    unbreakable: true,
  };

  const neg: OnePathWall = { ...base, id: `${base.id}_n` };
  const pos: OnePathWall = { ...base, id: `${base.id}_p` };

  if (segIndex === 0) {
    return { neg, pos };
  }

  if (rand() > diff.breakChance) {
    return { neg, pos };
  }

  const hp = randInt(rand, diff.breakMin, diff.breakMax);
  const pattern = rand();
  const breakNeg = pattern < 0.75;
  const breakPos = pattern > 0.25;

  if (breakNeg) {
    neg.maxHp = hp;
    neg.hp = hp;
    neg.unbreakable = false;
  }
  if (breakPos) {
    pos.maxHp = hp;
    pos.hp = hp;
    pos.unbreakable = false;
  }

  return { neg, pos };
}

export const onePathState = proxy({
  phase: 'menu' as OnePathPhase,
  mode: 'levels' as OnePathMode,

  level: 1,
  selectedLevel: 1,
  bestLevel: 1,
  endlessBest: 0,
  endlessSeed: 1,

  gems: 0,
  lastRunGems: 0,

  selectedSkin: 'black',
  unlockedSkins: ['black'] as string[],
  skins: DEFAULT_SKINS,

  load: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<SaveData>;

      if (typeof data.bestLevel === 'number') {
        onePathState.bestLevel = Math.max(1, Math.floor(data.bestLevel));
      }
      if (typeof data.level === 'number') {
        onePathState.level = Math.max(1, Math.floor(data.level));
      }
      if (typeof data.selectedLevel === 'number') {
        onePathState.selectedLevel = Math.max(1, Math.floor(data.selectedLevel));
      }
      if (typeof data.gems === 'number') {
        onePathState.gems = Math.max(0, Math.floor(data.gems));
      }
      if (typeof data.endlessBest === 'number') {
        onePathState.endlessBest = Math.max(0, Math.floor(data.endlessBest));
      }
      if (typeof data.selectedSkin === 'string') {
        onePathState.selectedSkin = data.selectedSkin;
      }
      if (Array.isArray(data.unlockedSkins)) {
        const cleaned = Array.from(
          new Set(data.unlockedSkins.map((s) => String(s)))
        ).filter(Boolean);
        onePathState.unlockedSkins = cleaned;
      }
      if (!onePathState.unlockedSkins.includes('black')) {
        onePathState.unlockedSkins = ['black', ...onePathState.unlockedSkins];
      }
    } catch {
      // no-op
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
      // no-op
    }
  },

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
    onePathState.selectedLevel = Math.max(1, Math.floor(n));
  },

  start: () => {
    onePathState.mode = 'levels';
    onePathState.level = onePathState.selectedLevel;
    onePathState.phase = 'playing';
  },

  startEndless: () => {
    onePathState.mode = 'endless';
    onePathState.level = 1;
    onePathState.endlessSeed = hash32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
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
      onePathState.bestLevel = Math.max(onePathState.bestLevel, onePathState.level);
    } else {
      onePathState.endlessBest = Math.max(onePathState.endlessBest, onePathState.level);
    }

    onePathState.save();
  },

  advanceEndless: (gemsCollected: number) => {
    if (onePathState.mode !== 'endless') return;
    onePathState.lastRunGems = gemsCollected;
    onePathState.gems += gemsCollected;
    onePathState.level += 1;
    onePathState.endlessBest = Math.max(onePathState.endlessBest, onePathState.level);
    onePathState.phase = 'playing';
    onePathState.save();
  },

  next: () => {
    if (onePathState.mode === 'levels') {
      onePathState.level += 1;
      onePathState.selectedLevel = onePathState.level;
      onePathState.bestLevel = Math.max(onePathState.bestLevel, onePathState.level);
    } else {
      onePathState.level += 1;
      onePathState.endlessBest = Math.max(onePathState.endlessBest, onePathState.level);
    }
    onePathState.phase = 'playing';
    onePathState.save();
  },

  awardGems: (n: number) => {
    onePathState.gems += Math.max(0, Math.floor(n));
    onePathState.save();
  },

  canAfford: (skinId: string) => {
    const skin = DEFAULT_SKINS.find((s) => s.id === skinId);
    if (!skin) return false;
    if (onePathState.unlockedSkins.includes(skinId)) return true;
    return onePathState.gems >= skin.cost;
  },

  unlockSkin: (skinId: string) => {
    const skin = DEFAULT_SKINS.find((s) => s.id === skinId);
    if (!skin) return;
    if (onePathState.unlockedSkins.includes(skinId)) return;
    if (onePathState.gems < skin.cost) return;
    onePathState.gems -= skin.cost;
    onePathState.unlockedSkins = [...onePathState.unlockedSkins, skinId];
    onePathState.selectedSkin = skinId;
    onePathState.save();
  },

  selectSkin: (skinId: string) => {
    if (!onePathState.unlockedSkins.includes(skinId)) return;
    onePathState.selectedSkin = skinId;
    onePathState.save();
  },

  // Deterministic level generator.
  buildLevel: (level: number, mode: OnePathMode = 'levels'): OnePathLevel => {
    const lvl = Math.max(1, Math.floor(level));
    const diff = getDifficulty(lvl, mode);

    const seed =
      mode === 'levels'
        ? hash32(lvl * 0x9e3779b1)
        : hash32(onePathState.endlessSeed ^ Math.imul(lvl, 0x85ebca6b));
    const rand = mulberry32(seed);

    const segmentCount =
      mode === 'levels'
        ? clamp(7 + Math.floor(lvl * 0.42), 7, 24)
        : clamp(9 + Math.floor(lvl * 0.48), 9, 30);

    const segments: OnePathSegment[] = [];
    let cursor = { x: 0, z: 0 };

    for (let i = 0; i < segmentCount; i += 1) {
      const axis: OnePathAxis = i % 2 === 0 ? 'z' : 'x';
      const dir = pickDirection(axis, cursor, rand);
      const length = randRange(rand, diff.lengthMin, diff.lengthMax);
      const width = randRange(rand, diff.widthMin, diff.widthMax);
      const halfWidth = width * 0.5;

      const gateMargin = Math.min(0.35, halfWidth * 0.38);
      const isLast = i === segmentCount - 1;
      const bridgeOffset = isLast
        ? 0
        : randRange(rand, -halfWidth + gateMargin, halfWidth - gateMargin);

      const triggerWindow = randRange(
        rand,
        diff.triggerWindowMin,
        diff.triggerWindowMax
      );
      const triggerEnd = length - 0.06;
      const triggerStart = Math.max(length * 0.56, triggerEnd - triggerWindow);

      const maxHits = estimateMaxBouncesToTrigger(
        triggerEnd,
        halfWidth,
        diff.speed,
        diff.lateralSpeed
      );
      let requiredBounces = 0;
      if (!isLast && rand() < diff.trapChance && maxHits > 1) {
        const minReq = Math.min(maxHits - 1, diff.reqMin);
        const maxReq = Math.max(minReq, Math.min(maxHits - 1, diff.reqMax));
        requiredBounces = randInt(rand, minReq, maxReq);
      }

      const walls = buildWalls(lvl, i, rand, diff);

      const gems: OnePathGem[] = [];
      if (!isLast && rand() < diff.gemChance) {
        const gemsOnSeg = rand() < 0.18 ? 2 : 1;
        for (let g = 0; g < gemsOnSeg; g += 1) {
          gems.push({
            id: `g_${lvl}_${i}_${g}`,
            s: randRange(rand, Math.max(0.25, length * 0.22), length - 0.2),
            l: randRange(rand, -halfWidth * 0.72, halfWidth * 0.72),
            collected: false,
          });
        }
      }

      segments.push({
        id: `s_${lvl}_${i}`,
        axis,
        dir,
        x: cursor.x,
        z: cursor.z,
        length,
        halfWidth,
        gate: isLast
          ? null
          : {
              offset: bridgeOffset,
              triggerStart,
              triggerEnd,
              requiredBounces,
              isOpen: requiredBounces <= 0,
            },
        walls,
        gems,
      });

      if (!isLast) {
        const nextOrigin = pointOnSegment(segments[i], length, bridgeOffset);
        cursor = { x: nextOrigin.x, z: nextOrigin.z };
      }
    }

    const finalSeg = segments[segments.length - 1];
    const exitPoint = finalSeg
      ? pointOnSegment(finalSeg, finalSeg.length, 0)
      : { x: 0, z: 0 };

    const tolBase = diff.widthMin * 0.12;
    const frameSafety = diff.speed * CONST.FIXED_DT * 1.25;
    const tolerance = Math.max(tolBase, frameSafety);
    const perfectTol = tolerance * 0.45;

    return {
      id: `${mode}_lvl_${lvl}`,
      level: lvl,
      mode,
      seed,
      segments,
      exit: {
        x: exitPoint.x,
        z: exitPoint.z,
        segIndex: Math.max(0, segments.length - 1),
      },
      speed: diff.speed,
      lateralSpeed: diff.lateralSpeed,
      tolerance,
      perfectTol,
      bridgeWidth: clamp(diff.widthMin * 0.72, 0.62, 1.18),
      baseHeight: CONST.BASE_H,
      deckHeight: CONST.DECK_H,
      fallMargin: CONST.FALL_MARGIN,
    };
  },
});
