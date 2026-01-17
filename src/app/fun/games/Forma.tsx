/**
 * Forma.tsx (Vertex Merge)
 * 
 * 2048-like polygon evolution game with modifiers
 * Merge same-sided polygons to evolve: triangle → square → pentagon → ...
 * Features: unstable tiles, gravity flip, wormholes, glass tiles
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

type ModifierType = 'wormhole' | 'glass' | null;

interface Tile {
  id: string;
  sides: number;
  row: number;
  col: number;
  merging?: boolean;
  isNew?: boolean;
  unstable?: number; // Decay timer (0-1), tile disappears at 0
  modifier?: ModifierType;
}

interface CellModifier {
  type: ModifierType;
  linkedCell?: [number, number]; // For wormholes
}

type Direction = 'up' | 'down' | 'left' | 'right';

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const formaState = proxy({
  score: 0,
  highScore: 0,
  gameOver: false,
  highestSides: 3,
  mergeCount: 0,
  modifiersUnlocked: 0,
  gravityFlipped: false,
  reset: () => {
    formaState.score = 0;
    formaState.gameOver = false;
    formaState.highestSides = 3;
    formaState.mergeCount = 0;
    formaState.modifiersUnlocked = 0;
    formaState.gravityFlipped = false;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const GRID_SIZE = 4;
const CELL_SIZE = 2;
const CELL_GAP = 0.2;
const UNSTABLE_CHANCE = 0.15;
const UNSTABLE_DECAY_RATE = 0.08; // Per move
const GRAVITY_FLIP_INTERVAL = 10; // Merges between flips

const POLYGON_COLORS: Record<number, string> = {
  3: '#ff6b6b',
  4: '#feca57',
  5: '#48dbfb',
  6: '#ff9ff3',
  7: '#54a0ff',
  8: '#5f27cd',
  9: '#00d2d3',
  10: '#ff6b6b',
  11: '#feca57',
  12: '#10ac84',
};

const MODIFIER_COLORS: Record<string, string> = {
  wormhole: '#9b59b6',
  glass: '#ecf0f1',
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const createEmptyGrid = (): (Tile | null)[][] => {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null)
  );
};

const getGridPosition = (row: number, col: number): [number, number, number] => {
  const x = (col - (GRID_SIZE - 1) / 2) * (CELL_SIZE + CELL_GAP);
  const y = ((GRID_SIZE - 1) / 2 - row) * (CELL_SIZE + CELL_GAP);
  return [x, y, 0];
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Polygon mesh with enhanced animations
const PolygonTile: React.FC<{
  tile: Tile;
}> = ({ tile }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [position, setPosition] = useState(getGridPosition(tile.row, tile.col));
  const [scale, setScale] = useState(tile.isNew ? 0 : 1);
  const [rotation, setRotation] = useState(0);

  const color = POLYGON_COLORS[tile.sides] || '#ffffff';
  const isUnstable = tile.unstable !== undefined;

  // Create polygon geometry
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const radius = CELL_SIZE * 0.4;
    const sides = tile.sides;

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
  }, [tile.sides]);

  // Animate position, scale, and rotation
  useFrame((_, delta) => {
    const targetPos = getGridPosition(tile.row, tile.col);
    
    // Smooth position transition
    setPosition((prev) => [
      THREE.MathUtils.lerp(prev[0], targetPos[0], delta * 12),
      THREE.MathUtils.lerp(prev[1], targetPos[1], delta * 12),
      prev[2],
    ]);

    // Scale animation for new tiles
    if (tile.isNew && scale < 1) {
      setScale((prev) => Math.min(1, prev + delta * 10));
    }

    // Merge pop animation
    if (tile.merging) {
      setScale((prev) => {
        if (prev > 1.2) return THREE.MathUtils.lerp(prev, 1, delta * 8);
        return Math.min(1.3, prev + delta * 15);
      });
    }

    // Constant rotation
    setRotation((prev) => prev + delta * 0.8);

    // Unstable tile shake
    if (meshRef.current && isUnstable) {
      const shake = Math.sin(Date.now() * 0.02) * 0.03 * (1 - (tile.unstable || 0));
      meshRef.current.position.x = position[0] + shake;
    }

    // Glow pulse for unstable
    if (glowRef.current && isUnstable) {
      const pulse = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
      glowRef.current.scale.setScalar(1.1 + pulse * 0.1);
    }
  });

  const opacity = isUnstable ? 0.5 + (tile.unstable || 0) * 0.5 : 1;
  const emissiveIntensity = tile.merging ? 0.8 : isUnstable ? 0.6 : 0.3;

  return (
    <group position={position}>
      {/* Main polygon */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        rotation={[0, 0, rotation]}
        scale={[scale, scale, scale]}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.3}
          roughness={0.4}
          transparent={isUnstable}
          opacity={opacity}
        />
      </mesh>

      {/* Glow effect for unstable tiles */}
      {isUnstable && (
        <mesh ref={glowRef} rotation={[0, 0, rotation]} scale={[scale * 1.1, scale * 1.1, 1]}>
          <circleGeometry args={[CELL_SIZE * 0.45, tile.sides]} />
          <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
        </mesh>
      )}

      {/* Unstable decay indicator */}
      {isUnstable && (
        <mesh position={[0, 0, 0.3]} rotation={[0, 0, 0]}>
          <ringGeometry args={[CELL_SIZE * 0.35, CELL_SIZE * 0.4, 32, 1, 0, Math.PI * 2 * (tile.unstable || 0)]} />
          <meshBasicMaterial color="#ff4444" />
        </mesh>
      )}

      {/* Modifier indicator */}
      {tile.modifier === 'glass' && (
        <mesh position={[0, 0, 0.35]}>
          <boxGeometry args={[CELL_SIZE * 0.6, CELL_SIZE * 0.6, 0.05]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.4}
            transmission={0.6}
            roughness={0}
          />
        </mesh>
      )}
    </group>
  );
};

