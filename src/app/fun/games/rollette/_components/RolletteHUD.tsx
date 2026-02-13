import React from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { COMBO_WINDOW_S } from '../constants';

export interface RolletteHUDProps {
  score: number;
  highScore: number;
  bonusBank: number;
  health: number;
  maxHealth: number;
  gameOver: boolean;
  combo: number;
  comboTimer: number;
  nudgeCooldown: number;
  nudgeCooldownMax: number;
  shieldTime: number;
  multiplier: number;
  multiplierTime: number;
  powerMode: string | null;
  powerTime: number;
  wizardActive: boolean;
  wizardTime: number;
  multiballActive: boolean;
  multiballTime: number;
  multiballLit: boolean;
  inMiniZone: boolean;
  toast: string;
  toastTime: number;
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
  bonusBank,
  health,
  maxHealth,
  gameOver,
  combo,
  comboTimer,
  nudgeCooldown,
  nudgeCooldownMax,
  shieldTime,
  multiplier,
  multiplierTime,
  powerMode,
  powerTime,
  wizardActive,
  wizardTime,
  multiballActive,
  multiballTime,
  multiballLit,
  inMiniZone,
  toast,
  toastTime,
  paused,
}) => {
  const healthPct = maxHealth > 0 ? THREE.MathUtils.clamp(health / maxHealth, 0, 1) : 0;
  const comboPct = THREE.MathUtils.clamp(comboTimer / COMBO_WINDOW_S, 0, 1);
  const nudgePct =
    nudgeCooldownMax > 0
      ? 1 - THREE.MathUtils.clamp(nudgeCooldown / nudgeCooldownMax, 0, 1)
      : 1;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute top-4 left-4 z-50 pointer-events-none flex flex-col gap-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/72 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">Score</div>
              <div className="text-3xl font-bold font-mono">{Math.floor(score).toLocaleString()}</div>
              <div className="text-xs text-white/45 mt-1">Best: {Math.floor(highScore).toLocaleString()}</div>
            </div>

            <div className="min-w-[190px]">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Integrity</span>
                <span className="font-mono" style={{ color: healthColor(healthPct) }}>
                  {Math.max(0, Math.round(health))}%
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{ width: `${healthPct * 100}%`, backgroundColor: healthColor(healthPct) }}
                />
              </div>
              {shieldTime > 0 && <div className="mt-1 text-[10px] text-cyan-300/90">Shield active</div>}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">Bonus Bank</div>
              <div className="font-mono text-lg">{Math.floor(bonusBank).toLocaleString()}</div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">Nudge</div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-fuchsia-400/90" style={{ width: `${nudgePct * 100}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-white/50">
                Space {nudgeCooldown > 0 ? `(CD ${nudgeCooldown.toFixed(1)}s)` : '(Ready)'}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Combo</span>
              <span className="font-mono">x{Math.max(1, combo)}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-amber-300/90" style={{ width: `${comboPct * 100}%` }} />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-white/60">
            <div className="flex items-center gap-3">
              {inMiniZone && <span className="text-emerald-300">MINI ZONE x1.3</span>}
              {powerMode && <span className="text-cyan-300 font-mono">{powerMode} {powerTime.toFixed(1)}s</span>}
              {multiballLit && <span className="text-yellow-300">JACKPOT LIT</span>}
              {multiballActive && <span className="text-fuchsia-300">MULTIBALL {multiballTime.toFixed(1)}s</span>}
              {wizardActive && <span className="text-orange-300">WIZARD {wizardTime.toFixed(1)}s</span>}
            </div>
            {multiplier > 1 && (
              <span className="text-cyan-300 font-mono">x{multiplier} ({multiplierTime.toFixed(1)}s)</span>
            )}
          </div>
        </div>

        <div className="text-white/50 text-xs">
          <div>WASD/Arrows: direct ball control</div>
          <div>Mouse mode: force steering • T toggles control style</div>
          <div>Space: nudge (tilt lock if spammed) • 1-8: arena theme • R: restart • P: pause</div>
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
            <div className="text-4xl font-extrabold tracking-wide">BALL LOST</div>
            <div className="mt-2 text-white/70 font-mono text-2xl">{Math.floor(score).toLocaleString()}</div>
            <div className="mt-1 text-white/40 text-sm">Best: {Math.floor(highScore).toLocaleString()}</div>
            <div className="mt-5 text-white/60">Press R to restart</div>
          </div>
        </div>
      )}
    </Html>
  );
};
