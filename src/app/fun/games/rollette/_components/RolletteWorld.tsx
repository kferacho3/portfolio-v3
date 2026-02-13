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
  COMBO_WINDOW_S,
  CONTROL_SPEED,
  DRAIN_GAP,
  FLOOR_Y,
  GRAVITY,
  ITEM_Y,
  MAX_PLANAR_SPEED,
  MOUSE_FORCE,
  NUDGE_COOLDOWN_S,
  NUDGE_LIMIT,
  NUDGE_WINDOW_S,
  PLAYER_RADIUS,
  SKILL_SHOT_WINDOW_S,
  TILT_LOCK_S,
} from '../constants';
import { rolletteState } from '../state';
import type {
  ControlMode,
  ObjectiveTag,
  ObstacleMotion,
  PowerMode,
  TargetKind,
  ThemeId,
  Vec3,
} from '../types';
import { BurstFX, FlashFX, type Burst, type Flash, type Wave, WaveFX } from './BurstFX';
import { Player } from './Player';

const WALL_THICKNESS = 1.35;
const WALL_HEIGHT = 4;

const nowSec = () => performance.now() / 1000;

interface ThemeConfig {
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
  lane: string;
  glow: number;
}

interface ArenaTarget {
  id: string;
  kind: TargetKind;
  pos: Vec3;
  radius: number;
  points: number;
  active?: boolean;
  bank?: string;
  objective?: ObjectiveTag;
  pairId?: string;
  yRot?: number;
  tint?: string;
}

interface ArenaObstacle {
  id: string;
  pos: Vec3;
  size: [number, number, number];
  motion: ObstacleMotion;
  axis?: 'x' | 'z';
  amp: number;
  speed: number;
  damage: number;
  tint: string;
}

interface ArenaLane {
  id: string;
  pos: Vec3;
  inner: number;
  outer: number;
  start: number;
  length: number;
  kind: 'orbit' | 'ramp' | 'lane';
  tint?: string;
}

interface ArenaLayout {
  targets: ArenaTarget[];
  obstacles: ArenaObstacle[];
  lanes: ArenaLane[];
  miniZone: { center: Vec3; half: [number, number] };
  launch: Vec3;
  skillShotTargetId: string;
}

interface Objectives {
  dropBanks: Set<string>;
  spinnerHits: number;
  bullHits: number;
  orbitHits: number;
  rampHits: number;
  mysteryHits: number;
  captiveHits: number;
  gobbleHits: number;
  jackpotValue: number;
  skillShotActive: boolean;
  launchAt: number;
}

type SoundEvent =
  | 'target'
  | 'bumper'
  | 'drop'
  | 'jackpot'
  | 'nudge'
  | 'danger'
  | 'wizard'
  | 'mystery';

const THEMES: Record<ThemeId, ThemeConfig> = {
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
    lane: '#10d9ff',
    glow: 1.75,
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
    lane: '#dcaeff',
    glow: 1.05,
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
    lane: '#7ecf7d',
    glow: 0.95,
  },
  abyss: {
    id: 'abyss',
    name: 'Abyssal Current',
    background: '#010916',
    fog: '#031024',
    floor: '#072039',
    rail: '#0f3353',
    accent: '#24d8ff',
    secondary: '#4d9dff',
    hazard: '#0f5d86',
    highlight: '#8ff6ff',
    lane: '#3fc8ff',
    glow: 1.28,
  },
  forge: {
    id: 'forge',
    name: 'Volcanic Forge',
    background: '#140603',
    fog: '#2a0d05',
    floor: '#311109',
    rail: '#4a1d10',
    accent: '#ff6a2a',
    secondary: '#ffb347',
    hazard: '#d9361d',
    highlight: '#ffd88a',
    lane: '#ff7a34',
    glow: 1.38,
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Grid Matrix',
    background: '#03060f',
    fog: '#081324',
    floor: '#0b1020',
    rail: '#10223f',
    accent: '#00f0ff',
    secondary: '#ff4dff',
    hazard: '#ff2d7a',
    highlight: '#a5ff3d',
    lane: '#24c9ff',
    glow: 1.6,
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora Prism',
    background: '#081028',
    fog: '#101e3e',
    floor: '#172848',
    rail: '#20365f',
    accent: '#58ffd8',
    secondary: '#7f8bff',
    hazard: '#7e5adf',
    highlight: '#ddf9ff',
    lane: '#63b9ff',
    glow: 1.25,
  },
  desert: {
    id: 'desert',
    name: 'Desert Relic Run',
    background: '#1a1208',
    fog: '#2b1f11',
    floor: '#3a2a17',
    rail: '#5a3d1f',
    accent: '#e6c170',
    secondary: '#d6a85b',
    hazard: '#b46c2d',
    highlight: '#ffe2a9',
    lane: '#e4bf79',
    glow: 1.08,
  },
};

const THEME_KEYS: Record<string, ThemeId> = {
  '1': 'nebula',
  '2': 'cotton',
  '3': 'nature',
  '4': 'abyss',
  '5': 'forge',
  '6': 'cyber',
  '7': 'aurora',
  '8': 'desert',
};

const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const makeObjectives = (): Objectives => ({
  dropBanks: new Set<string>(),
  spinnerHits: 0,
  bullHits: 0,
  orbitHits: 0,
  rampHits: 0,
  mysteryHits: 0,
  captiveHits: 0,
  gobbleHits: 0,
  jackpotValue: 14000,
  skillShotActive: true,
  launchAt: nowSec(),
});

const canStartWizard = (o: Objectives) =>
  o.dropBanks.size >= 2 &&
  o.spinnerHits >= 8 &&
  o.bullHits >= 4 &&
  o.orbitHits >= 6 &&
  o.rampHits >= 6 &&
  o.mysteryHits >= 2;