// Grid background with modifier indicators
const GridBackground: React.FC<{
  modifiers: Map<string, CellModifier>;
  wormholeLinks: Array<[[number, number], [number, number]]>;
}> = ({ modifiers, wormholeLinks }) => {
  const cells = useMemo(() => {
    const result: JSX.Element[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const pos = getGridPosition(row, col);
        const key = `${row}-${col}`;
        const modifier = modifiers.get(key);
        
        let cellColor = '#1a1a2e';
        if (modifier?.type === 'wormhole') cellColor = '#2d1b4e';
        if (modifier?.type === 'glass') cellColor = '#2a3a4a';

        result.push(
          <mesh key={`cell-${key}`} position={pos}>
            <boxGeometry args={[CELL_SIZE, CELL_SIZE, 0.1]} />
            <meshStandardMaterial color={cellColor} transparent opacity={0.8} />
          </mesh>
        );

        // Wormhole indicator
        if (modifier?.type === 'wormhole') {
          result.push(
            <mesh key={`wormhole-${key}`} position={[pos[0], pos[1], 0.1]} rotation={[0, 0, Date.now() * 0.001]}>
              <ringGeometry args={[CELL_SIZE * 0.3, CELL_SIZE * 0.4, 32]} />
              <meshBasicMaterial color={MODIFIER_COLORS.wormhole} transparent opacity={0.6} />
            </mesh>
          );
        }
      }
    }
    return result;
  }, [modifiers]);

  return <group position={[0, 0, -0.2]}>{cells}</group>;
};

