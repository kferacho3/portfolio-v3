/**
 * Forma.tsx (Vertex Merge)
 *
 * 2048-like polygon evolution game with multiple grid sizes
 * Merge same-sided polygons to evolve: triangle → square → pentagon → ...
 * Grid sizes: 4x4 (Classic), 8x8 (Extended), 12x12 (Challenge), 16x16 (Extreme)
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
import FixedViewportOverlay from '../_shared/FixedViewportOverlay';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type GridSizeOption = 4 | 8 | 12 | 16;

interface Tile {
  id: string;
  sides: number;
  row: number;
  col: number;
  merging?: boolean;
  isNew?: boolean;
  unstable?: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

// ═══════════════════════════════════════════════════════════════════════════
// GRID SIZE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

interface GridConfig {
  size: number;
  cellSize: number;
  cellGap: number;
  cameraZ: number;
  initialTiles: number;
  unstableChance: number;
  unstableDecayRate: number;
  spawnHigherChance: number; // Chance to spawn 4-sided instead of 3
  maxUnstableChance: number;
  name: string;
  description: string;
}

const GRID_CONFIGS: Record<GridSizeOption, GridConfig> = {
  4: {
    size: 4,
    cellSize: 2,
    cellGap: 0.2,
    cameraZ: 12,
    initialTiles: 2,
    unstableChance: 0.15,
    unstableDecayRate: 0.12,
    spawnHigherChance: 0.1,
    maxUnstableChance: 0.3,
    name: 'Classic',
    description: '4×4 grid - Original gameplay',
  },
  8: {
    size: 8,
    cellSize: 1.2,
    cellGap: 0.12,
    cameraZ: 14,
    initialTiles: 4,
    unstableChance: 0.12,
    unstableDecayRate: 0.08,
    spawnHigherChance: 0.15,
    maxUnstableChance: 0.25,
    name: 'Extended',
    description: '8×8 grid - More room to merge',
  },
  12: {
    size: 12,
    cellSize: 0.9,
    cellGap: 0.08,
    cameraZ: 17,
    initialTiles: 6,
    unstableChance: 0.1,
    unstableDecayRate: 0.06,
    spawnHigherChance: 0.2,
    maxUnstableChance: 0.2,
    name: 'Challenge',
    description: '12×12 grid - Strategic depth',
  },
  16: {
    size: 16,
    cellSize: 0.7,
    cellGap: 0.05,
    cameraZ: 20,
    initialTiles: 8,
    unstableChance: 0.08,
    unstableDecayRate: 0.05,
    spawnHigherChance: 0.25,
    maxUnstableChance: 0.15,
    name: 'Extreme',
    description: '16×16 grid - Ultimate challenge',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

export const formaState = proxy({
  score: 0,
  highScore: 0,
  gameOver: false,
  highestSides: 3,
  mergeCount: 0,
  gridSize: 4 as GridSizeOption,
  started: false,

  reset: () => {
    formaState.score = 0;
    formaState.gameOver = false;
    formaState.highestSides = 3;
    formaState.mergeCount = 0;
  },

  setGridSize: (size: GridSizeOption) => {
    formaState.gridSize = size;
    formaState.reset();
  },

  start: () => {
    formaState.started = true;
  },

  backToMenu: () => {
    formaState.started = false;
    formaState.reset();
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// POLYGON COLORS
// ═══════════════════════════════════════════════════════════════════════════

const MIN_COLOR_SIDE = 3;
const MAX_COLOR_SIDE = 16;

interface FormaPalette {
  name: string;
  seedHue: number;
  colors: Record<number, string>;
}

const createPalette = (
  name: string,
  seedHue: number,
  swatches: string[]
): FormaPalette => {
  const colors: Record<number, string> = {};
  for (let i = 0; i < swatches.length; i += 1) {
    colors[MIN_COLOR_SIDE + i] = swatches[i];
  }
  return { name, seedHue, colors };
};

const FORMA_PALETTES: FormaPalette[] = [
  createPalette('Solar Pulse', 18, [
    '#ff5d8f',
    '#ff9f1c',
    '#ffe066',
    '#2ec4b6',
    '#4cc9f0',
    '#3a86ff',
    '#7b2cbf',
    '#ff006e',
    '#fb5607',
    '#80ed99',
    '#00f5d4',
    '#9bf6ff',
    '#b8c0ff',
    '#ffd6ff',
  ]),
  createPalette('Glacier Neon', 204, [
    '#ff4d6d',
    '#ffbe0b',
    '#06d6a0',
    '#00bbf9',
    '#43aa8b',
    '#3f8efc',
    '#577590',
    '#9d4edd',
    '#f15bb5',
    '#00f5ff',
    '#83c5be',
    '#ffd166',
    '#bde0fe',
    '#caffbf',
  ]),
  createPalette('Electric Dusk', 276, [
    '#ff006e',
    '#ff7f51',
    '#fcbf49',
    '#2a9d8f',
    '#48cae4',
    '#4361ee',
    '#560bad',
    '#b5179e',
    '#ff758f',
    '#06ffa5',
    '#72efdd',
    '#a8dadc',
    '#d0bfff',
    '#ffcad4',
  ]),
  createPalette('Aurora Glass', 142, [
    '#ff4f79',
    '#ff9f43',
    '#ffd60a',
    '#38b000',
    '#00d4ff',
    '#4361ee',
    '#7b2cbf',
    '#c77dff',
    '#f15bb5',
    '#00f5a0',
    '#8ecae6',
    '#90e0ef',
    '#caf0f8',
    '#ffd6a5',
  ]),
  createPalette('Candy Plasma', 328, [
    '#ff595e',
    '#ffca3a',
    '#8ac926',
    '#00c2a8',
    '#1982c4',
    '#4263eb',
    '#7209b7',
    '#f72585',
    '#ff70a6',
    '#70d6ff',
    '#ff9770',
    '#9dffb0',
    '#bdb2ff',
    '#ffc6ff',
  ]),
  createPalette('Obsidian Bloom', 58, [
    '#ff477e',
    '#ff9e00',
    '#ffd166',
    '#06d6a0',
    '#118ab2',
    '#3f37c9',
    '#8338ec',
    '#ff006e',
    '#ff5400',
    '#4cc9f0',
    '#80ffdb',
    '#c77dff',
    '#bde0fe',
    '#ffe5ec',
  ]),
];

const colorForSides = (sides: number, palette: FormaPalette): string => {
  const normalized = Math.max(MIN_COLOR_SIDE, Math.floor(sides));
  if (normalized <= MAX_COLOR_SIDE) {
    return palette.colors[normalized] || '#ffffff';
  }

  // Extend beyond 16 sides with a deterministic hue walk per run palette.
  const hue = (palette.seedHue + (normalized - MIN_COLOR_SIDE) * 37) % 360;
  const saturation = 72 + ((normalized * 11) % 18);
  const lightness = 54 + ((normalized * 7) % 12);
  return `hsl(${hue}, ${Math.min(92, saturation)}%, ${Math.min(68, lightness)}%)`;
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const createEmptyGrid = (size: number): (Tile | null)[][] => {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null)
  );
};

const buildTilesFromGrid = (grid: (Tile | null)[][]): Tile[] => {
  const tiles: Tile[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const tile = grid[row][col];
      if (!tile) continue;
      if (tile.row !== row || tile.col !== col) {
        tile.row = row;
        tile.col = col;
      }
      tiles.push(tile);
    }
  }
  return tiles;
};

const getGridPosition = (
  row: number,
  col: number,
  config: GridConfig
): [number, number, number] => {
  const totalWidth =
    config.size * (config.cellSize + config.cellGap) - config.cellGap;
  const x =
    col * (config.cellSize + config.cellGap) -
    totalWidth / 2 +
    config.cellSize / 2;
  const y =
    (config.size - 1 - row) * (config.cellSize + config.cellGap) -
    totalWidth / 2 +
    config.cellSize / 2;
  return [x, y, 0];
};

const getGridBounds = (config: GridConfig) => {
  const totalWidth =
    config.size * (config.cellSize + config.cellGap) - config.cellGap;
  const halfExtent = totalWidth / 2 - config.cellSize / 2;
  return {
    minX: -halfExtent,
    maxX: halfExtent,
    minY: -halfExtent,
    maxY: halfExtent,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Polygon mesh with animations
const PolygonTile: React.FC<{
  tile: Tile;
  config: GridConfig;
  palette: FormaPalette;
}> = ({ tile, config, palette }) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [initialX, initialY, initialZ] = getGridPosition(tile.row, tile.col, config);
  const targetPos = useRef(new THREE.Vector3(initialX, initialY, initialZ));
  const scaleRef = useRef(tile.isNew ? 0 : 1);
  const rotationRef = useRef(0);
  const bounds = useMemo(
    () => getGridBounds(config),
    [config.size, config.cellSize, config.cellGap]
  );

  const color = colorForSides(tile.sides, palette);
  const isUnstable = tile.unstable !== undefined;

  // Update target position when tile moves
  useEffect(() => {
    const [x, y, z] = getGridPosition(tile.row, tile.col, config);
    targetPos.current.set(
      THREE.MathUtils.clamp(x, bounds.minX, bounds.maxX),
      THREE.MathUtils.clamp(y, bounds.minY, bounds.maxY),
      z
    );
  }, [tile.row, tile.col, config, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]);

  // Hard reset transforms whenever a new tile component mounts.
  useEffect(() => {
    if (!groupRef.current || !meshRef.current) return;
    groupRef.current.position.copy(targetPos.current);
    meshRef.current.position.set(0, 0, 0);
    scaleRef.current = tile.isNew ? 0 : 1;
    rotationRef.current = 0;
  }, [tile.id, tile.isNew]);

  // Create polygon geometry
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const radius = config.cellSize * 0.4;
    const sides = Math.min(tile.sides, 32); // Cap sides for performance

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
      depth: config.cellSize * 0.15,
      bevelEnabled: true,
      bevelThickness: config.cellSize * 0.05,
      bevelSize: config.cellSize * 0.025,
      bevelSegments: 2,
    });
  }, [tile.sides, config.cellSize]);

  // Animate position, scale, and rotation
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        targetPos.current.x,
        Math.min(delta * 16, 1)
      );
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        targetPos.current.y,
        Math.min(delta * 16, 1)
      );
      groupRef.current.position.x = THREE.MathUtils.clamp(
        groupRef.current.position.x,
        bounds.minX,
        bounds.maxX
      );
      groupRef.current.position.y = THREE.MathUtils.clamp(
        groupRef.current.position.y,
        bounds.minY,
        bounds.maxY
      );
      groupRef.current.position.z = targetPos.current.z;
    }

    // Scale animation for new tiles and merge pops.
    if (tile.isNew && scaleRef.current < 1) {
      scaleRef.current = Math.min(1, scaleRef.current + delta * 12);
    } else if (tile.merging) {
      if (scaleRef.current > 1.15) {
        scaleRef.current = THREE.MathUtils.lerp(
          scaleRef.current,
          1,
          Math.min(delta * 10, 1)
        );
      } else {
        scaleRef.current = Math.min(1.2, scaleRef.current + delta * 20);
      }
    } else if (scaleRef.current !== 1) {
      scaleRef.current = THREE.MathUtils.lerp(
        scaleRef.current,
        1,
        Math.min(delta * 12, 1)
      );
    }

    rotationRef.current += delta * (1.2 / Math.max(tile.sides - 2, 1));

    if (meshRef.current) {
      meshRef.current.rotation.set(0, 0, rotationRef.current);
      meshRef.current.scale.setScalar(scaleRef.current);

      // Shake should stay local to the tile, never include world/grid offsets.
      if (isUnstable) {
        const shake =
          Math.sin(state.clock.elapsedTime * 19.4) *
          config.cellSize *
          0.02 *
          (1 - (tile.unstable || 0));
        meshRef.current.position.set(shake, 0, 0);
      } else {
        meshRef.current.position.set(0, 0, 0);
      }
    }

    if (glowRef.current && isUnstable) {
      const pulse = 0.3 + Math.sin(state.clock.elapsedTime * 7.2) * 0.2;
      const glowScale = scaleRef.current * (1.1 + pulse * 0.1);
      glowRef.current.rotation.set(0, 0, rotationRef.current);
      glowRef.current.scale.set(glowScale, glowScale, 1);
    }
  });

  const opacity = isUnstable ? 0.5 + (tile.unstable || 0) * 0.5 : 1;
  const emissiveIntensity = tile.merging ? 0.8 : isUnstable ? 0.6 : 0.3;

  return (
    <group ref={groupRef} position={[initialX, initialY, initialZ]}>
      {/* Main polygon */}
      <mesh ref={meshRef} geometry={geometry}>
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
        <mesh ref={glowRef}>
          <circleGeometry
            args={[config.cellSize * 0.45, Math.min(tile.sides, 16)]}
          />
          <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
        </mesh>
      )}

      {/* Unstable decay indicator */}
      {isUnstable && (
        <mesh position={[0, 0, config.cellSize * 0.2]} rotation={[0, 0, 0]}>
          <ringGeometry
            args={[
              config.cellSize * 0.35,
              config.cellSize * 0.4,
              32,
              1,
              0,
              Math.PI * 2 * (tile.unstable || 0),
            ]}
          />
          <meshBasicMaterial color="#ff4444" />
        </mesh>
      )}

      {/* Side count indicator for higher polygons */}
      {tile.sides >= 6 && (
        <Html
          center
          position={[0, 0, config.cellSize * 0.25]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="text-white font-bold text-xs bg-black/50 rounded px-1"
            style={{ fontSize: `${Math.max(8, 14 - config.size)}px` }}
          >
            {tile.sides}
          </div>
        </Html>
      )}
    </group>
  );
};

