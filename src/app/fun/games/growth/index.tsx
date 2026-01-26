import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Html } from '@react-three/drei';
import { useSnapshot } from 'valtio';

import { useInputRef, clearFrameInput } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';

import { growthState, growthSkins } from './state';
import CharacterSelection from './_components/CharacterSelection';

export { growthState } from './state';

type Segment = {
  z: number;
  obstacleFace: number; // 0..3
  obstacleKind: 0 | 1; // 0 pillar, 1 spike
  gemFace: number; // 0..3
  gemActive: boolean;
  branchGrowth: number; // 0..1, grows over time
  branchTargetSize: number; // 0..1, random target size
  branchGrowthSpeed: number; // growth rate
  spawnTime: number; // when segment was spawned
};

const TAU = Math.PI * 2;
const QUARTER = Math.PI / 2;

// Aesthetic + scale (tuned to resemble the isometric, soft-lit screenshots)
const BEAM_SIZE = 1.0;
const BEAM_HALF = BEAM_SIZE / 2;
const SEGMENT_LEN = 1.0;
const SEGMENTS = 120;
const TRACK_LENGTH = SEGMENTS * SEGMENT_LEN;

const PLAYER_RADIUS = 0.18;
const PLAYER_HOVER = 0.12;

const OB_PILLAR_R = 0.24;
const OB_PILLAR_H = 0.65;

const OB_SPIKE_R = 0.24;
const OB_SPIKE_H = 0.75;

const GEM_R = 0.17;

const COLLISION_Z = 0.38;

// Speed progression
const BASE_SPEED = 2.4;
const MAX_SPEED = 6.5; // Cap for playability
const SPEED_RAMP = 0.003; // Speed increase per score point

// Branch growth
const BRANCH_MIN_SIZE = 0.1;
const BRANCH_MAX_SIZE = 1.0;
const BRANCH_GROWTH_SPEED_MIN = 0.8; // seconds to fully grow
const BRANCH_GROWTH_SPEED_MAX = 2.5;
const CLOSE_CALL_CHANCE = 0.25; // 25% chance of close call growth

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function wrapAngle(a: number) {
  // keep angle in [-PI, PI] to improve numerical stability
  const w = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return w;
}

function randInt(n: number) {
  return Math.floor(Math.random() * n);
}

