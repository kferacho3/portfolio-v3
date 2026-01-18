// src/components/games/SkyBlitz.tsx
'use client';

import { Html, Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
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

// Constants matching original SkyBlitz.js
const NUM_OBSTACLES = 100;
const OBSTACLE_SPREAD_Z = 200;
const PLAYER_SPEED = 25; // delta * 25 from original
const HIT_RADIUS = 1.5;
const PROJECTILE_SPEED = 50;
const REPOSITION_THRESHOLD = 40;

const generateRandomPosition = (zOffset: number): [number, number, number] => [
  Math.random() * 12 - 6, // X between -6 and 6
  0, // Y at ground level for obstacles
  zOffset,
];

// Ground component matching original
const Ground: React.FC = () => {
  return (
    <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#1a1a2e" />
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
  const bodyRef = useRef<THREE.Group>(null!);
  const [projectiles, setProjectiles] = useState<ProjectileData[]>([]);
  const [obstacles, setObstacles] = useState<ObstacleData[]>([]);
  const projectilesRef = useRef(projectiles);
  const obstaclesRef = useRef(obstacles);
  const lastDamageRef = useRef(0);
  const targetPosition = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Quaternion());

  useEffect(() => {
    projectilesRef.current = projectiles;
  }, [projectiles]);

  useEffect(() => {
    obstaclesRef.current = obstacles;
  }, [obstacles]);

  // Initialize obstacles
  useEffect(() => {
    const initialObstacles = Array.from({ length: NUM_OBSTACLES }, (_, index) => ({
      id: `ob-${index}`,
      position: generateRandomPosition(-index * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES)),
    }));
    setObstacles(initialObstacles);
  }, []);

  const shootProjectile = useCallback(() => {
    if (!playerRef.current) return;
    
    const playerDirection = new THREE.Vector3();
    playerRef.current.getWorldDirection(playerDirection);
    const velocity = playerDirection.multiplyScalar(-PROJECTILE_SPEED);
    
    const projectilePosition: [number, number, number] = [
      playerRef.current.position.x,
      playerRef.current.position.y,
      playerRef.current.position.z,
    ];

    setProjectiles((prev) => [
      ...prev.slice(-15),
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
    if (!playerRef.current) return;

    // Player movement matching original SkyBlitz.js exactly
    const xPosition = state.pointer.x * 6;
    const yPosition = Math.max(state.pointer.y * 3, 0);
    const zPosition = playerRef.current.position.z - delta * PLAYER_SPEED;
    
    targetPosition.current.set(xPosition, yPosition, zPosition);
    playerRef.current.position.lerp(targetPosition.current, 0.1);

    // Rotation towards cursor matching original
    const direction = new THREE.Vector3(
      state.pointer.x / 5,
      Math.max(state.pointer.y, -0.1),
      0.5
    ).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    targetRotation.current.slerp(rotation, 0.1);
    playerRef.current.quaternion.slerp(targetRotation.current, 0.1);

    // Camera follows player with offset - matching original exactly
    const cameraOffset = new THREE.Vector3(0, 3, 12);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    cameraPosition.y -= 2;
    state.camera.position.lerp(cameraPosition, 0.2);
    state.camera.lookAt(playerRef.current.position);

    // Score based on distance traveled
    onScore(delta);

    if (health <= 0) return;

    // Update projectiles
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

    // Check projectile-obstacle collisions
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
            ? { ...obstacle, position: generateRandomPosition(playerRef.current.position.z - OBSTACLE_SPREAD_Z) }
            : obstacle
        )
      );
    }

    // Check player-obstacle collision
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
              ? { ...obstacle, position: generateRandomPosition(playerRef.current.position.z - OBSTACLE_SPREAD_Z - 50) }
              : obstacle
          )
        );
      }
    }

    setProjectiles(nextProjectiles.filter((projectile) => !hitProjectileIds.has(projectile.id)));

    // Reposition obstacles that are behind the player
    setObstacles((prev) => {
      let changed = false;
      const next = prev.map((obstacle) => {
        if (playerRef.current.position.z - obstacle.position[2] > REPOSITION_THRESHOLD) {
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
      
      <Ground />
      
      {/* UFO Ship - pass both refs as in original */}
      <UfoShip playerRef={playerRef} bodyRef={bodyRef} />
      
      {/* Obstacles - Aliens */}
      {obstacles.map((obstacle) => (
        <group key={obstacle.id} position={obstacle.position}>
          <Alien color={skyBlitzState.skin} />
        </group>
      ))}
      
      {/* Projectiles */}
      {projectiles.map((projectile) => (
        <mesh key={projectile.id} position={projectile.position}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={0.5} />
        </mesh>
      ))}
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
    const initialObstacles = Array.from({ length: 50 }, (_, index) => ({
      id: `runner-ob-${index}`,
      position: [Math.random() * 8 - 4, 0, -index * 8] as [number, number, number],
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

    // Camera follow
    const cameraOffset = new THREE.Vector3(0, 2.5, 10);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    cameraPosition.y -= 1;
    state.camera.position.lerp(cameraPosition, 0.1);
    state.camera.lookAt(playerRef.current.position);

    if (health <= 0) return;

    // Reposition obstacles
    setObstacles((prev) => {
      let changed = false;
      const next = prev.map((obstacle) => {
        if (playerRef.current.position.z - obstacle.position[2] > 20) {
          changed = true;
          return { 
            ...obstacle, 
            position: [Math.random() * 8 - 4, 0, playerRef.current.position.z - 400] as [number, number, number]
          };
        }
        return obstacle;
      });
      return changed ? next : prev;
    });

    // Collision detection
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
              ? { ...obstacle, position: [Math.random() * 8 - 4, 0, playerRef.current.position.z - 200] as [number, number, number] }
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
      <Sky
        distance={450000}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        inclination={0.49}
        azimuth={0.25}
      />
      <Stars radius={400} depth={60} count={3000} factor={2} saturation={0} fade />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      <Ground />
      
      {/* Runner character */}
      <group ref={playerRef} position={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.8, 1.8, 0.6]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#fcd34d" />
        </mesh>
      </group>
      
      {/* Obstacles */}
      {obstacles.map((obstacle) => (
        <mesh key={obstacle.id} position={obstacle.position}>
          <boxGeometry args={[1, 1.5, 1]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      ))}
    </>
  );
};

// HUD Component
const GameHUD: React.FC<{ score: number; health: number; mode: string }> = ({ score, health, mode }) => {
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      {/* Score display - bottom right like original */}
      <div 
        className="absolute bottom-4 right-4 text-white text-3xl font-bold"
        style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
      >
        Score: {Math.floor(score)}
      </div>
      
      {/* Health bar */}
      <div className="absolute top-4 right-4 w-48">
        <div className="text-white text-sm mb-1">Health</div>
        <div className="w-full bg-gray-700/50 h-3 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-200"
            style={{ width: `${health}%` }}
          />
        </div>
      </div>
      
      {/* Mode indicator */}
      <div className="absolute top-4 left-4">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm">
          {mode === 'UfoMode' ? '🛸 UFO Mode' : '🏃 Runner Mode'}
        </div>
      </div>
      
      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 text-white/60 text-xs">
        {mode === 'UfoMode' ? 'Mouse to move • Space to shoot' : 'Mouse to move • Space to jump'}
      </div>
      
      {/* Game over overlay */}
      {health <= 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-red-500 mb-4">GAME OVER</h1>
            <p className="text-3xl text-white mb-6">Score: {Math.floor(score)}</p>
            <p className="text-white/60 text-sm">Press R to restart</p>
          </div>
        </div>
      )}
    </Html>
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
      setResetSeed((prev) => prev + 1);
    }
  }, [skyBlitzSnap.score, skyBlitzSnap.health, score, health]);

  // Keyboard restart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && health <= 0) {
        skyBlitzState.reset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [health]);

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

  return (
    <>
      {skyBlitzSnap.mode === 'RunnerManMode' ? (
        <RunnerManMode 
          key={`runner-${resetSeed}`} 
          score={score} 
          health={health} 
          onScore={handleScore} 
          onDamage={handleDamage} 
        />
      ) : (
        <UfoMode 
          key={`ufo-${resetSeed}`} 
          score={score} 
          health={health} 
          onScore={handleScore} 
          onDamage={handleDamage} 
        />
      )}
      <GameHUD score={score} health={health} mode={skyBlitzSnap.mode} />
    </>
  );
};

export default SkyBlitz;
