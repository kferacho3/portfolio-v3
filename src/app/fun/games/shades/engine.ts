export const SHADES_ROWS = 10;
export const SHADES_COLS = 5;
export const SHADES_MIN_SHADE = 1;
export const SHADES_MAX_SHADE = 4;
export const SHADES_MAX_RESOLVE_LOOPS = 96;

export const SHADES_LEVEL_WEIGHTS = [64, 24, 9, 3] as const;

export type ShadesGrid = Uint8Array;

export type ActiveTile = {
  x: number;
  y: number;
  shade: number;
};

export type SpawnResult = {
  active: ActiveTile | null;
  gameOver: boolean;
};

export type DropResult = {
  active: ActiveTile;
  locked: boolean;
};

export type ResolveInvariantStep = {
  loop: number;
  before: number;
  merges: number;
  afterMerge: number;
  clears: number;
  afterClear: number;
  afterGravity: number;
};

export type ResolveResult = {
  grid: ShadesGrid;
  merges: number;
  clears: number;
  hadEffect: boolean;
  loops: number;
  invariants: ResolveInvariantStep[];
};

export type LockResolveResult = ResolveResult & {
  placedShade: number;
  placedX: number;
  placedY: number;
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
  return new Uint8Array(rows * cols);
}

export function cloneGrid(grid: ShadesGrid): ShadesGrid {
  return new Uint8Array(grid);
}

export function cellIndex(x: number, y: number, cols = SHADES_COLS): number {
  return y * cols + x;
}

export function countOccupied(grid: ShadesGrid): number {
  let count = 0;
  for (let i = 0; i < grid.length; i += 1) {
    if (grid[i] !== 0) count += 1;
  }
  return count;
}

export function getShade(
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
  return x >= 0 && x < cols && y >= 0 && y < rows && getShade(grid, x, y, rows, cols) === 0;
}

export function randomShade(
  rng: RandomLike,
  weights: readonly number[] = SHADES_LEVEL_WEIGHTS
): number {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.float(0, totalWeight);

  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return i + SHADES_MIN_SHADE;
  }

  return SHADES_MIN_SHADE;
}

export function spawnActive(
  grid: ShadesGrid,
  nextShade: number,
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

  const active: ActiveTile = {
    x: spawnX,
    y: spawnY,
    shade: clamp(Math.round(nextShade), SHADES_MIN_SHADE, SHADES_MAX_SHADE),
  };

  if (!canOccupy(grid, active.x, active.y, rows, cols)) {
    return { active: null, gameOver: true };
  }

  return { active, gameOver: false };
}

export function moveLeftRight(
  grid: ShadesGrid,
  active: ActiveTile,
  dx: number,
  options: { rows?: number; cols?: number } = {}
): ActiveTile {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;
  const nextX = active.x + dx;

  if (!canOccupy(grid, nextX, active.y, rows, cols)) {
    return active;
  }

  return { ...active, x: nextX };
}

export function moveToColumn(
  grid: ShadesGrid,
  active: ActiveTile,
  targetColumn: number,
  options: { rows?: number; cols?: number } = {}
): ActiveTile {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;

  const target = clamp(Math.round(targetColumn), 0, cols - 1);
  if (canOccupy(grid, target, active.y, rows, cols)) {
    return { ...active, x: target };
  }

  const direction = target > active.x ? 1 : -1;
  let cursor = active.x;

  while (cursor !== target) {
    const next = cursor + direction;
    if (!canOccupy(grid, next, active.y, rows, cols)) break;
    cursor = next;
  }

  if (cursor === active.x) return active;
  return { ...active, x: cursor };
}

export function softDrop(
  grid: ShadesGrid,
  active: ActiveTile,
  options: { rows?: number; cols?: number } = {}
): DropResult {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;

  if (canOccupy(grid, active.x, active.y - 1, rows, cols)) {
    return {
      active: { ...active, y: active.y - 1 },
      locked: false,
    };
  }

  return { active, locked: true };
}

export function hardDrop(
  grid: ShadesGrid,
  active: ActiveTile,
  options: { rows?: number; cols?: number } = {}
): ActiveTile {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;

  let y = active.y;
  while (canOccupy(grid, active.x, y - 1, rows, cols)) {
    y -= 1;
  }

  if (y === active.y) return active;
  return { ...active, y };
}

export function lockTile(
  grid: ShadesGrid,
  active: ActiveTile,
  options: { cols?: number } = {}
): ShadesGrid {
  const cols = options.cols ?? SHADES_COLS;
  const nextGrid = cloneGrid(grid);
  nextGrid[cellIndex(active.x, active.y, cols)] = clamp(
    active.shade,
    SHADES_MIN_SHADE,
    SHADES_MAX_SHADE
  );
  return nextGrid;
}

function mergeVerticalStep(
  grid: ShadesGrid,
  rows: number,
  cols: number,
  maxShade: number
): number {
  let merges = 0;

  for (let x = 0; x < cols; x += 1) {
    for (let y = 0; y < rows - 1; y += 1) {
      const lowerIndex = cellIndex(x, y, cols);
      const upperIndex = cellIndex(x, y + 1, cols);
      const lower = grid[lowerIndex];
      const upper = grid[upperIndex];

      if (lower === 0 || upper === 0) continue;
      if (lower !== upper) continue;
      if (lower >= maxShade) continue;

      grid[lowerIndex] = lower + 1;
      grid[upperIndex] = 0;
      merges += 1;
    }
  }

  return merges;
}

