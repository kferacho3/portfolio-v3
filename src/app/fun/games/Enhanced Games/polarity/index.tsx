'use client';

import { Html, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Physics, useBox, usePlane, useSphere } from '@react-three/cannon';
import { useSnapshot } from 'valtio';
import { ArcadeHudCard, ArcadeHudPill, ArcadeHudShell } from '../../components/shell/ArcadeHudPanel';
import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { polarityState, type PolarityCharge, type PolarityEvent } from './state';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ARENA_SIZE = 70;
const HALF = ARENA_SIZE / 2;

const PLAYER_RADIUS = 1.15;
const PLAYER_MASS = 1.25;

const BASE_MOVE_FORCE = 75;
const MAX_SPEED = 26;
const SPEED_SOFT_CAP_FORCE = 14;

const MAGNET_BASE_STRENGTH = 1750; // scaled by difficulty and distance
const MAGNET_MIN_DIST = 2.4;
const MAGNET_MAX_FORCE = 220;

const ION_COUNT = 34;
const SPIKE_BASE_COUNT = 12;

const ION_PICKUP_RADIUS = 2.1;
const SPIKE_HIT_RADIUS = 1.9;
const SPIKE_NEAR_RADIUS = 3.5;

const PYLON_WHIP_RADIUS = 3.1;
const PYLON_WHIP_SPEED = 14;

const ZONE_RADIUS = 8.5;
const ZONE_SCORE_MULT = 1.6;
const ZONE_MAGNET_BOOST = 1.45;

const ION_BLOOM_MIN = 6;
const ION_BLOOM_MAX = 10;

const PULSE_IMPULSE = 10.5;
const RESONANCE_BURST_RADIUS = 10.5;
const FLIP_PERFECT_RADIUS = 6.5;
const BEST_SCORE_KEY = 'polarity-best-score';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type IonKind = PolarityCharge;

interface Magnet {
  id: string;
  pos: THREE.Vector3;
  charge: PolarityCharge;
}

interface Ion {
  id: string;
  pos: THREE.Vector3;
  kind: IonKind;
}

interface Spike {
  id: string;
  pos: THREE.Vector3;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const randRange = (min: number, max: number) => min + Math.random() * (max - min);

const randSign = (): PolarityCharge => (Math.random() < 0.5 ? -1 : 1);

const randomInArena = (y: number): THREE.Vector3 =>
  new THREE.Vector3((Math.random() * ARENA_SIZE - HALF) * 0.95, y, (Math.random() * ARENA_SIZE - HALF) * 0.95);

const insideArena = (x: number, z: number, margin: number = 3) =>
  x > -HALF + margin && x < HALF - margin && z > -HALF + margin && z < HALF - margin;

const farFromSpikes = (pos: THREE.Vector3, spikes: Spike[], minDist: number) => {
  for (let i = 0; i < spikes.length; i++) {
    if (spikes[i].pos.distanceTo(pos) < minDist) return false;
  }
  return true;
};

function spawnAroundPlayer(
  player: THREE.Vector3,
  y: number,
  opts: { minDist: number; maxDist: number; attempts?: number } = { minDist: 8, maxDist: 26, attempts: 18 }
): THREE.Vector3 {
  const attempts = opts.attempts ?? 18;
  for (let i = 0; i < attempts; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = opts.minDist + Math.random() * (opts.maxDist - opts.minDist);
    const x = player.x + Math.cos(a) * r;
    const z = player.z + Math.sin(a) * r;
    if (x > -HALF + 3 && x < HALF - 3 && z > -HALF + 3 && z < HALF - 3) return new THREE.Vector3(x, y, z);
  }
  return randomInArena(y);
}

function spawnIonAhead(player: THREE.Vector3, forward: THREE.Vector3, spikes: Spike[]): THREE.Vector3 {
  const dir = forward.clone();
  dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
  dir.normalize();

  for (let i = 0; i < 30; i++) {
    const angle = (Math.random() * 2 - 1) * (Math.PI / 3); // ±60deg
    const r = randRange(7, 24);
    const rotated = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const x = player.x + rotated.x * r;
    const z = player.z + rotated.z * r;
    if (!insideArena(x, z, 3)) continue;
    const pos = new THREE.Vector3(x, 0.9, z);
    if (!farFromSpikes(pos, spikes, 3.2)) continue;
    return pos;
  }
  return randomInArena(0.9);
}

const chargeColors: Record<PolarityCharge, { main: string; emissive: string }> = {
  1: { main: '#22d3ee', emissive: '#06b6d4' },
  [-1]: { main: '#fb7185', emissive: '#e11d48' },
};

const NeonDome: React.FC<{ accentA: string; accentB: string }> = ({ accentA, accentB }) => {
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
          float waves = sin((vPos.x + vPos.z) * 0.03 + uTime * 0.6) * 0.06;
          float stars = step(0.985, hash(floor(vPos.xz*0.35))) * 0.85;
          vec3 col = mix(uB, uA, h + waves);
          col += stars * vec3(0.9, 0.95, 1.0);
          float v = smoothstep(220.0, 70.0, length(vPos.xz));
          col *= mix(0.5, 1.0, v);
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
      <icosahedronGeometry args={[240, 2]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
};

const LowPolyGroundVisual: React.FC<{ tint: string }> = ({ tint }) => {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 22, 22);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z) / (ARENA_SIZE * 0.6);
      const wobble = Math.sin(x * 0.18) * Math.cos(z * 0.16) * 0.18;
      const bowl = -r * r * 0.38;
      pos.setY(i, -0.58 + wobble + bowl);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial color={tint} roughness={0.95} metalness={0.05} flatShading />
    </mesh>
  );
};

