// src/app/fun/games/Apex.tsx
// Premium endless path-runner inspired by ZigZag
// Features multiple unique game modes with stunning visuals and addictive gameplay
// Created for Racho's Arcade
'use client';

import { Html, OrthographicCamera, Trail } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS (Matching original ZigZag for core gameplay)
// ═══════════════════════════════════════════════════════════════════════════

// Matching original ZigZag constants exactly
const TILE_SIZE = 1.35;
const TILE_DEPTH = 4; // TALL PILLARS like original ZigZag!
const SPHERE_RADIUS = 0.26;
const MAX_TILES = 300;

// Platform dimensions
const PLATFORM_WIDTH = 8;
const PLATFORM_LENGTH = 8;
const PLATFORM_TILE_COUNT = PLATFORM_WIDTH * PLATFORM_LENGTH;

// Path generation
const LOOKAHEAD_DISTANCE = 40;
const MAX_DIVERGENCE = 3; // Match original

// Tile falling
const FALL_DELAY = 0.75;
const REMOVAL_Y = -40;
const GRAVITY = 16; // Match original

// Speed settings (match original)
const INITIAL_SPEED = 5.75;
const SPEED_INCREMENT = 0.012;
const SPEED_LIMIT = 10;

// Gem settings (match original)
const GEM_RADIUS = 0.35;
const GEM_HEIGHT = GEM_RADIUS * 1.5;
const GEM_SPAWN_CHANCE = 0.2;
const GEM_HEIGHT_OFFSET = TILE_DEPTH / 2 + GEM_HEIGHT; // Place on top of tile

// Power-up settings
const POWERUP_SPAWN_CHANCE = 0.05;
const POWERUP_DURATION = 5;

// Camera settings (matching original ZigZag isometric view)
const CAMERA_OFFSET_X = 19.05;
const CAMERA_OFFSET_Y = 12;
const CAMERA_OFFSET_Z = 15;
const CAMERA_ZOOM_MOBILE = 40;
const CAMERA_ZOOM_DESKTOP = 72;
const CAMERA_FAR = 60;
const PATH_EDGE_COLOR = '#0b0414';

// ═══════════════════════════════════════════════════════════════════════════
// UI OVERLAY (DOM via drei <Html>, safe in R3F)
// ═══════════════════════════════════════════════════════════════════════════

const FullscreenOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Html fullscreen portal={document.body} zIndexRange={[1000, 0]} style={{ width: '100%', height: '100%' }}>
      {children}
    </Html>
  );
};

const ApexCamera: React.FC = () => {
  const { size } = useThree();
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  const zoom = size.width < 768 ? CAMERA_ZOOM_MOBILE : CAMERA_ZOOM_DESKTOP;

  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.zoom = zoom;
    cameraRef.current.far = CAMERA_FAR;
    cameraRef.current.updateProjectionMatrix();
  }, [zoom]);

  return (
    <OrthographicCamera
      makeDefault
      ref={cameraRef}
      zoom={zoom}
      near={0.1}
      far={CAMERA_FAR}
      position={[-CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z]}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// THEME DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const THEMES = {
  neon: {
    name: 'Neon',
    tile: new THREE.Color('#00ffff'),
    tileHex: '#00ffff',
    gem: new THREE.Color('#ff00ff'),
    gemHex: '#ff00ff',
    glow: new THREE.Color('#00ffff'),
    bg: '#0a0a15',
    accent: '#00ffff',
  },
  sunset: {
    name: 'Sunset',
    tile: new THREE.Color('#ff6b6b'),
    tileHex: '#ff6b6b',
    gem: new THREE.Color('#feca57'),
    gemHex: '#feca57',
    glow: new THREE.Color('#ff6b6b'),
    bg: '#1a0a0a',
    accent: '#ff6b6b',
  },
  forest: {
    name: 'Forest',
    tile: new THREE.Color('#00ff88'),
    tileHex: '#00ff88',
    gem: new THREE.Color('#48dbfb'),
    gemHex: '#48dbfb',
    glow: new THREE.Color('#00ff88'),
    bg: '#0a1510',
    accent: '#00ff88',
  },
  galaxy: {
    name: 'Galaxy',
    tile: new THREE.Color('#6c5ce7'),
    tileHex: '#6c5ce7',
    gem: new THREE.Color('#fd79a8'),
    gemHex: '#fd79a8',
    glow: new THREE.Color('#6c5ce7'),
    bg: '#0a0515',
    accent: '#6c5ce7',
  },
  gold: {
    name: 'Gold',
    tile: new THREE.Color('#f39c12'),
    tileHex: '#f39c12',
    gem: new THREE.Color('#e74c3c'),
    gemHex: '#e74c3c',
    glow: new THREE.Color('#f39c12'),
    bg: '#151005',
    accent: '#f39c12',
  },
};

type ThemeKey = keyof typeof THEMES;
const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

type GameMode = 'classic' | 'curved' | 'spiral' | 'gravity' | 'speedrush' | 'zen';
type PowerUpType = 'none' | 'shield' | 'magnet' | 'slowmo';
type TileStatus = 'active' | 'falling' | 'removed';

interface TileData {
  id: number;
  x: number;
  y: number;
  z: number;
  status: TileStatus;
  lastContactTime: number;
  fallVelocity: number;
}

interface GemData {
  id: number;
  x: number;
  y: number;
  z: number;
  tileId: number;
  collected: boolean;
  rotation: number;
}

