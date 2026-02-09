'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import { SeededRandom } from '../../utils/seededRandom';
import {
  buildPatternLibraryTemplate,
  sampleSurvivability,
  sampleDifficulty,
} from '../../config/ketchapp';
import { KetchappGameShell } from '../_shared/KetchappGameShell';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';

type GameStatus = 'menu' | 'playing' | 'gameover';

const STORAGE_BEST_KEY = 'fun_orbitlatch_best_v1';

const BALL_RADIUS = 0.18;
const BALL_Y = 0.28;
const ORBIT_RADIUS = 1.15;
const ORBIT_SPEED = 2.35; // radians/sec
const GAP = 5.4;
const LATCH_DIST = 0.55;
const VIEW_AHEAD = 14;
const VIEW_BEHIND = 4;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function hashSeed(baseSeed: number, index: number) {
  // deterministic 32-bit-ish hash
  const x = (baseSeed ^ (index * 0x9e3779b9)) >>> 0;
  return x;
}

function getAnchorPos(baseSeed: number, index: number, out: THREE.Vector3) {
  const rng = new SeededRandom(hashSeed(baseSeed, index));
  const x = rng.float(-2.0, 2.0);
  const z = index * GAP;
  out.set(x, 0, z);
  return out;
}

function getHazard(
  baseSeed: number,
  index: number,
  out: { pos: THREE.Vector3; r: number }
) {
  // hazard between anchor index and index+1
  const rng = new SeededRandom(hashSeed(baseSeed + 1337, index));
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  getAnchorPos(baseSeed, index, a);
  getAnchorPos(baseSeed, index + 1, b);

  out.r = rng.float(0.16, 0.28);
  const t = rng.float(0.25, 0.75);
  const x = THREE.MathUtils.lerp(a.x, b.x, t) + rng.float(-1.0, 1.0);
  const z = THREE.MathUtils.lerp(a.z, b.z, t) + rng.float(-0.6, 0.6);
  out.pos.set(x, BALL_Y, z);
  return out;
}

