/**
 * Types Barrel Export
 *
 * Re-exports all type definitions.
 */

// Game module types (existing)
export * from './GameModule';

// Re-export store types for convenience
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
} from '../store/types';
