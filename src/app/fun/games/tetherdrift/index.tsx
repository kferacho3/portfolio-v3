// @ts-nocheck
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html, Sky, Stars, Torus } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  ArcadeHudCard,
  ArcadeHudPill,
  ArcadeHudShell,
} from '../../components/shell/ArcadeHudPanel';
import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { tetherDriftState } from './state';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ARENA_SIZE = 72;
const HALF = ARENA_SIZE / 2;

const PLAYER_R = 1.1;
const GATE_R = 1.6;

const BOOST_CD = 1.25;
const BOOST_IMPULSE = 10.5;
const LASER_TELEGRAPH = 1.1;
const PERFECT_TENSION_MIN = 14;
const PERFECT_TENSION_MAX = 32;
const BEST_SCORE_KEY = 'tetherdrift-best-score';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

type EventType = 'TwinLasers' | 'ShockPylon' | 'LowGravity' | null;

type Pylon = { id: string; pos: THREE.Vector3 };

const clampArenaXZ = (p: THREE.Vector3) => {
  p.x = clamp(p.x, -HALF + 2.2, HALF - 2.2);
  p.z = clamp(p.z, -HALF + 2.2, HALF - 2.2);
};

function randomDirXZ(): THREE.Vector3 {
  const a = Math.random() * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
}

function spawnGateDonut(
  base: THREE.Vector3,
  forward: THREE.Vector3
): THREE.Vector3 {
  const fwd = forward.clone();
  fwd.y = 0;
  if (fwd.lengthSq() < 0.0001) fwd.copy(randomDirXZ());
  fwd.normalize();

  for (let i = 0; i < 30; i++) {
    const cone = THREE.MathUtils.degToRad(60);
    const a = (Math.random() * 2 - 1) * cone;
    const r = THREE.MathUtils.randFloat(10, 22);

    const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    const p = base.clone().addScaledVector(dir, r);
    p.y = 1.15;

    if (p.x < -HALF + 7 || p.x > HALF - 7 || p.z < -HALF + 7 || p.z > HALF - 7)
      continue;
    return p;
  }

  return new THREE.Vector3(
    THREE.MathUtils.randFloat(-HALF + 7, HALF - 7),
    1.15,
    THREE.MathUtils.randFloat(-HALF + 7, HALF - 7)
  );
}

const GateMesh: React.FC<{ pos: THREE.Vector3; active: boolean }> = ({
  pos,
  active,
}) => (
  <Torus
    position={[pos.x, pos.y, pos.z]}
    args={[1.45, 0.26, 14, 28]}
    rotation={[Math.PI / 2, 0, 0]}
  >
    <meshStandardMaterial
      color={active ? '#22d3ee' : '#facc15'}
      emissive={active ? '#22d3ee' : '#f59e0b'}
      emissiveIntensity={active ? 0.65 : 0.25}
      metalness={0.2}
      roughness={0.5}
    />
  </Torus>
);

const PylonMesh: React.FC<{ pylon: Pylon; shock?: boolean }> = ({
  pylon,
  shock,
}) => (
  <group position={[pylon.pos.x, 0, pylon.pos.z]}>
    <mesh castShadow>
      <cylinderGeometry args={[0.55, 0.75, 3.0, 12]} />
      <meshStandardMaterial color="#0f172a" metalness={0.35} roughness={0.85} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
      <torusGeometry args={[0.9, 0.09, 10, 24]} />
      <meshStandardMaterial
        color="#1e293b"
        emissive="#38bdf8"
        emissiveIntensity={0.25}
      />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.7, 0]}>
      <torusGeometry args={[0.75, 0.08, 10, 24]} />
      <meshStandardMaterial
        color={shock ? '#fb7185' : '#7dd3fc'}
        emissive={shock ? '#fb7185' : '#38bdf8'}
        emissiveIntensity={0.55}
      />
    </mesh>
    <mesh castShadow position={[0, 2.05, 0]}>
      <sphereGeometry args={[0.25, 16, 16]} />
      <meshStandardMaterial
        color={shock ? '#fb7185' : '#a78bfa'}
        emissive={shock ? '#fb7185' : '#a78bfa'}
        emissiveIntensity={shock ? 0.85 : 0.45}
      />
    </mesh>
  </group>
);

