// src/components/games/Sizr.tsx
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
import { proxy } from 'valtio';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════════════

export interface SizrState {
  score: number;
  reset: () => void;
}

export const sizrState = proxy<SizrState>({
  score: 0,
  reset: () => {
    sizrState.score = 0;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGO COLOR PALETTE
// ═══════════════════════════════════════════════════════════════════════════

const LEGO_COLORS = [
  '#E4202A', // Bright Red
  '#F6A800', // Bright Yellow/Orange
  '#0055BF', // Bright Blue
  '#00AF4D', // Bright Green
  '#F97306', // Bright Orange
  '#FF69B4', // Bright Pink
  '#6B5BAA', // Medium Lavender
  '#00BCD4', // Bright Cyan
  '#FCAC00', // Flame Yellowish Orange
  '#B31B19', // Dark Red
  '#1E5AA8', // Dark Blue
  '#009247', // Dark Green
];

const getRandomLegoColor = () =>
  LEGO_COLORS[Math.floor(Math.random() * LEGO_COLORS.length)];

// ═══════════════════════════════════════════════════════════════════════════
// GAME CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

interface StackBlock {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}

const BASE_SIZE: [number, number, number] = [4, 0.5, 4];
const MOVE_RANGE = 6;
const BASE_MOVE_SPEED = 3;
const BLOCK_HEIGHT = 0.55;
const PERFECT_THRESHOLD = 0.15; // How close to consider a "perfect" placement

interface SizrProps {
  soundsOn?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGO BLOCK MATERIAL - Gives blocks that classic LEGO shine
// ═══════════════════════════════════════════════════════════════════════════

const LegoBlockMaterial: React.FC<{ color: string; isPerfect?: boolean }> = ({
  color,
  isPerfect,
}) => {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current || !isPerfect) return;
    // Subtle glow animation for perfect blocks
    materialRef.current.emissiveIntensity =
      0.2 + 0.1 * Math.sin(clock.getElapsedTime() * 4);
  });

  return (
    <meshPhysicalMaterial
      ref={materialRef}
      color={color}
      metalness={0.0}
      roughness={0.35}
      clearcoat={0.8}
      clearcoatRoughness={0.15}
      emissive={isPerfect ? color : '#000000'}
      emissiveIntensity={isPerfect ? 0.2 : 0}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGO STUD COMPONENT - Classic LEGO studs on top of blocks
// ═══════════════════════════════════════════════════════════════════════════

const LegoStuds: React.FC<{
  size: [number, number, number];
  color: string;
}> = ({ size, color }) => {
  const [width, height, depth] = size;
  const studRadius = 0.15;
  const studHeight = 0.12;
  const studSpacing = 0.8;

  const studs = useMemo(() => {
    const result: [number, number][] = [];
    const countX = Math.floor(width / studSpacing);
    const countZ = Math.floor(depth / studSpacing);
    const offsetX = (width - (countX - 1) * studSpacing) / 2;
    const offsetZ = (depth - (countZ - 1) * studSpacing) / 2;

    for (let x = 0; x < countX; x++) {
      for (let z = 0; z < countZ; z++) {
        result.push([
          -width / 2 + offsetX + x * studSpacing,
          -depth / 2 + offsetZ + z * studSpacing,
        ]);
      }
    }
    return result;
  }, [width, depth]);

  return (
    <group position={[0, height / 2 + studHeight / 2, 0]}>
      {studs.map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]}>
          <cylinderGeometry args={[studRadius, studRadius, studHeight, 12]} />
          <meshPhysicalMaterial
            color={color}
            metalness={0.0}
            roughness={0.35}
            clearcoat={0.8}
            clearcoatRoughness={0.15}
          />
        </mesh>
      ))}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CUT-OFF PIECE ANIMATION
// ═══════════════════════════════════════════════════════════════════════════

interface FallingPieceProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  direction: 'left' | 'right';
}

