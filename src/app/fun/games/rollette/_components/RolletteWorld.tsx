// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
'use client';

import { Html, Sky, Sparkles, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ARENA_HALF,
  ARENA_SIZE,
  CHAIN_WINDOW_S,
  FLOOR_Y,
  ITEM_Y,
  PLAYER_RADIUS,
} from '../constants';
import { rolletteState } from '../state';
import type { Vec3 } from '../types';
import { BurstFX, type Burst } from './BurstFX';
import { Player } from './Player';

const nowSec = () => performance.now() / 1000;

const WALL_THICKNESS = 1.3;
const WALL_HEIGHT = 3.6;
const TABLE_DRAIN_GAP = 13;

const CONTROL_SPEED = 20; // matched to Rollette JS legacy keyboard velocity
const MOUSE_FORCE = 205; // matched to Rollette JS legacy mouse force feel
const MAX_SPEED = 38;

const NUDGE_COOLDOWN_S = 0.95;
const MAX_NUDGES_PER_WINDOW = 3;
const NUDGE_WINDOW_S = 5;
const TILT_LOCK_S = 3;

type ThemeId = 'nebula' | 'cotton' | 'nature';
type ControlMode = 'mouse' | 'keyboard';
type PowerMode = 'HEAVY' | 'GHOST' | 'MAGNET' | null;

type TargetKind =
  | 'standup'
  | 'drop'
  | 'pop'
  | 'spinner'
  | 'slingshot'
  | 'vari'
  | 'bullOuter'
  | 'bullCore'
  | 'saucer'
  | 'rollover'
  | 'ramp'
  | 'orbit'
  | 'magnet'
  | 'wormholeIn'
  | 'wormholeOut'
  | 'mystery'
  | 'kicker'
  | 'mini';

type ObjectiveTag = 'drop' | 'spinner' | 'bullseye' | 'orbit' | 'ramp' | 'mystery';

interface ArenaTheme {
  id: ThemeId;
  name: string;
  background: string;
  fog: string;
  floor: string;
  rail: string;
  accent: string;
  secondary: string;
  hazard: string;
  highlight: string;
  glow: number;
  laneTint: string;
}

interface PinballTarget {
  id: string;
  kind: TargetKind;
  pos: Vec3;
  radius: number;
  points: number;
  active?: boolean;
  bank?: string;
  pairId?: string;
  yRot?: number;
  tint?: string;
  objective?: ObjectiveTag;
}

interface ArenaObstacle {
  id: string;
  pos: Vec3;
  size: [number, number, number];
  motion: 'rotate' | 'slide' | 'pulse';
  axis?: 'x' | 'z';
  amp: number;
  speed: number;
  damage: number;
  tint: string;
}

interface PathRibbon {
  id: string;
  pos: Vec3;
  inner: number;
  outer: number;
  start: number;
  length: number;
  tilt?: number;
  tint?: string;
  kind: 'orbit' | 'ramp' | 'lane';
}

interface ArenaLayout {
  targets: PinballTarget[];
  obstacles: ArenaObstacle[];
  ribbons: PathRibbon[];
  miniZone: { center: Vec3; half: [number, number] };
  launch: Vec3;
  skillShotTargetId: string;
  drainGap: number;
}

interface ObjectiveState {
  dropBanks: Set<string>;
  spinnerHits: number;
  bullseyeHits: number;
  orbitHits: number;
  rampHits: number;
  mysteryHits: number;
  rolloverHits: number;
  jackpotValue: number;
  multiballLit: boolean;
  multiballUntil: number;
  skillShotActive: boolean;
  launchAt: number;
}

interface WaveFx {
  id: string;
  pos: Vec3;
  color: string;
  bornAt: number;
  life: number;
  maxScale: number;
}

interface FlashFx {
  id: string;
  pos: Vec3;
  color: string;
  bornAt: number;
  life: number;
  intensity: number;
}

type SoundEvent =
  | 'hit'
  | 'target'
  | 'bumper'
  | 'drop'
  | 'jackpot'
  | 'nudge'
  | 'danger'
  | 'mode'
  | 'wizard'
  | 'mystery';

const THEMES: Record<ThemeId, ArenaTheme> = {
  nebula: {
    id: 'nebula',
    name: 'Neon Nebula Galaxy',
    background: '#02030a',
    fog: '#070b1e',
    floor: '#0a1027',
    rail: '#1a1431',
    accent: '#24ff9f',
    secondary: '#8e4bff',
    hazard: '#ff4f45',
    highlight: '#ffd84d',
    glow: 1.75,
    laneTint: '#10d9ff',
  },
  cotton: {
    id: 'cotton',
    name: 'Cotton Candy World',
    background: '#faf5ff',
    fog: '#ffeef8',
    floor: '#f7f6ff',
    rail: '#d7d7ef',
    accent: '#ff99cd',
    secondary: '#7ecbff',
    hazard: '#ff6e8d',
    highlight: '#ffffff',
    glow: 1.05,
    laneTint: '#dcaeff',
  },
  nature: {
    id: 'nature',
    name: 'Naturalistic Nature',
    background: '#081709',
    fog: '#102814',
    floor: '#12311a',
    rail: '#2a3f24',
    accent: '#68d764',
    secondary: '#9ad64a',
    hazard: '#8d5430',
    highlight: '#d6ff87',
    glow: 0.95,
    laneTint: '#7ecf7d',
  },
};

const THEME_KEYS: Record<string, ThemeId> = {
  '1': 'nebula',
  '2': 'cotton',
  '3': 'nature',
};

const makeId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const makeObjectives = (): ObjectiveState => ({
  dropBanks: new Set<string>(),
  spinnerHits: 0,
  bullseyeHits: 0,
  orbitHits: 0,
  rampHits: 0,
  mysteryHits: 0,
  rolloverHits: 0,
  jackpotValue: 14000,
  multiballLit: false,
  multiballUntil: 0,
  skillShotActive: true,
  launchAt: nowSec(),
});

const wizardReady = (o: ObjectiveState) =>
  o.dropBanks.size >= 2 &&
  o.spinnerHits >= 8 &&
  o.bullseyeHits >= 4 &&
  o.orbitHits >= 6 &&
  o.rampHits >= 6 &&
  o.mysteryHits >= 2;

