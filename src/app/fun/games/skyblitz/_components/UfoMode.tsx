import { Sky, Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  ALIEN_COLLISION_RADIUS,
  ALIEN_DESPAWN_Z,
  DEATH_ANIM_DURATION,
  MAX_FRAME_DELTA,
  MAX_PROJECTILES,
  NUM_OBSTACLES,
  OBSTACLE_RESPAWN_BUFFER,
  OBSTACLE_SPREAD_Z,
  PLAYER_COLLISION_RADIUS,
  PLAYER_FIRE_COOLDOWN,
  PLAYER_HIT_COOLDOWN,
  PLAYER_SPEED,
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
  const playerRef = useRef<THREE.Group>(null!);

  const [initialized, setInitialized] = useState(false);

  const aliensRef = useRef<AlienData[]>([]);
  const alienMeshRefs = useRef<(THREE.Group | null)[]>([]);

  const projectilesRef = useRef<ProjectileData[]>([]);
  const projectileMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const projectileWriteIndex = useRef(0);

  const lastDamageTime = useRef(0);
  const shootingRef = useRef(false);
  const lastShotTime = useRef(0);
  const scoreAccumulator = useRef(0);
  const killsThisWave = useRef(0);
  const lastScoreSync = useRef(0);

  const tmpDir = useRef(new THREE.Vector3());
  const tmpPos = useRef(new THREE.Vector3());

  useEffect(() => {
    const initialAliens: AlienData[] = [];
    for (let i = 0; i < NUM_OBSTACLES; i++) {
      const z = -20 - i * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES);
      const pos = generateRandomPosition(z);
      initialAliens.push({
        id: i,
        position: new THREE.Vector3(...pos),
        health: 1,
        maxHealth: 1,
        alive: true,
        scale: 1,
        deathStart: 0,
        respawnAt: 0,
      });
    }
    aliensRef.current = initialAliens;

    projectilesRef.current = Array.from({ length: MAX_PROJECTILES }, (_, idx) => ({
      id: idx,
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      active: false,
      spawnedAt: 0,
    }));

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

      tmpDir.current
        .set(0, 0, -1)
        .applyQuaternion(playerRef.current.quaternion)
        .normalize();
      tmpPos.current
        .copy(playerRef.current.position)
        .addScaledVector(tmpDir.current, PROJECTILE_SPAWN_OFFSET);
      tmpPos.current.y += 0.25;

      const idx = projectileWriteIndex.current;
      projectileWriteIndex.current = (idx + 1) % MAX_PROJECTILES;

      const p = projectilesRef.current[idx];
      p.active = true;
      p.spawnedAt = now;
      p.position.copy(tmpPos.current);
      p.velocity.copy(tmpDir.current).multiplyScalar(PROJECTILE_SPEED);
    },
    [playerRef, projectilesRef, projectileWriteIndex, lastShotTime, tmpDir, tmpPos]
  );

  useUfoControls({ shootingRef, tryShoot });

  useFrame((_, delta) => {
    if (!playerRef.current) return;

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
    const playerHitDistSq = (PLAYER_COLLISION_RADIUS + ALIEN_COLLISION_RADIUS) ** 2;

    for (let i = 0; i < projectilesRef.current.length; i++) {
      const proj = projectilesRef.current[i];
      const mesh = projectileMeshRefs.current[i];

      if (!proj.active) {
        if (mesh) mesh.visible = false;
        continue;
      }

      proj.position.addScaledVector(proj.velocity, dt);

      if (now - proj.spawnedAt > PROJECTILE_TTL) {
        proj.active = false;
        if (mesh) mesh.visible = false;
        continue;
      }

      for (const alien of aliensRef.current) {
        if (!alien.alive) continue;
        if (alien.position.distanceToSquared(proj.position) <= projHitDistSq) {
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
      }

      if (mesh) {
        mesh.visible = proj.active;
        mesh.position.copy(proj.position);
      }
    }

    for (let i = 0; i < aliensRef.current.length; i++) {
      const alien = aliensRef.current[i];
      const mesh = alienMeshRefs.current[i];

      if (!alien.alive) {
        const deathElapsed = now - alien.deathStart;
        const shrink = 1 - Math.min(deathElapsed / DEATH_ANIM_DURATION, 1);
        alien.scale = Math.max(0, shrink);

        if (now >= alien.respawnAt) {
          const z = -OBSTACLE_SPREAD_Z - Math.random() * OBSTACLE_RESPAWN_BUFFER;
          const newPos = generateRandomPosition(z);
          alien.position.set(...newPos);
          alien.health = skyBlitzState.wave;
          alien.maxHealth = skyBlitzState.wave;
          alien.alive = true;
          alien.scale = 1;
          alien.deathStart = 0;
          alien.respawnAt = 0;
        }
      } else {
        alien.position.z += PLAYER_SPEED * dt;

        if (alien.position.z > ALIEN_DESPAWN_Z) {
          const z = -OBSTACLE_SPREAD_Z - Math.random() * OBSTACLE_RESPAWN_BUFFER;
          const newPos = generateRandomPosition(z);
          alien.position.set(...newPos);
          alien.health = skyBlitzState.wave;
          alien.maxHealth = skyBlitzState.wave;
          alien.scale = 1;
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
        const z = -20 - i * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES);
        const pos = generateRandomPosition(z);
        const alien = aliensRef.current[i];
        alien.position.set(...pos);
        alien.health = skyBlitzState.wave;
        alien.maxHealth = skyBlitzState.wave;
        alien.alive = true;
        alien.scale = 1;
        alien.deathStart = 0;
        alien.respawnAt = 0;
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
      <Stars radius={300} depth={500} count={5000} factor={2} saturation={0} fade />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <pointLight distance={400} position={[0, 100, -420]} intensity={5} color="indianred" />

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
