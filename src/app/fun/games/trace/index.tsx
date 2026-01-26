'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Html, Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
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
import { traceState } from './state';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ARENA_SIZE = 60;
const HALF = ARENA_SIZE / 2;

const PLAYER_R = 1.05;
const SEG_SPACING = 0.72;
const MAX_SEGS = 900;

const SHARD_COUNT = 7;
const SHARD_R = 1.55;

const HIT_R = 0.85;
const GRAZE_R = 1.85;
const HASH_CELL = 2.0;
const SEAL_MIN_SEGS = 120;
const SEAL_RADIUS = 6.0;
const SEAL_BUFFER_MS = 180;
const PERFECT_WALL_MARGIN = 3.2;
const BEST_SCORE_KEY = 'trace-best-score';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

type Segment = { x: number; z: number; t: number; key: string };
type Shard = { id: string; pos: THREE.Vector3 };

function randomArenaPoint(y = 1): THREE.Vector3 {
  return new THREE.Vector3(
    THREE.MathUtils.randFloat(-HALF + 4, HALF - 4),
    y,
    THREE.MathUtils.randFloat(-HALF + 4, HALF - 4)
  );
}

function spawnShardAwayFrom(player: THREE.Vector3): THREE.Vector3 {
  for (let i = 0; i < 22; i++) {
    const p = randomArenaPoint(1.0);
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (d < 10) continue;
    return p;
  }
  return randomArenaPoint(1.0);
}

const cellKey = (x: number, z: number) =>
  `${Math.floor(x / HASH_CELL)}:${Math.floor(z / HASH_CELL)}`;

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
          float bands = sin((vPos.x*0.02) + uTime*0.7) * 0.07;
          float stars = step(0.988, hash(floor(vPos.xz*0.26))) * 0.85;
          vec3 col = mix(uB, uA, h + bands);
          col += stars * vec3(0.9, 0.95, 1.0);
          float v = smoothstep(240.0, 90.0, length(vPos.xz));
          col *= mix(0.6, 1.0, v);
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

const LowPolyGround: React.FC = () => {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 18, 18);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const ridge = Math.sin(x * 0.22) * Math.cos(z * 0.18) * 0.11;
      const bowl = (-Math.hypot(x, z) / (ARENA_SIZE * 0.7)) * 0.42;
      pos.setY(i, -0.02 + ridge + bowl);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial
        color="#060913"
        roughness={0.95}
        metalness={0.05}
        flatShading
      />
    </mesh>
  );
};

const ScenePostFX: React.FC<{ boost: number }> = ({ boost }) => {
  const strength = clamp(0.55 + boost * 1.05, 0.55, 1.75);
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={strength} luminanceThreshold={0.2} mipmapBlur />
      <ChromaticAberration
        offset={new THREE.Vector2(0.00085, 0.0007)}
        radialModulation={false}
        modulationOffset={0}
      />
      <Noise opacity={0.05} />
      <Vignette eskil={false} offset={0.3} darkness={0.78} />
    </EffectComposer>
  );
};

