/**
 * Weave.tsx
 * 
 * A neon arcade game where you orbit the center, dodging sweeping laser arms
 * while collecting glowing orbs to build score. Thread through danger,
 * collect the light, survive as long as you can.
 */
'use client';

import { Html, Trail } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const weaveState = proxy({
  score: 0,
  highScore: 0,
  lives: 3,
  maxLives: 3,
  level: 1,
  orbs: 0,
  orbsCollected: 0,
  gameOver: false,
  combo: 0,
  bestCombo: 0,
  invincible: false,
  reset: () => {
    weaveState.score = 0;
    weaveState.lives = 3;
    weaveState.level = 1;
    weaveState.orbs = 0;
    weaveState.orbsCollected = 0;
    weaveState.gameOver = false;
    weaveState.combo = 0;
    weaveState.invincible = false;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PLAYER_ORBIT_RADIUS = 3.5;
const PLAYER_SIZE = 0.22;
const PLAYER_HITBOX = 0.12; // Reduced for more forgiving collision
const BASE_PLAYER_SPEED = 3.8; // Increased player speed
const BASE_ARM_SPEED = 0.6; // Slower arm rotation for better dodging
const ARM_WIDTH = 0.08; // Thinner arms
const INNER_SAFE_RADIUS = 0.8;
const OUTER_RADIUS = 5.5;
const ORB_SPAWN_INTERVAL = 1.5;
const ORB_LIFETIME = 4.0;
const ORB_SIZE = 0.18;
const ORB_COLLECT_RADIUS = 0.4;
const INVINCIBILITY_TIME = 1.5;
const LEVEL_UP_ORBS = 8;

const NEON_COLORS = ['#00ffff', '#ff00ff', '#00ff88', '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'];
const ARM_COLOR = '#ff3366';
const ARM_GLOW = '#ff0044';
const ORB_COLOR = '#00ffff';
const ORB_GLOW = '#00ddff';
const BONUS_ORB_COLOR = '#feca57';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LaserArm {
  id: string;
  angle: number;
  speed: number;
  length: number;
  color: string;
}

interface Orb {
  id: string;
  angle: number;
  radius: number;
  spawnTime: number;
  isBonus: boolean;
  collected: boolean;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const CentralCore: React.FC<{ level: number; pulse: number }> = ({ level, pulse }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const color = NEON_COLORS[(level - 1) % NEON_COLORS.length];

  useFrame(({ clock }) => {
    if (meshRef.current && glowRef.current) {
      const t = clock.getElapsedTime();
      const scale = 0.4 + 0.05 * Math.sin(t * 3) + pulse * 0.1;
      meshRef.current.scale.setScalar(scale);
      meshRef.current.rotation.z = t * 0.5;
      meshRef.current.rotation.x = t * 0.3;
      glowRef.current.scale.setScalar(scale * 1.8);
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <dodecahedronGeometry args={[1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.BackSide} />
      </mesh>
      <pointLight color={color} intensity={2.5} distance={10} />
    </group>
  );
};

const OrbitRing: React.FC<{ radius: number; color: string }> = ({ radius, color }) => {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.02, 8, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.25} />
    </mesh>
  );
};

const DangerZone: React.FC = () => {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (innerRef.current) {
      (innerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.03 + 0.02 * Math.sin(t * 2);
    }
  });

  return (
    <group>
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]}>
        <ringGeometry args={[INNER_SAFE_RADIUS, PLAYER_ORBIT_RADIUS - 0.3, 64]} />
        <meshBasicMaterial color={ARM_COLOR} transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const Player: React.FC<{
  angle: number;
  color: string;
  isHit: boolean;
  invincible: boolean;
}> = ({ angle, color, isHit, invincible }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const x = Math.cos(angle) * PLAYER_ORBIT_RADIUS;
  const y = Math.sin(angle) * PLAYER_ORBIT_RADIUS;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.z = t * 4;
      meshRef.current.rotation.x = t * 3;
      
      if (invincible) {
        meshRef.current.visible = Math.floor(t * 10) % 2 === 0;
      } else {
        meshRef.current.visible = true;
      }
    }
  });

  const displayColor = isHit ? '#ff0000' : color;

  return (
    <group position={[x, y, 0]}>
      <Trail width={0.4} length={6} color={color} attenuation={(t) => t * t}>
        <mesh ref={meshRef}>
          <octahedronGeometry args={[PLAYER_SIZE]} />
          <meshStandardMaterial
            color={displayColor}
            emissive={displayColor}
            emissiveIntensity={isHit ? 1.5 : 0.8}
          />
        </mesh>
      </Trail>
      <pointLight color={color} intensity={1.2} distance={2.5} />
    </group>
  );
};

const LaserArmComponent: React.FC<{ arm: LaserArm }> = ({ arm }) => {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const t = clock.getElapsedTime();
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.04 * Math.sin(t * 8);
    }
  });

  const armLength = arm.length - INNER_SAFE_RADIUS;
  const armCenter = INNER_SAFE_RADIUS + armLength / 2;
  
  // Visual width slightly larger than hitbox for clarity
  const visualWidth = ARM_WIDTH * 1.5;

  return (
    <group ref={groupRef} rotation={[0, 0, arm.angle]}>
      {/* Main laser beam - thinner and more visible */}
      <mesh position={[armCenter, 0, 0]}>
        <boxGeometry args={[armLength, visualWidth, 0.04]} />
        <meshStandardMaterial color={arm.color} emissive={arm.color} emissiveIntensity={1.5} />
      </mesh>
      {/* Glow effect - shows danger zone more clearly */}
      <mesh ref={glowRef} position={[armCenter, 0, -0.02]}>
        <boxGeometry args={[armLength, visualWidth * 3, 0.02]} />
        <meshBasicMaterial color={ARM_GLOW} transparent opacity={0.12} />
      </mesh>
      {/* End caps */}
      <mesh position={[INNER_SAFE_RADIUS, 0, 0]}>
        <circleGeometry args={[visualWidth, 12]} />
        <meshBasicMaterial color={arm.color} />
      </mesh>
      <mesh position={[arm.length, 0, 0]}>
        <circleGeometry args={[visualWidth, 12]} />
        <meshBasicMaterial color={arm.color} />
      </mesh>
    </group>
  );
};

