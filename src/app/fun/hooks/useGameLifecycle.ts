/**
 * useGameLifecycle Hook
 * 
 * Domain hook for managing game lifecycle events.
 * Handles mount/unmount, pause/resume, and restart logic.
 */
'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useGameUIState, useGameStateActions } from '../store/selectors';
import type { GameId } from '../store/types';

// Import game state reset functions
// These will be called when restarting games
import { dropperState } from '../games/Dropper';
import { reactPongState } from '../games/ReactPong';
import { spinBlockState } from '../games/SpinBlock';
import { stackzState } from '../games/Stackz';
import { sizrState } from '../games/Sizr';
import { shapeShifterState } from '../games/ShapeShifter';
import { skyBlitzState } from '../games/SkyBlitz';
import { fluxHopState } from '../games/FluxHop';
import { gyroState } from '../games/Gyro';
import { prismState } from '../games/Prism';
import { formaState } from '../games/Forma';
import { weaveState } from '../games/Weave';
import { paveState } from '../games/Pave';
import { voidRunnerState } from '../games/VoidRunner';
import { gravityRushState } from '../games/GravityRush';
import { apexState } from '../games/Apex';
// Classic ports
import { rolletteClassicState } from '../games/RolletteClassic';
import { skyBlitzClassicState } from '../games/SkyBlitzClassic';
import { dropperClassicState } from '../games/DropperClassic';
import { stackzCatchClassicState } from '../games/StackzCatchClassic';

/**
 * Map of game IDs to their Valtio state reset functions
 */
const GAME_STATE_RESETTERS: Partial<Record<GameId, () => void>> = {
  dropper: () => dropperState.reset(),
  reactpong: () => reactPongState.reset(),
  spinblock: () => spinBlockState.reset(),
  stackz: () => stackzState.reset(),
  sizr: () => sizrState.reset(),
  shapeshifter: () => shapeShifterState.reset(),
  skyblitz: () => skyBlitzState.reset(),
  fluxhop: () => fluxHopState.reset(),
  gyro: () => gyroState.reset(),
  prism: () => prismState.reset(),
  forma: () => formaState.reset(),
  weave: () => weaveState.reset(),
  pave: () => paveState.reset(),
  voidrunner: () => voidRunnerState.reset(),
  gravityrush: () => gravityRushState.reset(),
  apex: () => apexState.reset(),
  // Classic ports
  rolletteClassic: () => rolletteClassicState.reset(),
  skyblitzClassic: () => skyBlitzClassicState.reset(),
  dropperClassic: () => dropperClassicState.reset(),
  stackzCatchClassic: () => stackzCatchClassicState.reset(),
};

/**
 * Games that need remounting (restartSeed) to restart properly
 */
const REMOUNT_GAMES: GameId[] = [
  'geochrome',
  'pinball',
  'rollette',
  'flappybird',
  'museum',
  'voidrunner',
  'gravityrush',
  'apex',
];

export interface UseGameLifecycleOptions {
  onMount?: () => void;
  onUnmount?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

/**
 * Main game lifecycle hook
 */
export function useGameLifecycle(
  gameId: GameId,
  options: UseGameLifecycleOptions = {}
) {
  const { onMount, onUnmount, onPause, onResume } = options;
  const { paused, restartSeed } = useGameUIState();
  const { restartGame, setPaused, setHealth } = useGameStateActions();
  const previousPausedRef = useRef(paused);
  const mountedRef = useRef(false);

  // Mount/unmount lifecycle
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      onMount?.();
    }

    return () => {
      onUnmount?.();
      mountedRef.current = false;
    };
  }, [onMount, onUnmount]);

  // Pause/resume lifecycle
  useEffect(() => {
    if (previousPausedRef.current !== paused) {
      if (paused) {
        onPause?.();
      } else {
        onResume?.();
      }
      previousPausedRef.current = paused;
    }
  }, [paused, onPause, onResume]);

  /**
   * Reset the game state (both Valtio and Zustand)
   */
  const resetGameState = useCallback(() => {
    // Reset Valtio state if the game has one
    const resetFn = GAME_STATE_RESETTERS[gameId];
    if (resetFn) {
      resetFn();
    }

    // Reset Zustand store state
    setHealth(100);
    setPaused(false);

    // Trigger remount if needed
    if (REMOUNT_GAMES.includes(gameId)) {
      restartGame();
    }
  }, [gameId, setHealth, setPaused, restartGame]);

  /**
   * Full restart (reset state + trigger remount)
   */
  const restart = useCallback(() => {
    resetGameState();
    restartGame();
  }, [resetGameState, restartGame]);

  return {
    paused,
    restartSeed,
    restart,
    resetGameState,
    setPaused,
  };
}

/**
 * Hook for tracking game state changes
 */
export function useGameStateSync(
  gameId: GameId,
  getScore: () => number,
  getHealth?: () => number
) {
  const { setHealth } = useGameStateActions();
  const previousScoreRef = useRef(0);

  // Sync health from game state to Zustand store
  useEffect(() => {
    if (!getHealth) return;

    const interval = setInterval(() => {
      const health = getHealth();
      setHealth(health);
    }, 100);

    return () => clearInterval(interval);
  }, [getHealth, setHealth]);

  return {
    previousScore: previousScoreRef.current,
  };
}

/**
 * Hook for visibility change handling (tab switching)
 */
export function useVisibilityPause() {
  const { setPaused } = useGameStateActions();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setPaused(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setPaused]);
}

export default useGameLifecycle;
