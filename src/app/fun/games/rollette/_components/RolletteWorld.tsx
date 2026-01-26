// @ts-nocheck
'use client';

import { Dodecahedron, Sky, Stars, TorusKnot } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import {
  ARENA_HALF,
  ARENA_SIZE,
  CHAIN_WINDOW_S,
  DASH_REFILL_FRACTION_ON_SPRING,
  FLOOR_Y,
  ITEM_Y,
  PLAYER_RADIUS,
  SPRING_POINTS,
  TETRA_HEAL,
  TORUS_MATERIAL,
  ZONE_MULTIPLIER,
} from '../constants';
import { rolletteState } from '../state';
import { pickSpawnPoint } from '../utils/spawn';
import {
  randId,
  dist2XZ,
  pickRingColor,
  pickPyramidType,
  pickSpringType,
  pickTetraType,
  pickKnotType,
  pickTorusOutcome,
} from '../utils';
import { clamp } from '../utils/helpers';
import type {
  DodecaItem,
  MovingBlockItem,
  PyramidItem,
  RingItem,
  SpringItem,
  StarItem,
  TetraItem,
  TorusKnotItem,
  Vec3,
} from '../types';
import { BurstFX, type Burst } from './BurstFX';
import { Arena } from './Arena';
import { Player } from './Player';
import { MovingBlocks } from './MovingBlocks';
import { ItemsRenderer } from './ItemsRenderer';
import { ZoneVisual } from './ZoneVisual';

