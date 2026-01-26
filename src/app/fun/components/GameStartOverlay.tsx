'use client';

import React from 'react';
import type { GameId } from '../store/types';
import { getGameCard } from '../config/games';
import { getArcadePanelCSS } from '../config/themes';

interface GameStartOverlayProps {
  gameId: GameId;
  visible: boolean;
  onStart: () => void;
}

const GameStartOverlay: React.FC<GameStartOverlayProps> = ({
  gameId,
  visible,
  onStart,
}) => {
  const card = getGameCard(gameId);
  const accent = card?.accent ?? '#7dd3fc';
  const title = card?.title ?? 'Game';
  const panelStyles = getArcadePanelCSS(accent);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={panelStyles}
      onClick={onStart}
      role="button"
      aria-label="Tap to start"
      tabIndex={0}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 18% 18%, rgba(120, 119, 198, 0.25), transparent 58%), radial-gradient(circle at 82% 12%, rgba(255, 180, 102, 0.18), transparent 55%), linear-gradient(180deg, rgba(6, 8, 12, 0.82), rgba(3, 4, 8, 0.9))',
        }}
      />
      <div
        className="relative w-full max-w-sm border border-white/10 bg-white/5 px-6 py-5 text-center backdrop-blur-2xl"
        style={{
          borderRadius: 'var(--arcade-radius)',
          boxShadow: `var(--arcade-elevation), 0 0 36px ${accent}22`,
        }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.4em] text-white/50"
          style={{ fontFamily: 'var(--arcade-mono)' }}
        >
          Ready Player
        </div>
        <div className="mt-3 text-xl font-semibold text-white/90">{title}</div>
        <div className="mt-4 text-sm text-white/60">
          Tap to start or press
          <span
            className="ml-2 inline-flex items-center border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-white/70"
            style={{
              borderRadius: 'var(--arcade-radius-sm)',
              fontFamily: 'var(--arcade-mono)',
            }}
          >
            Enter
          </span>
        </div>
        <div className="mt-5 flex items-center justify-center">
          <div
            className="h-1 w-24 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0))`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default GameStartOverlay;
