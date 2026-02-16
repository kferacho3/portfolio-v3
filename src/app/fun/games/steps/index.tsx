'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import {
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';

import { BIOMES, difficultyForDistance } from './biomes';
import { buildChunk, CHUNK_LENGTH } from './generator';
import { parseGhost, sampleGhostFrame, serializeGhost } from './ghost';
import { dailySeedForDate, getActiveSeason, seasonBiome } from './liveOps';
import { decayCombo, applySkillEvent, scoreBreakdown } from './scoring';
import { createRunChecksum, estimateLeaderboard, queueLeaderboardSubmission, requestRewardedAd } from './services';
import { stepsState, stepsStorageKeys } from './state';
import type {
  BiomeId,
  ChunkDefinition,
  GhostFrame,
  ObstacleSpawn,
  ObstacleType,
  PlatformSpawn,
  RunGhost,
  SkillEventKind,
  Vec3Tuple,
} from './types';

export { stepsState } from './state';

type EffectCommand =
  | { type: 'invert_controls'; duration: number }
  | { type: 'slow_time'; duration: number; scale: number }
  | { type: 'anti_gravity'; duration: number; force: number }
  | { type: 'lock_rotation'; duration: number }
  | { type: 'sticky'; duration: number }
  | { type: 'size_shift'; duration: number; scale: number }
  | { type: 'teleport'; position: Vec3Tuple }
  | { type: 'impulse'; value: Vec3Tuple }
  | { type: 'speed_boost'; duration: number; multiplier: number }
  | { type: 'gravity_flip'; duration: number }
  | { type: 'wind'; duration: number; force: Vec3Tuple }
  | { type: 'checkpoint'; position: Vec3Tuple };

type ActorCallbacks = {
  onKill: (reason: string) => void;
  onSkill: (kind: SkillEventKind) => void;
  onEffect: (effect: EffectCommand) => void;
  getPlayer: () => RapierRigidBody | null;
  getTime: () => number;
};

type RuntimeRef = {
  elapsed: number;
  runTime: number;
  score: number;

  comboScore: number;
  obstacleScore: number;
  comboMultiplier: number;
  comboChain: number;
  comboTimer: number;
  comboPeak: number;

  lastChunkIndex: number;
  chunkWindowCenter: number;

  cameraShake: number;

  invertUntil: number;
  slowUntil: number;
  slowScale: number;
  antiGravityUntil: number;
  antiGravityForce: number;
  lockRotationUntil: number;
  stickyUntil: number;
  sizeUntil: number;
  sizeScale: number;
  speedBoostUntil: number;
  speedBoostMultiplier: number;
  gravityFlipUntil: number;
  windUntil: number;
  windForce: THREE.Vector3;

  checkpoint: THREE.Vector3;

  pauseForRevive: boolean;
  reviveConsumed: boolean;
  pendingDeathReason: string;

  ghostRecordTimer: number;
  ghostFrames: GhostFrame[];
  loadedGhost: RunGhost | null;

  hudCommit: number;
  rotationLocked: boolean;
  nearMissScore: number;
};

const PLAYER_NAME = 'steps-player';

const START_POSITION = new THREE.Vector3(0, 1.8, 3);
const BASE_FOG_NEAR = 10;
const BASE_FOG_FAR = 78;

const PLAYER_SIZE: Vec3Tuple = [0.78, 0.62, 0.78];
const BASE_FORWARD_SPEED = 11;
const TAP_FORWARD_IMPULSE = 1.6;
const TAP_UP_IMPULSE = 5.8;
const SIDE_IMPULSE = 5.4;

const CHUNKS_AHEAD = 6;
const CHUNKS_BEHIND = 2;