const buildLayout = (theme: ThemeId): ArenaLayout => {
  const targets: ArenaTarget[] = [];
  const obstacles: ArenaObstacle[] = [];
  const lanes: ArenaLane[] = [];

  const mirrorTarget = (
    baseId: string,
    kind: TargetKind,
    x: number,
    z: number,
    cfg: Partial<ArenaTarget> = {}
  ) => {
    targets.push({
      id: `${baseId}-r`,
      kind,
      pos: [Math.abs(x), ITEM_Y + 0.45, z],
      radius: 1.4,
      points: 240,
      active: true,
      ...cfg,
    });
    targets.push({
      id: `${baseId}-l`,
      kind,
      pos: [-Math.abs(x), ITEM_Y + 0.45, z],
      radius: 1.4,
      points: 240,
      active: true,
      yRot: Math.PI,
      ...cfg,
    });
  };

  const mirrorLane = (
    baseId: string,
    x: number,
    z: number,
    cfg: Omit<ArenaLane, 'id' | 'pos'>
  ) => {
    lanes.push({ id: `${baseId}-r`, pos: [Math.abs(x), ITEM_Y - 0.07, z], ...cfg });
    lanes.push({ id: `${baseId}-l`, pos: [-Math.abs(x), ITEM_Y - 0.07, z], ...cfg });
  };

  if (theme === 'nebula') {
    for (const [i, z] of [-10, -15, -20, -25].entries()) {
      mirrorTarget(`n-drop-a-${i}`, 'drop', 16, z, {
        bank: z <= -20 ? 'n-bank-a2' : 'n-bank-a1',
        points: 1000,
        radius: 1.45,
        objective: 'drop',
      });
    }
    for (const [i, z] of [-30, -35, -40, -45].entries()) {
      mirrorTarget(`n-drop-b-${i}`, 'drop', 22, z, {
        bank: z <= -40 ? 'n-bank-b2' : 'n-bank-b1',
        points: 1200,
        radius: 1.48,
        objective: 'drop',
      });
    }

    for (const [i, z] of [-4, -12, -20, -28, -36].entries()) {
      mirrorTarget(`n-stand-${i}`, 'standup', 8, z, { points: 260, radius: 1.16 });
    }

    for (const [i, z] of [-14, -30].entries()) {
      mirrorTarget(`n-spin-${i}`, 'spinner', 24, z, {
        radius: 1.9,
        points: 420,
        objective: 'spinner',
      });
    }

    mirrorTarget('n-sling', 'sling', 12.3, 40, { radius: 2.15, points: 560 });
    mirrorTarget('n-vari', 'vari', 20.4, 22, { radius: 1.52, points: 700 });
    mirrorTarget('n-saucer', 'saucer', 9.2, -39, { radius: 1.75, points: 2100 });
    mirrorTarget('n-magnet', 'magnet', 8.2, -26, { radius: 2.1, points: 420 });
    mirrorTarget('n-orbit-a', 'orbit', 28, -4, {
      radius: 2.35,
      points: 900,
      objective: 'orbit',
    });
    mirrorTarget('n-orbit-b', 'orbit', 28, -24, {
      radius: 2.35,
      points: 950,
      objective: 'orbit',
    });
    mirrorTarget('n-ramp-a', 'ramp', 8, -8, {
      radius: 2.1,
      points: 1050,
      objective: 'ramp',
    });
    mirrorTarget('n-ramp-b', 'ramp', 13.2, -22, {
      radius: 1.9,
      points: 980,
      objective: 'ramp',
    });
    mirrorTarget('n-worm-in', 'wormIn', 24, 18, { radius: 1.9, points: 2600 });
    mirrorTarget('n-worm-out', 'wormOut', 6.4, -47, { radius: 1.5, points: 0 });
    mirrorTarget('n-mini', 'mini', 5.5, -48.5, { radius: 1.45, points: 980 });
    mirrorTarget('n-captive', 'captive', 18.6, -12, { radius: 1.35, points: 520 });

    targets.push({
      id: 'n-mini-core',
      kind: 'mini',
      pos: [0, ITEM_Y + 0.45, -49.5],
      radius: 1.5,
      points: 1450,
      active: true,
    });

    targets.push({
      id: 'n-bull-outer',
      kind: 'bullOuter',
      pos: [0, ITEM_Y + 0.4, -52.5],
      radius: 2.45,
      points: 1450,
      objective: 'bullseye',
      active: true,
    });

    targets.push({
      id: 'n-bull-inner',
      kind: 'bullInner',
      pos: [0, ITEM_Y + 0.45, -52.5],
      radius: 1.1,
      points: 4600,
      objective: 'bullseye',
      active: true,
    });

    targets.push({
      id: 'n-mystery',
      kind: 'mystery',
      pos: [0, ITEM_Y + 0.44, -18],
      radius: 1.6,
      points: 1800,
      objective: 'mystery',
      active: true,
    });

    targets.push({
      id: 'n-kicker',
      kind: 'kicker',
      pos: [0, ITEM_Y + 0.45, -37],
      radius: 1.5,
      points: 1100,
      active: true,
    });

    targets.push({
      id: 'n-gobble',
      kind: 'gobble',
      pos: [0, ITEM_Y + 0.43, -9],
      radius: 1.45,
      points: 7500,
      active: true,
    });

    for (const [i, x] of [-20, -10, 0, 10, 20].entries()) {
      targets.push({
        id: `n-roll-${i}`,
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
        id: `n-pop-${i}`,
        kind: 'pop',
        pos: [x, ITEM_Y + 0.45, z],
        radius: 1.72,
        points: 560,
        active: true,
      });
    }

    obstacles.push({
      id: 'n-obs-cross',
      pos: [0, ITEM_Y + 0.82, -12],
      size: [10.5, 0.95, 1.05],
      motion: 'rotate',
      amp: 0,
      speed: 1.55,
      damage: 11,
      tint: '#ff5a56',
    });

    obstacles.push({
      id: 'n-obs-gate-r',
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
      id: 'n-obs-gate-l',
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
      id: 'n-obs-core',
      pos: [0, ITEM_Y + 1.05, -29],
      size: [2.4, 2.5, 2.4],
      motion: 'pulse',
      amp: 2.8,
      speed: 1.8,
      damage: 10,
      tint: '#a958ff',
    });

    mirrorLane('n-lane-orbit', 26.5, -14, {
      kind: 'orbit',
      inner: 5.8,
      outer: 7.4,
      start: Math.PI * 0.05,
      length: Math.PI * 0.85,
    });

    mirrorLane('n-lane-ramp', 8.8, -19, {
      kind: 'ramp',
      inner: 3.6,
      outer: 5.1,
      start: Math.PI * 0.3,
      length: Math.PI * 0.72,
    });

    lanes.push({
      id: 'n-lane-center',
      kind: 'lane',
      pos: [0, ITEM_Y - 0.08, -38],
      inner: 2.8,
      outer: 4,
      start: Math.PI * 0.15,
      length: Math.PI * 1.7,
    });

    const rightIn = targets.find((t) => t.id === 'n-worm-in-r');
    const leftIn = targets.find((t) => t.id === 'n-worm-in-l');
    if (rightIn) rightIn.pairId = 'n-worm-out-r';
    if (leftIn) leftIn.pairId = 'n-worm-out-l';

    return {
      targets,
      obstacles,
      lanes,
      miniZone: { center: [0, ITEM_Y, -49], half: [12, 8] },
      launch: [0, 2.4, 45],
      skillShotTargetId: 'n-roll-2',
    };
  }

  if (theme === 'cotton') {
    for (const [i, z] of [-6, -11, -16, -21].entries()) {
      mirrorTarget(`c-drop-a-${i}`, 'drop', 12.5, z, {
        bank: z <= -16 ? 'c-bank-a2' : 'c-bank-a1',
        points: 980,
        radius: 1.35,
        objective: 'drop',
      });
    }

    for (const [i, z] of [-26, -31, -36, -41].entries()) {
      mirrorTarget(`c-drop-b-${i}`, 'drop', 18.5, z, {
        bank: z <= -36 ? 'c-bank-b2' : 'c-bank-b1',
        points: 1150,
        radius: 1.4,
        objective: 'drop',
      });
    }

    for (const [i, z] of [-4, -12, -20, -28, -36].entries()) {
      mirrorTarget(`c-stand-${i}`, 'standup', 7.2, z, { points: 250, radius: 1.12 });
    }

    for (const [i, z] of [-10, -30].entries()) {
      mirrorTarget(`c-spin-${i}`, 'spinner', 18.8, z, {
        radius: 1.82,
        points: 390,
        objective: 'spinner',
      });
    }

    mirrorTarget('c-sling', 'sling', 11.2, 39.2, { radius: 2.1, points: 560 });
    mirrorTarget('c-vari', 'vari', 19.5, 20, { radius: 1.45, points: 690 });
    mirrorTarget('c-saucer', 'saucer', 7.5, -33.5, { radius: 1.7, points: 1900 });
    mirrorTarget('c-magnet', 'magnet', 9.5, -21, { radius: 2, points: 420 });
    mirrorTarget('c-orbit-a', 'orbit', 23.8, -2.5, {
      radius: 2.25,
      points: 880,
      objective: 'orbit',
    });
    mirrorTarget('c-orbit-b', 'orbit', 23.8, -22.5, {
      radius: 2.25,
      points: 910,
      objective: 'orbit',
    });
    mirrorTarget('c-ramp-a', 'ramp', 5.8, -10.5, {
      radius: 1.95,
      points: 1020,
      objective: 'ramp',
    });
    mirrorTarget('c-ramp-b', 'ramp', 10.8, -24.5, {
      radius: 1.72,
      points: 930,
      objective: 'ramp',
    });
    mirrorTarget('c-worm-in', 'wormIn', 16.5, 16, { radius: 1.75, points: 2400 });
    mirrorTarget('c-worm-out', 'wormOut', 4.2, -35.2, { radius: 1.45, points: 0 });
    mirrorTarget('c-mini', 'mini', 5.8, -37.2, { radius: 1.3, points: 950 });
    mirrorTarget('c-captive', 'captive', 15.5, -16.5, { radius: 1.28, points: 500 });

    targets.push({
      id: 'c-mini-core',
      kind: 'mini',
      pos: [0, ITEM_Y + 0.45, -39.3],
      radius: 1.35,
      points: 1350,
      active: true,
    });

    targets.push({
      id: 'c-bull-outer',
      kind: 'bullOuter',
      pos: [0, ITEM_Y + 0.4, -41.5],
      radius: 2.3,
      points: 1400,
      objective: 'bullseye',
      active: true,
    });

    targets.push({
      id: 'c-bull-inner',
      kind: 'bullInner',
      pos: [0, ITEM_Y + 0.45, -41.5],
      radius: 1.02,
      points: 4300,
      objective: 'bullseye',
      active: true,
    });

    targets.push({
      id: 'c-mystery',
      kind: 'mystery',
      pos: [0, ITEM_Y + 0.44, -16],
      radius: 1.5,
      points: 1700,
      objective: 'mystery',
      active: true,
    });

    targets.push({
      id: 'c-kicker',
      kind: 'kicker',
      pos: [0, ITEM_Y + 0.45, -30.5],
      radius: 1.4,
      points: 1080,
      active: true,
    });

    targets.push({
      id: 'c-gobble',
      kind: 'gobble',
      pos: [0, ITEM_Y + 0.43, -5],
      radius: 1.42,
      points: 6900,
      active: true,
    });

    for (const [i, x] of [-16, -8, 0, 8, 16].entries()) {
      targets.push({
        id: `c-roll-${i}`,
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
        id: `c-pop-${i}`,
        kind: 'pop',
        pos: [x, ITEM_Y + 0.45, z],
        radius: 1.62,
        points: 530,
        active: true,
      });
    }

    obstacles.push({
      id: 'c-obs-pinwheel',
      pos: [0, ITEM_Y + 0.8, -8],
      size: [8.2, 0.85, 1],
      motion: 'rotate',
      amp: 0,
      speed: 1.15,
      damage: 8,
      tint: '#ff9bcf',
    });

    obstacles.push({
      id: 'c-obs-slide-r',
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
      id: 'c-obs-slide-l',
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
      id: 'c-obs-pulse',
      pos: [0, ITEM_Y + 1.05, -24],
      size: [2.1, 2.2, 2.1],
      motion: 'pulse',
      amp: 2.4,
      speed: 1.5,
      damage: 9,
      tint: '#e4b6ff',
    });

    mirrorLane('c-lane-orbit', 22.6, -12, {
      kind: 'orbit',
      inner: 5.4,
      outer: 6.9,
      start: Math.PI * 0.1,
      length: Math.PI * 0.92,
    });

    mirrorLane('c-lane-ramp', 6.5, -19.5, {
      kind: 'ramp',
      inner: 4.1,
      outer: 5.3,
      start: Math.PI * 0.24,
      length: Math.PI * 0.76,
    });

    lanes.push({
      id: 'c-lane-hub',
      kind: 'lane',
      pos: [0, ITEM_Y - 0.08, -26],
      inner: 5.5,
      outer: 7.1,
      start: Math.PI * 0.05,
      length: Math.PI * 1.9,
    });

    const rightIn = targets.find((t) => t.id === 'c-worm-in-r');
    const leftIn = targets.find((t) => t.id === 'c-worm-in-l');
    if (rightIn) rightIn.pairId = 'c-worm-out-r';
    if (leftIn) leftIn.pairId = 'c-worm-out-l';

    return {
      targets,
      obstacles,
      lanes,
      miniZone: { center: [0, ITEM_Y, -38.5], half: [11, 9] },
      launch: [0, 2.4, 45],
      skillShotTargetId: 'c-roll-2',
    };
  }

  for (const [i, z] of [-12, -18, -24, -30].entries()) {
    mirrorTarget(`g-drop-a-${i}`, 'drop', 17.8, z, {
      bank: z <= -24 ? 'g-bank-a2' : 'g-bank-a1',
      points: 1040,
      radius: 1.43,
      objective: 'drop',
    });
  }

  for (const [i, z] of [-34, -40, -46].entries()) {
    mirrorTarget(`g-drop-b-${i}`, 'drop', 22.8, z, {
      bank: z <= -40 ? 'g-bank-b2' : 'g-bank-b1',
      points: 1260,
      radius: 1.5,
      objective: 'drop',
    });
  }

  for (const [i, z] of [-8, -16, -24, -32].entries()) {
    mirrorTarget(`g-stand-${i}`, 'standup', 9.2, z, { points: 270, radius: 1.18 });
  }

  for (const [i, z] of [-24, -39].entries()) {
    mirrorTarget(`g-spin-${i}`, 'spinner', 23.2, z, {
      radius: 1.88,
      points: 430,
      objective: 'spinner',
    });
  }

  mirrorTarget('g-sling', 'sling', 13.7, 37.6, { radius: 2.15, points: 570 });
  mirrorTarget('g-vari', 'vari', 21.2, 19.4, { radius: 1.55, points: 710 });
  mirrorTarget('g-saucer', 'saucer', 9.4, -36, { radius: 1.75, points: 2050 });
  mirrorTarget('g-magnet', 'magnet', 10.2, -30.5, { radius: 2.15, points: 450 });
  mirrorTarget('g-orbit-a', 'orbit', 27.2, -7, {
    radius: 2.3,
    points: 920,
    objective: 'orbit',
  });
  mirrorTarget('g-orbit-b', 'orbit', 27.2, -29, {
    radius: 2.3,
    points: 980,
    objective: 'orbit',
  });
  mirrorTarget('g-ramp-a', 'ramp', 7.1, -22.5, {
    radius: 2,
    points: 1060,
    objective: 'ramp',
  });
  mirrorTarget('g-ramp-b', 'ramp', 13.5, -33.5, {
    radius: 1.8,
    points: 990,
    objective: 'ramp',
  });
  mirrorTarget('g-worm-in', 'wormIn', 25.4, 22, { radius: 1.82, points: 2500 });
  mirrorTarget('g-worm-out', 'wormOut', 7, -46.5, { radius: 1.55, points: 0 });
  mirrorTarget('g-mini', 'mini', 5.2, -49.2, { radius: 1.4, points: 1000 });
  mirrorTarget('g-captive', 'captive', 18.8, -18.5, { radius: 1.35, points: 520 });

  targets.push({
    id: 'g-mini-core',
    kind: 'mini',
    pos: [0, ITEM_Y + 0.45, -50.8],
    radius: 1.45,
    points: 1480,
    active: true,
  });

  targets.push({
    id: 'g-bull-outer',
    kind: 'bullOuter',
    pos: [0, ITEM_Y + 0.4, -53.3],
    radius: 2.45,
    points: 1500,
    objective: 'bullseye',
    active: true,
  });

  targets.push({
    id: 'g-bull-inner',
    kind: 'bullInner',
    pos: [0, ITEM_Y + 0.45, -53.3],
    radius: 1.1,
    points: 4700,
    objective: 'bullseye',
    active: true,
  });

  targets.push({
    id: 'g-mystery',
    kind: 'mystery',
    pos: [0, ITEM_Y + 0.44, -21.2],
    radius: 1.56,
    points: 1850,
    objective: 'mystery',
    active: true,
  });

  targets.push({
    id: 'g-kicker',
    kind: 'kicker',
    pos: [0, ITEM_Y + 0.45, -42],
    radius: 1.48,
    points: 1120,
    active: true,
  });

  targets.push({
    id: 'g-gobble',
    kind: 'gobble',
    pos: [0, ITEM_Y + 0.43, -10],
    radius: 1.46,
    points: 7800,
    active: true,
  });

  for (const [i, x] of [-20, -10, 0, 10, 20].entries()) {
    targets.push({
      id: `g-roll-${i}`,
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
      id: `g-pop-${i}`,
      kind: 'pop',
      pos: [x, ITEM_Y + 0.45, z],
      radius: 1.75,
      points: 560,
      active: true,
    });
  }

  obstacles.push({
    id: 'g-obs-branch',
    pos: [0, ITEM_Y + 0.84, -16],
    size: [9.8, 0.95, 1.05],
    motion: 'rotate',
    amp: 0,
    speed: 1.3,
    damage: 9,
    tint: '#7d522c',
  });

  obstacles.push({
    id: 'g-obs-log-r',
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
    id: 'g-obs-log-l',
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
    id: 'g-obs-root',
    pos: [0, ITEM_Y + 1.08, -34.5],
    size: [2.4, 2.6, 2.4],
    motion: 'pulse',
    amp: 2.6,
    speed: 1.7,
    damage: 10,
    tint: '#9f6f41',
  });

  mirrorLane('g-lane-orbit', 25.8, -18, {
    kind: 'orbit',
    inner: 6,
    outer: 7.5,
    start: Math.PI * 0.08,
    length: Math.PI * 0.9,
  });

  mirrorLane('g-lane-ramp', 8.2, -29, {
    kind: 'ramp',
    inner: 3.8,
    outer: 5.2,
    start: Math.PI * 0.24,
    length: Math.PI * 0.72,
  });

  lanes.push({
    id: 'g-lane-trunk',
    kind: 'lane',
    pos: [0, ITEM_Y - 0.08, -44],
    inner: 3.4,
    outer: 4.6,
    start: Math.PI * 0.14,
    length: Math.PI * 1.72,
  });

  const rightIn = targets.find((t) => t.id === 'g-worm-in-r');
  const leftIn = targets.find((t) => t.id === 'g-worm-in-l');
  if (rightIn) rightIn.pairId = 'g-worm-out-r';
  if (leftIn) leftIn.pairId = 'g-worm-out-l';

  return {
    targets,
    obstacles,
    lanes,
    miniZone: { center: [0, ITEM_Y, -50], half: [13, 7] },
    launch: [0, 2.4, 45],
    skillShotTargetId: 'g-roll-2',
  };
};

