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
  renderTiles: Tile[];
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

const buildLevelCache = (level: Level): LevelCache => {
  const tileMap = new Map<string, Tile>();
  let start: GridPos | null = null;
  let end: GridPos | null = null;

  for (const tile of level.tiles) {
    const [x, y] = tile.pos;
    if (x < 0 || x >= level.width || y < 0 || y >= level.height) {
      throw new Error(`Rune Roll level ${level.id} has out-of-bounds tile at [${x}, ${y}].`);
    }
    const key = keyForGridPos(tile.pos);
    tileMap.set(key, tile);

    if (tile.type === 'start') {
      start = [x, y];
    } else if (tile.type === 'end') {
      end = [x, y];
    }
  }

  if (!start) {
    throw new Error(`Rune Roll level ${level.id} is missing a start tile.`);
  }

  const renderTiles: Tile[] = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const key = keyForGridPos([x, y]);
      renderTiles.push(tileMap.get(key) ?? { type: 'floor', pos: [x, y] });
    }
  }

  return {
    start,
    end,
    bounds: {
      minX: 0,
      maxX: level.width - 1,
      minY: 0,
      maxY: level.height - 1,
    },
    renderTiles,
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

  const cached = getLevelCache(level);
  return cached.tileMap.get(keyForGridPos(position)) ?? { type: 'floor', pos: [x, y] };
};

export const getLevelStart = (level: Level): GridPos => getLevelCache(level).start;

export const getLevelEnd = (level: Level): GridPos | null => getLevelCache(level).end;

export const getLevelBounds = (level: Level): LevelBounds => getLevelCache(level).bounds;

export const getLevelTiles = (level: Level): Tile[] => getLevelCache(level).renderTiles;

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

export const LEVELS: Level[] = [
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

export const RUNE_LEVELS = LEVELS;

export const createInitialFaces = (): FaceColors => [null, null, null, null, null, null];
