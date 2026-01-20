/**
 * Arcade Shell Type Definitions
 * 
 * Core types for the arcade shell UI state and actions.
 */

/**
 * All available game identifiers
 */
export type GameId =
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
  | 'dropperClassic'
  | 'stackzCatchClassic'
  // New geometry games
  | 'gyro'
  | 'prism'
  | 'forma'
  | 'weave'
  | 'pave'
  // Endless runners
  | 'voidrunner'
  | 'gravityrush'
  | 'apex';

/**
 * Game type including home state
 */
export type GameType = GameId | 'home';

/**
 * Sky Blitz game modes
 */
export type SkyBlitzMode = 'UfoMode' | 'RunnerManMode';

/**
 * React Pong game modes
 * - SoloPaddle: Classic free-form paddle mode
 * - SoloWalls: Wall bounce mode
 * - WallMode: Curve Catch 3D - capture and release against opposing wall
 */
export type ReactPongMode = 'SoloPaddle' | 'SoloWalls' | 'WallMode';

/**
 * Shape Shifter grid sizes
 */
export type ShapeShifterMode = '3x3' | '4x4' | '5x5';

/**
 * Arcade shell state (UI-related state for the arcade)
 */
export interface ArcadeShellState {
  /** Currently active game or home screen */
  currentGame: GameType;
  /** Index of selected game in the carousel */
  selectedIndex: number;
  /** Whether background music is enabled */
  musicOn: boolean;
  /** Whether sound effects are enabled */
  soundsOn: boolean;
  /** Whether the game is paused */
  paused: boolean;
  /** Whether game rules panel is visible */
  showGameRules: boolean;
  /** Restart seed for remounting games */
  restartSeed: number;
  /** Current health (for games that use it) */
  health: number;
}

/**
 * Game mode state for games with multiple modes
 */
export interface GameModeState {
  skyBlitzMode: SkyBlitzMode;
  reactPongMode: ReactPongMode;
  shapeShifterMode: ShapeShifterMode;
}

/**
 * Arcade shell actions
 */
export interface ArcadeShellActions {
  // Navigation
  setCurrentGame: (game: GameType) => void;
  setSelectedIndex: (index: number) => void;
  goHome: () => void;
  launchGame: (gameId: GameId) => void;
  selectNextGame: () => void;
  selectPreviousGame: () => void;
  
  // Audio
  toggleMusic: () => void;
  toggleSounds: () => void;
  setMusicOn: (on: boolean) => void;
  setSoundsOn: (on: boolean) => void;
  
  // Game state
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
  toggleGameRules: () => void;
  setShowGameRules: (show: boolean) => void;
  restartGame: () => void;
  setHealth: (health: number) => void;
  
  // Mode switching
  setSkyBlitzMode: (mode: SkyBlitzMode) => void;
  setReactPongMode: (mode: ReactPongMode) => void;
  setShapeShifterMode: (mode: ShapeShifterMode) => void;
  
  // Random game
  launchRandomGame: () => void;
}

/**
 * Complete arcade store type
 */
export type ArcadeStore = ArcadeShellState & GameModeState & ArcadeShellActions;
