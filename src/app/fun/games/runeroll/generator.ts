import { rotateFaces } from './engine';
import {
  createInitialFaces,
  getTileAt,
  keyForGridPos,
  normalizeRuneColor,
  type Direction,
  type FaceColors,
  type GridPos,
  type Level,
  type Tile,
} from './levels';

const PROC_COLORS = ['#ff0044', '#3399ff', '#00ffaa', '#ffaa00'] as const;

type ReplayResult =
  | { valid: true }
  | { valid: false; reason: string; step: number };

const moveDirection = (from: GridPos, to: GridPos): Direction => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];

  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === 0 && dy === -1) return 'up';

  throw new Error(
    `Non-adjacent path segment from [${from[0]},${from[1]}] to [${to[0]},${to[1]}].`
  );
};

const applyTileRules = (
  faces: FaceColors,
  tile: Tile,
  tilePos: GridPos,
  consumedPickups: Set<string>
): ReplayResult => {
  if (tile.type === 'wipe') {
    faces[1] = null;
    return { valid: true };
  }

  if (tile.type === 'pickup') {
    const key = keyForGridPos(tilePos);
    faces[1] = tile.color;
    if (!consumedPickups.has(key)) {
      consumedPickups.add(key);
    }
    return { valid: true };
  }

  if (
    tile.type === 'match' &&
    normalizeRuneColor(faces[1] ?? '') !== normalizeRuneColor(tile.color)
  ) {
    return {
      valid: false,
      step: -1,
      reason: `Match tile at [${tilePos[0]},${tilePos[1]}] expected ${tile.color}, got ${
        faces[1] ?? 'null'
      }.`,
    };
  }

  return { valid: true };
};

export const generateHamiltonianPath = (size: number): GridPos[] => {
  if (!Number.isInteger(size) || size < 2) {
    throw new Error(`Level size must be an integer >= 2, received ${size}.`);
  }

  const path: GridPos[] = [];
  for (let y = 0; y < size; y += 1) {
    if (y % 2 === 0) {
      for (let x = 0; x < size; x += 1) {
        path.push([x, y]);
      }
    } else {
      for (let x = size - 1; x >= 0; x -= 1) {
        path.push([x, y]);
      }
    }
  }

  return path;
};

export const replayLevelPath = (level: Level, path: GridPos[]): ReplayResult => {
  if (path.length < 2) {
    return {
      valid: false,
      step: 0,
      reason: 'Path must have at least 2 positions.',
    };
  }

  const startTile = getTileAt(level, path[0]);
  if (!startTile || startTile.type !== 'start') {
    return {
      valid: false,
      step: 0,
      reason: 'Path must start on a start tile.',
    };
  }

  const consumedPickups = new Set<string>();
  let faces = createInitialFaces();

  for (let i = 1; i < path.length; i += 1) {
    const previous = path[i - 1];
    const current = path[i];

    const direction = moveDirection(previous, current);
    faces = rotateFaces(faces, direction);

    const tile = getTileAt(level, current);
    if (!tile) {
      return {
        valid: false,
        step: i,
        reason: `Path moved to undeclared tile at [${current[0]},${current[1]}].`,
      };
    }

    const interaction = applyTileRules(faces, tile, current, consumedPickups);
    if (!interaction.valid) {
      const reason = 'reason' in interaction ? interaction.reason : 'Unknown tile interaction failure.';
      return {
        valid: false,
        step: i,
        reason,
      };
    }
  }

  const finalTile = getTileAt(level, path[path.length - 1]);
  if (!finalTile || finalTile.type !== 'end') {
    return {
      valid: false,
      step: path.length - 1,
      reason: 'Path must end on an end tile.',
    };
  }

  return { valid: true };
};

export const generateSolvableLevelWithPath = (size: number) => {
  const path = generateHamiltonianPath(size);
  const tiles: Tile[] = [{ type: 'start', pos: path[0] }];

  let faces = createInitialFaces();
  let colorIndex = 0;

  for (let i = 1; i < path.length - 1; i += 1) {
    const previous = path[i - 1];
    const current = path[i];
    const direction = moveDirection(previous, current);
    faces = rotateFaces(faces, direction);

    if (i % 8 === 0 && faces[1] !== null) {
      tiles.push({ type: 'wipe', pos: current });
      faces[1] = null;
      continue;
    }

    if (i % 5 === 0 && faces[1] === null) {
      const color = PROC_COLORS[colorIndex % PROC_COLORS.length];
      colorIndex += 1;
      tiles.push({ type: 'pickup', pos: current, color });
      faces[1] = color;
      continue;
    }

    if (i % 6 === 0 && faces[1] !== null) {
      tiles.push({ type: 'match', pos: current, color: faces[1] });
      continue;
    }

    tiles.push({ type: 'floor', pos: current });
  }

  tiles.push({ type: 'end', pos: path[path.length - 1] });

  const level: Level = {
    id: `PROC_${Date.now()}`,
    width: size,
    height: size,
    parMoves: path.length - 1,
    tiles,
  };

  const replay = replayLevelPath(level, path);
  if (!replay.valid) {
    const { step, reason } = replay as Extract<ReplayResult, { valid: false }>;
    throw new Error(`Generated level failed replay validation at step ${step}: ${reason}`);
  }

  return { level, path };
};

export const generateSolvableLevel = (size: number): Level =>
  generateSolvableLevelWithPath(size).level;
