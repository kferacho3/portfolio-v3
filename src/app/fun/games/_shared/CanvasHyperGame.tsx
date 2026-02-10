'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPatternLibraryTemplate,
  getKetchappGameSpec,
  pickPatternChunkForSurvivability,
  sampleDifficulty,
  sampleSurvivability,
  type KetchappGameId,
} from '../../config/ketchapp';
import { KetchappGameShell } from './KetchappGameShell';
import type { HyperConcept, HyperInput, HyperSim } from './hyperConcepts';

type ShellStatus = 'ready' | 'playing' | 'gameover';

type RuntimeSync = {
  status: ShellStatus;
  score: number;
  best: number;
};

type CanvasHyperGameProps = {
  gameId: KetchappGameId;
  concept: HyperConcept;
  storageKey: string;
  deathTitle: string;
  tone?: 'dark' | 'light';
  startCtaText?: string;
  externalResetVersion?: number;
  onRuntimeSync?: (next: RuntimeSync) => void;
};

const makeRng = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const getCanvasSize = (canvas: HTMLCanvasElement) => ({
  width: Math.max(320, canvas.clientWidth || canvas.width || 320),
  height: Math.max(320, canvas.clientHeight || canvas.height || 320),
});

const createFreshSim = (
  gameId: KetchappGameId,
  concept: HyperConcept,
  width: number,
  height: number,
  seed?: number
): HyperSim => {
  const rng = makeRng(seed ?? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0));
  const sim: HyperSim = {
    score: 0,
    dead: false,
    note: '',
    t: 0,
    rand: rng,
  };

  const spec = getKetchappGameSpec(gameId);
  if (spec) {
    const library = buildPatternLibraryTemplate(gameId);
    const elapsedSeconds = 0;
    sim.runtimeTuning = {
      spec,
      library,
      currentChunk: library[0] ?? null,
      chunkTimeLeft: library[0]?.durationSeconds ?? 1.2,
      difficulty: sampleDifficulty(spec.chunkProfile, elapsedSeconds),
      survivability: sampleSurvivability(gameId, elapsedSeconds),
      elapsedSeconds,
    };
  }

  concept.init(sim, width, height);
  return sim;
};

export function CanvasHyperGame({
  gameId,
  concept,
  storageKey,
  deathTitle,
  tone = 'dark',
  startCtaText = 'Tap to Play',
  externalResetVersion,
  onRuntimeSync,
}: CanvasHyperGameProps) {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<HyperSim | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const statusRef = useRef<ShellStatus>('ready');

  const inputRef = useRef<HyperInput>({
    tap: false,
    release: false,
    down: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const loaded = Number(raw ?? 0);
      if (Number.isFinite(loaded) && loaded > 0) {
        setBest(loaded);
        bestRef.current = loaded;
      }
    } catch {
      // Ignore storage failures.
    }
  }, [storageKey]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  const syncRuntime = useCallback(
    (next: RuntimeSync) => {
      onRuntimeSync?.(next);
    },
    [onRuntimeSync]
  );

  useEffect(() => {
    syncRuntime({ status, score, best });
  }, [status, score, best, syncRuntime]);

  const resetToReady = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = getCanvasSize(canvas);
    simRef.current = createFreshSim(gameId, concept, width, height);
    setScore(0);
    setStatus('ready');
  }, [concept, gameId]);

  const startRun = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = getCanvasSize(canvas);
    simRef.current = createFreshSim(gameId, concept, width, height);
    setScore(0);
    setStatus('playing');
  }, [concept, gameId]);

  useEffect(() => {
    if (externalResetVersion === undefined) return;
    resetToReady();
  }, [externalResetVersion, resetToReady]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();

      if (statusRef.current !== 'playing') {
        startRun();
        return;
      }

      inputRef.current.tap = true;
      inputRef.current.down = true;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      inputRef.current.down = false;
      inputRef.current.release = true;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startRun]);

  const applyPointerPosition = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    inputRef.current.x = event.clientX - rect.left;
    inputRef.current.y = event.clientY - rect.top;
  }, []);

  useEffect(() => {
    const tick = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const size = getCanvasSize(canvas);
          const targetW = Math.round(size.width * dpr);
          const targetH = Math.round(size.height * dpr);
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
            canvas.style.width = `${size.width}px`;
            canvas.style.height = `${size.height}px`;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          if (!simRef.current) {
            simRef.current = createFreshSim(gameId, concept, size.width, size.height);
          }

          const sim = simRef.current;
          const dt = Math.min(0.033, Math.max(0.001, (timestamp - lastTimeRef.current) / 1000));
          lastTimeRef.current = timestamp;
          sim.t += dt;

          if (statusRef.current === 'playing') {
            if (sim.runtimeTuning) {
              sim.runtimeTuning.elapsedSeconds += dt;
              sim.runtimeTuning.difficulty = sampleDifficulty(
                sim.runtimeTuning.spec.chunkProfile,
                sim.runtimeTuning.elapsedSeconds
              );
              sim.runtimeTuning.survivability = sampleSurvivability(
                gameId,
                sim.runtimeTuning.elapsedSeconds
              );
              sim.runtimeTuning.chunkTimeLeft -= dt;

              if (
                sim.runtimeTuning.chunkTimeLeft <= 0 ||
                !sim.runtimeTuning.currentChunk
              ) {
                const intensity = Math.min(1, sim.runtimeTuning.elapsedSeconds / 95);
                sim.runtimeTuning.currentChunk = pickPatternChunkForSurvivability(
                  gameId,
                  sim.runtimeTuning.library,
                  sim.rand,
                  intensity,
                  sim.runtimeTuning.elapsedSeconds
                );
                sim.runtimeTuning.chunkTimeLeft = Math.max(
                  0.75,
                  sim.runtimeTuning.currentChunk.durationSeconds
                );
              }
            }

            concept.update(sim, dt, inputRef.current, size.width, size.height);

            if (sim.score !== scoreRef.current) {
              scoreRef.current = sim.score;
              setScore(sim.score);
            }

            if (sim.dead) {
              const nextBest = Math.max(bestRef.current, sim.score);
              if (nextBest !== bestRef.current) {
                bestRef.current = nextBest;
                setBest(nextBest);
                try {
                  window.localStorage.setItem(storageKey, String(nextBest));
                } catch {
                  // Ignore storage failures.
                }
              }
              setStatus('gameover');
            }
          }

          concept.draw(sim, ctx, size.width, size.height);
        }
      }

      inputRef.current.tap = false;
      inputRef.current.release = false;
      rafRef.current = window.requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [concept, gameId, storageKey]);

  const statusNote = useMemo(() => simRef.current?.note ?? '', [score, status]);

  return (
    <div
      className="relative h-full w-full select-none"
      onPointerDown={(event) => {
        applyPointerPosition(event);
        inputRef.current.down = true;

        if (statusRef.current !== 'playing') {
          startRun();
          return;
        }

        inputRef.current.tap = true;
      }}
      onPointerUp={(event) => {
        applyPointerPosition(event);
        inputRef.current.down = false;
        inputRef.current.release = true;
      }}
      onPointerMove={applyPointerPosition}
      onPointerCancel={() => {
        inputRef.current.down = false;
        inputRef.current.release = true;
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <KetchappGameShell
        gameId={gameId}
        score={score}
        best={best}
        status={status}
        tone={tone}
        deathTitle={deathTitle}
        startCtaText={startCtaText}
        statusNote={status === 'playing' ? statusNote : null}
        containerClassName="absolute inset-0"
      />
    </div>
  );
}
