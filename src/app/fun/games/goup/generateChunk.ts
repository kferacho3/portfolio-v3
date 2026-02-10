import { CFG } from './config';
import { mulberry32 } from './rng';
import type { SimDir, SimVec3, Step } from './simTypes';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const randRange = (rng: () => number, min: number, max: number) =>
  min + (max - min) * rng();
const randIntRange = (rng: () => number, min: number, max: number) =>
  Math.floor(min + rng() * (max - min + 1));

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
  let inTension = false;
  let phaseRemain = randIntRange(
    rng,
    CFG.STEP.calmRunMin,
    CFG.STEP.calmRunMax
  );
  let demandingCooldown = 0;
  let spikeCooldown = 0;
  let prevGapAfter = false;
  let prevRiseToNext: number = CFG.STEP.riseCalmMin;
  let prevHadSpike = false;

  for (let k = 0; k < CFG.STEPS_PER_CHUNK; k += 1) {
    const i = startStepIndex + k;
    const difficulty = clamp01(i / 700);
    const gapBase =
      CFG.STEP.gapChance +
      difficulty * (CFG.DIFFICULTY.gapChanceMax - CFG.STEP.gapChance);

    if (phaseRemain <= 0) {
      inTension = !inTension;
      phaseRemain = inTension
        ? randIntRange(rng, CFG.STEP.tensionRunMin, CFG.STEP.tensionRunMax)
        : randIntRange(rng, CFG.STEP.calmRunMin, CFG.STEP.calmRunMax);
    }
    phaseRemain -= 1;

    if (segmentRemain <= 0) {
      const hardTurn = rng() < CFG.STEP.hardTurnChance;
      const maxTurn = hardTurn
        ? CFG.STEP.turnHardRange
        : CFG.STEP.turnGentleRange;
      const signedTurn = (rng() < 0.5 ? -1 : 1) * (0.04 + rng() * maxTurn);
      const shouldTurn =
        rng() <
        (inTension ? CFG.STEP.turnChanceTension : CFG.STEP.turnChanceCalm);
      segmentRemain = Math.max(
        1,
        randIntRange(rng, CFG.STEP.turnSegmentMin, CFG.STEP.turnSegmentMax)
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

    let riseToNext = inTension
      ? randRange(rng, CFG.STEP.riseTensionMin, CFG.STEP.riseTensionMax)
      : randRange(rng, CFG.STEP.riseCalmMin, CFG.STEP.riseCalmMax);

    const gapChance = inTension
      ? clamp01(
          gapBase + CFG.STEP.gapChanceTensionBoost * (0.7 + difficulty * 0.5)
        )
      : gapBase * CFG.STEP.gapChanceCalmMultiplier;

    let gapAfter = rng() < gapChance;
    if (demandingCooldown > 0) {
      gapAfter = false;
      riseToNext = Math.min(riseToNext, CFG.STEP.safeRiseMaxAfterDemanding);
    }
    if (prevHadSpike) {
      gapAfter = false;
      riseToNext = Math.min(riseToNext, CFG.STEP.safeRiseMaxAfterDemanding);
    }
    const gapLength = gapAfter
      ? CFG.STEP.gapLengthMin +
        (CFG.STEP.gapLengthMax - CFG.STEP.gapLengthMin) * rng()
      : 0;

    const spikeChanceRaw = inTension
      ? CFG.STEP.spikeChanceTension
      : CFG.STEP.spikeChanceCalm;
    const spikeChance = clamp01(spikeChanceRaw + difficulty * 0.06);
    const enteredFromDemanding =
      prevGapAfter || prevRiseToNext > CFG.STEP.spikeBlockRiseFromPrev;
    const nextDemanding =
      gapAfter || riseToNext > CFG.STEP.spikeMaxRiseWithNext;
    const spikeAllowed: boolean =
      spikeCooldown <= 0 &&
      !enteredFromDemanding &&
      !nextDemanding &&
      !gapAfter &&
      !prevHadSpike;
    const hasSpike: boolean = spikeAllowed && rng() < spikeChance;
    if (hasSpike) {
      spikeCooldown = randIntRange(
        rng,
        CFG.STEP.spikeCooldownMin,
        CFG.STEP.spikeCooldownMax
      );
    } else if (spikeCooldown > 0) {
      spikeCooldown -= 1;
    }

    const centerX = pos[0] + dir[0] * (length * 0.5);
    const centerZ = pos[2] + dir[2] * (length * 0.5);

    const step: Step = {
      i,
      pos: [centerX, pos[1], centerZ],
      dir: [...dir],
      length,
      width: CFG.STEP.width,
      height: pos[1],
      riseToNext,
      gapAfter,
      gapLength,
      spike: hasSpike
        ? {
            along:
              length *
              randRange(rng, CFG.STEP.spikeAlongMin, CFG.STEP.spikeAlongMax),
            clearance: CFG.STEP.spikeClearance,
            hit: false,
          }
        : undefined,
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

    const demanding =
      gapAfter || riseToNext > CFG.STEP.demandingRiseThreshold;
    if (demanding) {
      demandingCooldown = randIntRange(
        rng,
        CFG.STEP.demandingCooldownMin,
        CFG.STEP.demandingCooldownMax
      );
    } else if (hasSpike) {
      demandingCooldown = Math.max(demandingCooldown, 1);
    } else if (demandingCooldown > 0) {
      demandingCooldown -= 1;
    }
    prevGapAfter = gapAfter;
    prevRiseToNext = riseToNext;
    prevHadSpike = hasSpike;

    const nextY = pos[1] + riseToNext;
    const nextX = pos[0] + dir[0] * (length + gapLength);
    const nextZ = pos[2] + dir[2] * (length + gapLength);
    pos = [nextX, nextY, nextZ];
  }

  return { steps, endPos: pos, endDir: dir };
}