interface PowerUpData {
  id: number;
  type: Exclude<PowerUpType, 'none'>;
  x: number;
  y: number;
  z: number;
  tileId: number;
  collected: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTIONS (matching original ZigZag)
// ═══════════════════════════════════════════════════════════════════════════

const DIRECTIONS = [
  new THREE.Vector3(0, 0, -1),  // Forward (-Z)
  new THREE.Vector3(1, 0, 0),   // Right (+X)
];

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE (Valtio)
// ═══════════════════════════════════════════════════════════════════════════

export const apexState = proxy({
  phase: 'menu' as 'menu' | 'playing' | 'gameover',
  mode: 'classic' as GameMode,
  score: 0,
  gems: 0,
  level: 1,
  distance: 0,
  bestCombo: 0,
  highScores: {
    classic: 0,
    curved: 0,
    spiral: 0,
    gravity: 0,
    speedrush: 0,
    zen: 0,
  } as Record<GameMode, number>,
  combo: 0,
  comboMultiplier: 1,
  powerUp: 'none' as PowerUpType,
  powerUpTimer: 0,
  currentTheme: 'neon' as ThemeKey,
  difficulty: 'normal' as 'easy' | 'normal' | 'hard',
  
  reset() {
    this.phase = 'menu';
    this.score = 0;
    this.gems = 0;
    this.level = 1;
    this.distance = 0;
    this.combo = 0;
    this.comboMultiplier = 1;
    this.bestCombo = 0;
    this.powerUp = 'none';
    this.powerUpTimer = 0;
    this.currentTheme = 'neon';
    
    // Reset mutation state
    mutation.speed = INITIAL_SPEED;
    mutation.spherePos.set(0, SPHERE_RADIUS, 0);
    mutation.velocity.set(0, 0, 0);
    mutation.directionIndex = 0;
    mutation.currentDirection.copy(DIRECTIONS[0]);
    mutation.targetDirection.copy(DIRECTIONS[0]);
    mutation.isOnPlatform = true;
    mutation.gameOver = false;
    mutation.tiles = [];
    mutation.gems = [];
    mutation.powerUps = [];
    mutation.nextTileId = 0;
    mutation.nextGemId = 0;
    mutation.lastTilePos.set(0, -TILE_DEPTH / 2, 0);
    mutation.divergenceX = 0;
    mutation.divergenceZ = 0;
    mutation.curveT = 0;
    mutation.spiralAngle = 0;
    mutation.spiralRadius = 10;
    mutation.initialized = false;
  },
  
  startGame() {
    this.phase = 'playing';
    this.score = 0;
    this.gems = 0;
    this.level = 1;
    this.distance = 0;
    this.combo = 0;
    this.comboMultiplier = 1;
    this.bestCombo = 0;
    this.powerUp = 'none';
    this.powerUpTimer = 0;
    
    const difficultyMult = this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.3 : 1;
    mutation.speed = INITIAL_SPEED * difficultyMult * (this.mode === 'speedrush' ? 1.5 : 1);
    mutation.gameOver = false;
    mutation.isOnPlatform = true;
    mutation.initialized = false;
  },
  
  endGame() {
    if (this.mode === 'zen') return;
    this.phase = 'gameover';
    mutation.gameOver = true;
    if (this.score > this.highScores[this.mode]) {
      this.highScores[this.mode] = this.score;
      this.saveHighScores();
    }
  },
  
  setMode(mode: GameMode) {
    this.mode = mode;
  },
  
  setDifficulty(d: 'easy' | 'normal' | 'hard') {
    this.difficulty = d;
  },
  
  addScore(points: number) {
    const multiplier = this.comboMultiplier * (this.mode === 'speedrush' ? 2 : 1);
    this.score += Math.floor(points * multiplier);
  },
  
  collectGem() {
    this.gems += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (this.combo >= 10) this.comboMultiplier = 3;
    else if (this.combo >= 5) this.comboMultiplier = 2;
    else if (this.combo >= 2) this.comboMultiplier = 1.5;
    this.addScore(10);
  },
  
  breakCombo() {
    this.combo = 0;
    this.comboMultiplier = 1;
  },
  
  activatePowerUp(type: Exclude<PowerUpType, 'none'>) {
    this.powerUp = type;
    this.powerUpTimer = POWERUP_DURATION;
  },
  
  levelUp() {
    this.level += 1;
    if (this.level % 2 === 0) {
      const currentIndex = THEME_KEYS.indexOf(this.currentTheme);
      this.currentTheme = THEME_KEYS[(currentIndex + 1) % THEME_KEYS.length];
    }
    const difficultyMult = this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.3 : 1;
    mutation.speed = Math.min(mutation.speed + SPEED_INCREMENT * 10 * difficultyMult, SPEED_LIMIT);
  },
  
  loadHighScores() {
    try {
      const saved = localStorage.getItem('apex-highscores');
      if (saved) Object.assign(this.highScores, JSON.parse(saved));
    } catch (e) { /* ignore */ }
  },
  
  saveHighScores() {
    try {
      localStorage.setItem('apex-highscores', JSON.stringify(this.highScores));
    } catch (e) { /* ignore */ }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// MUTATION OBJECT (Non-reactive per-frame updates)
// ═══════════════════════════════════════════════════════════════════════════

const mutation = {
  speed: INITIAL_SPEED,
  spherePos: new THREE.Vector3(0, SPHERE_RADIUS, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  directionIndex: 0,
  currentDirection: new THREE.Vector3(0, 0, -1),
  targetDirection: new THREE.Vector3(0, 0, -1),
  isOnPlatform: true,
  gameOver: false,
  initialized: false,
  
  tiles: [] as TileData[],
  gems: [] as GemData[],
  powerUps: [] as PowerUpData[],
  nextTileId: 0,
  nextGemId: 0,
  
  lastTilePos: new THREE.Vector3(0, -TILE_DEPTH / 2, 0),
  divergenceX: 0,
  divergenceZ: 0,
  
  // Mode-specific
  curveT: 0,
  spiralAngle: 0,
  spiralRadius: 10,
  spiralDirection: 1,
};

// ═══════════════════════════════════════════════════════════════════════════
// PATH GENERATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const generateClassicTile = (): THREE.Vector3 => {
  const lastPos = mutation.lastTilePos.clone();
  let direction: THREE.Vector3;
  
  if (mutation.divergenceX >= MAX_DIVERGENCE) {
    direction = new THREE.Vector3(0, 0, -1);
    mutation.divergenceZ += 1;
    mutation.divergenceX -= 1;
  } else if (mutation.divergenceZ >= MAX_DIVERGENCE) {
    direction = new THREE.Vector3(1, 0, 0);
    mutation.divergenceX += 1;
    mutation.divergenceZ -= 1;
  } else {
    if (Math.random() < 0.5) {
      direction = new THREE.Vector3(0, 0, -1);
      mutation.divergenceZ += 1;
      mutation.divergenceX -= 1;
    } else {
      direction = new THREE.Vector3(1, 0, 0);
      mutation.divergenceX += 1;
      mutation.divergenceZ -= 1;
    }
  }
  
  const nextPos = lastPos.addScaledVector(direction, TILE_SIZE);
  mutation.lastTilePos.copy(nextPos);
  return nextPos.clone();
};

const generateCurvedTile = (): THREE.Vector3 => {
  const lastPos = mutation.lastTilePos.clone();
  mutation.curveT += 0.12;
  const waveX = Math.sin(mutation.curveT) * TILE_SIZE * 0.8;
  
  const nextPos = new THREE.Vector3(
    lastPos.x + waveX * 0.3,
    -TILE_DEPTH / 2,
    lastPos.z - TILE_SIZE
  );
  
  mutation.lastTilePos.copy(nextPos);
  return nextPos;
};

const generateSpiralTile = (): THREE.Vector3 => {
  mutation.spiralAngle += 0.1 * mutation.spiralDirection;
  
  if (mutation.spiralRadius < 5) mutation.spiralDirection = 1;
  else if (mutation.spiralRadius > 15) mutation.spiralDirection = -1;
  mutation.spiralRadius += mutation.spiralDirection * 0.05;
  
  const nextPos = new THREE.Vector3(
    Math.cos(mutation.spiralAngle) * mutation.spiralRadius,
    -TILE_DEPTH / 2,
    Math.sin(mutation.spiralAngle) * mutation.spiralRadius - mutation.nextTileId * 0.3
  );
  
  mutation.lastTilePos.copy(nextPos);
  return nextPos;
};

const generateGravityTile = (): THREE.Vector3 => {
  const lastPos = mutation.lastTilePos.clone();
  let direction: THREE.Vector3;
  const rand = Math.random();
  
  if (rand < 0.45) {
    direction = new THREE.Vector3(0, 0, -1);
  } else if (rand < 0.9) {
    direction = new THREE.Vector3(1, 0, 0);
  } else {
    direction = new THREE.Vector3(0, Math.random() < 0.5 ? 0.3 : -0.3, -1);
  }
  
  const nextPos = lastPos.addScaledVector(direction, TILE_SIZE);
  mutation.lastTilePos.copy(nextPos);
  return nextPos.clone();
};

const generateSpeedRushTile = (): THREE.Vector3 => {
  const lastPos = mutation.lastTilePos.clone();
  let direction: THREE.Vector3;
  
  if (Math.random() < 0.75) {
    direction = new THREE.Vector3(0, 0, -1);
  } else {
    direction = new THREE.Vector3(Math.random() < 0.5 ? 1 : -1, 0, 0);
  }
  
  if (Math.abs(lastPos.x) > MAX_DIVERGENCE * TILE_SIZE) {
    direction = new THREE.Vector3(-Math.sign(lastPos.x), 0, -1).normalize();
  }
  
  const nextPos = lastPos.addScaledVector(direction, TILE_SIZE);
  mutation.lastTilePos.copy(nextPos);
  return nextPos.clone();
};

const generateZenTile = (): THREE.Vector3 => {
  const lastPos = mutation.lastTilePos.clone();
  mutation.curveT += 0.08;
  const gentleWave = Math.sin(mutation.curveT) * 0.25;
  
  const nextPos = new THREE.Vector3(
    lastPos.x + gentleWave,
    -TILE_DEPTH / 2,
    lastPos.z - TILE_SIZE
  );
  
  mutation.lastTilePos.copy(nextPos);
  return nextPos;
};

const generateTileForMode = (mode: GameMode): THREE.Vector3 => {
  switch (mode) {
    case 'classic': return generateClassicTile();
    case 'curved': return generateCurvedTile();
    case 'spiral': return generateSpiralTile();
    case 'gravity': return generateGravityTile();
    case 'speedrush': return generateSpeedRushTile();
    case 'zen': return generateZenTile();
    default: return generateClassicTile();
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SPHERE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Sphere: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const snap = useSnapshot(apexState);
  const rotationRef = useRef(new THREE.Euler());
  
  useFrame((_, delta) => {
    if (!meshRef.current || snap.phase !== 'playing') return;
    if (!mutation.initialized) return;
    
    const mesh = meshRef.current;
    
    // Instant direction change (matching original ZigZag)
    mutation.currentDirection.copy(mutation.targetDirection);
    
    // Move sphere
    if (!mutation.gameOver && mutation.isOnPlatform) {
      const moveDelta = mutation.currentDirection.clone().multiplyScalar(mutation.speed * delta);
      mutation.spherePos.add(moveDelta);
      mutation.velocity.copy(moveDelta.divideScalar(delta));
      
      // Increase speed
      mutation.speed = Math.min(mutation.speed + SPEED_INCREMENT * delta, SPEED_LIMIT);
      
      // Track distance for level ups
      apexState.distance += mutation.speed * delta;
      if (Math.floor(apexState.distance / 200) >= apexState.level) {
        apexState.levelUp();
      }
    }
    
    // Game over when off platform
    if (!mutation.isOnPlatform && !mutation.gameOver) {
      if (snap.mode === 'zen') {
        // Respawn on nearest active tile
        const activeTile = mutation.tiles.find(t => t.status === 'active');
        if (activeTile) {
          mutation.spherePos.set(activeTile.x, SPHERE_RADIUS, activeTile.z);
          mutation.velocity.set(0, 0, 0);
          mutation.isOnPlatform = true;
        }
      } else {
        apexState.endGame();
      }
    }
    
    // Falling animation after game over
    if (mutation.gameOver && mutation.spherePos.y > REMOVAL_Y) {
      mutation.velocity.y -= GRAVITY * delta;
      mutation.spherePos.add(mutation.velocity.clone().multiplyScalar(delta));
    }
    
    // Update mesh position
    mesh.position.copy(mutation.spherePos);
    
    // Rotate ball
    const rotSpeed = (mutation.speed * delta) / SPHERE_RADIUS;
    rotationRef.current.x += mutation.currentDirection.z * rotSpeed;
    rotationRef.current.z -= mutation.currentDirection.x * rotSpeed;
    mesh.rotation.copy(rotationRef.current);
    
    // Camera follow (isometric, matching original ZigZag exactly)
    // Only update camera if sphere hasn't fallen too far
    if (mutation.spherePos.y > REMOVAL_Y) {
      const movementAverage = (mutation.spherePos.x - mutation.spherePos.z) / 2;
      camera.position.x = -CAMERA_OFFSET_X + movementAverage;
      camera.position.z = CAMERA_OFFSET_Z - movementAverage;
    }
  });
  
  const theme = THEMES[snap.currentTheme];
  
  return (
    <group>
      <Trail width={1} length={8} color={theme.accent} attenuation={(t) => t * t}>
        <mesh ref={meshRef} position={[0, SPHERE_RADIUS, 0]}>
          <sphereGeometry args={[SPHERE_RADIUS, 32, 32]} />
          <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
          <pointLight color={theme.accent} intensity={2} distance={3} />
        </mesh>
      </Trail>
      
      {snap.powerUp === 'shield' && (
        <mesh position={mutation.spherePos}>
          <icosahedronGeometry args={[SPHERE_RADIUS * 2, 1]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.3} wireframe />
        </mesh>
      )}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TILE SYSTEM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const TileSystem: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const snap = useSnapshot(apexState);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const clockRef = useRef(0);
  const theme = THEMES[snap.currentTheme];

  const tileGeometry = useMemo(
    () => new THREE.BoxGeometry(TILE_SIZE, TILE_DEPTH, TILE_SIZE),
    []
  );
  const sideMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PATH_EDGE_COLOR,
        emissive: PATH_EDGE_COLOR,
        emissiveIntensity: 0.08,
        metalness: 0.3,
        roughness: 0.85,
      }),
    []
  );
  const topMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.tileHex,
        emissive: theme.tileHex,
        emissiveIntensity: 0.45,
        metalness: 0.6,
        roughness: 0.4,
      }),
    []
  );
  const tileMaterials = useMemo(
    () => [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial],
    [sideMaterial, topMaterial]
  );

