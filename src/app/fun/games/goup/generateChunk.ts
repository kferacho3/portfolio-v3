import { CFG } from './config';
import { mulberry32 } from './rng';
import type { GenMode, GenState, Obstacle, SimDir, SimVec3, Step, TrackMode } from './simTypes';
import * as THREE from 'three';

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

const weightedModePick = (
  rng: () => number,
  trackMode: TrackMode,
  difficulty: number
): GenMode => {
  if (trackMode === 'classic' || trackMode === 'curved' || trackMode === 'spiral') {
    return trackMode;
  }

  const roll = rng();
  if (trackMode === 'auto') {
    const wClassic = difficulty < 0.35 ? 0.78 : 0.62;
    const wCurved = difficulty < 0.45 ? 0.2 : 0.27;
    const wSpiral = 1 - wClassic - wCurved;
    if (roll < wClassic) return 'classic';
    if (roll < wClassic + wCurved) return 'curved';
    return 'spiral';
  }

  if (roll < 0.42) return 'classic';
  if (roll < 0.76) return 'curved';
  return 'spiral';
};

const maxStepWithinRadius = (
  px: number,
  pz: number,
  dx: number,
  dz: number,
  hardR: number
) => {
  // Solve |P + D * s| = R for positive s to cap advance before crossing hard radius.
  const b = 2 * (px * dx + pz * dz);
  const c = px * px + pz * pz - hardR * hardR;
  const disc = b * b - 4 * c;
  if (disc <= 0) return 0;
  const sqrtDisc = Math.sqrt(disc);
  const r1 = (-b - sqrtDisc) / 2;
  const r2 = (-b + sqrtDisc) / 2;
  const max = Math.max(r1, r2);
  if (max <= 0) return 0;
  return max;
};

const copyState = (state: GenState): GenState => ({
  ...state,
  pos: [...state.pos],
  dir: [...state.dir],
});

const chooseObstacleType = (rng: () => number): Obstacle['type'] =>
  rng() < 0.58 ? 'wall' : 'spike';

