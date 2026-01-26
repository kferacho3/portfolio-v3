'use client';

import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useInputRef, clearFrameInput } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import { SeededRandom } from '../../utils/seededRandom';
import { GAME } from './constants';
import { OctaSurgeUI } from './_components/OctaSurgeUI';
import { octaSurgeState } from './state';
import type {
  CollectibleData,
  CollectionEffect,
  ObstacleData,
  ObstacleType,
} from './types';

const TWO_PI = Math.PI * 2;

function wrapAngle(a: number) {
  let x = a % TWO_PI;
  if (x < -Math.PI) x += TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
  return x;
}

function smallestAngleDiff(a: number, b: number) {
  return wrapAngle(a - b);
}

function faceAngle() {
  return (Math.PI * 2) / GAME.faces;
}

function pickObstacleType(rng: SeededRandom, hazard: number): ObstacleType {
  if (rng.random() < hazard * 0.55) return 'hole';
  return 'bump';
}

/** Z-ranges overlap? */
function zOverlap(
  aCenter: number,
  aHalf: number,
  bCenter: number,
  bHalf: number
): boolean {
  return aCenter - aHalf < bCenter + bHalf && aCenter + aHalf > bCenter - bHalf;
}

/** Which tunnel face is at the bottom (player face)? worldRot in rad. */
function playerFaceIndex(worldRot: number): number {
  const fA = faceAngle();
  let idx = Math.round((Math.PI - worldRot) / fA);
  idx = idx % GAME.faces;
  if (idx < 0) idx += GAME.faces;
  return idx;
}

/** Same face (obstacle vs player)? Use angular tolerance for sub-frame blur. */
function sameFaceObstacle(
  obsFace: number,
  worldRot: number,
  faceTol: number
): boolean {
  const diff = Math.abs(
    smallestAngleDiff(obsFace * faceAngle(), Math.PI - worldRot)
  );
  return diff < faceAngle() * faceTol;
}

/** Place normal collectibles in safe gaps, on faces with NO obstacle in that z-band. Reachable. */
function placeNormalCollectible(
  c: CollectibleData,
  obstacles: ObstacleData[],
  rng: SeededRandom
) {
  if (obstacles.length < 2) return;
  const depth = GAME.obstacleDepth;
  const half = depth / 2;
  const sorted = [...obstacles].sort((a, b) => a.z - b.z);
  const gaps: { z: number; excludedFaces: Set<number> }[] = [];
  const band = 3;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gapSize = b.z - a.z - depth;
    if (gapSize < 3) continue;
    const mid = (a.z + b.z) / 2;
    const excludedFaces = new Set<number>();
    for (const o of obstacles) {
      if (zOverlap(o.z, half, mid, band)) excludedFaces.add(o.faceIndex);
    }
    gaps.push({ z: mid, excludedFaces });
  }
  if (gaps.length === 0) return;
  const g = rng.pick(gaps);
  const lead = rng.float(
    GAME.collectibleGapLeadMin,
    GAME.collectibleGapLeadMax
  );
  const safeFaces = Array.from({ length: GAME.faces }, (_, i) => i).filter(
    (f) => !g.excludedFaces.has(f)
  );
  const face =
    safeFaces.length > 0 ? rng.pick(safeFaces) : rng.int(0, GAME.faces - 1);
  c.faceIndex = face;
  c.z = g.z + lead;
  c.collected = false;
  delete c.respawnAt;
}

/** Specials: just AHEAD of obstacle (we see collectible first), same face. Hard but achievable. */
function placeSpecialCollectible(
  c: CollectibleData,
  obstacles: ObstacleData[],
  rng: SeededRandom
) {
  if (obstacles.length === 0) return;
  const ob = rng.pick(obstacles);
  const lead = rng.float(GAME.specialZOffsetMin, GAME.specialZOffsetMax);
  c.faceIndex = ob.faceIndex;
  c.z = ob.z + GAME.obstacleDepth / 2 + lead;
  c.collected = false;
  delete c.respawnAt;
}

function respawnCollectible(
  collectible: CollectibleData,
  obstacles: ObstacleData[],
  rng: SeededRandom
) {
  if (collectible.type === 'special') {
    placeSpecialCollectible(collectible, obstacles, rng);
  } else {
    placeNormalCollectible(collectible, obstacles, rng);
  }
}