const TraceHUD: React.FC<{ solidifyMs: number }> = ({ solidifyMs }) => {
  const s = useSnapshot(traceState);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) traceState.bestScore = Number(stored) || 0;
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${s.bestScore}`);
  }, [s.bestScore]);
  const toastOpacity = clamp(s.toastTime / 1.1, 0, 1);
  const flash = s.slowMoTime > 0 ? clamp(s.slowMoTime / 0.12, 0, 1) : 0;
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      {flash > 0 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'rgba(34, 211, 238, 0.2)', opacity: flash }}
        />
      )}
      <ArcadeHudShell
        gameId="trace"
        className="absolute top-4 left-4 pointer-events-auto"
      >
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">
            Neon Etch
          </div>
          <div className="text-[9px] uppercase tracking-[0.26em] text-white/40">
            Carve → Phase → Seal
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.32em] text-white/50">
            Score
          </div>
          <div className="text-2xl font-semibold text-white">
            {s.score.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/50">
            Best {s.bestScore.toLocaleString()}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ArcadeHudPill label={`Combo x${s.combo}`} />
            <ArcadeHudPill label={`Window ${s.comboTime.toFixed(1)}s`} />
            <ArcadeHudPill
              label={`Phase ${s.phaseCharges}/${s.phaseMaxCharges}`}
            />
            <ArcadeHudPill label={`Solidify ${Math.round(solidifyMs)}ms`} />
            <ArcadeHudPill label={`Seals ${s.seals}`} tone="accent" />
            <ArcadeHudPill label={`Perfect ${s.perfectPhases}`} />
            {s.event && (
              <ArcadeHudPill
                label={`${s.event} ${Math.ceil(s.eventTime)}s`}
                tone="accent"
              />
            )}
          </div>
          <div className="mt-2 space-y-2 text-[11px] text-white/70">
            <div className="flex items-center justify-between">
              <span>Purge</span>
              <span>
                {s.purgeCooldown > 0 ? s.purgeCooldown.toFixed(1) : 'ready'}
              </span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-sky-300/70"
                style={{
                  width: `${clamp((1 - s.purgeCooldown / s.purgeCooldownMax) * 100, 0, 100)}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Seal</span>
              <span>
                {s.sealCooldown > 0 ? s.sealCooldown.toFixed(1) : 'ready'}
              </span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{
                  width: `${clamp((1 - s.sealCooldown / s.sealCooldownMax) * 100, 0, 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            A/D steer • W/S speed • Space phase • E purge
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {s.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="trace">
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
          <ArcadeHudShell gameId="trace">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">
              {s.toastText}
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </Html>
  );
};

const Trace: React.FC = () => {
  const { camera } = useThree();
  const { paused } = useGameUIState();
  const snap = useSnapshot(traceState);

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [
      ' ',
      'Space',
      'arrowleft',
      'arrowright',
      'arrowup',
      'arrowdown',
    ],
  });

  const playerMesh = useRef<THREE.Mesh | null>(null);
  const trailMesh = useRef<THREE.InstancedMesh | null>(null);

  const posRef = useRef(new THREE.Vector3(0, 1.0, 12));
  const headingRef = useRef(Math.PI); // facing -Z
  const speedRef = useRef(16);

  const segsRef = useRef<Segment[]>([]);
  const lastSegPosRef = useRef(
    new THREE.Vector3(posRef.current.x, 0, posRef.current.z)
  );
  const bucketsRef = useRef<Map<string, Segment[]>>(new Map());

  const lastGrazeAtRef = useRef(0);
  const tmpObj = useMemo(() => new THREE.Object3D(), []);
  const sealFxRef = useRef<THREE.Mesh | null>(null);
  const sealFxMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sealFxTimeRef = useRef(0);
  const sealFxPosRef = useRef(new THREE.Vector3(0, 0.1, 0));
  const gridHelper = useMemo(() => {
    const grid = new THREE.GridHelper(ARENA_SIZE, 24, '#0ea5e9', '#0ea5e9');
    const mat = grid.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.18;
      });
    } else {
      mat.transparent = true;
      mat.opacity = 0.18;
    }
    return grid;
  }, []);

  const [shards, setShards] = useState<Shard[]>(() =>
    Array.from({ length: SHARD_COUNT }, (_, i) => ({
      id: `sh-${i}-${Math.random().toString(36).slice(2, 7)}`,
      pos: spawnShardAwayFrom(posRef.current),
    }))
  );

  const rebuildInstances = useCallback(
    (solidifyMs: number) => {
      const inst = trailMesh.current;
      if (!inst) return;

      const now = performance.now();
      const s = segsRef.current;
      const solidColor = new THREE.Color('#22d3ee');
      const armingColor = new THREE.Color('#0ea5e9');

      inst.count = Math.min(s.length, MAX_SEGS);
      for (let i = 0; i < inst.count; i++) {
        const seg = s[i];
        const isSolid = now - seg.t >= solidifyMs;

        tmpObj.position.set(seg.x, 0.45, seg.z);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.set(0.6, 1.0, 0.6);
        if (!isSolid) tmpObj.scale.multiplyScalar(0.55); // “arming” cue
        tmpObj.updateMatrix();
        inst.setMatrixAt(i, tmpObj.matrix);
        inst.setColorAt(i, isSolid ? solidColor : armingColor);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    },
    [tmpObj]
  );

  useEffect(() => {
    // Seed a few segments so the trail shows immediately
    for (let i = 0; i < 10; i++) {
      const x = posRef.current.x;
      const z = posRef.current.z + i * 0.01;
      const key = cellKey(x, z);
      const seg = { x, z, t: performance.now(), key };
      segsRef.current.unshift(seg);
      const bucket = bucketsRef.current.get(key);
      if (bucket) bucket.unshift(seg);
      else bucketsRef.current.set(key, [seg]);
    }
  }, []);

  useFrame((_, dt) => {
    // Camera follow always
    camera.position.lerp(
      new THREE.Vector3(posRef.current.x, 22, posRef.current.z + 18),
      0.08
    );
    camera.lookAt(posRef.current.x, 0, posRef.current.z);

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    if (traceState.gameOver) {
      clearFrameInput(inputRef);
      return;
    }

    const timeScale = traceState.slowMoTime > 0 ? 0.6 : 1;
    const step = dt * timeScale;

    traceState.tick(step);

    // Solidify ramps from ~650ms to ~260ms over ~110s; SoftStorm slows it temporarily
    const baseSolidify = clamp(650 - traceState.elapsed * 3.55, 260, 650);
    const solidifyMs =
      traceState.event === 'SoftStorm'
        ? clamp(baseSolidify + 220, 260, 900)
        : baseSolidify;

    const keys = inputRef.current.keysDown;
    const justPressed = inputRef.current.justPressed;

    // Controls: steer left/right; optional speed trim with W/S
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    const up = keys.has('w') || keys.has('arrowup');
    const down = keys.has('s') || keys.has('arrowdown');

    const invert = traceState.event === 'Mirror' ? -1 : 1;
    const turn = ((right ? 1 : 0) - (left ? 1 : 0)) * invert;
    headingRef.current += turn * 3.15 * step;

    if (up) speedRef.current = clamp(speedRef.current + 18 * step, 12, 28);
    if (down) speedRef.current = clamp(speedRef.current - 18 * step, 12, 28);

    // Phase
    if (justPressed.has(' ') || justPressed.has('space')) {
      const now = performance.now();
      const danger =
        posRef.current.x < -HALF + PERFECT_WALL_MARGIN ||
        posRef.current.x > HALF - PERFECT_WALL_MARGIN ||
        posRef.current.z < -HALF + PERFECT_WALL_MARGIN ||
        posRef.current.z > HALF - PERFECT_WALL_MARGIN ||
        (() => {
          const grazeR2 = GRAZE_R * GRAZE_R;
          const cellX = Math.floor(posRef.current.x / HASH_CELL);
          const cellZ = Math.floor(posRef.current.z / HASH_CELL);
          for (let gx = -1; gx <= 1; gx++) {
            for (let gz = -1; gz <= 1; gz++) {
              const key = `${cellX + gx}:${cellZ + gz}`;
              const bucket = bucketsRef.current.get(key);
              if (!bucket) continue;
              for (const seg of bucket) {
                if (now - seg.t < solidifyMs) continue;
                const dx = posRef.current.x - seg.x;
                const dz = posRef.current.z - seg.z;
                if (dx * dx + dz * dz < grazeR2) return true;
              }
            }
          }
          return false;
        })();

      if (traceState.tryPhase() && danger) {
        traceState.onPerfectPhase();
      }
    }

    if (justPressed.has('e') && traceState.tryPurge()) {
      const purgeCount = Math.min(segsRef.current.length, 220);
      for (let i = 0; i < purgeCount; i++) {
        const removed = segsRef.current.shift();
        if (!removed) break;
        const bin = bucketsRef.current.get(removed.key);
        if (bin) {
          const idx = bin.indexOf(removed);
          if (idx >= 0) bin.splice(idx, 1);
          if (bin.length === 0) bucketsRef.current.delete(removed.key);
        }
      }
      rebuildInstances(solidifyMs);
    }

    const speedMult = traceState.event === 'Overclock' ? 1.15 : 1.0;

    // Move
    const vx = Math.cos(headingRef.current) * speedRef.current * speedMult;
    const vz = Math.sin(headingRef.current) * speedRef.current * speedMult;
    posRef.current.x += vx * step;
    posRef.current.z += vz * step;

    // Arena boundaries: walls are lethal unless phasing (that’s your “save” tool)
    const min = -HALF + PLAYER_R;
    const max = HALF - PLAYER_R;
    if (
      posRef.current.x < min ||
      posRef.current.x > max ||
      posRef.current.z < min ||
      posRef.current.z > max
    ) {
      if (traceState.phaseTime > 0) {
        posRef.current.x = clamp(posRef.current.x, min, max);
        posRef.current.z = clamp(posRef.current.z, min, max);
      } else {
        traceState.gameOver = true;
      }
    }

    // Trail spawn (distance-based)
    const dSeg = lastSegPosRef.current.distanceTo(
      new THREE.Vector3(posRef.current.x, 0, posRef.current.z)
    );
    if (dSeg >= SEG_SPACING) {
      const x = posRef.current.x;
      const z = posRef.current.z;
      const key = cellKey(x, z);
      const seg = { x, z, t: performance.now(), key };
      segsRef.current.unshift(seg);
      const bucket = bucketsRef.current.get(key);
      if (bucket) bucket.unshift(seg);
      else bucketsRef.current.set(key, [seg]);

      lastSegPosRef.current.set(posRef.current.x, 0, posRef.current.z);
      if (segsRef.current.length > MAX_SEGS) {
        const removed = segsRef.current.pop();
        if (removed) {
          const bin = bucketsRef.current.get(removed.key);
          if (bin) {
            const idx = bin.indexOf(removed);
            if (idx >= 0) bin.splice(idx, 1);
            if (bin.length === 0) bucketsRef.current.delete(removed.key);
          }
        }
      }

      traceState.addScore(1);
      rebuildInstances(solidifyMs);
    }

    // Shard pickups (refresh phase + combo glue)
    const shardR2 = SHARD_R * SHARD_R;
    for (let i = 0; i < shards.length; i++) {
      const sh = shards[i];
      const dx = posRef.current.x - sh.pos.x;
      const dz = posRef.current.z - sh.pos.z;
      if (dx * dx + dz * dz < shardR2) {
        traceState.onShard();
        setShards((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], pos: spawnShardAwayFrom(posRef.current) };
          return next;
        });
        break;
      }
    }

    // Collision & graze scoring against SOLID trail
    if (traceState.phaseTime <= 0) {
      const now = performance.now();
      const hitR2 = HIT_R * HIT_R;
      const grazeR2 = GRAZE_R * GRAZE_R;
      const sealR2 = SEAL_RADIUS * SEAL_RADIUS;
      const cellX = Math.floor(posRef.current.x / HASH_CELL);
      const cellZ = Math.floor(posRef.current.z / HASH_CELL);
      let sealed = false;

      const performSeal = (cx: number, cz: number) => {
        const next: Segment[] = [];
        let cleared = 0;
        for (const seg of segsRef.current) {
          const dx = seg.x - cx;
          const dz = seg.z - cz;
          if (dx * dx + dz * dz <= sealR2) {
            cleared += 1;
          } else {
            next.push(seg);
          }
        }
        segsRef.current = next;
        bucketsRef.current = new Map();
        for (const seg of next) {
          const bucket = bucketsRef.current.get(seg.key);
          if (bucket) bucket.push(seg);
          else bucketsRef.current.set(seg.key, [seg]);
        }
        rebuildInstances(solidifyMs);
        traceState.onSeal(cleared);
        sealFxTimeRef.current = 0.5;
        sealFxPosRef.current.set(cx, 0.12, cz);
      };

      for (let gx = -1; gx <= 1; gx++) {
        for (let gz = -1; gz <= 1; gz++) {
          const key = `${cellX + gx}:${cellZ + gz}`;
          const bucket = bucketsRef.current.get(key);
          if (!bucket) continue;

          for (const seg of bucket) {
            if (now - seg.t < solidifyMs) continue;
            const dx = posRef.current.x - seg.x;
            const dz = posRef.current.z - seg.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < hitR2) {
              const canSeal =
                traceState.sealCooldown <= 0 &&
                segsRef.current.length >= SEAL_MIN_SEGS &&
                now - seg.t >= solidifyMs + SEAL_BUFFER_MS;
              if (canSeal) {
                performSeal(seg.x, seg.z);
                sealed = true;
              } else {
                traceState.gameOver = true;
              }
              break;
            }

            if (d2 < grazeR2 && d2 > hitR2) {
              if (traceState.elapsed - lastGrazeAtRef.current > 0.12) {
                lastGrazeAtRef.current = traceState.elapsed;
                traceState.onGraze();
              }
            }
          }
          if (traceState.gameOver || sealed) break;
        }
        if (traceState.gameOver || sealed) break;
      }
    }

    // Apply to mesh
    if (playerMesh.current) {
      playerMesh.current.position.set(posRef.current.x, 1.05, posRef.current.z);
    }

    if (sealFxRef.current) {
      if (sealFxTimeRef.current > 0) {
        sealFxTimeRef.current = Math.max(0, sealFxTimeRef.current - step);
        const t = 1 - sealFxTimeRef.current / 0.5;
        const scale = 1 + t * 6.2;
        sealFxRef.current.position.copy(sealFxPosRef.current);
        sealFxRef.current.scale.set(scale, scale, scale);
        if (sealFxMatRef.current) {
          sealFxMatRef.current.opacity = 0.45 * (1 - t);
          sealFxMatRef.current.emissiveIntensity = 0.6 * (1 - t);
        }
        sealFxRef.current.visible = true;
      } else {
        sealFxRef.current.visible = false;
      }
    }

    clearFrameInput(inputRef);
  });

  // Recompute solidify for HUD display (matches frame calculation closely)
  const hudSolidify =
    clamp(650 - traceState.elapsed * 3.55, 260, 650) +
    (traceState.event === 'SoftStorm' ? 220 : 0);

  return (
    <>
      <TraceHUD solidifyMs={hudSolidify} />
      <NeonDome accentA="#a78bfa" accentB="#1e1b2e" />
      <fog attach="fog" args={['#031019', 30, 120]} />
      <Stars
        radius={240}
        depth={60}
        count={1500}
        factor={4}
        saturation={0}
        fade
      />
      <ambientLight intensity={0.35} />
      <directionalLight position={[18, 32, 14]} intensity={1.1} castShadow />

      <ScenePostFX
        boost={
          Math.min(0.9, snap.combo / 20) +
          (snap.phaseCharges / snap.phaseMaxCharges) * 0.4 +
          (snap.sealTime > 0 ? 0.5 : 0) +
          (snap.event ? 0.35 : 0)
        }
      />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#070b12" />
      </mesh>
      <LowPolyGround />
      <primitive object={gridHelper} position={[0, 0.02, 0]} />

      {/* Trail instanced boxes */}
      <instancedMesh
        ref={trailMesh}
        args={[undefined as any, undefined as any, MAX_SEGS]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          emissive="#22d3ee"
          emissiveIntensity={0.2}
        />
      </instancedMesh>

      {/* Shards */}
      {shards.map((s) => (
        <mesh key={s.id} position={[s.pos.x, 1.05, s.pos.z]} castShadow>
          <tetrahedronGeometry args={[0.65, 0]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#f59e0b"
            emissiveIntensity={0.55}
          />
        </mesh>
      ))}

      <mesh ref={sealFxRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1.5, 40]} />
        <meshStandardMaterial
          ref={sealFxMatRef}
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.6}
          transparent
          opacity={0}
        />
      </mesh>

      {/* Player */}
      <mesh ref={playerMesh} castShadow>
        <sphereGeometry args={[PLAYER_R, 28, 28]} />
        <meshStandardMaterial
          color={traceState.phaseTime > 0 ? '#a78bfa' : '#22d3ee'}
          emissive={traceState.phaseTime > 0 ? '#7c3aed' : '#22d3ee'}
          emissiveIntensity={0.18}
        />
      </mesh>
    </>
  );
};

export default Trace;
export * from './state';
