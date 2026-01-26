/**
 * GameHUD
 *
 * Score, health, and mode selection overlay for games.
 */
'use client';

import React from 'react';
import { getGameCard } from '../../config/games';
import { getArcadePanelCSS } from '../../config/themes';
import type { GameId } from '../../store/types';

export interface GameHUDProps {
  gameId: GameId;
  score: number;
  health?: number;
  showHealth?: boolean;
  showModeSelection?: boolean;
  modeOptions?: string[];
  currentMode?: string;
  onModeSwitch?: (mode: string) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  gameId,
  score,
  health = 100,
  showHealth = false,
  showModeSelection = false,
  modeOptions = [],
  currentMode,
  onModeSwitch,
}) => {
  const accent = getGameCard(gameId)?.accent ?? '#60a5fa';
  const panelStyles = getArcadePanelCSS(accent);

  return (
    <div
      className="fixed bottom-4 right-4 flex flex-col items-end space-y-2 text-white z-[9999] pointer-events-auto"
      style={panelStyles}
    >
      {/* Score Display */}
      <ScoreDisplay score={score} />

      {/* Health Bar (for games like SkyBlitz) */}
      {showHealth && <HealthBar health={health} />}

      {/* Mode Selection (for games with multiple modes) */}
      {showModeSelection && modeOptions.length > 0 && (
        <ModeSelector
          options={modeOptions}
          currentMode={currentMode}
          onSelect={onModeSwitch}
        />
      )}
    </div>
  );
};

/**
 * Score display component
 */
const ScoreDisplay: React.FC<{ score: number }> = ({ score }) => (
  <div
    className="px-4 py-2 border backdrop-blur-xl"
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'rgba(10, 12, 18, 0.6)',
      borderRadius: 'var(--arcade-radius-sm)',
      boxShadow: 'var(--arcade-elevation-soft)',
    }}
  >
    <span className="text-base font-semibold text-white/90">
      Score: {score}
    </span>
  </div>
);

/**
 * Health bar component
 */
const HealthBar: React.FC<{ health: number }> = ({ health }) => (
  <div
    className="px-4 py-2 w-48 border backdrop-blur-xl"
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'rgba(10, 12, 18, 0.6)',
      borderRadius: 'var(--arcade-radius-sm)',
      boxShadow: 'var(--arcade-elevation-soft)',
    }}
  >
    <span
      className="text-[11px] uppercase tracking-[0.28em] text-white/50"
      style={{ fontFamily: 'var(--arcade-mono)' }}
    >
      Health
    </span>
    <div className="w-full bg-white/10 h-2 mt-2 rounded-full">
      <div
        className="h-2 rounded-full transition-all duration-300"
        style={{
          width: `${Math.max(0, Math.min(100, health))}%`,
          background:
            'linear-gradient(90deg, var(--arcade-accent), rgba(247, 178, 103, 0.9))',
        }}
      />
    </div>
  </div>
);

/**
 * Mode selector component
 */
const ModeSelector: React.FC<{
  options: string[];
  currentMode?: string;
  onSelect?: (mode: string) => void;
}> = ({ options, currentMode, onSelect }) => (
  <div
    className="px-4 py-2 w-48 flex flex-col space-y-1 border backdrop-blur-xl"
    style={{
      borderColor: 'var(--arcade-stroke)',
      background: 'rgba(10, 12, 18, 0.6)',
      borderRadius: 'var(--arcade-radius-sm)',
      boxShadow: 'var(--arcade-elevation-soft)',
    }}
  >
    <span
      className="text-[11px] uppercase tracking-[0.28em] text-white/50"
      style={{ fontFamily: 'var(--arcade-mono)' }}
    >
      Mode
    </span>
    <div className="flex flex-wrap mt-2 gap-2">
      {options.map((mode) => {
        const isActive = currentMode === mode;
        return (
          <button
            key={mode}
            onClick={() => onSelect?.(mode)}
            className="text-[11px] rounded px-2 py-1 border transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10 active:translate-y-0 active:scale-95"
            style={{
              borderColor: isActive
                ? 'var(--arcade-accent)'
                : 'var(--arcade-stroke)',
              color: isActive
                ? 'var(--arcade-accent)'
                : 'rgba(255,255,255,0.8)',
              borderRadius: 'var(--arcade-radius-sm)',
            }}
          >
            {mode}
          </button>
        );
      })}
    </div>
  </div>
);

/**
 * Hook to get HUD configuration for a specific game
 */
export function useHUDConfig(gameId: GameId) {
  const showHealth = gameId === 'skyblitz';
  const showModeSelection = gameId === 'skyblitz' || gameId === 'reactpong';

  let modeOptions: string[] = [];
  if (gameId === 'skyblitz') {
    modeOptions = ['UfoMode', 'RunnerManMode'];
  } else if (gameId === 'reactpong') {
    modeOptions = ['SoloPaddle', 'SoloWalls'];
  }

  // ShapeShifter has its own built-in HUD
  const useGenericHUD = gameId !== 'shapeshifter';

  return {
    showHealth,
    showModeSelection,
    modeOptions,
    useGenericHUD,
  };
}

export default GameHUD;
