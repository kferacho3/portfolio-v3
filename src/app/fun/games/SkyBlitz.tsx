// src/components/games/SkyBlitz.tsx
'use client';

import { Html, Sky, Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Alien } from './models/Alien';
import UfoShip from './models/UFOGames';
import { proxy, useSnapshot } from 'valtio';

export interface SkyBlitzState {
  score: number;
  health: number;
  mode: 'UfoMode' | 'RunnerManMode';
  skin: string;
  setMode: (mode: 'UfoMode' | 'RunnerManMode') => void;
  setSkin: (skin: string) => void;
  reset: () => void;
}

// Shared game state for SkyBlitz
const skyBlitzState = proxy<SkyBlitzState>({
  score: 0,
  health: 100,
  mode: 'UfoMode',
  skin: 'red',
  setMode: (mode) => {
    skyBlitzState.mode = mode;
  },
  setSkin: (skin) => {
    skyBlitzState.skin = skin;
  },
  reset: () => {
    skyBlitzState.score = 0;
    skyBlitzState.health = 100;
    skyBlitzState.mode = 'UfoMode';
    skyBlitzState.skin = 'red';
  },
});

export { skyBlitzState };

const NUM_OBSTACLES = 40;
const OBSTACLE_SPREAD_Z = 180;
const PLAYER_SPEED = 18;
const HIT_RADIUS = 1.7;
const PROJECTILE_SPEED = 38;

const generateRandomPosition = (zOffset: number): [number, number, number] => [
  Math.random() * 12 - 6,
  Math.random() * 3 + 0.5,
  zOffset,
];

const Ground: React.FC = () => {
  return (
    <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
  );
};

interface ObstacleData {
  id: string;
  position: [number, number, number];
}

interface ProjectileData {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
}

interface UfoModeProps {
  score: number;
  health: number;
  onScore: (points: number) => void;
  onDamage: (points: number) => void;
}

