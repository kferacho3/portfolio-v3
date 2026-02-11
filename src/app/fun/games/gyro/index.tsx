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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import { SeededRandom } from '../../utils/seededRandom';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type GateShape =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'pentagon'
  | 'hexagon'
  | 'heptagon'
  | 'octagon';
type DifficultyMode = 'easy' | 'medium' | 'hard';

const DIFFICULTY_SETTINGS: Record<
  DifficultyMode,
  {
    shapes: GateShape[];
    gateSpacing: number;
    speedMul: number;
    rampMul: number;
    maxSpeed: number;
    difficultyStep: number;
    passOffset: number;
  }
> = {
  easy: {
    shapes: ['circle', 'square', 'triangle'],
    gateSpacing: 14,
    speedMul: 0.9,
    rampMul: 0.8,
    maxSpeed: 9.8,
    difficultyStep: 0.1,
    passOffset: 0.24,
  },
  medium: {
    shapes: ['circle', 'square', 'triangle', 'pentagon', 'hexagon'],
    gateSpacing: 12.5,
    speedMul: 1,
    rampMul: 0.95,
    maxSpeed: 10.9,
    difficultyStep: 0.12,
    passOffset: 0.2,
  },
  hard: {
    shapes: [
      'circle',
      'square',
      'triangle',
      'pentagon',
      'hexagon',
      'heptagon',
      'octagon',
    ],
    gateSpacing: 11,
    speedMul: 1.08,
    rampMul: 1.05,
    maxSpeed: 11.8,
    difficultyStep: 0.14,
    passOffset: 0.16,
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
    gyroState.playerShape =
      DIFFICULTY_SETTINGS[gyroState.difficultyMode].shapes[0];
    gyroState.gatesPassed = 0;
  },
  cycleShape: () => {
    gyroState.cycleShapeBy(1);
  },
  cycleShapeBy: (dir: 1 | -1) => {
    const allowedShapes = DIFFICULTY_SETTINGS[gyroState.difficultyMode].shapes;
    const currentIndex = allowedShapes.indexOf(gyroState.playerShape);
    const len = allowedShapes.length;
    const nextIndex = (currentIndex + dir + len) % len;
    gyroState.playerShape = allowedShapes[nextIndex];
  },
  cycleShapeReverse: () => {
    gyroState.cycleShapeBy(-1);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TUNNEL_RADIUS = 4;
const TUNNEL_LENGTH = 100;
const PLAYER_SIZE = 0.4;
const PLAYER_Z = 5;
const BASE_SPEED = 7.4;
const SPEED_RAMP = 0.34;
const GATE_COUNT = 15;
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
  { bg: '#090b18', accent: '#ff4d8f', glow: '#ff4d8f' },
  { bg: '#0a1418', accent: '#36f1cd', glow: '#36f1cd' },
  { bg: '#160f0a', accent: '#ffb347', glow: '#ffb347' },
  { bg: '#120a18', accent: '#bb86fc', glow: '#bb86fc' },
  { bg: '#081022', accent: '#46d8ff', glow: '#46d8ff' },
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

const generateGate = (
  rng: SeededRandom,
  z: number,
  shapes: GateShape[]
): Gate => {
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

const createShapeGeometry = (
  shape: GateShape,
  size: number
): THREE.BufferGeometry => {
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

const createGateOutline = (
  shape: GateShape,
  innerRadius: number,
  outerRadius: number
): THREE.BufferGeometry => {
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
    case 'circle':
      sides = 32;
      break;
    case 'square':
      sides = 4;
      break;
    case 'triangle':
      sides = 3;
      break;
    case 'pentagon':
      sides = 5;
      break;
    case 'hexagon':
      sides = 6;
      break;
    case 'heptagon':
      sides = 7;
      break;
    case 'octagon':
      sides = 8;
      break;
    default:
      sides = 32;
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
  distanceToPlayer: number;
}> = ({ gate, zOffset, isNext = false, distanceToPlayer }) => {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const shapeColor = SHAPE_COLORS[gate.shape];
  const focus = THREE.MathUtils.clamp(1 - distanceToPlayer / 28, 0.2, 1);
  const outlineOpacity = isNext ? 0.98 : 0.24 + focus * 0.42;
  const outlineEmissive = isNext ? 1.15 : 0.35 + focus * 0.28;
  const indicatorSize = isNext ? 0.82 : 0.52 + focus * 0.1;
  const indicatorOpacity = isNext ? 0.95 : 0.45 + focus * 0.28;
  const indicatorEmissive = isNext ? 1.35 : 0.7;

  const geometry = useMemo(
    () => createGateOutline(gate.shape, 1.5, TUNNEL_RADIUS),
    [gate.shape]
  );

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.3;
    }
    if (isNext && haloRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 6.2) * 0.08;
      haloRef.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <group
      position={[0, 0, gate.z + zOffset]}
      rotation={[0, 0, gate.rotation]}
      ref={groupRef}
    >
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
      {isNext && (
        <mesh ref={haloRef} position={[0, 0, 0.21]}>
          <ringGeometry args={[1.72, 2.16, 64]} />
          <meshBasicMaterial
            color={shapeColor}
            transparent
            opacity={0.58}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* Shape indicator in center */}
      <mesh position={[0, 0, 0.2]}>
        {gate.shape === 'circle' && (
          <circleGeometry args={[indicatorSize, 32]} />
        )}
        {gate.shape === 'square' && (
          <planeGeometry args={[indicatorSize * 1.6, indicatorSize * 1.6]} />
        )}
        {gate.shape === 'triangle' && (
          <circleGeometry args={[indicatorSize, 3]} />
        )}
        {gate.shape === 'pentagon' && (
          <circleGeometry args={[indicatorSize, 5]} />
        )}
        {gate.shape === 'hexagon' && (
          <circleGeometry args={[indicatorSize, 6]} />
        )}
        {gate.shape === 'heptagon' && (
          <circleGeometry args={[indicatorSize, 7]} />
        )}
        {gate.shape === 'octagon' && (
          <circleGeometry args={[indicatorSize, 8]} />
        )}
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
  const ringRef = useRef<THREE.Mesh>(null);
  const color = SHAPE_COLORS[shape];

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 2;
    }
    if (ringRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 5.1) * 0.06;
      ringRef.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <group position={[0, 0, PLAYER_Z]}>
      <mesh ref={meshRef}>
        {shape === 'circle' && <circleGeometry args={[PLAYER_SIZE, 32]} />}
        {shape === 'square' && (
          <planeGeometry args={[PLAYER_SIZE * 1.6, PLAYER_SIZE * 1.6]} />
        )}
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
      <mesh ref={ringRef} position={[0, 0, -0.02]}>
        <ringGeometry args={[PLAYER_SIZE * 1.45, PLAYER_SIZE * 1.8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
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
                isActive
                  ? buttonStyles[mode]
                  : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
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
      const material = new THREE.LineBasicMaterial({
        color,
        opacity: 0.15,
        transparent: true,
      });
      const lineObj = new THREE.Line(geometry, material);
      result.push(<primitive key={`long-${i}`} object={lineObj} />);
    }

    return result;
  }, [color]);

  const rings = useMemo(() => {
    const result: JSX.Element[] = [];
    for (let z = 0; z < TUNNEL_LENGTH; z += 6) {
      const alpha = THREE.MathUtils.clamp(1 - z / TUNNEL_LENGTH, 0.08, 0.38);
      result.push(
        <mesh key={`ring-${z}`} position={[0, 0, -z]}>
          <ringGeometry args={[TUNNEL_RADIUS - 0.06, TUNNEL_RADIUS + 0.03, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={alpha * 0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      );
    }
    return result;
  }, [color]);

  return (
    <group>
      {lines}
      {rings}
    </group>
  );
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
    const decisionPlaneZ = PLAYER_Z + difficultyConfig.passOffset;

    for (const gate of gates) {
      if (passedGateIds.current.has(gate.id)) continue;
      const gateWorldZ = gate.z + zTravel;
      const distance = decisionPlaneZ - gateWorldZ;

      if (distance >= 0 && distance < smallestDistance) {
        smallestDistance = distance;
        closest = gate;
      }
    }

    return closest;
  }, [gates, zTravel, difficultyConfig.passOffset]);

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
      if (
        e.code === 'Space' ||
        e.key === 'ArrowRight' ||
        e.key.toLowerCase() === 'd' ||
        e.key.toLowerCase() === 'e'
      ) {
        e.preventDefault();
        gyroState.cycleShapeBy(1);
      } else if (
        e.key === 'ArrowLeft' ||
        e.key.toLowerCase() === 'a' ||
        e.key.toLowerCase() === 'q'
      ) {
        e.preventDefault();
        gyroState.cycleShapeBy(-1);
      }
    };

    const isUiTarget = (target: EventTarget | null) => {
      return target instanceof Element && !!target.closest('[data-gyro-ui="1"]');
    };

    const handleClick = (e: MouseEvent) => {
      if (snap.gameOver || isUiTarget(e.target)) return;
      if (e.button !== 0) return;
      gyroState.cycleShapeBy(1);
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isUiTarget(e.target)) return;
      e.preventDefault();
      if (!snap.gameOver) {
        gyroState.cycleShapeBy(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [snap.gameOver, handleDifficultyChange, initGates]);

  // Game loop
  useFrame((_, delta) => {
    if (snap.gameOver) return;

    // Move forward
    const speed = Math.min(
      difficultyConfig.maxSpeed,
      BASE_SPEED * difficultyConfig.speedMul +
        snap.difficulty * SPEED_RAMP * difficultyConfig.rampMul
    );
    const nextZTravel = zTravel + speed * delta;
    setZTravel(nextZTravel);

    // Gate management and collision
    setGates((prev) => {
      let updated = [...prev];

      // Check gates near player
      for (const gate of updated) {
        const gateWorldZ = gate.z + nextZTravel;

        // Resolve gate slightly AFTER crossing player to keep timing fair.
        if (
          gateWorldZ >= PLAYER_Z + difficultyConfig.passOffset &&
          !passedGateIds.current.has(gate.id)
        ) {
          passedGateIds.current.add(gate.id);

          if (gate.shape === gyroState.playerShape) {
            // Success! Shape matches
            gyroState.combo += 1;
            gyroState.score += 10 * (1 + gyroState.combo * 0.1);
            gyroState.gatesPassed += 1;

            // Increase difficulty in softer steps.
            if (gyroState.gatesPassed % 12 === 0) {
              gyroState.difficulty += difficultyConfig.difficultyStep;
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
        updated.push(
          generateGate(rngRef.current, lastGateZ.current, activeShapes)
        );
      }

      return updated;
    });
  });

  const nextGateDistance = nextGate
    ? Math.max(0, PLAYER_Z + difficultyConfig.passOffset - (nextGate.z + zTravel))
    : 0;
  const approachProgress = nextGate
    ? THREE.MathUtils.clamp(1 - nextGateDistance / Math.max(gateSpacing, 1), 0, 1)
    : 0;
  const isLocked = !!nextGate && nextGate.shape === snap.playerShape;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, 10]} intensity={1.2} color={palette.glow} />
      <pointLight position={[0, 0, -18]} intensity={0.55} color={palette.accent} />

      {/* Tunnel wireframe */}
      <TunnelWireframe color={palette.accent} />

      {/* Gates */}
      {gates.map((gate) => (
        <GateComponent
          key={gate.id}
          gate={gate}
          zOffset={zTravel}
          isNext={gate.id === nextGate?.id}
          distanceToPlayer={Math.abs(gate.z + zTravel - PLAYER_Z)}
        />
      ))}

      {/* Player */}
      <Player shape={snap.playerShape} />

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto flex flex-col sm:flex-row items-start gap-3">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-white">
            <div className="text-3xl font-bold font-mono">
              {Math.floor(snap.score)}
            </div>
            <div className="text-xs text-white/60 mt-1">
              Combo: x{snap.combo + 1}
            </div>
            <div className="text-xs text-white/40">
              Best: {Math.floor(snap.highScore)}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <ShapeIndicator label="Current" shape={snap.playerShape} />
            {nextGate && (
              <ShapeIndicator label="Next Gate" shape={nextGate.shape} />
            )}
          </div>
        </div>

        {nextGate && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="rounded-xl border border-white/20 bg-black/55 backdrop-blur-sm px-4 py-2 min-w-[240px]">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-white/55">
                <span>Gate Lock</span>
                <span style={{ color: SHAPE_COLORS[nextGate.shape] }}>
                  {nextGate.shape}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-75"
                  style={{
                    width: `${Math.round(approachProgress * 100)}%`,
                    background: isLocked ? '#34d399' : '#f87171',
                  }}
                />
              </div>
              <div className="mt-1 text-[11px] text-white/65">
                {isLocked ? 'LOCKED' : 'MISMATCH'} • {nextGateDistance.toFixed(1)}m
              </div>
            </div>
          </div>
        )}

        <div
          data-gyro-ui="1"
          className="absolute bottom-20 left-4 z-50 pointer-events-auto"
        >
          <DifficultySelector
            value={snap.difficultyMode}
            onChange={handleDifficultyChange}
          />
        </div>

        {/* Controls hint */}
        <div
          data-gyro-ui="1"
          className="absolute bottom-4 left-4 text-white/60 text-sm pointer-events-auto"
        >
          <div>Space/Click/E/D = next shape • Q/A/Right-click = previous</div>
          <div className="text-xs mt-1">
            1/2/3 sets difficulty • Resolve happens just after crossing the gate
          </div>
        </div>

        <div
          data-gyro-ui="1"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
        >
          <div className="rounded-xl border border-white/15 bg-black/45 backdrop-blur-sm p-2 flex gap-2">
            <button
              onClick={() => gyroState.cycleShapeBy(-1)}
              className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/90 text-xs"
            >
              Prev
            </button>
            <button
              onClick={() => gyroState.cycleShapeBy(1)}
              className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/90 text-xs"
            >
              Next
            </button>
          </div>
        </div>

        {/* Game Over */}
        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
            <div className="text-center">
              <h1 className="text-5xl font-bold text-white mb-4">GAME OVER</h1>
              <p className="text-3xl text-white/80 mb-2">
                {Math.floor(snap.score)}
              </p>
              <p className="text-lg text-white/60 mb-1">
                Gates: {snap.gatesPassed}
              </p>
              <p className="text-lg text-white/60 mb-6">
                Best: {Math.floor(snap.highScore)}
              </p>
              <p className="text-white/50">Press R to restart</p>
            </div>
          </div>
        )}
      </Html>
    </>
  );
};

export default Gyro;