function choice<T>(arr: readonly T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function facePos(face: number, r: number) {
  // 0=+Y, 1=+X, 2=-Y, 3=-X
  switch (face & 3) {
    case 0:
      return new THREE.Vector2(0, r);
    case 1:
      return new THREE.Vector2(r, 0);
    case 2:
      return new THREE.Vector2(0, -r);
    default:
      return new THREE.Vector2(-r, 0);
  }
}

function makeSegments(): Segment[] {
  const arr: Segment[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    arr.push({
      z: i * SEGMENT_LEN + 6,
      obstacleFace: randInt(4),
      obstacleKind: (Math.random() < 0.18 ? 1 : 0) as 0 | 1,
      gemFace: randInt(4),
      gemActive: Math.random() < 0.45,
      branchGrowth: 0,
      branchTargetSize:
        Math.random() * (BRANCH_MAX_SIZE - BRANCH_MIN_SIZE) + BRANCH_MIN_SIZE,
      branchGrowthSpeed:
        1 /
        (Math.random() * (BRANCH_GROWTH_SPEED_MAX - BRANCH_GROWTH_SPEED_MIN) +
          BRANCH_GROWTH_SPEED_MIN),
      spawnTime: 0,
    });
  }
  return arr;
}

function respawnSegment(
  seg: Segment,
  newZ: number,
  difficulty01: number,
  currentTime: number
) {
  seg.z = newZ;

  // Difficulty ramps with score; keep it fun but fair
  const obstacleChance = clamp(0.18 + difficulty01 * 0.55, 0.18, 0.82);
  const gemChance = clamp(0.42 - difficulty01 * 0.18, 0.22, 0.48);

  // Branches are pre-placed but grow in real-time
  seg.obstacleFace = randInt(4);
  seg.obstacleKind = (Math.random() < 0.22 + difficulty01 * 0.25 ? 1 : 0) as
    | 0
    | 1;

  // Occasionally keep a short break
  if (Math.random() > obstacleChance) {
    // encode "no obstacle" by using face= -1-ish (we'll treat <0 as none)
    seg.obstacleFace = -1;
  }

  // Initialize branch growth - starts at 0, grows to random target size
  const isCloseCall = Math.random() < CLOSE_CALL_CHANCE;
  if (isCloseCall) {
    // Close call: starts smaller, grows faster to larger size
    seg.branchTargetSize = Math.random() * 0.4 + 0.7; // 0.7-1.0
    seg.branchGrowthSpeed = 1 / (Math.random() * 0.5 + 0.6); // Faster growth (0.6-1.1 seconds)
  } else {
    // Normal growth
    seg.branchTargetSize =
      Math.random() * (BRANCH_MAX_SIZE - BRANCH_MIN_SIZE) + BRANCH_MIN_SIZE;
    seg.branchGrowthSpeed =
      1 /
      (Math.random() * (BRANCH_GROWTH_SPEED_MAX - BRANCH_GROWTH_SPEED_MIN) +
        BRANCH_GROWTH_SPEED_MIN);
  }
  seg.branchGrowth = 0;
  seg.spawnTime = currentTime;

  seg.gemActive = Math.random() < gemChance;
  seg.gemFace = randInt(4);

  // Avoid trivial "gem inside obstacle" too often.
  if (
    seg.gemActive &&
    seg.obstacleFace >= 0 &&
    seg.gemFace === seg.obstacleFace &&
    Math.random() < 0.7
  ) {
    seg.gemFace = (seg.gemFace + 1 + randInt(3)) & 3;
  }
}

function VoxelRunner({ wobble = 0 }: { wobble?: number }) {
  const snap = useSnapshot(growthState);
  const selectedSkin = growthSkins[snap.skin] || growthSkins[0];
  const t = useRefTime();
  const bob = Math.sin(t * 8) * 0.03;

  return (
    <group
      position={[0, BEAM_HALF + PLAYER_HOVER + bob, 0]}
      rotation={[0, 0, wobble]}
    >
      {/* shadow */}
      <mesh position={[0, -0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 24]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.18} />
      </mesh>

      {/* body */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.32, 0.24, 0.28]} />
        <meshStandardMaterial
          color={selectedSkin.accent}
          roughness={0.65}
          metalness={0.05}
        />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.28, 0.22, 0.26]} />
        <meshStandardMaterial
          color={selectedSkin.primary}
          roughness={0.7}
          metalness={0.02}
          emissive={selectedSkin.primary}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* little visor stripe */}
      <mesh position={[0, 0.27, 0.15]}>
        <boxGeometry args={[0.26, 0.06, 0.03]} />
        <meshStandardMaterial
          color="#f0f0f0"
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

function useRefTime() {
  const tRef = React.useRef(0);
  useFrame((_, dt) => {
    tRef.current += dt;
  });
  return tRef.current;
}

