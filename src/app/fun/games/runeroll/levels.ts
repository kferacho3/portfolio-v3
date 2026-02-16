export type FaceColor = string | null;

export type FaceColors = [
  FaceColor,
  FaceColor,
  FaceColor,
  FaceColor,
  FaceColor,
  FaceColor,
];

export type GridPos = [number, number];

export type Direction = 'up' | 'down' | 'left' | 'right';

export type Tile =
  | { type: 'start'; pos: [number, number] }
  | { type: 'floor'; pos: [number, number] }
  | { type: 'pickup'; pos: [number, number]; color: string; consumed?: boolean }
  | { type: 'match'; pos: [number, number]; color: string }
  | { type: 'wipe'; pos: [number, number] }
  | { type: 'end'; pos: [number, number] };

export interface Level {
  id: string;
  width: number;
  height: number;
  parMoves: number;
  tiles: Tile[];
}

export const RUNE_COLOR_LEGEND = [
  { color: '#3399ff', edge: '#235ea8', name: 'Azure' },
  { color: '#ff0044', edge: '#a8123f', name: 'Rose' },
  { color: '#00ffaa', edge: '#10906d', name: 'Moss' },
  { color: '#ffaa00', edge: '#946837', name: 'Amber' },
  { color: '#00ccff', edge: '#167ea3', name: 'Cyan' },
] as const;

type LevelBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type LevelCache = {
  start: GridPos;
  end: GridPos | null;
  bounds: LevelBounds;
  tiles: Tile[];
  tileMap: Map<string, Tile>;
};

const levelCache = new WeakMap<Level, LevelCache>();
const edgeColorByHex = new Map<string, string>();
const nameByHex = new Map<string, string>();

for (const rune of RUNE_COLOR_LEGEND) {
  edgeColorByHex.set(rune.color, rune.edge);
  nameByHex.set(rune.color, rune.name);
}

export const normalizeRuneColor = (color: string) => color.trim().toLowerCase();

export const runeColorName = (color: string) =>
  nameByHex.get(normalizeRuneColor(color)) ?? color.toUpperCase();

export const runeEdgeColor = (color: string) =>
  edgeColorByHex.get(normalizeRuneColor(color)) ?? normalizeRuneColor(color);

export const keyForGridPos = (position: GridPos) => `${position[0]},${position[1]}`;

const sortedTiles = (tiles: Tile[]) =>
  [...tiles].sort((a, b) => {
    if (a.pos[1] !== b.pos[1]) return a.pos[1] - b.pos[1];
    return a.pos[0] - b.pos[0];
  });

const createOpenGridLevel = (level: Level): Level => {
  const specials = new Map<string, Tile>();

  for (const tile of level.tiles) {
    specials.set(keyForGridPos(tile.pos), tile);
  }

  const tiles: Tile[] = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const key = keyForGridPos([x, y]);
      tiles.push(specials.get(key) ?? { type: 'floor', pos: [x, y] });
    }
  }

  return {
    ...level,
    tiles,
  };
};

const buildLevelCache = (level: Level): LevelCache => {
  if (level.width < 1 || level.height < 1) {
    throw new Error(`Rune Roll level ${level.id} must have positive width/height.`);
  }

  const tileMap = new Map<string, Tile>();
  let start: GridPos | null = null;
  let end: GridPos | null = null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const tile of level.tiles) {
    const [x, y] = tile.pos;
    if (x < 0 || x >= level.width || y < 0 || y >= level.height) {
      throw new Error(`Rune Roll level ${level.id} has out-of-bounds tile at [${x}, ${y}].`);
    }

    const key = keyForGridPos(tile.pos);
    if (tileMap.has(key)) {
      throw new Error(`Rune Roll level ${level.id} has duplicate tile at [${x}, ${y}].`);
    }

    tileMap.set(key, tile);

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    if (tile.type === 'start') {
      start = [x, y];
    } else if (tile.type === 'end') {
      end = [x, y];
    }
  }

  if (!start) {
    throw new Error(`Rune Roll level ${level.id} is missing a start tile.`);
  }

  return {
    start,
    end,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
    },
    tiles: sortedTiles(level.tiles),
    tileMap,
  };
};

