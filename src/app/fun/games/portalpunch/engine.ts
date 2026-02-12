import * as THREE from 'three';
import type {
  BeamState,
  BeamTrace,
  Dir,
  Entity,
  GridPos,
  LaserSolveResult,
  PhaseId,
  PortalEntity,
  PortalPunchLevel,
  PortalPunchRuntime,
  ResolvedEntity,
  TargetEntity,
  TargetHit,
} from './types';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y_AXIS = V3(0, 1, 0);

const CELL_SIZE = 1;
const LASER_HEIGHT = 0.44;
const STEP_SIZE = 0.24;
const EPS = 0.04;
const MAX_STEPS = 560;
const MAX_BOUNCES = 48;
const MAX_DEPTH = 18;
const SIMULATED_C = 100;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const keyOf = (x: number, y: number) => `${x},${y}`;

const vecTuple = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];

const yawForDir = (dir: Dir) => {
  if (dir === 'E') return 0;
  if (dir === 'N') return Math.PI * 0.5;
  if (dir === 'W') return Math.PI;
  return -Math.PI * 0.5;
};

export const dirToVec3 = (dir: Dir): THREE.Vector3 => {
  if (dir === 'N') return V3(0, 0, -1);
  if (dir === 'E') return V3(1, 0, 0);
  if (dir === 'S') return V3(0, 0, 1);
  return V3(-1, 0, 0);
};

const sanitizeDir = (dir: THREE.Vector3) => {
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) {
    dir.set(1, 0, 0);
  }
  return dir.normalize();
};

const rotateQuarter = (dir: THREE.Vector3, turn: number) => {
  const out = dir.clone().applyAxisAngle(Y_AXIS, turn * (Math.PI / 2));
  return sanitizeDir(out);
};

const phaseDiff = (a: number, b: number) => {
  const d = ((((a - b) % 360) + 540) % 360) - 180;
  return Math.abs(d);
};

export const gridToWorld = (level: PortalPunchLevel, pos: GridPos, y = LASER_HEIGHT) => {
  const ox = (level.grid.w - 1) * 0.5;
  const oz = (level.grid.h - 1) * 0.5;
  return V3((pos.x - ox) * CELL_SIZE, y, (pos.y - oz) * CELL_SIZE);
};

export const worldToGrid = (level: PortalPunchLevel, world: THREE.Vector3): GridPos => {
  const ox = (level.grid.w - 1) * 0.5;
  const oz = (level.grid.h - 1) * 0.5;
  return {
    x: Math.round(world.x / CELL_SIZE + ox),
    y: Math.round(world.z / CELL_SIZE + oz),
  };
};

export const inBounds = (level: PortalPunchLevel, pos: GridPos) =>
  pos.x >= 0 && pos.y >= 0 && pos.x < level.grid.w && pos.y < level.grid.h;

const resolveMovingPos = (entity: Entity, elapsed: number): GridPos => {
  if (!entity.moving) return { ...entity.pos };
  const offset = Math.sin(elapsed * entity.moving.speed + entity.moving.phase) * entity.moving.range;
  if (entity.moving.axis === 'x') {
    return { x: Math.round(entity.pos.x + offset), y: entity.pos.y };
  }
  return { x: entity.pos.x, y: Math.round(entity.pos.y + offset) };
};

const entityActiveInPhase = (entity: Entity, phase: PhaseId) => {
  if (!entity.phase || entity.phase === 'BOTH') return true;
  return entity.phase === phase;
};

const priority = (entity: Entity) => {
  switch (entity.type) {
    case 'WALL':
      return 0;
    case 'GATE':
      return 1;
    case 'PORTAL':
      return 2;
    case 'MIRROR':
      return 3;
    case 'PRISM':
      return 4;
    case 'FILTER':
    case 'POLARIZER':
    case 'LENS':
    case 'PHASE_SHIFTER':
      return 5;
    case 'RECEPTOR':
      return 6;
    case 'TARGET':
      return 7;
    default:
      return 8;
  }
};

export const resolveEntities = (
  level: PortalPunchLevel,
  runtime: PortalPunchRuntime
): ResolvedEntity[] => {
  return level.entities
    .map((entity) => {
      const resolvedPos = resolveMovingPos(entity, runtime.elapsed);
      if (!inBounds(level, resolvedPos)) return null;

      if (entity.type === 'MIRROR') {
        const orientation = runtime.mirrors[entity.id] ?? entity.orientation;
        return {
          ...entity,
          orientation,
          resolvedPos,
        } as ResolvedEntity;
      }

      if (entity.type === 'PRISM') {
        const orientation = runtime.prisms[entity.id] ?? entity.orientation ?? 0;
        return {
          ...entity,
          orientation,
          resolvedPos,
        } as ResolvedEntity;
      }

      return {
        ...entity,
        resolvedPos,
      } as ResolvedEntity;
    })
    .filter((entity): entity is ResolvedEntity => Boolean(entity));
};

