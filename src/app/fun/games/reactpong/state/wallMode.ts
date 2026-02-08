import clamp from 'lodash-es/clamp';
import type { ReactPongState } from '../state';
import type { WallModeState } from '../types';

const BASE_SPEED = 8.9;
const MAX_SPEED = 28.5;
const SPEED_GROWTH_PER_S = 1.0046;

const SPIN_MAX = 1.9;
const SPIN_STRENGTH = 7.6;
const SPIN_SENS_GROWTH_PER_S = 0.0045;

const spinMag = (spin: { x: number; y: number }) => Math.hypot(spin.x, spin.y);

function addSpin(
  wm: WallModeState,
  add: { x: number; y: number },
  scale: number
) {
  wm.spin.x += add.x * scale;
  wm.spin.y += add.y * scale;
  const m = spinMag(wm.spin);
  if (m > SPIN_MAX) {
    const s = SPIN_MAX / Math.max(1e-6, m);
    wm.spin.x *= s;
    wm.spin.y *= s;
  }
}

export const createWallModeState = (): WallModeState => ({
  gameState: 'playing',
  started: false,
  elapsed: 0,

  baseSpeed: BASE_SPEED,
  currentSpeed: BASE_SPEED,
  maxSpeed: MAX_SPEED,
  speedGrowth: SPEED_GROWTH_PER_S,

  spin: { x: 0, y: 0 },
  spinStrength: SPIN_STRENGTH,
  spinSensitivity: 1,
  spinSensitivityGrowth: SPIN_SENS_GROWTH_PER_S,

  wallChaos: 0,

  paddleHits: 0,
});

export const resetWallMode = (state: ReactPongState) => {
  Object.assign(state.wallMode, createWallModeState());

  state.score = 0;
  state.hitStreak = 0;
  state.totalHits = 0;
  state.count = 0;

  state.scorePopups = [];
  state.hitEffects = [];
  state.screenShake = 0;
  state.comboText = '';
  state.comboColor = '#ffffff';
};

export const wallModeTick = (state: ReactPongState, dt: number) => {
  const wm = state.wallMode;
  if (wm.gameState !== 'playing') return;
  if (!Number.isFinite(dt) || dt <= 0) return;

  wm.elapsed += dt;

  const t = wm.elapsed;
  wm.currentSpeed = Math.min(
    wm.maxSpeed,
    wm.baseSpeed * Math.pow(wm.speedGrowth, t)
  );
  wm.spinSensitivity = 1 + t * wm.spinSensitivityGrowth;
  wm.wallChaos = clamp((t - 58) / 320, 0, 1);

  const speedMult = wm.currentSpeed / wm.baseSpeed;
  const spinN = clamp(spinMag(wm.spin) / SPIN_MAX, 0, 1);
  const perSecond =
    (6 + 8.5 * speedMult + 5 * spinN) * (0.55 + speedMult * 0.65);

  state.score += perSecond * dt;
  if (state.score > state.highScore) state.highScore = Math.floor(state.score);
};

export const wallModePaddleHit = (
  state: ReactPongState,
  opts: {
    position: [number, number, number];
    spinAdd: { x: number; y: number };
    spinScale?: number;
    intensity?: number;
  }
) => {
  const wm = state.wallMode;
  if (wm.gameState !== 'playing') return;

  wm.paddleHits += 1;
  state.hitStreak += 1;
  state.totalHits += 1;

  addSpin(wm, opts.spinAdd, opts.spinScale ?? wm.spinSensitivity);

  const speedMult = wm.currentSpeed / wm.baseSpeed;
  const spinN = clamp(spinMag(wm.spin) / SPIN_MAX, 0, 1);
  const points = Math.round(10 + 14 * speedMult + 18 * spinN);

  state.score += points;
  if (state.score > state.highScore) state.highScore = Math.floor(state.score);

  state.addScorePopup(points, opts.position, '#00ffaa');
  state.addHitEffect(opts.position, '#00ffaa', opts.intensity ?? 1.1);
  state.triggerScreenShake(0.035 + spinN * 0.06);

  const sound = state.audio.paddleHitSound;
  if (sound) {
    try {
      sound.currentTime = 0;
      sound.volume = clamp(0.35 + spinN * 0.35, 0.2, 0.85);
      void sound.play().catch(() => undefined);
    } catch {
      // ignore
    }
  }
};

export const wallModeWallHit = (
  state: ReactPongState,
  opts: { position: [number, number, number]; intensity?: number }
) => {
  const wm = state.wallMode;
  if (wm.gameState !== 'playing') return;

  state.addHitEffect(opts.position, '#4080ff', opts.intensity ?? 0.8);

  const sound = state.audio.wallHitSound;
  if (sound) {
    try {
      sound.currentTime = 0;
      sound.volume = clamp(0.25 + wm.wallChaos * 0.25, 0.15, 0.7);
      void sound.play().catch(() => undefined);
    } catch {
      // ignore
    }
  }
};

export const wallModeMiss = (state: ReactPongState) => {
  const wm = state.wallMode;
  if (wm.gameState !== 'playing') return;
  wm.gameState = 'gameOver';
  state.comboText = '';
  state.triggerScreenShake(0.4);
};
