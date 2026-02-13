import { proxy } from 'valtio';

import { CONST } from './constants';
import { hash32, mulberry32, randInt, randRange } from './helpers';

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
  // Position along the segment's long axis where the perpendicular branch starts.
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

  // Segment start (center of the "near" end wall), world space.
  x: number;
  z: number;

  // Long-axis distance between near and far end walls.
  length: number;

  // Total corridor width (wall-to-wall across narrow dimension).
  corridorWidth: number;
  halfWidth: number;

  // Ball-center oscillation bounds along long axis.
  centerMin: number;
  centerMax: number;

  gate: OnePathGate;
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

  speed: number;
  lateralSpeed: number;
  tolerance: number;
  perfectTol: number;
  bridgeWidth: number;
  baseHeight: number;
  deckHeight: number;
  fallMargin: number;
  noTouchMargin: number;
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
  segmentMin: number;
  segmentMax: number;
  lengthMin: number;
  lengthMax: number;
  speed: number;
  lateralSpeed: number;
  breakThreshold: number;
  trapChance: number;
  reqMin: number;
  reqMax: number;
  widthJitterMin: number;
  widthJitterMax: number;
  gemChance: number;
};

type AABB = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const SAVE_KEY = 'one_path_save_v1';

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

const BALL_DIAMETER = CONST.BALL_R * 2;
const MIN_CORRIDOR_WIDTH = BALL_DIAMETER + CONST.MIN_CLEARANCE;
const BASE_CORRIDOR_WIDTH = Math.max(
  BALL_DIAMETER * CONST.CORRIDOR_MULT,
  MIN_CORRIDOR_WIDTH
);

function getDifficulty(level: number, mode: OnePathMode): DifficultyProfile {
  const l = mode === 'endless' ? level + 12 : level;

  if (l <= 30) {
    return {
      segmentMin: 8,
      segmentMax: 14,
      lengthMin: 2.9,
      lengthMax: 4.3,
      speed: 3.8,
      lateralSpeed: 4.6,
      breakThreshold: 14,
      trapChance: 0.2,
      reqMin: 0,
      reqMax: 3,
      widthJitterMin: 0,
      widthJitterMax: 0.035,
      gemChance: 0.5,
    };
  }

  if (l <= 100) {
    return {
      segmentMin: 10,
      segmentMax: 18,
      lengthMin: 2.7,
      lengthMax: 4.0,
      speed: 4.4,
      lateralSpeed: 5.5,
      breakThreshold: 10,
      trapChance: 0.45,
      reqMin: 2,
      reqMax: 6,
      widthJitterMin: 0,
      widthJitterMax: 0.022,
      gemChance: 0.36,
    };
  }

  return {
    segmentMin: 12,
    segmentMax: 22,
    lengthMin: 2.5,
    lengthMax: 3.7,
    speed: 5.2,
    lateralSpeed: 6.4,
    breakThreshold: 7,
    trapChance: 0.62,
    reqMin: 4,
    reqMax: 9,
    widthJitterMin: 0,
    widthJitterMax: 0.015,
    gemChance: 0.25,
  };
}

function resolveTurnTarget(
  level: number,
  mode: OnePathMode,
  diff: DifficultyProfile,
  seed: number
) {
  if (mode === 'levels') return Math.max(1, level);
  const rand = mulberry32(hash32(seed ^ 0x4f1bbcdc));
  return randInt(rand, diff.segmentMin, diff.segmentMax);
}

function pointOnSegment(seg: OnePathSegment, s: number, l: number) {
  if (seg.axis === 'x') {
    return { x: seg.x + seg.dir * s, z: seg.z + l };
  }
  return { x: seg.x + l, z: seg.z + seg.dir * s };
}

function corridorAABB(seg: OnePathSegment, noTouchMargin: number): AABB {
  const halfTotal = seg.halfWidth + CONST.WALL_T * 0.5 + noTouchMargin;
  const endPad = CONST.WALL_T * 0.5 + noTouchMargin;

  if (seg.axis === 'x') {
    const x0 = seg.x;
    const x1 = seg.x + seg.dir * seg.length;
    return {
      minX: Math.min(x0, x1) - endPad,
      maxX: Math.max(x0, x1) + endPad,
      minZ: seg.z - halfTotal,
      maxZ: seg.z + halfTotal,
    };
  }

  const z0 = seg.z;
  const z1 = seg.z + seg.dir * seg.length;
  return {
    minX: seg.x - halfTotal,
    maxX: seg.x + halfTotal,
    minZ: Math.min(z0, z1) - endPad,
    maxZ: Math.max(z0, z1) + endPad,
  };
}

