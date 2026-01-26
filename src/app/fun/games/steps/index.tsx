'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom } from '../../utils/seededRandom';

import { stepsState } from './state';

export { stepsState } from './state';

type Tile = {
  key: string;
  ix: number;
  iz: number;
  index: number;
  instanceId: number;
  painted: boolean;
  hasSpike: boolean;
};

const TILE_SIZE = 1;
const TILE_HEIGHT = 0.22;
const PLAYER_SIZE: [number, number, number] = [0.7, 0.38, 0.7];
const PLAYER_Y = TILE_HEIGHT / 2 + PLAYER_SIZE[1] / 2;
const GRAVITY = -18;
const MAX_RENDER_TILES = 440;

const TURN_CHANCE = 0.28;
const SPIKE_CHANCE = 0.08;

function keyFor(ix: number, iz: number) {
  return `${ix}|${iz}`;
}

function easingLerp(current: number, target: number, dt: number, lambda = 10) {
  const t = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * t;
}

function Steps() {
  const snap = useSnapshot(stepsState);
  const { paused } = useGameUIState();
  const input = useInputRef();
  const { camera, scene } = useThree();

  const tileMeshRef = useRef<THREE.InstancedMesh>(null);
  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);

  const world = useRef({
    rng: new SeededRandom(1),
    genIx: 0,
    genIz: 0,
    genDir: 'x' as 'x' | 'z',
    nextIndex: 0,

    tilesByKey: new Map<string, Tile>(),
    instanceToTile: Array<Tile | null>(MAX_RENDER_TILES).fill(null),

    // player
    px: 0,
    py: PLAYER_Y,
    pz: 0,
    vy: 0,
    falling: false,
    dir: 'x' as 'x' | 'z',
    speed: 4.2,
    lastScoredIndex: 0,

    spaceWasDown: false,

    dummy: new THREE.Object3D(),
    color: new THREE.Color(),
  });

  const palette = useMemo(() => {
    // A "sea of blue" + golden path + painted trail
    return {
      unpainted: new THREE.Color('#f7d57a'),
      paintedA: new THREE.Color('#f472b6'),
      paintedB: new THREE.Color('#60a5fa'),
      spike: new THREE.Color('#ef4444'),
    };
  }, []);

  const resetWorld = () => {
    const w = world.current;
    w.rng.reset(snap.worldSeed);
    w.tilesByKey.clear();
    w.instanceToTile.fill(null);

    w.genIx = 0;
    w.genIz = 0;
    w.genDir = 'x';
    w.nextIndex = 0;

    w.px = 0;
    w.pz = 0;
    w.py = PLAYER_Y;
    w.vy = 0;
    w.falling = false;
    w.dir = 'x';
    w.speed = 4.2;
    w.lastScoredIndex = 0;

    // clear instances
    if (tileMeshRef.current) {
      for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        tileMeshRef.current.setMatrixAt(i, w.dummy.matrix);
        tileMeshRef.current.setColorAt(i, palette.unpainted);
        if (spikeMeshRef.current) {
          spikeMeshRef.current.setMatrixAt(i, w.dummy.matrix);
          spikeMeshRef.current.setColorAt(i, palette.spike);
        }
      }
      tileMeshRef.current.instanceMatrix.needsUpdate = true;
      if (tileMeshRef.current.instanceColor)
        tileMeshRef.current.instanceColor.needsUpdate = true;
      if (spikeMeshRef.current) {
        spikeMeshRef.current.instanceMatrix.needsUpdate = true;
        if (spikeMeshRef.current.instanceColor)
          spikeMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    for (let i = 0; i < 200; i += 1) addNextTile();

    scene.fog = new THREE.Fog('#bfe8ff', 8, 55);
  };

  const addNextTile = () => {
    const w = world.current;

    if (w.nextIndex > 0) {
      if (w.genDir === 'x') w.genIx += 1;
      else w.genIz += 1;
    }

    const ix = w.genIx;
    const iz = w.genIz;
    const index = w.nextIndex;
    const instanceId = index % MAX_RENDER_TILES;
    const key = keyFor(ix, iz);

    const old = w.instanceToTile[instanceId];
    if (old) w.tilesByKey.delete(old.key);

    const hasSpike = index > 10 ? w.rng.bool(SPIKE_CHANCE) : false;
    const tile: Tile = {
      key,
      ix,
      iz,
      index,
      instanceId,
      painted: false,
      hasSpike,
    };
    w.tilesByKey.set(key, tile);
    w.instanceToTile[instanceId] = tile;

    if (index > 5 && w.rng.bool(TURN_CHANCE)) {
      w.genDir = w.genDir === 'x' ? 'z' : 'x';
    }

    const x = ix * TILE_SIZE;
    const z = iz * TILE_SIZE;
    const y = TILE_HEIGHT / 2;

    if (tileMeshRef.current) {
      w.dummy.position.set(x, y, z);
      w.dummy.rotation.set(0, 0, 0);
      w.dummy.scale.set(1, 1, 1);
      w.dummy.updateMatrix();
      tileMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
      tileMeshRef.current.setColorAt(instanceId, palette.unpainted);

      if (hasSpike && spikeMeshRef.current) {
        w.dummy.position.set(x, TILE_HEIGHT + 0.1, z);
        w.dummy.rotation.set(0, 0, 0);
        w.dummy.scale.set(1, 1, 1);
        w.dummy.updateMatrix();
        spikeMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
        spikeMeshRef.current.setColorAt(instanceId, palette.spike);
      } else if (spikeMeshRef.current) {
        w.dummy.position.set(0, -9999, 0);
        w.dummy.scale.set(0.0001, 0.0001, 0.0001);
        w.dummy.updateMatrix();
        spikeMeshRef.current.setMatrixAt(instanceId, w.dummy.matrix);
      }

      tileMeshRef.current.instanceMatrix.needsUpdate = true;
      if (tileMeshRef.current.instanceColor)
        tileMeshRef.current.instanceColor.needsUpdate = true;
      if (spikeMeshRef.current) {
        spikeMeshRef.current.instanceMatrix.needsUpdate = true;
        if (spikeMeshRef.current.instanceColor)
          spikeMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    w.nextIndex += 1;
  };

  const getTileUnder = (x: number, z: number) => {
    const w = world.current;
    const ix = Math.round(x / TILE_SIZE);
    const iz = Math.round(z / TILE_SIZE);
    return w.tilesByKey.get(keyFor(ix, iz));
  };

  const paintTile = (tile: Tile) => {
    const w = world.current;
    if (tile.painted) return;
    tile.painted = true;

    if (tileMeshRef.current) {
      // alternate between two “paint” tones for a lively trail
      const c = tile.index % 2 === 0 ? palette.paintedA : palette.paintedB;
      tileMeshRef.current.setColorAt(tile.instanceId, c);
      if (tileMeshRef.current.instanceColor)
        tileMeshRef.current.instanceColor.needsUpdate = true;
    }
  };

  useEffect(() => {
    stepsState.loadBest();
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
        stepsState.startGame();
      } else if (snap.phase === 'playing') {
        w.dir = w.dir === 'x' ? 'z' : 'x';
      }
    }
    clearFrameInput(input);

    if (paused) return;

    // keep tiles ahead
    const needed = w.lastScoredIndex + 260;
    while (w.nextIndex < needed) addNextTile();

    if (snap.phase === 'playing') {
      w.speed = 4.4 + Math.min(6.5, snap.score * 0.006);
      const step = w.speed * dt;

      if (!w.falling) {
        if (w.dir === 'x') w.px += step;
        else w.pz += step;
      } else {
        if (w.dir === 'x') w.px += step * 0.9;
        else w.pz += step * 0.9;
      }

      const tile = getTileUnder(w.px, w.pz);
      if (tile) {
        w.py = easingLerp(w.py, PLAYER_Y, dt, 18);
        w.vy = 0;
        w.falling = false;

        paintTile(tile);

        if (tile.index > w.lastScoredIndex) {
          w.lastScoredIndex = tile.index;
          stepsState.score = tile.index;
        }

        if (tile.hasSpike) {
          stepsState.endGame();
        }
      } else {
        if (!w.falling) {
          w.falling = true;
          w.vy = -1.2;
        }
        w.vy += GRAVITY * dt;
        w.py += w.vy * dt;
        if (w.py < -6) {
          stepsState.endGame();
        }
      }
    }

    if (playerRef.current) {
      playerRef.current.position.set(w.px, w.py, w.pz);
      playerRef.current.rotation.y += dt * 1.2;
    }

    // isometric camera
    const targetCam = new THREE.Vector3(w.px + 6.5, 7.5, w.pz + 6.5);
    camera.position.x = easingLerp(camera.position.x, targetCam.x, dt, 3.6);
    camera.position.y = easingLerp(camera.position.y, targetCam.y, dt, 3.6);
    camera.position.z = easingLerp(camera.position.z, targetCam.z, dt, 3.6);
    camera.lookAt(w.px, 0.3, w.pz);
  });

  return (
    <group>
      <ambientLight intensity={0.7} />
      <directionalLight position={[7, 11, 6]} intensity={0.9} castShadow />

      <instancedMesh
        ref={tileMeshRef}
        args={[undefined, undefined, MAX_RENDER_TILES]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[TILE_SIZE, TILE_HEIGHT, TILE_SIZE]} />
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.05} />
      </instancedMesh>

      <instancedMesh
        ref={spikeMeshRef}
        args={[undefined, undefined, MAX_RENDER_TILES]}
      >
        <coneGeometry args={[0.16, 0.32, 10]} />
        <meshStandardMaterial vertexColors roughness={0.45} metalness={0.05} />
      </instancedMesh>

      <mesh ref={playerRef} castShadow>
        <boxGeometry args={PLAYER_SIZE} />
        <meshStandardMaterial
          color={'#ff5aa5'}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: '#0b1220',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.75 }}>STEPS</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{snap.score}</div>
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
                width: 380,
                padding: 18,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.84)',
                border: '1px solid rgba(0,0,0,0.08)',
                textAlign: 'center',
                boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 1 }}>
                STEPS
              </div>
              <div style={{ marginTop: 6, fontSize: 14, opacity: 0.75 }}>
                Tap / Space to start • Tap to switch direction • Avoid spikes.
              </div>
              {snap.phase === 'gameover' && (
                <div style={{ marginTop: 10, fontSize: 14 }}>
                  <div style={{ fontWeight: 700 }}>Run over</div>
                  <div style={{ opacity: 0.75 }}>Score: {snap.score}</div>
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.55 }}>
                Tip: Late taps are safer than early taps — watch the next
                corner.
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}

export default Steps;