const ScenePostFX: React.FC<{ boost: number }> = ({ boost }) => {
  const strength = clamp(0.6 + boost * 0.9, 0.6, 1.55);
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={strength} luminanceThreshold={0.18} mipmapBlur />
      <ChromaticAberration offset={new THREE.Vector2(0.0009, 0.00075)} />
      <Noise opacity={0.045} />
      <Vignette eskil={false} offset={0.28} darkness={0.78} />
    </EffectComposer>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SCENE PIECES
// ═══════════════════════════════════════════════════════════════════════════

const Ground: React.FC = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -0.7, 0],
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
      {/* physics collider; visual ground is rendered separately */}
      <meshStandardMaterial color="#050814" transparent opacity={0} />
    </mesh>
  );
};

const Wall: React.FC<{ position: [number, number, number]; size: [number, number, number] }> = ({ position, size }) => {
  const [ref] = useBox(() => ({
    type: 'Static',
    position,
    args: size,
  }));
  return (
    <mesh ref={ref} visible={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial />
    </mesh>
  );
};

const MagnetPylon: React.FC<{ magnet: Magnet }> = ({ magnet }) => {
  const c = chargeColors[magnet.charge];
  return (
    <group position={[magnet.pos.x, magnet.pos.y, magnet.pos.z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.55, 0.75, 3.0, 12]} />
        <meshStandardMaterial color="#0b1226" metalness={0.2} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial color={c.main} emissive={c.emissive} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
};

const IonMesh: React.FC<{ ion: Ion }> = ({ ion }) => {
  const c = chargeColors[ion.kind];
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const bob = Math.sin(t * 2 + ion.pos.x * 0.2 + ion.pos.z * 0.2) * 0.18;
    if (ref.current) ref.current.position.set(ion.pos.x, ion.pos.y + bob, ion.pos.z);
  });

  return (
    <mesh ref={ref} position={[ion.pos.x, ion.pos.y, ion.pos.z]} castShadow>
      <sphereGeometry args={[0.42, 14, 14]} />
      <meshStandardMaterial color={c.main} emissive={c.emissive} emissiveIntensity={0.55} />
    </mesh>
  );
};

const SpikeMesh: React.FC<{ spike: Spike }> = ({ spike }) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const wobble = Math.sin(t * 1.6 + spike.pos.x * 0.1) * 0.12;
    if (ref.current) ref.current.rotation.set(0, wobble, 0);
  });

  return (
    <mesh ref={ref} position={[spike.pos.x, spike.pos.y, spike.pos.z]} castShadow>
      <coneGeometry args={[0.85, 2.1, 8]} />
      <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.35} />
    </mesh>
  );
};

