import { proxy } from 'valtio';

export type GoUpPhase = 'menu' | 'playing' | 'gameover';
export type CrashType = 'none' | 'fell' | 'riser' | 'spike' | 'hit';
export type PathStyle = 'tiles' | 'tube' | 'ribbon' | 'hybrid';
export type PathSkin = 'sleek' | 'neon' | 'velvet';
export type TrackMode = 'auto' | 'classic' | 'curved' | 'spiral' | 'mix';
export type QualityMode = 'auto' | 'high' | 'low';

const BEST_KEY = 'rachos-fun-goup-best';
const ARENA_KEY = 'rachos-fun-goup-arena';
const ARENA_MODE_KEY = 'rachos-fun-goup-arena-mode';
const PATH_STYLE_KEY = 'rachos-fun-goup-path-style';
const PATH_SKIN_KEY = 'rachos-fun-goup-path-skin';
const TRACK_MODE_KEY = 'rachos-fun-goup-track-mode';
const QUALITY_KEY = 'rachos-fun-goup-quality';

const isPathStyle = (value: string | null): value is PathStyle =>
  value === 'tiles' ||
  value === 'tube' ||
  value === 'ribbon' ||
  value === 'hybrid';

const isPathSkin = (value: string | null): value is PathSkin =>
  value === 'sleek' || value === 'neon' || value === 'velvet';

const isTrackMode = (value: string | null): value is TrackMode =>
  value === 'auto' ||
  value === 'classic' ||
  value === 'curved' ||
  value === 'spiral' ||
  value === 'mix';

const isQualityMode = (value: string | null): value is QualityMode =>
  value === 'auto' || value === 'high' || value === 'low';

export const goUpState = proxy({
  phase: 'menu' as GoUpPhase,
  score: 0,
  best: 0,
  gems: 0,
  gapsJumped: 0,
  wallsClimbed: 0,
  spikesAvoided: 0,
  combo: 0,
  multiplier: 1,
  nearMisses: 0,
  arenaIndex: 0,
  arenaMode: 'auto' as 'auto' | 'fixed',
  pathStyle: 'tiles' as PathStyle,
  pathSkin: 'sleek' as PathSkin,
  trackMode: 'auto' as TrackMode,
  quality: 'auto' as QualityMode,

  crashType: 'none' as CrashType,
  crashX: 0,
  crashY: 0,
  crashZ: 0,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(BEST_KEY);
    const parsed = raw ? Number(raw) : 0;
    if (!Number.isNaN(parsed)) goUpState.best = parsed;
  },

  loadArena: () => {
    if (typeof window === 'undefined') return;
    const storedArena = window.localStorage.getItem(ARENA_KEY);
    const storedMode = window.localStorage.getItem(ARENA_MODE_KEY);
    const parsedArena = storedArena ? Number(storedArena) : 0;
    if (!Number.isNaN(parsedArena)) goUpState.arenaIndex = parsedArena;
    if (storedMode === 'auto' || storedMode === 'fixed') {
      goUpState.arenaMode = storedMode;
    }
  },

  loadSettings: () => {
    if (typeof window === 'undefined') return;
    const pathStyle = window.localStorage.getItem(PATH_STYLE_KEY);
    const pathSkin = window.localStorage.getItem(PATH_SKIN_KEY);
    const trackMode = window.localStorage.getItem(TRACK_MODE_KEY);
    const quality = window.localStorage.getItem(QUALITY_KEY);
    if (isPathStyle(pathStyle) && pathStyle === 'tiles') {
      goUpState.pathStyle = pathStyle;
    } else {
      goUpState.pathStyle = 'tiles';
    }
    if (isPathSkin(pathSkin)) goUpState.pathSkin = pathSkin;
    if (isTrackMode(trackMode)) goUpState.trackMode = trackMode;
    if (isQualityMode(quality)) goUpState.quality = quality;
  },

  setArena: (index: number) => {
    goUpState.arenaIndex = index;
    goUpState.arenaMode = 'fixed';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ARENA_KEY, String(index));
      window.localStorage.setItem(ARENA_MODE_KEY, goUpState.arenaMode);
    }
  },

  setArenaMode: (mode: 'auto' | 'fixed') => {
    goUpState.arenaMode = mode;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ARENA_MODE_KEY, mode);
    }
  },

  setPathStyle: (style: PathStyle) => {
    goUpState.pathStyle = style === 'tiles' ? style : 'tiles';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PATH_STYLE_KEY, goUpState.pathStyle);
    }
  },

  setPathSkin: (skin: PathSkin) => {
    goUpState.pathSkin = skin;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PATH_SKIN_KEY, skin);
    }
  },

  setTrackMode: (mode: TrackMode) => {
    goUpState.trackMode = mode;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TRACK_MODE_KEY, mode);
    }
  },

  setQuality: (quality: QualityMode) => {
    goUpState.quality = quality;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(QUALITY_KEY, quality);
    }
  },

  startGame: () => {
    goUpState.phase = 'playing';
    goUpState.score = 0;
    goUpState.gems = 0;
    goUpState.gapsJumped = 0;
    goUpState.wallsClimbed = 0;
    goUpState.spikesAvoided = 0;
    goUpState.combo = 0;
    goUpState.multiplier = 1;
    goUpState.nearMisses = 0;
    goUpState.crashType = 'none';
    goUpState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  endGame: (crashType: CrashType = 'none', x = 0, y = 0, z = 0) => {
    if (goUpState.phase === 'gameover') return;
    goUpState.phase = 'gameover';
    goUpState.crashType = crashType;
    goUpState.crashX = x;
    goUpState.crashY = y;
    goUpState.crashZ = z;
    if (goUpState.score > goUpState.best) {
      goUpState.best = goUpState.score;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(BEST_KEY, String(goUpState.best));
      }
    }
  },

  addGapBonus: () => {
    goUpState.gapsJumped += 1;
  },

  addWallBonus: () => {
    goUpState.wallsClimbed += 1;
  },

  addSpikeAvoidBonus: () => {
    goUpState.spikesAvoided += 1;
  },

  reset: () => {
    goUpState.phase = 'menu';
    goUpState.score = 0;
    goUpState.gems = 0;
    goUpState.gapsJumped = 0;
    goUpState.wallsClimbed = 0;
    goUpState.spikesAvoided = 0;
    goUpState.combo = 0;
    goUpState.multiplier = 1;
    goUpState.nearMisses = 0;
    goUpState.crashType = 'none';
    goUpState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },
});
