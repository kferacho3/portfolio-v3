// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * useGameLifecycle Hook
 *
 * Domain hook for managing game lifecycle events.
 * Handles mount/unmount, pause/resume, and restart logic.
 */
'use client';

import { useEffect, useCallback, useRef } from 'react';
import {
  useCurrentGameId,
  useGameStateActions,
  useGameUIState,
  useReactPongMode,
} from '../store/selectors';
import type { GameId } from '../store/types';

// Import game state reset functions
// These will be called when restarting games
import { dropperState } from '../games/dropper';
import { reactPongState } from '../games/reactpong';
import { spinBlockState } from '../games/spinblock';
import { stackzState } from '../games/stackz';
import { sizrState } from '../games/sizr';
import { shapeShifterState } from '../games/shapeshifter';
import { skyBlitzState } from '../games/skyblitz';
import { fluxHopState } from '../games/fluxhop';
import { gyroState } from '../games/gyro';
import { prismState } from '../games/prism';
import { formaState } from '../games/forma';
import { weaveState } from '../games/weave';
import { paveState } from '../games/pave';
import { voidRunnerState } from '../games/voidrunner';
import { apexState } from '../games/apex';
import { onePathState } from '../games/onepath';
import { slowMoState } from '../games/slowmo';
import { bouncerState } from '../games/bouncer';
import { knotHopState } from '../games/knothop';
import { octaSurgeState } from '../games/octasurge';
import { prismJumpState } from '../games/prismjump';
import { oscillateState } from '../games/oscillate';
import { growthState } from '../games/growth';
// Classic ports
import { rolletteClassicState } from '../games/rolletteClassic';
import { skyBlitzClassicState } from '../games/skyblitzClassic';
import { dropperClassicState } from '../games/dropperClassic';
import { stackzCatchClassicState } from '../games/stackzCatchClassic';

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
  apex: () => apexState.reset(),
  onepath: () => onePathState.retry(),
  slowmo: () => slowMoState.backToMenu(),
  bouncer: () => {
    bouncerState.phase = 'menu';
  },
  prismjump: () => prismJumpState.backToMenu(),
  octasurge: () => {
    octaSurgeState.phase = 'menu';
  },
  knothop: () => {
    knotHopState.phase = 'menu';
  },
  oscillate: () => oscillateState.retry(),
  growth: () => growthState.reset(),
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
  const currentGame = useCurrentGameId();
  const reactPongMode = useReactPongMode();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (currentGame === 'reactpong' && reactPongMode === 'WallMode') {
          return;
        }
        setPaused(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentGame, reactPongMode, setPaused]);
}

export default useGameLifecycle;
