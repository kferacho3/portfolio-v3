// Auto-generated level pack for Rune Roll (WebGL / React Three Fiber)
// Format: ASCII maps compiled to strict Tile[] at module load.
// Legend:
//  # = void (no tile)
//  . = floor
//  S = start
//  E = end
//  r,g,b,y = pickup (red, green, blue, yellow)
//  R,G,B,Y = match gate (requires bottom face color)
//  W = wipe (sets bottom face to null)

import { LEVEL_DEFS } from '../../../../rune/levels/defs';
import { LEVEL_DEFS_INTRICATE } from '../../../../rune/levels/defs_intricate';
import type { LevelDef as RuneGridLevelDef } from '../../../../rune/levels/types';
import { EXPERT_LEVELS, STANDARDIZED_LEVELS } from './levels.authored';

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
  parMoves: number; // computed as optimal solution length under the current rules
  tiles: Tile[];
}

export const PALETTE = {
  r: '#ff0044', // Rune Red
  g: '#00ffaa', // Rune Green (neon mint)
  b: '#3399ff', // Rune Blue
  y: '#ffaa00', // Rune Gold
} as const;

export const RUNE_COLOR_LEGEND = [
  { color: PALETTE.b, edge: '#235ea8', name: 'Azure' },
  { color: PALETTE.r, edge: '#a8123f', name: 'Rose' },
  { color: PALETTE.g, edge: '#10906d', name: 'Moss' },
  { color: PALETTE.y, edge: '#946837', name: 'Amber' },
] as const;

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

type AsciiLevelDef = {
  id: string;
  parMoves: number;
  map: string[];
};

export function levelFromAscii(def: AsciiLevelDef): Level {
  const { id, parMoves, map } = def;
  if (!map.length) throw new Error(`Level ${id}: map is empty`);
  const height = map.length;
  const width = map[0].length;
  if (!map.every((r) => r.length === width)) {
    throw new Error(`Level ${id}: map rows must all have the same width`);
  }

  let startCount = 0;
  let endCount = 0;

  const tiles: Tile[] = [];

  for (let z = 0; z < height; z++) {
    const row = map[z];
    for (let x = 0; x < width; x++) {
      const ch = row[x];

      if (ch === '#' || ch === ' ') continue;

      if (ch === '.') {
        tiles.push({ type: 'floor', pos: [x, z] });
        continue;
      }

      if (ch === 'S') {
        startCount++;
        tiles.push({ type: 'start', pos: [x, z] });
        continue;
      }

      if (ch === 'E') {
        endCount++;
        tiles.push({ type: 'end', pos: [x, z] });
        continue;
      }

      if (ch === 'W') {
        tiles.push({ type: 'wipe', pos: [x, z] });
        continue;
      }

      // Pickup
      if (ch === 'r' || ch === 'g' || ch === 'b' || ch === 'y') {
        tiles.push({ type: 'pickup', pos: [x, z], color: PALETTE[ch] });
        continue;
      }

      // Match gate
      if (ch === 'R' || ch === 'G' || ch === 'B' || ch === 'Y') {
        const key = ch.toLowerCase() as keyof typeof PALETTE;
        tiles.push({ type: 'match', pos: [x, z], color: PALETTE[key] });
        continue;
      }

      throw new Error(`Level ${id}: unknown char '${ch}' at (${x},${z})`);
    }
  }

  if (startCount !== 1) throw new Error(`Level ${id}: expected exactly 1 start, got ${startCount}`);
  if (endCount !== 1) throw new Error(`Level ${id}: expected exactly 1 end, got ${endCount}`);

  // Extra safety: disallow duplicate positions
  const seen = new Set<string>();
  for (const t of tiles) {
    const k = `${t.pos[0]},${t.pos[1]}`;
    if (seen.has(k)) throw new Error(`Level ${id}: duplicate tile at ${k}`);
    seen.add(k);
  }

  return { id, width, height, parMoves, tiles };
}