function GrowthWorld() {
  const input = useInputRef();
  const snap = useSnapshot(growthState);
  const { paused } = useGameUIState();

  const rollGroup = React.useRef<THREE.Group>(null!);

  const beamRef = React.useRef<THREE.InstancedMesh>(null!);
  const pillarRef = React.useRef<THREE.InstancedMesh>(null!);
  const spikeRef = React.useRef<THREE.InstancedMesh>(null!);
  const gemRef = React.useRef<THREE.InstancedMesh>(null!);

  const segmentsRef = React.useRef<Segment[]>(makeSegments());

  const tmpObj = React.useMemo(() => new THREE.Object3D(), []);
  const tmpObj2 = React.useMemo(() => new THREE.Object3D(), []);
  const tmpMat = React.useMemo(() => new THREE.Matrix4(), []);

  const mutation = React.useRef({
    roll: 0,
    rollTarget: 0,
    rollKick: 0,
    speed: BASE_SPEED,
    dist: 0,
    time: 0,
    seeded: false,
    lastRotateAt: -999,
    runSeed: Math.random() * 1000,
    spaceWasDown: false,
    leftWasDown: false,
    rightWasDown: false,
  });

  React.useEffect(() => {
    // Make instancing updates efficient
    if (beamRef.current)
      beamRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (pillarRef.current)
      pillarRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (spikeRef.current)
      spikeRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (gemRef.current)
      gemRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, []);

  // Initial render of segments - use a separate effect that runs after refs are set
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (
        beamRef.current &&
        pillarRef.current &&
        spikeRef.current &&
        gemRef.current
      ) {
        updateInstances(
          tmpObj,
          tmpObj2,
          tmpMat,
          segmentsRef.current,
          beamRef.current,
          pillarRef.current,
          spikeRef.current,
          gemRef.current,
          mutation.current.roll
        );
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [tmpObj, tmpObj2, tmpMat]);

  const resetRun = React.useCallback(() => {
    const m = mutation.current;
    m.roll = 0;
    m.rollTarget = 0;
    m.rollKick = 0;
    m.speed = BASE_SPEED;
    m.dist = 0;
    m.time = 0;
    m.seeded = true;
    m.lastRotateAt = -999;
    m.spaceWasDown = false;
    m.leftWasDown = false;
    m.rightWasDown = false;

    const segs = segmentsRef.current;
    for (let i = 0; i < segs.length; i++) {
      const z = i * SEGMENT_LEN + 6;
      respawnSegment(segs[i], z, 0, m.time);
    }
  }, []);

  React.useEffect(() => {
    if (snap.phase === 'playing') {
      resetRun();
      // Update instances after reset
      if (
        beamRef.current &&
        pillarRef.current &&
        spikeRef.current &&
        gemRef.current
      ) {
        updateInstances(
          tmpObj,
          tmpObj2,
          tmpMat,
          segmentsRef.current,
          beamRef.current,
          pillarRef.current,
          spikeRef.current,
          gemRef.current,
          mutation.current.roll
        );
      }
    }
  }, [snap.phase, resetRun, tmpObj, tmpObj2, tmpMat]);

  useFrame((_, dt) => {
    const m = mutation.current;
    m.time += dt;

    // Inputs - Space = clockwise, Left = left, Right = right
    const inputState = input.current;
    const tap = inputState.pointerJustDown;
    const spaceDown = inputState.keysDown.has(' ');
    const leftDown =
      inputState.keysDown.has('arrowleft') || inputState.keysDown.has('a');
    const rightDown =
      inputState.keysDown.has('arrowright') || inputState.keysDown.has('d');

    if (tap || spaceDown) {
      if (growthState.phase === 'menu' || growthState.phase === 'gameover') {
        growthState.start();
        clearFrameInput(input);
        return;
      }
    }

    if (growthState.phase === 'playing' && !paused) {
      // Rotation controls
      if (spaceDown && !m.spaceWasDown) {
        // Space = rotate clockwise
        m.rollTarget = wrapAngle(m.rollTarget - QUARTER);
        m.rollKick = 1;
        m.lastRotateAt = m.time;
      } else if (leftDown && !m.leftWasDown) {
        // Left arrow = rotate left (counter-clockwise)
        m.rollTarget = wrapAngle(m.rollTarget + QUARTER);
        m.rollKick = 1;
        m.lastRotateAt = m.time;
      } else if (rightDown && !m.rightWasDown) {
        // Right arrow = rotate right (clockwise)
        m.rollTarget = wrapAngle(m.rollTarget - QUARTER);
        m.rollKick = 1;
        m.lastRotateAt = m.time;
      }
      m.spaceWasDown = spaceDown;
      m.leftWasDown = leftDown;
      m.rightWasDown = rightDown;
    }

    // Menu idle animation (gentle sway)
    if (growthState.phase !== 'playing') {
      const idle = Math.sin(m.time * 0.35) * 0.08;
      m.roll = THREE.MathUtils.damp(m.roll, idle, 4.5, dt);
      m.rollTarget = m.roll;
      if (rollGroup.current) rollGroup.current.rotation.z = m.roll;
      updateInstances(
        tmpObj,
        tmpObj2,
        tmpMat,
        segmentsRef.current,
        beamRef.current,
        pillarRef.current,
        spikeRef.current,
        gemRef.current,
        m.roll
      );
      clearFrameInput(input);
      return;
    }

    if (paused) {
      clearFrameInput(input);
      return;
    }

    // Animate roll
    m.roll = THREE.MathUtils.damp(m.roll, m.rollTarget, 14, dt);
    m.roll = wrapAngle(m.roll);

    if (rollGroup.current) {
      // Add a tiny "snap" feel
      const kick = m.rollKick;
      rollGroup.current.rotation.z =
        m.roll + Math.sin(m.time * 24) * 0.01 * kick;
      m.rollKick = THREE.MathUtils.damp(m.rollKick, 0, 8, dt);
    }

    // Speed increases over time with cap
    const speedBoost = growthState.score * SPEED_RAMP;
    const targetSpeed = Math.min(BASE_SPEED + speedBoost, MAX_SPEED);
    m.speed = THREE.MathUtils.damp(m.speed, targetSpeed, 2.5, dt);

    // Distance -> score
    m.dist += m.speed * dt;
    while (m.dist >= SEGMENT_LEN) {
      m.dist -= SEGMENT_LEN;
      growthState.score += 1;
    }

    // Move segments towards the player and grow branches in real-time
    const segs = segmentsRef.current;
    const difficulty01 = clamp(growthState.score / 220, 0, 1);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      s.z -= m.speed * dt;

      // Grow branches in real-time
      if (s.obstacleFace >= 0 && s.branchGrowth < s.branchTargetSize) {
        s.branchGrowth = Math.min(
          s.branchTargetSize,
          s.branchGrowth + s.branchGrowthSpeed * dt
        );
      }

      if (s.z < -6) {
        s.z += TRACK_LENGTH;
        respawnSegment(s, s.z, difficulty01, m.time);
      }
    }

    // Collisions / collection in rollGroup local coords.
    // Player is fixed in world at (0, BEAM_HALF+hover, 0). Convert that to rollGroup local by inverse-rolling.
    const playerY = BEAM_HALF + PLAYER_HOVER;
    const c = Math.cos(-m.roll);
    const s = Math.sin(-m.roll);
    const playerLocalX = -playerY * s;
    const playerLocalY = playerY * c;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const dz = seg.z;
      if (Math.abs(dz) > COLLISION_Z) continue;

      // Gems
      if (seg.gemActive) {
        const gp = facePos(seg.gemFace, BEAM_HALF + 0.28);
        const dx = gp.x - playerLocalX;
        const dy = gp.y - playerLocalY;
        const rr = (PLAYER_RADIUS + GEM_R) * (PLAYER_RADIUS + GEM_R);
        if (dx * dx + dy * dy < rr) {
          seg.gemActive = false;
          growthState.addGem(1);
          // Small bonus for tight timing
          const timing = m.time - m.lastRotateAt;
          if (timing >= 0 && timing < 0.25) growthState.score += 2;
        }
      }

      // Obstacles - account for branch growth
      if (seg.obstacleFace >= 0) {
        const isSpike = seg.obstacleKind === 1;
        const growthScale = seg.branchGrowth;
        if (growthScale > 0.1) {
          // Only check collision if branch has grown enough
          const obR = (isSpike ? OB_SPIKE_R : OB_PILLAR_R) * growthScale;
          const baseHeight = isSpike ? OB_SPIKE_H : OB_PILLAR_H;
          const currentHeight = baseHeight * growthScale;
          const obPos = facePos(
            seg.obstacleFace,
            BEAM_HALF + currentHeight * 0.5
          );
          const dx = obPos.x - playerLocalX;
          const dy = obPos.y - playerLocalY;
          const rr = (PLAYER_RADIUS + obR) * (PLAYER_RADIUS + obR);
          if (dx * dx + dy * dy < rr) {
            growthState.gameOver();
            break;
          }
        }
      }
    }

    // Update visuals
    updateInstances(
      tmpObj,
      tmpObj2,
      tmpMat,
      segs,
      beamRef.current,
      pillarRef.current,
      spikeRef.current,
      gemRef.current,
      m.roll
    );

    // Clear frame input
    clearFrameInput(input);
  });

  return (
    <group>
      {/* Soft gradient foggy world */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 8, -4]} intensity={1.1} castShadow />

      <Environment preset="sunset" />

      {/* Rolling track */}
      <group ref={rollGroup}>
        {/* beam segments */}
        <instancedMesh
          ref={beamRef}
          args={[undefined as any, undefined as any, SEGMENTS]}
          castShadow
          receiveShadow
          frustumCulled={false}
        >
          <boxGeometry args={[BEAM_SIZE, BEAM_SIZE, SEGMENT_LEN]} />
          <meshStandardMaterial
            color="#f6e6b6"
            roughness={0.85}
            metalness={0.02}
          />
        </instancedMesh>

        {/* pillars */}
        <instancedMesh
          ref={pillarRef}
          args={[undefined as any, undefined as any, SEGMENTS]}
          castShadow
          receiveShadow
          frustumCulled={false}
        >
          <boxGeometry args={[0.48, OB_PILLAR_H, 0.48]} />
          <meshStandardMaterial
            color="#f2b190"
            roughness={0.8}
            metalness={0.02}
          />
        </instancedMesh>

        {/* spikes */}
        <instancedMesh
          ref={spikeRef}
          args={[undefined as any, undefined as any, SEGMENTS]}
          castShadow
          receiveShadow
          frustumCulled={false}
        >
          <coneGeometry args={[0.32, OB_SPIKE_H, 5]} />
          <meshStandardMaterial
            color="#f19b83"
            roughness={0.78}
            metalness={0.02}
          />
        </instancedMesh>

        {/* gems */}
        <instancedMesh
          ref={gemRef}
          args={[undefined as any, undefined as any, SEGMENTS]}
          castShadow
          frustumCulled={false}
        >
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color="#ffd15a"
            roughness={0.25}
            metalness={0.15}
            emissive="#ffb300"
            emissiveIntensity={0.25}
          />
        </instancedMesh>
      </group>

      {/* runner (not rolled with the world) */}
      <VoxelRunner
        wobble={
          Math.sin(mutation.current.time * 10) *
          0.06 *
          (growthState.phase === 'playing' ? 1 : 0.3)
        }
      />

      {/* Background "floating blocks" for depth */}
      <FloatingBlocks />
    </group>
  );
}

