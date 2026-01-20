// src/components/games/ReactPong.tsx
'use client';

import { Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import clamp from 'lodash-es/clamp';
import { easing } from 'maath';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import PaddleHand from './models/PaddleHand';

// ═══════════════════════════════════════════════════════════════════════════
// SCORING SYSTEM CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SCORE_VALUES = {
  paddle: { base: 10, perVelocity: 0.5 },
  wallTop: { base: 5 },
  wallSide: { base: 8 },
  wallCorner: { base: 15 },
  block: { breakable: 25, bouncy: 20, stationary: 15 },
};

const COMBO_MULTIPLIERS = {
  5: { multiplier: 1.5, name: 'Nice!', color: '#00ff88' },
  10: { multiplier: 2.0, name: 'Great!', color: '#00d4ff' },
  25: { multiplier: 3.0, name: 'Amazing!', color: '#ffaa00' },
  50: { multiplier: 4.0, name: 'Incredible!', color: '#ff00ff' },
  100: { multiplier: 5.0, name: 'LEGENDARY!', color: '#ff0000' },
};

const ACHIEVEMENTS = [
  { threshold: 25, skinName: 'Yellow', type: 'streak' },
  { threshold: 50, skinName: 'Green', type: 'streak' },
  { threshold: 100, skinName: 'Purple', type: 'streak' },
  { threshold: 250, skinName: 'Cyan', type: 'streak' },
  { threshold: 1000, skinName: 'Magenta', type: 'streak' },
  { threshold: 10000, skinName: 'Black', type: 'score' },
];

// ═══════════════════════════════════════════════════════════════════════════
// WALL MODE (CURVE CATCH 3D) CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const WALL_MODE_LEVELS = [
  // Level 1-2: Beginner - Plain wall, predictable rebounds
  { level: 1, streakGoal: 10, baseSpeed: 8, speedMultiplier: 1.05, captureZoneSize: 2.5, wallType: 'plain' as const, hasMovingPanels: false, hasTargetZones: false, hasHazardZones: false },
  { level: 2, streakGoal: 15, baseSpeed: 9, speedMultiplier: 1.06, captureZoneSize: 2.4, wallType: 'plain' as const, hasMovingPanels: false, hasTargetZones: false, hasHazardZones: false },
  // Level 3-5: Intermediate - Wall zones with speed/spin/bounce effects
  { level: 3, streakGoal: 18, baseSpeed: 10, speedMultiplier: 1.06, captureZoneSize: 2.3, wallType: 'zones' as const, hasMovingPanels: false, hasTargetZones: false, hasHazardZones: false },
  { level: 4, streakGoal: 20, baseSpeed: 11, speedMultiplier: 1.07, captureZoneSize: 2.2, wallType: 'zones' as const, hasMovingPanels: false, hasTargetZones: true, hasHazardZones: false },
  { level: 5, streakGoal: 22, baseSpeed: 12, speedMultiplier: 1.07, captureZoneSize: 2.1, wallType: 'zones' as const, hasMovingPanels: false, hasTargetZones: true, hasHazardZones: false },
  // Level 6-10: Advanced - Moving panels, target zones, hazard zones
  { level: 6, streakGoal: 25, baseSpeed: 13, speedMultiplier: 1.08, captureZoneSize: 2.0, wallType: 'advanced' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: false },
  { level: 7, streakGoal: 28, baseSpeed: 14, speedMultiplier: 1.08, captureZoneSize: 1.9, wallType: 'advanced' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: true },
  { level: 8, streakGoal: 30, baseSpeed: 15, speedMultiplier: 1.09, captureZoneSize: 1.8, wallType: 'advanced' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: true },
  { level: 9, streakGoal: 35, baseSpeed: 16, speedMultiplier: 1.09, captureZoneSize: 1.7, wallType: 'chaos' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: true },
  { level: 10, streakGoal: 40, baseSpeed: 18, speedMultiplier: 1.10, captureZoneSize: 1.6, wallType: 'chaos' as const, hasMovingPanels: true, hasTargetZones: true, hasHazardZones: true },
];

const WALL_MODE_COMBO_MULTIPLIERS = {
  5: { multiplier: 2, name: 'x2', color: '#00ff88' },
  10: { multiplier: 3, name: 'x3', color: '#00d4ff' },
  20: { multiplier: 5, name: 'x5', color: '#ffaa00' },
  35: { multiplier: 8, name: 'x8', color: '#ff00ff' },
  50: { multiplier: 10, name: 'x10', color: '#ff0000' },
};

type PowerupType = 'slowmo' | 'widen' | 'magnet' | 'shield' | 'curveBoost';

interface ActivePowerup {
  type: PowerupType;
  remainingTime?: number;
  remainingUses?: number;
}

