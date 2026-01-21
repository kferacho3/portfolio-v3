/**
 * Gyro.tsx (GateShift)
 * 
 * 3D Tunnel Runner with Shape-Morphing
 * Morph your shape to match gates before passing through them
 * Inspired by Super Hexagon + Color Switch mechanics
 */
'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import { SeededRandom } from '../../utils/seededRandom';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type GateShape = 'circle' | 'square' | 'triangle' | 'pentagon' | 'hexagon' | 'heptagon' | 'octagon';
type DifficultyMode = 'easy' | 'medium' | 'hard';

const DIFFICULTY_SETTINGS: Record<DifficultyMode, { shapes: GateShape[]; gateSpacing: number }> = {
  easy: {
    shapes: ['circle', 'square', 'triangle'],
    gateSpacing: 12,
  },
  medium: {
    shapes: ['circle', 'square', 'triangle', 'pentagon', 'hexagon'],
    gateSpacing: 10,
  },
  hard: {
    shapes: ['circle', 'square', 'triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon'],
    gateSpacing: 8,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const gyroState = proxy({
  score: 0,
  highScore: 0,
  combo: 0,
  gameOver: false,
  paletteIndex: 0,
  difficulty: 1,
  difficultyMode: 'medium' as DifficultyMode,
  playerShape: 'circle' as GateShape,
  gatesPassed: 0,
  setDifficultyMode: (mode: DifficultyMode) => {
    gyroState.difficultyMode = mode;
    const allowedShapes = DIFFICULTY_SETTINGS[mode].shapes;
    if (!allowedShapes.includes(gyroState.playerShape)) {
      gyroState.playerShape = allowedShapes[0];
    }
  },
  reset: () => {
    gyroState.score = 0;
    gyroState.combo = 0;
    gyroState.gameOver = false;
    gyroState.difficulty = 1;
    gyroState.paletteIndex = 0;
    gyroState.playerShape = DIFFICULTY_SETTINGS[gyroState.difficultyMode].shapes[0];
    gyroState.gatesPassed = 0;
  },
  cycleShape: () => {
    const allowedShapes = DIFFICULTY_SETTINGS[gyroState.difficultyMode].shapes;
    const currentIndex = allowedShapes.indexOf(gyroState.playerShape);
    gyroState.playerShape = allowedShapes[(currentIndex + 1) % allowedShapes.length];
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TUNNEL_RADIUS = 4;
const TUNNEL_LENGTH = 100;
const PLAYER_SIZE = 0.4;
const PLAYER_Z = 5;
const BASE_SPEED = 10;
const SPEED_RAMP = 0.5;
const GATE_COUNT = 15;
const GATE_PASS_WINDOW = 0.5;
const GATE_DESPAWN_Z = PLAYER_Z + 6;
const PALETTE_SHIFT_INTERVAL = 5; // Shift palette every N gates

// Shape colors for visual clarity
const SHAPE_COLORS: Record<GateShape, string> = {
  circle: '#00ffff',
  square: '#ff6b6b',
  triangle: '#feca57',
  pentagon: '#48dbfb',
  hexagon: '#ff9ff3',
  heptagon: '#2ecc71',
  octagon: '#ffa502',
};

// Color palettes for backgrounds
const PALETTES = [
  { bg: '#0a0a1a', accent: '#ff0055', glow: '#ff0055' },
  { bg: '#1a0a1a', accent: '#00ff88', glow: '#00ff88' },
  { bg: '#0a1a1a', accent: '#ff8800', glow: '#ff8800' },
  { bg: '#1a1a0a', accent: '#ff00ff', glow: '#ff00ff' },
  { bg: '#0a0a2a', accent: '#00ffff', glow: '#00ffff' },
];

// ═══════════════════════════════════════════════════════════════════════════
// GATE GENERATION
// ═══════════════════════════════════════════════════════════════════════════

interface Gate {
  id: string;
  z: number;
  shape: GateShape;
  rotation: number;
  passed: boolean;
}

const generateGate = (rng: SeededRandom, z: number, shapes: GateShape[]): Gate => {
  return {
    id: `gate-${z}-${Date.now()}-${Math.random()}`,
    z,
    shape: rng.pick(shapes),
    rotation: rng.float(0, Math.PI * 2),
    passed: false,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const createShapeGeometry = (shape: GateShape, size: number): THREE.BufferGeometry => {
  switch (shape) {
    case 'circle':
      return new THREE.CircleGeometry(size, 32);
    case 'square':
      return new THREE.PlaneGeometry(size * 1.6, size * 1.6);
    case 'triangle':
      return new THREE.CircleGeometry(size, 3);
    case 'pentagon':
      return new THREE.CircleGeometry(size, 5);
    case 'hexagon':
      return new THREE.CircleGeometry(size, 6);
    case 'heptagon':
      return new THREE.CircleGeometry(size, 7);
    case 'octagon':
      return new THREE.CircleGeometry(size, 8);
    default:
      return new THREE.CircleGeometry(size, 32);
  }
};

const createGateOutline = (shape: GateShape, innerRadius: number, outerRadius: number): THREE.BufferGeometry => {
  const getPoints = (r: number, sides: number): THREE.Vector2[] => {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      points.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    return points;
  };

  let sides: number;
  switch (shape) {
    case 'circle': sides = 32; break;
    case 'square': sides = 4; break;
    case 'triangle': sides = 3; break;
    case 'pentagon': sides = 5; break;
    case 'hexagon': sides = 6; break;
    case 'heptagon': sides = 7; break;
    case 'octagon': sides = 8; break;
    default: sides = 32;
  }

  const outerPoints = getPoints(outerRadius, sides);
  const innerPoints = getPoints(innerRadius, sides).reverse();

  const outerShape = new THREE.Shape(outerPoints);
  const holePath = new THREE.Path(innerPoints);
  outerShape.holes.push(holePath);

  return new THREE.ExtrudeGeometry(outerShape, {
    steps: 1,
    depth: 0.3,
    bevelEnabled: false,
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Gate component with shape-specific outline
const GateComponent: React.FC<{
  gate: Gate;
  zOffset: number;
  isNext?: boolean;
}> = ({ gate, zOffset, isNext = false }) => {
  const groupRef = useRef<THREE.Group>(null);
  const shapeColor = SHAPE_COLORS[gate.shape];
  const outlineOpacity = isNext ? 0.95 : 0.8;
  const outlineEmissive = isNext ? 0.9 : 0.5;
  const indicatorSize = isNext ? 0.7 : 0.55;
  const indicatorOpacity = isNext ? 0.85 : 0.6;
  const indicatorEmissive = isNext ? 1.2 : 0.8;

  const geometry = useMemo(
    () => createGateOutline(gate.shape, 1.5, TUNNEL_RADIUS),
    [gate.shape]
  );

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.3;
    }
  });

  return (
    <group position={[0, 0, gate.z + zOffset]} rotation={[0, 0, gate.rotation]} ref={groupRef}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={shapeColor}
          emissive={shapeColor}
          emissiveIntensity={outlineEmissive}
          transparent
          opacity={outlineOpacity}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Shape indicator in center */}
      <mesh position={[0, 0, 0.2]}>
        {gate.shape === 'circle' && <circleGeometry args={[indicatorSize, 32]} />}
        {gate.shape === 'square' && <planeGeometry args={[indicatorSize * 1.6, indicatorSize * 1.6]} />}
        {gate.shape === 'triangle' && <circleGeometry args={[indicatorSize, 3]} />}
        {gate.shape === 'pentagon' && <circleGeometry args={[indicatorSize, 5]} />}
        {gate.shape === 'hexagon' && <circleGeometry args={[indicatorSize, 6]} />}
        {gate.shape === 'heptagon' && <circleGeometry args={[indicatorSize, 7]} />}
        {gate.shape === 'octagon' && <circleGeometry args={[indicatorSize, 8]} />}
        <meshStandardMaterial
          color={shapeColor}
          emissive={shapeColor}
          emissiveIntensity={indicatorEmissive}
          transparent
          opacity={indicatorOpacity}
        />
      </mesh>
    </group>
  );
};

// Player shape that morphs
const Player: React.FC<{
  shape: GateShape;
}> = ({ shape }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = SHAPE_COLORS[shape];

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 2;
    }
  });

  return (
    <group position={[0, 0, PLAYER_Z]}>
      <mesh ref={meshRef}>
        {shape === 'circle' && <circleGeometry args={[PLAYER_SIZE, 32]} />}
        {shape === 'square' && <planeGeometry args={[PLAYER_SIZE * 1.6, PLAYER_SIZE * 1.6]} />}
        {shape === 'triangle' && <circleGeometry args={[PLAYER_SIZE, 3]} />}
        {shape === 'pentagon' && <circleGeometry args={[PLAYER_SIZE, 5]} />}
        {shape === 'hexagon' && <circleGeometry args={[PLAYER_SIZE, 6]} />}
        {shape === 'heptagon' && <circleGeometry args={[PLAYER_SIZE, 7]} />}
        {shape === 'octagon' && <circleGeometry args={[PLAYER_SIZE, 8]} />}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight color={color} intensity={1} distance={3} />
    </group>
  );
};

const ShapeIndicator: React.FC<{
  label: string;
  shape: GateShape;
}> = ({ label, shape }) => {
  const color = SHAPE_COLORS[shape];

  return (
    <div
      className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-center border"
      style={{ borderColor: color }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-1">
        {label}
      </div>
      <div className="text-lg font-bold capitalize" style={{ color }}>
        {shape}
      </div>
    </div>
  );
};

const DifficultySelector: React.FC<{
  value: DifficultyMode;
  onChange: (mode: DifficultyMode) => void;
}> = ({ value, onChange }) => {
  const buttonStyles: Record<DifficultyMode, string> = {
    easy: 'bg-emerald-500/80 text-white',
    medium: 'bg-amber-500/80 text-white',
    hard: 'bg-rose-500/80 text-white',
  };

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-1">
        Difficulty
      </div>
      <div className="flex gap-2">
        {(['easy', 'medium', 'hard'] as const).map((mode) => {
          const isActive = value === mode;
          return (
            <button
              key={mode}
              onClick={() => onChange(mode)}
              className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider transition ${
                isActive ? buttonStyles[mode] : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              {mode} ({DIFFICULTY_SETTINGS[mode].shapes.length})
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Tunnel wireframe for depth perception
const TunnelWireframe: React.FC<{ color: string }> = ({ color }) => {
  const lines = useMemo(() => {
    const result: JSX.Element[] = [];
    const segments = 12;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const points = [];
      for (let z = 0; z < TUNNEL_LENGTH; z += 5) {
        const x = Math.cos(angle) * TUNNEL_RADIUS;
        const y = Math.sin(angle) * TUNNEL_RADIUS;
        points.push(new THREE.Vector3(x, y, -z));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      result.push(
        <line key={`long-${i}`} geometry={geometry}>
          <lineBasicMaterial color={color} opacity={0.15} transparent />
        </line>
      );
    }

    return result;
  }, [color]);

  return <group>{lines}</group>;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Gyro: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(gyroState);
  const { camera, scene } = useThree();

  const [gates, setGates] = useState<Gate[]>([]);
  const [zTravel, setZTravel] = useState(0);

  const rngRef = useRef(new SeededRandom(Date.now()));
  const lastGateZ = useRef(0);
  const passedGateIds = useRef(new Set<string>());

  const palette = PALETTES[snap.paletteIndex % PALETTES.length];
  const difficultyConfig = DIFFICULTY_SETTINGS[snap.difficultyMode];
  const gateSpacing = difficultyConfig.gateSpacing;
  const activeShapes = difficultyConfig.shapes;

  const initGates = useCallback((mode: DifficultyMode) => {
    const { shapes, gateSpacing } = DIFFICULTY_SETTINGS[mode];
    const initialGates: Gate[] = [];
    for (let i = 0; i < GATE_COUNT; i++) {
      const z = -i * gateSpacing - 15;
      initialGates.push(generateGate(rngRef.current, z, shapes));
      lastGateZ.current = z;
    }
    setGates(initialGates);
  }, []);

  const nextGate = useMemo(() => {
    let closest: Gate | null = null;
    let smallestDistance = Number.POSITIVE_INFINITY;

    for (const gate of gates) {
      const gateWorldZ = gate.z + zTravel;
      const distance = PLAYER_Z - gateWorldZ;

      if (distance >= 0 && distance < smallestDistance) {
        smallestDistance = distance;
        closest = gate;
      }
    }

    return closest;
  }, [gates, zTravel]);

  const handleDifficultyChange = useCallback(
    (mode: DifficultyMode) => {
      if (mode === gyroState.difficultyMode) return;
      gyroState.setDifficultyMode(mode);
      gyroState.reset();
      setZTravel(0);
      passedGateIds.current.clear();
      rngRef.current = new SeededRandom(Date.now());
      initGates(mode);
    },
    [initGates]
  );

  // Camera setup
  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, -50);
    scene.background = new THREE.Color(palette.bg);
  }, [camera, scene, palette.bg]);

  // Generate initial gates
  useEffect(() => {
    initGates(gyroState.difficultyMode);
  }, [initGates]);

  // Reset passed gates on game reset
  useEffect(() => {
    if (!snap.gameOver) {
      passedGateIds.current.clear();
    }
  }, [snap.gameOver]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') {
        handleDifficultyChange('easy');
        return;
      }
      if (e.key === '2') {
        handleDifficultyChange('medium');
        return;
      }
      if (e.key === '3') {
        handleDifficultyChange('hard');
        return;
      }

      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r') {
          gyroState.reset();
          setZTravel(0);
          passedGateIds.current.clear();
          rngRef.current = new SeededRandom(Date.now());
          initGates(gyroState.difficultyMode);
        }
        return;
      }

      // Shape cycling: Space or Click
      if (e.code === 'Space') {
        e.preventDefault();
        gyroState.cycleShape();
      }
    };

    const handleClick = () => {
      if (!snap.gameOver) {
        gyroState.cycleShape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
    };
  }, [snap.gameOver, handleDifficultyChange, initGates]);

  // Game loop
  useFrame((_, delta) => {
    if (snap.gameOver) return;

    // Move forward
    const speed = BASE_SPEED + snap.difficulty * SPEED_RAMP;
    const nextZTravel = zTravel + speed * delta;
    setZTravel(nextZTravel);

    // Gate management and collision
    setGates((prev) => {
      let updated = [...prev];

      // Check gates near player
      for (const gate of updated) {
        const gateWorldZ = gate.z + nextZTravel;

        // Gate is at player position
        if (Math.abs(gateWorldZ - PLAYER_Z) < GATE_PASS_WINDOW && !passedGateIds.current.has(gate.id)) {
          passedGateIds.current.add(gate.id);

          if (gate.shape === gyroState.playerShape) {
            // Success! Shape matches
            gyroState.combo += 1;
            gyroState.score += 10 * (1 + gyroState.combo * 0.1);
            gyroState.gatesPassed += 1;

            // Increase difficulty every 10 gates
            if (gyroState.gatesPassed % 10 === 0) {
              gyroState.difficulty += 0.2;
            }

            // Palette shift every N gates
            if (gyroState.gatesPassed % PALETTE_SHIFT_INTERVAL === 0) {
              gyroState.paletteIndex += 1;
            }

            // Update high score
            if (gyroState.score > gyroState.highScore) {
              gyroState.highScore = gyroState.score;
            }
          } else {
            // Failure! Shape mismatch
            gyroState.gameOver = true;
          }
        }
      }

      // Remove old gates
      updated = updated.filter((g) => g.z + nextZTravel < GATE_DESPAWN_Z);

      // Add new gates
      while (lastGateZ.current + nextZTravel > -GATE_COUNT * gateSpacing - 20) {
        lastGateZ.current -= gateSpacing;
        updated.push(generateGate(rngRef.current, lastGateZ.current, activeShapes));
      }

      return updated;
    });
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 10]} intensity={1} color={palette.glow} />

      {/* Tunnel wireframe */}
      <TunnelWireframe color={palette.accent} />

      {/* Gates */}
      {gates.map((gate) => (
        <GateComponent
          key={gate.id}
          gate={gate}
          zOffset={zTravel}
          isNext={gate.id === nextGate?.id}
        />
      ))}

      {/* Player */}
      <Player shape={snap.playerShape} />

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto flex flex-col sm:flex-row items-start gap-3">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-white">
            <div className="text-3xl font-bold font-mono">{Math.floor(snap.score)}</div>
            <div className="text-xs text-white/60 mt-1">Combo: x{snap.combo + 1}</div>
            <div className="text-xs text-white/40">Best: {Math.floor(snap.highScore)}</div>
          </div>
          <div className="flex flex-col gap-2">
            <ShapeIndicator label="Current" shape={snap.playerShape} />
            {nextGate && <ShapeIndicator label="Next Gate" shape={nextGate.shape} />}
          </div>
        </div>

        <div className="absolute bottom-20 left-4 z-50 pointer-events-auto">
          <DifficultySelector value={snap.difficultyMode} onChange={handleDifficultyChange} />
        </div>

        {/* Controls hint */}
        <div className="absolute bottom-4 left-4 text-white/60 text-sm pointer-events-auto">
          <div>Space/Click to change shape</div>
          <div className="text-xs mt-1">1/2/3 to set difficulty | Match the gate shape</div>
        </div>

        {/* Game Over */}
        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
            <div className="text-center">
              <h1 className="text-5xl font-bold text-white mb-4">GAME OVER</h1>
              <p className="text-3xl text-white/80 mb-2">{Math.floor(snap.score)}</p>
              <p className="text-lg text-white/60 mb-1">Gates: {snap.gatesPassed}</p>
              <p className="text-lg text-white/60 mb-6">Best: {Math.floor(snap.highScore)}</p>
              <p className="text-white/50">Press R to restart</p>
            </div>
          </div>
        )}
      </Html>
    </>
  );
};

export default Gyro;