const getLevelCache = (level: Level) => {
  const cached = levelCache.get(level);
  if (cached) {
    return cached;
  }

  const next = buildLevelCache(level);
  levelCache.set(level, next);
  return next;
};

export const getTileAt = (level: Level, position: GridPos): Tile | undefined => {
  const [x, y] = position;
  if (x < 0 || x >= level.width || y < 0 || y >= level.height) {
    return undefined;
  }

  return getLevelCache(level).tileMap.get(keyForGridPos(position));
};

export const getLevelStart = (level: Level): GridPos => getLevelCache(level).start;

export const getLevelEnd = (level: Level): GridPos | null => getLevelCache(level).end;

export const getLevelBounds = (level: Level): LevelBounds => getLevelCache(level).bounds;

export const getLevelTiles = (level: Level): Tile[] => getLevelCache(level).tiles;

export const LEVEL_02: Level = {
  id: 'RUNE_02',
  width: 4,
  height: 3,
  parMoves: 6,
  tiles: [
    { type: 'start', pos: [0, 0] },
    { type: 'floor', pos: [1, 0] },
    { type: 'pickup', pos: [2, 0], color: '#3399ff' },
    { type: 'floor', pos: [2, 1] },
    { type: 'floor', pos: [1, 1] },
    { type: 'match', pos: [0, 1], color: '#3399ff' },
    { type: 'end', pos: [0, 2] },
  ],
};

export const LEVEL_03: Level = {
  id: 'RUNE_03',
  width: 4,
  height: 3,
  parMoves: 10,
  tiles: [
    { type: 'start', pos: [0, 0] },
    { type: 'pickup', pos: [1, 0], color: '#ff0044' },
    { type: 'floor', pos: [2, 0] },
    { type: 'pickup', pos: [2, 1], color: '#00ffaa' },
    { type: 'match', pos: [1, 1], color: '#ff0044' },
    { type: 'match', pos: [0, 1], color: '#00ffaa' },
    { type: 'end', pos: [0, 2] },
  ],
};

export const LEVEL_04: Level = {
  id: 'RUNE_04',
  width: 5,
  height: 3,
  parMoves: 12,
  tiles: [
    { type: 'start', pos: [0, 1] },
    { type: 'pickup', pos: [1, 1], color: '#ffaa00' },
    { type: 'floor', pos: [2, 1] },
    { type: 'pickup', pos: [3, 1], color: '#00ccff' },
    { type: 'match', pos: [2, 0], color: '#ffaa00' },
    { type: 'match', pos: [2, 2], color: '#00ccff' },
    { type: 'end', pos: [4, 1] },
  ],
};

export const LEVEL_05: Level = {
  id: 'RUNE_05',
  width: 5,
  height: 5,
  parMoves: 14,
  tiles: [
    { type: 'start', pos: [2, 2] },
    { type: 'pickup', pos: [2, 0], color: '#ff0044' },
    { type: 'pickup', pos: [4, 2], color: '#3399ff' },
    { type: 'match', pos: [2, 4], color: '#ff0044' },
    { type: 'match', pos: [0, 2], color: '#3399ff' },
    { type: 'end', pos: [2, 3] },
  ],
};

export const LEVEL_06: Level = {
  id: 'RUNE_06',
  width: 6,
  height: 3,
  parMoves: 16,
  tiles: [
    { type: 'start', pos: [0, 1] },
    { type: 'pickup', pos: [1, 1], color: '#ff0044' },
    { type: 'pickup', pos: [3, 1], color: '#00ffaa' },
    { type: 'pickup', pos: [5, 1], color: '#ffaa00' },
    { type: 'match', pos: [2, 0], color: '#ff0044' },
    { type: 'match', pos: [4, 2], color: '#00ffaa' },
    { type: 'end', pos: [5, 0] },
  ],
};

