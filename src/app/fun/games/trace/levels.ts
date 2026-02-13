export type TraceDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
type SymmetryMode = 'HV' | 'H' | 'V' | 'R' | 'NONE';
type LevelSymmetry = 'AXIAL' | 'RADIAL' | 'CHAOS';

export type TraceLevelDefinition = {
  id: number;
  name: string;
  size: number;
  blockedKeys: number[];
  openCells: number;
  chaotic: boolean;
  symmetry: LevelSymmetry;
};

type SpeedProfile = {
  base: number;
  growth: number;
  cap: number;
};

type BuildCtx = {
  level: number;
  size: number;
  mid: number;
  blocked: Uint8Array;
  rng: () => number;
  symmetry: SymmetryMode;
  chaotic: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const toKey = (x: number, y: number, size: number) => y * size + x;
const inBounds = (x: number, y: number, size: number) => x >= 0 && y >= 0 && x < size && y < size;

const LEVEL_COUNT = 120;
const MIN_SIZE = 11;
const MAX_SIZE = 17;

const SPEED_PROFILES: Record<TraceDifficulty, SpeedProfile> = {
  EASY: { base: 1.75, growth: 0.16, cap: 4.2 },
  MEDIUM: { base: 2.25, growth: 0.19, cap: 5.0 },
  HARD: { base: 2.75, growth: 0.22, cap: 5.9 },
};

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const randInt = (rng: () => number, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;

const symmetryPoints = (ctx: BuildCtx, x: number, y: number): Array<[number, number]> => {
  const s = ctx.size - 1;
  if (ctx.symmetry === 'NONE') return [[x, y]];
  if (ctx.symmetry === 'H') return [[x, y], [s - x, y]];
  if (ctx.symmetry === 'V') return [[x, y], [x, s - y]];
  if (ctx.symmetry === 'R') return [[x, y], [s - x, s - y]];
  return [
    [x, y],
    [s - x, y],
    [x, s - y],
    [s - x, s - y],
  ];
};

const setBlocked = (ctx: BuildCtx, x: number, y: number, blocked = true) => {
  if (!inBounds(x, y, ctx.size)) return;
  ctx.blocked[toKey(x, y, ctx.size)] = blocked ? 1 : 0;
};

const paintBlocked = (ctx: BuildCtx, x: number, y: number) => {
  for (const [sx, sy] of symmetryPoints(ctx, x, y)) {
    setBlocked(ctx, sx, sy, true);
  }
};

const paintOpen = (ctx: BuildCtx, x: number, y: number) => {
  for (const [sx, sy] of symmetryPoints(ctx, x, y)) {
    setBlocked(ctx, sx, sy, false);
  }
};

const paintRingBands = (ctx: BuildCtx) => {
  const spacing = randInt(ctx.rng, 2, 3);
  const offset = randInt(ctx.rng, 0, spacing - 1);
  const gateStride = randInt(ctx.rng, 2, 4);
  for (let y = 0; y < ctx.size; y += 1) {
    for (let x = 0; x < ctx.size; x += 1) {
      const dx = Math.abs(x - ctx.mid);
      const dy = Math.abs(y - ctx.mid);
      const ring = Math.max(dx, dy);
      if (ring <= 1 || (ring + offset) % spacing !== 0) continue;
      const gate =
        (x === ctx.mid && (y + ctx.level) % gateStride === 0) ||
        (y === ctx.mid && (x + ctx.level) % gateStride === 0);
      if (!gate) paintBlocked(ctx, x, y);
    }
  }
};

const paintDiamondBands = (ctx: BuildCtx) => {
  const spacing = randInt(ctx.rng, 3, 5);
  const offset = randInt(ctx.rng, 0, spacing - 1);
  for (let y = 0; y < ctx.size; y += 1) {
    for (let x = 0; x < ctx.size; x += 1) {
      const d = Math.abs(x - ctx.mid) + Math.abs(y - ctx.mid);
      if (d <= 1 || (d + offset) % spacing !== 0) continue;
      const axisGate = x === ctx.mid || y === ctx.mid;
      if (!axisGate) paintBlocked(ctx, x, y);
    }
  }
};

const paintAxisLanes = (ctx: BuildCtx) => {
  const lane = randInt(ctx.rng, 2, 4);
  const gateMod = randInt(ctx.rng, 2, 5);
  for (let y = 0; y < ctx.size; y += 1) {
    for (let x = 0; x < ctx.size; x += 1) {
      if ((x + ctx.level) % lane === 0 || (y + ctx.level * 2) % lane === 0) {
        const gate = (x + y + ctx.level) % gateMod === 0;
        if (!gate) paintBlocked(ctx, x, y);
      }
    }
  }
};

const paintSpokes = (ctx: BuildCtx) => {
  const spokeGap = randInt(ctx.rng, 2, 3);
  for (let y = 0; y < ctx.size; y += 1) {
    for (let x = 0; x < ctx.size; x += 1) {
      const dx = x - ctx.mid;
      const dy = y - ctx.mid;
      if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
        if ((Math.abs(dx) + Math.abs(dy) + ctx.level) % spokeGap !== 0) {
          paintBlocked(ctx, x, y);
        }
      }
    }
  }
};

const paintWeave = (ctx: BuildCtx) => {
  const periodA = randInt(ctx.rng, 4, 6);
  const periodB = randInt(ctx.rng, 3, 5);
  for (let y = 0; y < ctx.size; y += 1) {
    for (let x = 0; x < ctx.size; x += 1) {
      const dx = x - ctx.mid;
      const dy = y - ctx.mid;
      const waveA = (dx * 2 + dy + ctx.level) % periodA === 0;
      const waveB = (dy * 2 - dx + ctx.level) % periodB === 0;
      if (waveA || waveB) paintBlocked(ctx, x, y);
    }
  }
};

const paintPocketRooms = (ctx: BuildCtx) => {
  const rooms = randInt(ctx.rng, 3, 6);
  const half = Math.floor(ctx.size / 2);
  for (let i = 0; i < rooms; i += 1) {
    const cx = randInt(ctx.rng, 1, half);
    const cy = randInt(ctx.rng, 1, half);
    const r = randInt(ctx.rng, 1, 2);
    for (let y = cy - r; y <= cy + r; y += 1) {
      for (let x = cx - r; x <= cx + r; x += 1) {
        if (!inBounds(x, y, ctx.size)) continue;
        const edge = Math.abs(x - cx) === r || Math.abs(y - cy) === r;
        if (edge) paintBlocked(ctx, x, y);
      }
    }
  }
};

const paintSerpent = (ctx: BuildCtx) => {
  const amp = randInt(ctx.rng, 1, 3);
  const freq = randInt(ctx.rng, 2, 4);
  for (let x = 0; x < ctx.size; x += 1) {
    const local = x - ctx.mid;
    const yCenter = Math.round(
      ctx.mid + Math.sin((local / Math.max(1, freq)) * Math.PI * 0.6) * amp
    );
    for (let y = yCenter - 1; y <= yCenter + 1; y += 1) {
      if (inBounds(x, y, ctx.size) && (x + y + ctx.level) % 3 !== 0) {
        paintBlocked(ctx, x, y);
      }
    }
  }
};

const paintIslands = (ctx: BuildCtx) => {
  const half = Math.floor(ctx.size / 2);
  const blobs = randInt(ctx.rng, 4, 8);
  for (let i = 0; i < blobs; i += 1) {
    const bx = randInt(ctx.rng, 1, half);
    const by = randInt(ctx.rng, 1, half);
    const radius = randInt(ctx.rng, 1, 2);
    for (let y = by - radius; y <= by + radius; y += 1) {
      for (let x = bx - radius; x <= bx + radius; x += 1) {
        if (!inBounds(x, y, ctx.size)) continue;
        const d = Math.abs(x - bx) + Math.abs(y - by);
        if (d <= radius && ctx.rng() > 0.24) paintBlocked(ctx, x, y);
      }
    }
  }
};

const paintChaosClusters = (ctx: BuildCtx) => {
  const clusters = randInt(ctx.rng, 8, 14);
  for (let i = 0; i < clusters; i += 1) {
    const cx = randInt(ctx.rng, 0, ctx.size - 1);
    const cy = randInt(ctx.rng, 0, ctx.size - 1);
    const r = randInt(ctx.rng, 1, 3);
    for (let y = cy - r; y <= cy + r; y += 1) {
      for (let x = cx - r; x <= cx + r; x += 1) {
        if (!inBounds(x, y, ctx.size)) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r + 0.25 && ctx.rng() > 0.33) setBlocked(ctx, x, y, true);
      }
    }
  }
};

