export type SimDir = [number, 0, number];
export type SimVec3 = [number, number, number];

export type Step = {
  i: number;
  pos: SimVec3; // Tread center (top plane)
  dir: SimDir;
  length: number;
  width: number;
  height: number; // Top plane y
  gapAfter: boolean;
  gapLength: number;
  gem?: {
    offset: SimVec3;
    collected: boolean;
  };
};

