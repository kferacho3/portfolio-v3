import * as THREE from 'three';
import {
  CLASSIC_TURN_CHANCE,
  CURVE_BASE_CURVATURE,
  CURVE_BOUNDARY_HARD,
  CURVE_BOUNDARY_SOFT,
  CURVE_CENTER_PULL,
  CURVE_FORWARD_BIAS,
  CURVE_MAX_YAW,
  CURVE_SEGMENT_RANGE,
  CURVE_SEGMENT_SHORT_RANGE,
  CURVE_SELF_INTERSECTION_DISTANCE,
  CURVE_TILE_STEP,
  DIRECTIONS,
  GRAVITY_TURN_BASE,
  GRAVITY_TURN_SWING,
  GRAVITY_WAVE_AMPLITUDE,
  GRAVITY_WAVE_FREQUENCY,
  GRAVITY_WAVE_HEIGHT_MULTIPLIER,
  MAX_DIVERGENCE,
  SPEEDRUSH_FORWARD_CHANCE,
  SPIRAL_INWARD_DRIFT,
  SPIRAL_MAX_RADIUS,
  SPIRAL_MIN_RADIUS,
  SPIRAL_OUTWARD_DRIFT,
  SPIRAL_OUTER_PULL,
  SPIRAL_SWITCH_RANGE,
  SPIRAL_TURN_RATE,
  TILE_DEPTH,
  TILE_SIZE,
  ZEN_TURN_BASE,
  ZEN_TURN_SWING,
  ZEN_WAVE_STEP,
} from '../constants';
import { mutation } from '../state';
import type { GameMode } from '../types';

const forward = DIRECTIONS[0];
const right = DIRECTIONS[1];
const curveForward = new THREE.Vector3(1, 0, -1).normalize();
const curveRight = new THREE.Vector3(1, 0, 1).normalize();
const tempPos = new THREE.Vector3();
const tempRadial = new THREE.Vector3();
const tempTangent = new THREE.Vector3();
const tempNormal = new THREE.Vector3();

const curveHash = new Map<string, THREE.Vector3>();
const curveHashQueue: string[] = [];
const CURVE_HASH_CELL = CURVE_TILE_STEP * 0.9;
const CURVE_HASH_MAX = 220;

export const resetCurvePathCache = () => {
  curveHash.clear();
  curveHashQueue.length = 0;
};

const curveHashKey = (x: number, z: number) => {
  const gx = Math.round(x / CURVE_HASH_CELL);
  const gz = Math.round(z / CURVE_HASH_CELL);
  return `${gx}:${gz}`;
};

const isCurvePosTooClose = (pos: THREE.Vector3) => {
  const gx = Math.round(pos.x / CURVE_HASH_CELL);
  const gz = Math.round(pos.z / CURVE_HASH_CELL);
  const minDistSq =
    CURVE_SELF_INTERSECTION_DISTANCE * CURVE_SELF_INTERSECTION_DISTANCE;

  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      const key = `${gx + ix}:${gz + iz}`;
      const stored = curveHash.get(key);
      if (!stored) continue;
      if (stored.distanceToSquared(pos) < minDistSq) return true;
    }
  }
  return false;
};

const recordCurvePos = (pos: THREE.Vector3) => {
  const key = curveHashKey(pos.x, pos.z);
  curveHash.set(key, pos.clone());
  curveHashQueue.push(key);
  if (curveHashQueue.length > CURVE_HASH_MAX) {
    const oldKey = curveHashQueue.shift();
    if (oldKey) curveHash.delete(oldKey);
  }
};