const OrbComponent: React.FC<{ orb: Orb; currentTime: number }> = ({ orb, currentTime }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const x = Math.cos(orb.angle) * orb.radius;
  const y = Math.sin(orb.angle) * orb.radius;
  
  const age = currentTime - orb.spawnTime;
  const fadeStart = ORB_LIFETIME - 1.0;
  const opacity = age > fadeStart ? 1 - (age - fadeStart) / 1.0 : 1;
  const color = orb.isBonus ? BONUS_ORB_COLOR : ORB_COLOR;
  const glow = orb.isBonus ? BONUS_ORB_COLOR : ORB_GLOW;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.z = t * 3;
      meshRef.current.rotation.y = t * 2;
      const pulse = 1 + 0.15 * Math.sin(t * 5 + orb.angle);
      meshRef.current.scale.setScalar(pulse);
    }
  });

  if (orb.collected) return null;

  return (
    <group position={[x, y, 0]}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[ORB_SIZE]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh scale={[1.8, 1.8, 1.8]}>
        <sphereGeometry args={[ORB_SIZE, 16, 16]} />
        <meshBasicMaterial color={glow} transparent opacity={opacity * 0.2} />
      </mesh>
      <pointLight color={color} intensity={0.8 * opacity} distance={1.5} />
    </group>
  );
};

const ParticleEffect: React.FC<{ particles: Particle[] }> = ({ particles }) => {
  return (
    <>
      {particles.map((p) => (
        <mesh key={p.id} position={[p.x, p.y, 0]}>
          <circleGeometry args={[p.size * p.life, 6]} />
          <meshBasicMaterial color={p.color} transparent opacity={p.life * 0.8} />
        </mesh>
      ))}
    </>
  );
};

const LivesDisplay: React.FC<{ lives: number; maxLives: number }> = ({ lives, maxLives }) => {
  return (
    <group position={[-5.5, 4, 0]}>
      {Array.from({ length: maxLives }).map((_, i) => (
        <mesh key={i} position={[i * 0.5, 0, 0]}>
          <circleGeometry args={[0.15, 6]} />
          <meshBasicMaterial
            color={i < lives ? '#ff3366' : '#333333'}
            transparent
            opacity={i < lives ? 1 : 0.3}
          />
        </mesh>
      ))}
    </group>
  );
};

