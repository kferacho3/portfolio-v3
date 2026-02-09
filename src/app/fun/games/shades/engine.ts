export const SHADES_ROWS = 10;
export const SHADES_COLS = 5;
export const SHADES_TILE_LEVELS = 4;
export const SHADES_COLOR_GROUPS = 5;
export const SHADES_LEVEL_WEIGHTS = [56, 28, 12, 4] as const;
export const SHADES_MAX_RESOLVE_LOOPS = 96;

export type ShadesGrid = Int16Array;

export type TileSpec = {
  colorGroup: number;
  level: number;
};

export type ActiveTile = TileSpec & {
  x: number;
  y: number;
};

export type ResolveSummary = {
  merges: number;
  clears: number;
  hadEffect: boolean;
  loops: number;
};

export type ResolveResult = ResolveSummary & {
  grid: ShadesGrid;
};

export type LockResult = ResolveResult & {
  placedCode: number;
  placedX: number;
  placedY: number;
};

export type SpawnResult = {
  active: ActiveTile | null;
  gameOver: boolean;
};

export type RandomLike = {
  int: (min: number, max: number) => number;
  float: (min: number, max: number) => number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function createEmptyGrid(
  rows = SHADES_ROWS,
  cols = SHADES_COLS
): ShadesGrid {
  return new Int16Array(rows * cols);
}

export function cloneGrid(grid: ShadesGrid): ShadesGrid {
  return new Int16Array(grid);
}

export function cellIndex(x: number, y: number, cols = SHADES_COLS): number {
  return y * cols + x;
}

export function encodeTile(
  colorGroup: number,
  level: number,
  tileLevels = SHADES_TILE_LEVELS
): number {
  return 1 + colorGroup * tileLevels + level;
}

export function decodeColorGroup(
  code: number,
  tileLevels = SHADES_TILE_LEVELS
): number {
  return Math.floor((code - 1) / tileLevels);
}

export function decodeLevel(code: number, tileLevels = SHADES_TILE_LEVELS): number {
  return (code - 1) % tileLevels;
}

export function getCell(
  grid: ShadesGrid,
  x: number,
  y: number,
  rows = SHADES_ROWS,
  cols = SHADES_COLS
): number {
  if (x < 0 || x >= cols || y < 0 || y >= rows) return 0;
  return grid[cellIndex(x, y, cols)];
}

export function canOccupy(
  grid: ShadesGrid,
  x: number,
  y: number,
  rows = SHADES_ROWS,
  cols = SHADES_COLS
): boolean {
  return x >= 0 && x < cols && y >= 0 && y < rows && getCell(grid, x, y, rows, cols) === 0;
}

export function weightedLevel(
  rng: RandomLike,
  levelWeights: readonly number[] = SHADES_LEVEL_WEIGHTS
): number {
  const totalWeight = levelWeights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.float(0, totalWeight);

  for (let i = 0; i < levelWeights.length; i += 1) {
    roll -= levelWeights[i];
    if (roll <= 0) return i;
  }

  return 0;
}

export function randomTile(
  rng: RandomLike,
  colorGroups = SHADES_COLOR_GROUPS,
  levelWeights: readonly number[] = SHADES_LEVEL_WEIGHTS
): TileSpec {
  return {
    colorGroup: rng.int(0, colorGroups - 1),
    level: weightedLevel(rng, levelWeights),
  };
}

export function spawnActiveTile(
  grid: ShadesGrid,
  next: TileSpec,
  options: {
    rows?: number;
    cols?: number;
    spawnX?: number;
    spawnY?: number;
  } = {}
): SpawnResult {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;
  const spawnX = options.spawnX ?? Math.floor(cols * 0.5);
  const spawnY = options.spawnY ?? rows - 1;

  const tile: ActiveTile = {
    x: spawnX,
    y: spawnY,
    colorGroup: next.colorGroup,
    level: next.level,
  };

  if (!canOccupy(grid, tile.x, tile.y, rows, cols)) {
    return { active: null, gameOver: true };
  }

  return { active: tile, gameOver: false };
}

export function moveActiveTile(
  grid: ShadesGrid,
  tile: ActiveTile,
  dx: number,
  options: { rows?: number; cols?: number } = {}
): ActiveTile {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;
  const nextX = tile.x + dx;
  if (!canOccupy(grid, nextX, tile.y, rows, cols)) return tile;
  return { ...tile, x: nextX };
}

export function moveActiveTileToColumn(
  grid: ShadesGrid,
  tile: ActiveTile,
  targetColumn: number,
  options: { rows?: number; cols?: number } = {}
): ActiveTile {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;
  const target = clamp(Math.round(targetColumn), 0, cols - 1);

  if (canOccupy(grid, target, tile.y, rows, cols)) {
    return { ...tile, x: target };
  }

  const direction = target > tile.x ? 1 : -1;
  let cursor = tile.x;
  while (cursor !== target) {
    const next = cursor + direction;
    if (!canOccupy(grid, next, tile.y, rows, cols)) break;
    cursor = next;
  }

  if (cursor === tile.x) return tile;
  return { ...tile, x: cursor };
}

export function softDropTile(
  grid: ShadesGrid,
  tile: ActiveTile,
  options: { rows?: number; cols?: number } = {}
): { tile: ActiveTile; locked: boolean } {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;

  if (canOccupy(grid, tile.x, tile.y - 1, rows, cols)) {
    return { tile: { ...tile, y: tile.y - 1 }, locked: false };
  }

  return { tile, locked: true };
}

export function hardDropTile(
  grid: ShadesGrid,
  tile: ActiveTile,
  options: { rows?: number; cols?: number } = {}
): ActiveTile {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;

  let y = tile.y;
  while (canOccupy(grid, tile.x, y - 1, rows, cols)) {
    y -= 1;
  }

  if (y === tile.y) return tile;
  return { ...tile, y };
}

export function resolveGridRecursive(
  grid: ShadesGrid,
  options: {
    rows?: number;
    cols?: number;
    tileLevels?: number;
    maxResolveLoops?: number;
  } = {}
): ResolveResult {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;
  const tileLevels = options.tileLevels ?? SHADES_TILE_LEVELS;
  const maxResolveLoops = options.maxResolveLoops ?? SHADES_MAX_RESOLVE_LOOPS;

  const nextGrid = cloneGrid(grid);
  const summary: ResolveSummary = {
    merges: 0,
    clears: 0,
    hadEffect: false,
    loops: 0,
  };

  for (let loop = 0; loop < maxResolveLoops; loop += 1) {
    let changed = false;

    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows - 1; y += 1) {
        const lowerIndex = cellIndex(x, y, cols);
        const upperIndex = cellIndex(x, y + 1, cols);
        const lower = nextGrid[lowerIndex];
        const upper = nextGrid[upperIndex];
        if (lower === 0 || lower !== upper) continue;

        const colorGroup = decodeColorGroup(lower, tileLevels);
        const level = decodeLevel(lower, tileLevels);
        nextGrid[lowerIndex] = encodeTile(
          colorGroup,
          Math.min(level + 1, tileLevels - 1),
          tileLevels
        );
        nextGrid[upperIndex] = 0;

        summary.merges += 1;
        summary.hadEffect = true;
        changed = true;
      }
    }

    for (let y = 0; y < rows; y += 1) {
      const first = nextGrid[cellIndex(0, y, cols)];
      if (first === 0) continue;

      let rowMatch = true;
      for (let x = 1; x < cols; x += 1) {
        if (nextGrid[cellIndex(x, y, cols)] !== first) {
          rowMatch = false;
          break;
        }
      }

      if (!rowMatch) continue;

      for (let x = 0; x < cols; x += 1) {
        nextGrid[cellIndex(x, y, cols)] = 0;
      }

      summary.clears += 1;
      summary.hadEffect = true;
      changed = true;
    }

    for (let x = 0; x < cols; x += 1) {
      let writeY = 0;
      for (let y = 0; y < rows; y += 1) {
        const readIndex = cellIndex(x, y, cols);
        const code = nextGrid[readIndex];
        if (code === 0) continue;

        const writeIndex = cellIndex(x, writeY, cols);
        if (writeIndex !== readIndex) {
          nextGrid[writeIndex] = code;
          nextGrid[readIndex] = 0;
          changed = true;
        }

        writeY += 1;
      }

      for (let y = writeY; y < rows; y += 1) {
        const clearIndex = cellIndex(x, y, cols);
        if (nextGrid[clearIndex] !== 0) {
          nextGrid[clearIndex] = 0;
          changed = true;
        }
      }
    }

    summary.loops = loop + 1;
    if (!changed) break;
  }

  return {
    grid: nextGrid,
    ...summary,
  };
}

export function lockAndResolve(
  grid: ShadesGrid,
  tile: ActiveTile,
  options: {
    rows?: number;
    cols?: number;
    tileLevels?: number;
    maxResolveLoops?: number;
  } = {}
): LockResult {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;
  const tileLevels = options.tileLevels ?? SHADES_TILE_LEVELS;

  const placedCode = encodeTile(tile.colorGroup, tile.level, tileLevels);
  const placedGrid = cloneGrid(grid);
  placedGrid[cellIndex(tile.x, tile.y, cols)] = placedCode;

  const resolved = resolveGridRecursive(placedGrid, {
    rows,
    cols,
    tileLevels,
    maxResolveLoops: options.maxResolveLoops,
  });

  return {
    ...resolved,
    placedCode,
    placedX: tile.x,
    placedY: tile.y,
  };
}