export const LEVEL_01 = levelFromAscii({
  id: 'RUNE_01',
  parMoves: 9,
  map: [
    "###.#E",
    "##....",
    "#.#B..",
    "....##",
    "Sb..##",
    "##..##"
  ],
});

export const LEVEL_02 = levelFromAscii({
  id: 'RUNE_02',
  parMoves: 8,
  map: [
    "S##",
    "..#",
    ".y#",
    ".Y#",
    "#.E"
  ],
});

export const LEVEL_03 = levelFromAscii({
  id: 'RUNE_03',
  parMoves: 12,
  map: [
    "S..#",
    "#Bb#",
    "..##",
    "...#",
    "....",
    ".#.E"
  ],
});

export const LEVEL_04 = levelFromAscii({
  id: 'RUNE_04',
  parMoves: 13,
  map: [
    "#E#.##",
    "..#g.S",
    ".G...."
  ],
});

export const LEVEL_05 = levelFromAscii({
  id: 'RUNE_05',
  parMoves: 12,
  map: [
    "###..S",
    "..b...",
    ".B...#",
    "#.#.##",
    "#E####"
  ],
});

export const LEVEL_06 = levelFromAscii({
  id: 'RUNE_06',
  parMoves: 9,
  map: [
    "#S...##",
    ".....##",
    "#G...g.",
    "##...#.",
    "####..E",
    "####.##"
  ],
});

export const LEVEL_07 = levelFromAscii({
  id: 'RUNE_07',
  parMoves: 11,
  map: [
    "..r...S",
    "#......",
    "##...##",
    "###R.##",
    "###E###"
  ],
});

export const LEVEL_08 = levelFromAscii({
  id: 'RUNE_08',
  parMoves: 14,
  map: [
    "###...#",
    "###..##",
    "E..Y..y",
    "###...#",
    "###.S##"
  ],
});

export const LEVEL_09 = levelFromAscii({
  id: 'RUNE_09',
  parMoves: 10,
  map: [
    "###...E",
    "...B...",
    "....#.#",
    "#S.b###"
  ],
});

export const LEVEL_10 = levelFromAscii({
  id: 'RUNE_10',
  parMoves: 12,
  map: [
    "#S.",
    "#..",
    "#.r",
    "#..",
    "#..",
    "ER."
  ],
});

export const LEVEL_11 = levelFromAscii({
  id: 'RUNE_11',
  parMoves: 26,
  map: [
    "...yS",
    ".....",
    "#Y###",
    "#..##",
    "r.###",
    "..R.#",
    "##E##"
  ],
});

export const LEVEL_12 = levelFromAscii({
  id: 'RUNE_12',
  parMoves: 15,
  map: [
    "##E###",
    "#...##",
    "...#..",
    "#.RG..",
    "###...",
    "###.r.",
    "###.gS"
  ],
});

export const LEVEL_13 = levelFromAscii({
  id: 'RUNE_13',
  parMoves: 20,
  map: [
    "##..#E",
    "#..GY.",
    "#..###",
    "..####",
    "..####",
    "y.g###",
    "#S####"
  ],
});

export const LEVEL_14 = levelFromAscii({
  id: 'RUNE_14',
  parMoves: 15,
  map: [
    "####.##",
    "####..S",
    "###.y..",
    "###.b.#",
    "##.B..#",
    "#...###",
    "EY..###"
  ],
});

export const LEVEL_15 = levelFromAscii({
  id: 'RUNE_15',
  parMoves: 15,
  map: [
    "###....E",
    "##......",
    "##..##.y",
    "##......",
    "Y.R.#.##",
    "..r#####",
    "S..#####"
  ],
});

export const LEVEL_16 = levelFromAscii({
  id: 'RUNE_16',
  parMoves: 14,
  map: [
    "##E##",
    "##B##",
    "..G.#",
    "#...#",
    "..g.b",
    "#S..#"
  ],
});