// Grid background
const GridBackground: React.FC<{ config: GridConfig }> = ({ config }) => {
  const cells = useMemo(() => {
    const result: JSX.Element[] = [];
    for (let row = 0; row < config.size; row++) {
      for (let col = 0; col < config.size; col++) {
        const pos = getGridPosition(row, col, config);
        const key = `${row}-${col}`;

        // Checkerboard pattern for visual clarity
        const isDark = (row + col) % 2 === 0;
        const cellColor = isDark ? '#1a1a2e' : '#1f1f3a';

        result.push(
          <mesh key={`cell-${key}`} position={[pos[0], pos[1], -0.1]}>
            <boxGeometry
              args={[config.cellSize * 0.95, config.cellSize * 0.95, 0.05]}
            />
            <meshStandardMaterial color={cellColor} transparent opacity={0.9} />
          </mesh>
        );
      }
    }
    return result;
  }, [config]);

  // Grid border
  const totalWidth =
    config.size * (config.cellSize + config.cellGap) - config.cellGap;

  return (
    <group position={[0, 0, -0.2]}>
      {cells}
      {/* Border frame */}
      <lineSegments>
        <edgesGeometry
          args={[
            new THREE.BoxGeometry(totalWidth + 0.2, totalWidth + 0.2, 0.1),
          ]}
        />
        <lineBasicMaterial color="#3a3a5a" linewidth={2} />
      </lineSegments>
    </group>
  );
};

