import React from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CHAIN_WINDOW_S, DASH_COOLDOWN_S, ZONE_MULTIPLIER } from '../constants';

export interface RolletteHUDProps {
  score: number;
  highScore: number;
  bonusBank?: number;
  health: number;
  maxHealth: number;
  gameOver: boolean;
  combo: number;
  comboTimer: number;
  dashCooldown: number;
  dashCooldownMax: number;
  shieldTime: number;
  slowTime: number;
  slipperyTime: number;
  bonusMultiplier: number;
  bonusMultiplierTime: number;
  starChain: number;
  toast: string;
  toastTime: number;
  inZone: boolean;
  paused?: boolean;
}

const healthColor = (pct: number) => {
  if (pct > 0.66) return '#22c55e';
  if (pct > 0.33) return '#f59e0b';
  return '#ef4444';
};

export const RolletteHUD: React.FC<RolletteHUDProps> = ({
  score,
  highScore,
  bonusBank = 0,
  health,
  maxHealth,
  gameOver,
  combo,
  comboTimer,
  dashCooldown,
  dashCooldownMax,
  shieldTime,
  slowTime,
  slipperyTime,
  bonusMultiplier,
  bonusMultiplierTime,
  starChain,
  toast,
  toastTime,
  inZone,
  paused,
}) => {
  const healthPct =
    maxHealth > 0 ? THREE.MathUtils.clamp(health / maxHealth, 0, 1) : 0;
  const comboPct = THREE.MathUtils.clamp(comboTimer / CHAIN_WINDOW_S, 0, 1);
  const dashPct =
    dashCooldownMax > 0
      ? 1 - THREE.MathUtils.clamp(dashCooldown / dashCooldownMax, 0, 1)
      : 1;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute top-4 left-4 z-50 pointer-events-auto flex flex-col gap-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">
                Score
              </div>
              <div className="text-3xl font-bold font-mono">
                {Math.floor(score).toLocaleString()}
              </div>
              <div className="text-xs text-white/45 mt-1">
                Best: {Math.floor(highScore).toLocaleString()}
              </div>
            </div>

            <div className="min-w-[180px]">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Health</span>
                <span
                  className="font-mono"
                  style={{ color: healthColor(healthPct) }}
                >
                  {Math.max(0, Math.round(health))}%
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${healthPct * 100}%`,
                    backgroundColor: healthColor(healthPct),
                  }}
                />
              </div>
              {shieldTime > 0 && (
                <div className="mt-1 text-[10px] text-cyan-300/90">
                  Shield active
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                Bonus Bank
              </div>
              <div className="font-mono text-lg">
                {Math.floor(bonusBank).toLocaleString()}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                Nudge
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-fuchsia-400/90"
                  style={{ width: `${dashPct * 100}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-white/50">
                Space{' '}
                {dashCooldown > 0
                  ? `(CD ${dashCooldown.toFixed(1)}s)`
                  : '(Ready)'}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Combo</span>
              <span className="font-mono">+{combo}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-300/90"
                style={{ width: `${comboPct * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-white/60">
            <div className="flex items-center gap-3">
              {inZone && (
                <span className="text-emerald-300">
                  IN THE ZONE x{ZONE_MULTIPLIER}
                </span>
              )}
              {starChain > 0 && (
                <span className="text-pink-300">STAR x{starChain}</span>
              )}
              {slipperyTime > 0 && (
                <span className="text-red-300 font-mono">
                  SLIPPERY {slipperyTime.toFixed(1)}s
                </span>
              )}
              {slowTime > 0 && (
                <span className="text-cyan-200 font-mono">
                  SLOW {slowTime.toFixed(1)}s
                </span>
              )}
            </div>
            {bonusMultiplier > 1 && (
              <span className="text-cyan-300 font-mono">
                x{bonusMultiplier} ({bonusMultiplierTime.toFixed(1)}s)
              </span>
            )}
          </div>
        </div>

        <div className="text-white/50 text-xs pointer-events-auto">
          <div>WASD/Arrows: legacy velocity control • T: mouse/keyboard mode</div>
          <div>Mouse mode uses direct force steering (legacy Rollette feel)</div>
          <div>Space: nudge (tilt if spammed) • 1/2/3: swap arena theme • R: restart • P: pause</div>
        </div>
      </div>

      {toastTime > 0 && toast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="rounded-full border border-white/10 bg-black/60 px-4 py-2 text-white text-sm shadow backdrop-blur-sm">
            <span className="tracking-wide">{toast}</span>
          </div>
        </div>
      )}

      {paused && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/35 z-40 pointer-events-none">
          <div className="rounded-xl border border-white/10 bg-black/60 px-6 py-4 text-white shadow backdrop-blur-sm">
            <div className="text-2xl font-bold">Paused</div>
            <div className="text-sm text-white/60 mt-1">Press P to resume</div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 pointer-events-auto">
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-8 py-6 text-white shadow-2xl backdrop-blur-sm text-center">
            <div className="text-4xl font-extrabold tracking-wide">
              GAME OVER
            </div>
            <div className="mt-2 text-white/70 font-mono text-2xl">
              {Math.floor(score).toLocaleString()}
            </div>
            <div className="mt-1 text-white/40 text-sm">
              Best: {Math.floor(highScore).toLocaleString()}
            </div>
            <div className="mt-5 text-white/60">Press R to restart</div>
          </div>
        </div>
      )}
    </Html>
  );
};
