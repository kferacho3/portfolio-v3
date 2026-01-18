// src/app/fun/games/GravityRush.tsx
// Inspired by "r3f-gravity-ball" - A simple React Three Fiber physics game
// Enhanced with infinite worlds, multiple themes, power-ups, and endless gameplay
// for Racho's Arcade
'use client';

import { Html, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORM_WIDTH = 2.5; // Width of platforms
const PLATFORM_LENGTH = 3; // Length of each segment
const CHUNK_SIZE = 80;
const PLATFORMS_PER_CHUNK = 20;
const RENDER_DISTANCE = 2; // chunks ahead/behind to render
const BALL_RADIUS = 0.4;
const GRAVITY = -35;
const MOVE_FORCE = 22;
const MAX_VELOCITY = 12;
const JUMP_FORCE = 14;
const GROUND_FRICTION = 0.88;
const AIR_FRICTION = 0.96;

// Theme definitions
const THEMES = {
  neon: {
    name: 'Neon',
    background: '#0a0a1a',
    platform: '#00ffff',
    accent: '#ff00ff',
    ball: '#ffff00',
    crumble: '#ff6600',
    boost: '#00ff00',
    fog: '#1a0a2e',
  },
  ice: {
    name: 'Ice',
    background: '#0a1628',
    platform: '#88ddff',
    accent: '#ffffff',
    ball: '#00aaff',
    crumble: '#ff8866',
    boost: '#aaffaa',
    fog: '#102030',
  },
  lava: {
    name: 'Lava',
    background: '#1a0800',
    platform: '#ff8800',
    accent: '#ff4400',
    ball: '#ffcc00',
    crumble: '#ff0000',
    boost: '#ffff00',
    fog: '#2a0a00',
  },
  void: {
    name: 'Void',
    background: '#000008',
    platform: '#6600ff',
    accent: '#aa00ff',
    ball: '#ffffff',
    crumble: '#ff0066',
    boost: '#00ffaa',
    fog: '#0a0020',
  },
  cyber: {
    name: 'Cyber',
    background: '#001122',
    platform: '#00ffff',
    accent: '#ff0066',
    ball: '#00ff99',
    crumble: '#ff3300',
    boost: '#ffff00',
    fog: '#002244',
  },
  forest: {
    name: 'Forest',
    background: '#0a1a0a',
    platform: '#228822',
    accent: '#00ff66',
    ball: '#ffcc00',
    crumble: '#884400',
    boost: '#66ff66',
    fog: '#0a2a0a',
  },
};

type ThemeKey = keyof typeof THEMES;
const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

// Platform types
type PlatformType = 'static' | 'crumble' | 'moving' | 'boost' | 'start';

interface Platform {
  id: string;
  type: PlatformType;
  x: number;
  y: number;
  z: number;
  width: number; // actual width in units
  length: number; // actual length in units
  rotation?: number; // Y rotation for angled platforms
  moveAxis?: 'x' | 'z';
  moveRange?: number;
  movePhase?: number;
  crumbleTimer?: number;
  touched?: boolean;
}

interface Collectible {
  id: string;
  type: 'coin' | 'gem' | 'powerup';
  x: number;
  y: number;
  z: number;
  collected: boolean;
  powerupType?: 'shield' | 'speed' | 'doublePoints';
}

// ═══════════════════════════════════════════════════════════════════════════
// SEEDED RANDOM - For reproducible procedural generation
// ═══════════════════════════════════════════════════════════════════════════

class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE (Valtio)
// ═══════════════════════════════════════════════════════════════════════════

export const gravityRushState = proxy({
  // Game phase
  phase: 'menu' as 'menu' | 'playing' | 'gameover',
  
  // Stats
  score: 0,
  distance: 0,
  highScore: 0,
  coins: 0,
  
  // Theme
  currentTheme: 'neon' as ThemeKey,
  themeTransition: 0,
  
  // Power-ups
  hasShield: false,
  shieldTimer: 0,
  hasSpeedBoost: false,
  speedBoostTimer: 0,
  hasDoublePoints: false,
  doublePointsTimer: 0,
  
  // Combo system
  comboCount: 0,
  comboMultiplier: 1,
  lastLandTime: 0,
  
  // World seed
  worldSeed: Date.now(),
  
  // Controls state
  controls: { forward: false, back: false, left: false, right: false, jump: false },
  
  reset() {
    this.phase = 'menu';
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.currentTheme = 'neon';
    this.themeTransition = 0;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.hasSpeedBoost = false;
    this.speedBoostTimer = 0;
    this.hasDoublePoints = false;
    this.doublePointsTimer = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.lastLandTime = 0;
    this.worldSeed = Date.now();
    this.controls = { forward: false, back: false, left: false, right: false, jump: false };
    mutation.playerPos = [0, 2, 0];
    mutation.playerVel = [0, 0, 0];
    mutation.isGrounded = false;
    mutation.currentChunk = 0;
    mutation.chunks.clear();
    mutation.collectibles.clear();
  },
  
  startGame() {
    this.phase = 'playing';
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.worldSeed = Date.now();
    mutation.playerPos = [0, 2, 0];
    mutation.playerVel = [0, 0, 0];
    mutation.isGrounded = false;
    mutation.currentChunk = 0;
    mutation.chunks.clear();
    mutation.collectibles.clear();
  },
  
  endGame() {
    this.phase = 'gameover';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('gravityrush-highscore', String(this.score));
      } catch (e) { /* ignore */ }
    }
  },
  
  loadHighScore() {
    try {
      const saved = localStorage.getItem('gravityrush-highscore');
      if (saved) this.highScore = parseInt(saved, 10);
    } catch (e) { /* ignore */ }
  },
  
  addCombo() {
    const now = Date.now();
    if (now - this.lastLandTime < 2000) {
      this.comboCount++;
      this.comboMultiplier = Math.min(1 + this.comboCount * 0.2, 5);
    } else {
      this.comboCount = 1;
      this.comboMultiplier = 1;
    }
    this.lastLandTime = now;
  },
  
  collectCoin(value: number) {
    const multiplier = this.hasDoublePoints ? 2 : 1;
    this.score += Math.floor(value * this.comboMultiplier * multiplier);
    this.coins++;
  },
  
  activatePowerup(type: 'shield' | 'speed' | 'doublePoints') {
    if (type === 'shield') {
      this.hasShield = true;
      this.shieldTimer = 10;
    } else if (type === 'speed') {
      this.hasSpeedBoost = true;
      this.speedBoostTimer = 5;
    } else if (type === 'doublePoints') {
      this.hasDoublePoints = true;
      this.doublePointsTimer = 15;
    }
  },
});