function updateInstances(
  tmpObj: THREE.Object3D,
  tmpObj2: THREE.Object3D,
  tmpMat: THREE.Matrix4,
  segs: Segment[],
  beam: THREE.InstancedMesh | null,
  pillars: THREE.InstancedMesh | null,
  spikes: THREE.InstancedMesh | null,
  gems: THREE.InstancedMesh | null,
  roll: number
) {
  if (!beam || !pillars || !spikes || !gems) return;

  const t = performance.now() / 1000;

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];

    // Beam segment
    tmpObj.position.set(0, 0, s.z);
    tmpObj.rotation.set(0, 0, 0);
    tmpObj.scale.set(1, 1, 1);
    tmpObj.updateMatrix();
    beam.setMatrixAt(i, tmpObj.matrix);

    // Pillars & spikes (one obstacle per segment max) - with branch growth
    if (s.obstacleFace >= 0) {
      const isSpike = s.obstacleKind === 1;
      const growthScale = s.branchGrowth; // 0..1, scales the obstacle size
      const baseHeight = isSpike ? OB_SPIKE_H : OB_PILLAR_H;
      const currentHeight = baseHeight * growthScale;
      const p = facePos(s.obstacleFace, BEAM_HALF + currentHeight * 0.5);
      tmpObj.position.set(p.x, p.y, s.z);

      if (isSpike) {
        // Orient cone away from beam center, scale by growth
        const a = (s.obstacleFace & 3) * QUARTER;
        tmpObj.rotation.set(0, 0, a);
        tmpObj.scale.set(growthScale, growthScale, growthScale);
        tmpObj.updateMatrix();
        spikes.setMatrixAt(i, tmpObj.matrix);

        // Hide pillar instance
        tmpObj2.position.set(0, -999, 0);
        tmpObj2.rotation.set(0, 0, 0);
        tmpObj2.scale.set(0.001, 0.001, 0.001);
        tmpObj2.updateMatrix();
        pillars.setMatrixAt(i, tmpObj2.matrix);
      } else {
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.set(growthScale, growthScale, growthScale);
        tmpObj.updateMatrix();
        pillars.setMatrixAt(i, tmpObj.matrix);

        // Hide spike instance
        tmpObj2.position.set(0, -999, 0);
        tmpObj2.rotation.set(0, 0, 0);
        tmpObj2.scale.set(0.001, 0.001, 0.001);
        tmpObj2.updateMatrix();
        spikes.setMatrixAt(i, tmpObj2.matrix);
      }
    } else {
      // Hide both obstacle instances
      tmpObj.position.set(0, -999, 0);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.set(0.001, 0.001, 0.001);
      tmpObj.updateMatrix();
      pillars.setMatrixAt(i, tmpObj.matrix);
      spikes.setMatrixAt(i, tmpObj.matrix);
    }

    // Gems
    if (s.gemActive) {
      const gp = facePos(s.gemFace, BEAM_HALF + 0.28);
      tmpObj.position.set(gp.x, gp.y, s.z);
      tmpObj.rotation.set(0, (t + i * 0.17) * 1.2, 0);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      gems.setMatrixAt(i, tmpObj.matrix);
    } else {
      tmpObj.position.set(0, -999, 0);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.set(0.001, 0.001, 0.001);
      tmpObj.updateMatrix();
      gems.setMatrixAt(i, tmpObj.matrix);
    }
  }

  beam.instanceMatrix.needsUpdate = true;
  pillars.instanceMatrix.needsUpdate = true;
  spikes.instanceMatrix.needsUpdate = true;
  gems.instanceMatrix.needsUpdate = true;

  // Slightly "juice" the lighting by nudging emissive gems when rolled (subtle)
  // Not strictly necessary; kept here for future tuning.
  void roll;
  void tmpMat;
}

