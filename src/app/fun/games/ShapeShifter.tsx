// src/components/games/ShapeShifter.tsx
'use client';

import {
  Box,
  Cone,
  Dodecahedron,
  Html,
  Icosahedron,
  Octahedron,
  Sphere,
  Sparkles,
  Torus,
  TorusKnot,
} from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE (Valtio)
// ═══════════════════════════════════════════════════════════════════════════

export const shapeShifterState = proxy({
  wave: 1,
  score: 0,
  bestWave: 1,
  bestScore: 0,
  gridSize: 3,
  mode: 'normal' as 'normal' | 'casual',

  reset(newGridSize = 3) {
    this.wave = 1;
    this.score = 0;
    this.gridSize = newGridSize;
    this.mode = 'normal';
    this.bestWave = 1;
    this.bestScore = 0;
  },

  incrementWave() {
    this.wave += 1;
    if (this.wave > this.bestWave) {
      this.bestWave = this.wave;
    }
  },

  incrementScore(amount: number) {
    this.score += amount;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }
  },

  setGridSize(size: number) {
    this.gridSize = size;
  },

  setMode(newMode: 'normal' | 'casual') {
    this.mode = newMode;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE TYPES AND CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

type ShapeType = 'box' | 'sphere' | 'dodecahedron' | 'cone' | 'torus' | 'torusknot' | 'octahedron' | 'icosahedron';

// Drei shape components for reliable raycasting
const SHAPE_COMPONENTS = {
  box: Box,
  sphere: Sphere,
  dodecahedron: Dodecahedron,
  cone: Cone,
  torus: Torus,
  torusknot: TorusKnot,
  octahedron: Octahedron,
  icosahedron: Icosahedron,
};

const SHAPE_TYPES: ShapeType[] = ['box', 'sphere', 'dodecahedron', 'cone', 'torus', 'torusknot', 'octahedron', 'icosahedron'];

// Vibrant color palette
const SHAPE_COLORS = [
  '#FF3366', // Vibrant Pink
  '#00D4FF', // Cyan
  '#FFD700', // Gold
  '#00FF88', // Mint Green
  '#FF6B35', // Orange
  '#9B59B6', // Purple
  '#3498DB', // Blue
  '#E74C3C', // Red
];

const getRandomShapeType = () => SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
const getRandomColor = () => SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)];

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL SHAPE COMPONENT - Using drei components for reliable clicking
// ═══════════════════════════════════════════════════════════════════════════

interface ShapeProps {
  index: number;
  position: [number, number, number];
  color: string;
  shapeType: ShapeType;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
  isPulsing: boolean;
  isHovered: boolean;
  isSelected: boolean;
  gridSize: number;
  scale: number;
}

