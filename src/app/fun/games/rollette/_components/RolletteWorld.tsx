// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
'use client';

import { Html, Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ARENA_HALF, ARENA_SIZE, CHAIN_WINDOW_S, FLOOR_Y, ITEM_Y, PLAYER_RADIUS } from '../constants';
import { rolletteState } from '../state';
import { randId } from '../utils';
import type { Vec3 } from '../types';
import { clamp } from '../utils/helpers';
import { BurstFX, type Burst } from './BurstFX';
import { Player } from './Player';

const WALL_THICKNESS = 1.2;
const WALL_HEIGHT = 3.2;
const DRAIN_GAP = 14;

const CONTROL_SPEED = 20;
const MOUSE_FORCE = 220;
const MAX_SPEED = 34;

const NUDGE_COOLDOWN_S = 0.9;
const MAX_NUDGES_PER_WINDOW = 3;
const NUDGE_WINDOW_S = 5;
const TILT_LOCK_S = 3;

type ThemeId = 'nebula' | 'cotton' | 'nature';
type ControlMode = 'mouse' | 'keyboard';
type PowerUp = 'HEAVY' | 'GHOST' | 'MAGNET' | null;

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
  motion: 'rotate' | 'slide';
  axis?: 'x' | 'z';
  amp: number;
  speed: number;
  damage: number;
  tint: string;
}

interface ArenaLayout {
  targets: PinballTarget[];
  obstacles: ArenaObstacle[];
  miniZone: { center: Vec3; half: [number, number] };
  launch: Vec3;
  skillShotTargetId: string;
}

interface ObjectiveState {
  dropBanks: Set<string>;
  spinnerHits: number;
  bullseyeHits: number;
  orbitHits: number;
  rampHits: number;
  mysteryHits: number;
  jackpotValue: number;
  multiballReady: boolean;
  skillShotActive: boolean;
  launchAt: number;
}

const THEMES: Record<ThemeId, ArenaTheme> = {
  nebula: {
    id: 'nebula',
    name: 'Neon Nebula Galaxy',
    background: '#02040c',
    fog: '#050715',
    floor: '#060d1f',
    rail: '#120e22',
    accent: '#00ffd4',
    secondary: '#b026ff',
    hazard: '#ff3b30',
    highlight: '#ffe657',
    glow: 1.7,
  },
  cotton: {
    id: 'cotton',
    name: 'Cotton Candy World',
    background: '#f7f4ff',
    fog: '#ffeef7',
    floor: '#f8f6ff',
    rail: '#d7d6f8',
    accent: '#ff91c8',
    secondary: '#72c9ff',
    hazard: '#ff6b8a',
    highlight: '#ffffff',
    glow: 1.05,
  },
  nature: {
    id: 'nature',
    name: 'Naturalistic Nature',
    background: '#081709',
    fog: '#0e2110',
    floor: '#112a15',
    rail: '#1d331c',
    accent: '#58d667',
    secondary: '#9ad74f',
    hazard: '#8b4d2f',
    highlight: '#d6ff8c',
    glow: 0.9,
  },
};

const THEME_KEYS: Record<string, ThemeId> = {
  '1': 'nebula',
  '2': 'cotton',
  '3': 'nature',
};

const makeObjectives = (): ObjectiveState => ({
  dropBanks: new Set<string>(),
  spinnerHits: 0,
  bullseyeHits: 0,
  orbitHits: 0,
  rampHits: 0,
  mysteryHits: 0,
  jackpotValue: 12000,
  multiballReady: false,
  skillShotActive: true,
  launchAt: performance.now() / 1000,
});

const hasObjectiveComplete = (o: ObjectiveState) =>
  o.dropBanks.size >= 2 &&
  o.spinnerHits >= 8 &&
  o.bullseyeHits >= 3 &&
  o.orbitHits >= 6 &&
  o.rampHits >= 6 &&
  o.mysteryHits >= 2;