  useEffect(() => {
    topMaterial.color.set(theme.tileHex);
    topMaterial.emissive.set(theme.tileHex);
  }, [theme.tileHex, topMaterial]);
  
  const initializeLevel = useCallback(() => {
    mutation.tiles = [];
    mutation.gems = [];
    mutation.powerUps = [];
    mutation.nextTileId = 0;
    mutation.nextGemId = 0;
    mutation.divergenceX = 0;
    mutation.divergenceZ = 0;
    mutation.curveT = 0;
    mutation.spiralAngle = 0;
    mutation.spiralRadius = 10;
    mutation.spiralDirection = 1;
    
    // Reset sphere position
    mutation.spherePos.set(0, SPHERE_RADIUS, 0);
    mutation.velocity.set(0, 0, 0);
    mutation.directionIndex = 0;
    mutation.currentDirection.copy(DIRECTIONS[0]);
    mutation.targetDirection.copy(DIRECTIONS[0]);
    mutation.isOnPlatform = true;
    mutation.gameOver = false;
    
    // Create starting platform
    const halfWidth = Math.floor(PLATFORM_WIDTH / 2);
    const tileY = -TILE_DEPTH / 2;
    
    for (let l = 0; l < PLATFORM_LENGTH; l++) {
      for (let w = 0; w < PLATFORM_WIDTH; w++) {
        const tile: TileData = {
          id: mutation.nextTileId++,
          x: (halfWidth - w) * TILE_SIZE,
          y: tileY,
          z: -l * TILE_SIZE,
          status: 'active',
          lastContactTime: -1,
          fallVelocity: 0,
        };
        mutation.tiles.push(tile);
      }
    }
    
    // Set last tile position to top-right corner of platform
    mutation.lastTilePos.set(halfWidth * TILE_SIZE, tileY, -(PLATFORM_LENGTH - 1) * TILE_SIZE);
    
    // Generate initial path
    for (let i = 0; i < 30; i++) {
      addNewTile(apexState.mode);
    }
    
    mutation.initialized = true;
    clockRef.current = 0;
  }, []);
  
