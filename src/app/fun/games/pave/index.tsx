/**
 * Pave.tsx (Shape Shifter Rush)
 *
 * Infinite shape-matching runner
 * Cycle through shapes to match and collect oncoming shapes
 * Features: lives, obstacles, power-ups, combo system, and themed worlds
 */
'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ShapeType = 'triangle' | 'square' | 'pentagon' | 'hexagon';
type EntityType = 'shape' | 'obstacle' | 'powerup';
type PowerUpType = 'shield' | 'magnet' | 'slow' | 'doublePoints' | 'extraLife';

interface Entity {
  id: number;
  type: EntityType;
  shape?: ShapeType;
  powerUp?: PowerUpType;
  position: THREE.Vector3;
  collected: boolean;
  lane: number;
}

interface FXParticle {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  spin: number;
  color: string;
}

interface ShockRing {
  id: number;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
  startRadius: number;
  endRadius: number;
  thickness: number;
  color: string;
}

interface HUDCallout {
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const paveState = proxy({
  score: 0,
  highScore: 0,
  lives: 3,
  combo: 0,
  maxCombo: 0,
  streakTier: 0,
  maxStreakTier: 0,
  rhythmMeter: 0,
  shapesCollected: 0,
  gameOver: false,
  currentShape: 'triangle' as ShapeType,
  // Power-up states
  hasShield: false,
  shieldTimer: 0,
  hasMagnet: false,
  magnetTimer: 0,
  hasSlowMo: false,
  slowMoTimer: 0,
  hasDoublePoints: false,
  doublePointsTimer: 0,
  // World
  distance: 0,
  world: 0,

  reset() {
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 0;
    this.streakTier = 0;
    this.maxStreakTier = 0;
    this.rhythmMeter = 0;
    this.shapesCollected = 0;
    this.gameOver = false;
    this.currentShape = 'triangle';
    this.hasShield = false;
    this.shieldTimer = 0;
    this.hasMagnet = false;
    this.magnetTimer = 0;
    this.hasSlowMo = false;
    this.slowMoTimer = 0;
    this.hasDoublePoints = false;
    this.doublePointsTimer = 0;
    this.distance = 0;
    this.world = 0;
  },

  cycleShape(direction: 1 | -1) {
    const shapes: ShapeType[] = ['triangle', 'square', 'pentagon', 'hexagon'];
    const currentIndex = shapes.indexOf(this.currentShape);
    const newIndex = (currentIndex + direction + shapes.length) % shapes.length;
    this.currentShape = shapes[newIndex];
  },

  loseLife() {
    if (this.hasShield) {
      this.hasShield = false;
      return false;
    }
    this.lives -= 1;
    this.combo = 0;
    this.streakTier = 0;
    this.rhythmMeter = Math.max(0, this.rhythmMeter - 45);
    if (this.lives <= 0) {
      this.gameOver = true;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        try {
          localStorage.setItem('pave-highscore', String(this.score));
        } catch (e) {
          /* ignore */
        }
      }
    }
    return this.lives <= 0;
  },

  collectShape(isMatch: boolean, quality: 'normal' | 'perfect' = 'normal') {
    if (isMatch) {
      const basePoints = 10;
      const comboMultiplier = 1 + this.combo * 0.12;
      const qualityMultiplier = quality === 'perfect' ? 1.45 : 1;
      const doubleMultiplier = this.hasDoublePoints ? 2 : 1;
      this.streakTier = Math.min(5, Math.floor((this.combo + 1) / 6));
      this.maxStreakTier = Math.max(this.maxStreakTier, this.streakTier);
      const streakMultiplier = 1 + this.streakTier * 0.22;
      this.score += Math.floor(
        basePoints *
          comboMultiplier *
          qualityMultiplier *
          doubleMultiplier *
          streakMultiplier
      );
      this.combo += 1;
      this.rhythmMeter = Math.min(
        100,
        this.rhythmMeter + (quality === 'perfect' ? 18 : 12)
      );
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.shapesCollected += 1;
    } else {
      this.loseLife();
    }
  },

  activatePowerUp(type: PowerUpType) {
    switch (type) {
      case 'shield':
        this.hasShield = true;
        this.shieldTimer = 10;
        break;
      case 'magnet':
        this.hasMagnet = true;
        this.magnetTimer = 8;
        break;
      case 'slow':
        this.hasSlowMo = true;
        this.slowMoTimer = 5;
        break;
      case 'doublePoints':
        this.hasDoublePoints = true;
        this.doublePointsTimer = 15;
        break;
      case 'extraLife':
        this.lives = Math.min(this.lives + 1, 5);
        break;
    }
  },

  loadHighScore() {
    try {
      const saved = localStorage.getItem('pave-highscore');
      if (saved) this.highScore = parseInt(saved, 10);
    } catch (e) {
      /* ignore */
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SHAPES: ShapeType[] = ['triangle', 'square', 'pentagon', 'hexagon'];
const LANES = [-3, 0, 3]; // Three lanes
const SPAWN_DISTANCE = 50;
const COLLECTION_DISTANCE = 2.5;
const HIT_WINDOW_Z = 1.2;
const PERFECT_WINDOW_Z = 0.42;
const BASE_SPEED = 12;
const MAX_SPEED = 25;

const SHAPE_COLORS: Record<ShapeType, string> = {
  triangle: '#feca57',
  square: '#ff6b6b',
  pentagon: '#5f27cd',
  hexagon: '#48dbfb',
};

const POWERUP_COLORS: Record<PowerUpType, string> = {
  shield: '#00ff88',
  magnet: '#ff00ff',
  slow: '#00ffff',
  doublePoints: '#ffff00',
  extraLife: '#ff4757',
};

const WORLDS = [
  { name: 'Neon City', bg: '#0a0a1a', ground: '#1a1a2e', accent: '#ff2190' },
  { name: 'Crystal Cave', bg: '#0a1628', ground: '#162447', accent: '#48dbfb' },
  { name: 'Lava Fields', bg: '#1a0800', ground: '#2a1000', accent: '#ff6600' },
  { name: 'Void Space', bg: '#050510', ground: '#0a0a20', accent: '#9b59b6' },
  {
    name: 'Emerald Forest',
    bg: '#0a1a0a',
    ground: '#102010',
    accent: '#00ff66',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SEEDED RANDOM
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
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Shape mesh component
const ShapeMesh: React.FC<{
  shape: ShapeType;
  color: string;
  scale?: number;
  opacity?: number;
  wireframe?: boolean;
}> = ({ shape, color, scale = 1, opacity = 1, wireframe = false }) => {
  const geometry = useMemo(() => {
    switch (shape) {
      case 'triangle':
        return new THREE.ConeGeometry(0.8 * scale, 1.2 * scale, 3);
      case 'square':
        return new THREE.BoxGeometry(1 * scale, 1 * scale, 1 * scale);
      case 'pentagon':
        return new THREE.CylinderGeometry(
          0.8 * scale,
          0.8 * scale,
          0.5 * scale,
          5
        );
      case 'hexagon':
        return new THREE.CylinderGeometry(
          0.8 * scale,
          0.8 * scale,
          0.5 * scale,
          6
        );
      default:
        return new THREE.BoxGeometry(1 * scale, 1 * scale, 1 * scale);
    }
  }, [shape, scale]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent={opacity < 1}
        opacity={opacity}
        wireframe={wireframe}
      />
    </mesh>
  );
};

// Player component
const Player: React.FC<{
  lane: number;
  shape: ShapeType;
  hasShield: boolean;
}> = ({ lane, shape, hasShield }) => {
  const groupRef = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 2;
      // Smooth lane transition
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        LANES[lane],
        delta * 10
      );
    }
    if (shieldRef.current) {
      shieldRef.current.rotation.y -= delta * 1.5;
      shieldRef.current.rotation.x += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef} position={[LANES[lane], 1, 0]}>
      <ShapeMesh shape={shape} color={SHAPE_COLORS[shape]} scale={1.2} />
      <pointLight color={SHAPE_COLORS[shape]} intensity={2} distance={8} />

      {/* Shield effect */}
      {hasShield && (
        <mesh ref={shieldRef}>
          <icosahedronGeometry args={[1.8, 1]} />
          <meshBasicMaterial
            color="#00ff88"
            transparent
            opacity={0.25}
            wireframe
          />
        </mesh>
      )}
    </group>
  );
};

// Collectible entity
const CollectibleEntity: React.FC<{
  entity: Entity;
  playerLane: number;
  playerShape: ShapeType;
  hasMagnet: boolean;
}> = ({ entity, playerLane, playerShape, hasMagnet }) => {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const isTargetShape =
    entity.type === 'shape' && entity.shape === playerShape;

  useFrame((state, delta) => {
    if (!groupRef.current || entity.collected) return;

    groupRef.current.rotation.y += delta * 2;
    groupRef.current.rotation.z += delta * 0.6;

    // Magnet effect for matching shapes
    if (hasMagnet && entity.type === 'shape' && entity.shape === playerShape) {
      const targetX = LANES[playerLane];
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        targetX,
        delta * 3
      );
    }

    // Bobbing animation
    const bob = Math.sin(state.clock.elapsedTime * 3 + entity.id) * 0.2;
    groupRef.current.position.y = 1 + bob;

    if (haloRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 8 + entity.id) * 0.12;
      haloRef.current.scale.set(pulse, pulse, 1);
    }

    if (beamRef.current) {
      const px = LANES[playerLane];
      const ex = groupRef.current.position.x;
      const ez = groupRef.current.position.z;
      const dx = px - ex;
      const dz = -ez;
      const len = Math.hypot(dx, dz);
      if (len > 0.001 && (hasMagnet || isTargetShape)) {
        beamRef.current.visible = true;
        beamRef.current.position.set(dx * 0.5, 0, dz * 0.5);
        beamRef.current.rotation.set(0, Math.atan2(dx, dz), 0);
        beamRef.current.scale.set(1, 1, len);
      } else {
        beamRef.current.visible = false;
      }
    }
  });

  if (entity.collected) return null;

  let color = '#ffffff';
  let content: React.ReactNode = null;

  if (entity.type === 'shape' && entity.shape) {
    color = SHAPE_COLORS[entity.shape];
    content = (
      <>
        <ShapeMesh shape={entity.shape} color={color} />
        {(isTargetShape || hasMagnet) && (
          <>
            <mesh ref={haloRef} position={[0, 0, 0]}>
              <torusGeometry args={[1.1, 0.08, 8, 32]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isTargetShape ? 0.65 : 0.42}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
              <ringGeometry args={[1.15, 1.45, 32]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isTargetShape ? 0.28 : 0.15}
              />
            </mesh>
            <pointLight color={color} intensity={isTargetShape ? 1.6 : 0.9} distance={4.8} />
          </>
        )}
      </>
    );
  } else if (entity.type === 'obstacle') {
    color = '#ff0000';
    content = (
      <>
        <mesh>
          <octahedronGeometry args={[0.8]} />
          <meshStandardMaterial
            color="#ff0000"
            emissive="#ff0000"
            emissiveIntensity={0.8}
          />
        </mesh>
        <pointLight color="#ff0000" intensity={1} distance={4} />
      </>
    );
  } else if (entity.type === 'powerup' && entity.powerUp) {
    color = POWERUP_COLORS[entity.powerUp];
    content = (
      <>
        <mesh>
          <dodecahedronGeometry args={[0.6]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.8}
          />
        </mesh>
        <mesh>
          <torusGeometry args={[0.9, 0.05, 8, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
        <pointLight color={color} intensity={1.5} distance={5} />
      </>
    );
  }

  return (
    <group ref={groupRef} position={[entity.position.x, 1, entity.position.z]}>
      <mesh ref={beamRef} visible={false} position={[0, 0, 0]}>
        <planeGeometry args={[0.12, 0.12]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} />
      </mesh>
      {content}
    </group>
  );
};

// Ground with scrolling grid
const Ground: React.FC<{ color: string; accentColor: string }> = ({
  color,
  accentColor,
}) => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, -25]}>
        <planeGeometry args={[20, 100, 40, 200]} />
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
      {/* Lane markers */}
      {LANES.map((x, i) => (
        <group key={i} position={[x, -0.4, -25]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <planeGeometry args={[0.12, 100]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.45, 100]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.1} />
          </mesh>
        </group>
      ))}

