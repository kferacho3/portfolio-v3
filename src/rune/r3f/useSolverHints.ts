import { useEffect, useRef, useState } from 'react';
import type { LevelDef } from '../levels/types';

type SolveRes =
  | { type: 'solve-result'; ok: true; moves: number[]; parMoves: number }
  | { type: 'solve-result'; ok: false; error: string }
  | { type: 'score-result'; report: any };

export function useSolverHints(level: LevelDef | null) {
  const workerRef = useRef<Worker | null>(null);
  const [parMoves, setParMoves] = useState<number | null>(null);
  const [hintMoves, setHintMoves] = useState<number[] | null>(null);
  const [difficulty, setDifficulty] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = level?.id ?? 'none';

  useEffect(() => {
    workerRef.current ??= new Worker(new URL('../solver/worker.ts', import.meta.url), {
      type: 'module',
    });
    const w = workerRef.current;

    const onMsg = (ev: MessageEvent<SolveRes>) => {
      if (ev.data.type === 'solve-result') {
        if (!ev.data.ok) {
          setError(ev.data.error);
          setHintMoves(null);
          setParMoves(null);
          return;
        }
        setError(null);
        setHintMoves(ev.data.moves);
        setParMoves(ev.data.parMoves);
        // request score immediately
        if (level) w.postMessage({ type: 'score', level, moves: ev.data.moves });
      }
      if (ev.data.type === 'score-result') setDifficulty(ev.data.report);
    };

    w.addEventListener('message', onMsg);
    return () => w.removeEventListener('message', onMsg);
  }, [level]);

  useEffect(() => {
    setParMoves(null);
    setHintMoves(null);
    setDifficulty(null);
    setError(null);

    if (!level) return;
    workerRef.current?.postMessage({ type: 'solve', level, maxMoves: 140 });
  }, [key, level]);

  return { parMoves, hintMoves, difficulty, error };
}
