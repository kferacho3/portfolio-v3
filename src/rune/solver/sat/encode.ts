import type { ParsedLevel } from '../../levels/types';
import { COLOR_COUNT, FACE_COUNT, ROTATE, type DirIndex } from '../../cubeMath';
import { CNFBuilder } from './cnf';

export interface SatLayout {
  horizon: number;
  varCountBase: number;
  varCountTotal: number;

  // decode helpers
  N: number;
  walkable: Uint16Array;

  posBase: number;
  dirBase: number;
  faceBase: number;
  preFaceBase: number;
  consPreBase: number;
  consBase: number;

  P: number; // pickup count
}

const DIR_COUNT = 4; // U,D,L,R
const DIR_VALUES: readonly DirIndex[] = [0, 1, 2, 3];

export function buildSatLayout(level: ParsedLevel, horizon: number): SatLayout {
  const N = level.width * level.height;
  const P = level.pickupColorById.length;

  // base vars (no aux)
  const posVars = (horizon + 1) * level.walkable.length;
  const dirVars = horizon * DIR_COUNT;
  const faceVars = (horizon + 1) * FACE_COUNT * COLOR_COUNT;
  const preFaceVars = (horizon + 1) * FACE_COUNT * COLOR_COUNT;
  const consPreVars = (horizon + 1) * P;
  const consVars = (horizon + 1) * P;

  // We’ll allocate contiguous ranges.
  let base = 1;
  const posBase = base;
  base += posVars;
  const dirBase = base;
  base += dirVars;
  const faceBase = base;
  base += faceVars;
  const preFaceBase = base;
  base += preFaceVars;
  const consPreBase = base;
  base += consPreVars;
  const consBase = base;
  base += consVars;

  const varCountBase = base - 1;

  return {
    horizon,
    varCountBase,
    varCountTotal: varCountBase,
    N,
    walkable: level.walkable,
    posBase,
    dirBase,
    faceBase,
    preFaceBase,
    consPreBase,
    consBase,
    P,
  };
}

// We index walkable positions by their index in `walkable` list for compactness.
function posVar(L: SatLayout, t: number, wIdx: number) {
  return L.posBase + t * L.walkable.length + wIdx;
}
function dirVar(L: SatLayout, t: number, d: number) {
  return L.dirBase + t * DIR_COUNT + d;
}
function faceVar(L: SatLayout, t: number, f: number, c: number) {
  return L.faceBase + t * (FACE_COUNT * COLOR_COUNT) + f * COLOR_COUNT + c;
}
function preFaceVar(L: SatLayout, t: number, f: number, c: number) {
  return L.preFaceBase + t * (FACE_COUNT * COLOR_COUNT) + f * COLOR_COUNT + c;
}
function consPreVar(L: SatLayout, t: number, p: number) {
  return L.consPreBase + t * L.P + p;
}
function consVar(L: SatLayout, t: number, p: number) {
  return L.consBase + t * L.P + p;
}

function neighborIdx(level: ParsedLevel, idx: number, dir: DirIndex) {
  const w = level.width;
  const x = idx % w;
  const y = (idx / w) | 0;
  const nx = dir === 2 ? x - 1 : dir === 3 ? x + 1 : x;
  const ny = dir === 0 ? y - 1 : dir === 1 ? y + 1 : y;
  if (nx < 0 || ny < 0 || nx >= w || ny >= level.height) return -1;
  return ny * w + nx;
}

