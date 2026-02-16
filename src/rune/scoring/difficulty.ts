import type { ParsedLevel } from '../levels/types';
import { countOptimalSolutionsSAT } from '../solver/sat/optimal';
import { legalMoves, runMoves } from '../solver/simulate';

export interface DifficultyReport {
  parMoves: number;
  star3: number;
  star2: number;
  star1: number;

  score: number; // 0..100+
  tier: 'easy' | 'medium' | 'hard';

  metrics: {
    optimalSolutionsSeen: number;
    avgBranching: number;
    forcedSteps: number;
    revisits: number;
    pickups: number;
    gates: number;
    wipes: number;
    colorsUsed: number;
  };
}

export function scoreLevel(
  level: ParsedLevel,
  optimalMoves: number[],
  opts: { countAltLimit?: number; satTimeLimitMs?: number } = {}
): DifficultyReport {
  const parMoves = optimalMoves.length;

  // Count features
  const flat = {
    pickups: level.pickupColorById.length,
    gates: 0,
    wipes: 0,
    colors: new Set<number>(),
  };
  for (let i = 0; i < level.isVoid.length; i++) {
    if (level.isVoid[i] === 1) continue;
    if (level.isWipe[i] === 1) flat.wipes++;
    if (level.gateColorByIdx[i] > 0) {
      flat.gates++;
      flat.colors.add(level.gateColorByIdx[i]);
    }
    const pid = level.pickupIdByIdx[i];
    if (pid >= 0) flat.colors.add(level.pickupColorById[pid]);
  }

  // Branching along optimal path (how many legal actions per state)
  const sim = runMoves(level, optimalMoves);
  const visited = new Map<string, number>();
  let totalBranch = 0;
  let forcedSteps = 0;
  let revisits = 0;

  if (sim.ok) {
    for (let i = 0; i < sim.states.length; i++) {
      const st = sim.states[i];
      const key = `${st.idx}|${st.consumed.toString()}|${Array.from(st.faces).join(',')}`;
      const prev = visited.get(key);
      if (prev !== undefined) revisits++;
      visited.set(key, i);

      const moves = legalMoves(level, st);
      totalBranch += moves.length;
      if (moves.length <= 1) forcedSteps++;
    }
  }

  const avgBranching = totalBranch / Math.max(1, sim.states.length);

  // SAT-based “how many optimal solutions exist?” (few => harder)
  const altLimit = opts.countAltLimit ?? 12;
  const alt = countOptimalSolutionsSAT(level, parMoves, altLimit, {
    timeLimitMs: opts.satTimeLimitMs ?? 1500,
  });

  // Score components (tuned for puzzle feel)
  const colorsUsed = flat.colors.size;

  const solutionScarcity = 1 / Math.max(1, alt.count); // 1 if unique, smaller if many
  const branchingPenalty = Math.max(0, avgBranching - 1.0);

  let score =
    0.85 * parMoves +
    3.2 * flat.gates +
    1.8 * flat.wipes +
    2.0 * colorsUsed +
    6.0 * solutionScarcity +
    4.0 * branchingPenalty +
    0.6 * revisits;

  // Clamp-ish (you can keep >100 for ultra-hard)
  score = Math.round(score * 10) / 10;

  let tier: 'easy' | 'medium' | 'hard' = 'medium';
  if (score < 40) tier = 'easy';
  else if (score >= 75) tier = 'hard';

  // Stars
  const star3 = parMoves;
  const star2 = Math.ceil(parMoves * 1.25);
  const star1 = Math.ceil(parMoves * 1.6);

  return {
    parMoves,
    star3,
    star2,
    star1,
    score,
    tier,
    metrics: {
      optimalSolutionsSeen: alt.count,
      avgBranching: Math.round(avgBranching * 100) / 100,
      forcedSteps,
      revisits,
      pickups: flat.pickups,
      gates: flat.gates,
      wipes: flat.wipes,
      colorsUsed,
    },
  };
}
