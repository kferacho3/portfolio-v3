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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';
import { GAME, OCTA_PALETTES } from './constants';
import { OctaSurgeUI } from './_components/OctaSurgeUI';
import { octaSurgeState } from './state';
import type { OctaSurgeMode } from './types';

export { octaSurgeState } from './state';
export * from './types';
export * from './constants';

type RingRuntime = {
  slot: number;
  index: number;
  z: number;
  worldZ: number;
  prevWorldZ: number;
  rotation: number;
  prevRotation: number;
  spin: number;
  mask: number;
  safeLane: number;
  openWidth: number;
  theme: number;
  crossed: boolean;
};

type RuntimeState = {
  seed: number;
  paletteIndex: number;
  rings: RingRuntime[];
  nextRingIndex: number;
  farthestBackZ: number;
  lastSafeLane: number;

  elapsed: number;
  scroll: number;
  speed: number;
  score: number;
  combo: number;
  comboTimer: number;

  playerAngle: number;
  playerPrevAngle: number;
  angularVelocity: number;

  shake: number;
  flash: number;
  pulse: number;
};

const ALL_MASK = (1 << GAME.faces) - 1;
const TWO_PI = Math.PI * 2;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const normalizeLane = (lane: number) => {
  let out = lane % GAME.faces;
  if (out < 0) out += GAME.faces;
  return out;
};

const laneBit = (lane: number) => 1 << normalizeLane(lane);

const normalizeAngle = (angle: number) => {
  let out = angle % TWO_PI;
  if (out < 0) out += TWO_PI;
  return out;
};

const shortestAngle = (from: number, to: number) => {
  let delta = (to - from) % TWO_PI;
  if (delta > Math.PI) delta -= TWO_PI;
  if (delta < -Math.PI) delta += TWO_PI;
  return delta;
};

const laneAngle = (lane: number) => normalizeLane(lane) * GAME.faceStep;

const lanePos = (angle: number, radius: number): [number, number] => [
  Math.cos(angle) * radius,
  Math.sin(angle) * radius,
];

const hash2 = (seed: number, index: number) => {
  let x = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
};

const difficultyFromRing = (ringIndex: number) =>
  clamp(
    Math.max(0, ringIndex - GAME.warmupRings) / GAME.difficultyRampRings,
    0,
    1
  );

function pickPaletteIndex(seed: number, previous: number) {
  if (OCTA_PALETTES.length <= 1) return 0;
  const next = Math.abs(seed) % OCTA_PALETTES.length;
  if (next === previous) return (next + 1) % OCTA_PALETTES.length;
  return next;
}

function chooseSafeDrift(rng: SeededRandom, difficulty: number) {
  const maxDrift =
    difficulty < 0.42 ? GAME.maxSafeDriftNear : GAME.maxSafeDriftFar;
  const choices: { drift: number; weight: number }[] = [];

  for (let drift = -maxDrift; drift <= maxDrift; drift += 1) {
    const abs = Math.abs(drift);
    const weight =
      abs === 0
        ? 2.4 - difficulty * 0.9
        : abs === 1
          ? 1.2 + difficulty * 0.25
          : 0.45 + difficulty * 0.35;
    choices.push({ drift, weight: Math.max(0.1, weight) });
  }

  const total = choices.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng.float(0, total);
  for (const item of choices) {
    roll -= item.weight;
    if (roll <= 0) return item.drift;
  }
  return 0;
}