const LaserBar: React.FC<{
  angleRef: React.MutableRefObject<number>;
  strengthRef: React.MutableRefObject<number>;
  offset?: number;
}> = ({ angleRef, strengthRef, offset = 0 }) => {
  const ref = useRef<THREE.Mesh | null>(null);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const len = ARENA_SIZE * 0.92;
  const w = 0.55;

  useFrame(() => {
    if (!ref.current || !matRef.current) return;
    const strength = strengthRef.current;
    ref.current.visible = strength > 0.02;
    ref.current.rotation.set(0, angleRef.current + offset, 0);
    matRef.current.emissiveIntensity = 0.45 * strength;
    matRef.current.opacity = 0.25 + 0.55 * strength;
  });

  return (
    <mesh ref={ref} position={[0, 1.0, 0]} visible={false}>
      <boxGeometry args={[len, 0.18, w]} />
      <meshStandardMaterial
        ref={matRef}
        color="#ef4444"
        emissive="#7f1d1d"
        emissiveIntensity={0.2}
        transparent
        opacity={0.25}
      />
    </mesh>
  );
};

const NeonDome: React.FC<{ accentA: string; accentB: string }> = ({
  accentA,
  accentB,
}) => {
  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(accentA) },
        uB: { value: new THREE.Color(accentB) },
      },
      vertexShader: `
        varying vec3 vPos;
        varying vec3 vN;
        void main(){
          vPos = position;
          vN = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uA;
        uniform vec3 uB;
        varying vec3 vPos;
        varying vec3 vN;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        void main(){
          vec3 n = normalize(vN);
          float h = clamp(n.y*0.5+0.5, 0.0, 1.0);
          float bands = sin((vPos.z*0.025) + uTime*0.8) * 0.08;
          float stars = step(0.988, hash(floor(vPos.xz*0.28))) * 0.85;
          vec3 col = mix(uB, uA, h + bands);
          col += stars * vec3(0.9, 0.95, 1.0);
          float v = smoothstep(240.0, 80.0, length(vPos.xz));
          col *= mix(0.55, 1.0, v);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [accentA, accentB]);

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });

  return (
    <mesh>
      <icosahedronGeometry args={[260, 2]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
};

const LowPolyGround: React.FC = () => {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 22, 22);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const ripple = Math.sin((x + z) * 0.16) * 0.12;
      const bowl = (-Math.hypot(x, z) / (ARENA_SIZE * 0.65)) * 0.55;
      pos.setY(i, -0.02 + ripple + bowl);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial
        color="#070b12"
        roughness={0.95}
        metalness={0.05}
        flatShading
      />
    </mesh>
  );
};

const ScenePostFX: React.FC<{ boost: number }> = ({ boost }) => {
  const strength = clamp(0.55 + boost * 1.05, 0.55, 1.7);
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={strength} luminanceThreshold={0.2} mipmapBlur />
      <ChromaticAberration
        offset={new THREE.Vector2(0.00085, 0.0007)}
        radialModulation={false}
        modulationOffset={0}
      />
      <Noise opacity={0.05} />
      <Vignette eskil={false} offset={0.3} darkness={0.75} />
    </EffectComposer>
  );
};

const PlayerTrail: React.FC<{
  target: React.RefObject<THREE.Object3D>;
  color: string;
}> = ({ target, color }) => {
  const geomRef = useRef<THREE.BufferGeometry | null>(null);
  const attrRef = useRef<THREE.BufferAttribute | null>(null);
  const ring = useMemo(() => new Float32Array(70 * 3), []);
  const ordered = useMemo(() => new Float32Array(70 * 3), []);
  const countRef = useRef(0);
  const headRef = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!geomRef.current) return;
    const attr = new THREE.BufferAttribute(ordered, 3);
    attrRef.current = attr;
    geomRef.current.setAttribute('position', attr);
    geomRef.current.setDrawRange(0, 0);
  }, [ordered]);

  useFrame(() => {
    const obj = target.current;
    const geom = geomRef.current;
    const attr = attrRef.current;
    if (!obj || !geom || !attr) return;
    obj.getWorldPosition(tmp);

    const head = headRef.current;
    ring[head * 3] = tmp.x;
    ring[head * 3 + 1] = tmp.y + 0.12;
    ring[head * 3 + 2] = tmp.z;

    headRef.current = (head + 1) % 70;
    countRef.current = Math.min(70, countRef.current + 1);
    const n = countRef.current;
    if (n <= 0) {
      geom.setDrawRange(0, 0);
      return;
    }
    const start = headRef.current;
    for (let i = 0; i < n; i++) {
      const src = ((start + i) % 70) * 3;
      const dst = i * 3;
      ordered[dst] = ring[src];
      ordered[dst + 1] = ring[src + 1];
      ordered[dst + 2] = ring[src + 2];
    }
    for (let i = n; i < 70; i++) {
      const dst = i * 3;
      const last = (n - 1) * 3;
      ordered[dst] = ordered[last];
      ordered[dst + 1] = ordered[last + 1];
      ordered[dst + 2] = ordered[last + 2];
    }
    geom.setDrawRange(0, n);
    attr.needsUpdate = true;
  });

  return (
    <line frustumCulled={false}>
      <bufferGeometry ref={geomRef} />
      <lineBasicMaterial color={color} transparent opacity={0.45} />
    </line>
  );
};

const OrbitRings: React.FC = () => {
  const rings = [12, 20, 28];
  return (
    <group position={[0, 0.02, 0]}>
      {rings.map((r) => (
        <mesh key={`orbit-ring-${r}`} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.06, 8, 64]} />
          <meshStandardMaterial
            color="#1e293b"
            emissive="#38bdf8"
            emissiveIntensity={0.18}
            transparent
            opacity={0.35}
          />
        </mesh>
      ))}
    </group>
  );
};

const TetherDriftHUD: React.FC<{ event: EventType; eventTime: number }> = ({
  event,
  eventTime,
}) => {
  const s = useSnapshot(tetherDriftState);
  const heat = Math.round(s.heat);
  const heatMult = 1 + (s.heat / 100) * 0.75;
  const flash = s.perfectFlash > 0 ? Math.min(1, s.perfectFlash / 0.2) : 0;
  const eventLabel =
    event === 'TwinLasers'
      ? 'Laser Sweep'
      : event === 'ShockPylon'
        ? 'Shock Anchor'
        : event === 'LowGravity'
          ? 'Low Gravity'
          : '';
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) tetherDriftState.bestScore = Number(stored) || 0;
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${s.bestScore}`);
  }, [s.bestScore]);
  const toastOpacity = clamp(s.toastTime / 1.1, 0, 1);
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      {flash > 0 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'rgba(34, 211, 238, 0.2)', opacity: flash }}
        />
      )}
      <ArcadeHudShell
        gameId="tetherdrift"
        className="absolute top-4 left-4 pointer-events-auto"
      >
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[11px] uppercase tracking-[0.32em] text-white/60">
            Orbit Sling
          </div>
          <div className="text-[11px] text-white/45">
            Latch → Orbit → Release
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.32em] text-white/50">
            Score
          </div>
          <div className="text-2xl font-semibold text-white">
            {s.score.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/50">
            Best {s.bestScore.toLocaleString()}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ArcadeHudPill label={`Chain x${s.chain}`} />
            <ArcadeHudPill label={`Timer ${s.chainTime.toFixed(1)}s`} />
            <ArcadeHudPill
              label={`Heat ${heat}%`}
              tone={heat >= 80 ? 'warn' : 'default'}
            />
            {heat > 0 && (
              <ArcadeHudPill
                label={`Heat x${heatMult.toFixed(2)}`}
                tone="accent"
              />
            )}
            {event && (
              <ArcadeHudPill
                label={`${eventLabel} ${Math.ceil(eventTime)}s`}
                tone="accent"
              />
            )}
          </div>

          <div className="mt-3 space-y-2 text-[11px] text-white/70">
            <div className="flex items-center justify-between">
              <span>Chain window</span>
              <span>{s.chainTime.toFixed(1)}s</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{ width: `${clamp((s.chainTime / 3) * 100, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Heat</span>
              <span>{heat}%</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-rose-400/70"
                style={{ width: `${clamp(heat, 0, 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            Hold Click latch • Release sling • WASD trim • Space boost • Shift
            brake
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {s.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="tetherdrift">
            <ArcadeHudCard className="text-center">
              <div className="text-3xl font-semibold text-white">Game Over</div>
              <div className="mt-2 text-lg text-white/80">
                Final Score: {s.score.toLocaleString()}
              </div>
              <div className="mt-4 text-[11px] uppercase tracking-[0.3em] text-white/50">
                Press R to restart
              </div>
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}

      {s.toastTime > 0 && s.toastText && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ opacity: toastOpacity }}
        >
          <ArcadeHudShell gameId="tetherdrift">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">
              {s.toastText}
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </Html>
  );
};

const TetherDrift: React.FC = () => {
  const { camera } = useThree();
  const { paused } = useGameUIState();

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [
      ' ',
      'Space',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
    ],
  });

  const pylons = useMemo<Pylon[]>(
    () => [
      { id: 'p1', pos: new THREE.Vector3(-20, 0, -18) },
      { id: 'p2', pos: new THREE.Vector3(20, 0, -16) },
      { id: 'p3', pos: new THREE.Vector3(-18, 0, 20) },
      { id: 'p4', pos: new THREE.Vector3(18, 0, 18) },
      { id: 'p5', pos: new THREE.Vector3(0, 0, 0) },
      { id: 'p6', pos: new THREE.Vector3(0, 0, -26) },
    ],
    []
  );

  const playerRef = useRef<THREE.Mesh | null>(null);
  const posRef = useRef(new THREE.Vector3(0, 1.2, 14));
  const velRef = useRef(new THREE.Vector3(0, 0, -10));

  const tetheredRef = useRef(false);
  const anchorRef = useRef<Pylon | null>(null);
  const ropeRRef = useRef(10);
  const angVelRef = useRef(2.2);

  const boostCdRef = useRef(0);
  const ropeRef = useRef<THREE.Line | null>(null);
  const ropeGeom = useMemo(() => new THREE.BufferGeometry(), []);
  const ropePoints = useMemo(
    () => [new THREE.Vector3(), new THREE.Vector3()],
    []
  );
  const arrowRef = useRef<THREE.Group | null>(null);
  const constellationBurstRef = useRef({ time: 0, pos: new THREE.Vector3() });
  const burstMeshRef = useRef<THREE.Mesh | null>(null);
  const burstMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const [gates, setGates] = useState<THREE.Vector3[]>([]);
  const [activeGateIdx, setActiveGateIdx] = useState(0);
  const pathRef = useRef<THREE.Line | null>(null);
  const pathGeom = useMemo(() => new THREE.BufferGeometry(), []);

  const perfectArmedUntilRef = useRef(0);
  const eventRef = useRef<{
    type: EventType;
    startsAt: number;
    endsAt: number;
    duration: number;
    shockPylonId: string | null;
  }>({ type: null, startsAt: 0, endsAt: 0, duration: 0, shockPylonId: null });
  const nextEventAtRef = useRef(24);

  const laserAngleRef = useRef(0);
  const laserStrengthRef = useRef(0);

  const rebuildConstellation = (
    seedPos: THREE.Vector3,
    seedVel: THREE.Vector3
  ) => {
    const n = THREE.MathUtils.randInt(3, 7);
    const next: THREE.Vector3[] = [];

    let base = seedPos.clone();
    let dir = seedVel.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.1) dir.copy(randomDirXZ());

    for (let i = 0; i < n; i++) {
      base = spawnGateDonut(base, dir);
      next.push(base.clone());
      if (i > 0) dir = next[i].clone().sub(next[i - 1]);
    }

    setGates(next);
    setActiveGateIdx(0);
    tetherDriftState.chainTime = Math.max(2.4, tetherDriftState.chainTime);
  };

  useEffect(() => {
    // Initialize once on mount
    rebuildConstellation(posRef.current, velRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const points = gates
      .slice(activeGateIdx)
      .map((g) => new THREE.Vector3(g.x, 1.12, g.z));
    if (points.length < 2) {
      if (pathRef.current) pathRef.current.visible = false;
      return;
    }
    pathGeom.setFromPoints(points);
    if (pathRef.current) pathRef.current.visible = true;
  }, [activeGateIdx, gates, pathGeom]);

  const findNearestPylon = (p: THREE.Vector3): Pylon => {
    let best = pylons[0];
    let bestD = Infinity;
    for (const py of pylons) {
      const d =
        (py.pos.x - p.x) * (py.pos.x - p.x) +
        (py.pos.z - p.z) * (py.pos.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = py;
      }
    }
    return best;
  };

  useFrame((_, dt) => {
    // Camera follow always
    camera.position.lerp(
      new THREE.Vector3(posRef.current.x, 13.5, posRef.current.z + 19),
      0.08
    );
    camera.lookAt(posRef.current.x, posRef.current.y, posRef.current.z);

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    if (tetherDriftState.gameOver) {
      clearFrameInput(inputRef);
      return;
    }

    const timeScale = tetherDriftState.slowMoTime > 0 ? 0.6 : 1;
    const step = dt * timeScale;

    tetherDriftState.tick(step);
    boostCdRef.current = Math.max(0, boostCdRef.current - step);

    const keys = inputRef.current.keysDown;
    const justPressed = inputRef.current.justPressed;
    const pointerDown = inputRef.current.pointerDown;
    const pointerJustDown = inputRef.current.pointerJustDown;
    const pointerJustUp = inputRef.current.pointerJustUp;
    const braking = keys.has('shift');

    // Event deck (simple)
    if (tetherDriftState.elapsed >= nextEventAtRef.current) {
      const roll = Math.random();
      const type: EventType =
        roll < 0.34 ? 'TwinLasers' : roll < 0.67 ? 'ShockPylon' : 'LowGravity';
      eventRef.current.type = type;
      eventRef.current.duration = 9;
      eventRef.current.startsAt = tetherDriftState.elapsed;
      eventRef.current.endsAt =
        tetherDriftState.elapsed + eventRef.current.duration;
      eventRef.current.shockPylonId =
        type === 'ShockPylon'
          ? pylons[Math.floor(Math.random() * pylons.length)].id
          : null;
      nextEventAtRef.current = tetherDriftState.elapsed + 28;
    }
    if (
      eventRef.current.type &&
      tetherDriftState.elapsed >= eventRef.current.endsAt
    ) {
      eventRef.current.type = null;
      eventRef.current.shockPylonId = null;
      eventRef.current.duration = 0;
    }

    // Tether transitions
    if (pointerJustDown && !tetheredRef.current) {
      tetheredRef.current = true;
      anchorRef.current = findNearestPylon(posRef.current);
      ropeRRef.current = clamp(
        posRef.current.distanceTo(anchorRef.current.pos),
        6,
        18
      );
      angVelRef.current = clamp(angVelRef.current, 1.6, 5.5);
    }

    if (pointerJustUp && tetheredRef.current) {
      // Detach: fling tangent
      const a = anchorRef.current;
      if (a) {
        const off = posRef.current.clone().sub(a.pos);
        off.y = 0;
        if (off.lengthSq() < 0.0001) off.set(0, 0, 1);
        off.normalize();
        const tangent = new THREE.Vector3(-off.z, 0, off.x);
        const spd = clamp(
          Math.abs(angVelRef.current) * ropeRRef.current * 0.7,
          6,
          32
        );
        velRef.current.copy(tangent.multiplyScalar(spd));

        // Perfect-release “contract” for the next active gate
        const nextGate = gates[activeGateIdx];
        if (nextGate) {
          const toGate = nextGate.clone().sub(posRef.current);
          toGate.y = 0;
          if (toGate.lengthSq() > 0.1) {
            toGate.normalize();
            const vDir = velRef.current.clone().normalize();
            const dot = vDir.dot(toGate);
            const tension = (spd * spd) / Math.max(ropeRRef.current, 0.1);
            const tensionSweet =
              tension > PERFECT_TENSION_MIN && tension < PERFECT_TENSION_MAX;
            if (dot > 0.92 && tensionSweet) {
              perfectArmedUntilRef.current = tetherDriftState.elapsed + 1.25;
            }
          }
        }
      }

      tetheredRef.current = false;
      anchorRef.current = null;
    }

    // Space boost
    const wantsBoost = justPressed.has(' ') || justPressed.has('space');
    if (wantsBoost && boostCdRef.current <= 0) {
      boostCdRef.current = BOOST_CD;
      const v = velRef.current.clone();
      const dir =
        v.lengthSq() > 0.2 ? v.normalize() : new THREE.Vector3(0, 0, -1);
      velRef.current.addScaledVector(dir, BOOST_IMPULSE);
      tetherDriftState.addScore(6);
    }

    // Controls
    const ix =
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const iz =
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
      (keys.has('w') || keys.has('arrowup') ? 1 : 0);

    if (pointerDown && tetheredRef.current && anchorRef.current) {
      // Tethered orbit
      const a = anchorRef.current;

      // A/D changes orbit speed; W/S reels
      angVelRef.current = clamp(angVelRef.current + ix * 2.3 * step, 0.9, 6.2);
      ropeRRef.current = clamp(ropeRRef.current + iz * 7.2 * step, 5.5, 18.5);

      const off = posRef.current.clone().sub(a.pos);
      off.y = 0;
      if (off.lengthSq() < 0.0001) off.set(0, 0, 1);

      off
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), angVelRef.current * step)
        .setLength(ropeRRef.current);
      posRef.current.copy(a.pos).add(off);
      clampArenaXZ(posRef.current);

      // Keep a tangential velocity “estimate” so release feels consistent
      const tDir = new THREE.Vector3(-off.z, 0, off.x).normalize();
      velRef.current.copy(
        tDir.multiplyScalar(
          clamp(Math.abs(angVelRef.current) * ropeRRef.current * 0.65, 6, 30)
        )
      );

      // Cool heat while tethered (encourages alternation)
      tetherDriftState.setHeat(tetherDriftState.heat - 28 * step);

      // Shock pylon event: tethering the hot pylon pops you off
      if (
        eventRef.current.type === 'ShockPylon' &&
        eventRef.current.shockPylonId &&
        a.id === eventRef.current.shockPylonId
      ) {
        tetheredRef.current = false;
        anchorRef.current = null;
        velRef.current.addScaledVector(tDir, 6);
        tetherDriftState.damage(10);
      }
    } else {
      // Free flight
      const thr = new THREE.Vector3(ix, 0, iz);
      if (thr.lengthSq() > 0.0001) thr.normalize();

      // Heat makes steering “sloppy” (tiny drift)
      const heat = tetherDriftState.heat;
      const drift = heat > 70 ? (heat - 70) / 30 : 0;
      const chaos = drift * 0.65;
      const chaoticThr = thr
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * chaos,
            0,
            (Math.random() - 0.5) * chaos
          )
        );
      if (chaoticThr.lengthSq() > 0.0001) chaoticThr.normalize();

      velRef.current.addScaledVector(chaoticThr, 18 * step);

      // Damping (low gravity event = more drift)
      const baseDamping =
        eventRef.current.type === 'LowGravity' ? 0.985 : 0.972;
      velRef.current.multiplyScalar(baseDamping);

      if (braking) {
        velRef.current.multiplyScalar(0.9);
        tetherDriftState.setHeat(tetherDriftState.heat - 28 * step);
      }

      posRef.current.addScaledVector(velRef.current, step);
      clampArenaXZ(posRef.current);

      // Build heat with speed
      const spd = velRef.current.length();
      tetherDriftState.setHeat(tetherDriftState.heat + (spd / 24) * 18 * step);
    }

    // Gate pass
    const gate = gates[activeGateIdx];
    if (gate) {
      const dx = posRef.current.x - gate.x;
      const dz = posRef.current.z - gate.z;
      if (
        dx * dx + dz * dz <
        (GATE_R + PLAYER_R * 0.45) * (GATE_R + PLAYER_R * 0.45)
      ) {
        const perfect =
          tetherDriftState.elapsed <= perfectArmedUntilRef.current;
        perfectArmedUntilRef.current = 0;

        const nextIdx = activeGateIdx + 1;
        const done = nextIdx >= gates.length;
        tetherDriftState.onGatePassed({ perfect, constellationDone: done });

        if (done) {
          constellationBurstRef.current.pos.copy(gate);
          constellationBurstRef.current.time = 0.6;
          rebuildConstellation(posRef.current, velRef.current);
        } else {
          setActiveGateIdx(nextIdx);
          tetherDriftState.chainTime = Math.max(
            2.4,
            tetherDriftState.chainTime
          );
        }
      }
    }

    // Laser sweep collision (event-driven)
    if (
      eventRef.current.type === 'TwinLasers' &&
      eventRef.current.duration > 0
    ) {
      laserAngleRef.current += step * 0.9;
      const eventElapsed = tetherDriftState.elapsed - eventRef.current.startsAt;
      laserStrengthRef.current = clamp(eventElapsed / LASER_TELEGRAPH, 0.2, 1);
      const live = eventElapsed >= LASER_TELEGRAPH;
      if (live) {
        const a = laserAngleRef.current;
        const distToLine = Math.abs(
          Math.sin(a) * posRef.current.x - Math.cos(a) * posRef.current.z
        );
        const touching = distToLine < 0.55;
        if (touching) tetherDriftState.damage(22 * step);

        const a2 = a + Math.PI / 2;
        const dist2 = Math.abs(
          Math.sin(a2) * posRef.current.x - Math.cos(a2) * posRef.current.z
        );
        if (dist2 < 0.55) tetherDriftState.damage(22 * step);
      }
    } else {
      laserStrengthRef.current = 0;
    }

    // Apply to mesh
    if (playerRef.current) {
      playerRef.current.position.copy(posRef.current);
    }

    if (ropeRef.current) {
      if (tetheredRef.current && anchorRef.current) {
        ropeRef.current.visible = true;
        ropePoints[0].copy(anchorRef.current.pos);
        ropePoints[1].copy(posRef.current);
        ropeGeom.setFromPoints(ropePoints);
      } else {
        ropeRef.current.visible = false;
      }
    }

    if (arrowRef.current) {
      if (gate) {
        const dx = gate.x - posRef.current.x;
        const dz = gate.z - posRef.current.z;
        if (dx * dx + dz * dz > 0.01) {
          arrowRef.current.visible = true;
          arrowRef.current.position.set(
            posRef.current.x,
            3.1,
            posRef.current.z
          );
          arrowRef.current.rotation.set(0, Math.atan2(dx, dz), 0);
        } else {
          arrowRef.current.visible = false;
        }
      } else {
        arrowRef.current.visible = false;
      }
    }

    if (
      constellationBurstRef.current.time > 0 &&
      burstMeshRef.current &&
      burstMatRef.current
    ) {
      constellationBurstRef.current.time = Math.max(
        0,
        constellationBurstRef.current.time - step
      );
      const t = 1 - constellationBurstRef.current.time / 0.6;
      burstMeshRef.current.visible = true;
      burstMeshRef.current.position.set(
        constellationBurstRef.current.pos.x,
        0.2,
        constellationBurstRef.current.pos.z
      );
      const scale = 1 + t * 3.2;
      burstMeshRef.current.scale.set(scale, scale, scale);
      burstMatRef.current.opacity = 0.45 * (1 - t);
    } else if (burstMeshRef.current) {
      burstMeshRef.current.visible = false;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <TetherDriftHUD
        event={eventRef.current.type}
        eventTime={
          eventRef.current.type
            ? Math.max(0, eventRef.current.endsAt - tetherDriftState.elapsed)
            : 0
        }
      />
      <Sky />
      <fog attach="fog" args={['#061120', 40, 140]} />
      <Stars
        radius={220}
        depth={60}
        count={1400}
        factor={4}
        saturation={0}
        fade
      />
      <ambientLight intensity={0.38} />
      <directionalLight position={[22, 30, 14]} intensity={1.1} castShadow />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#070b12" />
      </mesh>
      <OrbitRings />

      {/* Pylons */}
      {pylons.map((p) => (
        <PylonMesh
          key={p.id}
          pylon={p}
          shock={
            eventRef.current.type === 'ShockPylon' &&
            eventRef.current.shockPylonId === p.id
          }
        />
      ))}

      <line ref={pathRef} geometry={pathGeom} visible={false}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.4} />
      </line>

      {/* Gates */}
      {gates.map((g, idx) => (
        <GateMesh
          key={`${g.x.toFixed(2)}-${g.z.toFixed(2)}-${idx}`}
          pos={g}
          active={idx === activeGateIdx}
        />
      ))}

      <line ref={ropeRef} geometry={ropeGeom}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.55} />
      </line>

      <group ref={arrowRef}>
        <mesh position={[0, 0.2, 0.6]}>
          <boxGeometry args={[0.18, 0.18, 1.1]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#f59e0b"
            emissiveIntensity={0.4}
          />
        </mesh>
        <mesh position={[0, 0.2, 1.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.32, 0.6, 10]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#f59e0b"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>

      <mesh ref={burstMeshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.2, 1.9, 32]} />
        <meshStandardMaterial
          ref={burstMatRef}
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.65}
          transparent
          opacity={0}
        />
      </mesh>

      {/* Lasers */}
      <LaserBar angleRef={laserAngleRef} strengthRef={laserStrengthRef} />
      <LaserBar
        angleRef={laserAngleRef}
        strengthRef={laserStrengthRef}
        offset={Math.PI / 2}
      />

      {/* Player */}
      <mesh ref={playerRef} castShadow>
        <sphereGeometry args={[PLAYER_R, 28, 28]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.18}
        />
      </mesh>
    </>
  );
};

export default TetherDrift;
export * from './state';
