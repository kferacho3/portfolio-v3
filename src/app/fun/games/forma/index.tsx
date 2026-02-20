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

type TileFxKind = 'collision' | 'merge';

interface TileFx {
  id: string;
  kind: TileFxKind;
  row: number;
  col: number;
  sides: number;
  color: string;
  intensity: number;
}

interface MergeSignature {
  label: string;
  ringCount: number;
  shardCount: number;
  spin: number;
  blast: number;
  duration: number;
}

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
    if (size !== 4) return;
    formaState.gridSize = 4;
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

const blendHex = (a: string, b: string, t: number) => {
  const colA = new THREE.Color(a);
  const colB = new THREE.Color(b);
  colA.lerp(colB, THREE.MathUtils.clamp(t, 0, 1));
  return `#${colA.getHexString()}`;
};

const withAlpha = (color: string, alpha: number) => {
  const clamped = THREE.MathUtils.clamp(alpha, 0, 1);
  const parsed = new THREE.Color(color);
  return `rgba(${Math.round(parsed.r * 255)}, ${Math.round(parsed.g * 255)}, ${Math.round(parsed.b * 255)}, ${clamped})`;
};

const mergeSignatureForSides = (sides: number): MergeSignature => {
  const motifs = [
    'Prism Bloom',
    'Nova Lattice',
    'Flux Crown',
    'Halo Weave',
    'Pulse Orbit',
    'Zenith Spiral',
    'Glyph Burst',
    'Arc Bloom',
  ];
  const normalized = Math.max(3, Math.floor(sides));
  const tier = normalized - 3;
  return {
    label: `${motifs[normalized % motifs.length]} • ${normalized}-gon`,
    ringCount: 2 + (tier % 2),
    shardCount: 6 + Math.min(12, tier),
    spin: 1.1 + tier * 0.06,
    blast: 1 + Math.min(1.5, tier * 0.08),
    duration: 0.36 + Math.min(0.58, tier * 0.02),
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
  const [initialX, initialY, initialZ] = getGridPosition(
    tile.row,
    tile.col,
    config
  );
  const targetPos = useRef(new THREE.Vector3(initialX, initialY, initialZ));
  const scaleRef = useRef(tile.isNew ? 0 : 1);
  const rotationRef = useRef(0);
  const bounds = useMemo(() => getGridBounds(config), [config]);

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
  }, [
    tile.row,
    tile.col,
    config,
    bounds.minX,
    bounds.maxX,
    bounds.minY,
    bounds.maxY,
  ]);

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
const GridBackground: React.FC<{
  config: GridConfig;
  palette: FormaPalette;
}> = ({ config, palette }) => {
  const haloRef = useRef<THREE.Mesh>(null);
  const scanRef = useRef<THREE.Mesh>(null);

  const frameColor = useMemo(
    () => blendHex(colorForSides(6, palette), '#8ec5ff', 0.35),
    [palette]
  );
  const glowColor = useMemo(
    () => blendHex(colorForSides(4, palette), '#37e5ff', 0.45),
    [palette]
  );

  const cells = useMemo(() => {
    const result: JSX.Element[] = [];
    const darkCell = blendHex(colorForSides(3, palette), '#050915', 0.86);
    const lightCell = blendHex(colorForSides(4, palette), '#101631', 0.82);

    for (let row = 0; row < config.size; row++) {
      for (let col = 0; col < config.size; col++) {
        const pos = getGridPosition(row, col, config);
        const key = `${row}-${col}`;

        // Checkerboard pattern for visual clarity
        const isDark = (row + col) % 2 === 0;
        const cellColor = isDark ? darkCell : lightCell;
        const emissive = blendHex(cellColor, frameColor, 0.24);

        result.push(
          <mesh key={`cell-${key}`} position={[pos[0], pos[1], -0.1]}>
            <boxGeometry
              args={[config.cellSize * 0.95, config.cellSize * 0.95, 0.05]}
            />
            <meshStandardMaterial
              color={cellColor}
              emissive={emissive}
              emissiveIntensity={0.18}
              transparent
              opacity={0.94}
              roughness={0.74}
              metalness={0.08}
            />
          </mesh>
        );
      }
    }
    return result;
  }, [config, frameColor, palette]);

  const totalWidth =
    config.size * (config.cellSize + config.cellGap) - config.cellGap;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (haloRef.current) {
      const pulse = 0.7 + Math.sin(t * 1.9) * 0.2;
      haloRef.current.scale.setScalar(1 + pulse * 0.07);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + pulse * 0.08;
    }

    if (scanRef.current) {
      scanRef.current.position.y = Math.sin(t * 0.86) * (totalWidth * 0.42);
      const mat = scanRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.09 + (Math.sin(t * 1.6) * 0.06 + 0.06);
    }
  });

  return (
    <group position={[0, 0, -0.2]}>
      <mesh ref={haloRef} position={[0, 0, -0.18]}>
        <circleGeometry args={[totalWidth * 0.67, 64]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.14} />
      </mesh>

      <mesh ref={scanRef} position={[0, 0, -0.11]}>
        <planeGeometry args={[totalWidth * 0.92, config.cellSize * 0.22]} />
        <meshBasicMaterial color={frameColor} transparent opacity={0.16} />
      </mesh>

      {cells}

      {/* Border frame */}
      <lineSegments>
        <edgesGeometry
          args={[
            new THREE.BoxGeometry(totalWidth + 0.24, totalWidth + 0.24, 0.1),
          ]}
        />
        <lineBasicMaterial color={frameColor} linewidth={2} />
      </lineSegments>
    </group>
  );
};

