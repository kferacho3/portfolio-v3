import type { ParsedLevel } from '../levels/types';

// Face indices: 0=Top, 1=Bottom, 2=North(Up), 3=South(Down), 4=West(Left), 5=East(Right)
// Colors: 0 NONE, 1..4 = R,G,B,Y
export interface SimState {
  idx: number;
  faces: Uint8Array; // length 6
  consumed: bigint; // pickup bitset (pickupId => bit)
}

const FACE_MAP: ReadonlyArray<ReadonlyArray<number>> = [
  [3, 2, 0, 1, 4, 5], // U
  [2, 3, 1, 0, 4, 5], // D
  [5, 4, 2, 3, 0, 1], // L
  [4, 5, 2, 3, 1, 0], // R
];
const DIR_VALUES = [0, 1, 2, 3] as const;

export function initialState(level: ParsedLevel): SimState {
  return {
    idx: level.startIdx,
    faces: new Uint8Array([0, 0, 0, 0, 0, 0]),
    consumed: BigInt(0),
  };
}

function neighbor(level: ParsedLevel, idx: number, dir: 0 | 1 | 2 | 3) {
  const w = level.width;
  const x = idx % w;
  const y = (idx / w) | 0;
  const nx = dir === 2 ? x - 1 : dir === 3 ? x + 1 : x;
  const ny = dir === 0 ? y - 1 : dir === 1 ? y + 1 : y;
  if (nx < 0 || ny < 0 || nx >= w || ny >= level.height) return -1;
  return ny * w + nx;
}

function rotateFaces(faces: Uint8Array, dir: 0 | 1 | 2 | 3) {
  const map = FACE_MAP[dir];
  const next = new Uint8Array(6);
  for (let i = 0; i < 6; i++) next[i] = faces[map[i]];
  return next;
}

export function step(level: ParsedLevel, s: SimState, dir: 0 | 1 | 2 | 3): SimState | null {
  const n = neighbor(level, s.idx, dir);
  if (n < 0 || level.isVoid[n] === 1) return null;

  let faces = rotateFaces(s.faces, dir);
  let consumed = s.consumed;

  // wipe
  if (level.isWipe[n] === 1) {
    faces[1] = 0;
  }

  // pickup
  const pid = level.pickupIdByIdx[n];
  if (pid >= 0) {
    const mask = BigInt(1) << BigInt(pid);
    const already = (consumed & mask) !== BigInt(0);
    if (!already && faces[1] === 0) {
      faces[1] = level.pickupColorById[pid]; // color index
      consumed |= mask;
    }
  }

  // gate
  const gate = level.gateColorByIdx[n];
  if (gate > 0 && faces[1] !== gate) return null;

  return { idx: n, faces, consumed };
}

export function legalMoves(level: ParsedLevel, s: SimState) {
  const out: (0 | 1 | 2 | 3)[] = [];
  for (const d of DIR_VALUES) if (step(level, s, d)) out.push(d);
  return out;
}

export function runMoves(level: ParsedLevel, moves: number[]) {
  let s = initialState(level);
  const states: SimState[] = [s];
  for (const m of moves) {
    const ns = step(level, s, m as 0 | 1 | 2 | 3);
    if (!ns) return { ok: false as const, states };
    s = ns;
    states.push(s);
  }
  return { ok: true as const, states };
}
