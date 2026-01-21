export type MoveDirection = 'forward' | 'backward' | 'left' | 'right';

export interface TreeData {
  tileIndex: number;
  height: number;
  type: 'pine' | 'oak' | 'crystal';
}

export interface VehicleData {
  x: number;
  length: number;
  width: number;
  color: string;
  type: 'car' | 'bus' | 'truck';
}

export interface CritterData {
  x: number;
  length: number;
  width: number;
  color: string;
  bobOffset: number;
}

export interface TrainData {
  x: number;
  length: number;
  width: number;
}

export interface LogData {
  x: number;
  length: number;
  width: number;
}

export interface DroneData {
  x: number;
  z: number;
  radius: number;
  speed: number;
  phase: number;
}

export interface BarrierData {
  x: number;
  width: number;
  slideRange: number;
  speed: number;
  phase: number;
}

export interface GrassRowData {
  type: 'grass';
  trees: TreeData[];
  boostTile?: number;
}

export interface RoadRowData {
  type: 'road';
  direction: 1 | -1;
  speed: number;
  vehicles: VehicleData[];
  barriers?: BarrierData[];
}

export interface RiverRowData {
  type: 'river';
  direction: 1 | -1;
  speed: number;
  logs: LogData[];
}

export interface IceRowData {
  type: 'ice';
  drift: 1 | -1;
  driftSpeed: number;
}

export interface WildlifeRowData {
  type: 'wildlife';
  direction: 1 | -1;
  speed: number;
  critters: CritterData[];
}

export interface SubwayRowData {
  type: 'subway';
  direction: 1 | -1;
  speed: number;
  trains: TrainData[];
}

export interface DroneRowData {
  type: 'drone';
  drones: DroneData[];
}

export type RowData =
  | GrassRowData
  | RoadRowData
  | RiverRowData
  | IceRowData
  | WildlifeRowData
  | SubwayRowData
  | DroneRowData;

export interface PlayerState {
  row: number;
  tile: number;
  isMoving: boolean;
}
