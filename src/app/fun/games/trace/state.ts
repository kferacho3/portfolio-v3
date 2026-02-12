import { proxy } from 'valtio';

export type TracePhase = 'menu' | 'playing' | 'gameover';
export type TraceMedal = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond';
export type TraceHeadStyle = 'orb' | 'cube' | 'diamond' | 'dart' | 'capsule';

export const TRACE_HEAD_STYLES: TraceHeadStyle[] = [
  'orb',
  'cube',
  'diamond',
  'dart',
  'capsule',
];

export type TracePalette = {
  id: string;
  name: string;
  bg: string;
  fog: string;
  grid: string;
  unfilled: string;
  trailA: string;
  trailB: string;
  head: string;
  accent: string;
  collectibleA: string;
  collectibleB: string;
};

export const TRACE_PALETTES: TracePalette[] = [
  {
    id: 'reef',
    name: 'Reef',
    bg: '#0f1722',
    fog: '#0f1722',
    grid: '#315d6f',
    unfilled: '#142435',
    trailA: '#5ce8ff',
    trailB: '#6bffbe',
    head: '#f7ffff',
    accent: '#7fffe0',
    collectibleA: '#ffd46f',
    collectibleB: '#ffa57d',
  },
  {
    id: 'sundust',
    name: 'Sundust',
    bg: '#1f1a14',
    fog: '#1f1a14',
    grid: '#705642',
    unfilled: '#2b2118',
    trailA: '#ffd46f',
    trailB: '#ff8fa8',
    head: '#fff6ea',
    accent: '#ffd4a3',
    collectibleA: '#85f6ff',
    collectibleB: '#fff09a',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    bg: '#131225',
    fog: '#131225',
    grid: '#3d3a76',
    unfilled: '#1b1a35',
    trailA: '#9a8bff',
    trailB: '#ff76dd',
    head: '#fdf5ff',
    accent: '#c4b2ff',
    collectibleA: '#6cf1ff',
    collectibleB: '#ffcc88',
  },
  {
    id: 'mintglass',
    name: 'Mint Glass',
    bg: '#0e1817',
    fog: '#0e1817',
    grid: '#2e6a62',
    unfilled: '#162a28',
    trailA: '#6cffd9',
    trailB: '#8fc7ff',
    head: '#f6fffb',
    accent: '#8cf8ea',
    collectibleA: '#ffe982',
    collectibleB: '#ffa679',
  },
  {
    id: 'rubysea',
    name: 'Ruby Sea',
    bg: '#1a1016',
    fog: '#1a1016',
    grid: '#70415e',
    unfilled: '#281725',
    trailA: '#ff8aa8',
    trailB: '#7bd4ff',
    head: '#fff1f6',
    accent: '#ffb5cb',
    collectibleA: '#ffde76',
    collectibleB: '#93f5ff',
  },
];

const BEST_KEY = 'trace_fill_best_v2';
const PREFS_KEY = 'trace_fill_prefs_v2';

type TracePrefs = {
  paletteIndex: number;
  autoPalette: boolean;
  headStyle: TraceHeadStyle;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const readBest = () => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(BEST_KEY);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const writeBest = (score: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_KEY, String(Math.max(0, Math.floor(score))));
};

const readPrefs = (): TracePrefs | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PREFS_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<TracePrefs>;
    const style =
      parsed.headStyle && TRACE_HEAD_STYLES.includes(parsed.headStyle)
        ? parsed.headStyle
        : 'orb';

    const paletteIndex = clamp(
      Number(parsed.paletteIndex ?? 0),
      0,
      TRACE_PALETTES.length - 1
    );

    return {
      paletteIndex,
      autoPalette: Boolean(parsed.autoPalette ?? true),
      headStyle: style,
    };
  } catch {
    return null;
  }
};

const writePrefs = (prefs: TracePrefs) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
};

const nextStyle = (style: TraceHeadStyle): TraceHeadStyle => {
  const i = TRACE_HEAD_STYLES.indexOf(style);
  return TRACE_HEAD_STYLES[(i + 1) % TRACE_HEAD_STYLES.length];
};

export const traceState = proxy({
  phase: 'menu' as TracePhase,
  score: 0,
  bestScore: 0,
  gameOver: false,
  resetVersion: 0,

  level: 1,
  gridSize: 5,
  completion: 0,
  currentMedal: 'none' as TraceMedal,

  bronze: 0,
  silver: 0,
  gold: 0,
  diamond: 0,

  collectibles: 0,

  paletteIndex: 0,
  autoPalette: false,
  headStyle: 'orb' as TraceHeadStyle,

  toastText: '',
  toastTime: 0,

  elapsed: 0,

  load() {
    this.bestScore = readBest();
    const prefs = readPrefs();
    if (!prefs) return;
    this.paletteIndex = prefs.paletteIndex;
    this.autoPalette = prefs.autoPalette;
    this.headStyle = prefs.headStyle;
  },

  savePrefs() {
    writePrefs({
      paletteIndex: this.paletteIndex,
      autoPalette: this.autoPalette,
      headStyle: this.headStyle,
    });
  },

  reset() {
    this.resetVersion += 1;
    this.phase = 'menu';
    this.score = 0;
    this.gameOver = false;
    this.level = 1;
    this.gridSize = 5;
    this.completion = 0;
    this.currentMedal = 'none';
    this.bronze = 0;
    this.silver = 0;
    this.gold = 0;
    this.diamond = 0;
    this.collectibles = 0;
    this.toastText = '';
    this.toastTime = 0;
    this.elapsed = 0;
  },

  startRun() {
    this.phase = 'playing';
    this.score = 0;
    this.gameOver = false;
    this.level = 1;
    this.gridSize = 5;
    this.completion = 0;
    this.currentMedal = 'none';
    this.bronze = 0;
    this.silver = 0;
    this.gold = 0;
    this.diamond = 0;
    this.collectibles = 0;
    this.toastText = '';
    this.toastTime = 0;
    this.elapsed = 0;

    if (this.autoPalette) {
      this.paletteIndex = Math.floor(Math.random() * TRACE_PALETTES.length);
    }
  },

  tick(dt: number) {
    if (this.phase !== 'playing') return;
    this.elapsed += dt;
    this.toastTime = Math.max(0, this.toastTime - dt);
  },

  setToast(text: string, duration = 1.2) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, duration);
  },

  nextPalette() {
    this.autoPalette = false;
    this.paletteIndex = (this.paletteIndex + 1) % TRACE_PALETTES.length;
    this.savePrefs();
  },

  toggleAutoPalette() {
    this.autoPalette = !this.autoPalette;
    this.savePrefs();
  },

  nextHeadStyle() {
    this.headStyle = nextStyle(this.headStyle);
    this.savePrefs();
  },

  endRun(finalScore: number) {
    const nextScore = Math.max(0, Math.floor(finalScore));
    this.phase = 'gameover';
    this.gameOver = true;
    this.score = nextScore;

    const nextBest = Math.max(this.bestScore, nextScore);
    if (nextBest !== this.bestScore) {
      this.bestScore = nextBest;
      writeBest(nextBest);
    }
  },
});