const BackgroundGrid: React.FC = () => {
  const lines = useMemo(() => {
    const result: THREE.Vector3[][] = [];
    const gridSize = 12;
    const divisions = 12;
    const step = gridSize / divisions;

    for (let i = -divisions / 2; i <= divisions / 2; i++) {
      const pos = i * step;
      result.push([new THREE.Vector3(pos, -gridSize / 2, -2), new THREE.Vector3(pos, gridSize / 2, -2)]);
      result.push([new THREE.Vector3(-gridSize / 2, pos, -2), new THREE.Vector3(gridSize / 2, pos, -2)]);
    }
    return result;
  }, []);

  return (
    <>
      {lines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array(pts.flatMap((p) => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#1a1a2e" transparent opacity={0.4} />
        </line>
      ))}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Weave: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(weaveState);
  const { camera, scene } = useThree();

  const [playerAngle, setPlayerAngle] = useState(Math.PI / 2);
  const [arms, setArms] = useState<LaserArm[]>([]);
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isHit, setIsHit] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [corePulse, setCorePulse] = useState(0);

  const playerDirection = useRef(0);
  const lastOrbSpawn = useRef(0);
  const invincibleTimer = useRef(0);
  const gameTime = useRef(0);
  const levelOrbCount = useRef(0);

  const currentColor = NEON_COLORS[(snap.level - 1) % NEON_COLORS.length];

  // Camera setup
  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    scene.background = new THREE.Color('#08080f');
  }, [camera, scene]);

  // Generate arms for level with guaranteed safe gaps
  const generateArms = useCallback((level: number) => {
    // Start with 1 arm, add more gradually
    const armCount = Math.min(1 + Math.floor(level / 3), 4);
    const newArms: LaserArm[] = [];

    // Calculate base speed - increases slowly with level
    const baseSpeed = BASE_ARM_SPEED * (1 + (level - 1) * 0.08);

    // All arms rotate in the same direction to maintain consistent gaps
    // This ensures players can always find a safe window by moving faster/slower than arms
    const rotationDirection = Math.random() > 0.5 ? 1 : -1;

    for (let i = 0; i < armCount; i++) {
      // Evenly space arms with no random offset - predictable pattern
      const angleOffset = (i / armCount) * Math.PI * 2;
      
      // Very small speed variation to keep gaps consistent
      const speedVariation = 0.95 + Math.random() * 0.1;

      newArms.push({
        id: `arm-${i}`,
        angle: angleOffset,
        speed: baseSpeed * rotationDirection * speedVariation,
        length: OUTER_RADIUS,
        color: ARM_COLOR,
      });
    }

    return newArms;
  }, []);

  // Initialize
  useEffect(() => {
    setArms(generateArms(1));
  }, [generateArms]);

  // Spawn particles
  const spawnParticles = useCallback((x: number, y: number, color: string, count: number) => {
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
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r') {
          weaveState.reset();
          setPlayerAngle(Math.PI / 2);
          setOrbs([]);
          setParticles([]);
          setArms(generateArms(1));
          setGameStarted(true);
          levelOrbCount.current = 0;
          gameTime.current = 0;
          lastOrbSpawn.current = 0;
        }
        return;
      }

      if (!gameStarted) {
        if (e.key === ' ' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'd') {
          e.preventDefault();
          setGameStarted(true);
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        playerDirection.current = 1;
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        playerDirection.current = -1;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        if (playerDirection.current === 1) playerDirection.current = 0;
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        if (playerDirection.current === -1) playerDirection.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [snap.gameOver, gameStarted, generateArms]);

  // Mouse/touch controls
  useEffect(() => {
    let isPointerDown = false;
    let lastX = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (!gameStarted && !snap.gameOver) {
        setGameStarted(true);
        return;
      }
      if (snap.gameOver) {
        weaveState.reset();
        setPlayerAngle(Math.PI / 2);
        setOrbs([]);
        setParticles([]);
        setArms(generateArms(1));
        setGameStarted(true);
        levelOrbCount.current = 0;
        gameTime.current = 0;
        lastOrbSpawn.current = 0;
        return;
      }
      isPointerDown = true;
      lastX = e.clientX;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!gameStarted || snap.gameOver) return;

      if (isPointerDown) {
        const dx = e.clientX - lastX;
        if (Math.abs(dx) > 2) {
          playerDirection.current = dx > 0 ? -1 : 1;
        }
        lastX = e.clientX;
      } else {
        const centerX = window.innerWidth / 2;
        const deadzone = 80;
        if (e.clientX < centerX - deadzone) {
          playerDirection.current = 1;
        } else if (e.clientX > centerX + deadzone) {
          playerDirection.current = -1;
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
  }, [snap.gameOver, gameStarted, generateArms]);

  // Check arm collision - uses angular difference for more reliable detection
  const checkArmCollision = useCallback((playerAngle: number, arms: LaserArm[]) => {
    // Normalize player angle to [0, 2π]
    const normalizedPlayerAngle = ((playerAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    
    // Calculate how wide the arm appears at the player's orbit radius (in radians)
    // This gives a more intuitive collision based on angular width
    const armAngularWidth = Math.atan2(ARM_WIDTH + PLAYER_HITBOX, PLAYER_ORBIT_RADIUS) * 2;

    for (const arm of arms) {
      // Normalize arm angle to [0, 2π]
      const armAngle = ((arm.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      
      // Calculate angular difference
      let angleDiff = Math.abs(normalizedPlayerAngle - armAngle);
      // Handle wrap-around
      if (angleDiff > Math.PI) {
        angleDiff = Math.PI * 2 - angleDiff;
      }
      
      // Check if player is within the arm's angular width
      if (angleDiff < armAngularWidth / 2) {
        return true;
      }
    }
    return false;
  }, []);

  // Game loop
  useFrame((_, delta) => {
    if (snap.gameOver || !gameStarted) return;

    gameTime.current += delta;

    // Update invincibility
    if (weaveState.invincible) {
      invincibleTimer.current -= delta;
      if (invincibleTimer.current <= 0) {
        weaveState.invincible = false;
        setIsHit(false);
      }
    }

    // Update player
    const playerSpeed = BASE_PLAYER_SPEED * (1 + snap.level * 0.08);
    if (playerDirection.current !== 0) {
      setPlayerAngle((prev) => prev + playerDirection.current * playerSpeed * delta);
    }

    // Update arms - speed increases gradually with level
    const levelSpeedMultiplier = 1 + (snap.level - 1) * 0.05; // 5% faster per level
    setArms((prev) =>
      prev.map((arm) => ({
        ...arm,
        angle: arm.angle + arm.speed * levelSpeedMultiplier * delta,
      }))
    );

    // Check arm collision
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

    // Spawn orbs
    if (gameTime.current - lastOrbSpawn.current > ORB_SPAWN_INTERVAL / (1 + snap.level * 0.1)) {
      lastOrbSpawn.current = gameTime.current;
      
      // Find safe angle (away from arms)
      let safeAngle = Math.random() * Math.PI * 2;
      let attempts = 0;
      while (attempts < 10) {
        let isSafe = true;
        for (const arm of arms) {
          const armAngle = ((arm.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
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

    // Update orbs - collect and expire
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
          // Collected!
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

          // Level up
          if (levelOrbCount.current >= LEVEL_UP_ORBS) {
            levelOrbCount.current = 0;
            weaveState.level += 1;
            weaveState.score += weaveState.level * 25;
            setArms(generateArms(weaveState.level));
            
            // Bonus life every 3 levels
            if (weaveState.level % 3 === 0 && weaveState.lives < weaveState.maxLives) {
              weaveState.lives += 1;
            }
          }

          continue; // Don't add to updated
        }

        updated.push(orb);
      }
      return updated;
    });

    // Update particles
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

    // Decay combo if not collecting
    // (Combo doesn't decay - resets on hit)
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
        <LaserArmComponent key={arm.id} arm={arm} />
      ))}

      {orbs.map((orb) => (
        <OrbComponent key={orb.id} orb={orb} currentTime={gameTime.current} />
      ))}

      <ParticleEffect particles={particles} />

      <Player
        angle={playerAngle}
        color={currentColor}
        isHit={isHit}
        invincible={snap.invincible}
      />

      {/* Combo display */}
      {snap.combo >= 3 && (
        <Html center position={[0, -2.5, 0]}>
          <div
            className="text-2xl font-bold animate-pulse"
            style={{
              color: snap.combo >= 10 ? '#feca57' : snap.combo >= 5 ? '#00ff88' : '#00ffff',
              textShadow: `0 0 20px currentColor`,
            }}
          >
            {snap.combo}x
          </div>
        </Html>
      )}

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50">
          <div className="bg-black/50 backdrop-blur-sm rounded-xl px-4 py-3 text-white border border-white/10">
            <div className="text-3xl font-light tracking-wider" style={{ color: currentColor }}>
              {snap.score}
            </div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Score</div>

            <div className="mt-3 flex items-center gap-4">
              <div>
                <div className="text-lg font-light">{snap.orbsCollected}</div>
                <div className="text-[10px] text-white/40 uppercase">Orbs</div>
              </div>
              <div>
                <div className="text-lg font-light">Lv.{snap.level}</div>
                <div className="text-[10px] text-white/40 uppercase">Level</div>
              </div>
            </div>

            {/* Level progress */}
            <div className="mt-3">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                Next Level ({levelOrbCount.current}/{LEVEL_UP_ORBS})
              </div>
              <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-200 rounded-full"
                  style={{
                    width: `${levelProgress}%`,
                    backgroundColor: currentColor,
                    boxShadow: `0 0 8px ${currentColor}`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-50">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs border border-white/10">
            <div className="text-white/60">Best: {snap.highScore}</div>
            <div className="text-white/40">Best Combo: {snap.bestCombo}x</div>
          </div>
        </div>

        {/* Lives indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
          {Array.from({ length: snap.maxLives }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full border-2 transition-all duration-200"
              style={{
                borderColor: '#ff3366',
                backgroundColor: i < snap.lives ? '#ff3366' : 'transparent',
                boxShadow: i < snap.lives ? '0 0 10px #ff3366' : 'none',
              }}
            />
          ))}
        </div>

        {/* Controls hint */}
        <div className="absolute bottom-4 left-4 text-white/40 text-xs">
          <div className="flex items-center gap-3">
            <span>A/D or Mouse to orbit</span>
            <span className="text-white/20">|</span>
            <span>Collect orbs, dodge lasers</span>
          </div>
        </div>

        {/* Start screen */}
        {!gameStarted && !snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
            <div className="text-center max-w-md px-8">
              <h1
                className="text-6xl font-thin tracking-[0.3em] mb-6"
                style={{ color: currentColor, textShadow: `0 0 40px ${currentColor}` }}
              >
                WEAVE
              </h1>
              <p className="text-white/60 text-sm leading-relaxed mb-4">
                Orbit the center and collect glowing orbs.<br />
                Dodge the sweeping laser arms.<br />
                Build combos. Survive. Level up.
              </p>
              <div className="flex justify-center gap-6 text-xs text-white/40 mb-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ORB_COLOR }} />
                  <span>Orb (+10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BONUS_ORB_COLOR }} />
                  <span>Bonus (+50)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: ARM_COLOR }} />
                  <span>Danger!</span>
                </div>
              </div>
              <p className="text-white/40 text-xs animate-pulse">Click or press A/D to begin</p>
            </div>
          </div>
        )}

        {/* Game over screen */}
        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="text-center">
              <h1 className="text-5xl font-thin tracking-widest mb-6" style={{ color: '#ff3366' }}>
                GAME OVER
              </h1>
              <p className="text-4xl text-white/80 mb-2 font-light">{snap.score}</p>
              <div className="text-white/50 text-sm space-y-1 mb-6">
                <p>Orbs Collected: {snap.orbsCollected}</p>
                <p>Level Reached: {snap.level}</p>
                <p>Best Combo: {snap.bestCombo}x</p>
                {snap.score >= snap.highScore && snap.score > 0 && (
                  <p className="text-yellow-400 mt-2">New High Score!</p>
                )}
              </div>
              <p className="text-white/40 text-xs animate-pulse">Click or Press R to play again</p>
            </div>
          </div>
        )}
      </Html>
    </>
  );
};

export default Weave;
