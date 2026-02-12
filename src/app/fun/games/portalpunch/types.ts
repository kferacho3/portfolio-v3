export type GameStatus = 'START' | 'PLAYING' | 'SOLVED' | 'GAMEOVER';
export type LevelDifficultyTag = 'Easy' | 'Normal' | 'Hard' | 'Expert' | 'Master';

export type PhaseId = 'A' | 'B';

export type GridPos = {
  x: number;
  y: number;
};

export type Dir = 'N' | 'E' | 'S' | 'W';

export type LaserColor =
  | 'WHITE'
  | 'RED'
  | 'GREEN'
  | 'BLUE'
  | 'CYAN'
  | 'VIOLET'
  | 'AMBER';

export type BaseEntity = {
  id: string;
  pos: GridPos;
  phase?: PhaseId | 'BOTH';
  moving?: {
    axis: 'x' | 'y';
    range: number;
    speed: number;
    phase: number;
  };
};

export type WallEntity = BaseEntity & {
  type: 'WALL';
};

export type MirrorEntity = BaseEntity & {
  type: 'MIRROR';
  orientation: number;
  interactable?: boolean;
  mode?: 'NORMAL' | 'VELOCITY';
  oscillation?: {
    axis: 'x' | 'y' | 'z';
    amplitude: number;
    frequency: number;
  };
};

export type PortalEntity = BaseEntity & {
  type: 'PORTAL';
  facing: Dir;
  linkId: string;
  color?: LaserColor;
};

export type PrismOutput = {
  color: LaserColor;
  turn: -1 | 0 | 1;
};

export type PrismEntity = BaseEntity & {
  type: 'PRISM';
  facing?: Dir;
  interactable?: boolean;
  orientation?: number;
  outputs?: PrismOutput[];
};

export type FilterEntity = BaseEntity & {
  type: 'FILTER';
  passColor: LaserColor;
};

export type PolarizerEntity = BaseEntity & {
  type: 'POLARIZER';
  requiredAngle: number;
  tolerance?: number;
};

export type LensEntity = BaseEntity & {
  type: 'LENS';
  subtype: 'CONVEX' | 'CONCAVE';
};

export type PhaseShifterEntity = BaseEntity & {
  type: 'PHASE_SHIFTER';
  phaseAdd: number;
};

export type GravityNodeEntity = BaseEntity & {
  type: 'GRAVITY_NODE';
  mass: number;
  radius: number;
};

export type SwitchEntity = BaseEntity & {
  type: 'SWITCH';
  mode: 'TOGGLE_PHASE';
};

export type ReceptorEntity = BaseEntity & {
  type: 'RECEPTOR';
  gateId: string;
  duration: number;
  passThrough?: boolean;
};

export type GateEntity = BaseEntity & {
  type: 'GATE';
  openByDefault?: boolean;
};

export type TargetEntity = BaseEntity & {
  type: 'TARGET';
  requiredColors?: LaserColor[];
  requiredHits?: number;
  requiredIntensity?: number;
  requiredPhase?: number;
  requiredWavelengthMax?: number;
  absorb?: boolean;
};

export type CollectibleEntity = BaseEntity & {
  type: 'COLLECTIBLE';
  score: number;
};

export type Entity =
  | WallEntity
  | MirrorEntity
  | PortalEntity
  | PrismEntity
  | FilterEntity
  | PolarizerEntity
  | LensEntity
  | PhaseShifterEntity
  | GravityNodeEntity
  | SwitchEntity
  | ReceptorEntity
  | GateEntity
  | TargetEntity
  | CollectibleEntity;

export type LaserSource = {
  pos: GridPos;
  dir: Dir;
  color: LaserColor;
  intensity: number;
  phase: number;
  wavelength: number;
  width: number;
  polarization: number;
};

export type LevelObjective = {
  description: string;
  targetIds: string[];
};

export type PortalPunchLevel = {
  id: number;
  key: string;
  name: string;
  subtitle: string;
  grid: {
    w: number;
    h: number;
  };
  playerStart: GridPos;
  source: LaserSource;
  entities: Entity[];
  objective: LevelObjective;
  difficulty: {
    rating: 1 | 2 | 3 | 4 | 5;
    tag: LevelDifficultyTag;
    seed: number;
  };
  camera?: {
    distance: number;
    height: number;
    lookZ: number;
  };
  style?: {
    floorA: string;
    floorB: string;
    fog: string;
    bloom: number;
    chroma: number;
  };
};

export type ResolvedEntity<T extends Entity = Entity> = T & {
  resolvedPos: GridPos;
};

export type BeamState = {
  id: string;
  pos: [number, number, number];
  dir: [number, number, number];
  color: LaserColor;
  intensity: number;
  phase: number;
  wavelength: number;
  width: number;
  polarization: number;
  depth: number;
  bounces: number;
};

export type BeamTrace = {
  id: string;
  points: [number, number, number][];
  color: LaserColor;
  intensity: number;
  width: number;
};

export type TargetHit = {
  id: string;
  color: LaserColor;
  intensity: number;
  phase: number;
  wavelength: number;
};

export type LaserSolveResult = {
  traces: BeamTrace[];
  hits: TargetHit[];
  receptorHits: Set<string>;
  gateTriggers: Record<string, number>;
  solvedTargets: Set<string>;
};

export type PortalPunchRuntime = {
  status: GameStatus;
  levelIndex: number;
  phase: PhaseId;
  player: GridPos;
  moves: number;
  elapsed: number;
  levelStart: number;
  mirrors: Record<string, number>;
  prisms: Record<string, number>;
  entityPositions: Record<string, GridPos>;
  gateTimers: Record<string, number>;
  collected: Set<string>;
  awardedTargets: Set<string>;
  solved: boolean;
  failReason: string;
  score: number;
  best: number;
};
