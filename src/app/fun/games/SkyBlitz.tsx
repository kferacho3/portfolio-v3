// src/components/games/SkyBlitz.tsx
// Matching original SkyBlitz.js as closely as possible
'use client';

import { Html, Sky, Stars } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import { Alien } from './models/Alien';
import UfoShip from './models/UFOGames';

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════════════

export interface SkyBlitzState {
  score: number;
  health: number;
  wave: number;
  mode: 'UfoMode' | 'RunnerManMode';
  skin: string;
  phase: 'playing' | 'gameover';
  setMode: (mode: 'UfoMode' | 'RunnerManMode') => void;
  setSkin: (skin: string) => void;
  reset: () => void;
}

const skyBlitzState = proxy<SkyBlitzState>({
  score: 0,
  health: 100,
  wave: 1,
  mode: 'UfoMode',
  skin: 'red',
  phase: 'playing',
  setMode: (mode) => {
    skyBlitzState.mode = mode;
  },
  setSkin: (skin) => {
    skyBlitzState.skin = skin;
  },
  reset: () => {
    skyBlitzState.score = 0;
    skyBlitzState.health = 100;
    skyBlitzState.wave = 1;
    skyBlitzState.phase = 'playing';
  },
});

export { skyBlitzState };

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - Matching original SkyBlitz.js exactly
// ═══════════════════════════════════════════════════════════════════════════

const NUM_OBSTACLES = 100;
const OBSTACLE_SPREAD_Z = 200;
const REPOSITION_THRESHOLD = 200;
const PLAYER_SPEED = 25;
const PROJECTILE_SPEED = 140;
const PROJECTILE_RADIUS = 0.18;
const PROJECTILE_SPAWN_OFFSET = 1.8;
const PROJECTILE_TTL = 4000;
const MAX_PROJECTILES = 50;
const ALIEN_COLLISION_RADIUS = 1.2;
const PLAYER_COLLISION_RADIUS = 1.5;
const WAVE_KILL_TARGET = 15;
const DEATH_ANIM_DURATION = 250;
const OBSTACLE_RESPAWN_BUFFER = 60;

// Generate random position for obstacle
const generateRandomPosition = (zOffset: number): [number, number, number] => [
  Math.random() * 12 - 6,
  0,
  zOffset,
];

