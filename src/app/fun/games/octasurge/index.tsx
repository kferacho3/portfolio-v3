'use client';

import { Environment, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { GAME } from './constants';
import { generateRing } from './generator';
import { OctaSurgeUI } from './_components/OctaSurgeUI';
import { octaSurgeState } from './state';
import type {
  CollectionFx,
  CollectibleType,
  OctaSurgeMode,
  RingData,
} from './types';
import { useKeyboardControls } from './useKeyboardControls';
import { useSwipeControls } from './useSwipeControls';

export { octaSurgeState } from './state';
export * from './types';
export * from './constants';

type InputStep = -1 | 1 | 4;

type RuntimeFx = {
  active: boolean;
  lane: number;
  z: number;
  age: number;
  life: number;
  intensity: number;
  type: CollectionFx['type'];
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const normalizeLane = (lane: number) => {
  let out = lane % GAME.faces;
  if (out < 0) out += GAME.faces;
  return out;
};

const laneBit = (lane: number) => 1 << normalizeLane(lane);

const laneDistance = (a: number, b: number) => {
  const d = Math.abs(normalizeLane(a) - normalizeLane(b));
  return Math.min(d, GAME.faces - d);
};

const lanePos = (lane: number, radius: number): [number, number] => {
  const angle = lane * GAME.faceStep;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
};

const dampAngle = (from: number, to: number, lambda: number, dt: number) => {
  const delta =
    ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + delta * (1 - Math.exp(-lambda * dt));
};

const ALL_MASK = (1 << GAME.faces) - 1;

const COLLECTION_COLOR: Record<CollectibleType | CollectionFx['type'], string> = {
  gem: '#facc15',
  boost: '#22d3ee',
  shield: '#a78bfa',
  magnet: '#34d399',
  prism: '#f472b6',
  phase: '#60a5fa',
  impact: '#fb7185',
  near: '#67e8f9',
  pad: '#2dd4bf',
  'phase-burst': '#93c5fd',
  combo: '#fde68a',
};

const motifHueOffset = (motif: RingData['motif']) => {
  if (motif === 'bump-corridor') return 0.02;
  if (motif === 'crusher-gate') return 0.08;
  if (motif === 'flip-gate') return 0.13;
  if (motif === 'speed-run') return -0.06;
  if (motif === 'alternating') return 0.17;
  return 0;
};

type InputControllerProps = {
  canStart: boolean;
  canRotate: boolean;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onFlip: () => void;
  onTapFallback: () => void;
  onStart: () => void;
};

const InputController: React.FC<InputControllerProps> = ({
  canStart,
  canRotate,
  onRotateLeft,
  onRotateRight,
  onFlip,
  onTapFallback,
  onStart,
}) => {
  useKeyboardControls({
    enabled: true,
    onLeft: () => {
      if (!canRotate) return;
      onRotateLeft();
    },
    onRight: () => {
      if (!canRotate) return;
      onRotateRight();
    },
    onFlip: () => {
      if (!canRotate) return;
      onFlip();
    },
    onTapFallback: () => {
      if (!canRotate) return;
      onTapFallback();
    },
    onStart: () => {
      if (!canStart) return;
      onStart();
    },
  });

  useSwipeControls({
    enabled: canRotate,
    onLeft: onRotateLeft,
    onRight: onRotateRight,
    onUp: onFlip,
  });

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (canStart) {
        onStart();
        return;
      }
      if (canRotate && event.pointerType !== 'touch') {
        onTapFallback();
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [canRotate, canStart, onStart, onTapFallback]);

  return null;
};

export default function OctaSurge() {
  const snap = useSnapshot(octaSurgeState);
  const { paused, restartSeed } = useGameUIState();
  const { camera, gl, scene } = useThree();

  const input = useInputRef({
    preventDefault: [
      ' ',
      'space',
      'spacebar',
      'arrowleft',
      'arrowright',
      'arrowup',
      'a',
      'd',
      'w',
    ],
  });

  const worldRef = useRef<THREE.Group>(null);
  const playerRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  const tileRef = useRef<THREE.InstancedMesh>(null);
  const bumpRef = useRef<THREE.InstancedMesh>(null);
  const crusherRef = useRef<THREE.InstancedMesh>(null);
  const speedPadRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);

  const gemRef = useRef<THREE.InstancedMesh>(null);
  const boostRef = useRef<THREE.InstancedMesh>(null);
  const shieldRef = useRef<THREE.InstancedMesh>(null);
  const magnetRef = useRef<THREE.InstancedMesh>(null);
  const prismRef = useRef<THREE.InstancedMesh>(null);
  const phaseRef = useRef<THREE.InstancedMesh>(null);
  const fxRef = useRef<THREE.InstancedMesh>(null);

  const bloomRef = useRef<any>(null);
  const chromaRef = useRef<any>(null);
  const vignetteRef = useRef<any>(null);

  const chromaOffset = useMemo(() => new THREE.Vector2(0.0007, 0.0003), []);
  const zeroOffset = useMemo(() => new THREE.Vector2(0, 0), []);

  const laneChord = useMemo(
    () => 2 * GAME.radius * Math.tan(Math.PI / GAME.faces),
    []
  );

  const geom = useMemo(
    () => ({
      tile: new THREE.BoxGeometry(
        laneChord * 0.95,
        GAME.tileThickness,
        GAME.ringDepth
      ),
      bump: new THREE.BoxGeometry(
        laneChord * 0.7,
        GAME.bumpHeight,
        GAME.ringDepth * 0.64
      ),
      crusher: new THREE.ConeGeometry(laneChord * 0.34, GAME.crusherHeight, 5),
      speedPad: new THREE.BoxGeometry(
        laneChord * 0.82,
        GAME.speedPadHeight,
        GAME.ringDepth * 0.7
      ),
      ring: new THREE.TorusGeometry(
        GAME.radius + 0.04,
        0.03,
        6,
        GAME.faces * 2
      ),
      gem: new THREE.OctahedronGeometry(0.2, 0),
      boost: new THREE.IcosahedronGeometry(0.22, 0),
      shield: new THREE.DodecahedronGeometry(0.22, 0),
      magnet: new THREE.TorusKnotGeometry(0.14, 0.055, 64, 10, 2, 3),
      prism: new THREE.CylinderGeometry(0.08, 0.12, 0.34, 6),
      phase: new THREE.SphereGeometry(0.18, 12, 12),
      fx: new THREE.IcosahedronGeometry(0.16, 0),
      player: new THREE.IcosahedronGeometry(0.29, 1),
      playerAura: new THREE.TorusGeometry(0.41, 0.06, 12, 36),
      pulseRing: new THREE.TorusGeometry(GAME.radius + 1.15, 0.09, 10, 64),
    }),
    [laneChord]
  );

  const runtime = useRef({
    rings: [] as RingData[],
    ringByIndex: new Map<number, number>(),
    worldSeed: 0,
    nextRingIndex: 0,
    farthestBackZ: 0,
    lastSafeLane: GAME.bottomFace,

    elapsed: 0,
    scroll: 0,
    prevScroll: 0,
    score: 0,
    speed: GAME.baseSpeed,
    combo: 0,
    comboTimer: 0,

    surge: 100,
    boostUntil: 0,
    speedPadUntil: 0,
    shieldCharges: 0,
    magnetUntil: 0,
    prismUntil: 0,
    phaseUntil: 0,

    logicalLane: GAME.bottomFace,
    targetRotation: 0,
    worldRotation: 0,
    lastDirection: 1 as 1 | -1,
    inputCooldownUntilMs: 0,
    lastFlipAtMs: 0,
    bufferedInput: null as { step: InputStep; expiresMs: number } | null,

    pulseClock: 0,
    shake: 0,
    fxCursor: 0,
    effects: Array.from({ length: GAME.fxPool }, () => ({
      active: false,
      lane: 0,
      z: 0,
      age: 0,
      life: 0,
      intensity: 1,
      type: 'near' as CollectionFx['type'],
    })) as RuntimeFx[],
  });

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const tileInstances = GAME.ringBuffer * GAME.faces;
  const bumpInstances = GAME.ringBuffer * GAME.faces;

  const hideInstance = useCallback(
    (mesh: THREE.InstancedMesh | null, id: number) => {
      if (!mesh) return;
      dummy.position.set(0, -9999, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.0001, 0.0001, 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(id, dummy.matrix);
    },
    [dummy]
  );

  const setCollectibleInSlot = useCallback(
    (
      ring: RingData,
      mesh: THREE.InstancedMesh | null,
      ringColor: THREE.ColorRepresentation,
      rotJitter = 0
    ) => {
      if (!mesh || ring.collectibleLane == null || ring.collected) return;
      const [cx, cy] = lanePos(ring.collectibleLane, GAME.radius - 0.58);
      dummy.position.set(cx, cy, ring.z);
      dummy.rotation.set(
        0.24,
        0.12 + rotJitter,
        ring.collectibleLane * GAME.faceStep * 0.55
      );
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(ring.slot, dummy.matrix);
      mesh.setColorAt(ring.slot, color.set(ringColor));
    },
    [color, dummy]
  );

  const syncRingInstances = useCallback(
    (ring: RingData) => {
      const tile = tileRef.current;
      const bump = bumpRef.current;
      const crusher = crusherRef.current;
      const speedPad = speedPadRef.current;
      const ringMesh = ringRef.current;

      const gem = gemRef.current;
      const boost = boostRef.current;
      const shield = shieldRef.current;
      const magnet = magnetRef.current;
      const prism = prismRef.current;
      const phase = phaseRef.current;

      if (
        !tile ||
        !bump ||
        !crusher ||
        !speedPad ||
        !ringMesh ||
        !gem ||
        !boost ||
        !shield ||
        !magnet ||
        !prism ||
        !phase
      ) {
        return;
      }

      for (let lane = 0; lane < GAME.faces; lane += 1) {
        const tileId = ring.slot * GAME.faces + lane;
        const bumpId = tileId;
        const [x, y] = lanePos(lane, GAME.radius);
        const angle = lane * GAME.faceStep + Math.PI / 2;
        const bit = laneBit(lane);

        if ((ring.solidMask & bit) !== 0) {
          dummy.position.set(x, y, ring.z);
          dummy.rotation.set(0, 0, angle);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          tile.setMatrixAt(tileId, dummy.matrix);

          color.setHSL(
            (0.57 + motifHueOffset(ring.motif) + ring.theme * 0.07 + lane * 0.011) %
              1,
            0.58,
            0.52 + ((ring.index + lane) % 2) * 0.04
          );
          tile.setColorAt(tileId, color);
        } else {
          hideInstance(tile, tileId);
        }

        if ((ring.bumpMask & bit) !== 0) {
          const [bx, by] = lanePos(lane, GAME.radius - GAME.bumpHeight * 0.43);
          dummy.position.set(bx, by, ring.z);
          dummy.rotation.set(0, 0, angle);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          bump.setMatrixAt(bumpId, dummy.matrix);
          color.setHSL((0.02 + lane * 0.03 + ring.theme * 0.05) % 1, 0.8, 0.52);
          bump.setColorAt(bumpId, color);
        } else {
          hideInstance(bump, bumpId);
        }

        if ((ring.crusherMask & bit) !== 0) {
          const [hx, hy] = lanePos(
            lane,
            GAME.radius - GAME.crusherHeight * 0.46
          );
          dummy.position.set(hx, hy, ring.z);
          dummy.rotation.set(Math.PI / 2, 0, angle + Math.PI);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          crusher.setMatrixAt(bumpId, dummy.matrix);
          color.setHSL((0.96 + lane * 0.01) % 1, 0.84, 0.58);
          crusher.setColorAt(bumpId, color);
        } else {
          hideInstance(crusher, bumpId);
        }

        if ((ring.speedMask & bit) !== 0) {
          const [sx, sy] = lanePos(lane, GAME.radius - 0.05);
          dummy.position.set(sx, sy, ring.z - GAME.ringDepth * 0.04);
          dummy.rotation.set(0, 0, angle);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          speedPad.setMatrixAt(bumpId, dummy.matrix);
          color.setHSL((0.48 + lane * 0.015 + ring.theme * 0.04) % 1, 0.82, 0.62);
          speedPad.setColorAt(bumpId, color);
        } else {
          hideInstance(speedPad, bumpId);
        }
      }

      dummy.position.set(0, 0, ring.z);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ringMesh.setMatrixAt(ring.slot, dummy.matrix);
      color.setHSL((0.55 + ring.theme * 0.09 + motifHueOffset(ring.motif)) % 1, 0.7, 0.64);
      ringMesh.setColorAt(ring.slot, color);

      hideInstance(gem, ring.slot);
      hideInstance(boost, ring.slot);
      hideInstance(shield, ring.slot);
      hideInstance(magnet, ring.slot);
      hideInstance(prism, ring.slot);
      hideInstance(phase, ring.slot);

      if (
        ring.collectibleLane != null &&
        ring.collectibleType &&
        !ring.collected
      ) {
        if (ring.collectibleType === 'gem') {
          setCollectibleInSlot(ring, gem, COLLECTION_COLOR.gem, 0.02);
        } else if (ring.collectibleType === 'boost') {
          setCollectibleInSlot(ring, boost, COLLECTION_COLOR.boost, 0.03);
        } else if (ring.collectibleType === 'shield') {
          setCollectibleInSlot(ring, shield, COLLECTION_COLOR.shield, 0.03);
        } else if (ring.collectibleType === 'magnet') {
          setCollectibleInSlot(ring, magnet, COLLECTION_COLOR.magnet, 0.05);
        } else if (ring.collectibleType === 'prism') {
          setCollectibleInSlot(ring, prism, COLLECTION_COLOR.prism, 0.06);
        } else if (ring.collectibleType === 'phase') {
          setCollectibleInSlot(ring, phase, COLLECTION_COLOR.phase, 0.04);
        }
      }
    },
    [color, dummy, hideInstance, setCollectibleInSlot]
  );

  const syncFxInstances = useCallback(() => {
    const fx = fxRef.current;
    if (!fx) return;
    const r = runtime.current;

    for (let i = 0; i < r.effects.length; i += 1) {
      const effect = r.effects[i];
      if (!effect.active) {
        hideInstance(fx, i);
        continue;
      }
      const t = effect.age / effect.life;
      const [x, y] = lanePos(effect.lane, GAME.radius - 0.5 - t * 0.34);
      const jitter = Math.sin((effect.age + i * 0.17) * 21) * 0.06;
      const scale = (0.32 + t * 1.05) * effect.intensity;

      dummy.position.set(x + jitter, y - jitter * 0.6, effect.z + effect.age * 3.2);
      dummy.rotation.set(effect.age * 7.2, effect.age * 6.1, effect.age * 5.8);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      fx.setMatrixAt(i, dummy.matrix);
      color.set(COLLECTION_COLOR[effect.type]);
      fx.setColorAt(i, color);
    }
  }, [color, dummy, hideInstance]);

  const flushInstanceChanges = useCallback(() => {
    const meshes = [
      tileRef.current,
      bumpRef.current,
      crusherRef.current,
      speedPadRef.current,
      ringRef.current,
      gemRef.current,
      boostRef.current,
      shieldRef.current,
      magnetRef.current,
      prismRef.current,
      phaseRef.current,
      fxRef.current,
    ];
    meshes.forEach((mesh) => {
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, []);

  const spawnFx = useCallback(
    (
      type: CollectionFx['type'],
      lane: number,
      z: number,
      life = GAME.fxLife,
      intensity = 1
    ) => {
      const r = runtime.current;
      const slot = r.fxCursor % r.effects.length;
      r.fxCursor += 1;
      r.effects[slot] = {
        active: true,
        lane: normalizeLane(lane),
        z,
        age: 0,
        life,
        intensity,
        type,
      };
    },
    []
  );

  const getRingByIndex = useCallback((absIndex: number): RingData | null => {
    const r = runtime.current;
    const slot = r.ringByIndex.get(absIndex);
    if (slot == null) return null;
    const ring = r.rings[slot];
    if (!ring || ring.index !== absIndex) return null;
    return ring;
  }, []);

  const generateIntoSlot = useCallback(
    (slot: number, index: number, z: number) => {
      const r = runtime.current;
      const existing = r.rings[slot];
      if (existing) {
        r.ringByIndex.delete(existing.index);
      }

      const ring = generateRing({
        seed: r.worldSeed,
        slot,
        index,
        z,
        previousSafeLane: r.lastSafeLane,
      });

      r.lastSafeLane = ring.safeLane;
      r.rings[slot] = ring;
      r.ringByIndex.set(index, slot);
      syncRingInstances(ring);
    },
    [syncRingInstances]
  );

  const resetWorld = useCallback(() => {
    const r = runtime.current;

    r.worldSeed = octaSurgeState.worldSeed;
    r.nextRingIndex = GAME.ringBuffer;
    r.lastSafeLane = GAME.bottomFace;
    r.ringByIndex.clear();

    r.elapsed = 0;
    r.scroll = 0;
    r.prevScroll = 0;
    r.score = 0;
    r.speed = GAME.baseSpeed;
    r.combo = 0;
    r.comboTimer = 0;

    r.surge = 100;
    r.boostUntil = 0;
    r.speedPadUntil = 0;
    r.shieldCharges = 0;
    r.magnetUntil = 0;
    r.prismUntil = 0;
    r.phaseUntil = 0;

    r.logicalLane = GAME.bottomFace;
    r.targetRotation = 0;
    r.worldRotation = 0;
    r.lastDirection = 1;
    r.inputCooldownUntilMs = 0;
    r.lastFlipAtMs = 0;
    r.bufferedInput = null;

    r.pulseClock = 0;
    r.shake = 0;
    r.fxCursor = 0;
    r.effects.forEach((effect) => {
      effect.active = false;
      effect.age = 0;
      effect.life = 0;
      effect.intensity = 0;
    });

    r.rings = [];
    r.farthestBackZ =
      GAME.spawnStartZ - (GAME.ringBuffer - 1) * GAME.ringSpacing;

    for (let slot = 0; slot < GAME.ringBuffer; slot += 1) {
      const index = slot;
      const z = GAME.spawnStartZ - slot * GAME.ringSpacing;
      generateIntoSlot(slot, index, z);
    }

    if (worldRef.current) {
      worldRef.current.position.set(0, 0, 0);
      worldRef.current.rotation.set(0, 0, 0);
    }

    octaSurgeState.score = 0;
    octaSurgeState.combo = 0;
    octaSurgeState.progress = 0;
    octaSurgeState.time = 0;
    octaSurgeState.speed = GAME.baseSpeed;
    octaSurgeState.surgeMeter = 100;
    octaSurgeState.shieldCharges = 0;
    octaSurgeState.boostActive = false;
    octaSurgeState.magnetActive = false;
    octaSurgeState.prismActive = false;
    octaSurgeState.phaseActive = false;
    octaSurgeState.speedPadActive = false;
    octaSurgeState.dangerPulse = 0;

    syncFxInstances();
    flushInstanceChanges();
  }, [flushInstanceChanges, generateIntoSlot, syncFxInstances]);

  const applyLaneStep = useCallback((step: InputStep, nowMs: number) => {
    const r = runtime.current;
    if (step === 4) {
      if (nowMs - r.lastFlipAtMs < GAME.laneFlipCooldownMs) return;
      r.logicalLane = normalizeLane(r.logicalLane + 4);
      r.lastFlipAtMs = nowMs;
      r.lastDirection *= -1;
    } else {
      r.logicalLane = normalizeLane(r.logicalLane + step);
      r.lastDirection = step > 0 ? 1 : -1;
    }

    r.targetRotation = (GAME.bottomFace - r.logicalLane) * GAME.faceStep;
    r.inputCooldownUntilMs = nowMs + 56;
  }, []);

  const enqueueLaneStep = useCallback(
    (step: InputStep) => {
      if (octaSurgeState.phase !== 'playing' || paused) return;
      const r = runtime.current;
      const nowMs = performance.now();

      if (nowMs < r.inputCooldownUntilMs) {
        r.bufferedInput = {
          step,
          expiresMs: nowMs + GAME.inputBufferMs,
        };
        return;
      }

      applyLaneStep(step, nowMs);
    },
    [applyLaneStep, paused]
  );

  const rotateLeft = useCallback(() => {
    enqueueLaneStep(-1);
  }, [enqueueLaneStep]);

  const rotateRight = useCallback(() => {
    enqueueLaneStep(1);
  }, [enqueueLaneStep]);

  const flipLane = useCallback(() => {
    enqueueLaneStep(4);
  }, [enqueueLaneStep]);

  const rotateFallback = useCallback(() => {
    enqueueLaneStep(runtime.current.lastDirection);
  }, [enqueueLaneStep]);

  const startRun = useCallback(() => {
    octaSurgeState.start();
  }, []);

  useEffect(() => {
    octaSurgeState.load();

    gl.domElement.style.touchAction = 'none';
    scene.background = new THREE.Color('#040818');
    scene.fog = new THREE.Fog('#040818', 9, 88);

    camera.position.set(0, -0.54, GAME.cameraBaseZ);
    camera.lookAt(0, 0, -18);

    return () => {
      gl.domElement.style.touchAction = '';
    };
  }, [camera, gl.domElement, scene]);

  useEffect(() => {
    if (!restartSeed) return;
    octaSurgeState.start();
  }, [restartSeed]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;
    resetWorld();
  }, [resetWorld, snap.phase, snap.worldSeed]);

  useEffect(() => {
    if (paused && snap.phase === 'playing') {
      octaSurgeState.boostActive = false;
      octaSurgeState.speedPadActive = false;
    }
  }, [paused, snap.phase]);

  useFrame((state, dt) => {
    const r = runtime.current;
    const realDt = clamp(dt, 0.001, 0.033);
    const nowMs = state.clock.elapsedTime * 1000;

    if (r.bufferedInput && nowMs >= r.inputCooldownUntilMs) {
      if (nowMs <= r.bufferedInput.expiresMs) {
        applyLaneStep(r.bufferedInput.step, nowMs);
      }
      r.bufferedInput = null;
    } else if (r.bufferedInput && nowMs > r.bufferedInput.expiresMs) {
      r.bufferedInput = null;
    }

    r.worldRotation = dampAngle(
      r.worldRotation,
      r.targetRotation,
      GAME.rotationResponse,
      realDt
    );
    if (worldRef.current) worldRef.current.rotation.z = r.worldRotation;

    if (snap.phase !== 'playing' || paused) {
      clearFrameInput(input);
      return;
    }

    const isTimed = snap.mode !== 'endless';
    const runSeconds =
      snap.mode === 'daily' ? GAME.dailyRunSeconds : GAME.classicRunSeconds;

    const spaceHeld =
      input.current.keysDown.has(' ') ||
      input.current.keysDown.has('space') ||
      input.current.keysDown.has('spacebar');

    r.prevScroll = r.scroll;
    r.elapsed += realDt;
    r.pulseClock += realDt;

    let simScale = 1;
    if (spaceHeld && r.surge > 0.1) {
      simScale = GAME.surgeSlowScale;
      r.surge = Math.max(0, r.surge - GAME.surgeDrainRate * realDt);
    }

    const boostActive = r.elapsed < r.boostUntil;
    const speedPadActive = r.elapsed < r.speedPadUntil;
    const magnetActive = r.elapsed < r.magnetUntil;
    const prismActive = r.elapsed < r.prismUntil;
    const phaseActive = r.elapsed < r.phaseUntil;

    r.surge = clamp(
      r.surge +
        GAME.surgeRechargeRate * realDt +
        (boostActive ? GAME.surgeBoostRecharge * realDt : 0),
      0,
      100
    );

    const delta = realDt * simScale;
    const baseSpeed =
      GAME.baseSpeed +
      r.elapsed * GAME.speedRampPerSecond +
      r.score * GAME.speedRampFromScore;
    let speed = clamp(baseSpeed, GAME.baseSpeed, GAME.maxSpeed);
    if (boostActive) speed *= GAME.boostMultiplier;
    if (speedPadActive) speed *= GAME.speedPadMultiplier;
    if (phaseActive) speed *= 1.04;
    r.speed = speed;

    r.scroll += r.speed * delta;
    if (worldRef.current) worldRef.current.position.z = r.scroll;

    r.comboTimer = Math.max(0, r.comboTimer - realDt);
    if (r.comboTimer <= 0) r.combo = 0;

    let shouldEnd = false;

    const prevCross = Math.floor(
      (r.prevScroll + GAME.spawnStartZ - GAME.playerPlaneZ) / GAME.ringSpacing
    );
    const nextCross = Math.floor(
      (r.scroll + GAME.spawnStartZ - GAME.playerPlaneZ) / GAME.ringSpacing
    );

    for (let absRing = prevCross + 1; absRing <= nextCross; absRing += 1) {
      const ring = getRingByIndex(absRing);
      if (!ring) continue;

      ring.crossed = true;
      const lane = r.logicalLane;
      const bit = laneBit(lane);
      const obstacleMask = ring.bumpMask | ring.crusherMask;
      const hitHole = (ring.solidMask & bit) === 0;
      const hitObstacle = (obstacleMask & bit) !== 0;
      const hitCrusher = (ring.crusherMask & bit) !== 0;

      if (hitHole || hitObstacle) {
        r.combo = 0;
        r.comboTimer = 0;

        if (phaseActive) {
          r.score += 5;
          r.shake = Math.max(r.shake, hitCrusher ? 0.1 : 0.08);
          spawnFx('phase-burst', lane, ring.z, 0.52, hitCrusher ? 1.2 : 1);
          continue;
        }

        if (r.shieldCharges > 0) {
          r.shieldCharges -= 1;
          r.shake = Math.max(r.shake, hitCrusher ? 0.2 : 0.12);
          spawnFx('shield', lane, ring.z, 0.58, hitCrusher ? 1.4 : 1.1);
          continue;
        }

        r.shake = Math.max(r.shake, hitCrusher ? 0.26 : 0.22);
        spawnFx('impact', lane, ring.z, 0.74, hitCrusher ? 1.4 : 1.2);
        shouldEnd = true;
        break;
      }

      r.combo += 1;
      r.comboTimer = GAME.comboWindow;
      let comboMult = 1 + Math.max(0, Math.min(14, r.combo - 1)) * GAME.comboStep;
      if (prismActive) comboMult *= GAME.prismMultiplier;
      r.score += GAME.clearScore * comboMult;

      const nearMask = laneBit(lane - 1) | laneBit(lane + 1);
      const holeMask = (~ring.solidMask & ALL_MASK) & nearMask;
      const obstacleNear = (obstacleMask & nearMask) !== 0;
      if (obstacleNear || holeMask !== 0) {
        r.score += GAME.nearMissScore * (prismActive ? 1.16 : 1);
        octaSurgeState.addNearMiss();
        spawnFx('near', lane, ring.z, 0.48, 0.95 + r.combo * 0.02);
        r.shake = Math.max(r.shake, 0.055);
      }

      if ((ring.speedMask & bit) !== 0) {
        r.speedPadUntil = Math.max(r.speedPadUntil, r.elapsed + GAME.speedPadDuration);
        r.score += GAME.speedPadScore * comboMult;
        spawnFx('pad', lane, ring.z, 0.5, 1.15);
      }

      if (
        ring.collectibleLane != null &&
        ring.collectibleType &&
        !ring.collected
      ) {
        let collect = ring.collectibleLane === lane;
        if (!collect && magnetActive) {
          collect =
            laneDistance(lane, ring.collectibleLane) <= GAME.magnetLaneReach;
        }

        if (collect) {
          ring.collected = true;
          const type = ring.collectibleType;
          octaSurgeState.addCollect(type);

          if (type === 'gem') {
            r.score += GAME.gemScore * comboMult;
            r.surge = clamp(r.surge + 12, 0, 100);
          } else if (type === 'boost') {
            r.score += GAME.boostScore * comboMult;
            r.boostUntil = Math.max(r.boostUntil, r.elapsed + GAME.boostDuration);
          } else if (type === 'shield') {
            r.score += GAME.shieldScore * comboMult;
            r.shieldCharges = Math.min(GAME.shieldMaxCharges, r.shieldCharges + 1);
          } else if (type === 'magnet') {
            r.score += GAME.magnetScore * comboMult;
            r.magnetUntil = Math.max(r.magnetUntil, r.elapsed + GAME.magnetDuration);
          } else if (type === 'prism') {
            r.score += GAME.prismScore * comboMult;
            r.prismUntil = Math.max(r.prismUntil, r.elapsed + GAME.prismDuration);
          } else if (type === 'phase') {
            r.score += GAME.phaseScore * comboMult;
            r.phaseUntil = Math.max(r.phaseUntil, r.elapsed + GAME.phaseDuration);
          }

          spawnFx(type, lane, ring.z, 0.62, 1.06);
          syncRingInstances(ring);
        }
      }

      if (r.combo > 0 && r.combo % 12 === 0) {
        spawnFx('combo', lane, ring.z, 0.68, 1.24);
      }
    }

    for (let slot = 0; slot < r.rings.length; slot += 1) {
      const ring = r.rings[slot];
      if (!ring) continue;
      if (ring.z + r.scroll <= GAME.despawnWorldZ) continue;

      const nextIndex = r.nextRingIndex;
      const nextZ = r.farthestBackZ - GAME.ringSpacing;
      r.nextRingIndex += 1;
      r.farthestBackZ = nextZ;
      generateIntoSlot(ring.slot, nextIndex, nextZ);
    }

    for (let i = 0; i < r.effects.length; i += 1) {
      const effect = r.effects[i];
      if (!effect.active) continue;
      effect.age += realDt;
      if (effect.age >= effect.life) effect.active = false;
    }

    syncFxInstances();
    flushInstanceChanges();

    const activeBoost = r.elapsed < r.boostUntil;
    const activePad = r.elapsed < r.speedPadUntil;
    const activeMagnet = r.elapsed < r.magnetUntil;
    const activePrism = r.elapsed < r.prismUntil;
    const activePhase = r.elapsed < r.phaseUntil;

    if (shouldEnd) {
      octaSurgeState.score = Math.floor(r.score);
      octaSurgeState.combo = r.combo;
      octaSurgeState.shieldCharges = r.shieldCharges;
      octaSurgeState.surgeMeter = r.surge;
      octaSurgeState.boostActive = false;
      octaSurgeState.speedPadActive = false;
      octaSurgeState.magnetActive = false;
      octaSurgeState.prismActive = false;
      octaSurgeState.phaseActive = false;
      octaSurgeState.progress = isTimed
        ? clamp(r.elapsed / runSeconds, 0, 1)
        : 0;
      octaSurgeState.time = r.elapsed;
      octaSurgeState.speed = r.speed;
      octaSurgeState.dangerPulse = 1;
      octaSurgeState.end();
      clearFrameInput(input);
      return;
    }

    if (isTimed && r.elapsed >= runSeconds) {
      octaSurgeState.score = Math.floor(r.score);
      octaSurgeState.combo = r.combo;
      octaSurgeState.shieldCharges = r.shieldCharges;
      octaSurgeState.surgeMeter = r.surge;
      octaSurgeState.boostActive = false;
      octaSurgeState.speedPadActive = false;
      octaSurgeState.magnetActive = false;
      octaSurgeState.prismActive = false;
      octaSurgeState.phaseActive = false;
      octaSurgeState.progress = 1;
      octaSurgeState.time = r.elapsed;
      octaSurgeState.speed = r.speed;
      octaSurgeState.dangerPulse = 0;
      octaSurgeState.end();
      clearFrameInput(input);
      return;
    }

    octaSurgeState.score = Math.floor(r.score);
    octaSurgeState.combo = r.combo;
    octaSurgeState.shieldCharges = r.shieldCharges;
    octaSurgeState.surgeMeter = r.surge;
    octaSurgeState.boostActive = activeBoost;
    octaSurgeState.speedPadActive = activePad;
    octaSurgeState.magnetActive = activeMagnet;
    octaSurgeState.prismActive = activePrism;
    octaSurgeState.phaseActive = activePhase;
    octaSurgeState.progress = isTimed ? clamp(r.elapsed / runSeconds, 0, 1) : 0;
    octaSurgeState.time = r.elapsed;
    octaSurgeState.speed = r.speed;
    octaSurgeState.dangerPulse = clamp(r.shake * 4.2, 0, 1);

    r.shake = Math.max(0, r.shake - realDt * 2.1);

    const speedRatio = clamp(r.speed / GAME.maxSpeed, 0, 1);
    const targetFov =
      GAME.cameraBaseFov +
      speedRatio * GAME.cameraMaxFovBoost +
      (activeBoost ? 2.8 : 0) +
      (activePad ? 1.6 : 0);

    const cameraShakeX = Math.sin(state.clock.elapsedTime * 35) * r.shake * 0.52;
    const cameraShakeY = Math.cos(state.clock.elapsedTime * 28) * r.shake * 0.38;

    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = THREE.MathUtils.lerp(
      cam.fov,
      targetFov,
      1 - Math.exp(-realDt * 8)
    );
    cam.position.x = THREE.MathUtils.lerp(
      cam.position.x,
      cameraShakeX + Math.sin(r.worldRotation * 0.46) * 0.24,
      1 - Math.exp(-realDt * 10)
    );
    cam.position.y = THREE.MathUtils.lerp(
      cam.position.y,
      -0.5 + cameraShakeY,
      1 - Math.exp(-realDt * 10)
    );
    cam.position.z = THREE.MathUtils.lerp(
      cam.position.z,
      GAME.cameraBaseZ - speedRatio * GAME.cameraSpeedZoom - (activeBoost ? 0.18 : 0),
      1 - Math.exp(-realDt * 10)
    );
    cam.lookAt(0, 0, -GAME.cameraLookAhead - speedRatio * 8);
    cam.updateProjectionMatrix();

    if (playerRef.current) {
      const pulse =
        1 +
        Math.sin(state.clock.elapsedTime * 10.5) * 0.03 +
        (activeBoost ? 0.07 : 0) +
        (activePhase ? 0.05 : 0);
      playerRef.current.scale.setScalar(pulse);
      playerRef.current.rotation.y = r.worldRotation * 0.2;
    }

    if (auraRef.current) {
      const auraMat = auraRef.current.material as THREE.MeshBasicMaterial;
      const targetOpacity =
        0.2 + (activeBoost ? 0.12 : 0) + (activePrism ? 0.08 : 0) + (activePhase ? 0.1 : 0);
      auraMat.opacity = THREE.MathUtils.lerp(
        auraMat.opacity,
        targetOpacity,
        1 - Math.exp(-realDt * 8)
      );
      auraMat.color.set(
        activePhase ? '#93c5fd' : activePrism ? '#f472b6' : '#67e8f9'
      );
    }

    if (bloomRef.current) {
      const tierScalar =
        snap.fxLevel === 'full' ? 1 : snap.fxLevel === 'medium' ? 0.76 : 0.52;
      const bloomTarget =
        (0.34 + speedRatio * 0.52 + (activeBoost ? 0.2 : 0) + (activePad ? 0.12 : 0)) *
        tierScalar;
      bloomRef.current.intensity = THREE.MathUtils.lerp(
        bloomRef.current.intensity ?? bloomTarget,
        bloomTarget,
        1 - Math.exp(-realDt * 6)
      );
    }

    if (chromaRef.current && snap.fxLevel !== 'low') {
      const amt =
        (snap.fxLevel === 'full' ? 0.00035 : 0.0002) +
        speedRatio * 0.0011 +
        r.shake * 0.0013;
      chromaOffset.set(amt, amt * 0.42);
      chromaRef.current.offset = chromaOffset;
    }

    if (vignetteRef.current) {
      const targetDarkness =
        (snap.fxLevel === 'full' ? 0.64 : snap.fxLevel === 'medium' ? 0.56 : 0.5) +
        r.shake * 0.2;
      vignetteRef.current.darkness = THREE.MathUtils.lerp(
        vignetteRef.current.darkness ?? targetDarkness,
        targetDarkness,
        1 - Math.exp(-realDt * 6)
      );
    }

    clearFrameInput(input);
  });

  const fxMultisample = snap.fxLevel === 'full' ? 2 : 0;
  const bloomThreshold = snap.fxLevel === 'full' ? 0.28 : 0.34;

  return (
    <group>
      <InputController
        canStart={snap.phase !== 'playing'}
        canRotate={snap.phase === 'playing' && !paused}
        onRotateLeft={rotateLeft}
        onRotateRight={rotateRight}
        onFlip={flipLane}
        onTapFallback={rotateFallback}
        onStart={startRun}
      />

      <OctaSurgeUI
        onStart={startRun}
        onSelectMode={(mode: OctaSurgeMode) => octaSurgeState.setMode(mode)}
        onCycleFxLevel={() => {
          const next =
            snap.fxLevel === 'full'
              ? 'medium'
              : snap.fxLevel === 'medium'
                ? 'low'
                : 'full';
          octaSurgeState.setFxLevel(next);
          octaSurgeState.save();
        }}
      />

      <ambientLight intensity={0.32} />
      <directionalLight position={[5, 8, 6]} intensity={1.15} castShadow />
      <directionalLight position={[-5, -2, 4]} intensity={0.45} />
      <pointLight
        position={[0, -1.2, 4]}
        intensity={0.8}
        color={snap.prismActive ? '#f9a8d4' : '#67e8f9'}
      />
      <Environment preset="sunset" background={false} />
      <Stars
        radius={150}
        depth={54}
        count={900}
        factor={2.4}
        saturation={0.6}
        fade
        speed={0.24}
      />

      <group ref={worldRef}>
        <instancedMesh
          ref={tileRef}
          args={[undefined, undefined, tileInstances]}
          receiveShadow
        >
          <primitive object={geom.tile} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.44}
            metalness={0.08}
            emissive="#0f172a"
            emissiveIntensity={0.28}
          />
        </instancedMesh>

        <instancedMesh
          ref={bumpRef}
          args={[undefined, undefined, bumpInstances]}
          castShadow
          receiveShadow
        >
          <primitive object={geom.bump} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.26}
            metalness={0.08}
            emissive="#7f1d1d"
            emissiveIntensity={0.42}
          />
        </instancedMesh>

        <instancedMesh
          ref={crusherRef}
          args={[undefined, undefined, bumpInstances]}
          castShadow
        >
          <primitive object={geom.crusher} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.2}
            metalness={0.18}
            emissive="#be123c"
            emissiveIntensity={0.54}
          />
        </instancedMesh>

        <instancedMesh
          ref={speedPadRef}
          args={[undefined, undefined, bumpInstances]}
        >
          <primitive object={geom.speedPad} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.2}
            metalness={0.22}
            emissive="#22d3ee"
            emissiveIntensity={0.6}
          />
        </instancedMesh>

        <instancedMesh ref={ringRef} args={[undefined, undefined, GAME.ringBuffer]}>
          <primitive object={geom.ring} attach="geometry" />
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.46}
            toneMapped={false}
          />
        </instancedMesh>

        <instancedMesh ref={gemRef} args={[undefined, undefined, GAME.ringBuffer]}>
          <primitive object={geom.gem} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.14}
            metalness={0.18}
            emissive="#f59e0b"
            emissiveIntensity={0.48}
          />
        </instancedMesh>

        <instancedMesh ref={boostRef} args={[undefined, undefined, GAME.ringBuffer]}>
          <primitive object={geom.boost} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.18}
            metalness={0.2}
            emissive="#06b6d4"
            emissiveIntensity={0.54}
          />
        </instancedMesh>

        <instancedMesh ref={shieldRef} args={[undefined, undefined, GAME.ringBuffer]}>
          <primitive object={geom.shield} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.2}
            metalness={0.16}
            emissive="#7c3aed"
            emissiveIntensity={0.52}
          />
        </instancedMesh>

        <instancedMesh
          ref={magnetRef}
          args={[undefined, undefined, GAME.ringBuffer]}
        >
          <primitive object={geom.magnet} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.24}
            metalness={0.38}
            emissive="#10b981"
            emissiveIntensity={0.5}
          />
        </instancedMesh>

        <instancedMesh ref={prismRef} args={[undefined, undefined, GAME.ringBuffer]}>
          <primitive object={geom.prism} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.2}
            metalness={0.24}
            emissive="#f472b6"
            emissiveIntensity={0.56}
          />
        </instancedMesh>

        <instancedMesh ref={phaseRef} args={[undefined, undefined, GAME.ringBuffer]}>
          <primitive object={geom.phase} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.16}
            metalness={0.2}
            emissive="#60a5fa"
            emissiveIntensity={0.6}
            transparent
            opacity={0.96}
          />
        </instancedMesh>

        <instancedMesh
          ref={fxRef}
          args={[undefined, undefined, runtime.current.effects.length]}
        >
          <primitive object={geom.fx} attach="geometry" />
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.86}
            toneMapped={false}
          />
        </instancedMesh>
      </group>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -28]}>
        <primitive object={geom.pulseRing} attach="geometry" />
        <meshBasicMaterial
          color={snap.phaseActive ? '#93c5fd' : '#67e8f9'}
          transparent
          opacity={0.2}
          toneMapped={false}
        />
      </mesh>

      <group
        ref={playerRef}
        position={[0, -GAME.radius + 0.62, GAME.playerPlaneZ]}
      >
        <mesh castShadow>
          <primitive object={geom.player} attach="geometry" />
          <meshStandardMaterial
            color="#f8fafc"
            roughness={0.24}
            metalness={0.1}
            emissive={snap.phaseActive ? '#93c5fd' : '#93c5fd'}
            emissiveIntensity={snap.phaseActive ? 0.54 : 0.32}
          />
        </mesh>
        <mesh
          ref={auraRef}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -0.03]}
        >
          <primitive object={geom.playerAura} attach="geometry" />
          <meshBasicMaterial
            color="#67e8f9"
            transparent
            opacity={0.22}
            toneMapped={false}
          />
        </mesh>
      </group>

      <EffectComposer enableNormalPass={false} multisampling={fxMultisample}>
        <Bloom
          ref={bloomRef}
          intensity={snap.fxLevel === 'full' ? 0.42 : snap.fxLevel === 'medium' ? 0.32 : 0.22}
          luminanceThreshold={bloomThreshold}
          luminanceSmoothing={0.24}
          mipmapBlur
        />
        <ChromaticAberration
          ref={chromaRef}
          offset={snap.fxLevel === 'low' ? zeroOffset : chromaOffset}
          radialModulation
          modulationOffset={0.44}
        />
        <Vignette
          ref={vignetteRef}
          eskil={false}
          offset={0.14}
          darkness={snap.fxLevel === 'full' ? 0.64 : 0.56}
        />
        <Noise
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={
            snap.fxLevel === 'low' ? 0 : snap.fxLevel === 'full' ? 0.08 : 0.05
          }
        />
      </EffectComposer>
    </group>
  );
}