// Mode selection screen
const ModeSelection: React.FC<{
  onSelect: (size: GridSizeOption) => void;
}> = ({ onSelect }) => {
  const [hoveredSize, setHoveredSize] = useState<GridSizeOption | null>(null);

  return (
    <FixedViewportOverlay pointerEvents="auto">
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-[#0a0a1a] to-[#1a1a3a]">
        <div className="text-center max-w-5xl px-4">
          <h1 className="text-6xl font-bold text-white mb-2">FORMA</h1>
          <p className="text-lg text-white/60 mb-8">Polygon Evolution Game</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {([4, 8, 12, 16] as GridSizeOption[]).map((size) => {
              const config = GRID_CONFIGS[size];
              const isHovered = hoveredSize === size;

              return (
                <button
                  key={size}
                  onClick={() => onSelect(size)}
                  onMouseEnter={() => setHoveredSize(size)}
                  onMouseLeave={() => setHoveredSize(null)}
                  className={`p-5 rounded-xl border-2 text-left transition-all duration-300 ${
                    isHovered
                      ? 'bg-white/20 border-white/60 scale-[1.02]'
                      : 'bg-white/5 border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <div className="text-3xl font-bold text-white">
                      {size}×{size}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-white/60">
                      {config.name}
                    </div>
                  </div>
                  <div className="text-xs text-white/60 mt-2">
                    {config.description}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-white/40">
                    <span>{config.initialTiles} start</span>
                    <span>
                      {(config.unstableDecayRate * 100).toFixed(0)}% decay
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-white/40 text-sm">
            <p className="mb-2">Use WASD or Arrow Keys to merge polygons</p>
            <p>Match shapes to evolve: Triangle → Square → Pentagon → ...</p>
          </div>
        </div>
      </div>
    </FixedViewportOverlay>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Forma: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(formaState);
  const { camera, scene } = useThree();

  const config = GRID_CONFIGS[snap.gridSize];

  const [grid, setGrid] = useState<(Tile | null)[][]>(() =>
    createEmptyGrid(config.size)
  );
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [activePalette, setActivePalette] = useState<FormaPalette>(
    FORMA_PALETTES[0]
  );

  const rngRef = useRef(new SeededRandom(Date.now()));
  const tileIdCounter = useRef(0);
  const gameRunRef = useRef(0);
  const paletteIndexRef = useRef(0);
  const canMove = useRef(true);

  // Camera setup - updates when grid size changes
  useEffect(() => {
    camera.position.set(0, 0, config.cameraZ);
    camera.lookAt(0, 0, 0);
    scene.background = new THREE.Color('#0a0a1a');
  }, [camera, scene, config.cameraZ]);

  const randomizePaletteForRun = useCallback(() => {
    if (FORMA_PALETTES.length === 0) return;
    let nextIndex = rngRef.current.int(0, FORMA_PALETTES.length - 1);
    if (FORMA_PALETTES.length > 1 && nextIndex === paletteIndexRef.current) {
      nextIndex =
        (nextIndex + 1 + rngRef.current.int(0, FORMA_PALETTES.length - 2)) %
        FORMA_PALETTES.length;
    }
    paletteIndexRef.current = nextIndex;
    setActivePalette(FORMA_PALETTES[nextIndex]);
  }, []);

  // Spawn new tile
  const spawnTile = useCallback(
    (currentGrid: (Tile | null)[][], cfg: GridConfig) => {
      const emptyCells: [number, number][] = [];
      for (let row = 0; row < cfg.size; row++) {
        for (let col = 0; col < cfg.size; col++) {
          if (!currentGrid[row]?.[col]) {
            emptyCells.push([row, col]);
          }
        }
      }

      if (emptyCells.length === 0) return null;

      const [row, col] = rngRef.current.pick(emptyCells);

      // Higher chance of 4-sided on larger grids
      const sides = rngRef.current.bool(1 - cfg.spawnHigherChance) ? 3 : 4;

      // Unstable chance scales with score and grid size
      const unstableChance = cfg.unstableChance + formaState.score * 0.00005;
      const isUnstable = rngRef.current.bool(
        Math.min(cfg.maxUnstableChance, unstableChance)
      );

      const tile: Tile = {
        id: `run-${gameRunRef.current}-tile-${tileIdCounter.current++}`,
        sides,
        row,
        col,
        isNew: true,
        unstable: isUnstable ? 1.0 : undefined,
      };

      return tile;
    },
    []
  );

  // Initialize game when starting
  const initializeGame = useCallback(() => {
    const cfg = GRID_CONFIGS[formaState.gridSize];
    gameRunRef.current += 1;
    tileIdCounter.current = 0;
    rngRef.current = new SeededRandom(Date.now() + gameRunRef.current * 101);
    randomizePaletteForRun();
    const initialGrid = createEmptyGrid(cfg.size);

    for (let i = 0; i < cfg.initialTiles; i++) {
      const tile = spawnTile(initialGrid, cfg);
      if (tile) {
        initialGrid[tile.row][tile.col] = tile;
      }
    }

    setGrid(initialGrid);
    const tilesFromGrid = buildTilesFromGrid(initialGrid);
    setTiles(tilesFromGrid);
  }, [spawnTile, randomizePaletteForRun]);

  // Initialize when game starts
  useEffect(() => {
    if (snap.started) {
      initializeGame();
    }
  }, [snap.started, snap.gridSize, initializeGame]);

  useEffect(() => {
    if (!snap.started) {
      const emptyGrid = createEmptyGrid(GRID_CONFIGS[snap.gridSize].size);
      setGrid(emptyGrid);
      setTiles([]);
      canMove.current = true;
    }
  }, [snap.started, snap.gridSize]);

  // Move tiles with proper boundary checking
  const moveTiles = useCallback(
    (direction: Direction) => {
      if (!canMove.current || snap.gameOver || !snap.started) return;
      canMove.current = false;

      const cfg = GRID_CONFIGS[snap.gridSize];

      setGrid((prevGrid) => {
        const newGrid = createEmptyGrid(cfg.size);
        let moved = false;
        let scoreGain = 0;
        let mergesThisMove = 0;

        // Determine traversal order based on direction
        const rows =
          direction === 'down'
            ? Array.from({ length: cfg.size }, (_, i) => cfg.size - 1 - i)
            : Array.from({ length: cfg.size }, (_, i) => i);
        const cols =
          direction === 'right'
            ? Array.from({ length: cfg.size }, (_, i) => cfg.size - 1 - i)
            : Array.from({ length: cfg.size }, (_, i) => i);

        const processLine = (
          line: (Tile | null)[],
          setCell: (idx: number, tile: Tile | null) => void
        ) => {
          const compacted: Tile[] = [];

          // Compact tiles and handle unstable decay
          for (const tile of line) {
            if (tile) {
              let newTile = { ...tile, isNew: false, merging: false };

              // Decay unstable tiles
              if (newTile.unstable !== undefined) {
                newTile.unstable -= cfg.unstableDecayRate;
                if (newTile.unstable <= 0) {
                  moved = true;
                  continue; // Tile decayed
                }
              }
              compacted.push(newTile);
            }
          }

          // Merge adjacent matching tiles
          const merged: Tile[] = [];
          let i = 0;
          while (i < compacted.length) {
            if (
              i + 1 < compacted.length &&
              compacted[i].sides === compacted[i + 1].sides
            ) {
              const newSides = compacted[i].sides + 1;
              merged.push({
                ...compacted[i],
                sides: newSides,
                merging: true,
                unstable: undefined, // Merging removes unstable
              });
              scoreGain += newSides * newSides * (cfg.size / 4); // Scale score with grid size
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

          // Place merged tiles
          for (let j = 0; j < merged.length; j++) {
            setCell(j, merged[j]);
          }
        };

        // Process based on direction
        if (direction === 'up' || direction === 'down') {
          for (const col of cols) {
            const line: (Tile | null)[] = [];
            for (const row of rows) {
              if (row >= 0 && row < cfg.size && col >= 0 && col < cfg.size) {
                line.push(prevGrid[row]?.[col] || null);
              }
            }

            processLine(line, (idx, tile) => {
              const targetRow = direction === 'up' ? idx : cfg.size - 1 - idx;
              // Boundary check
              if (
                targetRow >= 0 &&
                targetRow < cfg.size &&
                col >= 0 &&
                col < cfg.size &&
                tile
              ) {
                const originalRow = tile.row;
                tile.row = targetRow;
                tile.col = col;
                if (originalRow !== targetRow) moved = true;
                newGrid[targetRow][col] = tile;
              }
            });
          }
        } else {
          for (const row of rows) {
            const line: (Tile | null)[] = [];
            for (const col of cols) {
              if (row >= 0 && row < cfg.size && col >= 0 && col < cfg.size) {
                line.push(prevGrid[row]?.[col] || null);
              }
            }

            processLine(line, (idx, tile) => {
              const targetCol = direction === 'left' ? idx : cfg.size - 1 - idx;
              // Boundary check
              if (
                row >= 0 &&
                row < cfg.size &&
                targetCol >= 0 &&
                targetCol < cfg.size &&
                tile
              ) {
                const originalCol = tile.col;
                tile.row = row;
                tile.col = targetCol;
                if (originalCol !== targetCol) moved = true;
                newGrid[row][targetCol] = tile;
              }
            });
          }
        }

        // If moved, update score and spawn new tile
        if (moved) {
          formaState.score += Math.round(scoreGain);
          formaState.mergeCount += mergesThisMove;

          if (formaState.score > formaState.highScore) {
            formaState.highScore = formaState.score;
          }

          // Spawn new tile
          const newTile = spawnTile(newGrid, cfg);
          if (newTile) {
            // Verify spawn position is valid
            if (
              newTile.row >= 0 &&
              newTile.row < cfg.size &&
              newTile.col >= 0 &&
              newTile.col < cfg.size &&
              !newGrid[newTile.row][newTile.col]
            ) {
              newGrid[newTile.row][newTile.col] = newTile;
            }
          }
        }

        setTiles(buildTilesFromGrid(newGrid));

        // Check game over
        const hasEmpty = newGrid.some((row) => row.some((cell) => !cell));
        const canMerge = () => {
          for (let r = 0; r < cfg.size; r++) {
            for (let c = 0; c < cfg.size; c++) {
              const cell = newGrid[r]?.[c];
              if (!cell) continue;
              if (r > 0 && newGrid[r - 1]?.[c]?.sides === cell.sides)
                return true;
              if (c > 0 && newGrid[r]?.[c - 1]?.sides === cell.sides)
                return true;
              if (r < cfg.size - 1 && newGrid[r + 1]?.[c]?.sides === cell.sides)
                return true;
              if (c < cfg.size - 1 && newGrid[r]?.[c + 1]?.sides === cell.sides)
                return true;
            }
          }
          return false;
        };

        if (!hasEmpty && !canMerge()) {
          formaState.gameOver = true;
        }

        setTimeout(() => {
          canMove.current = true;
        }, 80);

        return newGrid;
      });
    },
    [snap.gameOver, snap.started, snap.gridSize, spawnTile]
  );

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Back to menu
      if (e.key === 'Escape') {
        formaState.backToMenu();
        return;
      }

      if (!snap.started) return;

      if (snap.gameOver) {
        if (e.key.toLowerCase() === 'r') {
          formaState.reset();
          initializeGame();
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
  }, [snap.gameOver, snap.started, moveTiles, initializeGame]);

  // Swipe controls for mobile/tablet
  useEffect(() => {
    if (!snap.started || snap.gameOver) return;

    let activePointerId: number | null = null;
    let startX: number | null = null;
    let startY: number | null = null;
    const swipeThreshold = Math.max(
      26,
      Math.min(window.innerWidth, window.innerHeight) * 0.045
    );

    const isUiTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest('button,a,input,textarea,select'));
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (isUiTarget(event.target)) return;

      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      if (startX == null || startY == null) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      activePointerId = null;
      startX = null;
      startY = null;

      if (Math.abs(dx) < swipeThreshold && Math.abs(dy) < swipeThreshold) {
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        moveTiles(dx > 0 ? 'right' : 'left');
      } else {
        moveTiles(dy > 0 ? 'down' : 'up');
      }
    };

    const clearSwipe = (event?: PointerEvent) => {
      if (event && activePointerId !== event.pointerId) return;
      activePointerId = null;
      startX = null;
      startY = null;
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', clearSwipe);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', clearSwipe);
    };
  }, [snap.started, snap.gameOver, moveTiles]);

  const handleModeSelect = (size: GridSizeOption) => {
    const nextConfig = GRID_CONFIGS[size];
    setGrid(createEmptyGrid(nextConfig.size));
    setTiles([]);
    tileIdCounter.current = 0;
    rngRef.current = new SeededRandom(Date.now());
    canMove.current = true;
    formaState.setGridSize(size);
    formaState.start();
  };

  // Mode selection screen
  if (!snap.started) {
    return <ModeSelection onSelect={handleModeSelect} />;
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 5, 10]} intensity={1} />
      <pointLight position={[-5, -5, 8]} intensity={0.3} />

      {/* Grid */}
      <GridBackground config={config} />

      {/* Tiles */}
      {tiles.map((tile) => (
        <PolygonTile
          key={tile.id}
          tile={tile}
          config={config}
          palette={activePalette}
        />
      ))}

      {/* HUD */}
      <FixedViewportOverlay>
        <div className="absolute top-4 left-4 z-50">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 text-white">
            <div className="text-2xl font-bold">{snap.score}</div>
            <div className="text-xs text-white/60">Best: {snap.highScore}</div>
            <div className="text-xs text-white/40 mt-1">
              Max: {snap.highestSides}-gon
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-50">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm">
            <div className="font-medium text-cyan-400">{config.name}</div>
            <div className="text-xs text-white/50">
              {snap.gridSize}×{snap.gridSize} Grid
            </div>
            <div className="text-xs text-white/45 mt-1">
              Palette: {activePalette.name}
            </div>
            <div className="text-xs text-white/40 mt-1">
              Merges: {snap.mergeCount}
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 text-white/60 text-sm pointer-events-auto">
          <div>WASD / Arrow Keys / Swipe to merge</div>
          <div className="text-xs mt-1 text-white/40">
            Red tiles decay - merge them fast!
          </div>
          <button
            onClick={() => formaState.backToMenu()}
            className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
          >
            ESC - Back to Menu
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 text-white/40 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded"
              style={{ background: colorForSides(3, activePalette) }}
            />
            <span>3 sides</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded"
              style={{ background: colorForSides(4, activePalette) }}
            />
            <span>4 sides</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded"
              style={{ background: colorForSides(5, activePalette) }}
            />
            <span>5 sides</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ background: colorForSides(6, activePalette) }}
            />
            <span>6+ sides</span>
          </div>
        </div>

        {snap.gameOver && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
            <div className="text-center">
              <h1 className="text-5xl font-bold text-white mb-4">GAME OVER</h1>
              <p className="text-3xl text-white/80 mb-2">{snap.score}</p>
              <p className="text-lg text-white/60 mb-1">
                Best: {snap.highScore}
              </p>
              <p className="text-lg text-white/60 mb-1">
                Max Polygon: {snap.highestSides} sides
              </p>
              <p className="text-lg text-white/60 mb-1">
                Mode: {config.name} ({snap.gridSize}×{snap.gridSize})
              </p>
              <p className="text-lg text-white/60 mb-6">
                Total Merges: {snap.mergeCount}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    formaState.reset();
                    initializeGame();
                  }}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                >
                  Play Again (R)
                </button>
                <button
                  onClick={() => formaState.backToMenu()}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  Change Mode
                </button>
              </div>
            </div>
          </div>
        )}
      </FixedViewportOverlay>
    </>
  );
};

export default Forma;
