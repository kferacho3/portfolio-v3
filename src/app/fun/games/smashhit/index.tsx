// @ts-nocheck
'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom } from '../../utils/seededRandom';
import { smashHitState } from './state';

export { smashHitState } from './state';

const COLS = 5;
const ROWS = 3;
const BLOCKS_PER_OBSTACLE = COLS * ROWS;

const MAX_OBSTACLES = 22;
const MAX_GLASS_BLOCKS = MAX_OBSTACLES * BLOCKS_PER_OBSTACLE;

const MAX_SHOTS = 22;
const MAX_SHARDS = 260;

const BLOCK_SIZE = 1.35;
const BLOCK_THICKNESS = 0.18;
const GLASS_OPACITY = 0.38;

const CORRIDOR_W = 9.6;
const CORRIDOR_H = 6.2;
const CORRIDOR_DEPTH = 240;

const START_Z = 8;
const START_SPAWN_Z = -18;

const GRAVITY = -14;

const SHOT_RADIUS = 0.16;
const SHOT_SPEED = 34;

const SHARD_LIFE = 0.7;

const SPACING_MIN = 12;
const SPACING_MAX = 18;

type Obstacle = {
  active: boolean;
  z: number;
  required: number[];
  passed: boolean;
  color: THREE.Color;
  crystalActive: boolean;
  crystalX: number;
  crystalY: number;
};

type Shot = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
};

type Shard = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  life: number;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothLerp(
  current: number,
  target: number,
  dt: number,
  speed: number
) {
  const t = 1 - Math.pow(0.001, dt * speed);
  return lerp(current, target, t);
}

function hslToColor(h: number, s: number, l: number) {
  const c = new THREE.Color();
  c.setHSL(h, s, l);
  return c;
}

function getSectionColor(distance: number) {
  // A smooth journey: icy blue -> violet -> warm red -> amber
  const t = clamp(distance / 520, 0, 1);
  const h = lerp(0.58, 0.05, t);
  const s = lerp(0.65, 0.75, t);
  const l = lerp(0.55, 0.58, t);
  return hslToColor(h, s, l);
}

const CELL_LOCAL_POS: Array<{ x: number; y: number }> = (() => {
  const arr: Array<{ x: number; y: number }> = [];
  const x0 = (COLS - 1) / 2;
  const y0 = (ROWS - 1) / 2;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = (c - x0) * BLOCK_SIZE;
      const y = (r - y0) * BLOCK_SIZE;
      arr.push({ x, y });
    }
  }
  return arr;
})();

function centerIndex() {
  const c = Math.floor(COLS / 2);
  const r = Math.floor(ROWS / 2);
  return r * COLS + c;
}

function requiredPattern(level: number, rng: SeededRandom): number[] {
  const ctr = centerIndex();
  const left = ctr - 1;
  const right = ctr + 1;
  const up = ctr - COLS;
  const down = ctr + COLS;

  if (level <= 0) return [ctr];
  if (level === 1) return rng.bool(0.5) ? [ctr, left] : [ctr, right];
  if (level === 2)
    return rng.bool(0.5)
      ? [ctr, left, right]
      : [ctr, up, down].filter((i) => i >= 0 && i < BLOCKS_PER_OBSTACLE);
  if (level === 3) {
    // 2x2 around center (clamped to grid)
    const r = Math.floor(ROWS / 2);
    const c = Math.floor(COLS / 2);
    const a = r * COLS + c;
    const b = r * COLS + clamp(c + 1, 0, COLS - 1);
    const d = clamp(r + 1, 0, ROWS - 1) * COLS + c;
    const e = clamp(r + 1, 0, ROWS - 1) * COLS + clamp(c + 1, 0, COLS - 1);
    return Array.from(new Set([a, b, d, e]));
  }

  // A spicier cross
  const base = [ctr, left, right, up, down].filter(
    (i) => i >= 0 && i < BLOCKS_PER_OBSTACLE
  );
  // Randomly drop one arm to keep it readable
  if (base.length > 3 && rng.bool(0.35))
    base.splice(1 + Math.floor(rng.float() * (base.length - 1)), 1);
  return base;
}

function makeShotDirection(pointerX: number, pointerY: number) {
  const dir = new THREE.Vector3(pointerX * 0.55, pointerY * 0.35, -1);
  dir.normalize();
  return dir;
}