const MOTIFS: Array<(ctx: BuildCtx) => void> = [
  paintRingBands,
  paintDiamondBands,
  paintAxisLanes,
  paintSpokes,
  paintWeave,
  paintPocketRooms,
  paintSerpent,
  paintIslands,
];

const forceOpenStart = (ctx: BuildCtx) => {
  const c = ctx.mid;
  setBlocked(ctx, c, c, false);
  setBlocked(ctx, c + 1, c, false);
  setBlocked(ctx, c - 1, c, false);
  setBlocked(ctx, c, c + 1, false);
  setBlocked(ctx, c, c - 1, false);
};

const floodOpen = (blocked: Uint8Array, size: number, startKey: number) => {
  const visited = new Uint8Array(blocked.length);
  if (blocked[startKey] === 1) return visited;
  const queue = [startKey];
  visited[startKey] = 1;
  while (queue.length > 0) {
    const key = queue.shift()!;
    const x = key % size;
    const y = Math.floor(key / size);
    const next: Array<[number, number]> = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of next) {
      if (!inBounds(nx, ny, size)) continue;
      const nKey = toKey(nx, ny, size);
      if (visited[nKey] === 1 || blocked[nKey] === 1) continue;
      visited[nKey] = 1;
      queue.push(nKey);
    }
  }
  return visited;
};

