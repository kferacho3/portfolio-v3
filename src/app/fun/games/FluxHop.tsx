// src/app/fun/games/FluxHop.tsx
'use client';

import { Html, Sparkles, useTexture } from '@react-three/drei';
import { useFrame, useThree, extend } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';

type MoveDirection = 'forward' | 'backward' | 'left' | 'right';

interface TreeData {
  tileIndex: number;
  height: number;
  type: 'pine' | 'oak' | 'crystal';
}

interface VehicleData {
  x: number;
  length: number;
  width: number;
  color: string;
  type: 'car' | 'bus' | 'truck';
}

interface CritterData {
  x: number;
  length: number;
  width: number;
  color: string;
  bobOffset: number;
}

interface TrainData {
  x: number;
  length: number;
  width: number;
}

interface LogData {
  x: number;
  length: number;
  width: number;
}

interface DroneData {
  x: number;
  z: number;
  radius: number;
  speed: number;
  phase: number;
}

interface BarrierData {
  x: number;
  width: number;
  slideRange: number;
  speed: number;
  phase: number;
}

interface GrassRowData {
  type: 'grass';
  trees: TreeData[];
  boostTile?: number;
}

interface RoadRowData {
  type: 'road';
  direction: 1 | -1;
  speed: number;
  vehicles: VehicleData[];
  barriers?: BarrierData[];
}

interface RiverRowData {
  type: 'river';
  direction: 1 | -1;
  speed: number;
  logs: LogData[];
}

interface IceRowData {
  type: 'ice';
  drift: 1 | -1;
  driftSpeed: number;
}

interface WildlifeRowData {
  type: 'wildlife';
  direction: 1 | -1;
  speed: number;
  critters: CritterData[];
}

interface SubwayRowData {
  type: 'subway';
  direction: 1 | -1;
  speed: number;
  trains: TrainData[];
}

interface DroneRowData {
  type: 'drone';
  drones: DroneData[];
}

type RowData = GrassRowData | RoadRowData | RiverRowData | IceRowData | WildlifeRowData | SubwayRowData | DroneRowData;

interface PlayerState {
  row: number;
  tile: number;
  isMoving: boolean;
}

export const fluxHopState = proxy({
  status: 'running' as 'running' | 'over',
  score: 0,
  bestScore: 0,
  combo: 0,
  bestCombo: 0,
  maxRow: 0,
  resetToken: 0,
  nearMiss: false,
  reset() {
    this.status = 'running';
    this.score = 0;
    this.combo = 0;
    this.maxRow = 0;
    this.nearMiss = false;
    this.resetToken += 1;
  },
  endGame() {
    if (this.status === 'over') return;
    this.status = 'over';
    if (this.score > this.bestScore) this.bestScore = this.score;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
  },
  addScore(points: number) {
    this.score += points;
    if (this.score > this.bestScore) this.bestScore = this.score;
  },
  setCombo(value: number) {
    this.combo = value;
    if (value > this.bestCombo) this.bestCombo = value;
  },
  triggerNearMiss() {
    this.nearMiss = true;
    setTimeout(() => { this.nearMiss = false; }, 200);
  },
});

const TILE_SIZE = 1.4;
const MIN_TILE_INDEX = -6;
const MAX_TILE_INDEX = 6;
const TILES_PER_ROW = MAX_TILE_INDEX - MIN_TILE_INDEX + 1;
const ROW_WIDTH = TILES_PER_ROW * TILE_SIZE;
const SAFE_ROWS_BEHIND = 6;
const INITIAL_ROW_COUNT = 34;
const ADD_ROW_COUNT = 16;
const ROW_BUFFER_BEHIND = 10;
const ROW_BUFFER_AHEAD = 14;
const BASE_STEP_TIME = 0.16;
const BOOST_STEP_TIME = 0.10;
const PLAYER_HEIGHT = 0.9;
const PLAYER_RADIUS = TILE_SIZE * 0.35;
const GROUND_Y = -0.12;
const VEHICLE_Y = 0.28;
const CRITTER_Y = 0.22;
const TRAIN_Y = 0.34;
const LOG_Y = 0.18;
const MIN_X = (MIN_TILE_INDEX - 2) * TILE_SIZE;
const MAX_X = (MAX_TILE_INDEX + 2) * TILE_SIZE;
const MAX_QUEUE = 2;

// Enhanced color palette - vibrant neon arcade style
const NEON_CYAN = '#00fff7';
const NEON_PINK = '#ff00ff';
const NEON_ORANGE = '#ff6b00';
const NEON_GREEN = '#39ff14';
const NEON_PURPLE = '#bf00ff';
const NEON_YELLOW = '#ffff00';

const VEHICLE_COLORS = ['#ff3366', '#00ccff', '#ff9500', '#00ff88', '#cc66ff', '#ffdd00'];
const GRASS_COLORS = ['#1a472a', '#0d3320'];
const GRASS_ACCENT = '#39ff14';
const ROAD_COLOR = '#0a0a12';
const ROAD_STRIPE = '#ffdd00';
const WATER_COLOR = '#001a33';
const WATER_GLOW = '#00fff7';
const ICE_COLOR = '#1a1a2e';
const ICE_GLOW = '#00ccff';
const WILDLIFE_COLOR = '#1a2e1a';
const WILDLIFE_COLORS = ['#ff9500', '#ffcc00', '#ff6600', '#cc66ff'];
const SUBWAY_COLOR = '#050510';
const SUBWAY_GLOW = '#ff3366';
const BOOST_COLOR = '#ffdd00';
const DRONE_COLOR = '#ff00ff';

const BEST_SCORE_KEY = 'fluxhop-best-score';
const BEST_COMBO_KEY = 'fluxhop-best-combo';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => min + Math.random() * (max - min);
const randomChoice = <T,>(values: T[]) => values[Math.floor(Math.random() * values.length)];

const directionToRotation = (direction: MoveDirection) => {
  if (direction === 'left') return Math.PI / 2;   // Face +X direction (screen left with this camera)
  if (direction === 'right') return -Math.PI / 2; // Face -X direction (screen right with this camera)
  if (direction === 'backward') return Math.PI;
  return 0;
};

const worldXToTile = (x: number) => clamp(Math.round(x / TILE_SIZE), MIN_TILE_INDEX, MAX_TILE_INDEX);

const difficultyForRow = (rowIndex: number) => {
  const adjusted = Math.max(0, rowIndex - 2);
  return Math.min(1 + adjusted * 0.012, 3.2);
};

const createVehicleSet = (count: number, sizeOptions: number[], colors: string[], difficulty: number) => {
  const vehicles: VehicleData[] = [];
  const types: ('car' | 'bus' | 'truck')[] = ['car', 'car', 'bus', 'truck'];
  for (let i = 0; i < count; i += 1) {
    const type = randomChoice(types);
    const baseLength = type === 'truck' ? 2.2 : type === 'bus' ? 1.8 : randomChoice(sizeOptions);
    const length = baseLength * TILE_SIZE;
    const width = TILE_SIZE * 0.8;
    let x = randomFloat(MIN_X, MAX_X);
    let attempts = 0;
    const spacing = Math.max(0.3, 0.5 - difficulty * 0.05);
    while (
      vehicles.some((vehicle) => Math.abs(vehicle.x - x) < (vehicle.length + length) * 0.5 + TILE_SIZE * spacing) &&
      attempts < 20
    ) {
      x = randomFloat(MIN_X, MAX_X);
      attempts += 1;
    }
    vehicles.push({ x, length, width, color: randomChoice(colors), type });
  }
  return vehicles;
};