export const advanceCurvedState = (
  pos: THREE.Vector3,
  theta: number,
  curvature: number,
  curvatureVel: number,
  directionSign: number,
  step: number
) => {
  // Curved Mode V2:
  // - Track is generated along a diagonal-forward basis (classic ZigZag "feel").
  // - Player + tiles share the exact same integrator (physically possible).
  // - Use sign flips (tap) to change curvature direction.
  const targetAbsYaw = THREE.MathUtils.clamp(
    Math.abs(curvature) > 0.001 ? Math.abs(curvature) : 0.5,
    0.24,
    CURVE_MAX_YAW * 0.88
  );
  const turnEnergy = THREE.MathUtils.clamp(
    Math.abs(curvatureVel) > 0.001 ? Math.abs(curvatureVel) : 1,
    0.7,
    1.55
  );
  const targetYaw = targetAbsYaw * (directionSign >= 0 ? 1 : -1);
  const turnRate = CURVE_BASE_CURVATURE * 0.52 * turnEnergy;

  const lateral = pos.dot(curveRight);
  const boundaryForce =
    THREE.MathUtils.clamp(Math.abs(lateral) / CURVE_BOUNDARY_HARD, 0, 1) *
    Math.sign(lateral);

  const steer = targetYaw - theta;
  theta += steer * turnRate * step;
  theta -= boundaryForce * 0.45 * turnRate * step;
  theta = THREE.MathUtils.damp(theta, 0, CURVE_FORWARD_BIAS * 0.45, step);
  theta = THREE.MathUtils.clamp(theta, -CURVE_MAX_YAW, CURVE_MAX_YAW);

  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const tangent = tempTangent
    .copy(curveForward)
    .multiplyScalar(c)
    .addScaledVector(curveRight, s)
    .normalize();
  const normal = tempNormal.set(-tangent.z, 0, tangent.x);
  pos.addScaledVector(tangent, step);

  // Pull the path back toward the diagonal centerline (in curveRight-space),
  // keeping long runs bounded without introducing discontinuities.
  const lateralAfter = pos.dot(curveRight);
  const lateralPulled = THREE.MathUtils.damp(
    lateralAfter,
    0,
    CURVE_CENTER_PULL,
    step
  );
  pos.addScaledVector(curveRight, lateralPulled - lateralAfter);
  pos.y = -TILE_DEPTH / 2;

  return {
    theta,
    curvature: targetAbsYaw,
    curvatureVel: turnEnergy,
    tangent,
    normal,
  };
};

const chooseGridDirection = (preferRight: boolean) => {
  let useRight = preferRight;
  if (mutation.divergenceX >= MAX_DIVERGENCE) {
    useRight = false;
  } else if (mutation.divergenceZ >= MAX_DIVERGENCE) {
    useRight = true;
  }

  if (useRight) {
    mutation.divergenceX += 1;
    mutation.divergenceZ = Math.max(0, mutation.divergenceZ - 1);
    return right;
  }

  mutation.divergenceZ += 1;
  mutation.divergenceX = Math.max(0, mutation.divergenceX - 1);
  return forward;
};

const advanceTile = (
  direction: THREE.Vector3,
  y = -TILE_DEPTH / 2,
  step = TILE_SIZE
) => {
  const nextPos = tempPos
    .copy(mutation.lastTilePos)
    .addScaledVector(direction, step);
  nextPos.y = y;
  mutation.lastTilePos.copy(nextPos);
  return nextPos.clone();
};

export const generateClassicTile = (): THREE.Vector3 => {
  const direction = chooseGridDirection(Math.random() < CLASSIC_TURN_CHANCE);
  return advanceTile(direction);
};