// ═══════════════════════════════════════════════════════════════════════════
// GROUND COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const UfoGround: React.FC<{ playerZ: number }> = ({ playerZ }) => {
  const texture = useLoader(THREE.TextureLoader, 'https://cdn.pixabay.com/photo/2020/05/22/12/26/web-5205244_1280.jpg');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100);

  return (
    <mesh position={[0, -1, playerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DATA INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface AlienData {
  id: number;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  alive: boolean;
  scale: number;
  deathStart: number;
  respawnAt: number;
}

interface ProjectileData {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  active: boolean;
  spawnedAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALIEN OBSTACLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const AlienObstacle: React.FC<{
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  color: string;
  scale: number;
}> = ({ position, health, maxHealth, color, scale }) => {
  const healthPercent = maxHealth > 0 ? health / maxHealth : 0;
  const displayColor = healthPercent < 0.5 ? 'orange' : color;
  
  return (
    <group position={position} scale={scale}>
      <Alien color={displayColor} />
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTILE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ProjectileMesh: React.FC<{
  position: THREE.Vector3;
}> = ({ position }) => {
  return (
    <mesh position={position}>
      <sphereGeometry args={[PROJECTILE_RADIUS, 12, 12]} />
      <meshStandardMaterial 
        color="yellow" 
        emissive="orange" 
        emissiveIntensity={2}
        toneMapped={false}
      />
    </mesh>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// UFO PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const UfoPlayer: React.FC<{
  playerRef: React.MutableRefObject<THREE.Group | null>;
}> = ({ playerRef }) => {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    if (!playerRef.current || skyBlitzState.phase !== 'playing') return;

    const xPosition = state.mouse.x * 6;
    const yPosition = Math.max(state.mouse.y * 3, 0);
    const zPosition = playerRef.current.position.z - delta * PLAYER_SPEED;

    targetPosition.current.set(xPosition, yPosition, zPosition);
    playerRef.current.position.lerp(targetPosition.current, 0.1);

    const direction = new THREE.Vector3(
      state.mouse.x / 5,
      Math.max(state.mouse.y, -0.1),
      0.5
    ).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    targetRotation.current.slerp(rotation, 0.1);
    playerRef.current.quaternion.slerp(targetRotation.current, 0.1);

    const cameraOffset = new THREE.Vector3(0, 3, 12);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    cameraPosition.y -= 2;
    camera.position.lerp(cameraPosition, 0.2);
    camera.lookAt(playerRef.current.position);
  });

  return <UfoShip playerRef={playerRef} />;
};

// ═══════════════════════════════════════════════════════════════════════════
// UFO MODE MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const UfoMode: React.FC = () => {
  const snap = useSnapshot(skyBlitzState);
  const playerRef = useRef<THREE.Group>(null!);
  const lastDamageTime = useRef(0);
  const scoreAccumulator = useRef(0);
  const killsThisWave = useRef(0);
  const nextProjectileId = useRef(0);
  
  // Use refs for game data to avoid re-renders during game loop
  const aliensRef = useRef<AlienData[]>([]);
  const projectilesRef = useRef<ProjectileData[]>([]);
  
  // Force re-render counter for visual updates
  const [, setRenderKey] = useState(0);
  const lastRenderTime = useRef(0);
  
  // Initialize aliens
  useEffect(() => {
    const initialAliens: AlienData[] = [];
    for (let i = 0; i < NUM_OBSTACLES; i++) {
      const pos = generateRandomPosition(-20 - i * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES));
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
    projectilesRef.current = [];
    scoreAccumulator.current = 0;
    killsThisWave.current = 0;
    skyBlitzState.phase = 'playing';
    skyBlitzState.health = 100;
    skyBlitzState.score = 0;
    skyBlitzState.wave = 1;
    setRenderKey(k => k + 1);
  }, []);

  // Shoot projectile
  const shootProjectile = useCallback(() => {
    if (!playerRef.current || skyBlitzState.phase !== 'playing') return;
    
    const playerDirection = new THREE.Vector3();
    playerRef.current.getWorldDirection(playerDirection);
    const velocity = playerDirection.clone().multiplyScalar(-PROJECTILE_SPEED);

    const spawnOffset = playerDirection.clone().multiplyScalar(-PROJECTILE_SPAWN_OFFSET);
    const projectilePosition = playerRef.current.position.clone().add(spawnOffset);

    projectilesRef.current.push({
      id: nextProjectileId.current++,
      position: projectilePosition,
      velocity: velocity,
      active: true,
      spawnedAt: performance.now(),
    });

    if (projectilesRef.current.length > MAX_PROJECTILES) {
      projectilesRef.current.splice(0, projectilesRef.current.length - MAX_PROJECTILES);
    }
  }, []);

  // Main game loop
  useFrame((_, delta) => {
    if (!playerRef.current || skyBlitzState.phase !== 'playing') return;
    
    const playerPos = playerRef.current.position;
    const now = performance.now();
    
    scoreAccumulator.current += delta;
    
    // Update projectiles
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
      const proj = projectilesRef.current[i];
      if (!proj.active) {
        projectilesRef.current.splice(i, 1);
        continue;
      }
      
      proj.position.addScaledVector(proj.velocity, delta);
      
      if (now - proj.spawnedAt > PROJECTILE_TTL) {
        projectilesRef.current.splice(i, 1);
        continue;
      }
      
      // Check collision with aliens
      for (const alien of aliensRef.current) {
        if (!alien.alive) continue;
        
        const dist = alien.position.distanceTo(proj.position);
        if (dist < ALIEN_COLLISION_RADIUS + PROJECTILE_RADIUS) {
          alien.health -= 1;
          proj.active = false;
          scoreAccumulator.current += 10;
          
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
    }
    
    // Update aliens
    for (const alien of aliensRef.current) {
      if (!alien.alive) {
        const deathElapsed = now - alien.deathStart;
        const shrink = 1 - Math.min(deathElapsed / DEATH_ANIM_DURATION, 1);
        alien.scale = Math.max(0, shrink);

        if (now >= alien.respawnAt) {
          const newPos = generateRandomPosition(
            playerPos.z - OBSTACLE_SPREAD_Z - Math.random() * OBSTACLE_RESPAWN_BUFFER
          );
          alien.position.set(...newPos);
          alien.health = skyBlitzState.wave;
          alien.maxHealth = skyBlitzState.wave;
          alien.alive = true;
          alien.scale = 1;
          alien.deathStart = 0;
          alien.respawnAt = 0;
        }
        continue;
      }
      
      // Reposition if behind player
      if (alien.position.z - playerPos.z > REPOSITION_THRESHOLD) {
        const newPos = generateRandomPosition(
          playerPos.z - OBSTACLE_SPREAD_Z - Math.random() * OBSTACLE_RESPAWN_BUFFER
        );
        alien.position.set(...newPos);
        alien.health = skyBlitzState.wave;
        alien.maxHealth = skyBlitzState.wave;
        alien.scale = 1;
        continue;
      }
      
      // Check player collision
      const distToPlayer = alien.position.distanceTo(playerPos);
      if (distToPlayer < PLAYER_COLLISION_RADIUS + ALIEN_COLLISION_RADIUS) {
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

    if (killsThisWave.current >= WAVE_KILL_TARGET) {
      skyBlitzState.wave += 1;
      killsThisWave.current = 0;

      for (let i = 0; i < NUM_OBSTACLES; i++) {
        const pos = generateRandomPosition(playerPos.z - 30 - i * (OBSTACLE_SPREAD_Z / NUM_OBSTACLES));
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

    skyBlitzState.score = Math.floor(scoreAccumulator.current);
    
    // Trigger visual update (throttled to ~30fps for visuals)
    if (now - lastRenderTime.current > 33) {
      lastRenderTime.current = now;
      setRenderKey(k => k + 1);
    }
  });

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        shootProjectile();
      }
      if (event.key.toLowerCase() === 'r' && skyBlitzState.phase === 'gameover') {
        skyBlitzState.reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shootProjectile]);

  // Click to shoot
  useEffect(() => {
    const handleClick = () => shootProjectile();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [shootProjectile]);

  const playerZ = playerRef.current?.position.z ?? 0;

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

      <UfoGround playerZ={playerZ} />
      <UfoPlayer playerRef={playerRef} />
      
      {/* Render aliens - using renderKey to force updates */}
      {aliensRef.current.filter((alien) => alien.scale > 0.01).map((alien) => (
        <AlienObstacle
          key={alien.id}
          position={alien.position}
          health={alien.health}
          maxHealth={alien.maxHealth}
          color={snap.skin}
          scale={alien.scale}
        />
      ))}
      
      {/* Render projectiles */}
      {projectilesRef.current.filter(p => p.active).map((proj) => (
        <ProjectileMesh
          key={proj.id}
          position={proj.position}
        />
      ))}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// RUNNER MODE - Alternative game mode
// ═══════════════════════════════════════════════════════════════════════════

interface ObstacleData {
  id: number;
  position: [number, number, number];
  active: boolean;
}

const Ground: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ camera }) => {
    if (meshRef.current) {
      meshRef.current.position.z = camera.position.z - 50;
    }
  });
  
  return (
    <mesh ref={meshRef} position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  );
};

const RunnerManMode: React.FC = () => {
  const snap = useSnapshot(skyBlitzState);
  const playerRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  
  const velocityRef = useRef(0);
  const isJumpingRef = useRef(false);
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const lastDamageTime = useRef(0);
  const scoreRef = useRef(0);
  const [, forceUpdate] = useState(0);
  
  useEffect(() => {
    const initialObstacles: ObstacleData[] = [];
    for (let i = 0; i < 50; i++) {
      initialObstacles.push({
        id: i,
        position: [Math.random() * 8 - 4, 0, -i * 8 - 20] as [number, number, number],
        active: true,
      });
    }
    obstaclesRef.current = initialObstacles;
    forceUpdate(n => n + 1);
  }, []);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isJumpingRef.current && snap.phase === 'playing') {
        velocityRef.current = 7;
        isJumpingRef.current = true;
      }
      if (event.key.toLowerCase() === 'r' && snap.phase === 'gameover') {
        skyBlitzState.reset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snap.phase]);
  
  useFrame((state, delta) => {
    if (!playerRef.current) return;
    
    const playerPos = playerRef.current.position;
    
    const x = state.pointer.x * 5;
    const z = playerPos.z - delta * 10;
    
    playerPos.x = x;
    playerPos.z = z;
    playerPos.y += velocityRef.current * delta;
    
    if (playerPos.y <= 0) {
      playerPos.y = 0;
      velocityRef.current = 0;
      isJumpingRef.current = false;
    } else {
      velocityRef.current -= 18 * delta;
    }
    
    const cameraOffset = new THREE.Vector3(0, 2.5, 10);
    const cameraPosition = playerPos.clone().add(cameraOffset);
    cameraPosition.y -= 1;
    camera.position.lerp(cameraPosition, 0.1);
    camera.lookAt(playerPos);
    
    if (snap.phase === 'playing') {
      scoreRef.current += delta * 2;
      skyBlitzState.score = Math.floor(scoreRef.current);
    }
    
    if (snap.phase === 'gameover') return;
    
    const now = performance.now();
    for (const obstacle of obstaclesRef.current) {
      if (obstacle.position[2] - playerPos.z > 20) {
        obstacle.position = [Math.random() * 8 - 4, 0, playerPos.z - 400] as [number, number, number];
      }
      
      const dx = playerPos.x - obstacle.position[0];
      const dz = playerPos.z - obstacle.position[2];
      if (Math.abs(dx) < 1.2 && Math.abs(dz) < 1.5 && playerPos.y < 1.2) {
        if (now - lastDamageTime.current > 600) {
          lastDamageTime.current = now;
          skyBlitzState.health = Math.max(0, skyBlitzState.health - 15);
          obstacle.position = [Math.random() * 8 - 4, 0, playerPos.z - 200] as [number, number, number];
          
          if (skyBlitzState.health <= 0) {
            skyBlitzState.phase = 'gameover';
          }
        }
      }
    }
    
    forceUpdate(n => n + 1);
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
      
      <group ref={playerRef} position={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.8, 1.8, 0.6]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#fcd34d" />
        </mesh>
      </group>
      
      {obstaclesRef.current.map((obstacle) => (
        <mesh key={obstacle.id} position={obstacle.position}>
          <boxGeometry args={[1, 1.5, 1]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      ))}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GAME HUD
// ═══════════════════════════════════════════════════════════════════════════

const GameHUD: React.FC = () => {
  const snap = useSnapshot(skyBlitzState);
  
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'fixed', inset: 0, fontFamily: 'system-ui, sans-serif' }}>
        {/* Score - bottom right */}
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          right: '1rem',
          fontSize: '2.25rem',
          fontWeight: 'bold',
          color: 'white',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        }}>
          Score: {snap.score}
        </div>
        
        {/* Wave indicator */}
        {snap.mode === 'UfoMode' && (
          <div style={{
            position: 'absolute',
            bottom: '4rem',
            right: '1rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#22d3ee',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}>
            Wave: {snap.wave}
          </div>
        )}
        
        {/* Health bar */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          width: '12rem',
        }}>
          <div style={{ color: 'white', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Health</div>
          <div style={{
            width: '100%',
            background: 'rgba(55, 65, 81, 0.5)',
            height: '0.75rem',
            borderRadius: '9999px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              background: snap.health > 30 ? 'linear-gradient(to right, #22c55e, #4ade80)' : '#dc2626',
              transition: 'width 0.2s',
              width: `${snap.health}%`,
            }} />
          </div>
        </div>
        
        {/* Mode indicator */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
        }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem',
            color: 'white',
            fontSize: '0.875rem',
          }}>
            {snap.mode === 'UfoMode' ? 'UFO Mode' : 'Runner Mode'}
          </div>
        </div>
        
        {/* Controls hint */}
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1rem',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '0.75rem',
        }}>
          {snap.mode === 'UfoMode' ? 'Mouse to move | Space/Click to shoot' : 'Mouse to move | Space to jump'}
        </div>
        
        {/* Game over overlay */}
        {snap.phase === 'gameover' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
            pointerEvents: 'auto',
          }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{
                fontSize: '3rem',
                fontWeight: 'bold',
                color: '#ef4444',
                marginBottom: '1rem',
              }}>GAME OVER</h1>
              <p style={{
                fontSize: '1.875rem',
                color: 'white',
                marginBottom: '0.5rem',
              }}>Score: {snap.score}</p>
              <p style={{
                fontSize: '1.25rem',
                color: '#22d3ee',
                marginBottom: '1.5rem',
              }}>Wave Reached: {snap.wave}</p>
              <p style={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.875rem',
              }}>Press R to restart</p>
            </div>
          </div>
        )}
      </div>
    </Html>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface SkyBlitzProps {
  soundsOn?: boolean;
}

const SkyBlitz: React.FC<SkyBlitzProps> = ({ soundsOn = true }) => {
  const snap = useSnapshot(skyBlitzState);
  const [gameKey, setGameKey] = useState(0);
  const prevPhaseRef = useRef(snap.phase);
  
  useEffect(() => {
    if (prevPhaseRef.current === 'gameover' && snap.phase === 'playing') {
      setGameKey(k => k + 1);
    }
    prevPhaseRef.current = snap.phase;
  }, [snap.phase]);
  
  useEffect(() => {
    return () => {
      skyBlitzState.reset();
    };
  }, []);
  
  return (
    <>
      {snap.mode === 'RunnerManMode' ? (
        <RunnerManMode key={`runner-${gameKey}`} />
      ) : (
        <UfoMode key={`ufo-${gameKey}`} />
      )}
      <GameHUD />
    </>
  );
};

export default SkyBlitz;
