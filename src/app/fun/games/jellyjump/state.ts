import { proxy } from 'valtio';
import { generateSeed } from '../../utils/seededRandom';
import type {
  DeathCause,
  EffectEvent,
  JellyControls,
  JellyJumpPhase,
} from './types';

const BEST_KEY = 'jellyjump-best';
const DEFAULT_CONTROLS: JellyControls = {
  jump: false,
  jumpHeld: false,
  left: false,
  right: false,
};

export const mutation = {
  playerPos: [0, 1.2, 0] as [number, number, number],
  playerVel: [0, 0, 0] as [number, number, number],
  maxY: 1.2,
  lastAwardedLevel: 0,
  isGrounded: true,
  lastGroundedMs: 0,
  currentFloor: 0,
  lastGroundedFloor: 0,
  jumpQueuedUntilMs: 0,
  jumpConsumedSinceGrounded: false,
  lastBombHitMs: 0,
  effectQueue: [] as EffectEvent[],
  nextEffectId: 1,
  shakeUntil: 0,
  shakeDuration: 0,
  shakeStrength: 0,
  slideGapByRow: new Map<number, number>(),
  slideClosingByRow: new Map<number, boolean>(),
  cameraAnchorY: 1.2,
};

export const jellyJumpState = proxy({
  phase: 'menu' as JellyJumpPhase,
  score: 0,
  level: 0,
  runMaxLevel: 0,
  best: 0,
  paletteIndex: 0,
  worldSeed: generateSeed(),
  startTime: 0, // ms
  controls: { ...DEFAULT_CONTROLS },
  gems: 0,
  gemsCollected: 0,
  selectedCharacter: 0,
  frozenUntil: 0, // timestamp when freeze ends
  activatedLevers: new Set<number>(), // row indices of activated levers
  deathCause: null as DeathCause | null,
  deathPosition: [0, 1.2, 0] as [number, number, number],
  deathAt: 0,

  reset() {
    this.phase = 'menu';
    this.score = 0;
    this.level = 0;
    this.runMaxLevel = 0;
    this.paletteIndex = 0;
    this.worldSeed = generateSeed();
    this.startTime = 0;
    this.controls = { ...DEFAULT_CONTROLS };
    this.gems = 0;
    this.gemsCollected = 0;
    this.frozenUntil = 0;
    this.activatedLevers.clear();
    this.deathCause = null;
    this.deathPosition = [0, 1.2, 0];
    this.deathAt = 0;

    mutation.playerPos = [0, 1.2, 0];
    mutation.playerVel = [0, 0, 0];
    mutation.maxY = 1.2;
    mutation.lastAwardedLevel = 0;
    mutation.isGrounded = true;
    mutation.lastGroundedMs = 0;
    mutation.currentFloor = 0;
    mutation.lastGroundedFloor = 0;
    mutation.jumpQueuedUntilMs = 0;
    mutation.jumpConsumedSinceGrounded = false;
    mutation.lastBombHitMs = 0;
    mutation.effectQueue = [];
    mutation.nextEffectId = 1;
    mutation.shakeUntil = 0;
    mutation.shakeDuration = 0;
    mutation.shakeStrength = 0;
    mutation.slideGapByRow.clear();
    mutation.slideClosingByRow.clear();
    mutation.cameraAnchorY = 1.2;
  },

  startGame() {
    this.phase = 'playing';
    this.score = 0;
    this.level = 0;
    this.runMaxLevel = 0;
    this.paletteIndex = 0;
    this.worldSeed = generateSeed();
    this.startTime = Date.now();
    this.controls = { ...DEFAULT_CONTROLS };
    this.gems = 0;
    this.gemsCollected = 0;
    this.frozenUntil = 0;
    this.activatedLevers.clear();
    this.deathCause = null;
    this.deathPosition = [0, 1.2, 0];
    this.deathAt = 0;

    mutation.playerPos = [0, 1.2, 0];
    mutation.playerVel = [0, 0, 0];
    mutation.maxY = 1.2;
    mutation.lastAwardedLevel = 0;
    mutation.isGrounded = true;
    mutation.lastGroundedMs = Date.now();
    mutation.currentFloor = 0;
    mutation.lastGroundedFloor = 0;
    mutation.jumpQueuedUntilMs = 0;
    mutation.jumpConsumedSinceGrounded = false;
    mutation.lastBombHitMs = 0;
    mutation.effectQueue = [];
    mutation.nextEffectId = 1;
    mutation.shakeUntil = 0;
    mutation.shakeDuration = 0;
    mutation.shakeStrength = 0;
    mutation.slideGapByRow.clear();
    mutation.slideClosingByRow.clear();
    mutation.cameraAnchorY = 1.2;
  },

  endGame(cause: DeathCause = 'lava', position?: [number, number, number]) {
    if (this.phase !== 'playing') return;
    this.phase = 'gameover';
    this.deathCause = cause;
    this.deathAt = Date.now();
    this.deathPosition = position ?? [...mutation.playerPos];
    if (this.runMaxLevel > this.best) {
      this.best = this.runMaxLevel;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        // ignore
      }
    }
  },

  loadBest() {
    try {
      const saved = localStorage.getItem(BEST_KEY);
      if (saved) this.best = parseInt(saved, 10);
    } catch {
      // ignore
    }
  },
});