function intersectsOrTouches(a: AABB, b: AABB) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ);
}

function overlapRect(a: AABB, b: AABB) {
  const minX = Math.max(a.minX, b.minX);
  const maxX = Math.min(a.maxX, b.maxX);
  const minZ = Math.max(a.minZ, b.minZ);
  const maxZ = Math.min(a.maxZ, b.maxZ);
  if (maxX <= minX || maxZ <= minZ) return null;
  return { minX, maxX, minZ, maxZ };
}

function overlapsCurrentOutsideConnector(
  candidate: AABB,
  current: AABB,
  connector: { x: number; z: number },
  connectorAllowance: number
) {
  const overlap = overlapRect(candidate, current);
  if (!overlap) return false;
  return !(
    overlap.minX >= connector.x - connectorAllowance &&
    overlap.maxX <= connector.x + connectorAllowance &&
    overlap.minZ >= connector.z - connectorAllowance &&
    overlap.maxZ <= connector.z + connectorAllowance
  );
}

function withinWorldBounds(aabb: AABB, worldLimit: number) {
  return (
    aabb.minX >= -worldLimit &&
    aabb.maxX <= worldLimit &&
    aabb.minZ >= -worldLimit &&
    aabb.maxZ <= worldLimit
  );
}

function pickDirection(
  axis: OnePathAxis,
  cursor: { x: number; z: number },
  rand: () => number
): -1 | 1 {
  const limit = CONST.WORLD_LIMIT * 0.72;
  if (axis === 'x') {
    if (cursor.x > limit) return -1;
    if (cursor.x < -limit) return 1;
  } else {
    if (cursor.z > limit) return -1;
    if (cursor.z < -limit) return 1;
  }
  return rand() < 0.5 ? -1 : 1;
}

function buildWalls(level: number, segIndex: number, threshold: number) {
  const hp = Math.max(2, threshold + (segIndex === 0 ? 2 : 0));
  const base = {
    maxHp: hp,
    hp,
    broken: false,
    unbreakable: false,
  };

  return {
    neg: { id: `w_${level}_${segIndex}_n`, ...base },
    pos: { id: `w_${level}_${segIndex}_p`, ...base },
  };
}

function buildFallbackLevel(
  level: number,
  mode: OnePathMode,
  seed: number,
  targetTurns: number
): OnePathLevel {
  const diff = getDifficulty(level, mode);
  const rand = mulberry32(hash32(seed ^ 0xa55a55a5));
  const noTouchMargin = CONST.BALL_R * CONST.NO_TOUCH_MARGIN_FACTOR;
  const turnCount = Math.max(1, Math.floor(targetTurns));
  const segments: OnePathSegment[] = [];
  let cursor = { x: 0, z: 0 };

  for (let i = 0; i < turnCount; i += 1) {
    const axis: OnePathAxis = i % 2 === 0 ? 'z' : 'x';
    const dir = pickDirection(axis, cursor, rand);
    const corridorWidth = Math.max(
      MIN_CORRIDOR_WIDTH,
      BASE_CORRIDOR_WIDTH + randRange(rand, diff.widthJitterMin, diff.widthJitterMax)
    );
    const halfWidth = corridorWidth * 0.5;
    const length = randRange(rand, diff.lengthMin, diff.lengthMax);

    const centerPad = CONST.BALL_R + CONST.WALL_T * 0.5;
    const centerMin = centerPad;
    const centerMax = Math.max(centerMin + 0.4, length - centerPad);
    const turnS = centerMin + (centerMax - centerMin) * (0.35 + rand() * 0.3);

    const reqAllowedMax = Math.max(0, Math.min(diff.reqMax, diff.breakThreshold - 2));
    const reqAllowedMin = Math.min(diff.reqMin, reqAllowedMax);
    const req =
      rand() < diff.trapChance && reqAllowedMax > 0
        ? randInt(rand, reqAllowedMin, reqAllowedMax)
        : 0;

    const seg: OnePathSegment = {
      id: `s_fb_${level}_${i}`,
      axis,
      dir,
      x: cursor.x,
      z: cursor.z,
      length,
      corridorWidth,
      halfWidth,
      centerMin,
      centerMax,
      gate: {
        offset: turnS,
        triggerStart: turnS - corridorWidth * 0.22,
        triggerEnd: turnS + corridorWidth * 0.22,
        requiredBounces: req,
        isOpen: req <= 0,
      },
      walls: buildWalls(level, i, diff.breakThreshold),
      gems: [],
    };

    segments.push(seg);
    cursor = pointOnSegment(seg, turnS, 0);
  }

  const finalSeg = segments[segments.length - 1];
  const exitPoint = pointOnSegment(finalSeg, finalSeg.gate.offset, 0);
  let tightestWidth = Number.POSITIVE_INFINITY;
  let widthSum = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const w = segments[i].corridorWidth;
    tightestWidth = Math.min(tightestWidth, w);
    widthSum += w;
  }
  const avgWidth = widthSum / segments.length;
  const tolerance = Math.max(
    tightestWidth * 0.18,
    diff.lateralSpeed * CONST.FIXED_DT * 1.25
  );

  return {
    id: `${mode}_lvl_${level}_fallback`,
    level,
    mode,
    seed,
    segments,
    exit: { x: exitPoint.x, z: exitPoint.z, segIndex: segments.length - 1 },
    speed: diff.speed,
    lateralSpeed: diff.lateralSpeed,
    tolerance,
    perfectTol: tolerance * 0.6,
    bridgeWidth: avgWidth,
    baseHeight: CONST.BASE_H,
    deckHeight: CONST.DECK_H,
    fallMargin: CONST.FALL_MARGIN,
    noTouchMargin,
  };
}

