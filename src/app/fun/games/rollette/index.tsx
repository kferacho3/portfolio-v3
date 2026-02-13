'use client';

import * as React from 'react';
import { Html, PerspectiveCamera, Sparkles, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useSnapshot } from 'valtio';
import * as THREE from 'three';

import { useGameUIState } from '../../store/selectors';
import {
  ARENA_PALETTES,
  BALL_RADIUS,
  BOARD_HALF_L,
  BOARD_HALF_W,
  BOARD_LENGTH,
  BOARD_WIDTH,
  COMBO_WINDOW,
  DRAIN_Z,
  DROP_RESET_DELAY_MS,
  KEY_FORCE,
  MAX_PLANAR_SPEED,
  MOUSE_STEER_FORCE,
  NUDGE_COOLDOWN,
  NUDGE_FORCE,
  NUDGE_UP_FORCE,
  POWER_DURATION,
  TILT_LIMIT,
  TILT_LOCK_TIME,
  TILT_WINDOW,
  WORLD_GRAVITY,
} from './constants';
import { rolletteState } from './state';
import type { ArenaThemeId, ObstacleKind, PowerMode, Vec3 } from './types';

export { rolletteState } from './state';

type DropBankSpec = {
  id: string;
  targets: Vec3[];
};

type SpinnerSpec = {
  id: string;
  position: Vec3;
  axis: 'x' | 'z';
  length: number;
  speed: number;
};

type WormholeSpec = {
  id: string;
  from: Vec3;
  to: Vec3;
};

type ObstacleSpec = {
  id: string;
  kind: ObstacleKind;
  position: Vec3;
  size: [number, number, number];
  motionAxis: 'x' | 'z' | 'y';
  speed: number;
  amplitude: number;
};

type RampSensorSpec = {
  id: string;
  position: Vec3;
  size: [number, number, number];
  rotation: Vec3;
  kind: 'ramp' | 'orbit';
};

type ArenaLayout = {
  id: ArenaThemeId;
  launch: Vec3;
  standups: Vec3[];
  pops: Vec3[];
  dropBanks: DropBankSpec[];
  spinners: SpinnerSpec[];
  slings: Array<{ id: string; position: Vec3; dirX: number }>;
  variTargets: Vec3[];
  bullseyes: Vec3[];
  saucers: Vec3[];
  rollovers: Vec3[];
  ramps: RampSensorSpec[];
  magnets: Vec3[];
  kickers: Vec3[];
  mysteries: Vec3[];
  wormholes: WormholeSpec[];
  obstacles: ObstacleSpec[];
  captive: Vec3;
  gobble: Vec3;
  miniZone: { center: Vec3; size: [number, number] };
  miniTargets: Vec3[];
  bossCore: Vec3;
  xandarShots: [string, string, string];
  ghostPath: Vec3[];
};

type SpawnedBall = {
  id: string;
  position: Vec3;
  velocity: Vec3;
};

type FxKind = 'burst' | 'ring' | 'pillar';
type FxEvent = {
  id: string;
  kind: FxKind;
  position: Vec3;
  color: string;
  born: number;
  life: number;
  strength: number;
};

const nowSec = () => performance.now() / 1000;

const pair = (x: number, z: number, y = BALL_RADIUS + 0.35): Vec3[] => [
  [x, y, z],
  [-x, y, z],
];