export const LEVEL_17 = levelFromAscii({
  id: 'RUNE_17',
  parMoves: 14,
  map: [
    "##E##",
    "##R##",
    ".#G.#",
    "..g..",
    "r...S",
    "...##"
  ],
});

export const LEVEL_18 = levelFromAscii({
  id: 'RUNE_18',
  parMoves: 14,
  map: [
    "g..##",
    "..RG.",
    ".r.#.",
    "S.##E"
  ],
});

export const LEVEL_19 = levelFromAscii({
  id: 'RUNE_19',
  parMoves: 22,
  map: [
    "#####S.##",
    "###.##...",
    "###.###..",
    "ER.Y.....",
    "###r..y.."
  ],
});

export const LEVEL_20 = levelFromAscii({
  id: 'RUNE_20',
  parMoves: 16,
  map: [
    "##.S",
    "#r..",
    "#..R",
    ".B..",
    "#E#b"
  ],
});

export const LEVEL_21 = levelFromAscii({
  id: 'RUNE_21',
  parMoves: 32,
  map: [
    ".....W##",
    "#..b#Yg#",
    "#...#.B#",
    "#Sy###G#",
    "######..",
    "######.E"
  ],
});

export const LEVEL_22 = levelFromAscii({
  id: 'RUNE_22',
  parMoves: 22,
  map: [
    "S.##.###",
    "..b...##",
    "....y###",
    "....G#.E",
    "#g##YWB.",
    "#.##...#"
  ],
});

export const LEVEL_23 = levelFromAscii({
  id: 'RUNE_23',
  parMoves: 27,
  map: [
    "######E",
    "S..#R..",
    "#..#G#.",
    ".W..B.#",
    "....bg#",
    "###.#.#",
    "###r###"
  ],
});

export const LEVEL_24 = levelFromAscii({
  id: 'RUNE_24',
  parMoves: 25,
  map: [
    "####.#####",
    "#.#g..r#y#",
    "Y.GR.W....",
    "E###.....#",
    "####.#..S#",
    "####.#####"
  ],
});

export const LEVEL_25 = levelFromAscii({
  id: 'RUNE_25',
  parMoves: 23,
  map: [
    "EYB..",
    "##yb.",
    "###..",
    "Sr##W",
    "....R",
    "##.##"
  ],
});

export const LEVEL_26 = levelFromAscii({
  id: 'RUNE_26',
  parMoves: 22,
  map: [
    "g.y#####",
    "W...GYBE",
    "S....b##"
  ],
});

export const LEVEL_27 = levelFromAscii({
  id: 'RUNE_27',
  parMoves: 25,
  map: [
    "###...E",
    "####...",
    "####...",
    "###WB#.",
    "##..b.#",
    "##B....",
    "#bR#.##",
    "#...###",
    ".r...S#"
  ],
});

export const LEVEL_28 = levelFromAscii({
  id: 'RUNE_28',
  parMoves: 26,
  map: [
    "###y#.###",
    "##..Y.W.#",
    "##...#..#",
    "..B..#.GE",
    "#..######",
    "#..b#####",
    "#Sg######"
  ],
});

export const LEVEL_29 = levelFromAscii({
  id: 'RUNE_29',
  parMoves: 23,
  map: [
    "####S##",
    "###..##",
    "#.y..##",
    "##...##",
    "YRYW.##",
    "E#....#",
    "###.r.y"
  ],
});

export const LEVEL_30 = levelFromAscii({
  id: 'RUNE_30',
  parMoves: 22,
  map: [
    "....S#",
    "ybWBBg",
    "...###",
    "G..###",
    "E#####"
  ],
});

export const LEVEL_31 = levelFromAscii({
  id: 'RUNE_31',
  parMoves: 22,
  map: [
    "####.S#",
    "####..#",
    "###.R.r",
    "##...##",
    "##g..y#",
    "EYG.W##"
  ],
});

export const LEVEL_32 = levelFromAscii({
  id: 'RUNE_32',
  parMoves: 23,
  map: [
    "gy#..b##",
    "W..Y.BGE",
    "...#####",
    "S#######"
  ],
});