  const addNewTile = useCallback((mode: GameMode) => {
    const pos = generateTileForMode(mode);
    
    const tile: TileData = {
      id: mutation.nextTileId++,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      status: 'active',
      lastContactTime: -1,
      fallVelocity: 0,
    };
    mutation.tiles.push(tile);
    
    // Spawn gem
    if (Math.random() < GEM_SPAWN_CHANCE) {
      const gem: GemData = {
        id: mutation.nextGemId++,
        x: pos.x,
        y: pos.y + GEM_HEIGHT_OFFSET,
        z: pos.z,
        tileId: tile.id,
        collected: false,
        rotation: 0,
      };
      mutation.gems.push(gem);
    }
    
    // Spawn power-up
    if (Math.random() < POWERUP_SPAWN_CHANCE) {
      const types: Exclude<PowerUpType, 'none'>[] = ['shield', 'magnet', 'slowmo'];
      const powerUp: PowerUpData = {
        id: mutation.nextGemId++,
        type: types[Math.floor(Math.random() * types.length)],
        x: pos.x,
        y: pos.y + GEM_HEIGHT_OFFSET + 0.3,
        z: pos.z,
        tileId: tile.id,
        collected: false,
      };
      mutation.powerUps.push(powerUp);
    }
  }, []);
  