const HUD_COMMIT_INTERVAL = 0.05;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function readNum(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isPlayerPayload(payload: unknown) {
  const p = payload as {
    other?: {
      rigidBodyObject?: { name?: string; userData?: Record<string, unknown> };
      rigidBody?: RapierRigidBody | null;
    };
  };

  const fromName = p?.other?.rigidBodyObject?.name === PLAYER_NAME;
  const fromTag = p?.other?.rigidBodyObject?.userData?.stepsTag === 'player';
  if (fromName || fromTag) return true;

  return Boolean(p?.other?.rigidBody);
}

function platformColor(type: PlatformSpawn['type']) {
  if (type === 'slippery_ice' || type === 'icy_half_pipe') return '#8ddcff';
  if (type === 'bouncer' || type === 'trampoline') return '#ffb347';
  if (type === 'conveyor_belt' || type === 'reverse_conveyor' || type === 'treadmill_switch') return '#8f9bb3';
  if (type === 'sticky_glue') return '#a855f7';
  if (type === 'sinking_sand') return '#c89f6a';
  if (type === 'ghost_platform') return '#b2fff5';
  if (type === 'crushing_ceiling') return '#ff7f7f';
  if (type === 'teleporter') return '#8b5cf6';
  if (type === 'size_shifter_pad') return '#34d399';
  if (type === 'gravity_flip_zone') return '#60a5fa';
  if (type === 'wind_tunnel') return '#a7f3d0';
  return '#f9d57b';
}

function obstacleColor(type: ObstacleType) {
  if (type === 'laser_grid' || type === 'lightning_striker') return '#ff2d55';
  if (type === 'gravity_well' || type === 'magnetic_field') return '#7c3aed';
  if (type === 'mirror_maze_platform' || type === 'telefrag_portal') return '#22d3ee';
  if (type === 'bomb_tile' || type === 'rising_lava') return '#ff7b2d';
  if (type === 'rolling_boulder' || type === 'meat_grinder') return '#9ca3af';
  if (type === 'flicker_bridge') return '#86efac';
  return '#ff5f8f';
}

function obstacleReason(type: ObstacleType) {
  if (type === 'laser_grid') return 'Timed laser grid burned the run.';
  if (type === 'rising_lava') return 'Lava line caught up.';
  if (type === 'rolling_boulder') return 'Rolling boulder impact.';
  if (type === 'meat_grinder') return 'Caught in the grinder.';
  if (type === 'lightning_striker') return 'Lightning strike connected.';
  if (type === 'spike_wave' || type === 'rising_spike_columns') return 'Spike timing was off.';
  if (type === 'trapdoor_row' || type === 'fragile_glass' || type === 'snap_trap') return 'The floor gave out.';
  return 'Obstacle hit.';
}

function PlatformActor({
  spawn,
  biome,
  callbacks,
}: {
  spawn: PlatformSpawn;
  biome: BiomeId;
  callbacks: ActorCallbacks;
}) {
  const rb = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const origin = useMemo(() => new THREE.Vector3(...spawn.position), [spawn.position]);
  const fallingStart = useRef<number | null>(null);
  const bridgeStressStart = useRef<number | null>(null);

  const isKinematic =
    spawn.type === 'moving_platform' ||
    spawn.type === 'falling_platform' ||
    spawn.type === 'ghost_platform' ||
    spawn.type === 'weight_sensitive_bridge' ||
    spawn.type === 'crushing_ceiling' ||
    spawn.type === 'icy_half_pipe';

  const type = isKinematic ? 'kinematicPosition' : 'fixed';

  const friction =
    spawn.type === 'slippery_ice' || biome === 'ice'
      ? 0.08
      : spawn.type === 'sticky_glue'
        ? 1.2
        : 0.82;

  const restitution =
    spawn.type === 'bouncer'
      ? 2.2
      : spawn.type === 'trampoline'
        ? 1.6
        : spawn.type === 'speed_ramp'
          ? 0.32
          : 0.14;

  const handleCollisionEnter = useCallback(
    (payload: unknown) => {
      if (!isPlayerPayload(payload)) return;

      if (spawn.type === 'falling_platform') {
        if (fallingStart.current === null) {
          fallingStart.current = callbacks.getTime();
        }
      }

      if (spawn.type === 'weight_sensitive_bridge') {
        bridgeStressStart.current = callbacks.getTime();
      }

      if (spawn.type === 'bouncer') {
        callbacks.onEffect({ type: 'impulse', value: [0, 6.8, 0] });
        callbacks.onSkill('super_bounce');
      }

      if (spawn.type === 'trampoline') {
        callbacks.onEffect({ type: 'impulse', value: [0, 9.2, -0.6] });
        callbacks.onSkill('super_bounce');
      }

      if (spawn.type === 'speed_ramp') {
        callbacks.onEffect({ type: 'speed_boost', duration: 1.4, multiplier: 1.34 });
        callbacks.onEffect({ type: 'impulse', value: [0, 1.4, -5.6] });
      }

      if (spawn.type === 'sticky_glue') {
        callbacks.onEffect({ type: 'sticky', duration: 1.2 });
      }

      if (spawn.type === 'sinking_sand') {
        callbacks.onEffect({ type: 'sticky', duration: 1.7 });
        callbacks.onEffect({ type: 'impulse', value: [0, -1.4, 0] });
      }

      if (spawn.type === 'teleporter') {
        callbacks.onEffect({
          type: 'teleport',
          position: [
            readNum(spawn.props?.targetX, spawn.position[0]),
            readNum(spawn.props?.targetY, 1.9),
            readNum(spawn.props?.targetZ, spawn.position[2] - 8),
          ],
        });
      }

      if (spawn.type === 'size_shifter_pad') {
        callbacks.onEffect({ type: 'size_shift', duration: 2.8, scale: 0.64 });
      }

      if (spawn.type === 'gravity_flip_zone') {
        callbacks.onEffect({ type: 'gravity_flip', duration: 1.2 });
      }

      if (spawn.type === 'wind_tunnel') {
        callbacks.onEffect({ type: 'wind', duration: 0.9, force: [0.6, 4.2, -0.2] });
      }

      if (spawn.type === 'reverse_conveyor') {
        callbacks.onEffect({ type: 'impulse', value: [0, 0, 2.6] });
      }

      callbacks.onEffect({ type: 'checkpoint', position: [spawn.position[0], 2, spawn.position[2] + 1.2] });
    },
    [callbacks, spawn.position, spawn.props, spawn.type]
  );

  useFrame((state, delta) => {
    const body = rb.current;
    if (!body) return;

    const t = state.clock.elapsedTime;
    const speed = readNum(spawn.props?.speed, 1);
    const amp = readNum(spawn.props?.amplitude, 1);

    let x = origin.x;
    let y = origin.y;
    let z = origin.z;

    if (spawn.type === 'moving_platform') {
      x += Math.sin(t * speed + readNum(spawn.props?.shift, 0)) * (0.8 + amp * 0.35);
    }

    if (spawn.type === 'icy_half_pipe') {
      x += Math.sin(t * speed * 0.8) * 0.28;
    }

    if (spawn.type === 'ghost_platform') {
      const active = Math.floor(t * 1.5) % 2 === 0;
      y = active ? origin.y : origin.y - 18;
      if (meshRef.current) meshRef.current.visible = active;
    }

    if (spawn.type === 'falling_platform' && fallingStart.current !== null) {
      const elapsed = t - fallingStart.current;
      if (elapsed > readNum(spawn.props?.triggerDelay, 0.45)) {
        y -= Math.min(16, (elapsed - 0.4) * 4.6);
      }
    }

    if (spawn.type === 'weight_sensitive_bridge' && bridgeStressStart.current !== null) {
      const elapsed = t - bridgeStressStart.current;
      if (elapsed > 1.05) {
        y -= Math.min(14, (elapsed - 1.05) * 5.2);
      }
    }

    body.setNextKinematicTranslation({ x, y, z });

    if (spawn.type === 'crushing_ceiling') {
      const crush = 1.3 + Math.abs(Math.sin(t * speed * 2.4));
      if (meshRef.current) {
        meshRef.current.scale.set(1, 1, 1);
        meshRef.current.position.y = -0.2;
      }
      const player = callbacks.getPlayer();
      if (player) {
        const p = player.translation();
        if (Math.abs(p.x - origin.x) < spawn.size[0] * 0.48 && Math.abs(p.z - origin.z) < spawn.size[2] * 0.48) {
          if (p.y < crush && p.y > -0.5) {
            callbacks.onKill('Crushing ceiling closed in.');
          }
        }
      }
    }

    if (spawn.type === 'conveyor_belt' || spawn.type === 'reverse_conveyor' || spawn.type === 'treadmill_switch') {
      const player = callbacks.getPlayer();
      if (!player) return;
      const p = player.translation();
      if (Math.abs(p.x - x) <= spawn.size[0] * 0.58 && Math.abs(p.z - z) <= spawn.size[2] * 0.58 && p.y <= 2.2) {
        let conveyor = spawn.type === 'reverse_conveyor' ? 2.4 : -2.2;
        if (spawn.type === 'treadmill_switch') {
          conveyor = Math.sin(t * speed * 1.6) > 0 ? -2.6 : 2.6;
        }
        player.applyImpulse({ x: conveyor * delta, y: 0, z: 0 }, true);
      }
    }
  });

  return (
    <RigidBody
      ref={rb}
      type={type}
      colliders={false}
      position={spawn.position}
      friction={friction}
      restitution={restitution}
      onCollisionEnter={handleCollisionEnter}
    >
      <CuboidCollider
        args={[spawn.size[0] * 0.5, spawn.size[1] * 0.5, spawn.size[2] * 0.5]}
        restitution={restitution}
        friction={friction}
      />
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={spawn.size} />
        <meshStandardMaterial
          color={platformColor(spawn.type)}
          metalness={spawn.type === 'conveyor_belt' || spawn.type === 'reverse_conveyor' ? 0.28 : 0.08}
          roughness={spawn.type === 'slippery_ice' || spawn.type === 'icy_half_pipe' ? 0.12 : 0.48}
          emissive={spawn.type === 'teleporter' ? '#8b5cf6' : '#000000'}
          emissiveIntensity={spawn.type === 'teleporter' ? 0.28 : 0}
        />
      </mesh>
    </RigidBody>
  );
}

function ObstacleActor({
  spawn,
  callbacks,
}: {
  spawn: ObstacleSpawn;
  callbacks: ActorCallbacks;
}) {
  const rb = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const auxMeshRef = useRef<THREE.Mesh | null>(null);

  const origin = useMemo(() => new THREE.Vector3(...spawn.position), [spawn.position]);

  const activeRef = useRef(true);
  const triggeredRef = useRef(false);
  const triggerTimeRef = useRef<number>(0);

  const isKinematic =
    spawn.type === 'rotating_floor_disk' ||
    spawn.type === 'rotating_cross_blades' ||
    spawn.type === 'pendulum_axes' ||
    spawn.type === 'shifting_tiles' ||
    spawn.type === 'rolling_boulder' ||
    spawn.type === 'trapdoor_row' ||
    spawn.type === 'rising_spike_columns' ||
    spawn.type === 'flicker_bridge' ||
    spawn.type === 'expand_o_matic' ||
    spawn.type === 'fragile_glass' ||
    spawn.type === 'meat_grinder' ||
    spawn.type === 'rising_lava' ||
    spawn.type === 'bomb_tile' ||
    spawn.type === 'snap_trap';

  const bodyType = isKinematic ? 'kinematicPosition' : 'fixed';

  const onKillHit = useCallback(
    (payload: unknown) => {
      if (!isPlayerPayload(payload)) return;
      if (!activeRef.current) return;
      callbacks.onKill(obstacleReason(spawn.type));
    },
    [callbacks, spawn.type]
  );

  const onEffectHit = useCallback(
    (payload: unknown) => {
      if (!isPlayerPayload(payload)) return;

      if (spawn.type === 'mirror_maze_platform') {
        callbacks.onEffect({ type: 'invert_controls', duration: 2.2 });
      }

      if (spawn.type === 'time_slow_zone') {
        callbacks.onEffect({ type: 'slow_time', duration: 1.1, scale: 0.55 });
      }

      if (spawn.type === 'anti_gravity_jump_pad') {
        callbacks.onEffect({ type: 'impulse', value: [0, 10.8, -0.8] });
        callbacks.onEffect({ type: 'anti_gravity', duration: 1.05, force: 12.8 });
        callbacks.onSkill('super_bounce');
      }

      if (spawn.type === 'telefrag_portal') {
        callbacks.onEffect({
          type: 'teleport',
          position: [spawn.position[0], 2.2, spawn.position[2] - 12],
        });
        callbacks.onEffect({ type: 'size_shift', duration: 2.8, scale: 0.65 });
      }

      if (spawn.type === 'magnetic_field') {
        callbacks.onEffect({ type: 'lock_rotation', duration: 1.4 });
      }

      if (spawn.type === 'bomb_tile') {
        if (!triggeredRef.current) {
          triggeredRef.current = true;
          triggerTimeRef.current = callbacks.getTime();
        }
      }

      if (spawn.type === 'snap_trap') {
        triggeredRef.current = true;
        triggerTimeRef.current = callbacks.getTime();
      }

      if (spawn.type === 'fragile_glass') {
        triggeredRef.current = true;
        triggerTimeRef.current = callbacks.getTime();
      }

      if (spawn.type === 'split_path_bridge') {
        const player = callbacks.getPlayer();
        const safeLane = readNum(spawn.props?.safeLane, 1);
        if (player) {
          const p = player.translation();
          const lane = p.x < -1 ? 0 : p.x > 1 ? 2 : 1;
          if (lane !== safeLane) {
            callbacks.onKill('Wrong side of split path bridge.');
          }
        }
      }
    },
    [callbacks, spawn.position, spawn.props?.safeLane, spawn.type]
  );

  useFrame((state, delta) => {
    const body = rb.current;
    if (!body) return;

    const t = state.clock.elapsedTime;
    const speed = readNum(spawn.props?.speed, 1);
    const amp = readNum(spawn.props?.amplitude, 1);
    const phase = readNum(spawn.props?.phase, 0);

    let x = origin.x;
    let y = origin.y;
    let z = origin.z;

    if (spawn.type === 'pulse_expander') {
      const pulse = 1 + Math.abs(Math.sin(t * speed + phase)) * (0.35 + amp * 0.22);
      if (meshRef.current) meshRef.current.scale.set(pulse, 1, pulse);

      const player = callbacks.getPlayer();
      if (player) {
        const p = player.translation();
        const dx = p.x - x;
        const dz = p.z - z;
        const distSq = dx * dx + dz * dz;
        if (distSq < 3.2) {
          const inv = 1 / Math.max(0.3, Math.sqrt(distSq));
          player.applyImpulse({ x: dx * inv * delta * 1.7, y: 0.12 * delta, z: dz * inv * delta * 1.7 }, true);
        }
      }
    }

    if (spawn.type === 'gravity_well') {
      const player = callbacks.getPlayer();
      if (player) {
        const p = player.translation();
        const dx = x - p.x;
        const dz = z - p.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 4.2) {
          const pull = clamp((4.2 - d) / 4.2, 0, 1) * (2.6 + amp);
          const nx = dx / Math.max(0.001, d);
          const nz = dz / Math.max(0.001, d);
          player.applyImpulse({ x: nx * pull * delta, y: 0, z: nz * pull * delta }, true);
        }
      }
      if (meshRef.current) {
        meshRef.current.rotation.y += delta * (0.4 + speed * 0.4);
      }
    }

    if (spawn.type === 'laser_grid') {
      const interval = readNum(spawn.props?.interval, 1.4);
      activeRef.current = Math.floor((t + phase) / interval) % 2 === 0;
      if (meshRef.current) {
        meshRef.current.visible = activeRef.current;
      }
    }

    if (spawn.type === 'rotating_floor_disk') {
      if (meshRef.current) {
        meshRef.current.rotation.y += delta * speed * 1.7;
      }
    }

    if (spawn.type === 'spike_wave') {
      y += Math.sin(t * (speed * 2.2) + phase) * 0.7;
      activeRef.current = y > origin.y + 0.2;
    }

    if (spawn.type === 'bomb_tile' && triggeredRef.current) {
      const elapsed = t - triggerTimeRef.current;
      const pre = elapsed < 0.3;
      if (meshRef.current) {
        meshRef.current.scale.setScalar(pre ? 1 + elapsed * 0.75 : 0.001);
      }
      if (elapsed >= 0.3 && activeRef.current) {
        activeRef.current = false;
        const player = callbacks.getPlayer();
        if (player) {
          const p = player.translation();
          const dx = p.x - x;
          const dz = p.z - z;
          const inv = 1 / Math.max(0.4, Math.sqrt(dx * dx + dz * dz));
          player.applyImpulse({ x: dx * inv * 7.4, y: 3.1, z: dz * inv * 7.4 }, true);
        }
      }
    }

    if (spawn.type === 'shifting_tiles') {
      x += Math.sin(t * speed * 1.6 + phase) * 1.2;
    }

    if (spawn.type === 'rolling_boulder') {
      z += ((t * speed * 4.6 + phase) % 18) - 9;
      if (meshRef.current) {
        meshRef.current.rotation.x += delta * speed * 4;
      }
    }

    if (spawn.type === 'trapdoor_row') {
      const wave = Math.floor((t + phase) * 2.3) % 3;
      if (meshRef.current) {
        meshRef.current.scale.set(wave === 0 ? 1 : 0.82, wave === 1 ? 0.4 : 1, wave === 2 ? 0.62 : 1);
      }
      activeRef.current = wave !== 1;
    }

    if (spawn.type === 'rotating_cross_blades') {
      if (meshRef.current) {
        meshRef.current.rotation.y += delta * speed * 2.5;
      }
    }

    if (spawn.type === 'flicker_bridge') {
      activeRef.current = Math.floor((t + phase) * 1.8) % 2 === 0;
      if (meshRef.current) meshRef.current.visible = activeRef.current;
      y = activeRef.current ? origin.y : origin.y - 12;
    }

    if (spawn.type === 'rising_spike_columns') {
      y += Math.abs(Math.sin(t * speed * 2.1 + phase)) * 1.2;
      activeRef.current = y > origin.y + 0.55;
    }

    if (spawn.type === 'meat_grinder') {
      if (meshRef.current) meshRef.current.rotation.x += delta * speed * 4;
      if (auxMeshRef.current) auxMeshRef.current.rotation.x -= delta * speed * 4;
    }

    if (spawn.type === 'homing_mine') {
      const player = callbacks.getPlayer();
      if (player) {
        const p = player.translation();
        const dx = p.x - x;
        const dz = p.z - z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 14) {
          const track = 1.25 * delta;
          x += (dx / Math.max(0.001, d)) * track;
          z += (dz / Math.max(0.001, d)) * track;
        }
      }
      if (meshRef.current) meshRef.current.rotation.y += delta * speed * 6;
    }

    if (spawn.type === 'expand_o_matic') {
      const scale = 1 + Math.abs(Math.sin(t * speed + phase)) * 2.4;
      if (meshRef.current) {
        meshRef.current.scale.set(scale, 1, scale);
      }
    }

    if (spawn.type === 'pendulum_axes') {
      const swing = Math.sin(t * speed + phase) * 1.1;
      if (meshRef.current) meshRef.current.rotation.z = swing;
    }

    if (spawn.type === 'rising_lava') {
      y = -2.8 + ((t * 0.2 + phase * 0.05) % 7.5);
      const player = callbacks.getPlayer();
      if (player) {
        const p = player.translation();
        if (p.y < y + 0.2) {
          callbacks.onKill('Rising lava reached the cube.');
        }
      }
    }

    if (spawn.type === 'fragile_glass' && triggeredRef.current) {
      const elapsed = t - triggerTimeRef.current;
      y -= Math.min(9, elapsed * 5.3);
      if (meshRef.current) {
        meshRef.current.rotation.x += delta * 4;
        meshRef.current.rotation.z += delta * 3;
      }
      activeRef.current = elapsed < 0.22;
    }

    if (spawn.type === 'lightning_striker') {
      const cycle = 1.6;
      const local = (t + phase) % cycle;
      const warning = local < 0.75;
      activeRef.current = !warning && local < 1.02;
      if (meshRef.current) {
        meshRef.current.visible = true;
        (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = warning ? 0.18 : 0.8;
      }
    }

    if (spawn.type === 'snap_trap' && triggeredRef.current) {
      const elapsed = t - triggerTimeRef.current;
      if (meshRef.current) {
        meshRef.current.scale.set(Math.max(0.01, 1 - elapsed * 1.6), 1, 1);
      }
      activeRef.current = elapsed < 0.22;
    }

    body.setNextKinematicTranslation({ x, y, z });
  });

  const obstacleMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: obstacleColor(spawn.type),
        roughness: 0.34,
        metalness: 0.2,
        emissive: obstacleColor(spawn.type),
        emissiveIntensity: 0.2,
      }),
    [spawn.type]
  );

  return (
    <RigidBody ref={rb} type={bodyType} colliders={false} position={spawn.position}>
      <CuboidCollider
        args={[spawn.size[0] * 0.4, spawn.size[1] * 0.4, spawn.size[2] * 0.4]}
        sensor
        onIntersectionEnter={onEffectHit}
      />
      <CuboidCollider
        args={[spawn.size[0] * 0.45, spawn.size[1] * 0.45, spawn.size[2] * 0.45]}
        sensor
        onIntersectionEnter={onKillHit}
      />

      {spawn.type === 'meat_grinder' ? (
        <group>
          <mesh ref={meshRef} position={[0, 0.35, 0.8]} material={obstacleMaterial}>
            <cylinderGeometry args={[0.3, 0.3, 2.2, 14]} />
          </mesh>
          <mesh ref={auxMeshRef} position={[0, 0.35, -0.8]} material={obstacleMaterial}>
            <cylinderGeometry args={[0.3, 0.3, 2.2, 14]} />
          </mesh>
        </group>
      ) : spawn.type === 'rotating_cross_blades' ? (
        <group ref={meshRef as React.RefObject<THREE.Group>}>
          <mesh material={obstacleMaterial}>
            <boxGeometry args={[4.4, 0.22, 0.32]} />
          </mesh>
          <mesh rotation-y={Math.PI * 0.5} material={obstacleMaterial}>
            <boxGeometry args={[4.4, 0.22, 0.32]} />
          </mesh>
        </group>
      ) : spawn.type === 'pendulum_axes' ? (
        <group ref={meshRef as React.RefObject<THREE.Group>}>
          <mesh position={[0, 0.95, 0]} material={obstacleMaterial}>
            <boxGeometry args={[0.16, 2.2, 0.16]} />
          </mesh>
          <mesh position={[0, -0.1, 0]} material={obstacleMaterial}>
            <boxGeometry args={[2.3, 0.24, 0.24]} />
          </mesh>
        </group>
      ) : spawn.type === 'laser_grid' ? (
        <mesh ref={meshRef} material={obstacleMaterial}>
          <cylinderGeometry args={[0.1, 0.1, 5.4, 12]} />
        </mesh>
      ) : spawn.type === 'gravity_well' ? (
        <mesh ref={meshRef} material={obstacleMaterial}>
          <torusGeometry args={[1.05, 0.16, 16, 40]} />
        </mesh>
      ) : spawn.type === 'rolling_boulder' || spawn.type === 'homing_mine' ? (
        <mesh ref={meshRef} material={obstacleMaterial}>
          <sphereGeometry args={[0.56, 18, 18]} />
        </mesh>
      ) : spawn.type === 'rising_lava' ? (
        <mesh ref={meshRef} material={obstacleMaterial}>
          <boxGeometry args={[6.8, 0.34, 6.8]} />
        </mesh>
      ) : spawn.type === 'spike_wave' || spawn.type === 'rising_spike_columns' ? (
        <mesh ref={meshRef} material={obstacleMaterial}>
          <coneGeometry args={[0.5, 1.2, 12]} />
        </mesh>
      ) : spawn.type === 'rotating_floor_disk' ? (
        <mesh ref={meshRef} material={obstacleMaterial}>
          <cylinderGeometry args={[1.6, 1.6, 0.22, 30]} />
        </mesh>
      ) : (
        <mesh ref={meshRef} material={obstacleMaterial}>
          <boxGeometry args={[1.5, 0.5, 1.5]} />
        </mesh>
      )}
    </RigidBody>
  );
}

