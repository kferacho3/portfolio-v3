/**
 * ArcadeDeck
 * 
 * Bottom game selector carousel for the home screen.
 * Allows browsing and launching games.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { GAME_CARDS, TOTAL_GAMES } from '../../config/games';
import { getArcadePanelCSS } from '../../config/themes';
import type { GameCard } from '../../store/types';

export interface ArcadeDeckProps {
  selectedIndex: number;
  onSelectGame: (index: number) => void;
  onLaunchGame: (gameId: string) => void;
}

export const ArcadeDeck: React.FC<ArcadeDeckProps> = ({
  selectedIndex,
  onSelectGame,
  onLaunchGame,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const selectedGame = GAME_CARDS[selectedIndex] ?? GAME_CARDS[0];
  const panelStyles = getArcadePanelCSS(selectedGame.accent);

  // Reset info panel when game changes
  useEffect(() => {
    setShowInfo(false);
  }, [selectedIndex]);

  const handleSelectPrevious = () => {
    onSelectGame((selectedIndex - 1 + TOTAL_GAMES) % TOTAL_GAMES);
  };

  const handleSelectNext = () => {
    onSelectGame((selectedIndex + 1) % TOTAL_GAMES);
  };

  const handleLaunchSelected = () => {
    if (selectedGame) {
      onLaunchGame(selectedGame.id);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-6 z-[9999] flex justify-center px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-[760px] animate-in fade-in slide-in-from-bottom-6 duration-700"
        style={panelStyles}
      >
        <div
          className="relative overflow-hidden rounded-[26px] border px-4 py-3 backdrop-blur-xl"
          style={{
            borderColor: 'var(--arcade-stroke)',
            background: 'var(--arcade-surface)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45), 0 0 30px var(--arcade-glow)',
          }}
        >
          {/* Gradient overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.08), transparent 55%), radial-gradient(circle at 85% 20%, rgba(255, 180, 102, 0.25), transparent 50%)',
              mixBlendMode: 'screen',
            }}
          />

          {/* Main content */}
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <NavigationButton
                direction="prev"
                onClick={handleSelectPrevious}
              />
              
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-lg font-semibold text-white md:text-xl truncate">
                  {selectedGame.title}
                </span>
                <InfoButton
                  isActive={showInfo}
                  onClick={() => setShowInfo((prev) => !prev)}
                />
              </div>
              
              <NavigationButton
                direction="next"
                onClick={handleSelectNext}
              />
            </div>

            <div className="flex-shrink-0">
              <LaunchButton onClick={handleLaunchSelected} />
            </div>
          </div>

          {/* Info panel */}
          {showInfo && (
            <div
              className="relative mt-3 rounded-xl border px-3 py-2 text-sm text-white/80"
              style={{
                borderColor: 'var(--arcade-stroke)',
                background: 'rgba(10, 12, 18, 0.6)',
              }}
            >
              {selectedGame.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Navigation button (prev/next) - Fixed position and styling
 */
const NavigationButton: React.FC<{
  direction: 'prev' | 'next';
  onClick: () => void;
}> = ({ direction, onClick }) => (
  <button
    onClick={onClick}
    aria-label={direction === 'prev' ? 'Previous game' : 'Next game'}
    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border text-base font-semibold text-white/90 transition-all hover:scale-110 hover:text-white hover:bg-white/10 active:scale-95"
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'rgba(10, 12, 18, 0.7)',
      fontFamily: '"Geist Mono", monospace',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    }}
  >
    {direction === 'prev' ? '←' : '→'}
  </button>
);

/**
 * Info toggle button
 */
const InfoButton: React.FC<{
  isActive: boolean;
  onClick: () => void;
}> = ({ isActive, onClick }) => (
  <button
    onClick={onClick}
    aria-label="Toggle game info"
    aria-pressed={isActive}
    className="flex h-8 w-8 items-center justify-center rounded-full border text-[11px] text-white/70 transition hover:text-white"
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'rgba(10, 12, 18, 0.45)',
      fontFamily: '"Geist Mono", monospace',
    }}
  >
    i
  </button>
);

/**
 * Launch/Start button
 */
const LaunchButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="rounded-full px-5 py-2 text-[11px] uppercase tracking-[0.35em] text-black transition hover:brightness-110"
    style={{
      background: 'linear-gradient(135deg, var(--arcade-accent), #f7b267)',
      fontFamily: '"Geist Mono", monospace',
    }}
  >
    Start
  </button>
);

export default ArcadeDeck;