  // Initialize on game start
  useEffect(() => {
    // Initialize a preview path in the menu too, so the maze is visible before starting.
    if ((snap.phase === 'playing' || snap.phase === 'menu') && !mutation.initialized) {
      initializeLevel();
    }
  }, [snap.phase, initializeLevel]);

  // If the player changes mode on the menu, refresh the preview.
  useEffect(() => {
    if (snap.phase === 'menu') {
      initializeLevel();
    }
  }, [snap.mode, snap.phase, initializeLevel]);
  
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (!mutation.initialized) return;
    
    clockRef.current += delta;

    // Only run gameplay simulation while playing.
    if (snap.phase === 'playing') {
      const spherePos = mutation.spherePos;
      const halfTile = TILE_SIZE / 2;
      
      // Generate new tiles
      while (spherePos.distanceTo(mutation.lastTilePos) < LOOKAHEAD_DISTANCE) {
        addNewTile(snap.mode);
      }
      
      // Collision detection - check if sphere is on any active tile
      mutation.isOnPlatform = false;
      let currentTileId: number | null = null;
      
      for (const tile of mutation.tiles) {
        if (tile.status !== 'active') continue;
        
        // Check collision (matching original ZigZag logic)
        if (
          spherePos.x >= tile.x - halfTile &&
          spherePos.x <= tile.x + halfTile &&
          spherePos.z >= tile.z - halfTile &&
          spherePos.z <= tile.z + halfTile &&
          spherePos.y >= tile.y - SPHERE_RADIUS &&
          spherePos.y <= tile.y + TILE_DEPTH + SPHERE_RADIUS
        ) {
          mutation.isOnPlatform = true;
          currentTileId = tile.id;
          tile.lastContactTime = clockRef.current;
          break;
        }
      }
      
      // Process tile falling
      const tilesToRemove: number[] = [];
      let platformShouldFall = false;
      
      for (const tile of mutation.tiles) {
        if (tile.status === 'active') {
          // Check if tile should start falling
          if (
            tile.lastContactTime > 0 &&
            tile.id !== currentTileId &&
            clockRef.current - tile.lastContactTime > FALL_DELAY &&
            tile.id >= PLATFORM_TILE_COUNT
          ) {
            tile.status = 'falling';
            apexState.addScore(1);
            
            // First path tile triggers platform fall
            if (tile.id === PLATFORM_TILE_COUNT) {
              platformShouldFall = true;
            }
          }
        } else if (tile.status === 'falling') {
          tile.fallVelocity += GRAVITY * delta * 0.5;
          tile.y -= tile.fallVelocity * delta;
          
          if (tile.y < REMOVAL_Y) {
            tilesToRemove.push(tile.id);
          }
        }
      }
      
      // Make platform fall together
      if (platformShouldFall) {
        for (const tile of mutation.tiles) {
          if (tile.id < PLATFORM_TILE_COUNT && tile.status === 'active') {
            tile.status = 'falling';
          }
        }
      }
      
      // Remove fallen tiles
      if (tilesToRemove.length > 0) {
        mutation.tiles = mutation.tiles.filter(t => !tilesToRemove.includes(t.id));
        mutation.gems = mutation.gems.filter(g => !tilesToRemove.includes(g.tileId));
        mutation.powerUps = mutation.powerUps.filter(p => !tilesToRemove.includes(p.tileId));
      }
    }
    