const buildCellMap = (entities: ResolvedEntity[]) => {
  const map = new Map<string, ResolvedEntity[]>();
  for (const entity of entities) {
    const key = keyOf(entity.resolvedPos.x, entity.resolvedPos.y);
    const arr = map.get(key);
    if (arr) arr.push(entity);
    else map.set(key, [entity]);
  }

  for (const arr of map.values()) {
    arr.sort((a, b) => priority(a) - priority(b));
  }

  return map;
};

const lookupPortal = (entities: ResolvedEntity[], id: string): ResolvedEntity<PortalEntity> | null => {
  const portal = entities.find((entity) => entity.type === 'PORTAL' && entity.id === id);
  return (portal as ResolvedEntity<PortalEntity> | undefined) ?? null;
};

const evaluateTarget = (target: TargetEntity, hits: TargetHit[]) => {
  if (hits.length === 0) return false;

  if (target.requiredHits != null && hits.length < target.requiredHits) {
    return false;
  }

  if (target.requiredColors && target.requiredColors.length > 0) {
    const present = new Set(hits.map((hit) => hit.color));
    for (const color of target.requiredColors) {
      if (!present.has(color)) return false;
    }
  }

  if (target.requiredIntensity != null) {
    const sum = hits.reduce((acc, hit) => acc + hit.intensity, 0);
    if (sum < target.requiredIntensity) return false;
  }

  if (target.requiredPhase != null) {
    const ok = hits.some((hit) => phaseDiff(hit.phase, target.requiredPhase ?? 0) <= 12);
    if (!ok) return false;
  }

  if (target.requiredWavelengthMax != null) {
    const ok = hits.some((hit) => hit.wavelength <= target.requiredWavelengthMax!);
    if (!ok) return false;
  }

  return true;
};

const commitTrace = (
  traces: BeamTrace[],
  id: string,
  points: [number, number, number][],
  color: BeamState['color'],
  intensity: number,
  width: number
) => {
  if (points.length < 2) return;

  traces.push({
    id,
    points,
    color,
    intensity,
    width,
  });
};

