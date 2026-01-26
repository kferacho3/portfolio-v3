/**
 * Store Types Barrel Export
 *
 * All type definitions for the arcade store.
 */

// Arcade shell types
export type {
  GameId,
  GameType,
  SkyBlitzMode,
  ReactPongMode,
  ShapeShifterMode,
  ArcadeShellState,
  GameModeState,
  ArcadeShellActions,
  ArcadeStore,
} from './arcade';

// Game state types
export type {
  UnlockableSkin,
  GameMode,
  GameHUDData,
  GameEvent,
  GameComponentProps,
  GameCard,
  GameRules,
  BaseGameState,
  GameStateWithHealth,
  GameStateWithModes,
  GameStateWithSkins,
  FullGameState,
} from './game';

// Type guards
export { hasModes, hasSkins, hasHealth } from './game';
