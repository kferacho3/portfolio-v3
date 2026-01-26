/**
 * Hooks Barrel Export
 *
 * Re-exports all domain hooks.
 */

// Arcade shell hooks
export {
  useArcadeShell,
  useArcadeKeyboard,
  useAutoCycleGames,
} from './useArcadeShell';

// Audio hooks
export {
  useGameAudio,
  useSoundEffect,
  useAudioPreloader,
} from './useGameAudio';

// Game lifecycle hooks
export {
  useGameLifecycle,
  useGameStateSync,
  useVisibilityPause,
} from './useGameLifecycle';

// Input hooks (existing)
export {
  useInput,
  useInputRef,
  useKeyPress,
  useDirectionalInput,
  clearFrameInput,
} from './useInput';
export type { InputState, UseInputOptions } from './useInput';