function makeRing(params: {
  seed: number;
  slot: number;
  index: number;
  z: number;
  previousSafeLane: number;
  scroll: number;
}): RingRuntime {
  const { seed, slot, index, z, previousSafeLane, scroll } = params;
  const rng = new SeededRandom(hash2(seed, index));
  const difficulty = difficultyFromRing(index);

  const drift = chooseSafeDrift(rng, difficulty);
  const safeLane = normalizeLane(previousSafeLane + drift);

  const openWidthRaw =
    GAME.openWidthNear +
    (GAME.openWidthFar - GAME.openWidthNear) * difficulty +
    rng.float(-0.34, 0.34);
  const openWidth = clamp(Math.round(openWidthRaw), 1, 3);

  let mask = ALL_MASK;
  const openStartOffset =
    openWidth === 1 ? 0 : openWidth === 2 ? (rng.bool(0.5) ? 0 : -1) : -1;
  for (let i = 0; i < openWidth; i += 1) {
    mask &= ~laneBit(safeLane + openStartOffset + i);
  }

  if (difficulty > 0.35 && rng.bool(0.16 + difficulty * 0.18)) {
    const extraOffset = (rng.bool(0.5) ? 1 : -1) * (2 + rng.int(0, 1));
    mask &= ~laneBit(safeLane + extraOffset);
  }

  mask &= ~laneBit(safeLane);

  const spinScale =
    GAME.ringSpinNear + (GAME.ringSpinFar - GAME.ringSpinNear) * difficulty;
  const spin = rng.float(-spinScale, spinScale);

  const rotation = rng.float(0, TWO_PI);
  const worldZ = z + scroll;

  return {
    slot,
    index,
    z,
    worldZ,
    prevWorldZ: worldZ,
    rotation,
    prevRotation: rotation,
    spin,
    mask,
    safeLane,
    openWidth,
    theme: rng.int(0, 3),
    crossed: false,
  };
}