export const LEVEL_33 = levelFromAscii({
  id: 'RUNE_33',
  parMoves: 25,
  map: [
    "#GE####",
    "#R#.###",
    "#Y.y###",
    "#..####",
    "#r.W.##",
    ".......",
    ".g...S#"
  ],
});

export const LEVEL_34 = levelFromAscii({
  id: 'RUNE_34',
  parMoves: 23,
  map: [
    "##.y..g",
    "#......",
    "r......",
    "...W#.S",
    "#G#####",
    "#R#####",
    "#YE####"
  ],
});

export const LEVEL_35 = levelFromAscii({
  id: 'RUNE_35',
  parMoves: 28,
  map: [
    ".#.b.S",
    "......",
    "...W.#",
    "...###",
    "...###",
    "..Bg##",
    "g#G.##",
    "#G.###",
    "#E####"
  ],
});

export const LEVEL_36 = levelFromAscii({
  id: 'RUNE_36',
  parMoves: 33,
  map: [
    "#.S##",
    "..W##",
    "rW.##",
    "bB###",
    "..RGY",
    "g.y#E"
  ],
});

export const LEVEL_37 = levelFromAscii({
  id: 'RUNE_37',
  parMoves: 37,
  map: [
    "####..#E#",
    "#.W.BRRW.",
    "#...b####",
    "##.######",
    "yrY######",
    "#...#####",
    "#.r.#####",
    "##..#####",
    "##..#####",
    "##.S#####"
  ],
});

export const LEVEL_38 = levelFromAscii({
  id: 'RUNE_38',
  parMoves: 32,
  map: [
    "#YBR....W..S",
    "..#.r.b...##",
    ".W##.b.#####",
    ".R##.y######",
    "#E##########"
  ],
});

export const LEVEL_39 = levelFromAscii({
  id: 'RUNE_39',
  parMoves: 42,
  map: [
    "#....###",
    "##..G.b.",
    "##Wr#.R#",
    "W.Yg##B#",
    "Sy.###E#"
  ],
});

export const LEVEL_40 = levelFromAscii({
  id: 'RUNE_40',
  parMoves: 32,
  map: [
    "S...#..##",
    "...b...##",
    ".YW...Bg.",
    "#...##W..",
    "#####rRy#",
    "######G.#",
    "######E##"
  ],
});

export const LEVEL_41 = levelFromAscii({
  id: 'RUNE_41',
  parMoves: 32,
  map: [
    "####r..g..S",
    "######.##..",
    "###.b#.##..",
    "##....RW...",
    "##b...B####",
    "##..W..####",
    "EBB.#######",
    "##.########"
  ],
});

export const LEVEL_42 = levelFromAscii({
  id: 'RUNE_42',
  parMoves: 32,
  map: [
    "#b.BYRE",
    "..W.###",
    "##R..##",
    "..W#.##",
    "..yy..r",
    "#S.####"
  ],
});

export const LEVEL_43 = levelFromAscii({
  id: 'RUNE_43',
  parMoves: 33,
  map: [
    "#####E#",
    "#####Y#",
    "#g.R.Gr",
    "#.Y#...",
    "##Wb..y",
    "##.#.##",
    "..W..##",
    ".....##",
    ".....##",
    "#S.####"
  ],
});

export const LEVEL_44 = levelFromAscii({
  id: 'RUNE_44',
  parMoves: 34,
  map: [
    "E#######",
    ".#######",
    "R.######",
    ".W######",
    "..#####y",
    ".BYB..Wb",
    "###....b",
    "###....#",
    "####r.S#"
  ],
});

export const LEVEL_45 = levelFromAscii({
  id: 'RUNE_45',
  parMoves: 48,
  map: [
    "##...####",
    "##..#####",
    "#...#gr##",
    "y#gGR..##",
    "..W.#..##",
    ".Y###..W#",
    "#G####...",
    "#.E###..S"
  ],
});

