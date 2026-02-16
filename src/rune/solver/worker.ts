import { parseLevel } from '../levels/parse';
import type { LevelDef } from '../levels/types';
import { scoreLevel } from '../scoring/difficulty';
import { solveOptimalSAT } from './sat/optimal';

type Req =
  | { type: 'solve'; level: LevelDef; maxMoves: number }
  | { type: 'score'; level: LevelDef; moves: number[] };

type Res =
  | { type: 'solve-result'; ok: true; moves: number[]; parMoves: number }
  | { type: 'solve-result'; ok: false; error: string }
  | { type: 'score-result'; report: ReturnType<typeof scoreLevel> };

self.onmessage = async (ev: MessageEvent<Req>) => {
  try {
    if (ev.data.type === 'solve') {
      const parsed = parseLevel(ev.data.level);
      const sol = await solveOptimalSAT(parsed, { maxMoves: ev.data.maxMoves, timeLimitMs: 2500 });
      if (!sol) {
        (self as any).postMessage({
          type: 'solve-result',
          ok: false,
          error: 'UNSAT within maxMoves',
        } satisfies Res);
        return;
      }
      (self as any).postMessage({
        type: 'solve-result',
        ok: true,
        moves: sol.moves,
        parMoves: sol.moves.length,
      } satisfies Res);
      return;
    }

    if (ev.data.type === 'score') {
      const parsed = parseLevel(ev.data.level);
      const report = scoreLevel(parsed, ev.data.moves, { countAltLimit: 12, satTimeLimitMs: 1500 });
      (self as any).postMessage({ type: 'score-result', report } satisfies Res);
      return;
    }
  } catch (e: any) {
    (self as any).postMessage({
      type: 'solve-result',
      ok: false,
      error: e?.message ?? 'worker error',
    } satisfies Res);
  }
};