function SmashHit() {
  const snap = useSnapshot(smashHitState);
  const { paused } = useGameUIState();
  const input = useInputRef();
  const { camera, scene } = useThree();

  const corridorRef = useRef<THREE.Mesh>(null);
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const crystalRef = useRef<THREE.InstancedMesh>(null);
  const shotsRef = useRef<THREE.InstancedMesh>(null);
  const shardsRef = useRef<THREE.InstancedMesh>(null);

  const world = useRef({
    rng: new SeededRandom(snap.worldSeed),
    dummy: new THREE.Object3D(),

    cameraZ: START_Z,
    baseSpeed: 10.5,
    distance: 0,
    nextSpawnZ: START_SPAWN_Z,

    obstacleCursor: 0,
    obstacles: Array.from(
      { length: MAX_OBSTACLES },
      (): Obstacle => ({
        active: false,
        z: 0,
        required: [],
        passed: false,
        color: new THREE.Color('#60a5fa'),
        crystalActive: false,
        crystalX: 0,
        crystalY: 0,
      })
    ),

    // Per glass block (alive = present and not broken)
    glassAlive: new Array<boolean>(MAX_GLASS_BLOCKS).fill(false),
    glassRequired: new Array<boolean>(MAX_GLASS_BLOCKS).fill(false),

    // Shot pool
    shots: Array.from(
      { length: MAX_SHOTS },
      (): Shot => ({
        active: false,
        pos: new THREE.Vector3(0, 0, 0),
        vel: new THREE.Vector3(0, 0, -1),
        life: 0,
      })
    ),
    shotCursor: 0,

    // Shards pool
    shards: Array.from(
      { length: MAX_SHARDS },
      (): Shard => ({
        active: false,
        pos: new THREE.Vector3(0, 0, 0),
        vel: new THREE.Vector3(0, 0, 0),
        rot: new THREE.Vector3(0, 0, 0),
        life: 0,
      })
    ),
    shardCursor: 0,

    // input edge tracking
    spaceWasDown: false,
  });

  const matPalette = useMemo(() => {
    return {
      corridor: new THREE.Color('#8bd3ff'),
      shot: new THREE.Color('#e5e7eb'),
      shard: new THREE.Color('#ffffff'),
      crystal: new THREE.Color('#facc15'),
    };
  }, []);

  const resetWorld = () => {
    const w = world.current;
    w.rng.reset(snap.worldSeed);
    w.cameraZ = START_Z;
    w.distance = 0;
    w.nextSpawnZ = START_SPAWN_Z;
    w.obstacleCursor = 0;

    // clear pools
    w.glassAlive.fill(false);
    w.glassRequired.fill(false);
    w.shots.forEach((s) => {
      s.active = false;
      s.life = 0;
      s.pos.set(0, 0, 0);
    });
    w.shards.forEach((p) => {
      p.active = false;
      p.life = 0;
      p.pos.set(0, 0, 0);
    });

    w.obstacles.forEach((o) => {
      o.active = false;
      o.passed = false;
      o.required = [];
      o.crystalActive = false;
      o.z = 0;
    });

    // hide all instances
    if (glassRef.current) {
      for (let i = 0; i < MAX_GLASS_BLOCKS; i += 1) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        glassRef.current.setMatrixAt(i, w.dummy.matrix);
        glassRef.current.setColorAt(i, new THREE.Color('#60a5fa'));
      }
      glassRef.current.instanceMatrix.needsUpdate = true;
      if (glassRef.current.instanceColor)
        glassRef.current.instanceColor.needsUpdate = true;
    }

    if (crystalRef.current) {
      for (let i = 0; i < MAX_OBSTACLES; i += 1) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        crystalRef.current.setMatrixAt(i, w.dummy.matrix);
        crystalRef.current.setColorAt(i, matPalette.crystal);
      }
      crystalRef.current.instanceMatrix.needsUpdate = true;
      if (crystalRef.current.instanceColor)
        crystalRef.current.instanceColor.needsUpdate = true;
    }

    if (shotsRef.current) {
      for (let i = 0; i < MAX_SHOTS; i += 1) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        shotsRef.current.setMatrixAt(i, w.dummy.matrix);
      }
      shotsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (shardsRef.current) {
      for (let i = 0; i < MAX_SHARDS; i += 1) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        shardsRef.current.setMatrixAt(i, w.dummy.matrix);
        shardsRef.current.setColorAt(i, matPalette.shard);
      }
      shardsRef.current.instanceMatrix.needsUpdate = true;
      if (shardsRef.current.instanceColor)
        shardsRef.current.instanceColor.needsUpdate = true;
    }

    // baseline camera + fog
    camera.position.set(0, 0, START_Z);
    camera.lookAt(0, 0, START_Z - 5);
    scene.fog = new THREE.Fog('#d7f2ff', 14, 95);
  };

  const spawnObstacle = () => {
    const w = world.current;
    const oIndex = w.obstacleCursor % MAX_OBSTACLES;
    const obstacle = w.obstacles[oIndex];

    obstacle.active = true;
    obstacle.passed = false;
    obstacle.z = w.nextSpawnZ;
    obstacle.color = getSectionColor(w.distance);

    const difficulty = Math.floor(w.distance / 160);
    obstacle.required = requiredPattern(difficulty, w.rng);

    // Crystal roughly every 3 obstacles
    obstacle.crystalActive = w.rng.bool(0.32);
    obstacle.crystalX = w.rng.float(-1.2, 1.2);
    obstacle.crystalY = w.rng.float(-0.8, 0.8);

    // Decide which blocks are present
    const holeChance = clamp(0.14 + difficulty * 0.03, 0.14, 0.42);

    for (let b = 0; b < BLOCKS_PER_OBSTACLE; b += 1) {
      const gIndex = oIndex * BLOCKS_PER_OBSTACLE + b;
      const isRequired = obstacle.required.includes(b);
      w.glassRequired[gIndex] = isRequired;

      // required blocks must exist; other blocks may be pre-missing
      const alive = isRequired ? true : !w.rng.bool(holeChance);
      w.glassAlive[gIndex] = alive;

      if (glassRef.current) {
        if (alive) {
          const lp = CELL_LOCAL_POS[b];
          w.dummy.position.set(lp.x, lp.y, obstacle.z);
          w.dummy.rotation.set(0, 0, 0);
          w.dummy.scale.set(1, 1, 1);
          w.dummy.updateMatrix();
          glassRef.current.setMatrixAt(gIndex, w.dummy.matrix);

          // Required blocks get a slightly warmer tint
          const c = obstacle.color.clone();
          if (isRequired) c.lerp(new THREE.Color('#ffffff'), 0.15);
          glassRef.current.setColorAt(gIndex, c);
        } else {
          w.dummy.position.set(0, -9999, 0);
          w.dummy.scale.set(0.0001, 0.0001, 0.0001);
          w.dummy.updateMatrix();
          glassRef.current.setMatrixAt(gIndex, w.dummy.matrix);
        }
      }
    }

    if (glassRef.current) {
      glassRef.current.instanceMatrix.needsUpdate = true;
      if (glassRef.current.instanceColor)
        glassRef.current.instanceColor.needsUpdate = true;
    }

    // Update crystal instance
    if (crystalRef.current) {
      if (obstacle.crystalActive) {
        w.dummy.position.set(
          obstacle.crystalX,
          obstacle.crystalY,
          obstacle.z - 2.2
        );
        w.dummy.rotation.set(Math.PI / 4, Math.PI / 4, 0);
        w.dummy.scale.set(1, 1, 1);
        w.dummy.updateMatrix();
        crystalRef.current.setMatrixAt(oIndex, w.dummy.matrix);
        crystalRef.current.setColorAt(oIndex, matPalette.crystal);
      } else {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        crystalRef.current.setMatrixAt(oIndex, w.dummy.matrix);
      }
      crystalRef.current.instanceMatrix.needsUpdate = true;
      if (crystalRef.current.instanceColor)
        crystalRef.current.instanceColor.needsUpdate = true;
    }

    w.obstacleCursor += 1;
    w.nextSpawnZ -= w.rng.float(SPACING_MIN, SPACING_MAX);
  };

  const breakBlock = (
    oIndex: number,
    blockIndex: number,
    hitPos: THREE.Vector3
  ) => {
    const w = world.current;
    const gIndex = oIndex * BLOCKS_PER_OBSTACLE + blockIndex;
    if (!w.glassAlive[gIndex]) return;

    w.glassAlive[gIndex] = false;

    // hide instance
    if (glassRef.current) {
      w.dummy.position.set(0, -9999, 0);
      w.dummy.scale.set(0.0001, 0.0001, 0.0001);
      w.dummy.updateMatrix();
      glassRef.current.setMatrixAt(gIndex, w.dummy.matrix);
      glassRef.current.instanceMatrix.needsUpdate = true;
    }

    // score + combo
    const wasRequired = w.glassRequired[gIndex];
    if (wasRequired) {
      smashHitState.combo += 1;
      smashHitState.addScore(35 + smashHitState.combo * 3);
    } else {
      // tiny reward for breaking non-required glass
      smashHitState.addScore(4);
    }

    // spawn shards
    for (let i = 0; i < 10; i += 1) {
      const shard = w.shards[w.shardCursor % MAX_SHARDS];
      shard.active = true;
      shard.life = SHARD_LIFE * (0.6 + w.rng.float() * 0.8);
      shard.pos.copy(hitPos);
      shard.vel.set(w.rng.float(-4, 4), w.rng.float(-4, 4), w.rng.float(-6, 1));
      shard.rot.set(
        w.rng.float(0, Math.PI),
        w.rng.float(0, Math.PI),
        w.rng.float(0, Math.PI)
      );
      w.shardCursor += 1;
    }
  };

  const fireShot = () => {
    if (snap.phase !== 'playing') return;
    if (!smashHitState.useBall()) return;

    const w = world.current;
    const shot = w.shots[w.shotCursor % MAX_SHOTS];
    const dir = makeShotDirection(input.pointerX, input.pointerY);

    shot.active = true;
    shot.life = 1.8;
    shot.pos.set(camera.position.x, camera.position.y, camera.position.z - 0.6);
    shot.vel.copy(dir).multiplyScalar(SHOT_SPEED);

    w.shotCursor += 1;
  };

  useEffect(() => {
    smashHitState.loadBest();
  }, []);

  useEffect(() => {
    resetWorld();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.worldSeed]);

  useFrame((_, dt) => {
    const w = world.current;
    const inputState = input.current;

    const spaceDown = inputState.keysDown.has(' ');
    const spaceJustDown = spaceDown && !w.spaceWasDown;
    w.spaceWasDown = spaceDown;

    const tap = inputState.pointerJustDown || spaceJustDown;

    if (tap) {
      if (snap.phase === 'menu' || snap.phase === 'gameover') {
        smashHitState.startGame();
      } else {
        fireShot();
      }
    }
    clearFrameInput(input);

    if (paused) return;

    // Animate corridor tint based on distance
    const sectionColor = getSectionColor(w.distance);
    if (corridorRef.current) {
      const mat = corridorRef.current.material as THREE.MeshStandardMaterial;
      mat.color.copy(sectionColor).lerp(new THREE.Color('#ffffff'), 0.55);
      mat.emissive.copy(sectionColor).multiplyScalar(0.08);
    }

    if (snap.phase === 'playing') {
      // forward motion
      const speed = w.baseSpeed + Math.min(9.5, snap.score * 0.012);
      w.cameraZ -= speed * dt;
      w.distance = START_Z - w.cameraZ;

      // base score from distance, but keep additive points from breaks
      const baseScore = Math.floor(w.distance * 2.0);
      if (baseScore > smashHitState.score) smashHitState.score = baseScore;

      // spawn ahead
      const spawnAhead = w.cameraZ - 120;
      while (w.nextSpawnZ > spawnAhead) spawnObstacle();

      // collision: camera reaches obstacles
      for (let oIndex = 0; oIndex < MAX_OBSTACLES; oIndex += 1) {
        const o = w.obstacles[oIndex];
        if (!o.active || o.passed) continue;

        // When camera reaches the panel plane...
        if (w.cameraZ < o.z + 0.55) {
          let cleared = true;
          for (const req of o.required) {
            const gIndex = oIndex * BLOCKS_PER_OBSTACLE + req;
            if (w.glassAlive[gIndex]) {
              cleared = false;
              break;
            }
          }
          if (!cleared) {
            smashHitState.endGame();
            break;
          }
          o.passed = true;
          smashHitState.combo = Math.max(0, smashHitState.combo - 1);
        }
      }

      // update camera
      const swayX = inputState.pointerX * 0.3;
      const swayY = inputState.pointerY * 0.18;
      camera.position.x = smoothLerp(camera.position.x, swayX, dt, 6);
      camera.position.y = smoothLerp(camera.position.y, swayY, dt, 6);
      camera.position.z = w.cameraZ;
      camera.lookAt(0, 0, w.cameraZ - 12);

      // keep corridor around camera
      if (corridorRef.current)
        corridorRef.current.position.z = w.cameraZ - CORRIDOR_DEPTH / 2;

      // shots update
      if (shotsRef.current) {
        for (let i = 0; i < MAX_SHOTS; i += 1) {
          const s = w.shots[i];
          if (!s.active) {
            w.dummy.position.set(0, -9999, 0);
            w.dummy.scale.set(0.0001, 0.0001, 0.0001);
            w.dummy.updateMatrix();
            shotsRef.current.setMatrixAt(i, w.dummy.matrix);
            continue;
          }

          s.life -= dt;
          if (s.life <= 0) {
            s.active = false;
            continue;
          }

          // integrate
          s.pos.addScaledVector(s.vel, dt);

          // kill if too far ahead
          if (s.pos.z < w.cameraZ - 140) {
            s.active = false;
            continue;
          }

          // collision with crystals + glass blocks
          for (let oIndex = 0; oIndex < MAX_OBSTACLES; oIndex += 1) {
            const o = w.obstacles[oIndex];
            if (!o.active) continue;

            // crystal
            if (o.crystalActive) {
              const cx = o.crystalX;
              const cy = o.crystalY;
              const cz = o.z - 2.2;
              const dx = s.pos.x - cx;
              const dy = s.pos.y - cy;
              const dz = s.pos.z - cz;
              if (
                dx * dx + dy * dy + dz * dz <
                (SHOT_RADIUS + 0.22) * (SHOT_RADIUS + 0.22)
              ) {
                o.crystalActive = false;
                smashHitState.addBalls(3);
                smashHitState.addScore(80);
                smashHitState.combo += 2;

                // hide crystal instance
                if (crystalRef.current) {
                  w.dummy.position.set(0, -9999, 0);
                  w.dummy.scale.set(0.0001, 0.0001, 0.0001);
                  w.dummy.updateMatrix();
                  crystalRef.current.setMatrixAt(oIndex, w.dummy.matrix);
                  crystalRef.current.instanceMatrix.needsUpdate = true;
                }

                // shards burst
                for (let k = 0; k < 14; k += 1) {
                  const shard = w.shards[w.shardCursor % MAX_SHARDS];
                  shard.active = true;
                  shard.life = SHARD_LIFE * (0.6 + w.rng.float() * 0.8);
                  shard.pos.set(cx, cy, cz);
                  shard.vel.set(
                    w.rng.float(-5, 5),
                    w.rng.float(-5, 5),
                    w.rng.float(-6, 2)
                  );
                  shard.rot.set(
                    w.rng.float(0, Math.PI),
                    w.rng.float(0, Math.PI),
                    w.rng.float(0, Math.PI)
                  );
                  w.shardCursor += 1;
                }

                s.active = false;
                break;
              }
            }

            // glass plane proximity check
            if (Math.abs(s.pos.z - o.z) > BLOCK_THICKNESS * 1.2 + SHOT_RADIUS)
              continue;

            // test blocks
            const half = BLOCK_SIZE * 0.5;
            for (let b = 0; b < BLOCKS_PER_OBSTACLE; b += 1) {
              const gIndex = oIndex * BLOCKS_PER_OBSTACLE + b;
              if (!w.glassAlive[gIndex]) continue;

              const lp = CELL_LOCAL_POS[b];
              if (
                Math.abs(s.pos.x - lp.x) < half + SHOT_RADIUS &&
                Math.abs(s.pos.y - lp.y) < half + SHOT_RADIUS
              ) {
                // hit!
                breakBlock(oIndex, b, new THREE.Vector3(lp.x, lp.y, o.z));
                s.active = false;
                break;
              }
            }
            if (!s.active) break;
          }

          if (s.active) {
            w.dummy.position.copy(s.pos);
            w.dummy.scale.set(1, 1, 1);
            w.dummy.updateMatrix();
            shotsRef.current.setMatrixAt(i, w.dummy.matrix);
          }
        }
        shotsRef.current.instanceMatrix.needsUpdate = true;
      }

      // shards update
      if (shardsRef.current) {
        for (let i = 0; i < MAX_SHARDS; i += 1) {
          const p = w.shards[i];
          if (!p.active) {
            w.dummy.position.set(0, -9999, 0);
            w.dummy.scale.set(0.0001, 0.0001, 0.0001);
            w.dummy.updateMatrix();
            shardsRef.current.setMatrixAt(i, w.dummy.matrix);
            continue;
          }
          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            continue;
          }

          p.vel.y += GRAVITY * 0.1 * dt;
          p.pos.addScaledVector(p.vel, dt);
          p.rot.x += dt * 4;
          p.rot.y += dt * 3;

          w.dummy.position.copy(p.pos);
          w.dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
          w.dummy.scale.set(1, 1, 1);
          w.dummy.updateMatrix();
          shardsRef.current.setMatrixAt(i, w.dummy.matrix);
        }
        shardsRef.current.instanceMatrix.needsUpdate = true;
      }

      // If out of balls, your combo drains (pressure)
      if (smashHitState.balls <= 0) {
        smashHitState.combo = Math.max(0, smashHitState.combo - dt * 2);
      }
    }
  });

  return (
    <group>
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 12, 8]} intensity={0.9} />
      <pointLight position={[-6, 2, 2]} intensity={0.6} />

      <mesh ref={corridorRef} position={[0, 0, START_Z - CORRIDOR_DEPTH / 2]}>
        <boxGeometry args={[CORRIDOR_W, CORRIDOR_H, CORRIDOR_DEPTH]} />
        <meshStandardMaterial
          side={THREE.BackSide}
          color={matPalette.corridor}
          roughness={0.85}
          metalness={0.0}
        />
      </mesh>

      <instancedMesh
        ref={glassRef}
        args={[undefined, undefined, MAX_GLASS_BLOCKS]}
      >
        <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_THICKNESS]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={GLASS_OPACITY}
          roughness={0.15}
          metalness={0.05}
        />
      </instancedMesh>

      <instancedMesh
        ref={crystalRef}
        args={[undefined, undefined, MAX_OBSTACLES]}
      >
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial vertexColors roughness={0.25} metalness={0.25} />
      </instancedMesh>

      <instancedMesh ref={shotsRef} args={[undefined, undefined, MAX_SHOTS]}>
        <sphereGeometry args={[SHOT_RADIUS, 14, 14]} />
        <meshStandardMaterial
          color={matPalette.shot}
          roughness={0.15}
          metalness={0.95}
        />
      </instancedMesh>

      <instancedMesh ref={shardsRef} args={[undefined, undefined, MAX_SHARDS]}>
        <boxGeometry args={[0.12, 0.06, 0.02]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.55}
          roughness={0.25}
          metalness={0.05}
        />
      </instancedMesh>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: 'white',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            textShadow: '0 2px 10px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.85, letterSpacing: 1 }}>
            SMASH HIT
          </div>
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snap.score}</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Balls: {snap.balls} • Combo: {Math.floor(snap.combo)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.55 }}>Best: {snap.best}</div>
        </div>

        {(snap.phase === 'menu' || snap.phase === 'gameover') && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 420,
                padding: 20,
                borderRadius: 18,
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.18)',
                textAlign: 'center',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 2 }}>
                SMASH HIT
              </div>
              <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9 }}>
                Click / Tap / Space to throw • Clear the highlighted glass cells
                to survive
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                Hit the gold crystals for +3 balls.
              </div>

              {snap.phase === 'gameover' && (
                <div style={{ marginTop: 14, fontSize: 14 }}>
                  <div style={{ fontWeight: 800 }}>Shattered.</div>
                  <div style={{ opacity: 0.85 }}>Score: {snap.score}</div>
                </div>
              )}

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.6 }}>
                Pro tip: hold your fire until you see the “required” blocks
                (slightly brighter).
              </div>
            </div>
          </div>
        )}

        {/* crosshair */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
            border: '2px solid rgba(255,255,255,0.75)',
            borderRadius: 999,
            boxShadow: '0 0 18px rgba(255,255,255,0.25)',
          }}
        />
      </Html>
    </group>
  );
}

export default SmashHit;