export const solveLaser = (
  level: PortalPunchLevel,
  runtime: PortalPunchRuntime
): LaserSolveResult => {
  const traces: BeamTrace[] = [];
  const hits: TargetHit[] = [];
  const receptorHits = new Set<string>();
  const gateTriggers: Record<string, number> = {};
  const solvedTargets = new Set<string>();

  const resolved = resolveEntities(level, runtime);
  const cellMap = buildCellMap(resolved);

  const beams: BeamState[] = [
    {
      id: 'beam_0',
      pos: vecTuple(gridToWorld(level, level.source.pos)),
      dir: vecTuple(dirToVec3(level.source.dir)),
      color: level.source.color,
      intensity: level.source.intensity,
      phase: level.source.phase,
      wavelength: level.source.wavelength,
      width: level.source.width,
      polarization: level.source.polarization,
      depth: 0,
      bounces: 0,
    },
  ];

  let beamNonce = 1;

  while (beams.length > 0) {
    const beam = beams.shift()!;
    if (beam.depth > MAX_DEPTH) continue;

    let pos = V3(beam.pos[0], beam.pos[1], beam.pos[2]);
    let dir = sanitizeDir(V3(beam.dir[0], beam.dir[1], beam.dir[2]));
    let color = beam.color;
    let intensity = beam.intensity;
    let phase = beam.phase;
    let wavelength = beam.wavelength;
    let width = beam.width;
    let polarization = beam.polarization;
    let bounces = beam.bounces;

    const tracePoints: [number, number, number][] = [vecTuple(pos)];
    let terminated = false;

    for (let step = 0; step < MAX_STEPS && !terminated; step += 1) {
      for (const entity of resolved) {
        if (entity.type !== 'GRAVITY_NODE') continue;
        if (!entityActiveInPhase(entity, runtime.phase)) continue;
        const gPos = gridToWorld(level, entity.resolvedPos);
        const toNode = gPos.clone().sub(pos);
        const dist = toNode.length();
        if (dist <= 0.001 || dist > entity.radius) continue;
        const pull = (entity.mass / (dist * dist)) * 0.018;
        dir.add(toNode.normalize().multiplyScalar(pull));
        sanitizeDir(dir);
      }

      const next = pos.clone().addScaledVector(dir, STEP_SIZE);
      tracePoints.push(vecTuple(next));

      const prevCell = worldToGrid(level, pos);
      const nextCell = worldToGrid(level, next);
      if (!inBounds(level, nextCell)) {
        pos = next;
        terminated = true;
        break;
      }

      if (prevCell.x === nextCell.x && prevCell.y === nextCell.y) {
        pos = next;
        continue;
      }

      const entities = cellMap.get(keyOf(nextCell.x, nextCell.y)) ?? [];
      if (entities.length === 0) {
        pos = next;
        continue;
      }

      let consumedCell = false;

      for (const entity of entities) {
        if (!entityActiveInPhase(entity, runtime.phase)) continue;

        if (entity.type === 'WALL') {
          consumedCell = true;
          terminated = true;
          pos = next;
          break;
        }

        if (entity.type === 'GATE') {
          const timer = runtime.gateTimers[entity.id] ?? 0;
          const open = entity.openByDefault || timer > 0;
          if (!open) {
            consumedCell = true;
            terminated = true;
            pos = next;
            break;
          }
          continue;
        }

        if (entity.type === 'MIRROR') {
          const center = gridToWorld(level, entity.resolvedPos);
          tracePoints[tracePoints.length - 1] = vecTuple(center);

          const normal =
            Math.abs(entity.orientation) % 2 === 0
              ? V3(1, 0, 1).normalize()
              : V3(1, 0, -1).normalize();

          if (entity.mode === 'VELOCITY' && entity.oscillation) {
            const w = entity.oscillation.frequency;
            const t = runtime.elapsed;
            const v = entity.oscillation.amplitude * w * Math.cos(t * w);
            const vel = V3(
              entity.oscillation.axis === 'x' ? v : 0,
              entity.oscillation.axis === 'y' ? v : 0,
              entity.oscillation.axis === 'z' ? v : 0
            );
            const relative = vel.dot(dir);
            wavelength = clamp(wavelength * (1 - relative / SIMULATED_C), 360, 760);
          }

          dir.reflect(normal);
          sanitizeDir(dir);
          pos = center.clone().addScaledVector(dir, EPS);
          bounces += 1;
          if (bounces > MAX_BOUNCES) {
            terminated = true;
          }
          consumedCell = true;
          break;
        }

        if (entity.type === 'PORTAL') {
          const linked = lookupPortal(resolved, entity.linkId);
          if (!linked || !entityActiveInPhase(linked, runtime.phase)) {
            consumedCell = true;
            terminated = true;
            break;
          }

          const inCenter = gridToWorld(level, entity.resolvedPos);
          const outCenter = gridToWorld(level, linked.resolvedPos);
          tracePoints[tracePoints.length - 1] = vecTuple(inCenter);
          commitTrace(
            traces,
            beam.id,
            [...tracePoints],
            color,
            intensity,
            width
          );

          const inQ = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yawForDir(entity.facing));
          const outQ = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yawForDir(linked.facing));

          const localDir = dir.clone().applyQuaternion(inQ.clone().invert());
          const teleportedDir = sanitizeDir(localDir.applyQuaternion(outQ));
          dir.copy(teleportedDir);
          pos = outCenter.clone().addScaledVector(dir, EPS);

          bounces += 1;
          if (bounces > MAX_BOUNCES) {
            terminated = true;
          }

          traces.push({
            id: `${beam.id}_jump_${step}`,
            points: [vecTuple(inCenter), vecTuple(outCenter)],
            color,
            intensity: intensity * 0.6,
            width: Math.max(0.3, width * 0.8),
          });

          tracePoints.length = 0;
          tracePoints.push(vecTuple(outCenter));
          tracePoints.push(vecTuple(pos));
          consumedCell = true;
          break;
        }

        if (entity.type === 'PRISM') {
          const center = gridToWorld(level, entity.resolvedPos);
          tracePoints[tracePoints.length - 1] = vecTuple(center);
          commitTrace(
            traces,
            beam.id,
            [...tracePoints],
            color,
            intensity,
            width
          );

          const orientationOffset = ((entity.orientation ?? 0) % 4 + 4) % 4;
          const outputs =
            entity.outputs && entity.outputs.length > 0
              ? entity.outputs
              : [
                  { color: 'RED' as const, turn: -1 as const },
                  { color: 'BLUE' as const, turn: 1 as const },
                ];

          for (const output of outputs) {
            const turn = output.turn + orientationOffset;
            const branchDir = rotateQuarter(dir, turn);
            const branchPos = center.clone().addScaledVector(branchDir, EPS);
            beams.push({
              id: `${beam.id}_${beamNonce++}`,
              pos: vecTuple(branchPos),
              dir: vecTuple(branchDir),
              color: color === 'WHITE' ? output.color : color,
              intensity: intensity * (outputs.length >= 3 ? 0.46 : 0.62),
              phase,
              wavelength,
              width: width * 0.9,
              polarization,
              depth: beam.depth + 1,
              bounces: bounces + 1,
            });
          }

          terminated = true;
          consumedCell = true;
          break;
        }

        if (entity.type === 'FILTER') {
          if (color !== entity.passColor) {
            terminated = true;
            consumedCell = true;
            break;
          }
          intensity *= 0.9;
          pos = gridToWorld(level, entity.resolvedPos).addScaledVector(dir, EPS);
          consumedCell = true;
          break;
        }

        if (entity.type === 'POLARIZER') {
          const theta = ((polarization - entity.requiredAngle) * Math.PI) / 180;
          const factor = Math.pow(Math.cos(theta), 2);
          intensity *= factor;
          polarization = entity.requiredAngle;
          if (factor < 0.1) {
            terminated = true;
          } else {
            pos = gridToWorld(level, entity.resolvedPos).addScaledVector(dir, EPS);
          }
          consumedCell = true;
          break;
        }

        if (entity.type === 'LENS') {
          if (entity.subtype === 'CONVEX') {
            width *= 0.72;
            intensity *= 1.14;
          } else {
            width *= 1.25;
            intensity *= 0.84;
          }
          pos = gridToWorld(level, entity.resolvedPos).addScaledVector(dir, EPS);
          consumedCell = true;
          break;
        }

        if (entity.type === 'PHASE_SHIFTER') {
          phase = (phase + entity.phaseAdd + 3600) % 360;
          pos = gridToWorld(level, entity.resolvedPos).addScaledVector(dir, EPS);
          consumedCell = true;
          break;
        }

        if (entity.type === 'RECEPTOR') {
          receptorHits.add(entity.id);
          gateTriggers[entity.gateId] = Math.max(gateTriggers[entity.gateId] ?? 0, entity.duration);
          if (!entity.passThrough) {
            terminated = true;
          }
          pos = gridToWorld(level, entity.resolvedPos).addScaledVector(dir, EPS);
          consumedCell = true;
          break;
        }

        if (entity.type === 'TARGET') {
          hits.push({
            id: entity.id,
            color,
            intensity,
            phase,
            wavelength,
          });
          const absorb = entity.absorb ?? true;
          pos = gridToWorld(level, entity.resolvedPos).addScaledVector(dir, EPS);
          if (absorb) {
            terminated = true;
          }
          consumedCell = true;
          break;
        }
      }

      if (!consumedCell) {
        pos = next;
      }
    }

    commitTrace(traces, beam.id, tracePoints, color, intensity, width);
  }

  for (const targetId of level.objective.targetIds) {
    const target = resolved.find(
      (entity): entity is ResolvedEntity<TargetEntity> =>
        entity.type === 'TARGET' && entity.id === targetId
    );
    if (!target) continue;

    const targetHits = hits.filter((hit) => hit.id === target.id);
    if (evaluateTarget(target, targetHits)) {
      solvedTargets.add(target.id);
    }
  }

  return {
    traces,
    hits,
    receptorHits,
    gateTriggers,
    solvedTargets,
  };
};

