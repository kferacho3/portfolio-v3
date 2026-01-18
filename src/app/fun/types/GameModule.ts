/**
 * Game Module Type Definitions
 * 
 * Standard interfaces for all games in the arcade.
 * Every game should conform to these contracts for consistent shell integration.
 */

/**
 * All available game identifiers
 */
export type GameId =
  | 'home'
  | 'geochrome'
  | 'shapeshifter'
  | 'skyblitz'
  | 'dropper'
  | 'stackz'
  | 'sizr'
  | 'pinball'
  | 'rollette'
  | 'flappybird'
  | 'fluxhop'
  | 'reactpong'
  | 'spinblock'
  | 'museum'
  // Classic legacy ports
  | 'rolletteClassic'
  | 'skyblitzClassic'
  | 'dropperCatchClassic'
  | 'stackzCatchClassic'
  // New geometry games
  | 'gyro'
  | 'prism'
  | 'forma'
  | 'weave'
  | 'pave';

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
 * Main GameModule interface
 * 
 * Games should export an object conforming to this interface
 * to enable full integration with the arcade shell.
 */
export interface GameModule {
  /** Unique game identifier */
  id: GameId;
  
  /** Display title */
  title: string;
  
  /** Short description for the arcade UI */
  description?: string;
  
  /** Accent color for UI theming */
  accent?: string;
  
  /** Poster image URL */
  poster?: string;
  
  /** Keyboard shortcut to launch */
  hotkey?: string;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle Methods
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Reset game to initial state
   * Called when user presses R or selects restart
   */
  reset: () => void;
  
  /**
   * Pause/resume the game
   * @param paused - Whether game should be paused
   */
  setPaused?: (paused: boolean) => void;
  
  /**
   * Called when game is mounted/launched
   */
  onMount?: () => void;
  
  /**
   * Called when game is unmounted/exited
   */
  onUnmount?: () => void;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // State Access
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get current HUD data for shell display
   */
  getHUD?: () => GameHUDData;
  
  /**
   * Get current game state for snapshots
   */
  getState?: () => Record<string, unknown>;
  
  /**
   * Subscribe to game events
   * @returns Unsubscribe function
   */
  subscribe?: (callback: (event: GameEvent) => void) => () => void;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Mode & Skin Management
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get available game modes
   */
  getModes?: () => GameMode[];
  
  /**
   * Get current mode ID
   */
  getCurrentMode?: () => string;
  
  /**
   * Set the current game mode
   */
  setMode?: (modeId: string) => void;
  
  /**
   * Get available skins
   */
  getSkins?: () => UnlockableSkin[];
  
  /**
   * Get current skin URL
   */
  getCurrentSkin?: () => string;
  
  /**
   * Set the current skin
   */
  setSkin?: (url: string) => void;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Audio
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get the background music track URL for this game
   */
  getMusicTrack?: () => string;
  
  /**
   * Set whether sounds are enabled
   */
  setSoundsEnabled?: (enabled: boolean) => void;
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
 * Game registry entry with component reference
 */
export interface GameRegistryEntry {
  module: GameModule;
  component: React.ComponentType<GameComponentProps>;
}

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
 * Type guard to check if a game has modes
 */
export function hasModes(module: GameModule): module is GameModule & Required<Pick<GameModule, 'getModes' | 'setMode'>> {
  return typeof module.getModes === 'function' && typeof module.setMode === 'function';
}

/**
 * Type guard to check if a game has skins
 */
export function hasSkins(module: GameModule): module is GameModule & Required<Pick<GameModule, 'getSkins' | 'setSkin'>> {
  return typeof module.getSkins === 'function' && typeof module.setSkin === 'function';
}

/**
 * Type guard to check if a game has HUD
 */
export function hasHUD(module: GameModule): module is GameModule & Required<Pick<GameModule, 'getHUD'>> {
  return typeof module.getHUD === 'function';
}