export function generateChunk(
  baseSeed: number,
  chunkIndex: number,
  startStepIndex: number,
  startState: GenState,
  trackMode: TrackMode
): { steps: Step[]; endState: GenState } {
  const rng = mulberry32((baseSeed ^ (chunkIndex * 2654435761)) >>> 0);
  const state = copyState(startState);
  const steps: Step[] = [];

  const hardR = CFG.STEP.pathRadiusMax;
  const softR = hardR * CFG.STEP.pathSoftRadiusRatio;

  for (let k = 0; k < CFG.STEPS_PER_CHUNK; k += 1) {
    const i = startStepIndex + k;
    const difficulty = clamp01(i / 700);

    if (state.tensionStepsLeft <= 0) {
      state.tension = !state.tension;
      state.tensionStepsLeft = state.tension
        ? randIntRange(rng, CFG.STEP.tensionRunMin, CFG.STEP.tensionRunMax)
        : randIntRange(rng, CFG.STEP.calmRunMin, CFG.STEP.calmRunMax);
    }
    state.tensionStepsLeft -= 1;

    if (state.modeStepsLeft <= 0 || trackMode === 'classic' || trackMode === 'curved' || trackMode === 'spiral') {
      state.mode = weightedModePick(rng, trackMode, difficulty);
      state.modeStepsLeft =
        state.mode === 'classic'
          ? randIntRange(rng, 12, 20)
          : state.mode === 'curved'
          ? randIntRange(rng, 14, 24)
          : randIntRange(rng, 16, 28);
    }
    state.modeStepsLeft -= 1;

    const [px, py, pz] = state.pos;
    const radius = Math.hypot(px, pz);
    const inwardYaw = Math.atan2(-px, -pz);

    if (state.mode === 'classic') {
      if (state.classicRunRemaining <= 0) {
        const forceInward = radius > softR;
        const shouldTurn =
          forceInward ||
          rng() < (state.tension ? CFG.STEP.turnChanceTension : CFG.STEP.turnChanceCalm);

        if (shouldTurn) {
          const towardInward = shortestAngle(state.yaw, inwardYaw);
          const inwardSign = towardInward >= 0 ? 1 : -1;
          const randomSign = rng() < 0.5 ? -1 : 1;
          const turnSign = forceInward ? inwardSign : (rng() < 0.7 ? inwardSign : randomSign);
          state.classicTurnSign = turnSign as 1 | -1;

          const hardTurn = rng() < CFG.STEP.hardTurnChance;
          const maxTurn = hardTurn
            ? CFG.STEP.turnHardRange
            : CFG.STEP.turnGentleRange;
          const turnAmount = 0.06 + rng() * maxTurn;
          state.yaw += state.classicTurnSign * turnAmount;
        }

        state.classicRunRemaining = randIntRange(
          rng,
          CFG.STEP.turnSegmentMin,
          CFG.STEP.turnSegmentMax
        );
      }
      state.classicRunRemaining -= 1;
      state.yaw += (rng() - 0.5) * CFG.STEP.headingJitter;
    } else if (state.mode === 'curved') {
      const towardInward = shortestAngle(state.yaw, inwardYaw);
      const pressure = clamp01((radius - softR) / Math.max(hardR - softR, 0.001));
      if (rng() < 0.08) state.classicTurnSign *= -1;
      const targetVel =
        state.classicTurnSign * CFG.STEP.curvedTurnRate +
        towardInward * (CFG.STEP.curvedBoundaryGain * pressure);
      state.yawVel = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(state.yawVel, targetVel, 0.3),
        -0.42,
        0.42
      );
      state.yaw += state.yawVel + (rng() - 0.5) * CFG.STEP.headingJitter * 0.5;
    } else {
      const radialX = radius > 1e-5 ? px / radius : 1;
      const radialZ = radius > 1e-5 ? pz / radius : 0;
      const tangentX = state.spiralSign * radialZ;
      const tangentZ = -state.spiralSign * radialX;
      let radialBias = state.spiralSign > 0
        ? CFG.STEP.spiralOutwardDrift
        : -CFG.STEP.spiralInwardDrift;

      if (radius < CFG.STEP.spiralMinRadius) radialBias = CFG.STEP.spiralOutwardDrift;
      if (radius > CFG.STEP.spiralMaxRadius) radialBias = -CFG.STEP.spiralInwardDrift;

      const dirX = tangentX * CFG.STEP.spiralTurnRate + radialX * radialBias;
      const dirZ = tangentZ * CFG.STEP.spiralTurnRate + radialZ * radialBias;
      state.yaw = Math.atan2(dirX, dirZ);

      if ((trackMode === 'auto' || trackMode === 'mix') && rng() < 0.02) {
        state.spiralSign *= -1;
      }
    }

    if (radius > softR && state.mode !== 'spiral') {
      const pressure = clamp01((radius - softR) / Math.max(hardR - softR, 0.001));
      state.yaw += shortestAngle(state.yaw, inwardYaw) * (CFG.STEP.radialPull + pressure * 0.35);
    }

    let dir = dirFromHeading(state.yaw);

    let length =
      CFG.STEP.lengthMin + (CFG.STEP.lengthMax - CFG.STEP.lengthMin) * rng();

    let riseToNext = state.tension
      ? randRange(rng, CFG.STEP.riseTensionMin, CFG.STEP.riseTensionMax)
      : randRange(rng, CFG.STEP.riseCalmMin, CFG.STEP.riseCalmMax);

    const gapBase =
      CFG.STEP.gapChance +
      difficulty * (CFG.DIFFICULTY.gapChanceMax - CFG.STEP.gapChance);
    const gapChance = state.tension
      ? clamp01(gapBase + CFG.STEP.gapChanceTensionBoost * (0.7 + difficulty * 0.5))
      : gapBase * CFG.STEP.gapChanceCalmMultiplier;

    let gapAfter = rng() < gapChance;
    if (state.demandingCooldown > 0 || state.prevGapAfter) {
      gapAfter = false;
      riseToNext = Math.min(riseToNext, CFG.STEP.safeRiseMaxAfterDemanding);
    }
    let gapLength = gapAfter
      ? CFG.STEP.gapLengthMin + (CFG.STEP.gapLengthMax - CFG.STEP.gapLengthMin) * rng()
      : 0;

    // Predictive hard boundary check: adjust length/gap before committing the step.
    const desiredAdvance = length + gapLength;
    let maxAdvance = maxStepWithinRadius(px, pz, dir[0], dir[2], hardR - 0.04);
    if (desiredAdvance > maxAdvance) {
      if (maxAdvance < 0.55) {
        state.yaw += shortestAngle(state.yaw, inwardYaw) * 0.92;
        dir = dirFromHeading(state.yaw);
        maxAdvance = maxStepWithinRadius(px, pz, dir[0], dir[2], hardR - 0.04);
      }

      if (gapAfter && desiredAdvance > maxAdvance) {
        const reduce = desiredAdvance - maxAdvance;
        gapLength = Math.max(0, gapLength - reduce);
        if (gapLength === 0) gapAfter = false;
      }

      if (length + gapLength > maxAdvance) {
        const allowedLength = Math.max(0.6, maxAdvance - gapLength);
        length = Math.min(length, allowedLength);
      }
    }

    const start: SimVec3 = [px, py, pz];
    const center: SimVec3 = [
      start[0] + dir[0] * (length * 0.5),
      start[1],
      start[2] + dir[2] * (length * 0.5),
    ];
    const end: SimVec3 = [
      start[0] + dir[0] * length,
      start[1],
      start[2] + dir[2] * length,
    ];

    let obstacles: Obstacle[] | undefined;
    const obstacleChanceBase =
      CFG.OBSTACLES.chanceMin +
      (CFG.OBSTACLES.chanceMax - CFG.OBSTACLES.chanceMin) * difficulty;
    if (
      state.tension &&
      state.hazardBurstRemaining <= 0 &&
      state.demandingCooldown <= 0 &&
      !state.prevGapAfter &&
      rng() < 0.2
    ) {
      state.hazardBurstRemaining = randIntRange(rng, 2, 4);
    }
    const burstBoost = state.hazardBurstRemaining > 0 ? 1.7 : 1;
    const obstacleChance = clamp01(
      (state.tension ? obstacleChanceBase * 1.08 : obstacleChanceBase * 0.38) *
        burstBoost
    );
    const obstacleAllowed =
      i > 5 &&
      !gapAfter &&
      state.demandingCooldown <= 0 &&
      !state.prevGapAfter &&
      state.prevRiseToNext <= CFG.STEP.demandingRiseThreshold &&
      riseToNext <= CFG.STEP.demandingRiseThreshold &&
      state.obstacleCooldown <= 0;

    let spawnedObstacle = false;
    if (obstacleAllowed && rng() < obstacleChance) {
      const type = chooseObstacleType(rng);
      const along = randRange(rng, length * 0.48, length * 0.82);
      let h = 0.8;
      let d = 0.3;
      let w = CFG.STEP.width * 0.9;

      if (type === 'wall') {
        h = randRange(rng, CFG.OBSTACLES.wallHeightMin, CFG.OBSTACLES.wallHeightMax);
        d = 0.28;
        w = CFG.STEP.width * 0.92;
      } else if (type === 'spike') {
        h = randRange(rng, CFG.OBSTACLES.spikeHeightMin, CFG.OBSTACLES.spikeHeightMax);
        d = 0.24;
        w = 0.42;
      }

      obstacles = [
        {
          id: ((chunkIndex + 1) * 131 + (i + 1) * 17) >>> 0,
          type,
          along,
          lateral: 0,
          w,
          h,
          d,
          requiredClearY: py + CFG.PLAYER.radius + h * 0.5,
          cleared: false,
          nearMissed: false,
        },
      ];
      spawnedObstacle = true;
      if (state.hazardBurstRemaining > 0) {
        state.hazardBurstRemaining -= 1;
      }
      const spacingMin = state.tension
        ? Math.max(1, CFG.OBSTACLES.minSpacingMin - 1)
        : CFG.OBSTACLES.minSpacingMin + 2;
      const spacingMax = state.tension
        ? CFG.OBSTACLES.minSpacingMax
        : CFG.OBSTACLES.minSpacingMax + 4;
      state.obstacleCooldown = randIntRange(rng, spacingMin, spacingMax);
    } else if (state.obstacleCooldown > 0) {
      state.obstacleCooldown -= 1;
    }
    if (!spawnedObstacle && state.hazardBurstRemaining > 0 && !state.tension) {
      state.hazardBurstRemaining = Math.max(0, state.hazardBurstRemaining - 1);
    }

    const step: Step = {
      i,
      pos: center,
      start,
      end,
      dir,
      length,
      width: CFG.STEP.width,
      height: py,
      riseToNext,
      gapAfter,
      gapLength,
      obstacles,
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

    const demanding = gapAfter || riseToNext > CFG.STEP.demandingRiseThreshold;
    if (demanding) {
      state.demandingCooldown = randIntRange(
        rng,
        CFG.STEP.demandingCooldownMin,
        CFG.STEP.demandingCooldownMax
      );
    } else if (state.demandingCooldown > 0) {
      state.demandingCooldown -= 1;
    }

    state.prevGapAfter = gapAfter;
    state.prevRiseToNext = riseToNext;
    state.pos = [
      start[0] + dir[0] * (length + gapLength),
      start[1] + riseToNext,
      start[2] + dir[2] * (length + gapLength),
    ];
    state.dir = dir;
    state.yaw = headingFromDir(dir);
    state.totalStepIndex = i + 1;
  }

  return { steps, endState: state };
}