const createBarrierSet = (count: number, difficulty: number): BarrierData[] => {
  const barriers: BarrierData[] = [];
  for (let i = 0; i < count; i++) {
    const width = TILE_SIZE * randomFloat(1.5, 2.5);
    const slideRange = TILE_SIZE * randomFloat(2, 4);
    const speed = randomFloat(0.8, 1.5) * difficulty;
    let x = randomFloat(MIN_X + slideRange, MAX_X - slideRange);
    barriers.push({ x, width, slideRange, speed, phase: Math.random() * Math.PI * 2 });
  }
  return barriers;
};

const createCritterSet = (count: number, sizeOptions: number[], colors: string[]) => {
  const critters: CritterData[] = [];
  for (let i = 0; i < count; i += 1) {
    const length = randomChoice(sizeOptions) * TILE_SIZE;
    const width = TILE_SIZE * 0.6;
    let x = randomFloat(MIN_X, MAX_X);
    let attempts = 0;
    while (
      critters.some((critter) => Math.abs(critter.x - x) < (critter.length + length) * 0.5 + TILE_SIZE * 0.5) &&
      attempts < 12
    ) {
      x = randomFloat(MIN_X, MAX_X);
      attempts += 1;
    }
    critters.push({ x, length, width, color: randomChoice(colors), bobOffset: Math.random() * Math.PI * 2 });
  }
  return critters;
};

const createTrainSet = (count: number, sizeOptions: number[]) => {
  const trains: TrainData[] = [];
  for (let i = 0; i < count; i += 1) {
    const length = randomChoice(sizeOptions) * TILE_SIZE;
    const width = TILE_SIZE * 0.95;
    let x = randomFloat(MIN_X, MAX_X);
    let attempts = 0;
    while (trains.some((train) => Math.abs(train.x - x) < (train.length + length) * 0.5 + TILE_SIZE * 2) && attempts < 12) {
      x = randomFloat(MIN_X, MAX_X);
      attempts += 1;
    }
    trains.push({ x, length, width });
  }
  return trains;
};

const createLogSet = (count: number, sizeOptions: number[]) => {
  const logs: LogData[] = [];
  for (let i = 0; i < count; i += 1) {
    const length = randomChoice(sizeOptions) * TILE_SIZE;
    const width = TILE_SIZE * 0.9;
    let x = randomFloat(MIN_X, MAX_X);
    let attempts = 0;
    while (logs.some((log) => Math.abs(log.x - x) < (log.length + length) * 0.5 + TILE_SIZE * 0.5) && attempts < 12) {
      x = randomFloat(MIN_X, MAX_X);
      attempts += 1;
    }
    logs.push({ x, length, width });
  }
  return logs;
};