function FloatingBlocks() {
  const blocks = React.useMemo(() => {
    const a: Array<{ pos: [number, number, number]; s: number; r: number }> =
      [];
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * 14;
      const y = (Math.random() - 0.2) * 6 - 2;
      const z = Math.random() * 26 + 6;
      a.push({
        pos: [x, y, z],
        s: 0.6 + Math.random() * 1.1,
        r: Math.random() * TAU,
      });
    }
    return a;
  }, []);

  const t = useRefTime();

  return (
    <group>
      {blocks.map((b, i) => (
        <mesh
          key={i}
          position={[
            b.pos[0],
            b.pos[1] + Math.sin(t * 0.3 + i) * 0.08,
            b.pos[2],
          ]}
          rotation={[0, b.r + t * 0.05, 0]}
        >
          <boxGeometry args={[b.s, b.s, b.s]} />
          <meshStandardMaterial
            color="#f0c7a6"
            roughness={0.9}
            metalness={0.02}
            transparent
            opacity={0.22}
          />
        </mesh>
      ))}
    </group>
  );
}

function GrowthHud() {
  const snap = useSnapshot(growthState);

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          padding: '8px 12px',
          borderRadius: 12,
          background: 'rgba(0,0,0,0.35)',
          color: 'white',
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.8 }}>SCORE</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{snap.score}</div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 16,
          top: 16,
          padding: '8px 12px',
          borderRadius: 12,
          background: 'rgba(0,0,0,0.35)',
          color: 'white',
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.8 }}>GEMS</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{snap.runGems}</div>
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
              width: 'min(520px, 92vw)',
              borderRadius: 24,
              background: 'rgba(0,0,0,0.55)',
              padding: 24,
              color: 'white',
              fontFamily: 'system-ui',
            }}
          >
            <div
              style={{
                fontSize: 14,
                opacity: 0.8,
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
              }}
            >
              Growth
            </div>
            <div style={{ fontSize: 30, fontWeight: 600 }}>
              Stay on the branch.
            </div>
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>
              Space = rotate clockwise • Left Arrow = rotate left • Right Arrow
              = rotate right
              <br />
              Branches grow in real-time—watch for close calls! Collect gems to
              unlock 31 unique characters.
            </div>

            <div
              style={{
                marginTop: 20,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div
                style={{
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.1)',
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8 }}>BEST</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {snap.bestScore}
                </div>
              </div>
              <div
                style={{
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.1)',
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8 }}>BANK</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {snap.bankGems}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                textAlign: 'center',
                fontSize: 14,
                opacity: 0.9,
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  borderRadius: 9999,
                  background: 'rgba(255,255,255,0.1)',
                  padding: '4px 12px',
                }}
              >
                Tap / Space to {snap.phase === 'gameover' ? 'retry' : 'start'}
              </div>
            </div>
          </div>
        </div>
      )}
    </Html>
  );
}

export default function Growth() {
  const { scene, camera } = useThree();

  React.useEffect(() => {
    scene.fog = new THREE.Fog('#d7c59d', 6, 34);
    camera.position.set(4.8, 5.2, -6.2);
    const perspCamera = camera as THREE.PerspectiveCamera;
    perspCamera.fov = 45;
    perspCamera.near = 0.1;
    perspCamera.far = 120;
    perspCamera.lookAt(0, 0.5, 0);
    perspCamera.updateProjectionMatrix();
  }, [scene, camera]);

  // Reset game state on mount
  React.useEffect(() => {
    growthState.reset();
  }, []);

  return (
    <>
      <color attach="background" args={['#d7c59d']} />
      <group position={[0, -0.2, 0]}>
        <GrowthWorld />
      </group>
      <GrowthHud />
      <CharacterSelection />
    </>
  );
}