const createArenaLayout = (theme: ThemeId): ArenaLayout => {
  const targets: PinballTarget[] = [];
  const obstacles: ArenaObstacle[] = [];
  const ribbons: PathRibbon[] = [];

  const addMirror = (
    baseId: string,
    kind: TargetKind,
    x: number,
    z: number,
    cfg: Partial<PinballTarget> = {}
  ) => {
    targets.push({
      id: `${baseId}-r`,
      kind,
      pos: [Math.abs(x), ITEM_Y + 0.45, z],
      radius: 1.4,
      points: 250,
      active: true,
      ...cfg,
    });
    targets.push({
      id: `${baseId}-l`,
      kind,
      pos: [-Math.abs(x), ITEM_Y + 0.45, z],
      radius: 1.4,
      points: 250,
      active: true,
      yRot: Math.PI,
      ...cfg,
    });
  };

  const addRibbonMirror = (
    baseId: string,
    x: number,
    z: number,
    cfg: Omit<PathRibbon, 'id' | 'pos'>
  ) => {
    ribbons.push({
      id: `${baseId}-r`,
      pos: [Math.abs(x), ITEM_Y - 0.07, z],
      ...cfg,
    });
    ribbons.push({
      id: `${baseId}-l`,
      pos: [-Math.abs(x), ITEM_Y - 0.07, z],
      ...cfg,
    });
  };

  if (theme === 'nebula') {
    for (const [i, z] of [-10, -15, -20, -25].entries()) {
      addMirror(`drop-nebula-a-${i}`, 'drop', 16, z, {
        bank: z <= -20 ? 'nebula-bank-a2' : 'nebula-bank-a1',
        points: 1000,
        radius: 1.45,
        objective: 'drop',
      });
    }
    for (const [i, z] of [-30, -35, -40, -45].entries()) {
      addMirror(`drop-nebula-b-${i}`, 'drop', 22, z, {
        bank: z <= -40 ? 'nebula-bank-b2' : 'nebula-bank-b1',
        points: 1200,
        radius: 1.48,
        objective: 'drop',
      });
    }

    for (const [i, z] of [-4, -12, -20, -28, -36].entries()) {
      addMirror(`stand-nebula-${i}`, 'standup', 8, z, {
        points: 260,
        radius: 1.16,
      });
    }

    for (const [i, z] of [-14, -30].entries()) {
      addMirror(`spin-nebula-${i}`, 'spinner', 24, z, {
        radius: 1.9,
        points: 420,
        objective: 'spinner',
      });
    }

    addMirror('sling-nebula', 'slingshot', 12.3, 38, {
      radius: 2.15,
      points: 560,
    });
    addMirror('vari-nebula', 'vari', 20.4, 22, { radius: 1.5, points: 700 });
    addMirror('saucer-nebula', 'saucer', 9.2, -39, {
      radius: 1.75,
      points: 2100,
    });
    addMirror('magnet-nebula', 'magnet', 8, -26, {
      radius: 2.1,
      points: 420,
    });
    addMirror('orbit-nebula-a', 'orbit', 28, -4, {
      radius: 2.35,
      points: 900,
      objective: 'orbit',
    });
    addMirror('orbit-nebula-b', 'orbit', 28, -24, {
      radius: 2.35,
      points: 950,
      objective: 'orbit',
    });
    addMirror('ramp-nebula-a', 'ramp', 8, -8, {
      radius: 2.1,
      points: 1050,
      objective: 'ramp',
    });
    addMirror('ramp-nebula-b', 'ramp', 13.2, -22, {
      radius: 1.9,
      points: 980,
      objective: 'ramp',
    });
    addMirror('worm-in-nebula', 'wormholeIn', 24, 18, {
      radius: 1.9,
      points: 2600,
    });
    addMirror('worm-out-nebula', 'wormholeOut', 6.4, -47, {
      radius: 1.5,
      points: 0,
    });
    addMirror('mini-nebula', 'mini', 5.5, -48.5, {
      radius: 1.45,
      points: 980,
    });

    targets.push({
      id: 'mini-nebula-core',
      kind: 'mini',
      pos: [0, ITEM_Y + 0.45, -49.5],
      radius: 1.5,
      points: 1450,
      active: true,
    });

    targets.push({
      id: 'bull-nebula-outer',
      kind: 'bullOuter',
      pos: [0, ITEM_Y + 0.4, -52.5],
      radius: 2.45,
      points: 1450,
      objective: 'bullseye',
      active: true,
    });
    targets.push({
      id: 'bull-nebula-core',
      kind: 'bullCore',
      pos: [0, ITEM_Y + 0.45, -52.5],
      radius: 1.1,
      points: 4600,
      objective: 'bullseye',
      active: true,
    });

    targets.push({
      id: 'mystery-nebula',
      kind: 'mystery',
      pos: [0, ITEM_Y + 0.44, -18],
      radius: 1.6,
      points: 1800,
      objective: 'mystery',
      active: true,
    });

    targets.push({
      id: 'kicker-nebula',
      kind: 'kicker',
      pos: [0, ITEM_Y + 0.45, -37],
      radius: 1.5,
      points: 1100,
      active: true,
    });

    for (const [i, x] of [-20, -10, 0, 10, 20].entries()) {
      targets.push({
        id: `roll-nebula-${i}`,
        kind: 'rollover',
        pos: [x, ITEM_Y + 0.35, -55],
        radius: 1.2,
        points: 360,
        active: true,
      });
    }

    for (const [i, [x, z]] of [
      [-6, -31],
      [6, -31],
      [0, -35],
      [-10.5, -24],
      [10.5, -24],
    ].entries()) {
      targets.push({
        id: `pop-nebula-${i}`,
        kind: 'pop',
        pos: [x, ITEM_Y + 0.45, z],
        radius: 1.72,
        points: 560,
        active: true,
      });
    }

    obstacles.push({
      id: 'obs-nebula-cross',
      pos: [0, ITEM_Y + 0.82, -12],
      size: [10.5, 0.95, 1.05],
      motion: 'rotate',
      amp: 0,
      speed: 1.55,
      damage: 11,
      tint: '#ff5a56',
    });
    obstacles.push({
      id: 'obs-nebula-gate-r',
      pos: [17, ITEM_Y + 0.72, 5],
      size: [4.8, 1, 2],
      motion: 'slide',
      axis: 'z',
      amp: 8,
      speed: 1.25,
      damage: 8,
      tint: '#2dc6ff',
    });
    obstacles.push({
      id: 'obs-nebula-gate-l',
      pos: [-17, ITEM_Y + 0.72, 5],
      size: [4.8, 1, 2],
      motion: 'slide',
      axis: 'z',
      amp: 8,
      speed: 1.25,
      damage: 8,
      tint: '#2dc6ff',
    });
    obstacles.push({
      id: 'obs-nebula-sentinel',
      pos: [0, ITEM_Y + 1.05, -29],
      size: [2.4, 2.5, 2.4],
      motion: 'pulse',
      amp: 2.8,
      speed: 1.8,
      damage: 10,
      tint: '#a958ff',
    });

    addRibbonMirror('lane-nebula-orbit', 26.5, -14, {
      kind: 'orbit',
      inner: 5.8,
      outer: 7.4,
      start: Math.PI * 0.05,
      length: Math.PI * 0.85,
      tilt: 0,
    });
    addRibbonMirror('lane-nebula-ramp', 8.8, -19, {
      kind: 'ramp',
      inner: 3.6,
      outer: 5.1,
      start: Math.PI * 0.3,
      length: Math.PI * 0.72,
      tilt: 0,
    });

    ribbons.push({
      id: 'lane-nebula-center',
      kind: 'lane',
      pos: [0, ITEM_Y - 0.08, -38],
      inner: 2.8,
      outer: 4,
      start: Math.PI * 0.15,
      length: Math.PI * 1.7,
      tilt: 0,
    });

    const inRight = targets.find((t) => t.id === 'worm-in-nebula-r');
    const inLeft = targets.find((t) => t.id === 'worm-in-nebula-l');
    if (inRight) inRight.pairId = 'worm-out-nebula-r';
    if (inLeft) inLeft.pairId = 'worm-out-nebula-l';

    return {
      targets,
      obstacles,
      ribbons,
      miniZone: { center: [0, ITEM_Y, -49], half: [12, 8] },
      launch: [0, 2.4, 45],
      skillShotTargetId: 'roll-nebula-2',
      drainGap: TABLE_DRAIN_GAP,
    };
  }

  if (theme === 'cotton') {
    for (const [i, z] of [-6, -11, -16, -21].entries()) {
      addMirror(`drop-cotton-a-${i}`, 'drop', 12.5, z, {
        bank: z <= -16 ? 'cotton-bank-a2' : 'cotton-bank-a1',
        points: 980,
        radius: 1.35,
        objective: 'drop',
      });
    }
    for (const [i, z] of [-26, -31, -36, -41].entries()) {
      addMirror(`drop-cotton-b-${i}`, 'drop', 18.5, z, {
        bank: z <= -36 ? 'cotton-bank-b2' : 'cotton-bank-b1',
        points: 1150,
        radius: 1.4,
        objective: 'drop',
      });
    }

    for (const [i, z] of [-4, -12, -20, -28, -36].entries()) {
      addMirror(`stand-cotton-${i}`, 'standup', 7.2, z, {
        points: 250,
        radius: 1.12,
      });
    }

    for (const [i, z] of [-10, -30].entries()) {
      addMirror(`spin-cotton-${i}`, 'spinner', 18.8, z, {
        radius: 1.82,
        points: 390,
        objective: 'spinner',
      });
    }

    addMirror('sling-cotton', 'slingshot', 11.2, 39.2, {
      radius: 2.1,
      points: 560,
    });
    addMirror('vari-cotton', 'vari', 19.5, 20, {
      radius: 1.45,
      points: 690,
    });
    addMirror('saucer-cotton', 'saucer', 7.5, -33.5, {
      radius: 1.7,
      points: 1900,
    });
    addMirror('magnet-cotton', 'magnet', 9.5, -21, {
      radius: 2,
      points: 420,
    });
    addMirror('orbit-cotton-a', 'orbit', 23.8, -2.5, {
      radius: 2.25,
      points: 880,
      objective: 'orbit',
    });
    addMirror('orbit-cotton-b', 'orbit', 23.8, -22.5, {
      radius: 2.25,
      points: 910,
      objective: 'orbit',
    });
    addMirror('ramp-cotton-a', 'ramp', 5.8, -10.5, {
      radius: 1.95,
      points: 1020,
      objective: 'ramp',
    });
    addMirror('ramp-cotton-b', 'ramp', 10.8, -24.5, {
      radius: 1.72,
      points: 930,
      objective: 'ramp',
    });
    addMirror('worm-in-cotton', 'wormholeIn', 16.5, 16, {
      radius: 1.75,
      points: 2400,
    });
    addMirror('worm-out-cotton', 'wormholeOut', 4.2, -35.2, {
      radius: 1.45,
      points: 0,
    });
    addMirror('mini-cotton', 'mini', 5.8, -37.2, {
      radius: 1.3,
      points: 950,
    });

    targets.push({
      id: 'mini-cotton-core',
      kind: 'mini',
      pos: [0, ITEM_Y + 0.45, -39.3],
      radius: 1.35,
      points: 1350,
      active: true,
    });

    targets.push({
      id: 'bull-cotton-outer',
      kind: 'bullOuter',
      pos: [0, ITEM_Y + 0.4, -41.5],
      radius: 2.3,
      points: 1400,
      objective: 'bullseye',
      active: true,
    });
    targets.push({
      id: 'bull-cotton-core',
      kind: 'bullCore',
      pos: [0, ITEM_Y + 0.45, -41.5],
      radius: 1.02,
      points: 4300,
      objective: 'bullseye',
      active: true,
    });

    targets.push({
      id: 'mystery-cotton',
      kind: 'mystery',
      pos: [0, ITEM_Y + 0.44, -16],
      radius: 1.5,
      points: 1700,
      objective: 'mystery',
      active: true,
    });

    targets.push({
      id: 'kicker-cotton',
      kind: 'kicker',
      pos: [0, ITEM_Y + 0.45, -30.5],
      radius: 1.4,
      points: 1080,
      active: true,
    });

    for (const [i, x] of [-16, -8, 0, 8, 16].entries()) {
      targets.push({
        id: `roll-cotton-${i}`,
        kind: 'rollover',
        pos: [x, ITEM_Y + 0.35, -43.5],
        radius: 1.18,
        points: 340,
        active: true,
      });
    }

    for (const [i, [x, z]] of [
      [-7, -18],
      [7, -18],
      [-3.3, -25],
      [3.3, -25],
      [0, -30.5],
      [0, -14],
    ].entries()) {
      targets.push({
        id: `pop-cotton-${i}`,
        kind: 'pop',
        pos: [x, ITEM_Y + 0.45, z],
        radius: 1.62,
        points: 530,
        active: true,
      });
    }

    obstacles.push({
      id: 'obs-cotton-pinwheel',
      pos: [0, ITEM_Y + 0.8, -8],
      size: [8.2, 0.85, 1],
      motion: 'rotate',
      amp: 0,
      speed: 1.15,
      damage: 8,
      tint: '#ff9bcf',
    });
    obstacles.push({
      id: 'obs-cotton-slide-r',
      pos: [14.8, ITEM_Y + 0.72, 2.5],
      size: [3.8, 0.82, 1.75],
      motion: 'slide',
      axis: 'x',
      amp: 6,
      speed: 1.2,
      damage: 7,
      tint: '#93d8ff',
    });
    obstacles.push({
      id: 'obs-cotton-slide-l',
      pos: [-14.8, ITEM_Y + 0.72, 2.5],
      size: [3.8, 0.82, 1.75],
      motion: 'slide',
      axis: 'x',
      amp: 6,
      speed: 1.2,
      damage: 7,
      tint: '#93d8ff',
    });
    obstacles.push({
      id: 'obs-cotton-pulse',
      pos: [0, ITEM_Y + 1.05, -24],
      size: [2.1, 2.2, 2.1],
      motion: 'pulse',
      amp: 2.4,
      speed: 1.5,
      damage: 9,
      tint: '#e4b6ff',
    });

    addRibbonMirror('lane-cotton-orbit', 22.6, -12, {
      kind: 'orbit',
      inner: 5.4,
      outer: 6.9,
      start: Math.PI * 0.1,
      length: Math.PI * 0.92,
      tilt: 0,
    });
    addRibbonMirror('lane-cotton-ramp', 6.5, -19.5, {
      kind: 'ramp',
      inner: 4.1,
      outer: 5.3,
      start: Math.PI * 0.24,
      length: Math.PI * 0.76,
      tilt: 0,
    });

    ribbons.push({
      id: 'lane-cotton-hub',
      kind: 'lane',
      pos: [0, ITEM_Y - 0.08, -26],
      inner: 5.5,
      outer: 7.1,
      start: Math.PI * 0.05,
      length: Math.PI * 1.9,
      tilt: 0,
    });

    const inRight = targets.find((t) => t.id === 'worm-in-cotton-r');
    const inLeft = targets.find((t) => t.id === 'worm-in-cotton-l');
    if (inRight) inRight.pairId = 'worm-out-cotton-r';
    if (inLeft) inLeft.pairId = 'worm-out-cotton-l';

    return {
      targets,
      obstacles,
      ribbons,
      miniZone: { center: [0, ITEM_Y, -38.5], half: [11, 9] },
      launch: [0, 2.4, 45],
      skillShotTargetId: 'roll-cotton-2',
      drainGap: TABLE_DRAIN_GAP,
    };
  }

  for (const [i, z] of [-12, -18, -24, -30].entries()) {
    addMirror(`drop-nature-a-${i}`, 'drop', 17.8, z, {
      bank: z <= -24 ? 'nature-bank-a2' : 'nature-bank-a1',
      points: 1040,
      radius: 1.43,
      objective: 'drop',
    });
  }
  for (const [i, z] of [-34, -40, -46].entries()) {
    addMirror(`drop-nature-b-${i}`, 'drop', 22.8, z, {
      bank: z <= -40 ? 'nature-bank-b2' : 'nature-bank-b1',
      points: 1260,
      radius: 1.5,
      objective: 'drop',
    });
  }

  for (const [i, z] of [-8, -16, -24, -32].entries()) {
    addMirror(`stand-nature-${i}`, 'standup', 9.2, z, {
      points: 270,
      radius: 1.18,
    });
  }

  for (const [i, z] of [-24, -39].entries()) {
    addMirror(`spin-nature-${i}`, 'spinner', 23.2, z, {
      radius: 1.88,
      points: 430,
      objective: 'spinner',
    });
  }

  addMirror('sling-nature', 'slingshot', 13.7, 37.6, {
    radius: 2.15,
    points: 570,
  });
  addMirror('vari-nature', 'vari', 21.2, 19.4, { radius: 1.55, points: 710 });
  addMirror('saucer-nature', 'saucer', 9.4, -36, {
    radius: 1.75,
    points: 2050,
  });
  addMirror('magnet-nature', 'magnet', 10.2, -30.5, {
    radius: 2.15,
    points: 450,
  });
  addMirror('orbit-nature-a', 'orbit', 27.2, -7, {
    radius: 2.3,
    points: 920,
    objective: 'orbit',
  });
  addMirror('orbit-nature-b', 'orbit', 27.2, -29, {
    radius: 2.3,
    points: 980,
    objective: 'orbit',
  });
  addMirror('ramp-nature-a', 'ramp', 7.1, -22.5, {
    radius: 2,
    points: 1060,
    objective: 'ramp',
  });
  addMirror('ramp-nature-b', 'ramp', 13.5, -33.5, {
    radius: 1.8,
    points: 990,
    objective: 'ramp',
  });
  addMirror('worm-in-nature', 'wormholeIn', 25.4, 22, {
    radius: 1.82,
    points: 2500,
  });
  addMirror('worm-out-nature', 'wormholeOut', 7, -46.5, {
    radius: 1.55,
    points: 0,
  });
  addMirror('mini-nature', 'mini', 5.2, -49.2, { radius: 1.4, points: 1000 });

  targets.push({
    id: 'mini-nature-core',
    kind: 'mini',
    pos: [0, ITEM_Y + 0.45, -50.8],
    radius: 1.45,
    points: 1480,
    active: true,
  });

  targets.push({
    id: 'bull-nature-outer',
    kind: 'bullOuter',
    pos: [0, ITEM_Y + 0.4, -53.3],
    radius: 2.45,
    points: 1500,
    objective: 'bullseye',
    active: true,
  });
  targets.push({
    id: 'bull-nature-core',
    kind: 'bullCore',
    pos: [0, ITEM_Y + 0.45, -53.3],
    radius: 1.1,
    points: 4700,
    objective: 'bullseye',
    active: true,
  });

  targets.push({
    id: 'mystery-nature',
    kind: 'mystery',
    pos: [0, ITEM_Y + 0.44, -21.2],
    radius: 1.56,
    points: 1850,
    objective: 'mystery',
    active: true,
  });

  targets.push({
    id: 'kicker-nature',
    kind: 'kicker',
    pos: [0, ITEM_Y + 0.45, -42],
    radius: 1.48,
    points: 1120,
    active: true,
  });

  for (const [i, x] of [-20, -10, 0, 10, 20].entries()) {
    targets.push({
      id: `roll-nature-${i}`,
      kind: 'rollover',
      pos: [x, ITEM_Y + 0.35, -56],
      radius: 1.2,
      points: 360,
      active: true,
    });
  }

  for (const [i, [x, z]] of [
    [-6.2, -38],
    [6.2, -38],
    [0, -42],
    [-11.2, -31],
    [11.2, -31],
  ].entries()) {
    targets.push({
      id: `pop-nature-${i}`,
      kind: 'pop',
      pos: [x, ITEM_Y + 0.45, z],
      radius: 1.75,
      points: 560,
      active: true,
    });
  }

  obstacles.push({
    id: 'obs-nature-branch',
    pos: [0, ITEM_Y + 0.84, -16],
    size: [9.8, 0.95, 1.05],
    motion: 'rotate',
    amp: 0,
    speed: 1.3,
    damage: 9,
    tint: '#7d522c',
  });
  obstacles.push({
    id: 'obs-nature-log-r',
    pos: [17, ITEM_Y + 0.73, 5],
    size: [4.5, 0.9, 1.8],
    motion: 'slide',
    axis: 'z',
    amp: 9,
    speed: 1.32,
    damage: 8,
    tint: '#4a8a3e',
  });
  obstacles.push({
    id: 'obs-nature-log-l',
    pos: [-17, ITEM_Y + 0.73, 5],
    size: [4.5, 0.9, 1.8],
    motion: 'slide',
    axis: 'z',
    amp: 9,
    speed: 1.32,
    damage: 8,
    tint: '#4a8a3e',
  });
  obstacles.push({
    id: 'obs-nature-root',
    pos: [0, ITEM_Y + 1.08, -34.5],
    size: [2.4, 2.6, 2.4],
    motion: 'pulse',
    amp: 2.6,
    speed: 1.7,
    damage: 10,
    tint: '#9f6f41',
  });

  addRibbonMirror('lane-nature-orbit', 25.8, -18, {
    kind: 'orbit',
    inner: 6,
    outer: 7.5,
    start: Math.PI * 0.08,
    length: Math.PI * 0.9,
    tilt: 0,
  });
  addRibbonMirror('lane-nature-ramp', 8.2, -29, {
    kind: 'ramp',
    inner: 3.8,
    outer: 5.2,
    start: Math.PI * 0.24,
    length: Math.PI * 0.72,
    tilt: 0,
  });

  ribbons.push({
    id: 'lane-nature-trunk',
    kind: 'lane',
    pos: [0, ITEM_Y - 0.08, -44],
    inner: 3.4,
    outer: 4.6,
    start: Math.PI * 0.14,
    length: Math.PI * 1.72,
    tilt: 0,
  });

  const inRight = targets.find((t) => t.id === 'worm-in-nature-r');
  const inLeft = targets.find((t) => t.id === 'worm-in-nature-l');
  if (inRight) inRight.pairId = 'worm-out-nature-r';
  if (inLeft) inLeft.pairId = 'worm-out-nature-l';

  return {
    targets,
    obstacles,
    ribbons,
    miniZone: { center: [0, ITEM_Y, -50], half: [13, 7] },
    launch: [0, 2.4, 45],
    skillShotTargetId: 'roll-nature-2',
    drainGap: TABLE_DRAIN_GAP,
  };
};