export default function OrbitLatch() {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [seed, setSeed] = useState<number>(
    () => (Date.now() ^ (Math.random() * 1e9)) >>> 0
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_BEST_KEY);
      if (raw) setBest(Math.max(0, Number(raw) || 0));
    } catch {
      // ignore
    }
  }, []);

  const start = useCallback(() => {
    setScore(0);
    setSeed((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    setStatus('playing');
  }, []);

  const onScore = useCallback(() => {
    setScore((s) => s + 1);
  }, []);

  const onGameOver = useCallback(
    (finalScore: number) => {
      setStatus('gameover');
      setBest((b) => {
        const next = Math.max(b, finalScore);
        try {
          localStorage.setItem(STORAGE_BEST_KEY, String(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [setBest]
  );

  return (
    <div
      className="relative h-full w-full select-none"
      style={{
        background: 'linear-gradient(to bottom, #ffb3d9 0%, #a8c8ff 100%)',
      }}
      onPointerDown={() => {
        if (status !== 'playing') start();
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <PerspectiveCamera makeDefault position={[0, 7.5, 7.5]} fov={55} />
        <color attach="background" args={['#a8c8ff']} />
        <OrbitLatchScene
          baseSeed={seed}
          status={status}
          onScore={onScore}
          onGameOver={onGameOver}
        />
      </Canvas>

      <KetchappGameShell
        gameId="orbitlatch"
        score={score}
        best={best}
        status={
          status === 'playing'
            ? 'playing'
            : status === 'gameover'
              ? 'gameover'
              : 'ready'
        }
        tone="light"
        deathTitle="Missed Latch"
        containerClassName="absolute inset-0"
      />
    </div>
  );
}

function OrbitLatchScene({
  baseSeed,
  status,
  onScore,
  onGameOver,
}: {
  baseSeed: number;
  status: GameStatus;
  onScore: () => void;
  onGameOver: (finalScore: number) => void;
}) {
  const input = useInputRef({ enabled: status === 'playing' });
  const ballRef = useRef<THREE.Mesh>(null);

  const sim = useRef({
    mode: 'orbit' as 'orbit' | 'flight',
    anchorIdx: 0,
    angle: Math.PI * 0.25,
    pos: new THREE.Vector3(0, BALL_Y, 0),
    vel: new THREE.Vector3(),
    score: 0,
    dead: false,
  });

  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  const tmpOff = useMemo(() => new THREE.Vector3(), []);
  const tmpHaz = useMemo(() => ({ pos: new THREE.Vector3(), r: 0.2 }), []);
  const patternLibrary = useMemo(
    () => buildPatternLibraryTemplate('orbitlatch'),
    []
  );

  const [anchorIdxRender, setAnchorIdxRender] = useState(0);

  useEffect(() => {
    if (status !== 'playing') return;
    sim.current.mode = 'orbit';
    sim.current.anchorIdx = 0;
    sim.current.angle = Math.PI * 0.25;
    sim.current.score = 0;
    sim.current.dead = false;

    getAnchorPos(baseSeed, 0, tmpA);
    sim.current.pos.set(tmpA.x + ORBIT_RADIUS, BALL_Y, tmpA.z);
    sim.current.vel.set(0, 0, 0);
    setAnchorIdxRender(0);
  }, [baseSeed, status, tmpA]);

  const die = useCallback(() => {
    if (sim.current.dead) return;
    sim.current.dead = true;
    onGameOver(sim.current.score);
  }, [onGameOver]);

  useFrame((_, dt) => {
    dt = clamp(dt, 0, 1 / 30);

    if (status !== 'playing') {
      clearFrameInput(input.current);
      return;
    }

    const s = sim.current;

    const difficulty = sampleDifficulty('orbit-chain', s.score * 0.9);
    const survivability = sampleSurvivability('orbitlatch', s.score);
    const activeChunk = patternLibrary[s.anchorIdx % patternLibrary.length];
    const dynamicFlightSpeed =
      (difficulty.speed + activeChunk.tier * 0.2) *
      survivability.intensityScale;
    const dynamicOrbitSpeed =
      (ORBIT_SPEED + activeChunk.tier * 0.12) * survivability.intensityScale;
    const latchDist = LATCH_DIST * survivability.decisionWindowScale;

    if (input.current.pointerJustDown && s.mode === 'orbit') {
      // tangent direction in xz plane
      const tx = -Math.sin(s.angle);
      const tz = Math.cos(s.angle);
      s.vel.set(tx, 0, tz).normalize().multiplyScalar(dynamicFlightSpeed);
      s.mode = 'flight';
    }

    if (s.mode === 'orbit') {
      s.angle += dynamicOrbitSpeed * dt;
      getAnchorPos(baseSeed, s.anchorIdx, tmpA);
      s.pos.set(
        tmpA.x + Math.cos(s.angle) * ORBIT_RADIUS,
        BALL_Y,
        tmpA.z + Math.sin(s.angle) * ORBIT_RADIUS
      );
    } else {
      s.pos.addScaledVector(s.vel, dt);

      // attempt latch
      getAnchorPos(baseSeed, s.anchorIdx + 1, tmpB);
      if (s.pos.distanceTo(tmpB) <= latchDist) {
        s.anchorIdx += 1;
        s.score += 1;
        onScore();

        tmpOff.copy(s.pos).sub(tmpB);
        // lock to orbit radius to make the motion snappy/clean
        if (tmpOff.lengthSq() < 1e-6) tmpOff.set(1, 0, 0);
        tmpOff.setY(0);
        tmpOff.setLength(ORBIT_RADIUS);
        s.pos.copy(tmpB).add(tmpOff);
        s.angle = Math.atan2(tmpOff.z, tmpOff.x);
        s.mode = 'orbit';
      } else {
        // missed: flew past the next anchor plane
        if (
          s.pos.z >
          tmpB.z + GAP * (0.9 + (survivability.decisionWindowScale - 1) * 0.24)
        ) {
          die();
        }
      }

      // out of bounds
      if (
        Math.abs(s.pos.x) >
        6.5 + (survivability.decisionWindowScale - 1) * 1.2
      )
        die();
    }

    // hazards near current segment(s)
    const start = Math.max(0, s.anchorIdx - 2);
    const end = s.anchorIdx + 8;
    for (let i = start; i <= end; i++) {
      getHazard(baseSeed, i, tmpHaz);
      const d = tmpHaz.pos.distanceTo(s.pos);
      const hitRadius = Math.max(
        0.16,
        tmpHaz.r +
          BALL_RADIUS * 0.92 -
          (survivability.decisionWindowScale - 1) * 0.1
      );
      if (d < hitRadius) {
        die();
        break;
      }
    }

    if (ballRef.current) ballRef.current.position.copy(s.pos);

    if (anchorIdxRender !== s.anchorIdx) setAnchorIdxRender(s.anchorIdx);

    clearFrameInput(input.current);
  });

  const visibleAnchors = useMemo(() => {
    const start = Math.max(0, anchorIdxRender - VIEW_BEHIND);
    const end = anchorIdxRender + VIEW_AHEAD;
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [anchorIdxRender]);

  const visibleHazards = useMemo(() => {
    const start = Math.max(0, anchorIdxRender - 2);
    const end = anchorIdxRender + 10;
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [anchorIdxRender]);

  const floorGeo = useMemo(() => new THREE.PlaneGeometry(60, 260, 1, 1), []);
  const pylonGeo = useMemo(
    () => new THREE.CylinderGeometry(0.28, 0.34, 0.9, 16, 1),
    []
  );
  const pylonTopGeo = useMemo(
    () => new THREE.CylinderGeometry(0.32, 0.32, 0.12, 16, 1),
    []
  );
  const hazardGeo = useMemo(() => new THREE.IcosahedronGeometry(0.24, 0), []);
  const skyGeo = useMemo(() => new THREE.SphereGeometry(200, 32, 32), []);
  const skyMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#a8c8ff',
        side: THREE.BackSide,
        depthWrite: false,
      }),
    []
  );

  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b8d4f0',
        roughness: 0.7,
        metalness: 0.1,
      }),
    []
  );
  const pylonMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8b5cf6',
        roughness: 0.4,
        metalness: 0.15,
        emissive: new THREE.Color('#7c3aed'),
        emissiveIntensity: 0.2,
      }),
    []
  );
  const pylonTopMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#facc15',
        roughness: 0.2,
        metalness: 0.3,
        emissive: new THREE.Color('#facc15'),
        emissiveIntensity: 0.8,
      }),
    []
  );
  const hazardMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ff3a5e',
        roughness: 0.2,
        metalness: 0.1,
        emissive: new THREE.Color('#ff3a5e'),
        emissiveIntensity: 0.6,
      }),
    []
  );
  const ballMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ef4444',
        roughness: 0.2,
        metalness: 0.3,
        emissive: new THREE.Color('#ef4444'),
        emissiveIntensity: 0.15,
      }),
    []
  );
  const lineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.6,
      }),
    []
  );

  return (
    <group position={[0, 0, -2]}>
      {/* Sky - solid color to avoid shader uniform issues */}
      <mesh geometry={skyGeo} material={skyMat} />

      <fog attach="fog" args={['#b8d4f0', 30, 120]} />

      {/* Bright floor */}
      <mesh
        geometry={floorGeo}
        material={floorMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 60]}
        receiveShadow
      />

      {/* Glowing path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 60]}>
        <planeGeometry args={[6, 260]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
      </mesh>

      <ambientLight intensity={1.2} />
      <directionalLight position={[6, 12, 6]} intensity={1.8} castShadow />
      <pointLight position={[0, 15, 0]} intensity={0.8} color="#ffd966" />
      <pointLight position={[-10, 8, -10]} intensity={0.6} color="#ffb3d9" />

      {/* Anchors */}
      {visibleAnchors.map((i) => {
        getAnchorPos(baseSeed, i, tmpA);
        return (
          <group key={`a-${i}`} position={[tmpA.x, 0, tmpA.z]}>
            {/* Pylon body - purple */}
            <mesh
              geometry={pylonGeo}
              material={pylonMat}
              position={[0, 0.45, 0]}
              castShadow
              receiveShadow
            />
            {/* Glowing yellow top */}
            <mesh
              geometry={pylonTopGeo}
              material={pylonTopMat}
              position={[0, 0.96, 0]}
              castShadow
            />
            {/* Glow ring around top */}
            <mesh position={[0, 0.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.28, 0.38, 32]} />
              <meshBasicMaterial color="#facc15" transparent opacity={0.5} />
            </mesh>
            {/* Connection lines to next pylon */}
            {(() => {
              const currentIdx = visibleAnchors.indexOf(i);
              if (currentIdx >= 0 && currentIdx < visibleAnchors.length - 1) {
                const nextIdx = visibleAnchors[currentIdx + 1];
                if (nextIdx !== undefined) {
                  const tmpB = new THREE.Vector3();
                  getAnchorPos(baseSeed, nextIdx, tmpB);
                  const points = [
                    new THREE.Vector3(0, 0.96, 0),
                    new THREE.Vector3(tmpB.x - tmpA.x, 0.96, tmpB.z - tmpA.z),
                  ];
                  const lineGeo = new THREE.BufferGeometry().setFromPoints(
                    points
                  );
                  const lineObj = new THREE.Line(lineGeo, lineMat);
                  return <primitive key={`line-${i}`} object={lineObj} />;
                }
              }
              return null;
            })()}
          </group>
        );
      })}

      {/* Hazards */}
      {visibleHazards.map((i) => {
        getHazard(baseSeed, i, tmpHaz);
        return (
          <mesh
            key={`h-${i}`}
            geometry={hazardGeo}
            material={hazardMat}
            position={tmpHaz.pos}
            scale={tmpHaz.r / 0.24}
          />
        );
      })}

      {/* Player ball - red */}
      <mesh ref={ballRef} castShadow receiveShadow>
        <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
        <primitive object={ballMat} attach="material" />
      </mesh>

      {/* Orbit trail effect - rendered dynamically */}
      <OrbitTrail
        baseSeed={baseSeed}
        anchorIdx={sim.current.anchorIdx}
        mode={sim.current.mode}
        angle={sim.current.angle}
        ORBIT_RADIUS={ORBIT_RADIUS}
        BALL_Y={BALL_Y}
        getAnchorPos={getAnchorPos}
      />
    </group>
  );
}