const PolarityHUD: React.FC = () => {
  const snap = useSnapshot(polarityState);
  const chargeLabel = snap.charge === 1 ? '+' : '−';
  const chargePill = snap.charge === 1 ? 'bg-cyan-500/20 text-cyan-200 border-cyan-300/20' : 'bg-rose-500/20 text-rose-200 border-rose-300/20';
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) polarityState.bestScore = Number(stored) || 0;
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${snap.bestScore}`);
  }, [snap.bestScore]);
  const toastOpacity = clamp(snap.toastTime / 1.1, 0, 1);

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <ArcadeHudShell gameId="polarity" className="absolute top-4 left-4 pointer-events-auto">
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">Score</div>
          <div className="text-2xl font-semibold text-white">{snap.score.toLocaleString()}</div>
          <div className="text-[11px] text-white/50">Best {snap.bestScore.toLocaleString()}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2 py-[3px] text-[9px] uppercase tracking-[0.24em] ${chargePill}`}>
              Charge {chargeLabel}
            </span>
            <ArcadeHudPill label={`Combo x${snap.combo}`} />
            <ArcadeHudPill label={`Lvl ${snap.level}`} />
            {snap.burstReady && <ArcadeHudPill label="Resonance Ready" tone="accent" />}
            {snap.zone && <ArcadeHudPill label={`Zone x${ZONE_SCORE_MULT}`} tone={snap.zoneActive ? 'accent' : 'default'} />}
            {snap.event && <ArcadeHudPill label={`${snap.event} ${Math.ceil(snap.eventTime)}s`} tone="accent" />}
          </div>

          <div className="mt-3 space-y-2 text-[11px] text-white/70">
            <div className="flex items-center justify-between">
              <span>Health</span>
              <span>{Math.round(snap.health)}%</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-400/80" style={{ width: `${clamp(snap.health, 0, 100)}%` }} />
            </div>

            <div className="flex items-center justify-between">
              <span>Instability</span>
              <span>{Math.round(snap.instability)}%</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-fuchsia-400/70" style={{ width: `${clamp(snap.instability, 0, 100)}%` }} />
            </div>

            <div className="flex items-center justify-between">
              <span>Combo window</span>
              <span>{snap.comboTime.toFixed(2)}s</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{ width: `${clamp((snap.comboTime / snap.comboTimeMax) * 100, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Pulse</span>
              <span>{snap.pulseCooldown > 0 ? snap.pulseCooldown.toFixed(1) : 'ready'}</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-amber-300/70"
                style={{ width: `${clamp((1 - snap.pulseCooldown / snap.pulseCooldownMax) * 100, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Resonance</span>
              <span>{Math.round(snap.resonance)}%</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-cyan-300/70" style={{ width: `${clamp(snap.resonance, 0, 100)}%` }} />
            </div>

            <div className="flex items-center justify-between">
              <span>Stabilize</span>
              <span>
                {snap.stabilizeTime > 0
                  ? snap.stabilizeTime.toFixed(1)
                  : snap.stabilizeCooldown > 0
                    ? snap.stabilizeCooldown.toFixed(1)
                    : 'ready'}
              </span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-sky-300/70"
                style={{
                  width: `${clamp(
                    snap.stabilizeTime > 0
                      ? (snap.stabilizeTime / 1.2) * 100
                      : (1 - snap.stabilizeCooldown / snap.stabilizeCooldownMax) * 100,
                    0,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            WASD roll • Space flip • Click pulse • Shift stabilize
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {snap.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="polarity">
            <ArcadeHudCard className="text-center">
              <div className="text-3xl font-semibold text-white">Game Over</div>
              <div className="mt-2 text-lg text-white/80">Final Score: {snap.score.toLocaleString()}</div>
              <div className="mt-4 text-[11px] uppercase tracking-[0.3em] text-white/50">Press R to restart</div>
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}

      {snap.toastTime > 0 && snap.toastText && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 pointer-events-none" style={{ opacity: toastOpacity }}>
          <ArcadeHudShell gameId="polarity">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">{snap.toastText}</ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </Html>
  );
};

const ZoneRing: React.FC = () => {
  const snap = useSnapshot(polarityState);
  if (!snap.zone) return null;

  const glow = snap.zoneActive ? 0.6 : 0.25;
  return (
    <group position={[snap.zone.x, -0.68, snap.zone.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[snap.zone.radius - 0.45, snap.zone.radius, 48]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={glow} transparent opacity={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[snap.zone.radius - 0.8, 40]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.2} transparent opacity={0.15} />
      </mesh>
    </group>
  );
};

const PlayerTrail: React.FC<{ target: React.RefObject<THREE.Object3D>; color: string }> = ({ target, color }) => {
  const geomRef = useRef<THREE.BufferGeometry | null>(null);
  const attrRef = useRef<THREE.BufferAttribute | null>(null);
  const ring = useMemo(() => new Float32Array(60 * 3), []);
  const ordered = useMemo(() => new Float32Array(60 * 3), []);
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
    ring[head * 3 + 0] = tmp.x;
    ring[head * 3 + 1] = tmp.y + 0.15;
    ring[head * 3 + 2] = tmp.z;

    headRef.current = (head + 1) % 60;
    countRef.current = Math.min(60, countRef.current + 1);

    // Reorder into a continuous strip (oldest -> newest)
    const n = countRef.current;
    const start = headRef.current;
    if (n <= 0) {
      geom.setDrawRange(0, 0);
      return;
    }
    for (let i = 0; i < n; i++) {
      const src = ((start + i) % 60) * 3;
      const dst = i * 3;
      ordered[dst] = ring[src];
      ordered[dst + 1] = ring[src + 1];
      ordered[dst + 2] = ring[src + 2];
    }

    // Fill remaining points (prevents stale segments when drawRange grows/shrinks)
    const last = (n - 1) * 3;
    for (let i = n; i < 60; i++) {
      const dst = i * 3;
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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GAME
// ═══════════════════════════════════════════════════════════════════════════

const PolarityWorld: React.FC = () => {
  const { camera } = useThree();
  const { paused } = useGameUIState();

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [' ', 'Space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
  });

  const lastPlayerPosRef = useRef(new THREE.Vector3(0, 1, 0));
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const tickAccRef = useRef(0);
  const lastLevelRef = useRef(1);
  const lastChargeRef = useRef<PolarityCharge>(polarityState.charge);
  const playerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastEventRef = useRef<PolarityEvent | null>(null);
  const stormRef = useRef<{ ids: string[]; originals: Record<string, PolarityCharge> } | null>(null);
  const spikeGrazeRef = useRef<Record<string, number>>({});
  const pylonWhipRef = useRef<Record<string, number>>({});
  const zoneActiveRef = useRef(false);
  const cameraDirRef = useRef(new THREE.Vector3());

  const [playerRef, playerApi] = useSphere(() => ({
    mass: PLAYER_MASS,
    position: [0, 1.2, 0],
    args: [PLAYER_RADIUS],
    linearDamping: 0.25,
    angularDamping: 0.75,
    userData: { type: 'player' },
  }));

  useEffect(() => {
    const unsub = playerApi.velocity.subscribe((v) => {
      velocityRef.current.set(v[0], v[1], v[2]);
    });
    return () => void unsub();
  }, [playerApi]);

  const [magnets, setMagnets] = useState<Magnet[]>(() =>
    Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      pos: randomInArena(0.8),
      charge: randSign(),
    }))
  );

  const [ions, setIons] = useState<Ion[]>(() =>
    Array.from({ length: ION_COUNT }, (_, i) => ({
      id: `ion-${i}`,
      pos: randomInArena(0.9),
      kind: randSign(),
    }))
  );

  const [spikes, setSpikes] = useState<Spike[]>(() =>
    Array.from({ length: SPIKE_BASE_COUNT }, (_, i) => ({
      id: `sp-${i}`,
      pos: randomInArena(0.35),
    }))
  );
  const spikesRef = useRef(spikes);

  useEffect(() => {
    spikesRef.current = spikes;
  }, [spikes]);

  const applyStorm = () => {
    setMagnets((prev) => {
      const picks = new Set<number>();
      while (picks.size < Math.min(2, prev.length)) {
        picks.add(Math.floor(Math.random() * prev.length));
      }

      const originals: Record<string, PolarityCharge> = {};
      const ids: string[] = [];
      const next = prev.map((m, idx) => {
        if (!picks.has(idx)) return m;
        originals[m.id] = m.charge;
        ids.push(m.id);
        return { ...m, charge: m.charge === 1 ? -1 : 1 };
      });

      stormRef.current = { ids, originals };
      return next;
    });
  };

  const clearStorm = () => {
    const storm = stormRef.current;
    if (!storm) return;
    setMagnets((prev) =>
      prev.map((m) => (storm.originals[m.id] ? { ...m, charge: storm.originals[m.id] } : m))
    );
    stormRef.current = null;
  };

  const spawnIonBloom = (player: THREE.Vector3, forward: THREE.Vector3) => {
    const up = new THREE.Vector3(0, 1, 0);
    const dir = forward.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
    dir.normalize();

    setIons((prev) => {
      const count = THREE.MathUtils.randInt(ION_BLOOM_MIN, ION_BLOOM_MAX);
      const picks = new Set<number>();
      while (picks.size < Math.min(count, prev.length)) {
        picks.add(Math.floor(Math.random() * prev.length));
      }
      const pickList = Array.from(picks);
      const arc = Math.PI / 2;
      const step = pickList.length > 1 ? arc / (pickList.length - 1) : 0;
      const start = -arc / 2;

      const next = [...prev];
      for (let i = 0; i < pickList.length; i++) {
        const idx = pickList[i];
        const angle = start + step * i;
        const radius = randRange(9, 16);
        const rotated = dir.clone().applyAxisAngle(up, angle);
        const pos = player.clone().addScaledVector(rotated, radius);
        pos.x = clamp(pos.x, -HALF + 3, HALF - 3);
        pos.z = clamp(pos.z, -HALF + 3, HALF - 3);
        pos.y = 0.9;

        const safePos = farFromSpikes(pos, spikesRef.current, 3.2) ? pos : spawnIonAhead(player, dir, spikesRef.current);
        next[idx] = { ...next[idx], pos: safePos, kind: randSign() };
      }

      return next;
    });
  };

  useFrame((state, dt) => {
    if (!playerRef.current) return;

    // Camera follow always, even when paused/gameover
    const p = playerRef.current.getWorldPosition(new THREE.Vector3());
    lastPlayerPosRef.current.copy(p);
    camera.position.lerp(new THREE.Vector3(p.x, 12.5, p.z + 18), 0.085);
    camera.lookAt(p.x, p.y, p.z);

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    if (!polarityState.gameOver) {
      const timeScale = polarityState.slowMoTime > 0 ? 0.6 : 1;
      const step = dt * timeScale;

      // Tick at ~30Hz so we don't force 60Hz React updates via Valtio
      tickAccRef.current += step;
      if (tickAccRef.current >= 1 / 30) {
        polarityState.tick(tickAccRef.current);
        tickAccRef.current = 0;
      }

      const forward = velocityRef.current.clone();
      forward.y = 0;
      if (forward.lengthSq() < 0.1) {
        camera.getWorldDirection(cameraDirRef.current);
        forward.set(cameraDirRef.current.x, 0, cameraDirRef.current.z);
      }
      if (forward.lengthSq() > 0.0001) forward.normalize();

      const event = polarityState.event;
      if (event !== lastEventRef.current) {
        if (lastEventRef.current === 'PolarityStorm') clearStorm();
        if (lastEventRef.current === 'Superconductor') {
          polarityState.zone = null;
          polarityState.zoneActive = false;
          zoneActiveRef.current = false;
        }

        if (event === 'PolarityStorm') {
          applyStorm();
        }

        if (event === 'Superconductor') {
          const zonePos = spawnAroundPlayer(p, 0, { minDist: 8, maxDist: 18 });
          polarityState.zone = { x: zonePos.x, z: zonePos.z, radius: ZONE_RADIUS };
        }

        if (event === 'IonBloom') {
          spawnIonBloom(p, forward);
        }

        lastEventRef.current = event;
      }

      // Apply charge color without React rerenders
      const currentCharge = polarityState.charge;
      if (currentCharge !== lastChargeRef.current && playerMatRef.current) {
        lastChargeRef.current = currentCharge;
        const c = chargeColors[currentCharge];
        playerMatRef.current.color.set(c.main);
        playerMatRef.current.emissive.set(c.emissive);
      }

      // Difficulty ramp: add more magnets/spikes when level increases
      const level = polarityState.level;
      if (level !== lastLevelRef.current) {
        lastLevelRef.current = level;
        const targetMagnets = clamp(6 + level, 7, 14);
        if (magnets.length < targetMagnets) {
          setMagnets((prev) => [
            ...prev,
            ...Array.from({ length: targetMagnets - prev.length }, (_, j) => ({
              id: `m-${prev.length + j}`,
              pos: spawnAroundPlayer(lastPlayerPosRef.current, 0.8, { minDist: 10, maxDist: 28 }),
              charge: randSign(),
            })),
          ]);
        }

        const targetSpikes = clamp(SPIKE_BASE_COUNT + (level - 1) * 2, SPIKE_BASE_COUNT, 26);
        if (spikes.length < targetSpikes) {
          setSpikes((prev) => [
            ...prev,
            ...Array.from({ length: targetSpikes - prev.length }, (_, j) => ({
              id: `sp-${prev.length + j}`,
              pos: spawnAroundPlayer(lastPlayerPosRef.current, 0.35, { minDist: 10, maxDist: 30 }),
            })),
          ]);
        }
      }

      const zone = polarityState.zone;
      let zoneMult = 1;
      let zoneBoost = 1;
      if (zone) {
        const dx = p.x - zone.x;
        const dz = p.z - zone.z;
        const inZone = dx * dx + dz * dz <= zone.radius * zone.radius;
        zoneMult = inZone ? ZONE_SCORE_MULT : 1;
        zoneBoost = inZone ? ZONE_MAGNET_BOOST : 1;
        if (zoneActiveRef.current !== inZone) {
          zoneActiveRef.current = inZone;
          polarityState.zoneActive = inZone;
        }
      } else if (zoneActiveRef.current) {
        zoneActiveRef.current = false;
        polarityState.zoneActive = false;
      }
      const resonanceMult = zoneActiveRef.current ? 1.35 : 1;

      // Input direction (XZ)
      const keys = inputRef.current.keysDown;
      const justPressed = inputRef.current.justPressed;
      const pointerDown = inputRef.current.pointerDown;

      // Space flips polarity
      if (justPressed.has(' ') || justPressed.has('space')) {
        let bestMagnet: Magnet | null = null;
        let bestD2 = Infinity;
        for (let i = 0; i < magnets.length; i++) {
          const m = magnets[i];
          if (m.charge !== polarityState.charge) continue;
          const d2 = m.pos.distanceToSquared(p);
          if (d2 < bestD2) {
            bestD2 = d2;
            bestMagnet = m;
          }
        }

        const flipPerfect = bestMagnet && bestD2 < FLIP_PERFECT_RADIUS * FLIP_PERFECT_RADIUS;
        polarityState.flipCharge();
        playerApi.applyImpulse([0, 0.25, 0], [0, 0, 0]);
        if (flipPerfect && bestMagnet) {
          const dir = bestMagnet.pos.clone().sub(p).normalize();
          playerApi.applyImpulse([dir.x * 4.5, 0.45, dir.z * 4.5], [0, 0, 0]);
          polarityState.onFlipPerfect(zoneMult, resonanceMult);
        }
      }

      // Click pulse
      if (pointerDown) {
        const pulse = polarityState.tryPulse();
        if (pulse === 'pulse') {
          const v = velocityRef.current.clone();
          const vLen = v.length();
          const fallbackDir = vLen > 0.5 ? v.divideScalar(vLen) : new THREE.Vector3(0, 0, -1);
          playerApi.applyImpulse([fallbackDir.x * PULSE_IMPULSE, 0.2, fallbackDir.z * PULSE_IMPULSE], [0, 0, 0]);
        } else if (pulse === 'burst') {
          const v = velocityRef.current.clone();
          const vLen = v.length();
          const fallbackDir = vLen > 0.5 ? v.divideScalar(vLen) : new THREE.Vector3(0, 0, -1);
          playerApi.applyImpulse([fallbackDir.x * (PULSE_IMPULSE * 1.4), 0.5, fallbackDir.z * (PULSE_IMPULSE * 1.4)], [0, 0, 0]);

          const burstR2 = RESONANCE_BURST_RADIUS * RESONANCE_BURST_RADIUS;
          setSpikes((prev) =>
            prev.map((spike) =>
              spike.pos.distanceToSquared(p) < burstR2
                ? { ...spike, pos: spawnAroundPlayer(p, 0.35, { minDist: 12, maxDist: 30 }) }
                : spike
            )
          );
          polarityState.onResonanceBurst(zoneMult);
        }
      }

      if (justPressed.has('shift')) {
        polarityState.tryStabilize();
      }

      let dx = 0;
      let dz = 0;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
      if (keys.has('w') || keys.has('arrowup')) dz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dz += 1;

      // Subtle pointer steering (works nicely with the follow cam)
      dx += inputRef.current.pointerX * 0.35;
      dz += inputRef.current.pointerY * 0.35;

      const stabilizing = polarityState.stabilizeTime > 0;
      const wobbling = polarityState.wobbleTime > 0 && !stabilizing;
      const wobbleFlip = wobbling ? polarityState.wobbleFlip : 1;
      dx *= wobbleFlip;
      dz *= wobbleFlip;
      if (wobbling) {
        dx += Math.sin(state.clock.elapsedTime * 12) * 0.15;
        dz += Math.cos(state.clock.elapsedTime * 10) * 0.15;
      }

      const steer = new THREE.Vector3(dx, 0, dz);
      if (steer.lengthSq() > 0.0001) steer.normalize();

      // Wobble reduces control (still lets magnets fling you around)
      const controlScale = wobbling ? 0.45 : stabilizing ? 1.05 : 1.0;
      playerApi.applyForce(
        [steer.x * BASE_MOVE_FORCE * controlScale * timeScale, 0, steer.z * BASE_MOVE_FORCE * controlScale * timeScale],
        [0, 0, 0]
      );

      // Magnet field forces
      const stabilizeScale = stabilizing ? 0.7 : 1;
      const levelStrength = (1 + clamp(polarityState.level - 1, 0, 50) * 0.065) * zoneBoost * stabilizeScale;
      const maxForce = MAGNET_MAX_FORCE * (1 + clamp(polarityState.level - 1, 0, 10) * 0.04) * zoneBoost * stabilizeScale;
      for (let i = 0; i < magnets.length; i++) {
        const m = magnets[i];
        const dir = new THREE.Vector3().subVectors(m.pos, p);
        const dist = Math.max(MAGNET_MIN_DIST, dir.length());
        dir.divideScalar(dist);
        const k = (MAGNET_BASE_STRENGTH * levelStrength) / (dist * dist);
        const isAttract = m.charge !== polarityState.charge;
        const signed = isAttract ? 1 : -1;
        const magnitude = clamp(k, 0, maxForce);
        playerApi.applyForce([dir.x * magnitude * signed * timeScale, 0, dir.z * magnitude * signed * timeScale], [0, 0, 0]);
      }

      // Soft speed cap
      const spd = velocityRef.current.length();
      if (spd > MAX_SPEED) {
        const oppose = velocityRef.current.clone().normalize().multiplyScalar(-SPEED_SOFT_CAP_FORCE * (spd - MAX_SPEED));
        playerApi.applyForce([oppose.x * timeScale, 0, oppose.z * timeScale], [0, 0, 0]);
      }

      // Pylon whip scoring: close, fast passes by attracting pylons
      if (spd > PYLON_WHIP_SPEED) {
        const now = state.clock.elapsedTime;
        const whipR2 = PYLON_WHIP_RADIUS * PYLON_WHIP_RADIUS;
        for (let i = 0; i < magnets.length; i++) {
          const m = magnets[i];
          if (m.charge === polarityState.charge) continue;
          const d2 = m.pos.distanceToSquared(p);
          if (d2 < whipR2) {
            const last = pylonWhipRef.current[m.id] ?? 0;
            if (now - last > 0.9) {
              pylonWhipRef.current[m.id] = now;
              polarityState.onPylonWhip(zoneMult, resonanceMult);
            }
          }
        }
      }

      // Wall clamp (keeps cannon stable; avoids tunneling at high speed)
      const clampedX = clamp(p.x, -HALF + 2.4, HALF - 2.4);
      const clampedZ = clamp(p.z, -HALF + 2.4, HALF - 2.4);
      if (clampedX !== p.x || clampedZ !== p.z) {
        playerApi.position.set(clampedX, p.y, clampedZ);
        playerApi.velocity.set(velocityRef.current.x * 0.35, velocityRef.current.y, velocityRef.current.z * 0.35);
      }

      // Collect ions (manual distance checks)
      const ionR2 = ION_PICKUP_RADIUS * ION_PICKUP_RADIUS;
      for (let i = 0; i < ions.length; i++) {
        const ion = ions[i];
        const d2 = ion.pos.distanceToSquared(p);
        if (d2 < ionR2) {
          const matches = ion.kind === polarityState.charge;
          polarityState.onIonCollected(matches, zoneMult, resonanceMult);
          setIons((prev) => {
            const next = [...prev];
            const newPos = spawnIonAhead(p, forward, spikesRef.current);
            next[i] = { ...next[i], pos: newPos, kind: randSign() };
            return next;
          });
          break;
        }
      }

      // Spike hits
      const spikeR2 = SPIKE_HIT_RADIUS * SPIKE_HIT_RADIUS;
      let hitSpike = false;
      for (let i = 0; i < spikes.length; i++) {
        const s = spikes[i];
        const d2 = s.pos.distanceToSquared(p);
        if (d2 < spikeR2) {
          polarityState.takeDamage(12);
          setSpikes((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], pos: spawnAroundPlayer(p, 0.35, { minDist: 12, maxDist: 30 }) };
            return next;
          });
          // Knockback (small “pinball” feel)
          const away = new THREE.Vector3().subVectors(p, s.pos).normalize().multiplyScalar(5.5);
          playerApi.applyImpulse([away.x, 0.6, away.z], [0, 0, 0]);
          hitSpike = true;
          break;
        }
      }

      if (!hitSpike) {
        const nearR2 = SPIKE_NEAR_RADIUS * SPIKE_NEAR_RADIUS;
        const now = state.clock.elapsedTime;
        for (let i = 0; i < spikes.length; i++) {
          const s = spikes[i];
          const d2 = s.pos.distanceToSquared(p);
          if (d2 < nearR2 && d2 > spikeR2) {
            const last = spikeGrazeRef.current[s.id] ?? 0;
            if (now - last > 0.35) {
              spikeGrazeRef.current[s.id] = now;
              polarityState.onNearMiss(zoneMult, resonanceMult);
            }
            break;
          }
        }
      }
    }

    clearFrameInput(inputRef);
  });

  const walls = useMemo(
    () => [
      { position: [0, 12, -HALF - 1.4] as [number, number, number], size: [ARENA_SIZE + 8, 30, 2] as [number, number, number] },
      { position: [0, 12, HALF + 1.4] as [number, number, number], size: [ARENA_SIZE + 8, 30, 2] as [number, number, number] },
      { position: [-HALF - 1.4, 12, 0] as [number, number, number], size: [2, 30, ARENA_SIZE + 8] as [number, number, number] },
      { position: [HALF + 1.4, 12, 0] as [number, number, number], size: [2, 30, ARENA_SIZE + 8] as [number, number, number] },
    ],
    []
  );

  const playerColor = chargeColors[polarityState.charge];

  return (
    <>
      <Ground />
      <LowPolyGroundVisual tint="#050814" />
      <ZoneRing />
      {walls.map((w, idx) => (
        <Wall key={idx} position={w.position} size={w.size} />
      ))}

      {/* Player */}
      <mesh ref={playerRef} castShadow>
        <sphereGeometry args={[PLAYER_RADIUS, 28, 28]} />
        <meshStandardMaterial ref={playerMatRef} color={playerColor.main} emissive={playerColor.emissive} emissiveIntensity={0.35} />
      </mesh>
      <PlayerTrail target={playerRef} color={playerColor.emissive} />

      {/* Magnets */}
      {magnets.map((m) => (
        <MagnetPylon key={m.id} magnet={m} />
      ))}

      {/* Ions */}
      {ions.map((ion) => (
        <IonMesh key={ion.id} ion={ion} />
      ))}

      {/* Spikes */}
      {spikes.map((sp) => (
        <SpikeMesh key={sp.id} spike={sp} />
      ))}
    </>
  );
};

const PolarityPost: React.FC = () => {
  const s = useSnapshot(polarityState);
  const boost =
    (s.burstReady ? 0.9 : 0) +
    Math.min(0.9, (s.combo / 24) * 0.6) +
    (s.zoneActive ? 0.35 : 0) +
    (s.slowMoTime > 0 ? 0.25 : 0);
  return <ScenePostFX boost={boost} />;
};

const Polarity: React.FC<{ soundsOn?: boolean }> = () => (
  <>
    <PolarityHUD />
    <NeonDome accentA="#22d3ee" accentB="#2d1b54" />
    <fog attach="fog" args={['#040816', 35, 130]} />
    <Stars radius={220} depth={60} count={1600} factor={4} saturation={0} fade />
    <ambientLight intensity={0.45} />
    <directionalLight position={[25, 35, 15]} intensity={1.15} castShadow />

    <PolarityPost />

    <Physics gravity={[0, -22, 0]} iterations={6}>
      <PolarityWorld />
    </Physics>
  </>
);

export default Polarity;
export * from './state';