export const canPlayerOccupy = (
  level: PortalPunchLevel,
  runtime: PortalPunchRuntime,
  entities: ResolvedEntity[],
  next: GridPos
) => {
  if (!inBounds(level, next)) return false;

  for (const entity of entities) {
    if (!entityActiveInPhase(entity, runtime.phase)) continue;
    if (entity.resolvedPos.x !== next.x || entity.resolvedPos.y !== next.y) continue;

    if (entity.type === 'WALL') return false;
    if (entity.type === 'GATE') {
      const timer = runtime.gateTimers[entity.id] ?? 0;
      const open = entity.openByDefault || timer > 0;
      if (!open) return false;
    }
  }

  return true;
};

export const findInteractableNearPlayer = (
  runtime: PortalPunchRuntime,
  entities: ResolvedEntity[]
): ResolvedEntity | null => {
  let best: { entity: ResolvedEntity; dist: number } | null = null;

  for (const entity of entities) {
    if (!entityActiveInPhase(entity, runtime.phase)) continue;

    if (entity.type !== 'MIRROR' && entity.type !== 'PRISM' && entity.type !== 'SWITCH') {
      continue;
    }

    if (entity.type === 'MIRROR' && !entity.interactable) continue;
    if (entity.type === 'PRISM' && !entity.interactable) continue;

    const d = Math.abs(entity.resolvedPos.x - runtime.player.x) +
      Math.abs(entity.resolvedPos.y - runtime.player.y);

    if (d > 1) continue;

    if (!best || d < best.dist) {
      best = { entity, dist: d };
    }
  }

  return best?.entity ?? null;
};
