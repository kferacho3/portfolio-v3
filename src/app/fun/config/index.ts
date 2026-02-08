/**
 * Config Barrel Export
 *
 * Re-exports all configuration modules.
 */

// Games configuration
export {
  GAME_CARDS,
  GAME_RULES,
  KEY_TO_GAME,
  HUD_GAMES,
  TOTAL_GAMES,
  getGameCard,
  getGameRules,
  shouldShowHUD,
  getGameIndex,
} from './games';

// Audio configuration
export {
  MUSIC_TRACKS,
  DEFAULT_MUSIC_TRACK,
  AUDIO_SETTINGS,
  COMMON_SOUNDS,
  getMusicTrack,
} from './audio';

// Theme configuration
export {
  ARCADE_PANEL_STYLES,
  ANIMATION_DURATIONS,
  ORBIT_SETTINGS,
  GAME_THEMES,
  SCENE_BACKGROUNDS,
  getArcadePanelCSS,
} from './themes';
export type { ThemeKey } from './themes';

// Ketchapp universe configuration
export {
  KETCHAPP_GAME_IDS,
  KETCHAPP_GAME_SPECS,
  SHARED_CHUNK_TEMPLATE,
  KETCHAPP_DIFFICULTY_RAMPS,
  KETCHAPP_UNIVERSE_ART_DIRECTION,
  KETCHAPP_IMPLEMENTATION_PHASES,
  KETCHAPP_ACCEPTANCE_CHECKLIST,
  isKetchappGame,
  getKetchappGameSpec,
  sampleDifficulty,
  buildPatternLibraryTemplate,
} from './ketchapp';
export type {
  KetchappGameId,
  KetchappInputType,
  KetchappChunkProfile,
  KetchappFailCondition,
  KetchappGameSpec,
  ChunkTier,
  ChunkRewardMode,
  ChunkTemplate,
  GameChunkPatternTemplate,
  DifficultyRamp,
  DifficultySample,
} from './ketchapp';
