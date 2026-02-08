'use client';

import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';
import { GAME } from './constants';
import { OctaSurgeUI } from './_components/OctaSurgeUI';
import { octaSurgeState } from './state';
import type {
  CollectibleData,
  CollectibleType,
  CollectionEffect,
  ObstacleData,
  ObstacleType,
} from './types';

const TWO_PI = Math.PI * 2;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function wrapAngle(a: number) {
  let x = a % TWO_PI;
  if (x < -Math.PI) x += TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
  return x;
}

function wrapFaceFloat(v: number) {
  let x = v % GAME.faces;
  if (x < 0) x += GAME.faces;
  return x;
}

function smallestAngleDiff(a: number, b: number) {
  return wrapAngle(a - b);
}

function sweptRelativeAngleAbsDiff(
  targetPrevAngle: number,
  targetNextAngle: number,
  subjectPrevAngle: number,
  subjectNextAngle: number
) {
  const fromPrev = smallestAngleDiff(targetPrevAngle, subjectPrevAngle);
  const fromNext = smallestAngleDiff(targetNextAngle, subjectNextAngle);

  // If the sweep crossed the target between frames, treat as an exact pass.
  if (
    (fromPrev < 0 && fromNext > 0) ||
    (fromPrev > 0 && fromNext < 0) ||
    fromPrev === 0 ||
    fromNext === 0
  ) {
    return 0;
  }

  return Math.min(Math.abs(fromPrev), Math.abs(fromNext));
}

function faceAngle() {
  return TWO_PI / GAME.faces;
}

function zOverlap(
  aCenter: number,
  aHalf: number,
  bCenter: number,
  bHalf: number
): boolean {
  return aCenter - aHalf < bCenter + bHalf && aCenter + aHalf > bCenter - bHalf;
}

function pickObstacleType(rng: SeededRandom, hazard: number): ObstacleType {
  const r = rng.random();
  if (r < 0.14 + hazard * 0.24) return 'wedge';
  if (r < 0.48 + hazard * 0.26) return 'hole';
  return 'bump';
}

function obstaclePrimaryFace(o: ObstacleData): number {
  let idx = Math.round(o.faceFloat) % GAME.faces;
  if (idx < 0) idx += GAME.faces;
  return idx;
}

function obstacleBlockedFaces(o: ObstacleData): number[] {
  const base = obstaclePrimaryFace(o);
  if (o.span <= 1) return [base];
  const dir = o.faceVel >= 0 ? 1 : -1;
  const out: number[] = [base];
  for (let i = 1; i < o.span; i++) {
    let idx = (base + dir * i) % GAME.faces;
    if (idx < 0) idx += GAME.faces;
    out.push(idx);
  }
  return out;
}

function collectibleTypeByIndex(i: number): CollectibleType {
  if (i < GAME.collectibleCount) return 'normal';
  if (i < GAME.collectibleCount + GAME.specialCollectibleCount)
    return 'special';
  if (
    i <
    GAME.collectibleCount +
      GAME.specialCollectibleCount +
      GAME.boostCollectibleCount
  ) {
    return 'boost';
  }
  return 'shield';
}

function collectibleRadius(type: CollectibleType): number {
  if (type === 'special') return GAME.specialHitRadius;
  if (type === 'normal') return GAME.collectibleHitRadius;
  return GAME.powerupHitRadius;
}

function collectibleBasePoints(type: CollectibleType): number {
  switch (type) {
    case 'special':
      return GAME.pointsSpecial;
    case 'boost':
      return GAME.pointsBoost;
    case 'shield':
      return GAME.pointsShield;
    default:
      return GAME.pointsNormal;
  }
}

function collectibleColors(type: CollectibleType) {
  if (type === 'special') {
    return {
      color: '#A78BFA',
      emissive: '#7C3AED',
      glow: '#C4B5FD',
    };
  }
  if (type === 'boost') {
    return {
      color: '#F97316',
      emissive: '#EA580C',
      glow: '#FDBA74',
    };
  }
  if (type === 'shield') {
    return {
      color: '#2DD4BF',
      emissive: '#0F766E',
      glow: '#99F6E4',
    };
  }
  return {
    color: '#FBBF24',
    emissive: '#F59E0B',
    glow: '#FDE68A',
  };
}

