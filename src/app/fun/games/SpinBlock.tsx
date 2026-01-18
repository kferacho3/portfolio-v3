// src/components/games/SpinBlock.tsx
'use client';

import { Html, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════════════

export const spinBlockState = proxy({
  score: 0,
  highScore: 0,
  hearts: 3,
  combo: 0,
  coinsCollected: 0,
  gemsCollected: 0,
  level: 1,
  isPlaying: true,
  gameOver: false,
  multiplier: 1,
  multiplierTime: 0,
  shieldTime: 0,
  slowTime: 0,
  
  addScore(points: number) {
    const finalPoints = points * this.multiplier;
    this.score += finalPoints;
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
  },
  
  collectCoin() {
    this.coinsCollected++;
    this.combo++;
    this.addScore(10 + this.combo * 2);
  },
  
  collectGem() {
    this.gemsCollected++;
    this.combo++;
    this.addScore(50 + this.combo * 5);
  },
  
  hitBumper() {
    this.addScore(5);
  },
  
  hitHazard() {
    if (this.shieldTime > 0) {
      this.shieldTime = 0; // Shield absorbs hit
      return;
    }
    this.hearts--;
    this.combo = 0;
    if (this.hearts <= 0) {
      this.gameOver = true;
      this.isPlaying = false;
    }
  },
  
  activateMultiplier() {
    this.multiplier = 2;
    this.multiplierTime = 10;
  },
  
  activateShield() {
    this.shieldTime = 8;
  },
  
  activateSlowTime() {
    this.slowTime = 6;
  },
  
  reset() {
    this.score = 0;
    this.hearts = 3;
    this.combo = 0;
    this.coinsCollected = 0;
    this.gemsCollected = 0;
    this.level = 1;
    this.isPlaying = true;
    this.gameOver = false;
    this.multiplier = 1;
    this.multiplierTime = 0;
    this.shieldTime = 0;
    this.slowTime = 0;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BOX_SIZE = 12;
const WALL_THICKNESS = 0.5;
const BALL_RADIUS = 0.4;
const MAX_TILT = Math.PI / 6; // 30 degrees max tilt

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER BALL
// ═══════════════════════════════════════════════════════════════════════════

const PlayerBall: React.FC<{ hasShield: boolean }> = ({ hasShield }) => {
  const ballRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    
    // Visual effects on mesh
    if (meshRef.current && hasShield) {
      meshRef.current.scale.setScalar(1 + Math.sin(timeRef.current * 8) * 0.05);
    }
  });

  const ballColor = hasShield ? '#4169E1' : '#FF6B6B';

  return (
    <RigidBody
      ref={ballRef}
      type="dynamic"
      position={[0, 2, 0]}
      colliders={false}
      restitution={0.5}
      friction={0.3}
      linearDamping={0.5}
      angularDamping={0.3}
      ccd
    >
      <BallCollider args={[BALL_RADIUS]} restitution={0.5} friction={0.3} />
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshPhysicalMaterial
          color={ballColor}
          metalness={0.3}
          roughness={0.4}
          emissive={ballColor}
          emissiveIntensity={0.2}
          clearcoat={0.8}
        />
      </mesh>
      
      {/* Shield visual */}
      {hasShield && (
        <mesh scale={1.5}>
          <sphereGeometry args={[BALL_RADIUS, 16, 16]} />
          <meshBasicMaterial color="#4169E1" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
      
      <pointLight color={ballColor} intensity={1} distance={3} />
    </RigidBody>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTIBLES
// ═══════════════════════════════════════════════════════════════════════════

interface CollectibleProps {
  position: [number, number, number];
  onCollect: () => void;
}

const Coin: React.FC<CollectibleProps> = ({ position, onCollect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const collectedRef = useRef(false);

  useFrame((_, delta) => {
    if (meshRef.current && !collectedRef.current) {
      meshRef.current.rotation.y += delta * 3;
    }
  });

  const handleCollision = useCallback(() => {
    if (!collectedRef.current) {
      collectedRef.current = true;
      onCollect();
    }
  }, [onCollect]);

  if (collectedRef.current) return null;

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      sensor
      onIntersectionEnter={handleCollision}
    >
      <CylinderCollider args={[0.1, 0.3]} sensor />
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
        <meshPhysicalMaterial
          color="#FFD700"
          metalness={0.9}
          roughness={0.1}
          emissive="#FFD700"
          emissiveIntensity={0.3}
        />
      </mesh>
      <pointLight color="#FFD700" intensity={0.5} distance={2} />
    </RigidBody>
  );
};

const Gem: React.FC<CollectibleProps> = ({ position, onCollect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const collectedRef = useRef(false);

  useFrame((state) => {
    if (meshRef.current && !collectedRef.current) {
      meshRef.current.rotation.y += 0.02;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  const handleCollision = useCallback(() => {
    if (!collectedRef.current) {
      collectedRef.current = true;
      onCollect();
    }
  }, [onCollect]);

  if (collectedRef.current) return null;

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      sensor
      onIntersectionEnter={handleCollision}
    >
      <BallCollider args={[0.35]} sensor />
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.35]} />
        <meshPhysicalMaterial
          color="#00FFFF"
          metalness={0.1}
          roughness={0}
          transmission={0.6}
          thickness={0.5}
          emissive="#00FFFF"
          emissiveIntensity={0.4}
        />
      </mesh>
      <pointLight color="#00FFFF" intensity={0.8} distance={3} />
    </RigidBody>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HAZARDS
// ═══════════════════════════════════════════════════════════════════════════

interface HazardProps {
  position: [number, number, number];
  onHit: () => void;
}

const Spike: React.FC<HazardProps> = ({ position, onHit }) => {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      onCollisionEnter={onHit}
    >
      <CylinderCollider args={[0.3, 0.4]} />
      <group ref={meshRef}>
        {/* Multiple spikes */}
        {[0, 72, 144, 216, 288].map((angle, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((angle * Math.PI) / 180) * 0.2,
              0.2,
              Math.sin((angle * Math.PI) / 180) * 0.2,
            ]}
            rotation={[0, 0, Math.PI]}
          >
            <coneGeometry args={[0.15, 0.5, 4]} />
            <meshPhysicalMaterial
              color="#FF0000"
              emissive="#FF0000"
              emissiveIntensity={0.5}
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        ))}
        {/* Base */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.15, 16]} />
          <meshPhysicalMaterial color="#4a0000" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
      <pointLight color="#FF0000" intensity={0.6} distance={2} />
    </RigidBody>
  );
};

const HazardZone: React.FC<HazardProps & { size?: [number, number] }> = ({ 
  position, onHit, size = [1.5, 1.5] 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 
        0.3 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
    }
  });

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      sensor
      onIntersectionEnter={onHit}
    >
      <CuboidCollider args={[size[0] / 2, 0.1, size[1] / 2]} sensor />
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={size} />
        <meshBasicMaterial color="#FF0000" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </RigidBody>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// BUMPERS
// ═══════════════════════════════════════════════════════════════════════════

const Bumper: React.FC<{ position: [number, number, number]; color?: string }> = ({ 
  position, color = '#FF69B4' 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hit, setHit] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      if (hit) {
        meshRef.current.scale.setScalar(1.3);
        setTimeout(() => setHit(false), 100);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
  });

  const handleCollision = useCallback(() => {
    setHit(true);
    spinBlockState.hitBumper();
  }, []);

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      restitution={1.5}
      onCollisionEnter={handleCollision}
    >
      <CylinderCollider args={[0.4, 0.5]} restitution={1.5} />
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hit ? 0.8 : 0.3}
          metalness={0.4}
          roughness={0.3}
          clearcoat={0.5}
        />
      </mesh>
      <pointLight color={color} intensity={hit ? 1.5 : 0.5} distance={3} />
    </RigidBody>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// POWER-UPS
// ═══════════════════════════════════════════════════════════════════════════

interface PowerUpProps {
  position: [number, number, number];
  type: 'multiplier' | 'shield' | 'slowTime' | 'heart';
  onCollect: (type: string) => void;
}

const PowerUp: React.FC<PowerUpProps> = ({ position, type, onCollect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const collectedRef = useRef(false);

  const config = useMemo(() => {
    switch (type) {
      case 'multiplier':
        return { color: '#32CD32', emissive: '#00FF00', shape: 'dodecahedron' };
      case 'shield':
        return { color: '#4169E1', emissive: '#1E90FF', shape: 'icosahedron' };
      case 'slowTime':
        return { color: '#00CED1', emissive: '#00FFFF', shape: 'torus' };
      case 'heart':
        return { color: '#FF69B4', emissive: '#FF1493', shape: 'sphere' };
      default:
        return { color: '#FFFFFF', emissive: '#FFFFFF', shape: 'sphere' };
    }
  }, [type]);

  useFrame((state) => {
    if (meshRef.current && !collectedRef.current) {
      meshRef.current.rotation.y += 0.03;
      meshRef.current.rotation.x += 0.01;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    }
  });

  const handleCollision = useCallback(() => {
    if (!collectedRef.current) {
      collectedRef.current = true;
      onCollect(type);
    }
  }, [onCollect, type]);

  if (collectedRef.current) return null;

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      sensor
      onIntersectionEnter={handleCollision}
    >
      <BallCollider args={[0.4]} sensor />
      <mesh ref={meshRef}>
        {config.shape === 'dodecahedron' && <dodecahedronGeometry args={[0.35]} />}
        {config.shape === 'icosahedron' && <icosahedronGeometry args={[0.35]} />}
        {config.shape === 'torus' && <torusGeometry args={[0.25, 0.1, 8, 16]} />}
        {config.shape === 'sphere' && <sphereGeometry args={[0.3, 16, 16]} />}
        <meshPhysicalMaterial
          color={config.color}
          emissive={config.emissive}
          emissiveIntensity={0.5}
          metalness={0.3}
          roughness={0.2}
          clearcoat={0.8}
        />
      </mesh>
      <pointLight color={config.emissive} intensity={1} distance={3} />
    </RigidBody>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// THE BOX ARENA
// ═══════════════════════════════════════════════════════════════════════════

const BoxArena: React.FC = () => {
  const wallMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1a1a2e',
    metalness: 0.2,
    roughness: 0.8,
    transparent: true,
    opacity: 0.9,
  }), []);

  const floorMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0f0f1a',
    metalness: 0.1,
    roughness: 0.9,
  }), []);

  const halfSize = BOX_SIZE / 2;
  const halfWall = WALL_THICKNESS / 2;

  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" position={[0, -halfWall, 0]}>
        <CuboidCollider args={[halfSize, halfWall, halfSize]} restitution={0.3} friction={0.5} />
        <mesh material={floorMaterial} receiveShadow>
          <boxGeometry args={[BOX_SIZE, WALL_THICKNESS, BOX_SIZE]} />
        </mesh>
      </RigidBody>

      {/* Floor grid pattern */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOX_SIZE - 0.5, BOX_SIZE - 0.5]} />
        <meshBasicMaterial color="#1a1a3a" transparent opacity={0.5} />
      </mesh>

      {/* Walls */}
      {/* Front */}
      <RigidBody type="fixed" position={[0, halfSize / 2, halfSize + halfWall]}>
        <CuboidCollider args={[halfSize + WALL_THICKNESS, halfSize / 2, halfWall]} restitution={0.8} />
        <mesh material={wallMaterial}>
          <boxGeometry args={[BOX_SIZE + WALL_THICKNESS * 2, BOX_SIZE / 2, WALL_THICKNESS]} />
        </mesh>
      </RigidBody>

      {/* Back */}
      <RigidBody type="fixed" position={[0, halfSize / 2, -halfSize - halfWall]}>
        <CuboidCollider args={[halfSize + WALL_THICKNESS, halfSize / 2, halfWall]} restitution={0.8} />
        <mesh material={wallMaterial}>
          <boxGeometry args={[BOX_SIZE + WALL_THICKNESS * 2, BOX_SIZE / 2, WALL_THICKNESS]} />
        </mesh>
      </RigidBody>

      {/* Left */}
      <RigidBody type="fixed" position={[-halfSize - halfWall, halfSize / 2, 0]}>
        <CuboidCollider args={[halfWall, halfSize / 2, halfSize]} restitution={0.8} />
        <mesh material={wallMaterial}>
          <boxGeometry args={[WALL_THICKNESS, BOX_SIZE / 2, BOX_SIZE]} />
        </mesh>
      </RigidBody>

      {/* Right */}
      <RigidBody type="fixed" position={[halfSize + halfWall, halfSize / 2, 0]}>
        <CuboidCollider args={[halfWall, halfSize / 2, halfSize]} restitution={0.8} />
        <mesh material={wallMaterial}>
          <boxGeometry args={[WALL_THICKNESS, BOX_SIZE / 2, BOX_SIZE]} />
        </mesh>
      </RigidBody>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HEARTS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