      {/* Side glow rails */}
      {[-5.5, 5.5].map((x) => (
        <mesh key={x} position={[x, 0.05, -25]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[100, 1.8]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.08} />
        </mesh>
      ))}
    </>
  );
};

// HUD Component
const GameHUD: React.FC = () => {
  const snap = useSnapshot(paveState);
  const world = WORLDS[snap.world % WORLDS.length];

  const getShapeIcon = (shape: ShapeType) => {
    switch (shape) {
      case 'triangle':
        return '△';
      case 'square':
        return '□';
      case 'pentagon':
        return '⬠';
      case 'hexagon':
        return '⬡';
    }
  };

  // Load high score on mount
  useEffect(() => {
    paveState.loadHighScore();
  }, []);

  if (snap.gameOver) {
    return (
      <Html fullscreen>
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            background: 'rgba(0,0,0,0.9)',
            fontFamily: '"Geist", system-ui, sans-serif',
          }}
        >
          <div className="text-center">
            <h1 className="text-6xl font-bold text-white mb-4">GAME OVER</h1>
            <div className="text-4xl font-bold text-cyan-400 mb-4">
              {snap.score.toLocaleString()}
            </div>
            <div className="text-white/60 space-y-1 mb-6">
              <p>Shapes Collected: {snap.shapesCollected}</p>
              <p>Max Combo: x{snap.maxCombo + 1}</p>
              <p>Distance: {Math.floor(snap.distance)}m</p>
            </div>
            {snap.score >= snap.highScore && snap.score > 0 && (
              <div className="text-yellow-400 text-lg mb-4 animate-pulse">
                NEW HIGH SCORE!
              </div>
            )}
            <p className="text-white/40 mb-6">
              Best: {snap.highScore.toLocaleString()}
            </p>
            <button
              onClick={() => paveState.reset()}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-xl hover:scale-105 transition-transform"
            >
              PLAY AGAIN
            </button>
            <p className="text-white/30 text-sm mt-4">Press R to restart</p>
          </div>
        </div>
      </Html>
    );
  }

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div style={{ fontFamily: '"Geist", system-ui, sans-serif' }}>
        {/* Score & Lives */}
        <div className="absolute top-4 left-4">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3">
            <div className="text-white text-3xl font-bold">
              {snap.score.toLocaleString()}
            </div>
            <div className="text-white/60 text-sm">
              Distance: {Math.floor(snap.distance)}m
            </div>
            {snap.combo > 0 && (
              <div className="text-cyan-300 text-sm font-semibold">
                Combo: x{snap.combo + 1}
              </div>
            )}
            <div className="text-white/50 text-xs mt-1">
              Streak Tier: {snap.streakTier}
            </div>
            <div className="mt-1.5 w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-150"
                style={{
                  width: `${snap.rhythmMeter}%`,
                  background:
                    snap.rhythmMeter > 75
                      ? '#67e8f9'
                      : snap.rhythmMeter > 40
                        ? '#a78bfa'
                        : '#f472b6',
                }}
              />
            </div>
          </div>
        </div>

        {/* Lives */}
        <div className="absolute top-4 right-4">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-2xl ${i < snap.lives ? 'text-red-500' : 'text-gray-600'}`}
                >
                  ♥
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* World indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1">
            <span className="text-white/60 text-sm">{world.name}</span>
          </div>
        </div>

        {/* Current shape indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-8 py-4 flex flex-col items-center">
            <div className="text-white/40 text-xs mb-2">YOUR SHAPE</div>
            <div
              className="text-6xl"
              style={{ color: SHAPE_COLORS[snap.currentShape] }}
            >
              {getShapeIcon(snap.currentShape)}
            </div>
            <div className="flex gap-2 mt-3 text-white/50 text-xs">
              <span className="px-2 py-1 bg-white/10 rounded">SPACE</span>
              <span>to change</span>
            </div>
          </div>
        </div>

        {/* Active power-ups */}
        <div className="absolute top-20 right-4 flex flex-col gap-2">
          {snap.hasShield && (
            <div className="bg-green-500/30 text-green-400 px-3 py-1 rounded-full text-xs">
              Shield {Math.ceil(snap.shieldTimer)}s
            </div>
          )}
          {snap.hasMagnet && (
            <div className="bg-purple-500/30 text-purple-400 px-3 py-1 rounded-full text-xs">
              Magnet {Math.ceil(snap.magnetTimer)}s
            </div>
          )}
          {snap.hasSlowMo && (
            <div className="bg-cyan-500/30 text-cyan-400 px-3 py-1 rounded-full text-xs">
              Slow-Mo {Math.ceil(snap.slowMoTimer)}s
            </div>
          )}
          {snap.hasDoublePoints && (
            <div className="bg-yellow-500/30 text-yellow-400 px-3 py-1 rounded-full text-xs">
              2x Points {Math.ceil(snap.doublePointsTimer)}s
            </div>
          )}
        </div>

        {/* Streak grade */}
        {snap.streakTier >= 2 && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2">
            <div className="px-4 py-2 rounded-xl bg-black/55 border border-cyan-300/25 text-cyan-200 text-sm tracking-wide">
              STREAK {snap.streakTier} • RHYTHM LOCKED
            </div>
          </div>
        )}

        {/* Controls hint */}
        <div className="absolute bottom-4 left-4 text-white/30 text-xs">
          <div>←/→ or A/D : Move lanes</div>
          <div>Space : Change shape</div>
        </div>

        {/* Mobile controls */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 flex pointer-events-auto md:hidden">
          <div
            className="flex-1"
            onTouchStart={() => paveState.cycleShape(-1)}
          />
          <div
            className="flex-1"
            onTouchStart={() => paveState.cycleShape(1)}
          />
        </div>
      </div>
    </Html>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Pave: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(paveState);
  const { camera, scene } = useThree();

  const [playerLane, setPlayerLane] = useState(1); // 0, 1, 2 for left, center, right
  const [entities, setEntities] = useState<Entity[]>([]);
  const [fxParticles, setFxParticles] = useState<FXParticle[]>([]);
  const [shockRings, setShockRings] = useState<ShockRing[]>([]);
  const [hudCallout, setHudCallout] = useState<HUDCallout | null>(null);

  const rngRef = useRef(new SeededRandom(Date.now()));
  const entityIdRef = useRef(0);
  const fxIdRef = useRef(0);
  const nextSpawnTime = useRef(0); // Time until next spawn
  const gameSpeedRef = useRef(BASE_SPEED);
  const cameraShakeRef = useRef(0);
  const hitFlashRef = useRef<THREE.MeshBasicMaterial>(null);

  const world = WORLDS[snap.world % WORLDS.length];

  const pushCallout = useCallback((text: string, color: string, life = 0.9) => {
    setHudCallout({ text, color, life, maxLife: life });
  }, []);

  const spawnBurst = useCallback(
    (
      x: number,
      y: number,
      z: number,
      color: string,
      count: number,
      options?: {
        speedMin?: number;
        speedMax?: number;
        sizeMin?: number;
        sizeMax?: number;
      }
    ) => {
      const speedMin = options?.speedMin ?? 2.2;
      const speedMax = options?.speedMax ?? 4.8;
      const sizeMin = options?.sizeMin ?? 0.06;
      const sizeMax = options?.sizeMax ?? 0.13;

      const next: FXParticle[] = [];
      for (let i = 0; i < count; i += 1) {
        const theta = Math.random() * Math.PI * 2;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        next.push({
          id: fxIdRef.current++,
          x,
          y,
          z,
          vx: Math.cos(theta) * speed * (0.7 + Math.random() * 0.5),
          vy: (Math.random() - 0.2) * speed * 0.8,
          vz: (Math.random() - 0.5) * speed * 1.2,
          life: 1,
          maxLife: 1,
          size: sizeMin + Math.random() * (sizeMax - sizeMin),
          spin: (Math.random() - 0.5) * 8,
          color,
        });
      }
      setFxParticles((prev) => [...prev, ...next]);
    },
    []
  );

  const spawnShockRing = useCallback(
    (
      x: number,
      y: number,
      z: number,
      color: string,
      options?: {
        life?: number;
        startRadius?: number;
        endRadius?: number;
        thickness?: number;
      }
    ) => {
      const life = options?.life ?? 0.55;
      setShockRings((prev) => [
        ...prev,
        {
          id: fxIdRef.current++,
          x,
          y,
          z,
          life,
          maxLife: life,
          startRadius: options?.startRadius ?? 0.18,
          endRadius: options?.endRadius ?? 2.05,
          thickness: options?.thickness ?? 0.15,
          color,
        },
      ]);
    },
    []
  );

  // Camera setup
  useEffect(() => {
    camera.position.set(0, 6, 8);
    camera.lookAt(0, 0, -10);
  }, [camera]);

  // Scene background
  useEffect(() => {
    scene.background = new THREE.Color(world.bg);
  }, [scene, world.bg]);

  // Initialize with some entities
  useEffect(() => {
    const initialEntities: Entity[] = [];
    for (let i = 0; i < 8; i++) {
      const lane = rngRef.current.int(0, 2);
      const z = -10 - i * 6; // Spread them out
      initialEntities.push({
        id: entityIdRef.current++,
        type: 'shape',
        shape: rngRef.current.pick(SHAPES),
        position: new THREE.Vector3(LANES[lane], 1, z),
        collected: false,
        lane,
      });
    }
    setEntities(initialEntities);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r' || e.code === 'Space') {
          e.preventDefault();
          paveState.reset();
          setEntities([]);
          setFxParticles([]);
          setShockRings([]);
          setHudCallout(null);
          setPlayerLane(1);
          nextSpawnTime.current = 0;
          gameSpeedRef.current = BASE_SPEED;
          cameraShakeRef.current = 0;
          rngRef.current = new SeededRandom(Date.now());
        }
        return;
      }

      // Lane movement (Left/Right or A/D)
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        setPlayerLane((prev) => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        setPlayerLane((prev) => Math.min(2, prev + 1));
      }

      // Shape cycling (Space bar)
      if (e.code === 'Space') {
        e.preventDefault();
        paveState.cycleShape(1);
      }

      // Alternative shape cycling with W/S or Up/Down
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        paveState.cycleShape(-1);
      }
      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        paveState.cycleShape(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snap.gameOver]);

  // Game loop
  useFrame((state, delta) => {
    if (snap.gameOver) return;

    // Calculate speed
    const speedMultiplier = paveState.hasSlowMo ? 0.5 : 1;
    const difficultySpeed = Math.min(
      MAX_SPEED,
      BASE_SPEED + snap.distance * 0.01
    );
    gameSpeedRef.current = difficultySpeed * speedMultiplier;

    // Update distance
    paveState.distance += gameSpeedRef.current * delta;

    // Update world every 500m
    const newWorld = Math.floor(snap.distance / 500) % WORLDS.length;
    if (newWorld !== snap.world) {
      paveState.world = newWorld;
    }

    // Update power-up timers
    if (paveState.shieldTimer > 0) {
      paveState.shieldTimer -= delta;
      if (paveState.shieldTimer <= 0) paveState.hasShield = false;
    }
    if (paveState.magnetTimer > 0) {
      paveState.magnetTimer -= delta;
      if (paveState.magnetTimer <= 0) paveState.hasMagnet = false;
    }
    if (paveState.slowMoTimer > 0) {
      paveState.slowMoTimer -= delta;
      if (paveState.slowMoTimer <= 0) paveState.hasSlowMo = false;
    }
    if (paveState.doublePointsTimer > 0) {
      paveState.doublePointsTimer -= delta;
      if (paveState.doublePointsTimer <= 0) paveState.hasDoublePoints = false;
    }

    // Move entities toward player
    setEntities((prev) => {
      return prev
        .map((entity) => {
          if (entity.collected) return entity;

          const newZ = entity.position.z + gameSpeedRef.current * delta;
          entity.position.z = newZ;
          return entity;
        })
        .filter((entity) => entity.position.z < 10); // Remove passed entities
    });

    // Check collisions
    const playerX = LANES[playerLane];
    const playerZ = 0;

    const collisionEvents: Array<{
      type: 'match' | 'mismatch' | 'obstacle' | 'powerup';
      x: number;
      y: number;
      z: number;
      color: string;
      perfect?: boolean;
      powerUp?: PowerUpType;
    }> = [];
    const previousTier = paveState.streakTier;
    const previousCombo = paveState.combo;

    setEntities((prev) => {
      return prev.map((entity) => {
        if (entity.collected) return entity;

        const laneDist = Math.abs(entity.position.x - playerX);
        const zDist = Math.abs(entity.position.z - playerZ);
        const inHitWindow =
          laneDist < COLLECTION_DISTANCE * 0.45 && zDist < HIT_WINDOW_Z;

        if (inHitWindow) {
          if (entity.type === 'shape') {
            const isMatch = entity.shape === paveState.currentShape;
            const perfect = zDist < PERFECT_WINDOW_Z;
            paveState.collectShape(isMatch, perfect ? 'perfect' : 'normal');
            if (isMatch) {
              collisionEvents.push({
                type: 'match',
                x: entity.position.x,
                y: 1,
                z: entity.position.z,
                color: SHAPE_COLORS[entity.shape!],
                perfect,
              });
            } else {
              collisionEvents.push({
                type: 'mismatch',
                x: entity.position.x,
                y: 1,
                z: entity.position.z,
                color: '#ff3b6f',
              });
            }
            return { ...entity, collected: true };
          } else if (entity.type === 'obstacle') {
            paveState.loseLife();
            collisionEvents.push({
              type: 'obstacle',
              x: entity.position.x,
              y: 1,
              z: entity.position.z,
              color: '#ff4d4d',
            });
            return { ...entity, collected: true };
          } else if (entity.type === 'powerup' && entity.powerUp) {
            paveState.activatePowerUp(entity.powerUp);
            collisionEvents.push({
              type: 'powerup',
              x: entity.position.x,
              y: 1,
              z: entity.position.z,
              color: POWERUP_COLORS[entity.powerUp],
              powerUp: entity.powerUp,
            });
            return { ...entity, collected: true };
          }
        }
        return entity;
      });
    });

    if (collisionEvents.length > 0) {
      for (const event of collisionEvents) {
        if (event.type === 'match') {
          spawnBurst(
            event.x,
            event.y,
            event.z,
            event.color,
            event.perfect ? 22 : 14,
            event.perfect
              ? { speedMin: 3.6, speedMax: 6.2, sizeMin: 0.07, sizeMax: 0.15 }
              : undefined
          );
          spawnShockRing(
            event.x,
            event.y,
            event.z,
            event.color,
            event.perfect
              ? {
                  life: 0.62,
                  startRadius: 0.24,
                  endRadius: 2.6,
                  thickness: 0.2,
                }
              : {
                  life: 0.45,
                  startRadius: 0.16,
                  endRadius: 1.6,
                  thickness: 0.14,
                }
          );
          cameraShakeRef.current = Math.min(
            1,
            cameraShakeRef.current + (event.perfect ? 0.24 : 0.08)
          );
          if (event.perfect) {
            pushCallout('PERFECT HIT', '#67e8f9', 0.52);
          }
        } else if (event.type === 'powerup') {
          spawnBurst(event.x, event.y, event.z, event.color, 18);
          spawnShockRing(event.x, event.y, event.z, event.color, {
            life: 0.7,
            startRadius: 0.25,
            endRadius: 3.0,
            thickness: 0.18,
          });
          pushCallout(
            event.powerUp === 'extraLife'
              ? 'EXTRA LIFE'
              : `${event.powerUp?.toUpperCase()} ON`,
            event.color,
            0.72
          );
          cameraShakeRef.current = Math.min(1, cameraShakeRef.current + 0.12);
        } else {
          spawnBurst(event.x, event.y, event.z, event.color, 28, {
            speedMin: 3.2,
            speedMax: 7.2,
            sizeMin: 0.08,
            sizeMax: 0.18,
          });
          spawnShockRing(event.x, event.y, event.z, event.color, {
            life: 0.78,
            startRadius: 0.28,
            endRadius: 3.6,
            thickness: 0.24,
          });
          pushCallout('MISS', '#ff6b9a', 0.65);
          cameraShakeRef.current = Math.min(1, cameraShakeRef.current + 0.9);
        }
      }
    }

    if (paveState.combo >= 5 && paveState.combo !== previousCombo && paveState.combo % 5 === 0) {
      const bonus = 20 + paveState.streakTier * 12;
      paveState.score += bonus * (paveState.hasDoublePoints ? 2 : 1);
      pushCallout(`COMBO x${paveState.combo + 1} +${bonus}`, '#f0abfc', 0.78);
      spawnShockRing(playerX, 1, 0, '#f0abfc', {
        life: 0.66,
        startRadius: 0.22,
        endRadius: 3.2,
        thickness: 0.2,
      });
      cameraShakeRef.current = Math.min(1, cameraShakeRef.current + 0.16);
    }

    if (paveState.streakTier > previousTier) {
      pushCallout(`STREAK TIER ${paveState.streakTier}`, '#a5f3fc', 0.85);
      spawnBurst(playerX, 1, -0.4, '#a5f3fc', 26, {
        speedMin: 2.4,
        speedMax: 5.4,
        sizeMin: 0.07,
        sizeMax: 0.16,
      });
      spawnShockRing(playerX, 1, -0.4, '#67e8f9', {
        life: 0.72,
        startRadius: 0.3,
        endRadius: 3.8,
        thickness: 0.22,
      });
      cameraShakeRef.current = Math.min(1, cameraShakeRef.current + 0.22);
    }

    // Spawn new entities continuously
    nextSpawnTime.current -= delta;

    if (nextSpawnTime.current <= 0) {
      // Calculate spawn interval (gets faster as game progresses)
      const baseInterval = 0.8;
      const minInterval = 0.3;
      const spawnInterval = Math.max(
        minInterval,
        baseInterval - snap.distance * 0.0005
      );
      nextSpawnTime.current = spawnInterval + rngRef.current.range(-0.2, 0.2);

      const lane = rngRef.current.int(0, 2);
      const rand = rngRef.current.next();

      let newEntity: Entity;

      // Spawn probabilities (obstacles get more common over time)
      const obstacleChance = Math.min(0.2, 0.05 + snap.distance * 0.0002);
      const powerUpChance = 0.05;

      if (rand < obstacleChance) {
        // Spawn obstacle
        newEntity = {
          id: entityIdRef.current++,
          type: 'obstacle',
          position: new THREE.Vector3(LANES[lane], 1, -SPAWN_DISTANCE),
          collected: false,
          lane,
        };
      } else if (rand < obstacleChance + powerUpChance) {
        // Spawn power-up
        const powerUps: PowerUpType[] = [
          'shield',
          'magnet',
          'slow',
          'doublePoints',
          'extraLife',
        ];
        newEntity = {
          id: entityIdRef.current++,
          type: 'powerup',
          powerUp: rngRef.current.pick(powerUps),
          position: new THREE.Vector3(LANES[lane], 1, -SPAWN_DISTANCE),
          collected: false,
          lane,
        };
      } else {
        // Spawn collectible shape
        newEntity = {
          id: entityIdRef.current++,
          type: 'shape',
          shape: rngRef.current.pick(SHAPES),
          position: new THREE.Vector3(LANES[lane], 1, -SPAWN_DISTANCE),
          collected: false,
          lane,
        };
      }

      setEntities((prev) => [...prev, newEntity]);
    }

    setFxParticles((prev) =>
      prev
        .map((p) => ({
          ...p,
          x: p.x + p.vx * delta,
          y: p.y + p.vy * delta,
          z: p.z + p.vz * delta,
          vx: p.vx * Math.pow(0.9, delta * 60),
          vy: p.vy * Math.pow(0.9, delta * 60),
          vz: p.vz * Math.pow(0.9, delta * 60),
          life: p.life - delta * 1.7,
          spin: p.spin + delta * 3.2,
        }))
        .filter((p) => p.life > 0)
    );

    setShockRings((prev) =>
      prev
        .map((r) => ({
          ...r,
          life: r.life - delta,
        }))
        .filter((r) => r.life > 0)
    );

    setHudCallout((prev) => {
      if (!prev) return null;
      const nextLife = prev.life - delta;
      if (nextLife <= 0) return null;
      return { ...prev, life: nextLife };
    });

    cameraShakeRef.current = Math.max(0, cameraShakeRef.current - delta * 2.1);
    const shake = cameraShakeRef.current * cameraShakeRef.current;
    const t = state.clock.elapsedTime;
    if (hitFlashRef.current) {
      hitFlashRef.current.opacity = shake * 0.18;
    }

    // Camera position
    const laneTargetX =
      LANES[playerLane] * 0.3 + Math.sin(t * 34.2 + 0.7) * shake * 0.22;
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      laneTargetX,
      delta * 4.2
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      6 + Math.cos(t * 28.5 + 1.6) * shake * 0.16,
      delta * 4
    );
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      8 + shake * 0.22,
      delta * 4
    );
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[0, 5, -10]} intensity={0.5} color={world.accent} />

      {/* Fog */}
      <fog attach="fog" args={[world.bg, 20, 60]} />

      {/* Ground */}
      <Ground color={world.ground} accentColor={world.accent} />

      {/* Player */}
      <Player
        lane={playerLane}
        shape={snap.currentShape}
        hasShield={snap.hasShield}
      />

      {/* Entities */}
      {entities.map((entity) => (
        <CollectibleEntity
          key={entity.id}
          entity={entity}
          playerLane={playerLane}
          playerShape={snap.currentShape}
          hasMagnet={snap.hasMagnet}
        />
      ))}

      {/* FX particles */}
      {fxParticles.map((p) => (
        <group key={p.id} position={[p.x, p.y, p.z]}>
          <mesh rotation={[p.spin, p.spin * 0.5, p.spin * 0.2]}>
            <octahedronGeometry args={[p.size * (0.45 + p.life * 0.8)]} />
            <meshBasicMaterial
              color={p.color}
              transparent
              opacity={p.life * 0.85}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[p.size * (0.8 + p.life), 10, 10]} />
            <meshBasicMaterial
              color={p.color}
              transparent
              opacity={p.life * 0.22}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Shock rings */}
      {shockRings.map((ring) => {
        const t = 1 - ring.life / ring.maxLife;
        const radius = THREE.MathUtils.lerp(ring.startRadius, ring.endRadius, t);
        return (
          <mesh key={ring.id} position={[ring.x, ring.y - 0.2, ring.z]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius, radius + ring.thickness, 48]} />
            <meshBasicMaterial
              color={ring.color}
              transparent
              opacity={ring.life / ring.maxLife * 0.45}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {/* Hit flash */}
      <mesh position={[0, 3.2, -6]} renderOrder={120}>
        <planeGeometry args={[26, 16]} />
        <meshBasicMaterial
          ref={hitFlashRef}
          color="#ff2b61"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* HUD */}
      <GameHUD />

      {/* Dynamic callout */}
      {hudCallout && (
        <Html
          center
          position={[0, 4.2, -4]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="px-4 py-1.5 rounded-xl border text-sm font-semibold tracking-wider backdrop-blur-sm"
            style={{
              color: hudCallout.color,
              borderColor: `${hudCallout.color}66`,
              background: 'rgba(0,0,0,0.45)',
              opacity: hudCallout.life / hudCallout.maxLife,
              transform: `translateY(${(1 - hudCallout.life / hudCallout.maxLife) * -8}px)`,
            }}
          >
            {hudCallout.text}
          </div>
        </Html>
      )}
    </>
  );
};

export default Pave;