const createDroneSet = (count: number, difficulty: number): DroneData[] => {
  const drones: DroneData[] = [];
  for (let i = 0; i < count; i++) {
    drones.push({
      x: randomFloat(MIN_X * 0.8, MAX_X * 0.8),
      z: 0,
      radius: randomFloat(1.5, 3) * TILE_SIZE,
      speed: randomFloat(1.5, 3) * difficulty,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return drones;
};

const generateGrassRow = (rowIndex: number, difficulty: number): GrassRowData => {
  const maxTrees = TILES_PER_ROW - 4;
  const baseTrees = rowIndex < 4 ? 2 : 3;
  const treeCount = clamp(baseTrees + Math.floor(difficulty * 1.0), 2, maxTrees);
  const occupied = new Set<number>();
  const trees: TreeData[] = [];
  const treeTypes: ('pine' | 'oak' | 'crystal')[] = ['pine', 'oak', 'crystal'];

  while (trees.length < treeCount) {
    const tileIndex = randomInt(MIN_TILE_INDEX, MAX_TILE_INDEX);
    if (occupied.has(tileIndex)) continue;
    occupied.add(tileIndex);
    trees.push({ 
      tileIndex, 
      height: randomChoice([0.8, 1.05, 1.25]),
      type: randomChoice(treeTypes),
    });
  }

  let boostTile: number | undefined;
  if (rowIndex > 4 && Math.random() < 0.15) {
    const openTiles: number[] = [];
    for (let tile = MIN_TILE_INDEX + 1; tile <= MAX_TILE_INDEX - 1; tile += 1) {
      if (!occupied.has(tile)) openTiles.push(tile);
    }
    if (openTiles.length) boostTile = randomChoice(openTiles);
  }

  return { type: 'grass', trees, boostTile };
};

const generateRoadRow = (rowIndex: number, difficulty: number): RoadRowData => {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const speed = (1.4 + randomFloat(0, 0.4)) * difficulty;
  const vehicleCount = clamp(2 + Math.floor(difficulty * 1.1), 2, 5);
  const sizeOptions = [1.0, 1.3, 1.6];
  const barriers = difficulty > 1.5 && Math.random() < 0.3 ? createBarrierSet(1, difficulty) : undefined;

  return {
    type: 'road',
    direction,
    speed,
    vehicles: createVehicleSet(vehicleCount, sizeOptions, VEHICLE_COLORS, difficulty),
    barriers,
  };
};

const generateRiverRow = (rowIndex: number, difficulty: number): RiverRowData => {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const speed = (0.9 + randomFloat(0, 0.25)) * difficulty;
  const logCount = clamp(3 + Math.floor(difficulty * 0.4), 3, 5);
  const sizeOptions = [2.4, 3.0, 3.6, 4.2];

  return { type: 'river', direction, speed, logs: createLogSet(logCount, sizeOptions) };
};

const generateIceRow = (rowIndex: number, difficulty: number): IceRowData => {
  const drift = Math.random() > 0.5 ? 1 : -1;
  const driftSpeed = (0.4 + randomFloat(0, 0.25)) * difficulty;
  return { type: 'ice', drift, driftSpeed };
};

const generateWildlifeRow = (rowIndex: number, difficulty: number): WildlifeRowData => {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const speed = (0.8 + randomFloat(0, 0.25)) * difficulty;
  const critterCount = clamp(2 + Math.floor(difficulty * 0.7), 2, 5);
  const sizeOptions = [0.7, 0.9, 1.1];
  return { type: 'wildlife', direction, speed, critters: createCritterSet(critterCount, sizeOptions, WILDLIFE_COLORS) };
};

const generateSubwayRow = (rowIndex: number, difficulty: number): SubwayRowData => {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const speed = (2.4 + randomFloat(0, 0.8)) * difficulty;
  const trainCount = clamp(1 + Math.floor(difficulty * 0.35), 1, 2);
  const sizeOptions = [4.6, 5.8, 7.0, 8.0];
  return { type: 'subway', direction, speed, trains: createTrainSet(trainCount, sizeOptions) };
};

const generateDroneRow = (rowIndex: number, difficulty: number): DroneRowData => {
  const droneCount = clamp(2 + Math.floor(difficulty * 0.5), 2, 4);
  return { type: 'drone', drones: createDroneSet(droneCount, difficulty) };
};

const generateRow = (rowIndex: number): RowData => {
  const difficulty = difficultyForRow(rowIndex);
  const progress = Math.max(0, rowIndex - 4);
  const grassWeight = clamp(0.50 - progress * 0.007, 0.18, 0.50);
  const riverWeight = rowIndex < 6 ? 0 : clamp(0.05 + progress * 0.003, 0, 0.22);
  const iceWeight = rowIndex < 10 ? 0 : clamp(0.04 + progress * 0.002, 0, 0.16);
  const wildlifeWeight = rowIndex < 8 ? 0 : clamp(0.04 + progress * 0.002, 0, 0.14);
  const subwayWeight = rowIndex < 16 ? 0 : clamp(0.03 + progress * 0.0015, 0, 0.12);
  const droneWeight = rowIndex < 20 ? 0 : clamp(0.02 + progress * 0.001, 0, 0.10);
  const reservedWeight = grassWeight + riverWeight + iceWeight + wildlifeWeight + subwayWeight + droneWeight;
  const roadWeight = Math.max(0.22, 1 - reservedWeight);
  const totalWeight = reservedWeight + roadWeight;
  const roll = Math.random() * totalWeight;

  if (roll < grassWeight) return generateGrassRow(rowIndex, difficulty);
  if (roll < grassWeight + roadWeight) return generateRoadRow(rowIndex, difficulty);
  if (roll < grassWeight + roadWeight + riverWeight) return generateRiverRow(rowIndex, difficulty);
  if (roll < grassWeight + roadWeight + riverWeight + iceWeight) return generateIceRow(rowIndex, difficulty);
  if (roll < grassWeight + roadWeight + riverWeight + iceWeight + wildlifeWeight) return generateWildlifeRow(rowIndex, difficulty);
  if (roll < grassWeight + roadWeight + riverWeight + iceWeight + wildlifeWeight + subwayWeight) return generateSubwayRow(rowIndex, difficulty);
  return generateDroneRow(rowIndex, difficulty);
};

const generateRows = (count: number, startIndex: number, previousType?: RowData['type']) => {
  const rows: RowData[] = [];
  let lastType: RowData['type'] | null = previousType ?? null;
  for (let i = 0; i < count; i += 1) {
    const rowIndex = startIndex + i;
    let row = generateRow(rowIndex);
    if (lastType && row.type === lastType && ['ice', 'wildlife', 'subway', 'drone'].includes(row.type)) {
      const difficulty = difficultyForRow(rowIndex);
      row = Math.random() > 0.5 ? generateRoadRow(rowIndex, difficulty) : generateGrassRow(rowIndex, difficulty);
    }
    if (lastType === 'subway' && row.type === 'river') {
      const difficulty = difficultyForRow(rowIndex);
      row = generateRoadRow(rowIndex, difficulty);
    }
    rows.push(row);
    lastType = row.type;
  }
  return rows;
};

const calculateFinalPosition = (current: { rowIndex: number; tileIndex: number }, moves: MoveDirection[]) => {
  return moves.reduce(
    (position, direction) => {
      if (direction === 'forward') return { ...position, rowIndex: position.rowIndex + 1 };
      if (direction === 'backward') return { ...position, rowIndex: position.rowIndex - 1 };
      if (direction === 'left') return { ...position, tileIndex: position.tileIndex + 1 };  // Left arrow = +X (screen left)
      if (direction === 'right') return { ...position, tileIndex: position.tileIndex - 1 }; // Right arrow = -X (screen right)
      return position;
    },
    { ...current }
  );
};

// Enhanced tree with glow effect
const Trees: React.FC<{ trees: TreeData[] }> = ({ trees }) => {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!trunkRef.current || !crownRef.current) return;
    trunkRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    crownRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    trees.forEach((tree, index) => {
      dummy.position.set(tree.tileIndex * TILE_SIZE, 0.25, 0);
      dummy.scale.set(0.5, 1, 0.5);
      dummy.updateMatrix();
      trunkRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(tree.tileIndex * TILE_SIZE, 0.9, 0);
      const scaleMultiplier = tree.type === 'crystal' ? 0.6 : tree.type === 'pine' ? 0.7 : 1;
      dummy.scale.set(scaleMultiplier, tree.height, scaleMultiplier);
      dummy.updateMatrix();
      crownRef.current?.setMatrixAt(index, dummy.matrix);
    });

    trunkRef.current.instanceMatrix.needsUpdate = true;
    crownRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy, trees]);

  if (!trees.length) return null;

  const crownColor = trees[0]?.type === 'crystal' ? NEON_CYAN : NEON_GREEN;

  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow>
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshStandardMaterial color="#2a1a0a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, trees.length]} castShadow>
        <boxGeometry args={[0.7, 0.6, 0.7]} />
        <meshStandardMaterial 
          color={crownColor} 
          emissive={crownColor} 
          emissiveIntensity={0.3} 
          roughness={0.5} 
        />
      </instancedMesh>
    </>
  );
};

const BoostPad: React.FC<{ tileIndex: number }> = ({ tileIndex }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const pulse = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 4);
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
  });

  return (
    <mesh ref={meshRef} position={[tileIndex * TILE_SIZE, 0.08, 0]} castShadow>
      <boxGeometry args={[TILE_SIZE * 0.6, 0.1, TILE_SIZE * 0.6]} />
      <meshStandardMaterial color={BOOST_COLOR} emissive={BOOST_COLOR} emissiveIntensity={0.8} roughness={0.3} metalness={0.5} />
    </mesh>
  );
};

const GrassRow: React.FC<{ rowIndex: number; data: GrassRowData }> = ({ rowIndex, data }) => {
  const colorIndex = Math.abs(rowIndex) % GRASS_COLORS.length;
  const color = GRASS_COLORS[colorIndex];

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* Grid lines for style */}
      <mesh position={[0, 0.01, TILE_SIZE * 0.45]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.02, 0.02]} />
        <meshStandardMaterial color={GRASS_ACCENT} emissive={GRASS_ACCENT} emissiveIntensity={0.2} transparent opacity={0.4} />
      </mesh>
      <Trees trees={data.trees} />
      {typeof data.boostTile === 'number' && <BoostPad tileIndex={data.boostTile} />}
    </group>
  );
};

