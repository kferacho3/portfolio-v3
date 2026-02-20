'use client';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrthographicCamera } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { proxy, useSnapshot } from 'valtio';
import FixedViewportOverlay from '../_shared/FixedViewportOverlay';
import {
  BALL_SKINS,
  type SlowMoDifficulty,
  state as persistState,
  load,
  addStars,
  setHighScore,
  unlockBall,
  setSelectedBall,
  canUnlockBall,
} from './state';

const TRACK_WIDTH = 3.4;
const TRACK_THICK = 0.12;
const RAIL_WIDTH = 0.22;
const SEG_LEN = 6;
const SEG_COUNT = 30;

const BALL_RADIUS = 0.21;
const OBST_THICK = 0.38;
const OBST_HEIGHT = 0.36;
const IMPACT_POOL_SIZE = 44;

const LANE_HALF = TRACK_WIDTH / 2 - RAIL_WIDTH - 0.06;
const HUD_PUBLISH_INTERVAL = 1 / 15;
const SLOW_VISUAL_STEP = 0.07;

const OBST_COLORS = ['#ff6b6b', '#ffe4b8', '#b6ffcc', '#a3d4ff'];

type SlowMoDifficultyProfile = {
  label: string;
  description: string;
  sideObstacleChance: number;
  sideLenMin: number;
  sideLenMax: number;
  centerLenMin: number;
  centerLenMax: number;
  giftChance: number;
  starChance: number;
  spawnGapMin: number;
  spawnGapMax: number;
  spawnLookAhead: number;
  scoreRampMultiplier: number;
  energyDrainMultiplier: number;
  energyRegenMultiplier: number;
};

const DIFFICULTY_ORDER: SlowMoDifficulty[] = ['easy', 'medium', 'hard'];

const SLOWMO_DIFFICULTY_PROFILES: Record<
  SlowMoDifficulty,
  SlowMoDifficultyProfile
> = {
  easy: {
    label: 'Easy',
    description: 'Wider obstacle gaps and more pickups.',
    sideObstacleChance: 0.94,
    sideLenMin: 0.42,
    sideLenMax: 0.88,
    centerLenMin: 0.38,
    centerLenMax: 0.66,
    giftChance: 0.12,
    starChance: 0.48,
    spawnGapMin: 3.1,
    spawnGapMax: 5.1,
    spawnLookAhead: 74,
    scoreRampMultiplier: 0.76,
    energyDrainMultiplier: 0.78,
    energyRegenMultiplier: 1.22,
  },
  medium: {
    label: 'Medium',
    description: 'Balanced pacing with fair reaction windows.',
    sideObstacleChance: 0.9,
    sideLenMin: 0.48,
    sideLenMax: 1.05,
    centerLenMin: 0.45,
    centerLenMax: 0.78,
    giftChance: 0.09,
    starChance: 0.4,
    spawnGapMin: 2.65,
    spawnGapMax: 4.45,
    spawnLookAhead: 70,
    scoreRampMultiplier: 0.88,
    energyDrainMultiplier: 0.92,
    energyRegenMultiplier: 1.06,
  },
  hard: {
    label: 'Hard',
    description: 'Dense patterns, faster escalation.',
    sideObstacleChance: 0.82,
    sideLenMin: 0.62,
    sideLenMax: 1.26,
    centerLenMin: 0.6,
    centerLenMax: 0.98,
    giftChance: 0.05,
    starChance: 0.28,
    spawnGapMin: 2.1,
    spawnGapMax: 3.6,
    spawnLookAhead: 66,
    scoreRampMultiplier: 1.25,
    energyDrainMultiplier: 1.1,
    energyRegenMultiplier: 0.9,
  },
};

const GAME_TUNING = {
  forward: {
    baseSpeed: 4.2,
    scoreRamp: 0.045,
  },
  side: {
    baseSpeed: 3.35,
    maxSpeed: 4.7,
    responseLambda: 12.5,
    dragBase: 2.1,
    dragSlow: 5.9,
    wallRestitution: 0.46,
    wallSpring: 0.2,
  },
  slow: {
    factor: 0.2,
    lambdaIn: 22,
    lambdaOut: 13,
  },
  spawn: {
    poolSize: 42,
    initialSpawnZ: 7,
    gapMin: 2.35,
    gapMax: 4.05,
    respawnBehind: 10,
    lookAhead: 68,
  },
  energy: {
    drainPerSecond: 0.35,
    regenPerSecond: 0.18,
    pickupRefill: 0.25,
  },
  trail: {
    length: 16,
    sampleNormal: 0.03,
    sampleSlow: 0.016,
    size: BALL_RADIUS * 1.05,
  },
  tunnel: {
    ringCount: 14,
    spacing: 8,
    radius: TRACK_WIDTH * 0.82,
  },
  camera: {
    offsetX: 5.4,
    offsetZ: -5.2,
    height: 6,
    lookAhead: 4.9,
    baseZoom: 82,
    slowZoom: 91,
    followLambda: 10,
    zoomLambda: 11,
    releaseDamp: 13,
    releaseShake: 0.05,
  },
} as const;

const THEME = {
  background: '#020713',
  fog: '#050d1e',
  track: '#101924',
  rails: '#40f2d0',
  stripe: '#8cb8ff',
  tunnelRing: '#78bcff',
  trailBase: '#5fd6ff',
  trailSlow: '#d1f7ff',
  ring: '#b6ffcc',
} as const;

const isDev = process.env.NODE_ENV !== 'production';

type ObstacleKind = 'side' | 'center';

type Obstacle = {
  id: number;
  active: boolean;
  z: number;
  kind: ObstacleKind;
  side: -1 | 1;
  lenX: number;
  color: string;
  hasStar: boolean;
  hasGift: boolean;
  passed: boolean;
  starCollected: boolean;
  giftCollected: boolean;
};

type ImpactFxKind = 'wall' | 'obstacle' | 'pickup';

type ImpactFx = {
  id: number;
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  spin: number;
  color: THREE.Color;
  kind: ImpactFxKind;
};

type WorldRuntime = {
  realTime: number;
  gameTime: number;
  runnerDistance: number;
  nextSpawnAt: number;
  x: number;
  xVel: number;
  sideDir: -1 | 1;
  timeScale: number;
  targetScale: number;
  slowEnergy: number;
  slowStrength: number;
  isSlow: boolean;
  cameraX: number;
  cameraZ: number;
  cameraZoom: number;
  releaseKick: number;
  bouncePulse: number;
  ringPulse: number;
  trailSampleAcc: number;
  hudAccumulator: number;
  fps: number;
  wasSlow: boolean;
  visualSlowBucket: number;
  wallPulseL: number;
  wallPulseR: number;
  impactCursor: number;
  impacts: ImpactFx[];
  trailPoints: THREE.Vector3[];
};