export const LEVEL_07: Level = {
  id: 'RUNE_07',
  width: 5,
  height: 4,
  parMoves: 18,
  tiles: [
    { type: 'start', pos: [0, 0] },
    { type: 'pickup', pos: [1, 0], color: '#ff0044' },
    { type: 'wipe', pos: [2, 0] },
    { type: 'pickup', pos: [2, 1], color: '#3399ff' },
    { type: 'match', pos: [1, 2], color: '#3399ff' },
    { type: 'match', pos: [0, 2], color: '#ff0044' },
    { type: 'end', pos: [0, 3] },
  ],
};

export const LEVEL_08: Level = {
  id: 'RUNE_08',
  width: 6,
  height: 6,
  parMoves: 22,
  tiles: [
    { type: 'start', pos: [3, 3] },
    { type: 'pickup', pos: [3, 0], color: '#ff0044' },
    { type: 'pickup', pos: [5, 3], color: '#00ffaa' },
    { type: 'pickup', pos: [3, 5], color: '#3399ff' },
    { type: 'match', pos: [0, 3], color: '#ff0044' },
    { type: 'match', pos: [2, 2], color: '#00ffaa' },
    { type: 'match', pos: [4, 4], color: '#3399ff' },
    { type: 'end', pos: [3, 4] },
  ],
};

export const LEVEL_09: Level = {
  id: 'RUNE_09',
  width: 7,
  height: 5,
  parMoves: 26,
  tiles: [
    { type: 'start', pos: [0, 2] },
    { type: 'pickup', pos: [2, 2], color: '#ff0044' },
    { type: 'pickup', pos: [4, 2], color: '#00ffaa' },
    { type: 'match', pos: [3, 0], color: '#ff0044' },
    { type: 'match', pos: [6, 2], color: '#00ffaa' },
    { type: 'pickup', pos: [3, 4], color: '#ffaa00' },
    { type: 'match', pos: [1, 4], color: '#ffaa00' },
    { type: 'end', pos: [6, 4] },
  ],
};

export const LEVEL_10: Level = {
  id: 'RUNE_10',
  width: 7,
  height: 7,
  parMoves: 32,
  tiles: [
    { type: 'start', pos: [3, 3] },
    { type: 'pickup', pos: [3, 1], color: '#ff0044' },
    { type: 'pickup', pos: [5, 3], color: '#3399ff' },
    { type: 'pickup', pos: [3, 5], color: '#00ffaa' },
    { type: 'match', pos: [1, 3], color: '#ff0044' },
    { type: 'match', pos: [5, 1], color: '#3399ff' },
    { type: 'match', pos: [1, 5], color: '#00ffaa' },
    { type: 'end', pos: [3, 6] },
  ],
};

export const EXPERT_01: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_01',
  width: 9,
  height: 9,
  parMoves: 42,
  tiles: [
    { type: 'start', pos: [4, 4] },
    { type: 'pickup', pos: [4, 1], color: '#ff0044' },
    { type: 'pickup', pos: [7, 4], color: '#00ffaa' },
    { type: 'pickup', pos: [4, 7], color: '#3399ff' },
    { type: 'pickup', pos: [1, 4], color: '#ffaa00' },
    { type: 'match', pos: [2, 2], color: '#ff0044' },
    { type: 'match', pos: [6, 2], color: '#00ffaa' },
    { type: 'match', pos: [6, 6], color: '#3399ff' },
    { type: 'match', pos: [2, 6], color: '#ffaa00' },
    { type: 'end', pos: [4, 8] },
  ],
});