export const generateCurvedTiles = () => {
  if (mutation.pathCurveSegmentRemaining <= 0) {
    const shouldFlip =
      Math.abs(mutation.pathCurveTheta) > 0.32 || Math.random() < 0.82;
    mutation.pathCurveSegmentRemaining = THREE.MathUtils.randInt(
      CURVE_SEGMENT_RANGE[0],
      CURVE_SEGMENT_RANGE[1]
    );
    if (mutation.pathCurveDirection === 0) {
      mutation.pathCurveDirection = Math.random() < 0.5 ? 1 : -1;
    } else if (shouldFlip) {
      mutation.pathCurveDirection *= -1;
    }
    mutation.pathCurveCurvature = THREE.MathUtils.randFloat(0.32, 0.68);
    mutation.pathCurveCurvatureVel = THREE.MathUtils.randFloat(0.9, 1.35);
  }

  const nearYawLimit = Math.abs(mutation.pathCurveTheta) > CURVE_MAX_YAW * 0.92;
  if (nearYawLimit) {
    mutation.pathCurveDirection *= -1;
    mutation.pathCurveSegmentRemaining = THREE.MathUtils.randInt(
      CURVE_SEGMENT_SHORT_RANGE[0],
      CURVE_SEGMENT_SHORT_RANGE[1]
    );
    mutation.pathCurveCurvature = THREE.MathUtils.randFloat(0.5, 0.78);
    mutation.pathCurveCurvatureVel = THREE.MathUtils.randFloat(1.1, 1.5);
  }

  const lateral = mutation.lastTilePos.dot(curveRight);
  if (Math.abs(lateral) > CURVE_BOUNDARY_SOFT) {
    mutation.pathCurveDirection = lateral > 0 ? -1 : 1;
    mutation.pathCurveSegmentRemaining = THREE.MathUtils.randInt(
      CURVE_SEGMENT_SHORT_RANGE[0],
      CURVE_SEGMENT_SHORT_RANGE[1]
    );
    mutation.pathCurveCurvature = THREE.MathUtils.randFloat(0.52, 0.8);
    mutation.pathCurveCurvatureVel = THREE.MathUtils.randFloat(1.1, 1.55);
  }

  const prevPos = mutation.lastTilePos.clone();
  const prevTheta = mutation.pathCurveTheta;
  const prevCurvature = mutation.pathCurveCurvature;
  const prevCurvatureVel = mutation.pathCurveCurvatureVel;
  const prevDirection = mutation.pathCurveDirection;

  let result = advanceCurvedState(
    mutation.lastTilePos,
    mutation.pathCurveTheta,
    mutation.pathCurveCurvature,
    mutation.pathCurveCurvatureVel,
    mutation.pathCurveDirection,
    CURVE_TILE_STEP
  );

  let center = mutation.lastTilePos.clone();
  const lateralAfter = center.dot(curveRight);
  if (
    Math.abs(lateralAfter) > CURVE_BOUNDARY_HARD ||
    isCurvePosTooClose(center)
  ) {
    mutation.lastTilePos.copy(prevPos);
    mutation.pathCurveTheta = prevTheta;
    mutation.pathCurveCurvature = prevCurvature;
    mutation.pathCurveCurvatureVel = prevCurvatureVel;
    mutation.pathCurveDirection = prevDirection * -1;
    mutation.pathCurveSegmentRemaining = Math.max(
      1,
      THREE.MathUtils.randInt(
        CURVE_SEGMENT_SHORT_RANGE[0],
        CURVE_SEGMENT_SHORT_RANGE[1]
      )
    );
    mutation.pathCurveCurvature = THREE.MathUtils.randFloat(0.52, 0.82);
    mutation.pathCurveCurvatureVel = THREE.MathUtils.randFloat(1.15, 1.55);

    result = advanceCurvedState(
      mutation.lastTilePos,
      mutation.pathCurveTheta,
      mutation.pathCurveCurvature,
      mutation.pathCurveCurvatureVel,
      mutation.pathCurveDirection,
      CURVE_TILE_STEP
    );
    center = mutation.lastTilePos.clone();
  }

  mutation.pathCurveTheta = result.theta;
  mutation.pathCurveCurvature = result.curvature;
  mutation.pathCurveCurvatureVel = result.curvatureVel;
  mutation.pathCurveSegmentRemaining -= 1;

  recordCurvePos(center);

  const rotationY = Math.atan2(result.tangent.x, result.tangent.z);

  return { center, rotationY };
};