export const LEVEL_46 = levelFromAscii({
  id: 'RUNE_46',
  parMoves: 32,
  map: [
    "##..###",
    "#.b..#E",
    "WGWYY.G",
    "S.rg..y"
  ],
});

export const LEVEL_47 = levelFromAscii({
  id: 'RUNE_47',
  parMoves: 32,
  map: [
    "###b.S#",
    "#.....#",
    "r.#.W..",
    "yW...##",
    ".Y#r.##",
    "#R#####",
    "#R.####",
    "EB#####"
  ],
});

export const LEVEL_48 = levelFromAscii({
  id: 'RUNE_48',
  parMoves: 35,
  map: [
    "#E#####",
    "#Y#####",
    "#R.Wg.#",
    "r..Y..#",
    "#y#..b#",
    "###....",
    "#.RW.##",
    "##...##",
    "##S..##"
  ],
});

export const LEVEL_49 = levelFromAscii({
  id: 'RUNE_49',
  parMoves: 37,
  map: [
    "#####S",
    "####.W",
    "###y..",
    "#.#b..",
    "...Y.W",
    "#bR.#.",
    "##B#r.",
    "#EB###"
  ],
});

export const LEVEL_50 = levelFromAscii({
  id: 'RUNE_50',
  parMoves: 32,
  map: [
    "#.##",
    "..rS",
    "..WW",
    "..Y#",
    "#yBb",
    "#yR.",
    "EB.#"
  ],
});

export const LEVEL_51 = levelFromAscii({
  id: 'RUNE_51',
  parMoves: 40,
  map: [
    "####E",
    "##g#R",
    "#..WG",
    "###Wr",
    "#..Bb",
    ".Y.y.",
    "#..##",
    "#S.##"
  ],
});

export const LEVEL_52 = levelFromAscii({
  id: 'RUNE_52',
  parMoves: 41,
  map: [
    "##b#######",
    "#..g.##.r#",
    "##G.R..W..",
    "EYB#.#..W#",
    "####y...S#"
  ],
});

export const LEVEL_53 = levelFromAscii({
  id: 'RUNE_53',
  parMoves: 41,
  map: [
    "###.####",
    "#S..g.##",
    "yR..B.##",
    "#.##W.##",
    "##......",
    "##.....#",
    "##r.G.b.",
    "###.WY.#",
    "#####E##"
  ],
});

export const LEVEL_54 = levelFromAscii({
  id: 'RUNE_54',
  parMoves: 41,
  map: [
    "#####.G.B.E",
    "#####.b#.##",
    "#####Y#####",
    "#####.#####",
    "#.###..####",
    "#.y##..####",
    "#..W.Yg####",
    "#.#..######",
    ".....######",
    "#W.y#######",
    "#S#########"
  ],
});


export const LEVELS: Level[] = [
  LEVEL_01,
  LEVEL_02,
  LEVEL_03,
  LEVEL_04,
  LEVEL_05,
  LEVEL_06,
  LEVEL_07,
  LEVEL_08,
  LEVEL_09,
  LEVEL_10,
  LEVEL_11,
  LEVEL_12,
  LEVEL_13,
  LEVEL_14,
  LEVEL_15,
  LEVEL_16,
  LEVEL_17,
  LEVEL_18,
  LEVEL_19,
  LEVEL_20,
  LEVEL_21,
  LEVEL_22,
  LEVEL_23,
  LEVEL_24,
  LEVEL_25,
  LEVEL_26,
  LEVEL_27,
  LEVEL_28,
  LEVEL_29,
  LEVEL_30,
  LEVEL_31,
  LEVEL_32,
  LEVEL_33,
  LEVEL_34,
  LEVEL_35,
  LEVEL_36,
  LEVEL_37,
  LEVEL_38,
  LEVEL_39,
  LEVEL_40,
  LEVEL_41,
  LEVEL_42,
  LEVEL_43,
  LEVEL_44,
  LEVEL_45,
  LEVEL_46,
  LEVEL_47,
  LEVEL_48,
  LEVEL_49,
  LEVEL_50,
  LEVEL_51,
  LEVEL_52,
  LEVEL_53,
  LEVEL_54
];

