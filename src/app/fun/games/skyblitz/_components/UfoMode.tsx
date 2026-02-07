import { Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  ALIEN_COLLISION_RADIUS,
  DEATH_ANIM_DURATION,
  MAX_FRAME_DELTA,
  MAX_PROJECTILES,
  NUM_OBSTACLES,
  OBSTACLE_RESPAWN_BUFFER,
  OBSTACLE_SPREAD_Z,
  PLAYER_COLLISION_RADIUS,
  PLAYER_FIRE_COOLDOWN,
  PLAYER_HIT_COOLDOWN,
  PROJECTILE_RADIUS,
  PROJECTILE_SPEED,
  PROJECTILE_SPAWN_OFFSET,
  PROJECTILE_TTL,
  WAVE_KILL_TARGET,
} from '../constants';
import { useUfoControls } from '../hooks/useUfoControls';
import { skyBlitzState } from '../state';
import type { AlienData, ProjectileData } from '../types';
import { generateRandomPosition } from '../utils/spawn';
import AlienObstacle from './AlienObstacle';
import ProjectileMesh from './ProjectileMesh';
import UfoGround from './UfoGround';
import UfoPlayer from './UfoPlayer';

const UfoMode: React.FC = () => {
  const snap = useSnapshot(skyBlitzState);
  const { camera, pointer } = useThree();
  const playerRef = useRef<THREE.Group>(null!);

  const [initialized, setInitialized] = useState(false);

  const aliensRef = useRef<AlienData[]>([]);
  const alienMeshRefs = useRef<(THREE.Group | null)[]>([]);
  const starsGroupRef = useRef<THREE.Group | null>(null);

  const projectilesRef = useRef<ProjectileData[]>([]);
  const projectileMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const projectileWriteIndex = useRef(0);

  const lastDamageTime = useRef(0);
  const shootingRef = useRef(false);
  const lastShotTime = useRef(0);
  const scoreAccumulator = useRef(0);
  const killsThisWave = useRef(0);
  const lastScoreSync = useRef(0);

  const aimRaycaster = useRef(new THREE.Raycaster());
  const tmpDir = useRef(new THREE.Vector3());
  const tmpPos = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  const tmpPrevPos = useRef(new THREE.Vector3());
  const tmpAB = useRef(new THREE.Vector3());
  const tmpAP = useRef(new THREE.Vector3());
  const tmpClosest = useRef(new THREE.Vector3());

  const SPAWN_AHEAD = 60;
  const DESPAWN_BEHIND = 28;
  const AIM_DISTANCE = 220;

  const respawnAlien = useCallback((alien: AlienData, z: number) => {
    const pos = generateRandomPosition(z);
    alien.position.set(...pos);
    alien.baseX = pos[0];
    alien.baseY = pos[1];
    alien.driftAmpX = 0.6 + Math.random() * 1.8;
    alien.driftAmpY = 0.25 + Math.random() * 1.1;
    alien.driftSpeed = 0.55 + Math.random() * 0.9;
    alien.driftPhase = Math.random() * Math.PI * 2;

    alien.health = skyBlitzState.wave;
    alien.maxHealth = skyBlitzState.wave;
    alien.alive = true;
    alien.scale = 1;
    alien.deathStart = 0;
    alien.respawnAt = 0;
  }, []);

  useEffect(() => {
    const initialAliens: AlienData[] = [];
    for (let i = 0; i < NUM_OBSTACLES; i++) {
      const z =
        -SPAWN_AHEAD -
        i * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES) -
        Math.random() * OBSTACLE_RESPAWN_BUFFER;
      const pos = generateRandomPosition(z);
      const alien: AlienData = {
        id: i,
        position: new THREE.Vector3(...pos),
        health: 1,
        maxHealth: 1,
        alive: true,
        scale: 1,
        deathStart: 0,
        respawnAt: 0,
        baseX: pos[0],
        baseY: pos[1],
        driftAmpX: 0.8 + Math.random() * 1.2,
        driftAmpY: 0.25 + Math.random() * 0.8,
        driftSpeed: 0.55 + Math.random() * 0.9,
        driftPhase: Math.random() * Math.PI * 2,
      };
      initialAliens.push(alien);
    }
    aliensRef.current = initialAliens;

    projectilesRef.current = Array.from(
      { length: MAX_PROJECTILES },
      (_, idx) => ({
        id: idx,
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        active: false,
        spawnedAt: 0,
      })
    );

    projectileWriteIndex.current = 0;
    lastDamageTime.current = 0;
    lastShotTime.current = 0;
    scoreAccumulator.current = 0;
    killsThisWave.current = 0;
    lastScoreSync.current = 0;

    skyBlitzState.phase = 'playing';
    skyBlitzState.health = 100;
    skyBlitzState.score = 0;
    skyBlitzState.wave = 1;

    setInitialized(true);
  }, []);

  const tryShoot = useCallback(
    (now: number) => {
      if (!playerRef.current || skyBlitzState.phase !== 'playing') return;
      if (now - lastShotTime.current < PLAYER_FIRE_COOLDOWN) return;
      lastShotTime.current = now;

      // Shoot through the crosshair (camera ray) while spawning from the ship.
      aimRaycaster.current.setFromCamera(pointer, camera);
      tmpDir.current.copy(aimRaycaster.current.ray.direction).normalize();
      tmpTarget.current
        .copy(aimRaycaster.current.ray.origin)
        .addScaledVector(tmpDir.current, AIM_DISTANCE);

      tmpPos.current.copy(playerRef.current.position);
      tmpPos.current.y += 0.25;
      tmpDir.current.subVectors(tmpTarget.current, tmpPos.current).normalize();
      tmpPos.current.addScaledVector(tmpDir.current, PROJECTILE_SPAWN_OFFSET);

      const idx = projectileWriteIndex.current;
      projectileWriteIndex.current = (idx + 1) % MAX_PROJECTILES;

      const p = projectilesRef.current[idx];
      p.active = true;
      p.spawnedAt = now;
      p.position.copy(tmpPos.current);
      p.velocity.copy(tmpDir.current).multiplyScalar(PROJECTILE_SPEED);
    },
    [
      camera,
      pointer,
      playerRef,
      projectilesRef,
      projectileWriteIndex,
      lastShotTime,
      aimRaycaster,
      tmpDir,
      tmpPos,
      tmpTarget,
    ]
  );

  useUfoControls({ shootingRef, tryShoot });

  useFrame((_, delta) => {
    if (!playerRef.current) return;
    if (starsGroupRef.current) {
      starsGroupRef.current.position.copy(camera.position);
    }

    const dt = Math.min(delta, MAX_FRAME_DELTA);
    const now = performance.now();

    if (skyBlitzState.phase === 'playing') {
      scoreAccumulator.current += dt * 10;
    }

    if (skyBlitzState.phase !== 'playing') return;

    if (shootingRef.current) {
      tryShoot(now);
    }

    const playerPos = playerRef.current.position;

    const projHitDistSq = (ALIEN_COLLISION_RADIUS + PROJECTILE_RADIUS) ** 2;
    const playerHitDistSq =
      (PLAYER_COLLISION_RADIUS + ALIEN_COLLISION_RADIUS) ** 2;

    for (let i = 0; i < projectilesRef.current.length; i++) {
      const proj = projectilesRef.current[i];
      const mesh = projectileMeshRefs.current[i];

      if (!proj.active) {
        if (mesh) mesh.visible = false;
        continue;
      }

      tmpPrevPos.current.copy(proj.position);
      proj.position.addScaledVector(proj.velocity, dt);

      if (now - proj.spawnedAt > PROJECTILE_TTL) {
        proj.active = false;
        if (mesh) mesh.visible = false;
        continue;
      }

      // Continuous collision: fast projectiles can tunnel through at low FPS.
      tmpAB.current.subVectors(proj.position, tmpPrevPos.current);
      const abLenSq = tmpAB.current.lengthSq();
      for (const alien of aliensRef.current) {
        if (!alien.alive) continue;

        let hit = false;
        if (abLenSq < 1e-9) {
          hit = alien.position.distanceToSquared(proj.position) <= projHitDistSq;
        } else {
          tmpAP.current.subVectors(alien.position, tmpPrevPos.current);
          const t = THREE.MathUtils.clamp(tmpAP.current.dot(tmpAB.current) / abLenSq, 0, 1);
          tmpClosest.current.copy(tmpPrevPos.current).addScaledVector(tmpAB.current, t);
          hit = alien.position.distanceToSquared(tmpClosest.current) <= projHitDistSq;
        }

        if (!hit) continue;

        proj.active = false;
        scoreAccumulator.current += 10;

        alien.health -= 1;
        if (alien.health <= 0) {
          alien.alive = false;
          alien.deathStart = now;
          alien.respawnAt = now + DEATH_ANIM_DURATION;
          killsThisWave.current += 1;
          scoreAccumulator.current += 50 * skyBlitzState.wave;
        }
        break;
      }

      if (mesh) {
        mesh.visible = proj.active;
        mesh.position.copy(proj.position);
      }
    }

    const t = now * 0.001;
    const approachSpeed = Math.min(14, 6 + skyBlitzState.wave * 0.55);
    const chase = Math.min(1, dt * (0.55 + skyBlitzState.wave * 0.03));

    for (let i = 0; i < aliensRef.current.length; i++) {
      const alien = aliensRef.current[i];
      const mesh = alienMeshRefs.current[i];

      if (!alien.alive) {
        const deathElapsed = now - alien.deathStart;
        const shrink = 1 - Math.min(deathElapsed / DEATH_ANIM_DURATION, 1);
        alien.scale = Math.max(0, shrink);

        if (now >= alien.respawnAt) {
          const z =
            playerPos.z -
            OBSTACLE_SPREAD_Z -
            Math.random() * OBSTACLE_RESPAWN_BUFFER;
          respawnAlien(alien, z);
        }
      } else {
        // Aliens drift organically while "coming at" the player.
        alien.position.z += approachSpeed * dt;

        alien.baseX = THREE.MathUtils.lerp(alien.baseX, playerPos.x, chase * 0.22);
        alien.baseY = THREE.MathUtils.lerp(alien.baseY, playerPos.y, chase * 0.18);
        alien.baseX = THREE.MathUtils.clamp(alien.baseX, -7.2, 7.2);
        alien.baseY = THREE.MathUtils.clamp(alien.baseY, 0, 5.6);

        const driftT = t * alien.driftSpeed + alien.driftPhase;
        alien.position.x = alien.baseX + Math.sin(driftT) * alien.driftAmpX;
        alien.position.y = alien.baseY + Math.cos(driftT * 1.1) * alien.driftAmpY;
        alien.position.x = THREE.MathUtils.clamp(alien.position.x, -7.5, 7.5);
        alien.position.y = THREE.MathUtils.clamp(alien.position.y, 0, 6);

        if (alien.position.z - playerPos.z > DESPAWN_BEHIND) {
          const z =
            playerPos.z -
            OBSTACLE_SPREAD_Z -
            Math.random() * OBSTACLE_RESPAWN_BUFFER;
          respawnAlien(alien, z);
        }

        if (alien.position.distanceToSquared(playerPos) <= playerHitDistSq) {
          if (now - lastDamageTime.current > PLAYER_HIT_COOLDOWN) {
            lastDamageTime.current = now;
            skyBlitzState.health = Math.max(0, skyBlitzState.health - 10);

            alien.alive = false;
            alien.deathStart = now;
            alien.respawnAt = now + DEATH_ANIM_DURATION;

            if (skyBlitzState.health <= 0) {
              skyBlitzState.phase = 'gameover';
            }
          }
        }
      }

      if (mesh) {
        mesh.visible = alien.scale > 0.01;
        mesh.position.copy(alien.position);
        mesh.scale.setScalar(alien.scale);
      }
    }

    if (killsThisWave.current >= WAVE_KILL_TARGET) {
      skyBlitzState.wave += 1;
      killsThisWave.current = 0;

      for (let i = 0; i < NUM_OBSTACLES; i++) {
        const alien = aliensRef.current[i];
        const z =
          playerPos.z -
          SPAWN_AHEAD -
          i * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES) -
          Math.random() * OBSTACLE_RESPAWN_BUFFER;
        respawnAlien(alien, z);
      }
    }

    if (now - lastScoreSync.current > 75) {
      lastScoreSync.current = now;
      skyBlitzState.score = Math.floor(scoreAccumulator.current);
    }
  });

  return (
    <>
      <Sky
        distance={450000}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        inclination={0.49}
        azimuth={0.25}
      />
      <group ref={starsGroupRef}>
        <Stars
          radius={300}
          depth={500}
          count={5000}
          factor={2}
          saturation={0}
          fade
        />
      </group>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <pointLight
        distance={400}
        position={[0, 100, -420]}
        intensity={5}
        color="indianred"
      />

      <UfoGround />
      <UfoPlayer playerRef={playerRef} />

      {initialized &&
        aliensRef.current.map((alien) => (
          <AlienObstacle
            key={alien.id}
            ref={(el) => {
              alienMeshRefs.current[alien.id] = el;
            }}
            color={snap.skin}
          />
        ))}

      {initialized &&
        projectilesRef.current.map((proj) => (
          <ProjectileMesh
            key={proj.id}
            ref={(el) => {
              projectileMeshRefs.current[proj.id] = el;
            }}
          />
        ))}
    </>
  );
};

export default UfoMode;
