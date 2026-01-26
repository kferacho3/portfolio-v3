import {
  MAX_TILE_INDEX,
  MAX_X,
  MIN_TILE_INDEX,
  MIN_X,
  TILE_SIZE,
  TILES_PER_ROW,
  VEHICLE_COLORS,
  WILDLIFE_COLORS,
} from '../constants';
import type {
  BarrierData,
  CritterData,
  DroneData,
  DroneRowData,
  GrassRowData,
  LogData,
  MoveDirection,
  PlayerState,
  RiverRowData,
  RoadRowData,
  RowData,
  SubwayRowData,
  TrainData,
  TreeData,
  VehicleData,
  WildlifeRowData,
  IceRowData,
} from '../types';

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
export const randomFloat = (min: number, max: number) =>
  min + Math.random() * (max - min);
export const randomChoice = <T>(values: T[]) =>
  values[Math.floor(Math.random() * values.length)];

export const directionToRotation = (direction: MoveDirection) => {
  if (direction === 'left') return Math.PI / 2;
  if (direction === 'right') return -Math.PI / 2;
  if (direction === 'backward') return Math.PI;
  return 0;
};

export const worldXToTile = (x: number) =>
  clamp(Math.round(x / TILE_SIZE), MIN_TILE_INDEX, MAX_TILE_INDEX);

export const difficultyForRow = (rowIndex: number) => {
  const adjusted = Math.max(0, rowIndex - 2);
  return Math.min(1 + adjusted * 0.012, 3.2);
};

export const createVehicleSet = (
  count: number,
  sizeOptions: number[],
  colors: string[],
  difficulty: number
) => {
  const vehicles: VehicleData[] = [];
  const types: ('car' | 'bus' | 'truck')[] = ['car', 'car', 'bus', 'truck'];
  for (let i = 0; i < count; i += 1) {
    const type = randomChoice(types);
    const baseLength =
      type === 'truck' ? 2.2 : type === 'bus' ? 1.8 : randomChoice(sizeOptions);
    const length = baseLength * TILE_SIZE;
    const width = TILE_SIZE * 0.8;
    let x = randomFloat(MIN_X, MAX_X);
    let attempts = 0;
    const spacing = Math.max(0.3, 0.5 - difficulty * 0.05);
    while (
      vehicles.some(
        (vehicle) =>
          Math.abs(vehicle.x - x) <
          (vehicle.length + length) * 0.5 + TILE_SIZE * spacing
      ) &&
      attempts < 20
    ) {
      x = randomFloat(MIN_X, MAX_X);
      attempts += 1;
    }
    vehicles.push({ x, length, width, color: randomChoice(colors), type });
  }
  return vehicles;
};