const createArenaLayout = (theme: ThemeId): ArenaLayout => {
  const targets: PinballTarget[] = [];
  const obstacles: ArenaObstacle[] = [];

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
      pos: [x, ITEM_Y + 0.45, z],
      radius: 1.4,
      points: 150,
      ...cfg,
    });
    targets.push({
      id: `${baseId}-l`,
      kind,
      pos: [-x, ITEM_Y + 0.45, z],
      radius: 1.4,
      points: 150,
      yRot: Math.PI,
      ...cfg,
    });
  };

  if (theme === 'nebula') {
    for (const [i, z] of [-8, -12, -16, -20].entries()) {
      addMirror(`drop-nebula-${i}`, 'drop', 16, z, {
        bank: z < -14 ? 'drop-nebula-upper' : 'drop-nebula-lower',
        radius: 1.45,
        points: 900,
        objective: 'drop',
      });
    }
    for (const z of [-4, -10, -18, -26]) {
      addMirror(`stand-nebula-${z}`, 'standup', 8, z, { radius: 1.2, points: 220 });
    }
    for (const [i, z] of [-14, -24].entries()) {
      addMirror(`spin-nebula-${i}`, 'spinner', 22, z, {
        radius: 1.8,
        points: 340,
        objective: 'spinner',
      });
    }
    addMirror('sling-nebula', 'slingshot', 12.5, 23, {
      radius: 2.1,
      points: 520,
    });
    addMirror('vari-nebula', 'vari', 22, 7, { radius: 1.5, points: 600 });
    addMirror('saucer-nebula', 'saucer', 10.5, -33, { radius: 1.75, points: 1700 });
    addMirror('magnet-nebula', 'magnet', 7, -20, { radius: 2.1, points: 400 });
    addMirror('orbit-nebula', 'orbit', 27, -2, {
      radius: 2.25,
      points: 760,
      objective: 'orbit',
    });
    addMirror('ramp-nebula-a', 'ramp', 7, -8, {
      radius: 2.1,
      points: 950,
      objective: 'ramp',
    });
    addMirror('ramp-nebula-b', 'ramp', 13.5, -18, {
      radius: 1.8,
      points: 850,
      objective: 'ramp',
    });
    addMirror('worm-in-nebula', 'wormholeIn', 22, 16, {
      radius: 1.8,
      points: 2200,
    });
    addMirror('worm-out-nebula', 'wormholeOut', 6.2, -35, {
      radius: 1.5,
      points: 0,
    });
    addMirror('mini-nebula', 'mini', 4.5, -37.5, { radius: 1.4, points: 900 });
    targets.push({
      id: 'mini-nebula-center',
      kind: 'mini',
      pos: [0, ITEM_Y + 0.45, -39],
      radius: 1.4,
      points: 1200,
    });

    targets.push({
      id: 'bull-nebula-outer',
      kind: 'bullOuter',
      pos: [0, ITEM_Y + 0.4, -41],
      radius: 2.3,
      points: 1200,
      objective: 'bullseye',
    });
    targets.push({
      id: 'bull-nebula-core',
      kind: 'bullCore',
      pos: [0, ITEM_Y + 0.45, -41],
      radius: 1.05,
      points: 3800,
      objective: 'bullseye',
    });
    targets.push({
      id: 'mystery-nebula',
      kind: 'mystery',
      pos: [0, ITEM_Y + 0.4, -17],
      radius: 1.55,
      points: 1500,
      objective: 'mystery',
    });
    targets.push({
      id: 'kicker-nebula',
      kind: 'kicker',
      pos: [0, ITEM_Y + 0.45, -34],
      radius: 1.45,
      points: 900,
    });
    for (const [i, x] of [-18, -9, 0, 9, 18].entries()) {
      targets.push({
        id: `roll-nebula-${i}`,
        kind: 'rollover',
        pos: [x, ITEM_Y + 0.35, -43],
        radius: 1.2,
        points: 300,
      });
    }
    for (const [i, [x, z]] of [
      [-4.5, -26],
      [4.5, -26],
      [0, -30],
      [-9.5, -20],
      [9.5, -20],
    ].entries()) {
      targets.push({
        id: `pop-nebula-${i}`,
        kind: 'pop',
        pos: [x, ITEM_Y + 0.45, z],
        radius: 1.7,
        points: 520,
      });
    }
    obstacles.push({
      id: 'obs-nebula-rotor',
      pos: [0, ITEM_Y + 0.7, -11],
      size: [10, 0.9, 1],
      motion: 'rotate',
      amp: 0,
      speed: 1.5,
      damage: 10,
      tint: '#fb7185',
    });
    obstacles.push({
      id: 'obs-nebula-slide-r',
      pos: [17, ITEM_Y + 0.65, 2],
      size: [4.6, 0.9, 1.8],
      motion: 'slide',
      axis: 'z',
      amp: 8,
      speed: 1.3,
      damage: 8,
      tint: '#38bdf8',
    });
    obstacles.push({
      id: 'obs-nebula-slide-l',
      pos: [-17, ITEM_Y + 0.65, 2],
      size: [4.6, 0.9, 1.8],
      motion: 'slide',
      axis: 'z',
      amp: 8,
      speed: 1.3,
      damage: 8,
      tint: '#38bdf8',
    });

    const wormInR = targets.find((t) => t.id === 'worm-in-nebula-r');
    const wormInL = targets.find((t) => t.id === 'worm-in-nebula-l');
    if (wormInR) wormInR.pairId = 'worm-out-nebula-r';
    if (wormInL) wormInL.pairId = 'worm-out-nebula-l';

    return {
      targets,
      obstacles,
      miniZone: { center: [0, ITEM_Y, -37], half: [11.5, 7.2] },
      launch: [0, 2.5, 33],
      skillShotTargetId: 'roll-nebula-2',
    };
  }

  if (theme === 'cotton') {
    for (const [i, z] of [-6, -11, -16, -21].entries()) {
      addMirror(`drop-cotton-${i}`, 'drop', 13.5, z, {
        bank: z < -14 ? 'drop-cotton-upper' : 'drop-cotton-lower',
        points: 850,
        radius: 1.35,
        objective: 'drop',
      });
    }
    for (const [i, [x, z]] of [
      [-6.8, -14],
      [6.8, -14],
      [-3.4, -20.5],
      [3.4, -20.5],
      [0, -14],
      [0, -26],
    ].entries()) {
      targets.push({
        id: `pop-cotton-${i}`,
        kind: 'pop',
        pos: [x, ITEM_Y + 0.45, z],
        radius: 1.6,
        points: 500,
      });
    }
    for (const [i, z] of [-4, -13, -22, -31].entries()) {
      addMirror(`stand-cotton-${i}`, 'standup', 7.5, z, {
        points: 210,
        radius: 1.15,
      });
    }
    addMirror('spin-cotton', 'spinner', 19, -13, {
      radius: 1.8,
      points: 330,
      objective: 'spinner',
    });
    addMirror('sling-cotton', 'slingshot', 10.8, 24, { radius: 2.05, points: 520 });
    addMirror('vari-cotton', 'vari', 20.5, 9, { radius: 1.45, points: 580 });
    addMirror('saucer-cotton', 'saucer', 7, -28, { radius: 1.65, points: 1600 });
    addMirror('orbit-cotton', 'orbit', 24, -5, {
      radius: 2.2,
      points: 760,
      objective: 'orbit',
    });
    addMirror('ramp-cotton-a', 'ramp', 5.5, -8, {
      radius: 1.9,
      points: 930,
      objective: 'ramp',
    });
    addMirror('ramp-cotton-b', 'ramp', 11.5, -20, {
      radius: 1.7,
      points: 840,
      objective: 'ramp',
    });
    addMirror('magnet-cotton', 'magnet', 8.5, -22.5, {
      radius: 2,
      points: 420,
    });
    addMirror('worm-in-cotton', 'wormholeIn', 17.5, 15.5, {
      radius: 1.75,
      points: 2000,
    });
    addMirror('worm-out-cotton', 'wormholeOut', 3.5, -29, {
      radius: 1.45,
      points: 0,
    });
    addMirror('mini-cotton', 'mini', 5, -30.5, { radius: 1.3, points: 850 });
    targets.push({
      id: 'mini-cotton-center',
      kind: 'mini',
      pos: [0, ITEM_Y + 0.45, -33],
      radius: 1.3,
      points: 1150,
    });

    targets.push({
      id: 'bull-cotton-outer',
      kind: 'bullOuter',
      pos: [0, ITEM_Y + 0.4, -35],
      radius: 2.25,
      points: 1200,
      objective: 'bullseye',
    });
    targets.push({
      id: 'bull-cotton-core',
      kind: 'bullCore',
      pos: [0, ITEM_Y + 0.45, -35],
      radius: 1.0,
      points: 3600,
      objective: 'bullseye',
    });
    targets.push({
      id: 'mystery-cotton',
      kind: 'mystery',
      pos: [0, ITEM_Y + 0.4, -15],
      radius: 1.45,
      points: 1400,
      objective: 'mystery',
    });
    targets.push({
      id: 'kicker-cotton',
      kind: 'kicker',
      pos: [0, ITEM_Y + 0.45, -27.5],
      radius: 1.35,
      points: 870,
    });
    for (const [i, x] of [-15, -5, 0, 5, 15].entries()) {
      targets.push({
        id: `roll-cotton-${i}`,
        kind: 'rollover',
        pos: [x, ITEM_Y + 0.35, -37.5],
        radius: 1.15,
        points: 290,
      });
    }
    obstacles.push({
      id: 'obs-cotton-rotor',
      pos: [0, ITEM_Y + 0.72, -10],
      size: [8.6, 0.8, 1],
      motion: 'rotate',
      amp: 0,
      speed: 1.1,
      damage: 8,
      tint: '#ff9fca',
    });
    obstacles.push({
      id: 'obs-cotton-slide-r',
      pos: [14.5, ITEM_Y + 0.64, 0],
      size: [3.6, 0.8, 1.6],
      motion: 'slide',
      axis: 'x',
      amp: 6.5,
      speed: 1.25,
      damage: 7,
      tint: '#93d8ff',
    });
    obstacles.push({
      id: 'obs-cotton-slide-l',
      pos: [-14.5, ITEM_Y + 0.64, 0],
      size: [3.6, 0.8, 1.6],
      motion: 'slide',
      axis: 'x',
      amp: 6.5,
      speed: 1.25,
      damage: 7,
      tint: '#93d8ff',
    });

    const wormInR = targets.find((t) => t.id === 'worm-in-cotton-r');
    const wormInL = targets.find((t) => t.id === 'worm-in-cotton-l');
    if (wormInR) wormInR.pairId = 'worm-out-cotton-r';
    if (wormInL) wormInL.pairId = 'worm-out-cotton-l';

    return {
      targets,
      obstacles,
      miniZone: { center: [0, ITEM_Y, -31], half: [10, 8] },
      launch: [0, 2.5, 33],
      skillShotTargetId: 'roll-cotton-2',
    };
  }

  for (const [i, z] of [-9, -14, -19, -24].entries()) {
    addMirror(`drop-nature-${i}`, 'drop', 18, z, {
      bank: z < -16 ? 'drop-nature-upper' : 'drop-nature-lower',
      points: 880,
      radius: 1.42,
      objective: 'drop',
    });
  }
  for (const [i, z] of [-7, -15, -23, -31].entries()) {
    addMirror(`stand-nature-${i}`, 'standup', 9.5, z, { radius: 1.2, points: 230 });
  }
  for (const [i, z] of [-22, -30].entries()) {
    addMirror(`spin-nature-${i}`, 'spinner', 22.5, z, {
      radius: 1.85,
      points: 340,
      objective: 'spinner',
    });
  }
  addMirror('sling-nature', 'slingshot', 13.8, 22.2, { radius: 2.1, points: 520 });
  addMirror('vari-nature', 'vari', 20.8, 8.2, { radius: 1.55, points: 600 });
  addMirror('saucer-nature', 'saucer', 9.3, -31.5, { radius: 1.7, points: 1700 });
  addMirror('orbit-nature', 'orbit', 26.2, -7, {
    radius: 2.25,
    points: 780,
    objective: 'orbit',
  });
  addMirror('ramp-nature-a', 'ramp', 6.2, -20, {
    radius: 2.0,
    points: 920,
    objective: 'ramp',
  });
  addMirror('ramp-nature-b', 'ramp', 12.5, -28, {
    radius: 1.75,
    points: 840,
    objective: 'ramp',
  });
  addMirror('magnet-nature', 'magnet', 10.2, -28, { radius: 2.1, points: 430 });
  addMirror('worm-in-nature', 'wormholeIn', 24, 23, {
    radius: 1.8,
    points: 2150,
  });
  addMirror('worm-out-nature', 'wormholeOut', 6.5, -36.5, {
    radius: 1.55,
    points: 0,
  });
  addMirror('mini-nature', 'mini', 4.6, -39.5, { radius: 1.35, points: 920 });
  targets.push({
    id: 'mini-nature-center',
    kind: 'mini',
    pos: [0, ITEM_Y + 0.45, -41.5],
    radius: 1.35,
    points: 1250,
  });

  targets.push({
    id: 'bull-nature-outer',
    kind: 'bullOuter',
    pos: [0, ITEM_Y + 0.4, -44],
    radius: 2.35,
    points: 1250,
    objective: 'bullseye',
  });
  targets.push({
    id: 'bull-nature-core',
    kind: 'bullCore',
    pos: [0, ITEM_Y + 0.45, -44],
    radius: 1.02,
    points: 3900,
    objective: 'bullseye',
  });
  targets.push({
    id: 'mystery-nature',
    kind: 'mystery',
    pos: [0, ITEM_Y + 0.4, -19.5],
    radius: 1.5,
    points: 1500,
    objective: 'mystery',
  });
  targets.push({
    id: 'kicker-nature',
    kind: 'kicker',
    pos: [0, ITEM_Y + 0.45, -35],
    radius: 1.45,
    points: 900,
  });
  for (const [i, x] of [-20, -10, 0, 10, 20].entries()) {
    targets.push({
      id: `roll-nature-${i}`,
      kind: 'rollover',
      pos: [x, ITEM_Y + 0.35, -45.5],
      radius: 1.2,
      points: 320,
    });
  }
  for (const [i, [x, z]] of [
    [-5.8, -34],
    [5.8, -34],
    [0, -38],
    [-11, -28],
    [11, -28],
  ].entries()) {
    targets.push({
      id: `pop-nature-${i}`,
      kind: 'pop',
      pos: [x, ITEM_Y + 0.45, z],
      radius: 1.7,
      points: 540,
    });
  }
  obstacles.push({
    id: 'obs-nature-rotor',
    pos: [0, ITEM_Y + 0.75, -16],
    size: [9.6, 0.9, 1],
    motion: 'rotate',
    amp: 0,
    speed: 1.25,
    damage: 9,
    tint: '#7a4b2a',
  });
  obstacles.push({
    id: 'obs-nature-slide-r',
    pos: [16.8, ITEM_Y + 0.68, 4],
    size: [4.4, 0.9, 1.7],
    motion: 'slide',
    axis: 'z',
    amp: 9,
    speed: 1.35,
    damage: 8,
    tint: '#4f8a3c',
  });
  obstacles.push({
    id: 'obs-nature-slide-l',
    pos: [-16.8, ITEM_Y + 0.68, 4],
    size: [4.4, 0.9, 1.7],
    motion: 'slide',
    axis: 'z',
    amp: 9,
    speed: 1.35,
    damage: 8,
    tint: '#4f8a3c',
  });

  const wormInR = targets.find((t) => t.id === 'worm-in-nature-r');
  const wormInL = targets.find((t) => t.id === 'worm-in-nature-l');
  if (wormInR) wormInR.pairId = 'worm-out-nature-r';
  if (wormInL) wormInL.pairId = 'worm-out-nature-l';

  return {
    targets,
    obstacles,
    miniZone: { center: [0, ITEM_Y, -40], half: [12.5, 7] },
    launch: [0, 2.5, 33],
    skillShotTargetId: 'roll-nature-2',
  };
};

