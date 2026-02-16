import type { LevelDef, ParsedLevel } from './types';
import { COLOR_INDEX } from './types';

function isRect(grid: string[]) {
  if (grid.length === 0) return false;
  const w = grid[0].length;
  return grid.every((r) => r.length === w);
}

export function parseLevel(def: LevelDef): ParsedLevel {
  const { id, grid } = def;
  if (!isRect(grid)) throw new Error(`Level ${id} grid must be rectangular`);

  const height = grid.length;
  const width = grid[0].length;
  const n = width * height;

  const isVoid = new Uint8Array(n);
  const isWipe = new Uint8Array(n);
  const gateColorByIdx = new Int8Array(n);
  gateColorByIdx.fill(-1);

  const pickupIdByIdx = new Int16Array(n);
  pickupIdByIdx.fill(-1);

  let startIdx = -1;
  let endIdx = -1;

  // First pass: count pickups to size pickupColorById
  const pickupCells: Array<{ idx: number; colorIndex: number }> = [];

  const idxOf = (x: number, y: number) => y * width + x;

  for (let y = 0; y < height; y++) {
    const row = grid[y];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const idx = idxOf(x, y);

      if (ch === '#') {
        isVoid[idx] = 1;
        continue;
      }

      if (ch === 'S') startIdx = idx;
      if (ch === 'E') endIdx = idx;

      if (ch === 'W') isWipe[idx] = 1;

      // pickups
      if (ch === 'R' || ch === 'G' || ch === 'B' || ch === 'Y') {
        pickupCells.push({ idx, colorIndex: COLOR_INDEX[ch] });
      }

      // gates
      if (ch === 'r' || ch === 'g' || ch === 'b' || ch === 'y') {
        const up = ch.toUpperCase() as 'R' | 'G' | 'B' | 'Y';
        gateColorByIdx[idx] = COLOR_INDEX[up];
      }
    }
  }

  if (startIdx < 0) throw new Error(`Level ${id} missing S`);
  if (endIdx < 0) throw new Error(`Level ${id} missing E`);

  const pickupColorById = new Uint8Array(pickupCells.length);
  pickupCells.forEach((p, i) => {
    pickupIdByIdx[p.idx] = i;
    pickupColorById[i] = p.colorIndex;
  });

  // walkable list
  const walkableTmp: number[] = [];
  for (let i = 0; i < n; i++) if (isVoid[i] === 0) walkableTmp.push(i);

  return {
    id,
    width,
    height,
    startIdx,
    endIdx,
    isVoid,
    isWipe,
    gateColorByIdx,
    pickupIdByIdx,
    pickupColorById,
    walkable: Uint16Array.from(walkableTmp),
  };
}

export function idxToXY(level: ParsedLevel, idx: number) {
  const x = idx % level.width;
  const y = Math.floor(idx / level.width);
  return { x, y };
}

export function xyToIdx(level: ParsedLevel, x: number, y: number) {
  return y * level.width + x;
}