const TileEffectInstance: React.FC<{
  effect: TileFx;
  config: GridConfig;
  onDone: (id: string) => void;
}> = ({ effect, config, onDone }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const secondaryRingRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const shardRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ageRef = useRef(0);
  const completedRef = useRef(false);

  const signature = useMemo(
    () => mergeSignatureForSides(effect.sides),
    [effect.sides]
  );
  const life =
    effect.kind === 'merge'
      ? signature.duration
      : 0.24 + effect.intensity * 0.2;
  const shardCount =
    effect.kind === 'merge'
      ? signature.shardCount
      : 5 + Math.round(effect.intensity * 3);
  const shardAngles = useMemo(
    () =>
      Array.from({ length: shardCount }, (_, index) => {
        return (index / Math.max(shardCount, 1)) * Math.PI * 2;
      }),
    [shardCount]
  );

  const [x, y] = getGridPosition(effect.row, effect.col, config);

  useFrame((_, delta) => {
    ageRef.current += delta;
    const progress = THREE.MathUtils.clamp(ageRef.current / life, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 2);
    const fade = 1 - progress;
    const spinBoost = effect.kind === 'merge' ? signature.spin : 1;
    const blast = effect.kind === 'merge' ? signature.blast : 1;

    if (ringRef.current) {
      const scale = 0.4 + eased * (0.95 + effect.intensity * 0.55) * blast;
      ringRef.current.scale.setScalar(scale);
      ringRef.current.rotation.z += delta * spinBoost;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.7 * fade;
    }

    if (secondaryRingRef.current) {
      const scale = 0.3 + eased * (1.3 + effect.intensity * 0.6) * blast;
      secondaryRingRef.current.scale.setScalar(scale);
      secondaryRingRef.current.rotation.z -= delta * spinBoost * 0.8;
      const mat = secondaryRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = effect.kind === 'merge' ? 0.56 * fade : 0;
    }

    if (coreRef.current) {
      const scale = 1 - eased * 0.92;
      coreRef.current.scale.setScalar(Math.max(0.08, scale));
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.74 * fade;
    }

    shardRefs.current.forEach((shard, index) => {
      if (!shard) return;
      const angle = shardAngles[index] + progress * spinBoost * 1.8;
      const dist =
        config.cellSize *
        (0.16 + eased * (0.75 + effect.intensity * 0.18)) *
        blast;
      shard.position.set(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        config.cellSize * 0.02
      );
      const shardScale =
        (1 - eased) * config.cellSize * (effect.kind === 'merge' ? 0.12 : 0.08);
      shard.scale.setScalar(Math.max(config.cellSize * 0.025, shardScale));
      const mat = shard.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.82 * fade;
    });

    if (groupRef.current) {
      groupRef.current.position.set(x, y, config.cellSize * 0.12);
    }

    if (progress >= 1 && !completedRef.current) {
      completedRef.current = true;
      onDone(effect.id);
    }
  });

  return (
    <group ref={groupRef} position={[x, y, config.cellSize * 0.12]}>
      <mesh ref={ringRef}>
        <ringGeometry
          args={[config.cellSize * 0.18, config.cellSize * 0.24, 32, 1]}
        />
        <meshBasicMaterial color={effect.color} transparent opacity={0.65} />
      </mesh>

      <mesh ref={secondaryRingRef}>
        <ringGeometry
          args={[
            config.cellSize * 0.1,
            config.cellSize * 0.14,
            Math.min(48, effect.sides * 4),
            1,
          ]}
        />
        <meshBasicMaterial
          color={blendHex(effect.color, '#ffffff', 0.25)}
          transparent
          opacity={0.48}
        />
      </mesh>

      <mesh ref={coreRef}>
        <circleGeometry
          args={[config.cellSize * 0.16, Math.min(effect.sides, 20)]}
        />
        <meshBasicMaterial
          color={blendHex(effect.color, '#ffffff', 0.35)}
          transparent
          opacity={0.72}
        />
      </mesh>

      {shardAngles.map((_, index) => (
        <mesh
          key={`fx-${effect.id}-shard-${index}`}
          ref={(mesh) => {
            shardRefs.current[index] = mesh;
          }}
        >
          <circleGeometry
            args={[
              config.cellSize * (effect.kind === 'merge' ? 0.08 : 0.06),
              Math.min(Math.max(3, effect.sides), 16),
            ]}
          />
          <meshBasicMaterial color={effect.color} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
};

const TileEffectLayer: React.FC<{
  effects: TileFx[];
  config: GridConfig;
  onDone: (id: string) => void;
}> = ({ effects, config, onDone }) => {
  return (
    <group>
      {effects.map((effect) => (
        <TileEffectInstance
          key={effect.id}
          effect={effect}
          config={config}
          onDone={onDone}
        />
      ))}
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

          <div className="mb-8 flex justify-center">
            <button
              onClick={() => onSelect(4)}
              onMouseEnter={() => setHoveredSize(4)}
              onMouseLeave={() => setHoveredSize(null)}
              className={`p-5 rounded-xl border-2 text-left transition-all duration-300 w-full max-w-md ${
                hoveredSize === 4
                  ? 'bg-white/20 border-white/60 scale-[1.02]'
                  : 'bg-white/5 border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-3xl font-bold text-white">4×4</div>
                <div className="text-[11px] uppercase tracking-wider text-white/60">
                  {GRID_CONFIGS[4].name}
                </div>
              </div>
              <div className="text-xs text-white/60 mt-2">
                {GRID_CONFIGS[4].description}
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-white/40">
                <span>{GRID_CONFIGS[4].initialTiles} start</span>
                <span>
                  {(GRID_CONFIGS[4].unstableDecayRate * 100).toFixed(0)}% decay
                </span>
              </div>
            </button>
          </div>

          <div className="text-white/50 text-sm mb-8">
            Extended Forma grid modes are available on{' '}
            <a
              href="https://prism3d.studio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-200 underline underline-offset-2"
            >
              prism3d.studio
            </a>
            .
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

interface ComboToast {
  id: string;
  label: string;
  color: string;
}

const Forma: React.FC<{ soundsOn?: boolean }> = ({ soundsOn = true }) => {
  const snap = useSnapshot(formaState);
  const { camera, scene } = useThree();

  const config = GRID_CONFIGS[snap.gridSize];
  const fxIntensityBoost = soundsOn ? 1 : 0.92;

  const [, setGrid] = useState<(Tile | null)[][]>(() =>
    createEmptyGrid(config.size)
  );
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [activePalette, setActivePalette] = useState<FormaPalette>(
    FORMA_PALETTES[0]
  );
  const [tileFx, setTileFx] = useState<TileFx[]>([]);
  const [comboToast, setComboToast] = useState<ComboToast | null>(null);

  const hudAccent = useMemo(
    () => colorForSides(Math.max(4, snap.highestSides), activePalette),
    [activePalette, snap.highestSides]
  );
  const boardAmbient = useMemo(
    () => blendHex(colorForSides(3, activePalette), '#0a0b17', 0.72),
    [activePalette]
  );

  const rngRef = useRef(new SeededRandom(Date.now()));
  const tileIdCounter = useRef(0);
  const gameRunRef = useRef(0);
  const paletteIndexRef = useRef(0);
  const canMove = useRef(true);
  const fxIdCounter = useRef(0);
  const moveUnlockTimeoutRef = useRef<number | null>(null);
  const comboToastTimeoutRef = useRef<number | null>(null);

  // Camera setup - updates when grid size changes
  useEffect(() => {
    camera.position.set(0, 0, config.cameraZ);
    camera.lookAt(0, 0, 0);
    scene.background = new THREE.Color(boardAmbient);
  }, [camera, scene, config.cameraZ, boardAmbient]);

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

  const scheduleMoveUnlock = useCallback((delayMs: number) => {
    if (moveUnlockTimeoutRef.current !== null) {
      window.clearTimeout(moveUnlockTimeoutRef.current);
    }
    moveUnlockTimeoutRef.current = window.setTimeout(() => {
      canMove.current = true;
      moveUnlockTimeoutRef.current = null;
    }, delayMs);
  }, []);

  const pushEffects = useCallback((effects: Omit<TileFx, 'id'>[]) => {
    if (effects.length === 0) return;
    setTileFx((prev) => {
      const appended = effects.map((effect) => ({
        ...effect,
        id: `fx-${fxIdCounter.current++}`,
      }));
      return [...prev, ...appended].slice(-220);
    });
  }, []);

  const removeEffect = useCallback((id: string) => {
    setTileFx((prev) => prev.filter((effect) => effect.id !== id));
  }, []);

  const showComboToast = useCallback((label: string, color: string) => {
    if (comboToastTimeoutRef.current !== null) {
      window.clearTimeout(comboToastTimeoutRef.current);
    }
    const next: ComboToast = {
      id: `combo-${Date.now()}-${fxIdCounter.current++}`,
      label,
      color,
    };
    setComboToast(next);
    comboToastTimeoutRef.current = window.setTimeout(() => {
      setComboToast((current) => (current?.id === next.id ? null : current));
      comboToastTimeoutRef.current = null;
    }, 780);
  }, []);

  useEffect(() => {
    return () => {
      if (moveUnlockTimeoutRef.current !== null) {
        window.clearTimeout(moveUnlockTimeoutRef.current);
      }
      if (comboToastTimeoutRef.current !== null) {
        window.clearTimeout(comboToastTimeoutRef.current);
      }
    };
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
    setTileFx([]);
    setComboToast(null);
    canMove.current = true;
    if (moveUnlockTimeoutRef.current !== null) {
      window.clearTimeout(moveUnlockTimeoutRef.current);
      moveUnlockTimeoutRef.current = null;
    }
    if (comboToastTimeoutRef.current !== null) {
      window.clearTimeout(comboToastTimeoutRef.current);
      comboToastTimeoutRef.current = null;
    }

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
      setTileFx([]);
      setComboToast(null);
      canMove.current = true;
      if (moveUnlockTimeoutRef.current !== null) {
        window.clearTimeout(moveUnlockTimeoutRef.current);
        moveUnlockTimeoutRef.current = null;
      }
      if (comboToastTimeoutRef.current !== null) {
        window.clearTimeout(comboToastTimeoutRef.current);
        comboToastTimeoutRef.current = null;
      }
    }
  }, [snap.started, snap.gridSize]);

  // Move tiles with proper boundary checking
  const moveTiles = useCallback(
    (direction: Direction) => {
      if (!canMove.current || snap.gameOver || !snap.started) return;
      canMove.current = false;

      const cfg = GRID_CONFIGS[snap.gridSize];
      const fxBuffer: Omit<TileFx, 'id'>[] = [];
      let bestMergedSides = 0;

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
              const newTile = { ...tile, isNew: false, merging: false };

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
              bestMergedSides = Math.max(bestMergedSides, newSides);
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
                const originalCol = tile.col;
                tile.row = targetRow;
                tile.col = col;
                const travel =
                  Math.abs(originalRow - targetRow) +
                  Math.abs(originalCol - col);
                if (travel > 0) {
                  moved = true;
                  fxBuffer.push({
                    kind: 'collision',
                    row: targetRow,
                    col,
                    sides: tile.sides,
                    color: colorForSides(tile.sides, activePalette),
                    intensity:
                      Math.min(1.9, 0.7 + travel * 0.34) * fxIntensityBoost,
                  });
                }
                if (tile.merging) {
                  fxBuffer.push({
                    kind: 'merge',
                    row: targetRow,
                    col,
                    sides: tile.sides,
                    color: colorForSides(tile.sides, activePalette),
                    intensity:
                      (1 + Math.min(1.6, (tile.sides - 3) * 0.09)) *
                      fxIntensityBoost,
                  });
                }
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
                const originalRow = tile.row;
                const originalCol = tile.col;
                tile.row = row;
                tile.col = targetCol;
                const travel =
                  Math.abs(originalRow - row) +
                  Math.abs(originalCol - targetCol);
                if (travel > 0) {
                  moved = true;
                  fxBuffer.push({
                    kind: 'collision',
                    row,
                    col: targetCol,
                    sides: tile.sides,
                    color: colorForSides(tile.sides, activePalette),
                    intensity:
                      Math.min(1.9, 0.7 + travel * 0.34) * fxIntensityBoost,
                  });
                }
                if (tile.merging) {
                  fxBuffer.push({
                    kind: 'merge',
                    row,
                    col: targetCol,
                    sides: tile.sides,
                    color: colorForSides(tile.sides, activePalette),
                    intensity:
                      (1 + Math.min(1.6, (tile.sides - 3) * 0.09)) *
                      fxIntensityBoost,
                  });
                }
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
              fxBuffer.push({
                kind: 'collision',
                row: newTile.row,
                col: newTile.col,
                sides: newTile.sides,
                color: colorForSides(newTile.sides, activePalette),
                intensity: 0.56 * fxIntensityBoost,
              });
            }
          }

          pushEffects(fxBuffer);
          if (mergesThisMove > 0 && bestMergedSides >= 4) {
            const signature = mergeSignatureForSides(bestMergedSides);
            const chainLabel =
              mergesThisMove > 1
                ? `${mergesThisMove}x Chain • ${signature.label}`
                : signature.label;
            showComboToast(
              chainLabel,
              blendHex(
                colorForSides(bestMergedSides, activePalette),
                '#ffffff',
                0.24
              )
            );
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

        scheduleMoveUnlock(moved ? 88 : 46);

        return newGrid;
      });
    },
    [
      snap.gameOver,
      snap.started,
      snap.gridSize,
      spawnTile,
      activePalette,
      fxIntensityBoost,
      pushEffects,
      scheduleMoveUnlock,
      showComboToast,
    ]
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

      if (e.repeat) return;

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

    window.addEventListener('pointerdown', handlePointerDown, {
      passive: true,
    });
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
    setTileFx([]);
    setComboToast(null);
    if (moveUnlockTimeoutRef.current !== null) {
      window.clearTimeout(moveUnlockTimeoutRef.current);
      moveUnlockTimeoutRef.current = null;
    }
    if (comboToastTimeoutRef.current !== null) {
      window.clearTimeout(comboToastTimeoutRef.current);
      comboToastTimeoutRef.current = null;
    }
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
      <ambientLight intensity={0.42} />
      <hemisphereLight
        args={[blendHex(hudAccent, '#ffffff', 0.2), '#05070f', 0.42]}
      />
      <pointLight position={[0, 5, 10]} intensity={1.1} color={hudAccent} />
      <pointLight position={[-5, -5, 8]} intensity={0.34} color="#7cdfff" />
      <pointLight position={[5, -3, 7]} intensity={0.28} color="#ff6ac1" />

      {/* Grid */}
      <GridBackground config={config} palette={activePalette} />

      {/* Tiles */}
      {tiles.map((tile) => (
        <PolygonTile
          key={tile.id}
          tile={tile}
          config={config}
          palette={activePalette}
        />
      ))}

      {/* Tile collisions + merge signatures */}
      <TileEffectLayer effects={tileFx} config={config} onDone={removeEffect} />

      {/* HUD */}
      <FixedViewportOverlay>
        {comboToast && (
          <div className="absolute top-4 left-1/2 z-50 -translate-x-1/2">
            <div
              className="rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg"
              style={{
                borderColor: withAlpha(comboToast.color, 0.66),
                background: `linear-gradient(120deg, ${withAlpha(comboToast.color, 0.22)}, rgba(7, 10, 24, 0.86))`,
                boxShadow: `0 0 18px ${withAlpha(comboToast.color, 0.34)}`,
              }}
            >
              {comboToast.label}
            </div>
          </div>
        )}

        <div className="absolute top-4 left-4 z-50">
          <div
            className="backdrop-blur-sm rounded-lg px-4 py-3 text-white border"
            style={{
              borderColor: withAlpha(hudAccent, 0.45),
              background: `linear-gradient(145deg, ${withAlpha(hudAccent, 0.2)}, rgba(7, 10, 26, 0.86))`,
              boxShadow: `0 0 24px ${withAlpha(hudAccent, 0.2)}`,
            }}
          >
            <div className="text-2xl font-bold">{snap.score}</div>
            <div className="text-xs text-white/60">Best: {snap.highScore}</div>
            <div className="text-xs text-white/40 mt-1">
              Max: {snap.highestSides}-gon
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-50">
          <div
            className="backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm border"
            style={{
              borderColor: withAlpha(hudAccent, 0.45),
              background: `linear-gradient(145deg, rgba(7, 10, 24, 0.86), ${withAlpha(hudAccent, 0.16)})`,
            }}
          >
            <div className="font-medium" style={{ color: hudAccent }}>
              {config.name}
            </div>
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
            New: every landing triggers collision pulses. Each polygon upgrade
            has its own signature burst.
          </div>
          <button
            onClick={() => formaState.backToMenu()}
            className="mt-2 text-xs hover:opacity-85"
            style={{ color: hudAccent }}
          >
            ESC - Back to Menu
          </button>
        </div>

        {/* Legend */}
        <div
          className="absolute bottom-4 right-4 text-white/40 text-xs border rounded-md px-2 py-2"
          style={{
            borderColor: withAlpha(hudAccent, 0.32),
            background: 'rgba(6, 8, 20, 0.66)',
          }}
        >
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
            <div
              className="text-center border rounded-2xl px-8 py-7"
              style={{
                borderColor: withAlpha(hudAccent, 0.52),
                background: `linear-gradient(160deg, rgba(6, 8, 20, 0.92), ${withAlpha(hudAccent, 0.18)})`,
              }}
            >
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
                  Back to Menu
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
