/**
 * Arcade Store Selectors
 * 
 * Optimized selector hooks using useShallow to prevent unnecessary re-renders.
 * Components should use these selectors instead of accessing the store directly.
 */
'use client';

import { useShallow } from 'zustand/react/shallow';
import { useArcadeStore } from './index';
import type {
  GameType,
  GameId,
  SkyBlitzMode,
  ReactPongMode,
  ShapeShifterMode,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// State Selectors (Read-Only)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Current game state
 * @returns { currentGame, selectedIndex }
 */
export const useGameState = () =>
  useArcadeStore(
    useShallow((s) => ({
      currentGame: s.currentGame,
      selectedIndex: s.selectedIndex,
    }))
  );

/**
 * Audio settings state
 * @returns { musicOn, soundsOn }
 */
export const useAudioState = () =>
  useArcadeStore(
    useShallow((s) => ({
      musicOn: s.musicOn,
      soundsOn: s.soundsOn,
    }))
  );

/**
 * Game UI state
 * @returns { paused, showGameRules, restartSeed, health }
 */
export const useGameUIState = () =>
  useArcadeStore(
    useShallow((s) => ({
      paused: s.paused,
      showGameRules: s.showGameRules,
      restartSeed: s.restartSeed,
      health: s.health,
    }))
  );

/**
 * Game mode states for games with multiple modes
 * @returns { skyBlitzMode, reactPongMode, shapeShifterMode }
 */
export const useGameModeState = () =>
  useArcadeStore(
    useShallow((s) => ({
      skyBlitzMode: s.skyBlitzMode,
      reactPongMode: s.reactPongMode,
      shapeShifterMode: s.shapeShifterMode,
    }))
  );

/**
 * Full arcade shell state (for components that need everything)
 * Use sparingly - prefer specific selectors
 */
export const useFullArcadeState = () =>
  useArcadeStore(
    useShallow((s) => ({
      currentGame: s.currentGame,
      selectedIndex: s.selectedIndex,
      musicOn: s.musicOn,
      soundsOn: s.soundsOn,
      paused: s.paused,
      showGameRules: s.showGameRules,
      restartSeed: s.restartSeed,
      health: s.health,
      skyBlitzMode: s.skyBlitzMode,
      reactPongMode: s.reactPongMode,
      shapeShifterMode: s.shapeShifterMode,
    }))
  );

// ═══════════════════════════════════════════════════════════════════════════════
// Action Selectors (Write)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Navigation actions
 * @returns { setCurrentGame, setSelectedIndex, goHome, launchGame, selectNextGame, selectPreviousGame }
 */
export const useNavigationActions = () =>
  useArcadeStore(
    useShallow((s) => ({
      setCurrentGame: s.setCurrentGame,
      setSelectedIndex: s.setSelectedIndex,
      goHome: s.goHome,
      launchGame: s.launchGame,
      selectNextGame: s.selectNextGame,
      selectPreviousGame: s.selectPreviousGame,
    }))
  );

/**
 * Audio control actions
 * @returns { toggleMusic, toggleSounds, setMusicOn, setSoundsOn }
 */
export const useAudioActions = () =>
  useArcadeStore(
    useShallow((s) => ({
      toggleMusic: s.toggleMusic,
      toggleSounds: s.toggleSounds,
      setMusicOn: s.setMusicOn,
      setSoundsOn: s.setSoundsOn,
    }))
  );

/**
 * Game state actions
 * @returns { togglePause, setPaused, toggleGameRules, setShowGameRules, restartGame, setHealth }
 */
export const useGameStateActions = () =>
  useArcadeStore(
    useShallow((s) => ({
      togglePause: s.togglePause,
      setPaused: s.setPaused,
      toggleGameRules: s.toggleGameRules,
      setShowGameRules: s.setShowGameRules,
      restartGame: s.restartGame,
      setHealth: s.setHealth,
    }))
  );

/**
 * Game mode switching actions
 * @returns { setSkyBlitzMode, setReactPongMode, setShapeShifterMode }
 */
export const useGameModeActions = () =>
  useArcadeStore(
    useShallow((s) => ({
      setSkyBlitzMode: s.setSkyBlitzMode,
      setReactPongMode: s.setReactPongMode,
      setShapeShifterMode: s.setShapeShifterMode,
    }))
  );

/**
 * Random game action
 * @returns { launchRandomGame }
 */
export const useRandomGameAction = () =>
  useArcadeStore(
    useShallow((s) => ({
      launchRandomGame: s.launchRandomGame,
    }))
  );

// ═══════════════════════════════════════════════════════════════════════════════
// Computed Selectors (Derived State)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if currently on home screen
 */
export const useIsHome = () =>
  useArcadeStore((s) => s.currentGame === 'home');

/**
 * Check if a game is currently active
 */
export const useIsGameActive = () =>
  useArcadeStore((s) => s.currentGame !== 'home');

/**
 * Check if game is paused
 */
export const useIsPaused = () =>
  useArcadeStore((s) => s.paused);

/**
 * Get current game ID (null if on home)
 */
export const useCurrentGameId = (): GameId | null =>
  useArcadeStore((s) => (s.currentGame === 'home' ? null : s.currentGame));

/**
 * Check if music is enabled
 */
export const useIsMusicOn = () =>
  useArcadeStore((s) => s.musicOn);

/**
 * Check if sounds are enabled
 */
export const useIsSoundsOn = () =>
  useArcadeStore((s) => s.soundsOn);

// ═══════════════════════════════════════════════════════════════════════════════
// Specific Game Mode Selectors
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sky Blitz mode selector
 */
export const useSkyBlitzMode = (): SkyBlitzMode =>
  useArcadeStore((s) => s.skyBlitzMode);

/**
 * React Pong mode selector
 */
export const useReactPongMode = (): ReactPongMode =>
  useArcadeStore((s) => s.reactPongMode);

/**
 * Shape Shifter mode selector
 */
export const useShapeShifterMode = (): ShapeShifterMode =>
  useArcadeStore((s) => s.shapeShifterMode);

// ═══════════════════════════════════════════════════════════════════════════════
// Combined State + Actions Selectors
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * All audio state and actions combined
 * Use when component needs both read and write
 */
export const useAudio = () =>
  useArcadeStore(
    useShallow((s) => ({
      musicOn: s.musicOn,
      soundsOn: s.soundsOn,
      toggleMusic: s.toggleMusic,
      toggleSounds: s.toggleSounds,
    }))
  );

/**
 * Game control state and actions for the shell UI
 */
export const useGameControl = () =>
  useArcadeStore(
    useShallow((s) => ({
      paused: s.paused,
      showGameRules: s.showGameRules,
      togglePause: s.togglePause,
      toggleGameRules: s.toggleGameRules,
      restartGame: s.restartGame,
      goHome: s.goHome,
    }))
  );
