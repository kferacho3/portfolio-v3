/**
 * useArcadeShell Hook
 * 
 * Domain hook for arcade shell UI state and actions.
 * Combines store state with navigation and UI control logic.
 */
'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useGameState,
  useGameUIState,
  useAudioState,
  useGameModeState,
  useNavigationActions,
  useGameStateActions,
  useAudioActions,
  useGameModeActions,
  useRandomGameAction,
} from '../store/selectors';
import { GAME_CARDS, getGameCard, KEY_TO_GAME } from '../config/games';
import type { GameId, GameType } from '../store/types';

/**
 * Main arcade shell hook
 * Provides all state and actions needed for the arcade shell UI
 */
export function useArcadeShell() {
  const router = useRouter();
  
  // State
  const { currentGame, selectedIndex } = useGameState();
  const { paused, showGameRules, restartSeed, health } = useGameUIState();
  const { musicOn, soundsOn } = useAudioState();
  const { skyBlitzMode, reactPongMode, shapeShifterMode } = useGameModeState();
  
  // Actions
  const {
    setCurrentGame,
    setSelectedIndex,
    goHome: storeGoHome,
    launchGame: storeLaunchGame,
    selectNextGame,
    selectPreviousGame,
  } = useNavigationActions();
  
  const {
    togglePause,
    setPaused,
    toggleGameRules,
    setShowGameRules,
    restartGame,
    setHealth,
  } = useGameStateActions();
  
  const { toggleMusic, toggleSounds } = useAudioActions();
  const { setSkyBlitzMode, setReactPongMode, setShapeShifterMode } = useGameModeActions();
  const { launchRandomGame } = useRandomGameAction();

  // Derived state
  const isHome = currentGame === 'home';
  const isGameActive = !isHome;
  const selectedGame = GAME_CARDS[selectedIndex] ?? GAME_CARDS[0];
  const activeGameCard = isGameActive ? getGameCard(currentGame) : selectedGame;

  // Navigation with router integration
  const goHome = useCallback(() => {
    storeGoHome();
    router.push('/fun');
  }, [storeGoHome, router]);

  const launchGame = useCallback((gameId: GameId) => {
    storeLaunchGame(gameId);
    router.push(`/fun/${gameId}`);
  }, [storeLaunchGame, router]);

  const launchSelectedGame = useCallback(() => {
    if (selectedGame) {
      launchGame(selectedGame.id as GameId);
    }
  }, [selectedGame, launchGame]);

  // Mode switching
  const handleModeSwitch = useCallback((mode: string) => {
    if (currentGame === 'skyblitz') {
      setSkyBlitzMode(mode as 'UfoMode' | 'RunnerManMode');
    } else if (currentGame === 'reactpong') {
      setReactPongMode(mode as 'SoloPaddle' | 'SoloWalls');
    } else if (currentGame === 'shapeshifter') {
      setShapeShifterMode(mode as '3x3' | '4x4' | '5x5');
    }
  }, [currentGame, setSkyBlitzMode, setReactPongMode, setShapeShifterMode]);

  // Get current mode for the active game
  const getCurrentMode = useCallback(() => {
    switch (currentGame) {
      case 'skyblitz':
        return skyBlitzMode;
      case 'reactpong':
        return reactPongMode;
      case 'shapeshifter':
        return shapeShifterMode;
      default:
        return undefined;
    }
  }, [currentGame, skyBlitzMode, reactPongMode, shapeShifterMode]);

  return {
    // State
    currentGame,
    selectedIndex,
    isHome,
    isGameActive,
    selectedGame,
    activeGameCard,
    paused,
    showGameRules,
    restartSeed,
    health,
    musicOn,
    soundsOn,
    skyBlitzMode,
    reactPongMode,
    shapeShifterMode,
    
    // Navigation actions
    goHome,
    launchGame,
    launchSelectedGame,
    setSelectedIndex,
    selectNextGame,
    selectPreviousGame,
    launchRandomGame,
    
    // Game state actions
    togglePause,
    setPaused,
    toggleGameRules,
    setShowGameRules,
    restartGame,
    setHealth,
    
    // Audio actions
    toggleMusic,
    toggleSounds,
    
    // Mode switching
    handleModeSwitch,
    getCurrentMode,
  };
}

/**
 * Hook for keyboard controls
 * Handles global keyboard shortcuts for the arcade
 */
export function useArcadeKeyboard() {
  const {
    currentGame,
    isHome,
    goHome,
    launchGame,
    restartGame,
    toggleGameRules,
    togglePause,
    launchRandomGame,
  } = useArcadeShell();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Global controls that work from any game (not home)
      if (!isHome) {
        // R = Restart current game
        if (key === 'r') {
          e.preventDefault();
          restartGame();
        }
        // H = Go home
        if (key === 'h') {
          e.preventDefault();
          goHome();
        }
        // I = Toggle game info/rules
        if (key === 'i') {
          e.preventDefault();
          toggleGameRules();
        }
        // G = Random game (override game shortcut when in game)
        if (key === 'g') {
          e.preventDefault();
          launchRandomGame();
        }
        // P = Pause/resume
        if (key === 'p') {
          e.preventDefault();
          togglePause();
        }
        // Esc = Pause/resume
        if (key === 'escape') {
          e.preventDefault();
          togglePause();
        }
      } else {
        // Home screen - game shortcuts
        const gameType = KEY_TO_GAME[key];
        if (gameType && gameType !== 'home') {
          e.preventDefault();
          launchGame(gameType as GameId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHome, goHome, restartGame, toggleGameRules, togglePause, launchRandomGame, launchGame]);
}

/**
 * Hook for auto-cycling games on the arcade home screen
 */
export function useAutoCycleGames(intervalMs: number = 5500) {
  const { isHome, selectNextGame } = useArcadeShell();

  useEffect(() => {
    if (!isHome || GAME_CARDS.length === 0) return;

    const interval = setInterval(() => {
      selectNextGame();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isHome, selectNextGame, intervalMs]);
}

export default useArcadeShell;