interface WallZone {
  id: string;
  type: 'speed' | 'spin' | 'bounce' | 'target' | 'hazard';
  position: [number, number, number];
  size: [number, number];
  effect: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

type BlockType = 'breakable' | 'stationary' | 'bouncy';

interface Block {
  color: string;
  position: [number, number, number];
  hitsLeft: number;
}

interface UnlockableSkin {
  name: string;
  url: string;
  unlocked: boolean;
  achievement: string;
}

interface ScorePopup {
  id: string;
  value: number;
  position: [number, number, number];
  color: string;
  combo?: string;
  timestamp: number;
}

interface HitEffect {
  id: string;
  position: [number, number, number];
  color: string;
  intensity: number;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT ASSETS
// ═══════════════════════════════════════════════════════════════════════════

const defaultBallTexture =
  'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlue.png';

const reactPongSkins: UnlockableSkin[] = [
  { name: 'Blue', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlue.png', unlocked: true, achievement: 'Default skin' },
  { name: 'Red', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongRed.png', unlocked: true, achievement: 'Default skin' },
  { name: 'Yellow', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongYellow.png', unlocked: false, achievement: 'Bounce 25 hits in a row' },
  { name: 'Green', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongGreen.png', unlocked: false, achievement: 'Bounce 50 hits in a row' },
  { name: 'Purple', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongPurple.png', unlocked: false, achievement: 'Bounce 100 hits in a row' },
  { name: 'Cyan', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongCyan.png', unlocked: false, achievement: 'Bounce 250 hits in a row' },
  { name: 'Magenta', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongMagenta.png', unlocked: false, achievement: 'Bounce 1000 hits in a row' },
  { name: 'Black', url: 'https://racho-devs.s3.us-east-2.amazonaws.com/funV2/reactPongAssets/pingPongBlack.png', unlocked: false, achievement: 'Reach a score of 10,000' },
];

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STATE (Valtio)
// ═══════════════════════════════════════════════════════════════════════════

export const reactPongState = proxy({
  score: 0,
  highScore: 0,
  hitStreak: 0,
  bestStreak: 0,
  totalHits: 0,
  ballColor: '#00d4ff',
  scoreColor: '#00d4ff',
  currentMultiplier: 1,
  ballTexture: defaultBallTexture,
  count: 0,
  
  // Visual feedback
  scorePopups: [] as ScorePopup[],
  hitEffects: [] as HitEffect[],
  screenShake: 0,
  comboText: '',
  comboColor: '#ffffff',

  audio: {
    paddleHitSound: null as HTMLAudioElement | null,
    wallHitSound: null as HTMLAudioElement | null,
    scoreSound: null as HTMLAudioElement | null,
    scoreBonusSound: null as HTMLAudioElement | null,
  },

  blocks: {
    breakable: {} as Record<string, Block>,
    stationary: {} as Record<string, Block>,
    bouncy: {} as Record<string, Block>,
  },

  skins: [...reactPongSkins],
  mode: 'SoloPaddle' as 'SoloPaddle' | 'SoloWalls' | 'WallMode',

  // ═══════════════════════════════════════════════════════════════════════════
  // WALL MODE (CURVE CATCH 3D) STATE
  // ═══════════════════════════════════════════════════════════════════════════
  wallMode: {
    // Game state
    lives: 5,
    currentLevel: 1,
    gameState: 'ready' as 'ready' | 'playing' | 'captured' | 'levelComplete' | 'gameOver' | 'victory',
    
    // Ball mechanics
    currentSpeed: 8,
    maxSpeed: 35,
    rallyStreak: 0,
    levelStreak: 0,
    
    // Capture mechanics
    isBallCaptured: false,
    captureStartTime: 0,
    captureHoldTime: 0.3, // seconds to hold before auto-release
    chargeAmount: 0, // 0-1, increases with hold time
    
    // Spin mechanics
    spinIntensity: 0, // -1 to 1, based on paddle flick
    lastPaddleVelocity: { x: 0, y: 0 },
    
    // Level config
    currentLevelConfig: WALL_MODE_LEVELS[0],
    wallZones: [] as WallZone[],
    
    // Powerups
    activePowerups: [] as ActivePowerup[],
    availablePowerup: null as { type: PowerupType; position: [number, number, number] } | null,
    
    // Stabilize mode (Shift key)
    stabilizeMode: false,
    
    // Perfect catch bonus
    lastCatchWasPerfect: false,
  },

  setMode: (mode: 'SoloPaddle' | 'SoloWalls' | 'WallMode') => {
    reactPongState.mode = mode;
    if (mode === 'WallMode') {
      reactPongState.resetWallMode();
    }
  },

  // Wall Mode specific methods
  resetWallMode() {
    this.wallMode.lives = 5;
    this.wallMode.currentLevel = 1;
    this.wallMode.gameState = 'ready';
    this.wallMode.currentSpeed = WALL_MODE_LEVELS[0].baseSpeed;
    this.wallMode.rallyStreak = 0;
    this.wallMode.levelStreak = 0;
    this.wallMode.isBallCaptured = false;
    this.wallMode.captureStartTime = 0;
    this.wallMode.chargeAmount = 0;
    this.wallMode.spinIntensity = 0;
    this.wallMode.currentLevelConfig = WALL_MODE_LEVELS[0];
    this.wallMode.activePowerups = [];
    this.wallMode.availablePowerup = null;
    this.wallMode.lastCatchWasPerfect = false;
    this.score = 0;
    this.hitStreak = 0;
    this.comboText = '';
    this.generateWallZones();
  },

  generateWallZones() {
    const config = this.wallMode.currentLevelConfig;
    const zones: WallZone[] = [];
    
    if (config.wallType === 'plain') {
      // No special zones for beginner levels
      this.wallMode.wallZones = [];
      return;
    }
    
    const wallWidth = 16;
    const wallHeight = 8;
    
    if (config.wallType === 'zones' || config.wallType === 'advanced' || config.wallType === 'chaos') {
      // Speed zones
      zones.push({
        id: 'speed-1',
        type: 'speed',
        position: [-wallWidth / 4, 0, 0],
        size: [3, 2],
        effect: 1.3,
      });
      
      // Spin zones
      zones.push({
        id: 'spin-1',
        type: 'spin',
        position: [wallWidth / 4, 1, 0],
        size: [2.5, 2.5],
        effect: 0.8,
      });
      
      // Bounce zones
      zones.push({
        id: 'bounce-1',
        type: 'bounce',
        position: [0, -2, 0],
        size: [3, 1.5],
        effect: 1.5,
      });
    }
    
    if (config.hasTargetZones) {
      // Target zones for bonus points
      zones.push({
        id: 'target-1',
        type: 'target',
        position: [Math.random() * wallWidth / 2 - wallWidth / 4, Math.random() * wallHeight / 2 - wallHeight / 4, 0],
        size: [1.5, 1.5],
        effect: 100, // Bonus points
      });
    }
    
    if (config.hasHazardZones) {
      // Hazard zones with unpredictable rebounds
      zones.push({
        id: 'hazard-1',
        type: 'hazard',
        position: [Math.random() > 0.5 ? wallWidth / 3 : -wallWidth / 3, Math.random() * 2 - 1, 0],
        size: [2, 2],
        effect: 2, // Chaos multiplier
      });
    }
    
    this.wallMode.wallZones = zones;
  },

  advanceWallModeLevel() {
    const nextLevel = this.wallMode.currentLevel + 1;
    if (nextLevel > 10) {
      this.wallMode.gameState = 'victory';
      return;
    }
    
    this.wallMode.currentLevel = nextLevel;
    this.wallMode.currentLevelConfig = WALL_MODE_LEVELS[nextLevel - 1];
    this.wallMode.currentSpeed = this.wallMode.currentLevelConfig.baseSpeed;
    this.wallMode.levelStreak = 0;
    this.wallMode.rallyStreak = 0;
    this.wallMode.gameState = 'ready';
    this.wallMode.activePowerups = [];
    this.wallMode.availablePowerup = null;
    this.generateWallZones();
  },

  wallModeCaptureBall() {
    if (!this.wallMode.isBallCaptured) {
      this.wallMode.isBallCaptured = true;
      this.wallMode.captureStartTime = Date.now();
      this.wallMode.chargeAmount = 0;
      this.wallMode.gameState = 'captured';
    }
  },

  wallModeReleaseBall(): { speed: number; spin: number; charge: number } {
    const charge = this.wallMode.chargeAmount;
    const spin = this.wallMode.spinIntensity;
    const baseSpeed = this.wallMode.currentSpeed;
    const chargeBonus = 1 + charge * 0.5; // Up to 50% speed bonus from charge
    
    this.wallMode.isBallCaptured = false;
    this.wallMode.gameState = 'playing';
    this.wallMode.chargeAmount = 0;
    
    return {
      speed: baseSpeed * chargeBonus,
      spin: spin,
      charge: charge,
    };
  },

  wallModeHitWall(zoneType?: string, isPerfectCatch: boolean = false) {
    this.wallMode.rallyStreak++;
    this.wallMode.levelStreak++;
    
    // Speed increase with each hit (7% per hit or config multiplier)
    const multiplier = this.wallMode.currentLevelConfig.speedMultiplier;
    this.wallMode.currentSpeed = Math.min(
      this.wallMode.maxSpeed,
      this.wallMode.currentSpeed * multiplier
    );
    
    // Calculate score
    let baseScore = 10;
    if (zoneType === 'target') baseScore = 100;
    if (zoneType === 'hazard') baseScore = 25;
    if (zoneType === 'speed') baseScore = 15;
    if (zoneType === 'spin') baseScore = 15;
    if (isPerfectCatch) {
      baseScore *= 1.5;
      this.wallMode.lastCatchWasPerfect = true;
    } else {
      this.wallMode.lastCatchWasPerfect = false;
    }
    
    // Apply combo multiplier
    const comboData = this.getWallModeMultiplier();
    const totalScore = Math.round(baseScore * comboData.multiplier);
    this.score += totalScore;
    
    // Check for combo milestones
    const comboThresholds = Object.keys(WALL_MODE_COMBO_MULTIPLIERS).map(Number);
    if (comboThresholds.includes(this.wallMode.rallyStreak)) {
      const combo = WALL_MODE_COMBO_MULTIPLIERS[this.wallMode.rallyStreak as keyof typeof WALL_MODE_COMBO_MULTIPLIERS];
      this.comboText = combo.name;
      this.comboColor = combo.color;
      this.triggerScreenShake(0.15);
    }
    
    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    
    // Check if level goal reached
    if (this.wallMode.levelStreak >= this.wallMode.currentLevelConfig.streakGoal) {
      this.wallMode.gameState = 'levelComplete';
    }
    
    // Random powerup drop (5% chance on target zones, 2% otherwise)
    const powerupChance = zoneType === 'target' ? 0.05 : 0.02;
    if (Math.random() < powerupChance && !this.wallMode.availablePowerup) {
      const powerupTypes: PowerupType[] = ['slowmo', 'widen', 'magnet', 'shield', 'curveBoost'];
      this.wallMode.availablePowerup = {
        type: powerupTypes[Math.floor(Math.random() * powerupTypes.length)],
        position: [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, 0],
      };
    }
    
    return { score: totalScore, combo: comboData };
  },

  wallModeMiss() {
    this.wallMode.lives--;
    this.wallMode.rallyStreak = 0;
    this.wallMode.currentSpeed = this.wallMode.currentLevelConfig.baseSpeed;
    this.comboText = '';
    
    if (this.wallMode.lives <= 0) {
      this.wallMode.gameState = 'gameOver';
    } else {
      this.wallMode.gameState = 'ready';
    }
  },

  getWallModeMultiplier(): { multiplier: number; name: string; color: string } {
    const thresholds = Object.keys(WALL_MODE_COMBO_MULTIPLIERS).map(Number).sort((a, b) => b - a);
    for (const threshold of thresholds) {
      if (this.wallMode.rallyStreak >= threshold) {
        return WALL_MODE_COMBO_MULTIPLIERS[threshold as keyof typeof WALL_MODE_COMBO_MULTIPLIERS];
      }
    }
    return { multiplier: 1, name: '', color: '#ffffff' };
  },

  collectPowerup(type: PowerupType) {
    this.wallMode.availablePowerup = null;
    
    switch (type) {
      case 'slowmo':
        this.wallMode.activePowerups.push({ type: 'slowmo', remainingTime: 2 });
        break;
      case 'widen':
        this.wallMode.activePowerups.push({ type: 'widen', remainingTime: 5 });
        break;
      case 'magnet':
        this.wallMode.activePowerups.push({ type: 'magnet', remainingUses: 3 });
        break;
      case 'shield':
        this.wallMode.activePowerups.push({ type: 'shield', remainingUses: 1 });
        break;
      case 'curveBoost':
        this.wallMode.activePowerups.push({ type: 'curveBoost', remainingUses: 1 });
        break;
    }
  },

  updatePowerups(delta: number) {
    this.wallMode.activePowerups = this.wallMode.activePowerups.filter(p => {
      if (p.remainingTime !== undefined) {
        p.remainingTime -= delta;
        return p.remainingTime > 0;
      }
      if (p.remainingUses !== undefined) {
        return p.remainingUses > 0;
      }
      return true;
    });
  },

  hasPowerup(type: PowerupType): boolean {
    return this.wallMode.activePowerups.some(p => p.type === type);
  },

  usePowerup(type: PowerupType) {
    const powerup = this.wallMode.activePowerups.find(p => p.type === type);
    if (powerup && powerup.remainingUses !== undefined) {
      powerup.remainingUses--;
    }
  },

  addScorePopup(value: number, position: [number, number, number], color: string, combo?: string) {
    const popup: ScorePopup = {
      id: Math.random().toString(36).slice(2, 10),
      value,
      position,
      color,
      combo,
      timestamp: Date.now(),
    };
    this.scorePopups.push(popup);
    // Remove after 1.5 seconds
    setTimeout(() => {
      this.scorePopups = this.scorePopups.filter(p => p.id !== popup.id);
    }, 1500);
  },

  addHitEffect(position: [number, number, number], color: string, intensity: number) {
    const effect: HitEffect = {
      id: Math.random().toString(36).slice(2, 10),
      position,
      color,
      intensity,
      timestamp: Date.now(),
    };
    this.hitEffects.push(effect);
    setTimeout(() => {
      this.hitEffects = this.hitEffects.filter(e => e.id !== effect.id);
    }, 800);
  },

  triggerScreenShake(intensity: number) {
    this.screenShake = intensity;
  },

  getMultiplier(): { multiplier: number; name: string; color: string } {
    const thresholds = Object.keys(COMBO_MULTIPLIERS).map(Number).sort((a, b) => b - a);
    for (const threshold of thresholds) {
      if (this.hitStreak >= threshold) {
        return COMBO_MULTIPLIERS[threshold as keyof typeof COMBO_MULTIPLIERS];
      }
    }
    return { multiplier: 1, name: '', color: '#ffffff' };
  },

  hitBlock(type: BlockType, id: string) {
    const block = this.blocks[type][id];
    if (block) {
      block.hitsLeft -= 1;
      if (block.hitsLeft <= 0) {
        const baseScore = SCORE_VALUES.block[type] || 15;
        const { multiplier } = this.getMultiplier();
        this.score += Math.round(baseScore * multiplier);
        delete this.blocks[type][id];
      }
    }
  },

  pong(velocity: number, colliderType: string, position?: [number, number, number]) {
    let scoreDelta = 0;
    let hitColor = '#00d4ff';
    const pos = position || [0, 0, 0] as [number, number, number];
    
    // Get current multiplier
    const { multiplier, name: comboName, color: comboColor } = this.getMultiplier();

    if (colliderType === 'paddle') {
      // Paddle hit
      const localAudio = reactPongState.audio.paddleHitSound;
      if (localAudio) {
        try {
          localAudio.currentTime = 0;
          localAudio.volume = clamp(velocity / 20, 0.3, 1);
          localAudio.play().catch(() => {});
        } catch {}
      }
      
      this.hitStreak++;
      this.totalHits++;
      this.count++;
      
      // Calculate score with velocity bonus
      const baseScore = SCORE_VALUES.paddle.base + Math.round(velocity * SCORE_VALUES.paddle.perVelocity);
      scoreDelta = Math.round(baseScore * multiplier);
      hitColor = '#00ffaa';

      // Check for combo milestones
      const comboThresholds = Object.keys(COMBO_MULTIPLIERS).map(Number);
      if (comboThresholds.includes(this.hitStreak)) {
        const combo = COMBO_MULTIPLIERS[this.hitStreak as keyof typeof COMBO_MULTIPLIERS];
        this.comboText = combo.name;
        this.comboColor = combo.color;
        this.triggerScreenShake(this.hitStreak >= 50 ? 0.3 : 0.15);
        
        // Bonus score for reaching combo
        scoreDelta += this.hitStreak * 2;
        
        // Play bonus sound
        const bonusSound = reactPongState.audio.scoreBonusSound;
        if (bonusSound) {
          try {
            bonusSound.currentTime = 0;
            bonusSound.play().catch(() => {});
          } catch {}
        }
      }

      // Update best streak
      if (this.hitStreak > this.bestStreak) {
        this.bestStreak = this.hitStreak;
      }

      // Check achievements
      ACHIEVEMENTS.forEach((ach) => {
        if (ach.type === 'streak' && this.hitStreak === ach.threshold) {
          const skin = this.skins.find((s) => s.name === ach.skinName);
          if (skin && !skin.unlocked) {
            skin.unlocked = true;
          }
        }
      });

    } else if (colliderType.startsWith('wall')) {
      // Wall hit
      const localWallHitSound = reactPongState.audio.wallHitSound;
      if (localWallHitSound) {
        try {
          localWallHitSound.currentTime = 0;
          localWallHitSound.volume = clamp(velocity / 20, 0.2, 0.8);
          localWallHitSound.play().catch(() => {});
        } catch {}
      }
      
      // Reset streak on wall hit
      this.hitStreak = 0;
      this.comboText = '';

      switch (colliderType) {
        case 'wall-top':
          scoreDelta = SCORE_VALUES.wallTop.base;
          hitColor = '#4080ff';
          break;
        case 'wall-left':
        case 'wall-right':
          scoreDelta = SCORE_VALUES.wallSide.base;
          hitColor = '#8040ff';
          break;
        case 'wall-bottom-left':
        case 'wall-bottom-right':
          scoreDelta = SCORE_VALUES.wallCorner.base;
          hitColor = '#ff4080';
          break;
      }
    } else {
      // Block hit
      this.count += 2;
      switch (colliderType) {
        case 'breakable':
          scoreDelta = Math.round(SCORE_VALUES.block.breakable * multiplier);
          hitColor = '#ff8800';
          break;
        case 'bouncy':
          scoreDelta = Math.round(SCORE_VALUES.block.bouncy * multiplier);
          hitColor = '#00ff88';
          break;
        default:
          scoreDelta = Math.round(SCORE_VALUES.block.stationary * multiplier);
          hitColor = '#ff4444';
          break;
      }
    }

    if (scoreDelta > 0) {
      this.score += scoreDelta;
      
      // Add visual feedback
      this.addScorePopup(scoreDelta, pos, hitColor, comboName && colliderType === 'paddle' ? comboName : undefined);
      this.addHitEffect(pos, hitColor, velocity / 10);
      
      // Update high score
      if (this.score > this.highScore) {
        this.highScore = this.score;
      }
    }

    // Check score achievements
    ACHIEVEMENTS.forEach((ach) => {
      if (ach.type === 'score' && this.score >= ach.threshold) {
        const skin = this.skins.find((s) => s.name === ach.skinName);
        if (skin && !skin.unlocked) {
          skin.unlocked = true;
        }
      }
    });

    // Dynamic ball color based on streak
    if (this.hitStreak >= 100) {
      this.ballColor = '#ff00ff';
    } else if (this.hitStreak >= 50) {
      this.ballColor = '#ffaa00';
    } else if (this.hitStreak >= 25) {
      this.ballColor = '#00ffaa';
    } else if (this.hitStreak >= 10) {
      this.ballColor = '#00d4ff';
    } else {
      this.ballColor = '#ffffff';
    }
    this.scoreColor = this.ballColor;
  },

  reset() {
    this.score = 0;
    this.hitStreak = 0;
    this.totalHits = 0;
    this.count = 0;
    this.ballColor = '#00d4ff';
    this.scoreColor = '#00d4ff';
    this.currentMultiplier = 1;
    this.ballTexture = defaultBallTexture;
    this.scorePopups = [];
    this.hitEffects = [];
    this.screenShake = 0;
    this.comboText = '';

    Object.keys(this.blocks).forEach((type) => {
      // @ts-ignore
      this.blocks[type] = {};
    });

    this.skins = reactPongSkins.map((skin, index) => ({
      ...skin,
      unlocked: index < 2,
    }));
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// HIT EFFECT PARTICLES
// ═══════════════════════════════════════════════════════════════════════════

interface HitParticlesProps {
  effects: HitEffect[];
}

const HitParticles: React.FC<HitParticlesProps> = ({ effects }) => {
  return (
    <>
      {effects.map((effect) => (
        <HitParticleEffect key={effect.id} effect={effect} />
      ))}
    </>
  );
};

const HitParticleEffect: React.FC<{ effect: HitEffect }> = ({ effect }) => {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const particles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.5,
      size: 0.08 + Math.random() * 0.1,
      offset: Math.random() * 0.2,
    }));
  }, []);

  useFrame((_, delta) => {
    particles.forEach((p, i) => {
      const mesh = meshRefs.current[i];
      if (mesh) {
        mesh.position.x += Math.cos(p.angle) * p.speed * delta * 3;
        mesh.position.y += Math.sin(p.angle) * p.speed * delta * 3;
        mesh.scale.multiplyScalar(0.95);
      }
    });
  });

  return (
    <group position={effect.position}>
      {particles.map((p, i) => (
        <mesh 
          key={i} 
          ref={(el) => { meshRefs.current[i] = el; }}
          position={[Math.cos(p.angle) * p.offset, Math.sin(p.angle) * p.offset, 0]}
        >
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshBasicMaterial color={effect.color} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SCORE POPUP ANIMATION
// ═══════════════════════════════════════════════════════════════════════════

interface ScorePopupsProps {
  popups: ScorePopup[];
}

const ScorePopups: React.FC<ScorePopupsProps> = ({ popups }) => {
  return (
    <>
      {popups.map((popup) => (
        <ScorePopupItem key={popup.id} popup={popup} />
      ))}
    </>
  );
};

const ScorePopupItem: React.FC<{ popup: ScorePopup }> = ({ popup }) => {
  const ref = useRef<THREE.Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    elapsed.current += delta;
    ref.current.position.y += delta * 2;
    ref.current.scale.setScalar(Math.max(0, 1 - elapsed.current / 1.5));
  });

  return (
    <group ref={ref} position={[popup.position[0], popup.position[1] + 1, popup.position[2] + 1]}>
      <Text
        fontSize={0.5}
        color={popup.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        +{popup.value}
      </Text>
      {popup.combo && (
        <Text
          fontSize={0.7}
          color={popup.color}
          anchorX="center"
          anchorY="middle"
          position={[0, 0.8, 0]}
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {popup.combo}
        </Text>
      )}
    </group>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// BALL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface BallProps {
  position: [number, number, number];
  ballColor: string;
  onBodyReady?: (body: RapierRigidBody | null) => void;
}

const Ball: React.FC<BallProps> = ({ position, ballColor, onBodyReady }) => {
  const api = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const frameCount = useRef(0);
  const initialized = useRef(false);

  const resetBall = useCallback(() => {
    reactPongState.reset();
    if (api.current) {
      api.current.setTranslation({ x: 0, y: 5, z: 0 }, true);
      api.current.setLinvel({ x: 0, y: -5, z: 0 }, true);
      api.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, []);

  // Notify parent when body is ready
  useEffect(() => {
    // Small delay to ensure the body is initialized
    const timer = setTimeout(() => {
      if (api.current && onBodyReady) {
        onBodyReady(api.current);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [onBodyReady]);

  // Initialize ball position on mount
  useEffect(() => {
    if (!initialized.current && api.current) {
      initialized.current = true;
      api.current.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
      api.current.setLinvel({ x: 0, y: -5, z: 0 }, true);
    }
  });

  useFrame(() => {
    if (!api.current) return;

    frameCount.current++;

    // Initialize on first few frames if not already done
    if (!initialized.current || frameCount.current < 3) {
      api.current.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
      api.current.setLinvel({ x: 0, y: -5, z: 0 }, true);
      initialized.current = true;
      return;
    }

    const vel = api.current.linvel();
    const pos = api.current.translation();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    // Keep ball in 2D plane
    if (Math.abs(vel.z) > 0.01) {
      api.current.setLinvel({ x: vel.x, y: vel.y, z: 0 }, true);
    }

    // Minimum speed to keep ball moving
    if (speed < 2 && speed > 0.1) {
      const boost = 3 / speed;
      api.current.setLinvel({ x: vel.x * boost, y: vel.y * boost, z: 0 }, true);
    }

    // Max speed cap
    const maxSpeed = 30;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      api.current.setLinvel({ x: vel.x * scale, y: vel.y * scale, z: 0 }, true);
    }

    // Keep ball on z=0 plane
    if (Math.abs(pos.z) > 0.1) {
      api.current.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
    }

    // Animate mesh glow based on speed
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + speed * 0.05;
    }
  });

  return (
    <>
      <RigidBody
        ref={api}
        type="dynamic"
        position={position}
        ccd
        angularDamping={0.8}
        linearDamping={0}
        restitution={1}
        friction={0}
        canSleep={false}
        colliders={false}
        enabledTranslations={[true, true, false]}
        enabledRotations={[true, true, true]}
      >
        <BallCollider args={[0.5]} restitution={1} friction={0} />
        <mesh ref={meshRef} castShadow receiveShadow>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial
            color={ballColor}
            emissive={ballColor}
            emissiveIntensity={0.5}
            metalness={0.3}
            roughness={0.2}
          />
        </mesh>
        {/* Ball glow */}
        <pointLight color={ballColor} intensity={1} distance={8} />
      </RigidBody>

      {/* Bottom reset trigger */}
      <RigidBody type="fixed" colliders={false} position={[0, -20, 0]} restitution={2.1} onCollisionEnter={resetBall}>
        <CuboidCollider args={[1000, 2, 1000]} />
      </RigidBody>

      {/* Top reset trigger */}
      <RigidBody type="fixed" colliders={false} position={[0, 30, 0]} restitution={2.1} onCollisionEnter={resetBall}>
        <CuboidCollider args={[1000, 2, 1000]} />
      </RigidBody>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ARENA COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Arena: React.FC = () => {
  const { blocks } = useSnapshot(reactPongState);
  const ballRef = useRef<RapierRigidBody | null>(null);

  const onWallCollision = useCallback((colliderType: string) => {
    const pos = ballRef.current?.translation();
    reactPongState.pong(10, colliderType, pos ? [pos.x, pos.y, pos.z] : undefined);
  }, []);

  const arenaWidth = 20;
  const arenaHeight = 10;
  const wallThickness = 0.5;

  const bottomWallLength = (arenaWidth * 0.33) / 2;
  const bottomWallGap = arenaWidth * 0.8;

  const wallRestitution = 1.0;
  const wallFriction = 0;

  return (
    <>
      {/* Walls with neon glow effect */}
      {/* Top Wall */}
      <RigidBody
        type="fixed"
        position={[0, arenaHeight / 2, 0]}
        onCollisionEnter={() => onWallCollision('wall-top')}
      >
        <CuboidCollider args={[arenaWidth / 2, wallThickness / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[arenaWidth, wallThickness, 0.2]} />
          <meshStandardMaterial color="#4080ff" emissive="#4080ff" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      {/* Left Wall */}
      <RigidBody
        type="fixed"
        position={[-arenaWidth / 2 - wallThickness / 2, 0, 0]}
        onCollisionEnter={() => onWallCollision('wall-left')}
      >
        <CuboidCollider args={[wallThickness / 2, arenaHeight / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[wallThickness, arenaHeight, 0.2]} />
          <meshStandardMaterial color="#8040ff" emissive="#8040ff" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      {/* Right Wall */}
      <RigidBody
        type="fixed"
        position={[arenaWidth / 2 + wallThickness / 2, 0, 0]}
        onCollisionEnter={() => onWallCollision('wall-right')}
      >
        <CuboidCollider args={[wallThickness / 2, arenaHeight / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[wallThickness, arenaHeight, 0.2]} />
          <meshStandardMaterial color="#8040ff" emissive="#8040ff" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      {/* Bottom Left Wall */}
      <RigidBody
        type="fixed"
        position={[-(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]}
        onCollisionEnter={() => onWallCollision('wall-bottom-left')}
      >
        <CuboidCollider args={[bottomWallLength / 2, wallThickness / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[bottomWallLength, wallThickness, 0.2]} />
          <meshStandardMaterial color="#ff4080" emissive="#ff4080" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      {/* Bottom Right Wall */}
      <RigidBody
        type="fixed"
        position={[(bottomWallGap / 2 + bottomWallLength / 2), -arenaHeight / 2, 0]}
        onCollisionEnter={() => onWallCollision('wall-bottom-right')}
      >
        <CuboidCollider args={[bottomWallLength / 2, wallThickness / 2, 2]} restitution={wallRestitution} friction={wallFriction} />
        <mesh>
          <boxGeometry args={[bottomWallLength, wallThickness, 0.2]} />
          <meshStandardMaterial color="#ff4080" emissive="#ff4080" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      {/* Arena edge glow lights */}
      <pointLight position={[0, arenaHeight / 2, 2]} color="#4080ff" intensity={0.5} distance={15} />
      <pointLight position={[-arenaWidth / 2, 0, 2]} color="#8040ff" intensity={0.3} distance={10} />
      <pointLight position={[arenaWidth / 2, 0, 2]} color="#8040ff" intensity={0.3} distance={10} />
      <pointLight position={[0, -arenaHeight / 2, 2]} color="#ff4080" intensity={0.4} distance={12} />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PADDLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PaddleProps {
  scoreColor: string;
}

const Paddle: React.FC<PaddleProps> = ({ scoreColor }) => {
  const paddleApi = useRef<RapierRigidBody | null>(null);
  const model = useRef<THREE.Group>(null);
  const { count, hitStreak, comboText, comboColor } = useSnapshot(reactPongState);

  const vec = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const quaternion = useRef(new THREE.Quaternion());
  const euler = useRef(new THREE.Euler());

  const contactForce = useCallback((payload: { totalForceMagnitude: number }) => {
    if (payload.totalForceMagnitude > 500) {
      const pos = paddleApi.current?.translation();
      reactPongState.pong(
        payload.totalForceMagnitude / 100,
        'paddle',
        pos ? [pos.x, pos.y, pos.z] : undefined
      );
      if (model.current) {
        model.current.position.y = -payload.totalForceMagnitude / 10000;
      }
    }
  }, []);

  useFrame((state, delta) => {
    vec.current.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
    dir.current.copy(vec.current).sub(state.camera.position).normalize();
    vec.current.add(dir.current.multiplyScalar(state.camera.position.length()));

    const arenaWidth = 20;
    const arenaHeight = 10;
    const clampedX = clamp(vec.current.x, -arenaWidth / 2 + 2, arenaWidth / 2 - 2);
    const clampedY = clamp(vec.current.y, -arenaHeight / 2 + 1, arenaHeight / 2 - 1);

    paddleApi.current?.setNextKinematicTranslation({ x: clampedX, y: clampedY, z: 0 });

    const rotationAngle = (state.pointer.x * Math.PI) / 10;
    euler.current.set(0, 0, rotationAngle);
    quaternion.current.setFromEuler(euler.current);

    paddleApi.current?.setNextKinematicRotation({
      x: quaternion.current.x,
      y: quaternion.current.y,
      z: quaternion.current.z,
      w: quaternion.current.w,
    });

    if (model.current) {
      easing.damp3(model.current.position, [0, 0, 0], 0.2, delta);
    }

    // Apply screen shake
    const shake = reactPongState.screenShake;
    if (shake > 0) {
      state.camera.position.x += (Math.random() - 0.5) * shake;
      state.camera.position.y += (Math.random() - 0.5) * shake;
      reactPongState.screenShake *= 0.9;
      if (reactPongState.screenShake < 0.01) reactPongState.screenShake = 0;
    }

    easing.damp3(
      state.camera.position,
      [-state.pointer.x * 4, 2.5 + -state.pointer.y * 4, 12],
      0.3,
      delta
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <RigidBody
      ref={paddleApi}
      ccd
      canSleep={false}
      type="kinematicPosition"
      colliders={false}
      onContactForce={contactForce}
    >
      <CylinderCollider args={[0.15, 1.75]} />
      <group ref={model} position={[0, 2, 0]} scale={0.15}>
        {/* Score display */}
        <Text
          anchorX="center"
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, 0]}
          color={scoreColor}
          position={[0, 1, 0]}
          fontSize={10}
          outlineWidth={0.5}
          outlineColor="#000000"
        >
          {count}
        </Text>
        
        {/* Streak indicator */}
        {hitStreak >= 5 && (
          <Text
            anchorX="center"
            anchorY="middle"
            rotation={[-Math.PI / 2, 0, 0]}
            color={comboColor || '#00ffaa'}
            position={[0, 2, 0]}
            fontSize={5}
            outlineWidth={0.3}
            outlineColor="#000000"
          >
            x{hitStreak}
          </Text>
        )}
        
        <PaddleHand />
      </group>
      
      {/* Paddle glow */}
      <pointLight color={scoreColor} intensity={0.8} distance={5} />
    </RigidBody>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SOLO WALLS MODE
// ═══════════════════════════════════════════════════════════════════════════

interface SoloWallsAssistProps {
  ballRef: React.MutableRefObject<RapierRigidBody | null>;
}

const SoloWallsAssist: React.FC<SoloWallsAssistProps> = ({ ballRef }) => {
  const pointerDown = useRef(false);

  useEffect(() => {
    const handlePointerDown = () => { pointerDown.current = true; };
    const handlePointerUp = () => { pointerDown.current = false; };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (!pointerDown.current || !ballRef.current) return;
    const impulseScale = 1.2;
    ballRef.current.applyImpulse(
      {
        x: state.pointer.x * impulseScale * delta * 60,
        y: state.pointer.y * impulseScale * delta * 60,
        z: 0,
      },
      true
    );
  });

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// SPACE PONG 3D (WALL MODE) - Curveball Style
// ═══════════════════════════════════════════════════════════════════════════

// Game constants for Space Pong
const TUNNEL_WIDTH = 8;
const TUNNEL_HEIGHT = 6;
const TUNNEL_DEPTH = 40;
const BALL_RADIUS = 0.4;
const PADDLE_WIDTH = 2.5;
const PADDLE_HEIGHT = 2;
const CPU_PADDLE_SPEED_BASE = 0.15;

interface SpacePongBallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  rotation: number;
}

// Space Pong Ball Component (non-physics, pure math)
const SpacePongBall: React.FC<{
  ballState: SpacePongBallState;
  maxZ: number;
}> = ({ ballState, maxZ }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Scale ball based on Z distance (smaller when far)
  const scale = useMemo(() => {
    const t = ballState.z / maxZ;
    return 1 - t * 0.75; // At max distance, ball is 25% of original size
  }, [ballState.z, maxZ]);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.set(ballState.x, ballState.y, -ballState.z);
      meshRef.current.scale.setScalar(scale);
      meshRef.current.rotation.z = ballState.rotation;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
      <meshStandardMaterial
        color="#00ffff"
        emissive="#00ffff"
        emissiveIntensity={0.6}
        metalness={0.3}
        roughness={0.2}
      />
    </mesh>
  );
};

// Ball Trail/Tracker showing where ball will land
const BallTracker: React.FC<{
  ballState: SpacePongBallState;
  maxZ: number;
  showPlayerSide: boolean;
}> = ({ ballState, maxZ, showPlayerSide }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Only show when ball is moving toward the relevant side
  const isVisible = showPlayerSide ? ballState.vz < 0 : ballState.vz > 0;
  
  // Predict where ball will be when it reaches the paddle plane
  const predictedPos = useMemo(() => {
    if (!isVisible) return { x: 0, y: 0 };
    
    const targetZ = showPlayerSide ? 0 : maxZ;
    const distanceToTravel = showPlayerSide ? ballState.z : (maxZ - ballState.z);
    const timeToReach = Math.abs(distanceToTravel / ballState.vz);
    
    return {
      x: ballState.x + ballState.vx * timeToReach,
      y: ballState.y + ballState.vy * timeToReach,
    };
  }, [ballState, maxZ, showPlayerSide, isVisible]);
  
  const scale = showPlayerSide ? 1 : 0.25;
  const zPos = showPlayerSide ? -0.1 : -(maxZ + 0.1);
  
  if (!isVisible) return null;
  
  return (
    <mesh ref={meshRef} position={[predictedPos.x, predictedPos.y, zPos]}>
      <ringGeometry args={[BALL_RADIUS * scale * 0.8, BALL_RADIUS * scale * 1.2, 32]} />
      <meshBasicMaterial color={showPlayerSide ? '#ff4444' : '#44ff44'} transparent opacity={0.5} />
    </mesh>
  );
};

// Player Paddle (follows mouse)
const PlayerPaddle: React.FC<{
  position: { x: number; y: number };
  onPositionChange: (x: number, y: number) => void;
  prevPosition: React.MutableRefObject<{ x: number; y: number }>;
}> = ({ position, onPositionChange, prevPosition }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    // Convert mouse position to paddle position
    const halfWidth = TUNNEL_WIDTH / 2 - PADDLE_WIDTH / 2;
    const halfHeight = TUNNEL_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    
    const targetX = clamp(state.pointer.x * TUNNEL_WIDTH * 0.6, -halfWidth, halfWidth);
    const targetY = clamp(state.pointer.y * TUNNEL_HEIGHT * 0.6, -halfHeight, halfHeight);
    
    // Store previous position for spin calculation
    prevPosition.current = { x: position.x, y: position.y };
    
    onPositionChange(targetX, targetY);
    
    if (meshRef.current) {
      meshRef.current.position.set(targetX, targetY, 0);
    }
  });
  
  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <boxGeometry args={[PADDLE_WIDTH, PADDLE_HEIGHT, 0.2]} />
      <meshStandardMaterial
        color="#00aaff"
        emissive="#00aaff"
        emissiveIntensity={0.4}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
};

// CPU/Wall Paddle (AI opponent)
const CPUPaddle: React.FC<{
  position: { x: number; y: number };
  targetPosition: { x: number; y: number };
  level: number;
  onPositionChange: (x: number, y: number) => void;
}> = ({ position, targetPosition, level, onPositionChange }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // CPU speed increases with level
  const cpuSpeed = CPU_PADDLE_SPEED_BASE + level * 0.02;
  
  useFrame((_, delta) => {
    // Move toward target position (where ball will land)
    const dx = targetPosition.x - position.x;
    const dy = targetPosition.y - position.y;
    
    const halfWidth = TUNNEL_WIDTH / 2 - PADDLE_WIDTH / 2;
    const halfHeight = TUNNEL_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    
    const newX = clamp(position.x + dx * cpuSpeed, -halfWidth, halfWidth);
    const newY = clamp(position.y + dy * cpuSpeed, -halfHeight, halfHeight);
    
    onPositionChange(newX, newY);
    
    if (meshRef.current) {
      meshRef.current.position.set(newX, newY, -TUNNEL_DEPTH);
    }
  });
  
  // Scale paddle smaller to show perspective
  const scale = 0.25;
  
  return (
    <mesh ref={meshRef} position={[0, 0, -TUNNEL_DEPTH]} scale={[scale, scale, 1]}>
      <boxGeometry args={[PADDLE_WIDTH, PADDLE_HEIGHT, 0.2]} />
      <meshStandardMaterial
        color="#ff4466"
        emissive="#ff4466"
        emissiveIntensity={0.4}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
};

// 3D Tunnel/Corridor
const Tunnel: React.FC = () => {
  const tunnelRef = useRef<THREE.Group>(null);
  
  // Create tunnel walls with perspective lines
  const wallColor = '#1a1a2e';
  const lineColor = '#3a3a5e';
  
  return (
    <group ref={tunnelRef}>
      {/* Floor */}
      <mesh position={[0, -TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TUNNEL_WIDTH, TUNNEL_DEPTH]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Ceiling */}
      <mesh position={[0, TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TUNNEL_WIDTH, TUNNEL_DEPTH]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Left wall */}
      <mesh position={[-TUNNEL_WIDTH / 2, 0, -TUNNEL_DEPTH / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[TUNNEL_DEPTH, TUNNEL_HEIGHT]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Right wall */}
      <mesh position={[TUNNEL_WIDTH / 2, 0, -TUNNEL_DEPTH / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[TUNNEL_DEPTH, TUNNEL_HEIGHT]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Perspective grid lines on floor */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={`floor-line-${i}`} position={[0, -TUNNEL_HEIGHT / 2 + 0.01, -i * (TUNNEL_DEPTH / 10)]}>
          <boxGeometry args={[TUNNEL_WIDTH, 0.02, 0.05]} />
          <meshBasicMaterial color={lineColor} />
        </mesh>
      ))}
      
      {/* Vertical lines on walls */}
      {Array.from({ length: 10 }).map((_, i) => (
        <React.Fragment key={`wall-lines-${i}`}>
          <mesh position={[-TUNNEL_WIDTH / 2 + 0.01, 0, -i * (TUNNEL_DEPTH / 10)]}>
            <boxGeometry args={[0.02, TUNNEL_HEIGHT, 0.05]} />
            <meshBasicMaterial color={lineColor} />
          </mesh>
          <mesh position={[TUNNEL_WIDTH / 2 - 0.01, 0, -i * (TUNNEL_DEPTH / 10)]}>
            <boxGeometry args={[0.02, TUNNEL_HEIGHT, 0.05]} />
            <meshBasicMaterial color={lineColor} />
          </mesh>
        </React.Fragment>
      ))}
      
      {/* Back wall (opponent's goal) */}
      <mesh position={[0, 0, -TUNNEL_DEPTH - 0.1]}>
        <planeGeometry args={[TUNNEL_WIDTH, TUNNEL_HEIGHT]} />
        <meshStandardMaterial color="#2a1a3e" emissive="#1a0a2e" emissiveIntensity={0.2} />
      </mesh>
      
      {/* Front frame (player's goal area) */}
      <mesh position={[0, 0, 0.1]}>
        <ringGeometry args={[Math.max(TUNNEL_WIDTH, TUNNEL_HEIGHT) * 0.5, Math.max(TUNNEL_WIDTH, TUNNEL_HEIGHT) * 0.55, 4]} />
        <meshBasicMaterial color="#00aaff" transparent opacity={0.3} />
      </mesh>
    </group>
  );
};

// Space Pong UI Overlay
const SpacePongUI: React.FC<{
  score: number;
  lives: number;
  level: number;
  cpuScore: number;
  gameState: string;
  streak: number;
}> = ({ score, lives, level, cpuScore, gameState, streak }) => {
  return (
    <>
      {/* Player Score (bottom) */}
      <Text
        position={[0, -TUNNEL_HEIGHT / 2 - 0.8, 0]}
        fontSize={0.5}
        color="#00ffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        Player: {score}
      </Text>
      
      {/* CPU Score (top, far) */}
      <Text
        position={[0, TUNNEL_HEIGHT / 2 + 0.5, -TUNNEL_DEPTH]}
        fontSize={0.15}
        color="#ff4466"
        anchorX="center"
        anchorY="middle"
      >
        CPU: {cpuScore}
      </Text>
      
      {/* Lives */}
      <Text
        position={[-TUNNEL_WIDTH / 2 - 0.5, TUNNEL_HEIGHT / 2, 0]}
        fontSize={0.4}
        color="#ff4444"
        anchorX="right"
        anchorY="middle"
      >
        {'❤️'.repeat(lives)}
      </Text>
      
      {/* Level */}
      <Text
        position={[TUNNEL_WIDTH / 2 + 0.5, TUNNEL_HEIGHT / 2, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
      >
        Level {level}
      </Text>
      
      {/* Streak */}
      {streak >= 3 && (
        <Text
          position={[0, 0, 1]}
          fontSize={0.6}
          color="#ffff00"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          {streak}x Streak!
        </Text>
      )}
      
      {/* Game state overlays */}
      {gameState === 'ready' && (
        <Text
          position={[0, 0, -5]}
          fontSize={0.5}
          color="#00ff88"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          Click to Start!
        </Text>
      )}
      
      {gameState === 'levelComplete' && (
        <>
          <Text
            position={[0, 0.5, -5]}
            fontSize={0.6}
            color="#ffff00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            Level Complete!
          </Text>
          <Text
            position={[0, -0.5, -5]}
            fontSize={0.3}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Click to continue
          </Text>
        </>
      )}
      
      {gameState === 'gameOver' && (
        <>
          <Text
            position={[0, 0.5, -5]}
            fontSize={0.7}
            color="#ff4444"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#000000"
          >
            Game Over
          </Text>
          <Text
            position={[0, -0.5, -5]}
            fontSize={0.4}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Final Score: {score}
          </Text>
          <Text
            position={[0, -1.2, -5]}
            fontSize={0.3}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            Press R to restart
          </Text>
        </>
      )}
      
      {gameState === 'victory' && (
        <>
          <Text
            position={[0, 0.8, -5]}
            fontSize={0.8}
            color="#ffff00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            CHAMPION!
          </Text>
          <Text
            position={[0, -0.2, -5]}
            fontSize={0.4}
            color="#00ff88"
            anchorX="center"
            anchorY="middle"
          >
            You beat all 10 levels!
          </Text>
          <Text
            position={[0, -1, -5]}
            fontSize={0.35}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Final Score: {score}
          </Text>
        </>
      )}
    </>
  );
};

// Main Space Pong Game Component
const SpacePongGame: React.FC = () => {
  const { wallMode } = useSnapshot(reactPongState);
  
  // Game state
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'scored' | 'levelComplete' | 'gameOver' | 'victory'>('ready');
  const [playerScore, setPlayerScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [goalsToAdvance, setGoalsToAdvance] = useState(3);
  const [levelGoals, setLevelGoals] = useState(0);
  
  // Ball state
  const [ball, setBall] = useState<SpacePongBallState>({
    x: 0, y: 0, z: TUNNEL_DEPTH / 2,
    vx: 0, vy: 0, vz: 8,
    spinX: 0, spinY: 0, rotation: 0,
  });
  
  // Paddle positions
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [cpuPos, setCpuPos] = useState({ x: 0, y: 0 });
  const prevPlayerPos = useRef({ x: 0, y: 0 });
  
  // Ball speed increases with level
  const baseBallSpeed = 8 + level * 1.5;
  
  // Reset ball to center
  const resetBall = useCallback((direction: 'toPlayer' | 'toCPU') => {
    setBall({
      x: 0, y: 0, z: TUNNEL_DEPTH / 2,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      vz: direction === 'toPlayer' ? -baseBallSpeed : baseBallSpeed,
      spinX: 0, spinY: 0, rotation: 0,
    });
  }, [baseBallSpeed]);
  
  // Handle click to start
  useEffect(() => {
    const handleClick = () => {
      if (gameState === 'ready') {
        setGameState('playing');
        resetBall('toCPU');
      } else if (gameState === 'levelComplete') {
        // Advance to next level
        if (level >= 10) {
          setGameState('victory');
        } else {
          setLevel(l => l + 1);
          setLevelGoals(0);
          setGameState('playing');
          resetBall('toCPU');
        }
      }
    };
    
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [gameState, level, resetBall]);
  
  // Handle keyboard restart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && (gameState === 'gameOver' || gameState === 'victory')) {
        // Reset everything
        setGameState('ready');
        setPlayerScore(0);
        setCpuScore(0);
        setLives(5);
        setLevel(1);
        setStreak(0);
        setLevelGoals(0);
        resetBall('toCPU');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, resetBall]);
  
  // Main game loop
  useFrame((_, delta) => {
    if (gameState !== 'playing') return;
    
    setBall(prevBall => {
      let { x, y, z, vx, vy, vz, spinX, spinY, rotation } = { ...prevBall };
      
      // Apply spin to velocity
      vx += spinX * delta * 2;
      vy += spinY * delta * 2;
      
      // Decay spin
      spinX *= 0.995;
      spinY *= 0.995;
      
      // Update position
      x += vx * delta * 60;
      y += vy * delta * 60;
      z += vz * delta * 60;
      
      // Rotate ball
      rotation += 0.1;
      
      // Wall collisions (bounce off tunnel walls)
      const halfWidth = TUNNEL_WIDTH / 2 - BALL_RADIUS;
      const halfHeight = TUNNEL_HEIGHT / 2 - BALL_RADIUS;
      
      if (x < -halfWidth) { x = -halfWidth; vx = Math.abs(vx); }
      if (x > halfWidth) { x = halfWidth; vx = -Math.abs(vx); }
      if (y < -halfHeight) { y = -halfHeight; vy = Math.abs(vy); }
      if (y > halfHeight) { y = halfHeight; vy = -Math.abs(vy); }
      
      // Player paddle collision (z near 0)
      if (z <= BALL_RADIUS && vz < 0) {
        // Check if ball hits paddle
        const paddleHalfW = PADDLE_WIDTH / 2;
        const paddleHalfH = PADDLE_HEIGHT / 2;
        
        if (x >= playerPos.x - paddleHalfW && x <= playerPos.x + paddleHalfW &&
            y >= playerPos.y - paddleHalfH && y <= playerPos.y + paddleHalfH) {
          // Hit! Calculate spin from paddle movement
          const paddleVelX = playerPos.x - prevPlayerPos.current.x;
          const paddleVelY = playerPos.y - prevPlayerPos.current.y;
          
          spinX = paddleVelX * 0.5;
          spinY = paddleVelY * 0.5;
          
          // Reverse and speed up slightly
          vz = Math.abs(vz) * 1.02;
          z = BALL_RADIUS;
          
          // Add some velocity based on where ball hit paddle
          vx += (x - playerPos.x) * 0.3;
          vy += (y - playerPos.y) * 0.3;
          
          // Increase streak
          setStreak(s => s + 1);
          
          // Play sound
          const sound = reactPongState.audio.paddleHitSound;
          if (sound) {
            try { sound.currentTime = 0; sound.volume = 0.5; sound.play().catch(() => {}); } catch {}
          }
        } else {
          // Player missed - CPU scores
          setCpuScore(s => s + 1);
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              setGameState('gameOver');
            }
            return newLives;
          });
          setStreak(0);
          
          // Reset ball
          setTimeout(() => {
            if (lives > 1) resetBall('toPlayer');
          }, 500);
          
          return { x: 0, y: 0, z: TUNNEL_DEPTH / 2, vx: 0, vy: 0, vz: 0, spinX: 0, spinY: 0, rotation: 0 };
        }
      }
      
      // CPU paddle collision (z near TUNNEL_DEPTH)
      if (z >= TUNNEL_DEPTH - BALL_RADIUS && vz > 0) {
        // Check if ball hits CPU paddle
        const cpuPaddleHalfW = PADDLE_WIDTH / 2;
        const cpuPaddleHalfH = PADDLE_HEIGHT / 2;
        
        if (x >= cpuPos.x - cpuPaddleHalfW && x <= cpuPos.x + cpuPaddleHalfW &&
            y >= cpuPos.y - cpuPaddleHalfH && y <= cpuPos.y + cpuPaddleHalfH) {
          // CPU hit - bounce back
          vz = -Math.abs(vz);
          z = TUNNEL_DEPTH - BALL_RADIUS;
          
          // CPU adds some random spin
          spinX += (Math.random() - 0.5) * 0.3;
          spinY += (Math.random() - 0.5) * 0.3;
          
          // Play sound
          const sound = reactPongState.audio.wallHitSound;
          if (sound) {
            try { sound.currentTime = 0; sound.volume = 0.4; sound.play().catch(() => {}); } catch {}
          }
        } else {
          // CPU missed - Player scores!
          setPlayerScore(s => s + 10 * (streak + 1));
          setLevelGoals(g => {
            const newGoals = g + 1;
            if (newGoals >= goalsToAdvance) {
              if (level >= 10) {
                setGameState('victory');
              } else {
                setGameState('levelComplete');
              }
            }
            return newGoals;
          });
          
          // Play score sound
          const sound = reactPongState.audio.scoreBonusSound;
          if (sound) {
            try { sound.currentTime = 0; sound.play().catch(() => {}); } catch {}
          }
          
          // Reset ball
          setTimeout(() => resetBall('toCPU'), 500);
          
          return { x: 0, y: 0, z: TUNNEL_DEPTH / 2, vx: 0, vy: 0, vz: 0, spinX: 0, spinY: 0, rotation: 0 };
        }
      }
      
      return { x, y, z, vx, vy, vz, spinX, spinY, rotation };
    });
  });
  
  // Calculate CPU target (predict where ball will land)
  const cpuTarget = useMemo(() => {
    if (ball.vz <= 0) return { x: 0, y: 0 }; // Ball moving away from CPU
    
    const timeToReach = (TUNNEL_DEPTH - ball.z) / ball.vz;
    return {
      x: ball.x + ball.vx * timeToReach,
      y: ball.y + ball.vy * timeToReach,
    };
  }, [ball]);
  
  return (
    <>
      {/* Tunnel */}
      <Tunnel />
      
      {/* Ball */}
      <SpacePongBall ballState={ball} maxZ={TUNNEL_DEPTH} />
      
      {/* Ball trackers */}
      <BallTracker ballState={ball} maxZ={TUNNEL_DEPTH} showPlayerSide={true} />
      <BallTracker ballState={ball} maxZ={TUNNEL_DEPTH} showPlayerSide={false} />
      
      {/* Player paddle */}
      <PlayerPaddle 
        position={playerPos} 
        onPositionChange={(x, y) => setPlayerPos({ x, y })}
        prevPosition={prevPlayerPos}
      />
      
      {/* CPU paddle */}
      <CPUPaddle
        position={cpuPos}
        targetPosition={cpuTarget}
        level={level}
        onPositionChange={(x, y) => setCpuPos({ x, y })}
      />
      
      {/* UI */}
      <SpacePongUI
        score={playerScore}
        lives={lives}
        level={level}
        cpuScore={cpuScore}
        gameState={gameState}
        streak={streak}
      />
      
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 5]} intensity={1} color="#00aaff" />
      <pointLight position={[0, 0, -TUNNEL_DEPTH + 5]} intensity={0.5} color="#ff4466" />
    </>
  );
};

// Space Pong Camera Setup
const SpacePongCameraSetup: React.FC = () => {
  const { camera, scene } = useThree();
  
  useEffect(() => {
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, -TUNNEL_DEPTH / 2);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 60;
      (camera as THREE.PerspectiveCamera).near = 0.1;
      (camera as THREE.PerspectiveCamera).far = 1000;
      camera.updateProjectionMatrix();
    }
    scene.background = new THREE.Color('#050510');
  }, [camera, scene]);
  
  return null;
};
// ═══════════════════════════════════════════════════════════════════════════
// WALL MODE (CURVE CATCH 3D) COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const WALL_MODE_WIDTH = 16;
const WALL_MODE_HEIGHT = 10;
const WALL_MODE_DEPTH = 18;
const WALL_MODE_WALL_Z = -WALL_MODE_DEPTH / 2;
const WALL_MODE_PLAYER_Z = WALL_MODE_DEPTH / 2 - 1;
const WALL_MODE_BALL_OFFSET = 0.8;

interface WallModePaddleProps {
  ballRef: React.MutableRefObject<RapierRigidBody | null>;
  scoreColor: string;
  shotSpinRef: React.MutableRefObject<{ x: number; y: number }>;
}

const WallModePaddle: React.FC<WallModePaddleProps> = ({ ballRef, scoreColor, shotSpinRef }) => {
  const paddleApi = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const captureGlowRef = useRef<THREE.Mesh>(null);
  const pointerDown = useRef(false);
  const rightClickDown = useRef(false);
  const paddlePos = useRef({ x: 0, y: 0 });
  const prevPos = useRef({ x: 0, y: 0 });

  const vec = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const quaternion = useRef(new THREE.Quaternion());
  const euler = useRef(new THREE.Euler());

  const { wallMode, comboText, comboColor } = useSnapshot(reactPongState);

  const widenMultiplier = reactPongState.hasPowerup('widen') ? 1.4 : 1;
  const baseCaptureSize = wallMode.currentLevelConfig.captureZoneSize;
  const actualCaptureSize = baseCaptureSize * widenMultiplier;
  const actualCaptureHeight = baseCaptureSize * 0.6 * widenMultiplier;

  const launchBall = useCallback(() => {
    if (!ballRef.current) return;
    reactPongState.wallMode.gameState = 'playing';
    const jitterX = (Math.random() - 0.5) * 0.2;
    const jitterY = (Math.random() - 0.5) * 0.2;
    const direction = new THREE.Vector3(jitterX, jitterY, -1).normalize();
    const speed = reactPongState.wallMode.currentSpeed;

    ballRef.current.setTranslation({ x: 0, y: 0, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET }, true);
    ballRef.current.setLinvel(
      { x: direction.x * speed, y: direction.y * speed, z: direction.z * speed },
      true
    );
  }, [ballRef]);

  const releaseBall = useCallback(() => {
    if (!ballRef.current) return;

    const release = reactPongState.wallModeReleaseBall();
    const paddleXY = paddlePos.current;
    const aimX = clamp(paddleXY.x / (WALL_MODE_WIDTH / 2), -1, 1);
    const aimY = clamp(paddleXY.y / (WALL_MODE_HEIGHT / 2), -1, 1);

    const velocity = reactPongState.wallMode.lastPaddleVelocity;
    const spinBoost = reactPongState.hasPowerup('curveBoost') ? 1.6 : 1;
    const spinX = clamp(velocity.x * 0.02, -1, 1) * spinBoost;
    const spinY = clamp(velocity.y * 0.02, -1, 1) * spinBoost;

    if (reactPongState.hasPowerup('curveBoost')) {
      reactPongState.usePowerup('curveBoost');
    }

    shotSpinRef.current = { x: spinX * 0.8, y: spinY * 0.8 };

    const direction = new THREE.Vector3(
      aimX * 0.6 + spinX * 0.6,
      aimY * 0.6 + spinY * 0.6,
      -1
    ).normalize();

    ballRef.current.setTranslation(
      { x: paddleXY.x, y: paddleXY.y, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET },
      true
    );
    ballRef.current.setLinvel(
      {
        x: direction.x * release.speed,
        y: direction.y * release.speed,
        z: direction.z * release.speed,
      },
      true
    );
    ballRef.current.setAngvel({ x: -spinY * 6, y: spinX * 6, z: 0 }, true);
  }, [ballRef, shotSpinRef]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        rightClickDown.current = true;
        return;
      }
      pointerDown.current = true;

      if (reactPongState.wallMode.gameState === 'ready') {
        launchBall();
      } else if (reactPongState.wallMode.gameState === 'levelComplete') {
        reactPongState.advanceWallModeLevel();
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 2) {
        rightClickDown.current = false;
        return;
      }
      pointerDown.current = false;

      if (reactPongState.wallMode.isBallCaptured) {
        releaseBall();
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        reactPongState.wallMode.stabilizeMode = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        reactPongState.wallMode.stabilizeMode = false;
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [launchBall, releaseBall]);

  useFrame((state, delta) => {
    const sensitivity = wallMode.stabilizeMode ? 0.6 : 1;
    vec.current.set(state.pointer.x * sensitivity, state.pointer.y * sensitivity, 0.5).unproject(state.camera);
    dir.current.copy(vec.current).sub(state.camera.position).normalize();

    if (Math.abs(dir.current.z) < 0.001) return;
    const distance = (WALL_MODE_PLAYER_Z - state.camera.position.z) / dir.current.z;
    const target = state.camera.position.clone().add(dir.current.multiplyScalar(distance));

    const halfWidth = WALL_MODE_WIDTH / 2 - actualCaptureSize / 2;
    const halfHeight = WALL_MODE_HEIGHT / 2 - actualCaptureHeight / 2;
    const clampedX = clamp(target.x, -halfWidth, halfWidth);
    const clampedY = clamp(target.y, -halfHeight, halfHeight);

    const velX = (clampedX - prevPos.current.x) / Math.max(delta, 0.001);
    const velY = (clampedY - prevPos.current.y) / Math.max(delta, 0.001);
    reactPongState.wallMode.lastPaddleVelocity = { x: velX, y: velY };
    reactPongState.wallMode.spinIntensity = clamp((velX + velY) * 0.005, -1, 1);

    prevPos.current = { x: clampedX, y: clampedY };
    paddlePos.current = { x: clampedX, y: clampedY };

    let tiltAngle = 0;
    if (rightClickDown.current) {
      tiltAngle = state.pointer.x * 0.3;
    }

    paddleApi.current?.setNextKinematicTranslation({ x: clampedX, y: clampedY, z: WALL_MODE_PLAYER_Z });

    euler.current.set(0, 0, tiltAngle);
    quaternion.current.setFromEuler(euler.current);
    paddleApi.current?.setNextKinematicRotation({
      x: quaternion.current.x,
      y: quaternion.current.y,
      z: quaternion.current.z,
      w: quaternion.current.w,
    });

    // Update charge while holding captured ball
    if (wallMode.isBallCaptured && pointerDown.current) {
      const holdTime = (Date.now() - wallMode.captureStartTime) / 1000;
      reactPongState.wallMode.chargeAmount = Math.min(1, holdTime / 1.5);
    }

    // Auto-release after hold time
    if (wallMode.isBallCaptured && !pointerDown.current) {
      const holdTime = (Date.now() - wallMode.captureStartTime) / 1000;
      if (holdTime >= wallMode.captureHoldTime) {
        releaseBall();
      }
    }

    // Move captured ball with paddle
    if (wallMode.isBallCaptured && ballRef.current) {
      ballRef.current.setTranslation(
        { x: clampedX, y: clampedY, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET },
        true
      );
      ballRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    // Update powerups
    reactPongState.updatePowerups(delta);

    // Capture glow effect
    if (captureGlowRef.current) {
      const material = captureGlowRef.current.material as THREE.MeshBasicMaterial;
      if (wallMode.isBallCaptured) {
        material.opacity = 0.3 + wallMode.chargeAmount * 0.4;
        const hue = wallMode.chargeAmount * 0.1;
        material.color.setHSL(hue, 1, 0.5);
      } else {
        material.opacity = 0.15 + Math.sin(Date.now() / 200) * 0.05;
        material.color.set(scoreColor);
      }
    }

    // Apply screen shake
    const shake = reactPongState.screenShake;
    if (shake > 0) {
      state.camera.position.x += (Math.random() - 0.5) * shake;
      state.camera.position.y += (Math.random() - 0.5) * shake;
      reactPongState.screenShake *= 0.9;
      if (reactPongState.screenShake < 0.01) reactPongState.screenShake = 0;
    }

    // Camera follow
    easing.damp3(
      state.camera.position,
      [-state.pointer.x * 2.5, -state.pointer.y * 1.5, 18],
      0.3,
      delta
    );
    state.camera.lookAt(0, 0, 0);
  });

  const handleCapture = useCallback((payload: { totalForceMagnitude: number }) => {
    if (payload.totalForceMagnitude > 150 && !reactPongState.wallMode.isBallCaptured) {
      const paddlePosition = paddleApi.current?.translation();
      const ballPosition = ballRef.current?.translation();
      const ballVelocity = ballRef.current?.linvel();
      if (!paddlePosition || !ballPosition || !ballVelocity) return;
      if (ballVelocity.z <= 0) return;
      if (ballPosition.z < WALL_MODE_PLAYER_Z - 1) return;

      const distX = Math.abs(ballPosition.x - paddlePosition.x);
      const distY = Math.abs(ballPosition.y - paddlePosition.y);
      const distFromCenter = Math.hypot(distX, distY);
      const isPerfect = distFromCenter < actualCaptureSize * 0.2;

      const hasMagnet = reactPongState.hasPowerup('magnet');
      const effectiveWidth = hasMagnet ? actualCaptureSize * 1.4 : actualCaptureSize;
      const effectiveHeight = hasMagnet ? actualCaptureHeight * 1.4 : actualCaptureHeight;

      if (distX <= effectiveWidth / 2 && distY <= effectiveHeight / 2) {
        reactPongState.wallMode.lastCatchWasPerfect = isPerfect;
        reactPongState.wallModeCaptureBall();

        if (hasMagnet) {
          reactPongState.usePowerup('magnet');
        }

        const sound = reactPongState.audio.paddleHitSound;
        if (sound) {
          try {
            sound.currentTime = 0;
            sound.volume = 0.5;
            sound.play().catch(() => {});
          } catch {}
        }

        reactPongState.addHitEffect(
          [ballPosition.x, ballPosition.y, ballPosition.z],
          isPerfect ? '#ffff00' : scoreColor,
          isPerfect ? 2 : 1
        );
      }
    }
  }, [actualCaptureHeight, actualCaptureSize, ballRef, scoreColor]);

  return (
    <RigidBody
      ref={paddleApi}
      ccd
      canSleep={false}
      type="kinematicPosition"
      colliders={false}
      onContactForce={handleCapture}
    >
      {/* Main paddle collider - plane-like */}
      <CuboidCollider args={[actualCaptureSize / 2, actualCaptureHeight / 2, 0.2]} />

      {/* Visual paddle representation */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[actualCaptureSize, actualCaptureHeight, 0.4]} />
        <meshStandardMaterial
          color={scoreColor}
          emissive={scoreColor}
          emissiveIntensity={wallMode.isBallCaptured ? 0.8 : 0.3}
          metalness={0.5}
          roughness={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Capture zone glow indicator */}
      <mesh ref={captureGlowRef} position={[0, 0, 0.4]}>
        <boxGeometry args={[actualCaptureSize + 0.5, actualCaptureHeight + 0.5, 0.2]} />
        <meshBasicMaterial color={scoreColor} transparent opacity={0.15} />
      </mesh>

      {/* Spin indicator */}
      {Math.abs(wallMode.spinIntensity) > 0.2 && (
        <mesh position={[wallMode.spinIntensity * 2, 0.5, 0.2]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color={wallMode.spinIntensity > 0 ? '#ff4400' : '#0044ff'} />
        </mesh>
      )}

      {/* Charge indicator */}
      {wallMode.isBallCaptured && wallMode.chargeAmount > 0 && (
        <mesh position={[0, actualCaptureHeight * 0.8, 0]} scale={[wallMode.chargeAmount * 2 + 0.5, 0.1, 0.3]}>
          <boxGeometry args={[actualCaptureSize, 0.2, 0.5]} />
          <meshBasicMaterial
            color={new THREE.Color().setHSL(wallMode.chargeAmount * 0.1, 1, 0.5)}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Streak display */}
      <Text
        anchorX="center"
        anchorY="middle"
        position={[0, actualCaptureHeight * 0.9 + 0.6, 0]}
        fontSize={0.6}
        color={comboColor || scoreColor}
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {wallMode.levelStreak}/{wallMode.currentLevelConfig.streakGoal}
      </Text>

      {comboText && (
        <Text
          anchorX="center"
          anchorY="middle"
          position={[0, actualCaptureHeight * 0.9 + 1.4, 0]}
          fontSize={0.8}
          color={comboColor}
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {comboText}
        </Text>
      )}

      {/* Paddle glow light */}
      <pointLight color={scoreColor} intensity={wallMode.isBallCaptured ? 1.5 : 0.6} distance={6} />
    </RigidBody>
  );
};

// Opposing Wall Component
interface OpposingWallProps {
  ballRef: React.MutableRefObject<RapierRigidBody | null>;
}

const OpposingWall: React.FC<OpposingWallProps> = ({ ballRef }) => {
  const { wallMode } = useSnapshot(reactPongState);
  const config = wallMode.currentLevelConfig;
  const zones = wallMode.wallZones;
  
  const wallWidth = WALL_MODE_WIDTH;
  const wallHeight = WALL_MODE_HEIGHT;
  const wallZ = WALL_MODE_WALL_Z;
  const wallThickness = 0.6;
  
  const movingPanelRefs = useRef<THREE.Mesh[]>([]);
  
  useFrame(({ clock }) => {
    // Animate moving panels
    if (config.hasMovingPanels) {
      movingPanelRefs.current.forEach((panel, i) => {
        if (panel) {
          const speed = 0.5 + i * 0.2;
          const amplitude = 2 + i;
          panel.position.x = Math.sin(clock.getElapsedTime() * speed) * amplitude;
        }
      });
    }
  });

  const handleWallHit = useCallback(() => {
    const ballPos = ballRef.current?.translation();
    const ballVel = ballRef.current?.linvel();
    if (!ballPos || !ballVel) return;

    // Check which zone was hit
    let hitZone: WallZone | undefined;
    for (const zone of zones) {
      const dx = Math.abs(ballPos.x - zone.position[0]);
      const dy = Math.abs(ballPos.y - zone.position[1]);
      if (dx < zone.size[0] / 2 && dy < zone.size[1] / 2) {
        hitZone = zone;
        break;
      }
    }

    // Apply zone effects
    let newVelX = ballVel.x;
    let newVelY = ballVel.y;
    let newVelZ = Math.abs(ballVel.z);
    let speedScale = 1;

    if (hitZone) {
      switch (hitZone.type) {
        case 'speed':
          speedScale = hitZone.effect;
          break;
        case 'spin':
          ballRef.current?.setAngvel({ x: hitZone.effect * 4, y: 0, z: hitZone.effect * 6 }, true);
          newVelX += (Math.random() - 0.5) * hitZone.effect * 2;
          newVelY += (Math.random() - 0.5) * hitZone.effect * 2;
          break;
        case 'bounce':
          newVelX *= hitZone.effect;
          newVelY *= hitZone.effect;
          break;
        case 'hazard': {
          const angle = (Math.random() - 0.5) * Math.PI * 0.7;
          const speed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y + ballVel.z * ballVel.z);
          newVelX = Math.sin(angle) * speed * 0.6;
          newVelY = Math.cos(angle) * speed * 0.6;
          break;
        }
        case 'target':
          // Bonus points handled in state
          break;
      }
    }

    // Register hit
    const result = reactPongState.wallModeHitWall(hitZone?.type, reactPongState.wallMode.lastCatchWasPerfect);
    const targetSpeed = Math.min(
      reactPongState.wallMode.maxSpeed,
      reactPongState.wallMode.currentSpeed * speedScale
    );
    const direction = new THREE.Vector3(newVelX, newVelY, newVelZ).normalize();
    ballRef.current?.setLinvel(
      {
        x: direction.x * targetSpeed,
        y: direction.y * targetSpeed,
        z: direction.z * targetSpeed,
      },
      true
    );
    
    // Add visual feedback
    if (ballPos) {
      reactPongState.addScorePopup(
        result.score,
        [ballPos.x, ballPos.y, ballPos.z],
        hitZone?.type === 'target' ? '#ffff00' : hitZone?.type === 'hazard' ? '#ff0000' : '#00d4ff',
        result.combo.name || undefined
      );
      reactPongState.addHitEffect(
        [ballPos.x, ballPos.y, ballPos.z],
        hitZone?.type === 'target' ? '#ffff00' : '#4080ff',
        1
      );
    }

    // Play sound
    const sound = reactPongState.audio.wallHitSound;
    if (sound) {
      try {
        sound.currentTime = 0;
        sound.volume = 0.6;
        sound.play().catch(() => {});
      } catch {}
    }
  }, [zones, ballRef]);

  const getZoneColor = (type: string) => {
    switch (type) {
      case 'speed': return '#ff8800';
      case 'spin': return '#00ff88';
      case 'bounce': return '#8800ff';
      case 'target': return '#ffff00';
      case 'hazard': return '#ff0044';
      default: return '#4080ff';
    }
  };

  return (
    <>
      {/* Main wall */}
      <RigidBody
        type="fixed"
        position={[0, 0, wallZ]}
        onCollisionEnter={handleWallHit}
      >
        <CuboidCollider args={[wallWidth / 2, wallHeight / 2, wallThickness / 2]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[wallWidth, wallHeight, wallThickness]} />
          <meshStandardMaterial 
            color="#4080ff" 
            emissive="#4080ff" 
            emissiveIntensity={0.4} 
            transparent 
            opacity={0.7}
          />
        </mesh>
      </RigidBody>

      {/* Wall zones */}
      {zones.map((zone) => (
        <mesh
          key={zone.id}
          position={[zone.position[0], zone.position[1], wallZ + wallThickness / 2 + 0.05]}
        >
          <boxGeometry args={[zone.size[0], zone.size[1], 0.2]} />
          <meshStandardMaterial
            color={getZoneColor(zone.type)}
            emissive={getZoneColor(zone.type)}
            emissiveIntensity={zone.type === 'target' ? 0.8 : 0.5}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}

      {/* Zone labels */}
      {zones.filter(z => z.type !== 'hazard').map((zone) => (
        <Text
          key={`label-${zone.id}`}
          position={[zone.position[0], zone.position[1], wallZ + wallThickness / 2 + 0.2]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {zone.type.toUpperCase()}
        </Text>
      ))}

      {/* Moving panels (advanced levels) */}
      {config.hasMovingPanels && (
        <>
          <mesh
            ref={(el) => { if (el) movingPanelRefs.current[0] = el; }}
            position={[0, -wallHeight / 4, wallZ + wallThickness / 2 + 0.2]}
          >
            <boxGeometry args={[3, 0.5, 0.3]} />
            <meshStandardMaterial color="#ff4080" emissive="#ff4080" emissiveIntensity={0.5} />
          </mesh>
          <mesh
            ref={(el) => { if (el) movingPanelRefs.current[1] = el; }}
            position={[0, -wallHeight / 2 + 1.2, wallZ + wallThickness / 2 + 0.2]}
          >
            <boxGeometry args={[2.5, 0.5, 0.3]} />
            <meshStandardMaterial color="#40ff80" emissive="#40ff80" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}

      {/* Wall glow */}
      <pointLight position={[0, 0, wallZ + 2]} color="#4080ff" intensity={0.6} distance={15} />
    </>
  );
};

// Wall Mode Bounds (arena box without player-facing wall)
const WallModeBounds: React.FC = () => {
  const halfWidth = WALL_MODE_WIDTH / 2;
  const halfHeight = WALL_MODE_HEIGHT / 2;
  const halfDepth = WALL_MODE_DEPTH / 2;
  const wallThickness = 0.5;

  return (
    <>
      {/* Left wall */}
      <RigidBody type="fixed" position={[-halfWidth - wallThickness / 2, 0, 0]}>
        <CuboidCollider args={[wallThickness / 2, halfHeight, halfDepth]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[wallThickness, WALL_MODE_HEIGHT, WALL_MODE_DEPTH]} />
          <meshStandardMaterial color="#8040ff" emissive="#402070" emissiveIntensity={0.4} transparent opacity={0.6} />
        </mesh>
      </RigidBody>

      {/* Right wall */}
      <RigidBody type="fixed" position={[halfWidth + wallThickness / 2, 0, 0]}>
        <CuboidCollider args={[wallThickness / 2, halfHeight, halfDepth]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[wallThickness, WALL_MODE_HEIGHT, WALL_MODE_DEPTH]} />
          <meshStandardMaterial color="#8040ff" emissive="#402070" emissiveIntensity={0.4} transparent opacity={0.6} />
        </mesh>
      </RigidBody>

      {/* Ceiling */}
      <RigidBody type="fixed" position={[0, halfHeight + wallThickness / 2, 0]}>
        <CuboidCollider args={[halfWidth, wallThickness / 2, halfDepth]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[WALL_MODE_WIDTH, wallThickness, WALL_MODE_DEPTH]} />
          <meshStandardMaterial color="#4080ff" emissive="#204080" emissiveIntensity={0.3} transparent opacity={0.5} />
        </mesh>
      </RigidBody>

      {/* Floor */}
      <RigidBody type="fixed" position={[0, -halfHeight - wallThickness / 2, 0]}>
        <CuboidCollider args={[halfWidth, wallThickness / 2, halfDepth]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[WALL_MODE_WIDTH, wallThickness, WALL_MODE_DEPTH]} />
          <meshStandardMaterial color="#4080ff" emissive="#204080" emissiveIntensity={0.3} transparent opacity={0.5} />
        </mesh>
      </RigidBody>

      {/* Player side frame (open wall) */}
      <mesh position={[0, 0, WALL_MODE_PLAYER_Z + 0.2]}>
        <boxGeometry args={[WALL_MODE_WIDTH + 0.8, WALL_MODE_HEIGHT + 0.8, 0.1]} />
        <meshBasicMaterial color="#00aaff" transparent opacity={0.15} wireframe />
      </mesh>
    </>
  );
};

// Wall Mode Ball Component
interface WallModeBallProps {
  position: [number, number, number];
  ballColor: string;
  shotSpinRef: React.MutableRefObject<{ x: number; y: number }>;
  onBodyReady?: (body: RapierRigidBody | null) => void;
}

const WallModeBall: React.FC<WallModeBallProps> = ({ position, ballColor, shotSpinRef, onBodyReady }) => {
  const api = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const frameCount = useRef(0);
  const { wallMode } = useSnapshot(reactPongState);

  const handleMiss = useCallback(() => {
    // Check for shield powerup
    if (reactPongState.hasPowerup('shield')) {
      reactPongState.usePowerup('shield');
      // Bounce ball back up
      if (api.current) {
        const vel = api.current.linvel();
        api.current.setLinvel({ x: vel.x, y: vel.y, z: -Math.abs(vel.z) }, true);
      }
      return;
    }
    
    reactPongState.wallModeMiss();
    
    // Reset ball position
    if (api.current) {
      api.current.setTranslation({ x: 0, y: 0, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET }, true);
      api.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      api.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, []);

  useEffect(() => {
    if (onBodyReady) onBodyReady(api.current);
  }, [onBodyReady]);

  useFrame((_, delta) => {
    if (!api.current) return;

    frameCount.current++;

    // Initial position setup
    if (frameCount.current < 5) {
      api.current.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
      api.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const vel = api.current.linvel();
    const pos = api.current.translation();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    // Apply slow-mo powerup
    const hasSlowMo = reactPongState.hasPowerup('slowmo');
    if (hasSlowMo && speed > 5) {
      const slowFactor = 0.5;
      api.current.setLinvel({ x: vel.x * slowFactor, y: vel.y * slowFactor, z: vel.z * slowFactor }, true);
    }

    // Cap max speed
    const maxSpeed = wallMode.maxSpeed;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      api.current.setLinvel({ x: vel.x * scale, y: vel.y * scale, z: vel.z * scale }, true);
    }

    // Apply curve from shot spin
    if (wallMode.gameState === 'playing' && !wallMode.isBallCaptured) {
      const spin = shotSpinRef.current;
      if (Math.abs(spin.x) > 0.001 || Math.abs(spin.y) > 0.001) {
        api.current.setLinvel(
          {
            x: vel.x + spin.x * delta * 15,
            y: vel.y + spin.y * delta * 15,
            z: vel.z,
          },
          true
        );
        shotSpinRef.current = { x: spin.x * 0.985, y: spin.y * 0.985 };
      }
    }

    // Check for miss (ball passes player side)
    if (pos.z > WALL_MODE_PLAYER_Z + 2 && wallMode.gameState === 'playing') {
      handleMiss();
    }

    // Visual feedback - glow based on speed
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + (speed / maxSpeed) * 0.7;
    }
  });

  return (
    <>
      <RigidBody
        ref={api}
        type="dynamic"
        ccd
        angularDamping={0.5}
        linearDamping={0}
        restitution={1}
        friction={0}
        canSleep={false}
        colliders={false}
        enabledTranslations={[true, true, true]}
        enabledRotations={[true, true, true]}
        gravityScale={0} // No gravity - controlled manually
      >
        <BallCollider args={[0.5]} restitution={1} friction={0} />
        <mesh ref={meshRef} castShadow receiveShadow>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial
            color={ballColor}
            emissive={ballColor}
            emissiveIntensity={0.5}
            metalness={0.3}
            roughness={0.2}
          />
        </mesh>
        <pointLight color={ballColor} intensity={1} distance={8} />
      </RigidBody>
    </>
  );
};

// Powerup Component
interface PowerupProps {
  type: PowerupType;
  position: [number, number, number];
  onCollect: () => void;
}

const Powerup: React.FC<PowerupProps> = ({ type, position, onCollect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const getColor = () => {
    switch (type) {
      case 'slowmo': return '#00ffff';
      case 'widen': return '#ff00ff';
      case 'magnet': return '#ffff00';
      case 'shield': return '#00ff00';
      case 'curveBoost': return '#ff8800';
      default: return '#ffffff';
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'slowmo': return 'SLOW';
      case 'widen': return 'WIDE';
      case 'magnet': return 'MAG';
      case 'shield': return 'SHLD';
      case 'curveBoost': return 'SPIN';
      default: return '?';
    }
  };

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 2;
      meshRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 3) * 0.3;
    }
  });

  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false} sensor onIntersectionEnter={onCollect}>
        <BallCollider args={[0.8]} sensor />
      </RigidBody>
      
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.6]} />
        <meshStandardMaterial
          color={getColor()}
          emissive={getColor()}
          emissiveIntensity={0.6}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      <Text
        position={[0, -1, 0]}
        fontSize={0.3}
        color={getColor()}
        anchorX="center"
        anchorY="middle"
      >
        {getLabel()}
      </Text>
      
      <pointLight color={getColor()} intensity={0.5} distance={4} />
    </group>
  );
};

// Wall Mode UI Overlay
const WallModeUI: React.FC = () => {
  const { wallMode, score, highScore } = useSnapshot(reactPongState);
  const instructionsText = `Curve Catch 3D Instructions
Click your plane-paddle to launch the ball at the opposing wall. Move your mouse to control the plane and catch the ball when it rebounds back. After you capture it, release it back toward the wall to keep the rally alive.

Every hit makes the ball faster, so the longer you survive, the harder it gets. Flick your paddle right before catching to add spin - but watch out: spin will change the rebound angle and can bait you into missing.

Clear each stage by reaching the required streak or score. You only get 5 lives to finish the whole run. Each level adds tougher wall patterns, faster pacing, and more unpredictable returns. Can you conquer all wall challenges and become the Curve Catch 3D champion?`;
  const tipsText = `Strategy Tips
Stop tracking the ball late. Track its trajectory early. The moment it hits the wall, your job is predicting the rebound lane, not staring at the ball.

Catch slightly early, not late. Your plane is a partial wall - meet the ball instead of chasing it.

Use "soft catches" (minimal movement at contact) to stabilize returns when speed gets insane.

Only add heavy spin when you're in control. Spin is a weapon and a trap.`;
  
  return (
    <>
      {/* Lives display */}
      <Text
        position={[-7, 6, 0]}
        fontSize={0.5}
        color="#ff4444"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {'❤️'.repeat(wallMode.lives)}
      </Text>
      
      {/* Level display */}
      <Text
        position={[0, 10, 0]}
        fontSize={0.6}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        Level {wallMode.currentLevel} / 10
      </Text>
      
      {/* Score display */}
      <Text
        position={[7, 6, 0]}
        fontSize={0.5}
        color="#00d4ff"
        anchorX="right"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        Score: {score}
      </Text>
      
      {/* High score */}
      <Text
        position={[7, 5, 0]}
        fontSize={0.3}
        color="#888888"
        anchorX="right"
        anchorY="middle"
      >
        Best: {highScore}
      </Text>
      
      {/* Speed indicator */}
      <Text
        position={[-7, 5, 0]}
        fontSize={0.3}
        color="#ffaa00"
        anchorX="left"
        anchorY="middle"
      >
        Speed: {wallMode.currentSpeed.toFixed(1)}
      </Text>

      {/* Active powerups */}
      {wallMode.activePowerups.map((p, i) => (
        <Text
          key={`powerup-${i}`}
          position={[-7 + i * 1.5, 4, 0]}
          fontSize={0.3}
          color={p.type === 'slowmo' ? '#00ffff' : p.type === 'shield' ? '#00ff00' : '#ff00ff'}
          anchorX="left"
          anchorY="middle"
        >
          {p.type.toUpperCase()}{p.remainingTime ? ` ${p.remainingTime.toFixed(1)}s` : p.remainingUses ? ` x${p.remainingUses}` : ''}
        </Text>
      ))}

      {/* Game state overlays */}
      {wallMode.gameState === 'ready' && (
        <>
          <Text
            position={[0, 2, 0]}
            fontSize={0.8}
            color="#00ff88"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#000000"
          >
            Click to Launch!
          </Text>
          <Text
            position={[0, 0.5, 0]}
            fontSize={0.35}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
            maxWidth={12}
          >
            Reach {wallMode.currentLevelConfig.streakGoal} returns to advance
          </Text>
          <Text
            position={[0, -2.2, 0]}
            fontSize={0.2}
            color="#cccccc"
            anchorX="center"
            anchorY="middle"
            maxWidth={14}
          >
            {instructionsText}
          </Text>
          <Text
            position={[0, -6.5, 0]}
            fontSize={0.18}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
            maxWidth={14}
          >
            {tipsText}
          </Text>
        </>
      )}

      {wallMode.gameState === 'levelComplete' && (
        <>
          <Text
            position={[0, 2, 0]}
            fontSize={1}
            color="#ffff00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            Level Complete!
          </Text>
          <Text
            position={[0, 0, 0]}
            fontSize={0.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Click to continue
          </Text>
        </>
      )}

      {wallMode.gameState === 'gameOver' && (
        <>
          <Text
            position={[0, 2, 0]}
            fontSize={1}
            color="#ff4444"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            Game Over
          </Text>
          <Text
            position={[0, 0, 0]}
            fontSize={0.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Final Score: {score}
          </Text>
          <Text
            position={[0, -1.5, 0]}
            fontSize={0.4}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            Press R to restart
          </Text>
        </>
      )}

      {wallMode.gameState === 'victory' && (
        <>
          <Text
            position={[0, 3, 0]}
            fontSize={1.2}
            color="#ffff00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.06}
            outlineColor="#000000"
          >
            CHAMPION!
          </Text>
          <Text
            position={[0, 1, 0]}
            fontSize={0.6}
            color="#00ff88"
            anchorX="center"
            anchorY="middle"
          >
            You conquered all 10 walls!
          </Text>
          <Text
            position={[0, -0.5, 0]}
            fontSize={0.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Final Score: {score}
          </Text>
          <Text
            position={[0, -2, 0]}
            fontSize={0.4}
            color="#aaaaaa"
            anchorX="center"
            anchorY="middle"
          >
            Press R to restart
          </Text>
        </>
      )}
    </>
  );
};

// Wall Mode Arena (complete setup)
interface WallModeArenaProps {
  scoreColor: string;
  ballColor: string;
}

const WallModeArena: React.FC<WallModeArenaProps> = ({ scoreColor, ballColor }) => {
  const { wallMode, scorePopups, hitEffects } = useSnapshot(reactPongState);
  const ballRef = useRef<RapierRigidBody | null>(null);
  const shotSpinRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!ballRef.current) return;
    if (['ready', 'levelComplete', 'gameOver', 'victory'].includes(wallMode.gameState)) {
      ballRef.current.setTranslation({ x: 0, y: 0, z: WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET }, true);
      ballRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ballRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      shotSpinRef.current = { x: 0, y: 0 };
    }
  }, [wallMode.gameState, wallMode.currentLevel]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 4, 8]} intensity={0.8} color="#00aaff" />
      <pointLight position={[0, 0, WALL_MODE_WALL_Z + 3]} intensity={0.6} color="#ff4080" />

      {/* Score popups */}
      <ScorePopups popups={[...scorePopups]} />

      {/* Hit effects */}
      <HitParticles effects={[...hitEffects]} />

      <Physics gravity={[0, 0, 0]} timeStep="vary">
        <WallModeBall
          position={[0, 0, WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET]}
          ballColor={ballColor}
          shotSpinRef={shotSpinRef}
          onBodyReady={(body) => {
            ballRef.current = body;
          }}
        />
        <WallModePaddle ballRef={ballRef} scoreColor={scoreColor} shotSpinRef={shotSpinRef} />
        <OpposingWall ballRef={ballRef} />
        <WallModeBounds />
        {wallMode.availablePowerup && (
          <Powerup
            type={wallMode.availablePowerup.type}
            position={wallMode.availablePowerup.position}
            onCollect={() => reactPongState.collectPowerup(wallMode.availablePowerup!.type)}
          />
        )}
      </Physics>

      <WallModeUI />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA SETUP
// ═══════════════════════════════════════════════════════════════════════════

const CameraSetup: React.FC = () => {
  const { camera, scene } = useThree();
  const frameCount = useRef(0);

  useEffect(() => {
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, 0);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 45;
      (camera as THREE.PerspectiveCamera).near = 0.1;
      (camera as THREE.PerspectiveCamera).far = 1000;
      camera.updateProjectionMatrix();
    }
    scene.background = new THREE.Color('#0a0a1a');
  }, [camera, scene]);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current < 30) {
      camera.position.set(0, 5, 12);
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// WALL MODE CAMERA SETUP
// ═══════════════════════════════════════════════════════════════════════════

const WallModeCameraSetup: React.FC = () => {
  const { camera, scene } = useThree();
  const frameCount = useRef(0);

  useEffect(() => {
    camera.position.set(0, 0, 18);
    camera.lookAt(0, 0, 0);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 50;
      (camera as THREE.PerspectiveCamera).near = 0.1;
      (camera as THREE.PerspectiveCamera).far = 1000;
      camera.updateProjectionMatrix();
    }
    scene.background = new THREE.Color('#050510');
  }, [camera, scene]);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current < 30) {
      camera.position.set(0, 0, 18);
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN REACT PONG COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ReactPong: React.FC<{ ready?: boolean }> = ({ ready: _ready }) => {
  const { scoreColor, ballColor, mode, scorePopups, hitEffects } = useSnapshot(reactPongState);
  const ballBodyRef = useRef<RapierRigidBody | null>(null);

  // Audio refs
  const paddleHitSoundRef = useRef<HTMLAudioElement | null>(null);
  const wallHitSoundRef = useRef<HTMLAudioElement | null>(null);
  const scoreSoundRef = useRef<HTMLAudioElement | null>(null);
  const scoreBonusSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      paddleHitSoundRef.current = new Audio('https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/ReactPongPingPongHit.mp3');
      wallHitSoundRef.current = new Audio('https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/ReactPongWallHit.mp3');
      scoreSoundRef.current = new Audio('https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/SoundScore.mp3');
      scoreBonusSoundRef.current = new Audio('https://racho-devs.s3.us-east-2.amazonaws.com/funV2/gameAudio/reactPong/SoundScoreBonusPoints.mp3');
    }
  }, []);

  useEffect(() => {
    reactPongState.audio.paddleHitSound = paddleHitSoundRef.current;
    reactPongState.audio.wallHitSound = wallHitSoundRef.current;
    reactPongState.audio.scoreSound = scoreSoundRef.current;
    reactPongState.audio.scoreBonusSound = scoreBonusSoundRef.current;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        if (mode === 'WallMode') {
          reactPongState.resetWallMode();
        } else {
          reactPongState.reset();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  // Wall Mode render (Space Pong 3D)
  if (mode === 'WallMode') {
    return (
      <>
        <WallModeCameraSetup />
        <WallModeArena scoreColor={scoreColor} ballColor={ballColor} />
      </>
    );
  }

  // Free Form Mode render (original)
  return (
    <>
      <CameraSetup />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <spotLight
        position={[-10, 15, 10]}
        angle={0.5}
        penumbra={1}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[10, 10, 10]} intensity={0.3} color="#00d4ff" />
      <pointLight position={[-10, -5, 5]} intensity={0.2} color="#ff4080" />

      {/* Score popups */}
      <ScorePopups popups={[...scorePopups]} />

      {/* Hit effects */}
      <HitParticles effects={[...hitEffects]} />

      <Physics gravity={[0, -40, 0]} timeStep="vary">
        <Suspense fallback={null}>
          <Ball
            position={[0, 5, 0]}
            ballColor={ballColor}
            onBodyReady={(body) => {
              ballBodyRef.current = body;
            }}
          />
        </Suspense>

        {mode === 'SoloPaddle' && (
          <Suspense fallback={null}>
            <Paddle scoreColor={scoreColor} />
          </Suspense>
        )}
        {mode === 'SoloWalls' && <SoloWallsAssist ballRef={ballBodyRef} />}
        
        <Arena />
      </Physics>
    </>
  );
};

export default ReactPong;
