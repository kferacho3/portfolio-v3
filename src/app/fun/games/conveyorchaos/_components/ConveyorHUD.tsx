'use client';

import { Html } from '@react-three/drei';
import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import {
  ArcadeHudCard,
  ArcadeHudPill,
  ArcadeHudShell,
} from '../../../components/shell/ArcadeHudPanel';
import { clamp } from '../utils';
import {
  BEST_SCORE_KEY,
  REVERSE_DURATION,
  REVERSE_COOLDOWN,
} from '../constants';
import { conveyorChaosState } from '../state';

export const ConveyorHUD: React.FC = () => {
  const s = useSnapshot(conveyorChaosState);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) conveyorChaosState.bestScore = Number(stored) || 0;
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${s.bestScore}`);
  }, [s.bestScore]);
  const goalMax = clamp(12 - s.level * 0.35, 6, 12);
  const reverseLabel =
    s.reverseTime > 0
      ? `${s.reverseTime.toFixed(1)}s`
      : s.reverseCooldown > 0
        ? `${s.reverseCooldown.toFixed(1)}s`
        : 'ready';
  const overrideLabel =
    s.overrideCooldown > 0 ? `${s.overrideCooldown.toFixed(1)}s` : 'ready';
  const toastOpacity = clamp(s.toastTime / 1.1, 0, 1);
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <ArcadeHudShell
        gameId="conveyorchaos"
        className="absolute top-4 left-4 pointer-events-auto"
      >
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">
            Factory Engineer
          </div>
          <div className="text-[9px] uppercase tracking-[0.26em] text-white/40">
            Rotate → Route → Deliver
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.32em] text-white/50">
            Score
          </div>
          <div className="text-2xl font-semibold text-white">
            {s.score.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/50">
            Best {s.bestScore.toLocaleString()}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-[0.28em] text-white/50">
              Stress
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: s.maxStrikes }).map((_, i) => (
                <div
                  key={`strike-${i}`}
                  className={`h-2.5 w-2.5 rounded-sm ${i < s.strikes ? 'bg-rose-400' : 'bg-white/15'}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ArcadeHudPill label={`Level ${s.level}`} />
            <ArcadeHudPill label={`Chain x${s.chain}`} />
            {s.deliveryStreak > 0 && (
              <ArcadeHudPill
                label={`Streak x${s.deliveryStreak}`}
                tone="accent"
              />
            )}
            <ArcadeHudPill label={`Goal ${s.goalTime.toFixed(1)}s`} />
            <ArcadeHudPill
              label={`Reverse ${reverseLabel}`}
              tone={s.reverseTime > 0 ? 'accent' : 'default'}
            />
            <ArcadeHudPill
              label={`Override ${overrideLabel}`}
              tone={s.overrideCooldown > 0 ? 'default' : 'accent'}
            />
            {s.event && (
              <ArcadeHudPill
                label={`${s.event} ${Math.ceil(s.eventTime)}s`}
                tone="accent"
              />
            )}
          </div>

          <div className="mt-3 space-y-2 text-[11px] text-white/70">
            <div className="flex items-center justify-between">
              <span>Goal timer</span>
              <span>{s.goalTime.toFixed(1)}s</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{
                  width: `${clamp((s.goalTime / goalMax) * 100, 0, 100)}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Reverse</span>
              <span>{reverseLabel}</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full ${s.reverseTime > 0 ? 'bg-amber-300/80' : 'bg-slate-400/70'}`}
                style={{
                  width: `${clamp(
                    s.reverseTime > 0
                      ? (s.reverseTime / REVERSE_DURATION) * 100
                      : (1 - s.reverseCooldown / REVERSE_COOLDOWN) * 100,
                    0,
                    100
                  )}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Override</span>
              <span>{overrideLabel}</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{
                  width: `${clamp((1 - s.overrideCooldown / s.overrideCooldownMax) * 100, 0, 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            Click rotate • Right click back • Shift 180 • WASD nudge • Space
            reverse • E override
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {s.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="conveyorchaos">
            <ArcadeHudCard className="text-center">
              <div className="text-3xl font-semibold text-white">Game Over</div>
              <div className="mt-2 text-lg text-white/80">
                Final Score: {s.score.toLocaleString()}
              </div>
              <div className="mt-4 text-[11px] uppercase tracking-[0.3em] text-white/50">
                Press R to restart
              </div>
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}

      {s.toastTime > 0 && s.toastText && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ opacity: toastOpacity }}
        >
          <ArcadeHudShell gameId="conveyorchaos">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">
              {s.toastText}
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </Html>
  );
};