export const EXPERT_02: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_02',
  width: 10,
  height: 6,
  parMoves: 44,
  tiles: [
    { type: 'start', pos: [0, 3] },
    { type: 'pickup', pos: [2, 3], color: '#ff0044' },
    { type: 'wipe', pos: [3, 3] },
    { type: 'pickup', pos: [5, 3], color: '#3399ff' },
    { type: 'wipe', pos: [6, 3] },
    { type: 'pickup', pos: [8, 3], color: '#00ffaa' },
    { type: 'match', pos: [9, 1], color: '#ff0044' },
    { type: 'match', pos: [9, 3], color: '#3399ff' },
    { type: 'match', pos: [9, 5], color: '#00ffaa' },
    { type: 'end', pos: [0, 5] },
  ],
});

export const EXPERT_03: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_03',
  width: 11,
  height: 11,
  parMoves: 48,
  tiles: [
    { type: 'start', pos: [5, 5] },
    { type: 'pickup', pos: [5, 1], color: '#ff0044' },
    { type: 'pickup', pos: [9, 5], color: '#00ffaa' },
    { type: 'pickup', pos: [5, 9], color: '#3399ff' },
    { type: 'pickup', pos: [1, 5], color: '#ffaa00' },
    { type: 'match', pos: [3, 3], color: '#ffaa00' },
    { type: 'match', pos: [7, 3], color: '#ff0044' },
    { type: 'match', pos: [7, 7], color: '#00ffaa' },
    { type: 'match', pos: [3, 7], color: '#3399ff' },
    { type: 'end', pos: [10, 10] },
  ],
});

export const EXPERT_04: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_04',
  width: 8,
  height: 8,
  parMoves: 46,
  tiles: [
    { type: 'start', pos: [0, 0] },
    { type: 'pickup', pos: [1, 2], color: '#ff0044' },
    { type: 'pickup', pos: [3, 4], color: '#3399ff' },
    { type: 'pickup', pos: [5, 2], color: '#00ffaa' },
    { type: 'pickup', pos: [6, 6], color: '#ffaa00' },
    { type: 'match', pos: [2, 6], color: '#ff0044' },
    { type: 'match', pos: [4, 6], color: '#3399ff' },
    { type: 'match', pos: [6, 4], color: '#00ffaa' },
    { type: 'match', pos: [7, 7], color: '#ffaa00' },
    { type: 'end', pos: [0, 7] },
  ],
});

export const EXPERT_05: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_05',
  width: 12,
  height: 5,
  parMoves: 50,
  tiles: [
    { type: 'start', pos: [6, 2] },
    { type: 'pickup', pos: [2, 2], color: '#ff0044' },
    { type: 'pickup', pos: [9, 2], color: '#3399ff' },
    { type: 'wipe', pos: [6, 0] },
    { type: 'wipe', pos: [6, 4] },
    { type: 'match', pos: [0, 0], color: '#ff0044' },
    { type: 'match', pos: [11, 4], color: '#3399ff' },
    { type: 'end', pos: [11, 2] },
  ],
});

export const EXPERT_06: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_06',
  width: 9,
  height: 9,
  parMoves: 52,
  tiles: [
    { type: 'start', pos: [4, 4] },
    { type: 'pickup', pos: [0, 4], color: '#ff0044' },
    { type: 'pickup', pos: [8, 4], color: '#3399ff' },
    { type: 'pickup', pos: [4, 0], color: '#00ffaa' },
    { type: 'pickup', pos: [4, 8], color: '#ffaa00' },
    { type: 'match', pos: [2, 2], color: '#ffaa00' },
    { type: 'match', pos: [6, 2], color: '#ff0044' },
    { type: 'match', pos: [6, 6], color: '#3399ff' },
    { type: 'match', pos: [2, 6], color: '#00ffaa' },
    { type: 'end', pos: [8, 8] },
  ],
});