// Gravity indicator
const GravityIndicator: React.FC<{ flipped: boolean }> = ({ flipped }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 2;
    }
  });

  return (
    <group position={[0, flipped ? 5 : -5, 0]}>
      <mesh ref={meshRef}>
        <coneGeometry args={[0.3, 0.6, 4]} />
        <meshStandardMaterial
          color={flipped ? '#ff6b6b' : '#48dbfb'}
          emissive={flipped ? '#ff6b6b' : '#48dbfb'}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Forma: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(formaState);
  const { camera, scene } = useThree();

  const [grid, setGrid] = useState<(Tile | null)[][]>(createEmptyGrid);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [modifiers, setModifiers] = useState<Map<string, CellModifier>>(new Map());
  const [wormholeLinks, setWormholeLinks] = useState<Array<[[number, number], [number, number]]>>([]);

  const rngRef = useRef(new SeededRandom(Date.now()));
  const tileIdCounter = useRef(0);
  const canMove = useRef(true);

  // Camera setup
  useEffect(() => {
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    scene.background = new THREE.Color('#0a0a1a');
  }, [camera, scene]);

  // Spawn new tile
  const spawnTile = useCallback((currentGrid: (Tile | null)[][]) => {
    const emptyCells: [number, number][] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (!currentGrid[row][col]) {
          emptyCells.push([row, col]);
        }
      }
    }

    if (emptyCells.length === 0) return null;

    const [row, col] = rngRef.current.pick(emptyCells);
    const sides = rngRef.current.bool(0.9) ? 3 : 4;
    
    // Chance for unstable tile (increases with score)
    const unstableChance = UNSTABLE_CHANCE + formaState.score * 0.0001;
    const isUnstable = rngRef.current.bool(Math.min(0.3, unstableChance));

    const tile: Tile = {
      id: `tile-${tileIdCounter.current++}`,
      sides,
      row,
      col,
      isNew: true,
      unstable: isUnstable ? 1.0 : undefined,
    };

    return tile;
  }, []);

  // Spawn modifier on board
  const spawnModifier = useCallback(() => {
    const emptyCells: [number, number][] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const key = `${row}-${col}`;
        if (!modifiers.has(key)) {
          emptyCells.push([row, col]);
        }
      }
    }

    if (emptyCells.length < 2) return;

    const modType = rngRef.current.bool(0.6) ? 'wormhole' : 'glass';

    if (modType === 'wormhole' && emptyCells.length >= 2) {
      const [cell1, cell2] = rngRef.current.shuffle(emptyCells).slice(0, 2);
      setModifiers((prev) => {
        const newMap = new Map(prev);
        newMap.set(`${cell1[0]}-${cell1[1]}`, { type: 'wormhole', linkedCell: cell2 });
        newMap.set(`${cell2[0]}-${cell2[1]}`, { type: 'wormhole', linkedCell: cell1 });
        return newMap;
      });
      setWormholeLinks((prev) => [...prev, [cell1, cell2]]);
    } else {
      const cell = rngRef.current.pick(emptyCells);
      setModifiers((prev) => {
        const newMap = new Map(prev);
        newMap.set(`${cell[0]}-${cell[1]}`, { type: 'glass' });
        return newMap;
      });
    }
  }, [modifiers]);

  // Initialize game
  useEffect(() => {
    const initialGrid = createEmptyGrid();
    const initialTiles: Tile[] = [];

    for (let i = 0; i < 2; i++) {
      const tile = spawnTile(initialGrid);
      if (tile) {
        initialGrid[tile.row][tile.col] = tile;
        initialTiles.push(tile);
      }
    }

    setGrid(initialGrid);
    setTiles(initialTiles);
  }, [spawnTile]);

  // Move tiles
  const moveTiles = useCallback((direction: Direction) => {
    if (!canMove.current || snap.gameOver) return;
    canMove.current = false;

    // Apply gravity flip
    let actualDirection = direction;
    if (snap.gravityFlipped) {
      if (direction === 'up') actualDirection = 'down';
      else if (direction === 'down') actualDirection = 'up';
    }

    setGrid((prevGrid) => {
      const newGrid = createEmptyGrid();
      const newTiles: Tile[] = [];
      let moved = false;
      let scoreGain = 0;
      let mergesThisMove = 0;

      const rows = actualDirection === 'down'
        ? Array.from({ length: GRID_SIZE }, (_, i) => GRID_SIZE - 1 - i)
        : Array.from({ length: GRID_SIZE }, (_, i) => i);
      const cols = actualDirection === 'right'
        ? Array.from({ length: GRID_SIZE }, (_, i) => GRID_SIZE - 1 - i)
        : Array.from({ length: GRID_SIZE }, (_, i) => i);

      const processLine = (line: (Tile | null)[], setCell: (idx: number, tile: Tile | null) => void) => {
        const compacted: Tile[] = [];

        for (const tile of line) {
          if (tile) {
            // Decay unstable tiles
            let newTile = { ...tile, isNew: false, merging: false };
            if (newTile.unstable !== undefined) {
              newTile.unstable -= UNSTABLE_DECAY_RATE;
              if (newTile.unstable <= 0) {
                // Tile decays - skip it
                moved = true;
                continue;
              }
            }
            compacted.push(newTile);
          }
        }

        const merged: Tile[] = [];
        let i = 0;
        while (i < compacted.length) {
          if (i + 1 < compacted.length && compacted[i].sides === compacted[i + 1].sides) {
            const newSides = compacted[i].sides + 1;
            merged.push({
              ...compacted[i],
              sides: newSides,
              merging: true,
              unstable: undefined, // Merging removes unstable status
            });
            scoreGain += newSides * newSides;
            mergesThisMove++;
            if (newSides > formaState.highestSides) {
              formaState.highestSides = newSides;
            }
            moved = true;
            i += 2;
          } else {
            merged.push(compacted[i]);
            i++;
          }
        }

        for (let j = 0; j < merged.length; j++) {
          setCell(j, merged[j]);
        }
      };

      if (actualDirection === 'up' || actualDirection === 'down') {
        for (const col of cols) {
          const line: (Tile | null)[] = [];
          for (const row of rows) {
            line.push(prevGrid[row][col]);
          }
          processLine(line, (idx, tile) => {
            const targetRow = actualDirection === 'up' ? idx : GRID_SIZE - 1 - idx;
            if (tile) {
              const originalRow = tile.row;
              tile.row = targetRow;
              tile.col = col;
              if (originalRow !== targetRow) moved = true;
              newGrid[targetRow][col] = tile;
              newTiles.push(tile);
            }
          });
        }
      } else {
        for (const row of rows) {
          const line: (Tile | null)[] = [];
          for (const col of cols) {
            line.push(prevGrid[row][col]);
          }
          processLine(line, (idx, tile) => {
            const targetCol = actualDirection === 'left' ? idx : GRID_SIZE - 1 - idx;
            if (tile) {
              const originalCol = tile.col;
              tile.row = row;
              tile.col = targetCol;
              if (originalCol !== targetCol) moved = true;
              newGrid[row][targetCol] = tile;
              newTiles.push(tile);
            }
          });
        }
      }

      if (moved) {
        formaState.score += scoreGain;
        formaState.mergeCount += mergesThisMove;

        // Check for gravity flip
        if (formaState.mergeCount > 0 && formaState.mergeCount % GRAVITY_FLIP_INTERVAL === 0) {
          formaState.gravityFlipped = !formaState.gravityFlipped;
        }

        // Spawn modifier after certain merges
        if (formaState.mergeCount % 5 === 0 && formaState.mergeCount > formaState.modifiersUnlocked * 5) {
          formaState.modifiersUnlocked++;
          spawnModifier();
        }

        if (formaState.score > formaState.highScore) {
          formaState.highScore = formaState.score;
        }

        const newTile = spawnTile(newGrid);
        if (newTile) {
          newGrid[newTile.row][newTile.col] = newTile;
          newTiles.push(newTile);
        }
      }

      setTiles(newTiles);

      const hasEmpty = newGrid.some((row) => row.some((cell) => !cell));
      const canMerge = () => {
        for (let row = 0; row < GRID_SIZE; row++) {
          for (let col = 0; col < GRID_SIZE; col++) {
            const cell = newGrid[row][col];
            if (!cell) continue;
            if (row > 0 && newGrid[row - 1][col]?.sides === cell.sides) return true;
            if (col > 0 && newGrid[row][col - 1]?.sides === cell.sides) return true;
          }
        }
        return false;
      };

      if (!hasEmpty && !canMerge()) {
        formaState.gameOver = true;
      }

      setTimeout(() => {
        canMove.current = true;
      }, 100);

      return newGrid;
    });
  }, [snap.gameOver, snap.gravityFlipped, spawnTile, spawnModifier]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r') {
          formaState.reset();
          setModifiers(new Map());
          setWormholeLinks([]);
          const initialGrid = createEmptyGrid();
          const initialTiles: Tile[] = [];
          for (let i = 0; i < 2; i++) {
            const tile = spawnTile(initialGrid);
            if (tile) {
              initialGrid[tile.row][tile.col] = tile;
              initialTiles.push(tile);
            }
          }
          setGrid(initialGrid);
          setTiles(initialTiles);
          rngRef.current = new SeededRandom(Date.now());
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          moveTiles('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          moveTiles('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveTiles('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveTiles('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snap.gameOver, moveTiles, spawnTile]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 5, 10]} intensity={1} />

      {/* Grid */}
      <GridBackground modifiers={modifiers} wormholeLinks={wormholeLinks} />

      {/* Gravity indicator */}
      <GravityIndicator flipped={snap.gravityFlipped} />

      {/* Tiles */}
      {tiles.map((tile) => (
        <PolygonTile key={tile.id} tile={tile} />
      ))}

      {/* HUD */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-white">
            <div className="text-2xl font-bold">{snap.score}</div>
            <div className="text-xs text-white/60">Best: {snap.highScore}</div>
            <div className="text-xs text-white/40 mt-1">
              Max: {snap.highestSides}-gon
            </div>
          </div>
        </div>

        <div className="absolute top-4 left-40 z-50 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs">
            <div>Merges: {snap.mergeCount}</div>
            {snap.gravityFlipped && (
              <div className="text-red-400 mt-1 animate-pulse">Gravity Flipped!</div>
            )}
          </div>
        </div>

        <div className="absolute bottom-4 left-4 text-white/60 text-sm pointer-events-auto">
          <div>WASD or Arrow Keys to merge</div>
          <div className="text-xs mt-1">Red tiles decay - merge them fast!</div>
        </div>

        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
            <div className="text-center">
              <h1 className="text-5xl font-bold text-white mb-4">GAME OVER</h1>
              <p className="text-3xl text-white/80 mb-2">{snap.score}</p>
              <p className="text-lg text-white/60 mb-1">Best: {snap.highScore}</p>
              <p className="text-lg text-white/60 mb-1">Max Polygon: {snap.highestSides} sides</p>
              <p className="text-lg text-white/60 mb-6">Total Merges: {snap.mergeCount}</p>
              <p className="text-white/50">Press R to restart</p>
            </div>
          </div>
        )}
      </Html>
    </>
  );
};

export default Forma;
