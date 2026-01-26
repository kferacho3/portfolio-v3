'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { ArcadeHudCard, ArcadeHudPill, ArcadeHudShell } from '../../components/shell/ArcadeHudPanel';
import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { flipBoxState, type FlipBoxEvent } from './state';

const BOX = 26;
const HALF = BOX / 2;
const BALL_R = 1.05;

const CORE_R = 1.7;
const MAX_HAZARDS = 22;
const BEST_SCORE_KEY = 'flipbox-best-score';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type AimDir = 'left' | 'right' | 'forward' | 'back' | 'up' | 'down';

type Core = { id: string; pos: THREE.Vector3; value: number };
type HazardKind = 'block' | 'spike' | 'laser';
type Hazard = {
  id: string;
  kind: HazardKind;
  pos: THREE.Vector3;
  size: THREE.Vector3;
  vel: THREE.Vector3;
  axis?: 'x' | 'y' | 'z';
  phase: number;
};

const dirToVec = (d: AimDir) => {
  switch (d) {
    case 'left':
      return new THREE.Vector3(-1, 0, 0);
    case 'right':
      return new THREE.Vector3(1, 0, 0);
    case 'back':
      return new THREE.Vector3(0, 0, 1);
    case 'up':
      return new THREE.Vector3(0, 1, 0);
    case 'down':
      return new THREE.Vector3(0, -1, 0);
    default:
      return new THREE.Vector3(0, 0, -1);
  }
};

function randomCoreOnFace(): THREE.Vector3 {
  const face = Math.floor(Math.random() * 6);
  const u = THREE.MathUtils.randFloat(-HALF + 3.2, HALF - 3.2);
  const v = THREE.MathUtils.randFloat(-HALF + 3.2, HALF - 3.2);
  const wall = HALF - 1.35;
  switch (face) {
    case 0:
      return new THREE.Vector3(-wall, u, v);
    case 1:
      return new THREE.Vector3(wall, u, v);
    case 2:
      return new THREE.Vector3(u, v, -wall);
    case 3:
      return new THREE.Vector3(u, v, wall);
    case 4:
      return new THREE.Vector3(u, wall, v);
    default:
      return new THREE.Vector3(u, -wall, v);
  }
}

function spawnCoreCluster(base: THREE.Vector3): Core[] {
  const n = Math.random() < 0.22 ? 3 : 1;
  const cores: Core[] = [];
  for (let i = 0; i < n; i++) {
    const jitter = new THREE.Vector3(
      THREE.MathUtils.randFloat(-1.8, 1.8),
      THREE.MathUtils.randFloat(-1.8, 1.8),
      THREE.MathUtils.randFloat(-1.8, 1.8)
    );
    const p = base.clone().add(jitter);
    // Project back toward the face plane (keeps the cluster near the wall)
    const ax = Math.max(Math.abs(base.x), Math.abs(base.y), Math.abs(base.z));
    if (Math.abs(base.x) === ax) p.x = base.x;
    if (Math.abs(base.y) === ax) p.y = base.y;
    if (Math.abs(base.z) === ax) p.z = base.z;
    cores.push({ id: `c-${Math.random().toString(36).slice(2, 8)}`, pos: p, value: i === 0 ? 1 : 0 });
  }
  return cores;
}

