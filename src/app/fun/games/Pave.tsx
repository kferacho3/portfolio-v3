/**
 * Pave.tsx (Tessellate Rush)
 * 
 * Infinite tiling puzzle sprint
 * Place tiles quickly to keep the path complete as it scrolls
 * Features: multiple piece choices, wild tiles, bomb tiles, pattern bonuses
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

type TileShape = 'triangle' | 'square' | 'hexagon' | 'wild' | 'bomb';
type BasicShape = 'triangle' | 'square' | 'hexagon';

interface Cell {
  id: string;
  x: number;
  z: number;
  requiredShape: BasicShape;
  filled: boolean;
  filledShape?: TileShape;
  isExploded?: boolean;
}

interface TilePiece {
  shape: TileShape;
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const paveState = proxy({
  score: 0,
  highScore: 0,
  streak: 0,
  bestStreak: 0,
  gameOver: false,
  biome: 0,
  tilesPlaced: 0,
  patternBonuses: 0,
  reset: () => {
    paveState.score = 0;
    paveState.streak = 0;
    paveState.gameOver = false;
    paveState.biome = 0;
    paveState.tilesPlaced = 0;
    paveState.patternBonuses = 0;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BASE_SPEED = 6;
const SPEED_RAMP = 0.3;
const CELL_SIZE = 2;
const GRID_WIDTH = 5;
const VISIBLE_DEPTH = 20;
const SPAWN_AHEAD = 15;
const PIECES_COUNT = 3; // Number of pieces to choose from

const BASIC_SHAPES: BasicShape[] = ['triangle', 'square', 'hexagon'];

const SHAPE_COLORS: Record<TileShape, string> = {
  triangle: '#feca57',
  square: '#ff6b6b',
  hexagon: '#48dbfb',
  wild: '#ff9ff3',
  bomb: '#ff4757',
};

const BIOMES = [
  { name: 'Marble', bg: '#1a1a2e', tileColor: '#e8e8e8', pathColor: '#4a4a6a' },
  { name: 'Neon Glass', bg: '#0a0a1a', tileColor: '#00ffff', pathColor: '#002233' },
  { name: 'Lava Grid', bg: '#1a0a0a', tileColor: '#ff6600', pathColor: '#331100' },
  { name: 'Ice Prism', bg: '#0a1a2a', tileColor: '#88ccff', pathColor: '#112233' },
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const generatePieces = (rng: SeededRandom, score: number): TilePiece[] => {
  const pieces: TilePiece[] = [];
  
  for (let i = 0; i < PIECES_COUNT; i++) {
    const rand = rng.float(0, 1);
    let shape: TileShape;
    
    // Special pieces become more common as score increases
    const wildChance = Math.min(0.08, 0.02 + score / 5000);
    const bombChance = Math.min(0.06, 0.01 + score / 8000);
    
    if (rand < wildChance) {
      shape = 'wild';
    } else if (rand < wildChance + bombChance) {
      shape = 'bomb';
    } else {
      shape = rng.pick(BASIC_SHAPES);
    }
    
    pieces.push({
      shape,
      color: SHAPE_COLORS[shape],
    });
  }
  
  return pieces;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Tile geometry based on shape
const TileGeometry: React.FC<{
  shape: TileShape;
  position: [number, number, number];
  color: string;
  filled: boolean;
  correct?: boolean;
  isWild?: boolean;
  isBomb?: boolean;
  isExploded?: boolean;
}> = ({ shape, position, color, filled, correct, isWild, isBomb, isExploded }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const size = CELL_SIZE * 0.45;
    if (shape === 'wild') {
      return new THREE.OctahedronGeometry(size * 0.7);
    }
    if (shape === 'bomb') {
      return new THREE.SphereGeometry(size * 0.6, 16, 16);
    }
    switch (shape) {
      case 'triangle':
        return new THREE.ConeGeometry(size, 0.3, 3);
      case 'square':
        return new THREE.BoxGeometry(size * 1.4, 0.3, size * 1.4);
      case 'hexagon':
        return new THREE.CylinderGeometry(size, size, 0.3, 6);
      default:
        return new THREE.BoxGeometry(size, 0.3, size);
    }
  }, [shape]);

  // Animate wild and bomb tiles
  useFrame((_, delta) => {
    if (meshRef.current && (isWild || isBomb)) {
      meshRef.current.rotation.y += delta * 2;
    }
  });

  const material = useMemo(() => {
    if (isExploded) {
      return new THREE.MeshStandardMaterial({
        color: '#00ff00',
        emissive: '#00ff00',
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.6,
      });
    }
    if (!filled) {
      return new THREE.MeshStandardMaterial({
        color: '#333344',
        transparent: true,
        opacity: 0.4,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: isWild ? SHAPE_COLORS.wild : isBomb ? SHAPE_COLORS.bomb : color,
      emissive: isWild ? SHAPE_COLORS.wild : isBomb ? SHAPE_COLORS.bomb : color,
      emissiveIntensity: correct ? 0.6 : 0.3,
    });
  }, [color, filled, correct, isWild, isBomb, isExploded]);

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      material={material} 
      position={position} 
    />
  );
};

// Player character
const Player: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 2;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.35]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.6}
        />
      </mesh>
      <pointLight color="#ffffff" intensity={1.5} distance={6} />
    </group>
  );
};

// Ground grid for reference
const GroundGrid: React.FC<{
  zOffset: number;
  color: string;
}> = ({ zOffset, color }) => {
  const lines = useMemo(() => {
    const result: JSX.Element[] = [];
    for (let z = 0; z < VISIBLE_DEPTH; z++) {
      const points = [
        new THREE.Vector3(-GRID_WIDTH * CELL_SIZE / 2, -0.5, -z * CELL_SIZE),
        new THREE.Vector3(GRID_WIDTH * CELL_SIZE / 2, -0.5, -z * CELL_SIZE),
      ];
      result.push(
        <line key={`h-${z}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={color} transparent opacity={0.3} />
        </line>
      );
    }
    return result;
  }, [color]);

  return <group position={[0, 0, zOffset % CELL_SIZE]}>{lines}</group>;
};

// Enhanced tile selector with visual pieces
const TileSelectorEnhanced: React.FC<{
  pieces: TilePiece[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}> = ({ pieces, selectedIndex, onSelect }) => {
  const getShapeIcon = (shape: TileShape) => {
    switch (shape) {
      case 'triangle': return '△';
      case 'square': return '□';
      case 'hexagon': return '⬡';
      case 'wild': return '✦';
      case 'bomb': return '💥';
      default: return '?';
    }
  };

  return (
    <div className="flex gap-3">
      {pieces.map((piece, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all transform ${
            selectedIndex === i
              ? 'border-white bg-white/25 scale-110'
              : 'border-white/30 bg-black/50 hover:border-white/60 hover:scale-105'
          }`}
          style={{ 
            borderColor: selectedIndex === i ? piece.color : undefined,
            boxShadow: selectedIndex === i ? `0 0 15px ${piece.color}40` : undefined 
          }}
        >
          <span 
            className="text-2xl" 
            style={{ color: piece.color }}
          >
            {getShapeIcon(piece.shape)}
          </span>
          <span className="text-white/60 text-xs mt-0.5">{i + 1}</span>
        </button>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Pave: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(paveState);
  const { camera, scene } = useThree();

  const [playerZ, setPlayerZ] = useState(0);
  const [playerX, setPlayerX] = useState(0);
  const [cells, setCells] = useState<Cell[]>([]);
  const [pieces, setPieces] = useState<TilePiece[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const rngRef = useRef(new SeededRandom(Date.now()));
  const lastCellZ = useRef(0);
  const cellIdCounter = useRef(0);

  const currentBiome = BIOMES[snap.biome % BIOMES.length];

  // Generate initial pieces
  useEffect(() => {
    setPieces(generatePieces(rngRef.current, 0));
  }, []);

  // Camera setup
  useEffect(() => {
    camera.position.set(0, 8, 6);
    camera.lookAt(0, 0, -5);
  }, [camera]);

  // Scene background
  useEffect(() => {
    scene.background = new THREE.Color(currentBiome.bg);
  }, [scene, currentBiome.bg]);

  // Generate initial cells
  useEffect(() => {
    const initialCells: Cell[] = [];
    for (let z = 0; z < SPAWN_AHEAD; z++) {
      const numHoles = Math.floor(rngRef.current.float(1, 3));
      const holePositions = new Set<number>();
      while (holePositions.size < numHoles) {
        holePositions.add(Math.floor(rngRef.current.float(0, GRID_WIDTH)));
      }

      for (let x = 0; x < GRID_WIDTH; x++) {
        if (holePositions.has(x)) {
          initialCells.push({
            id: `cell-${cellIdCounter.current++}`,
            x: (x - (GRID_WIDTH - 1) / 2) * CELL_SIZE,
            z: -z * CELL_SIZE,
            requiredShape: rngRef.current.pick(BASIC_SHAPES),
            filled: false,
          });
        }
      }
      lastCellZ.current = -z * CELL_SIZE;
    }
    setCells(initialCells);
  }, []);

  // Place tile function
  const placeTile = useCallback((pieceIndex: number) => {
    if (pieceIndex < 0 || pieceIndex >= pieces.length) return;
    
    const piece = pieces[pieceIndex];
    const targetZ = playerZ - CELL_SIZE * 2;
    const targetX = playerX;

    setCells((prev) => {
      const updated = [...prev];
      let placed = false;

      // Handle bomb - explode nearby unfilled cells
      if (piece.shape === 'bomb') {
        let explodedCount = 0;
        for (let i = 0; i < updated.length; i++) {
          const cell = updated[i];
          if (
            !cell.filled &&
            Math.abs(cell.x - targetX) < CELL_SIZE * 2.5 &&
            Math.abs(cell.z - targetZ) < CELL_SIZE * 2.5
          ) {
            updated[i] = { ...cell, filled: true, filledShape: 'bomb', isExploded: true };
            explodedCount++;
          }
        }
        if (explodedCount > 0) {
          paveState.score += 5 * explodedCount;
          paveState.tilesPlaced += 1;
          placed = true;
        }
      } else {
        // Normal placement
        for (let i = 0; i < updated.length; i++) {
          const cell = updated[i];
          if (
            !cell.filled &&
            Math.abs(cell.x - targetX) < CELL_SIZE * 0.6 &&
            Math.abs(cell.z - targetZ) < CELL_SIZE * 0.6
          ) {
            // Wild matches any shape, otherwise must match
            const correct = piece.shape === 'wild' || cell.requiredShape === piece.shape;
            updated[i] = {
              ...cell,
              filled: true,
              filledShape: piece.shape,
            };

            if (correct) {
              const bonus = piece.shape === 'wild' ? 1.5 : 1;
              paveState.score += Math.floor(10 * (1 + paveState.streak * 0.1) * bonus);
              paveState.streak += 1;
              if (paveState.streak > paveState.bestStreak) {
                paveState.bestStreak = paveState.streak;
              }
            } else {
              paveState.streak = 0;
            }
            
            paveState.tilesPlaced += 1;
            placed = true;
            break;
          }
        }
      }

      // Generate new pieces after placement
      if (placed) {
        setPieces(generatePieces(rngRef.current, paveState.score));
        setSelectedIndex(0);
      }

      return updated;
    });
  }, [playerZ, playerX, pieces]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r') {
          paveState.reset();
          setCells([]);
          setPlayerZ(0);
          setPlayerX(0);
          lastCellZ.current = 0;
          rngRef.current = new SeededRandom(Date.now());
          setPieces(generatePieces(rngRef.current, 0));
          setSelectedIndex(0);
        }
        return;
      }

      // Tile selection (1, 2, 3)
      if (e.key === '1') setSelectedIndex(0);
      if (e.key === '2') setSelectedIndex(1);
      if (e.key === '3') setSelectedIndex(2);

      // Horizontal movement
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        setPlayerX((prev) => Math.max(prev - CELL_SIZE, -(GRID_WIDTH - 1) / 2 * CELL_SIZE));
      }
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        setPlayerX((prev) => Math.min(prev + CELL_SIZE, (GRID_WIDTH - 1) / 2 * CELL_SIZE));
      }

      // Place tile
      if (e.code === 'Space') {
        e.preventDefault();
        placeTile(selectedIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snap.gameOver, selectedIndex, placeTile]);

  // Game loop
  useFrame((_, delta) => {
    if (snap.gameOver) return;

    // Auto-move forward
    const speed = BASE_SPEED + snap.score * 0.0005 * SPEED_RAMP;
    setPlayerZ((prev) => prev - speed * delta);

    // Camera follow with smooth lag
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, playerZ + 6, delta * 3);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, playerX * 0.3, delta * 2);
    camera.lookAt(playerX * 0.5, 0, playerZ - 5);

    // Check if player is over a hole
    for (const cell of cells) {
      if (
        !cell.filled &&
        Math.abs(cell.x - playerX) < CELL_SIZE * 0.4 &&
        Math.abs(cell.z - playerZ) < CELL_SIZE * 0.4
      ) {
        paveState.gameOver = true;
        break;
      }
    }

    // Manage cells
    setCells((prev) => {
      let updated = prev.filter((cell) => cell.z > playerZ - CELL_SIZE * 3);

      while (lastCellZ.current > playerZ - SPAWN_AHEAD * CELL_SIZE) {
        lastCellZ.current -= CELL_SIZE;
        const numHoles = Math.floor(rngRef.current.float(1, Math.min(3, 1 + paveState.score / 200)));
        const holePositions = new Set<number>();
        while (holePositions.size < numHoles) {
          holePositions.add(Math.floor(rngRef.current.float(0, GRID_WIDTH)));
        }

        for (let x = 0; x < GRID_WIDTH; x++) {
          if (holePositions.has(x)) {
            updated.push({
              id: `cell-${cellIdCounter.current++}`,
              x: (x - (GRID_WIDTH - 1) / 2) * CELL_SIZE,
              z: lastCellZ.current,
              requiredShape: rngRef.current.pick(BASIC_SHAPES),
              filled: false,
            });
          }
        }
      }

      return updated;
    });

    // Biome change
    const newBiome = Math.floor(paveState.score / 300) % BIOMES.length;
    if (newBiome !== paveState.biome) {
      paveState.biome = newBiome;
    }

    // High score
    if (paveState.score > paveState.highScore) {
      paveState.highScore = paveState.score;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />

      <GroundGrid zOffset={playerZ} color={currentBiome.pathColor} />

      {cells.map((cell) => (
        <TileGeometry
          key={cell.id}
          shape={cell.filledShape || cell.requiredShape}
          position={[cell.x, -0.25, cell.z]}
          color={currentBiome.tileColor}
          filled={cell.filled}
          correct={cell.filled && (cell.filledShape === 'wild' || cell.filledShape === cell.requiredShape)}
          isWild={cell.filledShape === 'wild'}
          isBomb={cell.filledShape === 'bomb'}
          isExploded={cell.isExploded}
        />
      ))}

      <mesh position={[0, -0.5, playerZ - VISIBLE_DEPTH * CELL_SIZE / 2]}>
        <boxGeometry args={[GRID_WIDTH * CELL_SIZE, 0.1, VISIBLE_DEPTH * CELL_SIZE]} />
        <meshStandardMaterial color={currentBiome.pathColor} />
      </mesh>

      <Player position={[playerX, 0.5, playerZ]} />

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-white">
            <div className="text-2xl font-bold">{Math.floor(snap.score)}</div>
            <div className="text-xs text-white/60">Streak: x{snap.streak + 1}</div>
            <div className="text-xs text-white/40 mt-1">{currentBiome.name}</div>
          </div>
        </div>

        <div className="absolute top-4 left-40 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs">
            <div>Tiles: {snap.tilesPlaced}</div>
            <div className="text-white/60">Best: {Math.floor(snap.highScore)}</div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-5 py-4">
            <TileSelectorEnhanced
              pieces={pieces}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
            />
            <div className="text-center text-white/50 text-xs mt-3">
              1/2/3 select • Space place • A/D move
            </div>
          </div>
        </div>

        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
            <div className="text-center">
              <h1 className="text-5xl font-bold text-white mb-4">GAME OVER</h1>
              <p className="text-3xl text-white/80 mb-2">{Math.floor(snap.score)}</p>
              <p className="text-lg text-white/60 mb-1">Tiles Placed: {snap.tilesPlaced}</p>
              <p className="text-lg text-white/60 mb-1">Best Streak: x{snap.bestStreak + 1}</p>
              <p className="text-lg text-white/60 mb-6">Best: {Math.floor(snap.highScore)}</p>
              <p className="text-white/50">Press R to restart</p>
            </div>
          </div>
        )}
      </Html>
    </>
  );
};

export default Pave;
