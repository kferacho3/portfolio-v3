export type DifficultyTag = 'easy' | 'medium' | 'hard';

export type ColorKey = 'R' | 'G' | 'B' | 'Y';

// SAT & runtime use numeric color indices:
// 0 = NONE, 1..4 = R,G,B,Y
export const COLOR_INDEX: Record<ColorKey, number> = { R: 1, G: 2, B: 3, Y: 4 };
export const INDEX_COLOR: Record<number, ColorKey> = { 1: 'R', 2: 'G', 3: 'B', 4: 'Y' };

export const COLOR_HEX: Record<ColorKey, string> = {
  R: '#ff0044',
  G: '#00ffaa',
  B: '#3399ff',
  Y: '#ffaa00',
};

export interface LevelDef {
  id: string;
  difficultyTag: DifficultyTag;
  // Optional rough target. True par is computed by SAT optimal solver.
  targetParMoves?: number;
  // Rectangular grid. Each row same length.
  // Legend:
  //  # void
  //  . floor
  //  S start
  //  E end
  //  W wipe (bottom face -> NONE)
  //  R,G,B,Y pickups (if bottom is NONE and pickup not consumed yet, bottom becomes that color)
  //  r,g,b,y gates (require bottom to match color; no state change)
  grid: string[];
}

export interface ParsedLevel {
  id: string;
  width: number;
  height: number;

  startIdx: number;
  endIdx: number;

  // Flattened arrays, length = width*height
  isVoid: Uint8Array;            // 1 if void (#)
  isWipe: Uint8Array;            // 1 if wipe (W)
  gateColorByIdx: Int8Array;     // -1 none, else 1..4
  pickupIdByIdx: Int16Array;     // -1 none, else pickupId
  pickupColorById: Uint8Array;   // pickupId -> colorIndex 1..4

  walkable: Uint16Array;         // list of idx that are not void
}

export { DIRS } from '../cubeMath';
export type { Dir, DirIndex } from '../cubeMath';
