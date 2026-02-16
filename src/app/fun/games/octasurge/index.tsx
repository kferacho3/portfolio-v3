'use client';

import { Environment, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Glitch,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import {
  FIBER_COLORS,
  GAME,
  OCTA_OBSTACLE_FAIL_REASON,
  OCTA_TILE_VARIANT_ACCENT,
  STAGE_AESTHETICS,
  STAGE_PROFILES,
} from './constants';
import { createFixedStepper } from './engine/fixedStep';
import {
  createRingRunGenerator,
  laneBit,
  normalizeLane,
} from './level/generator';
import type { RingData, RingLaneMeta } from './level/types';
import { TunnelMesh } from './render/TunnelMesh';
import { useOctaRuntimeStore } from './runtime';
import { octaSurgeState } from './state';
import type {
  OctaCameraMode,
  OctaObstacleType,
  OctaPlatformType,
  OctaReplayGhostFrame,
  OctaReplayInputAction,
  OctaReplayInputEvent,
  OctaReplayOutcome,
  OctaReplayRun,
  OctaSurgeMode,
} from './types';

export { octaSurgeState } from './state';
export * from './types';
export * from './constants';

const TWO_PI = Math.PI * 2;
const RING_SPACING = 0.82;
const VISIBLE_RING_COUNT = 220;
const MAX_TURN_QUEUE = 6;
const MAX_FLIP_QUEUE = 4;
const GHOST_RECORD_STRIDE = 2;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const positiveMod = (value: number, mod: number) => {
  const m = value % mod;
  return m < 0 ? m + mod : m;
};

const normalizeAngle = (angle: number) => {
  let value = angle % TWO_PI;
  if (value < 0) value += TWO_PI;
  return value;
};

const shortestAngle = (from: number, to: number) => {
  let delta = (to - from) % TWO_PI;
  if (delta > Math.PI) delta -= TWO_PI;
  if (delta < -Math.PI) delta += TWO_PI;
  return delta;
};

const laneStep = (sides: number) => TWO_PI / Math.max(3, sides);

const rotationForLane = (lane: number, sides: number) =>
  GAME.playerAngle - normalizeLane(lane, sides) * laneStep(sides);

const stageById = (id: number) =>
  STAGE_PROFILES.find((stage) => stage.id === id) ?? STAGE_PROFILES[0];

const stageVisualById = (id: number) =>
  STAGE_AESTHETICS[id] ?? STAGE_AESTHETICS[1];

const nextCameraMode = (mode: OctaCameraMode): OctaCameraMode => {
  if (mode === 'chase') return 'firstPerson';
  if (mode === 'firstPerson') return 'topDown';
  return 'chase';
};

type AudioGraph = {
  element: HTMLAudioElement | null;
  context: AudioContext | null;
  source: MediaElementAudioSourceNode | null;
  analyser: AnalyserNode | null;
  data: Uint8Array<ArrayBuffer> | null;
  started: boolean;
};

type ReplayMode = 'record' | 'playback';

type ReplayRuntime = {
  mode: ReplayMode;
  seed: number;
  runMode: OctaSurgeMode;
  cameraMode: OctaCameraMode;
  frame: number;
  events: OctaReplayInputEvent[];
  ghostFrames: OctaReplayGhostFrame[];
  playbackEvents: OctaReplayInputEvent[];
  playbackCursor: number;
};

type SimState = {
  laneIndex: number;
  laneFloat: number;
  laneVelocity: number;
  sides: number;
  targetRotation: number;
  rotation: number;
  angularVelocity: number;

  speed: number;
  distance: number;
  runTime: number;
  score: number;

  combo: number;
  comboTimer: number;
  multiplier: number;

  stageId: number;
  stageFlash: number;

  slowMoMeter: number;
  slowMoTime: number;
  shardCount: number;
  syncTimer: number;

  flipPulse: number;
  dangerPulse: number;
  audioReactive: number;

  turnCooldown: number;
  flipCooldown: number;

  scroll: number;
  baseRing: number;
  lastCrossedRing: number;

  currentPlatform: OctaPlatformType;
  currentObstacle: OctaObstacleType;

  ended: boolean;
  deathType: 'void' | 'obstacle';
  endReason: string;
  deathTimer: number;
};

type ObstacleState = {
  closedBlend: number;
  danger: boolean;
};

const createReplayRuntime = (): ReplayRuntime => ({
  mode: 'record',
  seed: 0,
  runMode: 'classic',
  cameraMode: 'chase',
  frame: 0,
  events: [],
  ghostFrames: [],
  playbackEvents: [],
  playbackCursor: 0,
});

const createSimState = (startLane: number, sides: number, stageId: number): SimState => ({
  laneIndex: startLane,
  laneFloat: startLane,
  laneVelocity: 0,
  sides,
  targetRotation: rotationForLane(startLane, sides),
  rotation: rotationForLane(startLane, sides),
  angularVelocity: 0,

  speed: GAME.baseSpeed,
  distance: 0,
  runTime: 0,
  score: 0,

  combo: 0,
  comboTimer: 0,
  multiplier: 1,

  stageId,
  stageFlash: 1,

  slowMoMeter: 0,
  slowMoTime: 0,
  shardCount: 0,
  syncTimer: 0,

  flipPulse: 0,
  dangerPulse: 0,
  audioReactive: 0,

  turnCooldown: 0,
  flipCooldown: 0,

  scroll: 0,
  baseRing: 0,
  lastCrossedRing: -1,

  currentPlatform: 'smooth_lane',
  currentObstacle: 'none',

  ended: false,
  deathType: 'void',
  endReason: '',
  deathTimer: 0,
});

const platformBlend = (platform: OctaPlatformType, phase: number, time: number) => {
  if (platform === 'phase_lane') {
    return 0.5 + 0.5 * Math.sin(time * 1.9 + phase * 1.2);
  }
  if (platform === 'crusher_lane') {
    return 0.5 + 0.5 * Math.sin(time * 2.35 + phase * 0.9);
  }
  if (platform === 'resin_lane') {
    return 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 0.8 + phase));
  }
  if (platform === 'pulse_pad') {
    return 0.5 + 0.5 * Math.sin(time * 3.1 + phase * 1.3);
  }
  if (platform === 'overdrive_strip') {
    return 0.5 + 0.5 * Math.sin(time * 2.8 + phase * 0.6);
  }
  if (platform === 'split_rail') {
    return 0.5 + 0.5 * Math.sin(time * 2.1 + phase * 0.95);
  }
  if (platform === 'gravity_drift') {
    return 0.5 + 0.5 * Math.sin(time * 1.45 + phase * 1.7);
  }
  return 0;
};

