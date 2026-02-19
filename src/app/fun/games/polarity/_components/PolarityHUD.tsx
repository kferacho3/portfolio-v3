'use client';

import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import {
  ArcadeHudCard,
  ArcadeHudPill,
  ArcadeHudShell,
} from '../../../components/shell/ArcadeHudPanel';
import FixedViewportOverlay from '../../_shared/FixedViewportOverlay';
import { clamp } from '../utils';
import { BEST_SCORE_KEY, ZONE_SCORE_MULT } from '../constants';
import { polarityState } from '../state';

export const PolarityHUD: React.FC = () => {
  const snap = useSnapshot(polarityState);
  const chargeLabel = snap.charge === 1 ? '+' : '−';
  const chargePill =
    snap.charge === 1
      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-300/20'
      : 'bg-rose-500/20 text-rose-200 border-rose-300/20';
  const eventLabel =
    snap.event === 'PolarityStorm'
      ? 'Polarity Storm'
      : snap.event === 'Superconductor'
        ? 'Superconductor Zone'
        : snap.event === 'IonBloom'
          ? 'Ion Bloom'
          : '';
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) polarityState.bestScore = Number(stored) || 0;
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${snap.bestScore}`);
  }, [snap.bestScore]);
  const toastOpacity = clamp(snap.toastTime / 1.1, 0, 1);

  return (
    <FixedViewportOverlay>
      <ArcadeHudShell
        gameId="polarity"
        className="absolute top-4 left-4 pointer-events-auto"
      >
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[11px] uppercase tracking-[0.32em] text-white/60">
            Magnetic Resonance
          </div>
          <div className="text-[11px] text-white/45">
            Flip → Whip → Stabilize
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.32em] text-white/50">
            Score
          </div>
          <div className="text-2xl font-semibold text-white">
            {snap.score.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/50">
            Best {snap.bestScore.toLocaleString()}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-[3px] text-[9px] uppercase tracking-[0.24em] ${chargePill}`}
            >
              Charge {chargeLabel}
            </span>
            <ArcadeHudPill label={`Combo x${snap.combo}`} />
            <ArcadeHudPill label={`Lvl ${snap.level}`} />
            {snap.burstReady && (
              <ArcadeHudPill label="Resonance Ready" tone="accent" />
            )}
            {snap.zone && (
              <ArcadeHudPill
                label={`Zone x${ZONE_SCORE_MULT}`}
                tone={snap.zoneActive ? 'accent' : 'default'}
              />
            )}
            {snap.event && (
              <ArcadeHudPill
                label={`${eventLabel} ${Math.ceil(snap.eventTime)}s`}
                tone="accent"
              />
            )}
          </div>

          <div className="mt-3 space-y-2 text-[11px] text-white/70">
            <div className="flex items-center justify-between">
              <span>Health</span>
              <span>{Math.round(snap.health)}%</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-emerald-400/80"
                style={{ width: `${clamp(snap.health, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Instability</span>
              <span>{Math.round(snap.instability)}%</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-fuchsia-400/70"
                style={{ width: `${clamp(snap.instability, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Combo window</span>
              <span>{snap.comboTime.toFixed(2)}s</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{
                  width: `${clamp((snap.comboTime / snap.comboTimeMax) * 100, 0, 100)}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Pulse</span>
              <span>
                {snap.pulseCooldown > 0
                  ? snap.pulseCooldown.toFixed(1)
                  : 'ready'}
              </span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-amber-300/70"
                style={{
                  width: `${clamp((1 - snap.pulseCooldown / snap.pulseCooldownMax) * 100, 0, 100)}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Resonance</span>
              <span>{Math.round(snap.resonance)}%</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-300/70"
                style={{ width: `${clamp(snap.resonance, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Stabilize</span>
              <span>
                {snap.stabilizeTime > 0
                  ? snap.stabilizeTime.toFixed(1)
                  : snap.stabilizeCooldown > 0
                    ? snap.stabilizeCooldown.toFixed(1)
                    : 'ready'}
              </span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-sky-300/70"
                style={{
                  width: `${clamp(
                    snap.stabilizeTime > 0
                      ? (snap.stabilizeTime / 1.2) * 100
                      : (1 -
                          snap.stabilizeCooldown / snap.stabilizeCooldownMax) *
                          100,
                    0,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            WASD roll • Space flip • Click pulse • Shift stabilize
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {snap.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="polarity">
            <ArcadeHudCard className="text-center">
              <div className="text-3xl font-semibold text-white">Game Over</div>
              <div className="mt-2 text-lg text-white/80">
                Final Score: {snap.score.toLocaleString()}
              </div>
              <div className="mt-4 text-[11px] uppercase tracking-[0.3em] text-white/50">
                Press R to restart
              </div>
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}

      {snap.toastTime > 0 && snap.toastText && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ opacity: toastOpacity }}
        >
          <ArcadeHudShell gameId="polarity">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">
              {snap.toastText}
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </FixedViewportOverlay>
  );
};