export const onePathState = proxy({
  phase: 'menu' as OnePathPhase,
  mode: 'levels' as OnePathMode,
  resetTick: 0,

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
    onePathState.resetTick += 1;
  },

  startEndless: () => {
    onePathState.mode = 'endless';
    onePathState.level = 1;
    onePathState.endlessSeed = hash32(
      (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0
    );
    onePathState.phase = 'playing';
    onePathState.resetTick += 1;
  },

  retry: () => {
    onePathState.phase = 'playing';
    onePathState.resetTick += 1;
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
    onePathState.resetTick += 1;
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
    onePathState.resetTick += 1;
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

  // Deterministic self-avoiding generator:
  // each new branch can only connect to current segment and cannot touch older corridors.
  // In levels mode, required turns strictly match the selected level number.
  buildLevel: (level: number, mode: OnePathMode = 'levels'): OnePathLevel => {
    const lvl = Math.max(1, Math.floor(level));
    const diff = getDifficulty(lvl, mode);

    const seed =
      mode === 'levels'
        ? hash32(lvl * 0x9e3779b1)
        : hash32(onePathState.endlessSeed ^ Math.imul(lvl, 0x85ebca6b));

    const segmentCount = resolveTurnTarget(lvl, mode, diff, seed);
    const noTouchMargin = CONST.BALL_R * CONST.NO_TOUCH_MARGIN_FACTOR;

    for (let regen = 0; regen < 42; regen += 1) {
      const rand = mulberry32(hash32(seed ^ regen));

      const segments: OnePathSegment[] = [];
      const occupied: AABB[] = [];
      let cursor = { x: 0, z: 0 };
      let failed = false;

      for (let i = 0; i < segmentCount; i += 1) {
        const axis: OnePathAxis = i % 2 === 0 ? 'z' : 'x';

        let accepted: OnePathSegment | null = null;
        let acceptedAABB: AABB | null = null;

        for (let attempt = 0; attempt < 120; attempt += 1) {
          const dir = pickDirection(axis, cursor, rand);
          const corridorWidth = Math.max(
            MIN_CORRIDOR_WIDTH,
            BASE_CORRIDOR_WIDTH + randRange(rand, diff.widthJitterMin, diff.widthJitterMax)
          );
          const halfWidth = corridorWidth * 0.5;

          const shrink = Math.max(0.55, 1 - attempt * 0.008);
          const length = randRange(rand, diff.lengthMin, diff.lengthMax) * shrink;

          const centerPad = CONST.BALL_R + CONST.WALL_T * 0.5;
          const centerMin = centerPad;
          const centerMax = length - centerPad;
          if (centerMax - centerMin <= 0.35) continue;

          const turnMargin = Math.max(0.2, (centerMax - centerMin) * 0.12);
          const turnMin = centerMin + turnMargin;
          const turnMax = centerMax - turnMargin;
          if (turnMax <= turnMin) continue;

          const turnS = randRange(rand, turnMin, turnMax);
          const gateWindow = Math.max(corridorWidth * 0.25, 0.09);

          const reqAllowedMax = Math.max(0, Math.min(diff.reqMax, diff.breakThreshold - 2));
          const reqAllowedMin = Math.min(diff.reqMin, reqAllowedMax);
          const req =
            rand() < diff.trapChance && reqAllowedMax > 0
              ? randInt(rand, reqAllowedMin, reqAllowedMax)
              : 0;

          const seg: OnePathSegment = {
            id: `s_${lvl}_${i}`,
            axis,
            dir,
            x: cursor.x,
            z: cursor.z,
            length,
            corridorWidth,
            halfWidth,
            centerMin,
            centerMax,
            gate: {
              offset: turnS,
              triggerStart: turnS - gateWindow,
              triggerEnd: turnS + gateWindow,
              requiredBounces: req,
              isOpen: req <= 0,
            },
            walls: buildWalls(lvl, i, diff.breakThreshold),
            gems: [],
          };

          if (rand() < diff.gemChance) {
            const gemCount = rand() < 0.18 ? 2 : 1;
            for (let g = 0; g < gemCount; g += 1) {
              seg.gems.push({
                id: `g_${lvl}_${i}_${g}`,
                s: randRange(rand, Math.max(centerMin + 0.08, turnS - 0.5), Math.min(centerMax - 0.08, turnS + 0.5)),
                l: randRange(rand, -halfWidth * 0.16, halfWidth * 0.16),
                collected: false,
              });
            }
          }

          const aabb = corridorAABB(seg, noTouchMargin);
          if (!withinWorldBounds(aabb, CONST.WORLD_LIMIT)) continue;

          let blocked = false;
          for (let j = 0; j < occupied.length - 1; j += 1) {
            if (intersectsOrTouches(aabb, occupied[j])) {
              blocked = true;
              break;
            }
          }
          if (!blocked && occupied.length > 0) {
            const currentCorridor = occupied[occupied.length - 1];
            const connectorAllowance = halfWidth + CONST.WALL_T + noTouchMargin + 0.1;
            if (
              overlapsCurrentOutsideConnector(
                aabb,
                currentCorridor,
                cursor,
                connectorAllowance
              )
            ) {
              blocked = true;
            }
          }
          if (blocked) continue;

          accepted = seg;
          acceptedAABB = aabb;
          break;
        }

        if (!accepted || !acceptedAABB) {
          failed = true;
          break;
        }

        segments.push(accepted);
        occupied.push(acceptedAABB);
        cursor = pointOnSegment(accepted, accepted.gate.offset, 0);
      }

      if (failed || segments.length === 0) {
        continue;
      }

      const finalSeg = segments[segments.length - 1];
      const exitPoint = pointOnSegment(finalSeg, finalSeg.gate.offset, 0);
      let tightestWidth = Number.POSITIVE_INFINITY;
      let widthSum = 0;
      for (let i = 0; i < segments.length; i += 1) {
        const w = segments[i].corridorWidth;
        tightestWidth = Math.min(tightestWidth, w);
        widthSum += w;
      }
      const avgWidth = widthSum / segments.length;
      const tolerance = Math.max(
        tightestWidth * 0.18,
        diff.lateralSpeed * CONST.FIXED_DT * 1.25
      );

      return {
        id: `${mode}_lvl_${lvl}`,
        level: lvl,
        mode,
        seed,
        segments,
        exit: {
          x: exitPoint.x,
          z: exitPoint.z,
          segIndex: segments.length - 1,
        },
        speed: diff.speed,
        lateralSpeed: diff.lateralSpeed,
        tolerance,
        perfectTol: tolerance * 0.6,
        bridgeWidth: avgWidth,
        baseHeight: CONST.BASE_H,
        deckHeight: CONST.DECK_H,
        fallMargin: CONST.FALL_MARGIN,
        noTouchMargin,
      };
    }

    return buildFallbackLevel(lvl, mode, seed, segmentCount);
  },
});
