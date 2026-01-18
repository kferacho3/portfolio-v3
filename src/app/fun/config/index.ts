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
