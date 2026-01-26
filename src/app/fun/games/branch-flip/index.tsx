'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom } from '../../utils/seededRandom';

import { branchFlipState } from './state';

export { branchFlipState } from './state';
export * from './types';
export * from './constants';

type Segment = {
  index: number;
  instanceId: number;
  branchSide: number | null;
  hasGem: boolean;
  gemSide: number;
  scored: boolean;
  themeIndex: number;
  spawnTime: number;
  branchGrowth: number;
};

type Theme = {
  skyTop: string;
  skyBottom: string;
  fog: string;
  tileTop: string;
  tileSide: string;
  gem: string;
};

const TILE_SIZE = 1.0;
const TILE_HEIGHT = 0.32;
const PLAYER_SIZE = 0.38;
const PLAYER_Y = TILE_HEIGHT / 2 + PLAYER_SIZE / 2 + 0.02;

const BRANCH_LENGTH = 0.82;
const BRANCH_OFFSET = TILE_SIZE / 2 + BRANCH_LENGTH / 2;
const GEM_OFFSET = TILE_SIZE / 2 + 0.2;

const LOOKAHEAD = 160;
const MAX_SEGMENTS = 260;

const BRANCH_GROW_TIME = 0.35;
const BRANCH_BLOCK_THRESHOLD = 0.6;
const MAX_LAG = 2.4;

const ROTATE_STEP = Math.PI / 2;
const ROTATE_SMOOTH = 12;

const GEM_CHANCE = 0.14;
const BRANCH_CHANCE_MIN = 0.18;
const BRANCH_CHANCE_MAX = 0.45;

const THEMES: Theme[] = [
  {
    skyTop: '#f0d7a6',
    skyBottom: '#b9c07f',
    fog: '#c8c084',
    tileTop: '#fff3c7',
    tileSide: '#f4a381',
    gem: '#facc15',
  },
  {
    skyTop: '#e7c2ff',
    skyBottom: '#a98bd9',
    fog: '#b99cd9',
    tileTop: '#fff1cf',
    tileSide: '#f1a07b',
    gem: '#facc15',
  },
  {
    skyTop: '#f2e2b3',
    skyBottom: '#c8b7a8',
    fog: '#d1b9a1',
    tileTop: '#fff4d8',
    tileSide: '#f3a17b',
    gem: '#facc15',
  },
];