const UfoMode: React.FC<UfoModeProps> = ({ score, health, onScore, onDamage }) => {
  const playerRef = useRef<THREE.Group>(null!);
  const [projectiles, setProjectiles] = useState<ProjectileData[]>([]);
  const [obstacles, setObstacles] = useState<ObstacleData[]>([]);
  const projectilesRef = useRef(projectiles);
  const obstaclesRef = useRef(obstacles);
  const lastDamageRef = useRef(0);

  useEffect(() => {
    projectilesRef.current = projectiles;
  }, [projectiles]);

  useEffect(() => {
    obstaclesRef.current = obstacles;
  }, [obstacles]);

  useEffect(() => {
    const initialObstacles = Array.from({ length: NUM_OBSTACLES }, (_, index) => ({
      id: `ob-${index}`,
      position: generateRandomPosition(-index * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES)),
    }));
    setObstacles(initialObstacles);
  }, []);

  const shootProjectile = useCallback(() => {
    const playerDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(playerRef.current.quaternion);
    const velocity = playerDirection.multiplyScalar(PROJECTILE_SPEED);
    const projectilePosition: [number, number, number] = [
      playerRef.current.position.x,
      playerRef.current.position.y,
      playerRef.current.position.z,
    ];

    setProjectiles((prev) => [
      ...prev.slice(-10),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        position: projectilePosition,
        velocity: [velocity.x, velocity.y, velocity.z],
      },
    ]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        shootProjectile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shootProjectile]);

  useFrame((state, delta) => {
    const xPosition = state.pointer.x * 6;
    const yPosition = Math.max(state.pointer.y * 3, 0.2);
    const zPosition = playerRef.current.position.z - delta * PLAYER_SPEED;
    playerRef.current.position.lerp(new THREE.Vector3(xPosition, yPosition, zPosition), 0.1);

    const direction = new THREE.Vector3(state.pointer.x / 4, Math.max(state.pointer.y, -0.1), 0.6).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    playerRef.current.quaternion.slerp(rotation, 0.1);

    // Camera follows player with offset and slight Y adjustment for better view
    const cameraOffset = new THREE.Vector3(0, 3, 12);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    cameraPosition.y -= 2; // Lower the camera slightly for better perspective
    state.camera.position.lerp(cameraPosition, 0.2);
    state.camera.lookAt(playerRef.current.position);

    if (health <= 0) return;

    const nextProjectiles = projectilesRef.current
      .map((projectile) => ({
        ...projectile,
        position: [
          projectile.position[0] + projectile.velocity[0] * delta,
          projectile.position[1] + projectile.velocity[1] * delta,
          projectile.position[2] + projectile.velocity[2] * delta,
        ] as [number, number, number],
      }))
      .filter((projectile) => projectile.position[2] > playerRef.current.position.z - 200);

    const hitObstacleIds = new Set<string>();
    const hitProjectileIds = new Set<string>();

    nextProjectiles.forEach((projectile) => {
      obstaclesRef.current.forEach((obstacle) => {
        const dx = projectile.position[0] - obstacle.position[0];
        const dy = projectile.position[1] - obstacle.position[1];
        const dz = projectile.position[2] - obstacle.position[2];
        if (dx * dx + dy * dy + dz * dz < HIT_RADIUS * HIT_RADIUS) {
          hitObstacleIds.add(obstacle.id);
          hitProjectileIds.add(projectile.id);
        }
      });
    });

    if (hitObstacleIds.size > 0) {
      onScore(hitObstacleIds.size * 50);
      setObstacles((prev) =>
        prev.map((obstacle) =>
          hitObstacleIds.has(obstacle.id)
            ? { ...obstacle, position: generateRandomPosition(playerRef.current.position.z - 80) }
            : obstacle
        )
      );
    }

    const playerHit = obstaclesRef.current.find((obstacle) => {
      const dx = playerRef.current.position.x - obstacle.position[0];
      const dy = playerRef.current.position.y - obstacle.position[1];
      const dz = playerRef.current.position.z - obstacle.position[2];
      return dx * dx + dy * dy + dz * dz < HIT_RADIUS * HIT_RADIUS;
    });

    if (playerHit) {
      const now = performance.now();
      if (now - lastDamageRef.current > 600) {
        lastDamageRef.current = now;
        onDamage(10);
        setObstacles((prev) =>
          prev.map((obstacle) =>
            obstacle.id === playerHit.id
              ? { ...obstacle, position: generateRandomPosition(playerRef.current.position.z - 90) }
              : obstacle
          )
        );
      }
    }

    setProjectiles(
      nextProjectiles.filter((projectile) => !hitProjectileIds.has(projectile.id))
    );

    setObstacles((prev) => {
      let changed = false;
      const next = prev.map((obstacle) => {
        if (playerRef.current.position.z - obstacle.position[2] > 40) {
          changed = true;
          return { ...obstacle, position: generateRandomPosition(playerRef.current.position.z - OBSTACLE_SPREAD_Z) };
        }
        return obstacle;
      });
      return changed ? next : prev;
    });
  });

  return (
    <>
      <Sky distance={450000} turbidity={10} rayleigh={3} mieCoefficient={0.005} mieDirectionalG={0.8} inclination={0.49} azimuth={0.25} />
      <Stars radius={300} depth={500} count={4000} factor={2} saturation={0} fade />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Ground />
      <UfoShip playerRef={playerRef} bodyRef={playerRef} />
      {obstacles.map((obstacle) => (
        <group key={obstacle.id} position={obstacle.position}>
          <Alien color={skyBlitzState.skin} />
        </group>
      ))}
      {projectiles.map((projectile) => (
        <mesh key={projectile.id} position={projectile.position}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#fde68a" />
        </mesh>
      ))}
      <Html>
        <div className="absolute bottom-2.5 right-2.5 text-2xl text-white">Score: {Math.floor(score)}</div>
      </Html>
    </>
  );
};

interface RunnerModeProps {
  score: number;
  health: number;
  onScore: (points: number) => void;
  onDamage: (points: number) => void;
}