export const RolletteWorld: React.FC<{
  soundsOn: boolean;
  paused: boolean;
  damageFlashRef: React.MutableRefObject<number>;
  shieldLightRef: React.RefObject<THREE.PointLight>;
}> = ({ soundsOn, paused, damageFlashRef, shieldLightRef }) => {
  const { camera, gl, scene } = useThree();
  const ballRef = useRef<RapierRigidBody>(null);
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const nudgeQueuedRef = useRef(false);
  const nudgeTimesRef = useRef<number[]>([]);
  const tiltLockUntilRef = useRef(0);
  const tiltToastAtRef = useRef(0);
  const pausedRef = useRef(paused);
  const drainLockRef = useRef(0);
  const activeSaucerRef = useRef<string | null>(null);
  const pendingLaunchRef = useRef<Vec3 | null>(null);
  const obstacleBodiesRef = useRef<Record<string, RapierRigidBody | null>>({});
  const obstacleWorldRef = useRef<Record<string, Vec3>>({});
  const hitAtRef = useRef<Record<string, number>>({});
  const targetMapRef = useRef<Record<string, PinballTarget>>({});
  const timersRef = useRef<number[]>([]);
  const objectivesRef = useRef<ObjectiveState>(makeObjectives());
  const wizardUntilRef = useRef(0);
  const bonusBankRef = useRef(0);
  const powerUntilRef = useRef(0);
  const [themeId, setThemeId] = useState<ThemeId>('nebula');
  const [controlMode, setControlMode] = useState<ControlMode>('keyboard');
  const [activePower, setActivePower] = useState<PowerUp>(null);
  const [wizardActive, setWizardActive] = useState(false);
  const [multiballReady, setMultiballReady] = useState(false);
  const [layout, setLayout] = useState<ArenaLayout>(() => createArenaLayout('nebula'));
  const [targets, setTargets] = useState<PinballTarget[]>(() => createArenaLayout('nebula').targets);
  const [obstacles, setObstacles] = useState<ArenaObstacle[]>(() => createArenaLayout('nebula').obstacles);
  const [bursts, setBursts] = useState<Burst[]>([]);

  const theme = THEMES[themeId];
  const floorTexture = useMemo(() => new THREE.Color(theme.floor), [theme.floor]);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) nudgeQueuedRef.current = false;
  }, [paused]);

  useEffect(() => {
    gl.setClearColor(theme.background, 1);
    scene.fog = new THREE.Fog(theme.fog, 34, 142);
    return () => {
      scene.fog = null;
    };
  }, [gl, scene, theme.background, theme.fog]);

  const queueTimer = useCallback((cb: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      cb();
      timersRef.current = timersRef.current.filter((t) => t !== id);
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(
    () => () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    },
    []
  );

  type SoundKey = 'hit' | 'point' | 'nudge' | 'mode';
  const audioRef = useRef<null | Record<SoundKey, HTMLAudioElement[]>>(null);
  const audioIdxRef = useRef<Record<SoundKey, number>>({
    hit: 0,
    point: 0,
    nudge: 0,
    mode: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mk = (src: string, count: number, volume: number) =>
      Array.from({ length: count }, () => {
        const a = new Audio(src);
        a.volume = volume;
        a.preload = 'auto';
        return a;
      });
    audioRef.current = {
      hit: mk('/fun/audio/sfx_hit.wav', 3, 0.38),
      point: mk('/fun/audio/sfx_point.wav', 4, 0.34),
      nudge: mk('/fun/audio/sfx_swooshing.wav', 2, 0.32),
      mode: mk('/fun/resources/ping.mp3', 2, 0.25),
    };
    return () => {
      audioRef.current = null;
    };
  }, []);

  const playSound = useCallback(
    (type: SoundKey) => {
      if (!soundsOn || !audioRef.current) return;
      const pool = audioRef.current[type];
      if (!pool?.length) return;
      const idx = audioIdxRef.current[type] % pool.length;
      audioIdxRef.current[type] = (idx + 1) % pool.length;
      const a = pool[idx];
      a.currentTime = 0;
      a.play().catch(() => undefined);
    },
    [soundsOn]
  );

  const spawnBurst = useCallback(
    (
      pos: Vec3,
      color: string,
      count = 12,
      life = 0.6,
      shape: Burst['shape'] = 'spark'
    ) => {
      setBursts((prev) => [
        ...prev.slice(-24),
        {
          id: randId('burst'),
          pos,
          color,
          count,
          life,
          shape,
          bornAt: performance.now() / 1000,
        },
      ]);
    },
    []
  );

  const launchBall = useCallback((launch: Vec3, resetSkillShot = true) => {
    const rb = ballRef.current;
    if (!rb) {
      pendingLaunchRef.current = launch;
      return;
    }
    rb.setTranslation({ x: launch[0], y: launch[1], z: launch[2] }, true);
    rb.setLinvel({ x: 0, y: 0, z: -18 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (resetSkillShot) {
      objectivesRef.current.skillShotActive = true;
      objectivesRef.current.launchAt = performance.now() / 1000;
    }
  }, []);

  const setPowerUp = useCallback((next: PowerUp, duration: number) => {
    setActivePower(next);
    powerUntilRef.current = performance.now() / 1000 + duration;
    if (next) rolletteState.setToast(`${next} MODE`);
  }, []);

  const initializeArena = useCallback(
    (nextTheme: ThemeId) => {
      const arena = createArenaLayout(nextTheme);
      setLayout(arena);
      setTargets(arena.targets);
      setObstacles(arena.obstacles);
      targetMapRef.current = Object.fromEntries(arena.targets.map((t) => [t.id, t]));
      hitAtRef.current = {};
      obstacleWorldRef.current = {};
      activeSaucerRef.current = null;
      bonusBankRef.current = 0;
      objectivesRef.current = makeObjectives();
      wizardUntilRef.current = 0;
      setWizardActive(false);
      setMultiballReady(false);
      setPowerUp(null, 0);
      setBursts([]);
      rolletteState.zoneCenter = [...arena.miniZone.center];
      launchBall(arena.launch, true);
    },
    [launchBall, setPowerUp]
  );

  const resetRun = useCallback(
    (nextTheme: ThemeId = themeId) => {
      rolletteState.reset();
      rolletteState.maxHealth = 100;
      rolletteState.health = 100;
      rolletteState.dashCooldownMax = NUDGE_COOLDOWN_S;
      rolletteState.dashCooldown = 0;
      rolletteState.setToast('ROLETTE: PINBALL ULTIMATE');
      initializeArena(nextTheme);
    },
    [initializeArena, themeId]
  );

  useEffect(() => {
    resetRun(themeId);
    camera.position.set(0, 13, 30);
    camera.lookAt(0, 1, 0);
  }, [camera, resetRun, themeId]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (THEME_KEYS[key] && !e.repeat) {
        setThemeId(THEME_KEYS[key]);
        rolletteState.setToast(`${THEMES[THEME_KEYS[key]].name} loaded`);
        playSound('mode');
        return;
      }
      if (key === 't' && !e.repeat) {
        setControlMode((prev) => {
          const next = prev === 'mouse' ? 'keyboard' : 'mouse';
          rolletteState.setToast(`CONTROL: ${next.toUpperCase()}`);
          return next;
        });
        playSound('mode');
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
  }, [playSound, resetRun]);

  const awardPoints = useCallback(
    (base: number, pos: Vec3, color: string, shape: Burst['shape'] = 'spark') => {
      if (base <= 0) return;
      const comboActive = rolletteState.comboTimer > 0;
      rolletteState.combo = comboActive ? rolletteState.combo + 1 : 1;
      rolletteState.comboTimer = CHAIN_WINDOW_S;
      const comboMult = 1 + Math.max(0, rolletteState.combo - 1) * 0.08;
      let points = base * comboMult;
      if (rolletteState.inZone) points *= 1.35;
      if (wizardActive) points *= 2.2;
      if (rolletteState.bonusMultiplier > 1) points *= rolletteState.bonusMultiplier;
      rolletteState.addScore(points);
      bonusBankRef.current += Math.floor(points * 0.16);
      playSound('point');
      spawnBurst(pos, color, 12, 0.56, shape);
    },
    [playSound, spawnBurst, wizardActive]
  );

  const applyRepelImpulse = useCallback(
    (rb: RapierRigidBody, from: Vec3, to: Vec3, force = 12) => {
      const dx = from[0] - to[0];
      const dz = from[2] - to[2];
      const len = Math.max(1e-4, Math.hypot(dx, dz));
      rb.applyImpulse(
        {
          x: (dx / len) * force,
          y: 0.35,
          z: (dz / len) * force,
        },
        true
      );
    },
    []
  );

  const evaluateModes = useCallback(() => {
    const o = objectivesRef.current;
    if (!o.multiballReady && o.dropBanks.size >= 2 && o.spinnerHits >= 5) {
      o.multiballReady = true;
      setMultiballReady(true);
      rolletteState.setToast('MULTIBALL JACKPOT LIT');
    }
    if (!wizardActive && hasObjectiveComplete(o)) {
      setWizardActive(true);
      wizardUntilRef.current = performance.now() / 1000 + 35;
      rolletteState.activateMultiplier(3, 35);
      rolletteState.setToast('WIZARD MODE ONLINE');
      playSound('mode');
    }
  }, [playSound, wizardActive]);

  const handleMysteryAward = useCallback(
    (p: Vec3) => {
      const roll = Math.random();
      if (roll < 0.25) {
        const bonus = 2800 + Math.floor(Math.random() * 2200);
        rolletteState.addScore(bonus);
        rolletteState.setToast(`MYSTERY +${bonus.toLocaleString()}`);
      } else if (roll < 0.45) {
        rolletteState.activateShield(10);
        rolletteState.setToast('MYSTERY SHIELD');
      } else if (roll < 0.62) {
        rolletteState.activateMultiplier(2, 12);
        rolletteState.setToast('MYSTERY x2');
      } else if (roll < 0.76) {
        setPowerUp('HEAVY', 10);
      } else if (roll < 0.88) {
        setPowerUp('GHOST', 8);
      } else {
        setPowerUp('MAGNET', 10);
      }
      spawnBurst([p[0], ITEM_Y + 0.5, p[2]], theme.highlight, 20, 0.85, 'tetra');
    },
    [setPowerUp, spawnBurst, theme.highlight]
  );

  const resolveTargetHit = useCallback(
    (target: PinballTarget, p: Vec3, v: { x: number; y: number; z: number }, rb: RapierRigidBody) => {
      const now = performance.now() / 1000;
      const speed = Math.hypot(v.x, v.z);
      const kindColor =
        target.tint ??
        (target.kind === 'pop'
          ? theme.secondary
          : target.kind === 'drop'
            ? theme.highlight
            : target.kind === 'mystery'
              ? theme.highlight
              : target.kind === 'magnet'
                ? theme.accent
                : theme.secondary);

      const asBurstPos: Vec3 = [target.pos[0], ITEM_Y + 0.45, target.pos[2]];

      if (target.objective === 'spinner') objectivesRef.current.spinnerHits += 1;
      if (target.objective === 'bullseye') objectivesRef.current.bullseyeHits += 1;
      if (target.objective === 'orbit') objectivesRef.current.orbitHits += 1;
      if (target.objective === 'ramp') objectivesRef.current.rampHits += 1;
      if (target.objective === 'mystery') objectivesRef.current.mysteryHits += 1;

      switch (target.kind) {
        case 'pop': {
          const kick = activePower === 'HEAVY' ? 18 : 14;
          applyRepelImpulse(rb, p, target.pos, kick);
          awardPoints(target.points, asBurstPos, kindColor);
          break;
        }
        case 'slingshot': {
          const side = Math.sign(target.pos[0]) || 1;
          rb.applyImpulse(
            {
              x: -side * 10,
              y: 0.45,
              z: -10,
            },
            true
          );
          awardPoints(target.points, asBurstPos, kindColor);
          break;
        }
        case 'standup': {
          awardPoints(target.points, asBurstPos, kindColor);
          break;
        }
        case 'drop': {
          if (target.active === false) break;
          awardPoints(target.points, asBurstPos, kindColor);
          setTargets((prev) =>
            prev.map((t) => (t.id === target.id ? { ...t, active: false } : t))
          );
          if (target.bank) {
            const bankTargets = targets.filter((t) => t.bank === target.bank);
            const downCount = bankTargets.reduce(
              (count, t) => count + (t.id === target.id || t.active === false ? 1 : 0),
              0
            );
            if (downCount >= bankTargets.length) {
              objectivesRef.current.dropBanks.add(target.bank);
              const bankBonus = wizardActive ? 18000 : 9000;
              rolletteState.addScore(bankBonus);
              rolletteState.setToast(`DROP BANK CLEARED +${bankBonus.toLocaleString()}`);
              spawnBurst([target.pos[0], ITEM_Y + 0.55, target.pos[2]], theme.highlight, 24, 0.8, 'box');
              queueTimer(() => {
                setTargets((prev) =>
                  prev.map((t) => (t.bank === target.bank ? { ...t, active: true } : t))
                );
              }, 1300);
            }
          }
          evaluateModes();
          break;
        }
        case 'spinner': {
          awardPoints(target.points + Math.floor(speed * 30), asBurstPos, kindColor);
          evaluateModes();
          break;
        }
        case 'vari': {
          const powerScore = clamp(Math.floor(speed * 42), 280, 2400);
          awardPoints(powerScore, asBurstPos, kindColor);
          applyRepelImpulse(rb, p, target.pos, 9);
          break;
        }
        case 'bullOuter': {
          awardPoints(target.points, asBurstPos, kindColor);
          evaluateModes();
          break;
        }
        case 'bullCore': {
          const coreBonus = target.points + (wizardActive ? 4000 : 0);
          awardPoints(coreBonus, asBurstPos, theme.highlight, 'tetra');
          objectivesRef.current.bullseyeHits += 1;
          evaluateModes();
          break;
        }
        case 'rollover': {
          awardPoints(target.points, asBurstPos, theme.accent);
          const o = objectivesRef.current;
          if (
            o.skillShotActive &&
            now - o.launchAt <= 8 &&
            target.id === layout.skillShotTargetId
          ) {
            o.skillShotActive = false;
            const skillBonus = 6500;
            rolletteState.addScore(skillBonus);
            rolletteState.setToast(`SKILL SHOT +${skillBonus.toLocaleString()}`);
            spawnBurst(asBurstPos, theme.highlight, 24, 0.75, 'tetra');
          }
          break;
        }
        case 'ramp': {
          awardPoints(target.points, asBurstPos, kindColor);
          rb.applyImpulse({ x: 0, y: 0.15, z: -8.5 }, true);
          evaluateModes();
          break;
        }
        case 'orbit': {
          awardPoints(target.points, asBurstPos, kindColor);
          const side = Math.sign(target.pos[0]) || 1;
          rb.applyImpulse({ x: side * 4.5, y: 0.1, z: -6.5 }, true);
          evaluateModes();
          break;
        }
        case 'saucer': {
          if (activeSaucerRef.current) break;
          activeSaucerRef.current = target.id;
          awardPoints(target.points, asBurstPos, kindColor);
          rb.setTranslation({ x: target.pos[0], y: p[1], z: target.pos[2] }, true);
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
          queueTimer(() => {
            const sideKick = Math.sign(target.pos[0]) * -4;
            rb.applyImpulse({ x: sideKick, y: 0.45, z: -17 }, true);
            activeSaucerRef.current = null;
          }, 550);

          const o = objectivesRef.current;
          if (o.multiballReady) {
            const jackpot = o.jackpotValue;
            o.jackpotValue += 2500;
            o.multiballReady = false;
            setMultiballReady(false);
            rolletteState.addScore(jackpot);
            rolletteState.setToast(`MULTIBALL JACKPOT +${jackpot.toLocaleString()}`);
            spawnBurst(asBurstPos, theme.highlight, 32, 0.95, 'tetra');
          }
          break;
        }
        case 'mystery': {
          awardPoints(target.points, asBurstPos, kindColor);
          handleMysteryAward(target.pos);
          evaluateModes();
          break;
        }
        case 'magnet': {
          awardPoints(target.points, asBurstPos, kindColor);
          setPowerUp('MAGNET', 8);
          break;
        }
        case 'wormholeIn': {
          const exit = target.pairId ? targetMapRef.current[target.pairId] : null;
          if (exit) {
            const lv = rb.linvel();
            rb.setTranslation({ x: exit.pos[0], y: p[1], z: exit.pos[2] }, true);
            rb.setLinvel(
              {
                x: lv.x * 1.08,
                y: lv.y,
                z: lv.z * 1.08 - 2,
              },
              true
            );
            awardPoints(target.points, asBurstPos, theme.accent, 'spark');
          }
          break;
        }
        case 'kicker': {
          awardPoints(target.points, asBurstPos, kindColor);
          rb.applyImpulse({ x: 0, y: 0.5, z: -20 }, true);
          break;
        }
        case 'mini': {
          awardPoints(target.points, asBurstPos, theme.highlight);
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
      layout.skillShotTargetId,
      queueTimer,
      setPowerUp,
      targets,
      theme.accent,
      theme.highlight,
      theme.secondary,
      wizardActive,
    ]
  );

  useFrame((state, delta) => {
    const now = performance.now() / 1000;
    if (pendingLaunchRef.current && ballRef.current) {
      const nextLaunch = pendingLaunchRef.current;
      pendingLaunchRef.current = null;
      launchBall(nextLaunch, true);
    }

    if (bursts.length) {
      const active = bursts.filter((b) => now - b.bornAt <= b.life);
      if (active.length !== bursts.length) setBursts(active);
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
      setActivePower(null);
      rolletteState.setToast('POWER DOWN');
    }

    const p = rb.translation();
    const v = rb.linvel();
    const playerPos: Vec3 = [p.x, p.y, p.z];

    const inMini =
      Math.abs(playerPos[0] - layout.miniZone.center[0]) <= layout.miniZone.half[0] &&
      Math.abs(playerPos[2] - layout.miniZone.center[2]) <= layout.miniZone.half[1];
    rolletteState.inZone = inMini;

    if (
      objectivesRef.current.skillShotActive &&
      now - objectivesRef.current.launchAt > 8
    ) {
      objectivesRef.current.skillShotActive = false;
    }

    rb.setLinearDamping(activePower === 'GHOST' ? 0.04 : 0.12);
    rb.setAngularDamping(activePower === 'HEAVY' ? 0.35 : 0.55);

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
        const gain = activePower === 'HEAVY' ? 1.25 : 1;
        rb.setLinvel(
          {
            x: (ix / len) * CONTROL_SPEED * gain,
            y: v.y,
            z: (iz / len) * CONTROL_SPEED * gain,
          },
          true
        );
      } else {
        rb.setLinvel({ x: v.x * 0.9, y: v.y, z: v.z * 0.92 }, true);
      }
    } else {
      const gain = activePower === 'HEAVY' ? 1.2 : 1;
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
        } else if (now >= tiltLockUntilRef.current) {
          rb.applyImpulse(
            {
              x: (Math.random() - 0.5) * 4,
              y: 4.5,
              z: -2 + Math.random() * 4,
            },
            true
          );
          playSound('nudge');
          spawnBurst([p.x, ITEM_Y + 0.35, p.z], theme.accent, 10, 0.45, 'spark');
        }
        rolletteState.dashCooldown = NUDGE_COOLDOWN_S;
      }
    }

    const targetCam = new THREE.Vector3(p.x * 0.25, p.y + 13, p.z + 22);
    camera.position.lerp(targetCam, 0.09);
    camera.lookAt(p.x, p.y + 1.15, p.z - 4);
    if (damageFlashRef.current > 0) {
      damageFlashRef.current = Math.max(0, damageFlashRef.current - delta * 1.6);
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
      shieldLightRef.current.intensity = rolletteState.shieldTime > 0 ? 0.4 + fade * 0.8 : 0;
      shieldLightRef.current.distance = 6 + fade * 2;
    }

    const insideBounds = ARENA_HALF - 2.1;
    if (Math.abs(p.x) > insideBounds) {
      rb.addForce({ x: -Math.sign(p.x) * 28, y: 0, z: 0 }, true);
    }
    if (p.z < -ARENA_HALF + 2.6) {
      rb.addForce({ x: 0, y: 0, z: 25 }, true);
    }

    for (const o of obstacles) {
      const body = obstacleBodiesRef.current[o.id];
      if (!body) continue;
      const t = state.clock.elapsedTime;
      const x =
        o.motion === 'slide' && o.axis === 'x'
          ? o.pos[0] + Math.sin(t * o.speed) * o.amp
          : o.pos[0];
      const z =
        o.motion === 'slide' && o.axis === 'z'
          ? o.pos[2] + Math.sin(t * o.speed) * o.amp
          : o.pos[2];
      body.setNextKinematicTranslation({ x, y: o.pos[1], z });
      if (o.motion === 'rotate') {
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, t * o.speed, 0)
        );
        body.setNextKinematicRotation(q);
      }
      obstacleWorldRef.current[o.id] = [x, o.pos[1], z];

      const hitX = Math.abs(playerPos[0] - x) < o.size[0] * 0.54 + PLAYER_RADIUS;
      const hitZ = Math.abs(playerPos[2] - z) < o.size[2] * 0.54 + PLAYER_RADIUS;
      const hitWindow = hitX && hitZ;
      const last = hitAtRef.current[o.id] ?? -999;
      if (hitWindow && now - last > 0.65) {
        hitAtRef.current[o.id] = now;
        if (activePower !== 'GHOST') {
          rolletteState.takeDamage(o.damage);
          damageFlashRef.current = Math.min(0.75, damageFlashRef.current + 0.45);
          playSound('hit');
          applyRepelImpulse(rb, playerPos, [x, o.pos[1], z], 14);
          spawnBurst([x, ITEM_Y + 0.35, z], theme.hazard, 18, 0.75, 'box');
        }
      }
    }

    const highValue = targets.filter(
      (t) => t.kind === 'bullCore' || t.kind === 'saucer' || t.kind === 'mystery'
    );
    if (activePower === 'MAGNET' && highValue.length) {
      let nearest = highValue[0];
      let best = Infinity;
      for (const h of highValue) {
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

    for (const target of targets) {
      const cooldown = target.kind === 'rollover' ? 0.28 : target.kind === 'spinner' ? 0.2 : 0.35;
      const last = hitAtRef.current[target.id] ?? -999;
      if (now - last < cooldown) continue;
      if (target.kind === 'drop' && target.active === false) continue;
      if (target.kind === 'wormholeOut') continue;

      const dx = playerPos[0] - target.pos[0];
      const dz = playerPos[2] - target.pos[2];
      const hitR = target.radius + PLAYER_RADIUS * 0.82;
      if (dx * dx + dz * dz > hitR * hitR) continue;

      hitAtRef.current[target.id] = now;
      resolveTargetHit(target, playerPos, v, rb);
    }

    if (p.z > ARENA_HALF + 3 && Math.abs(p.x) < DRAIN_GAP * 0.54) {
      if (now - drainLockRef.current > 0.95) {
        drainLockRef.current = now;
        const objectiveBonus =
          objectivesRef.current.dropBanks.size * 1100 +
          objectivesRef.current.spinnerHits * 120 +
          objectivesRef.current.bullseyeHits * 700 +
          objectivesRef.current.orbitHits * 150 +
          objectivesRef.current.rampHits * 170;
        const endBonus = Math.floor(bonusBankRef.current + objectiveBonus);
        if (endBonus > 0) {
          rolletteState.addScore(endBonus);
          rolletteState.setToast(`END OF BALL BONUS +${endBonus.toLocaleString()}`);
        }
        bonusBankRef.current = 0;
        rolletteState.takeDamage(25);
        playSound('hit');
        damageFlashRef.current = Math.min(0.8, damageFlashRef.current + 0.5);
        if (!rolletteState.gameOver) {
          queueTimer(() => launchBall(layout.launch, true), 380);
        }
      }
    }
  });

  const bottomSegmentWidth = (ARENA_SIZE - DRAIN_GAP) / 2;
  const bottomSegmentHalf = bottomSegmentWidth / 2;

  return (
    <>
      <color attach="background" args={[theme.background]} />
      <Sky inclination={0.47} azimuth={0.18} distance={450000} />
      <Stars radius={280} depth={90} count={3800} factor={4} saturation={0} fade />

      <ambientLight intensity={theme.id === 'nature' ? 0.33 : 0.4} />
      <directionalLight
        position={[16, 24, 11]}
        intensity={theme.id === 'cotton' ? 0.95 : 1.12}
        castShadow
      />
      <pointLight position={[0, 18, -8]} intensity={theme.glow} color={theme.accent} />
      <pointLight position={[0, 14, 18]} intensity={theme.glow * 0.55} color={theme.secondary} />
      {wizardActive && (
        <pointLight position={[0, 8, -20]} intensity={2.2} color={theme.highlight} />
      )}

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 right-4 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-white/90 text-xs backdrop-blur-sm">
          <div className="font-semibold tracking-wide">{theme.name}</div>
          <div>Control: {controlMode === 'keyboard' ? 'Keyboard Velocity' : 'Mouse Steering'}</div>
          <div>Mode: {wizardActive ? 'Wizard' : multiballReady ? 'Jackpot Lit' : 'Build Objectives'}</div>
          <div>Power: {activePower ?? 'None'}</div>
        </div>
      </Html>

      <Physics gravity={[0, -25, 10]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            args={[ARENA_SIZE / 2, 0.2, ARENA_SIZE / 2]}
            position={[0, FLOOR_Y - 0.2, 0]}
            friction={0.08}
            restitution={0.62}
          />
          <CuboidCollider
            args={[ARENA_SIZE / 2 + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS]}
            position={[0, WALL_HEIGHT, -ARENA_HALF - WALL_THICKNESS]}
            restitution={0.8}
          />
          <CuboidCollider
            args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE / 2 + WALL_THICKNESS]}
            position={[-ARENA_HALF - WALL_THICKNESS, WALL_HEIGHT, 0]}
            restitution={0.8}
          />
          <CuboidCollider
            args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE / 2 + WALL_THICKNESS]}
            position={[ARENA_HALF + WALL_THICKNESS, WALL_HEIGHT, 0]}
            restitution={0.8}
          />
          <CuboidCollider
            args={[bottomSegmentHalf, WALL_HEIGHT, WALL_THICKNESS]}
            position={[
              -(DRAIN_GAP / 2 + bottomSegmentHalf),
              WALL_HEIGHT,
              ARENA_HALF + WALL_THICKNESS,
            ]}
            restitution={0.8}
          />
          <CuboidCollider
            args={[bottomSegmentHalf, WALL_HEIGHT, WALL_THICKNESS]}
            position={[
              DRAIN_GAP / 2 + bottomSegmentHalf,
              WALL_HEIGHT,
              ARENA_HALF + WALL_THICKNESS,
            ]}
            restitution={0.8}
          />
        </RigidBody>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
          <planeGeometry args={[ARENA_SIZE, ARENA_SIZE, 4, 4]} />
          <meshStandardMaterial
            color={floorTexture}
            emissive={theme.floor}
            emissiveIntensity={theme.id === 'nebula' ? 0.24 : 0.12}
            roughness={theme.id === 'cotton' ? 0.62 : 0.42}
            metalness={theme.id === 'nebula' ? 0.22 : 0.08}
          />
        </mesh>

        <mesh position={[0, 0.35, -ARENA_HALF - WALL_THICKNESS]} castShadow>
          <boxGeometry args={[ARENA_SIZE + WALL_THICKNESS * 2, 0.7, WALL_THICKNESS * 2]} />
          <meshStandardMaterial color={theme.rail} emissive={theme.secondary} emissiveIntensity={0.16} />
        </mesh>
        <mesh position={[-ARENA_HALF - WALL_THICKNESS, 0.35, 0]} castShadow>
          <boxGeometry args={[WALL_THICKNESS * 2, 0.7, ARENA_SIZE + WALL_THICKNESS * 2]} />
          <meshStandardMaterial color={theme.rail} emissive={theme.secondary} emissiveIntensity={0.16} />
        </mesh>
        <mesh position={[ARENA_HALF + WALL_THICKNESS, 0.35, 0]} castShadow>
          <boxGeometry args={[WALL_THICKNESS * 2, 0.7, ARENA_SIZE + WALL_THICKNESS * 2]} />
          <meshStandardMaterial color={theme.rail} emissive={theme.secondary} emissiveIntensity={0.16} />
        </mesh>
        <mesh position={[0, 0.2, ARENA_HALF + WALL_THICKNESS + 0.02]}>
          <boxGeometry args={[DRAIN_GAP, 0.4, WALL_THICKNESS]} />
          <meshStandardMaterial
            color={theme.hazard}
            emissive={theme.hazard}
            emissiveIntensity={0.4}
            transparent
            opacity={0.75}
          />
        </mesh>

        {obstacles.map((o) => (
          <RigidBody
            key={o.id}
            ref={(rb) => {
              obstacleBodiesRef.current[o.id] = rb;
            }}
            type="kinematicPosition"
            colliders={false}
          >
            <CuboidCollider args={[o.size[0] / 2, o.size[1] / 2, o.size[2] / 2]} />
            <mesh castShadow>
              <boxGeometry args={o.size} />
              <meshStandardMaterial
                color={o.tint}
                emissive={o.tint}
                emissiveIntensity={0.55}
                roughness={0.35}
                metalness={0.28}
              />
            </mesh>
          </RigidBody>
        ))}

        <Player ballRef={ballRef} shieldLightRef={shieldLightRef} />

        {targets.map((target) => {
          const active = target.active !== false;
          const yOffset = target.kind === 'drop' && !active ? -0.9 : 0;
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
          const emissive = wizardActive ? theme.highlight : tint;

          return (
            <group
              key={target.id}
              position={[target.pos[0], target.pos[1] + yOffset, target.pos[2]]}
              rotation={[0, target.yRot ?? 0, 0]}
            >
              {target.kind === 'pop' && (
                <mesh castShadow>
                  <cylinderGeometry args={[0.95, 1.1, 0.72, 22]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.72} />
                </mesh>
              )}
              {target.kind === 'standup' && (
                <mesh castShadow>
                  <boxGeometry args={[1, 1.3, 0.32]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.34} />
                </mesh>
              )}
              {target.kind === 'drop' && (
                <mesh castShadow>
                  <boxGeometry args={[1.12, 1.55, 0.35]} />
                  <meshStandardMaterial
                    color={tint}
                    emissive={emissive}
                    emissiveIntensity={active ? 0.52 : 0.08}
                    opacity={active ? 1 : 0.35}
                    transparent
                  />
                </mesh>
              )}
              {target.kind === 'spinner' && (
                <mesh castShadow rotation={[0, performance.now() * 0.0016, 0]}>
                  <boxGeometry args={[3, 0.25, 0.26]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.55} />
                </mesh>
              )}
              {target.kind === 'slingshot' && (
                <mesh castShadow rotation={[-Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[1.18, 1.2, 3]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.42} />
                </mesh>
              )}
              {target.kind === 'vari' && (
                <group>
                  <mesh castShadow>
                    <boxGeometry args={[1.25, 1, 0.32]} />
                    <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.34} />
                  </mesh>
                  <mesh position={[0, 0, -0.7]}>
                    <boxGeometry args={[0.2, 0.2, 1.1]} />
                    <meshStandardMaterial color="#374151" />
                  </mesh>
                </group>
              )}
              {target.kind === 'bullOuter' && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[1.9, 0.26, 16, 40]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.56} />
                </mesh>
              )}
              {target.kind === 'bullCore' && (
                <mesh>
                  <sphereGeometry args={[0.72, 18, 18]} />
                  <meshStandardMaterial color={theme.highlight} emissive={theme.highlight} emissiveIntensity={0.95} />
                </mesh>
              )}
              {target.kind === 'saucer' && (
                <mesh>
                  <cylinderGeometry args={[1.3, 1.5, 0.55, 24]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.48} />
                </mesh>
              )}
              {target.kind === 'rollover' && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.9, 0.12, 10, 20]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.52} />
                </mesh>
              )}
              {target.kind === 'ramp' && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[1.1, 1.7, 32, 1, 0.25, Math.PI * 1.2]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.5} side={THREE.DoubleSide} />
                </mesh>
              )}
              {target.kind === 'orbit' && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[1.2, 2.1, 40, 1, Math.PI * 0.2, Math.PI * 1.6]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.5} side={THREE.DoubleSide} />
                </mesh>
              )}
              {target.kind === 'magnet' && (
                <group>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.2, 0.2, 16, 36]} />
                    <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.7} />
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
                    <torusGeometry args={[1.05, 0.18, 16, 34]} />
                    <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.9} />
                  </mesh>
                  <pointLight color={tint} intensity={0.55} distance={4} />
                </group>
              )}
              {target.kind === 'wormholeOut' && (
                <mesh>
                  <sphereGeometry args={[0.5, 14, 14]} />
                  <meshStandardMaterial color={theme.highlight} emissive={theme.highlight} emissiveIntensity={0.75} transparent opacity={0.45} />
                </mesh>
              )}
              {target.kind === 'mystery' && (
                <mesh>
                  <cylinderGeometry args={[1.15, 1.3, 0.58, 18]} />
                  <meshStandardMaterial color={theme.highlight} emissive={theme.highlight} emissiveIntensity={0.72} />
                </mesh>
              )}
              {target.kind === 'kicker' && (
                <mesh>
                  <cylinderGeometry args={[0.9, 1.1, 0.6, 14]} />
                  <meshStandardMaterial color={tint} emissive={emissive} emissiveIntensity={0.52} />
                </mesh>
              )}
              {target.kind === 'mini' && (
                <mesh>
                  <octahedronGeometry args={[0.76, 0]} />
                  <meshStandardMaterial color={theme.highlight} emissive={theme.highlight} emissiveIntensity={0.88} />
                </mesh>
              )}
            </group>
          );
        })}

        {bursts.map((b) => (
          <BurstFX key={b.id} burst={b} />
        ))}
      </Physics>
    </>
  );
};
