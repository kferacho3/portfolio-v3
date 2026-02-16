// Offline solver + validator (use in dev tooling to verify solvability / compute parMoves)
// Matches rules:
// - Can only move onto declared non-void tiles (tiles present in Level.tiles)
// - Match tiles require bottom face color === tile color
// - Pickup tiles: always set bottom face to tile color; mark consumed once for state tracking
// - Wipe tiles: set bottom face to null

import { rotateFaces } from './rotateFaces';
import type { Level, Tile } from './levels';

type Faces = readonly [
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
];
type Dir = readonly [number, number];

const DIRS: Dir[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

function keyPos(x: number, z: number) {
  return `${x},${z}`;
}

export function indexLevel(level: Level) {
  const map = new Map<string, Tile>();
  let start: [number, number] | null = null;
  let end: [number, number] | null = null;
  const pickups: Array<{ x: number; z: number; color: string }> = [];

  for (const t of level.tiles) {
    map.set(keyPos(t.pos[0], t.pos[1]), t);
    if (t.type === 'start') start = t.pos;
    if (t.type === 'end') end = t.pos;
    if (t.type === 'pickup') pickups.push({ x: t.pos[0], z: t.pos[1], color: t.color });
  }
  if (!start || !end) throw new Error(`Level ${level.id}: missing start/end`);

  const pickupIndex = new Map<string, number>();
  pickups.forEach((p, i) => pickupIndex.set(keyPos(p.x, p.z), i));

  return { map, start, end, pickups, pickupIndex };
}

export function solveLevel(level: Level, maxSteps = 2000): number | null {
  const { map, start, end, pickupIndex } = indexLevel(level);

  const faces0: Faces = [null, null, null, null, null, null];

  // state = x,z,faces,consumedMask
  type State = { x: number; z: number; faces: Faces; mask: number };
  const startState: State = { x: start[0], z: start[1], faces: faces0, mask: 0 };

  const q: State[] = [startState];
  const dist = new Map<string, number>();
  const hash = (s: State) => `${s.x},${s.z}|${s.faces.join(',')}|${s.mask}`;
  dist.set(hash(startState), 0);

  while (q.length) {
    const s = q.shift()!;
    const d = dist.get(hash(s))!;
    if (s.x === end[0] && s.z === end[1]) return d;
    if (d >= maxSteps) continue;

    for (const dir of DIRS) {
      const [dx, dz] = dir;
      const nx = s.x + dx;
      const nz = s.z + dz;
      const tile = map.get(keyPos(nx, nz));
      if (!tile) continue;

      let nf = rotateFaces(s.faces as any, dir) as Faces;
      let nmask = s.mask;

      if (tile.type === 'match') {
        if (nf[1] !== tile.color) continue;
      } else if (tile.type === 'wipe') {
        nf = [nf[0], null, nf[2], nf[3], nf[4], nf[5]];
      } else if (tile.type === 'pickup') {
        const idx = pickupIndex.get(keyPos(nx, nz));
        nf = [nf[0], tile.color, nf[2], nf[3], nf[4], nf[5]];
        if (idx !== undefined && (nmask & (1 << idx)) === 0) {
          nmask = nmask | (1 << idx);
        }
      }

      const ns: State = { x: nx, z: nz, faces: nf, mask: nmask };
      const h = hash(ns);
      if (!dist.has(h)) {
        dist.set(h, d + 1);
        q.push(ns);
      }
    }
  }

  return null;
}

export function assertSolvable(level: Level) {
  const d = solveLevel(level);
  if (d === null) throw new Error(`Level ${level.id} is NOT solvable under current rules`);
  return d;
}