const obstacleState = (meta: RingLaneMeta, time: number): ObstacleState => {
  if (meta.obstacle === 'none') return { closedBlend: 0, danger: false };

  const cycle = Math.max(0.8, meta.obstacleCycle);
  const openWindow = clamp(meta.obstacleOpenWindow, 0.15, cycle);
  const local = positiveMod(time + meta.obstaclePhase * 0.1, cycle);
  const start = positiveMod(meta.obstacleWindowStart, cycle);
  const end = start + openWindow;

  let open = false;
  if (end <= cycle) {
    open = local >= start && local <= end;
  } else {
    open = local >= start || local <= end - cycle;
  }

  const center = positiveMod(start + openWindow * 0.5, cycle);
  const dist = Math.min(
    positiveMod(local - center, cycle),
    positiveMod(center - local, cycle)
  );
  const openRadius = openWindow * 0.5;
  const blend = clamp(1 - dist / Math.max(0.001, openRadius), 0, 1);
  const closedBlend = open ? 1 - blend * 0.86 : 1;

  let tunedClosed = closedBlend;
  let dangerThreshold = 0.46;

  if (meta.obstacle === 'arc_blade') {
    tunedClosed = clamp(closedBlend * 1.08 + Math.sin(time * 3.4 + meta.obstaclePhase) * 0.08, 0, 1);
    dangerThreshold = 0.33;
  } else if (meta.obstacle === 'shutter_gate') {
    tunedClosed = clamp(closedBlend * 0.94 + 0.06, 0, 1);
    dangerThreshold = 0.5;
  } else if (meta.obstacle === 'pulse_laser') {
    tunedClosed = clamp(closedBlend + Math.sin(time * 7.8 + meta.obstaclePhase * 2.1) * 0.18, 0, 1);
    dangerThreshold = 0.37;
  } else if (meta.obstacle === 'gravity_orb') {
    tunedClosed = clamp(closedBlend * 0.86 + (0.5 + 0.5 * Math.sin(time * 2.2 + meta.obstaclePhase)) * 0.28, 0, 1);
    dangerThreshold = 0.44;
  } else if (meta.obstacle === 'prism_mine') {
    tunedClosed = clamp(closedBlend * 0.9 + (0.5 + 0.5 * Math.sin(time * 5.6 + meta.obstaclePhase * 2.0)) * 0.22, 0, 1);
    dangerThreshold = 0.41;
  } else if (meta.obstacle === 'flame_jet') {
    tunedClosed = clamp(closedBlend * 0.85 + (0.5 + 0.5 * Math.sin(time * 4.5 + meta.obstaclePhase * 1.2)) * 0.24, 0, 1);
    dangerThreshold = 0.52;
  } else if (meta.obstacle === 'phase_portal') {
    tunedClosed = clamp(closedBlend * 0.94 + Math.sin(time * 2.9 + meta.obstaclePhase) * 0.1, 0, 1);
    dangerThreshold = 0.4;
  } else if (meta.obstacle === 'trap_split') {
    tunedClosed = clamp(closedBlend * 1.06, 0, 1);
    dangerThreshold = 0.35;
  } else if (meta.obstacle === 'magnetron') {
    tunedClosed = clamp(closedBlend * 0.9 + (0.5 + 0.5 * Math.sin(time * 1.8 + meta.obstaclePhase)) * 0.18, 0, 1);
    dangerThreshold = 0.47;
  } else if (meta.obstacle === 'spike_fan') {
    tunedClosed = clamp(closedBlend * 1.06 + (0.5 + 0.5 * Math.sin(time * 6.1 + meta.obstaclePhase * 1.4)) * 0.08, 0, 1);
    dangerThreshold = 0.36;
  } else if (meta.obstacle === 'thunder_column') {
    tunedClosed = clamp(closedBlend * 0.84 + (0.5 + 0.5 * Math.sin(time * 8.8 + meta.obstaclePhase * 2.8)) * 0.25, 0, 1);
    dangerThreshold = 0.5;
  } else if (meta.obstacle === 'vortex_saw') {
    tunedClosed = clamp(closedBlend * 1.02 + Math.sin(time * 4.4 + meta.obstaclePhase * 1.7) * 0.12, 0, 1);
    dangerThreshold = 0.38;
  } else if (meta.obstacle === 'ion_barrier') {
    tunedClosed = clamp(closedBlend * 1.05 + Math.sin(time * 5.9 + meta.obstaclePhase) * 0.14, 0, 1);
    dangerThreshold = 0.4;
  } else if (meta.obstacle === 'void_serpent') {
    tunedClosed = clamp(closedBlend * 0.9 + (0.5 + 0.5 * Math.sin(time * 1.3 + meta.obstaclePhase)) * 0.3, 0, 1);
    dangerThreshold = 0.46;
  } else if (meta.obstacle === 'ember_wave') {
    tunedClosed = clamp(closedBlend * 0.88 + Math.sin(time * 6.7 + meta.obstaclePhase * 1.5) * 0.18, 0, 1);
    dangerThreshold = 0.43;
  } else if (meta.obstacle === 'quantum_shard') {
    tunedClosed = clamp(closedBlend * 0.82 + (0.5 + 0.5 * Math.sin(time * 7.2 + meta.obstaclePhase * 2.4)) * 0.28, 0, 1);
    dangerThreshold = 0.49;
  }

  return {
    closedBlend: tunedClosed,
    danger: tunedClosed >= dangerThreshold,
  };
};

const collectibleColor = (type: RingData['collectibleType']) => {
  if (type === 'core') return '#ffcb8d';
  if (type === 'sync') return '#9ef4ff';
  return '#78e6ff';
};

const platformColor = (platform: OctaPlatformType) => {
  if (
    platform === 'drift_boost' ||
    platform === 'reverse_drift' ||
    platform === 'overdrive_strip'
  ) {
    return '#75e7ff';
  }
  if (platform === 'split_rail' || platform === 'gravity_drift') return '#95dbff';
  if (platform === 'pulse_pad' || platform === 'spring_pad') return '#ffbf7f';
  if (platform === 'warp_gate' || platform === 'phase_lane') return '#cb95ff';
  if (platform === 'resin_lane') return '#8de08d';
  if (platform === 'crusher_lane') return '#ff8f8f';
  return '#9fd9ff';
};

const obstacleColor = (obstacle: OctaObstacleType) => {
  if (obstacle === 'none') return '#ffffff';
  if (
    obstacle === 'shutter_gate' ||
    obstacle === 'trap_split' ||
    obstacle === 'thunder_column'
  ) {
    return '#ffb37b';
  }
  if (
    obstacle === 'gravity_orb' ||
    obstacle === 'magnetron' ||
    obstacle === 'phase_portal' ||
    obstacle === 'void_serpent' ||
    obstacle === 'quantum_shard'
  ) {
    return '#be94ff';
  }
  if (obstacle === 'flame_jet') return '#ff7044';
  if (obstacle === 'ember_wave') return '#ff8b54';
  if (obstacle === 'ion_barrier') return '#8fe4ff';
  if (obstacle === 'pulse_laser') return '#ff7fd8';
  return '#ff8e7e';
};

const sampleGhostFrame = (
  frames: readonly OctaReplayGhostFrame[],
  targetFrame: number
) => {
  if (frames.length <= 0) return null;
  if (targetFrame <= frames[0].frame) return frames[0];
  if (targetFrame >= frames[frames.length - 1].frame) {
    return frames[frames.length - 1];
  }

  let lo = 0;
  let hi = frames.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].frame < targetFrame) lo = mid + 1;
    else hi = mid - 1;
  }

  const next = frames[Math.min(frames.length - 1, lo)];
  const prev = frames[Math.max(0, lo - 1)];
  const span = Math.max(1, next.frame - prev.frame);
  const alpha = clamp((targetFrame - prev.frame) / span, 0, 1);

  return {
    frame: Math.floor(targetFrame),
    x: THREE.MathUtils.lerp(prev.x, next.x, alpha),
    y: THREE.MathUtils.lerp(prev.y, next.y, alpha),
    z: THREE.MathUtils.lerp(prev.z, next.z, alpha),
  };
};

const nextStageTargetLabel = (stageId: number) => {
  const next = STAGE_PROFILES.find((stage) => stage.id === stageId + 1);
  return next?.label ?? STAGE_PROFILES[STAGE_PROFILES.length - 1].label;
};

