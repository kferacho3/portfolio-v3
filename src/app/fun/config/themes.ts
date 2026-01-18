/**
 * Theme Configuration
 * 
 * Shared color themes and visual styles for the arcade.
 */

/**
 * Arcade panel styles
 */
export const ARCADE_PANEL_STYLES = {
  fontFamily: '"Geist", sans-serif',
  monoFontFamily: '"Geist Mono", monospace',
  surface: 'linear-gradient(135deg, rgba(15, 17, 22, 0.94), rgba(22, 26, 36, 0.96))',
  panel: 'linear-gradient(135deg, rgba(22, 26, 36, 0.96), rgba(12, 14, 22, 0.94))',
  stroke: 'rgba(255, 255, 255, 0.14)',
  glow: 'rgba(255, 180, 102, 0.35)',
} as const;

/**
 * Get CSS variables for arcade panel styling
 */
export function getArcadePanelCSS(accent: string): React.CSSProperties {
  return {
    fontFamily: ARCADE_PANEL_STYLES.fontFamily,
    ['--arcade-accent' as string]: accent,
    ['--arcade-surface' as string]: ARCADE_PANEL_STYLES.surface,
    ['--arcade-panel' as string]: ARCADE_PANEL_STYLES.panel,
    ['--arcade-stroke' as string]: ARCADE_PANEL_STYLES.stroke,
    ['--arcade-glow' as string]: ARCADE_PANEL_STYLES.glow,
  };
}

/**
 * Animation durations
 */
export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
  panel: 700,
} as const;

/**
 * Orbit controls settings
 */
export const ORBIT_SETTINGS = {
  autoSpeed: 0.6,
  rampDuration: 1.35,
} as const;

/**
 * Common game themes
 */
export const GAME_THEMES = {
  neon: {
    name: 'Neon',
    primary: '#00ffff',
    secondary: '#ff00ff',
    background: '#0a0a15',
  },
  sunset: {
    name: 'Sunset',
    primary: '#ff6b6b',
    secondary: '#feca57',
    background: '#1a0a0a',
  },
  forest: {
    name: 'Forest',
    primary: '#00ff88',
    secondary: '#48dbfb',
    background: '#0a1510',
  },
  galaxy: {
    name: 'Galaxy',
    primary: '#6c5ce7',
    secondary: '#fd79a8',
    background: '#0a0515',
  },
  gold: {
    name: 'Gold',
    primary: '#f39c12',
    secondary: '#e74c3c',
    background: '#151005',
  },
  synthwave: {
    name: 'Synthwave',
    primary: '#ff2190',
    secondary: '#00ffff',
    background: '#0f0520',
  },
} as const;

export type ThemeKey = keyof typeof GAME_THEMES;

/**
 * Scene background colors
 */
export const SCENE_BACKGROUNDS = {
  dark: 0x000000,
  light: 0x1a1a1a,
} as const;