const IceRow: React.FC<{ rowIndex: number; data: IceRowData }> = ({ rowIndex, data }) => {
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (glowRef.current) {
      const pulse = 0.25 + 0.15 * Math.sin(clock.elapsedTime * 2 + rowIndex);
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
  });

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={ICE_COLOR} roughness={0.1} metalness={0.3} />
      </mesh>
      <mesh ref={glowRef} position={[0, 0.05, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.04, TILE_SIZE * 0.96]} />
        <meshStandardMaterial color={ICE_GLOW} emissive={ICE_GLOW} emissiveIntensity={0.3} transparent opacity={0.6} />
      </mesh>
      {/* Direction arrows */}
      {[-2, 0, 2].map((offset) => (
        <mesh key={offset} position={[offset * TILE_SIZE * 2, 0.08, 0]} rotation={[0, data.drift > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <coneGeometry args={[0.15, 0.3, 4]} />
          <meshStandardMaterial color={ICE_GLOW} emissive={ICE_GLOW} emissiveIntensity={0.5} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
};

const VehiclesLane: React.FC<{
  rowIndex: number;
  data: RoadRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;

  useEffect(() => {
    if (!meshRef.current || data.vehicles.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (!meshRef.current.instanceColor) {
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(data.vehicles.length * 3), 3);
    }
    data.vehicles.forEach((vehicle, index) => {
      meshRef.current?.setColorAt(index, new THREE.Color(vehicle.color));
    });
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [data.vehicles]);

  useFrame((_, delta) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || data.vehicles.length === 0) return;
    const player = playerRef.current;

    data.vehicles.forEach((vehicle, index) => {
      vehicle.x += data.speed * data.direction * delta;
      const wrapOffset = vehicle.length + TILE_SIZE * 2;
      if (data.direction === 1 && vehicle.x > MAX_X + wrapOffset) vehicle.x = MIN_X - wrapOffset;
      else if (data.direction === -1 && vehicle.x < MIN_X - wrapOffset) vehicle.x = MAX_X + wrapOffset;

      // Position relative to parent group (which is already at rowZ)
      dummy.position.set(vehicle.x, VEHICLE_Y, 0);
      dummy.scale.set(vehicle.length, 0.5, vehicle.width);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;

    const playerX = player.position.x;
    let nearMiss = false;
    const hit = data.vehicles.some((vehicle) => {
      const half = vehicle.length * 0.5 + PLAYER_RADIUS * 0.45;
      const dist = Math.abs(playerX - vehicle.x);
      if (dist < half) return true;
      if (dist < half + TILE_SIZE * 0.3) nearMiss = true;
      return false;
    });

    if (hit) onHit();
    else if (nearMiss) fluxHopState.triggerNearMiss();
  });

  if (data.vehicles.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, data.vehicles.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.4} vertexColors />
    </instancedMesh>
  );
};

const SlidingBarriers: React.FC<{
  rowIndex: number;
  barriers: BarrierData[];
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, barriers, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;
  const positionsRef = useRef<number[]>(barriers.map(b => b.x));

  useEffect(() => {
    if (!meshRef.current || barriers.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [barriers.length]);

  useFrame(({ clock }, delta) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || barriers.length === 0) return;
    const player = playerRef.current;

    barriers.forEach((barrier, index) => {
      const newX = barrier.x + Math.sin(clock.elapsedTime * barrier.speed + barrier.phase) * barrier.slideRange;
      positionsRef.current[index] = newX;
      
      // Position relative to parent group (which is already at rowZ)
      dummy.position.set(newX, 0.4, 0);
      dummy.scale.set(barrier.width, 0.6, TILE_SIZE * 0.3);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;

    const playerX = player.position.x;
    const hit = barriers.some((barrier, index) => {
      const half = barrier.width * 0.5 + PLAYER_RADIUS * 0.3;
      return Math.abs(playerX - positionsRef.current[index]) < half;
    });

    if (hit) onHit();
  });

  if (barriers.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, barriers.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={NEON_ORANGE} emissive={NEON_ORANGE} emissiveIntensity={0.5} roughness={0.4} metalness={0.3} />
    </instancedMesh>
  );
};

const RoadRow: React.FC<{
  rowIndex: number;
  data: RoadRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={ROAD_COLOR} roughness={0.9} />
      </mesh>
      {/* Road stripes */}
      {[-3, -1, 1, 3].map((offset) => (
        <mesh key={offset} position={[offset * TILE_SIZE * 1.5, 0.01, 0]}>
          <boxGeometry args={[TILE_SIZE * 0.8, 0.02, 0.08]} />
          <meshStandardMaterial color={ROAD_STRIPE} emissive={ROAD_STRIPE} emissiveIntensity={0.3} />
        </mesh>
      ))}
      <VehiclesLane rowIndex={rowIndex} data={data} playerRef={playerRef} onHit={onHit} />
      {data.barriers && <SlidingBarriers rowIndex={rowIndex} barriers={data.barriers} playerRef={playerRef} onHit={onHit} />}
    </group>
  );
};

const CrittersLane: React.FC<{
  rowIndex: number;
  data: WildlifeRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;

  useEffect(() => {
    if (!meshRef.current || data.critters.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (!meshRef.current.instanceColor) {
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(data.critters.length * 3), 3);
    }
    data.critters.forEach((critter, index) => {
      meshRef.current?.setColorAt(index, new THREE.Color(critter.color));
    });
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [data.critters]);

  useFrame((state, delta) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || data.critters.length === 0) return;
    const time = state.clock.elapsedTime;
    const player = playerRef.current;

    data.critters.forEach((critter, index) => {
      const pace = data.speed * (0.7 + 0.3 * Math.sin(time * 1.4 + critter.bobOffset));
      critter.x += pace * data.direction * delta;
      const wrapOffset = critter.length + TILE_SIZE * 2.4;
      if (data.direction === 1 && critter.x > MAX_X + wrapOffset) critter.x = MIN_X - wrapOffset;
      else if (data.direction === -1 && critter.x < MIN_X - wrapOffset) critter.x = MAX_X + wrapOffset;

      const bob = 0.05 * Math.sin(time * 4 + critter.bobOffset);
      // Position relative to parent group (which is already at rowZ)
      dummy.position.set(critter.x, CRITTER_Y + bob, 0);
      dummy.scale.set(critter.length, 0.35, critter.width);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;

    const playerX = player.position.x;
    const hit = data.critters.some((critter) => {
      const half = critter.length * 0.45 + PLAYER_RADIUS * 0.3;
      return Math.abs(playerX - critter.x) < half;
    });

    if (hit) onHit();
  });

  if (data.critters.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, data.critters.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.5} metalness={0.1} vertexColors />
    </instancedMesh>
  );
};

const WildlifeRow: React.FC<{
  rowIndex: number;
  data: WildlifeRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={WILDLIFE_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[ROW_WIDTH * 0.8, 0.04, TILE_SIZE * 0.35]} />
        <meshStandardMaterial color={NEON_GREEN} emissive={NEON_GREEN} emissiveIntensity={0.15} transparent opacity={0.4} />
      </mesh>
      <CrittersLane rowIndex={rowIndex} data={data} playerRef={playerRef} onHit={onHit} />
    </group>
  );
};

const TrainLane: React.FC<{
  rowIndex: number;
  data: SubwayRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;

  useEffect(() => {
    if (!meshRef.current || data.trains.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [data.trains.length]);

  useFrame((_, delta) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || data.trains.length === 0) return;
    const player = playerRef.current;

    data.trains.forEach((train, index) => {
      train.x += data.speed * data.direction * delta;
      const wrapOffset = train.length + TILE_SIZE * 4;
      if (data.direction === 1 && train.x > MAX_X + wrapOffset) train.x = MIN_X - wrapOffset;
      else if (data.direction === -1 && train.x < MIN_X - wrapOffset) train.x = MAX_X + wrapOffset;

      // Position relative to parent group (which is already at rowZ)
      dummy.position.set(train.x, TRAIN_Y, 0);
      dummy.scale.set(train.length, 0.65, train.width);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;

    const playerX = player.position.x;
    const hit = data.trains.some((train) => {
      const half = train.length * 0.5 + PLAYER_RADIUS * 0.2;
      return Math.abs(playerX - train.x) < half;
    });

    if (hit) onHit();
  });

  if (data.trains.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, data.trains.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#1a1a2e" emissive={SUBWAY_GLOW} emissiveIntensity={0.2} roughness={0.4} metalness={0.5} />
    </instancedMesh>
  );
};

const SubwayRow: React.FC<{
  rowIndex: number;
  data: SubwayRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const signalMaterialLeft = useRef<THREE.MeshStandardMaterial>(null);
  const signalMaterialRight = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const pulse = 0.4 + 0.5 * Math.sin(clock.elapsedTime * 6 + rowIndex * 0.2);
    if (signalMaterialLeft.current) signalMaterialLeft.current.emissiveIntensity = pulse;
    if (signalMaterialRight.current) signalMaterialRight.current.emissiveIntensity = pulse;
  });

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={SUBWAY_COLOR} roughness={0.8} />
      </mesh>
      {/* Rails */}
      <mesh position={[0, 0.03, TILE_SIZE * 0.25]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 1.6, 0.05, TILE_SIZE * 0.08]} />
        <meshStandardMaterial color="#404060" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.03, -TILE_SIZE * 0.25]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 1.6, 0.05, TILE_SIZE * 0.08]} />
        <meshStandardMaterial color="#404060" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Warning signals */}
      <mesh position={[ROW_WIDTH * 0.45, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial ref={signalMaterialRight} color="#0a0a15" emissive={SUBWAY_GLOW} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-ROW_WIDTH * 0.45, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial ref={signalMaterialLeft} color="#0a0a15" emissive={SUBWAY_GLOW} emissiveIntensity={0.5} />
      </mesh>
      <TrainLane rowIndex={rowIndex} data={data} playerRef={playerRef} onHit={onHit} />
    </group>
  );
};

