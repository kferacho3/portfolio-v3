import { CFG } from './config';
import { mulberry32 } from './rng';
import type { SimDir, SimVec3, Step } from './simTypes';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function rot90(dir: SimDir, sign: 1 | -1): SimDir {
  const [x, , z] = dir;
  return sign === 1 ? [-z, 0, x] : [z, 0, -x];
}

function normalizeXZ(x: number, z: number): [number, number] {
  const len = Math.hypot(x, z);
  if (len < 1e-6) return [1, 0];
  return [x / len, z / len];
}

function steerTowardCenter(dir: SimDir, pos: SimVec3): SimDir {
  const [px, , pz] = pos;
  const radius = Math.hypot(px, pz);
  if (radius < CFG.STEP.pathRadiusMax) return dir;

  const left = rot90(dir, 1);
  const right = rot90(dir, -1);
  const leftDot = left[0] * px + left[2] * pz;
  const rightDot = right[0] * px + right[2] * pz;
  return leftDot < rightDot ? left : right;
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

  for (let k = 0; k < CFG.STEPS_PER_CHUNK; k += 1) {
    const i = startStepIndex + k;
    const difficulty = clamp01(i / 700);
    const gapChance =
      CFG.STEP.gapChance +
      difficulty * (CFG.DIFFICULTY.gapChanceMax - CFG.STEP.gapChance);

    dir = steerTowardCenter(dir, pos);

    if (rng() < CFG.STEP.turnChance) {
      dir = rot90(dir, rng() < 0.5 ? 1 : -1);
    }

    const length =
      CFG.STEP.lengthMin + (CFG.STEP.lengthMax - CFG.STEP.lengthMin) * rng();

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

    const nextY = pos[1] + CFG.STEP.rise;
    const nextX = pos[0] + dir[0] * (length + gapLength);
    const nextZ = pos[2] + dir[2] * (length + gapLength);
    const [normX, normZ] = normalizeXZ(nextX, nextZ);
    const clampedRadius = Math.min(Math.hypot(nextX, nextZ), CFG.STEP.pathRadiusMax);

    pos = [normX * clampedRadius, nextY, normZ * clampedRadius];
  }

  return { steps, endPos: pos, endDir: dir };
}

