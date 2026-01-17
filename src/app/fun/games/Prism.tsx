/**
 * Prism.tsx (Prism Hop Infinite)
 * 
 * Endless platform-hopping game
 * Jump between floating glass prisms that drift and rotate
 * Features: normal, cracked (breaks), and boost platforms
 */
'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import { SeededRandom } from '../utils/seededRandom';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type PrismType = 'normal' | 'cracked' | 'boost';

interface Platform {
  id: string;
  position: THREE.Vector3;
  rotation: number;
  type: PrismType;
  crackTimer?: number; // For cracked platforms
  sides: number; // 3=triangle, 4=square, 5=pentagon, 6=hexagon
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const prismState = proxy({
  score: 0,
  highScore: 0,
  distance: 0,
  perfectLandings: 0,
  combo: 0,
  gameOver: false,
  reset: () => {
    prismState.score = 0;
    prismState.distance = 0;
    prismState.perfectLandings = 0;
    prismState.combo = 0;
    prismState.gameOver = false;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORM_SPACING = 4;
const PLATFORM_COUNT = 12;
const GRAVITY = -25;
const JUMP_FORCE = 12;
const BOOST_MULTIPLIER = 1.6;
const PLATFORM_SIZE = 1.2;
const PLAYER_SIZE = 0.2;
const PERFECT_LANDING_RADIUS = 0.3;

const PRISM_COLORS: Record<PrismType, string> = {
  normal: '#48dbfb',
  cracked: '#feca57',
  boost: '#00ff88',
};

const SKY_GRADIENT = [
  { stop: 0, color: '#1a0a2e' },
  { stop: 0.5, color: '#16213e' },
  { stop: 1, color: '#0a1628' },
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const generatePlatform = (rng: SeededRandom, x: number, y: number, difficulty: number): Platform => {
  const rand = rng.float(0, 1);
  let type: PrismType = 'normal';
  
  // Increase special platform chance with difficulty
  const crackedChance = Math.min(0.25, 0.1 + difficulty * 0.01);
  const boostChance = Math.min(0.15, 0.05 + difficulty * 0.005);
  
  if (rand < crackedChance) {
    type = 'cracked';
  } else if (rand < crackedChance + boostChance) {
    type = 'boost';
  }

  const sides = rng.int(3, 6);

  return {
    id: `platform-${x}-${Date.now()}-${rng.float(0, 1000)}`,
    position: new THREE.Vector3(x, y, 0),
    rotation: rng.float(0, Math.PI * 2),
    type,
    sides,
    color: PRISM_COLORS[type],
    crackTimer: type === 'cracked' ? 0.8 : undefined,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Glass prism platform
const PrismPlatform: React.FC<{
  platform: Platform;
  isCurrent: boolean;
}> = ({ platform, isCurrent }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { type, sides, color, position, rotation } = platform;

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  const geometry = useMemo(() => {
    return new THREE.CylinderGeometry(PLATFORM_SIZE, PLATFORM_SIZE, 0.3, sides);
  }, [sides]);

  const opacity = type === 'cracked' ? 0.7 : 0.85;
  const emissiveIntensity = isCurrent ? 0.6 : 0.3;

  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geometry} rotation={[0, rotation, 0]}>
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
          roughness={0.1}
          metalness={0.2}
          transmission={0.3}
        />
      </mesh>
      {/* Glow ring for current platform */}
      {isCurrent && (
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[PLATFORM_SIZE * 0.9, PLATFORM_SIZE * 1.1, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      )}
      {/* Boost indicator */}
      {type === 'boost' && (
        <mesh position={[0, 0.3, 0]}>
          <coneGeometry args={[0.2, 0.4, 8]} />
          <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
};

// Player ball
const Player: React.FC<{
  position: THREE.Vector3;
  isGrounded: boolean;
}> = ({ position, isGrounded }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 5;
      meshRef.current.rotation.z += delta * 3;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[PLAYER_SIZE, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.8}
        />
      </mesh>
      <pointLight color="#ffffff" intensity={1.5} distance={3} />
      {/* Shadow below */}
      {isGrounded && (
        <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.15, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

// Starfield background
const Starfield: React.FC = () => {
  const points = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i < 200; i++) {
      positions.push(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        -20 - Math.random() * 30
      );
    }
    return new Float32Array(positions);
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={200} array={points} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.1} transparent opacity={0.6} />
    </points>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Prism: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(prismState);
  const { camera, scene } = useThree();

  const [playerPos, setPlayerPos] = useState(new THREE.Vector3(0, 1, 0));
  const [playerVel, setPlayerVel] = useState(new THREE.Vector3(0, 0, 0));
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState(0);
  const [isGrounded, setIsGrounded] = useState(true);

  const rngRef = useRef(new SeededRandom(Date.now()));
  const platformIdCounter = useRef(0);

  // Initialize scene
  useEffect(() => {
    camera.position.set(0, 5, 15);
    camera.lookAt(0, 0, 0);
    scene.background = new THREE.Color('#0a1628');
  }, [camera, scene]);

  // Generate initial platforms
  useEffect(() => {
    const initialPlatforms: Platform[] = [];
    let x = 0;
    let y = 0;

    for (let i = 0; i < PLATFORM_COUNT; i++) {
      const offsetX = i === 0 ? 0 : rngRef.current.float(-2, 2);
      const offsetY = i === 0 ? 0 : rngRef.current.float(-0.5, 1);
      
      x += PLATFORM_SPACING;
      y = Math.max(0, y + offsetY);

      initialPlatforms.push(generatePlatform(rngRef.current, x, y, 0));
    }

    // Add starting platform
    initialPlatforms.unshift({
      id: 'start',
      position: new THREE.Vector3(0, 0, 0),
      rotation: 0,
      type: 'normal',
      sides: 6,
      color: PRISM_COLORS.normal,
    });

    setPlatforms(initialPlatforms);
  }, []);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r') {
          prismState.reset();
          setPlayerPos(new THREE.Vector3(0, 1, 0));
          setPlayerVel(new THREE.Vector3(0, 0, 0));
          setCurrentPlatformIndex(0);
          setIsGrounded(true);
          rngRef.current = new SeededRandom(Date.now());
          
          // Regenerate platforms
          const newPlatforms: Platform[] = [];
          let x = 0;
          let y = 0;

          for (let i = 0; i < PLATFORM_COUNT; i++) {
            const offsetX = i === 0 ? 0 : rngRef.current.float(-2, 2);
            const offsetY = i === 0 ? 0 : rngRef.current.float(-0.5, 1);
            
            x += PLATFORM_SPACING;
            y = Math.max(0, y + offsetY);

            newPlatforms.push(generatePlatform(rngRef.current, x, y, 0));
          }

          newPlatforms.unshift({
            id: 'start',
            position: new THREE.Vector3(0, 0, 0),
            rotation: 0,
            type: 'normal',
            sides: 6,
            color: PRISM_COLORS.normal,
          });

          setPlatforms(newPlatforms);
        }
        return;
      }

      // Jump
      if (e.code === 'Space' && isGrounded) {
        e.preventDefault();
        const currentPlatform = platforms[currentPlatformIndex];
        const jumpMultiplier = currentPlatform?.type === 'boost' ? BOOST_MULTIPLIER : 1;
        
        setPlayerVel((prev) => new THREE.Vector3(6, JUMP_FORCE * jumpMultiplier, 0));
        setIsGrounded(false);
      }
    };

    const handleClick = () => {
      if (!snap.gameOver && isGrounded) {
        const currentPlatform = platforms[currentPlatformIndex];
        const jumpMultiplier = currentPlatform?.type === 'boost' ? BOOST_MULTIPLIER : 1;
        
        setPlayerVel((prev) => new THREE.Vector3(6, JUMP_FORCE * jumpMultiplier, 0));
        setIsGrounded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
    };
  }, [snap.gameOver, isGrounded, platforms, currentPlatformIndex]);

  // Game loop
  useFrame((state, delta) => {
    if (snap.gameOver) return;

    // Apply gravity
    const newVel = playerVel.clone();
    newVel.y += GRAVITY * delta;

    // Apply velocity
    const newPos = playerPos.clone();
    newPos.add(newVel.clone().multiplyScalar(delta));

    // Lateral drift control with pointer
    if (!isGrounded) {
      newPos.z += state.pointer.x * delta * 3;
      newPos.z = THREE.MathUtils.clamp(newPos.z, -2, 2);
    }

    // Check platform collision
    let landed = false;
    let landedPlatformIndex = -1;

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      const dx = newPos.x - platform.position.x;
      const dy = newPos.y - platform.position.y;
      const dz = newPos.z - platform.position.z;

      // Check if landing on top of platform
      if (
        Math.abs(dx) < PLATFORM_SIZE * 0.9 &&
        Math.abs(dz) < PLATFORM_SIZE * 0.9 &&
        dy >= 0 && dy < 0.5 &&
        newVel.y < 0
      ) {
        landed = true;
        landedPlatformIndex = i;

        // Perfect landing check
        const distFromCenter = Math.sqrt(dx * dx + dz * dz);
        if (distFromCenter < PERFECT_LANDING_RADIUS) {
          prismState.score += 15;
          prismState.perfectLandings += 1;
          prismState.combo += 1;
        } else {
          prismState.score += 5;
          prismState.combo = 0;
        }

        // Set position on platform
        newPos.y = platform.position.y + 0.3;
        newVel.set(0, 0, 0);

        break;
      }
    }

    if (landed) {
      setIsGrounded(true);
      setCurrentPlatformIndex(landedPlatformIndex);

      // Handle cracked platform
      const landedPlatform = platforms[landedPlatformIndex];
      if (landedPlatform.type === 'cracked') {
        // Start crack timer
        setPlatforms((prev) => {
          const updated = [...prev];
          updated[landedPlatformIndex] = {
            ...updated[landedPlatformIndex],
            crackTimer: 0.6,
          };
          return updated;
        });
      }
    } else {
      setIsGrounded(false);
    }

    // Update cracked platform timers
    setPlatforms((prev) => {
      return prev.map((p, i) => {
        if (p.type === 'cracked' && p.crackTimer !== undefined && p.crackTimer > 0) {
          const newTimer = p.crackTimer - delta;
          if (newTimer <= 0 && i === currentPlatformIndex && isGrounded) {
            // Platform breaks, player falls
            setIsGrounded(false);
            setPlayerVel(new THREE.Vector3(0, -5, 0));
          }
          return { ...p, crackTimer: Math.max(0, newTimer) };
        }
        return p;
      });
    });

    // Check fall off
    if (newPos.y < -10) {
      prismState.gameOver = true;
    }

    setPlayerPos(newPos);
    setPlayerVel(newVel);

    // Update distance
    prismState.distance = Math.max(prismState.distance, Math.floor(newPos.x));

    // Camera follow
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, newPos.x + 5, delta * 3);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, newPos.y + 5, delta * 2);
    camera.lookAt(newPos.x + 3, newPos.y, 0);

    // Generate new platforms ahead
    const lastPlatform = platforms[platforms.length - 1];
    if (lastPlatform && newPos.x > lastPlatform.position.x - PLATFORM_COUNT * PLATFORM_SPACING / 2) {
      setPlatforms((prev) => {
        const updated = [...prev];
        
        // Remove old platforms
        while (updated.length > 0 && updated[0].position.x < newPos.x - 10) {
          updated.shift();
          setCurrentPlatformIndex((i) => Math.max(0, i - 1));
        }

        // Add new platform
        const last = updated[updated.length - 1];
        const newX = last.position.x + PLATFORM_SPACING;
        const newY = Math.max(0, last.position.y + rngRef.current.float(-0.5, 1));

        updated.push(generatePlatform(rngRef.current, newX, newY, prismState.distance));

        return updated;
      });
    }

    // Update high score
    if (prismState.score > prismState.highScore) {
      prismState.highScore = prismState.score;
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <pointLight position={[playerPos.x, playerPos.y + 2, 2]} intensity={0.5} color="#48dbfb" />

      {/* Background */}
      <Starfield />

      {/* Platforms */}
      {platforms.map((platform, index) => (
        <PrismPlatform
          key={platform.id}
          platform={platform}
          isCurrent={index === currentPlatformIndex}
        />
      ))}

      {/* Player */}
      <Player position={playerPos} isGrounded={isGrounded} />

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-white">
            <div className="text-2xl font-bold">{snap.score}</div>
            <div className="text-xs text-white/60">Distance: {snap.distance}m</div>
            <div className="text-xs text-white/40">Combo: x{snap.combo + 1}</div>
          </div>
        </div>

        <div className="absolute top-4 left-40 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs">
            <div>Perfect: {snap.perfectLandings}</div>
            <div className="text-white/60">Best: {snap.highScore}</div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 text-white/60 text-sm pointer-events-auto">
          <div>Space or Click to jump</div>
          <div className="text-xs mt-1">Move mouse to drift • Land centered for bonus</div>
        </div>

        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
            <div className="text-center">
              <h1 className="text-5xl font-bold text-white mb-4">GAME OVER</h1>
              <p className="text-3xl text-white/80 mb-2">{snap.score}</p>
              <p className="text-lg text-white/60 mb-1">Distance: {snap.distance}m</p>
              <p className="text-lg text-white/60 mb-1">Perfect Landings: {snap.perfectLandings}</p>
              <p className="text-lg text-white/60 mb-6">Best: {snap.highScore}</p>
              <p className="text-white/50">Press R to restart</p>
            </div>
          </div>
        )}
      </Html>
    </>
  );
};

export default Prism;
