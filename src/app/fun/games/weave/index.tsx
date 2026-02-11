/**
 * Weave.tsx
 *
 * A neon arcade game where you orbit the center, dodging sweeping laser arms
 * while collecting glowing orbs to build score. Thread through danger,
 * collect the light, survive as long as you can.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import BackgroundGrid from './_components/BackgroundGrid';
import CentralCore from './_components/CentralCore';
import DangerZone from './_components/DangerZone';
import LaserArm from './_components/LaserArm';
import LivesDisplay from './_components/LivesDisplay';
import OrbitRing from './_components/OrbitRing';
import OrbEntity from './_components/Orb';
import ParticleEffect from './_components/ParticleEffect';
import Player from './_components/Player';
import WeaveHUD from './_components/WeaveHUD';
import {
  ARM_COLOR,
  BASE_ARM_SPEED,
  BASE_PLAYER_SPEED,
  BONUS_ORB_COLOR,
  INVINCIBILITY_TIME,
  LEVEL_UP_ORBS,
  MULTI_LASER_COOLDOWN_MAX,
  MULTI_LASER_COOLDOWN_MIN,
  MULTI_LASER_MAX_DURATION,
  MULTI_LASER_MIN_DURATION,
  NEON_COLORS,
  ORB_COLOR,
  ORB_COLLECT_RADIUS,
  ORB_LIFETIME,
  ORB_SPAWN_INTERVAL,
  OUTER_RADIUS,
  PLAYER_ORBIT_RADIUS,
} from './constants';
import { weaveState } from './state';
import type { LaserArm as LaserArmType, Orb, Particle } from './types';
import { checkArmCollision } from './utils/collision';

export { weaveState } from './state';
export * from './constants';
export * from './types';

type ParticleBurstOptions = {
  speedMin?: number;
  speedMax?: number;
  lifeMin?: number;
  lifeMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  dragMin?: number;
  dragMax?: number;
  glowMin?: number;
  glowMax?: number;
  zMin?: number;
  zMax?: number;
  vzMin?: number;
  vzMax?: number;
};

type ImpactWave = {
  id: string;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
  startRadius: number;
  endRadius: number;
  thickness: number;
  color: string;
};

const Weave: React.FC<{ soundsOn?: boolean }> = ({
  soundsOn: _soundsOn = true,
}) => {
  const snap = useSnapshot(weaveState);
  const { camera, scene } = useThree();

  const [playerAngle, setPlayerAngle] = useState(Math.PI / 2);
  const [arms, setArms] = useState<LaserArmType[]>([]);
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [impactWaves, setImpactWaves] = useState<ImpactWave[]>([]);
  const [isHit, setIsHit] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [corePulse, setCorePulse] = useState(0);
  const [laserCount, setLaserCount] = useState(1);
  const [laserBurstLabel, setLaserBurstLabel] = useState<string | null>(null);
  const [damageFlash, setDamageFlash] = useState(0);

  const playerDirection = useRef(0);
  const lastNonZeroDirection = useRef<1 | -1>(1);
  const lastOrbSpawn = useRef(0);
  const invincibleTimer = useRef(0);
  const gameTime = useRef(0);
  const levelOrbCount = useRef(0);
  const burstEndsAt = useRef<number | null>(null);
  const nextBurstAt = useRef<number>(12);
  const milestone3Done = useRef(false);
  const milestone4Done = useRef(false);
  const rotationDirectionRef = useRef<1 | -1>(Math.random() > 0.5 ? 1 : -1);
  const cameraShake = useRef(0);

  const currentColor = NEON_COLORS[(snap.level - 1) % NEON_COLORS.length];

  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    scene.background = new THREE.Color('#08080f');
  }, [camera, scene]);

  const generateArms = useCallback(
    (level: number, armCountOverride?: number, baseAngle = 0) => {
      const armCount = Math.max(1, Math.min(armCountOverride ?? 1, 4));
      const newArms: LaserArmType[] = [];
      const baseSpeed = BASE_ARM_SPEED * (1 + (level - 1) * 0.08);
      const rotationDirection = rotationDirectionRef.current;

      for (let i = 0; i < armCount; i++) {
        const angleOffset = (i / armCount) * Math.PI * 2;
        const speedVariation = 0.95 + Math.random() * 0.1;

        newArms.push({
          id: `arm-${i}`,
          angle: baseAngle + angleOffset,
          speed: baseSpeed * rotationDirection * speedVariation,
          length: OUTER_RADIUS,
          color: ARM_COLOR,
        });
      }

      return newArms;
    },
    []
  );

  useEffect(() => {
    setLaserCount(1);
    setArms(generateArms(1, 1, 0));
  }, [generateArms]);

  const spawnParticles = useCallback(
    (
      x: number,
      y: number,
      color: string,
      count: number,
      options: ParticleBurstOptions = {}
    ) => {
      const speedMin = options.speedMin ?? 1;
      const speedMax = options.speedMax ?? 2.5;
      const lifeMin = options.lifeMin ?? 0.45;
      const lifeMax = options.lifeMax ?? 0.95;
      const sizeMin = options.sizeMin ?? 0.05;
      const sizeMax = options.sizeMax ?? 0.12;
      const dragMin = options.dragMin ?? 0.8;
      const dragMax = options.dragMax ?? 0.93;
      const glowMin = options.glowMin ?? 1;
      const glowMax = options.glowMax ?? 1.8;
      const zMin = options.zMin ?? -0.06;
      const zMax = options.zMax ?? 0.22;
      const vzMin = options.vzMin ?? -0.6;
      const vzMax = options.vzMax ?? 0.9;

      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        newParticles.push({
          id: `p-${Date.now()}-${i}`,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          z: zMin + Math.random() * (zMax - zMin),
          vz: vzMin + Math.random() * (vzMax - vzMin),
          life: lifeMin + Math.random() * (lifeMax - lifeMin),
          color,
          size: sizeMin + Math.random() * (sizeMax - sizeMin),
          drag: dragMin + Math.random() * (dragMax - dragMin),
          spin: (Math.random() - 0.5) * 16,
          glow: glowMin + Math.random() * (glowMax - glowMin),
        });
      }
      setParticles((prev) => [...prev, ...newParticles]);
    },
    []
  );

  const spawnImpactWave = useCallback(
    (
      x: number,
      y: number,
      color: string,
      options: {
        life?: number;
        startRadius?: number;
        endRadius?: number;
        thickness?: number;
        z?: number;
      } = {}
    ) => {
      const life = options.life ?? 0.45;
      const wave: ImpactWave = {
        id: `wave-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x,
        y,
        z: options.z ?? 0.05,
        life,
        maxLife: life,
        startRadius: options.startRadius ?? 0.1,
        endRadius: options.endRadius ?? 0.9,
        thickness: options.thickness ?? 0.12,
        color,
      };
      setImpactWaves((prev) => [...prev, wave]);
    },
    []
  );

  const resetRun = useCallback(() => {
    weaveState.reset();
    setPlayerAngle(Math.PI / 2);
    setOrbs([]);
    setParticles([]);
    setImpactWaves([]);
    setLaserCount(1);
    rotationDirectionRef.current = Math.random() > 0.5 ? 1 : -1;
    setArms(generateArms(1, 1, 0));
    setGameStarted(true);
    setDamageFlash(0);
    levelOrbCount.current = 0;
    gameTime.current = 0;
    lastOrbSpawn.current = 0;
    burstEndsAt.current = null;
    nextBurstAt.current = 12;
    milestone3Done.current = false;
    milestone4Done.current = false;
    cameraShake.current = 0;
  }, [generateArms]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const lower = key.toLowerCase();

      if (snap.gameOver) {
        if (lower === 'r') {
          resetRun();
        }
        return;
      }

      if (!gameStarted) {
        if (
          key === ' ' ||
          lower === 'a' ||
          lower === 'd' ||
          key === 'ArrowLeft' ||
          key === 'ArrowRight'
        ) {
          e.preventDefault();
          setGameStarted(true);
        }
        return;
      }

      if (key === ' ') {
        e.preventDefault();
        if (
          snap.controlScheme === 'keyboard' ||
          snap.controlScheme === 'hybrid'
        ) {
          const next =
            playerDirection.current === 0
              ? -lastNonZeroDirection.current
              : playerDirection.current * -1;
          playerDirection.current = next;
          lastNonZeroDirection.current = next as 1 | -1;
        }
        return;
      }

      if (
        snap.controlScheme === 'keyboard' ||
        snap.controlScheme === 'hybrid'
      ) {
        if (key === 'ArrowLeft' || lower === 'a') {
          playerDirection.current = 1;
          lastNonZeroDirection.current = 1;
        } else if (key === 'ArrowRight' || lower === 'd') {
          playerDirection.current = -1;
          lastNonZeroDirection.current = -1;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      const lower = key.toLowerCase();
      if (
        snap.controlScheme === 'keyboard' ||
        snap.controlScheme === 'hybrid'
      ) {
        if (key === 'ArrowLeft' || lower === 'a') {
          if (playerDirection.current === 1) playerDirection.current = 0;
        } else if (key === 'ArrowRight' || lower === 'd') {
          if (playerDirection.current === -1) playerDirection.current = 0;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [snap.controlScheme, snap.gameOver, gameStarted, resetRun]);

  useEffect(() => {
    let isPointerDown = false;
    let lastX = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (!gameStarted && !snap.gameOver) {
        setGameStarted(true);
        return;
      }
      if (snap.gameOver) {
        resetRun();
        return;
      }
      isPointerDown = true;
      lastX = e.clientX;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!gameStarted || snap.gameOver) return;
      if (snap.controlScheme === 'keyboard') return;

      if (isPointerDown) {
        const dx = e.clientX - lastX;
        if (Math.abs(dx) > 2) {
          playerDirection.current = dx > 0 ? -1 : 1;
          lastNonZeroDirection.current = playerDirection.current as 1 | -1;
        }
        lastX = e.clientX;
      } else {
        const centerX = window.innerWidth / 2;
        const deadzone = 80;
        if (e.clientX < centerX - deadzone) {
          playerDirection.current = 1;
          lastNonZeroDirection.current = 1;
        } else if (e.clientX > centerX + deadzone) {
          playerDirection.current = -1;
          lastNonZeroDirection.current = -1;
        } else {
          playerDirection.current = 0;
        }
      }
    };

    const handlePointerUp = () => {
      isPointerDown = false;
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [snap.controlScheme, snap.gameOver, gameStarted, resetRun]);

  useFrame((_, delta) => {
    if (snap.gameOver || !gameStarted) return;

    gameTime.current += delta;

    const t = gameTime.current;
    const allow3 = t >= 120;
    const allow4 = t >= 180;

    const startBurst = (count: number, label: string) => {
      const duration =
        MULTI_LASER_MIN_DURATION +
        Math.random() * (MULTI_LASER_MAX_DURATION - MULTI_LASER_MIN_DURATION);
      burstEndsAt.current = t + duration;
      setLaserCount(count);
      const baseAngle = arms[0]?.angle ?? 0;
      setArms(generateArms(snap.level, count, baseAngle));
      setLaserBurstLabel(label);
      window.setTimeout(() => setLaserBurstLabel(null), 1200);
      const cooldown =
        MULTI_LASER_COOLDOWN_MIN +
        Math.random() * (MULTI_LASER_COOLDOWN_MAX - MULTI_LASER_COOLDOWN_MIN);
      nextBurstAt.current = t + duration + cooldown;
    };

    if (allow4 && !milestone4Done.current && !burstEndsAt.current) {
      milestone4Done.current = true;
      startBurst(4, 'QUAD LASERS');
    } else if (allow3 && !milestone3Done.current && !burstEndsAt.current) {
      milestone3Done.current = true;
      startBurst(3, 'TRIPLE LASERS');
    } else if (!burstEndsAt.current && t >= nextBurstAt.current) {
      const max = allow4 ? 4 : allow3 ? 3 : 2;
      const count = 2 + Math.floor(Math.random() * (max - 1));
      startBurst(
        count,
        count === 2
          ? 'DUAL LASERS'
          : count === 3
            ? 'TRIPLE LASERS'
            : 'QUAD LASERS'
      );
    } else if (burstEndsAt.current && t >= burstEndsAt.current) {
      burstEndsAt.current = null;
      setLaserCount(1);
      const baseAngle = arms[0]?.angle ?? 0;
      setArms(generateArms(snap.level, 1, baseAngle));
      setLaserBurstLabel('BACK TO SINGLE');
      window.setTimeout(() => setLaserBurstLabel(null), 900);
    }

    if (weaveState.invincible) {
      invincibleTimer.current -= delta;
      if (invincibleTimer.current <= 0) {
        weaveState.invincible = false;
        setIsHit(false);
      }
    }

    const playerSpeed = BASE_PLAYER_SPEED * (1 + snap.level * 0.08);
    if (playerDirection.current !== 0) {
      setPlayerAngle(
        (prev) => prev + playerDirection.current * playerSpeed * delta
      );
    }

    const levelSpeedMultiplier = 1 + (snap.level - 1) * 0.05;
    setArms((prev) =>
      prev.map((arm) => ({
        ...arm,
        angle: arm.angle + arm.speed * levelSpeedMultiplier * delta,
      }))
    );

    if (!weaveState.invincible) {
      const hit = checkArmCollision(playerAngle, arms);
      if (hit) {
        setIsHit(true);
        weaveState.lives -= 1;
        weaveState.combo = 0;
        weaveState.invincible = true;
        invincibleTimer.current = INVINCIBILITY_TIME;

        const px = Math.cos(playerAngle) * PLAYER_ORBIT_RADIUS;
        const py = Math.sin(playerAngle) * PLAYER_ORBIT_RADIUS;
        spawnParticles(px, py, '#ff3366', 28, {
          speedMin: 2.2,
          speedMax: 4.8,
          lifeMin: 0.65,
          lifeMax: 1.15,
          sizeMin: 0.06,
          sizeMax: 0.14,
          glowMin: 1.3,
          glowMax: 2.2,
          dragMin: 0.75,
          dragMax: 0.88,
          zMin: -0.08,
          zMax: 0.24,
          vzMin: -1.1,
          vzMax: 1.4,
        });
        spawnParticles(px, py, '#ffd6e3', 10, {
          speedMin: 1.3,
          speedMax: 2.6,
          lifeMin: 0.5,
          lifeMax: 0.9,
          sizeMin: 0.04,
          sizeMax: 0.08,
          glowMin: 1.1,
          glowMax: 1.6,
          dragMin: 0.82,
          dragMax: 0.92,
          zMin: -0.03,
          zMax: 0.16,
          vzMin: -0.5,
          vzMax: 0.9,
        });
        cameraShake.current = Math.min(1, cameraShake.current + 0.95);
        spawnImpactWave(px, py, '#ff4f7e', {
          life: 0.58,
          startRadius: 0.15,
          endRadius: 1.45,
          thickness: 0.18,
          z: 0.12,
        });
        setDamageFlash(1);

        if (weaveState.lives <= 0) {
          weaveState.gameOver = true;
          if (weaveState.score > weaveState.highScore) {
            weaveState.highScore = weaveState.score;
          }
        }
      }
    }

    if (
      gameTime.current - lastOrbSpawn.current >
      ORB_SPAWN_INTERVAL / (1 + snap.level * 0.1)
    ) {
      lastOrbSpawn.current = gameTime.current;

      let safeAngle = Math.random() * Math.PI * 2;
      let attempts = 0;
      while (attempts < 10) {
        let isSafe = true;
        for (const arm of arms) {
          const armAngle =
            ((arm.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          let diff = Math.abs(safeAngle - armAngle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < 0.5) {
            isSafe = false;
            break;
          }
        }
        if (isSafe) break;
        safeAngle = Math.random() * Math.PI * 2;
        attempts++;
      }

      const isBonus = Math.random() < 0.15;
      const newOrb: Orb = {
        id: `orb-${Date.now()}`,
        angle: safeAngle,
        radius: PLAYER_ORBIT_RADIUS + (Math.random() - 0.5) * 0.8,
        spawnTime: gameTime.current,
        isBonus,
        collected: false,
      };
      setOrbs((prev) => [...prev, newOrb]);
    }

    const px = Math.cos(playerAngle) * PLAYER_ORBIT_RADIUS;
    const py = Math.sin(playerAngle) * PLAYER_ORBIT_RADIUS;

    setOrbs((prev) => {
      const updated: Orb[] = [];
      for (const orb of prev) {
        if (orb.collected) continue;

        const age = gameTime.current - orb.spawnTime;
        if (age > ORB_LIFETIME) continue;

        const ox = Math.cos(orb.angle) * orb.radius;
        const oy = Math.sin(orb.angle) * orb.radius;
        const dist = Math.sqrt((px - ox) ** 2 + (py - oy) ** 2);

        if (dist < ORB_COLLECT_RADIUS) {
          const points = orb.isBonus ? 50 : 10;
          const comboBonus = Math.floor(weaveState.combo / 3) * 5;
          weaveState.score += points + comboBonus;
          weaveState.combo += 1;
          weaveState.orbs += 1;
          weaveState.orbsCollected += 1;
          levelOrbCount.current += 1;

          if (weaveState.combo > weaveState.bestCombo) {
            weaveState.bestCombo = weaveState.combo;
          }

          spawnParticles(ox, oy, orb.isBonus ? BONUS_ORB_COLOR : ORB_COLOR, orb.isBonus ? 18 : 12, {
            speedMin: orb.isBonus ? 1.9 : 1.2,
            speedMax: orb.isBonus ? 3.2 : 2.2,
            lifeMin: 0.42,
            lifeMax: orb.isBonus ? 0.95 : 0.75,
            sizeMin: 0.04,
            sizeMax: orb.isBonus ? 0.1 : 0.08,
            glowMin: orb.isBonus ? 1.35 : 1.1,
            glowMax: orb.isBonus ? 2.15 : 1.55,
            dragMin: 0.8,
            dragMax: 0.92,
            zMin: -0.03,
            zMax: 0.22,
            vzMin: -0.4,
            vzMax: 1.2,
          });
          cameraShake.current = Math.min(
            1,
            cameraShake.current + (orb.isBonus ? 0.22 : 0.09)
          );
          spawnImpactWave(ox, oy, orb.isBonus ? BONUS_ORB_COLOR : ORB_COLOR, {
            life: orb.isBonus ? 0.5 : 0.34,
            startRadius: 0.08,
            endRadius: orb.isBonus ? 1.2 : 0.78,
            thickness: orb.isBonus ? 0.14 : 0.1,
            z: 0.06,
          });
          setCorePulse(1);
          setTimeout(() => setCorePulse(0), 150);

          if (levelOrbCount.current >= LEVEL_UP_ORBS) {
            levelOrbCount.current = 0;
            weaveState.level += 1;
            weaveState.score += weaveState.level * 25;
            const baseAngle = arms[0]?.angle ?? 0;
            setArms(generateArms(weaveState.level, laserCount, baseAngle));

            if (
              weaveState.level % 3 === 0 &&
              weaveState.lives < weaveState.maxLives
            ) {
              weaveState.lives += 1;
            }
          }

          continue;
        }

        updated.push(orb);
      }
      return updated;
    });

    setParticles((prev) =>
      prev
        .map((p) => ({
          ...p,
          x: p.x + p.vx * delta,
          y: p.y + p.vy * delta,
          z: p.z + p.vz * delta,
          vx: p.vx * Math.pow(p.drag, delta * 60),
          vy: p.vy * Math.pow(p.drag, delta * 60),
          vz: p.vz * Math.pow(p.drag, delta * 60),
          life: p.life - delta * (1.5 + p.size * 1.2),
        }))
        .filter((p) => p.life > 0)
    );

    setImpactWaves((prev) =>
      prev
        .map((wave) => ({
          ...wave,
          life: wave.life - delta,
        }))
        .filter((wave) => wave.life > 0)
    );

    if (damageFlash > 0) {
      setDamageFlash((prev) => Math.max(0, prev - delta * 2.8));
    }

    cameraShake.current = Math.max(0, cameraShake.current - delta * 1.9);
    const shake = cameraShake.current * cameraShake.current;
    const camT = gameTime.current;
    const breathing = Math.sin(camT * 0.7) * 0.05;
    camera.position.x = Math.sin(camT * 28.1 + 1.2) * shake * 0.18;
    camera.position.y = Math.cos(camT * 24.7 + 2.4) * shake * 0.18;
    camera.position.z = 10 + breathing + shake * 0.22;
    camera.lookAt(0, 0, 0);
  });

  const levelProgress = (levelOrbCount.current / LEVEL_UP_ORBS) * 100;
  const playerX = Math.cos(playerAngle) * PLAYER_ORBIT_RADIUS;
  const playerY = Math.sin(playerAngle) * PLAYER_ORBIT_RADIUS;

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 0, 8]} intensity={0.4} />

      <BackgroundGrid />
      <DangerZone />
      <OrbitRing radius={PLAYER_ORBIT_RADIUS} color={currentColor} />
      <LivesDisplay lives={snap.lives} maxLives={snap.maxLives} />
      <CentralCore level={snap.level} pulse={corePulse} />

      {arms.map((arm) => (
        <LaserArm key={arm.id} arm={arm} />
      ))}

      {orbs.map((orb) => (
        <OrbEntity
          key={orb.id}
          orb={orb}
          currentTime={gameTime.current}
          playerX={playerX}
          playerY={playerY}
        />
      ))}

      <ParticleEffect particles={particles} />

      {impactWaves.map((wave) => {
        const progress = 1 - wave.life / wave.maxLife;
        const radius = THREE.MathUtils.lerp(
          wave.startRadius,
          wave.endRadius,
          progress
        );
        return (
          <mesh key={wave.id} position={[wave.x, wave.y, wave.z]}>
            <ringGeometry args={[radius, radius + wave.thickness, 56]} />
            <meshBasicMaterial
              color={wave.color}
              transparent
              opacity={wave.life / wave.maxLife * 0.42}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
        );
      })}

      <Player
        angle={playerAngle}
        color={currentColor}
        isHit={isHit}
        invincible={snap.invincible}
      />

      {damageFlash > 0 && (
        <mesh position={[0, 0, 1.2]}>
          <planeGeometry args={[16, 16]} />
          <meshBasicMaterial
            color="#ff3b6f"
            transparent
            opacity={damageFlash * 0.16}
          />
        </mesh>
      )}

      <WeaveHUD
        score={snap.score}
        orbsCollected={snap.orbsCollected}
        level={snap.level}
        laserCount={laserCount}
        levelOrbCount={levelOrbCount.current}
        levelUpOrbs={LEVEL_UP_ORBS}
        levelProgress={levelProgress}
        controlScheme={snap.controlScheme}
        onControlSchemeChange={(scheme) => weaveState.setControlScheme(scheme)}
        currentColor={currentColor}
        highScore={snap.highScore}
        bestCombo={snap.bestCombo}
        lives={snap.lives}
        maxLives={snap.maxLives}
        gameStarted={gameStarted}
        gameOver={snap.gameOver}
        combo={snap.combo}
        laserBurstLabel={laserBurstLabel}
      />
    </>
  );
};

export default Weave;
