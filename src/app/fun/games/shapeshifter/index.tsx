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
  Torus,
  TorusKnot,
} from '@react-three/drei';
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

type ShapeType =
  | 'box'
  | 'sphere'
  | 'dodecahedron'
  | 'cone'
  | 'torus'
  | 'torusknot'
  | 'octahedron'
  | 'icosahedron';

const SHAPE_TYPES: ShapeType[] = [
  'box',
  'sphere',
  'dodecahedron',
  'cone',
  'torus',
  'torusknot',
  'octahedron',
  'icosahedron',
];

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

const getRandomShapeType = () =>
  SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
const getRandomColor = () =>
  SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)];

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL SHAPE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ShapeProps {
  index: number;
  position: [number, number, number];
  color: string;
  shapeType: ShapeType;
  isPulsing: boolean;
  isHovered: boolean;
  isSelected: boolean;
  gridSize: number;
  scale: number;
  isClickable: boolean;
  onHover: (index: number) => void;
  onUnhover: (index: number) => void;
  onClick: (index: number) => void;
}

const Shape: React.FC<ShapeProps> = ({
  index,
  position,
  color,
  shapeType,
  isPulsing,
  isHovered,
  isSelected,
  gridSize,
  scale,
  isClickable,
  onHover,
  onUnhover,
  onClick,
}) => {
  const visualRef = useRef<THREE.Group>(null);

  // Get base scale based on grid size
  const baseScale = useMemo(() => {
    if (gridSize === 3) return 0.8;
    if (gridSize === 4) return 0.6;
    if (gridSize === 5) return 0.5;
    return 0.8;
  }, [gridSize]);

  // Calculate final scale with effects
  const finalScale = useMemo(() => {
    let s = scale * baseScale;
    if (isPulsing) s *= 1.4;
    else if (isSelected) s *= 1.2;
    else if (isHovered && isClickable) s *= 1.1;
    return s;
  }, [scale, baseScale, isPulsing, isSelected, isHovered, isClickable]);

  const hitRadius = useMemo(() => {
    if (gridSize >= 5) return 0.5;
    if (gridSize === 4) return 0.56;
    return 0.64;
  }, [gridSize]);

  // Gentle rotation - only rotate the visual group
  useFrame(() => {
    if (visualRef.current) {
      visualRef.current.rotation.y += 0.008;
      visualRef.current.rotation.x += 0.003;
    }
  });

  // Calculate emissive intensity based on state
  const emissiveIntensity = isPulsing
    ? 1.0
    : isSelected
      ? 0.5
      : isHovered && isClickable
        ? 0.3
        : 0.1;

  // Material for the shape
  const material = useMemo(
    () => (
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        metalness={0.3}
        roughness={0.4}
      />
    ),
    [color, emissiveIntensity]
  );

  // Render the appropriate shape (visual only, no event handlers)
  const renderShape = () => {
    switch (shapeType) {
      case 'box':
        return <Box args={[1, 1, 1]}>{material}</Box>;
      case 'sphere':
        return <Sphere args={[0.6, 32, 32]}>{material}</Sphere>;
      case 'dodecahedron':
        return <Dodecahedron args={[0.6]}>{material}</Dodecahedron>;
      case 'cone':
        return <Cone args={[0.5, 1, 32]}>{material}</Cone>;
      case 'torus':
        return <Torus args={[0.4, 0.2, 16, 32]}>{material}</Torus>;
      case 'torusknot':
        return <TorusKnot args={[0.35, 0.12, 64, 16]}>{material}</TorusKnot>;
      case 'octahedron':
        return <Octahedron args={[0.6]}>{material}</Octahedron>;
      case 'icosahedron':
        return <Icosahedron args={[0.6]}>{material}</Icosahedron>;
      default:
        return <Box args={[1, 1, 1]}>{material}</Box>;
    }
  };

  return (
    <group position={position} scale={finalScale}>
      {/* Invisible hit mesh for reliable raycast-based interaction */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!isClickable) return;
          onHover(index);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onUnhover(index);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!isClickable) return;
          onClick(index);
        }}
      >
        <sphereGeometry args={[hitRadius, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Visual shape - rotates independently */}
      <group ref={visualRef}>{renderShape()}</group>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// GAME GRID ITEM INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

interface GridItem {
  shapeType: ShapeType;
  color: string;
  index: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SHAPESHIFTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ShapeShifterProps {
  soundsOn?: boolean;
}

const ShapeShifter: React.FC<ShapeShifterProps> = ({ soundsOn = true }) => {
  const snap = useSnapshot(shapeShifterState);
  const { camera, scene, size } = useThree();

  // Game state
  const [grid, setGrid] = useState<GridItem[]>([]);
  const [animatingEntries, setAnimatingEntries] = useState<Set<number>>(
    new Set()
  );
  const [pulseSequence, setPulseSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [currentPulseIndex, setCurrentPulseIndex] = useState(-1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [gamePhase, setGamePhase] = useState<
    'idle' | 'showing' | 'input' | 'checking'
  >('idle');
  const [showResult, setShowResult] = useState<'success' | 'fail' | null>(null);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [gameKey, setGameKey] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sequenceTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Set up camera and scene - adjust camera based on viewport
  useEffect(() => {
    // Set background
    scene.background = new THREE.Color('#0f0f23');

    // Calculate camera distance based on aspect ratio for proper centering
    const aspect = size.width / size.height;
    const cameraZ = aspect < 1 ? 14 : 10; // Further back on narrow screens
    camera.position.set(0, 0, cameraZ);
    camera.lookAt(0, 0, 0);
  }, [camera, scene, size]);

  // Generate grid
  const generateGrid = useCallback((gridSizeParam: number): GridItem[] => {
    return Array(gridSizeParam ** 2)
      .fill(null)
      .map((_, index) => ({
        shapeType: getRandomShapeType(),
        color: getRandomColor(),
        index,
      }));
  }, []);

  // Generate sequence
  const generateSequence = useCallback(
    (wave: number, gridSizeParam: number): number[] => {
      const sequenceLength = wave + 2;
      const maxIndex = gridSizeParam ** 2;
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
    },
    []
  );

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    sequenceTimersRef.current.forEach((timer) => clearTimeout(timer));
    sequenceTimersRef.current = [];
  }, []);

  // Start game / initialize
  const startGame = useCallback(
    (gridSizeParam: number) => {
      clearAllTimers();

      const newGrid = generateGrid(gridSizeParam);
      const allIndices = new Set(newGrid.map((_, i) => i));

      setGrid(newGrid);
      setAnimatingEntries(allIndices);
      setUserSequence([]);
      setSelectedIndices(new Set());
      setCurrentPulseIndex(-1);
      setShowResult(null);
      setGamePhase('idle');
      setIsInitialized(true);

      // Stagger entry animations
      newGrid.forEach((_, i) => {
        const entryTimer = setTimeout(
          () => {
            setAnimatingEntries((prev) => {
              const next = new Set(prev);
              next.delete(i);
              return next;
            });
          },
          i * 50 + 100
        );
        sequenceTimersRef.current.push(entryTimer);
      });

      // Generate sequence for current wave
      const newSequence = generateSequence(
        shapeShifterState.wave,
        gridSizeParam
      );
      setPulseSequence(newSequence);

      // Start showing sequence after entries complete
      const showTimer = setTimeout(
        () => {
          setGamePhase('showing');
        },
        newGrid.length * 50 + 600
      );
      timerRef.current = showTimer;
    },
    [generateGrid, generateSequence, clearAllTimers]
  );

  // Initialize on mount and when gameKey changes
  useEffect(() => {
    startGame(shapeShifterState.gridSize);

    return () => {
      clearAllTimers();
      document.body.style.cursor = 'auto';
    };
  }, [gameKey, startGame, clearAllTimers]);

  useEffect(() => {
    if (gamePhase !== 'input') {
      setHoveredIndex(null);
      document.body.style.cursor = 'auto';
      return;
    }
    document.body.style.cursor = hoveredIndex !== null ? 'pointer' : 'auto';
  }, [gamePhase, hoveredIndex]);

  // Show sequence animation - using refs to avoid stale closures
  const pulseSequenceRef = useRef(pulseSequence);
  pulseSequenceRef.current = pulseSequence;

  const speedMultiplierRef = useRef(speedMultiplier);
  speedMultiplierRef.current = speedMultiplier;

  useEffect(() => {
    if (gamePhase !== 'showing') return;
    if (pulseSequenceRef.current.length === 0) return;

    const sequence = pulseSequenceRef.current;
    const pulseDelay = Math.max(350, 600 / speedMultiplierRef.current);
    const gapDelay = 150;

    let timeoutIds: NodeJS.Timeout[] = [];
    let totalDelay = 400; // Initial delay before starting

    // Schedule all pulses
    sequence.forEach((shapeIndex, i) => {
      // Turn on pulse
      const onTimer = setTimeout(() => {
        setCurrentPulseIndex(shapeIndex);
      }, totalDelay);
      timeoutIds.push(onTimer);

      // Turn off pulse
      const offTimer = setTimeout(() => {
        setCurrentPulseIndex(-1);
      }, totalDelay + pulseDelay);
      timeoutIds.push(offTimer);

      totalDelay += pulseDelay + gapDelay;
    });

    // Transition to input phase after sequence completes
    const inputTimer = setTimeout(() => {
      setGamePhase('input');
    }, totalDelay + 200);
    timeoutIds.push(inputTimer);

    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
    };
  }, [gamePhase]);

  // Handle shape click
  const handleShapeClick = useCallback(
    (index: number) => {
      if (gamePhase !== 'input') return;

      // Visual feedback
      setSelectedIndices((prev) => new Set(prev).add(index));
      setTimeout(() => {
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }, 200);

      setUserSequence((prev) => {
        const newUserSequence = [...prev, index];

        // Check if correct
        const currentIdx = newUserSequence.length - 1;
        if (pulseSequence[currentIdx] !== index) {
          // Wrong!
          setGamePhase('checking');
          setShowResult('fail');
          setTimeout(() => {
            shapeShifterState.reset(shapeShifterState.gridSize);
            setSpeedMultiplier(1);
            setGameKey((k) => k + 1);
          }, 1500);
          return newUserSequence;
        }

        // Check if sequence complete
        if (newUserSequence.length === pulseSequence.length) {
          // Success!
          setGamePhase('checking');
          setShowResult('success');

          setTimeout(() => {
            shapeShifterState.incrementWave();
            shapeShifterState.incrementScore(
              pulseSequence.length * 10 + shapeShifterState.wave * 5
            );

            // Increase grid size in normal mode every 10 waves
            let newGridSize = shapeShifterState.gridSize;
            if (
              shapeShifterState.mode === 'normal' &&
              shapeShifterState.wave % 10 === 0 &&
              newGridSize < 5
            ) {
              newGridSize += 1;
              shapeShifterState.setGridSize(newGridSize);
            }

            // Speed up every 5 waves
            if (shapeShifterState.wave % 5 === 0) {
              setSpeedMultiplier((prev) => Math.min(prev * 1.1, 2.5));
            }

            // Generate new sequence
            const newSequence = generateSequence(
              shapeShifterState.wave,
              newGridSize
            );
            setPulseSequence(newSequence);
            setUserSequence([]);
            setShowResult(null);

            // Regenerate grid if size changed, otherwise just show new sequence
            if (newGridSize !== shapeShifterState.gridSize) {
              setGameKey((k) => k + 1);
            } else {
              setGamePhase('showing');
            }
          }, 1000);
        }

        return newUserSequence;
      });
    },
    [gamePhase, pulseSequence, generateSequence]
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') {
        shapeShifterState.reset(shapeShifterState.gridSize);
        setSpeedMultiplier(1);
        setGameKey((k) => k + 1);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: 'normal' | 'casual', newGridSize: number) => {
      shapeShifterState.setMode(newMode);
      shapeShifterState.setGridSize(newGridSize);
      shapeShifterState.reset(newGridSize);
      setSpeedMultiplier(1);
      setGameKey((k) => k + 1);
    },
    []
  );

  // Grid calculations - compute based on actual grid length
  const currentGridSize =
    grid.length > 0 ? Math.sqrt(grid.length) : snap.gridSize;
  const spacing =
    currentGridSize === 3 ? 2.2 : currentGridSize === 4 ? 1.8 : 1.5;
  const offset = ((currentGridSize - 1) * spacing) / 2;
  const handleShapeHover = useCallback(
    (index: number) => {
      if (gamePhase !== 'input') return;
      setHoveredIndex((prev) => (prev === index ? prev : index));
    },
    [gamePhase]
  );

  const handleShapeUnhover = useCallback(
    (index: number) => {
      if (gamePhase !== 'input') return;
      setHoveredIndex((prev) => (prev === index ? null : prev));
    },
    [gamePhase]
  );

  // Don't render until initialized
  if (!isInitialized) return null;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
      <pointLight position={[-10, -10, 10]} intensity={0.6} />

      {/* Grid of shapes - centered at origin */}
      <group position={[0, 0, 0]}>
        {grid.map((item, i) => {
          const row = Math.floor(i / currentGridSize);
          const col = i % currentGridSize;
          const x = col * spacing - offset;
          const y = (currentGridSize - 1 - row) * spacing - offset;
          const entryScale = animatingEntries.has(i) ? 0 : 1;

          return (
            <Shape
              key={`shape-${item.index}-${gameKey}`}
              index={item.index}
              position={[x, y, 0]}
              color={item.color}
              shapeType={item.shapeType}
              isPulsing={currentPulseIndex === item.index}
              isHovered={hoveredIndex === item.index}
              isSelected={selectedIndices.has(item.index)}
              gridSize={currentGridSize}
              scale={entryScale}
              isClickable={gamePhase === 'input'}
              onHover={handleShapeHover}
              onUnhover={handleShapeUnhover}
              onClick={handleShapeClick}
            />
          );
        })}
      </group>

      {/* Result feedback - centered in 3D space */}
      {showResult && (
        <Html center position={[0, 0, 2]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              fontSize: '5rem',
              fontWeight: 'bold',
              color: showResult === 'success' ? '#4ade80' : '#f87171',
              textShadow: `0 0 40px ${showResult === 'success' ? '#4ade80' : '#f87171'}`,
            }}
          >
            {showResult === 'success' ? '✓' : '✗'}
          </div>
        </Html>
      )}

      {/* Phase indicator below grid */}
      {(gamePhase === 'showing' || gamePhase === 'input') && (
        <Html
          center
          position={[0, -offset - 1.8, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1.1rem',
              fontWeight: 500,
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            {gamePhase === 'showing'
              ? 'Watch the sequence...'
              : `Your turn! (${userSequence.length}/${pulseSequence.length})`}
          </div>
        </Html>
      )}

      {/* HUD - Top stats (fixed to viewport so it never clips under the site header) */}
      <Html fullscreen style={{ pointerEvents: 'none' }} zIndexRange={[0, 0]}>
        <div
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 92px)',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            fontSize: '1rem',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, sans-serif',
            pointerEvents: 'none',
            maxWidth: 'calc(100vw - 1.5rem)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ marginRight: '0.8rem' }}>
            Wave: <strong style={{ color: '#22d3ee' }}>{snap.wave}</strong>
          </span>
          <span style={{ marginRight: '0.8rem' }}>
            Score: <strong style={{ color: '#4ade80' }}>{snap.score}</strong>
          </span>
          <span>
            Best: <strong style={{ color: '#facc15' }}>{snap.bestScore}</strong>
          </span>
        </div>
      </Html>

      {/* Bottom controls - positioned below grid in world space */}
      <Html
        position={[0, -offset - 3, 0]}
        center
        style={{ pointerEvents: 'none' }}
        zIndexRange={[0, 0]}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontFamily: 'system-ui, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Grid Size Selector (Casual Mode Only) */}
          {snap.mode === 'casual' && (
            <div
              style={{ display: 'flex', gap: '0.3rem', pointerEvents: 'auto' }}
            >
              {[3, 4, 5].map((gridSizeOption) => (
                <button
                  key={gridSizeOption}
                  onClick={() => handleModeChange('casual', gridSizeOption)}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: '0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    background:
                      snap.gridSize === gridSizeOption
                        ? '#06b6d4'
                        : 'rgba(30, 41, 59, 0.9)',
                    color:
                      snap.gridSize === gridSizeOption
                        ? 'white'
                        : 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  {gridSizeOption}x{gridSizeOption}
                </button>
              ))}
            </div>
          )}

          {/* Mode Toggle */}
          <button
            onClick={() =>
              handleModeChange(
                snap.mode === 'normal' ? 'casual' : 'normal',
                snap.mode === 'normal' ? snap.gridSize : 3
              )
            }
            style={{
              background: 'linear-gradient(135deg, #0891b2, #2563eb)',
              color: 'white',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.4rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              pointerEvents: 'auto',
            }}
          >
            {snap.mode === 'normal' ? 'Casual' : 'Normal'} Mode
          </button>

          <span
            style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.65rem' }}
          >
            Press R to restart
          </span>
        </div>
      </Html>
    </>
  );
};

export default ShapeShifter;