// Fast mutation object for per-frame updates
const mutation = {
  playerPos: [0, 2, 0] as [number, number, number],
  playerVel: [0, 0, 0] as [number, number, number],
  isGrounded: false,
  currentChunk: 0,
  chunks: new Map<number, Platform[]>(),
  collectibles: new Map<string, Collectible>(),
};

// ═══════════════════════════════════════════════════════════════════════════
// CHUNK GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateChunk(chunkIndex: number, seed: number): Platform[] {
  const rng = new SeededRandom(seed + chunkIndex * 1000);
  const platforms: Platform[] = [];
  const difficulty = Math.min(chunkIndex * 0.1, 3); // Slower difficulty scaling
  
  // Start platform for chunk 0 - larger safe area
  if (chunkIndex === 0) {
    platforms.push({
      id: `${chunkIndex}-start`,
      type: 'start',
      x: 0,
      y: 0,
      z: 0,
      width: 4,
      length: 4,
    });
  }
  
  // Track path state
  let lastX = chunkIndex === 0 ? 0 : rng.range(-5, 5);
  let lastZ = chunkIndex === 0 ? 4 : chunkIndex * CHUNK_SIZE;
  let lastY = 0;
  
  for (let i = 0; i < PLATFORMS_PER_CHUNK; i++) {
    // Determine if this is a gap or connected segment
    const hasGap = rng.next() < (0.15 + difficulty * 0.08);
    const gapSize = hasGap ? rng.range(2, 4 + difficulty * 0.5) : 0;
    
    // Z position - platforms connect or have small gaps
    const z = lastZ + PLATFORM_LENGTH + gapSize;
    
    // X position - path curves gradually
    const turnChance = rng.next();
    let xDrift = 0;
    if (turnChance < 0.3) {
      xDrift = rng.range(-2, -0.5); // Turn left
    } else if (turnChance > 0.7) {
      xDrift = rng.range(0.5, 2); // Turn right
    }
    const x = Math.max(-10, Math.min(10, lastX + xDrift));
    
    // Y position - slight height variations
    const yChange = rng.next() < 0.2 ? rng.range(-0.5, 0.5) : 0;
    const y = Math.max(-2, Math.min(3, lastY + yChange));
    
    // Select platform type based on difficulty
    let type: PlatformType = 'static';
    const typeRoll = rng.next();
    
    if (typeRoll < 0.08 + difficulty * 0.02) {
      type = 'boost';
    } else if (typeRoll < 0.18 + difficulty * 0.04) {
      type = 'moving';
    } else if (typeRoll < 0.30 + difficulty * 0.06) {
      type = 'crumble';
    }
    
    // Platform dimensions - width narrows with difficulty
    const baseWidth = Math.max(1.8, PLATFORM_WIDTH - difficulty * 0.15);
    const width = rng.range(baseWidth * 0.9, baseWidth * 1.1);
    const length = PLATFORM_LENGTH;
    
    const platform: Platform = {
      id: `${chunkIndex}-${i}`,
      type,
      x,
      y,
      z,
      width,
      length,
    };
    
    if (type === 'moving') {
      platform.moveAxis = rng.next() > 0.6 ? 'x' : 'z';
      platform.moveRange = rng.range(1.5, 3);
      platform.movePhase = rng.range(0, Math.PI * 2);
    }
    
    platforms.push(platform);
    lastX = x;
    lastZ = z;
    lastY = y;
  }
  
  return platforms;
}