const ThemeDecor: React.FC<{ theme: ThemeConfig }> = ({ theme }) => {
  if (theme.id === 'cotton') {
    return (
      <group>
        {[-1, 1].map((side) => (
          <group key={`cotton-cloud-${side}`} position={[side * 22, ITEM_Y + 1.8, -24]}>
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
              <meshStandardMaterial color="#182649" emissive="#2a74ff" emissiveIntensity={0.35} metalness={0.65} roughness={0.25} />
            </mesh>
            <mesh position={[-26.5, ITEM_Y + 1.35, z]} castShadow>
              <cylinderGeometry args={[0.45, 0.65, 2.7, 14]} />
              <meshStandardMaterial color="#182649" emissive="#2a74ff" emissiveIntensity={0.35} metalness={0.65} roughness={0.25} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const soundForKind = (kind: TargetKind | 'obstacle' | 'drain' | 'jackpot'): SoundEvent => {
  switch (kind) {
    case 'pop':
    case 'sling':
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
  const [powerMode, setPowerMode] = useState<PowerMode>(null);

  const layout0 = useMemo(() => buildLayout('nebula'), []);
  const [layout, setLayout] = useState(layout0);
  const [targets, setTargets] = useState(layout0.targets);
  const [obstacles, setObstacles] = useState(layout0.obstacles);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [flashes, setFlashes] = useState<Flash[]>([]);

  const theme = THEMES[themeId];

  const ballRef = useRef<RapierRigidBody>(null);
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const nudgeQueuedRef = useRef(false);
  const nudgeTimesRef = useRef<number[]>([]);
  const tiltLockUntilRef = useRef(0);
  const tiltToastAtRef = useRef(0);
  const pausedRef = useRef(paused);

  const timersRef = useRef<number[]>([]);
  const pendingLaunchRef = useRef<Vec3 | null>(null);
  const drainLockRef = useRef(0);
  const activeSaucerRef = useRef<string | null>(null);

  const layoutRef = useRef(layout);
  const targetsRef = useRef(targets);
  const obstaclesRef = useRef(obstacles);
  const targetMapRef = useRef<Record<string, ArenaTarget>>(Object.fromEntries(targets.map((t) => [t.id, t])));

  const targetHitAtRef = useRef<Record<string, number>>({});
  const obstacleHitAtRef = useRef<Record<string, number>>({});
  const obstacleBodiesRef = useRef<Record<string, RapierRigidBody | null>>({});
  const spinnerRefs = useRef<Record<string, THREE.Group | null>>({});

  const objectivesRef = useRef<Objectives>(makeObjectives());

  const audioCtxRef = useRef<AudioContext | null>(null);

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
    rolletteState.setTheme(theme.id);
    return () => {
      scene.fog = null;
    };
  }, [gl, scene, theme]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current = [];
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
    },
    []
  );

  const queueTimer = useCallback((fn: () => void, ms: number) => {
    const timer = window.setTimeout(() => {
      fn();
      timersRef.current = timersRef.current.filter((t) => t !== timer);
    }, ms);
    timersRef.current.push(timer);
  }, []);

  const ensureAudio = useCallback(() => {
    if (!soundsOn || typeof window === 'undefined') return null;

    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      audioCtxRef.current = new Ctor();
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => undefined);
    }

    return audioCtxRef.current;
  }, [soundsOn]);

  const playTone = useCallback(
    (event: SoundEvent, velocity = 1) => {
      const ctx = ensureAudio();
      if (!ctx) return;

      const now = ctx.currentTime;

      const tone = (
        from: number,
        to: number,
        duration: number,
        type: OscillatorType,
        amp: number,
        delay = 0
      ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = now + delay;

        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(30, from), t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + duration);

        gain.gain.setValueAtTime(Math.max(0.0001, amp * velocity), t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
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
      } else if (event === 'wizard') {
        tone(260, 780, 0.22, 'sine', 0.035);
        tone(580, 1200, 0.16, 'triangle', 0.03, 0.08);
      } else if (event === 'mystery') {
        tone(330, 520, 0.09, 'triangle', 0.03);
        tone(540, 300, 0.11, 'triangle', 0.025, 0.08);
      }
    },
    [ensureAudio]
  );

  const spawnBurst = useCallback((pos: Vec3, color: string, count = 14, life = 0.6, shape: Burst['shape'] = 'spark') => {
    setBursts((prev) => [
      ...prev.slice(-80),
      {
        id: id('burst'),
        pos,
        color,
        count,
        life,
        shape,
        bornAt: nowSec(),
      },
    ]);
  }, []);

  const spawnWave = useCallback((pos: Vec3, color: string, life = 0.45, maxScale = 3.2) => {
    setWaves((prev) => [
      ...prev.slice(-40),
      { id: id('wave'), pos, color, bornAt: nowSec(), life, maxScale },
    ]);
  }, []);

  const spawnFlash = useCallback((pos: Vec3, color: string, life = 0.18, intensity = 1.6) => {
    setFlashes((prev) => [
      ...prev.slice(-40),
      { id: id('flash'), pos, color, bornAt: nowSec(), life, intensity },
    ]);
  }, []);

  const spawnImpact = useCallback(
    (kind: TargetKind | 'obstacle' | 'drain' | 'jackpot', pos: Vec3, color: string) => {
      if (kind === 'pop' || kind === 'sling') {
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
      } else if (kind === 'vari' || kind === 'bullInner' || kind === 'mini') {
        spawnBurst(pos, color, 22, 0.72, 'tetra');
        spawnWave(pos, color, 0.56, 3.8);
        spawnFlash([pos[0], pos[1] + 0.5, pos[2]], color, 0.22, 2.1);
      } else if (kind === 'mystery') {
        spawnBurst(pos, color, 34, 0.96, 'tetra');
        spawnBurst(pos, '#ffffff', 18, 0.66, 'spark');
        spawnWave(pos, color, 0.68, 4.6);
        spawnFlash([pos[0], pos[1] + 0.8, pos[2]], color, 0.24, 2.6);
      } else if (kind === 'wormIn') {
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

  const setPower = useCallback((mode: PowerMode, duration = 0) => {
    setPowerMode(mode);
    rolletteState.setPower(mode, duration);
    if (mode) rolletteState.setToast(`${mode} MODE`);
  }, []);

  const launchBall = useCallback((pos: Vec3, resetSkillShot = true) => {
    const rb = ballRef.current;
    if (!rb) {
      pendingLaunchRef.current = pos;
      return;
    }

    rb.setTranslation({ x: pos[0], y: pos[1], z: pos[2] }, true);
    rb.setLinvel({ x: 0, y: 0, z: -18 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);

    if (resetSkillShot) {
      objectivesRef.current.skillShotActive = true;
      objectivesRef.current.launchAt = nowSec();
    }
  }, []);

  const resetRun = useCallback(
    (nextTheme: ThemeId = themeId) => {
      const built = buildLayout(nextTheme);
      setLayout(built);
      setTargets(built.targets);
      setObstacles(built.obstacles);
      layoutRef.current = built;
      targetsRef.current = built.targets;
      obstaclesRef.current = built.obstacles;
      targetMapRef.current = Object.fromEntries(built.targets.map((t) => [t.id, t]));

      targetHitAtRef.current = {};
      obstacleHitAtRef.current = {};
      spinnerRefs.current = {};

      objectivesRef.current = makeObjectives();
      activeSaucerRef.current = null;
      drainLockRef.current = 0;

      setPower(null, 0);
      setBursts([]);
      setWaves([]);
      setFlashes([]);

      rolletteState.reset();
      rolletteState.health = 100;
      rolletteState.maxHealth = 100;
      rolletteState.nudgeCooldownMax = NUDGE_COOLDOWN_S;
      rolletteState.setToast('ROLETTE: PINBALL ULTIMATE');

      queueTimer(() => launchBall(built.launch, true), 40);
    },
    [launchBall, queueTimer, setPower, themeId]
  );

  useEffect(() => {
    resetRun(themeId);
    camera.position.set(0, 21, 34);
    camera.lookAt(0, 1, 0);
  }, [camera, resetRun, themeId]);

  const awardPoints = useCallback(
    (base: number, pos: Vec3, color: string, kind: TargetKind | 'obstacle' | 'drain' | 'jackpot') => {
      if (base <= 0) return;
      rolletteState.addComboPoints(base, rolletteState.inMiniZone);
      spawnImpact(kind, pos, color);
      playTone(soundForKind(kind), 1.05);
    },
    [playTone, spawnImpact]
  );

  const repel = useCallback((rb: RapierRigidBody, from: Vec3, center: Vec3, force = 12) => {
    const dx = from[0] - center[0];
    const dz = from[2] - center[2];
    const len = Math.max(1e-4, Math.hypot(dx, dz));
    rb.applyImpulse({ x: (dx / len) * force, y: 0.4, z: (dz / len) * force }, true);
  }, []);

  const evaluateProgress = useCallback(() => {
    const o = objectivesRef.current;

    if (!rolletteState.multiballLit && o.dropBanks.size >= 2 && o.spinnerHits >= 6) {
      rolletteState.setMultiballLit(true);
      rolletteState.setToast('MULTIBALL JACKPOT LIT');
      playTone('target', 1.1);
    }

    if (!rolletteState.wizardActive && canStartWizard(o)) {
      rolletteState.activateWizard(38);
      rolletteState.activateMultiplier(3, 38);
      rolletteState.setToast('WIZARD MODE ONLINE');
      playTone('wizard', 1.15);
    }
  }, [playTone]);

  const mysteryAward = useCallback(
    (pos: Vec3) => {
      const roll = Math.random();
      const o = objectivesRef.current;

      if (roll < 0.22) {
        const bonus = 2800 + Math.floor(Math.random() * 2800);
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
        setPower('HEAVY', 10);
      } else if (roll < 0.9) {
        setPower('GHOST', 8);
      } else if (roll < 0.97) {
        setPower('MAGNET', 10);
      } else {
        rolletteState.setMultiballLit(true);
        rolletteState.setToast('MYSTERY JACKPOT LIT');
      }

      o.mysteryHits += 1;
      spawnImpact('mystery', [pos[0], ITEM_Y + 0.55, pos[2]], theme.highlight);
      playTone('mystery', 1.2);
    },
    [playTone, setPower, spawnImpact, theme.highlight]
  );

  const setTargetsSafe = useCallback((updater: (prev: ArenaTarget[]) => ArenaTarget[]) => {
    setTargets((prev) => {
      const next = updater(prev);
      targetsRef.current = next;
      targetMapRef.current = Object.fromEntries(next.map((t) => [t.id, t]));
      return next;
    });
  }, []);

  const handleTargetHit = useCallback(
    (target: ArenaTarget, playerPos: Vec3, vel: { x: number; y: number; z: number }, rb: RapierRigidBody) => {
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
              : target.kind === 'sling'
                ? theme.hazard
                : theme.secondary);

      if (target.objective === 'spinner') o.spinnerHits += 1;
      if (target.objective === 'bullseye') o.bullHits += 1;
      if (target.objective === 'orbit') o.orbitHits += 1;
      if (target.objective === 'ramp') o.rampHits += 1;
      if (target.objective === 'mystery') o.mysteryHits += 1;

      switch (target.kind) {
        case 'standup': {
          awardPoints(target.points, pos, tint, 'standup');
          break;
        }

        case 'drop': {
          if (target.active === false) break;
          awardPoints(target.points, pos, tint, 'drop');

          setTargetsSafe((prev) => prev.map((t) => (t.id === target.id ? { ...t, active: false } : t)));

          if (target.bank) {
            const bank = targetsRef.current.filter((t) => t.bank === target.bank);
            const down = bank.reduce((sum, t) => sum + (t.id === target.id || t.active === false ? 1 : 0), 0);

            if (down >= bank.length && bank.length > 0) {
              o.dropBanks.add(target.bank);
              const bankBonus = rolletteState.wizardActive ? 20000 : 11000;
              rolletteState.addScore(bankBonus);
              rolletteState.addBank(bankBonus * 0.25);
              rolletteState.setToast(`DROP BANK CLEARED +${bankBonus.toLocaleString()}`);
              spawnImpact('jackpot', pos, theme.highlight);
              playTone('jackpot', 1.1);

              queueTimer(() => {
                setTargetsSafe((prev) => prev.map((t) => (t.bank === target.bank ? { ...t, active: true } : t)));
              }, 1400);
            }
          }

          evaluateProgress();
          break;
        }

        case 'pop': {
          const kick = powerMode === 'HEAVY' ? 20 : 14;
          repel(rb, playerPos, target.pos, kick);
          awardPoints(target.points, pos, tint, 'pop');
          break;
        }

        case 'spinner': {
          const points = target.points + Math.floor(speed * 30);
          awardPoints(points, pos, tint, 'spinner');
          rb.applyImpulse({ x: Math.sign(target.pos[0]) * 1.8, y: 0, z: -2.6 }, true);
          evaluateProgress();
          break;
        }

        case 'sling': {
          const side = Math.sign(target.pos[0]) || 1;
          rb.applyImpulse({ x: -side * 11, y: 0.5, z: -10.5 }, true);
          awardPoints(target.points, pos, tint, 'sling');
          break;
        }

        case 'vari': {
          const powerScore = THREE.MathUtils.clamp(Math.floor(speed * 46), 320, 2800);
          awardPoints(powerScore, pos, tint, 'vari');
          repel(rb, playerPos, target.pos, 10);
          break;
        }

        case 'bullOuter': {
          awardPoints(target.points, pos, tint, 'bullOuter');
          evaluateProgress();
          break;
        }

        case 'bullInner': {
          o.bullHits += 1;
          awardPoints(target.points + (rolletteState.wizardActive ? 4200 : 0), pos, theme.highlight, 'bullInner');
          evaluateProgress();
          break;
        }

        case 'rollover': {
          awardPoints(target.points, pos, theme.accent, 'rollover');

          if (
            o.skillShotActive &&
            nowSec() - o.launchAt <= SKILL_SHOT_WINDOW_S &&
            target.id === layoutRef.current.skillShotTargetId
          ) {
            o.skillShotActive = false;
            const bonus = 7200;
            rolletteState.addScore(bonus);
            rolletteState.addBank(1500);
            rolletteState.setToast(`SKILL SHOT +${bonus.toLocaleString()}`);
            spawnImpact('jackpot', pos, theme.highlight);
            playTone('jackpot', 1.05);
          }
          break;
        }

        case 'ramp': {
          awardPoints(target.points, pos, tint, 'ramp');
          rb.applyImpulse({ x: 0, y: 0.12, z: -8.6 }, true);
          evaluateProgress();
          break;
        }

        case 'orbit': {
          awardPoints(target.points, pos, tint, 'orbit');
          const side = Math.sign(target.pos[0]) || 1;
          rb.applyImpulse({ x: side * 5.4, y: 0.1, z: -6.8 }, true);
          evaluateProgress();
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

          if (rolletteState.multiballLit) {
            const jackpot = o.jackpotValue;
            o.jackpotValue += 3200;
            rolletteState.setMultiballLit(false);
            rolletteState.activateMultiball(18);
            rolletteState.addScore(jackpot);
            rolletteState.setToast(`MULTIBALL JACKPOT +${jackpot.toLocaleString()}`);
            spawnImpact('jackpot', pos, theme.highlight);
            playTone('jackpot', 1.2);
          } else if (rolletteState.multiballActive) {
            const superJackpot = 3600 + Math.floor(o.spinnerHits * 120 + o.orbitHits * 90);
            rolletteState.addScore(superJackpot);
            rolletteState.setToast(`SUPER JACKPOT +${superJackpot.toLocaleString()}`);
            spawnImpact('jackpot', pos, theme.highlight);
            playTone('jackpot', 1.2);
          }

          break;
        }

        case 'mystery': {
          awardPoints(target.points, pos, tint, 'mystery');
          mysteryAward(target.pos);
          evaluateProgress();
          break;
        }

        case 'magnet': {
          awardPoints(target.points, pos, tint, 'magnet');
          setPower('MAGNET', 9);
          break;
        }

        case 'wormIn': {
          const exit = target.pairId ? targetMapRef.current[target.pairId] : null;
          if (!exit) break;
          const lv = rb.linvel();
          rb.setTranslation({ x: exit.pos[0], y: playerPos[1], z: exit.pos[2] }, true);
          rb.setLinvel({ x: lv.x * 1.1, y: lv.y, z: lv.z * 1.1 - 2.4 }, true);
          targetHitAtRef.current[exit.id] = nowSec();
          awardPoints(target.points, pos, theme.accent, 'wormIn');
          break;
        }

        case 'wormOut': {
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

        case 'captive': {
          o.captiveHits += 1;
          const captivePts = target.points + Math.min(1800, o.captiveHits * 140);
          awardPoints(captivePts, pos, tint, 'captive');
          repel(rb, playerPos, target.pos, 9);
          if (o.captiveHits % 5 === 0) {
            rolletteState.activateMultiplier(2, 6);
            rolletteState.setToast('CAPTIVE COMBO x2');
          }
          break;
        }

        case 'gobble': {
          o.gobbleHits += 1;
          const gobbleBonus = target.points + Math.min(12000, o.gobbleHits * 900);
          rolletteState.addScore(gobbleBonus);
          rolletteState.setToast(`GOBBLE +${gobbleBonus.toLocaleString()}`);
          spawnImpact('jackpot', pos, theme.highlight);
          playTone('jackpot', 1.25);
          queueTimer(() => launchBall(layoutRef.current.launch, false), 260);
          break;
        }
      }
    },
    [
      awardPoints,
      evaluateProgress,
      launchBall,
      mysteryAward,
      playTone,
      powerMode,
      queueTimer,
      repel,
      setPower,
      setTargetsSafe,
      spawnImpact,
      theme.accent,
      theme.hazard,
      theme.highlight,
      theme.secondary,
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
        playTone('target', 1.08);
        return;
      }

      if (key === 't' && !e.repeat) {
        setControlMode((prev) => {
          const next = prev === 'mouse' ? 'keyboard' : 'mouse';
          rolletteState.setToast(`CONTROL: ${next.toUpperCase()}`);
          return next;
        });
        playTone('target', 1.06);
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
  }, [ensureAudio, playTone, resetRun]);

  useFrame((state, delta) => {
    const now = nowSec();

    if (pendingLaunchRef.current && ballRef.current) {
      const pos = pendingLaunchRef.current;
      pendingLaunchRef.current = null;
      launchBall(pos, true);
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

    if (powerMode !== rolletteState.powerMode) {
      setPowerMode(rolletteState.powerMode);
    }

    const rb = ballRef.current;
    if (!rb) return;

    const p = rb.translation();
    const v = rb.linvel();
    const playerPos: Vec3 = [p.x, p.y, p.z];

    const mini = layoutRef.current.miniZone;
    rolletteState.inMiniZone =
      Math.abs(playerPos[0] - mini.center[0]) <= mini.half[0] &&
      Math.abs(playerPos[2] - mini.center[2]) <= mini.half[1];

    if (objectivesRef.current.skillShotActive && now - objectivesRef.current.launchAt > SKILL_SHOT_WINDOW_S) {
      objectivesRef.current.skillShotActive = false;
    }

    rb.setLinearDamping(powerMode === 'GHOST' ? 0.03 : 0.08);
    rb.setAngularDamping(powerMode === 'HEAVY' ? 0.32 : 0.45);
    rb.setGravityScale(powerMode === 'HEAVY' ? 1.08 : 1, true);

    if (powerMode === 'HEAVY') {
      rb.setAdditionalMass(45, true);
    } else {
      rb.setAdditionalMass(0, true);
    }

    const locked = now < tiltLockUntilRef.current;
    if (locked) {
      if (now - tiltToastAtRef.current > 0.75) {
        tiltToastAtRef.current = now;
        rolletteState.setToast('TILT LOCK', 0.45);
      }
    } else if (controlMode === 'keyboard') {
      const ix = (keysRef.current.d ? 1 : 0) - (keysRef.current.a ? 1 : 0);
      const iz = (keysRef.current.s ? 1 : 0) - (keysRef.current.w ? 1 : 0);

      if (ix !== 0 || iz !== 0) {
        const len = Math.max(1, Math.hypot(ix, iz));
        const gain = powerMode === 'HEAVY' ? 1.2 : 1;
        rb.setLinvel({ x: (ix / len) * CONTROL_SPEED * gain, y: v.y, z: (iz / len) * CONTROL_SPEED * gain }, true);
      } else {
        rb.setLinvel({ x: v.x * 0.94, y: v.y, z: v.z * 0.94 }, true);
      }
    } else {
      const gain = powerMode === 'HEAVY' ? 1.18 : 1;
      rb.addForce({ x: mouseRef.current.x * MOUSE_FORCE * gain, y: 0, z: -mouseRef.current.y * MOUSE_FORCE * gain }, true);
    }

    const planar = Math.hypot(v.x, v.z);
    const cap = powerMode === 'HEAVY' ? MAX_PLANAR_SPEED + 4 : MAX_PLANAR_SPEED;
    if (planar > cap) {
      const k = cap / planar;
      rb.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
    }

    if (nudgeQueuedRef.current) {
      nudgeQueuedRef.current = false;
      if (rolletteState.nudgeCooldown <= 0) {
        const fresh = nudgeTimesRef.current.filter((t) => now - t < NUDGE_WINDOW_S);
        nudgeTimesRef.current = [...fresh, now];

        if (nudgeTimesRef.current.length > NUDGE_LIMIT) {
          tiltLockUntilRef.current = now + TILT_LOCK_S;
          rolletteState.setToast('TILT');
          rolletteState.takeDamage(4);
          playTone('danger');
        } else if (now >= tiltLockUntilRef.current) {
          rb.applyImpulse({ x: (Math.random() - 0.5) * 4, y: 4.8, z: -2 + Math.random() * 4 }, true);
          playTone('nudge');
          spawnImpact('standup', [p.x, ITEM_Y + 0.35, p.z], theme.accent);
        }

        rolletteState.nudgeCooldown = NUDGE_COOLDOWN_S;
      }
    }

    const camTarget = rolletteState.inMiniZone
      ? new THREE.Vector3(p.x * 0.27, p.y + 17.5, p.z + 18)
      : new THREE.Vector3(p.x * 0.22, p.y + 21, p.z + 30);

    camera.position.lerp(camTarget, 0.08);
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
      shieldLightRef.current.intensity = rolletteState.shieldTime > 0 ? 0.42 + fade * 0.9 : 0;
      shieldLightRef.current.distance = 6 + fade * 2;
    }

    const t = state.clock.elapsedTime;

    for (const obstacle of obstaclesRef.current) {
      const body = obstacleBodiesRef.current[obstacle.id];
      if (!body) continue;

      let x = obstacle.pos[0];
      let y = obstacle.pos[1];
      let z = obstacle.pos[2];

      if (obstacle.motion === 'slide') {
        const offset = Math.sin(t * obstacle.speed) * obstacle.amp;
        if (obstacle.axis === 'x') x += offset;
        else z += offset;
      }

      if (obstacle.motion === 'pulse') {
        y += Math.sin(t * obstacle.speed) * obstacle.amp * 0.32;
      }

      body.setNextKinematicTranslation({ x, y, z });

      if (obstacle.motion === 'rotate') {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t * obstacle.speed, 0));
        body.setNextKinematicRotation(q);
      }

      const hitX = Math.abs(playerPos[0] - x) <= obstacle.size[0] * 0.54 + PLAYER_RADIUS;
      const hitZ = Math.abs(playerPos[2] - z) <= obstacle.size[2] * 0.54 + PLAYER_RADIUS;
      const hitY = Math.abs(playerPos[1] - y) <= obstacle.size[1] * 0.7 + PLAYER_RADIUS;

      const last = obstacleHitAtRef.current[obstacle.id] ?? -999;
      if (hitX && hitZ && hitY && now - last > 0.62) {
        obstacleHitAtRef.current[obstacle.id] = now;

        if (powerMode !== 'GHOST') {
          if (powerMode === 'HEAVY') {
            awardPoints(1200, [x, ITEM_Y + 0.45, z], theme.highlight, 'obstacle');
            rolletteState.setToast('HEAVY IMPACT +1,200', 0.45);
          } else {
            rolletteState.takeDamage(obstacle.damage);
            damageFlashRef.current = Math.min(0.82, damageFlashRef.current + 0.5);
            playTone('danger');
            spawnImpact('obstacle', [x, ITEM_Y + 0.4, z], theme.hazard);
          }
          repel(rb, playerPos, [x, y, z], 14);
        }
      }
    }

    for (const spinner of Object.values(spinnerRefs.current)) {
      if (spinner) spinner.rotation.y += delta * 8;
    }

    if (powerMode === 'MAGNET') {
      const hi = targetsRef.current.filter(
        (target) => target.kind === 'bullInner' || target.kind === 'saucer' || target.kind === 'mystery' || target.kind === 'kicker'
      );

      if (hi.length) {
        let nearest = hi[0];
        let best = Number.POSITIVE_INFINITY;

        for (const h of hi) {
          const dx = h.pos[0] - playerPos[0];
          const dz = h.pos[2] - playerPos[2];
          const d2 = dx * dx + dz * dz;
          if (d2 < best) {
            best = d2;
            nearest = h;
          }
        }

        const dx = nearest.pos[0] - playerPos[0];
        const dz = nearest.pos[2] - playerPos[2];
        const d = Math.max(1, Math.hypot(dx, dz));

        rb.addForce({ x: (dx / d) * 24, y: 0, z: (dz / d) * 24 }, true);
      }
    }

    for (const target of targetsRef.current) {
      if (target.kind === 'wormOut') continue;
      if (target.kind === 'drop' && target.active === false) continue;

      const cooldown = target.kind === 'rollover' ? 0.28 : target.kind === 'spinner' ? 0.19 : 0.34;
      const last = targetHitAtRef.current[target.id] ?? -999;
      if (now - last < cooldown) continue;

      const dx = playerPos[0] - target.pos[0];
      const dz = playerPos[2] - target.pos[2];
      const hitRadius = target.radius + PLAYER_RADIUS * 0.82;

      if (dx * dx + dz * dz > hitRadius * hitRadius) continue;

      targetHitAtRef.current[target.id] = now;
      handleTargetHit(target, playerPos, v, rb);
    }

    if (p.z > ARENA_HALF + 2.8 && Math.abs(p.x) < DRAIN_GAP * 0.54) {
      if (now - drainLockRef.current > 0.95) {
        drainLockRef.current = now;

        const o = objectivesRef.current;
        const endBonus =
          Math.floor(rolletteState.bonusBank) +
          o.dropBanks.size * 1200 +
          o.spinnerHits * 130 +
          o.bullHits * 760 +
          o.orbitHits * 180 +
          o.rampHits * 200 +
          (rolletteState.multiballActive ? 4200 : 0);

        if (endBonus > 0) {
          rolletteState.addScore(endBonus);
          rolletteState.setToast(`END OF BALL BONUS +${endBonus.toLocaleString()}`);
        }

        rolletteState.clearBank();

        if (rolletteState.multiballActive) {
          rolletteState.setToast('BALL SAVE');
          spawnImpact('drain', [p.x, ITEM_Y + 0.35, p.z], theme.hazard);
          queueTimer(() => launchBall(layoutRef.current.launch, false), 280);
        } else {
          rolletteState.takeDamage(24);
          damageFlashRef.current = Math.min(0.86, damageFlashRef.current + 0.52);
          spawnImpact('drain', [p.x, ITEM_Y + 0.35, p.z], theme.hazard);
          playTone('danger', 1.2);

          if (!rolletteState.gameOver) {
            queueTimer(() => launchBall(layoutRef.current.launch, true), 420);
          }
        }
      }
    }
  });

  const floorColor = useMemo(() => new THREE.Color(theme.floor), [theme.floor]);

  return (
    <>
      <color attach="background" args={[theme.background]} />
      <Sky inclination={0.47} azimuth={0.18} distance={450000} />
      <Stars radius={280} depth={96} count={theme.id === 'cotton' ? 2500 : 3800} factor={4} saturation={0} fade />

      {theme.id === 'nebula' && (
        <Sparkles count={220} size={2.2} scale={[80, 24, 110]} color={theme.secondary} speed={0.24} />
      )}

      <ambientLight intensity={theme.id === 'nature' ? 0.36 : 0.42} />
      <directionalLight position={[16, 25, 12]} intensity={theme.id === 'cotton' ? 0.95 : 1.15} castShadow />
      <pointLight position={[0, 19, -12]} intensity={theme.glow} color={theme.accent} />
      <pointLight position={[0, 15, 20]} intensity={theme.glow * 0.58} color={theme.secondary} />
      {rolletteState.wizardActive && <pointLight position={[0, 10, -24]} intensity={2.4} color={theme.highlight} />}

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 right-4 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-white/90 text-xs backdrop-blur-sm">
          <div className="font-semibold tracking-wide">{theme.name}</div>
          <div>Controls: {controlMode === 'keyboard' ? 'Legacy Keyboard Velocity' : 'Legacy Mouse Force'}</div>
          <div>
            Mode:{' '}
            {rolletteState.wizardActive
              ? 'Wizard'
              : rolletteState.multiballActive
                ? 'Multiball'
                : rolletteState.multiballLit
                  ? 'Jackpot Lit'
                  : 'Build Objectives'}
          </div>
          <div>Power: {powerMode ?? 'None'}</div>
        </div>
      </Html>

      <Physics gravity={GRAVITY} interpolation={false}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[ARENA_SIZE / 2, 0.2, ARENA_SIZE / 2]} position={[0, FLOOR_Y - 0.2, 0]} friction={0.1} restitution={0.66} />
          <CuboidCollider args={[ARENA_SIZE / 2 + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS]} position={[0, WALL_HEIGHT, -ARENA_HALF - WALL_THICKNESS]} restitution={0.84} />
          <CuboidCollider args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE / 2 + WALL_THICKNESS]} position={[-ARENA_HALF - WALL_THICKNESS, WALL_HEIGHT, 0]} restitution={0.84} />
          <CuboidCollider args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE / 2 + WALL_THICKNESS]} position={[ARENA_HALF + WALL_THICKNESS, WALL_HEIGHT, 0]} restitution={0.84} />

          <CuboidCollider args={[(ARENA_SIZE - DRAIN_GAP) / 4, WALL_HEIGHT, WALL_THICKNESS]} position={[-(DRAIN_GAP / 2 + (ARENA_SIZE - DRAIN_GAP) / 4), WALL_HEIGHT, ARENA_HALF + WALL_THICKNESS]} restitution={0.84} />
          <CuboidCollider args={[(ARENA_SIZE - DRAIN_GAP) / 4, WALL_HEIGHT, WALL_THICKNESS]} position={[DRAIN_GAP / 2 + (ARENA_SIZE - DRAIN_GAP) / 4, WALL_HEIGHT, ARENA_HALF + WALL_THICKNESS]} restitution={0.84} />
        </RigidBody>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
          <planeGeometry args={[ARENA_SIZE, ARENA_SIZE, 8, 8]} />
          <meshStandardMaterial color={floorColor} emissive={theme.floor} emissiveIntensity={theme.id === 'nebula' ? 0.26 : 0.14} roughness={theme.id === 'cotton' ? 0.62 : 0.42} metalness={theme.id === 'nebula' ? 0.3 : 0.12} />
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
          <boxGeometry args={[DRAIN_GAP, 0.42, WALL_THICKNESS]} />
          <meshStandardMaterial color={theme.hazard} emissive={theme.hazard} emissiveIntensity={0.45} transparent opacity={0.8} />
        </mesh>

        <mesh position={[layout.miniZone.center[0], ITEM_Y - 0.04, layout.miniZone.center[2]]} receiveShadow>
          <boxGeometry args={[layout.miniZone.half[0] * 1.96, 0.14, layout.miniZone.half[1] * 1.96]} />
          <meshStandardMaterial color={theme.id === 'nature' ? '#203a1f' : theme.id === 'cotton' ? '#fff2fb' : '#121a33'} emissive={theme.accent} emissiveIntensity={0.09} roughness={0.5} metalness={0.18} />
        </mesh>

        <ThemeDecor theme={theme} />

        {layout.lanes.map((lane) => (
          <mesh key={lane.id} position={lane.pos as unknown as THREE.Vector3Tuple} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[lane.inner, lane.outer, 48, 1, lane.start, lane.length]} />
            <meshStandardMaterial
              color={lane.tint ?? theme.lane}
              emissive={lane.tint ?? theme.lane}
              emissiveIntensity={lane.kind === 'orbit' ? 0.52 : lane.kind === 'ramp' ? 0.42 : 0.36}
              transparent
              opacity={theme.id === 'cotton' ? 0.55 : 0.48}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {obstacles.map((obstacle) => (
          <RigidBody key={obstacle.id} ref={(rb) => { obstacleBodiesRef.current[obstacle.id] = rb; }} type="kinematicPosition" colliders={false}>
            <CuboidCollider args={[obstacle.size[0] / 2, obstacle.size[1] / 2, obstacle.size[2] / 2]} />
            <mesh castShadow>
              <boxGeometry args={obstacle.size} />
              <meshStandardMaterial color={obstacle.tint} emissive={obstacle.tint} emissiveIntensity={0.58} roughness={0.34} metalness={0.3} />
            </mesh>
          </RigidBody>
        ))}

        <Player ballRef={ballRef} shieldLightRef={shieldLightRef} tint={theme.accent} glow={theme.secondary} powerMode={powerMode} />

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
                  : target.kind === 'sling'
                    ? theme.hazard
                    : theme.secondary);

          return (
            <group key={target.id} position={[target.pos[0], target.pos[1] + yOffset, target.pos[2]]} rotation={[0, target.yRot ?? 0, 0]}>
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
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={active ? 0.56 : 0.08} opacity={active ? 1 : 0.35} transparent />
                </mesh>
              )}

              {target.kind === 'spinner' && (
                <group ref={(g) => { spinnerRefs.current[target.id] = g; }}>
                  <mesh castShadow>
                    <boxGeometry args={[3.1, 0.24, 0.24]} />
                    <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.56} />
                  </mesh>
                </group>
              )}

              {target.kind === 'sling' && (
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

              {target.kind === 'bullInner' && (
                <mesh>
                  <sphereGeometry args={[0.74, 18, 18]} />
                  <meshStandardMaterial color={theme.highlight} emissive={theme.highlight} emissiveIntensity={1.05} />
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
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.52} side={THREE.DoubleSide} />
                </mesh>
              )}

              {target.kind === 'orbit' && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[1.24, 2.14, 40, 1, Math.PI * 0.15, Math.PI * 1.64]} />
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.54} side={THREE.DoubleSide} />
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

              {target.kind === 'wormIn' && (
                <group>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.06, 0.18, 16, 34]} />
                    <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.95} />
                  </mesh>
                  <pointLight color={tint} intensity={0.58} distance={4.5} />
                </group>
              )}

              {target.kind === 'wormOut' && (
                <mesh>
                  <sphereGeometry args={[0.52, 14, 14]} />
                  <meshStandardMaterial color={theme.highlight} emissive={theme.highlight} emissiveIntensity={0.8} transparent opacity={0.5} />
                </mesh>
              )}

              {target.kind === 'mystery' && (
                <mesh>
                  <cylinderGeometry args={[1.16, 1.3, 0.6, 18]} />
                  <meshStandardMaterial color={theme.highlight} emissive={theme.highlight} emissiveIntensity={0.75} />
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
                  <meshStandardMaterial color={theme.highlight} emissive={theme.highlight} emissiveIntensity={0.9} />
                </mesh>
              )}

              {target.kind === 'captive' && (
                <mesh>
                  <sphereGeometry args={[0.62, 16, 16]} />
                  <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.64} metalness={0.55} roughness={0.2} />
                </mesh>
              )}

              {target.kind === 'gobble' && (
                <mesh>
                  <cylinderGeometry args={[1.1, 1.36, 0.58, 20]} />
                  <meshStandardMaterial color={theme.hazard} emissive={theme.hazard} emissiveIntensity={0.66} />
                </mesh>
              )}
            </group>
          );
        })}

        {bursts.map((burst) => (
          <BurstFX key={burst.id} burst={burst} />
        ))}

        {waves.map((wave) => (
          <WaveFX key={wave.id} wave={wave} />
        ))}

        {flashes.map((flash) => (
          <FlashFX key={flash.id} flash={flash} />
        ))}
      </Physics>
    </>
  );
};