const DroneLane: React.FC<{
  rowIndex: number;
  data: DroneRowData;
  playerRef: React.RefObject<THREE.Group>;
  onHit: () => void;
}> = ({ rowIndex, data, playerRef, onHit }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;
  const positionsRef = useRef<{ x: number; z: number }[]>(data.drones.map(d => ({ x: d.x, z: rowZ + d.z })));

  useEffect(() => {
    if (!meshRef.current || data.drones.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [data.drones.length]);

  useFrame(({ clock }, delta) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || data.drones.length === 0) return;
    const player = playerRef.current;
    const time = clock.elapsedTime;

    data.drones.forEach((drone, index) => {
      const angle = time * drone.speed + drone.phase;
      const x = drone.x + Math.cos(angle) * drone.radius;
      // Z offset relative to the group (which is at rowZ)
      const zOffset = Math.sin(angle) * drone.radius * 0.3;
      const hover = 0.8 + Math.sin(time * 3 + drone.phase) * 0.1;
      
      // Store world Z for collision detection
      positionsRef.current[index] = { x, z: rowZ + zOffset };

      // Position relative to parent group
      dummy.position.set(x, hover, zOffset);
      dummy.scale.set(0.4, 0.2, 0.4);
      dummy.rotation.y = angle;
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;

    const playerX = player.position.x;
    const playerZ = player.position.z;
    const hit = data.drones.some((drone, index) => {
      const pos = positionsRef.current[index];
      const dist = Math.sqrt(Math.pow(playerX - pos.x, 2) + Math.pow(playerZ - pos.z, 2));
      return dist < PLAYER_RADIUS + 0.3;
    });

    if (hit) onHit();
  });

  if (data.drones.length === 0) return null;

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color="#0a0a15" roughness={0.9} />
      </mesh>
      {/* Warning pattern */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[ROW_WIDTH, 0.02, TILE_SIZE * 0.8]} />
        <meshStandardMaterial color={DRONE_COLOR} emissive={DRONE_COLOR} emissiveIntensity={0.15} transparent opacity={0.3} />
      </mesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, data.drones.length]} castShadow>
        <octahedronGeometry args={[1]} />
        <meshStandardMaterial color={DRONE_COLOR} emissive={DRONE_COLOR} emissiveIntensity={0.6} roughness={0.3} metalness={0.7} />
      </instancedMesh>
    </group>
  );
};

const LogsLane: React.FC<{
  rowIndex: number;
  data: RiverRowData;
  playerRef: React.RefObject<THREE.Group>;
  playerStateRef: React.MutableRefObject<PlayerState>;
  onDrown: () => void;
}> = ({ rowIndex, data, playerRef, playerStateRef, onDrown }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rowZ = rowIndex * TILE_SIZE;

  useEffect(() => {
    if (!meshRef.current || data.logs.length === 0) return;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [data.logs.length]);

  useFrame((_, delta) => {
    if (fluxHopState.status !== 'running' || !meshRef.current || data.logs.length === 0) return;
    const player = playerRef.current;

    data.logs.forEach((log, index) => {
      log.x += data.speed * data.direction * delta;
      const wrapOffset = log.length + TILE_SIZE * 2;
      if (data.direction === 1 && log.x > MAX_X + wrapOffset) log.x = MIN_X - wrapOffset;
      else if (data.direction === -1 && log.x < MIN_X - wrapOffset) log.x = MAX_X + wrapOffset;

      // Position relative to parent group (which is already at rowZ)
      dummy.position.set(log.x, LOG_Y, 0);
      dummy.scale.set(log.length, 0.35, log.width);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (!player || fluxHopState.status !== 'running') return;
    if (Math.abs(player.position.z - rowZ) > TILE_SIZE * 0.45) return;
    if (playerStateRef.current.isMoving) return;

    const playerX = player.position.x;
    let riding = false;
    let drift = 0;
    data.logs.forEach((log) => {
      const half = log.length * 0.5 - PLAYER_RADIUS * 0.2;
      if (Math.abs(playerX - log.x) < half) {
        riding = true;
        drift = data.speed * data.direction;
      }
    });

    if (!riding) {
      onDrown();
      return;
    }

    player.position.x += drift * delta;
    playerStateRef.current.tile = worldXToTile(player.position.x);

    if (player.position.x < MIN_X - TILE_SIZE || player.position.x > MAX_X + TILE_SIZE) {
      onDrown();
    }
  });

  if (data.logs.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, data.logs.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#8b4513" roughness={0.7} metalness={0.1} />
    </instancedMesh>
  );
};

const RiverRow: React.FC<{
  rowIndex: number;
  data: RiverRowData;
  playerRef: React.RefObject<THREE.Group>;
  playerStateRef: React.MutableRefObject<PlayerState>;
  onDrown: () => void;
}> = ({ rowIndex, data, playerRef, playerStateRef, onDrown }) => {
  const waterRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (waterRef.current) {
      const pulse = 0.2 + 0.1 * Math.sin(clock.elapsedTime * 2 + rowIndex * 0.5);
      (waterRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
  });

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={WATER_COLOR} roughness={0.2} metalness={0.2} />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.04, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.04, TILE_SIZE * 0.96]} />
        <meshStandardMaterial color={WATER_GLOW} emissive={WATER_GLOW} emissiveIntensity={0.25} transparent opacity={0.7} />
      </mesh>
      <LogsLane rowIndex={rowIndex} data={data} playerRef={playerRef} playerStateRef={playerStateRef} onDrown={onDrown} />
    </group>
  );
};