function generateCollectibles(chunkIndex: number, seed: number, platforms: Platform[]): Collectible[] {
  const rng = new SeededRandom(seed + chunkIndex * 2000);
  const collectibles: Collectible[] = [];
  
  platforms.forEach((platform, i) => {
    if (platform.type === 'start') return;
    
    // Coins on some platforms
    if (rng.next() > 0.4) {
      collectibles.push({
        id: `coin-${chunkIndex}-${i}`,
        type: 'coin',
        x: platform.x,
        y: platform.y + 1.5,
        z: platform.z,
        collected: false,
      });
    }
    
    // Rare gems
    if (rng.next() > 0.92) {
      collectibles.push({
        id: `gem-${chunkIndex}-${i}`,
        type: 'gem',
        x: platform.x + rng.range(-1, 1),
        y: platform.y + 2,
        z: platform.z + rng.range(-1, 1),
        collected: false,
      });
    }
    
    // Very rare power-ups
    if (rng.next() > 0.97) {
      const powerupTypes: Array<'shield' | 'speed' | 'doublePoints'> = ['shield', 'speed', 'doublePoints'];
      collectibles.push({
        id: `powerup-${chunkIndex}-${i}`,
        type: 'powerup',
        x: platform.x,
        y: platform.y + 2.5,
        z: platform.z,
        collected: false,
        powerupType: rng.choice(powerupTypes),
      });
    }
  });
  
  return collectibles;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PlayerProps {
  theme: typeof THEMES.neon;
  onChunkUpdate: (chunk: number) => void;
}

const Player: React.FC<PlayerProps> = ({ theme, onChunkUpdate }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const lastChunkRef = useRef(0);
  
  // Set initial camera position
  useEffect(() => {
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 0, -8);
  }, [camera]);
  
  useFrame((state, delta) => {
    if (!meshRef.current || gravityRushState.phase !== 'playing') return;
    
    const dt = Math.min(delta, 0.05); // Cap delta time
    const [px, py, pz] = mutation.playerPos;
    let [vx, vy, vz] = mutation.playerVel;
    
    // Get controls
    const { forward, back, left, right, jump } = gravityRushState.controls;
    const speedMult = gravityRushState.hasSpeedBoost ? 1.5 : 1;
    
    // Apply movement forces
    const force = MOVE_FORCE * speedMult;
    if (forward) vz -= force * dt;
    if (back) vz += force * dt;
    if (left) vx -= force * dt;
    if (right) vx += force * dt;
    
    // Apply gravity
    vy += GRAVITY * dt;
    
    // Jump if grounded
    if (jump && mutation.isGrounded) {
      vy = JUMP_FORCE;
      mutation.isGrounded = false;
      gravityRushState.controls.jump = false;
    }
    
    // Clamp velocity
    vx = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, vx));
    vz = Math.max(-MAX_VELOCITY * speedMult, Math.min(MAX_VELOCITY * speedMult, vz));
    
    // Apply friction
    const friction = mutation.isGrounded ? GROUND_FRICTION : AIR_FRICTION;
    vx *= friction;
    vz *= friction;
    
    // Update position
    let newX = px + vx * dt;
    let newY = py + vy * dt;
    let newZ = pz + vz * dt;
    
    // Platform collision detection
    mutation.isGrounded = false;
    const currentChunk = Math.max(0, Math.floor(-newZ / CHUNK_SIZE));
    
    // Notify parent of chunk change for world updates
    if (currentChunk !== lastChunkRef.current) {
      lastChunkRef.current = currentChunk;
      onChunkUpdate(currentChunk);
    }
    
    for (let ci = Math.max(0, currentChunk - 1); ci <= currentChunk + 1; ci++) {
      const platforms = mutation.chunks.get(ci);
      if (!platforms) continue;
      
      for (const platform of platforms) {
        // Calculate platform position (with movement if applicable)
        let platX = platform.x;
        let platZ = platform.z;
        let platY = platform.y;
        
        if (platform.type === 'moving' && platform.moveAxis) {
          const moveRange = platform.moveRange || 2;
          const moveAmount = Math.sin((state.clock.elapsedTime * 1.5) + (platform.movePhase || 0)) * moveRange;
          if (platform.moveAxis === 'x') {
            platX += moveAmount;
          } else {
            platZ += moveAmount;
          }
        }
        
        // Handle crumbling platforms y position
        if (platform.type === 'crumble' && platform.crumbleTimer !== undefined && platform.crumbleTimer < 0.6) {
          platY = platform.y - (0.6 - platform.crumbleTimer) * 15;
        }
        
        const halfW = platform.width / 2;
        const halfL = platform.length / 2;
        const platTop = platY + 0.2; // Half of platform height
        
        // Check if ball is above platform
        if (newX > platX - halfW - BALL_RADIUS &&
            newX < platX + halfW + BALL_RADIUS &&
            newZ > -platZ - halfL - BALL_RADIUS &&
            newZ < -platZ + halfL + BALL_RADIUS) {
          
          // Landing on top
          if (newY - BALL_RADIUS <= platTop && newY - BALL_RADIUS > platTop - 1.5 && vy < 0) {
            newY = platTop + BALL_RADIUS;
            vy = 0;
            mutation.isGrounded = true;
            
            // Handle platform type effects
            if (platform.type === 'boost') {
              vz = -MAX_VELOCITY * 1.3;
              vy = JUMP_FORCE * 0.8;
              mutation.isGrounded = false;
            } else if (platform.type === 'crumble' && !platform.touched) {
              platform.touched = true;
              platform.crumbleTimer = 0.8; // Less time to react
            }
            
            // Combo for landing
            gravityRushState.addCombo();
          }
        }
        
        // Handle crumbling platforms
        if (platform.type === 'crumble' && platform.crumbleTimer !== undefined) {
          platform.crumbleTimer -= dt;
          if (platform.crumbleTimer <= -1) {
            platform.y -= 100; // Drop out of sight
          }
        }
      }
    }
    
    // Check collectibles
    for (const [, collectible] of mutation.collectibles) {
      if (collectible.collected) continue;
      
      const dist = Math.sqrt(
        (newX - collectible.x) ** 2 +
        (newY - collectible.y) ** 2 +
        (newZ - (-collectible.z)) ** 2
      );
      
      if (dist < BALL_RADIUS + 0.5) {
        collectible.collected = true;
        
        if (collectible.type === 'coin') {
          gravityRushState.collectCoin(10);
        } else if (collectible.type === 'gem') {
          gravityRushState.collectCoin(50);
        } else if (collectible.type === 'powerup' && collectible.powerupType) {
          gravityRushState.activatePowerup(collectible.powerupType);
        }
      }
    }
    
    // Death check - more punishing
    if (newY < -8) {
      if (gravityRushState.hasShield) {
        gravityRushState.hasShield = false;
        gravityRushState.shieldTimer = 0;
        // Respawn slightly above last position
        newY = 3;
        vy = 0;
        vx = 0;
        vz = 0;
      } else {
        gravityRushState.endGame();
        return;
      }
    }
    
    // Update state
    mutation.playerPos = [newX, newY, newZ];
    mutation.playerVel = [vx, vy, vz];
    mutation.currentChunk = currentChunk;
    
    // Update distance/score
    const distance = Math.max(0, -newZ);
    gravityRushState.distance = Math.floor(distance);
    gravityRushState.score = Math.floor(distance * gravityRushState.comboMultiplier) + gravityRushState.coins * 10;
    
    // Theme transitions every 200 units
    const themeIndex = Math.floor(distance / 200) % THEME_KEYS.length;
    if (THEME_KEYS[themeIndex] !== gravityRushState.currentTheme) {
      gravityRushState.currentTheme = THEME_KEYS[themeIndex];
    }
    
    // Update mesh
    meshRef.current.position.set(newX, newY, newZ);
    meshRef.current.rotation.x -= vz * dt * 2;
    meshRef.current.rotation.z += vx * dt * 2;
    
    // Camera follow - slightly higher and further back for better view
    camera.position.lerp(
      new THREE.Vector3(newX * 0.5, newY + 5, newZ + 10),
      dt * 4
    );
    camera.lookAt(newX * 0.3, newY - 1, newZ - 8);
    
    // Trail effect
    if (trailRef.current) {
      trailRef.current.position.set(newX, newY, newZ + 1);
      const speed = Math.sqrt(vx * vx + vz * vz);
      trailRef.current.scale.z = Math.min(speed * 0.3, 3);
      (trailRef.current.material as THREE.MeshBasicMaterial).opacity = Math.min(speed * 0.05, 0.5);
    }
    
    // Shield effect
    if (shieldRef.current) {
      shieldRef.current.position.copy(meshRef.current.position);
      shieldRef.current.visible = gravityRushState.hasShield;
      shieldRef.current.rotation.y += dt * 2;
    }
    
    // Update power-up timers
    if (gravityRushState.shieldTimer > 0) {
      gravityRushState.shieldTimer -= dt;
      if (gravityRushState.shieldTimer <= 0) gravityRushState.hasShield = false;
    }
    if (gravityRushState.speedBoostTimer > 0) {
      gravityRushState.speedBoostTimer -= dt;
      if (gravityRushState.speedBoostTimer <= 0) gravityRushState.hasSpeedBoost = false;
    }
    if (gravityRushState.doublePointsTimer > 0) {
      gravityRushState.doublePointsTimer -= dt;
      if (gravityRushState.doublePointsTimer <= 0) gravityRushState.hasDoublePoints = false;
    }
  });
  
  return (
    <>
      <mesh ref={meshRef} position={[0, 2, 0]} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
        <meshStandardMaterial
          color={theme.ball}
          emissive={theme.ball}
          emissiveIntensity={0.4}
          metalness={0.6}
          roughness={0.2}
        />
        <pointLight color={theme.ball} intensity={0.8} distance={4} />
      </mesh>
      
      {/* Trail */}
      <mesh ref={trailRef} position={[0, 2, 1]}>
        <boxGeometry args={[0.2, 0.2, 1.5]} />
        <meshBasicMaterial color={theme.ball} transparent opacity={0.4} />
      </mesh>
      
      {/* Shield */}
      <mesh ref={shieldRef} visible={false}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.3} wireframe />
      </mesh>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const PlatformMesh: React.FC<{ platform: Platform; theme: typeof THEMES.neon }> = ({ platform, theme }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.LineSegments>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    let x = platform.x;
    let z = -platform.z;
    let y = platform.y;
    
    // Moving platforms
    if (platform.type === 'moving' && platform.moveAxis) {
      const moveRange = platform.moveRange || 2;
      const moveAmount = Math.sin((state.clock.elapsedTime * 1.5) + (platform.movePhase || 0)) * moveRange;
      if (platform.moveAxis === 'x') {
        x += moveAmount;
      } else {
        z -= moveAmount;
      }
    }
    
    // Crumbling animation
    if (platform.type === 'crumble' && platform.crumbleTimer !== undefined && platform.crumbleTimer < 0.6) {
      y = platform.y - (0.6 - platform.crumbleTimer) * 15;
      meshRef.current.rotation.x = (0.6 - platform.crumbleTimer) * 0.4;
      meshRef.current.rotation.z = (0.6 - platform.crumbleTimer) * 0.2;
    }
    
    meshRef.current.position.set(x, y, z);
    if (edgeRef.current) {
      edgeRef.current.position.set(x, y, z);
      edgeRef.current.rotation.copy(meshRef.current.rotation);
    }
  });
  
  // Determine color based on type
  let color = theme.platform;
  let emissive = theme.platform;
  let emissiveIntensity = 0.15;
  
  if (platform.type === 'start') {
    color = '#3B99FC';
    emissive = '#3B99FC';
    emissiveIntensity = 0.4;
  } else if (platform.type === 'crumble') {
    color = theme.crumble;
    emissive = theme.crumble;
    emissiveIntensity = platform.touched ? 0.6 : 0.25;
  } else if (platform.type === 'moving') {
    color = theme.accent;
    emissive = theme.accent;
    emissiveIntensity = 0.35;
  } else if (platform.type === 'boost') {
    color = theme.boost;
    emissive = theme.boost;
    emissiveIntensity = 0.5;
  }
  
  const platformHeight = 0.4;
  
  return (
    <group>
      <mesh
        ref={meshRef}
        position={[platform.x, platform.y, -platform.z]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[platform.width, platformHeight, platform.length]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
      {/* Glowing edge outline */}
      <lineSegments ref={edgeRef} position={[platform.x, platform.y, -platform.z]}>
        <edgesGeometry args={[new THREE.BoxGeometry(platform.width, platformHeight, platform.length)]} />
        <lineBasicMaterial color={emissive} transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTIBLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const CollectibleMesh: React.FC<{ collectible: Collectible; theme: typeof THEMES.neon }> = ({ collectible, theme }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!meshRef.current || collectible.collected) return;
    
    // Bobbing animation
    const bob = Math.sin(state.clock.elapsedTime * 3 + collectible.z * 0.1) * 0.2;
    meshRef.current.position.y = collectible.y + bob;
    meshRef.current.rotation.y += 0.02;
  });
  
  if (collectible.collected) return null;
  
  let color = '#ffcc00';
  let size = 0.3;
  
  if (collectible.type === 'gem') {
    color = '#ff00ff';
    size = 0.4;
  } else if (collectible.type === 'powerup') {
    color = collectible.powerupType === 'shield' ? '#00ff88' :
            collectible.powerupType === 'speed' ? '#ff8800' : '#ffff00';
    size = 0.5;
  }
  
  return (
    <mesh
      ref={meshRef}
      position={[collectible.x, collectible.y, -collectible.z]}
    >
      {collectible.type === 'coin' ? (
        <cylinderGeometry args={[size, size, 0.1, 16]} />
      ) : collectible.type === 'gem' ? (
        <octahedronGeometry args={[size]} />
      ) : (
        <dodecahedronGeometry args={[size]} />
      )}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        metalness={0.8}
        roughness={0.2}
      />
      <pointLight color={color} intensity={0.5} distance={3} />
    </mesh>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// WORLD COMPONENT - Manages chunk loading/unloading
// ═══════════════════════════════════════════════════════════════════════════

interface WorldProps {
  theme: typeof THEMES.neon;
  currentChunk: number;
  seed: number;
}

const World: React.FC<WorldProps> = ({ theme, currentChunk, seed }) => {
  const [renderedChunks, setRenderedChunks] = useState<Array<{
    index: number;
    platforms: Platform[];
    collectibles: Collectible[];
  }>>([]);
  
  // Generate chunks when currentChunk or seed changes
  useEffect(() => {
    const chunks: Array<{ index: number; platforms: Platform[]; collectibles: Collectible[] }> = [];
    
    for (let i = Math.max(0, currentChunk - 1); i <= currentChunk + RENDER_DISTANCE; i++) {
      if (!mutation.chunks.has(i)) {
        const platforms = generateChunk(i, seed);
        mutation.chunks.set(i, platforms);
        
        const collectibles = generateCollectibles(i, seed, platforms);
        collectibles.forEach(c => mutation.collectibles.set(c.id, c));
      }
      
      const platforms = mutation.chunks.get(i) || [];
      const collectibles = Array.from(mutation.collectibles.values())
        .filter(c => Math.floor(c.z / CHUNK_SIZE) === i && !c.collected);
      
      chunks.push({ index: i, platforms, collectibles });
    }
    
    setRenderedChunks(chunks);
  }, [currentChunk, seed]);
  
  return (
    <>
      {renderedChunks.map(({ index, platforms, collectibles }) => (
        <React.Fragment key={index}>
          {platforms.map(platform => (
            <PlatformMesh key={platform.id} platform={platform} theme={theme} />
          ))}
          {collectibles.map(collectible => (
            <CollectibleMesh key={collectible.id} collectible={collectible} theme={theme} />
          ))}
        </React.Fragment>
      ))}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Environment: React.FC<{ theme: typeof THEMES.neon }> = ({ theme }) => {
  return (
    <>
      <Stars
        radius={200}
        depth={100}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />
      <fog attach="fog" args={[theme.fog, 30, 150]} />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARD CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

const KeyboardControls: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        gravityRushState.controls.forward = true;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        gravityRushState.controls.back = true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        gravityRushState.controls.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        gravityRushState.controls.right = true;
      }
      if (e.key === ' ') {
        if (gravityRushState.phase === 'menu' || gravityRushState.phase === 'gameover') {
          gravityRushState.reset();
          gravityRushState.startGame();
        } else {
          gravityRushState.controls.jump = true;
        }
        e.preventDefault();
      }
      if (e.key === 'r' || e.key === 'R') {
        gravityRushState.reset();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        gravityRushState.controls.forward = false;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        gravityRushState.controls.back = false;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        gravityRushState.controls.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        gravityRushState.controls.right = false;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const GameUI: React.FC = () => {
  const snap = useSnapshot(gravityRushState);
  const theme = THEMES[snap.currentTheme];
  
  useEffect(() => {
    gravityRushState.loadHighScore();
  }, []);
  
  // Menu Screen
  if (snap.phase === 'menu') {
    return (
      <Html fullscreen>
        <div 
          className="fixed inset-0 flex flex-col items-center justify-center"
          style={{ 
            background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.fog} 100%)`,
            fontFamily: '"Geist", system-ui, sans-serif',
          }}
        >
          <h1 
            className="text-6xl md:text-8xl font-bold mb-4 tracking-wider"
            style={{
              background: `linear-gradient(135deg, ${theme.platform}, ${theme.accent})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textShadow: `0 0 60px ${theme.accent}50`,
            }}
          >
            GRAVITY RUSH
          </h1>
          
          <p className="text-white/50 text-sm mb-8">
            Inspired by "r3f-gravity-ball"
          </p>
          
          {snap.highScore > 0 && (
            <p style={{ color: theme.accent }} className="text-lg mb-6">
              High Score: {snap.highScore.toLocaleString()}
            </p>
          )}
          
          <button
            onClick={() => {
              gravityRushState.reset();
              gravityRushState.startGame();
            }}
            className="px-12 py-4 text-2xl font-bold rounded-xl transition-all duration-300 hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${theme.platform}, ${theme.accent})`,
              color: theme.background,
              boxShadow: `0 0 40px ${theme.accent}60`,
            }}
          >
            START
          </button>
          
          <div className="mt-8 text-white/40 text-sm text-center">
            <p>WASD / Arrow Keys to move</p>
            <p>Space to jump • R to restart</p>
          </div>
          
          {/* Mobile touch hint */}
          <div className="absolute bottom-6 left-0 right-0 text-center text-white/30 text-xs">
            Touch controls on mobile
          </div>
        </div>
      </Html>
    );
  }
  
  // Game Over Screen
  if (snap.phase === 'gameover') {
    return (
      <Html fullscreen>
        <div 
          className="fixed inset-0 flex flex-col items-center justify-center"
          style={{ 
            background: 'rgba(0, 0, 0, 0.9)',
            fontFamily: '"Geist", system-ui, sans-serif',
          }}
        >
          <h1 
            className="text-5xl md:text-7xl font-bold mb-4"
            style={{ color: theme.crumble, textShadow: `0 0 40px ${theme.crumble}80` }}
          >
            GAME OVER
          </h1>
          
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="text-white/60 text-lg">Score</div>
            <div className="text-5xl font-bold text-white">
              {snap.score.toLocaleString()}
            </div>
            
            <div className="text-white/40 text-sm">
              Distance: {snap.distance}m • Coins: {snap.coins}
            </div>
            
            {snap.score >= snap.highScore && snap.score > 0 && (
              <div style={{ color: theme.boost }} className="text-sm animate-pulse">
                NEW HIGH SCORE!
              </div>
            )}
          </div>
          
          <button
            onClick={() => {
              gravityRushState.reset();
              gravityRushState.startGame();
            }}
            className="px-10 py-3 text-xl font-bold rounded-xl transition-all duration-300 hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${theme.platform}, ${theme.accent})`,
              color: theme.background,
              boxShadow: `0 0 30px ${theme.accent}50`,
            }}
          >
            PLAY AGAIN
          </button>
          
          <button
            onClick={() => gravityRushState.reset()}
            className="mt-4 text-white/40 hover:text-white/60 transition-colors"
          >
            Back to Menu
          </button>
        </div>
      </Html>
    );
  }
  
  // In-Game HUD
  return (
    <Html fullscreen>
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{ fontFamily: '"Geist Mono", monospace' }}
      >
        {/* Score & Distance */}
        <div className="absolute top-6 left-6">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Score</div>
          <div className="text-3xl font-bold text-white">{snap.score.toLocaleString()}</div>
          <div style={{ color: theme.accent }} className="text-sm mt-2">
            {snap.distance}m
          </div>
          {snap.comboMultiplier > 1 && (
            <div style={{ color: theme.boost }} className="text-sm">
              x{snap.comboMultiplier.toFixed(1)} combo
            </div>
          )}
        </div>
        
        {/* Theme indicator */}
        <div className="absolute top-6 right-6 text-right">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-1">World</div>
          <div className="text-lg font-bold" style={{ color: theme.platform }}>
            {THEMES[snap.currentTheme].name}
          </div>
        </div>
        
        {/* Active power-ups */}
        <div className="absolute top-20 right-6 flex flex-col gap-2">
          {snap.hasShield && (
            <div className="px-3 py-1 rounded-full text-xs" style={{ background: '#00ff8840', color: '#00ff88' }}>
              Shield {Math.ceil(snap.shieldTimer)}s
            </div>
          )}
          {snap.hasSpeedBoost && (
            <div className="px-3 py-1 rounded-full text-xs" style={{ background: '#ff880040', color: '#ff8800' }}>
              Speed {Math.ceil(snap.speedBoostTimer)}s
            </div>
          )}
          {snap.hasDoublePoints && (
            <div className="px-3 py-1 rounded-full text-xs" style={{ background: '#ffff0040', color: '#ffff00' }}>
              2x Points {Math.ceil(snap.doublePointsTimer)}s
            </div>
          )}
        </div>
        
        {/* Mobile touch controls */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 flex pointer-events-auto md:hidden">
          <div 
            className="flex-1 flex"
            onTouchStart={() => gravityRushState.controls.left = true}
            onTouchEnd={() => gravityRushState.controls.left = false}
          >
            <div className="m-auto text-white/20 text-4xl">◀</div>
          </div>
          <div 
            className="flex-1 flex"
            onTouchStart={() => {
              gravityRushState.controls.forward = true;
              gravityRushState.controls.jump = true;
            }}
            onTouchEnd={() => {
              gravityRushState.controls.forward = false;
            }}
          >
            <div className="m-auto text-white/20 text-4xl">▲</div>
          </div>
          <div 
            className="flex-1 flex"
            onTouchStart={() => gravityRushState.controls.right = true}
            onTouchEnd={() => gravityRushState.controls.right = false}
          >
            <div className="m-auto text-white/20 text-4xl">▶</div>
          </div>
        </div>
      </div>
    </Html>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA SETUP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const CameraSetup: React.FC = () => {
  const { camera } = useThree();
  
  useEffect(() => {
    // Set initial camera position for menu view
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, -5);
  }, [camera]);
  
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface GravityRushProps {
  soundsOn?: boolean;
}

const GravityRush: React.FC<GravityRushProps> = ({ soundsOn = true }) => {
  const snap = useSnapshot(gravityRushState);
  const theme = THEMES[snap.currentTheme];
  const [currentChunk, setCurrentChunk] = useState(0);
  
  // Handle chunk updates from player
  const handleChunkUpdate = useCallback((chunk: number) => {
    setCurrentChunk(chunk);
  }, []);
  
  // Reset chunk state when game restarts
  useEffect(() => {
    if (snap.phase === 'menu') {
      setCurrentChunk(0);
    }
  }, [snap.phase]);
  
  // Reset on unmount
  useEffect(() => {
    return () => {
      gravityRushState.reset();
    };
  }, []);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.2}
        color={theme.accent}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 10, -50]} intensity={0.8} color={theme.platform} />
      <hemisphereLight args={[theme.platform, theme.fog, 0.3]} />
      
      {/* Camera Setup */}
      <CameraSetup />
      
      {/* Environment */}
      <Environment theme={theme} />
      
      {/* Game Components */}
      <World theme={theme} currentChunk={currentChunk} seed={snap.worldSeed} />
      {snap.phase === 'playing' && (
        <Player theme={theme} onChunkUpdate={handleChunkUpdate} />
      )}
      
      {/* Controls */}
      <KeyboardControls />
      
      {/* UI */}
      <GameUI />
    </>
  );
};

export default GravityRush;