function makeLayouts(): Record<ArenaThemeId, ArenaLayout> {
  const nebula: ArenaLayout = {
    id: 'nebula',
    launch: [0, BALL_RADIUS + 0.6, 18.4],
    standups: [
      ...pair(9.2, -14.2),
      ...pair(7.4, -10.8),
      ...pair(5.2, -7.8),
      [0, BALL_RADIUS + 0.35, -11.6],
    ],
    pops: [[0, BALL_RADIUS + 0.45, -17.2], ...pair(3.2, -15.6), ...pair(6.2, -17.7)],
    dropBanks: [
      {
        id: 'nebula_bank_left',
        targets: [
          [-11.2, BALL_RADIUS + 0.35, -8.2],
          [-11.2, BALL_RADIUS + 0.35, -6.9],
          [-11.2, BALL_RADIUS + 0.35, -5.6],
        ],
      },
      {
        id: 'nebula_bank_right',
        targets: [
          [11.2, BALL_RADIUS + 0.35, -8.2],
          [11.2, BALL_RADIUS + 0.35, -6.9],
          [11.2, BALL_RADIUS + 0.35, -5.6],
        ],
      },
      {
        id: 'nebula_bank_top',
        targets: [
          [-2.1, BALL_RADIUS + 0.35, -19.1],
          [0, BALL_RADIUS + 0.35, -19.1],
          [2.1, BALL_RADIUS + 0.35, -19.1],
        ],
      },
    ],
    spinners: [
      { id: 'nebula_spinner_l', position: [-7.1, BALL_RADIUS + 0.5, -11.9], axis: 'z', length: 2.6, speed: 2.4 },
      { id: 'nebula_spinner_r', position: [7.1, BALL_RADIUS + 0.5, -11.9], axis: 'z', length: 2.6, speed: 2.4 },
      { id: 'nebula_spinner_c', position: [0, BALL_RADIUS + 0.5, -6.1], axis: 'x', length: 2.8, speed: 1.6 },
    ],
    slings: [
      { id: 'nebula_sling_l', position: [-6.6, BALL_RADIUS + 0.3, 16.2], dirX: 1 },
      { id: 'nebula_sling_r', position: [6.6, BALL_RADIUS + 0.3, 16.2], dirX: -1 },
    ],
    variTargets: [...pair(8.5, -1.1)],
    bullseyes: [[0, BALL_RADIUS + 0.35, -14.9], ...pair(4.2, -3.5)],
    saucers: [[0, BALL_RADIUS + 0.25, -10.5], ...pair(9.6, -17.9)],
    rollovers: [[0, BALL_RADIUS + 0.18, -20.5], ...pair(2.8, -20.1), ...pair(5.5, -19.5), ...pair(9.8, -12.6)],
    ramps: [
      {
        id: 'nebula_ramp_l',
        position: [-8.1, BALL_RADIUS + 0.6, 1.6],
        size: [1.9, 1, 10.2],
        rotation: [0.4, 0.23, 0.08],
        kind: 'ramp',
      },
      {
        id: 'nebula_ramp_r',
        position: [8.1, BALL_RADIUS + 0.6, 1.6],
        size: [1.9, 1, 10.2],
        rotation: [0.4, -0.23, -0.08],
        kind: 'ramp',
      },
      {
        id: 'orbit_gate_1',
        position: [-12.1, BALL_RADIUS + 0.4, -5.5],
        size: [1.2, 0.8, 23],
        rotation: [0, 0, 0],
        kind: 'orbit',
      },
      {
        id: 'orbit_gate_2',
        position: [12.1, BALL_RADIUS + 0.4, -5.5],
        size: [1.2, 0.8, 23],
        rotation: [0, 0, 0],
        kind: 'orbit',
      },
    ],
    magnets: [[0, BALL_RADIUS + 0.25, -7.5], ...pair(7.8, -16.1)],
    kickers: [...pair(10.8, -1.8)],
    mysteries: [[0, BALL_RADIUS + 0.25, -21]],
    wormholes: [
      { id: 'nebula_worm_l', from: [-12.4, BALL_RADIUS + 0.3, -17.3], to: [-1.6, BALL_RADIUS + 0.8, -6.2] },
      { id: 'nebula_worm_r', from: [12.4, BALL_RADIUS + 0.3, -17.3], to: [1.6, BALL_RADIUS + 0.8, -6.2] },
    ],
    obstacles: [
      {
        id: 'nebula_flag',
        kind: 'spinFlag',
        position: [0, BALL_RADIUS + 0.42, -1.9],
        size: [6.4, 0.45, 0.38],
        motionAxis: 'y',
        speed: 2.7,
        amplitude: 1,
      },
      {
        id: 'nebula_drop_l',
        kind: 'dropWall',
        position: [-4.3, BALL_RADIUS + 0.46, -12.7],
        size: [1.6, 1.25, 0.5],
        motionAxis: 'y',
        speed: 1.5,
        amplitude: 0.6,
      },
      {
        id: 'nebula_drop_r',
        kind: 'dropWall',
        position: [4.3, BALL_RADIUS + 0.46, -12.7],
        size: [1.6, 1.25, 0.5],
        motionAxis: 'y',
        speed: 1.5,
        amplitude: 0.6,
      },
      {
        id: 'nebula_crusher',
        kind: 'crusher',
        position: [0, BALL_RADIUS + 0.55, -18.3],
        size: [3.4, 0.7, 0.7],
        motionAxis: 'x',
        speed: 1.2,
        amplitude: 3.3,
      },
    ],
    captive: [0, BALL_RADIUS + 0.34, 8.4],
    gobble: [0, BALL_RADIUS + 0.15, 20.4],
    miniZone: { center: [0, BALL_RADIUS + 0.8, -22], size: [7, 5.2] },
    miniTargets: [...pair(2.1, -22), [0, BALL_RADIUS + 1, -23.1]],
    bossCore: [0, BALL_RADIUS + 1.4, -22.7],
    xandarShots: ['orbit_gate_1', 'saucer_prime', 'boss_core'],
    ghostPath: [
      [-11.8, BALL_RADIUS + 0.55, -5.5],
      [-9.4, BALL_RADIUS + 0.62, -12.2],
      [-5.2, BALL_RADIUS + 0.72, -17.2],
      [0, BALL_RADIUS + 0.9, -21.8],
      [5.3, BALL_RADIUS + 0.72, -17.2],
      [9.5, BALL_RADIUS + 0.62, -12.2],
      [11.8, BALL_RADIUS + 0.55, -5.5],
      [0, BALL_RADIUS + 0.48, 8.4],
    ],
  };

  const cotton: ArenaLayout = {
    id: 'cotton',
    launch: [0, BALL_RADIUS + 0.6, 17.8],
    standups: [...pair(10.2, -9.5), ...pair(7.4, -4.8), ...pair(4.6, -0.4), [0, BALL_RADIUS + 0.35, -6]],
    pops: [...pair(2.4, -11.2), ...pair(5.1, -12.8), ...pair(7.8, -11.2), [0, BALL_RADIUS + 0.45, -14.3]],
    dropBanks: [
      {
        id: 'cotton_bank_arc_left',
        targets: [
          [-8.6, BALL_RADIUS + 0.35, -7.4],
          [-7.6, BALL_RADIUS + 0.35, -8.6],
          [-6.4, BALL_RADIUS + 0.35, -9.5],
        ],
      },
      {
        id: 'cotton_bank_arc_right',
        targets: [
          [8.6, BALL_RADIUS + 0.35, -7.4],
          [7.6, BALL_RADIUS + 0.35, -8.6],
          [6.4, BALL_RADIUS + 0.35, -9.5],
        ],
      },
      {
        id: 'cotton_bank_top',
        targets: [
          [-2.6, BALL_RADIUS + 0.35, -18],
          [0, BALL_RADIUS + 0.35, -18.6],
          [2.6, BALL_RADIUS + 0.35, -18],
        ],
      },
    ],
    spinners: [
      { id: 'cotton_spinner_l', position: [-6.2, BALL_RADIUS + 0.48, -3.4], axis: 'x', length: 2.2, speed: 1.5 },
      { id: 'cotton_spinner_r', position: [6.2, BALL_RADIUS + 0.48, -3.4], axis: 'x', length: 2.2, speed: 1.5 },
      { id: 'cotton_spinner_c', position: [0, BALL_RADIUS + 0.48, -12.2], axis: 'z', length: 3.2, speed: 2.2 },
    ],
    slings: [
      { id: 'cotton_sling_l', position: [-6.4, BALL_RADIUS + 0.3, 15.6], dirX: 1 },
      { id: 'cotton_sling_r', position: [6.4, BALL_RADIUS + 0.3, 15.6], dirX: -1 },
    ],
    variTargets: [...pair(9.6, -14.1)],
    bullseyes: [[0, BALL_RADIUS + 0.35, -8.8], ...pair(5.8, -15)],
    saucers: [[0, BALL_RADIUS + 0.25, -16], ...pair(9.7, -5.5)],
    rollovers: [[0, BALL_RADIUS + 0.18, -21], ...pair(3.1, -20.7), ...pair(6.2, -20.1), ...pair(9.3, -18.6)],
    ramps: [
      {
        id: 'cotton_ramp_l',
        position: [-9.6, BALL_RADIUS + 0.6, 4.1],
        size: [1.5, 1, 8.2],
        rotation: [0.35, 0.34, 0.11],
        kind: 'ramp',
      },
      {
        id: 'cotton_ramp_r',
        position: [9.6, BALL_RADIUS + 0.6, 4.1],
        size: [1.5, 1, 8.2],
        rotation: [0.35, -0.34, -0.11],
        kind: 'ramp',
      },
      {
        id: 'orbit_gate_1',
        position: [-11.3, BALL_RADIUS + 0.4, -3.4],
        size: [1.3, 0.8, 25.4],
        rotation: [0, 0.12, 0],
        kind: 'orbit',
      },
      {
        id: 'orbit_gate_2',
        position: [11.3, BALL_RADIUS + 0.4, -3.4],
        size: [1.3, 0.8, 25.4],
        rotation: [0, -0.12, 0],
        kind: 'orbit',
      },
    ],
    magnets: [[0, BALL_RADIUS + 0.25, -10.2], ...pair(5.4, -5.8)],
    kickers: [...pair(10.8, 0.8)],
    mysteries: [[0, BALL_RADIUS + 0.25, -22.2]],
    wormholes: [
      { id: 'cotton_worm_l', from: [-12.1, BALL_RADIUS + 0.3, 0.2], to: [-2, BALL_RADIUS + 0.8, -16.8] },
      { id: 'cotton_worm_r', from: [12.1, BALL_RADIUS + 0.3, 0.2], to: [2, BALL_RADIUS + 0.8, -16.8] },
    ],
    obstacles: [
      {
        id: 'cotton_flag',
        kind: 'spinFlag',
        position: [0, BALL_RADIUS + 0.42, -5.5],
        size: [5.2, 0.38, 0.34],
        motionAxis: 'y',
        speed: 1.9,
        amplitude: 1,
      },
      {
        id: 'cotton_drop_l',
        kind: 'dropWall',
        position: [-5.8, BALL_RADIUS + 0.52, -13.2],
        size: [1.6, 1.45, 0.5],
        motionAxis: 'y',
        speed: 1.6,
        amplitude: 0.7,
      },
      {
        id: 'cotton_drop_r',
        kind: 'dropWall',
        position: [5.8, BALL_RADIUS + 0.52, -13.2],
        size: [1.6, 1.45, 0.5],
        motionAxis: 'y',
        speed: 1.6,
        amplitude: 0.7,
      },
      {
        id: 'cotton_crusher',
        kind: 'crusher',
        position: [0, BALL_RADIUS + 0.52, -17.8],
        size: [2.9, 0.64, 0.64],
        motionAxis: 'z',
        speed: 1.2,
        amplitude: 2.8,
      },
    ],
    captive: [0, BALL_RADIUS + 0.34, 7.6],
    gobble: [0, BALL_RADIUS + 0.15, 20.1],
    miniZone: { center: [0, BALL_RADIUS + 0.82, -13.8], size: [8.4, 6.4] },
    miniTargets: [...pair(2.4, -14.4), ...pair(3.7, -12.8), [0, BALL_RADIUS + 1, -13.8]],
    bossCore: [0, BALL_RADIUS + 1.36, -13.8],
    xandarShots: ['orbit_gate_2', 'saucer_prime', 'boss_core'],
    ghostPath: [
      [-11.2, BALL_RADIUS + 0.58, -3.4],
      [-8.7, BALL_RADIUS + 0.66, -10.8],
      [-4.4, BALL_RADIUS + 0.76, -14.2],
      [0, BALL_RADIUS + 0.92, -13.8],
      [4.4, BALL_RADIUS + 0.76, -14.2],
      [8.7, BALL_RADIUS + 0.66, -10.8],
      [11.2, BALL_RADIUS + 0.58, -3.4],
      [0, BALL_RADIUS + 0.48, 7.6],
    ],
  };

  const nature: ArenaLayout = {
    id: 'nature',
    launch: [0, BALL_RADIUS + 0.6, 18.8],
    standups: [
      ...pair(2.2, -4.8),
      ...pair(4.5, -8.2),
      ...pair(6.8, -11.6),
      ...pair(9.1, -15.1),
      [0, BALL_RADIUS + 0.35, -12.1],
    ],
    pops: [[0, BALL_RADIUS + 0.45, -9.2], ...pair(3.3, -12.1), ...pair(6.6, -15.8)],
    dropBanks: [
      {
        id: 'nature_leaf_left',
        targets: [
          [-10.2, BALL_RADIUS + 0.35, -12.8],
          [-9.2, BALL_RADIUS + 0.35, -14.1],
          [-8.1, BALL_RADIUS + 0.35, -15.4],
        ],
      },
      {
        id: 'nature_leaf_right',
        targets: [
          [10.2, BALL_RADIUS + 0.35, -12.8],
          [9.2, BALL_RADIUS + 0.35, -14.1],
          [8.1, BALL_RADIUS + 0.35, -15.4],
        ],
      },
      {
        id: 'nature_root_mid',
        targets: [
          [-1.8, BALL_RADIUS + 0.35, -3.2],
          [0, BALL_RADIUS + 0.35, -2.1],
          [1.8, BALL_RADIUS + 0.35, -3.2],
        ],
      },
    ],
    spinners: [
      { id: 'nature_spinner_l', position: [-7.5, BALL_RADIUS + 0.48, -7.2], axis: 'z', length: 2.4, speed: 2 },
      { id: 'nature_spinner_r', position: [7.5, BALL_RADIUS + 0.48, -7.2], axis: 'z', length: 2.4, speed: 2 },
      { id: 'nature_spinner_c', position: [0, BALL_RADIUS + 0.48, -16.7], axis: 'x', length: 3.8, speed: 1.3 },
    ],
    slings: [
      { id: 'nature_sling_l', position: [-6.1, BALL_RADIUS + 0.3, 16.6], dirX: 1 },
      { id: 'nature_sling_r', position: [6.1, BALL_RADIUS + 0.3, 16.6], dirX: -1 },
    ],
    variTargets: [...pair(8.8, -2.2)],
    bullseyes: [[0, BALL_RADIUS + 0.35, -18.4], ...pair(4.8, -13.1)],
    saucers: [[0, BALL_RADIUS + 0.25, -5.6], ...pair(10.1, -18.2)],
    rollovers: [[0, BALL_RADIUS + 0.18, -21.2], ...pair(2.8, -20.4), ...pair(5.6, -19.2), ...pair(8.4, -17.4)],
    ramps: [
      {
        id: 'nature_ramp_l',
        position: [-8.6, BALL_RADIUS + 0.68, -1.2],
        size: [1.9, 1, 11.4],
        rotation: [0.44, 0.25, 0.08],
        kind: 'ramp',
      },
      {
        id: 'nature_ramp_r',
        position: [8.6, BALL_RADIUS + 0.68, -1.2],
        size: [1.9, 1, 11.4],
        rotation: [0.44, -0.25, -0.08],
        kind: 'ramp',
      },
      {
        id: 'orbit_gate_1',
        position: [-11.4, BALL_RADIUS + 0.42, -5.8],
        size: [1.4, 0.8, 24],
        rotation: [0, 0.04, 0],
        kind: 'orbit',
      },
      {
        id: 'orbit_gate_2',
        position: [11.4, BALL_RADIUS + 0.42, -5.8],
        size: [1.4, 0.8, 24],
        rotation: [0, -0.04, 0],
        kind: 'orbit',
      },
    ],
    magnets: [[0, BALL_RADIUS + 0.25, -14.8], ...pair(6.4, -10.8)],
    kickers: [...pair(10.6, -0.2)],
    mysteries: [[0, BALL_RADIUS + 0.25, -22.3]],
    wormholes: [
      { id: 'nature_worm_l', from: [-12.4, BALL_RADIUS + 0.3, -15.2], to: [-2.4, BALL_RADIUS + 0.8, -4.6] },
      { id: 'nature_worm_r', from: [12.4, BALL_RADIUS + 0.3, -15.2], to: [2.4, BALL_RADIUS + 0.8, -4.6] },
    ],
    obstacles: [
      {
        id: 'nature_flag',
        kind: 'spinFlag',
        position: [0, BALL_RADIUS + 0.44, -10.1],
        size: [5.7, 0.4, 0.34],
        motionAxis: 'y',
        speed: 2.2,
        amplitude: 1,
      },
      {
        id: 'nature_drop_l',
        kind: 'dropWall',
        position: [-5.2, BALL_RADIUS + 0.56, -16.5],
        size: [1.5, 1.5, 0.5],
        motionAxis: 'y',
        speed: 1.8,
        amplitude: 0.75,
      },
      {
        id: 'nature_drop_r',
        kind: 'dropWall',
        position: [5.2, BALL_RADIUS + 0.56, -16.5],
        size: [1.5, 1.5, 0.5],
        motionAxis: 'y',
        speed: 1.8,
        amplitude: 0.75,
      },
      {
        id: 'nature_crusher',
        kind: 'crusher',
        position: [0, BALL_RADIUS + 0.52, -12.6],
        size: [3.2, 0.64, 0.64],
        motionAxis: 'x',
        speed: 1.1,
        amplitude: 3.5,
      },
    ],
    captive: [0, BALL_RADIUS + 0.34, 9.2],
    gobble: [0, BALL_RADIUS + 0.15, 20.6],
    miniZone: { center: [0, BALL_RADIUS + 0.86, -18.9], size: [7.8, 5.6] },
    miniTargets: [...pair(2.3, -19.2), ...pair(3.7, -17.8), [0, BALL_RADIUS + 1, -19.2]],
    bossCore: [0, BALL_RADIUS + 1.4, -19.4],
    xandarShots: ['orbit_gate_1', 'saucer_prime', 'boss_core'],
    ghostPath: [
      [-11.2, BALL_RADIUS + 0.55, -5.8],
      [-8.3, BALL_RADIUS + 0.66, -11.8],
      [-4.4, BALL_RADIUS + 0.78, -16.3],
      [0, BALL_RADIUS + 0.94, -19.1],
      [4.4, BALL_RADIUS + 0.78, -16.3],
      [8.3, BALL_RADIUS + 0.66, -11.8],
      [11.2, BALL_RADIUS + 0.55, -5.8],
      [0, BALL_RADIUS + 0.48, 9.2],
    ],
  };

  return {
    nebula,
    cotton,
    nature,
  };
}

