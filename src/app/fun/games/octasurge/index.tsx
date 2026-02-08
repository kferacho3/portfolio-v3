'use client';

import { Environment, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
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

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const normalizeLane = (lane: number) => {
  let out = lane % GAME.faces;
  if (out < 0) out += GAME.faces;
  return out;
};

const laneBit = (lane: number) => 1 << normalizeLane(lane);

const cubicEase = (t: number) => {
  const p = clamp(t, 0, 1);
  return p * p * (3 - 2 * p);
};

const lanePos = (lane: number, radius: number): [number, number] => {
  const angle = lane * GAME.faceStep;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
};

const COLLECTION_COLOR: Record<CollectibleType | 'impact' | 'near', string> = {
  gem: '#facc15',
  boost: '#22d3ee',
  shield: '#a78bfa',
  impact: '#fb7185',
  near: '#67e8f9',
};

type RotAnim = {
  startMs: number;
  from: number;
  to: number;
  durationMs: number;
};

type InputControllerProps = {
  canStart: boolean;
  canRotate: boolean;
  onRotateClockwise: () => void;
  onRotateCounterClockwise: () => void;
  onFlip: () => void;
  onTapFallback: () => void;
  onStart: () => void;
};

const InputController: React.FC<InputControllerProps> = ({
  canStart,
  canRotate,
  onRotateClockwise,
  onRotateCounterClockwise,
  onFlip,
  onTapFallback,
  onStart,
}) => {
  useKeyboardControls({
    enabled: true,
    onLeft: () => {
      if (!canRotate) return;
      onRotateClockwise();
    },
    onRight: () => {
      if (!canRotate) return;
      onRotateCounterClockwise();
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
    onLeft: onRotateClockwise,
    onRight: onRotateCounterClockwise,
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
  const tileRef = useRef<THREE.InstancedMesh>(null);
  const bumpRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const gemRef = useRef<THREE.InstancedMesh>(null);
  const boostRef = useRef<THREE.InstancedMesh>(null);
  const shieldRef = useRef<THREE.InstancedMesh>(null);
  const fxRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Group>(null);

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
        laneChord * 0.72,
        GAME.bumpHeight,
        GAME.ringDepth * 0.62
      ),
      ring: new THREE.TorusGeometry(
        GAME.radius + 0.04,
        0.03,
        6,
        GAME.faces * 2
      ),
      gem: new THREE.OctahedronGeometry(0.19, 0),
      boost: new THREE.IcosahedronGeometry(0.22, 0),
      shield: new THREE.DodecahedronGeometry(0.21, 0),
      fx: new THREE.IcosahedronGeometry(0.15, 0),
      player: new THREE.IcosahedronGeometry(0.28, 1),
      playerAura: new THREE.TorusGeometry(0.38, 0.06, 10, 32),
    }),
    [laneChord]
  );

  const runtime = useRef({
    rings: [] as RingData[],
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
    shieldCharges: 0,

    rotationIndex: 0,
    worldRotation: 0,
    rotationQueue: [] as number[],
    rotAnim: null as RotAnim | null,
    lastDirection: 1 as 1 | -1,
    lastRotateAt: 0,

    shake: 0,
    fxCursor: 0,
    effects: Array.from({ length: 36 }, () => ({
      active: false,
      lane: 0,
      z: 0,
      age: 0,
      life: 0,
      type: 'near' as CollectionFx['type'],
    })),
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

  const syncRingInstances = useCallback(
    (ring: RingData) => {
      const tile = tileRef.current;
      const bump = bumpRef.current;
      const ringMesh = ringRef.current;
      const gem = gemRef.current;
      const boost = boostRef.current;
      const shield = shieldRef.current;

      if (!tile || !bump || !ringMesh || !gem || !boost || !shield) return;

      for (let lane = 0; lane < GAME.faces; lane += 1) {
        const tileId = ring.slot * GAME.faces + lane;
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
            (0.55 + ring.theme * 0.07 + lane * 0.012) % 1,
            0.5,
            0.58 + ((ring.index + lane) % 2) * 0.03
          );
          tile.setColorAt(tileId, color);
        } else {
          hideInstance(tile, tileId);
        }

        const bumpId = ring.slot * GAME.faces + lane;
        if ((ring.bumpMask & bit) !== 0) {
          const [bx, by] = lanePos(lane, GAME.radius - GAME.bumpHeight * 0.48);
          dummy.position.set(bx, by, ring.z);
          dummy.rotation.set(0, 0, angle);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          bump.setMatrixAt(bumpId, dummy.matrix);
          color.setHSL((0.02 + lane * 0.02) % 1, 0.82, 0.56);
          bump.setColorAt(bumpId, color);
        } else {
          hideInstance(bump, bumpId);
        }
      }

      dummy.position.set(0, 0, ring.z);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ringMesh.setMatrixAt(ring.slot, dummy.matrix);
      color.setHSL((0.58 + ring.theme * 0.08) % 1, 0.68, 0.64);
      ringMesh.setColorAt(ring.slot, color);

      hideInstance(gem, ring.slot);
      hideInstance(boost, ring.slot);
      hideInstance(shield, ring.slot);

      if (
        ring.collectibleLane != null &&
        !ring.collected &&
        ring.collectibleType
      ) {
        const [cx, cy] = lanePos(ring.collectibleLane, GAME.radius - 0.56);
        dummy.position.set(cx, cy, ring.z);
        dummy.rotation.set(
          0.2,
          0.1,
          ring.collectibleLane * GAME.faceStep * 0.6
        );
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        if (ring.collectibleType === 'gem') {
          gem.setMatrixAt(ring.slot, dummy.matrix);
          gem.setColorAt(ring.slot, color.set(COLLECTION_COLOR.gem));
        } else if (ring.collectibleType === 'boost') {
          boost.setMatrixAt(ring.slot, dummy.matrix);
          boost.setColorAt(ring.slot, color.set(COLLECTION_COLOR.boost));
        } else {
          shield.setMatrixAt(ring.slot, dummy.matrix);
          shield.setColorAt(ring.slot, color.set(COLLECTION_COLOR.shield));
        }
      }
    },
    [color, dummy, hideInstance]
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

      const lifeT = effect.age / effect.life;
      const [x, y] = lanePos(effect.lane, GAME.radius - 0.45 - lifeT * 0.32);
      const jitter = Math.sin((effect.age + i * 0.07) * 23) * 0.05;
      const scale = 0.34 + lifeT * 0.9;
      dummy.position.set(x + jitter, y - jitter, effect.z + effect.age * 2.8);
      dummy.rotation.set(effect.age * 8.2, effect.age * 6.4, effect.age * 4.8);
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
      ringRef.current,
      gemRef.current,
      boostRef.current,
      shieldRef.current,
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
      life = GAME.fxLife
    ) => {
      const r = runtime.current;
      const slot = r.fxCursor % r.effects.length;
      r.fxCursor += 1;
      r.effects[slot] = {
        active: true,
        lane,
        z,
        age: 0,
        life,
        type,
      };
    },
    []
  );

  const generateIntoSlot = useCallback(
    (slot: number, index: number, z: number) => {
      const ring = generateRing({
        seed: runtime.current.worldSeed,
        slot,
        index,
        z,
        previousSafeLane: runtime.current.lastSafeLane,
      });
      runtime.current.lastSafeLane = ring.safeLane;
      runtime.current.rings[slot] = ring;
      syncRingInstances(ring);
    },
    [syncRingInstances]
  );

  const resetWorld = useCallback(() => {
    const r = runtime.current;

    r.worldSeed = octaSurgeState.worldSeed;
    r.nextRingIndex = GAME.ringBuffer;
    r.lastSafeLane = GAME.bottomFace;

    r.elapsed = 0;
    r.scroll = 0;
    r.prevScroll = 0;
    r.score = 0;
    r.speed = GAME.baseSpeed;
    r.combo = 0;
    r.comboTimer = 0;

    r.surge = 100;
    r.boostUntil = 0;
    r.shieldCharges = 0;

    r.rotationIndex = 0;
    r.worldRotation = 0;
    r.rotationQueue = [];
    r.rotAnim = null;
    r.lastDirection = 1;
    r.lastRotateAt = 0;

    r.shake = 0;
    r.fxCursor = 0;
    r.effects.forEach((effect) => {
      effect.active = false;
      effect.age = 0;
      effect.life = 0;
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

    syncFxInstances();
    flushInstanceChanges();
  }, [flushInstanceChanges, generateIntoSlot, syncFxInstances]);

  const startRotation = useCallback((step: number, nowMs: number) => {
    const r = runtime.current;
    r.rotationIndex += step;
    const target = r.rotationIndex * GAME.faceStep;
    r.rotAnim = {
      startMs: nowMs,
      from: r.worldRotation,
      to: target,
      durationMs: GAME.rotationDurationMs,
    };

    if (step > 0) r.lastDirection = 1;
    if (step < 0) r.lastDirection = -1;
    r.lastRotateAt = nowMs;
  }, []);

  const enqueueRotation = useCallback(
    (step: number) => {
      const r = runtime.current;
      const nowMs = performance.now();
      if (r.rotAnim) {
        if (r.rotationQueue.length < GAME.rotationQueueLimit) {
          r.rotationQueue.push(step);
        } else {
          r.rotationQueue[r.rotationQueue.length - 1] = step;
        }
        return;
      }
      startRotation(step, nowMs);
    },
    [startRotation]
  );

  const rotateClockwise = useCallback(() => {
    if (octaSurgeState.phase !== 'playing' || paused) return;
    enqueueRotation(1);
  }, [enqueueRotation, paused]);

  const rotateCounterClockwise = useCallback(() => {
    if (octaSurgeState.phase !== 'playing' || paused) return;
    enqueueRotation(-1);
  }, [enqueueRotation, paused]);

  const flipLane = useCallback(() => {
    if (octaSurgeState.phase !== 'playing' || paused) return;
    enqueueRotation(4);
  }, [enqueueRotation, paused]);

  const rotateFallback = useCallback(() => {
    if (octaSurgeState.phase !== 'playing' || paused) return;
    enqueueRotation(runtime.current.lastDirection);
  }, [enqueueRotation, paused]);

  const startRun = useCallback(() => {
    octaSurgeState.start();
  }, []);

  useEffect(() => {
    octaSurgeState.load();

    gl.domElement.style.touchAction = 'none';
    scene.background = new THREE.Color('#050816');
    scene.fog = new THREE.Fog('#050816', 9, 78);

    camera.position.set(0, -0.55, 8.8);
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
    }
  }, [paused, snap.phase]);

  useFrame((state, dt) => {
    const r = runtime.current;
    const realDt = clamp(dt, 0.001, 0.033);
    const nowMs = state.clock.elapsedTime * 1000;

    const advanceRotation = () => {
      if (!r.rotAnim) {
        if (worldRef.current) worldRef.current.rotation.z = r.worldRotation;
        return;
      }
      const t = (nowMs - r.rotAnim.startMs) / r.rotAnim.durationMs;
      const eased = cubicEase(clamp(t, 0, 1));
      r.worldRotation =
        r.rotAnim.from + (r.rotAnim.to - r.rotAnim.from) * eased;
      if (worldRef.current) worldRef.current.rotation.z = r.worldRotation;
      if (t >= 1) {
        r.worldRotation = r.rotAnim.to;
        r.rotAnim = null;
        if (r.rotationQueue.length > 0) {
          const next = r.rotationQueue.shift() ?? 0;
          startRotation(next, nowMs);
        }
      }
    };

    advanceRotation();

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

    let simScale = 1;
    if (spaceHeld && r.surge > 0.1) {
      simScale = GAME.surgeSlowScale;
      r.surge = Math.max(0, r.surge - GAME.surgeDrainRate * realDt);
    }

    const boostActive = r.elapsed < r.boostUntil;
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

    r.speed = clamp(baseSpeed, GAME.baseSpeed, GAME.maxSpeed);
    if (boostActive) r.speed *= GAME.boostMultiplier;

    r.scroll += r.speed * delta;
    if (worldRef.current) worldRef.current.position.z = r.scroll;

    r.comboTimer = Math.max(0, r.comboTimer - realDt);
    if (r.comboTimer <= 0) r.combo = 0;

    const activeLane = normalizeLane(GAME.bottomFace - r.rotationIndex);
    const activeBit = laneBit(activeLane);

    let shouldEnd = false;

    for (let i = 0; i < r.rings.length; i += 1) {
      const ring = r.rings[i];
      const prevWorldZ = ring.z + r.prevScroll;
      const nextWorldZ = ring.z + r.scroll;

      if (
        !ring.crossed &&
        prevWorldZ <= GAME.playerPlaneZ &&
        nextWorldZ > GAME.playerPlaneZ
      ) {
        ring.crossed = true;

        const holeHit = (ring.solidMask & activeBit) === 0;
        const bumpHit = (ring.bumpMask & activeBit) !== 0;

        if (holeHit || bumpHit) {
          if (r.shieldCharges > 0) {
            r.shieldCharges -= 1;
            spawnFx('shield', activeLane, ring.z, 0.56);
            r.shake = Math.max(r.shake, 0.12);
          } else {
            spawnFx('impact', activeLane, ring.z, 0.7);
            r.shake = Math.max(r.shake, 0.2);
            shouldEnd = true;
          }
        } else {
          r.combo += 1;
          r.comboTimer = GAME.comboWindow;
          const comboMult =
            1 + Math.max(0, Math.min(12, r.combo - 1)) * GAME.comboStep;
          r.score += GAME.clearScore * comboMult;

          const nearMask = laneBit(activeLane - 1) | laneBit(activeLane + 1);
          if ((ring.bumpMask & nearMask) !== 0) {
            r.score += GAME.nearMissScore;
            octaSurgeState.addNearMiss();
            spawnFx('near', activeLane, ring.z, 0.48);
            r.shake = Math.max(r.shake, 0.05);
          }

          if (
            ring.collectibleLane != null &&
            ring.collectibleLane === activeLane &&
            ring.collectibleType &&
            !ring.collected
          ) {
            ring.collected = true;
            const type = ring.collectibleType;
            octaSurgeState.addCollect(type);

            if (type === 'gem') {
              r.score += GAME.gemScore;
              r.surge = clamp(r.surge + 10, 0, 100);
            } else if (type === 'boost') {
              r.score += GAME.boostScore;
              r.boostUntil = r.elapsed + GAME.boostDuration;
            } else {
              r.score += GAME.shieldScore;
              r.shieldCharges = Math.min(
                GAME.shieldMaxCharges,
                r.shieldCharges + 1
              );
            }

            spawnFx(type, activeLane, ring.z, 0.62);
            syncRingInstances(ring);
          }
        }
      }

      if (ring.z + r.scroll > GAME.despawnWorldZ) {
        const nextIndex = r.nextRingIndex;
        const nextZ = r.farthestBackZ - GAME.ringSpacing;
        r.nextRingIndex += 1;
        r.farthestBackZ = nextZ;

        const recycled = generateRing({
          seed: r.worldSeed,
          slot: ring.slot,
          index: nextIndex,
          z: nextZ,
          previousSafeLane: r.lastSafeLane,
        });

        r.lastSafeLane = recycled.safeLane;
        r.rings[ring.slot] = recycled;
        syncRingInstances(recycled);
      }

      if (shouldEnd) break;
    }

    for (let i = 0; i < r.effects.length; i += 1) {
      const effect = r.effects[i];
      if (!effect.active) continue;
      effect.age += realDt;
      if (effect.age >= effect.life) {
        effect.active = false;
      }
    }

    syncFxInstances();
    flushInstanceChanges();

    if (shouldEnd) {
      octaSurgeState.score = Math.floor(r.score);
      octaSurgeState.combo = r.combo;
      octaSurgeState.shieldCharges = r.shieldCharges;
      octaSurgeState.surgeMeter = r.surge;
      octaSurgeState.boostActive = false;
      octaSurgeState.progress = isTimed
        ? clamp(r.elapsed / runSeconds, 0, 1)
        : 0;
      octaSurgeState.time = r.elapsed;
      octaSurgeState.speed = r.speed;
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
      octaSurgeState.progress = 1;
      octaSurgeState.time = r.elapsed;
      octaSurgeState.speed = r.speed;
      octaSurgeState.end();
      clearFrameInput(input);
      return;
    }

    octaSurgeState.score = Math.floor(r.score);
    octaSurgeState.combo = r.combo;
    octaSurgeState.shieldCharges = r.shieldCharges;
    octaSurgeState.surgeMeter = r.surge;
    octaSurgeState.boostActive = boostActive;
    octaSurgeState.progress = isTimed ? clamp(r.elapsed / runSeconds, 0, 1) : 0;
    octaSurgeState.time = r.elapsed;
    octaSurgeState.speed = r.speed;

    r.shake = Math.max(0, r.shake - realDt * 1.85);

    const speedRatio = clamp(r.speed / GAME.maxSpeed, 0, 1);
    const targetFov =
      GAME.cameraBaseFov +
      speedRatio * GAME.cameraMaxFovBoost +
      (boostActive ? 3 : 0);

    const cameraShakeX =
      Math.sin(state.clock.elapsedTime * 34) * r.shake * 0.55;
    const cameraShakeY =
      Math.cos(state.clock.elapsedTime * 28) * r.shake * 0.42;

    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = THREE.MathUtils.lerp(
      cam.fov,
      targetFov,
      1 - Math.exp(-realDt * 8)
    );
    cam.position.x = THREE.MathUtils.lerp(
      cam.position.x,
      cameraShakeX + Math.sin(r.worldRotation * 0.35) * 0.22,
      1 - Math.exp(-realDt * 10)
    );
    cam.position.y = THREE.MathUtils.lerp(
      cam.position.y,
      -0.52 + cameraShakeY,
      1 - Math.exp(-realDt * 10)
    );
    cam.position.z = THREE.MathUtils.lerp(
      cam.position.z,
      8.8 - speedRatio * 0.9,
      1 - Math.exp(-realDt * 10)
    );
    cam.lookAt(0, 0, -18 - speedRatio * 4);
    cam.updateProjectionMatrix();

    if (playerRef.current) {
      const pulse =
        1 +
        Math.sin(state.clock.elapsedTime * 10) * 0.03 +
        (boostActive ? 0.05 : 0);
      playerRef.current.scale.setScalar(pulse);
    }

    clearFrameInput(input);
  });

  return (
    <group>
      <InputController
        canStart={snap.phase !== 'playing'}
        canRotate={snap.phase === 'playing' && !paused}
        onRotateClockwise={rotateClockwise}
        onRotateCounterClockwise={rotateCounterClockwise}
        onFlip={flipLane}
        onTapFallback={rotateFallback}
        onStart={startRun}
      />

      <OctaSurgeUI
        onStart={startRun}
        onSelectMode={(mode: OctaSurgeMode) => octaSurgeState.setMode(mode)}
      />

      <ambientLight intensity={0.28} />
      <directionalLight
        position={[5, 8, 6]}
        intensity={1.05}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, -2, 4]} intensity={0.45} />
      <Environment preset="sunset" background={false} />
      <Stars
        radius={140}
        depth={44}
        count={700}
        factor={2.2}
        saturation={0.6}
        fade
        speed={0.15}
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
            roughness={0.42}
            metalness={0.08}
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
            roughness={0.34}
            metalness={0.06}
            emissive="#7f1d1d"
            emissiveIntensity={0.35}
          />
        </instancedMesh>

        <instancedMesh
          ref={ringRef}
          args={[undefined, undefined, GAME.ringBuffer]}
        >
          <primitive object={geom.ring} attach="geometry" />
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.4}
            toneMapped={false}
          />
        </instancedMesh>

        <instancedMesh
          ref={gemRef}
          args={[undefined, undefined, GAME.ringBuffer]}
        >
          <primitive object={geom.gem} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.18}
            metalness={0.2}
            emissive="#f59e0b"
            emissiveIntensity={0.45}
          />
        </instancedMesh>

        <instancedMesh
          ref={boostRef}
          args={[undefined, undefined, GAME.ringBuffer]}
        >
          <primitive object={geom.boost} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.2}
            metalness={0.18}
            emissive="#0891b2"
            emissiveIntensity={0.52}
          />
        </instancedMesh>

        <instancedMesh
          ref={shieldRef}
          args={[undefined, undefined, GAME.ringBuffer]}
        >
          <primitive object={geom.shield} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.22}
            metalness={0.15}
            emissive="#7c3aed"
            emissiveIntensity={0.5}
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
            opacity={0.85}
            toneMapped={false}
          />
        </instancedMesh>
      </group>

      <group
        ref={playerRef}
        position={[0, -GAME.radius + 0.62, GAME.playerPlaneZ]}
      >
        <mesh castShadow>
          <primitive object={geom.player} attach="geometry" />
          <meshStandardMaterial
            color="#f8fafc"
            roughness={0.28}
            metalness={0.08}
            emissive="#93c5fd"
            emissiveIntensity={0.28}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.02]}>
          <primitive object={geom.playerAura} attach="geometry" />
          <meshBasicMaterial
            color="#67e8f9"
            transparent
            opacity={0.25}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