const PlayerAvatar: React.FC<{
  playerRef: React.RefObject<THREE.Group>;
  bodyRef: React.RefObject<THREE.Mesh>;
}> = ({ playerRef, bodyRef }) => {
  const glowRef = useRef<THREE.PointLight>(null);
  
  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.intensity = 0.6 + 0.3 * Math.sin(clock.elapsedTime * 3);
    }
  });

  return (
    <group ref={playerRef}>
      <mesh ref={bodyRef} position={[0, PLAYER_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[TILE_SIZE * 0.6, PLAYER_HEIGHT, TILE_SIZE * 0.5]} />
        <meshStandardMaterial color="#ffffff" emissive={NEON_CYAN} emissiveIntensity={0.3} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Eyes */}
      <mesh position={[TILE_SIZE * 0.1, PLAYER_HEIGHT * 0.85, TILE_SIZE * 0.26]}>
        <boxGeometry args={[TILE_SIZE * 0.12, TILE_SIZE * 0.12, 0.04]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[-TILE_SIZE * 0.1, PLAYER_HEIGHT * 0.85, TILE_SIZE * 0.26]}>
        <boxGeometry args={[TILE_SIZE * 0.12, TILE_SIZE * 0.12, 0.04]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <pointLight ref={glowRef} position={[0, 1.2, 0]} intensity={0.6} color={NEON_CYAN} distance={4} />
      <Sparkles count={16} scale={[1.2, 1.2, 1.2]} size={2.5} speed={0.5} color={NEON_CYAN} />
    </group>
  );
};


const ControlsOverlay: React.FC<{
  status: 'running' | 'over';
  combo: number;
  bestCombo: number;
  onMove: (direction: MoveDirection) => void;
  onReset: () => void;
}> = ({ status, combo, bestCombo, onMove, onReset }) => {
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="fixed left-6 top-6 flex flex-col gap-2 text-white pointer-events-none">
        <div
          className="rounded-xl border border-cyan-400/30 bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.3em]"
          style={{ fontFamily: '"Geist Mono", monospace', boxShadow: '0 0 20px rgba(0, 255, 247, 0.2)' }}
        >
          combo <span className="ml-2 text-base font-semibold text-cyan-400">{combo}</span>
        </div>
        <div
          className="rounded-xl border border-pink-400/30 bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.3em]"
          style={{ fontFamily: '"Geist Mono", monospace', boxShadow: '0 0 20px rgba(255, 0, 255, 0.2)' }}
        >
          best <span className="ml-2 text-base font-semibold text-pink-400">{bestCombo}</span>
        </div>
      </div>

      {status === 'running' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-white pointer-events-auto">
          <div
            className="mb-2 text-center text-xs uppercase tracking-[0.3em] text-white/60"
            style={{ fontFamily: '"Geist Mono", monospace' }}
          >
            swipe or tap
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-11 w-11" />
            <button
              className="h-11 w-11 rounded-lg border border-cyan-400/30 bg-slate-900/80 text-lg hover:bg-cyan-900/50 hover:border-cyan-400/60 transition-all"
              onClick={() => onMove('forward')}
              style={{ boxShadow: '0 0 10px rgba(0, 255, 247, 0.2)' }}
            >
              ^
            </button>
            <div className="h-11 w-11" />
            <button
              className="h-11 w-11 rounded-lg border border-cyan-400/30 bg-slate-900/80 text-lg hover:bg-cyan-900/50 hover:border-cyan-400/60 transition-all"
              onClick={() => onMove('left')}
              style={{ boxShadow: '0 0 10px rgba(0, 255, 247, 0.2)' }}
            >
              {'<'}
            </button>
            <div className="h-11 w-11" />
            <button
              className="h-11 w-11 rounded-lg border border-cyan-400/30 bg-slate-900/80 text-lg hover:bg-cyan-900/50 hover:border-cyan-400/60 transition-all"
              onClick={() => onMove('right')}
              style={{ boxShadow: '0 0 10px rgba(0, 255, 247, 0.2)' }}
            >
              {'>'}
            </button>
            <div className="h-11 w-11" />
            <button
              className="h-11 w-11 rounded-lg border border-cyan-400/30 bg-slate-900/80 text-lg hover:bg-cyan-900/50 hover:border-cyan-400/60 transition-all"
              onClick={() => onMove('backward')}
              style={{ boxShadow: '0 0 10px rgba(0, 255, 247, 0.2)' }}
            >
              v
            </button>
            <div className="h-11 w-11" />
          </div>
        </div>
      )}
    </Html>
  );
};

const GameOverOverlay: React.FC<{ score: number; bestScore: number; onRestart: () => void }> = ({
  score,
  bestScore,
  onRestart,
}) => {
  return (
    <Html fullscreen>
      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 text-white backdrop-blur-sm">
        <div 
          className="w-[min(92vw,360px)] rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-6 text-center shadow-xl"
          style={{ boxShadow: '0 0 40px rgba(0, 255, 247, 0.3)' }}
        >
          <div className="text-sm uppercase tracking-[0.35em] text-cyan-400/80" style={{ fontFamily: '"Geist Mono", monospace' }}>
            FluxHop
          </div>
          <h2 className="mt-3 text-3xl font-semibold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">Game Over</h2>
          <div className="mt-4 text-lg">Score: <span className="text-cyan-400">{score}</span></div>
          <div className="text-sm text-white/70">Best: <span className="text-pink-400">{bestScore}</span></div>
          <button
            onClick={onRestart}
            className="mt-5 w-full rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-900/50 to-pink-900/50 px-4 py-3 text-sm uppercase tracking-[0.3em] hover:from-cyan-800/60 hover:to-pink-800/60 transition-all"
            style={{ boxShadow: '0 0 20px rgba(0, 255, 247, 0.2)' }}
          >
            Retry
          </button>
          <div className="mt-3 text-xs text-white/50">R to restart - Swipe or tap to move</div>
        </div>
      </div>
    </Html>
  );
};