function OrbitTrail({
  baseSeed,
  anchorIdx,
  mode,
  ORBIT_RADIUS,
  BALL_Y,
  getAnchorPos,
}: {
  baseSeed: number;
  anchorIdx: number;
  mode: 'orbit' | 'flight';
  angle: number;
  ORBIT_RADIUS: number;
  BALL_Y: number;
  getAnchorPos: (
    baseSeed: number,
    index: number,
    out: THREE.Vector3
  ) => THREE.Vector3;
}) {
  const lineRef = useRef<THREE.Line | null>(null);
  const tmpA = useMemo(() => new THREE.Vector3(), []);

  // Create line object once
  const lineObj = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.4,
    });
    return new THREE.Line(geometry, material);
  }, []);

  useEffect(() => {
    lineRef.current = lineObj;
    return () => {
      lineObj.geometry.dispose();
      (lineObj.material as THREE.Material).dispose();
    };
  }, [lineObj]);

  useFrame(() => {
    if (mode !== 'orbit' || !lineRef.current) return;
    getAnchorPos(baseSeed, anchorIdx, tmpA);
    const orbitPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      orbitPoints.push(
        new THREE.Vector3(
          Math.cos(a) * ORBIT_RADIUS,
          BALL_Y,
          Math.sin(a) * ORBIT_RADIUS
        )
      );
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    lineRef.current.geometry.dispose();
    lineRef.current.geometry = orbitGeo;
    lineRef.current.position.set(tmpA.x, 0, tmpA.z);
  });

  if (mode !== 'orbit') return null;

  return <primitive object={lineObj} />;
}