function ChunkActor({
  chunk,
  callbacks,
}: {
  chunk: ChunkDefinition;
  callbacks: ActorCallbacks;
}) {
  return (
    <group>
      {chunk.platforms.map((platform) => (
        <PlatformActor key={platform.id} spawn={platform} biome={chunk.biome} callbacks={callbacks} />
      ))}
      {chunk.obstacles.map((obstacle) => (
        <ObstacleActor key={obstacle.id} spawn={obstacle} callbacks={callbacks} />
      ))}
    </group>
  );
}

function Steps() {
  const snap = useSnapshot(stepsState);
  const { paused } = useGameUIState();
  const { camera, scene } = useThree();

  const input = useInputRef({
    preventDefault: [' ', 'space', 'enter', 'r', 'arrowleft', 'arrowright', 'a', 'd'],
  });

  const playerBodyRef = useRef<RapierRigidBody | null>(null);
  const playerMeshRef = useRef<THREE.Mesh | null>(null);
  const ghostMeshRef = useRef<THREE.Mesh | null>(null);

  const chunkCacheRef = useRef<Map<number, ChunkDefinition>>(new Map());
  const [chunks, setChunks] = useState<ChunkDefinition[]>([]);

  const [revivePrompt, setRevivePrompt] = useState(false);
  const [hudNotice, setHudNotice] = useState('');

  const runtime = useRef<RuntimeRef>({
    elapsed: 0,
    runTime: 0,
    score: 0,

    comboScore: 0,
    obstacleScore: 0,
    comboMultiplier: 1,
    comboChain: 0,
    comboTimer: 0,
    comboPeak: 1,

    lastChunkIndex: 0,
    chunkWindowCenter: -999,

    cameraShake: 0,

    invertUntil: 0,
    slowUntil: 0,
    slowScale: 1,
    antiGravityUntil: 0,
    antiGravityForce: 0,
    lockRotationUntil: 0,
    stickyUntil: 0,
    sizeUntil: 0,
    sizeScale: 1,
    speedBoostUntil: 0,
    speedBoostMultiplier: 1,
    gravityFlipUntil: 0,
    windUntil: 0,
    windForce: new THREE.Vector3(),

    checkpoint: START_POSITION.clone(),

    pauseForRevive: false,
    reviveConsumed: false,
    pendingDeathReason: '',

    ghostRecordTimer: 0,
    ghostFrames: [],
    loadedGhost: null,

    hudCommit: 0,
    rotationLocked: false,
    nearMissScore: 0,
  });

  const backgroundColorRef = useRef(new THREE.Color(BIOMES.ice.skyColor));
  const fogColorRef = useRef(new THREE.Color(BIOMES.ice.fogColor));
  const cameraTargetRef = useRef(new THREE.Vector3(6, 6, 10));

  const season = useMemo(() => getActiveSeason(), []);

  const ensureChunkWindow = useCallback(
    (centerChunk: number) => {
      if (centerChunk === runtime.current.chunkWindowCenter) return;

      const start = Math.max(0, centerChunk - CHUNKS_BEHIND);
      const end = centerChunk + CHUNKS_AHEAD;

      for (let i = start; i <= end; i += 1) {
        if (chunkCacheRef.current.has(i)) continue;
        const distance = i * CHUNK_LENGTH;
        const biome = seasonBiome(distance, season.id);
        const difficulty = difficultyForDistance(distance);
        const chunk = buildChunk(
          snap.worldSeed,
          i,
          biome,
          difficulty,
          BIOMES[biome].obstacleWeightBoost
        );
        chunkCacheRef.current.set(i, chunk);
      }

      for (const key of Array.from(chunkCacheRef.current.keys())) {
        if (key < start - 2 || key > end + 2) {
          chunkCacheRef.current.delete(key);
        }
      }

      const nextChunks: ChunkDefinition[] = [];
      for (let i = start; i <= end; i += 1) {
        const chunk = chunkCacheRef.current.get(i);
        if (chunk) nextChunks.push(chunk);
      }

      runtime.current.chunkWindowCenter = centerChunk;
      setChunks(nextChunks);
      const activeChunk = nextChunks.find((chunk) => chunk.index === centerChunk);
      stepsState.setBossActive(Boolean(activeChunk?.isBoss));
    },
    [season.id, snap.worldSeed]
  );

  const registerSkill = useCallback((kind: SkillEventKind) => {
    const r = runtime.current;
    const scored = applySkillEvent(kind, r.comboMultiplier, r.comboChain);
    r.comboScore += scored.comboScore;
    r.comboMultiplier = scored.nextMultiplier;
    r.comboChain = scored.nextChain;
    r.comboTimer = scored.comboTimer;
    if (r.comboMultiplier > r.comboPeak) r.comboPeak = r.comboMultiplier;
    r.cameraShake = Math.max(r.cameraShake, 0.14);
  }, []);

  const applyEffect = useCallback((effect: EffectCommand) => {
    const r = runtime.current;
    const now = r.elapsed;
    const player = playerBodyRef.current;

    if (effect.type === 'invert_controls') {
      r.invertUntil = Math.max(r.invertUntil, now + effect.duration);
      return;
    }

    if (effect.type === 'slow_time') {
      r.slowUntil = Math.max(r.slowUntil, now + effect.duration);
      r.slowScale = effect.scale;
      return;
    }

    if (effect.type === 'anti_gravity') {
      r.antiGravityUntil = Math.max(r.antiGravityUntil, now + effect.duration);
      r.antiGravityForce = effect.force;
      return;
    }

    if (effect.type === 'lock_rotation') {
      r.lockRotationUntil = Math.max(r.lockRotationUntil, now + effect.duration);
      return;
    }

    if (effect.type === 'sticky') {
      r.stickyUntil = Math.max(r.stickyUntil, now + effect.duration);
      return;
    }

    if (effect.type === 'size_shift') {
      r.sizeUntil = Math.max(r.sizeUntil, now + effect.duration);
      r.sizeScale = effect.scale;
      return;
    }

    if (effect.type === 'teleport') {
      if (player) {
        player.setTranslation({ x: effect.position[0], y: effect.position[1], z: effect.position[2] }, true);
        player.setLinvel({ x: 0, y: 0, z: -BASE_FORWARD_SPEED }, true);
        player.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      return;
    }

    if (effect.type === 'impulse') {
      if (player) {
        player.applyImpulse(
          {
            x: effect.value[0],
            y: effect.value[1],
            z: effect.value[2],
          },
          true
        );
      }
      return;
    }

    if (effect.type === 'speed_boost') {
      r.speedBoostUntil = Math.max(r.speedBoostUntil, now + effect.duration);
      r.speedBoostMultiplier = Math.max(r.speedBoostMultiplier, effect.multiplier);
      return;
    }

    if (effect.type === 'gravity_flip') {
      r.gravityFlipUntil = Math.max(r.gravityFlipUntil, now + effect.duration);
      return;
    }

    if (effect.type === 'wind') {
      r.windUntil = Math.max(r.windUntil, now + effect.duration);
      r.windForce.set(effect.force[0], effect.force[1], effect.force[2]);
      return;
    }

    if (effect.type === 'checkpoint') {
      r.checkpoint.set(effect.position[0], effect.position[1], effect.position[2]);
    }
  }, []);

  const finalizeRun = useCallback((reason: string) => {
    const r = runtime.current;
    if (stepsState.phase === 'gameover') return;

    const difficulty = difficultyForDistance(stepsState.distance);
    const checksum = createRunChecksum(r.score, snap.worldSeed, r.runTime, r.comboPeak);

    queueLeaderboardSubmission({
      score: r.score,
      distance: stepsState.distance,
      seed: snap.worldSeed,
      runDuration: r.runTime,
      checksum,
      comboPeak: r.comboPeak,
      timestamp: Date.now(),
    });

    const estimate = estimateLeaderboard(r.score);
    stepsState.setLeaderboardSnapshot(estimate.rank, estimate.percentile);

    const existingBest = stepsState.best;
    if (r.score >= existingBest && r.ghostFrames.length > 20) {
      const ghost: RunGhost = {
        seed: snap.worldSeed,
        score: r.score,
        duration: r.runTime,
        frames: r.ghostFrames,
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(stepsStorageKeys.bestGhost, serializeGhost(ghost));
      }
      stepsState.setGhostReady(true);
      r.loadedGhost = ghost;
    }

    if (difficulty >= 6) {
      setHudNotice('Hard tier run complete. Leaderboard payload queued.');
    }

    stepsState.endGame(reason);
  }, [snap.worldSeed]);

  const triggerKill = useCallback(
    (reason: string) => {
      if (stepsState.phase !== 'playing') return;
      const r = runtime.current;
      if (!r.reviveConsumed && stepsState.reviveAvailable && stepsState.rewardedReady) {
        r.reviveConsumed = true;
        r.pauseForRevive = true;
        r.pendingDeathReason = reason;
        stepsState.consumeRevive();
        const player = playerBodyRef.current;
        if (player) {
          player.setLinvel({ x: 0, y: 0, z: 0 }, true);
          player.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
        setRevivePrompt(true);
        return;
      }

      finalizeRun(reason);
    },
    [finalizeRun]
  );

  const callbacks = useMemo<ActorCallbacks>(
    () => ({
      onKill: triggerKill,
      onSkill: registerSkill,
      onEffect: applyEffect,
      getPlayer: () => playerBodyRef.current,
      getTime: () => runtime.current.elapsed,
    }),
    [applyEffect, registerSkill, triggerKill]
  );

  const resetRun = useCallback(() => {
    const r = runtime.current;

    r.elapsed = 0;
    r.runTime = 0;
    r.score = 0;

    r.comboScore = 0;
    r.obstacleScore = 0;
    r.comboMultiplier = 1;
    r.comboChain = 0;
    r.comboTimer = 0;
    r.comboPeak = 1;

    r.lastChunkIndex = 0;
    r.chunkWindowCenter = -999;

    r.cameraShake = 0;

    r.invertUntil = 0;
    r.slowUntil = 0;
    r.slowScale = 1;
    r.antiGravityUntil = 0;
    r.antiGravityForce = 0;
    r.lockRotationUntil = 0;
    r.stickyUntil = 0;
    r.sizeUntil = 0;
    r.sizeScale = 1;
    r.speedBoostUntil = 0;
    r.speedBoostMultiplier = 1;
    r.gravityFlipUntil = 0;
    r.windUntil = 0;
    r.windForce.set(0, 0, 0);

    r.pauseForRevive = false;
    r.reviveConsumed = false;
    r.pendingDeathReason = '';

    r.checkpoint.copy(START_POSITION);

    r.ghostRecordTimer = 0;
    r.ghostFrames = [];

    r.hudCommit = 0;
    r.rotationLocked = false;
    r.nearMissScore = 0;

    chunkCacheRef.current.clear();
    ensureChunkWindow(0);

    const player = playerBodyRef.current;
    if (player) {
      player.setTranslation({ x: START_POSITION.x, y: START_POSITION.y, z: START_POSITION.z }, true);
      player.setLinvel({ x: 0, y: 0, z: -BASE_FORWARD_SPEED }, true);
      player.setAngvel({ x: 0, y: 0, z: 0 }, true);
      player.setEnabledRotations(true, true, true, true);
    }

    if (playerMeshRef.current) {
      playerMeshRef.current.scale.set(1, 1, 1);
      playerMeshRef.current.rotation.set(0, 0, 0);
    }

    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 44;
      camera.updateProjectionMatrix();
    }

    camera.position.set(6, 6.2, 10.4);
    camera.lookAt(0, 1, 0);

    setRevivePrompt(false);
    setHudNotice('');
  }, [camera, ensureChunkWindow]);

  useEffect(() => {
    stepsState.loadBest();
    stepsState.dailySeed = dailySeedForDate();
    stepsState.setSeason(season.id);

    if (typeof window !== 'undefined') {
      runtime.current.loadedGhost = parseGhost(window.localStorage.getItem(stepsStorageKeys.bestGhost));
      stepsState.setGhostReady(Boolean(runtime.current.loadedGhost));
    }
  }, [season.id]);

  useEffect(() => {
    resetRun();
  }, [resetRun, snap.worldSeed]);

  useFrame((state, dt) => {
    const r = runtime.current;
    r.elapsed += dt;

    const inputState = input.current;

    const leftDown = inputState.keysDown.has('arrowleft') || inputState.keysDown.has('a');
    const rightDown = inputState.keysDown.has('arrowright') || inputState.keysDown.has('d');

    const spaceTap = inputState.pointerJustDown || inputState.justPressed.has(' ') || inputState.justPressed.has('enter');
    const restart = inputState.justPressed.has('r');

    if (restart) {
      stepsState.startGame();
      resetRun();
    }

    if (spaceTap) {
      if (stepsState.phase === 'menu' || stepsState.phase === 'gameover') {
        stepsState.startGame();
        resetRun();
      }
    }

    clearFrameInput(input);

    if (paused) return;

    const body = playerBodyRef.current;

    if (stepsState.phase === 'playing' && body && !r.pauseForRevive) {
      r.runTime += dt;

      const pos = body.translation();
      const vel = body.linvel();

      const distance = Math.max(0, -pos.z);
      const biomeId = seasonBiome(distance, snap.seasonId || season.id);
      const biome = BIOMES[biomeId];
      const difficulty = difficultyForDistance(distance);

      if (stepsState.biome !== biomeId) {
        stepsState.setBiome(biomeId);
      }

      const comboDecay = decayCombo(r.comboTimer, r.comboMultiplier, r.comboChain, dt);
      r.comboTimer = comboDecay.comboTimer;
      r.comboMultiplier = comboDecay.comboMultiplier;
      r.comboChain = comboDecay.chain;

      let steer = 0;
      if (leftDown) steer -= 1;
      if (rightDown) steer += 1;
      steer += clamp(inputState.pointerX * 0.35, -0.5, 0.5);

      if (r.elapsed < r.invertUntil) steer *= -1;

      const slowScale = r.elapsed < r.slowUntil ? r.slowScale : 1;
      const boostScale = r.elapsed < r.speedBoostUntil ? r.speedBoostMultiplier : 1;
      const targetForward = -BASE_FORWARD_SPEED * biome.speedScale * slowScale * boostScale;
      const nextVz = lerp(vel.z, targetForward, 0.1);

      body.setLinvel({ x: vel.x, y: vel.y, z: nextVz }, true);
      body.applyImpulse({ x: steer * SIDE_IMPULSE * dt, y: 0, z: 0 }, true);

      if (spaceTap) {
        body.applyImpulse({ x: 0, y: TAP_UP_IMPULSE, z: -TAP_FORWARD_IMPULSE }, true);
        body.applyImpulseAtPoint(
          { x: 0.6, y: 0, z: 0 },
          { x: pos.x + 0.35, y: pos.y, z: pos.z },
          true
        );
        registerSkill('perfect_landing');
      }

      if (r.elapsed < r.antiGravityUntil) {
        body.applyImpulse({ x: 0, y: r.antiGravityForce * dt, z: 0 }, true);
      }

      if (r.elapsed < r.gravityFlipUntil) {
        body.applyImpulse({ x: 0, y: 14 * dt, z: 0 }, true);
      }

      if (r.elapsed < r.windUntil) {
        body.applyImpulse(
          {
            x: r.windForce.x * dt,
            y: r.windForce.y * dt,
            z: r.windForce.z * dt,
          },
          true
        );
      }

      if (r.elapsed < r.stickyUntil) {
        body.setLinvel({ x: vel.x * 0.62, y: vel.y * 0.5, z: vel.z * 0.62 }, true);
      }

      const shouldLockRotation = r.elapsed < r.lockRotationUntil;
      if (shouldLockRotation !== r.rotationLocked) {
        body.setEnabledRotations(!shouldLockRotation, !shouldLockRotation, !shouldLockRotation, true);
        r.rotationLocked = shouldLockRotation;
      }

      if (playerMeshRef.current) {
        const targetScale = r.elapsed < r.sizeUntil ? r.sizeScale : 1;
        const nextScale = lerp(playerMeshRef.current.scale.x, targetScale, 0.18);
        playerMeshRef.current.scale.set(nextScale, nextScale, nextScale);
      }

      if (pos.y < -10) {
        triggerKill('Fell into the void.');
      }

      if (Math.abs(pos.x) > 8.5) {
        triggerKill('Lost lane control.');
      }

      const chunkIndex = Math.max(0, Math.floor(distance / CHUNK_LENGTH));
      ensureChunkWindow(chunkIndex);
      if (chunkIndex > r.lastChunkIndex) {
        registerSkill('chunk_clear');
        r.lastChunkIndex = chunkIndex;
      }

      const totalScore = scoreBreakdown(
        distance,
        r.comboScore,
        r.obstacleScore + r.nearMissScore,
        r.runTime,
        difficulty,
        season.scoreBonus
      );
      r.score = totalScore;

      const pressure = clamp((Math.abs(pos.x) / 8.5) * 0.5 + (pos.y < 0.8 ? 0.5 : 0), 0, 1);
      stepsState.setPressure(pressure);

      r.hudCommit += dt;
      if (r.hudCommit >= HUD_COMMIT_INTERVAL) {
        r.hudCommit = 0;
        stepsState.setRunMetrics(r.score, distance, r.comboMultiplier, r.comboChain, r.comboTimer);
      }

      if (r.runTime > 0.8 && pos.y > 0.2) {
        r.checkpoint.set(pos.x, Math.max(1.6, pos.y + 0.5), pos.z + 2.2);
      }

      r.ghostRecordTimer += dt;
      if (r.ghostRecordTimer >= 1 / 30) {
        r.ghostRecordTimer = 0;
        const rot = body.rotation();
        r.ghostFrames.push({
          t: r.runTime,
          x: Math.round(pos.x * 100) / 100,
          y: Math.round(pos.y * 100) / 100,
          z: Math.round(pos.z * 100) / 100,
          qx: Math.round(rot.x * 1000) / 1000,
          qy: Math.round(rot.y * 1000) / 1000,
          qz: Math.round(rot.z * 1000) / 1000,
          qw: Math.round(rot.w * 1000) / 1000,
        });
      }

      if (r.loadedGhost && ghostMeshRef.current) {
        const sample = sampleGhostFrame(r.loadedGhost.frames, r.runTime);
        if (sample) {
          ghostMeshRef.current.visible = true;
          ghostMeshRef.current.position.set(sample.x, sample.y, sample.z);
          ghostMeshRef.current.quaternion.set(sample.qx, sample.qy, sample.qz, sample.qw).normalize();
        }
      }

      const nearMiss = Math.abs(pos.x) > 5.8 && Math.abs(pos.x) < 6.3;
      if (nearMiss) {
        r.nearMissScore += dt * 18;
      }

      backgroundColorRef.current.lerp(new THREE.Color(biome.skyColor), 1 - Math.exp(-dt * 2));
      fogColorRef.current.lerp(new THREE.Color(biome.fogColor), 1 - Math.exp(-dt * 2));
      scene.background = backgroundColorRef.current;
      if (!scene.fog) {
        scene.fog = new THREE.Fog(fogColorRef.current.getHex(), BASE_FOG_NEAR, BASE_FOG_FAR);
      } else if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(fogColorRef.current);
        scene.fog.near = lerp(scene.fog.near, BASE_FOG_NEAR, 1 - Math.exp(-dt * 2));
        scene.fog.far = lerp(scene.fog.far, BASE_FOG_FAR, 1 - Math.exp(-dt * 2));
      }

      const targetX = pos.x + 5.6;
      const targetY = pos.y + 5.9;
      const targetZ = pos.z + 9.2;
      cameraTargetRef.current.set(targetX, targetY, targetZ);

      r.cameraShake = Math.max(0, r.cameraShake - dt * 2.2);
      const shakeX = Math.sin(r.elapsed * 28) * r.cameraShake * 0.08;
      const shakeZ = Math.cos(r.elapsed * 24) * r.cameraShake * 0.08;

      camera.position.x = lerp(camera.position.x, cameraTargetRef.current.x + shakeX, 1 - Math.exp(-dt * 5));
      camera.position.y = lerp(camera.position.y, cameraTargetRef.current.y, 1 - Math.exp(-dt * 5));
      camera.position.z = lerp(camera.position.z, cameraTargetRef.current.z + shakeZ, 1 - Math.exp(-dt * 5));
      camera.lookAt(pos.x, pos.y, pos.z - 2.4);

      if ('fov' in camera) {
        const perspective = camera as THREE.PerspectiveCamera;
        const targetFov = 44 + r.comboMultiplier * 0.9 + (r.elapsed < r.speedBoostUntil ? 6 : 0) + pressure * 2;
        perspective.fov = lerp(perspective.fov, targetFov, 1 - Math.exp(-dt * 4));
        perspective.updateProjectionMatrix();
      }
    } else if (stepsState.phase === 'gameover') {
      const sample = runtime.current.loadedGhost && ghostMeshRef.current
        ? sampleGhostFrame(runtime.current.loadedGhost.frames, Math.min(runtime.current.runTime, runtime.current.loadedGhost.duration))
        : null;
      if (sample && ghostMeshRef.current) {
        ghostMeshRef.current.visible = true;
        ghostMeshRef.current.position.set(sample.x, sample.y, sample.z);
        ghostMeshRef.current.quaternion.set(sample.qx, sample.qy, sample.qz, sample.qw).normalize();
      }
    }
  });

  const handleRevive = useCallback(async () => {
    const r = runtime.current;
    const reward = await requestRewardedAd('revive');
    if (!reward.granted) {
      finalizeRun(r.pendingDeathReason || 'Revive unavailable');
      return;
    }

    const body = playerBodyRef.current;
    if (body) {
      body.setTranslation({ x: r.checkpoint.x, y: r.checkpoint.y, z: r.checkpoint.z }, true);
      body.setLinvel({ x: 0, y: 0.4, z: -BASE_FORWARD_SPEED }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    r.pauseForRevive = false;
    r.pendingDeathReason = '';
    setRevivePrompt(false);
    setHudNotice('Revive active. One last push.');
  }, [finalizeRun]);

  const handleSkipRevive = useCallback(() => {
    const r = runtime.current;
    setRevivePrompt(false);
    r.pauseForRevive = false;
    finalizeRun(r.pendingDeathReason || 'Run over');
  }, [finalizeRun]);

  const holdToBeatText =
    snap.phase === 'gameover' && snap.nearBestDelta > 0
      ? `You were ${snap.nearBestDelta} points from your best.`
      : snap.phase === 'gameover' && snap.nearBestDelta === 0
        ? 'New personal best.'
        : '';

  return (
    <group>
      <ambientLight intensity={BIOMES[snap.biome].ambientIntensity} />
      <directionalLight
        position={[7, 13, 5]}
        intensity={BIOMES[snap.biome].directionalIntensity}
        castShadow
      />
      <pointLight position={[-5, 5, -8]} intensity={0.45} color="#6ee7ff" />
      <pointLight position={[5, 3, -2]} intensity={0.34} color="#ff7f9f" />

      <Physics gravity={[0, -23 * BIOMES[snap.biome].gravityScale, 0]} timeStep={1 / 60} paused={paused || snap.phase !== 'playing'}>
        <RigidBody
          ref={playerBodyRef}
          name={PLAYER_NAME}
          userData={{ stepsTag: 'player' }}
          type="dynamic"
          colliders={false}
          position={[START_POSITION.x, START_POSITION.y, START_POSITION.z]}
          ccd
          friction={0.82 * BIOMES[snap.biome].frictionScale}
          restitution={0.16}
          linearDamping={0.16}
          angularDamping={0.34}
        >
          <CuboidCollider args={[PLAYER_SIZE[0] * 0.5, PLAYER_SIZE[1] * 0.5, PLAYER_SIZE[2] * 0.5]} />
          <mesh ref={playerMeshRef} castShadow>
            <boxGeometry args={PLAYER_SIZE} />
            <meshStandardMaterial
              color="#ff5fb3"
              emissive="#ff8fd0"
              emissiveIntensity={0.22}
              roughness={0.24}
              metalness={0.08}
            />
          </mesh>
        </RigidBody>

        {chunks.map((chunk) => (
          <ChunkActor key={chunk.id} chunk={chunk} callbacks={callbacks} />
        ))}

        <mesh ref={ghostMeshRef} visible={false}>
          <boxGeometry args={PLAYER_SIZE} />
          <meshStandardMaterial
            color="#7dd3fc"
            emissive="#a5f3fc"
            emissiveIntensity={0.42}
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      </Physics>

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.5} luminanceThreshold={0.46} radius={0.72} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.44} />
        <Noise opacity={0.014} />
      </EffectComposer>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: 'white',
            textShadow: '0 2px 12px rgba(0,0,0,0.35)',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          }}
        >
          <div style={{ opacity: 0.86, fontSize: 12, letterSpacing: 1.4 }}>STEPS // RAPIER</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>{snap.score}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Distance {Math.floor(snap.distance)}m</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            Combo {snap.comboMultiplier.toFixed(1)}x ({snap.comboChain})
          </div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Best {snap.best}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            Gems +{snap.runGems} (Bank {snap.gems})
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'rgba(8, 16, 34, 0.62)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 12,
            padding: '10px 12px',
            color: 'white',
            width: 240,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.82 }}>BIOME</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{BIOMES[snap.biome].name}</div>
          <div style={{ fontSize: 11, opacity: 0.82, marginTop: 4 }}>Season: {season.label}</div>
          <div style={{ fontSize: 11, opacity: 0.82 }}>Boss Chunk: {snap.bossActive ? 'Active' : 'Idle'}</div>
          <div style={{ fontSize: 11, opacity: 0.82 }}>Daily Seed: {snap.dailySeed}</div>
          <div style={{ fontSize: 11, opacity: 0.82 }}>
            Leaderboard Est. #{snap.leaderboardRank} ({snap.leaderboardPercentile.toFixed(1)}%)
          </div>
        </div>

        {snap.phase === 'playing' && (
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 300,
              pointerEvents: 'none',
              color: 'white',
            }}
          >
            <div
              style={{
                height: 8,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.24)',
                background: 'rgba(255,255,255,0.18)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(clamp(snap.pressure, 0, 1) * 100)}%`,
                  height: '100%',
                  background:
                    snap.pressure < 0.5
                      ? 'linear-gradient(90deg,#34d399,#10b981)'
                      : snap.pressure < 0.8
                        ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                        : 'linear-gradient(90deg,#ef4444,#dc2626)',
                  transition: 'width 80ms linear',
                }}
              />
            </div>
            <div style={{ textAlign: 'center', marginTop: 4, fontSize: 11, opacity: 0.88 }}>
              Risk Pressure {Math.round(snap.pressure * 100)}%
            </div>
            {hudNotice && (
              <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: '#fef08a', letterSpacing: 0.5 }}>
                {hudNotice}
              </div>
            )}
          </div>
        )}

        {(snap.phase === 'menu' || snap.phase === 'gameover') && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                width: 520,
                padding: 24,
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(7, 16, 34, 0.74)',
                color: 'white',
                textAlign: 'center',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 1.2 }}>STEPS</div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 8 }}>
                Physics-first endless runner with deterministic chunk seeds, biome progression, boss chunks, and 20+ advanced obstacle families.
              </div>
              <div style={{ fontSize: 12, opacity: 0.82, marginTop: 6 }}>
                Tap for jump-roll. `A/D` or arrows steer lanes. Time obstacles, chain combo events, and survive seasonal world shifts.
              </div>

              {snap.phase === 'gameover' && (
                <div style={{ marginTop: 14, fontSize: 14 }}>
                  <div style={{ fontWeight: 800 }}>Run Over</div>
                  <div style={{ opacity: 0.9 }}>Score {snap.score}</div>
                  <div style={{ opacity: 0.76 }}>{snap.failReason}</div>
                  {holdToBeatText && <div style={{ marginTop: 5, opacity: 0.85 }}>{holdToBeatText}</div>}
                </div>
              )}

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.72 }}>
                Click/Tap/Space = Jump Roll | Enter = Start | R = Restart
              </div>
            </div>
          </div>
        )}

        {revivePrompt && snap.phase === 'playing' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                width: 360,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(5, 10, 24, 0.9)',
                padding: 18,
                textAlign: 'center',
                color: 'white',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800 }}>Second Chance</div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.88 }}>
                {runtime.current.pendingDeathReason || 'Critical hit'}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.74 }}>
                Watch rewarded ad hook and continue from the latest checkpoint.
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={handleRevive}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.45)',
                    background: 'linear-gradient(180deg, #22d3ee, #0891b2)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: 12,
                    padding: '8px 14px',
                  }}
                >
                  Revive
                </button>
                <button
                  onClick={handleSkipRevive}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.35)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 12,
                    padding: '8px 14px',
                  }}
                >
                  End Run
                </button>
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}

export default Steps;
