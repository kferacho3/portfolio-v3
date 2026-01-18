/**
 * Game State Type Definitions
 * 
 * Types for individual game states and HUD data.
 */

import type { GameId } from './arcade';

/**
 * Unlockable skin definition
 */
export interface UnlockableSkin {
  name: string;
  url: string;
  unlocked: boolean;
  achievement: string;
}

/**
 * Game mode definition
 */
export interface GameMode {
  id: string;
  name: string;
  description?: string;
}

/**
 * HUD data that games can expose to the shell
 */
export interface GameHUDData {
  score?: number;
  health?: number;
  wave?: number;
  level?: number;
  combo?: number;
  timeRemaining?: number;
  lives?: number;
  custom?: Record<string, string | number>;
}

/**
 * Game state events for shell coordination
 */
export type GameEvent =
  | { type: 'score'; value: number }
  | { type: 'health'; value: number }
  | { type: 'gameOver'; finalScore: number }
  | { type: 'levelUp'; level: number }
  | { type: 'achievement'; id: string; name: string }
  | { type: 'skinUnlocked'; skin: UnlockableSkin };

/**
 * Props passed to game components by the shell
 */
export interface GameComponentProps {
  /** Whether sounds are enabled */
  soundsOn?: boolean;
  /** Whether music is enabled */
  musicOn?: boolean;
  /** Whether game is paused */
  paused?: boolean;
  /** Callback when game wants to exit to home */
  onRequestHome?: () => void;
  /** Callback when game state changes */
  onStateChange?: (state: GameHUDData) => void;
}

/**
 * Game card data for the arcade carousel
 */
export interface GameCard {
  id: GameId | string;
  title: string;
  description: string;
  accent: string;
  poster: string;
  hotkey: string;
}

/**
 * Game rules for the info panel
 */
export interface GameRules {
  controls: string;
  objective: string;
  tips?: string;
}

/**
 * Helper type for Valtio proxy state
 */
export interface BaseGameState {
  score: number;
  reset: () => void;
}

/**
 * Extended game state with health
 */
export interface GameStateWithHealth extends BaseGameState {
  health: number;
}

/**
 * Extended game state with modes
 */
export interface GameStateWithModes<T extends string = string> extends BaseGameState {
  mode: T;
  setMode: (mode: T) => void;
}

/**
 * Extended game state with skins
 */
export interface GameStateWithSkins extends BaseGameState {
  skins: UnlockableSkin[];
  currentSkin: string;
  setSkin: (url: string) => void;
}

/**
 * Full-featured game state combining all extensions
 */
export interface FullGameState<TMode extends string = string>
  extends GameStateWithHealth,
    GameStateWithModes<TMode>,
    GameStateWithSkins {}

/**
 * Type guard to check if state has modes
 */
export function hasModes<T extends BaseGameState>(
  state: T
): state is T & GameStateWithModes {
  return 'mode' in state && 'setMode' in state;
}

/**
 * Type guard to check if state has skins
 */
export function hasSkins<T extends BaseGameState>(
  state: T
): state is T & GameStateWithSkins {
  return 'skins' in state && 'setSkin' in state;
}

/**
 * Type guard to check if state has health
 */
export function hasHealth<T extends BaseGameState>(
  state: T
): state is T & GameStateWithHealth {
  return 'health' in state;
}