const run = proxy({
  score: 0,
  slow: false,
  speed: Number(GAME_TUNING.forward.baseSpeed),
  lateralVel: 0,
  starsThisRun: 0,
  timeScale: 1,
  targetScale: 1,
  slowEnergy: 1,
  distance: 0,
  vignette: 0,
  slowStrength: 0,
  fps: 60,
});

const holdInput = proxy({
  isHolding: false,
});

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function expDamp(current: number, target: number, lambda: number, dt: number) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

function createObstacleSlot(id: number): Obstacle {
  return {
    id,
    active: false,
    z: -999,
    kind: 'side',
    side: 1,
    lenX: 0.6,
    color: OBST_COLORS[0],
    hasStar: false,
    hasGift: false,
    passed: false,
    starCollected: true,
    giftCollected: true,
  };
}

function createImpactFxSlot(id: number): ImpactFx {
  return {
    id,
    active: false,
    x: 0,
    y: BALL_RADIUS,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 0.2,
    size: 0.2,
    spin: 0,
    color: new THREE.Color('#ffffff'),
    kind: 'obstacle',
  };
}

function makeObstacle(
  id: number,
  z: number,
  profile: SlowMoDifficultyProfile
): Obstacle {
  const kind: ObstacleKind =
    Math.random() < profile.sideObstacleChance ? 'side' : 'center';
  const side: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
  const lenX =
    kind === 'side'
      ? rand(LANE_HALF * profile.sideLenMin, LANE_HALF * profile.sideLenMax)
      : rand(LANE_HALF * profile.centerLenMin, LANE_HALF * profile.centerLenMax);

  const hasGift = Math.random() < profile.giftChance;
  const hasStar = !hasGift && Math.random() < profile.starChance;

  return {
    id,
    active: true,
    z,
    kind,
    side,
    lenX,
    color: pick(OBST_COLORS),
    hasStar,
    hasGift,
    passed: false,
    starCollected: false,
    giftCollected: false,
  };
}

function obstacleXRange(o: Obstacle) {
  if (o.kind === 'center') {
    return { xMin: -o.lenX / 2, xMax: o.lenX / 2 };
  }

  if (o.side === -1) {
    return { xMin: -LANE_HALF, xMax: -LANE_HALF + o.lenX };
  }

  return { xMin: LANE_HALF - o.lenX, xMax: LANE_HALF };
}

function pickupX(o: Obstacle) {
  if (o.kind === 'center') return 0;
  return o.side === -1 ? LANE_HALF * 0.45 : -LANE_HALF * 0.45;
}

