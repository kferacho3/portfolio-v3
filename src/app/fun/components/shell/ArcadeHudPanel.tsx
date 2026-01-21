'use client';

import React from 'react';
import { getArcadePanelCSS } from '../../config/themes';
import { getGameCard } from '../../config/games';
import type { GameId } from '../../store/types';

export const ArcadeHudShell: React.FC<{
  gameId: GameId;
  className?: string;
  children: React.ReactNode;
}> = ({ gameId, className, children }) => {
  const gameCard = getGameCard(gameId);
  const accent = gameCard?.accent ?? '#60a5fa';
  const panelStyles = getArcadePanelCSS(accent);

  return (
    <div className={className} style={panelStyles}>
      {children}
    </div>
  );
};

export const ArcadeHudCard: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <div
    className={`rounded-2xl border px-4 py-3 text-white shadow-lg backdrop-blur ${className ?? ''}`}
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'var(--arcade-panel)',
      boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
    }}
  >
    {children}
  </div>
);

export const ArcadeHudPill: React.FC<{
  label: string;
  tone?: 'default' | 'accent' | 'warn';
}> = ({ label, tone = 'default' }) => {
  const styles =
    tone === 'accent'
      ? 'border-[var(--arcade-accent)]/40 text-[var(--arcade-accent)] bg-[var(--arcade-accent)]/10'
      : tone === 'warn'
        ? 'border-rose-300/30 text-rose-200 bg-rose-500/15'
        : 'border-white/10 text-white/70 bg-white/5';

  return <span className={`inline-flex items-center rounded-full border px-2 py-[3px] text-[9px] uppercase tracking-[0.24em] ${styles}`}>{label}</span>;
};

export default ArcadeHudShell;