export const generateSpiralTile = (): THREE.Vector3 => {
  if (mutation.pathSpiralSwitchRemaining <= 0) {
    mutation.pathSpiralSwitchRemaining = THREE.MathUtils.randInt(
      SPIRAL_SWITCH_RANGE[0],
      SPIRAL_SWITCH_RANGE[1]
    );
  }

  const radial = tempRadial.copy(mutation.lastTilePos).setY(0);
  const radius = Math.max(radial.length(), 0.001);
  if (radius < 0.01) {
    radial.set(1, 0, 0);
  } else {
    radial.divideScalar(radius);
  }

  // Spiral Mode V2:
  // A true spiral track around the origin with controllable in/out drift.
  // Path + player share the same integrator; the tap flips radial drift sign.
  const tangent = tempTangent.set(radial.z, 0, -radial.x);
  tangent.multiplyScalar(SPIRAL_TURN_RATE);

  let radialBias =
    mutation.pathSpiralDirection >= 0
      ? SPIRAL_OUTWARD_DRIFT
      : -SPIRAL_INWARD_DRIFT;
  if (radius < SPIRAL_MIN_RADIUS) radialBias = SPIRAL_OUTWARD_DRIFT;
  else if (radius > SPIRAL_MAX_RADIUS)
    radialBias = -SPIRAL_INWARD_DRIFT * SPIRAL_OUTER_PULL;

  const direction = tangent.add(radial.multiplyScalar(radialBias));
  direction.normalize();
  const nextPos = tempPos
    .copy(mutation.lastTilePos)
    .addScaledVector(direction, TILE_SIZE);
  nextPos.y = -TILE_DEPTH / 2;

  mutation.pathSpiralSwitchRemaining -= 1;
  if (mutation.pathSpiralSwitchRemaining === 0) {
    mutation.pathSpiralDirection *= -1;
  }

  mutation.lastTilePos.copy(nextPos);
  return nextPos.clone();
};

export const generateGravityTile = (): THREE.Vector3 => {
  mutation.gravityPhase += GRAVITY_WAVE_FREQUENCY;
  const wave = Math.sin(mutation.gravityPhase);
  const turnBias = THREE.MathUtils.clamp(
    GRAVITY_TURN_BASE + wave * GRAVITY_TURN_SWING,
    0.1,
    0.9
  );
  const direction = chooseGridDirection(Math.random() < turnBias);
  const heightOffset =
    Math.sin(mutation.gravityPhase * GRAVITY_WAVE_HEIGHT_MULTIPLIER) *
    GRAVITY_WAVE_AMPLITUDE;
  return advanceTile(direction, -TILE_DEPTH / 2 + heightOffset);
};

export const generateSpeedRushTile = (): THREE.Vector3 => {
  const preferRight = Math.random() > SPEEDRUSH_FORWARD_CHANCE;
  const direction = chooseGridDirection(preferRight);
  return advanceTile(direction);
};

export const generateZenTile = (): THREE.Vector3 => {
  mutation.zenPhase += ZEN_WAVE_STEP;
  const wave = Math.sin(mutation.zenPhase);
  const turnBias = THREE.MathUtils.clamp(
    ZEN_TURN_BASE + wave * ZEN_TURN_SWING,
    0.05,
    0.75
  );
  const direction = chooseGridDirection(Math.random() < turnBias);
  return advanceTile(direction);
};

export const generateTileForMode = (mode: GameMode): THREE.Vector3 => {
  switch (mode) {
    case 'classic':
      return generateClassicTile();
    case 'curved':
      return generateCurvedTiles().center;
    case 'spiral':
      return generateSpiralTile();
    case 'gravity':
      return generateGravityTile();
    case 'speedrush':
      return generateSpeedRushTile();
    case 'zen':
      return generateZenTile();
    default:
      return generateClassicTile();
  }
};