export default function OctaSurge() {
  const snap = useSnapshot(octaSurgeState);
  const { paused, restartSeed } = useGameUIState();
  const { camera, gl, scene } = useThree();

  const inputRef = useInputRef({
    preventDefault: [
      ' ',
      'space',
      'spacebar',
      'enter',
      'arrowleft',
      'arrowright',
      'arrowup',
      'a',
      'd',
      'w',
      'q',
      'e',
      'c',
      'v',
      'tab',
      'r',
      'shift',
    ],
  });

  const worldRef = useRef<THREE.Group>(null);
  const playerRef = useRef<THREE.Group>(null);
  const ghostRef = useRef<THREE.Group>(null);

  const obstacleBladeMeshRef = useRef<THREE.InstancedMesh>(null);
  const obstacleGateMeshRef = useRef<THREE.InstancedMesh>(null);
  const obstacleCoreMeshRef = useRef<THREE.InstancedMesh>(null);
  const obstacleSpireMeshRef = useRef<THREE.InstancedMesh>(null);
  const platformMeshRef = useRef<THREE.InstancedMesh>(null);
  const collectibleMeshRef = useRef<THREE.InstancedMesh>(null);

  const bloomRef = useRef<any>(null);
  const chromaRef = useRef<any>(null);
  const vignetteRef = useRef<any>(null);

  const ringGenRef = useRef(createRingRunGenerator(snap.worldSeed, snap.mode));
  const simRef = useRef(createSimState(Math.floor(STAGE_PROFILES[0].sides / 2), STAGE_PROFILES[0].sides, STAGE_PROFILES[0].id));
  const fixedStepperRef = useRef(createFixedStepper(1 / 120, 0.05, 8));
  const turnQueueRef = useRef<Array<-1 | 1>>([]);
  const flipQueueRef = useRef(0);
  const slowTapRef = useRef(false);

  const replayRef = useRef<ReplayRuntime>(createReplayRuntime());
  const queuedReplayRef = useRef<OctaReplayRun | null>(null);

  const baseRingRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const speedRef = useRef<number>(GAME.baseSpeed);
  const comboRef = useRef(0);
  const audioReactiveRef = useRef(0);
  const stageFlashRef = useRef(0);
  const tileVariantRef = useRef(snap.tileVariant);

  const audioRef = useRef<AudioGraph>({
    element: null,
    context: null,
    source: null,
    analyser: null,
    data: null,
    started: false,
  });

  const sceneBgRef = useRef(new THREE.Color(FIBER_COLORS.bg));
  const sceneFogRef = useRef(new THREE.Color(FIBER_COLORS.fog));

  const obstacleCountMax = VISIBLE_RING_COUNT * GAME.maxSides;
  const platformCountMax = VISIBLE_RING_COUNT * GAME.maxSides;
  const collectibleCountMax = VISIBLE_RING_COUNT;

  const geometry = useMemo(
    () => ({
      obstacleBlade: new THREE.BoxGeometry(0.82, 0.1, 0.26),
      obstacleGate: new THREE.TorusGeometry(0.32, 0.09, 10, 24),
      obstacleCore: new THREE.IcosahedronGeometry(0.34, 0),
      obstacleSpire: new THREE.ConeGeometry(0.3, 0.8, 6),
      platformPulse: new THREE.TorusGeometry(0.24, 0.05, 8, 18),
      collectible: new THREE.IcosahedronGeometry(0.25, 0),
      playerCore: new THREE.IcosahedronGeometry(0.38, 1),
      playerHalo: new THREE.TorusGeometry(0.6, 0.045, 12, 64),
      ghostCore: new THREE.IcosahedronGeometry(0.22, 1),
      ghostRing: new THREE.TorusGeometry(0.44, 0.034, 12, 40),
    }),
    []
  );

  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColorA = useMemo(() => new THREE.Color(), []);
  const tempColorB = useMemo(() => new THREE.Color(), []);
  const chromaOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  const zeroOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  const glitchDelay = useMemo(() => new THREE.Vector2(1.4, 3.1), []);
  const glitchDuration = useMemo(() => new THREE.Vector2(0.08, 0.16), []);
  const glitchStrength = useMemo(() => new THREE.Vector2(0.03, 0.14), []);

  const getRing = useCallback((index: number) => ringGenRef.current.getRing(index), []);

  const startAudio = useCallback(() => {
    const graph = audioRef.current;
    if (!graph.element || graph.started) return;
    if (typeof window === 'undefined') return;

    const context = new window.AudioContext();
    const source = context.createMediaElementSource(graph.element);
    const analyser = context.createAnalyser();

    analyser.fftSize = GAME.audioFFTSize;
    analyser.smoothingTimeConstant = 0.82;

    source.connect(analyser);
    analyser.connect(context.destination);

    graph.context = context;
    graph.source = source;
    graph.analyser = analyser;
    graph.data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)) as Uint8Array<ArrayBuffer>;
    graph.started = true;

    void context.resume().then(() => {
      void graph.element?.play().catch(() => {});
    });
  }, []);

  const sampleAudioReactive = useCallback(() => {
    const graph = audioRef.current;
    if (!graph.analyser || !graph.data) return 0;

    graph.analyser.getByteFrequencyData(graph.data);

    let bass = 0;
    let high = 0;

    const bassEnd = Math.max(6, Math.floor(graph.data.length * 0.16));
    const highStart = Math.max(bassEnd + 1, Math.floor(graph.data.length * 0.52));

    for (let i = 0; i < bassEnd; i += 1) bass += graph.data[i];
    for (let i = highStart; i < graph.data.length; i += 1) high += graph.data[i];

    const bassNorm = bass / Math.max(1, bassEnd) / 255;
    const highNorm = high / Math.max(1, graph.data.length - highStart) / 255;

    return clamp(bassNorm * 0.74 + highNorm * 0.48, 0, 1);
  }, []);

  const queueReplayInput = useCallback((action: OctaReplayInputAction) => {
    const replay = replayRef.current;
    if (replay.mode !== 'record') return;
    replay.events.push({
      frame: replay.frame + 1,
      action,
    });
  }, []);

  const finalizeReplay = useCallback(
    (params: {
      outcome: OctaReplayOutcome;
      endReason: string;
      score: number;
      distance: number;
      runTime: number;
    }) => {
      const replay = replayRef.current;
      if (replay.mode !== 'record') return;

      const replayRun: OctaReplayRun = {
        version: 1,
        seed: replay.seed,
        mode: replay.runMode,
        cameraMode: replay.cameraMode,
        recordedAt: Date.now(),
        totalFrames: replay.frame,
        finalScore: Math.floor(params.score),
        finalDistance: params.distance,
        finalTime: params.runTime,
        outcome: params.outcome,
        endReason: params.endReason,
        events: replay.events.map((event) => ({ ...event })),
        ghostFrames: replay.ghostFrames.map((frame) => ({ ...frame })),
      };
      octaSurgeState.setLastReplay(replayRun);
    },
    []
  );

  const initializeRun = useCallback(() => {
    startAudio();

    const queuedReplay = queuedReplayRef.current ?? octaSurgeState.consumeReplayPlayback();
    ringGenRef.current.reset(queuedReplay?.seed ?? snap.worldSeed, queuedReplay?.mode ?? snap.mode);

    const firstRing = getRing(0);
    const sim = createSimState(firstRing.safeLane, firstRing.sides, firstRing.stageId);
    simRef.current = sim;

    baseRingRef.current = sim.baseRing;
    scrollOffsetRef.current = 0;
    speedRef.current = sim.speed;
    comboRef.current = sim.combo;
    audioReactiveRef.current = sim.audioReactive;
    stageFlashRef.current = sim.stageFlash;

    replayRef.current = {
      mode: queuedReplay ? 'playback' : 'record',
      seed: queuedReplay?.seed ?? snap.worldSeed,
      runMode: queuedReplay?.mode ?? snap.mode,
      cameraMode: queuedReplay?.cameraMode ?? snap.cameraMode,
      frame: 0,
      events: [],
      ghostFrames: [],
      playbackCursor: 0,
      playbackEvents: queuedReplay
        ? queuedReplay.events.map((event) => ({ ...event })).sort((a, b) => a.frame - b.frame)
        : [],
    };
    octaSurgeState.setReplayMode(replayRef.current.mode);
    queuedReplayRef.current = null;

    turnQueueRef.current.length = 0;
    flipQueueRef.current = 0;
    slowTapRef.current = false;
    fixedStepperRef.current.reset();

    octaSurgeState.setCrashReason('');
    octaSurgeState.syncFrame({
      score: 0,
      combo: 0,
      multiplier: 1,
      speed: GAME.baseSpeed,
      time: 0,
      distance: 0,
      progress: 0,
      sides: sim.sides,
      stage: sim.stageId,
      stageLabel: stageById(sim.stageId).label,
      stageFlash: 1,
      slowMoMeter: 0,
      shardCount: 0,
      hudPulse: 0,
      audioReactive: 0,
      currentPlatform: 'smooth_lane',
      currentObstacle: 'none',
    });

    useOctaRuntimeStore.setState({
      cameraMode: queuedReplay?.cameraMode ?? snap.cameraMode,
    });
  }, [getRing, snap.cameraMode, snap.mode, snap.worldSeed, startAudio]);

  const startRun = useCallback(() => {
    if (octaSurgeState.phase === 'playing') {
      const sim = simRef.current;
      finalizeReplay({
        outcome: 'abort',
        endReason: 'Run aborted.',
        score: sim.score,
        distance: sim.distance,
        runTime: sim.runTime,
      });
    }

    const replayPlayback = octaSurgeState.consumeReplayPlayback();
    queuedReplayRef.current = replayPlayback;

    if (replayPlayback) {
      octaSurgeState.setMode(replayPlayback.mode);
      octaSurgeState.setCameraMode(replayPlayback.cameraMode);
      useOctaRuntimeStore.setState({ cameraMode: replayPlayback.cameraMode });
    }

    fixedStepperRef.current.reset();
    turnQueueRef.current.length = 0;
    flipQueueRef.current = 0;
    slowTapRef.current = false;
    octaSurgeState.setReplayMode('off');
    octaSurgeState.start();
    if (replayPlayback) {
      octaSurgeState.worldSeed = replayPlayback.seed;
    }
  }, [finalizeReplay]);

  const endRun = useCallback(
    (reason: string, outcome: OctaReplayOutcome) => {
      const sim = simRef.current;
      const runGoal =
        snap.mode === 'daily' ? GAME.dailyTargetScore : GAME.classicTargetScore;
      const progress =
        snap.mode === 'endless'
          ? 0
          : clamp(sim.score / Math.max(1, runGoal), 0, 1);
      const stage = stageById(sim.stageId);

      octaSurgeState.syncFrame({
        score: Math.floor(sim.score),
        combo: sim.combo,
        multiplier: sim.multiplier,
        speed: sim.speed,
        time: sim.runTime,
        distance: sim.distance,
        progress,
        sides: sim.sides,
        stage: stage.id,
        stageLabel: stage.label,
        stageFlash: sim.stageFlash,
        slowMoMeter: sim.slowMoMeter,
        shardCount: sim.shardCount,
        hudPulse: Math.max(sim.flipPulse, sim.dangerPulse, sim.audioReactive * 0.5),
        audioReactive: sim.audioReactive,
        currentPlatform: sim.currentPlatform,
        currentObstacle: sim.currentObstacle,
      });

      finalizeReplay({
        outcome,
        endReason: reason,
        score: sim.score,
        distance: sim.distance,
        runTime: sim.runTime,
      });

      octaSurgeState.setCrashReason(reason);
      octaSurgeState.end();
    },
    [finalizeReplay, snap.mode]
  );

  const updateInstances = useCallback(() => {
    const bladeMesh = obstacleBladeMeshRef.current;
    const gateMesh = obstacleGateMeshRef.current;
    const coreMesh = obstacleCoreMeshRef.current;
    const spireMesh = obstacleSpireMeshRef.current;
    const platformMesh = platformMeshRef.current;
    const collectibleMesh = collectibleMeshRef.current;

    if (
      !bladeMesh ||
      !gateMesh ||
      !coreMesh ||
      !spireMesh ||
      !platformMesh ||
      !collectibleMesh
    ) {
      return;
    }

    const flushMesh = (mesh: THREE.InstancedMesh, count: number) => {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    const sim = simRef.current;
    const baseRing = sim.baseRing;
    const scrollOffset = sim.scroll - baseRing * RING_SPACING;

    let bladeCount = 0;
    let gateCount = 0;
    let coreCount = 0;
    let spireCount = 0;
    let platformCount = 0;
    let collectibleCount = 0;

    for (let r = 0; r < VISIBLE_RING_COUNT; r += 1) {
      const ring = getRing(baseRing + r);
      const stage = stageById(ring.stageId);
      const stageVisual = stageVisualById(ring.stageId);
      const step = laneStep(ring.sides);
      const warp =
        Math.sin(ring.warpSeed + sim.runTime * 0.72 + ring.index * 0.11) *
        stage.warpAmplitude;
      const z = -r * RING_SPACING + scrollOffset;

      for (let lane = 0; lane < ring.sides; lane += 1) {
        const bit = laneBit(lane, ring.sides);
        if ((ring.solidMask & bit) === 0) continue;

        const meta = ring.laneMeta[lane];
        if (!meta) continue;

        const angle = lane * step + warp;

        if (meta.platform !== 'smooth_lane' && platformCount < platformCountMax) {
          const platformPulse = platformBlend(
            meta.platform,
            meta.platformPhase,
            sim.runTime
          );
          const platformRadius = GAME.radius - 1.02 + platformPulse * 0.08;
          const px = Math.cos(angle) * platformRadius;
          const py = Math.sin(angle) * platformRadius;

          let psx = 0.86;
          let psy = 0.86;
          let psz = 0.86;
          if (meta.platform === 'drift_boost' || meta.platform === 'reverse_drift') {
            psx = 1.02;
            psy = 0.68;
          } else if (meta.platform === 'pulse_pad') {
            psx = 0.78 + platformPulse * 0.42;
            psy = 0.78 + platformPulse * 0.42;
          } else if (meta.platform === 'spring_pad') {
            psx = 0.72;
            psy = 0.72;
            psz = 1.02;
          } else if (meta.platform === 'warp_gate' || meta.platform === 'phase_lane') {
            psx = 0.98;
            psy = 0.98;
            psz = 0.74;
          } else if (meta.platform === 'resin_lane') {
            psx = 1.08;
            psy = 0.62;
            psz = 0.72;
          } else if (meta.platform === 'crusher_lane') {
            psx = 0.82;
            psy = 0.82;
            psz = 1.08;
          } else if (meta.platform === 'overdrive_strip') {
            psx = 1.12;
            psy = 0.54;
            psz = 0.68;
          } else if (meta.platform === 'split_rail') {
            psx = 1.06;
            psy = 0.58;
            psz = 0.84;
          } else if (meta.platform === 'gravity_drift') {
            psx = 0.74 + platformPulse * 0.24;
            psy = 0.98;
            psz = 0.78;
          }

          tempObject.position.set(px, py, z - 0.03);
          tempObject.rotation.set(
            platformPulse * 0.6 + sim.runTime * 0.4,
            sim.runTime * 1.2 + meta.platformPhase * 0.5,
            angle + Math.PI / 2
          );
          tempObject.scale.set(psx, psy, psz);
          tempObject.updateMatrix();
          platformMesh.setMatrixAt(platformCount, tempObject.matrix);

          tempColorA
            .set(platformColor(meta.platform))
            .lerp(tempColorB.set(stageVisual.laneHot), 0.22)
            .multiplyScalar(0.56 + platformPulse * 0.62 + sim.audioReactive * 0.22);
          platformMesh.setColorAt(platformCount, tempColorA);
          platformCount += 1;
        }

        if (meta.obstacle === 'none') continue;

        const hazard = obstacleState(meta, sim.runTime);
        if (hazard.closedBlend < 0.08) continue;

        const obstacleRadius = GAME.radius - 0.94 + hazard.closedBlend * 0.16;
        const ox = Math.cos(angle) * obstacleRadius;
        const oy = Math.sin(angle) * obstacleRadius;

        let sx = 0.34;
        let sy = 0.34;
        let sz = 0.34;
        let tiltX = sim.runTime * 1.4 + meta.obstaclePhase * 0.1;
        let tiltY = sim.runTime * 1.1;

        if (meta.obstacle === 'arc_blade') {
          sx = 0.84;
          sy = 0.1 + hazard.closedBlend * 0.2;
          sz = 0.24;
          tiltY = sim.runTime * 4.2 + meta.obstaclePhase * 0.8;
        } else if (meta.obstacle === 'shutter_gate') {
          sx = 0.62;
          sy = 0.22 + hazard.closedBlend * 0.32;
          sz = 0.2;
        } else if (meta.obstacle === 'pulse_laser') {
          sx = 0.9;
          sy = 0.08 + hazard.closedBlend * 0.16;
          sz = 0.12;
          tiltY = sim.runTime * 6.0 + meta.obstaclePhase * 0.5;
        } else if (meta.obstacle === 'gravity_orb') {
          sx = 0.44 + hazard.closedBlend * 0.14;
          sy = 0.44 + hazard.closedBlend * 0.14;
          sz = 0.44 + hazard.closedBlend * 0.14;
          tiltY = sim.runTime * 2.0 + meta.obstaclePhase * 1.1;
        } else if (meta.obstacle === 'prism_mine') {
          sx = 0.38 + hazard.closedBlend * 0.18;
          sy = 0.38 + hazard.closedBlend * 0.18;
          sz = 0.38 + hazard.closedBlend * 0.18;
          tiltY = sim.runTime * 2.8 + meta.obstaclePhase * 1.5;
        } else if (meta.obstacle === 'flame_jet') {
          sx = 0.32;
          sy = 0.62 + hazard.closedBlend * 0.44;
          sz = 0.24;
          tiltX = sim.runTime * 2.2 + meta.obstaclePhase;
        } else if (meta.obstacle === 'phase_portal') {
          sx = 0.48;
          sy = 0.48;
          sz = 0.24 + hazard.closedBlend * 0.12;
          tiltY = sim.runTime * 3.2;
        } else if (meta.obstacle === 'trap_split') {
          sx = 0.78;
          sy = 0.12 + hazard.closedBlend * 0.16;
          sz = 0.24;
        } else if (meta.obstacle === 'magnetron') {
          sx = 0.52;
          sy = 0.3;
          sz = 0.52;
          tiltY = sim.runTime * 1.8 + meta.obstaclePhase;
        } else if (meta.obstacle === 'spike_fan') {
          sx = 0.66;
          sy = 0.14 + hazard.closedBlend * 0.12;
          sz = 0.54;
          tiltY = sim.runTime * 5.4 + meta.obstaclePhase;
        } else if (meta.obstacle === 'thunder_column') {
          sx = 0.28;
          sy = 0.78 + hazard.closedBlend * 0.22;
          sz = 0.28;
          tiltY = sim.runTime * 8.2 + meta.obstaclePhase * 1.4;
        } else if (meta.obstacle === 'vortex_saw') {
          sx = 0.72;
          sy = 0.11 + hazard.closedBlend * 0.08;
          sz = 0.72;
          tiltY = sim.runTime * 6.4 + meta.obstaclePhase * 1.6;
        } else if (meta.obstacle === 'ion_barrier') {
          sx = 0.88;
          sy = 0.1 + hazard.closedBlend * 0.14;
          sz = 0.2;
          tiltY = sim.runTime * 7.2 + meta.obstaclePhase * 1.3;
        } else if (meta.obstacle === 'void_serpent') {
          sx = 0.56;
          sy = 0.24 + hazard.closedBlend * 0.2;
          sz = 0.56;
          tiltX = sim.runTime * 2.8 + meta.obstaclePhase * 1.2;
          tiltY = sim.runTime * 2.4 + meta.obstaclePhase * 0.9;
        } else if (meta.obstacle === 'ember_wave') {
          sx = 0.74;
          sy = 0.12 + hazard.closedBlend * 0.22;
          sz = 0.46;
          tiltY = sim.runTime * 5.8 + meta.obstaclePhase * 1.1;
        } else if (meta.obstacle === 'quantum_shard') {
          sx = 0.36 + hazard.closedBlend * 0.22;
          sy = 0.36 + hazard.closedBlend * 0.22;
          sz = 0.36 + hazard.closedBlend * 0.22;
          tiltY = sim.runTime * 4.6 + meta.obstaclePhase * 2.2;
        }

        tempObject.position.set(ox, oy, z);
        tempObject.rotation.set(tiltX, tiltY, angle + Math.PI / 2);
        tempObject.scale.set(sx, sy, sz);
        tempObject.updateMatrix();

        tempColorA
          .set(obstacleColor(meta.obstacle))
          .lerp(tempColorB.set(stageVisual.obstacleHot), 0.32)
          .multiplyScalar(0.58 + hazard.closedBlend * 0.8 + sim.audioReactive * 0.18);

        const useBlade =
          meta.obstacle === 'arc_blade' ||
          meta.obstacle === 'spike_fan' ||
          meta.obstacle === 'vortex_saw' ||
          meta.obstacle === 'ember_wave';
        const useGate =
          meta.obstacle === 'shutter_gate' ||
          meta.obstacle === 'pulse_laser' ||
          meta.obstacle === 'phase_portal' ||
          meta.obstacle === 'trap_split' ||
          meta.obstacle === 'ion_barrier';
        const useCore =
          meta.obstacle === 'gravity_orb' ||
          meta.obstacle === 'prism_mine' ||
          meta.obstacle === 'magnetron' ||
          meta.obstacle === 'void_serpent' ||
          meta.obstacle === 'quantum_shard';

        if (useBlade && bladeCount < obstacleCountMax) {
          bladeMesh.setMatrixAt(bladeCount, tempObject.matrix);
          bladeMesh.setColorAt(bladeCount, tempColorA);
          bladeCount += 1;
        } else if (useGate && gateCount < obstacleCountMax) {
          gateMesh.setMatrixAt(gateCount, tempObject.matrix);
          gateMesh.setColorAt(gateCount, tempColorA);
          gateCount += 1;
        } else if (useCore && coreCount < obstacleCountMax) {
          coreMesh.setMatrixAt(coreCount, tempObject.matrix);
          coreMesh.setColorAt(coreCount, tempColorA);
          coreCount += 1;
        } else if (spireCount < obstacleCountMax) {
          spireMesh.setMatrixAt(spireCount, tempObject.matrix);
          spireMesh.setColorAt(spireCount, tempColorA);
          spireCount += 1;
        }
      }

      if (
        ring.collectibleLane >= 0 &&
        ring.collectibleType !== null &&
        !ring.collected
      ) {
        const angle = ring.collectibleLane * step + warp;
        const radius = GAME.radius - 1.38;
        const cx = Math.cos(angle) * radius;
        const cy = Math.sin(angle) * radius;

        tempObject.position.set(cx, cy, z);
        tempObject.rotation.set(sim.runTime * 2.4, sim.runTime * 1.7, sim.runTime * 2.1);
        tempObject.scale.setScalar(
          ring.collectibleType === 'core'
            ? 1.24
            : ring.collectibleType === 'sync'
              ? 1.08
              : 0.92
        );
        tempObject.updateMatrix();
        collectibleMesh.setMatrixAt(collectibleCount, tempObject.matrix);

        tempColorA
          .set(collectibleColor(ring.collectibleType))
          .multiplyScalar(0.85 + sim.audioReactive * 0.4);
        collectibleMesh.setColorAt(collectibleCount, tempColorA);

        collectibleCount += 1;
      }
    }

    flushMesh(bladeMesh, bladeCount);
    flushMesh(gateMesh, gateCount);
    flushMesh(coreMesh, coreCount);
    flushMesh(spireMesh, spireCount);
    flushMesh(platformMesh, platformCount);
    flushMesh(collectibleMesh, collectibleCount);
  }, [getRing, platformCountMax, tempColorA, tempColorB, tempObject]);

  useEffect(() => {
    octaSurgeState.load();

    sceneBgRef.current.set(FIBER_COLORS.bg);
    sceneFogRef.current.set(FIBER_COLORS.fog);

    scene.background = sceneBgRef.current;
    scene.fog = new THREE.Fog(sceneFogRef.current.clone(), 4, 150);
    gl.setClearColor(sceneBgRef.current, 1);
    gl.domElement.style.touchAction = 'none';

    const audio = new Audio(GAME.audioFile);
    audio.loop = true;
    audio.volume = 0.28;
    audio.preload = 'auto';
    audioRef.current.element = audio;

    return () => {
      gl.domElement.style.touchAction = '';
      scene.fog = null;

      if (audioRef.current.element) {
        audioRef.current.element.pause();
        audioRef.current.element.src = '';
      }

      if (audioRef.current.context) {
        void audioRef.current.context.close().catch(() => {});
      }

      audioRef.current.element = null;
      audioRef.current.analyser = null;
      audioRef.current.context = null;
      audioRef.current.source = null;
      audioRef.current.data = null;
      audioRef.current.started = false;
    };
  }, [gl, scene]);

  useEffect(() => {
    if (!restartSeed) return;
    startRun();
  }, [restartSeed, startRun]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;
    initializeRun();
  }, [initializeRun, snap.phase]);

  useEffect(() => {
    obstacleBladeMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    obstacleGateMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    obstacleCoreMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    obstacleSpireMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    platformMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    collectibleMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, []);

  useFrame((state, rawDelta) => {
    const frameDelta = clamp(rawDelta, 0.001, 0.05);
    const input = inputRef.current;

    tileVariantRef.current = snap.tileVariant;

    const wantsStart =
      input.pointerJustDown ||
      input.justPressed.has('enter') ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar');
    const replayTap = input.justPressed.has('r');

    if (snap.phase !== 'playing') {
      fixedStepperRef.current.reset();
      turnQueueRef.current.length = 0;
      flipQueueRef.current = 0;
      slowTapRef.current = false;
      if (octaSurgeState.replayMode !== 'off') {
        octaSurgeState.setReplayMode('off');
      }

      if (replayTap && octaSurgeState.queueReplayPlayback()) {
        startRun();
      } else if (wantsStart) {
        startRun();
      }

      if (worldRef.current) {
        worldRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
      }
      if (playerRef.current) {
        const px = Math.cos(GAME.playerAngle) * (GAME.radius - 0.58);
        const py = Math.sin(GAME.playerAngle) * (GAME.radius - 0.58);
        playerRef.current.position.set(px, py, GAME.playerZ + Math.sin(state.clock.elapsedTime * 2.8) * 0.04);
      }
      if (ghostRef.current) ghostRef.current.visible = false;

      const cam = camera as THREE.PerspectiveCamera;
      cam.fov = THREE.MathUtils.lerp(cam.fov, 66, 1 - Math.exp(-frameDelta * 4));
      cam.position.x = THREE.MathUtils.lerp(cam.position.x, 0, 1 - Math.exp(-frameDelta * 4));
      cam.position.y = THREE.MathUtils.lerp(cam.position.y, -0.5, 1 - Math.exp(-frameDelta * 4));
      cam.position.z = THREE.MathUtils.lerp(cam.position.z, 9.4, 1 - Math.exp(-frameDelta * 4));
      cam.lookAt(0, 0, -14);
      cam.updateProjectionMatrix();

      updateInstances();
      clearFrameInput(inputRef);
      return;
    }

    if (paused) {
      fixedStepperRef.current.reset();
      clearFrameInput(inputRef);
      return;
    }

    const leftTap =
      input.justPressed.has('arrowleft') ||
      input.justPressed.has('a') ||
      (input.pointerJustDown && input.pointerX < -0.2);
    const rightTap =
      input.justPressed.has('arrowright') ||
      input.justPressed.has('d') ||
      (input.pointerJustDown && input.pointerX > 0.2);
    const flipTap =
      input.justPressed.has('arrowup') ||
      input.justPressed.has('w') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar');
    const slowTap = input.justPressed.has('shift');

    const stylePrevTap = input.justPressed.has('q');
    const styleNextTap = input.justPressed.has('e');

    const cameraTap =
      input.justPressed.has('c') ||
      input.justPressed.has('v') ||
      input.justPressed.has('tab');

    if (cameraTap) {
      const mode = nextCameraMode(snap.cameraMode);
      octaSurgeState.setCameraMode(mode);
      useOctaRuntimeStore.setState({ cameraMode: mode });
    }

    if (stylePrevTap) octaSurgeState.cycleTileVariant(-1);
    if (styleNextTap) octaSurgeState.cycleTileVariant(1);

    if (leftTap !== rightTap) {
      const queue = turnQueueRef.current;
      const direction: -1 | 1 = leftTap ? -1 : 1;
      if (queue.length < MAX_TURN_QUEUE) {
        queue.push(direction);
        queueReplayInput(direction < 0 ? 'turn_left' : 'turn_right');
      }
    }

    if (flipTap) {
      const previous = flipQueueRef.current;
      flipQueueRef.current = Math.min(MAX_FLIP_QUEUE, flipQueueRef.current + 1);
      if (flipQueueRef.current > previous) queueReplayInput('flip');
    }

    if (slowTap) {
      slowTapRef.current = true;
      queueReplayInput('slow_mo');
    }

    const sampledAudio = sampleAudioReactive();
    const sim = simRef.current;

    fixedStepperRef.current.tick(frameDelta, (fixedDelta) => {
      const replay = replayRef.current;
      replay.frame += 1;

      if (replay.mode === 'playback') {
        while (replay.playbackCursor < replay.playbackEvents.length) {
          const event = replay.playbackEvents[replay.playbackCursor];
          if (event.frame > replay.frame) break;
          replay.playbackCursor += 1;
          if (event.frame < replay.frame) continue;

          if (event.action === 'turn_left' || event.action === 'turn_right') {
            const queue = turnQueueRef.current;
            const direction: -1 | 1 = event.action === 'turn_left' ? -1 : 1;
            if (queue.length < MAX_TURN_QUEUE) queue.push(direction);
            continue;
          }

          if (event.action === 'flip') {
            flipQueueRef.current = Math.min(MAX_FLIP_QUEUE, flipQueueRef.current + 1);
            continue;
          }

          if (event.action === 'slow_mo') {
            slowTapRef.current = true;
          }
        }
      }

      if (sim.ended) {
        sim.deathTimer += fixedDelta;
        return;
      }

      if (sim.flipCooldown <= 0 && flipQueueRef.current > 0) {
        flipQueueRef.current -= 1;
        sim.laneIndex = normalizeLane(sim.laneIndex + Math.floor(sim.sides / 2), sim.sides);
        sim.flipPulse = 1;
        sim.flipCooldown = GAME.flipCooldownMs / 1000;
        sim.targetRotation = rotationForLane(sim.laneIndex, sim.sides);
      }

      if (sim.turnCooldown <= 0 && turnQueueRef.current.length > 0) {
        const direction = turnQueueRef.current.shift();
        if (direction) {
          sim.laneIndex = normalizeLane(sim.laneIndex + direction, sim.sides);
          sim.turnCooldown = GAME.turnCooldownMs / 1000;
          sim.targetRotation = rotationForLane(sim.laneIndex, sim.sides);
        }
      }

      if (slowTapRef.current && sim.slowMoMeter >= 28 && sim.slowMoTime <= 0) {
        sim.slowMoMeter = clamp(sim.slowMoMeter - 28, 0, 100);
        sim.slowMoTime = 2.6;
      }
      slowTapRef.current = false;

      sim.turnCooldown = Math.max(0, sim.turnCooldown - fixedDelta);
      sim.flipCooldown = Math.max(0, sim.flipCooldown - fixedDelta);
      sim.comboTimer = Math.max(0, sim.comboTimer - fixedDelta);
      sim.stageFlash = Math.max(0, sim.stageFlash - fixedDelta / GAME.stageFlashDuration);
      sim.flipPulse = Math.max(0, sim.flipPulse - fixedDelta * 2.2);
      sim.dangerPulse = Math.max(0, sim.dangerPulse - fixedDelta * 1.8);
      sim.syncTimer = Math.max(0, sim.syncTimer - fixedDelta);

      if (sim.slowMoTime > 0) {
        sim.slowMoTime = Math.max(0, sim.slowMoTime - fixedDelta);
        sim.slowMoMeter = clamp(sim.slowMoMeter - fixedDelta * 20, 0, 100);
      }

      if (sim.comboTimer <= 0) {
        sim.combo = 0;
        sim.multiplier = Math.max(1, sim.multiplier - fixedDelta * 0.72);
      }

      sim.audioReactive = THREE.MathUtils.lerp(
        sim.audioReactive,
        sampledAudio,
        1 - Math.exp(-fixedDelta * 8)
      );

      const stage = stageById(sim.stageId);
      let targetSpeed = clamp(
        (GAME.baseSpeed + sim.runTime * GAME.speedRamp) *
          stage.speedMultiplier *
          (1 + sim.audioReactive * 0.03),
        GAME.baseSpeed,
        GAME.maxSpeed
      );

      if (sim.slowMoTime > 0) targetSpeed *= 0.58;

      sim.speed = THREE.MathUtils.lerp(sim.speed, targetSpeed, 1 - Math.exp(-fixedDelta * 2.6));
      sim.distance += sim.speed * fixedDelta;
      sim.runTime += fixedDelta;

      const laneDelta = sim.laneIndex - sim.laneFloat;
      const shortestLaneDelta =
        Math.abs(laneDelta) > sim.sides * 0.5
          ? laneDelta - Math.sign(laneDelta) * sim.sides
          : laneDelta;
      sim.laneVelocity += shortestLaneDelta * fixedDelta * 26;
      sim.laneVelocity *= Math.exp(-fixedDelta * 11.8);
      sim.laneFloat = positiveMod(sim.laneFloat + sim.laneVelocity * fixedDelta, sim.sides);

      sim.targetRotation = rotationForLane(sim.laneFloat, sim.sides);
      const deltaRot = shortestAngle(sim.rotation, sim.targetRotation);
      sim.angularVelocity += deltaRot * GAME.springStiffness * fixedDelta;
      sim.angularVelocity *= Math.exp(-GAME.springDamping * fixedDelta);
      sim.angularVelocity = clamp(sim.angularVelocity, -GAME.maxAngularVelocity, GAME.maxAngularVelocity);
      sim.rotation += sim.angularVelocity * fixedDelta;

      sim.scroll += sim.speed * fixedDelta;
      const baseRing = Math.floor(sim.scroll / RING_SPACING);
      sim.baseRing = baseRing;

      while (sim.lastCrossedRing < baseRing && !sim.ended) {
        sim.lastCrossedRing += 1;
        const ring = getRing(sim.lastCrossedRing);

        if (ring.sides !== sim.sides) {
          const remapAngle = normalizeAngle(GAME.playerAngle - sim.rotation);
          const remapped = normalizeLane(Math.round(remapAngle / laneStep(ring.sides)), ring.sides);
          sim.sides = ring.sides;
          sim.laneIndex = remapped;
          sim.laneFloat = remapped;
          sim.targetRotation = rotationForLane(remapped, ring.sides);
          sim.stageFlash = 1;
        }

        if (ring.stageId !== sim.stageId) {
          sim.stageId = ring.stageId;
          sim.stageFlash = 1;
          sim.dangerPulse = Math.max(sim.dangerPulse, 0.24);
        }

        const lane = normalizeLane(Math.round(sim.laneFloat), ring.sides);
        const bit = laneBit(lane, ring.sides);

        if ((ring.solidMask & bit) === 0) {
          sim.ended = true;
          sim.deathType = 'void';
          sim.endReason = 'Void breach: lane integrity lost.';
          sim.dangerPulse = 1;
          break;
        }

        const meta = ring.laneMeta[lane];
        sim.currentPlatform = meta?.platform ?? 'smooth_lane';
        sim.currentObstacle = meta?.obstacle ?? 'none';

        if (meta && meta.obstacle !== 'none') {
          const hazard = obstacleState(meta, sim.runTime);
          if (hazard.danger) {
            sim.ended = true;
            sim.deathType = 'obstacle';
            sim.endReason = OCTA_OBSTACLE_FAIL_REASON[meta.obstacle];
            sim.dangerPulse = 1;
            break;
          }
        }

        const platformGate = platformBlend(meta.platform, meta.platformPhase, sim.runTime);
        if (meta.platform === 'phase_lane' && platformGate > 0.8) {
          sim.ended = true;
          sim.deathType = 'void';
          sim.endReason = 'Phase lane blinked out beneath the packet.';
          sim.dangerPulse = 1;
          break;
        }

        if (meta.platform === 'crusher_lane' && platformGate > 0.84) {
          sim.ended = true;
          sim.deathType = 'obstacle';
          sim.endReason = 'Crusher lane clamped shut.';
          sim.dangerPulse = 1;
          break;
        }

        sim.combo += 1;
        sim.comboTimer = GAME.comboWindow;
        sim.multiplier = clamp(1 + sim.combo * 0.16 + sim.shardCount * 0.06, 1, 9);
        sim.score += GAME.scoreRate * sim.multiplier * (1 + sim.audioReactive * 0.42);

        if (meta.platform === 'drift_boost') {
          sim.laneIndex = normalizeLane(sim.laneIndex + 1, ring.sides);
          sim.targetRotation = rotationForLane(sim.laneIndex, ring.sides);
          sim.score += GAME.scoreRate * 0.26 * sim.multiplier;
        } else if (meta.platform === 'reverse_drift') {
          sim.laneIndex = normalizeLane(sim.laneIndex - 1, ring.sides);
          sim.targetRotation = rotationForLane(sim.laneIndex, ring.sides);
          sim.score += GAME.scoreRate * 0.26 * sim.multiplier;
        } else if (meta.platform === 'pulse_pad') {
          sim.score += GAME.scoreRate * 0.34 * sim.multiplier;
          sim.flipPulse = Math.max(sim.flipPulse, 0.32 + platformGate * 0.3);
          sim.slowMoMeter = clamp(sim.slowMoMeter + 8 + platformGate * 8, 0, 100);
        } else if (meta.platform === 'spring_pad') {
          sim.score += GAME.scoreRate * 0.46 * sim.multiplier;
          sim.flipPulse = Math.max(sim.flipPulse, 0.44);
          sim.slowMoMeter = clamp(sim.slowMoMeter + 14, 0, 100);
        } else if (meta.platform === 'warp_gate') {
          const jump = Math.sin(ring.index * 0.7 + meta.platformPhase) > 0 ? 2 : -2;
          sim.laneIndex = normalizeLane(sim.laneIndex + jump, ring.sides);
          sim.targetRotation = rotationForLane(sim.laneIndex, ring.sides);
          sim.score += GAME.scoreRate * 0.52 * sim.multiplier;
          sim.dangerPulse = Math.max(sim.dangerPulse, 0.36);
        } else if (meta.platform === 'phase_lane') {
          sim.score += GAME.scoreRate * 0.12 * sim.multiplier;
        } else if (meta.platform === 'resin_lane') {
          sim.speed *= 0.86;
          sim.multiplier = Math.max(1, sim.multiplier - 0.1);
        } else if (meta.platform === 'overdrive_strip') {
          sim.speed *= 1.09;
          sim.score += GAME.scoreRate * 0.3 * sim.multiplier;
        } else if (meta.platform === 'split_rail') {
          const offset = Math.sin(ring.index * 0.42 + meta.platformPhase) > 0 ? 1 : -1;
          sim.laneIndex = normalizeLane(sim.laneIndex + offset, ring.sides);
          sim.targetRotation = rotationForLane(sim.laneIndex, ring.sides);
          sim.score += GAME.scoreRate * 0.24 * sim.multiplier;
          sim.dangerPulse = Math.max(sim.dangerPulse, 0.22);
        } else if (meta.platform === 'gravity_drift') {
          const drift = platformGate > 0.5 ? 1 : -1;
          sim.laneIndex = normalizeLane(sim.laneIndex + drift, ring.sides);
          sim.targetRotation = rotationForLane(sim.laneIndex, ring.sides);
          sim.speed *= 1.03;
          sim.score += GAME.scoreRate * 0.26 * sim.multiplier;
          sim.flipPulse = Math.max(sim.flipPulse, 0.28);
        }

        const leftMeta = ring.laneMeta[normalizeLane(lane - 1, ring.sides)];
        const rightMeta = ring.laneMeta[normalizeLane(lane + 1, ring.sides)];
        const nearHazard =
          (leftMeta && leftMeta.obstacle !== 'none' && obstacleState(leftMeta, sim.runTime).danger) ||
          (rightMeta && rightMeta.obstacle !== 'none' && obstacleState(rightMeta, sim.runTime).danger);

        if (nearHazard) {
          sim.score += GAME.scoreRate * 0.34 * sim.multiplier;
          sim.dangerPulse = Math.max(sim.dangerPulse, 0.34);
        }

        if (
          ring.collectibleLane >= 0 &&
          ring.collectibleType !== null &&
          !ring.collected &&
          lane === ring.collectibleLane
        ) {
          ring.collected = true;
          if (ring.collectibleType === 'shard') {
            sim.shardCount += 1;
            sim.slowMoMeter = clamp(sim.slowMoMeter + 22, 0, 100);
            sim.score += 110;
            octaSurgeState.collectStyleShards(1);
          } else if (ring.collectibleType === 'core') {
            sim.multiplier = clamp(sim.multiplier + 0.6, 1, 9);
            sim.score += 220;
            octaSurgeState.collectStyleShards(2);
          } else if (ring.collectibleType === 'sync') {
            sim.syncTimer = 5;
            sim.score += 180;
            octaSurgeState.collectStyleShards(1);
          }
          sim.dangerPulse = Math.max(sim.dangerPulse, 0.22);
        }
      }

      if (replay.mode === 'record' && replay.frame % GHOST_RECORD_STRIDE === 0) {
        const angle = GAME.playerAngle + sim.rotation;
        const radius = GAME.radius - 0.58;
        replay.ghostFrames.push({
          frame: replay.frame,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          z: GAME.playerZ,
        });
      }
    });

    baseRingRef.current = sim.baseRing;
    scrollOffsetRef.current = sim.scroll - sim.baseRing * RING_SPACING;
    speedRef.current = sim.speed;
    comboRef.current = sim.combo;
    audioReactiveRef.current = sim.audioReactive;
    stageFlashRef.current = sim.stageFlash;

    const runGoal = snap.mode === 'daily' ? GAME.dailyTargetScore : GAME.classicTargetScore;
    const runComplete = snap.mode !== 'endless' && sim.score >= runGoal;

    if (!sim.ended && runComplete) {
      sim.ended = true;
      sim.endReason = `Run complete. ${nextStageTargetLabel(sim.stageId)} breached.`;
      sim.deathType = 'obstacle';
      sim.deathTimer = 0;
    }

    if (sim.ended) {
      if (sim.deathTimer >= 0.42) {
        if (runComplete) {
          endRun(sim.endReason, 'complete');
        } else {
          endRun(sim.endReason, 'death');
        }
        clearFrameInput(inputRef);
        return;
      }
      sim.deathTimer += frameDelta;
    }

    if (worldRef.current) {
      worldRef.current.rotation.z = sim.rotation + Math.sin(sim.runTime * 0.48) * 0.01;
    }

    if (playerRef.current) {
      const radius = GAME.radius - 0.58;
      const px = Math.cos(GAME.playerAngle) * radius;
      const py = Math.sin(GAME.playerAngle) * radius;
      const bob = Math.sin(sim.runTime * 7.6) * 0.03;
      const pulse = 1 + sim.audioReactive * 0.08 + sim.flipPulse * 0.1;
      playerRef.current.position.set(px, py, GAME.playerZ + bob);
      playerRef.current.scale.setScalar(pulse);
      playerRef.current.rotation.set(0, 0, -sim.rotation * 0.12 + sim.flipPulse * 0.18);
    }

    if (ghostRef.current) {
      const ghostReplay = snap.lastReplay;
      const canShowGhost =
        snap.phase === 'playing' &&
        snap.replayMode !== 'playback' &&
        !!ghostReplay &&
        ghostReplay.ghostFrames.length > 1;

      if (!canShowGhost || !ghostReplay) {
        ghostRef.current.visible = false;
      } else {
        const ghost = sampleGhostFrame(ghostReplay.ghostFrames, replayRef.current.frame);
        if (!ghost) {
          ghostRef.current.visible = false;
        } else {
          ghostRef.current.visible = true;
          ghostRef.current.position.set(ghost.x, ghost.y, ghost.z + 0.02);
          ghostRef.current.rotation.set(0, 0, sim.runTime * 2.2);
          ghostRef.current.scale.setScalar(1 + Math.sin(sim.runTime * 7.4) * 0.06);
        }
      }
    }

    const stage = stageById(sim.stageId);
    const stageVisual = stageVisualById(sim.stageId);
    const variantAccent = OCTA_TILE_VARIANT_ACCENT[snap.tileVariant];
    const speedRatio = clamp(sim.speed / GAME.maxSpeed, 0, 1);

    sceneBgRef.current.lerp(
      tempColorA.set(stageVisual.bg).lerp(tempColorB.set(variantAccent), 0.1),
      1 - Math.exp(-frameDelta * 2.8)
    );
    sceneFogRef.current.lerp(
      tempColorA.set(stageVisual.fog).lerp(tempColorB.set(variantAccent), 0.16),
      1 - Math.exp(-frameDelta * 2.8)
    );

    gl.setClearColor(sceneBgRef.current, 1);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(sceneFogRef.current);
    }

    const cameraMode = snap.cameraMode;
    const cam = camera as THREE.PerspectiveCamera;
    const shake = sim.dangerPulse * 0.03 + sim.audioReactive * 0.012;

    if (cameraMode === 'firstPerson') {
      cam.position.x = THREE.MathUtils.lerp(
        cam.position.x,
        Math.sin(sim.runTime * 9.6) * shake,
        1 - Math.exp(-frameDelta * 8)
      );
      cam.position.y = THREE.MathUtils.lerp(
        cam.position.y,
        Math.sin(GAME.playerAngle) * (GAME.radius - 0.58) + Math.cos(sim.runTime * 10.2) * shake,
        1 - Math.exp(-frameDelta * 8)
      );
      cam.position.z = THREE.MathUtils.lerp(cam.position.z, 2.1, 1 - Math.exp(-frameDelta * 8));
      cam.lookAt(0, Math.sin(GAME.playerAngle) * (GAME.radius - 0.58), -18 - speedRatio * 5);
      cam.fov = THREE.MathUtils.lerp(cam.fov, 78 + speedRatio * 4 + sim.flipPulse * 2.2, 1 - Math.exp(-frameDelta * 7));
    } else if (cameraMode === 'topDown') {
      cam.position.x = THREE.MathUtils.lerp(cam.position.x, Math.sin(sim.runTime * 4.2) * shake * 0.3, 1 - Math.exp(-frameDelta * 6));
      cam.position.y = THREE.MathUtils.lerp(cam.position.y, 14.2 + speedRatio * 1.9, 1 - Math.exp(-frameDelta * 6));
      cam.position.z = THREE.MathUtils.lerp(cam.position.z, 2.5, 1 - Math.exp(-frameDelta * 6));
      cam.lookAt(0, 0, -16);
      cam.fov = THREE.MathUtils.lerp(cam.fov, 52 + speedRatio * 2.6, 1 - Math.exp(-frameDelta * 6));
    } else {
      cam.position.x = THREE.MathUtils.lerp(
        cam.position.x,
        Math.sin(sim.rotation * 0.7) * 0.15 + Math.sin(sim.runTime * 7.4) * shake,
        1 - Math.exp(-frameDelta * 6)
      );
      cam.position.y = THREE.MathUtils.lerp(
        cam.position.y,
        -0.36 + Math.cos(sim.rotation * 0.52) * 0.05 + Math.cos(sim.runTime * 7.2) * shake * 0.7,
        1 - Math.exp(-frameDelta * 6)
      );
      cam.position.z = THREE.MathUtils.lerp(
        cam.position.z,
        10.4 - speedRatio * 0.8 - sim.flipPulse * 0.18,
        1 - Math.exp(-frameDelta * 6)
      );
      cam.lookAt(0, 0, -18 - speedRatio * 6.2);
      cam.fov = THREE.MathUtils.lerp(cam.fov, 60 + speedRatio * 4 + sim.flipPulse * 1.8, 1 - Math.exp(-frameDelta * 6));
    }

    cam.updateProjectionMatrix();

    const fxScale = snap.fxLevel === 'full' ? 1 : snap.fxLevel === 'medium' ? 0.76 : 0.54;
    if (bloomRef.current) {
      const targetBloom =
        (0.42 + sim.audioReactive * 0.72 + speedRatio * 0.28 + sim.flipPulse * 0.26 + sim.stageFlash * 0.2) * fxScale;
      bloomRef.current.intensity = THREE.MathUtils.lerp(
        bloomRef.current.intensity ?? targetBloom,
        targetBloom,
        1 - Math.exp(-frameDelta * 8)
      );
    }

    if (chromaRef.current && snap.fxLevel !== 'low') {
      const amount =
        (snap.fxLevel === 'full' ? 0.00022 : 0.00015) +
        sim.audioReactive * 0.001 +
        sim.dangerPulse * 0.0011 +
        sim.stageFlash * 0.0006;
      chromaOffset.set(amount, amount * 0.45);
      chromaRef.current.offset = chromaOffset;
    }

    if (vignetteRef.current) {
      const targetDark =
        (snap.fxLevel === 'full' ? 0.72 : snap.fxLevel === 'medium' ? 0.64 : 0.56) +
        sim.dangerPulse * 0.18;
      vignetteRef.current.darkness = THREE.MathUtils.lerp(
        vignetteRef.current.darkness ?? targetDark,
        targetDark,
        1 - Math.exp(-frameDelta * 8)
      );
    }

    updateInstances();

    const progress =
      snap.mode === 'endless' ? 0 : clamp(sim.score / Math.max(1, runGoal), 0, 1);
    octaSurgeState.syncFrame({
      score: Math.floor(sim.score),
      combo: sim.combo,
      multiplier: sim.multiplier,
      speed: sim.speed,
      time: sim.runTime,
      distance: sim.distance,
      progress,
      sides: sim.sides,
      stage: stage.id,
      stageLabel: stage.label,
      stageFlash: sim.stageFlash,
      slowMoMeter: sim.slowMoMeter,
      shardCount: sim.shardCount,
      hudPulse: Math.max(sim.flipPulse, sim.dangerPulse, sim.audioReactive * 0.4),
      audioReactive: sim.audioReactive,
      currentPlatform: sim.currentPlatform,
      currentObstacle: sim.currentObstacle,
    });

    clearFrameInput(inputRef);
  });

  const fxMultisample = snap.fxLevel === 'full' ? 2 : 0;

  return (
    <group>
      <ambientLight intensity={0.58} color="#cbeeff" />
      <directionalLight position={[8, 11, 6]} intensity={1.2} color="#f8fcff" />
      <pointLight position={[-6, 4, 5]} intensity={0.82} color="#8df1ff" />
      <pointLight position={[5, -4, 6]} intensity={0.66} color="#ffb684" />

      <Environment preset="city" background={false} />
      <Stars radius={220} depth={180} count={3200} factor={4.8} saturation={0} fade speed={0.68} />

      <group ref={worldRef}>
        <TunnelMesh
          ringCount={VISIBLE_RING_COUNT}
          spacing={RING_SPACING}
          getRing={getRing}
          baseRingRef={baseRingRef}
          scrollOffsetRef={scrollOffsetRef}
          speedRef={speedRef}
          audioReactiveRef={audioReactiveRef}
          comboRef={comboRef}
          stageFlashRef={stageFlashRef}
          tileVariantRef={tileVariantRef}
        />

        <instancedMesh
          ref={platformMeshRef}
          args={[undefined, undefined, platformCountMax]}
        >
          <primitive object={geometry.platformPulse} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            metalness={0.35}
            roughness={0.08}
            emissive={FIBER_COLORS.wire}
            emissiveIntensity={0.38}
          />
        </instancedMesh>

        <instancedMesh
          ref={obstacleBladeMeshRef}
          args={[undefined, undefined, obstacleCountMax]}
        >
          <primitive object={geometry.obstacleBlade} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            metalness={0.62}
            roughness={0.1}
            emissive={FIBER_COLORS.obstacle}
            emissiveIntensity={0.46}
          />
        </instancedMesh>

        <instancedMesh
          ref={obstacleGateMeshRef}
          args={[undefined, undefined, obstacleCountMax]}
        >
          <primitive object={geometry.obstacleGate} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            metalness={0.42}
            roughness={0.12}
            emissive={FIBER_COLORS.obstacleHot}
            emissiveIntensity={0.36}
          />
        </instancedMesh>

        <instancedMesh
          ref={obstacleCoreMeshRef}
          args={[undefined, undefined, obstacleCountMax]}
        >
          <primitive object={geometry.obstacleCore} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            metalness={0.22}
            roughness={0.06}
            emissive={FIBER_COLORS.accent}
            emissiveIntensity={0.48}
          />
        </instancedMesh>

        <instancedMesh
          ref={obstacleSpireMeshRef}
          args={[undefined, undefined, obstacleCountMax]}
        >
          <primitive object={geometry.obstacleSpire} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            metalness={0.54}
            roughness={0.14}
            emissive={FIBER_COLORS.obstacle}
            emissiveIntensity={0.42}
          />
        </instancedMesh>

        <instancedMesh ref={collectibleMeshRef} args={[undefined, undefined, collectibleCountMax]}>
          <primitive object={geometry.collectible} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            metalness={0.35}
            roughness={0.06}
            emissive={FIBER_COLORS.wire}
            emissiveIntensity={0.64}
          />
        </instancedMesh>
      </group>

      <group ref={playerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={geometry.playerCore} attach="geometry" />
          <meshStandardMaterial
            color={FIBER_COLORS.player}
            roughness={0.06}
            metalness={0.32}
            emissive={FIBER_COLORS.playerGlow}
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={geometry.playerHalo} attach="geometry" />
          <meshBasicMaterial
            color={FIBER_COLORS.playerGlow}
            transparent
            opacity={0.28}
            toneMapped={false}
          />
        </mesh>
      </group>

      <group ref={ghostRef} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={geometry.ghostCore} attach="geometry" />
          <meshBasicMaterial
            color="#8beeff"
            transparent
            opacity={0.44}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={geometry.ghostRing} attach="geometry" />
          <meshBasicMaterial
            color="#d4f7ff"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      <EffectComposer multisampling={fxMultisample} enableNormalPass={false}>
        <Bloom
          ref={bloomRef}
          intensity={snap.fxLevel === 'full' ? 0.8 : snap.fxLevel === 'medium' ? 0.56 : 0.34}
          luminanceThreshold={0.08}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
        <ChromaticAberration
          ref={chromaRef}
          offset={snap.fxLevel === 'low' ? zeroOffset : chromaOffset}
          radialModulation
          modulationOffset={0.52}
        />
        <Glitch
          active={snap.phase === 'playing' && snap.hudPulse > 0.48}
          delay={glitchDelay}
          duration={glitchDuration}
          strength={glitchStrength}
          ratio={0.66}
        />
        <Vignette
          ref={vignetteRef}
          eskil={false}
          offset={0.12}
          darkness={snap.fxLevel === 'full' ? 0.72 : 0.64}
        />
        <Noise
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={snap.fxLevel === 'full' ? 0.08 : snap.fxLevel === 'medium' ? 0.05 : 0.025}
        />
      </EffectComposer>
    </group>
  );
}