function SlowMoScene() {
  const snap = useSnapshot(persistState);
  const difficultyProfile =
    SLOWMO_DIFFICULTY_PROFILES[snap.difficulty] ??
    SLOWMO_DIFFICULTY_PROFILES.medium;

  const cameraRef = useRef<THREE.OrthographicCamera>(null!);
  const ballRef = useRef<THREE.Mesh>(null!);
  const ballMaterialRef = useRef<THREE.MeshStandardMaterial>(null!);
  const shadowRef = useRef<THREE.Mesh>(null!);
  const shadowMaterialRef = useRef<THREE.MeshBasicMaterial>(null!);
  const slowRingRef = useRef<THREE.Mesh>(null!);
  const slowRingMaterialRef = useRef<THREE.MeshBasicMaterial>(null!);
  const trailMaterialRef = useRef<THREE.PointsMaterial>(null!);
  const wallGlowLeftRef = useRef<THREE.Mesh>(null!);
  const wallGlowRightRef = useRef<THREE.Mesh>(null!);
  const wallGlowLeftMaterialRef = useRef<THREE.MeshBasicMaterial>(null!);
  const wallGlowRightMaterialRef = useRef<THREE.MeshBasicMaterial>(null!);
  const impactGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const impactCoreMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const impactRingMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  const segmentGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const tunnelRingRefs = useRef<(THREE.Mesh | null)[]>([]);

  const obstacleGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const obstacleMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const starRefs = useRef<(THREE.Mesh | null)[]>([]);
  const giftRefs = useRef<(THREE.Mesh | null)[]>([]);

  const trailColorRef = useRef(new THREE.Color(THEME.trailBase));
  const impactColorScratchRef = useRef(new THREE.Color());
  const whiteColorRef = useRef(new THREE.Color('#ffffff'));

  const segments = useMemo(
    () =>
      Array.from({ length: SEG_COUNT }, (_, i) => ({
        id: i,
        z: i * SEG_LEN,
      })),
    []
  );

  const tunnelRings = useMemo(
    () =>
      Array.from({ length: GAME_TUNING.tunnel.ringCount }, (_, i) => ({
        id: i,
        z: i * GAME_TUNING.tunnel.spacing,
      })),
    []
  );

  const obstacles = useMemo(
    () =>
      Array.from({ length: GAME_TUNING.spawn.poolSize }, (_, i) =>
        createObstacleSlot(i)
      ),
    []
  );

  const impactSlots = useMemo(
    () => Array.from({ length: IMPACT_POOL_SIZE }, (_, i) => i),
    []
  );

  const trailData = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(GAME_TUNING.trail.length * 3);
    const colors = new Float32Array(GAME_TUNING.trail.length * 3);

    const positionAttr = new THREE.BufferAttribute(positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);

    const colorAttr = new THREE.BufferAttribute(colors, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);

    geometry.setAttribute('position', positionAttr);
    geometry.setAttribute('color', colorAttr);

    return {
      geometry,
      positions,
      colors,
      positionAttr,
      colorAttr,
    };
  }, []);

  useEffect(() => {
    return () => {
      trailData.geometry.dispose();
    };
  }, [trailData.geometry]);

  const world = useRef<WorldRuntime>({
    realTime: 0,
    gameTime: 0,
    runnerDistance: 0,
    nextSpawnAt: GAME_TUNING.spawn.initialSpawnZ,
    x: -(LANE_HALF - BALL_RADIUS),
    xVel: 0,
    sideDir: 1,
    timeScale: 1,
    targetScale: 1,
    slowEnergy: 1,
    slowStrength: 0,
    isSlow: false,
    cameraX: GAME_TUNING.camera.offsetX,
    cameraZ: GAME_TUNING.camera.offsetZ,
    cameraZoom: GAME_TUNING.camera.baseZoom,
    releaseKick: 0,
    bouncePulse: 0,
    ringPulse: 0,
    trailSampleAcc: 0,
    hudAccumulator: 0,
    fps: 60,
    wasSlow: false,
    visualSlowBucket: -1,
    wallPulseL: 0,
    wallPulseR: 0,
    impactCursor: 0,
    impacts: Array.from({ length: IMPACT_POOL_SIZE }, (_, i) =>
      createImpactFxSlot(i)
    ),
    trailPoints: Array.from(
      { length: GAME_TUNING.trail.length },
      () => new THREE.Vector3(0, BALL_RADIUS + 0.02, 0)
    ),
  });

  function resetTrail(x: number, z: number) {
    const y = BALL_RADIUS + 0.02;
    for (let i = 0; i < world.current.trailPoints.length; i++) {
      world.current.trailPoints[i].set(x, y, z);

      const index = i * 3;
      trailData.positions[index] = x;
      trailData.positions[index + 1] = y;
      trailData.positions[index + 2] = z;
      trailData.colors[index] = 0;
      trailData.colors[index + 1] = 0;
      trailData.colors[index + 2] = 0;
    }

    trailData.positionAttr.needsUpdate = true;
    trailData.colorAttr.needsUpdate = true;
  }

  function updateSlowVisualBucket() {
    const strength = world.current.slowStrength;
    const bucket = Math.round(strength / SLOW_VISUAL_STEP);
    if (bucket === world.current.visualSlowBucket) return;

    world.current.visualSlowBucket = bucket;

    const emissiveIntensity = 0.18 + strength * 0.45;
    const ringOpacity = 0.08 + strength * 0.14;

    for (let i = 0; i < obstacleMeshRefs.current.length; i++) {
      const mesh = obstacleMeshRefs.current[i];
      if (!mesh) continue;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = emissiveIntensity;
    }

    for (let i = 0; i < tunnelRingRefs.current.length; i++) {
      const ring = tunnelRingRefs.current[i];
      if (!ring) continue;
      const material = ring.material as THREE.MeshBasicMaterial;
      material.opacity = ringOpacity;
    }
  }

  function spawnImpactFx(
    kind: ImpactFxKind,
    x: number,
    y: number,
    z: number,
    color: THREE.ColorRepresentation,
    size: number,
    ttl: number,
    count = 1,
    vxBias = 0,
    vzBias = 0
  ) {
    const w = world.current;
    const burstCount = Math.max(1, count);

    for (let i = 0; i < burstCount; i += 1) {
      const fx = w.impacts[w.impactCursor % w.impacts.length];
      w.impactCursor += 1;

      const spread = kind === 'wall' ? 0.32 : kind === 'pickup' ? 0.62 : 0.46;
      fx.active = true;
      fx.kind = kind;
      fx.x = x + rand(-0.04, 0.04);
      fx.y = y + rand(-0.04, 0.06);
      fx.z = z + rand(-0.05, 0.05);
      fx.vx = vxBias + rand(-spread, spread);
      fx.vy = rand(0.2, 1.1) * (kind === 'pickup' ? 1.25 : 0.85);
      fx.vz = vzBias + rand(-spread, spread) * 0.28;
      fx.maxLife = ttl * rand(0.82, 1.18);
      fx.life = fx.maxLife;
      fx.size = size * rand(0.82, 1.18);
      fx.spin = rand(-6, 6);
      fx.color.set(color);
    }
  }

  function updateImpactVisuals(dt: number) {
    const w = world.current;
    const wallGlowZ = w.runnerDistance + SEG_LEN * 2.2;
    if (wallGlowLeftRef.current) wallGlowLeftRef.current.position.z = wallGlowZ;
    if (wallGlowRightRef.current) wallGlowRightRef.current.position.z = wallGlowZ;

    if (wallGlowLeftMaterialRef.current) {
      const leftOpacity = 0.08 + w.slowStrength * 0.05 + w.wallPulseL * 0.45;
      wallGlowLeftMaterialRef.current.opacity = leftOpacity;
      impactColorScratchRef.current
        .set(THEME.rails)
        .lerp(whiteColorRef.current, 0.1 + w.wallPulseL * 0.35);
      wallGlowLeftMaterialRef.current.color.copy(impactColorScratchRef.current);
    }

    if (wallGlowRightMaterialRef.current) {
      const rightOpacity = 0.08 + w.slowStrength * 0.05 + w.wallPulseR * 0.45;
      wallGlowRightMaterialRef.current.opacity = rightOpacity;
      impactColorScratchRef.current
        .set(THEME.rails)
        .lerp(whiteColorRef.current, 0.1 + w.wallPulseR * 0.35);
      wallGlowRightMaterialRef.current.color.copy(impactColorScratchRef.current);
    }

    for (let i = 0; i < w.impacts.length; i += 1) {
      const fx = w.impacts[i];
      const group = impactGroupRefs.current[i];
      const coreMaterial = impactCoreMaterialRefs.current[i];
      const ringMaterial = impactRingMaterialRefs.current[i];
      if (!fx.active || !group || !coreMaterial || !ringMaterial) {
        if (group) group.visible = false;
        continue;
      }

      fx.life -= dt;
      if (fx.life <= 0) {
        fx.active = false;
        group.visible = false;
        continue;
      }

      const age = 1 - fx.life / Math.max(0.001, fx.maxLife);
      fx.vx *= Math.exp(-2.2 * dt);
      fx.vy = fx.vy * Math.exp(-2.6 * dt) - 0.8 * dt;
      fx.vz *= Math.exp(-2.2 * dt);
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.z += fx.vz * dt;

      group.visible = true;
      group.position.set(fx.x, fx.y, fx.z);
      group.rotation.z += fx.spin * dt;

      const scaleCore = fx.size * (1 + age * 1.1);
      const scaleRing = fx.size * (1 + age * 2.2);
      const coreMesh = group.children[0] as THREE.Mesh | undefined;
      const ringMesh = group.children[1] as THREE.Mesh | undefined;
      if (coreMesh) coreMesh.scale.setScalar(scaleCore);
      if (ringMesh) ringMesh.scale.setScalar(scaleRing);

      const alpha = Math.max(0, 1 - age);
      coreMaterial.color.copy(fx.color);
      coreMaterial.opacity =
        alpha * (fx.kind === 'pickup' ? 0.85 : fx.kind === 'wall' ? 0.74 : 0.78);

      impactColorScratchRef.current.copy(fx.color).lerp(whiteColorRef.current, 0.28);
      ringMaterial.color.copy(impactColorScratchRef.current);
      ringMaterial.opacity = alpha * 0.68;
    }
  }

  function syncObstacleVisual(i: number) {
    const o = obstacles[i];
    const group = obstacleGroupRefs.current[i];
    const block = obstacleMeshRefs.current[i];
    const star = starRefs.current[i];
    const gift = giftRefs.current[i];

    if (!group || !block) return;

    group.visible = o.active;
    if (!o.active) return;

    group.position.set(0, 0, o.z);

    const { xMin, xMax } = obstacleXRange(o);
    const lenX = xMax - xMin;
    const x = (xMin + xMax) / 2;

    block.position.set(x, OBST_HEIGHT / 2, 0);
    block.scale.set(lenX, OBST_HEIGHT, OBST_THICK);

    const blockMaterial = block.material as THREE.MeshStandardMaterial;
    blockMaterial.color.set(o.color);
    blockMaterial.emissive.set(o.color);
    blockMaterial.emissiveIntensity = 0.18 + world.current.slowStrength * 0.45;

    if (star) {
      star.visible = o.hasStar && !o.starCollected;
      star.position.set(pickupX(o), 0.45, 0);
    }

    if (gift) {
      gift.visible = o.hasGift && !o.giftCollected;
      gift.position.set(pickupX(o), 0.42, 0);
    }
  }

  function takeInactiveSlot() {
    for (let i = 0; i < obstacles.length; i++) {
      if (!obstacles[i].active) return i;
    }
    return -1;
  }

  function spawnObstacleAt(slotIndex: number, z: number) {
    const fresh = makeObstacle(obstacles[slotIndex].id, z, difficultyProfile);
    Object.assign(obstacles[slotIndex], fresh, { active: true, z });
    syncObstacleVisual(slotIndex);
  }

  function fillSpawnHorizon() {
    let guard = obstacles.length * 2;
    while (
      world.current.nextSpawnAt <
        world.current.runnerDistance + difficultyProfile.spawnLookAhead &&
      guard > 0
    ) {
      const slot = takeInactiveSlot();
      if (slot < 0) break;

      spawnObstacleAt(slot, world.current.nextSpawnAt);
      world.current.nextSpawnAt += rand(
        difficultyProfile.spawnGapMin,
        difficultyProfile.spawnGapMax
      );

      guard -= 1;
    }
  }

  function publishHud(forwardSpeed: number) {
    const w = world.current;

    run.slow = w.isSlow;
    run.speed = forwardSpeed;
    run.lateralVel = w.xVel;
    run.timeScale = w.timeScale;
    run.targetScale = w.targetScale;
    run.slowEnergy = w.slowEnergy;
    run.distance = w.runnerDistance;
    run.slowStrength = w.slowStrength;
    run.vignette = THREE.MathUtils.clamp(
      w.slowStrength * 0.8 + w.releaseKick * 0.3,
      0,
      1
    );
    run.fps = w.fps;
  }

  useEffect(() => {
    if (snap.phase !== 'playing') {
      holdInput.isHolding = false;
      return;
    }

    load();

    run.score = 0;
    run.slow = false;
    run.speed = GAME_TUNING.forward.baseSpeed;
    run.lateralVel = 0;
    run.starsThisRun = 0;
    run.timeScale = 1;
    run.targetScale = 1;
    run.slowEnergy = 1;
    run.distance = 0;
    run.vignette = 0;
    run.slowStrength = 0;
    run.fps = 60;

    const startX = -(LANE_HALF - BALL_RADIUS);

    world.current.realTime = 0;
    world.current.gameTime = 0;
    world.current.runnerDistance = 0;
    world.current.nextSpawnAt = GAME_TUNING.spawn.initialSpawnZ;
    world.current.x = startX;
    world.current.xVel = 0;
    world.current.sideDir = 1;
    world.current.timeScale = 1;
    world.current.targetScale = 1;
    world.current.slowEnergy = 1;
    world.current.slowStrength = 0;
    world.current.isSlow = false;
    world.current.cameraX = startX + GAME_TUNING.camera.offsetX;
    world.current.cameraZ = GAME_TUNING.camera.offsetZ;
    world.current.cameraZoom = GAME_TUNING.camera.baseZoom;
    world.current.releaseKick = 0;
    world.current.bouncePulse = 0;
    world.current.ringPulse = 0;
    world.current.trailSampleAcc = 0;
    world.current.hudAccumulator = 0;
    world.current.fps = 60;
    world.current.wasSlow = false;
    world.current.visualSlowBucket = -1;
    world.current.wallPulseL = 0;
    world.current.wallPulseR = 0;
    world.current.impactCursor = 0;

    for (let i = 0; i < world.current.impacts.length; i += 1) {
      const fx = world.current.impacts[i];
      fx.active = false;
      fx.life = 0;
      fx.vx = 0;
      fx.vy = 0;
      fx.vz = 0;
    }

    resetTrail(startX, 0);

    for (let i = 0; i < segments.length; i++) {
      segments[i].z = i * SEG_LEN;
    }

    for (let i = 0; i < tunnelRings.length; i++) {
      tunnelRings[i].z = i * GAME_TUNING.tunnel.spacing;
    }

    for (let i = 0; i < obstacles.length; i++) {
      Object.assign(obstacles[i], createObstacleSlot(obstacles[i].id));
      const group = obstacleGroupRefs.current[i];
      if (group) group.visible = false;
    }

    fillSpawnHorizon();
    updateSlowVisualBucket();
    publishHud(GAME_TUNING.forward.baseSpeed);

    requestAnimationFrame(() => {
      for (let i = 0; i < obstacles.length; i++) {
        syncObstacleVisual(i);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const cam = cameraRef.current;
    const w = world.current;

    if (snap.phase !== 'playing') {
      const lz = Math.max(0, w.runnerDistance) + GAME_TUNING.camera.lookAhead;
      cam.position.set(
        w.x + GAME_TUNING.camera.offsetX,
        GAME_TUNING.camera.height,
        lz + GAME_TUNING.camera.offsetZ
      );
      cam.lookAt(w.x, 0, lz);
      w.wallPulseL = expDamp(w.wallPulseL, 0, 10.5, delta);
      w.wallPulseR = expDamp(w.wallPulseR, 0, 10.5, delta);
      updateImpactVisuals(delta);
      return;
    }

    w.realTime += delta;

    if (holdInput.isHolding && w.slowEnergy > 0) {
      w.slowEnergy = Math.max(
        0,
        w.slowEnergy -
          GAME_TUNING.energy.drainPerSecond *
            difficultyProfile.energyDrainMultiplier *
            delta
      );
    } else {
      w.slowEnergy = Math.min(
        1,
        w.slowEnergy +
          GAME_TUNING.energy.regenPerSecond *
            difficultyProfile.energyRegenMultiplier *
            delta
      );
    }

    const canSlow = w.slowEnergy > 0.001;
    w.targetScale = holdInput.isHolding && canSlow ? GAME_TUNING.slow.factor : 1;

    const rampLambda =
      w.targetScale < w.timeScale
        ? GAME_TUNING.slow.lambdaIn
        : GAME_TUNING.slow.lambdaOut;
    w.timeScale = expDamp(w.timeScale, w.targetScale, rampLambda, delta);

    // Forward world progression is invariant; only lateral dynamics are time-dilated.
    const lateralScale = Math.pow(w.timeScale, 1.35);
    const lateralDt = delta * lateralScale;
    w.gameTime += delta;

    w.slowStrength = THREE.MathUtils.clamp(
      (1 - w.timeScale) / (1 - GAME_TUNING.slow.factor),
      0,
      1
    );
    w.isSlow = w.slowStrength > 0.08;

    const forwardSpeed =
      GAME_TUNING.forward.baseSpeed +
      run.score *
        GAME_TUNING.forward.scoreRamp *
        difficultyProfile.scoreRampMultiplier;
    w.runnerDistance += forwardSpeed * delta;

    const targetXVel = w.sideDir * GAME_TUNING.side.baseSpeed;
    const response = GAME_TUNING.side.responseLambda * (0.72 + 0.28 * w.timeScale);
    const drag = THREE.MathUtils.lerp(
      GAME_TUNING.side.dragSlow,
      GAME_TUNING.side.dragBase,
      w.timeScale
    );
    const accel = (targetXVel - w.xVel) * response - drag * w.xVel;
    w.xVel += accel * lateralDt;
    w.xVel = THREE.MathUtils.clamp(
      w.xVel,
      -GAME_TUNING.side.maxSpeed,
      GAME_TUNING.side.maxSpeed
    );
    w.x += w.xVel * lateralDt;

    const bound = LANE_HALF - BALL_RADIUS;
    if (w.x > bound) {
      const penetration = w.x - bound;
      w.x = bound - penetration * GAME_TUNING.side.wallSpring;
      if (w.xVel > 0) {
        w.xVel = -w.xVel * GAME_TUNING.side.wallRestitution;
      }
      w.sideDir = -1;
      w.bouncePulse = 1;
      w.wallPulseR = 1;
      spawnImpactFx(
        'wall',
        bound + 0.03,
        BALL_RADIUS + 0.08,
        w.runnerDistance,
        THEME.rails,
        0.13,
        0.24,
        5,
        -0.45,
        0
      );
    } else if (w.x < -bound) {
      const penetration = -bound - w.x;
      w.x = -bound + penetration * GAME_TUNING.side.wallSpring;
      if (w.xVel < 0) {
        w.xVel = -w.xVel * GAME_TUNING.side.wallRestitution;
      }
      w.sideDir = 1;
      w.bouncePulse = 1;
      w.wallPulseL = 1;
      spawnImpactFx(
        'wall',
        -bound - 0.03,
        BALL_RADIUS + 0.08,
        w.runnerDistance,
        THEME.rails,
        0.13,
        0.24,
        5,
        0.45,
        0
      );
    }

    w.bouncePulse = expDamp(w.bouncePulse, 0, 12, delta);
    w.ringPulse += delta * (w.isSlow ? 8 : 4);
    w.wallPulseL = expDamp(w.wallPulseL, 0, 10.5, delta);
    w.wallPulseR = expDamp(w.wallPulseR, 0, 10.5, delta);
    updateImpactVisuals(delta);

    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (!o.active) continue;

      if (o.z < w.runnerDistance - GAME_TUNING.spawn.respawnBehind) {
        o.active = false;
        o.hasGift = false;
        o.hasStar = false;
        o.starCollected = true;
        o.giftCollected = true;
        const group = obstacleGroupRefs.current[i];
        if (group) group.visible = false;
      }
    }

    fillSpawnHorizon();

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.z < w.runnerDistance - SEG_LEN) {
        seg.z += SEG_COUNT * SEG_LEN;
      }
      const group = segmentGroupRefs.current[i];
      if (group) group.position.z = seg.z;
    }

    const ringLoopLength =
      GAME_TUNING.tunnel.ringCount * GAME_TUNING.tunnel.spacing;
    for (let i = 0; i < tunnelRings.length; i++) {
      const ring = tunnelRings[i];
      if (ring.z < w.runnerDistance - GAME_TUNING.tunnel.spacing) {
        ring.z += ringLoopLength;
      }
      const mesh = tunnelRingRefs.current[i];
      if (mesh) {
        mesh.position.z = ring.z;
        mesh.rotation.z = w.realTime * 0.12 + i * 0.22;
      }
    }

    updateSlowVisualBucket();

    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (!o.active) continue;

      if (!o.passed && w.runnerDistance > o.z + 0.8) {
        o.passed = true;
        run.score += 1;
      }

      if (o.hasStar && !o.starCollected) {
        const dx = Math.abs(w.x - pickupX(o));
        const dz = Math.abs(w.runnerDistance - o.z);
        if (dx < 0.38 && dz < 0.55) {
          o.starCollected = true;
          run.starsThisRun += 1;
          w.slowEnergy = Math.min(1, w.slowEnergy + 0.08);
          addStars(1);
          spawnImpactFx(
            'pickup',
            pickupX(o),
            0.46,
            o.z,
            '#ffd36a',
            0.16,
            0.3,
            7
          );
          const star = starRefs.current[i];
          if (star) star.visible = false;
        }
      }

      if (o.hasGift && !o.giftCollected) {
        const dx = Math.abs(w.x - pickupX(o));
        const dz = Math.abs(w.runnerDistance - o.z);
        if (dx < 0.42 && dz < 0.6) {
          o.giftCollected = true;
          const bonus = Math.floor(rand(4, 8));
          run.starsThisRun += bonus;
          w.slowEnergy = Math.min(1, w.slowEnergy + GAME_TUNING.energy.pickupRefill);
          addStars(bonus);
          spawnImpactFx(
            'pickup',
            pickupX(o),
            0.42,
            o.z,
            '#ffffff',
            0.2,
            0.34,
            9
          );
          const gift = giftRefs.current[i];
          if (gift) gift.visible = false;
        }
      }

      const dz = Math.abs(w.runnerDistance - o.z);
      if (dz < OBST_THICK / 2 + BALL_RADIUS * 0.95) {
        const { xMin, xMax } = obstacleXRange(o);
        const inX = w.x + BALL_RADIUS > xMin && w.x - BALL_RADIUS < xMax;
        if (inX) {
          spawnImpactFx(
            'obstacle',
            w.x,
            BALL_RADIUS + 0.04,
            w.runnerDistance,
            o.color,
            0.24,
            0.34,
            10
          );
          setHighScore(run.score);
          holdInput.isHolding = false;
          publishHud(forwardSpeed);
          persistState.finish();
          return;
        }
      }

      const group = obstacleGroupRefs.current[i];
      if (group) group.position.z = o.z;

      const star = starRefs.current[i];
      if (star && star.visible) {
        star.rotation.y += delta * 3.2;
        star.rotation.x += delta * 2.2;
      }

      const gift = giftRefs.current[i];
      if (gift && gift.visible) {
        gift.rotation.y += delta * 1.6;
      }
    }

    const ballY = BALL_RADIUS + 0.02;
    ballRef.current.position.set(w.x, ballY, w.runnerDistance);
    shadowRef.current.position.set(w.x, 0.01, w.runnerDistance);

    const stretch = 1 + w.bouncePulse * 0.18 + w.slowStrength * 0.06;
    const squeeze = 1 - w.bouncePulse * 0.1;
    ballRef.current.scale.set(stretch, squeeze, stretch);

    ballMaterialRef.current.emissiveIntensity = 0.08 + w.slowStrength * 0.7;
    shadowMaterialRef.current.opacity = 0.16 + w.bouncePulse * 0.06;

    slowRingRef.current.position.set(w.x, ballY, w.runnerDistance);
    slowRingRef.current.rotation.set(Math.PI / 2, 0, w.realTime * 2.2);
    const ringPulse = Math.sin(w.ringPulse) * 0.06;
    slowRingRef.current.scale.setScalar(
      0.9 + w.slowStrength * 0.32 + w.bouncePulse * 0.08 + ringPulse
    );
    slowRingMaterialRef.current.opacity = 0.12 + w.slowStrength * 0.38;

    w.trailSampleAcc += delta;
    const sampleEvery = w.isSlow
      ? GAME_TUNING.trail.sampleSlow
      : GAME_TUNING.trail.sampleNormal;

    if (w.trailSampleAcc >= sampleEvery) {
      w.trailSampleAcc = 0;
      const recycled = w.trailPoints.pop();
      if (recycled) {
        recycled.set(w.x, ballY, w.runnerDistance);
        w.trailPoints.unshift(recycled);
      }
    } else {
      w.trailPoints[0].set(w.x, ballY, w.runnerDistance);
    }

    trailColorRef.current.set(w.isSlow ? THEME.trailSlow : THEME.trailBase);
    const trailBoost = w.isSlow ? 1 : 0.72;

    for (let i = 0; i < GAME_TUNING.trail.length; i++) {
      const p = w.trailPoints[i];
      const idx = i * 3;

      trailData.positions[idx] = p.x;
      trailData.positions[idx + 1] = p.y;
      trailData.positions[idx + 2] = p.z;

      const fade = (1 - i / (GAME_TUNING.trail.length - 1)) ** 2 * trailBoost;
      trailData.colors[idx] = trailColorRef.current.r * fade;
      trailData.colors[idx + 1] = trailColorRef.current.g * fade;
      trailData.colors[idx + 2] = trailColorRef.current.b * fade;
    }

    trailData.positionAttr.needsUpdate = true;
    trailData.colorAttr.needsUpdate = true;
    trailMaterialRef.current.opacity = 0.58 + w.slowStrength * 0.25;
    trailMaterialRef.current.size = GAME_TUNING.trail.size * (w.isSlow ? 1.18 : 1);

    if (w.wasSlow && !w.isSlow) {
      w.releaseKick = 1;
    }
    w.wasSlow = w.isSlow;
    w.releaseKick = expDamp(w.releaseKick, 0, GAME_TUNING.camera.releaseDamp, delta);

    w.cameraX = expDamp(
      w.cameraX,
      w.x + GAME_TUNING.camera.offsetX,
      GAME_TUNING.camera.followLambda,
      delta
    );
    w.cameraZ = expDamp(
      w.cameraZ,
      w.runnerDistance + GAME_TUNING.camera.offsetZ,
      GAME_TUNING.camera.followLambda,
      delta
    );
    w.cameraZoom = expDamp(
      w.cameraZoom,
      w.isSlow ? GAME_TUNING.camera.slowZoom : GAME_TUNING.camera.baseZoom,
      GAME_TUNING.camera.zoomLambda,
      delta
    );

    const shake =
      Math.sin(w.realTime * 90) * GAME_TUNING.camera.releaseShake * w.releaseKick;

    cam.position.set(
      w.cameraX + shake,
      GAME_TUNING.camera.height + w.releaseKick * 0.08,
      w.cameraZ - shake * 0.5
    );

    if (Math.abs(cam.zoom - w.cameraZoom) > 0.001) {
      cam.zoom = w.cameraZoom;
      cam.updateProjectionMatrix();
    }

    cam.lookAt(w.x, 0, w.runnerDistance + GAME_TUNING.camera.lookAhead);

    w.fps = expDamp(w.fps, 1 / Math.max(delta, 0.0001), 10, delta);

    w.hudAccumulator += delta;
    if (w.hudAccumulator >= HUD_PUBLISH_INTERVAL) {
      w.hudAccumulator = 0;
      publishHud(forwardSpeed);
    }
  });

  return (
    <>
      <OrthographicCamera
        ref={cameraRef}
        makeDefault
        zoom={GAME_TUNING.camera.baseZoom}
        near={0.1}
        far={1000}
        position={[
          GAME_TUNING.camera.offsetX,
          GAME_TUNING.camera.height,
          GAME_TUNING.camera.offsetZ,
        ]}
      />

      <color attach="background" args={[THEME.background]} />
      <fog attach="fog" args={[THEME.fog, 10, 44]} />

      <ambientLight intensity={0.55} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.05}
        color="#eff7ff"
      />
      <pointLight
        position={[0, 2.3, 2]}
        intensity={2.2}
        distance={18}
        color="#2fffe0"
      />
      <pointLight
        position={[0, 2.6, -4]}
        intensity={1.6}
        distance={20}
        color="#7ea4ff"
      />
      <pointLight
        position={[-TRACK_WIDTH * 0.72, 1.2, 5]}
        intensity={0.9}
        distance={20}
        color="#7effe1"
      />
      <pointLight
        position={[TRACK_WIDTH * 0.72, 1.2, 5]}
        intensity={0.9}
        distance={20}
        color="#7effe1"
      />

      {segments.map((seg, i) => (
        <group
          key={seg.id}
          ref={(el) => {
            segmentGroupRefs.current[i] = el;
          }}
          position={[0, 0, seg.z]}
        >
          <mesh position={[0, -TRACK_THICK / 2, SEG_LEN / 2]}>
            <boxGeometry args={[TRACK_WIDTH, TRACK_THICK, SEG_LEN]} />
            <meshStandardMaterial
              color={THEME.track}
              roughness={0.78}
              metalness={0.08}
            />
          </mesh>

          <mesh
            position={[
              -(TRACK_WIDTH / 2 - RAIL_WIDTH / 2),
              TRACK_THICK * 0.16,
              SEG_LEN / 2,
            ]}
          >
            <boxGeometry args={[RAIL_WIDTH, TRACK_THICK * 1.2, SEG_LEN]} />
            <meshStandardMaterial
              color={THEME.rails}
              emissive={THEME.rails}
              emissiveIntensity={0.45}
              roughness={0.32}
            />
          </mesh>

          <mesh
            position={[
              TRACK_WIDTH / 2 - RAIL_WIDTH / 2,
              TRACK_THICK * 0.16,
              SEG_LEN / 2,
            ]}
          >
            <boxGeometry args={[RAIL_WIDTH, TRACK_THICK * 1.2, SEG_LEN]} />
            <meshStandardMaterial
              color={THEME.rails}
              emissive={THEME.rails}
              emissiveIntensity={0.45}
              roughness={0.32}
            />
          </mesh>

          <mesh
            position={[0, 0.003, SEG_LEN / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[TRACK_WIDTH - RAIL_WIDTH * 2 - 0.14, 0.14]} />
            <meshBasicMaterial
              color={THEME.stripe}
              transparent
              opacity={seg.id % 2 === 0 ? 0.2 : 0.08}
            />
          </mesh>
        </group>
      ))}

      <mesh
        ref={wallGlowLeftRef}
        position={[-(TRACK_WIDTH / 2 - RAIL_WIDTH * 0.5), 0.06, SEG_LEN]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.16, SEG_LEN * 8]} />
        <meshBasicMaterial
          ref={wallGlowLeftMaterialRef}
          color={THEME.rails}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh
        ref={wallGlowRightRef}
        position={[TRACK_WIDTH / 2 - RAIL_WIDTH * 0.5, 0.06, SEG_LEN]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.16, SEG_LEN * 8]} />
        <meshBasicMaterial
          ref={wallGlowRightMaterialRef}
          color={THEME.rails}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {tunnelRings.map((ring, i) => (
        <mesh
          key={ring.id}
          ref={(el) => {
            tunnelRingRefs.current[i] = el;
          }}
          position={[0, 0.48, ring.z]}
          rotation={[0, 0, i * 0.22]}
        >
          <torusGeometry args={[GAME_TUNING.tunnel.radius, 0.035, 12, 52]} />
          <meshBasicMaterial
            color={THEME.tunnelRing}
            transparent
            opacity={0.08}
          />
        </mesh>
      ))}

      {obstacles.map((o, i) => (
        <group
          key={o.id}
          ref={(el) => {
            obstacleGroupRefs.current[i] = el;
          }}
          position={[0, 0, o.z]}
          visible={o.active}
        >
          <mesh
            ref={(el) => {
              obstacleMeshRefs.current[i] = el;
            }}
            position={[0, OBST_HEIGHT / 2, 0]}
            scale={[o.lenX, OBST_HEIGHT, OBST_THICK]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={o.color}
              emissive={o.color}
              emissiveIntensity={0.2}
              roughness={0.5}
              metalness={0.05}
            />
          </mesh>

          <mesh
            ref={(el) => {
              starRefs.current[i] = el;
            }}
            visible={o.hasStar && !o.starCollected}
            position={[pickupX(o), 0.45, 0]}
          >
            <octahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial
              color="#ffd36a"
              emissive="#ffd36a"
              emissiveIntensity={0.35}
              roughness={0.2}
              metalness={0.28}
            />
          </mesh>

          <mesh
            ref={(el) => {
              giftRefs.current[i] = el;
            }}
            visible={o.hasGift && !o.giftCollected}
            position={[pickupX(o), 0.42, 0]}
          >
            <boxGeometry args={[0.22, 0.22, 0.22]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fff0aa"
              emissiveIntensity={0.25}
              roughness={0.22}
              metalness={0.1}
            />
          </mesh>
        </group>
      ))}

      {impactSlots.map((slot) => (
        <group
          key={`impact-${slot}`}
          ref={(el) => {
            impactGroupRefs.current[slot] = el;
          }}
          visible={false}
          position={[0, BALL_RADIUS, 0]}
        >
          <mesh>
            <sphereGeometry args={[1, 12, 12]} />
            <meshBasicMaterial
              ref={(el) => {
                impactCoreMaterialRefs.current[slot] = el;
              }}
              color="#ffffff"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1, 0.16, 10, 28]} />
            <meshBasicMaterial
              ref={(el) => {
                impactRingMaterialRefs.current[slot] = el;
              }}
              color="#ffffff"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}

      <points geometry={trailData.geometry} frustumCulled={false}>
        <pointsMaterial
          ref={trailMaterialRef}
          size={GAME_TUNING.trail.size}
          vertexColors
          transparent
          depthWrite={false}
          opacity={0.58}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <mesh ref={ballRef} position={[0, BALL_RADIUS, 0]}>
        <sphereGeometry args={[BALL_RADIUS, 28, 28]} />
        <meshStandardMaterial
          ref={ballMaterialRef}
          color={BALL_SKINS[snap.selectedBall]?.color ?? '#ffffff'}
          emissive={BALL_SKINS[snap.selectedBall]?.color ?? '#ffffff'}
          emissiveIntensity={0.08}
          roughness={0.25}
          metalness={0.08}
        />
      </mesh>

      <mesh
        ref={shadowRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      >
        <circleGeometry args={[BALL_RADIUS * 1.18, 20]} />
        <meshBasicMaterial
          ref={shadowMaterialRef}
          color="#000000"
          opacity={0.16}
          transparent
        />
      </mesh>

      <mesh
        ref={slowRingRef}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, BALL_RADIUS + 0.02, 0]}
      >
        <torusGeometry args={[BALL_RADIUS * 0.9, 0.05, 12, 32]} />
        <meshBasicMaterial
          ref={slowRingMaterialRef}
          color={THEME.ring}
          opacity={0.12}
          transparent
        />
      </mesh>
    </>
  );
}

