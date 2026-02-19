'use client';

import React from 'react';
import type { GameId } from '../store/types';
import { getGameCard } from '../config/games';
import { getArcadePanelCSS } from '../config/themes';
import PacmanLoading from './LoadingAnimation';

interface GameLoadingOverlayProps {
  gameId: GameId;
  progress: number;
  visible: boolean;
}

const GameLoadingOverlay: React.FC<GameLoadingOverlayProps> = ({
  gameId,
  progress,
  visible,
}) => {
  const card = getGameCard(gameId);
  const accent = card?.accent ?? '#7dd3fc';
  const title = card?.title ?? 'Loading';
  const panelStyles = getArcadePanelCSS(accent);
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const stageLabel =
    clampedProgress < 20
      ? 'Loading module'
      : clampedProgress < 45
        ? 'Compiling shaders'
        : clampedProgress < 72
          ? 'Binding controls + HUD'
          : clampedProgress < 95
            ? 'Optimizing runtime'
            : 'Launching';
  const percentLabel = `${Math.round(clampedProgress)}%`;

  return (
    <div
      className={`fixed inset-0 z-[10000] transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={panelStyles}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 15% 15%, rgba(120, 119, 198, 0.25), transparent 55%), radial-gradient(circle at 80% 10%, rgba(255, 180, 102, 0.2), transparent 45%), radial-gradient(circle at 20% 80%, rgba(56, 189, 248, 0.2), transparent 60%), linear-gradient(180deg, rgba(8, 10, 16, 0.92), rgba(5, 6, 10, 0.96))',
        }}
      />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.08), transparent 55%), radial-gradient(circle at 70% 70%, rgba(255, 255, 255, 0.05), transparent 60%)',
          mixBlendMode: 'screen',
        }}
      />
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div
          className="w-full max-w-md border border-white/10 bg-white/5 p-6 text-center backdrop-blur-2xl"
          style={{
            borderRadius: 'var(--arcade-radius)',
            boxShadow: `var(--arcade-elevation), 0 0 40px ${accent}33`,
          }}
        >
          <div
            className="text-[11px] uppercase tracking-[0.5em] text-white/50"
            style={{ fontFamily: 'var(--arcade-mono)' }}
          >
            Loading
          </div>
          <div className="mt-3 text-2xl font-semibold text-white">{title}</div>
          <div
            className="mt-2 text-[10px] uppercase tracking-[0.3em] text-white/50"
            style={{ fontFamily: 'var(--arcade-mono)' }}
          >
            {stageLabel}
          </div>
          <div className="mt-6">
            <PacmanLoading
              progress={clampedProgress}
              backdrop={false}
              showLabel={false}
              className="h-auto"
            />
          </div>
          <div className="mt-5 flex items-center justify-between text-[10px] text-white/45">
            <span>Arcade warm-up</span>
            <span style={{ fontFamily: 'var(--arcade-mono)' }}>{percentLabel}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${clampedProgress}%`,
                background: `linear-gradient(90deg, ${accent}, rgba(247, 178, 103, 0.95))`,
              }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[9px] uppercase tracking-[0.18em] text-white/55">
            <div className={clampedProgress >= 25 ? 'text-cyan-200/90' : ''}>
              Render
            </div>
            <div className={clampedProgress >= 60 ? 'text-cyan-200/90' : ''}>
              Systems
            </div>
            <div className={clampedProgress >= 90 ? 'text-cyan-200/90' : ''}>
              Start
            </div>
          </div>
          <div
            className="mt-3 text-[11px] uppercase tracking-[0.35em] text-white/40"
            style={{ fontFamily: 'var(--arcade-mono)' }}
          >
            Calibrating arcade scene
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLoadingOverlay;