const ARENA_LAYOUTS = makeLayouts();

function inMiniZone(pos: Vec3, layout: ArenaLayout) {
  const [x, , z] = pos;
  const [cx, , cz] = layout.miniZone.center;
  const [sx, sz] = layout.miniZone.size;
  return Math.abs(x - cx) <= sx * 0.5 && Math.abs(z - cz) <= sz * 0.5;
}

function FxBurst({ event }: { event: FxEvent }) {
  const groupRef = React.useRef<THREE.Group>(null);
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 7 + Math.round(event.strength * 4) }, (_, i) => {
        const a = (i / 11) * Math.PI * 2 + Math.random() * 0.7;
        const r = 0.2 + Math.random() * 0.9;
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          y: 0.08 + Math.random() * 0.75,
          s: 0.08 + Math.random() * 0.14,
        };
      }),
    [event.id, event.strength]
  );
  const mat = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: event.color,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [event.color]
  );

  useFrame(() => {
    const t = THREE.MathUtils.clamp((nowSec() - event.born) / event.life, 0, 1);
    if (groupRef.current) groupRef.current.scale.setScalar(1 + t * (1 + event.strength * 0.6));
    mat.opacity = 0.92 * (1 - t);
  });

  React.useEffect(() => () => mat.dispose(), [mat]);

  return (
    <group ref={groupRef} position={event.position}>
      {pieces.map((piece, i) => (
        <mesh key={`${event.id}-${i}`} position={[piece.x, piece.y, piece.z]} scale={piece.s} material={mat}>
          <sphereGeometry args={[1, 8, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function FxRing({ event }: { event: FxEvent }) {
  const ringRef = React.useRef<THREE.Mesh>(null);
  const matRef = React.useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!ringRef.current || !matRef.current) return;
    const t = THREE.MathUtils.clamp((nowSec() - event.born) / event.life, 0, 1);
    const s = THREE.MathUtils.lerp(0.2, 2.6 + event.strength * 1.3, t);
    ringRef.current.scale.set(s, s, s);
    matRef.current.opacity = 0.7 * (1 - t);
  });

  return (
    <mesh ref={ringRef} position={event.position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.9, 44]} />
      <meshBasicMaterial
        ref={matRef}
        color={event.color}
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function FxPillar({ event }: { event: FxEvent }) {
  const meshRef = React.useRef<THREE.Mesh>(null);
  const matRef = React.useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const t = THREE.MathUtils.clamp((nowSec() - event.born) / event.life, 0, 1);
    meshRef.current.scale.set(1 + t * 0.4, 1 + t * 2.4, 1 + t * 0.4);
    matRef.current.opacity = 0.5 * (1 - t);
  });

  return (
    <mesh ref={meshRef} position={event.position}>
      <cylinderGeometry args={[0.24, 0.42, 1.4, 14, 1, true]} />
      <meshBasicMaterial
        ref={matRef}
        color={event.color}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function HudOverlay({
  paletteText,
  arenaName,
}: {
  paletteText: string;
  arenaName: string;
}) {
  const snap = useSnapshot(rolletteState);
  const comboPct = THREE.MathUtils.clamp(snap.comboTimer / COMBO_WINDOW, 0, 1);

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute top-4 left-4 rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-white backdrop-blur-sm">
          <div className="text-[10px] tracking-[0.35em] uppercase text-white/60">Score</div>
          <div className="font-mono text-3xl font-black">{Math.floor(snap.score).toLocaleString()}</div>
          <div className="mt-1 text-xs text-white/60">
            Best {Math.floor(snap.highScore).toLocaleString()} · Bonus {Math.floor(snap.bonusBank).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-white/70">Lives {snap.lives}</div>
          <div className="mt-1 h-2 w-44 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-amber-300/90" style={{ width: `${comboPct * 100}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-white/65">Combo x{Math.max(1, snap.combo)}</div>
        </div>

        <div className="absolute top-4 right-4 rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-white backdrop-blur-sm">
          <div className="text-[10px] tracking-[0.35em] uppercase text-white/60">Arena</div>
          <div className="text-lg font-bold">{arenaName}</div>
          <div className="mt-1 max-w-[240px] text-xs text-white/70">{paletteText}</div>
          <div className="mt-2 text-xs text-white/80">
            {snap.powerMode ? `${snap.powerMode} ${snap.powerTimer.toFixed(1)}s` : 'No Powerup'}
          </div>
          <div className="text-xs text-white/80">Multiplier x{snap.multiplier.toFixed(1)}</div>
          <div className="text-xs text-white/80">
            Wizard {snap.wizardActive ? `${snap.wizardTime.toFixed(1)}s` : 'Off'}
          </div>
          <div className="text-xs text-white/80">
            Xandar {snap.xandarActive ? `P${snap.xandarPhase} · ${snap.xandarTimer.toFixed(1)}s` : 'Inactive'}
          </div>
        </div>

        <div className="absolute bottom-4 left-4 rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-[11px] text-white/75 backdrop-blur-sm">
          <div>`WASD` / `Arrows` steer the ball</div>
          <div>Mouse also steers toward cursor</div>
          <div>`Space` nudge/tilt burst · `R` restart</div>
          <div>`1` Nebula · `2` Cotton · `3` Nature</div>
        </div>

        {snap.toastTimer > 0 && snap.toast && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-white shadow-lg backdrop-blur-sm">
            {snap.toast}
          </div>
        )}

        {snap.phase === 'gameover' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="pointer-events-auto rounded-2xl border border-white/20 bg-black/70 px-8 py-6 text-center text-white backdrop-blur-sm">
              <div className="text-4xl font-black">GAME OVER</div>
              <div className="mt-2 font-mono text-2xl">{Math.floor(snap.score).toLocaleString()}</div>
              <div className="mt-4 text-sm text-white/75">Press `R` to restart</div>
            </div>
          </div>
        )}
      </div>
    </Html>
  );
}

const RollettePinballUltimate: React.FC<{ soundsOn?: boolean }> = ({
  soundsOn = true,
}) => {
  const { gl } = useThree();
  const { paused } = useGameUIState();
  const snap = useSnapshot(rolletteState);

  const layout = React.useMemo(() => ARENA_LAYOUTS[snap.arena], [snap.arena]);
  const palette = ARENA_PALETTES[snap.arena];

  const mainBallRef = React.useRef<RapierRigidBody | null>(null);
  const extraBallRefs = React.useRef<Record<string, RapierRigidBody>>({});

  const [extraBalls, setExtraBalls] = React.useState<SpawnedBall[]>([]);
  const [dropState, setDropState] = React.useState<Record<string, boolean>>({});
  const dropStateRef = React.useRef<Record<string, boolean>>({});
  const [fxEvents, setFxEvents] = React.useState<FxEvent[]>([]);

  const spinnerRefs = React.useRef<Record<string, RapierRigidBody | null>>({});
  const spinnerAngles = React.useRef<Record<string, number>>({});
  const spinnerBoost = React.useRef<Record<string, number>>({});
  const obstacleRefs = React.useRef<Record<string, RapierRigidBody | null>>({});

  const hitCooldown = React.useRef<Record<string, number>>({});
  const dropResetTimers = React.useRef<Record<string, number>>({});
  const nudgeHistory = React.useRef<number[]>([]);
  const skillShotOpenUntil = React.useRef(0);
  const lastShot = React.useRef<{ kind: 'ramp' | 'orbit' | null; at: number }>({
    kind: null,
    at: -100,
  });

  const pointerNdc = React.useRef(new THREE.Vector2(0, 0));
  const pointerActive = React.useRef(false);
  const keyState = React.useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const raycaster = React.useMemo(() => new THREE.Raycaster(), []);
  const pointerPlane = React.useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BALL_RADIUS + 0.34)),
    []
  );
  const pointerWorld = React.useRef(new THREE.Vector3(0, BALL_RADIUS + 0.34, 0));

  const audioRef = React.useRef<{
    ctx: AudioContext | null;
    unlocked: boolean;
  }>({
    ctx: null,
    unlocked: false,
  });

  const pruneClock = React.useRef(0);

  const dropTargets = React.useMemo(
    () =>
      layout.dropBanks.flatMap((bank) =>
        bank.targets.map((position, i) => ({
          id: `${bank.id}_${i}`,
          bankId: bank.id,
          position,
        }))
      ),
    [layout]
  );

  const dropBankMembers = React.useMemo(() => {
    const members: Record<string, string[]> = {};
    for (const target of dropTargets) {
      if (!members[target.bankId]) members[target.bankId] = [];
      members[target.bankId].push(target.id);
    }
    return members;
  }, [dropTargets]);

  const unlockAudio = React.useCallback(() => {
    if (!soundsOn) return;
    const audio = audioRef.current;
    if (audio.unlocked) return;
    audio.unlocked = true;
    if (!audio.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audio.ctx = new Ctx();
    }
    if (audio.ctx?.state === 'suspended') void audio.ctx.resume();
  }, [soundsOn]);

  const playTone = React.useCallback(
    (freq: number, dur: number, type: OscillatorType, gain = 0.02) => {
      if (!soundsOn) return;
      const audio = audioRef.current;
      if (!audio.ctx || !audio.unlocked) return;
      const now = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const amp = audio.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      amp.gain.setValueAtTime(gain, now);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(amp);
      amp.connect(audio.ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    },
    [soundsOn]
  );

  const playSfx = React.useCallback(
    (kind: 'pop' | 'drop' | 'orbit' | 'ramp' | 'mystery' | 'danger' | 'jackpot' | 'worm') => {
      switch (kind) {
        case 'pop':
          playTone(780, 0.06, 'triangle', 0.02);
          playTone(420, 0.05, 'square', 0.014);
          break;
        case 'drop':
          playTone(540, 0.08, 'square', 0.016);
          break;
        case 'orbit':
          playTone(860, 0.05, 'sine', 0.016);
          break;
        case 'ramp':
          playTone(700, 0.06, 'sawtooth', 0.014);
          break;
        case 'mystery':
          playTone(640, 0.08, 'sine', 0.02);
          playTone(960, 0.08, 'sine', 0.02);
          break;
        case 'danger':
          playTone(170, 0.15, 'sawtooth', 0.03);
          break;
        case 'jackpot':
          playTone(760, 0.09, 'triangle', 0.022);
          playTone(1040, 0.08, 'sine', 0.02);
          break;
        case 'worm':
          playTone(330, 0.08, 'triangle', 0.02);
          playTone(560, 0.08, 'triangle', 0.02);
          break;
      }
    },
    [playTone]
  );

  const spawnFx = React.useCallback((kind: FxKind, position: Vec3, color: string, strength = 1) => {
    const ev: FxEvent = {
      id: `${kind}-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      kind,
      position,
      color,
      born: nowSec(),
      life: kind === 'burst' ? 0.55 : kind === 'ring' ? 0.62 : 0.5,
      strength,
    };
    setFxEvents((prev) => [...prev.slice(-90), ev]);
  }, []);

  const getBalls = React.useCallback(() => {
    const bodies: RapierRigidBody[] = [];
    if (mainBallRef.current) bodies.push(mainBallRef.current);
    for (const id of Object.keys(extraBallRefs.current)) {
      const rb = extraBallRefs.current[id];
      if (rb) bodies.push(rb);
    }
    return bodies;
  }, []);

  const nearestBall = React.useCallback(
    (position: Vec3) => {
      let best: RapierRigidBody | null = null;
      let bestD = Number.POSITIVE_INFINITY;
      const [x, y, z] = position;
      const bodies = getBalls();
      for (const body of bodies) {
        const p = body.translation();
        const d = (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = body;
        }
      }
      return best;
    },
    [getBalls]
  );

  const canHit = React.useCallback((id: string, cooldown: number) => {
    const t = nowSec();
    const last = hitCooldown.current[id] ?? -9999;
    if (t - last < cooldown) return false;
    hitCooldown.current[id] = t;
    return true;
  }, []);

  const applyImpulseFromPoint = React.useCallback(
    (
      position: Vec3,
      planarStrength: number,
      upStrength: number,
      directionOverride?: [number, number]
    ) => {
      const ball = nearestBall(position);
      if (!ball) return;
      const p = ball.translation();
      const dx = p.x - position[0];
      const dz = p.z - position[2];
      let ix = dx;
      let iz = dz;
      if (directionOverride) {
        ix = directionOverride[0];
        iz = directionOverride[1];
      }
      const len = Math.hypot(ix, iz);
      if (len < 1e-4) return;
      const nx = ix / len;
      const nz = iz / len;
      ball.applyImpulse({ x: nx * planarStrength, y: upStrength, z: nz * planarStrength }, true);
    },
    [nearestBall]
  );

  const respawnMainBall = React.useCallback((ball: RapierRigidBody | null) => {
    if (!ball) return;
    ball.setTranslation(
      { x: layout.launch[0], y: layout.launch[1], z: layout.launch[2] },
      true
    );
    ball.setLinvel({ x: 0, y: 0, z: -4.5 }, true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    skillShotOpenUntil.current = nowSec() + 7.2;
  }, [layout.launch]);

  const clearDropTimers = React.useCallback(() => {
    for (const k of Object.keys(dropResetTimers.current)) {
      window.clearTimeout(dropResetTimers.current[k]);
    }
    dropResetTimers.current = {};
  }, []);

  const resetRunRuntime = React.useCallback(() => {
    clearDropTimers();
    setExtraBalls([]);
    extraBallRefs.current = {};
    setDropState({});
    dropStateRef.current = {};
    setFxEvents([]);
    hitCooldown.current = {};
    spinnerBoost.current = {};
    nudgeHistory.current = [];
    lastShot.current = { kind: null, at: -100 };
    respawnMainBall(mainBallRef.current);
  }, [clearDropTimers, respawnMainBall]);

  const maybeUnlockWizard = React.useCallback(() => {
    if (rolletteState.wizardActive) return;
    if (
      rolletteState.dropBanksCleared >= 2 &&
      rolletteState.spinnerHits >= 8 &&
      rolletteState.bullseyeHits >= 5 &&
      rolletteState.rolloverHits >= 6
    ) {
      rolletteState.activateWizard();
      playSfx('jackpot');
    }
  }, [playSfx]);

  const maybeActivateXandar = React.useCallback(() => {
    if (rolletteState.xandarActive) return;
    if (
      rolletteState.wizardActive &&
      rolletteState.wormholeUses >= 3 &&
      rolletteState.miniBossHits >= 2
    ) {
      rolletteState.activateXandar();
      playSfx('jackpot');
    }
  }, [playSfx]);

  const scheduleBankReset = React.useCallback(
    (bankId: string) => {
      if (dropResetTimers.current[bankId]) {
        window.clearTimeout(dropResetTimers.current[bankId]);
      }
      dropResetTimers.current[bankId] = window.setTimeout(() => {
        setDropState((prev) => {
          const next = { ...prev };
          for (const id of dropBankMembers[bankId] ?? []) {
            delete next[id];
          }
          dropStateRef.current = next;
          return next;
        });
      }, DROP_RESET_DELAY_MS);
    },
    [dropBankMembers]
  );

  const spawnMultiball = React.useCallback(() => {
    const rb = mainBallRef.current;
    if (!rb) return;
    const p = rb.translation();
    const v = rb.linvel();
    const t = Date.now().toString(36);
    setExtraBalls([
      {
        id: `mb-${t}-a`,
        position: [p.x + 0.8, Math.max(BALL_RADIUS + 0.65, p.y + 0.1), p.z - 0.3],
        velocity: [v.x + 3, Math.max(1, v.y + 0.8), v.z - 1.8],
      },
      {
        id: `mb-${t}-b`,
        position: [p.x - 0.8, Math.max(BALL_RADIUS + 0.65, p.y + 0.1), p.z - 0.3],
        velocity: [v.x - 3, Math.max(1, v.y + 0.8), v.z - 1.8],
      },
    ]);
    rolletteState.activatePower('MULTIBALL', POWER_DURATION);
    rolletteState.setToast('MULTIBALL', 1.2);
    playSfx('jackpot');
  }, [playSfx]);

  const mysteryAward = React.useCallback(() => {
    const roll = Math.floor(Math.random() * 8);
    switch (roll) {
      case 0:
        rolletteState.addScore(8_000);
        rolletteState.setToast('MYSTERY +8000', 1.2);
        break;
      case 1:
        rolletteState.activateMultiplier(2, 10);
        rolletteState.setToast('DOUBLE SCORING', 1.2);
        break;
      case 2:
        rolletteState.activatePower('HEAVY');
        break;
      case 3:
        rolletteState.activatePower('GHOST');
        break;
      case 4:
        rolletteState.activatePower('MAGNET');
        break;
      case 5:
        if (rolletteState.lives < rolletteState.maxLives) {
          rolletteState.lives += 1;
          rolletteState.setToast('EXTRA BALL', 1.2);
        } else {
          rolletteState.addScore(3_000);
          rolletteState.setToast('MYSTERY +3000', 1.2);
        }
        break;
      case 6:
        spawnMultiball();
        break;
      default:
        rolletteState.activateWizard();
        break;
    }
    rolletteState.mysteryHits += 1;
    maybeActivateXandar();
  }, [maybeActivateXandar, spawnMultiball]);

  const resolveXandarShot = React.useCallback((id: string) => {
    if (!rolletteState.xandarActive) return;
    const [shot1, shot2, shot3] = layout.xandarShots;
    if (rolletteState.xandarPhase === 1 && id === shot1) {
      rolletteState.advanceXandar();
    } else if (rolletteState.xandarPhase === 2 && id === shot2) {
      rolletteState.advanceXandar();
    } else if (rolletteState.xandarPhase === 3 && id === shot3) {
      rolletteState.advanceXandar();
      playSfx('jackpot');
    }
  }, [layout.xandarShots, playSfx]);

  const scoreHit = React.useCallback(
    (
      kind:
        | 'standup'
        | 'drop'
        | 'pop'
        | 'spinner'
        | 'sling'
        | 'vari'
        | 'bullOuter'
        | 'bullInner'
        | 'saucer'
        | 'rollover'
        | 'ramp'
        | 'orbit'
        | 'magnet'
        | 'kicker'
        | 'mystery'
        | 'captive'
        | 'gobble'
        | 'mini'
        | 'wormhole',
      id: string,
      position: Vec3,
      basePoints: number,
      opts?: { dropBank?: string; cooldown?: number }
    ) => {
      if (rolletteState.phase !== 'playing') return;
      if (paused) return;
      if (!canHit(id, opts?.cooldown ?? 0.18)) return;

      const inMini = inMiniZone(position, layout);
      let points = basePoints;

      if (kind === 'drop') {
        if (dropStateRef.current[id]) return;
        setDropState((prev) => {
          const next = { ...prev, [id]: true };
          dropStateRef.current = next;
          return next;
        });
        playSfx('drop');

        if (opts?.dropBank) {
          const bank = dropBankMembers[opts.dropBank] ?? [];
          const willClear = bank.every((targetId) =>
            targetId === id ? true : Boolean(dropStateRef.current[targetId])
          );
          if (willClear) {
            rolletteState.dropBanksCleared += 1;
            rolletteState.addScore(6_000);
            rolletteState.activateMultiplier(1.4, 8);
            rolletteState.setToast('DROP BANK CLEARED', 1.1);
            spawnFx('pillar', position, palette.bonus, 1.3);
            scheduleBankReset(opts.dropBank);
          }
        }
      } else if (kind === 'pop') {
        applyImpulseFromPoint(position, 7.8, 1.2);
        playSfx('pop');
      } else if (kind === 'spinner') {
        rolletteState.spinnerHits += 1;
        spinnerBoost.current[id] = Math.min(4.2, (spinnerBoost.current[id] ?? 0) + 1.2);
        playSfx('orbit');
      } else if (kind === 'sling') {
        playSfx('pop');
      } else if (kind === 'vari') {
        const ball = nearestBall(position);
        if (ball) {
          const vel = ball.linvel();
          const speed = Math.hypot(vel.x, vel.y, vel.z);
          points = Math.floor(basePoints + speed * 130);
        }
      } else if (kind === 'bullInner') {
        rolletteState.bullseyeHits += 1;
        rolletteState.activateMultiplier(1.5, 6);
        playSfx('jackpot');
      } else if (kind === 'bullOuter') {
        rolletteState.bullseyeHits += 1;
        playSfx('pop');
      } else if (kind === 'saucer') {
        const ball = nearestBall(position);
        if (ball) {
          const angle = (nowSec() * 7) % (Math.PI * 2);
          ball.setTranslation({ x: position[0], y: BALL_RADIUS + 0.62, z: position[2] }, true);
          ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
          window.setTimeout(() => {
            ball.applyImpulse(
              { x: Math.cos(angle) * 6.6, y: 2, z: Math.sin(angle) * 6.6 - 1.8 },
              true
            );
          }, 260);
        }
        playSfx('orbit');
      } else if (kind === 'rollover') {
        rolletteState.rolloverHits += 1;
        if (id === 'skill_shot' && nowSec() <= skillShotOpenUntil.current) {
          rolletteState.addScore(9_000);
          rolletteState.activateMultiplier(2.1, 7);
          rolletteState.setToast('SKILL SHOT', 1.15);
          playSfx('jackpot');
        }
      } else if (kind === 'ramp') {
        if (lastShot.current.kind === 'orbit' && nowSec() - lastShot.current.at < 2.4) {
          rolletteState.addScore(2_500);
          rolletteState.setToast('RAMP/ORBIT COMBO', 0.9);
          playSfx('jackpot');
        } else {
          playSfx('ramp');
        }
        lastShot.current = { kind: 'ramp', at: nowSec() };
      } else if (kind === 'orbit') {
        if (lastShot.current.kind === 'ramp' && nowSec() - lastShot.current.at < 2.4) {
          rolletteState.addScore(2_500);
          rolletteState.setToast('ORBIT/RAMP COMBO', 0.9);
          playSfx('jackpot');
        } else {
          playSfx('orbit');
        }
        lastShot.current = { kind: 'orbit', at: nowSec() };
      } else if (kind === 'magnet') {
        applyImpulseFromPoint(position, -4.6, 0.6);
      } else if (kind === 'kicker') {
        applyImpulseFromPoint(position, 9.2, 2.2);
        playSfx('pop');
      } else if (kind === 'mystery') {
        mysteryAward();
        playSfx('mystery');
      } else if (kind === 'captive') {
        rolletteState.addScore(2_200);
        playSfx('pop');
      } else if (kind === 'gobble') {
        rolletteState.addScore(11_000);
        rolletteState.activateMultiplier(2, 8);
        const ball = nearestBall(position);
        if (ball) {
          ball.setTranslation(
            { x: layout.launch[0], y: layout.launch[1], z: layout.launch[2] },
            true
          );
          ball.setLinvel({ x: 0, y: 0, z: -6.3 }, true);
        }
        playSfx('jackpot');
      } else if (kind === 'mini') {
        rolletteState.miniBossHits += 1;
      } else if (kind === 'wormhole') {
        rolletteState.wormholeUses += 1;
        playSfx('worm');
        maybeActivateXandar();
      }

      rolletteState.comboScore(points, inMini);
      resolveXandarShot(id);
      maybeUnlockWizard();

      if (kind === 'drop' || kind === 'standup' || kind === 'spinner' || kind === 'kicker') {
        spawnFx('burst', position, palette.particleA, 1.1);
      } else if (kind === 'pop' || kind === 'sling' || kind === 'bullInner' || kind === 'bullOuter') {
        spawnFx('ring', position, palette.accent, kind === 'bullInner' ? 1.6 : 1);
      } else if (kind === 'mystery' || kind === 'gobble' || kind === 'mini') {
        spawnFx('pillar', position, palette.bonus, 1.6);
      } else {
        spawnFx('ring', position, palette.particleB, 0.9);
      }
    },
    [
      applyImpulseFromPoint,
      canHit,
      dropBankMembers,
      layout,
      maybeActivateXandar,
      maybeUnlockWizard,
      mysteryAward,
      nearestBall,
      palette.accent,
      palette.bonus,
      palette.particleA,
      palette.particleB,
      paused,
      playSfx,
      resolveXandarShot,
      scheduleBankReset,
      spawnFx,
    ]
  );

  const handleWormhole = React.useCallback(
    (spec: WormholeSpec) => {
      if (rolletteState.phase !== 'playing' || paused) return;
      if (!canHit(spec.id, 0.85)) return;
      const ball = nearestBall(spec.from);
      if (!ball) return;
      const vel = ball.linvel();
      ball.setTranslation({ x: spec.to[0], y: spec.to[1], z: spec.to[2] }, true);
      ball.setLinvel({ x: vel.x * 1.04, y: Math.max(vel.y, 0.8), z: vel.z * 1.04 }, true);
      scoreHit('wormhole', spec.id, spec.to, 2_100, { cooldown: 0.85 });
      spawnFx('pillar', spec.to, palette.accent2, 1.35);
    },
    [canHit, nearestBall, palette.accent2, paused, scoreHit, spawnFx]
  );

  const hitObstacle = React.useCallback(
    (spec: ObstacleSpec) => {
      if (rolletteState.phase !== 'playing' || paused) return;
      if (!canHit(`obstacle-${spec.id}`, 1.1)) return;

      if (rolletteState.powerMode === 'HEAVY') {
        rolletteState.addScore(1_800);
        rolletteState.setToast('HEAVY IMPACT', 0.8);
        spawnFx('burst', spec.position, palette.bonus, 1.2);
      } else if (rolletteState.powerMode === 'GHOST') {
        rolletteState.addScore(800);
        rolletteState.setToast('PHASED', 0.7);
      } else {
        rolletteState.loseLife();
        applyImpulseFromPoint(spec.position, 8.6, 1.5);
        spawnFx('ring', spec.position, palette.danger, 1.2);
        playSfx('danger');
      }
    },
    [applyImpulseFromPoint, canHit, palette.bonus, palette.danger, paused, playSfx, spawnFx]
  );

  const doNudge = React.useCallback(() => {
    if (rolletteState.phase !== 'playing') return;
    if (paused) return;
    if (rolletteState.tiltLockTime > 0) {
      rolletteState.setToast('TILT LOCK', 0.8);
      return;
    }
    if (rolletteState.nudgeCooldown > 0) return;

    const t = nowSec();
    nudgeHistory.current = nudgeHistory.current.filter((v) => t - v <= TILT_WINDOW);
    nudgeHistory.current.push(t);

    if (nudgeHistory.current.length > TILT_LIMIT) {
      rolletteState.tiltLockTime = TILT_LOCK_TIME;
      rolletteState.setToast('TILT', 1);
      playSfx('danger');
      return;
    }

    const bodies = getBalls();
    for (const body of bodies) {
      const impulseX = (Math.random() - 0.5) * NUDGE_FORCE;
      body.applyImpulse({ x: impulseX, y: NUDGE_UP_FORCE, z: -NUDGE_FORCE }, true);
    }
    rolletteState.nudgeCooldown = NUDGE_COOLDOWN;
    spawnFx('ring', [0, BALL_RADIUS + 0.12, 15.5], palette.accent, 1.35);
    playSfx('pop');
  }, [getBalls, palette.accent, paused, playSfx, spawnFx]);

  React.useEffect(() => {
    rolletteState.load();
    rolletteState.start();
    const previousTouchAction = gl.domElement.style.touchAction;
    gl.domElement.style.touchAction = 'none';
    return () => {
      gl.domElement.style.touchAction = previousTouchAction;
      clearDropTimers();
      const ctx = audioRef.current.ctx;
      if (ctx) void ctx.close();
      audioRef.current.ctx = null;
      audioRef.current.unlocked = false;
    };
  }, [clearDropTimers, gl.domElement.style]);

  React.useEffect(() => {
    resetRunRuntime();
  }, [resetRunRuntime, snap.arena, snap.resetTick]);

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      unlockAudio();
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.current.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      pointerActive.current = true;
    };
    const onPointerLeave = () => {
      pointerActive.current = false;
    };
    const onPointerDown = () => {
      unlockAudio();
      pointerActive.current = true;
      if (rolletteState.phase === 'gameover') rolletteState.reset();
    };
    const onContextMenu = (event: Event) => event.preventDefault();

    const el = gl.domElement;
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl.domElement, unlockAudio]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      unlockAudio();

      if (key === 'w') keyState.current.w = true;
      if (key === 'a') keyState.current.a = true;
      if (key === 's') keyState.current.s = true;
      if (key === 'd') keyState.current.d = true;
      if (event.key === 'ArrowUp') keyState.current.up = true;
      if (event.key === 'ArrowDown') keyState.current.down = true;
      if (event.key === 'ArrowLeft') keyState.current.left = true;
      if (event.key === 'ArrowRight') keyState.current.right = true;

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        doNudge();
      }
      if (key === 'r' && !event.repeat) {
        event.preventDefault();
        rolletteState.reset();
      }
      if (key === 'enter' && !event.repeat && rolletteState.phase === 'gameover') {
        rolletteState.reset();
      }
      if (!event.repeat && key === '1') {
        rolletteState.setArena('nebula');
        rolletteState.reset();
      }
      if (!event.repeat && key === '2') {
        rolletteState.setArena('cotton');
        rolletteState.reset();
      }
      if (!event.repeat && key === '3') {
        rolletteState.setArena('nature');
        rolletteState.reset();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'w') keyState.current.w = false;
      if (key === 'a') keyState.current.a = false;
      if (key === 's') keyState.current.s = false;
      if (key === 'd') keyState.current.d = false;
      if (event.key === 'ArrowUp') keyState.current.up = false;
      if (event.key === 'ArrowDown') keyState.current.down = false;
      if (event.key === 'ArrowLeft') keyState.current.left = false;
      if (event.key === 'ArrowRight') keyState.current.right = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [doNudge, unlockAudio]);

  useFrame((state, dt) => {
    const delta = Math.min(0.05, dt);

    for (const spinner of layout.spinners) {
      const body = spinnerRefs.current[spinner.id];
      if (!body) continue;
      spinnerAngles.current[spinner.id] =
        (spinnerAngles.current[spinner.id] ?? 0) +
        delta * (spinner.speed + (spinnerBoost.current[spinner.id] ?? 0));
      spinnerBoost.current[spinner.id] = Math.max(
        0,
        (spinnerBoost.current[spinner.id] ?? 0) - delta * 2
      );
      const q = new THREE.Quaternion();
      q.setFromEuler(
        new THREE.Euler(
          spinner.axis === 'x' ? spinnerAngles.current[spinner.id] : 0,
          spinner.axis === 'z' ? spinnerAngles.current[spinner.id] : 0,
          spinner.axis === 'x' ? 0 : spinnerAngles.current[spinner.id] * 0.2
        )
      );
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

    for (const obstacle of layout.obstacles) {
      const body = obstacleRefs.current[obstacle.id];
      if (!body) continue;
      const t = state.clock.elapsedTime * obstacle.speed;
      const wave = Math.sin(t) * obstacle.amplitude;
      const base = obstacle.position;
      const next = { x: base[0], y: base[1], z: base[2] };
      if (obstacle.motionAxis === 'x') next.x = base[0] + wave;
      if (obstacle.motionAxis === 'z') next.z = base[2] + wave;
      if (obstacle.motionAxis === 'y') next.y = base[1] + wave * 0.45;
      body.setNextKinematicTranslation(next);
      if (obstacle.kind === 'spinFlag') {
        const q = new THREE.Quaternion();
        q.setFromEuler(new THREE.Euler(0, t * 1.2, 0));
        body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      }
    }

    const ghost = state.scene.getObjectByName('rollette-ghost-path');
    if (ghost && rolletteState.xandarActive) {
      const path = layout.ghostPath;
      if (path.length > 1) {
        const cursor = ((state.clock.elapsedTime * 1.2) % path.length + path.length) % path.length;
        const i0 = Math.floor(cursor) % path.length;
        const i1 = (i0 + 1) % path.length;
        const t = cursor - Math.floor(cursor);
        const a = path[i0];
        const b = path[i1];
        ghost.position.set(
          THREE.MathUtils.lerp(a[0], b[0], t),
          THREE.MathUtils.lerp(a[1], b[1], t),
          THREE.MathUtils.lerp(a[2], b[2], t)
        );
      }
      ghost.visible = true;
    } else if (ghost) {
      ghost.visible = false;
    }

    pruneClock.current += delta;
    if (pruneClock.current > 0.08) {
      pruneClock.current = 0;
      setFxEvents((prev) => prev.filter((event) => nowSec() - event.born <= event.life));
    }

    if (paused || rolletteState.phase !== 'playing') return;

    rolletteState.tick(delta);

    raycaster.setFromCamera(pointerNdc.current, state.camera);
    raycaster.ray.intersectPlane(pointerPlane, pointerWorld.current);

    const bodies = getBalls();
    const powerMul = rolletteState.powerMode === 'HEAVY' ? 0.82 : rolletteState.wizardActive ? 1.22 : 1;

    for (const body of bodies) {
      const lv = body.linvel();
      const pos = body.translation();

      let moveX = 0;
      let moveZ = 0;
      if (keyState.current.w || keyState.current.up) moveZ -= 1;
      if (keyState.current.s || keyState.current.down) moveZ += 1;
      if (keyState.current.a || keyState.current.left) moveX -= 1;
      if (keyState.current.d || keyState.current.right) moveX += 1;

      if (moveX !== 0 || moveZ !== 0) {
        const n = Math.hypot(moveX, moveZ);
        moveX /= n;
        moveZ /= n;
      }

      if (pointerActive.current) {
        const dx = pointerWorld.current.x - pos.x;
        const dz = pointerWorld.current.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.001) {
          const ndx = dx / dist;
          const ndz = dz / dist;
          const steer = MOUSE_STEER_FORCE * THREE.MathUtils.clamp(dist * 0.22, 0, 1.5);
          moveX += ndx * steer;
          moveZ += ndz * steer;
        }
      }

      if (rolletteState.powerMode === 'MAGNET') {
        const closest = layout.magnets.reduce<{ pos: Vec3; d: number } | null>(
          (best, target) => {
            const d = Math.hypot(target[0] - pos.x, target[2] - pos.z);
            if (!best || d < best.d) return { pos: target, d };
            return best;
          },
          null
        );
        if (closest && closest.d < 8) {
          const mdx = closest.pos[0] - pos.x;
          const mdz = closest.pos[2] - pos.z;
          const ml = Math.max(0.001, Math.hypot(mdx, mdz));
          moveX += (mdx / ml) * 0.28;
          moveZ += (mdz / ml) * 0.28;
        }
      }

      body.applyImpulse(
        {
          x: moveX * KEY_FORCE * powerMul,
          y: 0,
          z: moveZ * KEY_FORCE * powerMul,
        },
        true
      );

      const planar = Math.hypot(lv.x, lv.z);
      if (planar > MAX_PLANAR_SPEED) {
        const k = MAX_PLANAR_SPEED / planar;
        body.setLinvel({ x: lv.x * k, y: lv.y, z: lv.z * k }, true);
      }
    }

    const main = mainBallRef.current;
    if (main) {
      const p = main.translation();
      if (p.z > DRAIN_Z || p.y < -2.6) {
        rolletteState.cashBonus();
        rolletteState.loseLife();
        setExtraBalls([]);
        extraBallRefs.current = {};
        if (rolletteState.phase === 'playing') {
          respawnMainBall(main);
        }
      }
    }

    const survivors: SpawnedBall[] = [];
    for (const spawned of extraBalls) {
      const rb = extraBallRefs.current[spawned.id];
      if (!rb) continue;
      const p = rb.translation();
      if (p.z > DRAIN_Z || p.y < -2.8) continue;
      survivors.push(spawned);
    }
    if (survivors.length !== extraBalls.length) setExtraBalls(survivors);
  });

  const ballColor =
    rolletteState.powerMode === 'HEAVY'
      ? '#ff6a2a'
      : rolletteState.powerMode === 'GHOST'
        ? '#98eeff'
        : rolletteState.powerMode === 'MAGNET'
          ? '#ffe76e'
          : '#f5fbff';

  const renderFx = (event: FxEvent) => {
    if (event.kind === 'burst') return <FxBurst key={event.id} event={event} />;
    if (event.kind === 'ring') return <FxRing key={event.id} event={event} />;
    return <FxPillar key={event.id} event={event} />;
  };

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 22, 30]} fov={45} />
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 22, 82]} />

      <ambientLight intensity={0.7} color={palette.text} />
      <directionalLight position={[10, 16, 10]} intensity={1} color={palette.text} castShadow />
      <directionalLight position={[-10, 8, -4]} intensity={0.35} color={palette.accent2} />
      <pointLight position={[0, 9, -10]} intensity={0.4} color={palette.accent} distance={35} />

      {snap.arena === 'nebula' && (
        <>
          <Stars radius={90} depth={34} count={1400} factor={3.8} saturation={0} fade speed={0.35} />
          <Sparkles
            count={180}
            speed={0.25}
            opacity={0.4}
            color={palette.particleA}
            scale={[32, 32, 32]}
            size={2.4}
            position={[0, 4, -6]}
          />
        </>
      )}
      {snap.arena === 'cotton' && (
        <Sparkles
          count={260}
          speed={0.2}
          opacity={0.26}
          color={palette.particleA}
          scale={[34, 24, 34]}
          size={3.2}
          position={[0, 3, -6]}
        />
      )}
      {snap.arena === 'nature' && (
        <Sparkles
          count={220}
          speed={0.35}
          opacity={0.3}
          color={palette.particleB}
          scale={[32, 26, 32]}
          size={2.6}
          position={[0, 3, -6]}
        />
      )}

      <Physics gravity={WORLD_GRAVITY} paused={paused}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[BOARD_HALF_W, 0.35, BOARD_HALF_L]} position={[0, -0.35, 0]} />
          <CuboidCollider args={[0.65, 1.6, BOARD_HALF_L + 0.2]} position={[-BOARD_HALF_W - 0.65, 1, 0]} />
          <CuboidCollider args={[0.65, 1.6, BOARD_HALF_L + 0.2]} position={[BOARD_HALF_W + 0.65, 1, 0]} />
          <CuboidCollider args={[BOARD_HALF_W + 0.65, 1.6, 0.65]} position={[0, 1, -BOARD_HALF_L - 0.65]} />
          <CuboidCollider args={[BOARD_HALF_W * 0.36, 1.6, 0.65]} position={[-BOARD_HALF_W * 0.64, 1, BOARD_HALF_L + 0.65]} />
          <CuboidCollider args={[BOARD_HALF_W * 0.36, 1.6, 0.65]} position={[BOARD_HALF_W * 0.64, 1, BOARD_HALF_L + 0.65]} />
        </RigidBody>

        <mesh position={[0, -0.02, 0]} receiveShadow>
          <boxGeometry args={[BOARD_WIDTH, 0.08, BOARD_LENGTH]} />
          <meshStandardMaterial color={palette.floor} roughness={0.64} metalness={0.16} />
        </mesh>

        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.4, 9.4, 72]} />
          <meshBasicMaterial color={palette.line} transparent opacity={0.28} />
        </mesh>

        <mesh position={[0, 0.12, -BOARD_HALF_L + 2.2]}>
          <boxGeometry args={[BOARD_WIDTH - 1.8, 0.05, 0.1]} />
          <meshBasicMaterial color={palette.accent2} transparent opacity={0.48} />
        </mesh>

        {layout.ramps.map((ramp) => (
          <React.Fragment key={ramp.id}>
            <mesh
              position={ramp.position}
              rotation={ramp.rotation}
              castShadow
              receiveShadow
            >
              <boxGeometry args={ramp.size} />
              <meshStandardMaterial
                color={ramp.kind === 'ramp' ? palette.accent2 : palette.line}
                roughness={0.28}
                metalness={0.44}
                emissive={ramp.kind === 'ramp' ? palette.accent : palette.accent2}
                emissiveIntensity={0.2}
              />
            </mesh>
            <RigidBody type="fixed" sensor>
              <CuboidCollider
                args={[ramp.size[0] * 0.55, 0.7, ramp.size[2] * 0.55]}
                position={[ramp.position[0], BALL_RADIUS + 0.45, ramp.position[2]]}
                sensor
                onIntersectionEnter={() =>
                  scoreHit(ramp.kind, ramp.id, ramp.position, ramp.kind === 'ramp' ? 1100 : 900, {
                    cooldown: 0.4,
                  })
                }
              />
            </RigidBody>
          </React.Fragment>
        ))}

        {layout.standups.map((position, i) => (
          <RigidBody
            key={`standup-${i}`}
            type="fixed"
            colliders={false}
            position={position}
            onCollisionEnter={() => scoreHit('standup', `standup-${i}`, position, 240)}
          >
            <CuboidCollider args={[0.35, 0.48, 0.13]} />
            <mesh castShadow>
              <boxGeometry args={[0.7, 0.96, 0.26]} />
              <meshStandardMaterial color={palette.accent2} emissive={palette.accent2} emissiveIntensity={0.2} />
            </mesh>
          </RigidBody>
        ))}

        {dropTargets.map((target) => {
          const dropped = Boolean(dropState[target.id]);
          return (
            <RigidBody
              key={target.id}
              type="fixed"
              colliders={false}
              position={target.position}
              onCollisionEnter={() =>
                scoreHit('drop', target.id, target.position, 650, {
                  dropBank: target.bankId,
                  cooldown: 0.35,
                })
              }
            >
              {!dropped && <CuboidCollider args={[0.34, 0.45, 0.14]} />}
              <mesh castShadow position={[0, dropped ? -0.9 : 0, 0]}>
                <boxGeometry args={[0.68, 0.9, 0.28]} />
                <meshStandardMaterial color={palette.bonus} emissive={palette.bonus} emissiveIntensity={0.18} />
              </mesh>
            </RigidBody>
          );
        })}

        {layout.pops.map((position, i) => (
          <RigidBody
            key={`pop-${i}`}
            type="fixed"
            colliders={false}
            position={position}
            onCollisionEnter={() => scoreHit('pop', `pop-${i}`, position, 420, { cooldown: 0.22 })}
          >
            <BallCollider args={[0.56]} restitution={1.2} friction={0} />
            <mesh castShadow>
              <cylinderGeometry args={[0.65, 0.78, 0.62, 22]} />
              <meshStandardMaterial
                color={palette.accent}
                emissive={palette.accent}
                emissiveIntensity={0.35}
                roughness={0.2}
                metalness={0.35}
              />
            </mesh>
          </RigidBody>
        ))}

        {layout.spinners.map((spinner) => (
          <RigidBody
            key={spinner.id}
            ref={(rb) => {
              spinnerRefs.current[spinner.id] = rb;
            }}
            type="kinematicPosition"
            colliders={false}
            position={spinner.position}
            onCollisionEnter={() =>
              scoreHit('spinner', spinner.id, spinner.position, 520, { cooldown: 0.1 })
            }
          >
            <CuboidCollider args={[spinner.axis === 'x' ? spinner.length * 0.5 : 0.18, 0.2, spinner.axis === 'z' ? spinner.length * 0.5 : 0.18]} />
            <mesh castShadow>
              <boxGeometry args={[spinner.axis === 'x' ? spinner.length : 0.38, 0.38, spinner.axis === 'z' ? spinner.length : 0.38]} />
              <meshStandardMaterial color={palette.bonus} emissive={palette.accent2} emissiveIntensity={0.24} />
            </mesh>
          </RigidBody>
        ))}

        {layout.slings.map((sling) => (
          <RigidBody
            key={sling.id}
            type="fixed"
            colliders={false}
            position={sling.position}
            rotation={[0, sling.dirX > 0 ? Math.PI * 0.2 : -Math.PI * 0.2, 0]}
            onCollisionEnter={() => {
              scoreHit('sling', sling.id, sling.position, 360, { cooldown: 0.24 });
              applyImpulseFromPoint(sling.position, 10.4, 2.3, [sling.dirX, -1]);
            }}
          >
            <CuboidCollider args={[1.05, 0.22, 0.38]} />
            <mesh castShadow>
              <boxGeometry args={[2.1, 0.44, 0.76]} />
              <meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.25} />
            </mesh>
          </RigidBody>
        ))}

        {layout.variTargets.map((position, i) => (
          <RigidBody
            key={`vari-${i}`}
            type="fixed"
            colliders={false}
            position={position}
            onCollisionEnter={() => scoreHit('vari', `vari-${i}`, position, 680, { cooldown: 0.24 })}
          >
            <CuboidCollider args={[0.55, 0.2, 0.2]} />
            <mesh castShadow>
              <boxGeometry args={[1.1, 0.4, 0.4]} />
              <meshStandardMaterial color={palette.line} emissive={palette.bonus} emissiveIntensity={0.16} />
            </mesh>
          </RigidBody>
        ))}

        {layout.bullseyes.map((position, i) => (
          <React.Fragment key={`bull-${i}`}>
            <RigidBody type="fixed" colliders={false} position={position}>
              <BallCollider
                args={[0.66]}
                sensor
                onIntersectionEnter={() =>
                  scoreHit('bullOuter', `bull_outer-${i}`, position, 820, { cooldown: 0.26 })
                }
              />
              <BallCollider
                args={[0.28]}
                sensor
                onIntersectionEnter={() =>
                  scoreHit('bullInner', `bull_inner-${i}`, position, 2100, { cooldown: 0.36 })
                }
              />
            </RigidBody>
            <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.24, 0.7, 44]} />
              <meshBasicMaterial color={palette.bonus} transparent opacity={0.85} />
            </mesh>
          </React.Fragment>
        ))}

        {layout.saucers.map((position, i) => (
          <React.Fragment key={`saucer-${i}`}>
            <RigidBody type="fixed" colliders={false} position={position}>
              <BallCollider
                args={[0.54]}
                sensor
                onIntersectionEnter={() =>
                  scoreHit('saucer', i === 0 ? 'saucer_prime' : `saucer-${i}`, position, 1400, {
                    cooldown: 0.72,
                  })
                }
              />
            </RigidBody>
            <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.58, 0.8, 0.14, 22]} />
              <meshStandardMaterial color={palette.line} emissive={palette.accent2} emissiveIntensity={0.2} />
            </mesh>
          </React.Fragment>
        ))}

        {layout.rollovers.map((position, i) => (
          <React.Fragment key={`rollover-${i}`}>
            <RigidBody type="fixed" colliders={false} position={position}>
              <CuboidCollider
                args={[0.46, 0.16, 0.46]}
                sensor
                onIntersectionEnter={() =>
                  scoreHit('rollover', i === 0 ? 'skill_shot' : `rollover-${i}`, position, 280, {
                    cooldown: 0.22,
                  })
                }
              />
            </RigidBody>
            <mesh position={position}>
              <cylinderGeometry args={[0.34, 0.34, 0.1, 16]} />
              <meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.3} />
            </mesh>
          </React.Fragment>
        ))}

        {layout.magnets.map((position, i) => (
          <React.Fragment key={`mag-${i}`}>
            <RigidBody type="fixed" colliders={false} position={position}>
              <BallCollider
                args={[0.5]}
                sensor
                onIntersectionEnter={() =>
                  scoreHit('magnet', `magnet-${i}`, position, 480, { cooldown: 0.3 })
                }
              />
            </RigidBody>
            <mesh position={position}>
              <sphereGeometry args={[0.33, 16, 16]} />
              <meshStandardMaterial color={palette.accent2} emissive={palette.accent2} emissiveIntensity={0.3} />
            </mesh>
          </React.Fragment>
        ))}

        {layout.kickers.map((position, i) => (
          <RigidBody
            key={`kicker-${i}`}
            type="fixed"
            colliders={false}
            position={position}
            onCollisionEnter={() =>
              scoreHit('kicker', `kicker-${i}`, position, 700, { cooldown: 0.3 })
            }
          >
            <BallCollider args={[0.46]} restitution={1.25} />
            <mesh castShadow>
              <coneGeometry args={[0.45, 0.9, 14]} />
              <meshStandardMaterial color={palette.danger} emissive={palette.danger} emissiveIntensity={0.28} />
            </mesh>
          </RigidBody>
        ))}

        {layout.mysteries.map((position, i) => (
          <React.Fragment key={`mystery-${i}`}>
            <RigidBody type="fixed" colliders={false} position={position}>
              <BallCollider
                args={[0.48]}
                sensor
                onIntersectionEnter={() =>
                  scoreHit('mystery', `mystery-${i}`, position, 900, { cooldown: 0.85 })
                }
              />
            </RigidBody>
            <mesh position={position}>
              <octahedronGeometry args={[0.52, 0]} />
              <meshStandardMaterial color={palette.bonus} emissive={palette.bonus} emissiveIntensity={0.45} />
            </mesh>
          </React.Fragment>
        ))}

        {layout.wormholes.map((worm) => (
          <React.Fragment key={worm.id}>
            <RigidBody type="fixed" colliders={false} position={worm.from}>
              <BallCollider args={[0.7]} sensor onIntersectionEnter={() => handleWormhole(worm)} />
            </RigidBody>
            <mesh position={worm.from} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.8, 0.1, 14, 30]} />
              <meshBasicMaterial color={palette.accent2} transparent opacity={0.8} />
            </mesh>
            <mesh position={worm.to} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.54, 0.08, 12, 24]} />
              <meshBasicMaterial color={palette.accent} transparent opacity={0.7} />
            </mesh>
          </React.Fragment>
        ))}

        {layout.obstacles.map((obstacle) => (
          <RigidBody
            key={obstacle.id}
            ref={(rb) => {
              obstacleRefs.current[obstacle.id] = rb;
            }}
            type="kinematicPosition"
            colliders={false}
            position={obstacle.position}
            onCollisionEnter={() => hitObstacle(obstacle)}
          >
            <CuboidCollider args={[obstacle.size[0] * 0.5, obstacle.size[1] * 0.5, obstacle.size[2] * 0.5]} />
            <mesh castShadow>
              <boxGeometry args={obstacle.size} />
              <meshStandardMaterial color={palette.danger} emissive={palette.danger} emissiveIntensity={0.2} />
            </mesh>
          </RigidBody>
        ))}

        <RigidBody type="fixed" colliders={false} position={layout.captive}>
          <BallCollider
            args={[0.38]}
            sensor
            onIntersectionEnter={() => scoreHit('captive', 'captive_ball', layout.captive, 1200, { cooldown: 0.45 })}
          />
          <mesh castShadow>
            <sphereGeometry args={[0.36, 18, 18]} />
            <meshStandardMaterial color={palette.line} emissive={palette.accent2} emissiveIntensity={0.2} />
          </mesh>
        </RigidBody>

        <RigidBody type="fixed" colliders={false} position={layout.gobble}>
          <BallCollider
            args={[0.74]}
            sensor
            onIntersectionEnter={() => scoreHit('gobble', 'gobble_hole', layout.gobble, 1900, { cooldown: 0.9 })}
          />
        </RigidBody>
        <mesh position={layout.gobble} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.78, 1.06, 0.22, 28]} />
          <meshStandardMaterial color={palette.danger} roughness={0.58} metalness={0.2} />
        </mesh>

        <mesh position={layout.miniZone.center} receiveShadow>
          <boxGeometry args={[layout.miniZone.size[0], 0.28, layout.miniZone.size[1]]} />
          <meshStandardMaterial color={palette.rail} emissive={palette.accent2} emissiveIntensity={0.08} />
        </mesh>

        {layout.miniTargets.map((position, i) => (
          <RigidBody
            key={`mini-target-${i}`}
            type="fixed"
            colliders={false}
            position={position}
            onCollisionEnter={() =>
              scoreHit('mini', `mini-target-${i}`, position, 1300, { cooldown: 0.22 })
            }
          >
            <CuboidCollider args={[0.4, 0.3, 0.4]} />
            <mesh castShadow>
              <dodecahedronGeometry args={[0.43, 0]} />
              <meshStandardMaterial color={palette.bonus} emissive={palette.bonus} emissiveIntensity={0.26} />
            </mesh>
          </RigidBody>
        ))}

        <RigidBody
          type="fixed"
          colliders={false}
          position={layout.bossCore}
          onCollisionEnter={() =>
            scoreHit('mini', 'boss_core', layout.bossCore, 4200, { cooldown: 0.42 })
          }
        >
          <BallCollider args={[0.72]} />
          <mesh castShadow>
            <icosahedronGeometry args={[0.7, 0]} />
            <meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.42} wireframe />
          </mesh>
        </RigidBody>

        <group name="rollette-ghost-path" visible={false}>
          <mesh>
            <sphereGeometry args={[0.34, 18, 18]} />
            <meshBasicMaterial color={palette.particleA} transparent opacity={0.55} />
          </mesh>
        </group>

        <RigidBody
          ref={(rb) => {
            mainBallRef.current = rb;
          }}
          colliders={false}
          position={layout.launch}
          linearDamping={0.07}
          angularDamping={0.45}
          canSleep={false}
          ccd
        >
          <BallCollider args={[BALL_RADIUS]} restitution={0.88} friction={0.04} />
          <mesh castShadow>
            <sphereGeometry args={[BALL_RADIUS, 28, 28]} />
            <meshStandardMaterial
              color={ballColor}
              emissive={ballColor}
              emissiveIntensity={0.22}
              metalness={0.92}
              roughness={0.14}
              transparent
              opacity={rolletteState.powerMode === 'GHOST' ? 0.56 : 1}
            />
          </mesh>
          <pointLight color={palette.accent2} intensity={0.3} distance={5.2} />
        </RigidBody>

        {extraBalls.map((spawn) => (
          <RigidBody
            key={spawn.id}
            ref={(rb) => {
              if (rb) {
                extraBallRefs.current[spawn.id] = rb;
                rb.setTranslation(
                  { x: spawn.position[0], y: spawn.position[1], z: spawn.position[2] },
                  true
                );
                rb.setLinvel({ x: spawn.velocity[0], y: spawn.velocity[1], z: spawn.velocity[2] }, true);
              } else {
                delete extraBallRefs.current[spawn.id];
              }
            }}
            colliders={false}
            position={spawn.position}
            linearDamping={0.06}
            angularDamping={0.34}
            canSleep={false}
            ccd
          >
            <BallCollider args={[BALL_RADIUS * 0.88]} restitution={0.92} friction={0.04} />
            <mesh castShadow>
              <sphereGeometry args={[BALL_RADIUS * 0.88, 22, 22]} />
              <meshStandardMaterial
                color={palette.particleA}
                emissive={palette.particleA}
                emissiveIntensity={0.32}
                metalness={0.9}
                roughness={0.12}
              />
            </mesh>
          </RigidBody>
        ))}
      </Physics>

      {fxEvents.map(renderFx)}

      <EffectComposer multisampling={0}>
        <Bloom intensity={snap.arena === 'nebula' ? 0.9 : snap.arena === 'cotton' ? 0.55 : 0.65} luminanceThreshold={0.34} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.22} darkness={0.62} />
        <Noise premultiply opacity={snap.arena === 'nebula' ? 0.05 : 0.03} />
      </EffectComposer>

      <HudOverlay paletteText={palette.description} arenaName={palette.name} />
    </>
  );
};

export default RollettePinballUltimate;