function clearUniformRowsStep(grid: ShadesGrid, rows: number, cols: number): number {
  let clears = 0;

  for (let y = 0; y < rows; y += 1) {
    const first = grid[cellIndex(0, y, cols)];
    if (first === 0) continue;

    let fullAndUniform = true;
    for (let x = 1; x < cols; x += 1) {
      const current = grid[cellIndex(x, y, cols)];
      if (current === 0 || current !== first) {
        fullAndUniform = false;
        break;
      }
    }

    if (!fullAndUniform) continue;

    for (let x = 0; x < cols; x += 1) {
      grid[cellIndex(x, y, cols)] = 0;
    }
    clears += 1;
  }

  return clears;
}

function applyGravityStep(grid: ShadesGrid, rows: number, cols: number): boolean {
  let changed = false;

  for (let x = 0; x < cols; x += 1) {
    let writeY = 0;

    for (let y = 0; y < rows; y += 1) {
      const readIndex = cellIndex(x, y, cols);
      const shade = grid[readIndex];
      if (shade === 0) continue;

      const writeIndex = cellIndex(x, writeY, cols);
      if (writeIndex !== readIndex) {
        grid[writeIndex] = shade;
        grid[readIndex] = 0;
        changed = true;
      }

      writeY += 1;
    }

    for (let y = writeY; y < rows; y += 1) {
      const idx = cellIndex(x, y, cols);
      if (grid[idx] !== 0) {
        grid[idx] = 0;
        changed = true;
      }
    }
  }

  return changed;
}

export function firstInvariantViolation(
  steps: readonly ResolveInvariantStep[],
  cols = SHADES_COLS
): string | null {
  for (const step of steps) {
    const expectedAfterMerge = step.before - step.merges;
    if (step.afterMerge !== expectedAfterMerge) {
      return `loop ${step.loop}: afterMerge=${step.afterMerge} expected ${expectedAfterMerge}`;
    }

    const expectedAfterClear = step.afterMerge - step.clears * cols;
    if (step.afterClear !== expectedAfterClear) {
      return `loop ${step.loop}: afterClear=${step.afterClear} expected ${expectedAfterClear}`;
    }

    if (step.afterGravity !== step.afterClear) {
      return `loop ${step.loop}: gravity changed occupied count (${step.afterClear} -> ${step.afterGravity})`;
    }
  }

  return null;
}

export function resolveStable(
  grid: ShadesGrid,
  options: {
    rows?: number;
    cols?: number;
    maxShade?: number;
    maxResolveLoops?: number;
    strictInvariants?: boolean;
  } = {}
): ResolveResult {
  const rows = options.rows ?? SHADES_ROWS;
  const cols = options.cols ?? SHADES_COLS;
  const maxShade = options.maxShade ?? SHADES_MAX_SHADE;
  const maxResolveLoops = options.maxResolveLoops ?? SHADES_MAX_RESOLVE_LOOPS;

  const working = cloneGrid(grid);
  const invariants: ResolveInvariantStep[] = [];

  let totalMerges = 0;
  let totalClears = 0;
  let hadEffect = false;

  for (let loop = 0; loop < maxResolveLoops; loop += 1) {
    let changed = false;

    const before = countOccupied(working);

    const merges = mergeVerticalStep(working, rows, cols, maxShade);
    if (merges > 0) {
      changed = true;
      hadEffect = true;
    }
    const afterMerge = countOccupied(working);

    const clears = clearUniformRowsStep(working, rows, cols);
    if (clears > 0) {
      changed = true;
      hadEffect = true;
    }
    const afterClear = countOccupied(working);

    const gravityChanged = applyGravityStep(working, rows, cols);
    if (gravityChanged) {
      changed = true;
      hadEffect = true;
    }
    const afterGravity = countOccupied(working);

    invariants.push({
      loop: loop + 1,
      before,
      merges,
      afterMerge,
      clears,
      afterClear,
      afterGravity,
    });

    totalMerges += merges;
    totalClears += clears;

    if (!changed) break;
  }

  if (options.strictInvariants) {
    const violation = firstInvariantViolation(invariants, cols);
    if (violation) {
      throw new Error(`Shades invariant violation: ${violation}`);
    }
  }

  return {
    grid: working,
    merges: totalMerges,
    clears: totalClears,
    hadEffect,
    loops: invariants.length,
    invariants,
  };
}

export function lockResolve(
  grid: ShadesGrid,
  active: ActiveTile,
  options: {
    rows?: number;
    cols?: number;
    maxShade?: number;
    maxResolveLoops?: number;
    strictInvariants?: boolean;
  } = {}
): LockResolveResult {
  const cols = options.cols ?? SHADES_COLS;

  const placedShade = clamp(active.shade, SHADES_MIN_SHADE, SHADES_MAX_SHADE);
  const placedGrid = lockTile(grid, { ...active, shade: placedShade }, { cols });

  const resolved = resolveStable(placedGrid, options);

  return {
    ...resolved,
    placedShade,
    placedX: active.x,
    placedY: active.y,
  };
}