export default function OctaSurge() {
  const snap = useSnapshot(octaSurgeState);
  const { paused, restartSeed } = useGameUIState();
  const { camera, gl, scene } = useThree();

  const inputRef = useInputRef({
    preventDefault: [' ', 'space', 'spacebar', 'enter', 'arrowleft', 'arrowright', 'a', 'd'],
  });

  const obstacleRef = useRef<THREE.InstancedMesh>(null);
  const railRef = useRef<THREE.InstancedMesh>(null);
  const worldRef = useRef<THREE.Group>(null);
  const playerRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  const bloomRef = useRef<any>(null);
  const chromaRef = useRef<any>(null);
  const vignetteRef = useRef<any>(null);

  const [paletteIndex, setPaletteIndex] = useState(0);
  const palette = OCTA_PALETTES[paletteIndex] ?? OCTA_PALETTES[0];

  const laneChord = useMemo(
    () => 2 * GAME.radius * Math.tan(Math.PI / GAME.faces),
    []
  );

  const obstacleCount = GAME.ringBuffer * GAME.faces;
  const railCount = GAME.ringBuffer;

  const geom = useMemo(
    () => ({
      obstacle: new THREE.BoxGeometry(
        laneChord * 0.96,
        GAME.tileThickness,
        GAME.ringDepth
      ),
      rail: new THREE.TorusGeometry(GAME.radius + 0.08, 0.03, 8, 64),
      player: new THREE.IcosahedronGeometry(0.28, 1),
      aura: new THREE.TorusGeometry(0.46, 0.06, 12, 40),
      tunnelA: new THREE.CylinderGeometry(
        GAME.radius + 1.55,
        GAME.radius + 1.55,
        210,
        32,
        1,
        true
      ),
      tunnelB: new THREE.CylinderGeometry(
        GAME.radius + 2.55,
        GAME.radius + 2.55,
        220,
        32,
        1,
        true
      ),
    }),
    [laneChord]
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const blendColor = useMemo(() => new THREE.Color(palette.obstacleB), [palette.obstacleB]);
  const chromaOffset = useMemo(() => new THREE.Vector2(0.0002, 0.0001), []);
  const zeroOffset = useMemo(() => new THREE.Vector2(0, 0), []);

  const runtime = useRef<RuntimeState>({
    seed: 1,
    paletteIndex: 0,
    rings: [],
    nextRingIndex: 0,
    farthestBackZ: 0,
    lastSafeLane: GAME.bottomFace,

    elapsed: 0,
    scroll: 0,
    speed: GAME.baseSpeed,
    score: 0,
    combo: 0,
    comboTimer: 0,

    playerAngle: laneAngle(GAME.bottomFace),
    playerPrevAngle: laneAngle(GAME.bottomFace),
    angularVelocity: 0,

    shake: 0,
    flash: 0,
    pulse: 0,
  });
  const initRunRef = useRef<(seed: number) => void>(() => {});

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

  const syncInstances = useCallback(() => {
    const obstacleMesh = obstacleRef.current;
    const railMesh = railRef.current;
    const r = runtime.current;

    if (!obstacleMesh || !railMesh) return;

    for (let i = 0; i < r.rings.length; i += 1) {
      const ring = r.rings[i];

      dummy.position.set(0, 0, ring.worldZ);
      dummy.rotation.set(Math.PI / 2, 0, ring.rotation);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      railMesh.setMatrixAt(ring.slot, dummy.matrix);

      color.set(palette.rail);
      color.offsetHSL((ring.theme - 1.5) * 0.012, 0, 0);
      railMesh.setColorAt(ring.slot, color);

      for (let lane = 0; lane < GAME.faces; lane += 1) {
        const id = ring.slot * GAME.faces + lane;
        const blocked = (ring.mask & laneBit(lane)) !== 0;
        if (!blocked) {
          hideInstance(obstacleMesh, id);
          continue;
        }

        const angle = laneAngle(lane) + ring.rotation;
        const [x, y] = lanePos(angle, GAME.radius);

        dummy.position.set(x, y, ring.worldZ);
        dummy.rotation.set(0, 0, angle + Math.PI / 2);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        obstacleMesh.setMatrixAt(id, dummy.matrix);

        const t = lane / Math.max(1, GAME.faces - 1);
        color.set(palette.obstacleA);
        color.lerp(blendColor, 0.22 + t * 0.66);
        color.offsetHSL((ring.theme - 1.5) * 0.01, 0, 0);
        obstacleMesh.setColorAt(id, color);
      }
    }

    obstacleMesh.instanceMatrix.needsUpdate = true;
    railMesh.instanceMatrix.needsUpdate = true;
    if (obstacleMesh.instanceColor) obstacleMesh.instanceColor.needsUpdate = true;
    if (railMesh.instanceColor) railMesh.instanceColor.needsUpdate = true;
  }, [blendColor, color, dummy, hideInstance, palette.obstacleA, palette.rail]);

  const initRun = useCallback(
    (seed: number) => {
      const r = runtime.current;
      const nextPaletteIndex = pickPaletteIndex(seed, r.paletteIndex);

      r.seed = seed;
      r.paletteIndex = nextPaletteIndex;
      setPaletteIndex(nextPaletteIndex);

      r.rings = [];
      r.nextRingIndex = GAME.ringBuffer;
      r.farthestBackZ = GAME.spawnStartZ - (GAME.ringBuffer - 1) * GAME.ringSpacing;
      r.lastSafeLane = GAME.bottomFace;

      r.elapsed = 0;
      r.scroll = 0;
      r.speed = GAME.baseSpeed;
      r.score = 0;
      r.combo = 0;
      r.comboTimer = 0;

      r.playerAngle = laneAngle(GAME.bottomFace);
      r.playerPrevAngle = r.playerAngle;
      r.angularVelocity = 0;

      r.shake = 0;
      r.flash = 0;
      r.pulse = 0;

      for (let slot = 0; slot < GAME.ringBuffer; slot += 1) {
        const index = slot;
        const z = GAME.spawnStartZ - slot * GAME.ringSpacing;
        const ring = makeRing({
          seed,
          slot,
          index,
          z,
          previousSafeLane: r.lastSafeLane,
          scroll: r.scroll,
        });
        r.lastSafeLane = ring.safeLane;
        r.rings.push(ring);
      }

      octaSurgeState.score = 0;
      octaSurgeState.combo = 0;
      octaSurgeState.progress = 0;
      octaSurgeState.time = 0;
      octaSurgeState.speed = GAME.baseSpeed;
      octaSurgeState.shieldCharges = 0;
      octaSurgeState.surgeMeter = 100;
      octaSurgeState.boostActive = false;
      octaSurgeState.magnetActive = false;
      octaSurgeState.prismActive = false;
      octaSurgeState.phaseActive = false;
      octaSurgeState.speedPadActive = false;
      octaSurgeState.dangerPulse = 0;
      octaSurgeState.setCrashReason('');

      syncInstances();
    },
    [syncInstances]
  );

  const startRun = useCallback(() => {
    octaSurgeState.start();
  }, []);

  const endRun = useCallback(
    (reason: string) => {
      const r = runtime.current;
      octaSurgeState.score = Math.floor(r.score);
      octaSurgeState.combo = r.combo;
      octaSurgeState.time = r.elapsed;
      octaSurgeState.speed = r.speed;
      octaSurgeState.progress =
        snap.mode === 'endless'
          ? 0
          : clamp(
              r.elapsed /
                (snap.mode === 'daily'
                  ? GAME.dailyRunSeconds
                  : GAME.classicRunSeconds),
              0,
              1
            );
      octaSurgeState.dangerPulse = 1;
      octaSurgeState.setCrashReason(reason);
      octaSurgeState.end();
    },
    [snap.mode]
  );

  useEffect(() => {
    initRunRef.current = initRun;
  }, [initRun]);

  useEffect(() => {
    octaSurgeState.load();
  }, []);

  useEffect(() => {
    gl.domElement.style.touchAction = 'none';
    return () => {
      gl.domElement.style.touchAction = '';
    };
  }, [gl]);

  useEffect(() => {
    scene.background = new THREE.Color(palette.bg);
    scene.fog = new THREE.Fog(palette.fog, 8, 110);
    gl.setClearColor(palette.bg, 1);
  }, [gl, palette.bg, palette.fog, scene]);

  useEffect(() => {
    if (!restartSeed) return;
    octaSurgeState.start();
  }, [restartSeed]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;
    initRunRef.current(snap.worldSeed);
  }, [snap.phase, snap.worldSeed]);

  useEffect(() => {
    if (obstacleRef.current) {
      obstacleRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    if (railRef.current) {
      railRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, []);

  useFrame((state, dt) => {
    const r = runtime.current;
    const d = clamp(dt, 0.001, 0.05);
    const input = inputRef.current;

    const wantsStart =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar') ||
      input.justPressed.has('enter');

    if (snap.phase !== 'playing') {
      if (wantsStart) octaSurgeState.start();

      if (worldRef.current) {
        worldRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
      }
      if (playerRef.current) {
        const [px, py] = lanePos(r.playerAngle + Math.sin(state.clock.elapsedTime) * 0.05, GAME.playerRadius);
        playerRef.current.position.set(px, py, GAME.playerPlaneZ);
      }

      syncInstances();
      clearFrameInput(inputRef);
      return;
    }

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    const leftHeld = input.keysDown.has('arrowleft') || input.keysDown.has('a');
    const rightHeld = input.keysDown.has('arrowright') || input.keysDown.has('d');

    let steer = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
    if (steer === 0 && input.pointerDown) {
      if (input.pointerX < -0.12) steer = -1;
      if (input.pointerX > 0.12) steer = 1;
    }

    r.playerPrevAngle = r.playerAngle;

    if (steer !== 0) {
      r.angularVelocity += steer * GAME.angularAccel * d;
    } else {
      let leadRing: RingRuntime | null = null;
      for (let i = 0; i < r.rings.length; i += 1) {
        const ring = r.rings[i];
        if (ring.crossed) continue;
        if (ring.worldZ < -9 || ring.worldZ > -1.2) continue;
        if (!leadRing || ring.worldZ > leadRing.worldZ) {
          leadRing = ring;
        }
      }

      if (leadRing) {
        const targetAngle = laneAngle(leadRing.safeLane) + leadRing.rotation;
        const delta = shortestAngle(r.playerAngle, targetAngle);
        r.angularVelocity += clamp(delta, -1, 1) * GAME.laneAssistStrength * d;
      }
    }

    r.angularVelocity *= Math.exp(-GAME.angularDrag * d);
    r.angularVelocity = clamp(
      r.angularVelocity,
      -GAME.maxAngularVelocity,
      GAME.maxAngularVelocity
    );

    r.playerAngle = normalizeAngle(r.playerAngle + r.angularVelocity * d);

    r.elapsed += d;
    r.pulse += d;

    const timedRun = snap.mode !== 'endless';
    const runSeconds =
      snap.mode === 'daily' ? GAME.dailyRunSeconds : GAME.classicRunSeconds;

    const speedTarget = clamp(
      GAME.baseSpeed +
        r.elapsed * GAME.speedRampPerSecond +
        Math.floor(r.score * 0.01) * GAME.speedRampFromScore,
      GAME.baseSpeed,
      GAME.maxSpeed
    );

    r.speed = THREE.MathUtils.lerp(r.speed, speedTarget, 1 - Math.exp(-d * 3));
    r.scroll += r.speed * d;

    r.comboTimer = Math.max(0, r.comboTimer - d);
    if (r.comboTimer <= 0) r.combo = 0;

    let crashReason = '';
    const halfLaneCore = GAME.faceStep * 0.5 - GAME.collisionLaneTolerance;

    for (let i = 0; i < r.rings.length; i += 1) {
      const ring = r.rings[i];

      ring.prevWorldZ = ring.worldZ;
      ring.worldZ = ring.z + r.scroll;
      ring.prevRotation = ring.rotation;
      ring.rotation = normalizeAngle(
        ring.rotation + ring.spin * d + (r.speed / GAME.maxSpeed) * 0.14 * d
      );

      if (ring.crossed) continue;

      const crossedPlane =
        ring.prevWorldZ <= GAME.playerPlaneZ + GAME.ringDepth * 0.5 &&
        ring.worldZ >= GAME.playerPlaneZ - GAME.ringDepth * 0.5;
      if (!crossedPlane) continue;

      ring.crossed = true;

      const zDelta = ring.worldZ - ring.prevWorldZ;
      const t =
        Math.abs(zDelta) < 0.0001
          ? 0.5
          : clamp((GAME.playerPlaneZ - ring.prevWorldZ) / zDelta, 0, 1);

      const playerAtImpact = normalizeAngle(
        r.playerPrevAngle + shortestAngle(r.playerPrevAngle, r.playerAngle) * t
      );
      const ringRotAtImpact = normalizeAngle(
        ring.prevRotation + shortestAngle(ring.prevRotation, ring.rotation) * t
      );
      const localAngle = normalizeAngle(playerAtImpact - ringRotAtImpact);

      const nearestLane = normalizeLane(Math.round(localAngle / GAME.faceStep));
      const nearestCenter = laneAngle(nearestLane);
      const nearestDelta = Math.abs(shortestAngle(localAngle, nearestCenter));

      const blocked = (ring.mask & laneBit(nearestLane)) !== 0;
      const inCore = nearestDelta <= halfLaneCore;

      if (blocked && inCore) {
        r.combo = 0;
        r.comboTimer = 0;
        r.flash = 1;
        r.shake = Math.max(r.shake, 0.26);

        crashReason =
          ring.openWidth === 1
            ? 'Missed the narrow opening. Start steering earlier.'
            : 'You clipped a closed segment. Keep your line inside the opening.';
        break;
      }

      r.combo += 1;
      r.comboTimer = GAME.comboWindow;
      const comboMult = 1 + Math.max(0, Math.min(12, r.combo - 1)) * GAME.comboStep;
      const centerBonus = 1 - clamp(nearestDelta / (GAME.faceStep * 0.5), 0, 1);
      r.score += GAME.clearScore * comboMult * (1 + centerBonus * 0.32);

      let closestBlockedMargin = Number.POSITIVE_INFINITY;
      for (let lane = 0; lane < GAME.faces; lane += 1) {
        if ((ring.mask & laneBit(lane)) === 0) continue;
        const dToBlocked = Math.abs(shortestAngle(localAngle, laneAngle(lane)));
        const margin = dToBlocked - halfLaneCore;
        if (margin < closestBlockedMargin) closestBlockedMargin = margin;
      }

      if (
        closestBlockedMargin > 0 &&
        closestBlockedMargin <= GAME.nearMissLaneTolerance
      ) {
        r.score += GAME.nearMissScore * comboMult;
        r.shake = Math.max(r.shake, 0.09);
        octaSurgeState.addNearMiss();
      }
    }

    if (crashReason) {
      endRun(crashReason);
      clearFrameInput(inputRef);
      return;
    }

    for (let i = 0; i < r.rings.length; i += 1) {
      const ring = r.rings[i];
      if (ring.worldZ <= GAME.despawnWorldZ) continue;

      const nextIndex = r.nextRingIndex;
      const nextZ = r.farthestBackZ - GAME.ringSpacing;
      r.nextRingIndex += 1;
      r.farthestBackZ = nextZ;

      const nextRing = makeRing({
        seed: r.seed,
        slot: ring.slot,
        index: nextIndex,
        z: nextZ,
        previousSafeLane: r.lastSafeLane,
        scroll: r.scroll,
      });
      r.lastSafeLane = nextRing.safeLane;
      r.rings[i] = nextRing;
    }

    if (timedRun && r.elapsed >= runSeconds) {
      endRun('Run complete. You survived the full timer.');
      clearFrameInput(inputRef);
      return;
    }

    r.flash = Math.max(0, r.flash - d * 2.4);
    r.shake = Math.max(0, r.shake - d * 2.1);

    octaSurgeState.score = Math.floor(r.score);
    octaSurgeState.combo = r.combo;
    octaSurgeState.progress = timedRun ? clamp(r.elapsed / runSeconds, 0, 1) : 0;
    octaSurgeState.time = r.elapsed;
    octaSurgeState.speed = r.speed;
    octaSurgeState.shieldCharges = 0;
    octaSurgeState.surgeMeter = 100;
    octaSurgeState.boostActive = false;
    octaSurgeState.speedPadActive = false;
    octaSurgeState.magnetActive = false;
    octaSurgeState.prismActive = false;
    octaSurgeState.phaseActive = false;
    octaSurgeState.dangerPulse = clamp(r.shake * 3.2 + r.flash * 0.8, 0, 1);

    if (worldRef.current) {
      worldRef.current.rotation.z =
        Math.sin(r.elapsed * 0.22) * 0.08 + r.angularVelocity * 0.045;
    }

    const [px, py] = lanePos(r.playerAngle, GAME.playerRadius);
    if (playerRef.current) {
      const bob = Math.sin(r.pulse * 7.5) * 0.045;
      playerRef.current.position.set(px, py, GAME.playerPlaneZ + bob);
      playerRef.current.rotation.set(0, 0, r.playerAngle + Math.PI / 2 + r.angularVelocity * 0.12);
      const stretch = 1 + Math.abs(r.angularVelocity) * 0.03;
      playerRef.current.scale.set(stretch, 1 / stretch, 1);
    }

    if (auraRef.current) {
      const auraMat = auraRef.current.material as THREE.MeshBasicMaterial;
      auraMat.opacity = THREE.MathUtils.lerp(
        auraMat.opacity,
        0.22 + r.flash * 0.25 + Math.abs(r.angularVelocity) * 0.02,
        1 - Math.exp(-d * 8)
      );
    }

    const speedRatio = clamp(r.speed / GAME.maxSpeed, 0, 1);
    const cam = camera as THREE.PerspectiveCamera;
    const targetFov = GAME.cameraBaseFov + speedRatio * GAME.cameraMaxFovBoost + r.flash * 1.4;
    cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-d * 8));
    cam.position.x = THREE.MathUtils.lerp(
      cam.position.x,
      px * 0.2 + Math.sin(state.clock.elapsedTime * 31) * r.shake * 0.4,
      1 - Math.exp(-d * 9)
    );
    cam.position.y = THREE.MathUtils.lerp(
      cam.position.y,
      py * 0.16 - 0.45 + Math.cos(state.clock.elapsedTime * 27) * r.shake * 0.32,
      1 - Math.exp(-d * 9)
    );
    cam.position.z = THREE.MathUtils.lerp(
      cam.position.z,
      GAME.cameraBaseZ - speedRatio * GAME.cameraSpeedZoom,
      1 - Math.exp(-d * 9)
    );
    cam.lookAt(0, 0, -GAME.cameraLookAhead - speedRatio * 6);
    cam.updateProjectionMatrix();

    if (bloomRef.current) {
      const fxScale =
        snap.fxLevel === 'full' ? 1 : snap.fxLevel === 'medium' ? 0.74 : 0.52;
      const bloomTarget = (0.28 + speedRatio * 0.46 + r.flash * 0.2) * fxScale;
      bloomRef.current.intensity = THREE.MathUtils.lerp(
        bloomRef.current.intensity ?? bloomTarget,
        bloomTarget,
        1 - Math.exp(-d * 7)
      );
    }

    if (chromaRef.current && snap.fxLevel !== 'low') {
      const amount =
        (snap.fxLevel === 'full' ? 0.00035 : 0.00022) +
        speedRatio * 0.0009 +
        r.shake * 0.001;
      chromaOffset.set(amount, amount * 0.4);
      chromaRef.current.offset = chromaOffset;
    }

    if (vignetteRef.current) {
      const targetDarkness =
        (snap.fxLevel === 'full' ? 0.64 : snap.fxLevel === 'medium' ? 0.57 : 0.5) +
        r.flash * 0.18;
      vignetteRef.current.darkness = THREE.MathUtils.lerp(
        vignetteRef.current.darkness ?? targetDarkness,
        targetDarkness,
        1 - Math.exp(-d * 7)
      );
    }

    syncInstances();
    clearFrameInput(inputRef);
  });

  const fxMultisample = snap.fxLevel === 'full' ? 2 : 0;

  return (
    <group>
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

      <ambientLight intensity={0.44} color={palette.playerGlow} />
      <directionalLight position={[6, 8, 6]} intensity={1.1} color="#ffffff" />
      <pointLight position={[0, 0, 5]} intensity={0.8} color={palette.playerGlow} />
      <pointLight position={[-5, 3, 2]} intensity={0.42} color={palette.rail} />

      <Environment preset="night" background={false} />
      <Stars
        radius={180}
        depth={120}
        count={2400}
        factor={4.4}
        saturation={0}
        fade
        speed={0.5}
      />

      <group ref={worldRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -90]}>
          <primitive object={geom.tunnelA} attach="geometry" />
          <meshBasicMaterial
            color={palette.tunnelA}
            side={THREE.BackSide}
            transparent
            opacity={0.28}
            toneMapped={false}
          />
        </mesh>

        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -90]}>
          <primitive object={geom.tunnelB} attach="geometry" />
          <meshBasicMaterial
            color={palette.tunnelB}
            side={THREE.BackSide}
            transparent
            opacity={0.14}
            toneMapped={false}
          />
        </mesh>

        <instancedMesh
          ref={obstacleRef}
          args={[undefined, undefined, obstacleCount]}
          castShadow
          receiveShadow
        >
          <primitive object={geom.obstacle} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.26}
            metalness={0.2}
            emissive={palette.obstacleA}
            emissiveIntensity={0.22}
          />
        </instancedMesh>

        <instancedMesh ref={railRef} args={[undefined, undefined, railCount]}>
          <primitive object={geom.rail} attach="geometry" />
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.56}
            toneMapped={false}
          />
        </instancedMesh>
      </group>

      <group ref={playerRef} position={[0, 0, GAME.playerPlaneZ]}>
        <mesh castShadow>
          <primitive object={geom.player} attach="geometry" />
          <meshStandardMaterial
            color={palette.player}
            roughness={0.18}
            metalness={0.24}
            emissive={palette.playerGlow}
            emissiveIntensity={0.38}
          />
        </mesh>
        <mesh ref={auraRef} rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={geom.aura} attach="geometry" />
          <meshBasicMaterial
            color={palette.playerGlow}
            transparent
            opacity={0.22}
            toneMapped={false}
          />
        </mesh>
      </group>

      <EffectComposer enableNormalPass={false} multisampling={fxMultisample}>
        <Bloom
          ref={bloomRef}
          intensity={snap.fxLevel === 'full' ? 0.4 : snap.fxLevel === 'medium' ? 0.3 : 0.2}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.22}
          mipmapBlur
        />
        <ChromaticAberration
          ref={chromaRef}
          offset={snap.fxLevel === 'low' ? zeroOffset : chromaOffset}
          radialModulation
          modulationOffset={0.4}
        />
        <Vignette
          ref={vignetteRef}
          eskil={false}
          offset={0.12}
          darkness={snap.fxLevel === 'full' ? 0.64 : 0.57}
        />
        <Noise
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={snap.fxLevel === 'low' ? 0 : snap.fxLevel === 'full' ? 0.06 : 0.04}
        />
      </EffectComposer>
    </group>
  );
}
