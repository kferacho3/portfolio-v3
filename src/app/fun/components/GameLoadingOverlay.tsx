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
          <div className="mt-6">
            <PacmanLoading
              progress={progress}
              backdrop={false}
              showLabel={false}
              className="h-auto"
            />
          </div>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: `linear-gradient(90deg, ${accent}, rgba(247, 178, 103, 0.95))`,
              }}
            />
          </div>
          <div
            className="mt-3 text-[11px] uppercase tracking-[0.35em] text-white/40"
            style={{ fontFamily: 'var(--arcade-mono)' }}
          >
            Warming up the arcade module
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLoadingOverlay;