export function encodeLevelToCNF(level: ParsedLevel, horizon: number) {
  const L = buildSatLayout(level, horizon);
  const cnf = new CNFBuilder(L.varCountBase);

  // --- Position: exactly-one among walkable per timestep
  for (let t = 0; t <= horizon; t++) {
    const vars = Array.from({ length: L.walkable.length }, (_, wIdx) => posVar(L, t, wIdx));
    cnf.exactlyOne(vars, 'seq');
  }

  // Fix start and end positions
  const startW = level.walkable.findIndex((idx) => idx === level.startIdx);
  const endW = level.walkable.findIndex((idx) => idx === level.endIdx);
  if (startW < 0 || endW < 0) throw new Error('Start/end not walkable?');

  cnf.addClause(posVar(L, 0, startW));
  cnf.addClause(posVar(L, horizon, endW));

  // --- Moves: exactly-one direction per step
  for (let t = 0; t < horizon; t++) {
    cnf.exactlyOne([dirVar(L, t, 0), dirVar(L, t, 1), dirVar(L, t, 2), dirVar(L, t, 3)], 'pair');
  }

  // --- Faces (post-tile) and preFaces (pre-tile): exactly-one per face per time
  for (let t = 0; t <= horizon; t++) {
    for (let f = 0; f < FACE_COUNT; f++) {
      const fv = Array.from({ length: COLOR_COUNT }, (_, c) => faceVar(L, t, f, c));
      const pv = Array.from({ length: COLOR_COUNT }, (_, c) => preFaceVar(L, t, f, c));
      cnf.exactlyOne(fv, 'seq');
      cnf.exactlyOne(pv, 'seq');
    }
  }

  // Initial faces all NONE on both pre and post at t=0
  for (let f = 0; f < FACE_COUNT; f++) {
    cnf.addClause(faceVar(L, 0, f, 0));
    cnf.addClause(preFaceVar(L, 0, f, 0));
  }

  // Non-bottom faces never change on tile interaction, so enforce preFace == face for f != 1
  for (let t = 0; t <= horizon; t++) {
    for (const f of [0, 2, 3, 4, 5]) {
      for (let c = 0; c < COLOR_COUNT; c++) {
        cnf.addIff(preFaceVar(L, t, f, c), faceVar(L, t, f, c));
      }
    }
  }

  // --- Consumed pickups: consPre and cons; consPre(0)=false
  for (let p = 0; p < L.P; p++) {
    cnf.addClause(-consPreVar(L, 0, p));
    cnf.addClause(-consVar(L, 0, p)); // start tile isn’t pickup; keep clean
  }
  // consPre(t+1) == cons(t)
  for (let t = 0; t < horizon; t++) {
    for (let p = 0; p < L.P; p++) cnf.addIff(consPreVar(L, t + 1, p), consVar(L, t, p));
  }

  // --- Position transitions (pos(t) + dir(t) -> pos(t+1))
  // We work in walkable index space for pos variables, but neighbor uses absolute idx.
  const absToWalkable = new Map<number, number>();
  level.walkable.forEach((idx, i) => absToWalkable.set(idx, i));

  for (let t = 0; t < horizon; t++) {
    for (let wIdx = 0; wIdx < level.walkable.length; wIdx++) {
      const abs = level.walkable[wIdx];
      for (const d of DIR_VALUES) {
        const nAbs = neighborIdx(level, abs, d);
        const nW = nAbs >= 0 ? absToWalkable.get(nAbs) : undefined;
        if (nW === undefined) {
          // forbid this move from this pos
          cnf.addClause(-posVar(L, t, wIdx), -dirVar(L, t, d));
        } else {
          cnf.addClause(-posVar(L, t, wIdx), -dirVar(L, t, d), posVar(L, t + 1, nW));
        }
      }
    }
  }

  // --- Face rotation: faces(t) + dir(t) -> preFaces(t+1)
  for (let t = 0; t < horizon; t++) {
    for (const d of DIR_VALUES) {
      const map = ROTATE[d];
      const dirLit = dirVar(L, t, d);

      for (let newF = 0; newF < FACE_COUNT; newF++) {
        const oldF = map[newF];
        for (let c = 0; c < COLOR_COUNT; c++) {
          // dir ∧ face(oldF,c) -> preFaceNext(newF,c)
          cnf.addClause(-dirLit, -faceVar(L, t, oldF, c), preFaceVar(L, t + 1, newF, c));
          // dir ∧ preFaceNext(newF,c) -> face(oldF,c)
          cnf.addClause(-dirLit, -preFaceVar(L, t + 1, newF, c), faceVar(L, t, oldF, c));
        }
      }
    }
  }

  // --- Tile interaction only affects BOTTOM face (f=1) and consumption.
  // For each time t, bottom face after tile depends on cell at pos(t).
  // We add clauses conditioned on posVar(t,wIdx).
  for (let t = 0; t <= horizon; t++) {
    for (let wIdx = 0; wIdx < level.walkable.length; wIdx++) {
      const abs = level.walkable[wIdx];
      const posLit = posVar(L, t, wIdx);

      const isWipe = level.isWipe[abs] === 1;
      const gateColor = level.gateColorByIdx[abs]; // -1 or 1..4
      const pickupId = level.pickupIdByIdx[abs]; // -1 or 0..P-1

      const preBottomNone = preFaceVar(L, t, 1, 0);

      if (isWipe) {
        // pos -> bottom is NONE
        cnf.addClause(-posLit, faceVar(L, t, 1, 0));
        for (let c = 1; c < COLOR_COUNT; c++) cnf.addClause(-posLit, -faceVar(L, t, 1, c));
        continue;
      }

      if (pickupId >= 0) {
        const p = pickupId;
        const pickupColorIdx = level.pickupColorById[p];
        const consPre = consPreVar(L, t, p);
        const cons = consVar(L, t, p);

        // monotonic: consPre -> cons
        cnf.addClause(-consPre, cons);

        // trigger: pos ∧ ¬consPre ∧ preBottomNone -> (bottom=pickupColor) and cons
        cnf.addClause(-posLit, consPre, -preBottomNone, faceVar(L, t, 1, pickupColorIdx));
        cnf.addClause(-posLit, consPre, -preBottomNone, cons);

        // prevent spontaneous: cons -> consPre OR pos ; cons -> consPre OR preBottomNone
        cnf.addClause(-cons, consPre, posLit);
        cnf.addClause(-cons, consPre, preBottomNone);

        // If already consumed: pos ∧ consPre -> bottom == preBottom (all colors)
        for (let c = 0; c < COLOR_COUNT; c++) {
          cnf.addClause(-posLit, -consPre, -preFaceVar(L, t, 1, c), faceVar(L, t, 1, c));
          cnf.addClause(-posLit, -consPre, -faceVar(L, t, 1, c), preFaceVar(L, t, 1, c));
        }

        // If bottom not NONE: pos ∧ ¬preBottomNone -> bottom == preBottom
        for (let c = 0; c < COLOR_COUNT; c++) {
          cnf.addClause(-posLit, preBottomNone, -preFaceVar(L, t, 1, c), faceVar(L, t, 1, c));
          cnf.addClause(-posLit, preBottomNone, -faceVar(L, t, 1, c), preFaceVar(L, t, 1, c));
        }
      } else {
        // normal tile (floor/start/end/gate): bottom == preBottom
        for (let c = 0; c < COLOR_COUNT; c++) {
          cnf.addClause(-posLit, -preFaceVar(L, t, 1, c), faceVar(L, t, 1, c));
          cnf.addClause(-posLit, -faceVar(L, t, 1, c), preFaceVar(L, t, 1, c));
        }
      }

      if (gateColor > 0) {
        // pos -> bottom must match gateColor
        cnf.addClause(-posLit, faceVar(L, t, 1, gateColor));
      }
    }
  }

  // For pickups NOT currently being stood on, cons may still stay same via constraints + consPre(t+1)==cons(t).
  // Good.

  // Update total var count (includes aux vars created by exactlyOne seq encodings)
  L.varCountTotal = cnf.varCount;

  return { cnf, layout: L };
}

export function decodeMoves(layout: SatLayout, asn: Int8Array): number[] {
  const moves: number[] = [];
  for (let t = 0; t < layout.horizon; t++) {
    let chosen = -1;
    for (let d = 0; d < 4; d++) {
      const v = layout.dirBase + t * 4 + d;
      if (asn[v] === 1) {
        chosen = d;
        break;
      }
    }
    if (chosen < 0) throw new Error('No move found in SAT assignment');
    moves.push(chosen);
  }
  return moves;
}