function placeCollectibleInGap(
  c: CollectibleData,
  obstacles: ObstacleData[],
  rng: SeededRandom,
  leadMin: number,
  leadMax: number
) {
  if (obstacles.length < 2) return;
  const depth = GAME.obstacleDepth;
  const half = depth / 2;
  const sorted = [...obstacles].sort((a, b) => a.z - b.z);
  const gaps: { z: number; blocked: Set<number> }[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gapSize = b.z - a.z - depth;
    if (gapSize < 3.1) continue;

    const mid = (a.z + b.z) / 2;
    const blocked = new Set<number>();
    for (const o of obstacles) {
      if (zOverlap(o.z, half, mid, 3.4)) {
        const faces = obstacleBlockedFaces(o);
        for (const f of faces) blocked.add(f);
      }
    }
    gaps.push({ z: mid, blocked });
  }

  if (gaps.length === 0) return;

  const g = rng.pick(gaps);
  const safeFaces = Array.from({ length: GAME.faces }, (_, i) => i).filter(
    (f) => !g.blocked.has(f)
  );
  const face =
    safeFaces.length > 0 ? rng.pick(safeFaces) : rng.int(0, GAME.faces - 1);

  c.faceIndex = face;
  c.z = g.z + rng.float(leadMin, leadMax);
  c.prevZ = c.z;
  c.collected = false;
  c.bobPhase = rng.float(0, TWO_PI);
  c.spinRate = rng.float(0.7, 1.6);
  delete c.respawnAt;
}

function placeSpecialCollectible(
  c: CollectibleData,
  obstacles: ObstacleData[],
  rng: SeededRandom
) {
  if (obstacles.length === 0) return;
  const o = rng.pick(obstacles);
  const blockedFaces = obstacleBlockedFaces(o);
  c.faceIndex = rng.pick(blockedFaces);
  c.z =
    o.z +
    GAME.obstacleDepth / 2 +
    rng.float(GAME.specialZOffsetMin, GAME.specialZOffsetMax);
  c.prevZ = c.z;
  c.collected = false;
  c.bobPhase = rng.float(0, TWO_PI);
  c.spinRate = rng.float(1.4, 2.6);
  delete c.respawnAt;
}

function respawnCollectible(
  c: CollectibleData,
  obstacles: ObstacleData[],
  rng: SeededRandom
) {
  if (c.type === 'special') {
    placeSpecialCollectible(c, obstacles, rng);
    return;
  }

  if (c.type === 'boost' || c.type === 'shield') {
    placeCollectibleInGap(
      c,
      obstacles,
      rng,
      GAME.powerupZOffsetMin,
      GAME.powerupZOffsetMax
    );
    return;
  }

  placeCollectibleInGap(
    c,
    obstacles,
    rng,
    GAME.collectibleGapLeadMin,
    GAME.collectibleGapLeadMax
  );
}

