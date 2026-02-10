import { CFG } from './config';
import { mulberry32 } from './rng';
import type { SimDir, SimVec3, Step } from './simTypes';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function normalizeXZ(x: number, z: number): [number, number] {
  const len = Math.hypot(x, z);
  if (len < 1e-6) return [1, 0];
  return [x / len, z / len];
}

const headingFromDir = (dir: SimDir) => Math.atan2(dir[0], dir[2]);

const dirFromHeading = (heading: number): SimDir => [
  Math.sin(heading),
  0,
  Math.cos(heading),
];

const shortestAngle = (from: number, to: number) => {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

function steerHeadingToTowerBand(
  heading: number,
  pos: SimVec3,
  rng: () => number
) {
  const [px, , pz] = pos;
  const radius = Math.hypot(px, pz);
  if (radius < 1e-5) return heading;

  const inwardHeading = Math.atan2(-px, -pz);
  const tangentHeading = Math.atan2(-pz, px);
  const blendNoise = (rng() - 0.5) * 0.1;
  const targetHeading =
    radius > CFG.STEP.pathRadiusMax
      ? inwardHeading
      : radius < CFG.STEP.pathRadiusMin
      ? tangentHeading + blendNoise
      : tangentHeading + blendNoise;

  const delta = shortestAngle(heading, targetHeading);
  const pullStrength =
    radius > CFG.STEP.pathRadiusMax || radius < CFG.STEP.pathRadiusMin
      ? CFG.STEP.radialPull * 1.35
      : CFG.STEP.radialPull;

  return heading + delta * pullStrength;
}

export function generateChunk(
  baseSeed: number,
  chunkIndex: number,
  startStepIndex: number,
  startPos: SimVec3,
  startDir: SimDir
): { steps: Step[]; endPos: SimVec3; endDir: SimDir } {
  const rng = mulberry32((baseSeed ^ (chunkIndex * 2654435761)) >>> 0);

  const steps: Step[] = [];
  let pos: SimVec3 = [...startPos];
  let dir: SimDir = [...startDir];
  let heading = headingFromDir(dir);

  let segmentTurn = 0;
  let segmentRemain = 0;

  for (let k = 0; k < CFG.STEPS_PER_CHUNK; k += 1) {
    const i = startStepIndex + k;
    const difficulty = clamp01(i / 700);
    const gapChance =
      CFG.STEP.gapChance +
      difficulty * (CFG.DIFFICULTY.gapChanceMax - CFG.STEP.gapChance);

    if (segmentRemain <= 0) {
      const hardTurn = rng() < CFG.STEP.hardTurnChance;
      const maxTurn = hardTurn ? CFG.STEP.turnHardRange : CFG.STEP.turnGentleRange;
      const signedTurn = (rng() < 0.5 ? -1 : 1) * (0.04 + rng() * maxTurn);
      const shouldTurn = rng() < CFG.STEP.turnChance;
      segmentRemain = Math.max(
        1,
        Math.floor(
          CFG.STEP.turnSegmentMin +
            rng() * (CFG.STEP.turnSegmentMax - CFG.STEP.turnSegmentMin + 1)
        )
      );
      segmentTurn = shouldTurn ? signedTurn / segmentRemain : 0;
    }
    segmentRemain -= 1;

    const length =
      CFG.STEP.lengthMin + (CFG.STEP.lengthMax - CFG.STEP.lengthMin) * rng();

    heading += segmentTurn;
    heading += (rng() - 0.5) * CFG.STEP.headingJitter;
    heading = steerHeadingToTowerBand(heading, pos, rng);
    dir = dirFromHeading(heading);

    const gapAfter = rng() < gapChance;
    const gapLength = gapAfter
      ? CFG.STEP.gapLengthMin +
        (CFG.STEP.gapLengthMax - CFG.STEP.gapLengthMin) * rng()
      : 0;

    const centerX = pos[0] + dir[0] * (length * 0.5);
    const centerZ = pos[2] + dir[2] * (length * 0.5);

    const step: Step = {
      i,
      pos: [centerX, pos[1], centerZ],
      dir: [...dir],
      length,
      width: CFG.STEP.width,
      height: pos[1],
      gapAfter,
      gapLength,
      gem:
        rng() < CFG.STEP.gemChance
          ? {
              offset: [
                (rng() - 0.5) * Math.min(0.6, length * 0.25),
                0.55,
                (rng() - 0.5) * 0.35,
              ],
              collected: false,
            }
          : undefined,
    };

    steps.push(step);

    const prevX = pos[0];
    const prevZ = pos[2];
    const nextY = pos[1] + CFG.STEP.rise;
    const nextX = pos[0] + dir[0] * (length + gapLength);
    const nextZ = pos[2] + dir[2] * (length + gapLength);
    const [normX, normZ] = normalizeXZ(nextX, nextZ);
    const radius = Math.hypot(nextX, nextZ);
    const clampedRadius = Math.min(
      CFG.STEP.pathRadiusMax,
      Math.max(CFG.STEP.pathRadiusMin, radius)
    );

    pos = [normX * clampedRadius, nextY, normZ * clampedRadius];
    const [stepDirX, stepDirZ] = normalizeXZ(pos[0] - prevX, pos[2] - prevZ);
    heading = Math.atan2(stepDirX, stepDirZ);
    dir = dirFromHeading(heading);
  }

  return { steps, endPos: pos, endDir: dir };
}
