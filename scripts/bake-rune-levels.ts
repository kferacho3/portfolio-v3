import fs from 'node:fs';
import path from 'node:path';
import { LEVEL_DEFS } from '../src/rune/levels/defs';
import { LEVEL_DEFS_INTRICATE } from '../src/rune/levels/defs_intricate';
import { parseLevel } from '../src/rune/levels/parse';
import { scoreLevel } from '../src/rune/scoring/difficulty';
import { countOptimalSolutionsSAT, solveOptimalSAT } from '../src/rune/solver/sat/optimal';

async function main() {
  const defs = [...LEVEL_DEFS, ...LEVEL_DEFS_INTRICATE];
  const baked: Array<Record<string, unknown>> = [];

  for (const def of defs) {
    const parsed = parseLevel(def);

    const sol = await solveOptimalSAT(parsed, { maxMoves: 220, timeLimitMs: 2500 });
    if (!sol) {
      throw new Error(`${def.id} UNSAT within maxMoves`);
    }

    const { count } = countOptimalSolutionsSAT(parsed, sol.moves.length, 12, {
      timeLimitMs: 1500,
    });
    const report = scoreLevel(parsed, sol.moves, {
      countAltLimit: 12,
      satTimeLimitMs: 1500,
    });

    baked.push({
      ...def,
      targetParMoves: sol.moves.length,
      sat: {
        par: sol.moves.length,
        solutionsSeen: count,
        score: report.score,
        tier: report.tier,
        stars: {
          three: report.star3,
          two: report.star2,
          one: report.star1,
        },
        metrics: report.metrics,
      },
    });
  }

  const outPath = path.resolve('src/rune/levels/levels.baked.json');
  fs.writeFileSync(outPath, JSON.stringify(baked, null, 2));
  console.log(`Baked ${baked.length} levels -> ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
