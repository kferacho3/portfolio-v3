// src/components/games/Stackz.tsx
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
import { proxy, useSnapshot } from 'valtio';
import * as THREE from 'three';
import FixedViewportOverlay from '../_shared/FixedViewportOverlay';

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════════════

export interface StackzState {
  score: number;
  difficulty: 'easy' | 'medium' | 'hard';
  reset: () => void;
}

export const stackzState = proxy<StackzState>({
  score: 0,
  difficulty: 'medium',
  reset: () => {
    stackzState.score = 0;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGO COLOR PALETTE
// ═══════════════════════════════════════════════════════════════════════════

const LEGO_COLORS = [
  '#E4202A', // Bright Red
  '#F6A800', // Bright Yellow
  '#0055BF', // Bright Blue
  '#00AF4D', // Bright Green
  '#F97306', // Bright Orange
  '#FF69B4', // Bright Pink
  '#6B5BAA', // Medium Lavender
  '#00BCD4', // Bright Cyan
  '#FCAC00', // Flame Yellow
  '#9C27B0', // Purple
  '#4CAF50', // Green
  '#03A9F4', // Light Blue
];

const getRandomLegoColor = () =>
  LEGO_COLORS[Math.floor(Math.random() * LEGO_COLORS.length)];

// ═══════════════════════════════════════════════════════════════════════════
// GAME CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_SIZE: [number, number, number] = [3.5, 0.5, 3.5];
const STACK_MOVE_SPEED = 10;
const SPAWN_OFFSET = 10; // Spawn this far above stack top
const STACK_BASE_Y = 0;
const CATCH_THRESHOLD = 2.5;

const DIFFICULTY_HEARTS: Record<string, number> = {
  easy: 5,
  medium: 3,
  hard: 1,
};

type BlockType = 'normal' | 'golden' | 'diamond' | 'rainbow' | 'bomb';

interface BlockTypeConfig {
  points: number;
  probability: number;
  dropSpeedMultiplier: number;
  color?: string;
  isDangerous: boolean;
}

const BLOCK_TYPES: Record<BlockType, BlockTypeConfig> = {
  normal: {
    points: 10,
    probability: 0.5,
    dropSpeedMultiplier: 1.0,
    isDangerous: false,
  },
  golden: {
    points: 50,
    probability: 0.2,
    dropSpeedMultiplier: 1.2,
    color: '#FFD700',
    isDangerous: false,
  },
  diamond: {
    points: 100,
    probability: 0.12,
    dropSpeedMultiplier: 1.4,
    color: '#00FFFF',
    isDangerous: false,
  },
  rainbow: {
    points: 200,
    probability: 0.08,
    dropSpeedMultiplier: 1.6,
    isDangerous: false,
  },
  bomb: {
    points: -1,
    probability: 0.1,
    dropSpeedMultiplier: 1.3,
    color: '#FF0000',
    isDangerous: true,
  },
};

const getRandomBlockType = (): BlockType => {
  const rand = Math.random();
  let cumulative = 0;
  for (const [type, config] of Object.entries(BLOCK_TYPES)) {
    cumulative += config.probability;
    if (rand < cumulative) return type as BlockType;
  }
  return 'normal';
};

interface FallingBlock {
  id: string;
  position: [number, number, number];
  type: BlockType;
  color: string;
  velocity: number;
}

interface StackedBlock {
  id: string;
  position: [number, number, number];
  type: BlockType;
  color: string;
}

interface StackzProps {
  soundsOn?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEARTS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

interface HeartsDisplayProps {
  maxHearts: number;
  currentHearts: number;
  isHurt: boolean;
}

const HeartsDisplay: React.FC<HeartsDisplayProps> = ({
  maxHearts,
  currentHearts,
  isHurt,
}) => {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: maxHearts }).map((_, i) => (
        <div
          key={i}
          className={`transition-all duration-200 ${
            i < currentHearts
              ? isHurt
                ? 'animate-pulse scale-110'
                : ''
              : 'opacity-30'
          }`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={i < currentHearts ? '#FF4444' : '#333333'}
            className={`drop-shadow-lg ${i < currentHearts ? 'drop-shadow-[0_0_8px_rgba(255,68,68,0.6)]' : ''}`}
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGO BLOCK MATERIAL
// ═══════════════════════════════════════════════════════════════════════════

interface LegoBlockMaterialProps {
  type: BlockType;
  color: string;
}

const LegoBlockMaterial: React.FC<LegoBlockMaterialProps> = ({
  type,
  color,
}) => {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    const t = clock.getElapsedTime();

    switch (type) {
      case 'golden':
        materialRef.current.emissiveIntensity = 0.3 + 0.15 * Math.sin(t * 4);
        break;
      case 'diamond':
        materialRef.current.iridescence = 0.8 + 0.2 * Math.sin(t * 3);
        break;
      case 'rainbow':
        const hue = (t * 80) % 360;
        materialRef.current.color.setHSL(hue / 360, 0.8, 0.55);
        materialRef.current.emissive.setHSL(hue / 360, 0.8, 0.25);
        break;
      case 'bomb':
        materialRef.current.emissiveIntensity = 0.3 + 0.3 * Math.sin(t * 6);
        break;
    }
  });

  const materialProps = useMemo(() => {
    const baseColor = new THREE.Color(color);

    switch (type) {
      case 'golden':
        return {
          color: baseColor,
          metalness: 0.8,
          roughness: 0.15,
          emissive: new THREE.Color('#FFD700'),
          emissiveIntensity: 0.3,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
        };
      case 'diamond':
        return {
          color: baseColor,
          metalness: 0.1,
          roughness: 0.0,
          transmission: 0.4,
          thickness: 0.5,
          ior: 2.4,
          iridescence: 1.0,
          iridescenceIOR: 2.0,
          emissive: new THREE.Color('#00FFFF'),
          emissiveIntensity: 0.15,
          clearcoat: 1.0,
          clearcoatRoughness: 0.0,
        };
      case 'rainbow':
        return {
          color: baseColor,
          metalness: 0.2,
          roughness: 0.2,
          emissive: baseColor,
          emissiveIntensity: 0.3,
          clearcoat: 0.8,
          clearcoatRoughness: 0.1,
        };
      case 'bomb':
        return {
          color: new THREE.Color('#1a1a1a'),
          metalness: 0.3,
          roughness: 0.6,
          emissive: new THREE.Color('#FF0000'),
          emissiveIntensity: 0.3,
        };
      default:
        return {
          color: baseColor,
          metalness: 0.0,
          roughness: 0.35,
          clearcoat: 0.7,
          clearcoatRoughness: 0.2,
        };
    }
  }, [type, color]);

  return <meshPhysicalMaterial ref={materialRef} {...materialProps} />;
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGO STUDS
// ═══════════════════════════════════════════════════════════════════════════

const LegoStuds: React.FC<{ color: string; type: BlockType }> = ({
  color,
  type,
}) => {
  if (type === 'bomb') return null;

  const studRadius = 0.15;
  const studHeight = 0.12;
  const positions: [number, number][] = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 0],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  return (
    <group position={[0, BLOCK_SIZE[1] / 2 + studHeight / 2, 0]}>
      {positions.map(([x, z], i) => (
        <mesh key={i} position={[x * 0.9, 0, z * 0.9]}>
          <cylinderGeometry args={[studRadius, studRadius, studHeight, 10]} />
          <meshPhysicalMaterial
            color={color}
            metalness={0.0}
            roughness={0.35}
            clearcoat={0.7}
          />
        </mesh>
      ))}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FALLING BLOCK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface FallingBlockVisualProps {
  block: FallingBlock;
}

const FallingBlockVisual: React.FC<FallingBlockVisualProps> = ({ block }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.5;
  });

  const isBomb = block.type === 'bomb';

  return (
    <group position={block.position}>
      <mesh ref={meshRef} castShadow>
        {isBomb ? (
          <sphereGeometry args={[0.8, 16, 16]} />
        ) : (
          <boxGeometry args={BLOCK_SIZE} />
        )}
        <LegoBlockMaterial type={block.type} color={block.color} />
      </mesh>
      {!isBomb && <LegoStuds color={block.color} type={block.type} />}

      {/* Glow effect for special blocks */}
      {block.type !== 'normal' && (
        <mesh scale={1.1}>
          {isBomb ? (
            <sphereGeometry args={[0.8, 16, 16]} />
          ) : (
            <boxGeometry args={BLOCK_SIZE} />
          )}
          <meshBasicMaterial
            color={isBomb ? '#FF0000' : block.color}
            transparent
            opacity={0.2}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Bomb fuse */}
      {isBomb && (
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
          <meshBasicMaterial color="#8B4513" />
        </mesh>
      )}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER STACK BASE
// ═══════════════════════════════════════════════════════════════════════════

interface PlayerStackProps {
  position: [number, number, number];
  blocks: StackedBlock[];
  isHurt: boolean;
}

const PlayerStack: React.FC<PlayerStackProps> = ({
  position,
  blocks,
  isHurt,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !isHurt) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.x = position[0] + Math.sin(t * 50) * 0.15;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Base platform */}
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[4, 0.5, 4]} />
        <meshPhysicalMaterial
          color={isHurt ? '#4a2a2a' : '#2a2a4a'}
          metalness={0.3}
          roughness={0.7}
          clearcoat={0.5}
          emissive={isHurt ? '#FF0000' : '#000000'}
          emissiveIntensity={isHurt ? 0.3 : 0}
        />
      </mesh>

      {/* Stacked blocks */}
      {blocks.map((block, index) => (
        <group
          key={block.id}
          position={[0, index * BLOCK_SIZE[1] + BLOCK_SIZE[1] / 2, 0]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={BLOCK_SIZE} />
            <LegoBlockMaterial type={block.type} color={block.color} />
          </mesh>
          <LegoStuds color={block.color} type={block.type} />
        </group>
      ))}

      {/* Catch zone indicator */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, blocks.length * BLOCK_SIZE[1] + 0.5, 0]}
      >
        <ringGeometry args={[1.8, 2.2, 32]} />
        <meshBasicMaterial
          color={isHurt ? '#FF4444' : '#00FF00'}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA CONTROLLER - Follows the top of the stack smoothly
// ═══════════════════════════════════════════════════════════════════════════

interface CameraControllerProps {
  stackHeight: number;
  playerX: number;
}

const CameraController: React.FC<CameraControllerProps> = ({
  stackHeight,
  playerX,
}) => {
  const { camera } = useThree();
  const currentY = useRef(5);
  const currentLookY = useRef(2);

  useEffect(() => {
    camera.position.set(0, 5, 12);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 55;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useFrame(() => {
    // Camera should always keep the top of stack visible with some headroom for falling blocks
    // Position camera to look at the top portion of the stack
    const topOfStack = stackHeight;

    // Camera Y should be slightly above stack top to see incoming blocks
    const targetCamY = Math.max(5, topOfStack + 5);

    // Look at point should be at stack top level
    const targetLookY = Math.max(2, topOfStack + 1);

    // Camera Z stays relatively fixed but can zoom out slightly for very tall stacks
    const targetCamZ = 12 + Math.max(0, stackHeight * 0.1);

    // Smooth interpolation - use higher lerp factor for more responsive following
    currentY.current = THREE.MathUtils.lerp(currentY.current, targetCamY, 0.08);
    currentLookY.current = THREE.MathUtils.lerp(
      currentLookY.current,
      targetLookY,
      0.08
    );

    // Apply camera position
    camera.position.set(
      playerX * 0.15, // Slight X follow
      currentY.current,
      targetCamZ
    );

    // Look at the top of the stack area
    camera.lookAt(playerX * 0.1, currentLookY.current, 0);
  });

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// DIFFICULTY SELECTOR
// ═══════════════════════════════════════════════════════════════════════════

interface DifficultySelectorProps {
  difficulty: string;
  onSelect: (d: 'easy' | 'medium' | 'hard') => void;
}

const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  difficulty,
  onSelect,
}) => {
  return (
    <div className="flex gap-2">
      {(['easy', 'medium', 'hard'] as const).map((d) => (
        <button
          key={d}
          onClick={() => onSelect(d)}
          className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all ${
            difficulty === d
              ? d === 'easy'
                ? 'bg-green-600 text-white'
                : d === 'medium'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-red-600 text-white'
              : 'bg-slate-800/80 text-white/60 hover:bg-slate-700/80'
          }`}
        >
          {d} ({DIFFICULTY_HEARTS[d]}❤️)
        </button>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN STACKZ COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Stackz: React.FC<StackzProps> = ({ soundsOn: _soundsOn = true }) => {
  const snap = useSnapshot(stackzState);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(
    'medium'
  );
  const [hearts, setHearts] = useState(DIFFICULTY_HEARTS['medium']);
  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [fallingBlocks, setFallingBlocks] = useState<FallingBlock[]>([]);
  const [playerX, setPlayerX] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [combo, setCombo] = useState(0);
  const [isHurt, setIsHurt] = useState(false);

  const playerXRef = useRef(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const lastDropTimeRef = useRef(Date.now());
  const { gl } = useThree();

  const maxHearts = DIFFICULTY_HEARTS[difficulty];

  // Calculate drop interval based on score
  const dropInterval = useMemo(() => {
    return Math.max(600, 1500 - score * 2);
  }, [score]);

  useEffect(() => {
    stackzState.score = score;
    stackzState.difficulty = difficulty;
  }, [score, difficulty]);

  const reset = useCallback(() => {
    setScore(0);
    setHearts(DIFFICULTY_HEARTS[difficulty]);
    setStackedBlocks([]);
    setFallingBlocks([]);
    setPlayerX(0);
    playerXRef.current = 0;
    setGameOver(false);
    setGameStarted(true);
    setCombo(0);
    setIsHurt(false);
    lastDropTimeRef.current = Date.now();
  }, [difficulty]);

  const changeDifficulty = useCallback(
    (d: 'easy' | 'medium' | 'hard') => {
      setDifficulty(d);
      setHearts(DIFFICULTY_HEARTS[d]);
      if (gameStarted) {
        reset();
      }
    },
    [gameStarted, reset]
  );

  useEffect(() => {
    stackzState.reset = reset;
  }, [reset]);

  // Spawn new falling blocks - spawn relative to stack height
  const spawnBlock = useCallback((currentStackHeight: number) => {
    const type = getRandomBlockType();
    const config = BLOCK_TYPES[type];
    const color = config.color || getRandomLegoColor();
    const spawnX = (Math.random() - 0.5) * 12;

    // Spawn blocks above the current stack top
    const spawnY = currentStackHeight + SPAWN_OFFSET;

    const newBlock: FallingBlock = {
      id: `falling-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      position: [spawnX, spawnY, 0],
      type,
      color,
      velocity: 5 * config.dropSpeedMultiplier,
    };

    setFallingBlocks((prev) => [...prev, newBlock]);
  }, []);

  // Mouse control
  useEffect(() => {
    const canvas = gl.domElement;
    const previousTouchAction = canvas.style.touchAction;

    const syncPlayerFromClientX = (clientX: number) => {
      if (gameOver || !gameStarted) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;

      playerXRef.current = Math.max(-7, Math.min(7, x * 7));
      setPlayerX(playerXRef.current);
    };

    const handlePointerMove = (event: PointerEvent) => {
      syncPlayerFromClientX(event.clientX);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!gameStarted || gameOver) {
        reset();
        return;
      }
      syncPlayerFromClientX(event.clientX);
    };

    const handleWindowClick = () => {
      if (!gameStarted || gameOver) {
        reset();
      }
    };

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('click', handleWindowClick);

    return () => {
      canvas.style.touchAction = previousTouchAction;
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('click', handleWindowClick);
    };
  }, [gl, gameOver, gameStarted, reset]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.current.add(event.key.toLowerCase());
      if (event.key.toLowerCase() === 'r') reset();
      if (event.key === ' ' && (!gameStarted || gameOver)) {
        event.preventDefault();
        reset();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current.delete(event.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [reset, gameStarted, gameOver]);

  // Game loop
  useFrame((_, delta) => {
    if (gameOver || !gameStarted) return;

    // Keyboard movement (in addition to mouse)
    let moveDirection = 0;
    if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) {
      moveDirection -= 1;
    }
    if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) {
      moveDirection += 1;
    }

    if (moveDirection !== 0) {
      playerXRef.current += moveDirection * STACK_MOVE_SPEED * delta;
      playerXRef.current = Math.max(-7, Math.min(7, playerXRef.current));
      setPlayerX(playerXRef.current);
    }

    // Spawn blocks - pass current stack height so blocks spawn above it
    const now = Date.now();
    const currentStackHeight = stackedBlocks.length * BLOCK_SIZE[1];
    if (now - lastDropTimeRef.current > dropInterval) {
      spawnBlock(currentStackHeight);
      lastDropTimeRef.current = now;
    }

    // Update falling blocks
    const stackHeight = stackedBlocks.length * BLOCK_SIZE[1];
    const catchY = STACK_BASE_Y + stackHeight + BLOCK_SIZE[1];

    setFallingBlocks((prev) => {
      const remaining: FallingBlock[] = [];
      let newScore = 0;
      let caughtGood = false;
      let caughtBad = false;
      let missed = false;

      for (const block of prev) {
        const newY = block.position[1] - block.velocity * delta;

        // Check if block reached catch height
        if (newY <= catchY + 0.5) {
          const distance = Math.abs(block.position[0] - playerXRef.current);

          if (distance < CATCH_THRESHOLD) {
            const config = BLOCK_TYPES[block.type];

            if (config.isDangerous) {
              // Hit by bomb
              caughtBad = true;
              setIsHurt(true);
              setTimeout(() => setIsHurt(false), 300);

              setHearts((prev) => {
                const newHearts = prev - 1;
                if (newHearts <= 0) {
                  setGameOver(true);
                }
                return Math.max(0, newHearts);
              });
            } else {
              // Caught good block
              caughtGood = true;
              newScore += config.points + combo * 5;

              setStackedBlocks((prevStack) => [
                ...prevStack,
                {
                  id: block.id,
                  position: [0, prevStack.length * BLOCK_SIZE[1], 0],
                  type: block.type,
                  color: block.color,
                },
              ]);
            }
          } else if (!BLOCK_TYPES[block.type].isDangerous) {
            // Missed good block
            missed = true;
          }
        } else if (newY > -5) {
          remaining.push({
            ...block,
            position: [block.position[0], newY, block.position[2]],
          });
        } else if (!BLOCK_TYPES[block.type].isDangerous) {
          // Block fell off screen
          missed = true;
        }
      }

      if (caughtGood) {
        setCombo((prev) => prev + 1);
        setScore((prev) => prev + newScore);
      }

      if (caughtBad || missed) {
        setCombo(0);
        if (missed) {
          setHearts((prev) => {
            const newHearts = prev - 1;
            if (newHearts <= 0) {
              setGameOver(true);
            }
            return Math.max(0, newHearts);
          });
          setIsHurt(true);
          setTimeout(() => setIsHurt(false), 200);
        }
      }

      return remaining;
    });
  });

  const stackHeight = stackedBlocks.length * BLOCK_SIZE[1];

  return (
    <>
      <CameraController stackHeight={stackHeight} playerX={playerX} />

      {/* HUD */}
      <FixedViewportOverlay>
        <div className="absolute top-4 left-4 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-sm px-5 py-4 text-white shadow-xl pointer-events-auto">
          <div className="text-3xl font-bold">{score}</div>
          <div className="text-xs text-white/50 uppercase tracking-wider">
            Score
          </div>

          {/* Hearts Display */}
          <div className="mt-3">
            <HeartsDisplay
              maxHearts={maxHearts}
              currentHearts={hearts}
              isHurt={isHurt}
            />
          </div>

          <div className="mt-3 flex gap-4">
            <div>
              <div className="text-lg font-semibold">
                {stackedBlocks.length}
              </div>
              <div className="text-xs text-white/50">Stack</div>
            </div>
            {combo > 1 && (
              <div>
                <div className="text-lg font-semibold text-yellow-400">
                  {combo}x
                </div>
                <div className="text-xs text-white/50">Combo</div>
              </div>
            )}
          </div>

          {/* Difficulty selector */}
          <div className="mt-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
              Difficulty
            </div>
            <DifficultySelector
              difficulty={difficulty}
              onSelect={changeDifficulty}
            />
          </div>

          <div className="text-xs text-white/40 mt-3">
            Drag/tap or use A/D to move
          </div>
        </div>

        {/* Game Over / Start Screen */}
        {(!gameStarted || gameOver) && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 pointer-events-auto">
            <div className="text-center bg-slate-950/90 rounded-3xl border border-white/10 p-8 backdrop-blur-xl">
              {gameOver ? (
                <>
                  <h1 className="text-4xl font-bold text-red-400 mb-4">
                    Game Over!
                  </h1>
                  <p className="text-2xl text-white mb-2">Score: {score}</p>
                  <p className="text-lg text-white/60 mb-2">
                    Blocks Stacked: {stackedBlocks.length}
                  </p>
                  <p className="text-lg text-white/60 mb-6">
                    Best Combo: {combo}x
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-4xl font-bold text-white mb-4">Stackz</h1>
                  <p className="text-lg text-white/70 mb-6">
                    Catch falling blocks and build your tower!
                    <br />
                    Avoid the bombs!
                  </p>
                </>
              )}
              <p className="text-white/50 animate-pulse">
                Tap/Click or press SPACE to {gameOver ? 'restart' : 'start'}
              </p>
            </div>
          </div>
        )}

        {/* Block type legend */}
        <div className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[10px] text-white/60 pointer-events-auto">
          <div className="flex gap-3">
            <span>Normal: 10pts</span>
            <span className="text-yellow-400">Golden: 50pts</span>
            <span className="text-cyan-400">Diamond: 100pts</span>
            <span className="text-pink-400">Rainbow: 200pts</span>
            <span className="text-red-500">Bomb: -1❤️</span>
          </div>
        </div>
      </FixedViewportOverlay>

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
      <directionalLight
        position={[-5, 10, -5]}
        intensity={0.4}
        color="#88aaff"
      />
      <pointLight
        position={[0, stackHeight + 5, 5]}
        intensity={0.5}
        color="#ffffff"
      />

      {/* Player stack */}
      <PlayerStack
        position={[playerX, STACK_BASE_Y, 0]}
        blocks={stackedBlocks}
        isHurt={isHurt}
      />

      {/* Falling blocks */}
      {fallingBlocks.map((block) => (
        <FallingBlockVisual key={block.id} block={block} />
      ))}

      {/* Ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0]}
        receiveShadow
      >
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <gridHelper
        args={[30, 30, '#333333', '#222222']}
        position={[0, -0.49, 0]}
      />

      {/* Spawn indicator line - follows stack height */}
      <mesh position={[0, stackHeight + SPAWN_OFFSET, -1]} rotation={[0, 0, 0]}>
        <planeGeometry args={[16, 0.1]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.15} />
      </mesh>
    </>
  );
};

export default Stackz;
