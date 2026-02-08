/**
 * ArcadeDeck
 *
 * Bottom game selector carousel for the home screen.
 * Allows browsing and launching games.
 */
'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { GAME_CARDS, TOTAL_GAMES } from '../../config/games';
import { getArcadePanelCSS } from '../../config/themes';

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
  const router = useRouter();
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

  const handlePreloadSelected = () => {
    if (!selectedGame) return;
    // Prefetch the route JS without executing/loading the game module.
    router.prefetch(`/fun/${selectedGame.id}`);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center px-4 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      <div
        className="pointer-events-auto w-full max-w-[760px] animate-in fade-in slide-in-from-bottom-4 duration-700"
        style={panelStyles}
      >
        <div
          className="relative overflow-hidden border px-4 py-3 md:px-5 md:py-4 backdrop-blur-none md:backdrop-blur-2xl"
          style={{
            borderColor: 'var(--arcade-stroke)',
            background: 'var(--arcade-surface)',
            boxShadow: 'var(--arcade-elevation), 0 0 30px var(--arcade-glow)',
            borderRadius: 'var(--arcade-radius)',
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
          <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="flex items-center justify-between gap-3 min-w-0">
              <NavigationButton
                direction="prev"
                onClick={handleSelectPrevious}
              />

              <div className="flex min-w-0 flex-1 items-center justify-center gap-2 md:justify-start">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-white/90 md:text-lg truncate text-center md:text-left">
                    {selectedGame.title}
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.28em] text-white/40 text-center md:text-left"
                    style={{ fontFamily: 'var(--arcade-mono)' }}
                  >
                    {selectedIndex + 1} / {TOTAL_GAMES}
                  </div>
                </div>
                <InfoButton
                  isActive={showInfo}
                  onClick={() => setShowInfo((prev) => !prev)}
                />
              </div>

              <NavigationButton direction="next" onClick={handleSelectNext} />
            </div>

            <LaunchButton
              className="w-full justify-center md:w-auto"
              onClick={handleLaunchSelected}
              onPreload={handlePreloadSelected}
            />
          </div>

          {/* Info panel */}
          {showInfo && (
            <div
              className="relative mt-3 border px-3 py-2 text-xs md:text-sm text-white/70"
              style={{
                borderColor: 'var(--arcade-stroke)',
                background: 'rgba(10, 12, 18, 0.55)',
                borderRadius: 'var(--arcade-radius-sm)',
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
    className="flex h-10 w-10 flex-shrink-0 items-center justify-center border text-base font-semibold text-white/80 transition-all duration-300 hover:-translate-y-0.5 hover:text-white hover:bg-white/10 active:translate-y-0 active:scale-95"
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'rgba(10, 12, 18, 0.7)',
      borderRadius: 'var(--arcade-radius-sm)',
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
    className="flex h-8 w-8 items-center justify-center border text-[11px] text-white/60 transition-all duration-300 hover:-translate-y-0.5 hover:text-white active:translate-y-0 active:scale-95"
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'rgba(10, 12, 18, 0.45)',
      borderRadius: 'var(--arcade-radius-sm)',
      fontFamily: 'var(--arcade-mono)',
    }}
  >
    i
  </button>
);

/**
 * Launch/Start button
 */
const LaunchButton: React.FC<{
  className?: string;
  onClick: () => void;
  onPreload: () => void;
}> = ({ className, onClick, onPreload }) => (
  <button
    onClick={onClick}
    onMouseEnter={onPreload}
    onFocus={onPreload}
    className={`group inline-flex items-center gap-2 border px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:text-white active:translate-y-0 active:scale-95 ${className ?? ''}`}
    style={{
      background:
        'linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04))',
      borderColor: 'var(--arcade-stroke)',
      borderRadius: 'var(--arcade-radius-sm)',
      fontFamily: 'var(--arcade-mono)',
      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
    }}
  >
    Play
    <span
      className="transition-opacity duration-300 group-hover:opacity-80"
      style={{ color: 'var(--arcade-accent)' }}
    >
      ↗
    </span>
  </button>
);

export default ArcadeDeck;