function spawnHazardAway(from: THREE.Vector3, existing: Hazard[]): Hazard {
  const kind: HazardKind = Math.random() < 0.25 ? 'laser' : Math.random() < 0.55 ? 'spike' : 'block';
  const id = `h-${Math.random().toString(36).slice(2, 8)}`;
  const tries = 32;
  for (let i = 0; i < tries; i++) {
    const p = new THREE.Vector3(
      THREE.MathUtils.randFloat(-HALF + 3.6, HALF - 3.6),
      THREE.MathUtils.randFloat(-HALF + 3.6, HALF - 3.6),
      THREE.MathUtils.randFloat(-HALF + 3.6, HALF - 3.6)
    );
    if (p.distanceTo(from) < 7.5) continue;
    let ok = true;
    for (const h of existing) if (h.pos.distanceTo(p) < 4.8) ok = false;
    if (!ok) continue;

    if (kind === 'laser') {
      const axis: Hazard['axis'] = Math.random() < 0.5 ? 'x' : 'z';
      return {
        id,
        kind,
        pos: p,
        size: new THREE.Vector3(axis === 'x' ? BOX * 0.92 : 0.35, 0.35, axis === 'z' ? BOX * 0.92 : 0.35),
        vel: new THREE.Vector3(0, 0, 0),
        axis,
        phase: Math.random() * Math.PI * 2,
      };
    }

    if (kind === 'spike') {
      return {
        id,
        kind,
        pos: p,
        size: new THREE.Vector3(1.6, 1.9, 1.6),
        vel: new THREE.Vector3(0, 0, 0),
        phase: Math.random() * Math.PI * 2,
      };
    }

    // block
    const v = new THREE.Vector3(
      THREE.MathUtils.randFloat(-3.2, 3.2),
      THREE.MathUtils.randFloat(-2.6, 2.6),
      THREE.MathUtils.randFloat(-3.2, 3.2)
    );
    return {
      id,
      kind,
      pos: p,
      size: new THREE.Vector3(2.2, 2.2, 2.2),
      vel: v,
      phase: Math.random() * Math.PI * 2,
    };
  }

  // fallback
  return {
    id,
    kind: 'block',
    pos: new THREE.Vector3(0, 0, 0),
    size: new THREE.Vector3(2.2, 2.2, 2.2),
    vel: new THREE.Vector3(0, 0, 0),
    phase: 0,
  };
}

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
          float sweep = sin((vPos.x*0.03) + uTime*0.8) * 0.07;
          float stars = step(0.989, hash(floor(vPos.xz*0.28))) * 0.85;
          vec3 col = mix(uB, uA, h + sweep);
          col += stars * vec3(0.9, 0.95, 1.0);
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
      <icosahedronGeometry args={[200, 2]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
};

const ScenePostFX: React.FC<{ boost: number }> = ({ boost }) => {
  const strength = clamp(0.55 + boost * 1.05, 0.55, 1.85);
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={strength} luminanceThreshold={0.2} mipmapBlur />
      <ChromaticAberration offset={new THREE.Vector2(0.0009, 0.00075)} />
      <Noise opacity={0.05} />
      <Vignette eskil={false} offset={0.3} darkness={0.78} />
    </EffectComposer>
  );
};