export const createBarrierSet = (
  count: number,
  difficulty: number
): BarrierData[] => {
  const barriers: BarrierData[] = [];
  for (let i = 0; i < count; i++) {
    const width = TILE_SIZE * randomFloat(1.5, 2.5);
    const slideRange = TILE_SIZE * randomFloat(2, 4);
    const speed = randomFloat(0.8, 1.5) * difficulty;
    const x = randomFloat(MIN_X + slideRange, MAX_X - slideRange);
    barriers.push({
      x,
      width,
      slideRange,
      speed,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return barriers;
};

export const createCritterSet = (
  count: number,
  sizeOptions: number[],
  colors: string[]
) => {
  const critters: CritterData[] = [];
  for (let i = 0; i < count; i += 1) {
    const length = randomChoice(sizeOptions) * TILE_SIZE;
    const width = TILE_SIZE * 0.6;
    let x = randomFloat(MIN_X, MAX_X);
    let attempts = 0;
    while (
      critters.some(
        (critter) =>
          Math.abs(critter.x - x) <
          (critter.length + length) * 0.5 + TILE_SIZE * 0.5
      ) &&
      attempts < 12
    ) {
      x = randomFloat(MIN_X, MAX_X);
      attempts += 1;
    }
    critters.push({
      x,
      length,
      width,
      color: randomChoice(colors),
      bobOffset: Math.random() * Math.PI * 2,
    });
  }
  return critters;
};

export const createTrainSet = (count: number, sizeOptions: number[]) => {
  const trains: TrainData[] = [];
  for (let i = 0; i < count; i += 1) {
    const length = randomChoice(sizeOptions) * TILE_SIZE;
    const width = TILE_SIZE * 0.95;
    let x = randomFloat(MIN_X, MAX_X);
    let attempts = 0;
    while (
      trains.some(
        (train) =>
          Math.abs(train.x - x) < (train.length + length) * 0.5 + TILE_SIZE * 2
      ) &&
      attempts < 12
    ) {
      x = randomFloat(MIN_X, MAX_X);
      attempts += 1;
    }
    trains.push({ x, length, width });
  }
  return trains;
};

export const createLogSet = (count: number, sizeOptions: number[]) => {
  const logs: LogData[] = [];
  for (let i = 0; i < count; i += 1) {
    const length = randomChoice(sizeOptions) * TILE_SIZE;
    const width = TILE_SIZE * 0.9;
    let x = randomFloat(MIN_X, MAX_X);
    let attempts = 0;
    while (
      logs.some(
        (log) =>
          Math.abs(log.x - x) < (log.length + length) * 0.5 + TILE_SIZE * 0.5
      ) &&
      attempts < 12
    ) {
      x = randomFloat(MIN_X, MAX_X);
      attempts += 1;
    }
    logs.push({ x, length, width });
  }
  return logs;
};

export const createDroneSet = (
  count: number,
  difficulty: number
): DroneData[] => {
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

export const generateGrassRow = (
  rowIndex: number,
  difficulty: number
): GrassRowData => {
  const maxTrees = TILES_PER_ROW - 4;
  const baseTrees = rowIndex < 4 ? 2 : 3;
  const treeCount = clamp(
    baseTrees + Math.floor(difficulty * 1.0),
    2,
    maxTrees
  );
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

export const generateRoadRow = (
  rowIndex: number,
  difficulty: number
): RoadRowData => {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const speed = (1.4 + randomFloat(0, 0.4)) * difficulty;
  const vehicleCount = clamp(2 + Math.floor(difficulty * 1.1), 2, 5);
  const sizeOptions = [1.0, 1.3, 1.6];
  const barriers =
    difficulty > 1.5 && Math.random() < 0.3
      ? createBarrierSet(1, difficulty)
      : undefined;

  return {
    type: 'road',
    direction,
    speed,
    vehicles: createVehicleSet(
      vehicleCount,
      sizeOptions,
      VEHICLE_COLORS,
      difficulty
    ),
    barriers,
  };
};

export const generateRiverRow = (
  rowIndex: number,
  difficulty: number
): RiverRowData => {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const speed = (0.9 + randomFloat(0, 0.25)) * difficulty;
  const logCount = clamp(3 + Math.floor(difficulty * 0.4), 3, 5);
  const sizeOptions = [2.4, 3.0, 3.6, 4.2];

  return {
    type: 'river',
    direction,
    speed,
    logs: createLogSet(logCount, sizeOptions),
  };
};

export const generateIceRow = (
  rowIndex: number,
  difficulty: number
): IceRowData => {
  const drift = Math.random() > 0.5 ? 1 : -1;
  const driftSpeed = (0.4 + randomFloat(0, 0.25)) * difficulty;
  return { type: 'ice', drift, driftSpeed };
};

export const generateWildlifeRow = (
  rowIndex: number,
  difficulty: number
): WildlifeRowData => {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const speed = (0.8 + randomFloat(0, 0.25)) * difficulty;
  const critterCount = clamp(2 + Math.floor(difficulty * 0.7), 2, 5);
  const sizeOptions = [0.7, 0.9, 1.1];
  return {
    type: 'wildlife',
    direction,
    speed,
    critters: createCritterSet(critterCount, sizeOptions, WILDLIFE_COLORS),
  };
};

export const generateSubwayRow = (
  rowIndex: number,
  difficulty: number
): SubwayRowData => {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const speed = (2.4 + randomFloat(0, 0.8)) * difficulty;
  const trainCount = clamp(1 + Math.floor(difficulty * 0.35), 1, 2);
  const sizeOptions = [4.6, 5.8, 7.0, 8.0];
  return {
    type: 'subway',
    direction,
    speed,
    trains: createTrainSet(trainCount, sizeOptions),
  };
};

export const generateDroneRow = (
  rowIndex: number,
  difficulty: number
): DroneRowData => {
  const droneCount = clamp(2 + Math.floor(difficulty * 0.5), 2, 4);
  return { type: 'drone', drones: createDroneSet(droneCount, difficulty) };
};

export const generateRow = (rowIndex: number): RowData => {
  const difficulty = difficultyForRow(rowIndex);
  const progress = Math.max(0, rowIndex - 4);
  const grassWeight = clamp(0.5 - progress * 0.007, 0.18, 0.5);
  const riverWeight =
    rowIndex < 6 ? 0 : clamp(0.05 + progress * 0.003, 0, 0.22);
  const iceWeight = rowIndex < 10 ? 0 : clamp(0.04 + progress * 0.002, 0, 0.16);
  const wildlifeWeight =
    rowIndex < 8 ? 0 : clamp(0.04 + progress * 0.002, 0, 0.14);
  const subwayWeight =
    rowIndex < 16 ? 0 : clamp(0.03 + progress * 0.0015, 0, 0.12);
  const droneWeight =
    rowIndex < 20 ? 0 : clamp(0.02 + progress * 0.001, 0, 0.1);
  const reservedWeight =
    grassWeight +
    riverWeight +
    iceWeight +
    wildlifeWeight +
    subwayWeight +
    droneWeight;
  const roadWeight = Math.max(0.22, 1 - reservedWeight);
  const totalWeight = reservedWeight + roadWeight;
  const roll = Math.random() * totalWeight;

  if (roll < grassWeight) return generateGrassRow(rowIndex, difficulty);
  if (roll < grassWeight + roadWeight)
    return generateRoadRow(rowIndex, difficulty);
  if (roll < grassWeight + roadWeight + riverWeight)
    return generateRiverRow(rowIndex, difficulty);
  if (roll < grassWeight + roadWeight + riverWeight + iceWeight)
    return generateIceRow(rowIndex, difficulty);
  if (
    roll <
    grassWeight + roadWeight + riverWeight + iceWeight + wildlifeWeight
  )
    return generateWildlifeRow(rowIndex, difficulty);
  if (
    roll <
    grassWeight +
      roadWeight +
      riverWeight +
      iceWeight +
      wildlifeWeight +
      subwayWeight
  ) {
    return generateSubwayRow(rowIndex, difficulty);
  }
  return generateDroneRow(rowIndex, difficulty);
};

export const generateRows = (
  count: number,
  startIndex: number,
  previousType?: RowData['type']
) => {
  const rows: RowData[] = [];
  let lastType: RowData['type'] | null = previousType ?? null;
  for (let i = 0; i < count; i += 1) {
    const rowIndex = startIndex + i;
    let row = generateRow(rowIndex);
    if (
      lastType &&
      row.type === lastType &&
      ['ice', 'wildlife', 'subway', 'drone'].includes(row.type)
    ) {
      const difficulty = difficultyForRow(rowIndex);
      row =
        Math.random() > 0.5
          ? generateRoadRow(rowIndex, difficulty)
          : generateGrassRow(rowIndex, difficulty);
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

export const calculateFinalPosition = (
  current: { rowIndex: number; tileIndex: number },
  moves: MoveDirection[]
) => {
  return moves.reduce(
    (position, direction) => {
      if (direction === 'forward')
        return { ...position, rowIndex: position.rowIndex + 1 };
      if (direction === 'backward')
        return { ...position, rowIndex: position.rowIndex - 1 };
      if (direction === 'left')
        return { ...position, tileIndex: position.tileIndex + 1 };
      if (direction === 'right')
        return { ...position, tileIndex: position.tileIndex - 1 };
      return position;
    },
    { ...current }
  );
};
