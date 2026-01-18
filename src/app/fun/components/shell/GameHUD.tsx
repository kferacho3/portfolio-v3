/**
 * GameHUD
 * 
 * Score, health, and mode selection overlay for games.
 */
'use client';

import React from 'react';
import type { GameId, SkyBlitzMode, ReactPongMode } from '../../store/types';

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
  return (
    <div className="fixed bottom-4 right-4 flex flex-col items-end space-y-2 text-white z-[9999] pointer-events-auto">
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
  <div className="bg-slate-950/80 px-4 py-2 rounded shadow border border-white/10">
    <span className="text-lg font-semibold">Score: {score}</span>
  </div>
);

/**
 * Health bar component
 */
const HealthBar: React.FC<{ health: number }> = ({ health }) => (
  <div className="bg-slate-950/80 px-4 py-2 rounded shadow w-48 border border-white/10">
    <span className="text-sm">Health</span>
    <div className="w-full bg-white/10 h-2 mt-1 rounded">
      <div
        className="bg-red-500 h-2 rounded transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, health))}%` }}
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
  <div className="bg-slate-950/80 px-4 py-2 rounded shadow w-48 flex flex-col space-y-1 border border-white/10">
    <span className="text-xs uppercase tracking-[0.2em] text-white/60">Mode</span>
    <div className="flex flex-wrap mt-1 gap-2">
      {options.map((mode) => (
        <button
          key={mode}
          onClick={() => onSelect?.(mode)}
          className={`text-xs rounded px-2 py-1 border border-white/10 bg-white/5 hover:bg-white/15 transition-colors ${
            currentMode === mode
              ? 'border-[#39FF14]/60 text-[#39FF14]'
              : 'text-white/80'
          }`}
        >
          {mode}
        </button>
      ))}
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
