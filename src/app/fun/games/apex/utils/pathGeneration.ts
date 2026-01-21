import * as THREE from 'three';
import {
  CLASSIC_TURN_CHANCE,
  CURVE_BASE_CURVATURE,
  CURVE_BOUNDARY_GAIN,
  CURVE_BOUNDARY_HARD,
  CURVE_BOUNDARY_SOFT,
  CURVE_CENTER_PULL,
  CURVE_DAMPING,
  CURVE_FORWARD_BIAS,
  CURVE_LANE_OFFSET,
  CURVE_MAX_YAW,
  CURVE_SEGMENT_RANGE,
  CURVE_SEGMENT_SHORT_RANGE,
  CURVE_SELF_INTERSECTION_DISTANCE,
  CURVE_SPRING,
  CURVE_TILE_STEP,
  DIRECTIONS,
  GRAVITY_TURN_BASE,
  GRAVITY_TURN_SWING,
  GRAVITY_WAVE_AMPLITUDE,
  GRAVITY_WAVE_FREQUENCY,
  GRAVITY_WAVE_HEIGHT_MULTIPLIER,
  MAX_DIVERGENCE,
  SPEEDRUSH_FORWARD_CHANCE,
  SPIRAL_FORWARD_DRIFT,
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
  const minDistSq = CURVE_SELF_INTERSECTION_DISTANCE * CURVE_SELF_INTERSECTION_DISTANCE;

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
  const boundaryForce =
    THREE.MathUtils.clamp(Math.abs(pos.x) / CURVE_BOUNDARY_HARD, 0, 1) * Math.sign(pos.x);
  const targetCurvature = directionSign * CURVE_BASE_CURVATURE - boundaryForce * CURVE_BOUNDARY_GAIN;

  curvatureVel += (targetCurvature - curvature) * CURVE_SPRING * step;
  curvatureVel *= Math.exp(-CURVE_DAMPING * step);
  curvature += curvatureVel * step;

  theta += curvature * step;
  theta = THREE.MathUtils.damp(theta, 0, CURVE_FORWARD_BIAS, step);
  theta = THREE.MathUtils.clamp(theta, -CURVE_MAX_YAW, CURVE_MAX_YAW);

  const tangent = tempTangent.set(Math.sin(theta), 0, -Math.cos(theta));
  const normal = tempNormal.set(-tangent.z, 0, tangent.x);
  pos.addScaledVector(tangent, step);
  pos.x = THREE.MathUtils.damp(pos.x, 0, CURVE_CENTER_PULL, step);
  pos.y = -TILE_DEPTH / 2;

  return { theta, curvature, curvatureVel, tangent, normal };
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

const advanceTile = (direction: THREE.Vector3, y = -TILE_DEPTH / 2, step = TILE_SIZE) => {
  const nextPos = tempPos.copy(mutation.lastTilePos).addScaledVector(direction, step);
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
    mutation.pathCurveSegmentRemaining = THREE.MathUtils.randInt(
      CURVE_SEGMENT_RANGE[0],
      CURVE_SEGMENT_RANGE[1]
    );
    mutation.pathCurveDirection = mutation.pathCurveDirection === 0 ? 1 : mutation.pathCurveDirection * -1;
  }

  const nearYawLimit = Math.abs(mutation.pathCurveTheta) > CURVE_MAX_YAW * 0.92;
  if (nearYawLimit) {
    mutation.pathCurveDirection *= -1;
    mutation.pathCurveSegmentRemaining = THREE.MathUtils.randInt(
      CURVE_SEGMENT_SHORT_RANGE[0],
      CURVE_SEGMENT_SHORT_RANGE[1]
    );
  }

  if (Math.abs(mutation.lastTilePos.x) > CURVE_BOUNDARY_SOFT) {
    mutation.pathCurveDirection = mutation.lastTilePos.x > 0 ? -1 : 1;
    mutation.pathCurveSegmentRemaining = THREE.MathUtils.randInt(
      CURVE_SEGMENT_SHORT_RANGE[0],
      CURVE_SEGMENT_SHORT_RANGE[1]
    );
  }

  const prevPos = mutation.lastTilePos.clone();
  const prevTheta = mutation.pathCurveTheta;
  const prevCurvature = mutation.pathCurveCurvature;
  const prevCurvatureVel = mutation.pathCurveCurvatureVel;

  let result = advanceCurvedState(
    mutation.lastTilePos,
    mutation.pathCurveTheta,
    mutation.pathCurveCurvature,
    mutation.pathCurveCurvatureVel,
    mutation.pathCurveDirection,
    CURVE_TILE_STEP
  );

  let center = mutation.lastTilePos.clone();
  if (Math.abs(center.x) > CURVE_BOUNDARY_HARD || isCurvePosTooClose(center)) {
    mutation.lastTilePos.copy(prevPos);
    mutation.pathCurveTheta = prevTheta;
    mutation.pathCurveCurvature = prevCurvature;
    mutation.pathCurveCurvatureVel = prevCurvatureVel;
    mutation.pathCurveDirection *= -1;
    mutation.pathCurveSegmentRemaining = THREE.MathUtils.randInt(
      CURVE_SEGMENT_SHORT_RANGE[0],
      CURVE_SEGMENT_SHORT_RANGE[1]
    );

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

  const left = center.clone().addScaledVector(result.normal, CURVE_LANE_OFFSET);
  const right = center.clone().addScaledVector(result.normal, -CURVE_LANE_OFFSET);
  const rotationY = Math.atan2(result.tangent.x, result.tangent.z);

  return { center, left, right, rotationY };
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

  const tangent = tempTangent.set(-radial.z, 0, radial.x);
  tangent.multiplyScalar(mutation.pathSpiralDirection * SPIRAL_TURN_RATE);

  let radialBias = -SPIRAL_INWARD_DRIFT;
  if (radius < SPIRAL_MIN_RADIUS) {
    radialBias = SPIRAL_OUTWARD_DRIFT;
  } else if (radius > SPIRAL_MAX_RADIUS) {
    radialBias = -SPIRAL_INWARD_DRIFT * SPIRAL_OUTER_PULL;
  }

  const direction = tangent.add(radial.multiplyScalar(radialBias));
  direction.z -= SPIRAL_FORWARD_DRIFT;
  direction.normalize();
  const nextPos = tempPos.copy(mutation.lastTilePos).addScaledVector(direction, TILE_SIZE);
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
    Math.sin(mutation.gravityPhase * GRAVITY_WAVE_HEIGHT_MULTIPLIER) * GRAVITY_WAVE_AMPLITUDE;
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
  const turnBias = THREE.MathUtils.clamp(ZEN_TURN_BASE + wave * ZEN_TURN_SWING, 0.05, 0.75);
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