const HeartsDisplay: React.FC<{ hearts: number }> = ({ hearts }) => (
  <div className="flex gap-1.5 items-center">
    {Array.from({ length: 3 }).map((_, i) => (
      <svg
        key={i}
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill={i < hearts ? '#FF4444' : '#333'}
        className={i < hearts ? 'drop-shadow-[0_0_8px_rgba(255,68,68,0.7)]' : ''}
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SPINBLOCK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const SpinBlock: React.FC = () => {
  const { camera, gl } = useThree();
  const snap = useSnapshot(spinBlockState);
  
  const [tiltX, setTiltX] = useState(0);
  const [tiltZ, setTiltZ] = useState(0);
  const targetTiltX = useRef(0);
  const targetTiltZ = useRef(0);
  
  const [coins, setCoins] = useState<[number, number, number][]>([]);
  const [gems, setGems] = useState<[number, number, number][]>([]);
  const [powerUps, setPowerUps] = useState<{ pos: [number, number, number]; type: PowerUpProps['type'] }[]>([]);

  // Generate level content
  const generateLevel = useCallback(() => {
    const halfBox = BOX_SIZE / 2 - 1;
    
    // Coins
    const newCoins: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) {
      newCoins.push([
        (Math.random() - 0.5) * halfBox * 1.6,
        0.5,
        (Math.random() - 0.5) * halfBox * 1.6,
      ]);
    }
    setCoins(newCoins);

    // Gems
    const newGems: [number, number, number][] = [];
    for (let i = 0; i < 4; i++) {
      newGems.push([
        (Math.random() - 0.5) * halfBox * 1.6,
        0.5,
        (Math.random() - 0.5) * halfBox * 1.6,
      ]);
    }
    setGems(newGems);

    // Power-ups
    const types: PowerUpProps['type'][] = ['multiplier', 'shield', 'slowTime', 'heart'];
    const newPowerUps = types.map((type) => ({
      pos: [
        (Math.random() - 0.5) * halfBox * 1.4,
        0.6,
        (Math.random() - 0.5) * halfBox * 1.4,
      ] as [number, number, number],
      type,
    }));
    setPowerUps(newPowerUps);
  }, []);

  // Initialize
  useEffect(() => {
    spinBlockState.reset();
    generateLevel();
    
    camera.position.set(0, 18, 12);
    camera.lookAt(0, 0, 0);
  }, [camera, generateLevel]);

  // Mouse/touch controls for tilting
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!snap.isPlaying) return;
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      
      targetTiltX.current = -y * MAX_TILT;
      targetTiltZ.current = x * MAX_TILT;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [gl, snap.isPlaying]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      if (key === 'r') {
        spinBlockState.reset();
        generateLevel();
      }
      
      // Arrow keys / WASD for tilting
      const tiltSpeed = MAX_TILT;
      if (key === 'w' || key === 'arrowup') targetTiltX.current = tiltSpeed;
      if (key === 's' || key === 'arrowdown') targetTiltX.current = -tiltSpeed;
      if (key === 'a' || key === 'arrowleft') targetTiltZ.current = -tiltSpeed;
      if (key === 'd' || key === 'arrowright') targetTiltZ.current = tiltSpeed;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 's', 'arrowup', 'arrowdown'].includes(key)) targetTiltX.current = 0;
      if (['a', 'd', 'arrowleft', 'arrowright'].includes(key)) targetTiltZ.current = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [generateLevel]);

  // Game loop
  useFrame((_, delta) => {
    if (!snap.isPlaying) return;

    // Smooth tilt interpolation
    const slowFactor = snap.slowTime > 0 ? 0.5 : 1;
    setTiltX((prev) => THREE.MathUtils.lerp(prev, targetTiltX.current, 0.1 * slowFactor));
    setTiltZ((prev) => THREE.MathUtils.lerp(prev, targetTiltZ.current, 0.1 * slowFactor));

    // Update timers
    if (spinBlockState.multiplierTime > 0) {
      spinBlockState.multiplierTime -= delta;
      if (spinBlockState.multiplierTime <= 0) {
        spinBlockState.multiplier = 1;
      }
    }
    if (spinBlockState.shieldTime > 0) {
      spinBlockState.shieldTime -= delta;
    }
    if (spinBlockState.slowTime > 0) {
      spinBlockState.slowTime -= delta;
    }
  });

  // Handlers
  const handleCoinCollect = useCallback((index: number) => {
    spinBlockState.collectCoin();
    setCoins((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGemCollect = useCallback((index: number) => {
    spinBlockState.collectGem();
    setGems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePowerUpCollect = useCallback((type: string, index: number) => {
    switch (type) {
      case 'multiplier':
        spinBlockState.activateMultiplier();
        break;
      case 'shield':
        spinBlockState.activateShield();
        break;
      case 'slowTime':
        spinBlockState.activateSlowTime();
        break;
      case 'heart':
        spinBlockState.hearts = Math.min(5, spinBlockState.hearts + 1);
        break;
    }
    setPowerUps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleHazardHit = useCallback(() => {
    spinBlockState.hitHazard();
  }, []);

  const handleRestart = useCallback(() => {
    spinBlockState.reset();
    generateLevel();
  }, [generateLevel]);

  // Bumper and hazard positions
  const bumperPositions: [number, number, number][] = useMemo(() => [
    [-3, 0.4, -3],
    [3, 0.4, -3],
    [-3, 0.4, 3],
    [3, 0.4, 3],
    [0, 0.4, 0],
  ], []);

  const spikePositions: [number, number, number][] = useMemo(() => [
    [-4.5, 0.3, 0],
    [4.5, 0.3, 0],
    [0, 0.3, -4.5],
    [0, 0.3, 4.5],
  ], []);

  const hazardZones: { pos: [number, number, number]; size: [number, number] }[] = useMemo(() => [
    { pos: [-4.5, 0, -4.5], size: [2, 2] },
    { pos: [4.5, 0, 4.5], size: [2, 2] },
  ], []);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#4488ff" />

      {/* Physics world with tilting gravity */}
      <Physics
        gravity={[
          Math.sin(tiltZ) * 20,
          -15,
          -Math.sin(tiltX) * 20,
        ]}
        timeStep={snap.slowTime > 0 ? 1 / 120 : 1 / 60}
      >
        {/* The tilting box */}
        <group rotation={[tiltX, 0, tiltZ]}>
          <BoxArena />

          {/* Bumpers */}
          {bumperPositions.map((pos, i) => (
            <Bumper
              key={`bumper-${i}`}
              position={pos}
              color={['#FF69B4', '#9B59B6', '#3498DB', '#E74C3C', '#F39C12'][i]}
            />
          ))}

          {/* Spikes */}
          {spikePositions.map((pos, i) => (
            <Spike key={`spike-${i}`} position={pos} onHit={handleHazardHit} />
          ))}

          {/* Hazard zones */}
          {hazardZones.map((zone, i) => (
            <HazardZone key={`zone-${i}`} position={zone.pos} size={zone.size} onHit={handleHazardHit} />
          ))}

          {/* Coins */}
          {coins.map((pos, i) => (
            <Coin key={`coin-${i}`} position={pos} onCollect={() => handleCoinCollect(i)} />
          ))}

          {/* Gems */}
          {gems.map((pos, i) => (
            <Gem key={`gem-${i}`} position={pos} onCollect={() => handleGemCollect(i)} />
          ))}

          {/* Power-ups */}
          {powerUps.map((pu, i) => (
            <PowerUp
              key={`powerup-${i}`}
              position={pu.pos}
              type={pu.type}
              onCollect={(type) => handlePowerUpCollect(type, i)}
            />
          ))}
        </group>

        {/* Player ball (not tilted, affected by gravity) */}
        <PlayerBall hasShield={snap.shieldTime > 0} />
      </Physics>

      {/* Background */}
      <mesh scale={100}>
        <sphereGeometry />
        <meshBasicMaterial color="#0a0a15" side={THREE.BackSide} />
      </mesh>

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-sm px-5 py-4 text-white shadow-xl pointer-events-auto">
          <div className="text-3xl font-bold">
            {snap.score}
            {snap.multiplier > 1 && <span className="text-green-400 text-lg ml-2">2x</span>}
          </div>
          <div className="text-xs text-white/50 uppercase tracking-wider">Score</div>

          <div className="mt-3">
            <HeartsDisplay hearts={snap.hearts} />
          </div>

          <div className="mt-3 flex gap-4">
            <div>
              <div className="text-lg font-semibold text-yellow-400">{snap.coinsCollected}</div>
              <div className="text-xs text-white/50">Coins</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-cyan-400">{snap.gemsCollected}</div>
              <div className="text-xs text-white/50">Gems</div>
            </div>
            {snap.combo > 1 && (
              <div>
                <div className="text-lg font-semibold text-orange-400">{snap.combo}x</div>
                <div className="text-xs text-white/50">Combo</div>
              </div>
            )}
          </div>

          {/* Active power-ups */}
          <div className="mt-3 flex flex-col gap-1">
            {snap.shieldTime > 0 && (
              <div className="text-xs text-blue-400">🛡️ Shield: {snap.shieldTime.toFixed(1)}s</div>
            )}
            {snap.multiplierTime > 0 && (
              <div className="text-xs text-green-400">2️⃣ 2x Points: {snap.multiplierTime.toFixed(1)}s</div>
            )}
            {snap.slowTime > 0 && (
              <div className="text-xs text-cyan-400">⏱️ Slow: {snap.slowTime.toFixed(1)}s</div>
            )}
          </div>

          <div className="text-[10px] text-white/40 mt-3">
            Move mouse or WASD to tilt<br />
            Press R to restart
          </div>
        </div>

        {/* Game Over */}
        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 pointer-events-auto">
            <div className="text-center bg-slate-950/90 rounded-3xl border border-white/10 p-8 backdrop-blur-xl">
              <h1 className="text-4xl font-bold text-red-400 mb-4">Game Over!</h1>
              <p className="text-2xl text-white mb-2">Score: {snap.score}</p>
              <p className="text-lg text-white/60 mb-1">High Score: {snap.highScore}</p>
              <p className="text-lg text-white/60 mb-1">Coins: {snap.coinsCollected} | Gems: {snap.gemsCollected}</p>
              <button
                onClick={handleRestart}
                className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold transition-colors"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[9px] text-white/60 pointer-events-auto">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-yellow-400">● Coin</span>
            <span className="text-cyan-400">◆ Gem</span>
            <span className="text-pink-400">○ Bumper</span>
            <span className="text-red-500">▲ Spike</span>
            <span className="text-green-400">⬡ 2x</span>
            <span className="text-blue-400">◯ Shield</span>
            <span className="text-pink-400">❤️ Life</span>
          </div>
        </div>
      </Html>
    </>
  );
};

export default SpinBlock;
