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
import { SeededRandom } from '../utils/seededRandom';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type GateShape = 'circle' | 'square' | 'triangle' | 'pentagon' | 'hexagon';

const GATE_SHAPES: GateShape[] = ['circle', 'square', 'triangle', 'pentagon', 'hexagon'];

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
  playerShape: 'circle' as GateShape,
  gatesPassed: 0,
  reset: () => {
    gyroState.score = 0;
    gyroState.combo = 0;
    gyroState.gameOver = false;
    gyroState.difficulty = 1;
    gyroState.paletteIndex = 0;
    gyroState.playerShape = 'circle';
    gyroState.gatesPassed = 0;
  },
  cycleShape: () => {
    const currentIndex = GATE_SHAPES.indexOf(gyroState.playerShape);
    gyroState.playerShape = GATE_SHAPES[(currentIndex + 1) % GATE_SHAPES.length];
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TUNNEL_RADIUS = 4;
const TUNNEL_LENGTH = 100;
const PLAYER_SIZE = 0.4;
const BASE_SPEED = 10;
const SPEED_RAMP = 0.5;
const GATE_SPACING = 8;
const GATE_COUNT = 15;
const PALETTE_SHIFT_INTERVAL = 5; // Shift palette every N gates

// Shape colors for visual clarity
const SHAPE_COLORS: Record<GateShape, string> = {
  circle: '#00ffff',
  square: '#ff6b6b',
  triangle: '#feca57',
  pentagon: '#48dbfb',
  hexagon: '#ff9ff3',
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

const generateGate = (rng: SeededRandom, z: number, difficulty: number): Gate => {
  return {
    id: `gate-${z}-${Date.now()}-${Math.random()}`,
    z,
    shape: rng.pick(GATE_SHAPES),
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
  color: string;
}> = ({ gate, zOffset, color }) => {
  const groupRef = useRef<THREE.Group>(null);
  const shapeColor = SHAPE_COLORS[gate.shape];

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
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Shape indicator in center */}
      <mesh position={[0, 0, 0.2]}>
        {gate.shape === 'circle' && <circleGeometry args={[0.5, 32]} />}
        {gate.shape === 'square' && <planeGeometry args={[0.8, 0.8]} />}
        {gate.shape === 'triangle' && <circleGeometry args={[0.5, 3]} />}
        {gate.shape === 'pentagon' && <circleGeometry args={[0.5, 5]} />}
        {gate.shape === 'hexagon' && <circleGeometry args={[0.5, 6]} />}
        <meshStandardMaterial
          color={shapeColor}
          emissive={shapeColor}
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
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
    <group position={[0, 0, 5]}>
      <mesh ref={meshRef}>
        {shape === 'circle' && <circleGeometry args={[PLAYER_SIZE, 32]} />}
        {shape === 'square' && <planeGeometry args={[PLAYER_SIZE * 1.6, PLAYER_SIZE * 1.6]} />}
        {shape === 'triangle' && <circleGeometry args={[PLAYER_SIZE, 3]} />}
        {shape === 'pentagon' && <circleGeometry args={[PLAYER_SIZE, 5]} />}
        {shape === 'hexagon' && <circleGeometry args={[PLAYER_SIZE, 6]} />}
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

  // Camera setup
  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, -50);
    scene.background = new THREE.Color(palette.bg);
  }, [camera, scene, palette.bg]);

  // Generate initial gates
  useEffect(() => {
    const initialGates: Gate[] = [];
    for (let i = 0; i < GATE_COUNT; i++) {
      const z = -i * GATE_SPACING - 15;
      initialGates.push(generateGate(rngRef.current, z, 1));
      lastGateZ.current = z;
    }
    setGates(initialGates);
  }, []);

  // Reset passed gates on game reset
  useEffect(() => {
    if (!snap.gameOver) {
      passedGateIds.current.clear();
    }
  }, [snap.gameOver]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r') {
          gyroState.reset();
          setGates([]);
          setZTravel(0);
          lastGateZ.current = 0;
          passedGateIds.current.clear();
          rngRef.current = new SeededRandom(Date.now());
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
  }, [snap.gameOver]);

  // Game loop
  useFrame((_, delta) => {
    if (snap.gameOver) return;

    // Move forward
    const speed = BASE_SPEED + snap.difficulty * SPEED_RAMP;
    setZTravel((prev) => prev + speed * delta);

    // Gate management and collision
    setGates((prev) => {
      let updated = [...prev];

      // Check gates near player (z = 5 is player position)
      for (const gate of updated) {
        const gateWorldZ = gate.z + zTravel;

        // Gate is at player position
        if (gateWorldZ > 4.5 && gateWorldZ < 5.5 && !passedGateIds.current.has(gate.id)) {
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
      updated = updated.filter((g) => g.z + zTravel > -5);

      // Add new gates
      while (lastGateZ.current + zTravel > -GATE_COUNT * GATE_SPACING - 20) {
        lastGateZ.current -= GATE_SPACING;
        updated.push(generateGate(rngRef.current, lastGateZ.current, gyroState.difficulty));
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
          color={palette.accent}
        />
      ))}

      {/* Player */}
      <Player shape={snap.playerShape} />

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-white">
            <div className="text-3xl font-bold font-mono">{Math.floor(snap.score)}</div>
            <div className="text-xs text-white/60 mt-1">Combo: x{snap.combo + 1}</div>
            <div className="text-xs text-white/40">Best: {Math.floor(snap.highScore)}</div>
          </div>
        </div>

        {/* Current shape indicator */}
        <div className="absolute top-4 left-40 z-50 pointer-events-auto">
          <div 
            className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-center"
            style={{ borderColor: SHAPE_COLORS[snap.playerShape], borderWidth: 2 }}
          >
            <div 
              className="text-lg font-bold capitalize"
              style={{ color: SHAPE_COLORS[snap.playerShape] }}
            >
              {snap.playerShape}
            </div>
          </div>
        </div>

        {/* Controls hint */}
        <div className="absolute bottom-4 left-4 text-white/60 text-sm pointer-events-auto">
          <div>Space or Click to change shape</div>
          <div className="text-xs mt-1">Match the gate shape to pass through</div>
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