export const RolletteWorld: React.FC<{
  soundsOn: boolean;
  paused: boolean;
  damageFlashRef: React.MutableRefObject<number>;
  shieldLightRef: React.RefObject<THREE.PointLight>;
}> = ({ soundsOn, paused, damageFlashRef, shieldLightRef }) => {
  const { camera } = useThree();
  const ballRef = useRef<RapierRigidBody>(null);
  const playerPosRef = useRef<Vec3>([0, 1.5, 0]);
  const lastMoveDirRef = useRef(new THREE.Vector3(0, 0, -1));

  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const brakeRef = useRef(false);
  const dashQueuedRef = useRef(false);

  const [rings, setRings] = useState<RingItem[]>([]);
  const [pyramids, setPyramids] = useState<PyramidItem[]>([]);
  const [springs, setSprings] = useState<SpringItem[]>([]);
  const [dodecas, setDodecas] = useState<DodecaItem[]>([]);
  const [blocks, setBlocks] = useState<MovingBlockItem[]>([]);
  const [tetras, setTetras] = useState<TetraItem[]>([]);
  const [knots, setKnots] = useState<TorusKnotItem[]>([]);
  const [star, setStar] = useState<StarItem>({
    id: 'star',
    kind: 'star',
    pos: [0, ITEM_Y + 0.6, 0],
  });

  const ringsRef = useRef(rings);
  const pyramidsRef = useRef(pyramids);
  const springsRef = useRef(springs);
  const dodecasRef = useRef(dodecas);
  const blocksRef = useRef(blocks);
  const tetrasRef = useRef(tetras);
  const knotsRef = useRef(knots);
  const starRef = useRef(star);

  useEffect(() => void (ringsRef.current = rings), [rings]);
  useEffect(() => void (pyramidsRef.current = pyramids), [pyramids]);
  useEffect(() => void (springsRef.current = springs), [springs]);
  useEffect(() => void (dodecasRef.current = dodecas), [dodecas]);
  useEffect(() => void (blocksRef.current = blocks), [blocks]);
  useEffect(() => void (tetrasRef.current = tetras), [tetras]);
  useEffect(() => void (knotsRef.current = knots), [knots]);
  useEffect(() => void (starRef.current = star), [star]);

  const blockBodyRefs = useRef<Record<string, RapierRigidBody | null>>({});
  const blockWorldPosRef = useRef<Record<string, Vec3>>({});
  const lastPyramidHitAtRef = useRef<Record<string, number>>({});
  const lastSpringHitAtRef = useRef<Record<string, number>>({});
  const lastKnotHitAtRef = useRef<Record<string, number>>({});
  const lastTetraHitAtRef = useRef<Record<string, number>>({});
  const lastRingHitAtRef = useRef<Record<string, number>>({});
  const lastStarHitAtRef = useRef(0);
  const lastBlockHitAtRef = useRef<Record<string, number>>({});
  const lastNearMissAtRef = useRef<Record<string, number>>({});

  const dodecaMeshRefs = useRef<Record<string, THREE.Object3D | null>>({});
  const dodecaMotionRef = useRef<
    Record<string, { pos: Vec3; vel: [number, number] }>
  >({});

  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstsRef = useRef(bursts);
  useEffect(() => void (burstsRef.current = bursts), [bursts]);

  useEffect(() => {
    for (const d of dodecasRef.current) {
      if (!dodecaMotionRef.current[d.id]) {
        dodecaMotionRef.current[d.id] = { pos: [...d.pos], vel: [...d.vel] };
      }
    }
    const live = new Set(dodecasRef.current.map((d) => d.id));
    for (const id of Object.keys(dodecaMotionRef.current)) {
      if (!live.has(id)) delete dodecaMotionRef.current[id];
    }
  }, [dodecas]);

  const zoneMoveIdRef = useRef(rolletteState.zoneMoveId);
  const difficultyRef = useRef(rolletteState.difficultyLevel);

  const avoidList = useCallback(() => {
    const avoids: Array<{ center: Vec3; radius: number }> = [];
    for (const p of pyramidsRef.current)
      avoids.push({ center: p.pos, radius: 2.2 });
    for (const b of blocksRef.current) {
      const bp = blockWorldPosRef.current[b.id] ?? b.pos;
      avoids.push({ center: bp, radius: 3.8 });
    }
    return avoids;
  }, []);

  const playSound = useCallback(
    (type: 'point' | 'hit' | 'dash' | 'zone') => {
      // Sound handling would go here if needed
    },
    [soundsOn]
  );

  const spawnBurst = useCallback(
    (
      pos: Vec3,
      color: string,
      count = 14,
      life = 0.65,
      shape: Burst['shape'] = 'spark'
    ) => {
      const burst: Burst = {
        id: randId('burst'),
        pos,
        color,
        bornAt: performance.now() / 1000,
        life,
        count,
        shape,
      };
      setBursts((prev) => [...prev.slice(-16), burst]);
    },
    []
  );

  const resetBall = useCallback(() => {
    const rb = ballRef.current;
    if (!rb) return;
    rb.setTranslation({ x: 0, y: 2.5, z: 0 }, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    playerPosRef.current = [0, 2.5, 0];
    lastMoveDirRef.current.set(0, 0, -1);
  }, []);

  const resetWorld = useCallback(() => {
    rolletteState.reset();
    resetBall();

    const level = 1;
    const playerPos = playerPosRef.current;
    const avoid = avoidList();

    rolletteState.zoneCenter = pickSpawnPoint(playerPos, {
      minDist: 8,
      maxDist: 26,
      y: FLOOR_Y,
      avoid,
    });
    zoneMoveIdRef.current = rolletteState.zoneMoveId;
    difficultyRef.current = rolletteState.difficultyLevel;

    setRings(
      Array.from({ length: 46 }, () => ({
        id: randId('ring'),
        kind: 'ring',
        color: pickRingColor(level),
        pos: pickSpawnPoint(playerPos, {
          minDist: 10,
          maxDist: 30,
          y: ITEM_Y,
          avoid,
        }),
      }))
    );
    setPyramids(
      Array.from({ length: 26 }, () => ({
        id: randId('pyr'),
        kind: 'pyramid',
        type: pickPyramidType(level),
        pos: pickSpawnPoint(playerPos, {
          minDist: 10,
          maxDist: 30,
          y: ITEM_Y,
          avoid,
        }),
      }))
    );
    setSprings(
      Array.from({ length: 10 }, () => ({
        id: randId('spring'),
        kind: 'spring',
        type: pickSpringType(level),
        pos: pickSpawnPoint(playerPos, {
          minDist: 12,
          maxDist: 32,
          y: ITEM_Y,
          avoid,
        }),
      }))
    );
    setDodecas(
      Array.from({ length: 8 }, () => ({
        id: randId('dodeca'),
        kind: 'dodeca',
        pos: pickSpawnPoint(playerPos, {
          minDist: 10,
          maxDist: 26,
          y: ITEM_Y + 0.55,
          avoid,
        }),
        vel: [(Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5],
      }))
    );
    setBlocks(
      Array.from({ length: 6 }, (_, i) => ({
        id: `block-${i}`,
        kind: 'block',
        pos: pickSpawnPoint(playerPos, {
          minDist: 14,
          maxDist: 35,
          y: ITEM_Y + 0.3,
          avoid,
        }),
        axis: Math.random() < 0.5 ? 'x' : 'z',
        amp: 6 + Math.random() * 5,
        speed: 0.55 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        glass: Math.random() < 0.35,
      }))
    );
    setTetras(
      Array.from({ length: 3 }, () => ({
        id: randId('tetra'),
        kind: 'tetra',
        type: pickTetraType(level),
        pos: pickSpawnPoint(playerPos, {
          minDist: 16,
          maxDist: 36,
          y: ITEM_Y + 0.45,
          avoid,
        }),
      }))
    );
    setKnots(
      Array.from({ length: 3 }, () => ({
        id: randId('knot'),
        kind: 'knot',
        type: pickKnotType(),
        pos: pickSpawnPoint(playerPos, {
          minDist: 16,
          maxDist: 36,
          y: ITEM_Y + 0.45,
          avoid,
        }),
      }))
    );
    setStar({
      id: 'star',
      kind: 'star',
      pos: pickSpawnPoint(playerPos, {
        minDist: 18,
        maxDist: 38,
        y: ITEM_Y + 0.75,
        avoid,
      }),
    });
    setBursts([]);
  }, [avoidList, resetBall]);

  useEffect(() => {
    resetWorld();
    camera.position.set(0, 9, 12);
    camera.lookAt(0, 1, 0);
  }, [camera, resetWorld]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keysRef.current.w = true;
      if (k === 'a' || k === 'arrowleft') keysRef.current.a = true;
      if (k === 's' || k === 'arrowdown') keysRef.current.s = true;
      if (k === 'd' || k === 'arrowright') keysRef.current.d = true;
      if (e.code === 'Space') {
        e.preventDefault();
        dashQueuedRef.current = true;
      }
      if (k === 'r') resetWorld();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keysRef.current.w = false;
      if (k === 'a' || k === 'arrowleft') keysRef.current.a = false;
      if (k === 's' || k === 'arrowdown') keysRef.current.s = false;
      if (k === 'd' || k === 'arrowright') keysRef.current.d = false;
    };
    const onDown = () => (brakeRef.current = true);
    const onUp = () => (brakeRef.current = false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onUp);
    };
  }, [resetWorld]);

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const tmpV2 = useMemo(() => new THREE.Vector3(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const nowS = performance.now() / 1000;

    if (burstsRef.current.length) {
      const next = burstsRef.current.filter((b) => nowS - b.bornAt < b.life);
      if (next.length !== burstsRef.current.length) setBursts(next);
    }

    if (paused) return;
    if (rolletteState.gameOver) return;

    const slowFactor = rolletteState.slowTime > 0 ? 0.55 : 1;
    const dt = delta * slowFactor;
    rolletteState.tick(dt);

    const rb = ballRef.current;
    if (!rb) return;

    const p = rb.translation();
    const v = rb.linvel();
    playerPosRef.current = [p.x, p.y, p.z];

    if (rolletteState.difficultyLevel !== difficultyRef.current) {
      difficultyRef.current = rolletteState.difficultyLevel;
      const level = difficultyRef.current;
      const playerPos = playerPosRef.current;
      const avoid = avoidList();

      const targetRings = clamp(46 + level * 6, 46, 110);
      if (ringsRef.current.length < targetRings) {
        setRings((prev) => [
          ...prev,
          ...Array.from(
            { length: Math.min(6, targetRings - prev.length) },
            () => ({
              id: randId('ring'),
              kind: 'ring' as const,
              color: pickRingColor(level),
              pos: pickSpawnPoint(playerPos, {
                minDist: 10,
                maxDist: 34,
                y: ITEM_Y,
                avoid,
              }),
            })
          ),
        ]);
      }

      const targetPyramids = clamp(26 + level * 3, 26, 70);
      if (pyramidsRef.current.length < targetPyramids) {
        setPyramids((prev) => [
          ...prev,
          ...Array.from(
            { length: Math.min(4, targetPyramids - prev.length) },
            () => ({
              id: randId('pyr'),
              kind: 'pyramid' as const,
              type: pickPyramidType(level),
              pos: pickSpawnPoint(playerPos, {
                minDist: 10,
                maxDist: 34,
                y: ITEM_Y,
                avoid,
              }),
            })
          ),
        ]);
      }

      const targetBlocks = clamp(6 + Math.floor(level / 2), 6, 12);
      if (blocksRef.current.length < targetBlocks) {
        setBlocks((prev) => [
          ...prev,
          ...Array.from(
            { length: Math.min(1, targetBlocks - prev.length) },
            (_, i) => ({
              id: `block-${prev.length + i}`,
              kind: 'block' as const,
              pos: pickSpawnPoint(playerPos, {
                minDist: 14,
                maxDist: 38,
                y: ITEM_Y + 0.3,
                avoid,
              }),
              axis: Math.random() < 0.5 ? 'x' : 'z',
              amp: 6 + Math.random() * 6,
              speed: 0.55 + Math.random() * 0.65 + level * 0.02,
              phase: Math.random() * Math.PI * 2,
              glass: Math.random() < 0.35,
            })
          ),
        ]);
      }
    }

    if (rolletteState.zoneMoveId !== zoneMoveIdRef.current) {
      zoneMoveIdRef.current = rolletteState.zoneMoveId;
      const playerPos = playerPosRef.current;
      const prefer = tmpDir.set(v.x, 0, v.z);
      const avoid = avoidList();
      rolletteState.zoneCenter = pickSpawnPoint(playerPos, {
        minDist: 10,
        maxDist: 34,
        y: FLOOR_Y,
        avoid,
        preferDir: prefer,
        biasTowardPreferDir: 0.55,
      });
      rolletteState.setToast('ZONE MOVED');
      playSound('zone');
      spawnBurst(
        [
          rolletteState.zoneCenter[0],
          ITEM_Y + 0.2,
          rolletteState.zoneCenter[2],
        ],
        '#34d399',
        18,
        0.8,
        'spark'
      );
    }

    for (const b of blocksRef.current) {
      const body = blockBodyRefs.current[b.id];
      if (!body) continue;
      const t = state.clock.elapsedTime;
      const offset = Math.sin(t * b.speed + b.phase) * b.amp;
      const x = b.axis === 'x' ? b.pos[0] + offset : b.pos[0];
      const z = b.axis === 'z' ? b.pos[2] + offset : b.pos[2];
      blockWorldPosRef.current[b.id] = [x, b.pos[1], z];
      body.setNextKinematicTranslation({ x, y: b.pos[1], z });
    }

    const zc = rolletteState.zoneCenter;
    const inZoneNow =
      dist2XZ(playerPosRef.current, [zc[0], 0, zc[2]]) <
      rolletteState.zoneRadius * rolletteState.zoneRadius;
    if (rolletteState.inZone !== inZoneNow) rolletteState.inZone = inZoneNow;

    const inputX = (keysRef.current.d ? 1 : 0) - (keysRef.current.a ? 1 : 0);
    const inputZ = (keysRef.current.s ? 1 : 0) - (keysRef.current.w ? 1 : 0);

    tmpV.set(inputX, 0, inputZ);
    if (tmpV.lengthSq() > 1e-4) tmpV.normalize();

    tmpV2.set(state.pointer.x, 0, -state.pointer.y).multiplyScalar(0.55);
    if (tmpV2.lengthSq() > 1e-4) tmpV2.normalize().multiplyScalar(0.55);

    tmpV.add(tmpV2);
    if (tmpV.lengthSq() > 1e-4) tmpV.normalize();

    const isBraking = brakeRef.current;
    const slippery = rolletteState.slipperyTime > 0;

    if (shieldLightRef.current) {
      shieldLightRef.current.intensity =
        rolletteState.shieldTime > 0 ? 0.95 : 0;
      shieldLightRef.current.distance = 6;
    }

    if (tmpV.lengthSq() > 1e-4) lastMoveDirRef.current.copy(tmpV);
    const moveDir = tmpV.lengthSq() > 1e-4 ? tmpV : lastMoveDirRef.current;

    const baseDamp = slippery ? 0.15 : 0.32;
    const brakeDamp = slippery ? 0.55 : 0.75;
    rb.setLinearDamping(isBraking ? brakeDamp : baseDamp);
    rb.setAngularDamping(isBraking ? 0.9 : 0.55);

    const baseForce = isBraking ? 25 : slippery ? 42 : 36;
    rb.addForce(
      { x: moveDir.x * baseForce, y: 0, z: moveDir.z * baseForce },
      true
    );

    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    const maxSpeed = (slippery ? 32 : 26) + rolletteState.difficultyLevel * 0.6;
    if (speed > maxSpeed) {
      const over = speed - maxSpeed;
      const inv = 1 / Math.max(1e-4, speed);
      rb.addForce(
        { x: -v.x * inv * over * 18, y: 0, z: -v.z * inv * over * 18 },
        true
      );
    }

    if (dashQueuedRef.current) {
      dashQueuedRef.current = false;
      if (rolletteState.dashCooldown <= 0) {
        const dashImpulse = 16 + rolletteState.difficultyLevel * 0.25;
        rb.applyImpulse(
          { x: moveDir.x * dashImpulse, y: 0.25, z: moveDir.z * dashImpulse },
          true
        );
        rolletteState.dashCooldown = rolletteState.dashCooldownMax;
        playSound('dash');
        spawnBurst([p.x, ITEM_Y + 0.2, p.z], '#f472b6', 10, 0.45, 'spark');
      }
    }

    const target = tmpDir.set(p.x, p.y + 5.8, p.z + 11);
    camera.position.lerp(target, 0.08);
    camera.lookAt(p.x, p.y + 1.1, p.z);
    if (damageFlashRef.current > 0) {
      damageFlashRef.current = Math.max(0, damageFlashRef.current - dt * 1.4);
      camera.position.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * damageFlashRef.current,
          0,
          (Math.random() - 0.5) * damageFlashRef.current
        )
      );
    }

    const limit = ARENA_HALF - 2.5;
    if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
      rb.addForce(
        { x: -Math.sign(p.x) * 40, y: 0, z: -Math.sign(p.z) * 40 },
        true
      );
    }

    const playerPos = playerPosRef.current;
    const level = rolletteState.difficultyLevel;
    const avoid = avoidList();

    for (const ring of ringsRef.current) {
      const lastAt = lastRingHitAtRef.current[ring.id] ?? -999;
      if (nowS - lastAt < 0.12) continue;
      if (dist2XZ(playerPos, ring.pos) < 1.6 * 1.6) {
        lastRingHitAtRef.current[ring.id] = nowS;
        rolletteState.hitRing(ring.color, inZoneNow);
        playSound('point');
        spawnBurst(
          [ring.pos[0], ITEM_Y + 0.3, ring.pos[2]],
          ring.color === 'gold'
            ? '#facc15'
            : ring.color === 'silver'
              ? '#cbd5e1'
              : '#cd7f32',
          10,
          0.55,
          'spark'
        );

        const wantZone = Math.random() < 0.65;
        let nextPos = pickSpawnPoint(playerPos, {
          minDist: 10,
          maxDist: 34,
          y: ITEM_Y,
          avoid,
          preferDir: lastMoveDirRef.current,
          biasTowardPreferDir: 0.65,
        });
        if (wantZone) {
          for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * Math.max(2, rolletteState.zoneRadius - 2);
            const x = rolletteState.zoneCenter[0] + Math.cos(a) * r;
            const z = rolletteState.zoneCenter[2] + Math.sin(a) * r;
            const candidate: Vec3 = [x, ITEM_Y, z];
            if (Math.abs(x) > ARENA_HALF - 2 || Math.abs(z) > ARENA_HALF - 2)
              continue;
            if (dist2XZ(candidate, playerPos) < 8 * 8) continue;
            nextPos = candidate;
            break;
          }
        }
        const nextColor = pickRingColor(level);
        setRings((prev) =>
          prev.map((r) =>
            r.id === ring.id ? { ...r, pos: nextPos, color: nextColor } : r
          )
        );
        break;
      }
    }

    for (const pyr of pyramidsRef.current) {
      const lastAt = lastPyramidHitAtRef.current[pyr.id] ?? -999;
      if (nowS - lastAt < 0.35) continue;
      if (dist2XZ(playerPos, pyr.pos) < 1.55 * 1.55) {
        lastPyramidHitAtRef.current[pyr.id] = nowS;
        rolletteState.hitPyramid(pyr.type);
        playSound('hit');
        damageFlashRef.current = Math.min(0.6, damageFlashRef.current + 0.35);
        spawnBurst(
          [pyr.pos[0], ITEM_Y + 0.35, pyr.pos[2]],
          '#ef4444',
          pyr.type === 'black' ? 18 : 14,
          0.8,
          'spark'
        );

        const dx = p.x - pyr.pos[0];
        const dz = p.z - pyr.pos[2];
        const mag = Math.max(1e-3, Math.sqrt(dx * dx + dz * dz));
        rb.applyImpulse({ x: (dx / mag) * 8, y: 0.5, z: (dz / mag) * 8 }, true);

        const nextPos = pickSpawnPoint(playerPos, {
          minDist: 12,
          maxDist: 36,
          y: ITEM_Y,
          avoid,
        });
        const nextType = pickPyramidType(level);
        setPyramids((prev) =>
          prev.map((pp) =>
            pp.id === pyr.id ? { ...pp, pos: nextPos, type: nextType } : pp
          )
        );
        break;
      }
    }

    for (const s of springsRef.current) {
      const lastAt = lastSpringHitAtRef.current[s.id] ?? -999;
      if (nowS - lastAt < 0.35) continue;
      if (dist2XZ(playerPos, s.pos) < 1.65 * 1.65) {
        lastSpringHitAtRef.current[s.id] = nowS;
        rolletteState.addScore(
          SPRING_POINTS[s.type] *
            (inZoneNow ? ZONE_MULTIPLIER : 1) *
            rolletteState.bonusMultiplier
        );
        rolletteState.refillDash(DASH_REFILL_FRACTION_ON_SPRING);
        if (s.type === 'cyan') rolletteState.activateSlow(2);
        playSound('point');
        spawnBurst(
          [s.pos[0], ITEM_Y + 0.2, s.pos[2]],
          s.type === 'cyan' ? '#22d3ee' : '#facc15',
          12,
          0.55,
          'spark'
        );

        const fwd = lastMoveDirRef.current;
        rb.applyImpulse({ x: fwd.x * 6, y: 6.5, z: fwd.z * 6 }, true);

        const nextPos = pickSpawnPoint(playerPos, {
          minDist: 14,
          maxDist: 36,
          y: ITEM_Y,
          avoid,
        });
        const nextType = pickSpringType(level);
        setSprings((prev) =>
          prev.map((ss) =>
            ss.id === s.id ? { ...ss, pos: nextPos, type: nextType } : ss
          )
        );
        break;
      }
    }

    for (const d of dodecasRef.current) {
      const motion = dodecaMotionRef.current[d.id];
      if (!motion) continue;
      const pos = motion.pos;

      const dd2 = dist2XZ(playerPos, pos);
      if (dd2 < 1.7 * 1.7) {
        rolletteState.addScore(
          90 * (inZoneNow ? ZONE_MULTIPLIER : 1) * rolletteState.bonusMultiplier
        );
        rolletteState.comboTimer = Math.min(
          CHAIN_WINDOW_S,
          rolletteState.comboTimer + 0.35
        );
        playSound('point');
        spawnBurst(
          [pos[0], ITEM_Y + 0.35, pos[2]],
          '#22d3ee',
          16,
          0.7,
          'spark'
        );

        const flock = Math.random() < 0.18;
        const base = pickSpawnPoint(playerPos, {
          minDist: 10,
          maxDist: 28,
          y: ITEM_Y + 0.55,
          avoid,
        });
        const nextVel: [number, number] = [
          (Math.random() - 0.5) * (flock ? 7 : 5),
          (Math.random() - 0.5) * (flock ? 7 : 5),
        ];
        motion.pos = [...base];
        motion.vel = nextVel;
        const obj = dodecaMeshRefs.current[d.id];
        if (obj) obj.position.set(base[0], base[1], base[2]);

        setDodecas((prev) =>
          prev.map((dd) =>
            dd.id === d.id ? { ...dd, pos: base, vel: nextVel } : dd
          )
        );
        continue;
      }

      const vx = motion.vel[0] + (Math.random() - 0.5) * 0.6;
      const vz = motion.vel[1] + (Math.random() - 0.5) * 0.6;
      let nx = pos[0] + vx * dt * 0.35;
      let nz = pos[2] + vz * dt * 0.35;
      const lim = ARENA_HALF - 3;
      if (nx < -lim || nx > lim) nx = THREE.MathUtils.clamp(nx, -lim, lim);
      if (nz < -lim || nz > lim) nz = THREE.MathUtils.clamp(nz, -lim, lim);
      motion.pos[0] = nx;
      motion.pos[2] = nz;
      motion.vel[0] = vx * 0.98;
      motion.vel[1] = vz * 0.98;
      const obj = dodecaMeshRefs.current[d.id];
      if (obj) obj.position.set(nx, pos[1], nz);
    }

    for (const b of blocksRef.current) {
      const bp = blockWorldPosRef.current[b.id] ?? b.pos;
      const d2 = dist2XZ(playerPos, bp);
      const hitR = 2.6;
      const nearR = 3.7;

      const lastHit = lastBlockHitAtRef.current[b.id] ?? -999;
      if (d2 < hitR * hitR && nowS - lastHit > 0.6) {
        lastBlockHitAtRef.current[b.id] = nowS;
        rolletteState.takeDamage(8 + rolletteState.difficultyLevel * 0.6);
        playSound('hit');
        damageFlashRef.current = Math.min(0.75, damageFlashRef.current + 0.4);

        const dx = p.x - bp[0];
        const dz = p.z - bp[2];
        const mag = Math.max(1e-3, Math.sqrt(dx * dx + dz * dz));
        rb.applyImpulse(
          { x: (dx / mag) * 12, y: 0.4, z: (dz / mag) * 12 },
          true
        );
        spawnBurst(
          [bp[0], ITEM_Y + 0.35, bp[2]],
          b.glass ? '#e2e8f0' : '#38bdf8',
          b.glass ? 22 : 12,
          0.8,
          b.glass ? 'box' : 'spark'
        );
        break;
      }

      const lastNear = lastNearMissAtRef.current[b.id] ?? -999;
      if (d2 < nearR * nearR && d2 > hitR * hitR && nowS - lastNear > 0.7) {
        lastNearMissAtRef.current[b.id] = nowS;
        rolletteState.addScore(
          20 *
            (1 + rolletteState.combo * 0.08) *
            (inZoneNow ? ZONE_MULTIPLIER : 1) *
            rolletteState.bonusMultiplier
        );
        spawnBurst([bp[0], ITEM_Y + 0.25, bp[2]], '#38bdf8', 8, 0.45, 'spark');
      }
    }

    for (const tItem of tetrasRef.current) {
      const lastAt = lastTetraHitAtRef.current[tItem.id] ?? -999;
      if (nowS - lastAt < 0.4) continue;
      if (dist2XZ(playerPos, tItem.pos) < 1.7 * 1.7) {
        lastTetraHitAtRef.current[tItem.id] = nowS;
        if (tItem.type === 'purple') {
          rolletteState.activateShield(10);
          spawnBurst(
            [tItem.pos[0], ITEM_Y + 0.35, tItem.pos[2]],
            '#a855f7',
            16,
            0.7,
            'tetra'
          );
        } else {
          const base = TETRA_HEAL[tItem.type];
          const scaled = base / (1 + level * 0.12);
          rolletteState.heal(scaled);
          spawnBurst(
            [tItem.pos[0], ITEM_Y + 0.35, tItem.pos[2]],
            tItem.type === 'green' ? '#22c55e' : '#3b82f6',
            14,
            0.7,
            'tetra'
          );
        }
        playSound('point');

        const nextPos = pickSpawnPoint(playerPos, {
          minDist: 16,
          maxDist: 40,
          y: ITEM_Y + 0.45,
          avoid,
        });
        const nextType = pickTetraType(level);
        setTetras((prev) =>
          prev.map((tt) =>
            tt.id === tItem.id ? { ...tt, pos: nextPos, type: nextType } : tt
          )
        );
        break;
      }
    }

    for (const kItem of knotsRef.current) {
      const lastAt = lastKnotHitAtRef.current[kItem.id] ?? -999;
      if (nowS - lastAt < 0.5) continue;
      if (dist2XZ(playerPos, kItem.pos) < 2.1 * 2.1) {
        lastKnotHitAtRef.current[kItem.id] = nowS;
        const out = pickTorusOutcome();
        if (out.kind === 'points') {
          rolletteState.addScore(
            out.value *
              (inZoneNow ? ZONE_MULTIPLIER : 1) *
              rolletteState.bonusMultiplier
          );
          rolletteState.setToast(`+${out.value}`);
        } else if (out.kind === 'jackpot') {
          rolletteState.addScore(
            out.value *
              (inZoneNow ? ZONE_MULTIPLIER : 1) *
              rolletteState.bonusMultiplier
          );
          rolletteState.setToast(`JACKPOT +${out.value.toLocaleString()}`);
        } else if (out.kind === 'multiplier') {
          rolletteState.activateMultiplier(out.value, out.time);
        } else if (out.kind === 'shield') {
          rolletteState.activateShield(out.time);
        }
        playSound('point');
        spawnBurst(
          [kItem.pos[0], ITEM_Y + 0.35, kItem.pos[2]],
          '#e879f9',
          18,
          0.85,
          'spark'
        );

        const nextPos = pickSpawnPoint(playerPos, {
          minDist: 18,
          maxDist: 44,
          y: ITEM_Y + 0.45,
          avoid,
        });
        const nextType = pickKnotType();
        setKnots((prev) =>
          prev.map((kk) =>
            kk.id === kItem.id ? { ...kk, pos: nextPos, type: nextType } : kk
          )
        );
        break;
      }
    }

    if (nowS - lastStarHitAtRef.current > 0.35) {
      if (dist2XZ(playerPos, starRef.current.pos) < 1.8 * 1.8) {
        lastStarHitAtRef.current = nowS;
        rolletteState.hitStar();
        playSound('point');
        spawnBurst(
          [starRef.current.pos[0], ITEM_Y + 0.35, starRef.current.pos[2]],
          '#0b0b12',
          18,
          0.85,
          'spark'
        );

        const nextPos = pickSpawnPoint(playerPos, {
          minDist: 18,
          maxDist: 44,
          y: ITEM_Y + 0.75,
          avoid,
        });
        setStar((prev) => ({ ...prev, pos: nextPos }));
      }
    }
  });

  return (
    <>
      <Sky />
      <Stars
        radius={260}
        depth={60}
        count={3200}
        factor={4}
        saturation={0}
        fade
      />

      <ambientLight intensity={0.35} />
      <directionalLight position={[18, 24, 12]} intensity={1} castShadow />
      <pointLight position={[0, 16, 0]} intensity={0.35} color="#22d3ee" />

      <Physics gravity={[0, -20, 0]}>
        <Arena />
        <ZoneVisual />
        <MovingBlocks blocks={blocks} blockBodyRefs={blockBodyRefs} />
        <Player ballRef={ballRef} />
        <ItemsRenderer
          rings={rings}
          pyramids={pyramids}
          springs={springs}
          tetras={tetras}
          knots={knots}
          dodecas={dodecas}
          star={star}
          dodecaMeshRefs={dodecaMeshRefs}
        />
        {bursts.map((b) => (
          <BurstFX key={b.id} burst={b} />
        ))}
      </Physics>
    </>
  );
};