export const EXPERT_07: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_07',
  width: 7,
  height: 12,
  parMoves: 54,
  tiles: [
    { type: 'start', pos: [3, 0] },
    { type: 'pickup', pos: [3, 2], color: '#ff0044' },
    { type: 'pickup', pos: [3, 5], color: '#3399ff' },
    { type: 'pickup', pos: [3, 8], color: '#00ffaa' },
    { type: 'wipe', pos: [1, 6] },
    { type: 'match', pos: [6, 4], color: '#ff0044' },
    { type: 'match', pos: [6, 7], color: '#3399ff' },
    { type: 'match', pos: [6, 10], color: '#00ffaa' },
    { type: 'end', pos: [3, 11] },
  ],
});

export const EXPERT_08: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_08',
  width: 13,
  height: 13,
  parMoves: 60,
  tiles: [
    { type: 'start', pos: [6, 6] },
    { type: 'pickup', pos: [6, 1], color: '#ff0044' },
    { type: 'pickup', pos: [11, 6], color: '#3399ff' },
    { type: 'pickup', pos: [6, 11], color: '#00ffaa' },
    { type: 'pickup', pos: [1, 6], color: '#ffaa00' },
    { type: 'match', pos: [3, 3], color: '#ffaa00' },
    { type: 'match', pos: [9, 3], color: '#ff0044' },
    { type: 'match', pos: [9, 9], color: '#3399ff' },
    { type: 'match', pos: [3, 9], color: '#00ffaa' },
    { type: 'end', pos: [12, 12] },
  ],
});

export const EXPERT_09: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_09',
  width: 14,
  height: 4,
  parMoves: 62,
  tiles: [
    { type: 'start', pos: [0, 2] },
    { type: 'pickup', pos: [3, 2], color: '#ff0044' },
    { type: 'pickup', pos: [6, 2], color: '#3399ff' },
    { type: 'pickup', pos: [9, 2], color: '#00ffaa' },
    { type: 'pickup', pos: [12, 2], color: '#ffaa00' },
    { type: 'match', pos: [13, 0], color: '#ff0044' },
    { type: 'match', pos: [13, 1], color: '#3399ff' },
    { type: 'match', pos: [13, 2], color: '#00ffaa' },
    { type: 'match', pos: [13, 3], color: '#ffaa00' },
    { type: 'end', pos: [0, 3] },
  ],
});

export const EXPERT_10: Level = createOpenGridLevel({
  id: 'RUNE_EXPERT_10',
  width: 15,
  height: 15,
  parMoves: 70,
  tiles: [
    { type: 'start', pos: [7, 7] },
    { type: 'pickup', pos: [7, 1], color: '#ff0044' },
    { type: 'pickup', pos: [13, 7], color: '#3399ff' },
    { type: 'pickup', pos: [7, 13], color: '#00ffaa' },
    { type: 'pickup', pos: [1, 7], color: '#ffaa00' },
    { type: 'match', pos: [3, 3], color: '#ffaa00' },
    { type: 'match', pos: [11, 3], color: '#ff0044' },
    { type: 'match', pos: [11, 11], color: '#3399ff' },
    { type: 'match', pos: [3, 11], color: '#00ffaa' },
    { type: 'end', pos: [14, 14] },
  ],
});

export const BASE_LEVELS: Level[] = [
  LEVEL_02,
  LEVEL_03,
  LEVEL_04,
  LEVEL_05,
  LEVEL_06,
  LEVEL_07,
  LEVEL_08,
  LEVEL_09,
  LEVEL_10,
];

export const EXPERT_LEVELS: Level[] = [
  EXPERT_01,
  EXPERT_02,
  EXPERT_03,
  EXPERT_04,
  EXPERT_05,
  EXPERT_06,
  EXPERT_07,
  EXPERT_08,
  EXPERT_09,
  EXPERT_10,
];

export const LEVELS: Level[] = [...BASE_LEVELS, ...EXPERT_LEVELS];

export const RUNE_LEVELS = LEVELS;

export const createInitialFaces = (): FaceColors => [null, null, null, null, null, null];