const hasOpenNeighbor = (blocked: Uint8Array, size: number, key: number) => {
  const x = key % size;
  const y = Math.floor(key / size);
  const next: Array<[number, number]> = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
  for (const [nx, ny] of next) {
    if (!inBounds(nx, ny, size)) continue;
    if (blocked[toKey(nx, ny, size)] === 0) return true;
  }
  return false;
};

const collapseUnreachable = (ctx: BuildCtx) => {
  const startKey = toKey(ctx.mid, ctx.mid, ctx.size);
  const reachable = floodOpen(ctx.blocked, ctx.size, startKey);
  for (let i = 0; i < ctx.blocked.length; i += 1) {
    if (ctx.blocked[i] === 0 && reachable[i] === 0) {
      ctx.blocked[i] = 1;
    }
  }
};

const openCount = (blocked: Uint8Array) => {
  let count = 0;
  for (let i = 0; i < blocked.length; i += 1) {
    if (blocked[i] === 0) count += 1;
  }
  return count;
};

const enforceMinimumOpen = (ctx: BuildCtx, minOpen: number) => {
  let currentOpen = openCount(ctx.blocked);
  let guard = 0;
  while (currentOpen < minOpen && guard < 8000) {
    guard += 1;
    const key = randInt(ctx.rng, 0, ctx.blocked.length - 1);
    if (ctx.blocked[key] === 0) continue;
    if (!hasOpenNeighbor(ctx.blocked, ctx.size, key)) continue;
    ctx.blocked[key] = 0;
    currentOpen += 1;
  }
};

const symmetryForLevel = (level: number, chaotic: boolean): SymmetryMode => {
  if (chaotic) return 'NONE';
  const modes: SymmetryMode[] = ['HV', 'R', 'H', 'V', 'HV'];
  return modes[level % modes.length];
};

const levelSizeFor = (level: number) => {
  const step = Math.floor((level - 1) / 18);
  return clamp(MIN_SIZE + step, MIN_SIZE, MAX_SIZE);
};