const FallingPiece: React.FC<FallingPieceProps> = ({
  position,
  size,
  color,
  direction,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const velocityRef = useRef({
    x: direction === 'left' ? -2 : 2,
    y: 0,
    rotZ: 0,
  });
  const [visible, setVisible] = useState(true);

  useFrame((_, delta) => {
    if (!meshRef.current || !visible) return;

    velocityRef.current.y -= 25 * delta; // Gravity
    velocityRef.current.rotZ += (direction === 'left' ? -3 : 3) * delta;

    meshRef.current.position.x += velocityRef.current.x * delta;
    meshRef.current.position.y += velocityRef.current.y * delta;
    meshRef.current.rotation.z = velocityRef.current.rotZ;

    if (meshRef.current.position.y < -20) {
      setVisible(false);
    }
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={size} />
      <meshPhysicalMaterial
        color={color}
        metalness={0.0}
        roughness={0.35}
        clearcoat={0.6}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PERFECT INDICATOR
// ═══════════════════════════════════════════════════════════════════════════

const PerfectIndicator: React.FC<{ position: [number, number, number] }> = ({
  position,
}) => {
  const [visible, setVisible] = useState(true);
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current || !visible) return;
    timeRef.current += delta;

    groupRef.current.position.y =
      position[1] + 1 + Math.sin(timeRef.current * 8) * 0.2;
    groupRef.current.scale.setScalar(1 + Math.sin(timeRef.current * 10) * 0.1);

    if (timeRef.current > 1) {
      setVisible(false);
    }
  });

  if (!visible) return null;

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1] + 1, position[2]]}
    >
      <Html center>
        <div className="text-yellow-400 font-bold text-2xl animate-bounce">
          PERFECT! ✨
        </div>
      </Html>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SIZR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Sizr: React.FC<SizrProps> = ({ soundsOn: _soundsOn = true }) => {
  const [stack, setStack] = useState<StackBlock[]>([
    { position: [0, -3, 0], size: BASE_SIZE, color: getRandomLegoColor() },
  ]);
  const [currentSize, setCurrentSize] =
    useState<[number, number, number]>(BASE_SIZE);
  const [currentY, setCurrentY] = useState(-3 + BLOCK_HEIGHT);
  const [currentColor, setCurrentColor] = useState(getRandomLegoColor());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [perfectStreak, setPerfectStreak] = useState(0);
  const [fallingPieces, setFallingPieces] = useState<FallingPieceProps[]>([]);
  const [perfectIndicators, setPerfectIndicators] = useState<
    [number, number, number][]
  >([]);

  const lastPlaceRef = useRef(0);
  const movingXRef = useRef(-MOVE_RANGE);
  const directionRef = useRef(1);
  const movingMeshRef = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();

  // Speed increases with height
  const moveSpeed = useMemo(() => {
    return BASE_MOVE_SPEED + stack.length * 0.08;
  }, [stack.length]);

  useEffect(() => {
    sizrState.score = score;
  }, [score]);

  const reset = useCallback(() => {
    const newColor = getRandomLegoColor();
    setStack([{ position: [0, -3, 0], size: BASE_SIZE, color: newColor }]);
    setCurrentSize(BASE_SIZE);
    setCurrentY(-3 + BLOCK_HEIGHT);
    setCurrentColor(getRandomLegoColor());
    movingXRef.current = -MOVE_RANGE;
    directionRef.current = 1;
    setScore(0);
    setGameOver(false);
    setPerfectStreak(0);
    setFallingPieces([]);
    setPerfectIndicators([]);
  }, []);

  useEffect(() => {
    sizrState.reset = reset;
  }, [reset]);

  const placeBlock = useCallback(() => {
    if (gameOver) {
      reset();
      return;
    }

    const now = Date.now();
    if (now - lastPlaceRef.current < 150) return;
    lastPlaceRef.current = now;

    const top = stack[stack.length - 1];
    const [topX] = top.position;
    const [topWidth] = top.size;
    const currX = movingXRef.current;
    const currY = currentY;
    const currZ = 0;
    const currWidth = currentSize[0];

    const topLeft = topX - topWidth / 2;
    const topRight = topX + topWidth / 2;
    const currLeft = currX - currWidth / 2;
    const currRight = currX + currWidth / 2;

    const overlapLeft = Math.max(topLeft, currLeft);
    const overlapRight = Math.min(topRight, currRight);
    const overlap = overlapRight - overlapLeft;

    // Game over if no overlap
    if (overlap <= 0.2) {
      setGameOver(true);
      return;
    }

    const newWidth = overlap;
    const newX = (overlapLeft + overlapRight) / 2;

    // Check for perfect placement
    const isPerfect = Math.abs(currWidth - overlap) < PERFECT_THRESHOLD;

    // Calculate points
    let points = Math.round(overlap * 10);
    if (isPerfect) {
      points += 50 + perfectStreak * 25; // Bonus for perfect, more for streaks
      setPerfectStreak((prev) => prev + 1);
      setPerfectIndicators((prev) => [...prev, [newX, currY, currZ]]);
    } else {
      setPerfectStreak(0);
    }

    // Create falling piece for the cut-off portion
    if (!isPerfect) {
      const cutOffWidth = currWidth - overlap;
      if (cutOffWidth > 0.1) {
        const isLeftCut = currLeft < topLeft;
        const cutOffX = isLeftCut
          ? currLeft + cutOffWidth / 2
          : currRight - cutOffWidth / 2;

        setFallingPieces((prev) => [
          ...prev,
          {
            position: [cutOffX, currY, currZ],
            size: [cutOffWidth, currentSize[1], currentSize[2]],
            color: currentColor,
            direction: isLeftCut ? 'left' : 'right',
          },
        ]);
      }
    }

    const newBlock: StackBlock = {
      position: [newX, currY, currZ],
      size: [isPerfect ? currWidth : newWidth, currentSize[1], currentSize[2]],
      color: currentColor,
    };

    setStack((prev) => [...prev, newBlock]);
    setScore((prev) => prev + points);

    const nextY = currY + BLOCK_HEIGHT;
    setCurrentY(nextY);
    setCurrentSize(
      isPerfect ? currentSize : [newWidth, currentSize[1], currentSize[2]]
    );
    setCurrentColor(getRandomLegoColor());
    directionRef.current *= -1;
    movingXRef.current = directionRef.current > 0 ? -MOVE_RANGE : MOVE_RANGE;
  }, [
    currentSize,
    currentColor,
    currentY,
    gameOver,
    reset,
    stack,
    perfectStreak,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        placeBlock();
      }
      if (event.key.toLowerCase() === 'r') reset();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [placeBlock, reset]);

  useEffect(() => {
    const canvas = gl.domElement;
    const previousTouchAction = canvas.style.touchAction;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      placeBlock();
    };

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', handlePointerDown);

    return () => {
      canvas.style.touchAction = previousTouchAction;
      canvas.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [gl, placeBlock]);

  // Animation loop
  useFrame((_, delta) => {
    if (gameOver) return;

    let nextX = movingXRef.current + directionRef.current * moveSpeed * delta;
    if (nextX > MOVE_RANGE) {
      nextX = MOVE_RANGE;
      directionRef.current = -1;
    }
    if (nextX < -MOVE_RANGE) {
      nextX = -MOVE_RANGE;
      directionRef.current = 1;
    }
    movingXRef.current = nextX;

    if (movingMeshRef.current) {
      movingMeshRef.current.position.x = nextX;
      movingMeshRef.current.position.y = currentY;
    }

    // Camera follows the stack
    const targetCamY = Math.max(4, currentY + 4);
    const targetCamZ = 12 + Math.max(0, stack.length * 0.1);
    camera.position.lerp(new THREE.Vector3(0, targetCamY, targetCamZ), 0.05);
    camera.lookAt(0, currentY - 2, 0);
  });

  // Clean up old perfect indicators
  useEffect(() => {
    const timer = setTimeout(() => {
      setPerfectIndicators([]);
    }, 1500);
    return () => clearTimeout(timer);
  }, [perfectIndicators.length]);

  return (
    <>
      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-sm px-5 py-4 text-white shadow-xl pointer-events-auto">
          <div className="text-3xl font-bold">{score}</div>
          <div className="text-xs text-white/50 uppercase tracking-wider">
            Score
          </div>

          <div className="mt-3 flex gap-4">
            <div>
              <div className="text-lg font-semibold">{stack.length - 1}</div>
              <div className="text-xs text-white/50">Blocks</div>
            </div>
            {perfectStreak > 0 && (
              <div>
                <div className="text-lg font-semibold text-yellow-400">
                  {perfectStreak}x
                </div>
                <div className="text-xs text-white/50">Perfect</div>
              </div>
            )}
          </div>

          <div className="text-xs text-white/40 mt-4">
            Tap or press SPACE to place
          </div>
          {gameOver && (
            <div className="text-red-400 mt-2 font-semibold animate-pulse">
              Missed! Tap or SPACE to restart
            </div>
          )}
        </div>

        {/* Game Title - positioned to not overlap with Arcade Deck */}
        <div className="absolute top-4 left-40 text-left pointer-events-auto">
          <div className="text-white/30 text-xs uppercase tracking-[0.3em]">
            SIZR
          </div>
          <div className="text-white/60 text-[10px] mt-1">
            Match the size perfectly!
          </div>
        </div>
      </Html>

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
      <directionalLight
        position={[-5, 10, -5]}
        intensity={0.4}
        color="#fff5e6"
      />
      <pointLight
        position={[0, currentY + 5, 5]}
        intensity={0.5}
        color="#ffffff"
      />

      {/* Stack */}
      <group>
        {stack.map((block, index) => (
          <group key={`stack-${index}`} position={block.position}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={block.size} />
              <LegoBlockMaterial color={block.color} />
            </mesh>
            <LegoStuds size={block.size} color={block.color} />
          </group>
        ))}

        {/* Moving block */}
        {!gameOver && (
          <group>
            <mesh
              ref={movingMeshRef}
              position={[movingXRef.current, currentY, 0]}
              castShadow
            >
              <boxGeometry args={currentSize} />
              <LegoBlockMaterial color={currentColor} />
            </mesh>
            <group position={[movingXRef.current, currentY, 0]}>
              <LegoStuds size={currentSize} color={currentColor} />
            </group>
            {/* Drop guide line */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={
                    new Float32Array([
                      movingXRef.current,
                      currentY - 0.3,
                      0,
                      movingXRef.current,
                      -10,
                      0,
                    ])
                  }
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ffffff" transparent opacity={0.15} />
            </line>
          </group>
        )}
      </group>

      {/* Falling pieces */}
      {fallingPieces.map((piece, index) => (
        <FallingPiece key={`falling-${index}`} {...piece} />
      ))}

      {/* Perfect indicators */}
      {perfectIndicators.map((pos, index) => (
        <PerfectIndicator key={`perfect-${index}`} position={pos} />
      ))}

      {/* Ground reference */}
      <gridHelper
        args={[20, 20, '#333333', '#222222']}
        position={[0, -3.5, 0]}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -3.5, 0]}
        receiveShadow
      >
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
    </>
  );
};

export default Sizr;