const RunnerManMode: React.FC<RunnerModeProps> = ({ score, health, onScore, onDamage }) => {
  const playerRef = useRef<THREE.Group>(null!);
  const velocityRef = useRef(0);
  const isJumpingRef = useRef(false);
  const scoreTimerRef = useRef(0);
  const lastDamageRef = useRef(0);
  const [obstacles, setObstacles] = useState<ObstacleData[]>([]);

  useEffect(() => {
    const initialObstacles = Array.from({ length: 30 }, (_, index) => ({
      id: `runner-ob-${index}`,
      position: [Math.random() * 8 - 4, 0, -index * 8],
    }));
    setObstacles(initialObstacles);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isJumpingRef.current) {
        velocityRef.current = 7;
        isJumpingRef.current = true;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useFrame((state, delta) => {
    if (!playerRef.current) return;
    const x = state.pointer.x * 5;
    const z = playerRef.current.position.z - delta * 10;

    playerRef.current.position.x = x;
    playerRef.current.position.z = z;
    playerRef.current.position.y += velocityRef.current * delta;

    if (playerRef.current.position.y <= 0) {
      playerRef.current.position.y = 0;
      velocityRef.current = 0;
      isJumpingRef.current = false;
    } else {
      velocityRef.current -= 18 * delta;
    }

    // Camera follows player with offset for runner mode
    const cameraOffset = new THREE.Vector3(0, 2.5, 10);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    cameraPosition.y -= 1; // Slight Y adjustment for better perspective
    state.camera.position.lerp(cameraPosition, 0.1);
    state.camera.lookAt(playerRef.current.position);

    if (health <= 0) return;

    setObstacles((prev) => {
      let changed = false;
      const next = prev.map((obstacle) => {
        if (playerRef.current.position.z - obstacle.position[2] > 20) {
          changed = true;
          return { ...obstacle, position: [Math.random() * 8 - 4, 0, playerRef.current.position.z - 200] };
        }
        return obstacle;
      });
      return changed ? next : prev;
    });

    const collision = obstacles.find((obstacle) => {
      const dx = playerRef.current.position.x - obstacle.position[0];
      const dz = playerRef.current.position.z - obstacle.position[2];
      return Math.abs(dx) < 1.2 && Math.abs(dz) < 1.5 && playerRef.current.position.y < 1.2;
    });

    if (collision) {
      const now = performance.now();
      if (now - lastDamageRef.current > 600) {
        lastDamageRef.current = now;
        onDamage(15);
        setObstacles((prev) =>
          prev.map((obstacle) =>
            obstacle.id === collision.id
              ? { ...obstacle, position: [Math.random() * 8 - 4, 0, playerRef.current.position.z - 120] }
              : obstacle
          )
        );
      }
    }

    scoreTimerRef.current += delta;
    if (scoreTimerRef.current >= 0.25) {
      onScore(scoreTimerRef.current * 2);
      scoreTimerRef.current = 0;
    }
  });

  return (
    <>
      <Sky distance={450000} turbidity={10} rayleigh={3} mieCoefficient={0.005} mieDirectionalG={0.8} inclination={0.49} azimuth={0.25} />
      <Stars radius={400} depth={60} count={3000} factor={2} saturation={0} fade />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Ground />
      <group ref={playerRef} position={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[1, 2, 1]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
      </group>
      {obstacles.map((obstacle) => (
        <mesh key={obstacle.id} position={obstacle.position}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      ))}
      <Html>
        <div className="absolute bottom-2.5 right-2.5 text-2xl text-white">Score: {Math.floor(score)}</div>
      </Html>
    </>
  );
};

const SkyBlitz: React.FC<{ soundsOn?: boolean }> = ({ soundsOn: _soundsOn = true }) => {
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const skyBlitzSnap = useSnapshot(skyBlitzState);
  const [resetSeed, setResetSeed] = useState(0);

  useEffect(() => {
    skyBlitzState.score = score;
    skyBlitzState.health = health;
  }, [score, health]);

  useEffect(() => {
    if (skyBlitzSnap.score === 0 && skyBlitzSnap.health === 100 && (score !== 0 || health !== 100)) {
      setScore(0);
      setHealth(100);
    }
  }, [skyBlitzSnap.score, skyBlitzSnap.health, score, health]);

  useEffect(() => {
    if (skyBlitzSnap.score === 0 && skyBlitzSnap.health === 100) {
      setResetSeed((prev) => prev + 1);
    }
  }, [skyBlitzSnap.score, skyBlitzSnap.health]);

  const handleScore = useCallback((points: number) => {
    setScore((prev) => prev + points);
  }, []);

  const handleDamage = useCallback((points: number) => {
    setHealth((prev) => Math.max(0, prev - points));
  }, []);

  useEffect(() => {
    if (health <= 0) {
      skyBlitzState.health = 0;
    }
  }, [health]);

  return skyBlitzSnap.mode === 'RunnerManMode' ? (
    <RunnerManMode key={`runner-${resetSeed}`} score={score} health={health} onScore={handleScore} onDamage={handleDamage} />
  ) : (
    <UfoMode key={`ufo-${resetSeed}`} score={score} health={health} onScore={handleScore} onDamage={handleDamage} />
  );
};

export default SkyBlitz;