const ThemeDecor: React.FC<{ theme: ArenaTheme }> = ({ theme }) => {
  if (theme.id === 'cotton') {
    return (
      <group>
        {[-1, 1].map((side) => (
          <group key={`cotton-clouds-${side}`} position={[side * 22, ITEM_Y + 1.8, -24]}>
            <mesh>
              <sphereGeometry args={[2.8, 18, 18]} />
              <meshStandardMaterial color="#ffe6f5" emissive="#ffd6f4" emissiveIntensity={0.22} />
            </mesh>
            <mesh position={[side * 1.8, 0.6, -1.6]}>
              <sphereGeometry args={[2.1, 16, 16]} />
              <meshStandardMaterial color="#def2ff" emissive="#def2ff" emissiveIntensity={0.18} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (theme.id === 'nature') {
    return (
      <group>
        {Array.from({ length: 6 }).map((_, i) => {
          const z = -6 - i * 9;
          return (
            <group key={`nature-post-${i}`}>
              <mesh position={[26.5, ITEM_Y + 1.2, z]} castShadow>
                <cylinderGeometry args={[0.5, 0.7, 2.4, 12]} />
                <meshStandardMaterial color="#4f6d37" emissive="#3d5b2d" emissiveIntensity={0.2} />
              </mesh>
              <mesh position={[-26.5, ITEM_Y + 1.2, z]} castShadow>
                <cylinderGeometry args={[0.5, 0.7, 2.4, 12]} />
                <meshStandardMaterial color="#4f6d37" emissive="#3d5b2d" emissiveIntensity={0.2} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

  return (
    <group>
      {Array.from({ length: 7 }).map((_, i) => {
        const z = -6 - i * 8;
        return (
          <group key={`nebula-pylon-${i}`}>
            <mesh position={[26.5, ITEM_Y + 1.35, z]} castShadow>
              <cylinderGeometry args={[0.45, 0.65, 2.7, 14]} />
              <meshStandardMaterial
                color="#182649"
                emissive="#2a74ff"
                emissiveIntensity={0.35}
                metalness={0.65}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[-26.5, ITEM_Y + 1.35, z]} castShadow>
              <cylinderGeometry args={[0.45, 0.65, 2.7, 14]} />
              <meshStandardMaterial
                color="#182649"
                emissive="#2a74ff"
                emissiveIntensity={0.35}
                metalness={0.65}
                roughness={0.25}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const ImpactWave: React.FC<{ wave: WaveFx }> = ({ wave }) => {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!groupRef.current || !matRef.current) return;
    const t = THREE.MathUtils.clamp((nowSec() - wave.bornAt) / wave.life, 0, 1);
    const s = THREE.MathUtils.lerp(0.2, wave.maxScale, t);
    groupRef.current.scale.setScalar(s);
    matRef.current.opacity = THREE.MathUtils.lerp(0.62, 0, t);
  });

  return (
    <group ref={groupRef} position={wave.pos as unknown as THREE.Vector3Tuple}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 1.1, 42]} />
        <meshBasicMaterial
          ref={matRef}
          color={wave.color}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

const ImpactFlash: React.FC<{ flash: FlashFx }> = ({ flash }) => {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const t = THREE.MathUtils.clamp((nowSec() - flash.bornAt) / flash.life, 0, 1);
    lightRef.current.intensity = THREE.MathUtils.lerp(flash.intensity, 0, t);
  });

  return (
    <pointLight
      ref={lightRef}
      position={flash.pos as unknown as THREE.Vector3Tuple}
      color={flash.color}
      distance={6}
      intensity={flash.intensity}
    />
  );
};

const kindToSound = (kind: TargetKind | 'obstacle' | 'drain' | 'jackpot'): SoundEvent => {
  switch (kind) {
    case 'pop':
    case 'slingshot':
      return 'bumper';
    case 'drop':
      return 'drop';
    case 'mystery':
      return 'mystery';
    case 'obstacle':
    case 'drain':
      return 'danger';
    case 'jackpot':
      return 'jackpot';
    default:
      return 'target';
  }
};

export const RolletteWorld: React.FC<{
  soundsOn: boolean;
  paused: boolean;
  damageFlashRef: React.MutableRefObject<number>;
  shieldLightRef: React.RefObject<THREE.PointLight>;
}> = ({ soundsOn, paused, damageFlashRef, shieldLightRef }) => {
  const { camera, gl, scene } = useThree();

  const [themeId, setThemeId] = useState<ThemeId>('nebula');
  const [controlMode, setControlMode] = useState<ControlMode>('mouse');
  const [activePower, setActivePower] = useState<PowerMode>(null);
  const [wizardActive, setWizardActive] = useState(false);
  const [multiballReady, setMultiballReady] = useState(false);

  const initialLayout = useMemo(() => createArenaLayout('nebula'), []);
  const [layout, setLayout] = useState<ArenaLayout>(initialLayout);
  const [targets, setTargets] = useState<PinballTarget[]>(initialLayout.targets);
  const [obstacles, setObstacles] = useState<ArenaObstacle[]>(initialLayout.obstacles);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [waves, setWaves] = useState<WaveFx[]>([]);
  const [flashes, setFlashes] = useState<FlashFx[]>([]);

  const theme = THEMES[themeId];

  const ballRef = useRef<RapierRigidBody>(null);
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const nudgeQueuedRef = useRef(false);
  const nudgeTimesRef = useRef<number[]>([]);
  const tiltLockUntilRef = useRef(0);
  const tiltToastAtRef = useRef(0);
  const pausedRef = useRef(paused);
  const pendingLaunchRef = useRef<Vec3 | null>(null);
  const drainLockRef = useRef(0);
  const activeSaucerRef = useRef<string | null>(null);

  const timersRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const layoutRef = useRef(layout);
  const targetsRef = useRef(targets);
  const obstaclesRef = useRef(obstacles);
  const targetMapRef = useRef<Record<string, PinballTarget>>(
    Object.fromEntries(targets.map((t) => [t.id, t]))
  );
  const targetLastHitRef = useRef<Record<string, number>>({});
  const obstacleLastHitRef = useRef<Record<string, number>>({});
  const obstacleBodiesRef = useRef<Record<string, RapierRigidBody | null>>({});
  const obstacleWorldRef = useRef<Record<string, Vec3>>({});
  const spinnerRefs = useRef<Record<string, THREE.Group | null>>({});

  const objectivesRef = useRef<ObjectiveState>(makeObjectives());
  const wizardUntilRef = useRef(0);
  const powerUntilRef = useRef(0);
  const bonusBankRef = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) nudgeQueuedRef.current = false;
  }, [paused]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    targetsRef.current = targets;
    targetMapRef.current = Object.fromEntries(targets.map((t) => [t.id, t]));
  }, [targets]);

  useEffect(() => {
    obstaclesRef.current = obstacles;
  }, [obstacles]);

  useEffect(() => {
    gl.setClearColor(theme.background, 1);
    scene.fog = new THREE.Fog(theme.fog, 26, 150);
    return () => {
      scene.fog = null;
    };
  }, [gl, scene, theme.background, theme.fog]);

  useEffect(() => {
    const previousTouchAction = gl.domElement.style.touchAction;
    gl.domElement.style.touchAction = 'none';
    return () => {
      gl.domElement.style.touchAction = previousTouchAction;
    };
  }, [gl]);

  const queueTimer = useCallback((cb: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      cb();
      timersRef.current = timersRef.current.filter((x) => x !== id);
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(
    () => () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
    },
    []
  );

  const ensureAudio = useCallback(() => {
    if (!soundsOn || typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      audioContextRef.current = new Ctx();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => undefined);
    }
    return audioContextRef.current;
  }, [soundsOn]);

  const playSynth = useCallback(
    (event: SoundEvent, velocity = 1) => {
      const ctx = ensureAudio();
      if (!ctx) return;

      const now = ctx.currentTime;

      const tone = (
        freq: number,
        endFreq: number,
        duration: number,
        type: OscillatorType,
        gainValue: number,
        offset = 0
      ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startAt = now + offset;

        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(40, freq), startAt);
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(40, endFreq),
          startAt + duration
        );

        const level = Math.max(0.0001, gainValue * velocity);
        gain.gain.setValueAtTime(level, startAt);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + duration + 0.02);
      };

      if (event === 'target') {
        tone(280, 210, 0.06, 'triangle', 0.028);
      } else if (event === 'bumper') {
        tone(520, 140, 0.09, 'square', 0.04);
      } else if (event === 'drop') {
        tone(220, 100, 0.12, 'sawtooth', 0.038);
      } else if (event === 'jackpot') {
        tone(400, 720, 0.14, 'triangle', 0.04);
        tone(820, 1100, 0.12, 'sine', 0.03, 0.09);
      } else if (event === 'nudge') {
        tone(170, 120, 0.08, 'sawtooth', 0.03);
      } else if (event === 'danger') {
        tone(180, 70, 0.14, 'square', 0.035);
      } else if (event === 'mode') {
        tone(250, 440, 0.12, 'triangle', 0.03);
      } else if (event === 'wizard') {
        tone(260, 780, 0.22, 'sine', 0.035);
        tone(580, 1200, 0.16, 'triangle', 0.03, 0.08);
      } else if (event === 'mystery') {
        tone(330, 520, 0.09, 'triangle', 0.03);
        tone(540, 300, 0.11, 'triangle', 0.025, 0.08);
      } else {
        tone(260, 180, 0.07, 'triangle', 0.03);
      }
    },
    [ensureAudio]
  );

  const spawnBurst = useCallback(
    (
      pos: Vec3,
      color: string,
      count = 14,
      life = 0.6,
      shape: Burst['shape'] = 'spark'
    ) => {
      setBursts((prev) => [
        ...prev.slice(-70),
        {
          id: makeId('burst'),
          pos,
          color,
          count,
          life,
          shape,
          bornAt: nowSec(),
        },
      ]);
    },
    []
  );

  const spawnWave = useCallback((pos: Vec3, color: string, life = 0.45, maxScale = 3.2) => {
    setWaves((prev) => [
      ...prev.slice(-40),
      {
        id: makeId('wave'),
        pos,
        color,
        bornAt: nowSec(),
        life,
        maxScale,
      },
    ]);
  }, []);

  const spawnFlash = useCallback(
    (pos: Vec3, color: string, life = 0.18, intensity = 1.6) => {
      setFlashes((prev) => [
        ...prev.slice(-30),
        {
          id: makeId('flash'),
          pos,
          color,
          bornAt: nowSec(),
          life,
          intensity,
        },
      ]);
    },
    []
  );

  const spawnImpact = useCallback(
    (kind: TargetKind | 'obstacle' | 'drain' | 'jackpot', pos: Vec3, color: string) => {
      if (kind === 'pop' || kind === 'slingshot') {
        spawnBurst(pos, color, 28, 0.66, 'spark');
        spawnBurst(pos, '#ffffff', 14, 0.42, 'box');
        spawnWave(pos, color, 0.45, 4.1);
        spawnFlash([pos[0], pos[1] + 0.6, pos[2]], color, 0.18, 2.3);
      } else if (kind === 'drop') {
        spawnBurst(pos, color, 20, 0.72, 'box');
        spawnWave(pos, color, 0.5, 3.1);
        spawnFlash([pos[0], pos[1] + 0.45, pos[2]], color, 0.16, 1.7);
      } else if (kind === 'spinner') {
        spawnBurst(pos, color, 22, 0.56, 'spark');
        spawnWave(pos, color, 0.36, 2.8);
      } else if (kind === 'vari' || kind === 'bullCore' || kind === 'mini') {
        spawnBurst(pos, color, 22, 0.72, 'tetra');
        spawnWave(pos, color, 0.56, 3.8);
        spawnFlash([pos[0], pos[1] + 0.5, pos[2]], color, 0.22, 2.1);
      } else if (kind === 'mystery') {
        spawnBurst(pos, color, 34, 0.96, 'tetra');
        spawnBurst(pos, '#ffffff', 18, 0.66, 'spark');
        spawnWave(pos, color, 0.68, 4.6);
        spawnFlash([pos[0], pos[1] + 0.8, pos[2]], color, 0.24, 2.6);
      } else if (kind === 'wormholeIn') {
        spawnBurst(pos, color, 30, 0.82, 'spark');
        spawnWave(pos, color, 0.72, 5.1);
      } else if (kind === 'jackpot') {
        spawnBurst(pos, color, 42, 1.1, 'tetra');
        spawnBurst(pos, '#ffffff', 28, 0.72, 'spark');
        spawnWave(pos, color, 0.82, 5.8);
        spawnFlash([pos[0], pos[1] + 1, pos[2]], color, 0.26, 3.2);
      } else if (kind === 'obstacle' || kind === 'drain') {
        spawnBurst(pos, color, 26, 0.84, 'box');
        spawnWave(pos, color, 0.52, 3.7);
        spawnFlash([pos[0], pos[1] + 0.55, pos[2]], color, 0.2, 2.2);
      } else {
        spawnBurst(pos, color, 14, 0.52, 'spark');
        spawnWave(pos, color, 0.34, 2.4);
      }
    },
    [spawnBurst, spawnFlash, spawnWave]
  );

  const setPowerMode = useCallback((next: PowerMode, duration: number) => {
    setActivePower(next);
    powerUntilRef.current = next ? nowSec() + duration : 0;
    if (next) rolletteState.setToast(`${next} MODE`);
  }, []);

  const launchBall = useCallback((launchPos: Vec3, resetSkillShot = true) => {
    const rb = ballRef.current;
    if (!rb) {
      pendingLaunchRef.current = launchPos;
      return;
    }

    rb.setTranslation({ x: launchPos[0], y: launchPos[1], z: launchPos[2] }, true);
    rb.setLinvel({ x: 0, y: 0, z: -18 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);

    if (resetSkillShot) {
      objectivesRef.current.skillShotActive = true;
      objectivesRef.current.launchAt = nowSec();
    }
  }, []);

  const updateTargets = useCallback((updater: (prev: PinballTarget[]) => PinballTarget[]) => {
    setTargets((prev) => {
      const next = updater(prev);
      targetsRef.current = next;
      targetMapRef.current = Object.fromEntries(next.map((t) => [t.id, t]));
      return next;
    });
  }, []);

  const initializeArena = useCallback(
    (nextTheme: ThemeId) => {
      const arena = createArenaLayout(nextTheme);
      setLayout(arena);
      layoutRef.current = arena;
      setTargets(arena.targets);
      targetsRef.current = arena.targets;
      targetMapRef.current = Object.fromEntries(arena.targets.map((t) => [t.id, t]));
      setObstacles(arena.obstacles);
      obstaclesRef.current = arena.obstacles;

      activeSaucerRef.current = null;
      drainLockRef.current = 0;
      targetLastHitRef.current = {};
      obstacleLastHitRef.current = {};
      obstacleWorldRef.current = {};
      spinnerRefs.current = {};
      bonusBankRef.current = 0;
      objectivesRef.current = makeObjectives();
      wizardUntilRef.current = 0;
      powerUntilRef.current = 0;
      setWizardActive(false);
      setMultiballReady(false);
      setPowerMode(null, 0);
      setBursts([]);
      setWaves([]);
      setFlashes([]);
      rolletteState.zoneCenter = [...arena.miniZone.center];

      queueTimer(() => launchBall(arena.launch, true), 80);
    },
    [launchBall, queueTimer, setPowerMode]
  );

  const resetRun = useCallback(
    (nextTheme: ThemeId = themeId) => {
      rolletteState.reset();
      rolletteState.health = 100;
      rolletteState.maxHealth = 100;
      rolletteState.dashCooldown = 0;
      rolletteState.dashCooldownMax = NUDGE_COOLDOWN_S;
      rolletteState.debt = 0;
      rolletteState.setBonusBank(0);
      rolletteState.setToast('ROLETTE: PINBALL ULTIMATE');
      initializeArena(nextTheme);
    },
    [initializeArena, themeId]
  );

  useEffect(() => {
    resetRun(themeId);
    camera.position.set(0, 21, 34);
    camera.lookAt(0, 1, 0);
  }, [camera, resetRun, themeId]);

  const evaluateModes = useCallback(() => {
    const o = objectivesRef.current;
    if (!o.multiballLit && o.dropBanks.size >= 2 && o.spinnerHits >= 6) {
      o.multiballLit = true;
      setMultiballReady(true);
      rolletteState.setToast('MULTIBALL JACKPOT LIT');
      playSynth('mode');
    }

    if (!wizardActive && wizardReady(o)) {
      setWizardActive(true);
      wizardUntilRef.current = nowSec() + 38;
      rolletteState.activateMultiplier(3, 38);
      rolletteState.setToast('WIZARD MODE ONLINE');
      playSynth('wizard');
    }
  }, [playSynth, wizardActive]);

  const applyRepelImpulse = useCallback(
    (rb: RapierRigidBody, from: Vec3, center: Vec3, force = 12) => {
      const dx = from[0] - center[0];
      const dz = from[2] - center[2];
      const len = Math.max(1e-4, Math.hypot(dx, dz));
      rb.applyImpulse(
        {
          x: (dx / len) * force,
          y: 0.4,
          z: (dz / len) * force,
        },
        true
      );
    },
    []
  );

  const awardPoints = useCallback(
    (
      basePoints: number,
      pos: Vec3,
      color: string,
      kind: TargetKind | 'obstacle' | 'drain' | 'jackpot'
    ) => {
      if (basePoints <= 0) return;

      const o = objectivesRef.current;
      rolletteState.combo = rolletteState.comboTimer > 0 ? rolletteState.combo + 1 : 1;
      rolletteState.comboTimer = CHAIN_WINDOW_S;

      const comboMult = 1 + Math.max(0, rolletteState.combo - 1) * 0.08;
      let points = basePoints * comboMult;

      if (rolletteState.inZone) points *= 1.35;
      if (o.multiballUntil > nowSec()) points *= 1.7;
      if (wizardActive) points *= 2.25;
      if (rolletteState.bonusMultiplier > 1) points *= rolletteState.bonusMultiplier;

      rolletteState.addScore(points);
      bonusBankRef.current += Math.floor(points * 0.14);
      rolletteState.setBonusBank(bonusBankRef.current);

      spawnImpact(kind, pos, color);
      playSynth(kindToSound(kind), 1.05);
    },
    [playSynth, spawnImpact, wizardActive]
  );

  const handleMysteryAward = useCallback(
    (p: Vec3) => {
      const roll = Math.random();
      const o = objectivesRef.current;
      if (roll < 0.24) {
        const bonus = 3000 + Math.floor(Math.random() * 3000);
        rolletteState.addScore(bonus);
        rolletteState.setToast(`MYSTERY +${bonus.toLocaleString()}`);
      } else if (roll < 0.38) {
        rolletteState.heal(18);
        rolletteState.setToast('MYSTERY REPAIR +18');
      } else if (roll < 0.52) {
        rolletteState.activateShield(10);
        rolletteState.setToast('MYSTERY SHIELD');
      } else if (roll < 0.67) {
        rolletteState.activateMultiplier(2, 12);
        rolletteState.setToast('MYSTERY x2');
      } else if (roll < 0.79) {
        setPowerMode('HEAVY', 10);
      } else if (roll < 0.9) {
        setPowerMode('GHOST', 8);
      } else if (roll < 0.97) {
        setPowerMode('MAGNET', 10);
      } else {
        o.multiballLit = true;
        setMultiballReady(true);
        rolletteState.setToast('MYSTERY JACKPOT LIT');
      }

      spawnImpact('mystery', [p[0], ITEM_Y + 0.55, p[2]], theme.highlight);
      playSynth('mystery', 1.2);
    },
    [playSynth, setPowerMode, spawnImpact, theme.highlight]
  );

  const resolveTargetHit = useCallback(
    (
      target: PinballTarget,
      playerPos: Vec3,
      vel: { x: number; y: number; z: number },
      rb: RapierRigidBody
    ) => {
      const o = objectivesRef.current;
      const speed = Math.hypot(vel.x, vel.z);
      const pos: Vec3 = [target.pos[0], ITEM_Y + 0.45, target.pos[2]];
      const tint =
        target.tint ??
        (target.kind === 'drop'
          ? theme.highlight
          : target.kind === 'mystery'
            ? theme.highlight
            : target.kind === 'magnet'
              ? theme.accent
              : target.kind === 'slingshot'
                ? theme.hazard
                : theme.secondary);

      if (target.objective === 'spinner') o.spinnerHits += 1;
      if (target.objective === 'bullseye') o.bullseyeHits += 1;
      if (target.objective === 'orbit') o.orbitHits += 1;
      if (target.objective === 'ramp') o.rampHits += 1;
      if (target.objective === 'mystery') o.mysteryHits += 1;

      switch (target.kind) {
        case 'pop': {
          const push = activePower === 'HEAVY' ? 20 : 14;
          applyRepelImpulse(rb, playerPos, target.pos, push);
          awardPoints(target.points, pos, tint, 'pop');
          break;
        }
        case 'slingshot': {
          const side = Math.sign(target.pos[0]) || 1;
          rb.applyImpulse({ x: -side * 11, y: 0.5, z: -10.5 }, true);
          awardPoints(target.points, pos, tint, 'slingshot');
          break;
        }
        case 'standup': {
          awardPoints(target.points, pos, tint, 'standup');
          break;
        }
        case 'drop': {
          if (target.active === false) break;
          awardPoints(target.points, pos, tint, 'drop');
          updateTargets((prev) =>
            prev.map((t) => (t.id === target.id ? { ...t, active: false } : t))
          );

          if (target.bank) {
            const bankTargets = targetsRef.current.filter((t) => t.bank === target.bank);
            const downCount = bankTargets.reduce(
              (sum, t) => sum + (t.id === target.id || t.active === false ? 1 : 0),
              0
            );

            if (downCount >= bankTargets.length && bankTargets.length > 0) {
              o.dropBanks.add(target.bank);
              const bankBonus = wizardActive ? 20000 : 11000;
              rolletteState.addScore(bankBonus);
              bonusBankRef.current += Math.floor(bankBonus * 0.25);
              rolletteState.setBonusBank(bonusBankRef.current);
              rolletteState.setToast(`DROP BANK CLEARED +${bankBonus.toLocaleString()}`);
              spawnImpact('jackpot', pos, theme.highlight);
              playSynth('jackpot', 1.1);

              queueTimer(() => {
                updateTargets((prev) =>
                  prev.map((t) =>
                    t.bank === target.bank
                      ? {
                          ...t,
                          active: true,
                        }
                      : t
                  )
                );
              }, 1400);
            }
          }

          evaluateModes();
          break;
        }
        case 'spinner': {
          const points = target.points + Math.floor(speed * 32);
          awardPoints(points, pos, tint, 'spinner');
          rb.applyImpulse({ x: Math.sign(target.pos[0]) * 1.8, y: 0, z: -2.5 }, true);
          evaluateModes();
          break;
        }
        case 'vari': {
          const powerScore = THREE.MathUtils.clamp(Math.floor(speed * 46), 320, 2800);
          awardPoints(powerScore, pos, tint, 'vari');
          applyRepelImpulse(rb, playerPos, target.pos, 10);
          break;
        }
        case 'bullOuter': {
          awardPoints(target.points, pos, tint, 'bullOuter');
          evaluateModes();
          break;
        }
        case 'bullCore': {
          o.bullseyeHits += 1;
          awardPoints(target.points + (wizardActive ? 4200 : 0), pos, theme.highlight, 'bullCore');
          evaluateModes();
          break;
        }
        case 'rollover': {
          o.rolloverHits += 1;
          awardPoints(target.points, pos, theme.accent, 'rollover');

          if (
            o.skillShotActive &&
            nowSec() - o.launchAt <= 8 &&
            target.id === layoutRef.current.skillShotTargetId
          ) {
            o.skillShotActive = false;
            const skillBonus = 7200;
            rolletteState.addScore(skillBonus);
            bonusBankRef.current += 1500;
            rolletteState.setBonusBank(bonusBankRef.current);
            rolletteState.setToast(`SKILL SHOT +${skillBonus.toLocaleString()}`);
            spawnImpact('jackpot', pos, theme.highlight);
            playSynth('jackpot', 1.05);
          }

          if (o.rolloverHits % 5 === 0) {
            rolletteState.activateMultiplier(2, 6);
            rolletteState.setToast('LANE COMBO x2');
          }
          break;
        }
        case 'ramp': {
          awardPoints(target.points, pos, tint, 'ramp');
          rb.applyImpulse({ x: 0, y: 0.12, z: -8.6 }, true);
          evaluateModes();
          break;
        }
        case 'orbit': {
          awardPoints(target.points, pos, tint, 'orbit');
          const side = Math.sign(target.pos[0]) || 1;
          rb.applyImpulse({ x: side * 5.4, y: 0.1, z: -6.8 }, true);
          evaluateModes();
          break;
        }
        case 'saucer': {
          if (activeSaucerRef.current) break;
          activeSaucerRef.current = target.id;

          awardPoints(target.points, pos, tint, 'saucer');

          rb.setTranslation({ x: target.pos[0], y: playerPos[1], z: target.pos[2] }, true);
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);

          queueTimer(() => {
            const sideKick = Math.sign(target.pos[0]) * -5;
            rb.applyImpulse({ x: sideKick, y: 0.52, z: -18 }, true);
            activeSaucerRef.current = null;
          }, 620);

          if (o.multiballLit) {
            const jackpot = o.jackpotValue;
            o.jackpotValue += 3200;
            o.multiballLit = false;
            setMultiballReady(false);
            o.multiballUntil = nowSec() + 18;
            rolletteState.addScore(jackpot);
            rolletteState.setToast(`MULTIBALL JACKPOT +${jackpot.toLocaleString()}`);
            spawnImpact('jackpot', pos, theme.highlight);
            playSynth('jackpot', 1.2);
          } else if (o.multiballUntil > nowSec()) {
            const superJackpot = 3600 + Math.floor(o.spinnerHits * 120 + o.orbitHits * 90);
            rolletteState.addScore(superJackpot);
            rolletteState.setToast(`SUPER JACKPOT +${superJackpot.toLocaleString()}`);
            spawnImpact('jackpot', pos, theme.highlight);
            playSynth('jackpot', 1.2);
          }

          break;
        }
        case 'mystery': {
          awardPoints(target.points, pos, tint, 'mystery');
          handleMysteryAward(target.pos);
          evaluateModes();
          break;
        }
        case 'magnet': {
          awardPoints(target.points, pos, tint, 'magnet');
          setPowerMode('MAGNET', 9);
          break;
        }
        case 'wormholeIn': {
          const exit = target.pairId ? targetMapRef.current[target.pairId] : null;
          if (!exit) break;

          const lv = rb.linvel();
          rb.setTranslation({ x: exit.pos[0], y: playerPos[1], z: exit.pos[2] }, true);
          rb.setLinvel(
            {
              x: lv.x * 1.1,
              y: lv.y,
              z: lv.z * 1.1 - 2.4,
            },
            true
          );
          targetLastHitRef.current[exit.id] = nowSec();
          awardPoints(target.points, pos, theme.accent, 'wormholeIn');
          break;
        }
        case 'kicker': {
          awardPoints(target.points, pos, tint, 'kicker');
          rb.applyImpulse({ x: 0, y: 0.58, z: -21 }, true);
          break;
        }
        case 'mini': {
          awardPoints(target.points, pos, theme.highlight, 'mini');
          break;
        }
        case 'wormholeOut': {
          break;
        }
        default:
          break;
      }
    },
    [
      activePower,
      applyRepelImpulse,
      awardPoints,
      evaluateModes,
      handleMysteryAward,
      playSynth,
      queueTimer,
      setPowerMode,
      spawnImpact,
      theme.accent,
      theme.hazard,
      theme.highlight,
      theme.secondary,
      updateTargets,
      wizardActive,
    ]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      ensureAudio();

      const key = e.key.toLowerCase();
      if (THEME_KEYS[key] && !e.repeat) {
        const next = THEME_KEYS[key];
        setThemeId(next);
        rolletteState.setToast(`${THEMES[next].name} loaded`);
        playSynth('mode');
        return;
      }

      if (key === 't' && !e.repeat) {
        setControlMode((prev) => {
          const next = prev === 'mouse' ? 'keyboard' : 'mouse';
          rolletteState.setToast(`CONTROL: ${next.toUpperCase()}`);
          return next;
        });
        playSynth('mode');
        return;
      }

      if (key === 'r' && !e.repeat) {
        resetRun();
        return;
      }

      if (key === 'w' || key === 'arrowup') keysRef.current.w = true;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = true;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = true;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = true;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) nudgeQueuedRef.current = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysRef.current.w = false;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = false;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = false;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = false;
    };

    const onBlur = () => {
      keysRef.current = { w: false, a: false, s: false, d: false };
      nudgeQueuedRef.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [ensureAudio, playSynth, resetRun]);

  useFrame((state, delta) => {
    const now = nowSec();

    if (pendingLaunchRef.current && ballRef.current) {
      const launchPos = pendingLaunchRef.current;
      pendingLaunchRef.current = null;
      launchBall(launchPos, true);
    }

    if (bursts.length) {
      const alive = bursts.filter((b) => now - b.bornAt <= b.life);
      if (alive.length !== bursts.length) setBursts(alive);
    }
    if (waves.length) {
      const alive = waves.filter((w) => now - w.bornAt <= w.life);
      if (alive.length !== waves.length) setWaves(alive);
    }
    if (flashes.length) {
      const alive = flashes.filter((f) => now - f.bornAt <= f.life);
      if (alive.length !== flashes.length) setFlashes(alive);
    }

    if (pausedRef.current || rolletteState.gameOver) return;

    rolletteState.tick(delta);

    const rb = ballRef.current;
    if (!rb) return;

    if (wizardActive && now >= wizardUntilRef.current) {
      setWizardActive(false);
      rolletteState.setToast('WIZARD MODE COMPLETE');
    }

    if (activePower && now >= powerUntilRef.current) {
      setPowerMode(null, 0);
      rolletteState.setToast('POWER DOWN');
    }

    const p = rb.translation();
    const v = rb.linvel();
    const playerPos: Vec3 = [p.x, p.y, p.z];

    const mini = layoutRef.current.miniZone;
    const inMini =
      Math.abs(playerPos[0] - mini.center[0]) <= mini.half[0] &&
      Math.abs(playerPos[2] - mini.center[2]) <= mini.half[1];
    rolletteState.inZone = inMini;

    if (objectivesRef.current.skillShotActive && now - objectivesRef.current.launchAt > 8) {
      objectivesRef.current.skillShotActive = false;
    }

    rb.setLinearDamping(activePower === 'GHOST' ? 0.03 : 0.08);
    rb.setAngularDamping(activePower === 'HEAVY' ? 0.32 : 0.45);
    rb.setGravityScale(activePower === 'HEAVY' ? 1.08 : 1, true);

    const controlsLocked = now < tiltLockUntilRef.current;
    if (controlsLocked) {
      if (now - tiltToastAtRef.current > 0.75) {
        tiltToastAtRef.current = now;
        rolletteState.setToast('TILT LOCK', 0.45);
      }
    } else if (controlMode === 'keyboard') {
      const ix = (keysRef.current.d ? 1 : 0) - (keysRef.current.a ? 1 : 0);
      const iz = (keysRef.current.s ? 1 : 0) - (keysRef.current.w ? 1 : 0);
      if (ix !== 0 || iz !== 0) {
        const len = Math.max(1, Math.hypot(ix, iz));
        const gain = activePower === 'HEAVY' ? 1.2 : 1;
        rb.setLinvel(
          {
            x: (ix / len) * CONTROL_SPEED * gain,
            y: v.y,
            z: (iz / len) * CONTROL_SPEED * gain,
          },
          true
        );
      } else {
        rb.setLinvel({ x: v.x * 0.94, y: v.y, z: v.z * 0.94 }, true);
      }
    } else {
      const gain = activePower === 'HEAVY' ? 1.18 : 1;
      rb.addForce(
        {
          x: mouseRef.current.x * MOUSE_FORCE * gain,
          y: 0,
          z: -mouseRef.current.y * MOUSE_FORCE * gain,
        },
        true
      );
    }

    const planarSpeed = Math.hypot(v.x, v.z);
    const maxSpeed = activePower === 'HEAVY' ? MAX_SPEED + 4 : MAX_SPEED;
    if (planarSpeed > maxSpeed) {
      const k = maxSpeed / planarSpeed;
      rb.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
    }

    if (nudgeQueuedRef.current) {
      nudgeQueuedRef.current = false;
      if (rolletteState.dashCooldown <= 0) {
        const nudges = nudgeTimesRef.current.filter((t) => now - t < NUDGE_WINDOW_S);
        nudgeTimesRef.current = [...nudges, now];

        if (nudgeTimesRef.current.length > MAX_NUDGES_PER_WINDOW) {
          tiltLockUntilRef.current = now + TILT_LOCK_S;
          rolletteState.setToast('TILT');
          rolletteState.takeDamage(4);
          playSynth('danger');
        } else if (now >= tiltLockUntilRef.current) {
          rb.applyImpulse(
            {
              x: (Math.random() - 0.5) * 4,
              y: 4.8,
              z: -2 + Math.random() * 4,
            },
            true
          );
          playSynth('nudge');
          spawnImpact('standup', [p.x, ITEM_Y + 0.35, p.z], theme.accent);
        }

        rolletteState.dashCooldown = NUDGE_COOLDOWN_S;
      }
    }

    const cameraTarget = inMini
      ? new THREE.Vector3(p.x * 0.27, p.y + 17.5, p.z + 18)
      : new THREE.Vector3(p.x * 0.22, p.y + 21, p.z + 30);
    camera.position.lerp(cameraTarget, 0.08);
    camera.lookAt(p.x, p.y + 1.1, p.z - 6);

    if (damageFlashRef.current > 0) {
      damageFlashRef.current = Math.max(0, damageFlashRef.current - delta * 1.7);
      camera.position.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * damageFlashRef.current * 0.9,
          0,
          (Math.random() - 0.5) * damageFlashRef.current * 0.9
        )
      );
    }

    if (shieldLightRef.current) {
      const fade = THREE.MathUtils.clamp(rolletteState.shieldTime / 0.8, 0, 1);
      shieldLightRef.current.intensity =
        rolletteState.shieldTime > 0 ? 0.42 + fade * 0.9 : 0;
      shieldLightRef.current.distance = 6 + fade * 2;
    }

    const obstacleNow = state.clock.elapsedTime;
    for (const obstacle of obstaclesRef.current) {
      const body = obstacleBodiesRef.current[obstacle.id];
      if (!body) continue;

      let x = obstacle.pos[0];
      let y = obstacle.pos[1];
      let z = obstacle.pos[2];

      if (obstacle.motion === 'slide') {
        const offset = Math.sin(obstacleNow * obstacle.speed) * obstacle.amp;
        if (obstacle.axis === 'x') x += offset;
        else z += offset;
      }

      if (obstacle.motion === 'pulse') {
        y += Math.sin(obstacleNow * obstacle.speed) * obstacle.amp * 0.32;
      }

      body.setNextKinematicTranslation({ x, y, z });

      if (obstacle.motion === 'rotate') {
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, obstacleNow * obstacle.speed, 0)
        );
        body.setNextKinematicRotation(q);
      }

      obstacleWorldRef.current[obstacle.id] = [x, y, z];

      const hitX = Math.abs(playerPos[0] - x) <= obstacle.size[0] * 0.54 + PLAYER_RADIUS;
      const hitZ = Math.abs(playerPos[2] - z) <= obstacle.size[2] * 0.54 + PLAYER_RADIUS;
      const hitY = Math.abs(playerPos[1] - y) <= obstacle.size[1] * 0.7 + PLAYER_RADIUS;

      const last = obstacleLastHitRef.current[obstacle.id] ?? -999;
      if (hitX && hitZ && hitY && now - last > 0.62) {
        obstacleLastHitRef.current[obstacle.id] = now;

        if (activePower !== 'GHOST') {
          if (activePower === 'HEAVY') {
            awardPoints(1200, [x, ITEM_Y + 0.45, z], theme.highlight, 'obstacle');
            rolletteState.setToast('HEAVY IMPACT +1,200', 0.45);
          } else {
            rolletteState.takeDamage(obstacle.damage);
            damageFlashRef.current = Math.min(0.82, damageFlashRef.current + 0.5);
            playSynth('danger');
            spawnImpact('obstacle', [x, ITEM_Y + 0.4, z], theme.hazard);
          }
          applyRepelImpulse(rb, playerPos, [x, y, z], 14);
        }
      }
    }

    for (const g of Object.values(spinnerRefs.current)) {
      if (g) g.rotation.y += delta * 8;
    }

    if (activePower === 'MAGNET') {
      const candidates = targetsRef.current.filter(
        (t) =>
          t.kind === 'bullCore' ||
          t.kind === 'saucer' ||
          t.kind === 'mystery' ||
          t.kind === 'kicker'
      );
      if (candidates.length) {
        let nearest = candidates[0];
        let best = Number.POSITIVE_INFINITY;
        for (const c of candidates) {
          const dx = c.pos[0] - playerPos[0];
          const dz = c.pos[2] - playerPos[2];
          const d2 = dx * dx + dz * dz;
          if (d2 < best) {
            best = d2;
            nearest = c;
          }
        }
        const dx = nearest.pos[0] - playerPos[0];
        const dz = nearest.pos[2] - playerPos[2];
        const d = Math.max(1, Math.hypot(dx, dz));
        rb.addForce({ x: (dx / d) * 24, y: 0, z: (dz / d) * 24 }, true);
      }
    }

    for (const target of targetsRef.current) {
      if (target.kind === 'wormholeOut') continue;
      if (target.kind === 'drop' && target.active === false) continue;

      const cooldown =
        target.kind === 'rollover' ? 0.28 : target.kind === 'spinner' ? 0.19 : 0.34;

      const last = targetLastHitRef.current[target.id] ?? -999;
      if (now - last < cooldown) continue;

      const dx = playerPos[0] - target.pos[0];
      const dz = playerPos[2] - target.pos[2];
      const hitRadius = target.radius + PLAYER_RADIUS * 0.82;

      if (dx * dx + dz * dz > hitRadius * hitRadius) continue;

      targetLastHitRef.current[target.id] = now;
      resolveTargetHit(target, playerPos, v, rb);
    }

    const drainGap = layoutRef.current.drainGap;
    if (p.z > ARENA_HALF + 2.8 && Math.abs(p.x) < drainGap * 0.54) {
      if (now - drainLockRef.current > 0.95) {
        drainLockRef.current = now;

        const o = objectivesRef.current;
        const endBonus =
          Math.floor(bonusBankRef.current) +
          o.dropBanks.size * 1200 +
          o.spinnerHits * 130 +
          o.bullseyeHits * 760 +
          o.orbitHits * 180 +
          o.rampHits * 200 +
          (o.multiballUntil > now ? 4200 : 0);

        if (endBonus > 0) {
          rolletteState.addScore(endBonus);
          rolletteState.setToast(`END OF BALL BONUS +${endBonus.toLocaleString()}`);
        }

        bonusBankRef.current = 0;
        rolletteState.setBonusBank(0);

        if (o.multiballUntil > now) {
          rolletteState.setToast('BALL SAVE');
          spawnImpact('drain', [p.x, ITEM_Y + 0.35, p.z], theme.hazard);
          queueTimer(() => launchBall(layoutRef.current.launch, false), 280);
        } else {
          rolletteState.takeDamage(24);
          damageFlashRef.current = Math.min(0.86, damageFlashRef.current + 0.52);
          spawnImpact('drain', [p.x, ITEM_Y + 0.35, p.z], theme.hazard);
          playSynth('danger', 1.2);
          if (!rolletteState.gameOver) {
            queueTimer(() => launchBall(layoutRef.current.launch, true), 420);
          }
        }
      }
    }
  });

  const floorColor = useMemo(() => new THREE.Color(theme.floor), [theme.floor]);

  const drainGap = layout.drainGap;
  const bottomSegmentWidth = (ARENA_SIZE - drainGap) / 2;
  const bottomSegmentHalf = bottomSegmentWidth / 2;

  return (
    <>
      <color attach="background" args={[theme.background]} />
      <Sky inclination={0.47} azimuth={0.18} distance={450000} />
      <Stars
        radius={280}
        depth={96}
        count={theme.id === 'cotton' ? 2500 : 3800}
        factor={4}
        saturation={0}
        fade
      />

      {theme.id === 'nebula' && (
        <Sparkles count={220} size={2.2} scale={[80, 24, 110]} color={theme.secondary} speed={0.24} />
      )}

      <ambientLight intensity={theme.id === 'nature' ? 0.36 : 0.42} />
      <directionalLight
        position={[16, 25, 12]}
        intensity={theme.id === 'cotton' ? 0.95 : 1.15}
        castShadow
      />
      <pointLight position={[0, 19, -12]} intensity={theme.glow} color={theme.accent} />
      <pointLight
        position={[0, 15, 20]}
        intensity={theme.glow * 0.58}
        color={theme.secondary}
      />
      {wizardActive && (
        <pointLight position={[0, 10, -24]} intensity={2.4} color={theme.highlight} />
      )}

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 right-4 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-white/90 text-xs backdrop-blur-sm">
          <div className="font-semibold tracking-wide">{theme.name}</div>
          <div>Controls: {controlMode === 'keyboard' ? 'Legacy Keyboard Velocity' : 'Legacy Mouse Force'}</div>
          <div>
            Mode:{' '}
            {wizardActive
              ? 'Wizard'
              : objectivesRef.current.multiballUntil > nowSec()
                ? 'Multiball'
                : multiballReady
                  ? 'Jackpot Lit'
                  : 'Build Objectives'}
          </div>
          <div>Power: {activePower ?? 'None'}</div>
        </div>
      </Html>

      <Physics gravity={[0, -25, 12]} interpolation={false}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            args={[ARENA_SIZE / 2, 0.2, ARENA_SIZE / 2]}
            position={[0, FLOOR_Y - 0.2, 0]}
            friction={0.1}
            restitution={0.66}
          />
          <CuboidCollider
            args={[ARENA_SIZE / 2 + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS]}
            position={[0, WALL_HEIGHT, -ARENA_HALF - WALL_THICKNESS]}
            restitution={0.84}
          />
          <CuboidCollider
            args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE / 2 + WALL_THICKNESS]}
            position={[-ARENA_HALF - WALL_THICKNESS, WALL_HEIGHT, 0]}
            restitution={0.84}
          />
          <CuboidCollider
            args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE / 2 + WALL_THICKNESS]}
            position={[ARENA_HALF + WALL_THICKNESS, WALL_HEIGHT, 0]}
            restitution={0.84}
          />
          <CuboidCollider
            args={[bottomSegmentHalf, WALL_HEIGHT, WALL_THICKNESS]}
            position={[
              -(drainGap / 2 + bottomSegmentHalf),
              WALL_HEIGHT,
              ARENA_HALF + WALL_THICKNESS,
            ]}
            restitution={0.84}
          />
          <CuboidCollider
            args={[bottomSegmentHalf, WALL_HEIGHT, WALL_THICKNESS]}
            position={[
              drainGap / 2 + bottomSegmentHalf,
              WALL_HEIGHT,
              ARENA_HALF + WALL_THICKNESS,
            ]}
            restitution={0.84}
          />
        </RigidBody>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
          <planeGeometry args={[ARENA_SIZE, ARENA_SIZE, 8, 8]} />
          <meshStandardMaterial
            color={floorColor}
            emissive={theme.floor}
            emissiveIntensity={theme.id === 'nebula' ? 0.26 : 0.14}
            roughness={theme.id === 'cotton' ? 0.62 : 0.42}
            metalness={theme.id === 'nebula' ? 0.3 : 0.12}
          />
        </mesh>

        <mesh position={[0, 0.36, -ARENA_HALF - WALL_THICKNESS]} castShadow>
          <boxGeometry args={[ARENA_SIZE + WALL_THICKNESS * 2, 0.72, WALL_THICKNESS * 2]} />
          <meshStandardMaterial color={theme.rail} emissive={theme.secondary} emissiveIntensity={0.16} />
        </mesh>
        <mesh position={[-ARENA_HALF - WALL_THICKNESS, 0.36, 0]} castShadow>
          <boxGeometry args={[WALL_THICKNESS * 2, 0.72, ARENA_SIZE + WALL_THICKNESS * 2]} />
          <meshStandardMaterial color={theme.rail} emissive={theme.secondary} emissiveIntensity={0.16} />
        </mesh>
        <mesh position={[ARENA_HALF + WALL_THICKNESS, 0.36, 0]} castShadow>
          <boxGeometry args={[WALL_THICKNESS * 2, 0.72, ARENA_SIZE + WALL_THICKNESS * 2]} />
          <meshStandardMaterial color={theme.rail} emissive={theme.secondary} emissiveIntensity={0.16} />
        </mesh>

        <mesh position={[0, 0.2, ARENA_HALF + WALL_THICKNESS + 0.02]}>
          <boxGeometry args={[drainGap, 0.42, WALL_THICKNESS]} />
          <meshStandardMaterial
            color={theme.hazard}
            emissive={theme.hazard}
            emissiveIntensity={0.45}
            transparent
            opacity={0.8}
          />
        </mesh>

        <mesh
          position={[
            layout.miniZone.center[0],
            ITEM_Y - 0.04,
            layout.miniZone.center[2],
          ]}
          receiveShadow
        >
          <boxGeometry
            args={[
              layout.miniZone.half[0] * 1.96,
              0.14,
              layout.miniZone.half[1] * 1.96,
            ]}
          />
          <meshStandardMaterial
            color={theme.id === 'nature' ? '#203a1f' : theme.id === 'cotton' ? '#fff2fb' : '#121a33'}
            emissive={theme.accent}
            emissiveIntensity={0.09}
            roughness={0.5}
            metalness={0.18}
          />
        </mesh>

        <ThemeDecor theme={theme} />

        {layout.ribbons.map((ribbon) => (
          <mesh
            key={ribbon.id}
            position={ribbon.pos as unknown as THREE.Vector3Tuple}
            rotation={[-Math.PI / 2 + (ribbon.tilt ?? 0), 0, 0]}
          >
            <ringGeometry args={[ribbon.inner, ribbon.outer, 48, 1, ribbon.start, ribbon.length]} />
            <meshStandardMaterial
              color={ribbon.tint ?? theme.laneTint}
              emissive={ribbon.tint ?? theme.laneTint}
              emissiveIntensity={
                ribbon.kind === 'orbit' ? 0.52 : ribbon.kind === 'ramp' ? 0.42 : 0.36
              }
              transparent
              opacity={theme.id === 'cotton' ? 0.55 : 0.48}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {obstacles.map((obstacle) => (
          <RigidBody
            key={obstacle.id}
            ref={(rb) => {
              obstacleBodiesRef.current[obstacle.id] = rb;
            }}
            type="kinematicPosition"
            colliders={false}
          >
            <CuboidCollider args={[obstacle.size[0] / 2, obstacle.size[1] / 2, obstacle.size[2] / 2]} />
            <mesh castShadow>
              <boxGeometry args={obstacle.size} />
              <meshStandardMaterial
                color={obstacle.tint}
                emissive={obstacle.tint}
                emissiveIntensity={0.58}
                roughness={0.34}
                metalness={0.3}
              />
            </mesh>
          </RigidBody>
        ))}

        <Player
          ballRef={ballRef}
          shieldLightRef={shieldLightRef}
          tint={theme.accent}
          glow={theme.secondary}
          powerMode={activePower}
        />

        {targets.map((target) => {
          const active = target.active !== false;
          const yOffset = target.kind === 'drop' && !active ? -0.92 : 0;

          const tint =
            target.tint ??
            (target.kind === 'drop'
              ? theme.highlight
              : target.kind === 'mystery'
                ? theme.highlight
                : target.kind === 'magnet'
                  ? theme.accent
                  : target.kind === 'slingshot'
                    ? theme.hazard
                    : theme.secondary);

          return (
            <group
              key={target.id}
              position={[target.pos[0], target.pos[1] + yOffset, target.pos[2]]}
              rotation={[0, target.yRot ?? 0, 0]}
            >
              {target.kind === 'pop' && (
                <mesh castShadow>
                  <cylinderGeometry args={[0.95, 1.12, 0.74, 22]} />
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.78} />
                </mesh>
              )}

              {target.kind === 'standup' && (
                <mesh castShadow>
                  <boxGeometry args={[1.02, 1.32, 0.32]} />
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.34} />
                </mesh>
              )}

              {target.kind === 'drop' && (
                <mesh castShadow>
                  <boxGeometry args={[1.14, 1.58, 0.36]} />
                  <meshStandardMaterial
                    color={tint}
                    emissive={tint}
                    emissiveIntensity={active ? 0.56 : 0.08}
                    opacity={active ? 1 : 0.35}
                    transparent
                  />
                </mesh>
              )}

              {target.kind === 'spinner' && (
                <group
                  ref={(g) => {
                    spinnerRefs.current[target.id] = g;
                  }}
                >
                  <mesh castShadow>
                    <boxGeometry args={[3.1, 0.24, 0.24]} />
                    <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.56} />
                  </mesh>
                </group>
              )}

              {target.kind === 'slingshot' && (
                <mesh castShadow rotation={[-Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[1.22, 1.25, 3]} />
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.46} />
                </mesh>
              )}

              {target.kind === 'vari' && (
                <group>
                  <mesh castShadow>
                    <boxGeometry args={[1.28, 1.02, 0.34]} />
                    <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.36} />
                  </mesh>
                  <mesh position={[0, 0, -0.75]}>
                    <boxGeometry args={[0.2, 0.2, 1.2]} />
                    <meshStandardMaterial color="#3a3a3a" />
                  </mesh>
                </group>
              )}

              {target.kind === 'bullOuter' && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[1.95, 0.26, 16, 40]} />
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.58} />
                </mesh>
              )}

              {target.kind === 'bullCore' && (
                <mesh>
                  <sphereGeometry args={[0.74, 18, 18]} />
                  <meshStandardMaterial
                    color={theme.highlight}
                    emissive={theme.highlight}
                    emissiveIntensity={1.05}
                  />
                </mesh>
              )}

              {target.kind === 'saucer' && (
                <mesh>
                  <cylinderGeometry args={[1.32, 1.52, 0.56, 24]} />
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.5} />
                </mesh>
              )}

              {target.kind === 'rollover' && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.9, 0.12, 10, 22]} />
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.54} />
                </mesh>
              )}

              {target.kind === 'ramp' && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[1.12, 1.78, 32, 1, 0.24, Math.PI * 1.2]} />
                  <meshStandardMaterial
                    color={tint}
                    emissive={tint}
                    emissiveIntensity={0.52}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              )}

              {target.kind === 'orbit' && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[1.24, 2.14, 40, 1, Math.PI * 0.15, Math.PI * 1.64]} />
                  <meshStandardMaterial
                    color={tint}
                    emissive={tint}
                    emissiveIntensity={0.54}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              )}

              {target.kind === 'magnet' && (
                <group>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.22, 0.21, 16, 36]} />
                    <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.74} />
                  </mesh>
                  <mesh>
                    <cylinderGeometry args={[0.45, 0.45, 0.65, 12]} />
                    <meshStandardMaterial color={theme.rail} />
                  </mesh>
                </group>
              )}

              {target.kind === 'wormholeIn' && (
                <group>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.06, 0.18, 16, 34]} />
                    <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.95} />
                  </mesh>
                  <pointLight color={tint} intensity={0.58} distance={4.5} />
                </group>
              )}

              {target.kind === 'wormholeOut' && (
                <mesh>
                  <sphereGeometry args={[0.52, 14, 14]} />
                  <meshStandardMaterial
                    color={theme.highlight}
                    emissive={theme.highlight}
                    emissiveIntensity={0.8}
                    transparent
                    opacity={0.5}
                  />
                </mesh>
              )}

              {target.kind === 'mystery' && (
                <mesh>
                  <cylinderGeometry args={[1.16, 1.3, 0.6, 18]} />
                  <meshStandardMaterial
                    color={theme.highlight}
                    emissive={theme.highlight}
                    emissiveIntensity={0.75}
                  />
                </mesh>
              )}

              {target.kind === 'kicker' && (
                <mesh>
                  <cylinderGeometry args={[0.9, 1.12, 0.62, 14]} />
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.54} />
                </mesh>
              )}

              {target.kind === 'mini' && (
                <mesh>
                  <octahedronGeometry args={[0.8, 0]} />
                  <meshStandardMaterial
                    color={theme.highlight}
                    emissive={theme.highlight}
                    emissiveIntensity={0.9}
                  />
                </mesh>
              )}
            </group>
          );
        })}

        {bursts.map((b) => (
          <BurstFX key={b.id} burst={b} />
        ))}

        {waves.map((w) => (
          <ImpactWave key={w.id} wave={w} />
        ))}

        {flashes.map((f) => (
          <ImpactFlash key={f.id} flash={f} />
        ))}
      </Physics>
    </>
  );
};