const Shape: React.FC<ShapeProps> = ({
  position,
  color,
  shapeType,
  onClick,
  onPointerOver,
  onPointerOut,
  isPulsing,
  isHovered,
  isSelected,
  gridSize,
  scale,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Get base scale based on grid size
  const baseScale = useMemo(() => {
    if (gridSize === 3) return 0.5;
    if (gridSize === 4) return 0.35;
    if (gridSize === 5) return 0.25;
    return 0.5;
  }, [gridSize]);

  // Calculate final scale with effects
  const finalScale = useMemo(() => {
    let s = scale * baseScale;
    if (isPulsing) s *= 1.3;
    else if (isSelected) s *= 1.15;
    else if (isHovered) s *= 1.05;
    return s;
  }, [scale, baseScale, isPulsing, isSelected, isHovered]);

  // Gentle rotation
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      meshRef.current.rotation.x += 0.002;
    }
  });

  // Get the drei component for this shape type
  const ShapeComponent = SHAPE_COMPONENTS[shapeType];

  // Calculate emissive intensity based on state
  const emissiveIntensity = isPulsing ? 0.8 : isSelected ? 0.4 : isHovered ? 0.2 : 0;

  return (
    <group position={position} scale={finalScale}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <ShapeComponent>
          <meshStandardMaterial 
            color={color} 
            emissive={color}
            emissiveIntensity={emissiveIntensity}
            metalness={0.3}
            roughness={0.4}
          />
        </ShapeComponent>
      </mesh>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GAME CORE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ShapeShiftCoreProps {
  gridSizeProp: number;
  modeProp: string;
  onModeChange: (mode: string, size: number) => void;
}

interface GridItem {
  shapeType: ShapeType;
  color: string;
  index: number;
}

const ShapeShiftCore: React.FC<ShapeShiftCoreProps> = ({ onModeChange }) => {
  const snap = useSnapshot(shapeShifterState);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  // Game state
  const [grid, setGrid] = useState<GridItem[]>([]);
  const [animatingEntries, setAnimatingEntries] = useState<Set<number>>(new Set());
  const [pulseSequence, setPulseSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [isShowingSequence, setIsShowingSequence] = useState(false);
  const [currentPulseIndex, setCurrentPulseIndex] = useState(-1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [gamePhase, setGamePhase] = useState<'idle' | 'showing' | 'input' | 'checking'>('idle');
  const [showResult, setShowResult] = useState<'success' | 'fail' | null>(null);

  // Generate grid
  const generateGrid = useCallback((size: number): GridItem[] => {
    return Array(size ** 2)
      .fill(null)
      .map((_, index) => ({
        shapeType: getRandomShapeType(),
        color: getRandomColor(),
        index,
      }));
  }, []);

  // Generate sequence
  const generateSequence = useCallback((wave: number, size: number): number[] => {
    const sequenceLength = wave + 2;
    const maxIndex = size ** 2;
    const usedIndices = new Set<number>();
    const sequence: number[] = [];

    while (sequence.length < sequenceLength && sequence.length < maxIndex) {
      const randomIndex = Math.floor(Math.random() * maxIndex);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        sequence.push(randomIndex);
      }
    }

    return sequence;
  }, []);

  // Animate grid entry
  const animateGridEntry = useCallback((size: number) => {
    const newGrid = generateGrid(size);
    const allIndices = new Set(newGrid.map((_, i) => i));
    setAnimatingEntries(allIndices);
    setGrid(newGrid);

    // Stagger the entry animation
    newGrid.forEach((_, i) => {
      setTimeout(() => {
        setAnimatingEntries(prev => {
          const next = new Set(prev);
          next.delete(i);
          return next;
        });
      }, i * 80 + 100);
    });

    // After all entries complete, start showing sequence
    setTimeout(() => {
      setGamePhase('showing');
    }, newGrid.length * 80 + 600);
  }, [generateGrid]);

  // Reset game
  const resetGame = useCallback((newGridSize = 3) => {
    shapeShifterState.reset(newGridSize);
    setSpeedMultiplier(1);
    setGrid([]);
    setUserSequence([]);
    setSelectedIndices(new Set());
    setCurrentPulseIndex(-1);
    setShowResult(null);
    setGamePhase('idle');
    
    const newSequence = generateSequence(1, newGridSize);
    setPulseSequence(newSequence);
    
    animateGridEntry(newGridSize);
  }, [animateGridEntry, generateSequence]);

  // Initialize game
  useEffect(() => {
    resetGame(shapeShifterState.gridSize);
  }, []);

  // Show sequence animation
  useEffect(() => {
    if (gamePhase !== 'showing' || pulseSequence.length === 0) return;

    setCurrentPulseIndex(-1);
    
    const showNextPulse = (index: number) => {
      if (index >= pulseSequence.length) {
        // Sequence complete, switch to input phase
        setTimeout(() => {
          setCurrentPulseIndex(-1);
          setGamePhase('input');
        }, 400);
        return;
      }

      setCurrentPulseIndex(pulseSequence[index]);
      
      const pulseDelay = Math.max(300, 600 / speedMultiplier);
      setTimeout(() => {
        setCurrentPulseIndex(-1);
        setTimeout(() => showNextPulse(index + 1), 100);
      }, pulseDelay);
    };

    // Start showing sequence after a short delay
    setTimeout(() => showNextPulse(0), 500);
  }, [gamePhase, pulseSequence, speedMultiplier]);

  // Handle shape click
  const handleShapeClick = useCallback((index: number) => {
    console.log('Shape clicked:', index, 'gamePhase:', gamePhase);
    if (gamePhase !== 'input') {
      console.log('Click ignored - not in input phase');
      return;
    }

    // Visual feedback
    setSelectedIndices(prev => new Set(prev).add(index));
    setTimeout(() => {
      setSelectedIndices(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 300);

    const newUserSequence = [...userSequence, index];
    setUserSequence(newUserSequence);

    // Check if this click is correct so far
    const currentIndex = newUserSequence.length - 1;
    if (pulseSequence[currentIndex] !== index) {
      // Wrong! Game over
      setGamePhase('checking');
      setShowResult('fail');
      setTimeout(() => {
        resetGame(shapeShifterState.gridSize);
      }, 1500);
      return;
    }

    // Check if sequence complete
    if (newUserSequence.length === pulseSequence.length) {
      // Success!
      setGamePhase('checking');
      setShowResult('success');
      
      setTimeout(() => {
        shapeShifterState.incrementWave();
        shapeShifterState.incrementScore(pulseSequence.length * 10 + shapeShifterState.wave * 5);

        // Increase difficulty
        let newGridSize = shapeShifterState.gridSize;
        if (shapeShifterState.mode === 'normal' && shapeShifterState.wave % 10 === 0 && newGridSize < 5) {
          newGridSize += 1;
          shapeShifterState.setGridSize(newGridSize);
        }

        // Speed up slightly every 5 waves
        if (shapeShifterState.wave % 5 === 0) {
          setSpeedMultiplier(prev => Math.min(prev * 1.1, 3));
        }

        // Generate new sequence
        const newSequence = generateSequence(shapeShifterState.wave, newGridSize);
        setPulseSequence(newSequence);
        setUserSequence([]);
        setShowResult(null);

        // Regenerate grid if size changed
        if (newGridSize !== grid.length ** 0.5) {
          animateGridEntry(newGridSize);
        } else {
          setGamePhase('showing');
        }
      }, 1000);
    }
  }, [gamePhase, userSequence, pulseSequence, grid.length, generateSequence, resetGame, animateGridEntry]);

  // Handle hover
  const handleShapeHover = useCallback((index: number, isHovering: boolean) => {
    if (gamePhase !== 'input') {
      setHoveredIndex(null);
      return;
    }
    setHoveredIndex(isHovering ? index : null);
  }, [gamePhase]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') {
        resetGame(shapeShifterState.gridSize);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [resetGame]);

  // Grid position calculations
  const gridSize = Math.sqrt(grid.length) || snap.gridSize;
  const spacing = gridSize === 3 ? 2.8 : gridSize === 4 ? 2.2 : 1.8;
  const offset = ((gridSize - 1) * spacing) / 2;

  return (
    <>
      {/* Grid of shapes - centered */}
      <group position={[1, 1, 0]}>
        {grid.map((item, i) => {
          const row = Math.floor(i / gridSize);
          const col = i % gridSize;
          const x = col * spacing - offset;
          const y = (gridSize - 1 - row) * spacing - offset;
          // Calculate entry scale - 0 while animating, 1 when done
          const entryScale = animatingEntries.has(i) ? 0 : 1;

          return (
            <Shape
              key={`${item.index}-${snap.wave}`}
              index={item.index}
              position={[x, y, 0]}
              color={item.color}
              shapeType={item.shapeType}
              onClick={() => handleShapeClick(item.index)}
              onPointerOver={() => handleShapeHover(item.index, true)}
              onPointerOut={() => handleShapeHover(item.index, false)}
              isPulsing={currentPulseIndex === item.index}
              isHovered={hoveredIndex === item.index}
              isSelected={selectedIndices.has(item.index)}
              gridSize={gridSize}
              scale={entryScale}
            />
          );
        })}
      </group>

      {/* Result feedback overlay - positioned to not block clicks */}
      {showResult && (
        <Html center position={[0, 0, 1]} style={{ pointerEvents: 'none' }}>
          <div className={`text-6xl font-bold ${showResult === 'success' ? 'text-green-400' : 'text-red-400'} animate-pulse`}>
            {showResult === 'success' ? '✓' : '✗'}
          </div>
        </Html>
      )}

      {/* Phase indicator - positioned below grid */}
      {gamePhase === 'showing' && (
        <Html center position={[0, -4.5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="text-white/80 text-lg font-medium animate-pulse whitespace-nowrap">
            Watch the sequence...
          </div>
        </Html>
      )}

      {gamePhase === 'input' && (
        <Html center position={[0, -4.5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="text-white/80 text-lg font-medium whitespace-nowrap">
            Your turn! ({userSequence.length}/{pulseSequence.length})
          </div>
        </Html>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT - Renders its own Canvas for proper event handling
// ═══════════════════════════════════════════════════════════════════════════

interface ShapeShifterProps {
  soundsOn?: boolean;
}

const ShapeShifter: React.FC<ShapeShifterProps> = ({ soundsOn = true }) => {
  const [key, setKey] = useState<number>(0);
  const [mode, setMode] = useState<string>('normal');
  const [gridSize, setGridSize] = useState<number>(3);
  const snap = useSnapshot(shapeShifterState);

  const handleModeChange = useCallback((newMode: string, newGridSize: number) => {
    shapeShifterState.setMode(newMode as 'normal' | 'casual');
    shapeShifterState.setGridSize(newGridSize);
    setMode(newMode);
    setGridSize(newGridSize);
    setKey((prevKey) => prevKey + 1);
  }, []);

  // Render using Html fullscreen to escape parent Canvas and create our own
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="fixed inset-0 pointer-events-auto">
        {/* HUD - positioned above canvas */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="text-white text-lg bg-slate-900/80 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/10 shadow-lg whitespace-nowrap">
            <span className="mr-4">Wave: <strong className="text-cyan-400">{snap.wave}</strong></span>
            <span className="mr-4">Score: <strong className="text-green-400">{snap.score}</strong></span>
            <span>Best: <strong className="text-yellow-400">{snap.bestScore}</strong></span>
          </div>
        </div>

        {/* Mode controls at bottom */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-4">
            {/* Grid Size Selector (Casual Mode Only) */}
            {snap.mode === 'casual' && (
              <div className="flex gap-2">
                {[3, 4, 5].map((size) => (
                  <button
                    key={size}
                    onClick={() => handleModeChange('casual', size)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      gridSize === size
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-slate-800/80 text-white/70 hover:bg-slate-700/80'
                    }`}
                  >
                    {size}x{size}
                  </button>
                ))}
              </div>
            )}

            {/* Mode Toggle Button */}
            <button
              onClick={() => {
                if (snap.mode === 'normal') {
                  handleModeChange('casual', gridSize);
                } else {
                  handleModeChange('normal', 3);
                }
              }}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg hover:shadow-cyan-500/20"
            >
              {snap.mode === 'normal' ? 'Casual' : 'Normal'} Mode
            </button>

            <span className="text-white/50 text-xs ml-2">Press R to restart</span>
          </div>
        </div>

        {/* Own Canvas for proper event handling - like the working JS version */}
        <Canvas
          camera={{ position: [0, 0, 15], fov: 50 }}
          style={{ background: 'linear-gradient(to bottom, #0f0f23, #1a1a2e)' }}
        >
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, -10, 10]} intensity={0.5} />
          <Sparkles count={40} scale={[20, 20, 20]} color="#ffffff" opacity={0.4} speed={0.3} />
          <ShapeShiftCore key={key} gridSizeProp={gridSize} modeProp={mode} onModeChange={handleModeChange} />
        </Canvas>
      </div>
    </Html>
  );
};

export default ShapeShifter;
