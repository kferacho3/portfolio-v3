export type RuneColorId = 0 | 1 | 2 | 3;

export type FaceColor = RuneColorId | null;

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
  | {
      kind: 'start' | 'floor' | 'end';
    }
  | {
      kind: 'pickup' | 'gate';
      color: RuneColorId;
    };

export type RuneLevel = {
  id: string;
  title: string;
  par: number;
  width: number;
  height: number;
  start: GridPos;
  end: GridPos;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  tiles: Array<{
    key: string;
    position: GridPos;
    tile: Tile;
  }>;
  tileMap: Map<string, Tile>;
};

type RawLevel = {
  id: string;
  title: string;
  par: number;
  rows: string[];
};

export const RUNE_NAMES = ['Azure', 'Rose', 'Moss', 'Amber'] as const;

export const RUNE_COLORS = [
  '#2fd8ff',
  '#ff64be',
  '#9af463',
  '#ffc56f',
] as const;

export const RUNE_EDGE_COLORS = [
  '#167ea3',
  '#9b3f79',
  '#578d37',
  '#946837',
] as const;

const PICKUP_SYMBOL_TO_COLOR: Record<string, RuneColorId> = {
  A: 0,
  R: 1,
  G: 2,
  Y: 3,
};

const GATE_SYMBOL_TO_COLOR: Record<string, RuneColorId> = {
  a: 0,
  r: 1,
  g: 2,
  y: 3,
};

const keyFor = (x: number, y: number) => `${x},${y}`;

const RAW_LEVELS: RawLevel[] = [
  {
    id: 'rune-01',
    title: 'First Mark',
    par: 3,
    rows: ['#######', '#S.AE##', '#######'],
  },
  {
    id: 'rune-02',
    title: 'Azure Gate',
    par: 10,
    rows: ['#######', '#SaE###', '#..####', '#A..###', '#######'],
  },
  {
    id: 'rune-03',
    title: 'Rose Gate',
    par: 10,
    rows: ['#######', '#SrE###', '#..####', '#R..###', '#######'],
  },
  {
    id: 'rune-04',
    title: 'Moss Gate',
    par: 10,
    rows: ['#######', '#SgE###', '#..####', '#G..###', '#######'],
  },
  {
    id: 'rune-05',
    title: 'Amber Gate',
    par: 10,
    rows: ['#######', '#SyE###', '#..####', '#Y..###', '#######'],
  },
  {
    id: 'rune-06',
    title: 'Twin Azure',
    par: 18,
    rows: ['############', '#Sa.aE######', '#..#########', '#A..########', '############'],
  },
  {
    id: 'rune-07',
    title: 'Dual Sigils',
    par: 16,
    rows: ['#########', '#Sa.rE###', '#..#.####', '#A..R.###', '#########'],
  },
  {
    id: 'rune-08',
    title: 'Verdant Pair',
    par: 16,
    rows: ['#########', '#Sg.yE###', '#..#.####', '#G..Y.###', '#########'],
  },
  {
    id: 'rune-09',
    title: 'Split Keys',
    par: 16,
    rows: ['###########', '#Sa.gE#####', '#..#.######', '#A..G.#####', '###########'],
  },
  {
    id: 'rune-10',
    title: 'Triple Azure',
    par: 20,
    rows: ['#############', '#Sa.a.aE#####', '#..##########', '#A..#########', '#############'],
  },
  {
    id: 'rune-11',
    title: 'Triple Verdant',
    par: 18,
    rows: ['##############', '#Sg.y.gE######', '#..#.#########', '#G..Y.########', '##############'],
  },
  {
    id: 'rune-12',
    title: 'Grand Archive',
    par: 38,
    rows: [
      '###############',
      '#Sr.y.aE#######',
      '#..#.##########',
      '#R..Y..A#######',
      '###############',
    ],
  },
];

const parseLevel = (raw: RawLevel): RuneLevel => {
  const width = Math.max(...raw.rows.map((row) => row.length));
  const height = raw.rows.length;
  const tileMap = new Map<string, Tile>();
  const tiles: RuneLevel['tiles'] = [];

  let start: GridPos | null = null;
  let end: GridPos | null = null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const addTile = (x: number, y: number, tile: Tile) => {
    const key = keyFor(x, y);
    tileMap.set(key, tile);
    tiles.push({
      key,
      position: [x, y],
      tile,
    });

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };

  for (let y = 0; y < raw.rows.length; y += 1) {
    const row = raw.rows[y] ?? '';
    for (let x = 0; x < width; x += 1) {
      const symbol = row[x] ?? '#';

      if (symbol === '#' || symbol === ' ') {
        continue;
      }

      if (symbol === '.') {
        addTile(x, y, { kind: 'floor' });
        continue;
      }

      if (symbol === 'S') {
        start = [x, y];
        addTile(x, y, { kind: 'start' });
        continue;
      }

      if (symbol === 'E') {
        end = [x, y];
        addTile(x, y, { kind: 'end' });
        continue;
      }

      const pickupColor = PICKUP_SYMBOL_TO_COLOR[symbol];
      if (pickupColor !== undefined) {
        addTile(x, y, {
          kind: 'pickup',
          color: pickupColor,
        });
        continue;
      }

      const gateColor = GATE_SYMBOL_TO_COLOR[symbol];
      if (gateColor !== undefined) {
        addTile(x, y, {
          kind: 'gate',
          color: gateColor,
        });
        continue;
      }

      throw new Error(`Unknown Rune Roll tile symbol "${symbol}" in ${raw.id}.`);
    }
  }

  if (!start) {
    throw new Error(`Rune Roll level ${raw.id} is missing a start tile.`);
  }

  if (!end) {
    throw new Error(`Rune Roll level ${raw.id} is missing an end tile.`);
  }

  return {
    id: raw.id,
    title: raw.title,
    par: raw.par,
    width,
    height,
    start,
    end,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
    },
    tiles,
    tileMap,
  };
};

export const RUNE_LEVELS = RAW_LEVELS.map(parseLevel);

export const getTileAt = (level: RuneLevel, position: GridPos): Tile | undefined =>
  level.tileMap.get(keyFor(position[0], position[1]));

export const createInitialFaces = (): FaceColors => [null, null, null, null, null, null];