export default function OctaSurge() {
  const snap = useSnapshot(octaSurgeState);

  // Player token is slightly in front of the tunnel opening.
  const playerZ = GAME.playerZ;
  const { paused, restartSeed } = useGameUIState();

  const { camera, scene, gl } = useThree();

  const input = useInputRef({
    preventDefault: [' ', 'Space', 'arrowleft', 'arrowright', 'a', 'd'],
  });

  // Visual refs
  const tunnelGroup = useRef<THREE.Group>(null);
  const faceMaterials = useRef<THREE.MeshStandardMaterial[]>([]);
  const obstacleRefs = useRef<(THREE.Group | null)[]>([]);
  const bumpRefs = useRef<(THREE.Mesh | null)[]>([]);
  const holeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const collectibleRefs = useRef<(THREE.Group | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);

  const geom = useMemo(() => {
    const ap = GAME.apothem;
    const side = 2 * ap * Math.tan(Math.PI / GAME.faces);
    return {
      apothem: ap,
      side,
      faceGeo: new THREE.PlaneGeometry(side, GAME.tunnelLength),
      ringGeo: new THREE.CylinderGeometry(ap, ap, 0.18, GAME.faces, 1, true),
      bumpGeo: new THREE.BoxGeometry(side * 0.72, 0.8, GAME.obstacleDepth),
      holeGeo: new THREE.PlaneGeometry(side * 0.78, GAME.obstacleDepth),
      playerGeo: new THREE.CylinderGeometry(0.52, 0.52, 0.25, GAME.faces),
      innerGeo: new THREE.CylinderGeometry(0.28, 0.28, 0.13, GAME.faces),
      collectibleGeo: new THREE.OctahedronGeometry(0.14, 0),
      specialGeo: new THREE.OctahedronGeometry(0.2, 1),
      effectRingGeo: new THREE.RingGeometry(0.08, 0.22, 16),
    };
  }, []);

  const world = useRef({
    rng: new SeededRandom(1),
    worldRot: 0,
    rotationVel: 0,
    targetRotationVel: 0,
    elapsed: 0,
    speed: GAME.baseSpeed,
    invulnUntil: 0,
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

    scene.background = new THREE.Color('#0a0612');
    scene.fog = new THREE.Fog('#0a0612', 12, 95);

    camera.position.set(0, 1.1, 10.5);
    camera.lookAt(0, 0, -40);

    octaSurgeState.load();
  }, [camera, gl.domElement, scene]);

  useEffect(() => {
    // Restart from global arcade UI.
    if (!restartSeed) return;
    octaSurgeState.start();
  }, [restartSeed]);

  useEffect(() => {
    if (snap.phase !== 'playing') return;

    const w = world.current;
    w.rng = new SeededRandom(snap.worldSeed);
    w.elapsed = 0;
    w.worldRot = 0;
    w.rotationVel = 0;
    w.targetRotationVel = 0;
    w.invulnUntil = 0;
    w.effectId = 0;
    w.collectedThisFrame = false;
    setCollectionEffects([]);

    w.obstacles = [];
    const depth = GAME.obstacleDepth;
    const startZ = -GAME.spawnDistance;
    const spacing = GAME.spawnDistance / GAME.obstacleCount;
    for (let i = 0; i < GAME.obstacleCount; i++) {
      const z = startZ + i * spacing;
      const hazard = 0.12;
      const faceIndex = w.rng.int(0, GAME.faces - 1);
      const type = pickObstacleType(w.rng, hazard);
      w.obstacles.push({
        id: i,
        faceIndex,
        z,
        type,
        depth,
        protrusion: type === 'bump' ? 0.8 : 0,
      });
    }

    w.collectibles = [];
    let cId = 0;
    for (let i = 0; i < GAME.collectibleCount; i++) {
      const collectible: CollectibleData = {
        id: cId++,
        faceIndex: 0,
        z: 0,
        type: 'normal',
        collected: false,
      };
      respawnCollectible(collectible, w.obstacles, w.rng);
      w.collectibles.push(collectible);
    }
    for (let i = 0; i < GAME.specialCollectibleCount; i++) {
      const collectible: CollectibleData = {
        id: cId++,
        faceIndex: 0,
        z: 0,
        type: 'special',
        collected: false,
      };
      respawnCollectible(collectible, w.obstacles, w.rng);
      w.collectibles.push(collectible);
    }

    w.ringZ = [];
    const ringCount = 26;
    const ringSpacing = GAME.tunnelLength / ringCount;
    for (let i = 0; i < ringCount; i++) {
      w.ringZ.push(-GAME.tunnelLength + i * ringSpacing);
    }
  }, [snap.phase, snap.worldSeed]);

  useFrame((_, dt) => {
    const w = world.current;

    // Always clear per-frame input to keep inputRef consistent.
    const endFrame = () => clearFrameInput(input);

    if (paused || snap.phase !== 'playing') {
      endFrame();
      return;
    }

    const delta = Math.min(0.033, Math.max(0.001, dt));
    w.collectedThisFrame = false;

    // Time + speed ramp
    w.elapsed += delta;
    const progress = Math.min(1, w.elapsed / GAME.runSeconds);
    octaSurgeState.progress = progress;

    if (progress >= 1) {
      octaSurgeState.end();
      endFrame();
      return;
    }

    const hazard = Math.min(0.55, GAME.baseHazard + progress * GAME.hazardRamp);
    w.speed = GAME.baseSpeed * (1 + progress * GAME.speedRamp);

    // Rotation: smooth easing (lower ease = silkier)
    const keyLeft =
      input.current.keysDown.has('arrowleft') ||
      input.current.keysDown.has('a');
    const keyRight =
      input.current.keysDown.has('arrowright') ||
      input.current.keysDown.has('d');
    w.targetRotationVel = 0;
    if (keyLeft) w.targetRotationVel = GAME.keyRotationSpeed;
    if (keyRight) w.targetRotationVel = -GAME.keyRotationSpeed;
    if (input.current.pointerDown) {
      const drag = -input.current.pointerX * GAME.dragRotationFactor * 100;
      w.targetRotationVel += drag;
    }
    const ease = 1 - Math.exp(-GAME.rotationEase * delta);
    w.rotationVel += (w.targetRotationVel - w.rotationVel) * ease;
    w.worldRot = wrapAngle(w.worldRot + w.rotationVel * delta);
    if (tunnelGroup.current) tunnelGroup.current.rotation.z = w.worldRot;

    // Animate face palette (neon drift — cyan / magenta / yellow)
    const t = w.elapsed;
    for (let i = 0; i < GAME.faces; i++) {
      const mat = faceMaterials.current[i];
      if (!mat) continue;
      const hue = 0.52 + (i / GAME.faces) * 0.18 + t * 0.04;
      mat.color.setHSL(hue % 1, 0.7, 0.62);
      mat.emissive.setHSL((hue + 0.06) % 1, 0.8, 0.18);
      mat.emissiveIntensity = 0.35 + 0.1 * Math.sin(t * 2 + i * 0.5);
    }

    // Move rings toward player and wrap
    for (let i = 0; i < w.ringZ.length; i++) {
      w.ringZ[i] += w.speed * delta;
      if (w.ringZ[i] > 1) {
        w.ringZ[i] -= GAME.tunnelLength;
      }
      const r = ringRefs.current[i];
      if (r) r.position.z = w.ringZ[i];
    }

    const fA = faceAngle();
    const playerAngle = Math.PI;
    const collectFaceTol = fA * GAME.collectibleFaceTolerance;
    const playerHalf = GAME.playerDepth / 2;
    const obsHalf = GAME.obstacleDepth / 2;
    const invuln = w.elapsed < w.invulnUntil;

    // --- Move obstacles ---
    for (let i = 0; i < w.obstacles.length; i++) {
      const o = w.obstacles[i];
      o.z += w.speed * delta;
      if (o.z > 4.5) {
        o.z -= GAME.spawnDistance;
        o.faceIndex = w.rng.int(0, GAME.faces - 1);
        o.type = pickObstacleType(w.rng, hazard);
        o.protrusion = o.type === 'bump' ? 0.8 : 0;
      }
    }

    // --- Move collectibles (only non-collected), check collect first, then respawn ---
    for (let i = 0; i < w.collectibles.length; i++) {
      const c = w.collectibles[i];
      if (c.collected) {
        if (c.respawnAt != null && w.elapsed >= c.respawnAt) {
          respawnCollectible(c, w.obstacles, w.rng);
        }
        const g = collectibleRefs.current[i];
        if (g) g.visible = false;
        continue;
      }
      c.z += w.speed * delta;

      const radius =
        c.type === 'special'
          ? GAME.specialHitRadius
          : GAME.collectibleHitRadius;
      const overlap = zOverlap(playerZ, playerHalf, c.z, radius);
      const diff = Math.abs(
        smallestAngleDiff(c.faceIndex * fA + w.worldRot, playerAngle)
      );
      const sameFace = diff < collectFaceTol;
      if (overlap && sameFace) {
        octaSurgeState.collect(c.type);
        c.collected = true;
        c.respawnAt = w.elapsed + GAME.collectionEffectLife + 0.08;
        w.invulnUntil = w.elapsed + GAME.invulnDuration;
        w.collectedThisFrame = true;
        const eff: CollectionEffect = {
          id: w.effectId++,
          type: c.type,
          faceIndex: c.faceIndex,
          z: c.z,
          bornAt: w.elapsed,
          life: GAME.collectionEffectLife,
        };
        pendingEffectsRef.current.push(eff);
        setCollectionEffects((prev) => [...prev.slice(-8), eff]);
      }

      if (c.z > 5) {
        respawnCollectible(c, w.obstacles, w.rng);
      }

      const g = collectibleRefs.current[i];
      if (g) {
        g.position.z = c.z;
        g.rotation.z = (c.faceIndex / GAME.faces) * Math.PI * 2;
        g.visible = true;
      }
    }

    // --- Obstacle hit (after collectibles). Never end when overlapping a collectible. ---
    for (let i = 0; i < w.obstacles.length; i++) {
      const o = w.obstacles[i];
      const prevZ = o.z - w.speed * delta;
      const segMin = Math.min(prevZ, o.z) - obsHalf;
      const segMax = Math.max(prevZ, o.z) + obsHalf;
      const sweptOverlap =
        playerZ - playerHalf < segMax && playerZ + playerHalf > segMin;
      const sameFace = sameFaceObstacle(
        o.faceIndex,
        w.worldRot,
        GAME.faceHitTightness
      );
      const skipHit = invuln || w.collectedThisFrame;
      if (!skipHit && sweptOverlap && sameFace) {
        octaSurgeState.end();
        endFrame();
        return;
      }

      const ref = obstacleRefs.current[i];
      if (ref) {
        ref.position.z = o.z;
        ref.rotation.z = (o.faceIndex / GAME.faces) * Math.PI * 2;
        ref.visible = true;
      }
      const bump = bumpRefs.current[i];
      const hole = holeRefs.current[i];
      if (bump) bump.visible = o.type === 'bump';
      if (hole) hole.visible = o.type === 'hole';
    }

    // --- Update collection effects (move with world, cull expired, set age) ---
    const now = w.elapsed;
    const pending = pendingEffectsRef.current;
    pendingEffectsRef.current = [];
    const base = [...collectionEffectsRef.current, ...pending];
    const updated = base
      .filter((e) => now - e.bornAt < e.life)
      .map((e) => {
        const age = now - e.bornAt;
        return { ...e, z: e.z + w.speed * delta, age };
      });
    if (updated.length > 0 || base.length > 0) {
      setCollectionEffects(updated);
    }

    endFrame();
  });

  const faces = useMemo(
    () => Array.from({ length: GAME.faces }, (_, i) => i),
    []
  );

  // Build a fixed number of rings (same count as initialized)
  const ringCount = 26;
  const rings = useMemo(
    () => Array.from({ length: ringCount }, (_, i) => i),
    []
  );

  return (
    <group>
      <OctaSurgeUI />

      {/* Lights — bright end glow + fill */}
      <ambientLight intensity={0.4} />
      <pointLight
        position={[0, 0, -70]}
        intensity={4}
        distance={160}
        color="#e0f0ff"
      />
      <pointLight
        position={[0, 0, -40]}
        intensity={1.5}
        distance={80}
        color="#ffb3d9"
      />
      <directionalLight position={[6, 8, 10]} intensity={0.85} />

      {/* Tunnel */}
      <group ref={tunnelGroup}>
        {faces.map((i) => {
          const angle = (i / GAME.faces) * Math.PI * 2;

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
                  metalness={0.08}
                  emissive={'#0d0820'}
                  emissiveIntensity={0.4}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}

        {/* Outline rings */}
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
              -GAME.tunnelLength + (i / ringCount) * GAME.tunnelLength,
            ]}
          >
            <meshBasicMaterial
              color={'#88ccff'}
              wireframe
              transparent
              opacity={0.2}
            />
          </mesh>
        ))}

        {/* Obstacles — position.z, rotation.z, bump/hole visibility set in useFrame */}
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
                color={'#1a0a12'}
                emissive={'#8B1538'}
                emissiveIntensity={0.25}
                roughness={0.5}
                metalness={0.15}
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
                color={'#000000'}
                transparent
                opacity={0.55}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}

        {/* Collectibles — position.z, rotation.z, visibility set in useFrame */}
        {Array.from(
          { length: GAME.collectibleCount + GAME.specialCollectibleCount },
          (_, i) => i
        ).map((i) => {
          const isSpecial = i >= GAME.collectibleCount;
          return (
            <group
              key={`c-${i}`}
              ref={(g) => {
                if (g) collectibleRefs.current[i] = g;
              }}
              position={[0, 0, 0]}
            >
              <mesh
                position={[0, geom.apothem - 0.15, 0]}
                geometry={isSpecial ? geom.specialGeo : geom.collectibleGeo}
              >
                <meshStandardMaterial
                  color={isSpecial ? '#A78BFA' : '#FBBF24'}
                  emissive={isSpecial ? '#7C3AED' : '#F59E0B'}
                  emissiveIntensity={isSpecial ? 0.5 : 0.4}
                  roughness={0.2}
                  metalness={0.3}
                />
              </mesh>
            </group>
          );
        })}

        {/* Collection effects — burst + glow that scale up and fade */}
        {collectionEffects.map((e) => {
          const age = e.age ?? 0;
          const t = Math.min(1, age / Math.max(0.01, e.life));
          const scale = 0.5 + 1.2 * Math.min(1, t * 2.5);
          const opacity = 1 - t * t;
          const isSpecial = e.type === 'special';
          return (
            <group
              key={`eff-${e.id}`}
              position={[0, 0, e.z]}
              rotation={[0, 0, (e.faceIndex / GAME.faces) * Math.PI * 2]}
              scale={[scale, scale, scale]}
            >
              <mesh
                position={[0, geom.apothem - 0.15, 0]}
                geometry={geom.collectibleGeo}
              >
                <meshBasicMaterial
                  color={isSpecial ? '#C4B5FD' : '#FDE68A'}
                  transparent
                  opacity={opacity * 0.95}
                />
              </mesh>
              <mesh
                position={[0, geom.apothem - 0.15, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geom.effectRingGeo}
              >
                <meshBasicMaterial
                  color={isSpecial ? '#A78BFA' : '#FBBF24'}
                  transparent
                  opacity={opacity * 0.6}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Player — faceted blue sphere (per reference) */}
      <group position={[0, -(GAME.apothem - GAME.playerInset), playerZ]}>
        <mesh geometry={geom.playerGeo}>
          <meshStandardMaterial
            color={'#3B82F6'}
            emissive={'#1E40AF'}
            emissiveIntensity={0.2}
            roughness={0.2}
            metalness={0.4}
          />
        </mesh>
        <mesh geometry={geom.innerGeo} position={[0, 0.16, 0]}>
          <meshStandardMaterial
            color={'#E0F0FF'}
            roughness={0.15}
            emissive={'#1a2744'}
          />
        </mesh>
      </group>

      {/* Subtle stars */}
      <Stars
        radius={90}
        depth={80}
        count={1200}
        factor={2}
        saturation={0}
        fade
      />
    </group>
  );
}

export { octaSurgeState };
