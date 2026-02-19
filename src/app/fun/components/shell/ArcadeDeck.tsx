/**
 * ArcadeDeck
 *
 * Bottom game selector carousel for the home screen.
 * Allows browsing and launching games.
 */
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { isGameUnlocked, PLAYABLE_GAME_ALLOWLIST } from '../../config/access';
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
  const [showCatalog, setShowCatalog] = useState(false);
  const selectedGame = GAME_CARDS[selectedIndex] ?? GAME_CARDS[0];
  const selectedGameUnlocked = isGameUnlocked(selectedGame.id);
  const unlockedPreviewCount = PLAYABLE_GAME_ALLOWLIST.length;
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
    if (!selectedGame || !selectedGameUnlocked) return;
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

          <div className="relative mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative h-7 w-7 overflow-hidden rounded-md border border-white/20 bg-white/5 p-1">
                <Image
                  src="/symbol.png"
                  alt=""
                  fill
                  aria-hidden
                  className="object-contain"
                  sizes="28px"
                />
              </span>
              <div className="relative h-5 w-[120px]">
                <Image
                  src="/logo.png"
                  alt="Racho Arcade"
                  fill
                  className="object-contain"
                  sizes="120px"
                />
                <Image
                  src="/logo-white.png"
                  alt=""
                  fill
                  aria-hidden
                  className="object-contain opacity-50 mix-blend-screen"
                  sizes="120px"
                />
              </div>
            </div>
            <span
              className="text-[9px] uppercase tracking-[0.24em] text-white/45"
              style={{ fontFamily: 'var(--arcade-mono)' }}
            >
              Lobby Deck
            </span>
          </div>

          <div
            className="relative mb-3 border px-3 py-2 text-[10px] leading-relaxed text-white/75 md:text-[11px]"
            style={{
              borderColor: 'var(--arcade-stroke)',
              background: 'rgba(10, 12, 18, 0.55)',
              borderRadius: 'var(--arcade-radius-sm)',
            }}
          >
            Showing {unlockedPreviewCount} playable previews in this lobby.
            Prism3D Studio hosts 60+ games total, and locked cards here are
            sneak peeks with full descriptions.
          </div>

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
                  {!selectedGameUnlocked && (
                    <div
                      className="text-[9px] uppercase tracking-[0.24em] text-cyan-200/80 text-center md:text-left"
                      style={{ fontFamily: 'var(--arcade-mono)' }}
                    >
                      Locked Here
                    </div>
                  )}
                  <div
                    className="text-[10px] uppercase tracking-[0.28em] text-white/40 text-center md:text-left"
                    style={{ fontFamily: 'var(--arcade-mono)' }}
                  >
                    {selectedIndex + 1} / {TOTAL_GAMES}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <InfoButton
                    isActive={showInfo}
                    onClick={() => setShowInfo((prev) => !prev)}
                  />
                  <CatalogButton
                    isActive={showCatalog}
                    onClick={() => setShowCatalog((prev) => !prev)}
                  />
                </div>
              </div>

              <NavigationButton direction="next" onClick={handleSelectNext} />
            </div>

            <LaunchButton
              locked={!selectedGameUnlocked}
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
              {!selectedGameUnlocked && (
                <div className="mt-2 text-cyan-200/90">
                  Locked in this arcade. This is a sneak peek. Play it on
                  Prism3D.
                </div>
              )}
            </div>
          )}

          {showCatalog && (
            <div
              className="relative mt-3 border px-3 py-3 text-white/75"
              style={{
                borderColor: 'var(--arcade-stroke)',
                background: 'rgba(10, 12, 18, 0.6)',
                borderRadius: 'var(--arcade-radius-sm)',
              }}
            >
              <div
                className="mb-2 text-[10px] uppercase tracking-[0.28em] text-white/45"
                style={{ fontFamily: 'var(--arcade-mono)' }}
              >
                Full Game Catalog
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {GAME_CARDS.map((game, index) => {
                  const unlocked = isGameUnlocked(game.id);
                  const isSelected = game.id === selectedGame.id;
                  return (
                    <button
                      key={game.id}
                      onClick={() => onSelectGame(index)}
                      className={`w-full border px-3 py-2 text-left transition ${
                        isSelected
                          ? 'border-cyan-300/55 bg-cyan-400/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                      style={{ borderRadius: 'var(--arcade-radius-sm)' }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white/90">
                          {game.title}
                        </div>
                        <span
                          className={`text-[9px] uppercase tracking-[0.22em] ${
                            unlocked ? 'text-emerald-200/80' : 'text-cyan-200/80'
                          }`}
                          style={{ fontFamily: 'var(--arcade-mono)' }}
                        >
                          {unlocked ? 'Playable Here' : 'Sneak Peek'}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed text-white/65">
                        {game.description}
                      </div>
                    </button>
                  );
                })}
              </div>
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

const CatalogButton: React.FC<{
  isActive: boolean;
  onClick: () => void;
}> = ({ isActive, onClick }) => (
  <button
    onClick={onClick}
    aria-label="Toggle full game catalog"
    aria-pressed={isActive}
    className="flex h-8 items-center justify-center border px-2 text-[10px] uppercase tracking-[0.18em] text-white/60 transition-all duration-300 hover:-translate-y-0.5 hover:text-white active:translate-y-0 active:scale-95"
    style={{
      borderColor: isActive ? 'var(--arcade-accent)' : 'var(--arcade-stroke)',
      background: isActive ? 'rgba(125, 227, 255, 0.14)' : 'rgba(10, 12, 18, 0.45)',
      color: isActive ? 'var(--arcade-accent)' : 'rgba(255,255,255,0.72)',
      borderRadius: 'var(--arcade-radius-sm)',
      fontFamily: 'var(--arcade-mono)',
    }}
  >
    List
  </button>
);

/**
 * Launch/Start button
 */
const LaunchButton: React.FC<{
  locked: boolean;
  className?: string;
  onClick: () => void;
  onPreload: () => void;
}> = ({ locked, className, onClick, onPreload }) => (
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
    <span className="relative h-4 w-4 overflow-hidden rounded-full border border-white/20 bg-white/5 p-[2px]">
      <Image
        src="/symbol.png"
        alt=""
        fill
        aria-hidden
        className="object-contain"
        sizes="16px"
      />
    </span>
    {locked ? 'Unlock' : 'Play'}
    <span
      className="transition-opacity duration-300 group-hover:opacity-80"
      style={{ color: locked ? '#7de3ff' : 'var(--arcade-accent)' }}
    >
      {locked ? 'Prism3D ↗' : '↗'}
    </span>
  </button>
);

export default ArcadeDeck;
