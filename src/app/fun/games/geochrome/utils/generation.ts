import * as THREE from 'three';
import {
  CLUSTER_COUNT,
  DEPOSIT_COUNT,
  HAZARD_COUNT,
  SHAPES,
  SHAPES_PER_CLUSTER,
  WORLD_RADIUS,
  colorPalettes,
} from '../constants';
import type {
  ClusterData,
  ClusterPattern,
  ClusterShapeData,
  DepositGate,
  Hazard,
  ShapeType,
} from '../types';

export const selectRandomPalette = () => {
  const keys = Object.keys(colorPalettes);
  return colorPalettes[keys[Math.floor(Math.random() * keys.length)]];
};

export const randomColor = (palette: string[]) =>
  palette[Math.floor(Math.random() * palette.length)];

export const randomShape = (): ShapeType =>
  SHAPES[Math.floor(Math.random() * SHAPES.length)];

export const sphericalToCartesian = (
  theta: number,
  phi: number,
  r: number
): [number, number, number] => {
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
};

export const cartesianToSpherical = (x: number, y: number, z: number) => {
  const r = Math.sqrt(x * x + y * y + z * z);
  return {
    theta: Math.atan2(z, x),
    phi: Math.acos(y / r),
    r,
  };
};

export const generateClusterShapes = (
  pattern: ClusterPattern,
  count: number,
  palette: string[]
): ClusterShapeData[] => {
  const shapes: ClusterShapeData[] = [];
  const materials: Array<
    'standard' | 'iridescent' | 'neon' | 'holographic' | 'crystal'
  > = ['standard', 'iridescent', 'neon', 'holographic', 'crystal'];

  for (let i = 0; i < count; i++) {
    let pos: [number, number, number];
    const angle = (i / count) * Math.PI * 2;
    const radius = 3 + Math.random() * 2;

    switch (pattern) {
      case 'spiral': {
        const spiralAngle = angle * 3;
        const spiralRadius = (i / count) * 6 + 1;
        pos = [
          Math.cos(spiralAngle) * spiralRadius,
          Math.sin(i * 0.5) * 2,
          Math.sin(spiralAngle) * spiralRadius,
        ];
        break;
      }
      case 'mandala': {
        const layer = Math.floor(i / 6);
        const layerAngle = ((i % 6) / 6) * Math.PI * 2 + layer * 0.5;
        const layerRadius = (layer + 1) * 2;
        pos = [
          Math.cos(layerAngle) * layerRadius,
          Math.sin((layer * Math.PI) / 3) * 0.5,
          Math.sin(layerAngle) * layerRadius,
        ];
        break;
      }
      case 'ring': {
        pos = [
          Math.cos(angle) * radius,
          Math.sin(angle * 2) * 0.8,
          Math.sin(angle) * radius,
        ];
        break;
      }
      case 'fibonacci': {
        const golden = (1 + Math.sqrt(5)) / 2;
        const fibAngle = i * golden * Math.PI * 2;
        const fibRadius = Math.sqrt(i) * 1.2;
        pos = [
          Math.cos(fibAngle) * fibRadius,
          Math.sin(fibAngle * 0.5) * 1,
          Math.sin(fibAngle) * fibRadius,
        ];
        break;
      }
      case 'flower': {
        const petals = 6;
        const petalAngle = angle;
        const petalRadius = 3 + Math.cos(petalAngle * petals) * 2;
        pos = [
          Math.cos(petalAngle) * petalRadius,
          Math.sin(petalAngle * petals) * 0.5,
          Math.sin(petalAngle) * petalRadius,
        ];
        break;
      }
      case 'wave': {
        const waveX = (i / count) * 10 - 5;
        pos = [waveX, Math.sin(waveX * 1.5) * 2, Math.cos(waveX * 1.5) * 2];
        break;
      }
      case 'helix': {
        const helixAngle = (i / count) * Math.PI * 4;
        const helixY = (i / count) * 8 - 4;
        pos = [Math.cos(helixAngle) * 3, helixY, Math.sin(helixAngle) * 3];
        break;
      }
      case 'grid': {
        const gridSize = Math.ceil(Math.sqrt(count));
        const gx = (i % gridSize) - gridSize / 2;
        const gz = Math.floor(i / gridSize) - gridSize / 2;
        pos = [gx * 2, Math.sin(gx + gz) * 0.5, gz * 2];
        break;
      }
      default:
        pos = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
    }

    shapes.push({
      id: `shape-${i}-${Math.random().toString(36).slice(2, 8)}`,
      type: randomShape(),
      localPosition: pos,
      color: randomColor(palette),
      scale: 0.6 + Math.random() * 0.4,
      collected: false,
      materialType: materials[Math.floor(Math.random() * materials.length)],
    });
  }

  return shapes;
};

export const generateClusters = (
  count: number = CLUSTER_COUNT
): ClusterData[] => {
  const clusters: ClusterData[] = [];
  const patterns: ClusterPattern[] = [
    'spiral',
    'mandala',
    'ring',
    'fibonacci',
    'flower',
    'wave',
    'helix',
    'grid',
  ];

  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const phi = Math.PI / 4 + (Math.random() * Math.PI) / 2;
    const palette = selectRandomPalette();

    clusters.push({
      id: `cluster-${i}`,
      pattern: patterns[i % patterns.length],
      worldPosition: sphericalToCartesian(theta, phi, WORLD_RADIUS),
      rotation: Math.random() * Math.PI * 2,
      shapes: generateClusterShapes(
        patterns[i % patterns.length],
        SHAPES_PER_CLUSTER,
        palette
      ),
      palette,
    });
  }

  return clusters;
};

export const generateDeposits = (
  count: number = DEPOSIT_COUNT
): DepositGate[] => {
  const deposits: DepositGate[] = [];
  const usedShapes = new Set<ShapeType>();

  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const phi = Math.PI / 2 + (Math.random() - 0.5) * 0.5;

    let shape = randomShape();
    while (usedShapes.has(shape) && usedShapes.size < SHAPES.length) {
      shape = randomShape();
    }
    usedShapes.add(shape);

    const palette = selectRandomPalette();

    deposits.push({
      id: `deposit-${i}`,
      shape,
      position: sphericalToCartesian(theta, phi, WORLD_RADIUS),
      color: randomColor(palette),
    });
  }

  return deposits;
};

export const generateHazards = (count: number = HAZARD_COUNT): Hazard[] => {
  const types: Hazard['type'][] = ['spike', 'orb', 'ring', 'pulse'];

  return Array.from({ length: count }, (_, i) => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.PI / 4 + (Math.random() * Math.PI) / 2;

    return {
      id: `hazard-${i}`,
      position: sphericalToCartesian(theta, phi, WORLD_RADIUS),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
      type: types[Math.floor(Math.random() * types.length)],
    };
  });
};