const levelName = (level: number, chaotic: boolean) => {
  const brightA = ['Mirror', 'Prism', 'Echo', 'Vector', 'Pulse', 'Nova', 'Cipher', 'Lumen'];
  const brightB = ['Vault', 'Grid', 'Bastion', 'Bloom', 'Spiral', 'Forge', 'Circuit', 'Array'];
  const chaosA = ['Rogue', 'Fracture', 'Storm', 'Shard', 'Entropy', 'Feral'];
  const chaosB = ['Maze', 'Field', 'Lattice', 'Loop', 'Stormline', 'Rift'];
  if (chaotic) {
    return `${chaosA[level % chaosA.length]} ${chaosB[level % chaosB.length]} ${String(level).padStart(3, '0')}`;
  }
  return `${brightA[level % brightA.length]} ${brightB[level % brightB.length]} ${String(level).padStart(3, '0')}`;
};

const toSymmetryLabel = (mode: SymmetryMode): LevelSymmetry => {
  if (mode === 'R') return 'RADIAL';
  if (mode === 'NONE') return 'CHAOS';
  return 'AXIAL';
};

const createOneLevel = (level: number, attempt: number): TraceLevelDefinition => {
  const chaotic = level % 9 === 0 || level % 14 === 0 || level % 25 === 0;
  const size = levelSizeFor(level);
  const symmetry = symmetryForLevel(level + attempt, chaotic);
  const seed = level * 9301 + attempt * 49157 + 17;
  const rng = mulberry32(seed);

  const ctx: BuildCtx = {
    level,
    size,
    mid: Math.floor(size / 2),
    blocked: new Uint8Array(size * size),
    rng,
    symmetry,
    chaotic,
  };

  const motifA = (level + attempt * 2) % MOTIFS.length;
  const motifB = (level * 3 + attempt * 5 + 1) % MOTIFS.length;
  const motifC = (level * 7 + attempt * 3 + 2) % MOTIFS.length;

  MOTIFS[motifA](ctx);
  MOTIFS[motifB](ctx);
  if (level % 3 === 0 || chaotic) MOTIFS[motifC](ctx);
  if (chaotic) {
    paintChaosClusters(ctx);
    paintChaosClusters(ctx);
  } else if (level % 5 === 0) {
    paintIslands(ctx);
  }

  for (let i = 0; i < randInt(rng, 2, 5); i += 1) {
    const cx = randInt(rng, 1, size - 2);
    const cy = randInt(rng, 1, size - 2);
    paintOpen(ctx, cx, cy);
  }

  forceOpenStart(ctx);
  collapseUnreachable(ctx);

  const minOpenRatio = chaotic ? 0.47 : 0.54;
  enforceMinimumOpen(ctx, Math.floor(size * size * minOpenRatio));
  forceOpenStart(ctx);
  collapseUnreachable(ctx);

  const blockedKeys: number[] = [];
  for (let i = 0; i < ctx.blocked.length; i += 1) {
    if (ctx.blocked[i] === 1) blockedKeys.push(i);
  }

  const openCells = size * size - blockedKeys.length;
  return {
    id: level,
    name: levelName(level, chaotic),
    size,
    blockedKeys,
    openCells: Math.max(1, openCells),
    chaotic,
    symmetry: toSymmetryLabel(symmetry),
  };
};

const buildLevels = () => {
  const layouts: TraceLevelDefinition[] = [];
  const seen = new Set<string>();

  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    let accepted: TraceLevelDefinition | null = null;
    for (let attempt = 0; attempt < 96; attempt += 1) {
      const next = createOneLevel(level, attempt);
      const signature = `${next.size}:${next.blockedKeys.join(',')}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      accepted = next;
      break;
    }
    if (!accepted) {
      accepted = createOneLevel(level, 999 + level);
    }
    layouts.push(accepted);
  }

  return layouts;
};

export const TRACE_LEVELS: TraceLevelDefinition[] = buildLevels();
export const TRACE_LEVEL_COUNT = TRACE_LEVELS.length;

export const getTraceLevelDefinition = (level: number) => {
  const safe = Math.max(1, Math.floor(level));
  return TRACE_LEVELS[(safe - 1) % TRACE_LEVELS.length];
};

export const speedForTraceLevel = (level: number, difficulty: TraceDifficulty) => {
  const profile = SPEED_PROFILES[difficulty];
  return clamp(profile.base + (Math.max(1, level) - 1) * profile.growth, profile.base, profile.cap);
};

export const speedCapForDifficulty = (difficulty: TraceDifficulty) => SPEED_PROFILES[difficulty].cap;
