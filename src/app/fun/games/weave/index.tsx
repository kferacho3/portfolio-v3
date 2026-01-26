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

const Weave: React.FC<{ soundsOn?: boolean }> = ({
  soundsOn: _soundsOn = true,
}) => {
  const snap = useSnapshot(weaveState);
  const { camera, scene } = useThree();

  const [playerAngle, setPlayerAngle] = useState(Math.PI / 2);
  const [arms, setArms] = useState<LaserArmType[]>([]);
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isHit, setIsHit] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [corePulse, setCorePulse] = useState(0);
  const [laserCount, setLaserCount] = useState(1);
  const [laserBurstLabel, setLaserBurstLabel] = useState<string | null>(null);

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
    (x: number, y: number, color: string, count: number) => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        newParticles.push({
          id: `p-${Date.now()}-${i}`,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color,
          size: 0.05 + Math.random() * 0.08,
        });
      }
      setParticles((prev) => [...prev, ...newParticles]);
    },
    []
  );

  const resetRun = useCallback(() => {
    weaveState.reset();
    setPlayerAngle(Math.PI / 2);
    setOrbs([]);
    setParticles([]);
    setLaserCount(1);
    rotationDirectionRef.current = Math.random() > 0.5 ? 1 : -1;
    setArms(generateArms(1, 1, 0));
    setGameStarted(true);
    levelOrbCount.current = 0;
    gameTime.current = 0;
    lastOrbSpawn.current = 0;
    burstEndsAt.current = null;
    nextBurstAt.current = 12;
    milestone3Done.current = false;
    milestone4Done.current = false;
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
        spawnParticles(px, py, '#ff3366', 15);

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

          spawnParticles(ox, oy, orb.isBonus ? BONUS_ORB_COLOR : ORB_COLOR, 8);
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
          life: p.life - delta * 2,
        }))
        .filter((p) => p.life > 0)
    );
  });

  const levelProgress = (levelOrbCount.current / LEVEL_UP_ORBS) * 100;

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
        <OrbEntity key={orb.id} orb={orb} currentTime={gameTime.current} />
      ))}

      <ParticleEffect particles={particles} />

      <Player
        angle={playerAngle}
        color={currentColor}
        isHit={isHit}
        invincible={snap.invincible}
      />

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