const FlipBoxHUD: React.FC<{ aim: AimDir; event: FlipBoxEvent }> = ({ aim, event }) => {
  const s = useSnapshot(flipBoxState);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) flipBoxState.bestScore = Number(stored) || 0;
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${s.bestScore}`);
  }, [s.bestScore]);

  const toastOpacity = clamp(s.toastTime / 1.1, 0, 1);

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <ArcadeHudShell gameId="flipbox" className="absolute top-4 left-4 pointer-events-auto">
        <ArcadeHudCard className="min-w-[280px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">Score</div>
          <div className="text-2xl font-semibold text-white">{s.score.toLocaleString()}</div>
          <div className="text-[11px] text-white/50">Best {s.bestScore.toLocaleString()}</div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ArcadeHudPill label={`Health ${Math.round(s.health)}%`} tone={s.health < 35 ? 'danger' : 'neutral'} />
            <ArcadeHudPill label={`Chain x${s.chain}`} tone={s.chain >= 6 ? 'good' : 'neutral'} />
            <ArcadeHudPill label={`Aim ${aim.toUpperCase()}`} />
            {event && <ArcadeHudPill label={event.toUpperCase()} tone="warn" />}
            <ArcadeHudPill label={`Brake ${s.brakeCd <= 0 ? 'READY' : `${s.brakeCd.toFixed(1)}s`}`} tone={s.brakeCd <= 0 ? 'good' : 'neutral'} />
          </div>

          <div className="mt-2 text-xs text-white/60">WASD/QE aim • Space snap • Shift brake</div>
          {s.gameOver && <div className="mt-2 text-sm font-semibold text-red-300">Game Over</div>}
        </ArcadeHudCard>
      </ArcadeHudShell>

      {s.toastTime > 0 && (
        <div className="absolute left-1/2 top-[12%] -translate-x-1/2" style={{ opacity: toastOpacity }}>
          <ArcadeHudShell gameId="flipbox">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">{s.toastText}</ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </Html>
  );
};

const FlipBox: React.FC = () => {
  const { camera } = useThree();
  const { paused } = useGameUIState();
  const snap = useSnapshot(flipBoxState);

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [' ', 'Space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
  });

  const ballRef = useRef<THREE.Mesh | null>(null);
  const posRef = useRef(new THREE.Vector3(0, 0, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const gravityRef = useRef(new THREE.Vector3(0, -22, 0));
  const aimRef = useRef<AimDir>('forward');

  const [cores, setCores] = useState<Core[]>(() => spawnCoreCluster(randomCoreOnFace()));
  const hazardsRef = useRef<Hazard[]>([]);
  const hazardMeshesRef = useRef(new Map<string, THREE.Mesh>());
  const [hazardsVersion, setHazardsVersion] = useState(0);
  const lastSnapAt = useRef(0);

  const snapFx = useRef<{ t: number; pos: THREE.Vector3 }[]>([]);

  const cubeMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({ color: '#111827', transparent: true, opacity: 0.08, wireframe: true });
  }, []);

  const aimAllowed = (dir: AimDir) => {
    if (flipBoxState.event !== 'AxisLock') return true;
    const mask = flipBoxState.axisLockMask;
    const axisBit = dir === 'left' || dir === 'right' ? 1 : dir === 'up' || dir === 'down' ? 2 : 4;
    return (mask & axisBit) !== 0;
  };

  const applyAim = (dir: AimDir) => {
    if (aimAllowed(dir)) {
      aimRef.current = dir;
      return;
    }
    // If locked out, pick an allowed axis closest to current aim
    const candidates: AimDir[] = ['left', 'right', 'forward', 'back', 'up', 'down'].filter(aimAllowed);
    if (candidates.length === 0) return;
    const cur = dirToVec(aimRef.current);
    let best = candidates[0];
    let bestDot = -Infinity;
    for (const c of candidates) {
      const dot = cur.dot(dirToVec(c));
      if (dot > bestDot) {
        bestDot = dot;
        best = c;
      }
    }
    aimRef.current = best;
  };

  useFrame((_, dt) => {
    const slow = snap.slowMoTime > 0 ? 0.6 : 1;
    const step = dt * slow;
    flipBoxState.tick(step);
    if (flipBoxState.gameOver) {
      clearFrameInput(inputRef);
      return;
    }

    const keys = inputRef.current.keysDown;
    if (keys.has('w') || keys.has('arrowup')) applyAim('forward');
    if (keys.has('s') || keys.has('arrowdown')) applyAim('back');
    if (keys.has('a') || keys.has('arrowleft')) applyAim('left');
    if (keys.has('d') || keys.has('arrowright')) applyAim('right');
    if (keys.has('q')) applyAim('up');
    if (keys.has('e')) applyAim('down');

    // Brake (save tool)
    if (inputRef.current.justPressed.has('shift')) {
      flipBoxState.tryBrake();
    }

    // Snap gravity
    if ((inputRef.current.justPressed.has(' ') || inputRef.current.justPressed.has('space')) && !paused) {
      lastSnapAt.current = flipBoxState.elapsed;
      // Perfect window starts at snap
      flipBoxState.chainTime = flipBoxState.perfectWindow;

      const baseMag = flipBoxState.event === 'Heavy' ? 28 : 22;
      gravityRef.current.copy(dirToVec(aimRef.current)).multiplyScalar(baseMag);
      flipBoxState.addScore(2);

      snapFx.current.unshift({ t: 0.55, pos: posRef.current.clone() });
      if (snapFx.current.length > 6) snapFx.current.pop();
    }

    // Integrate
    const damping = flipBoxState.brakeTime > 0 ? 0.88 : flipBoxState.event === 'Sticky' ? 0.985 : 0.992;
    const brakeExtra = flipBoxState.event === 'Sticky' ? 0.82 : 0.88;
    velRef.current.addScaledVector(gravityRef.current, step);
    velRef.current.multiplyScalar(damping);
    if (flipBoxState.brakeTime > 0) velRef.current.multiplyScalar(brakeExtra);
    posRef.current.addScaledVector(velRef.current, step);

    // Walls (reflect)
    const min = -HALF + BALL_R;
    const max = HALF - BALL_R;
    const wallHit = (axis: 'x' | 'y' | 'z', dir: -1 | 1) => {
      const v = velRef.current[axis];
      const hard = Math.abs(v) > 18;
      velRef.current[axis] = -v * 0.55;
      if (hard) flipBoxState.damage(0.9);
    };

    if (posRef.current.x < min) {
      posRef.current.x = min;
      wallHit('x', -1);
    }
    if (posRef.current.x > max) {
      posRef.current.x = max;
      wallHit('x', 1);
    }
    if (posRef.current.y < min) {
      posRef.current.y = min;
      wallHit('y', -1);
    }
    if (posRef.current.y > max) {
      posRef.current.y = max;
      wallHit('y', 1);
    }
    if (posRef.current.z < min) {
      posRef.current.z = min;
      wallHit('z', -1);
    }
    if (posRef.current.z > max) {
      posRef.current.z = max;
      wallHit('z', 1);
    }

    // Update hazards (mutable ref for perf)
    for (const h of hazardsRef.current) {
      h.phase += step;
      if (h.kind === 'block') {
        h.pos.addScaledVector(h.vel, step);
        for (const ax of ['x', 'y', 'z'] as const) {
          const limit = HALF - 2.2;
          if (h.pos[ax] < -limit) {
            h.pos[ax] = -limit;
            h.vel[ax] *= -1;
          }
          if (h.pos[ax] > limit) {
            h.pos[ax] = limit;
            h.vel[ax] *= -1;
          }
        }
      }
      if (h.kind === 'laser' && h.axis) {
        const amp = HALF * 0.62;
        if (h.axis === 'x') h.pos.x = Math.sin(h.phase * 0.85) * amp;
        if (h.axis === 'z') h.pos.z = Math.cos(h.phase * 0.92) * amp;
      }
      const mesh = hazardMeshesRef.current.get(h.id);
      if (mesh) mesh.position.copy(h.pos);
    }

    // Hazard collisions
    for (const h of hazardsRef.current) {
      if (h.kind === 'laser' && h.axis) {
        const dist = h.axis === 'x' ? Math.abs(posRef.current.x - h.pos.x) : Math.abs(posRef.current.z - h.pos.z);
        if (dist < 0.55 && Math.abs(posRef.current.y) < HALF - 1.2) {
          flipBoxState.damage(12 * step);
        }
        continue;
      }

      const dx = posRef.current.x - h.pos.x;
      const dy = posRef.current.y - h.pos.y;
      const dz = posRef.current.z - h.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const r = h.kind === 'spike' ? 1.55 : 1.75;
      if (d2 < r * r) {
        flipBoxState.damage(18 * step);
      }
    }

    // Core collect
    for (let i = 0; i < cores.length; i++) {
      const c = cores[i];
      if (posRef.current.distanceTo(c.pos) < CORE_R) {
        const withinPerfect = flipBoxState.chainTime > 0;
        flipBoxState.onCoreCollected(withinPerfect);

        // Add hazard
        const existing = hazardsRef.current;
        const next = [...existing, spawnHazardAway(posRef.current, existing)].slice(-MAX_HAZARDS);
        hazardsRef.current = next;
        setHazardsVersion((v) => v + 1);

        // New cores
        setCores(spawnCoreCluster(randomCoreOnFace()));
        break;
      }
    }

    // Tick snap FX
    snapFx.current = snapFx.current
      .map((f) => ({ ...f, t: f.t - step }))
      .filter((f) => f.t > 0);

    // Camera
    camera.position.lerp(new THREE.Vector3(posRef.current.x + 22, posRef.current.y + 18, posRef.current.z + 22), 0.06);
    camera.lookAt(posRef.current);

    if (ballRef.current) ballRef.current.position.copy(posRef.current);

    clearFrameInput(inputRef);
  });

  const boost =
    (snap.brakeTime > 0 ? 0.45 : 0) +
    Math.min(0.9, snap.chain * 0.08) +
    (snap.event === 'Heavy' ? 0.25 : 0) +
    (snap.event === 'AxisLock' ? 0.22 : 0);

  const hazardsList = useMemo(() => hazardsRef.current, [hazardsVersion]);

  return (
    <>
      <FlipBoxHUD aim={aimRef.current} event={snap.event} />
      <NeonDome accentA="#facc15" accentB="#1b1030" />
      <fog attach="fog" args={['#070b12', 25, 120]} />
      <Stars radius={240} depth={60} count={1200} factor={4} saturation={0} fade />
      <ambientLight intensity={0.35} />
      <directionalLight position={[30, 30, 30]} intensity={1.15} castShadow />
      <ScenePostFX boost={boost} />

      {/* Cube boundary */}
      <mesh material={cubeMat}>
        <boxGeometry args={[BOX, BOX, BOX]} />
      </mesh>

      {/* Cores */}
      {cores.map((c) => (
        <mesh key={c.id} position={[c.pos.x, c.pos.y, c.pos.z]} castShadow>
          <octahedronGeometry args={[0.95, 0]} />
          <meshStandardMaterial color={c.value > 0 ? '#22d3ee' : '#a78bfa'} emissive={c.value > 0 ? '#22d3ee' : '#a78bfa'} emissiveIntensity={0.75} />
        </mesh>
      ))}

      {/* Hazards */}
      {hazardsList.map((h) => {
        if (h.kind === 'laser') {
          return (
            <mesh
              key={h.id}
              ref={(m) => {
                if (m) hazardMeshesRef.current.set(h.id, m);
                else hazardMeshesRef.current.delete(h.id);
              }}
              position={[h.pos.x, h.pos.y, h.pos.z]}
            >
              <boxGeometry args={[h.size.x, 0.35, h.size.z]} />
              <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={0.6} transparent opacity={0.8} />
            </mesh>
          );
        }
        if (h.kind === 'spike') {
          return (
            <mesh
              key={h.id}
              ref={(m) => {
                if (m) hazardMeshesRef.current.set(h.id, m);
                else hazardMeshesRef.current.delete(h.id);
              }}
              position={[h.pos.x, h.pos.y, h.pos.z]}
              castShadow
            >
              <coneGeometry args={[0.9, 1.8, 8]} />
              <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.25} flatShading />
            </mesh>
          );
        }
        return (
          <mesh
            key={h.id}
            ref={(m) => {
              if (m) hazardMeshesRef.current.set(h.id, m);
              else hazardMeshesRef.current.delete(h.id);
            }}
            position={[h.pos.x, h.pos.y, h.pos.z]}
            castShadow
          >
            <boxGeometry args={[h.size.x, h.size.y, h.size.z]} />
            <meshStandardMaterial color="#111827" emissive="#a78bfa" emissiveIntensity={0.08} flatShading />
          </mesh>
        );
      })}

      {/* Snap FX rings */}
      {snapFx.current.map((f, idx) => {
        const a = clamp(f.t / 0.55, 0, 1);
        const s = 1 + (1 - a) * 6.5;
        return (
          <mesh key={`fx-${idx}`} position={[f.pos.x, f.pos.y, f.pos.z]} scale={[s, s, s]}>
            <torusGeometry args={[1.0, 0.08, 10, 28]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.55} transparent opacity={a * 0.45} />
          </mesh>
        );
      })}

      {/* Player */}
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[BALL_R, 24, 24]} />
        <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.12} />
      </mesh>
    </>
  );
};

export default FlipBox;
export * from './state';
