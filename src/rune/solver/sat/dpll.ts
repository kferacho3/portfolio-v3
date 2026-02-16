export interface SatOptions {
  timeLimitMs?: number;
}

type Assign = Int8Array; // 0 unassigned, 1 true, -1 false

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function evalLit(lit: number, asn: Assign): 1 | 0 | -1 {
  const v = Math.abs(lit);
  const a = asn[v];
  if (a === 0) return 0;
  const isTrue = (lit > 0 && a === 1) || (lit < 0 && a === -1);
  return isTrue ? 1 : -1;
}

function unitPropagate(clauses: number[][], asn: Assign, deadline?: number): boolean {
  let changed = true;
  while (changed) {
    if (deadline && nowMs() > deadline) return false;
    changed = false;

    for (const clause of clauses) {
      let anyTrue = false;
      let unassignedCount = 0;
      let lastUnassigned = 0;

      for (const lit of clause) {
        const v = evalLit(lit, asn);
        if (v === 1) {
          anyTrue = true;
          break;
        }
        if (v === 0) {
          unassignedCount++;
          lastUnassigned = lit;
        }
      }

      if (anyTrue) continue;

      if (unassignedCount === 0) {
        // clause false -> conflict
        return false;
      }

      if (unassignedCount === 1) {
        // unit clause
        const varId = Math.abs(lastUnassigned);
        const val = lastUnassigned > 0 ? 1 : -1;
        if (asn[varId] === 0) {
          asn[varId] = val;
          changed = true;
        } else if (asn[varId] !== val) {
          return false;
        }
      }
    }
  }
  return true;
}

function pureLiteralElim(clauses: number[][], asn: Assign, varCount: number) {
  const pos = new Int32Array(varCount + 1);
  const neg = new Int32Array(varCount + 1);

  for (const clause of clauses) {
    let clauseSatisfied = false;
    for (const lit of clause) {
      const v = Math.abs(lit);
      const a = asn[v];
      if (a !== 0) {
        const isTrue = (lit > 0 && a === 1) || (lit < 0 && a === -1);
        if (isTrue) {
          clauseSatisfied = true;
          break;
        }
      }
    }
    if (clauseSatisfied) continue;

    for (const lit of clause) {
      const v = Math.abs(lit);
      if (asn[v] !== 0) continue;
      if (lit > 0) pos[v]++;
      else neg[v]++;
    }
  }

  for (let v = 1; v <= varCount; v++) {
    if (asn[v] !== 0) continue;
    if (pos[v] > 0 && neg[v] === 0) asn[v] = 1;
    else if (neg[v] > 0 && pos[v] === 0) asn[v] = -1;
  }
}

function chooseVar(clauses: number[][], asn: Assign, varCount: number): number {
  // simple heuristic: pick first unassigned that appears most
  const occ = new Int32Array(varCount + 1);
  for (const clause of clauses) {
    // skip satisfied
    let satisfied = false;
    for (const lit of clause) {
      const v = Math.abs(lit);
      const a = asn[v];
      if (a !== 0) {
        const isTrue = (lit > 0 && a === 1) || (lit < 0 && a === -1);
        if (isTrue) {
          satisfied = true;
          break;
        }
      }
    }
    if (satisfied) continue;

    for (const lit of clause) {
      const v = Math.abs(lit);
      if (asn[v] === 0) occ[v]++;
    }
  }

  let best = 0;
  let bestOcc = -1;
  for (let v = 1; v <= varCount; v++) {
    if (asn[v] === 0 && occ[v] > bestOcc) {
      bestOcc = occ[v];
      best = v;
    }
  }
  return best || 0;
}

function dpll(clauses: number[][], asn: Assign, varCount: number, deadline?: number): boolean {
  if (deadline && nowMs() > deadline) return false;

  if (!unitPropagate(clauses, asn, deadline)) return false;
  pureLiteralElim(clauses, asn, varCount);
  if (!unitPropagate(clauses, asn, deadline)) return false;

  // check if all clauses satisfied
  let allSat = true;
  for (const clause of clauses) {
    let clauseSat = false;
    for (const lit of clause) {
      const v = Math.abs(lit);
      const a = asn[v];
      if (a === 0) continue;
      const isTrue = (lit > 0 && a === 1) || (lit < 0 && a === -1);
      if (isTrue) {
        clauseSat = true;
        break;
      }
    }
    if (!clauseSat) {
      allSat = false;
      break;
    }
  }
  if (allSat) return true;

  const v = chooseVar(clauses, asn, varCount);
  if (v === 0) return false;

  // branch true then false
  {
    const snapshot = asn.slice();
    asn[v] = 1;
    if (dpll(clauses, asn, varCount, deadline)) return true;
    asn.set(snapshot);
  }
  {
    const snapshot = asn.slice();
    asn[v] = -1;
    if (dpll(clauses, asn, varCount, deadline)) return true;
    asn.set(snapshot);
  }
  return false;
}

export function solveCNF(clauses: number[][], varCount: number, opts: SatOptions = {}): Int8Array | null {
  const deadline = opts.timeLimitMs ? nowMs() + opts.timeLimitMs : undefined;
  const asn = new Int8Array(varCount + 1);
  const ok = dpll(clauses, asn, varCount, deadline);
  return ok ? asn : null;
}