function SlowMoHoldInputLayer() {
  const snap = useSnapshot(persistState);
  const activePointerId = useRef<number | null>(null);
  const pointerHolding = useRef(false);
  const keyHolding = useRef(false);

  const syncHoldState = () => {
    holdInput.isHolding =
      snap.phase === 'playing' &&
      (pointerHolding.current || keyHolding.current);
  };

  const releasePointer = () => {
    activePointerId.current = null;
    pointerHolding.current = false;
  };

  const clearAllHolds = () => {
    releasePointer();
    keyHolding.current = false;
    holdInput.isHolding = false;
  };

  useEffect(() => {
    if (snap.phase !== 'playing') {
      clearAllHolds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (snap.phase !== 'playing') return;
      if (event.code !== 'Space' && event.key !== ' ') return;
      event.preventDefault();
      keyHolding.current = true;
      syncHoldState();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      keyHolding.current = false;
      syncHoldState();
    };

    const onBlur = () => {
      clearAllHolds();
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearAllHolds();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.phase]);

  const releaseFromPointerEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointerId.current) return;
    releasePointer();
    syncHoldState();
  };

  return (
    <div
      className={`absolute inset-0 ${snap.phase === 'playing' ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(event) => {
        if (snap.phase !== 'playing') return;
        if (activePointerId.current !== null) return;
        activePointerId.current = event.pointerId;
        pointerHolding.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        syncHoldState();
      }}
      onPointerUp={releaseFromPointerEvent}
      onPointerCancel={releaseFromPointerEvent}
      onLostPointerCapture={releaseFromPointerEvent}
      onPointerLeave={(event) => {
        if (event.pointerId !== activePointerId.current) return;
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          releasePointer();
          syncHoldState();
        }
      }}
    />
  );
}

function SlowMoOverlay() {
  const snap = useSnapshot(persistState);
  const r = useSnapshot(run);
  const difficultyProfile =
    SLOWMO_DIFFICULTY_PROFILES[snap.difficulty] ??
    SLOWMO_DIFFICULTY_PROFILES.medium;

  const handleTapStart = () => {
    if (snap.phase === 'menu') persistState.start();
  };

  const handleReplay = () => {
    if (snap.phase === 'finish') persistState.start();
  };

  const handleBackToMenu = () => {
    if (snap.phase === 'finish') persistState.backToMenu();
  };

  const energyPct = Math.round(r.slowEnergy * 100);

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 42%, rgba(7,14,26,0) 34%, rgba(2,4,12,${0.38 + r.vignette * 0.42}) 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `rgba(92, 178, 255, ${0.03 + r.vignette * 0.12})`,
          mixBlendMode: 'screen',
        }}
      />

      {snap.phase === 'playing' && (
        <>
          <div className="absolute top-4 left-0 right-0 flex items-center justify-center">
            <div className="px-5 py-2 rounded-full bg-black/35 text-white font-bold text-4xl tracking-wide border border-white/20">
              {r.score}
            </div>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <div className="px-3 py-2 rounded-full bg-black/30 text-white font-semibold border border-white/15">
              Star {snap.stars}
            </div>
            <div className="px-3 py-2 rounded-full bg-black/30 text-white font-semibold border border-white/15">
              {difficultyProfile.label}
            </div>
            {r.slow && (
              <div className="px-3 py-2 rounded-full bg-cyan-200/20 text-cyan-50 font-semibold border border-cyan-100/30">
                LATERAL x{r.timeScale.toFixed(2)}
              </div>
            )}
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[min(360px,80vw)]">
            <div className="px-4 py-3 rounded-2xl bg-black/35 border border-white/20 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs tracking-wide text-cyan-50/85 mb-2">
                <span>Slow Energy</span>
                <span>{energyPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-black/45 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-lime-300"
                  style={{ width: `${energyPct}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-white/75 text-center">
                Hold anywhere or press Space
              </div>
            </div>
          </div>

          {isDev && (
            <div className="absolute left-4 bottom-4 px-3 py-2 rounded-lg bg-black/50 text-[11px] text-cyan-100 font-mono leading-5 border border-cyan-100/20">
              <div>FPS: {r.fps.toFixed(0)}</div>
              <div>timeScale: {r.timeScale.toFixed(3)}</div>
              <div>targetScale: {r.targetScale.toFixed(2)}</div>
              <div>forwardSpeed: {r.speed.toFixed(2)}</div>
              <div>lateralVel: {r.lateralVel.toFixed(2)}</div>
              <div>slowEnergy: {r.slowEnergy.toFixed(2)}</div>
              <div>distance: {r.distance.toFixed(1)}</div>
            </div>
          )}
        </>
      )}

      {snap.phase === 'menu' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-between p-6 pointer-events-auto cursor-pointer"
          onClick={handleTapStart}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleTapStart();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Tap to start"
        >
          <div />

          <div className="flex flex-col items-center gap-3 text-center max-w-md">
            <div className="text-6xl font-black text-white drop-shadow">
              SlowMo
            </div>
            <div className="text-cyan-50/95 text-lg">
              Bend time to survive. Forward velocity stays constant while
              lateral oscillation slows.
            </div>
            <div className="text-white/80 text-sm">
              Hold anywhere to damp side drift. Release to snap oscillation
              back to speed.
            </div>
            <div className="text-white/70 text-xs">
              Default mode is Medium. Switch difficulty before starting.
            </div>
            <div className="text-white/70 text-xs">
              Collect stars and gifts to unlock skins and refill slow energy.
            </div>
          </div>

          <div
            className="w-full max-w-md flex flex-col gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-black/35 rounded-2xl p-4 border border-white/20 backdrop-blur-sm">
              <div className="text-white font-semibold mb-3">Difficulty</div>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTY_ORDER.map((difficulty) => {
                  const profile = SLOWMO_DIFFICULTY_PROFILES[difficulty];
                  const active = snap.difficulty === difficulty;
                  return (
                    <button
                      key={difficulty}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                        active
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                      onClick={() => persistState.setDifficulty(difficulty)}
                    >
                      {profile.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-white/70 text-xs mt-2">
                {difficultyProfile.description}
              </div>
            </div>

            <div className="bg-black/35 rounded-2xl p-4 border border-white/20 backdrop-blur-sm">
              <div className="text-white font-semibold mb-3">Balls</div>
              <div className="flex gap-2 flex-wrap">
                {BALL_SKINS.map((skin) => {
                  const unlocked = snap.unlockedBallIds.includes(skin.id);
                  const selected = snap.selectedBall === skin.id;
                  const afford = canUnlockBall(skin.id);

                  return (
                    <button
                      key={skin.id}
                      className={`relative w-14 h-14 rounded-full border-2 ${selected ? 'border-white' : 'border-white/30'} ${unlocked ? '' : 'opacity-70'}`}
                      style={{ background: skin.color }}
                      onClick={() => {
                        if (unlocked) {
                          setSelectedBall(skin.id);
                          return;
                        }
                        if (afford) {
                          unlockBall(skin.id);
                          setSelectedBall(skin.id);
                        }
                      }}
                      title={
                        unlocked ? skin.name : `${skin.name} - ${skin.cost}★`
                      }
                    >
                      {!unlocked && (
                        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white text-xs font-bold">
                          {skin.cost}★
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="text-white/85 text-sm mt-3">
                Stars: {snap.stars}
              </div>
            </div>

            <div className="text-center text-white/90 font-semibold tracking-wide">
              TAP TO START
            </div>
          </div>
        </div>
      )}

      {snap.phase === 'finish' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
          <div className="text-white text-5xl font-black drop-shadow">
            Game Over
          </div>
          <div className="text-white/90 text-xl font-bold">
            Score: {r.score}
          </div>
          <div className="text-white/70">Best: {snap.highScore}</div>
          <div className="text-white/80">Star +{r.starsThisRun} this run</div>
          <div className="text-white/75 text-sm">
            Difficulty: {difficultyProfile.label}
          </div>

          <div className="pointer-events-auto flex gap-3 mt-4">
            <button
              className="px-6 py-3 rounded-xl bg-white text-black font-bold"
              onClick={handleReplay}
            >
              Replay
            </button>
            <button
              className="px-6 py-3 rounded-xl bg-black/45 text-white font-bold"
              onClick={handleBackToMenu}
            >
              Menu
            </button>
          </div>

          <div className="text-white/65 text-xs mt-4 text-center max-w-xs">
            Lock your lane with slow, then release for aggressive side
            repositioning.
          </div>
        </div>
      )}
    </div>
  );
}

export { state as slowMoState } from './state';

export default function SlowMo() {
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <SlowMoScene />
      <FixedViewportOverlay pointerEvents="auto">
        <div className="fixed inset-0 pointer-events-auto select-none">
          <SlowMoHoldInputLayer />
          <SlowMoOverlay />
        </div>
      </FixedViewportOverlay>
    </>
  );
}
