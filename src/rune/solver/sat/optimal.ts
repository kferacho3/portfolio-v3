import type { ParsedLevel } from '../../levels/types';
import { solveCNF } from './dpll';
import { decodeMoves, encodeLevelToCNF } from './encode';

export interface SatSolution {
  moves: number[]; // 0..3 for U,D,L,R
  horizon: number; // moves.length
}

export async function solveOptimalSAT(
  level: ParsedLevel,
  opts: { maxMoves: number; timeLimitMs?: number } = { maxMoves: 120 }
): Promise<SatSolution | null> {
  const { maxMoves, timeLimitMs } = opts;

  for (let h = 0; h <= maxMoves; h++) {
    const { cnf, layout } = encodeLevelToCNF(level, h);
    const asn = solveCNF(cnf.clauses, layout.varCountTotal, { timeLimitMs });
    if (asn) {
      return { moves: decodeMoves(layout, asn), horizon: h };
    }
  }
  return null;
}

export function countOptimalSolutionsSAT(
  level: ParsedLevel,
  horizon: number,
  limit: number,
  opts: { timeLimitMs?: number } = {}
) {
  const { cnf, layout } = encodeLevelToCNF(level, horizon);

  let count = 0;
  const solutions: number[][] = [];

  while (count < limit) {
    const asn = solveCNF(cnf.clauses, layout.varCountTotal, opts);
    if (!asn) break;

    const moves = decodeMoves(layout, asn);
    solutions.push(moves);
    count++;

    // Block this exact move sequence:
    // (¬m0 ∨ ¬m1 ∨ ... ¬m_{h-1})
    const block: number[] = [];
    for (let t = 0; t < horizon; t++) {
      const chosen = moves[t];
      const v = layout.dirBase + t * 4 + chosen;
      block.push(-v);
    }
    cnf.addClause(...block);
  }

  return { count, solutions };
}