    // Update instance matrices
    const maxToRender = Math.min(mutation.tiles.length, MAX_TILES);
    for (let i = 0; i < maxToRender; i++) {
      const tile = mutation.tiles[i];
      dummy.position.set(tile.x, tile.y, tile.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    // Clear unused instances
    for (let i = maxToRender; i < MAX_TILES; i++) {
      dummy.position.set(0, -1000, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_TILES]}
      geometry={tileGeometry}
      material={tileMaterials}
      frustumCulled={false}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GEM SYSTEM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const GemSystem: React.FC = () => {
  const snap = useSnapshot(apexState);
  
  useFrame((_, delta) => {
    if (snap.phase !== 'playing' || !mutation.initialized) return;
    
    const spherePos = mutation.spherePos;
    const collectRadius = snap.powerUp === 'magnet' ? 3 : SPHERE_RADIUS + GEM_RADIUS;
    
    for (const gem of mutation.gems) {
      if (gem.collected) continue;
      
      gem.rotation += delta * 3;
      
      // Magnet effect
      if (snap.powerUp === 'magnet') {
        const dist = Math.sqrt(Math.pow(gem.x - spherePos.x, 2) + Math.pow(gem.z - spherePos.z, 2));
        if (dist < 5 && dist > 0.5) {
          const pull = 8 * delta / dist;
          gem.x += (spherePos.x - gem.x) * pull;
          gem.z += (spherePos.z - gem.z) * pull;
        }
      }
      
      // Collection
      const dist = Math.sqrt(
        Math.pow(gem.x - spherePos.x, 2) +
        Math.pow(gem.y - spherePos.y, 2) +
        Math.pow(gem.z - spherePos.z, 2)
      );
      
      if (dist < collectRadius && mutation.isOnPlatform) {
        gem.collected = true;
        apexState.collectGem();
      }
    }
    
    // Power-up collection
    for (const powerUp of mutation.powerUps) {
      if (powerUp.collected) continue;
      
      const dist = Math.sqrt(
        Math.pow(powerUp.x - spherePos.x, 2) +
        Math.pow(powerUp.y - spherePos.y, 2) +
        Math.pow(powerUp.z - spherePos.z, 2)
      );
      
      if (dist < SPHERE_RADIUS + 0.4) {
        powerUp.collected = true;
        apexState.activatePowerUp(powerUp.type);
      }
    }
  });
  
  const theme = THEMES[snap.currentTheme];
  const visibleGems = mutation.gems.filter(g => !g.collected);
  const visiblePowerUps = mutation.powerUps.filter(p => !p.collected);
  
  return (
    <group>
      {visibleGems.map(gem => (
        <mesh
          key={gem.id}
          position={[gem.x, gem.y + Math.sin(gem.rotation) * 0.1, gem.z]}
          rotation={[0, gem.rotation, Math.PI / 4]}
        >
          <octahedronGeometry args={[GEM_RADIUS, 0]} />
          <meshStandardMaterial
            color={theme.gemHex}
            emissive={theme.gemHex}
            emissiveIntensity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}
      
      {visiblePowerUps.map(powerUp => (
        <mesh
          key={powerUp.id}
          position={[powerUp.x, powerUp.y + Math.sin(Date.now() * 0.003) * 0.15, powerUp.z]}
          rotation={[0, Date.now() * 0.002, 0]}
        >
          <icosahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial
            color={powerUp.type === 'shield' ? '#00ff88' : powerUp.type === 'magnet' ? '#ff00ff' : '#ffcc00'}
            emissive={powerUp.type === 'shield' ? '#00ff88' : powerUp.type === 'magnet' ? '#ff00ff' : '#ffcc00'}
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GROUND COMPONENT (simple dark plane far below)
// ═══════════════════════════════════════════════════════════════════════════

const Ground: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.position.x = mutation.spherePos.x;
    meshRef.current.position.z = mutation.spherePos.z;
  });
  
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, 0]}>
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial color={PATH_EDGE_COLOR} />
    </mesh>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// INPUT HANDLER
// ═══════════════════════════════════════════════════════════════════════════

const InputHandler: React.FC = () => {
  const snap = useSnapshot(apexState);
  
  useEffect(() => {
    const handleInput = (e: KeyboardEvent | PointerEvent) => {
      const isAction = e.type === 'pointerdown' ||
        (e.type === 'keydown' && ['Space', 'Enter', 'ArrowUp', 'ArrowDown'].includes((e as KeyboardEvent).code));
      
      if (isAction) {
        if (e.type === 'keydown') {
          // Prevent page scroll / focus movement while playing Apex
          (e as KeyboardEvent).preventDefault();
        }
        if (snap.phase === 'playing' && mutation.isOnPlatform && !mutation.gameOver) {
          // Toggle direction
          mutation.directionIndex = (mutation.directionIndex + 1) % DIRECTIONS.length;
          mutation.targetDirection.copy(DIRECTIONS[mutation.directionIndex]);
          apexState.addScore(1);
        } else if (snap.phase === 'menu') {
          apexState.reset();
          apexState.startGame();
        } else if (snap.phase === 'gameover') {
          if (e.type === 'keydown' && (e as KeyboardEvent).code === 'Space') {
            apexState.reset();
          }
          if (e.type === 'pointerdown') {
            apexState.reset();
            apexState.startGame();
          }
        }
      }
    };
    
    window.addEventListener('pointerdown', handleInput);
    window.addEventListener('keydown', handleInput);
    
    return () => {
      window.removeEventListener('pointerdown', handleInput);
      window.removeEventListener('keydown', handleInput);
    };
  }, [snap.phase]);
  
  // Power-up timer
  useFrame((_, delta) => {
    if (apexState.powerUpTimer > 0) {
      apexState.powerUpTimer -= delta;
      if (apexState.powerUpTimer <= 0) {
        apexState.powerUp = 'none';
        apexState.powerUpTimer = 0;
      }
    }
  });
  
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const MODE_INFO: Record<GameMode, { name: string; description: string; color: string }> = {
  classic: { name: 'Classic', description: 'Sharp 90° turns. Pure skill.', color: '#00ffff' },
  curved: { name: 'Curved', description: 'Flowing wave patterns.', color: '#ff6b6b' },
  spiral: { name: 'Spiral', description: 'Hypnotic inward spiral.', color: '#6c5ce7' },
  gravity: { name: 'Gravity', description: 'World-bending shifts.', color: '#00ff88' },
  speedrush: { name: 'Speed Rush', description: '1.5x speed. 2x points.', color: '#f39c12' },
  zen: { name: 'Zen', description: 'No death. Pure flow.', color: '#48dbfb' },
};

const GameUI: React.FC = () => {
  const snap = useSnapshot(apexState);
  
  useEffect(() => {
    apexState.loadHighScores();
  }, []);
  
  // Menu Screen
  if (snap.phase === 'menu') {
    return (
      <FullscreenOverlay>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding:
              'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
            // Keep the maze visible behind the menu
            background:
              'linear-gradient(180deg, rgba(10,10,21,0.45) 0%, rgba(26,26,46,0.55) 50%, rgba(15,15,26,0.45) 100%)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(4rem, 12vw, 8rem)',
              fontWeight: 900,
              marginBottom: '0.5rem',
              letterSpacing: '-0.05em',
              background: 'linear-gradient(135deg, #00ffff, #ff00ff, #00ffff)',
              backgroundSize: '200% 200%',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textShadow: '0 0 80px rgba(0, 255, 255, 0.5)',
              animation: 'gradient 3s ease infinite',
            }}
          >
            APEX
          </h1>
          
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', marginBottom: '2rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Tap to Turn. Stay on the Path.
          </p>
          
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              marginBottom: '2rem',
              width: 'min(92vw, 760px)',
              maxHeight: 'min(52vh, 520px)',
              overflowY: 'auto',
              padding: '0 0.5rem',
            }}
          >
            {(Object.keys(MODE_INFO) as GameMode[]).map((mode) => {
              const info = MODE_INFO[mode];
              const isSelected = snap.mode === mode;
              const highScore = snap.highScores[mode];
              
              return (
                <button
                  key={mode}
                  onClick={() => apexState.setMode(mode)}
                  style={{
                    position: 'relative',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid rgba(255,255,255,0.6)' : '2px solid rgba(255,255,255,0.2)',
                    background: isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.3s',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px', color: info.color }}>
                    {info.name}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginBottom: '8px' }}>{info.description}</div>
                  {highScore > 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>Best: {highScore.toLocaleString()}</div>
                  )}
                </button>
              );
            })}
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', marginBottom: '2rem' }}>
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => apexState.setDifficulty(d)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '8px',
                  border: snap.difficulty === d ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.2)',
                  background: snap.difficulty === d ? 'rgba(34,211,238,0.2)' : 'transparent',
                  color: snap.difficulty === d ? '#22d3ee' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => {
              apexState.reset();
              apexState.startGame();
            }}
            style={{
              padding: '1.25rem 4rem',
              fontSize: '1.5rem',
              fontWeight: 700,
              borderRadius: '1rem',
              border: 'none',
              background: `linear-gradient(135deg, ${MODE_INFO[snap.mode].color}, #ff00ff)`,
              color: '#000',
              boxShadow: `0 0 60px ${MODE_INFO[snap.mode].color}40`,
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
          >
            START GAME
          </button>
          
          <div style={{ marginTop: '2.5rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem', textAlign: 'center' }}>
            <p>Tap / Space / Click to change direction</p>
          </div>
          
          <style>{`
            @keyframes gradient {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
        </div>
      </FullscreenOverlay>
    );
  }
  
  // Game Over Screen
  if (snap.phase === 'gameover') {
    const isNewHighScore = snap.score >= snap.highScores[snap.mode] && snap.score > 0;
    
    return (
      <FullscreenOverlay>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding:
              'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
            background: 'rgba(10, 10, 21, 0.75)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(3rem, 10vw, 5rem)',
              fontWeight: 900,
              marginBottom: '1.5rem',
              color: '#ff2190',
              textShadow: '0 0 40px rgba(255, 33, 144, 0.6)',
            }}
          >
            GAME OVER
          </h1>
          
          {isNewHighScore && (
            <div style={{ color: '#22d3ee', fontSize: '1.25rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>NEW HIGH SCORE!</div>
          )}
          
          <div style={{ fontSize: '3.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>{snap.score.toLocaleString()}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '2rem' }}>{MODE_INFO[snap.mode].name} Mode</div>
          
          <div style={{ display: 'flex', gap: '3rem', marginBottom: '2rem', textAlign: 'center' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>Gems</div>
              <div style={{ fontSize: '1.5rem', color: '#fff' }}>{snap.gems}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>Level</div>
              <div style={{ fontSize: '1.5rem', color: '#fff' }}>{snap.level}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>Best Combo</div>
              <div style={{ fontSize: '1.5rem', color: '#fff' }}>x{snap.bestCombo}</div>
            </div>
          </div>
          
          <button
            onClick={() => {
              apexState.reset();
              apexState.startGame();
            }}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #00ffff, #ff00ff)',
              color: '#000',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            PLAY AGAIN
          </button>
          
          <button
            onClick={() => apexState.reset()}
            style={{
              marginTop: '1rem',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
          >
            Back to Menu
          </button>
          
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </div>
      </FullscreenOverlay>
    );
  }
  
  // In-Game HUD
  const theme = THEMES[snap.currentTheme];
  
  return (
    <FullscreenOverlay>
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', fontFamily: '"Geist Mono", monospace' }}>
        <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Score</div>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#fff' }}>{snap.score.toLocaleString()}</div>
        </div>
        
        {snap.combo > 1 && (
          <div style={{ position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)' }}>
            <div
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                fontSize: '1.25rem',
                fontWeight: 700,
                background: snap.comboMultiplier >= 3 ? 'linear-gradient(135deg, #f39c12, #e74c3c)' :
                           snap.comboMultiplier >= 2 ? 'linear-gradient(135deg, #6c5ce7, #fd79a8)' :
                           'linear-gradient(135deg, #00ffff, #0088ff)',
                color: '#000',
              }}
            >
              x{snap.comboMultiplier.toFixed(1)} COMBO
            </div>
          </div>
        )}
        
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', textAlign: 'right' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Level</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.accent }}>{snap.level}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{snap.gems} gems</div>
        </div>
        
        {snap.powerUp !== 'none' && (
          <div style={{ position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)' }}>
            <div
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: snap.powerUp === 'shield' ? '#00ff8840' : snap.powerUp === 'magnet' ? '#ff00ff40' : '#ffcc0040',
                border: `2px solid ${snap.powerUp === 'shield' ? '#00ff88' : snap.powerUp === 'magnet' ? '#ff00ff' : '#ffcc00'}`,
              }}
            >
              <span style={{ color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>{snap.powerUp}</span>
              <div style={{ width: '4rem', height: '0.5rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: '9999px',
                    transition: 'all 0.1s',
                    width: `${(snap.powerUpTimer / POWERUP_DURATION) * 100}%`,
                    background: snap.powerUp === 'shield' ? '#00ff88' : snap.powerUp === 'magnet' ? '#ff00ff' : '#ffcc00',
                  }}
                />
              </div>
            </div>
          </div>
        )}
        
        <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem' }}>
          <div
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: `${MODE_INFO[snap.mode].color}20`,
              border: `1px solid ${MODE_INFO[snap.mode].color}40`,
              color: MODE_INFO[snap.mode].color,
            }}
          >
            {MODE_INFO[snap.mode].name}
          </div>
        </div>
      </div>
    </FullscreenOverlay>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ApexProps {
  soundsOn?: boolean;
}

const Apex: React.FC<ApexProps> = ({ soundsOn = true }) => {
  const snap = useSnapshot(apexState);
  const { scene, camera } = useThree();
  const lookAtRef = useRef(
    new THREE.Vector3(-(CAMERA_OFFSET_X - CAMERA_OFFSET_Z), 0, 0)
  );
  
  // Camera setup matching original ZigZag exactly
  const setupCamera = useCallback(() => {
    const spherePos = mutation.spherePos;
    camera.position.set(
      spherePos.x - CAMERA_OFFSET_X,
      spherePos.y + CAMERA_OFFSET_Y,
      spherePos.z + CAMERA_OFFSET_Z
    );
    camera.lookAt(lookAtRef.current);
  }, [camera]);
  
  useEffect(() => {
    const prevBackground = scene.background;
    scene.background = new THREE.Color(PATH_EDGE_COLOR);
    return () => {
      scene.background = prevBackground;
    };
  }, [scene]);
  
  // Initial camera setup
  useEffect(() => {
    setupCamera();
  }, [setupCamera]);
  
  // Reset camera when game starts or returns to menu
  useEffect(() => {
    if (snap.phase === 'playing' || snap.phase === 'menu') {
      // Small delay to ensure mutation.spherePos is reset
      setTimeout(() => setupCamera(), 0);
    }
  }, [snap.phase, setupCamera]);

  useEffect(() => {
    if (snap.phase === 'menu') {
      setTimeout(() => setupCamera(), 0);
    }
  }, [snap.mode, snap.phase, setupCamera]);
  
  useEffect(() => {
    return () => {
      apexState.reset();
    };
  }, []);
  
  // Lighting matching original ZigZag
  return (
    <>
      <ApexCamera />
      <ambientLight intensity={2.5} />
      <directionalLight position={[15, 30, 10]} intensity={3.5} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <fog attach="fog" args={[PATH_EDGE_COLOR, 30, 80]} />
      
      <Ground />
      {/* Keep the maze visible on the start menu too */}
      <TileSystem />
      <GemSystem />
      <Sphere />
      <InputHandler />
      <GameUI />
    </>
  );
};

export default Apex;