export default function OctaSurge() {
  const snap = useSnapshot(octaSurgeState);

  const { paused, restartSeed } = useGameUIState();
  const { camera, scene, gl } = useThree();

  const input = useInputRef({
    preventDefault: [' ', 'Space', 'arrowleft', 'arrowright', 'a', 'd'],
  });

  const gameGroup = useRef<THREE.Group>(null);
  const tunnelGroup = useRef<THREE.Group>(null);
  const faceMaterials = useRef<THREE.MeshStandardMaterial[]>([]);
  const obstacleRefs = useRef<(THREE.Group | null)[]>([]);
  const bumpRefs = useRef<(THREE.Mesh | null)[]>([]);
  const holeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const collectibleRefs = useRef<(THREE.Group | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);

  const collectibleTotal =
    GAME.collectibleCount +
    GAME.specialCollectibleCount +
    GAME.boostCollectibleCount +
    GAME.shieldCollectibleCount;

  const geom = useMemo(() => {
    const ap = GAME.apothem;
    const side = 2 * ap * Math.tan(Math.PI / GAME.faces);
    return {
      apothem: ap,
      side,
      faceGeo: new THREE.PlaneGeometry(side, GAME.tunnelLength),
      ringGeo: new THREE.CylinderGeometry(ap, ap, 0.2, GAME.faces, 1, true),
      bumpGeo: new THREE.BoxGeometry(side * 0.7, 0.84, GAME.obstacleDepth),
      holeGeo: new THREE.PlaneGeometry(side * 0.82, GAME.obstacleDepth),
      playerGeo: new THREE.CylinderGeometry(0.52, 0.52, 0.24, GAME.faces),
      playerCoreGeo: new THREE.IcosahedronGeometry(0.25, 0),
      playerAuraGeo: new THREE.SphereGeometry(0.8, 16, 16),
      collectibleGeo: new THREE.OctahedronGeometry(0.14, 0),
      specialGeo: new THREE.OctahedronGeometry(0.2, 1),
      boostGeo: new THREE.IcosahedronGeometry(0.2, 0),
      shieldGeo: new THREE.DodecahedronGeometry(0.2, 0),
      effectRingGeo: new THREE.RingGeometry(0.08, 0.24, 20),
      nearGeo: new THREE.RingGeometry(0.16, 0.34, 24),
      impactGeo: new THREE.IcosahedronGeometry(0.22, 0),
    };
  }, []);

  const world = useRef({
    rng: new SeededRandom(1),
    worldRot: 0,
    prevWorldRot: 0,
    rotationVel: 0,
    targetRotationVel: 0,
    lastPointerX: 0,

    elapsed: 0,
    speed: GAME.baseSpeed,
    invulnUntil: 0,
    boostUntil: 0,
    shieldCharges: 0,
    surgeMeter: 32,

    combo: 0,
    comboTimer: 0,
    score: 0,
    nearMisses: 0,

    shake: 0,
    effectId: 0,
    collectedThisFrame: false,

    obstacles: [] as ObstacleData[],
    collectibles: [] as CollectibleData[],
    ringZ: [] as number[],
  });

  const [collectionEffects, setCollectionEffects] = useState<
    CollectionEffect[]
  >([]);
  const collectionEffectsRef = useRef<CollectionEffect[]>([]);
  const pendingEffectsRef = useRef<CollectionEffect[]>([]);

  useEffect(() => {
    collectionEffectsRef.current = collectionEffects;
  }, [collectionEffects]);

  useEffect(() => {
    gl.domElement.style.touchAction = 'none';

    scene.background = new THREE.Color('#070915');
    scene.fog = new THREE.Fog('#070915', 10, 96);

    camera.position.set(0, 1.1, 10.5);
    camera.lookAt(0, 0, -42);

    octaSurgeState.load();
  }, [camera, gl.domElement, scene]);

  useEffect(() => {
    if (!restartSeed) return;
    octaSurgeState.start();
  }, [restartSeed]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;

    const w = world.current;
    w.rng = new SeededRandom(snap.worldSeed);
    w.worldRot = 0;
    w.prevWorldRot = 0;
    w.rotationVel = 0;
    w.targetRotationVel = 0;
    w.lastPointerX = 0;

    w.elapsed = 0;
    w.speed = GAME.baseSpeed;
    w.invulnUntil = 0;
    w.boostUntil = 0;
    w.shieldCharges = 0;
    w.surgeMeter = 32;

    w.combo = 0;
    w.comboTimer = 0;
    w.score = 0;
    w.nearMisses = 0;

    w.shake = 0;
    w.effectId = 0;
    w.collectedThisFrame = false;

    setCollectionEffects([]);

    w.obstacles = [];
    const spacing = GAME.spawnDistance / GAME.obstacleCount;
    for (let i = 0; i < GAME.obstacleCount; i++) {
      const z = -GAME.spawnDistance + i * spacing;
      const type = pickObstacleType(w.rng, GAME.baseHazard * 0.75);
      const faceFloat = w.rng.float(0, GAME.faces);
      const faceVel = w.rng.bool(0.34) ? w.rng.float(-0.55, 0.55) : 0;
      const span = type === 'wedge' ? 2 : 1;
      w.obstacles.push({
        id: i,
        z,
        prevZ: z,
        faceFloat,
        prevFaceFloat: faceFloat,
        faceVel,
        span,
        type,
        depth: GAME.obstacleDepth,
        protrusion: type === 'hole' ? 0 : 0.8,
        scale: type === 'wedge' ? GAME.wedgeScaleX : 1,
        nearMissed: false,
      });
    }

    w.collectibles = [];
    let cId = 0;

    const createCollectible = (type: CollectibleType) => {
      const c: CollectibleData = {
        id: cId++,
        faceIndex: 0,
        z: 0,
        prevZ: 0,
        type,
        collected: false,
        bobPhase: w.rng.float(0, TWO_PI),
        spinRate: w.rng.float(0.8, 1.8),
      };
      respawnCollectible(c, w.obstacles, w.rng);
      w.collectibles.push(c);
    };

    for (let i = 0; i < GAME.collectibleCount; i++) createCollectible('normal');
    for (let i = 0; i < GAME.specialCollectibleCount; i++)
      createCollectible('special');
    for (let i = 0; i < GAME.boostCollectibleCount; i++)
      createCollectible('boost');
    for (let i = 0; i < GAME.shieldCollectibleCount; i++)
      createCollectible('shield');

    w.ringZ = [];
    const ringSpacing = GAME.tunnelLength / GAME.ringCount;
    for (let i = 0; i < GAME.ringCount; i++) {
      w.ringZ.push(-GAME.tunnelLength + i * ringSpacing);
    }

    octaSurgeState.score = 0;
    octaSurgeState.combo = 0;
    octaSurgeState.shieldCharges = 0;
    octaSurgeState.surgeMeter = 32;
    octaSurgeState.boostActive = false;
  }, [snap.phase, snap.worldSeed]);

  useFrame((_, dt) => {
    const w = world.current;
    const endFrame = () => clearFrameInput(input);

    if (paused || snap.phase !== 'playing') {
      endFrame();
      return;
    }

    const deltaReal = clamp(dt, 0.001, 0.033);
    w.collectedThisFrame = false;

    w.prevWorldRot = w.worldRot;
    w.elapsed += deltaReal;

    const progress = clamp(w.elapsed / GAME.runSeconds, 0, 1);
    octaSurgeState.progress = progress;

    if (progress >= 1) {
      octaSurgeState.score = Math.floor(w.score);
      octaSurgeState.combo = w.combo;
      octaSurgeState.shieldCharges = w.shieldCharges;
      octaSurgeState.surgeMeter = w.surgeMeter;
      octaSurgeState.boostActive = false;
      octaSurgeState.end();
      endFrame();
      return;
    }

    const keyLeft =
      input.current.keysDown.has('arrowleft') ||
      input.current.keysDown.has('a');
    const keyRight =
      input.current.keysDown.has('arrowright') ||
      input.current.keysDown.has('d');
    const spaceHeld =
      input.current.keysDown.has(' ') ||
      input.current.keysDown.has('space') ||
      input.current.keysDown.has('spacebar');

    let simScale = 1;
    if (spaceHeld && w.surgeMeter > 0.1) {
      simScale = GAME.surgeSlowScale;
      w.surgeMeter = Math.max(
        0,
        w.surgeMeter - GAME.surgeDrainRate * deltaReal
      );
    }

    const boostActive = w.elapsed < w.boostUntil;
    const recharge =
      GAME.surgeRechargeRate * deltaReal +
      (boostActive ? GAME.surgeBoostRechargeRate * deltaReal : 0);
    w.surgeMeter = clamp(w.surgeMeter + recharge, 0, 100);

    const delta = deltaReal * simScale;

    const baseSpeed = GAME.baseSpeed * (1 + progress * GAME.speedRamp);
    w.speed = baseSpeed * (boostActive ? GAME.boostSpeedMultiplier : 1);

    const hazard = clamp(GAME.baseHazard + progress * GAME.hazardRamp, 0, 0.9);

    let pointerVel = 0;
    if (input.current.pointerDown) {
      const pointerDelta = input.current.pointerX - w.lastPointerX;
      pointerVel = -pointerDelta * GAME.dragRotationFactor * 80;
    }
    w.lastPointerX = input.current.pointerX;

    w.targetRotationVel = 0;
    if (keyLeft) w.targetRotationVel += GAME.keyRotationSpeed;
    if (keyRight) w.targetRotationVel -= GAME.keyRotationSpeed;
    w.targetRotationVel += pointerVel;

    const ease = 1 - Math.exp(-GAME.rotationEase * deltaReal);
    w.rotationVel += (w.targetRotationVel - w.rotationVel) * ease;
    w.worldRot = wrapAngle(w.worldRot + w.rotationVel * deltaReal);

    if (tunnelGroup.current) tunnelGroup.current.rotation.z = w.worldRot;

    w.comboTimer = Math.max(0, w.comboTimer - deltaReal);
    if (w.comboTimer <= 0 && w.combo > 0) w.combo = 0;

    const comboMult =
      1 + Math.max(0, Math.min(12, w.combo - 1)) * GAME.comboStep;
    w.score +=
      w.speed *
      delta *
      GAME.distanceScoreFactor *
      (boostActive ? GAME.boostScoreMultiplier : 1) *
      comboMult;

    const t = w.elapsed;
    for (let i = 0; i < GAME.faces; i++) {
      const mat = faceMaterials.current[i];
      if (!mat) continue;
      const hue = 0.52 + (i / GAME.faces) * 0.14 + t * 0.035;
      const sat = boostActive ? 0.95 : 0.78;
      const light = boostActive ? 0.67 : 0.6;
      mat.color.setHSL(hue % 1, sat, light);
      mat.emissive.setHSL((hue + 0.08) % 1, 0.9, boostActive ? 0.34 : 0.2);
      mat.emissiveIntensity =
        (boostActive ? 0.58 : 0.36) + 0.12 * Math.sin(t * 2.4 + i * 0.4);
    }

    for (let i = 0; i < w.ringZ.length; i++) {
      w.ringZ[i] += w.speed * delta;
      if (w.ringZ[i] > 1.4) w.ringZ[i] -= GAME.tunnelLength;
      const r = ringRefs.current[i];
      if (r) {
        r.position.z = w.ringZ[i];
        const m = r.material as THREE.MeshBasicMaterial;
        if (m) {
          m.opacity = boostActive ? 0.28 : 0.18;
          m.color.set(boostActive ? '#fca5a5' : '#88ccff');
        }
      }
    }

    const fA = faceAngle();
    const playerAngleNow = Math.PI - w.worldRot;
    const playerAnglePrev = Math.PI - w.prevWorldRot;
    const playerHalf = GAME.playerDepth / 2;

    for (let i = 0; i < w.obstacles.length; i++) {
      const o = w.obstacles[i];
      o.prevZ = o.z;
      o.prevFaceFloat = o.faceFloat;

      o.z += w.speed * delta;
      o.faceFloat = wrapFaceFloat(
        o.faceFloat + o.faceVel * delta * (1 + progress * 0.75)
      );

      if (o.z > 6) {
        o.z -= GAME.spawnDistance;
        o.prevZ = o.z;
        o.faceFloat = wrapFaceFloat(w.rng.float(0, GAME.faces));
        o.prevFaceFloat = o.faceFloat;
        o.type = pickObstacleType(w.rng, hazard);
        o.faceVel = w.rng.bool(0.36) ? w.rng.float(-0.7, 0.7) : 0;
        o.span = o.type === 'wedge' ? 2 : 1;
        o.scale = o.type === 'wedge' ? GAME.wedgeScaleX : 1;
        o.nearMissed = false;
      }

      const ref = obstacleRefs.current[i];
      if (ref) {
        ref.position.z = o.z;
        ref.rotation.z = (o.faceFloat / GAME.faces) * TWO_PI;
      }

      const bump = bumpRefs.current[i];
      if (bump) {
        bump.visible = o.type !== 'hole';
        bump.scale.x = o.scale;
        bump.scale.y = o.type === 'wedge' ? 1.1 : 1;
        const m = bump.material as THREE.MeshStandardMaterial;
        if (m) {
          m.color.set(o.type === 'wedge' ? '#8f2f4e' : '#521733');
          m.emissive.set(o.type === 'wedge' ? '#b91c1c' : '#7f1d1d');
          m.emissiveIntensity = 0.18 + progress * 0.2;
        }
      }

      const hole = holeRefs.current[i];
      if (hole) {
        hole.visible = o.type === 'hole';
        const m = hole.material as THREE.MeshBasicMaterial;
        if (m) m.opacity = 0.58 + progress * 0.14;
      }
    }

    for (let i = 0; i < w.collectibles.length; i++) {
      const c = w.collectibles[i];
      const g = collectibleRefs.current[i];

      if (c.collected) {
        if (c.respawnAt != null && w.elapsed >= c.respawnAt) {
          respawnCollectible(c, w.obstacles, w.rng);
        }
        if (g) g.visible = false;
        continue;
      }

      c.prevZ = c.z;
      c.z += w.speed * delta;

      const radius = collectibleRadius(c.type);
      const segMin = Math.min(c.prevZ, c.z) - radius;
      const segMax = Math.max(c.prevZ, c.z) + radius;
      const sweptOverlap =
        playerZ - playerHalf < segMax && playerZ + playerHalf > segMin;

      const cAngle = (c.faceIndex / GAME.faces) * TWO_PI;
      const diffMin = sweptRelativeAngleAbsDiff(
        cAngle,
        cAngle,
        playerAnglePrev,
        playerAngleNow
      );

      if (sweptOverlap && diffMin < fA * GAME.collectibleFaceTolerance) {
        octaSurgeState.collect(c.type);

        if (w.comboTimer > 0) w.combo += 1;
        else w.combo = 1;
        w.comboTimer = GAME.comboWindow;

        const runComboMult =
          1 + Math.max(0, Math.min(12, w.combo - 1)) * GAME.comboStep;
        w.score +=
          collectibleBasePoints(c.type) *
          runComboMult *
          (boostActive ? GAME.boostScoreMultiplier : 1);

        if (c.type === 'normal') {
          w.surgeMeter = clamp(w.surgeMeter + GAME.surgeGainNormal, 0, 100);
        } else if (c.type === 'special') {
          w.surgeMeter = clamp(w.surgeMeter + GAME.surgeGainSpecial, 0, 100);
        } else if (c.type === 'boost') {
          w.boostUntil = Math.max(w.boostUntil, w.elapsed + GAME.boostDuration);
          w.surgeMeter = clamp(w.surgeMeter + GAME.surgeGainPowerup, 0, 100);
        } else if (c.type === 'shield') {
          w.shieldCharges = Math.min(
            GAME.maxShieldCharges,
            w.shieldCharges + 1
          );
          w.surgeMeter = clamp(w.surgeMeter + GAME.surgeGainPowerup, 0, 100);
        }

        w.invulnUntil = Math.max(
          w.invulnUntil,
          w.elapsed + GAME.invulnDuration
        );
        w.collectedThisFrame = true;
        w.shake = Math.max(w.shake, c.type === 'special' ? 0.09 : 0.05);

        c.collected = true;
        c.respawnAt = w.elapsed + GAME.collectionEffectLife + 0.1;

        pendingEffectsRef.current.push({
          id: w.effectId++,
          kind: 'collect',
          type: c.type,
          faceIndex: c.faceIndex,
          z: c.z,
          bornAt: w.elapsed,
          life: GAME.collectionEffectLife,
        });
      }

      if (c.z > 7) {
        respawnCollectible(c, w.obstacles, w.rng);
      }

      if (g) {
        g.visible = true;
        const bob = Math.sin(w.elapsed * 3.2 + c.bobPhase) * 0.08;
        g.position.z = c.z;
        g.position.y = bob;
        g.rotation.z = (c.faceIndex / GAME.faces) * TWO_PI;
        g.rotation.y += delta * c.spinRate;
      }
    }

    for (let i = 0; i < w.obstacles.length; i++) {
      const o = w.obstacles[i];
      const obsHalf = o.depth / 2;
      const segMin = Math.min(o.prevZ, o.z) - obsHalf;
      const segMax = Math.max(o.prevZ, o.z) + obsHalf;
      const sweptOverlap =
        playerZ - playerHalf < segMax && playerZ + playerHalf > segMin;

      const oAngleNow = (o.faceFloat / GAME.faces) * TWO_PI;
      const oAnglePrev = (o.prevFaceFloat / GAME.faces) * TWO_PI;
      const diffMin = sweptRelativeAngleAbsDiff(
        oAnglePrev,
        oAngleNow,
        playerAnglePrev,
        playerAngleNow
      );
      const invuln = w.elapsed < w.invulnUntil;

      const hitTol = fA * (GAME.faceHitTightness + (o.span - 1) * 0.5);
      const nearTol = fA * (GAME.nearMissFaceTolerance + (o.span - 1) * 0.52);

      if (!sweptOverlap) continue;

      if (!invuln && !w.collectedThisFrame && diffMin < hitTol) {
        if (w.shieldCharges > 0) {
          w.shieldCharges -= 1;
          w.invulnUntil = w.elapsed + GAME.shieldInvulnDuration;
          w.shake = Math.max(w.shake, 0.16);

          pendingEffectsRef.current.push({
            id: w.effectId++,
            kind: 'shield',
            type: 'shield',
            faceIndex: obstaclePrimaryFace(o),
            z: playerZ,
            bornAt: w.elapsed,
            life: GAME.impactEffectLife,
          });

          o.z += o.depth * 1.4;
          o.prevZ = o.z;
          o.nearMissed = true;
          continue;
        }

        pendingEffectsRef.current.push({
          id: w.effectId++,
          kind: 'impact',
          type: 'special',
          faceIndex: obstaclePrimaryFace(o),
          z: playerZ,
          bornAt: w.elapsed,
          life: GAME.impactEffectLife,
        });

        octaSurgeState.score = Math.floor(w.score);
        octaSurgeState.combo = w.combo;
        octaSurgeState.shieldCharges = w.shieldCharges;
        octaSurgeState.surgeMeter = w.surgeMeter;
        octaSurgeState.boostActive = false;
        octaSurgeState.end();
        endFrame();
        return;
      }

      if (!o.nearMissed && diffMin >= hitTol && diffMin < nearTol) {
        o.nearMissed = true;
        w.nearMisses += 1;
        octaSurgeState.addNearMiss();
        w.score += GAME.nearMissScore;

        pendingEffectsRef.current.push({
          id: w.effectId++,
          kind: 'near',
          type: 'normal',
          faceIndex: obstaclePrimaryFace(o),
          z: playerZ - 0.1,
          bornAt: w.elapsed,
          life: GAME.collectionEffectLife,
        });
      }
    }

    const pending = pendingEffectsRef.current;
    pendingEffectsRef.current = [];
    const now = w.elapsed;

    const updatedEffects = [...collectionEffectsRef.current, ...pending]
      .filter((e) => now - e.bornAt < e.life)
      .map((e) => ({
        ...e,
        z: e.z + w.speed * delta,
        age: now - e.bornAt,
      }));

    if (updatedEffects.length > 0 || pending.length > 0) {
      setCollectionEffects(updatedEffects);
    }

    w.shake = Math.max(0, w.shake - deltaReal * 3.4);
    if (gameGroup.current) {
      const jitter = w.shake * 0.08;
      gameGroup.current.position.x = (Math.random() - 0.5) * jitter;
      gameGroup.current.position.y = (Math.random() - 0.5) * jitter;
    }

    octaSurgeState.score = Math.floor(w.score);
    octaSurgeState.combo = w.combo;
    octaSurgeState.shieldCharges = w.shieldCharges;
    octaSurgeState.surgeMeter = w.surgeMeter;
    octaSurgeState.boostActive = boostActive;
    if (w.combo > octaSurgeState.bestCombo) {
      octaSurgeState.bestCombo = w.combo;
    }

    endFrame();
  });

  const faces = useMemo(
    () => Array.from({ length: GAME.faces }, (_, i) => i),
    []
  );

  const rings = useMemo(
    () => Array.from({ length: GAME.ringCount }, (_, i) => i),
    []
  );

  const collectibleSlots = useMemo(
    () => Array.from({ length: collectibleTotal }, (_, i) => i),
    [collectibleTotal]
  );

  const playerAuraOpacity = snap.boostActive
    ? 0.22
    : snap.shieldCharges > 0
      ? 0.14
      : 0.06;
  const playerAuraColor = snap.boostActive
    ? '#fb7185'
    : snap.shieldCharges > 0
      ? '#2dd4bf'
      : '#60a5fa';

  const playerZ = GAME.playerZ;

  return (
    <group ref={gameGroup}>
      <OctaSurgeUI />

      <ambientLight intensity={0.42} />
      <pointLight
        position={[0, 0, -72]}
        intensity={4.2}
        distance={170}
        color="#dbeafe"
      />
      <pointLight
        position={[0, 0, -44]}
        intensity={1.7}
        distance={84}
        color={snap.boostActive ? '#fb7185' : '#f0abfc'}
      />
      <directionalLight position={[6, 8, 10]} intensity={0.88} />

      <group ref={tunnelGroup}>
        {faces.map((i) => {
          const angle = (i / GAME.faces) * TWO_PI;
          return (
            <group key={i} rotation={[0, 0, angle]}>
              <mesh
                position={[0, geom.apothem, -GAME.tunnelLength / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geom.faceGeo}
                receiveShadow
              >
                <meshStandardMaterial
                  ref={(m) => {
                    if (m) faceMaterials.current[i] = m;
                  }}
                  roughness={0.3}
                  metalness={0.12}
                  emissive="#0d0820"
                  emissiveIntensity={0.35}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}

        {rings.map((i) => (
          <mesh
            key={i}
            ref={(m) => {
              if (m) ringRefs.current[i] = m;
            }}
            geometry={geom.ringGeo}
            rotation={[Math.PI / 2, 0, 0]}
            position={[
              0,
              0,
              -GAME.tunnelLength + (i / GAME.ringCount) * GAME.tunnelLength,
            ]}
          >
            <meshBasicMaterial
              color="#88ccff"
              wireframe
              transparent
              opacity={0.2}
            />
          </mesh>
        ))}

        {Array.from({ length: GAME.obstacleCount }, (_, i) => i).map((i) => (
          <group
            key={i}
            ref={(o) => {
              if (o) obstacleRefs.current[i] = o;
            }}
            position={[0, 0, 0]}
          >
            <mesh
              ref={(m) => {
                if (m) bumpRefs.current[i] = m;
              }}
              position={[0, geom.apothem - 0.4, 0]}
              geometry={geom.bumpGeo}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color="#521733"
                emissive="#7f1d1d"
                emissiveIntensity={0.24}
                roughness={0.5}
                metalness={0.18}
              />
            </mesh>

            <mesh
              ref={(m) => {
                if (m) holeRefs.current[i] = m;
              }}
              position={[0, geom.apothem + 0.01, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={geom.holeGeo}
            >
              <meshBasicMaterial
                color="#05050a"
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}

        {collectibleSlots.map((i) => {
          const type = collectibleTypeByIndex(i);
          const colors = collectibleColors(type);
          const geometry =
            type === 'special'
              ? geom.specialGeo
              : type === 'boost'
                ? geom.boostGeo
                : type === 'shield'
                  ? geom.shieldGeo
                  : geom.collectibleGeo;

          return (
            <group
              key={`c-${i}`}
              ref={(g) => {
                if (g) collectibleRefs.current[i] = g;
              }}
              position={[0, 0, 0]}
            >
              <mesh position={[0, geom.apothem - 0.15, 0]} geometry={geometry}>
                <meshStandardMaterial
                  color={colors.color}
                  emissive={colors.emissive}
                  emissiveIntensity={type === 'special' ? 0.62 : 0.48}
                  roughness={0.2}
                  metalness={0.36}
                />
              </mesh>
            </group>
          );
        })}

        {collectionEffects.map((e) => {
          const age = e.age ?? 0;
          const tNorm = clamp(age / Math.max(0.01, e.life), 0, 1);
          const alpha = 1 - tNorm * tNorm;

          const colorSet =
            e.kind === 'near'
              ? { core: '#67e8f9', ring: '#22d3ee' }
              : e.kind === 'impact'
                ? { core: '#fca5a5', ring: '#ef4444' }
                : e.kind === 'shield'
                  ? { core: '#99f6e4', ring: '#2dd4bf' }
                  : (() => {
                      const c = collectibleColors(e.type);
                      return { core: c.glow, ring: c.color };
                    })();

          const baseScale =
            e.kind === 'impact'
              ? 0.9 + 1.6 * tNorm
              : e.kind === 'shield'
                ? 0.8 + 1.2 * tNorm
                : 0.5 + 1.1 * tNorm;

          return (
            <group
              key={`eff-${e.id}`}
              position={[0, 0, e.z]}
              rotation={[0, 0, (e.faceIndex / GAME.faces) * TWO_PI]}
              scale={[baseScale, baseScale, baseScale]}
            >
              <mesh
                position={[0, geom.apothem - 0.15, 0]}
                geometry={e.kind === 'near' ? geom.nearGeo : geom.impactGeo}
              >
                <meshBasicMaterial
                  color={colorSet.core}
                  transparent
                  opacity={alpha * (e.kind === 'near' ? 0.5 : 0.88)}
                  side={THREE.DoubleSide}
                />
              </mesh>

              <mesh
                position={[0, geom.apothem - 0.15, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geom.effectRingGeo}
              >
                <meshBasicMaterial
                  color={colorSet.ring}
                  transparent
                  opacity={alpha * 0.72}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      <group position={[0, -(GAME.apothem - GAME.playerInset), playerZ]}>
        <mesh geometry={geom.playerGeo}>
          <meshStandardMaterial
            color="#3B82F6"
            emissive={snap.boostActive ? '#be123c' : '#1E40AF'}
            emissiveIntensity={snap.boostActive ? 0.45 : 0.26}
            roughness={0.2}
            metalness={0.45}
          />
        </mesh>

        <mesh geometry={geom.playerCoreGeo} position={[0, 0.16, 0]}>
          <meshStandardMaterial
            color="#E0F2FE"
            roughness={0.12}
            emissive="#22325d"
          />
        </mesh>

        <mesh geometry={geom.playerAuraGeo}>
          <meshBasicMaterial
            color={playerAuraColor}
            transparent
            opacity={playerAuraOpacity}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      <Stars
        radius={92}
        depth={84}
        count={1500}
        factor={2.2}
        saturation={0}
        fade
      />
    </group>
  );
}

export { octaSurgeState };