const RUNE_GRID_PALETTE = {
  R: PALETTE.r,
  G: PALETTE.g,
  B: PALETTE.b,
  Y: PALETTE.y,
} as const;

const fromRuneGridLevelDef = (def: RuneGridLevelDef): Level => {
  const { id, grid, targetParMoves } = def;
  if (!grid.length) {
    throw new Error(`Rune grid level ${id} has an empty grid.`);
  }

  const height = grid.length;
  const width = grid[0].length;
  if (!grid.every((row) => row.length === width)) {
    throw new Error(`Rune grid level ${id} must be rectangular.`);
  }

  const tiles: Tile[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = grid[y];
    for (let x = 0; x < width; x += 1) {
      const ch = row[x];
      if (ch === '#' || ch === ' ') continue;

      if (ch === '.') {
        tiles.push({ type: 'floor', pos: [x, y] });
      } else if (ch === 'S') {
        tiles.push({ type: 'start', pos: [x, y] });
      } else if (ch === 'E') {
        tiles.push({ type: 'end', pos: [x, y] });
      } else if (ch === 'W') {
        tiles.push({ type: 'wipe', pos: [x, y] });
      } else if (ch === 'R' || ch === 'G' || ch === 'B' || ch === 'Y') {
        tiles.push({ type: 'pickup', pos: [x, y], color: RUNE_GRID_PALETTE[ch] });
      } else if (ch === 'r' || ch === 'g' || ch === 'b' || ch === 'y') {
        const color = RUNE_GRID_PALETTE[ch.toUpperCase() as keyof typeof RUNE_GRID_PALETTE];
        tiles.push({ type: 'match', pos: [x, y], color });
      } else {
        throw new Error(`Rune grid level ${id} has unknown symbol '${ch}' at [${x}, ${y}].`);
      }
    }
  }

  return {
    id,
    width,
    height,
    parMoves: targetParMoves ?? Math.max(1, width + height),
    tiles,
  };
};

export const SAT_LEVELS: Level[] = [...LEVEL_DEFS, ...LEVEL_DEFS_INTRICATE].map(
  fromRuneGridLevelDef
);

export const AUTHORED_LEVELS: Level[] = [...STANDARDIZED_LEVELS, ...EXPERT_LEVELS];

export const ALL_RUNE_LEVELS: Level[] = [...LEVELS, ...AUTHORED_LEVELS, ...SAT_LEVELS];

const UNSOLVABLE_SAT_LEVEL_IDS = new Set([
  'RR_MED_05',
  'RR_MED_06',
  'RR_MED_08',
  'RR_MED_09',
  'RR_MED_11',
  'RR_MED_12',
  'RR_MED_14',
  'RR_MED_15',
]);

export const SOLVABLE_SAT_LEVELS: Level[] = SAT_LEVELS.filter(
  (level) => !UNSOLVABLE_SAT_LEVEL_IDS.has(level.id)
);

// Keep campaign progression on validated-solvable levels.
// All authored packs are still exported via ALL_RUNE_LEVELS/AUTHORED_LEVELS.
export const RUNE_LEVELS: Level[] = [...LEVELS, ...SOLVABLE_SAT_LEVELS];

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

const sortedTiles = (tiles: Tile[]) =>
  [...tiles].sort((a, b) => {
    if (a.pos[1] !== b.pos[1]) return a.pos[1] - b.pos[1];
    return a.pos[0] - b.pos[0];
  });

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
    bounds: { minX, maxX, minY, maxY },
    tiles: sortedTiles(level.tiles),
    tileMap,
  };
};

const getLevelCache = (level: Level) => {
  const cached = levelCache.get(level);
  if (cached) return cached;

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

export const createInitialFaces = (): FaceColors => [null, null, null, null, null, null];