const FluxHop: React.FC<{ soundsOn: boolean }> = ({ soundsOn }) => {
  const snap = useSnapshot(fluxHopState);
  const { scene, gl } = useThree();
  const [rows, setRows] = useState<RowData[]>(() => generateRows(INITIAL_ROW_COUNT, 1));
  const [rowOffset, setRowOffset] = useState(1);
  const rowsRef = useRef(rows);
  const rowOffsetRef = useRef(rowOffset);
  const playerRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const moveQueueRef = useRef<MoveDirection[]>([]);
  const playerStateRef = useRef<PlayerState>({ row: 0, tile: 0, isMoving: false });
  const idleTimeRef = useRef(0);
  const boostPendingRef = useRef(false);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const cameraPositionRef = useRef(new THREE.Vector3());
  const audioRef = useRef<{ hop?: HTMLAudioElement; hit?: HTMLAudioElement; boost?: HTMLAudioElement } | null>(null);

  const moveDataRef = useRef({
    elapsed: 0,
    duration: BASE_STEP_TIME,
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    startQuat: new THREE.Quaternion(),
    endQuat: new THREE.Quaternion(),
    direction: null as MoveDirection | null,
  });

  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { rowOffsetRef.current = rowOffset; }, [rowOffset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    audioRef.current = {
      hop: new Audio('/fun/resources/ping.mp3'),
      hit: new Audio('/fun/audio/sfx_hit.wav'),
      boost: new Audio('/fun/audio/sfx_point.wav'),
    };
    if (audioRef.current.hop) audioRef.current.hop.volume = 0.35;
    if (audioRef.current.hit) audioRef.current.hit.volume = 0.5;
    if (audioRef.current.boost) audioRef.current.boost.volume = 0.45;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedScore = window.localStorage.getItem(BEST_SCORE_KEY);
    const storedCombo = window.localStorage.getItem(BEST_COMBO_KEY);
    if (storedScore) fluxHopState.bestScore = Number(storedScore) || 0;
    if (storedCombo) fluxHopState.bestCombo = Number(storedCombo) || 0;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${snap.bestScore}`);
  }, [snap.bestScore]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_COMBO_KEY, `${snap.bestCombo}`);
  }, [snap.bestCombo]);

  useEffect(() => {
    const previousTouchAction = gl.domElement.style.touchAction;
    gl.domElement.style.touchAction = 'none';
    return () => { gl.domElement.style.touchAction = previousTouchAction; };
  }, [gl]);

  useEffect(() => {
    const previousFog = scene.fog;
    scene.fog = new THREE.Fog('#030308', 6, 45);
    return () => { scene.fog = previousFog; };
  }, [scene]);

  const playSound = useCallback(
    (type: 'hop' | 'hit' | 'boost') => {
      if (!soundsOn || !audioRef.current) return;
      const sound = audioRef.current[type];
      if (!sound) return;
      sound.currentTime = 0;
      sound.play().catch(() => undefined);
    },
    [soundsOn]
  );

  const getRowAt = useCallback((rowIndex: number) => {
    if (rowIndex <= 0) return null;
    const idx = rowIndex - rowOffsetRef.current;
    if (idx < 0 || idx >= rowsRef.current.length) return null;
    return rowsRef.current[idx];
  }, []);

  const isValidPosition = useCallback(
    (position: { rowIndex: number; tileIndex: number }) => {
      if (position.tileIndex < MIN_TILE_INDEX || position.tileIndex > MAX_TILE_INDEX) return false;
      if (position.rowIndex < -SAFE_ROWS_BEHIND) return false;
      const row = getRowAt(position.rowIndex);
      if (!row) return true;
      if (row.type === 'grass') {
        return !row.trees.some((tree) => tree.tileIndex === position.tileIndex);
      }
      return true;
    },
    [getRowAt]
  );

  const ensureRows = useCallback(() => {
    const playerRow = playerStateRef.current.row;
    const lastRowIndex = rowOffsetRef.current + rowsRef.current.length - 1;
    if (lastRowIndex - playerRow < ROW_BUFFER_AHEAD) {
      const startIndex = lastRowIndex + 1;
      setRows((prev) => {
        const previousType = prev.length ? prev[prev.length - 1].type : undefined;
        return [...prev, ...generateRows(ADD_ROW_COUNT, startIndex, previousType)];
      });
    }
    const rowsBehind = playerRow - rowOffsetRef.current;
    if (rowsBehind > ROW_BUFFER_BEHIND) {
      const drop = rowsBehind - ROW_BUFFER_BEHIND;
      setRows((prev) => prev.slice(drop));
      setRowOffset((prev) => prev + drop);
    }
  }, []);

  const queueMove = useCallback(
    (direction: MoveDirection) => {
      if (fluxHopState.status !== 'running') return;
      if (moveQueueRef.current.length >= MAX_QUEUE) return;
      const player = playerRef.current;
      if (!player) return;

      const currentTile = worldXToTile(player.position.x);
      const currentPosition = { rowIndex: playerStateRef.current.row, tileIndex: currentTile };
      const finalPosition = calculateFinalPosition(currentPosition, [...moveQueueRef.current, direction]);
      if (!isValidPosition(finalPosition)) return;

      moveQueueRef.current.push(direction);
      playSound('hop');
    },
    [isValidPosition, playSound]
  );

  const handleStepComplete = useCallback(
    (direction: MoveDirection, rowIndex: number, tileIndex: number) => {
      if (direction === 'forward') {
        if (rowIndex > fluxHopState.maxRow) {
          fluxHopState.maxRow = rowIndex;
          const nextCombo = fluxHopState.combo + 1;
          fluxHopState.setCombo(nextCombo);
          fluxHopState.addScore(1 + Math.min(6, nextCombo));
        }
      } else {
        fluxHopState.setCombo(0);
      }

      const row = getRowAt(rowIndex);
      if (row?.type === 'grass' && row.boostTile === tileIndex) {
        boostPendingRef.current = true;
        playSound('boost');
        fluxHopState.addScore(5);
        queueMove('forward');
      }

      ensureRows();
    },
    [ensureRows, getRowAt, playSound, queueMove]
  );

  const endGame = useCallback(() => {
    if (fluxHopState.status !== 'running') return;
    fluxHopState.endGame();
    moveQueueRef.current = [];
    playerStateRef.current.isMoving = false;
    playSound('hit');
  }, [playSound]);

  const resetGame = useCallback(() => {
    moveQueueRef.current = [];
    playerStateRef.current = { row: 0, tile: 0, isMoving: false };
    boostPendingRef.current = false;
    setRows(generateRows(INITIAL_ROW_COUNT, 1));
    setRowOffset(1);
    if (playerRef.current) {
      playerRef.current.position.set(0, 0, 0);
      playerRef.current.rotation.set(0, 0, 0);
    }
    if (bodyRef.current) {
      bodyRef.current.position.y = PLAYER_HEIGHT / 2;
    }
  }, []);

  useEffect(() => { fluxHopState.reset(); }, []);
  useEffect(() => { resetGame(); }, [resetGame, snap.resetToken]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
      }
      if (event.code === 'Space') {
        event.preventDefault();
        queueMove('forward');
        return;
      }
      if (key === 'arrowup' || key === 'w') queueMove('forward');
      if (key === 'arrowdown' || key === 's') queueMove('backward');
      if (key === 'arrowleft' || key === 'a') queueMove('left');
      if (key === 'arrowright' || key === 'd') queueMove('right');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueMove]);

  useEffect(() => {
    const pointerStart = { x: 0, y: 0 };
    let active = false;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target?.closest('button')) return;
      if (!event.isPrimary) return;
      active = true;
      pointerStart.x = event.clientX;
      pointerStart.y = event.clientY;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!active) return;
      const target = event.target as HTMLElement;
      if (target?.closest('button')) {
        active = false;
        return;
      }

      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      const threshold = 18;

      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
        queueMove('forward');
        active = false;
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        queueMove(dx > 0 ? 'right' : 'left');
      } else {
        queueMove(dy < 0 ? 'forward' : 'backward');
      }
      active = false;
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [queueMove]);

  useFrame((state, delta) => {
    const player = playerRef.current;
    const body = bodyRef.current;
    if (!player || !body) return;

    if (fluxHopState.status === 'running') {
      if (!playerStateRef.current.isMoving && moveQueueRef.current.length) {
        const direction = moveQueueRef.current[0];
        moveDataRef.current.direction = direction;
        moveDataRef.current.elapsed = 0;
        const baseDuration = boostPendingRef.current ? BOOST_STEP_TIME : BASE_STEP_TIME;
        boostPendingRef.current = false;
        moveDataRef.current.start.copy(player.position);
        moveDataRef.current.startQuat.copy(player.quaternion);

        const startRow = playerStateRef.current.row;
        const startTile = worldXToTile(player.position.x);
        const startRowData = getRowAt(startRow);
        moveDataRef.current.duration = startRowData?.type === 'ice' ? baseDuration * 0.8 : baseDuration;
        const targetRow = direction === 'forward' ? startRow + 1 : direction === 'backward' ? startRow - 1 : startRow;
        const targetTile = direction === 'left' ? startTile + 1 : direction === 'right' ? startTile - 1 : startTile;

        moveDataRef.current.end.set(targetTile * TILE_SIZE, 0, targetRow * TILE_SIZE);
        moveDataRef.current.endQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), directionToRotation(direction));
        playerStateRef.current.isMoving = true;
      }

      if (playerStateRef.current.isMoving && moveDataRef.current.direction) {
        moveDataRef.current.elapsed += delta;
        const progress = Math.min(1, moveDataRef.current.elapsed / moveDataRef.current.duration);
        const ease = progress * (2 - progress);
        player.position.lerpVectors(moveDataRef.current.start, moveDataRef.current.end, ease);
        player.quaternion.slerpQuaternions(moveDataRef.current.startQuat, moveDataRef.current.endQuat, ease);
        body.position.y = PLAYER_HEIGHT / 2 + Math.sin(progress * Math.PI) * 0.3;

        if (progress >= 1) {
          const direction = moveDataRef.current.direction;
          playerStateRef.current.isMoving = false;
          moveQueueRef.current.shift();
          playerStateRef.current.row =
            direction === 'forward'
              ? playerStateRef.current.row + 1
              : direction === 'backward'
                ? playerStateRef.current.row - 1
                : playerStateRef.current.row;
          playerStateRef.current.tile = worldXToTile(player.position.x);
          handleStepComplete(direction, playerStateRef.current.row, playerStateRef.current.tile);
        }
      } else {
        idleTimeRef.current += delta;
        body.position.y = PLAYER_HEIGHT / 2 + Math.sin(idleTimeRef.current * 3) * 0.05;
        playerStateRef.current.tile = worldXToTile(player.position.x);

        const standingRow = getRowAt(playerStateRef.current.row);
        if (standingRow?.type === 'ice') {
          player.position.x += standingRow.driftSpeed * standingRow.drift * delta;
          playerStateRef.current.tile = worldXToTile(player.position.x);
          if (player.position.x < MIN_X - TILE_SIZE || player.position.x > MAX_X + TILE_SIZE) {
            endGame();
          }
        }
      }
    }

    cameraTargetRef.current.set(player.position.x, 0, player.position.z + TILE_SIZE * 3);
    cameraPositionRef.current.set(player.position.x, 9, player.position.z - 9);
    state.camera.position.lerp(cameraPositionRef.current, 0.12);
    state.camera.lookAt(cameraTargetRef.current);
  });

  return (
    <>
      
      <ambientLight intensity={0.4} color="#404080" />
      <directionalLight position={[8, 12, 4]} intensity={0.5} castShadow color="#ffffff" />
      <pointLight position={[0, 5, 10]} intensity={0.3} color={NEON_CYAN} />
      <pointLight position={[0, 5, -10]} intensity={0.3} color={NEON_PINK} />

      <PlayerAvatar playerRef={playerRef} bodyRef={bodyRef} />

      {Array.from({ length: SAFE_ROWS_BEHIND + 1 }).map((_, index) => {
        const rowIndex = -SAFE_ROWS_BEHIND + index;
        return <GrassRow key={`safe-${rowIndex}`} rowIndex={rowIndex} data={{ type: 'grass', trees: [] }} />;
      })}

      {rows.map((rowData, index) => {
        const rowIndex = rowOffset + index;
        if (rowData.type === 'grass') return <GrassRow key={`row-${rowIndex}`} rowIndex={rowIndex} data={rowData} />;
        if (rowData.type === 'ice') return <IceRow key={`row-${rowIndex}`} rowIndex={rowIndex} data={rowData} />;
        if (rowData.type === 'road') return <RoadRow key={`row-${rowIndex}`} rowIndex={rowIndex} data={rowData} playerRef={playerRef} onHit={endGame} />;
        if (rowData.type === 'wildlife') return <WildlifeRow key={`row-${rowIndex}`} rowIndex={rowIndex} data={rowData} playerRef={playerRef} onHit={endGame} />;
        if (rowData.type === 'subway') return <SubwayRow key={`row-${rowIndex}`} rowIndex={rowIndex} data={rowData} playerRef={playerRef} onHit={endGame} />;
        if (rowData.type === 'drone') return <DroneLane key={`row-${rowIndex}`} rowIndex={rowIndex} data={rowData} playerRef={playerRef} onHit={endGame} />;
        return <RiverRow key={`row-${rowIndex}`} rowIndex={rowIndex} data={rowData} playerRef={playerRef} playerStateRef={playerStateRef} onDrown={endGame} />;
      })}

      <ControlsOverlay status={snap.status} combo={snap.combo} bestCombo={snap.bestCombo} onMove={queueMove} onReset={() => fluxHopState.reset()} />
      {snap.status === 'over' && <GameOverOverlay score={snap.score} bestScore={snap.bestScore} onRestart={() => fluxHopState.reset()} />}
    </>
  );
};

export default FluxHop;