const SIDE_DIRS = [
  new THREE.Vector2(1, 0),
  new THREE.Vector2(0, 1),
  new THREE.Vector2(-1, 0),
  new THREE.Vector2(0, -1),
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const BranchFlip: React.FC = () => {
  const snap = useSnapshot(branchFlipState);
  const { paused } = useGameUIState();
  const input = useInputRef();
  const { camera, scene } = useThree();

  const worldRef = useRef<THREE.Group>(null);
  const tileMeshRef = useRef<THREE.InstancedMesh>(null);
  const branchMeshRef = useRef<THREE.InstancedMesh>(null);
  const gemMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Group>(null);
  const skyRef = useRef<THREE.Mesh>(null);

  const skyUniforms = useRef({
    uTop: { value: new THREE.Color(THEMES[0].skyTop) },
    uBottom: { value: new THREE.Color(THEMES[0].skyBottom) },
  });

  const world = useRef({
    rng: new SeededRandom(1),
    nextIndex: 0,
    segmentsByIndex: new Map<number, Segment>(),
    instanceToSegment: Array<Segment | null>(MAX_SEGMENTS).fill(null),
    rotationIndex: 0,
    rotation: 0,
    targetRotation: 0,
    playerX: 0,
    scrollX: 0,
    playerY: PLAYER_Y,
    time: 0,
    themeIndex: 0,
    dummy: new THREE.Object3D(),
    color: new THREE.Color(),
  });

  const themeForIndex = (index: number) => THEMES[index % THEMES.length];

  const clearInstances = () => {
    const w = world.current;
    if (tileMeshRef.current) {
      for (let i = 0; i < MAX_SEGMENTS; i += 1) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        tileMeshRef.current.setMatrixAt(i, w.dummy.matrix);
        branchMeshRef.current?.setMatrixAt(i, w.dummy.matrix);
        gemMeshRef.current?.setMatrixAt(i, w.dummy.matrix);
      }
      tileMeshRef.current.instanceMatrix.needsUpdate = true;
      branchMeshRef.current?.instanceMatrix.needsUpdate &&
        (branchMeshRef.current.instanceMatrix.needsUpdate = true);
      gemMeshRef.current?.instanceMatrix.needsUpdate &&
        (gemMeshRef.current.instanceMatrix.needsUpdate = true);
    }
  };

  const setBranchInstance = (segment: Segment, growth: number) => {
    if (!branchMeshRef.current) return;
    if (segment.branchSide == null) {
      const w = world.current;
      w.dummy.position.set(0, -9999, 0);
      w.dummy.scale.set(0.0001, 0.0001, 0.0001);
      w.dummy.updateMatrix();
      branchMeshRef.current.setMatrixAt(segment.instanceId, w.dummy.matrix);
      return;
    }

    const w = world.current;
    const dir = SIDE_DIRS[segment.branchSide];
    const x = segment.index * TILE_SIZE;
    const theme = themeForIndex(segment.themeIndex);
    const rotationBySide = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const rotationX = rotationBySide[segment.branchSide] ?? 0;

    w.dummy.position.set(x, dir.x * BRANCH_OFFSET, dir.y * BRANCH_OFFSET);
    w.dummy.rotation.set(rotationX, 0, 0);
    w.dummy.scale.set(1, clamp(growth, 0.001, 1), 1);
    w.dummy.updateMatrix();
    branchMeshRef.current.setMatrixAt(segment.instanceId, w.dummy.matrix);
    branchMeshRef.current.setColorAt(
      segment.instanceId,
      new THREE.Color(theme.tileSide)
    );
  };

  const addSegment = () => {
    const w = world.current;
    const index = w.nextIndex;
    const instanceId = index % MAX_SEGMENTS;

    const existing = w.instanceToSegment[instanceId];
    if (existing) {
      w.segmentsByIndex.delete(existing.index);
    }

    const difficulty = clamp(index / 160, 0, 1);
    const branchChance =
      BRANCH_CHANCE_MIN + (BRANCH_CHANCE_MAX - BRANCH_CHANCE_MIN) * difficulty;
    const hasBranch = index > 6 && w.rng.bool(branchChance);
    const branchSide = hasBranch ? w.rng.int(0, 3) : null;

    const hasGem =
      index > 4 && w.rng.bool(GEM_CHANCE) && branchSide !== w.rotationIndex;
    const gemSide = w.rng.int(0, 3);

    const themeIndex = Math.floor(index / 40) % THEMES.length;
    const segment: Segment = {
      index,
      instanceId,
      branchSide,
      hasGem,
      gemSide,
      scored: false,
      themeIndex,
      spawnTime: w.time,
      branchGrowth: 0,
    };

    w.segmentsByIndex.set(index, segment);
    w.instanceToSegment[instanceId] = segment;

    const theme = themeForIndex(themeIndex);

    const x = index * TILE_SIZE;
    if (tileMeshRef.current) {
      w.dummy.position.set(x, 0, 0);
      w.dummy.rotation.set(0, 0, 0);
      w.dummy.scale.set(1, 1, 1);
      w.dummy.updateMatrix();
      tileMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
      tileMeshRef.current.setColorAt(
        instanceId,
        new THREE.Color(theme.tileTop)
      );
    }

    segment.branchGrowth = 0.02;
    setBranchInstance(segment, 0.02);

    if (gemMeshRef.current) {
      if (hasGem) {
        const dir = SIDE_DIRS[gemSide];
        w.dummy.position.set(x, dir.x * GEM_OFFSET, dir.y * GEM_OFFSET);
        w.dummy.rotation.set(0, 0, 0);
        w.dummy.scale.set(0.4, 0.4, 0.4);
        w.dummy.updateMatrix();
        gemMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
        gemMeshRef.current.setColorAt(instanceId, new THREE.Color(theme.gem));
      } else {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        gemMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
      }
    }

    tileMeshRef.current?.instanceMatrix.needsUpdate &&
      (tileMeshRef.current.instanceMatrix.needsUpdate = true);
    tileMeshRef.current?.instanceColor &&
      (tileMeshRef.current.instanceColor.needsUpdate = true);
    branchMeshRef.current?.instanceMatrix.needsUpdate &&
      (branchMeshRef.current.instanceMatrix.needsUpdate = true);
    branchMeshRef.current?.instanceColor &&
      (branchMeshRef.current.instanceColor.needsUpdate = true);
    gemMeshRef.current?.instanceMatrix.needsUpdate &&
      (gemMeshRef.current.instanceMatrix.needsUpdate = true);
    gemMeshRef.current?.instanceColor &&
      (gemMeshRef.current.instanceColor.needsUpdate = true);

    w.nextIndex += 1;
  };

  const resetWorld = () => {
    const w = world.current;
    w.rng = new SeededRandom(Math.floor(Math.random() * 1_000_000_000));
    w.nextIndex = 0;
    w.segmentsByIndex.clear();
    w.instanceToSegment.fill(null);
    w.rotationIndex = 0;
    w.rotation = 0;
    w.targetRotation = 0;
    w.playerX = 0;
    w.scrollX = 0;
    w.playerY = PLAYER_Y;
    w.time = 0;
    w.themeIndex = 0;

    branchFlipState.score = 0;
    branchFlipState.gems = 0;
    branchFlipState.speed = 4.8;
    branchFlipState.falling = false;

    clearInstances();
    for (let i = 0; i < LOOKAHEAD; i += 1) {
      addSegment();
    }
  };

  useEffect(() => {
    branchFlipState.loadBestScore();
    resetWorld();
  }, []);

  useEffect(() => {
    const theme = themeForIndex(world.current.themeIndex);
    skyUniforms.current.uTop.value.set(theme.skyTop);
    skyUniforms.current.uBottom.value.set(theme.skyBottom);
    scene.fog = new THREE.Fog(theme.fog, 8, 60);
    scene.background = new THREE.Color(theme.skyBottom);
  }, [scene]);

  useFrame((_, dt) => {
    const w = world.current;
    const inputState = input.current;
    const tap = inputState.pointerJustDown || inputState.keysDown.has(' ');

    if (tap) {
      if (snap.phase === 'menu' || snap.phase === 'gameover') {
        branchFlipState.startGame();
        resetWorld();
      } else if (snap.phase === 'playing' && !paused) {
        w.rotationIndex = (w.rotationIndex + 1) % 4;
        w.targetRotation = w.rotationIndex * ROTATE_STEP;
      }
    }

    clearFrameInput(input);

    if (paused) return;

    if (snap.phase === 'playing') {
      w.time += dt;
      w.rotation =
        w.rotation +
        (w.targetRotation - w.rotation) * Math.min(1, dt * ROTATE_SMOOTH);
      if (worldRef.current) {
        worldRef.current.rotation.x = w.rotation;
      }

      branchFlipState.speed = 4.8 + Math.max(0, branchFlipState.score) * 0.02;
      w.scrollX += branchFlipState.speed * dt;

      const currentIndex = Math.floor(w.scrollX / TILE_SIZE);
      while (w.nextIndex < currentIndex + LOOKAHEAD) addSegment();

      const playerIndex = Math.floor(w.playerX / TILE_SIZE);
      const blockingSegment = w.segmentsByIndex.get(playerIndex + 1);
      const blockingGrowth = blockingSegment
        ? clamp((w.time - blockingSegment.spawnTime) / BRANCH_GROW_TIME, 0, 1)
        : 0;
      const isBlocked =
        !!blockingSegment &&
        blockingSegment.branchSide === w.rotationIndex &&
        blockingGrowth > BRANCH_BLOCK_THRESHOLD;

      if (!isBlocked) {
        w.playerX += branchFlipState.speed * dt;
        if (w.playerX > w.scrollX) w.playerX = w.scrollX;
      }

      const lag = w.scrollX - w.playerX;
      if (lag > MAX_LAG) {
        branchFlipState.endGame();
        return;
      }

      let branchUpdated = false;
      const growthStart = Math.max(0, currentIndex - 2);
      const growthEnd = currentIndex + 26;
      for (let i = growthStart; i <= growthEnd; i += 1) {
        const seg = w.segmentsByIndex.get(i);
        if (!seg || seg.branchSide == null) continue;
        const growth = clamp((w.time - seg.spawnTime) / BRANCH_GROW_TIME, 0, 1);
        if (Math.abs(growth - seg.branchGrowth) > 0.01) {
          seg.branchGrowth = growth;
          setBranchInstance(seg, growth);
          branchUpdated = true;
        }
      }
      if (branchUpdated && branchMeshRef.current) {
        branchMeshRef.current.instanceMatrix.needsUpdate = true;
        if (branchMeshRef.current.instanceColor) {
          branchMeshRef.current.instanceColor.needsUpdate = true;
        }
      }

      const segment = w.segmentsByIndex.get(playerIndex);
      if (segment && !segment.scored) {
        segment.scored = true;
        branchFlipState.score = Math.max(branchFlipState.score, playerIndex);

        if (segment.hasGem && segment.gemSide === w.rotationIndex) {
          segment.hasGem = false;
          branchFlipState.collectGem();
          if (gemMeshRef.current) {
            w.dummy.position.set(0, -9999, 0);
            w.dummy.scale.set(0.0001, 0.0001, 0.0001);
            w.dummy.updateMatrix();
            gemMeshRef.current.setMatrixAt(segment.instanceId, w.dummy.matrix);
            gemMeshRef.current.instanceMatrix.needsUpdate = true;
          }
        }
      }

      const themeIndex = Math.floor(currentIndex / 40) % THEMES.length;
      if (themeIndex !== w.themeIndex) {
        w.themeIndex = themeIndex;
        const theme = themeForIndex(themeIndex);
        skyUniforms.current.uTop.value.set(theme.skyTop);
        skyUniforms.current.uBottom.value.set(theme.skyBottom);
        scene.fog = new THREE.Fog(theme.fog, 8, 60);
        scene.background = new THREE.Color(theme.skyBottom);
      }
    }

    if (playerRef.current) {
      playerRef.current.position.set(w.playerX, w.playerY, 0);
    }

    if (skyRef.current) {
      skyRef.current.position.set(w.scrollX, 0, 0);
    }

    camera.position.x = w.scrollX - 6.8;
    camera.position.y = 4.6;
    camera.position.z = 4.6;
    camera.lookAt(w.scrollX + 2.4, 0.6, 0);
  });

  const scoreDisplay = snap.score;

  return (
    <group>
      <mesh ref={skyRef}>
        <sphereGeometry args={[80, 32, 32]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={skyUniforms.current}
          vertexShader={`
            varying vec3 vWorldPos;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPos = worldPosition.xyz;
              gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
          `}
          fragmentShader={`
            uniform vec3 uTop;
            uniform vec3 uBottom;
            varying vec3 vWorldPos;
            void main() {
              float h = normalize(vWorldPos).y * 0.5 + 0.5;
              vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, h));
              gl_FragColor = vec4(col, 1.0);
            }
          `}
        />
      </mesh>

      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 8, 6]} intensity={0.9} />

      <group ref={worldRef}>
        <instancedMesh
          ref={tileMeshRef}
          args={[undefined, undefined, MAX_SEGMENTS]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[TILE_SIZE, TILE_HEIGHT, TILE_SIZE]} />
          <meshStandardMaterial vertexColors roughness={0.6} metalness={0.05} />
        </instancedMesh>

        <instancedMesh
          ref={branchMeshRef}
          args={[undefined, undefined, MAX_SEGMENTS]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[TILE_SIZE, BRANCH_LENGTH, TILE_SIZE]} />
          <meshStandardMaterial
            vertexColors
            roughness={0.55}
            metalness={0.05}
          />
        </instancedMesh>

        <instancedMesh
          ref={gemMeshRef}
          args={[undefined, undefined, MAX_SEGMENTS]}
        >
          <octahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial
            vertexColors
            roughness={0.3}
            metalness={0.2}
            emissiveIntensity={0.35}
          />
        </instancedMesh>
        <group ref={playerRef}>
          <mesh>
            <boxGeometry
              args={[PLAYER_SIZE * 0.9, PLAYER_SIZE * 0.9, PLAYER_SIZE * 0.9]}
            />
            <meshStandardMaterial color={'#e25b4c'} roughness={0.5} />
          </mesh>
          <mesh position={[0, -PLAYER_SIZE * 0.55, 0]}>
            <boxGeometry
              args={[PLAYER_SIZE * 0.8, PLAYER_SIZE * 0.2, PLAYER_SIZE * 0.8]}
            />
            <meshStandardMaterial color={'#2b2b2b'} roughness={0.7} />
          </mesh>
        </group>
      </group>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: '#ffffff',
            fontFamily: 'ui-sans-serif, system-ui',
            textShadow: '0 2px 6px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.8 }}>GROWTH</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{scoreDisplay}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Gems: {snap.gems}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Best: {snap.bestScore}
          </div>
        </div>

        {(snap.phase === 'menu' || snap.phase === 'gameover') && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.78)',
                borderRadius: 16,
                padding: '18px 20px',
                width: 360,
                textAlign: 'center',
                color: 'white',
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 900 }}>Growth</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  opacity: 0.85,
                  lineHeight: 1.4,
                }}
              >
                Stay on the branch as long as you can. Tap to rotate the world
                and keep Mike safe.
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Collect gems to unlock new characters.
              </div>
              {snap.phase === 'gameover' && (
                <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                  Run over • Score: {scoreDisplay}
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
                Tap / Space to start
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
};

export default BranchFlip;
