'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html, Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { ArcadeHudCard, ArcadeHudPill, ArcadeHudShell } from '../../components/shell/ArcadeHudPanel';
import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { flipBoxState, type FlipBoxAim } from './state';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BOX = 26;
const HALF = BOX / 2;
const BALL_R = 1.05;
const SNAP_WINDOW_MAX = 0.9;
const MAX_HAZARDS = 8;
const CORE_MAGNET_RADIUS = 3.0;
const CORE_MAGNET_STRENGTH = 1.1;
const BEST_SCORE_KEY = 'flipbox-best-score';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type HazardKind = 'block' | 'laser' | 'spike' | 'rift';
type Hazard = { id: string; kind: HazardKind; pos: THREE.Vector3; phase: number; dir: THREE.Vector3; size?: number };
type Core = { id: string; pos: THREE.Vector3; size: number; points: number; face: number };

const aimToGravity = (aim: FlipBoxAim, mag: number) => {
  switch (aim) {
    case 'left':
      return new THREE.Vector3(-mag, 0, 0);
    case 'right':
      return new THREE.Vector3(mag, 0, 0);
    case 'back':
      return new THREE.Vector3(0, 0, mag);
    default:
      return new THREE.Vector3(0, 0, -mag);
  }
};

const faceNormal = (face: number) => {
  switch (face) {
    case 0:
      return new THREE.Vector3(1, 0, 0);
    case 1:
      return new THREE.Vector3(-1, 0, 0);
    case 2:
      return new THREE.Vector3(0, 1, 0);
    case 3:
      return new THREE.Vector3(0, -1, 0);
    case 4:
      return new THREE.Vector3(0, 0, 1);
    default:
      return new THREE.Vector3(0, 0, -1);
  }
};

const coreOnFace = (face: number, u: number, v: number, inset: number = 1.2) => {
  switch (face) {
    case 0:
      return new THREE.Vector3(-HALF + inset, u, v);
    case 1:
      return new THREE.Vector3(HALF - inset, u, v);
    case 2:
      return new THREE.Vector3(u, -HALF + inset, v);
    case 3:
      return new THREE.Vector3(u, HALF - inset, v);
    case 4:
      return new THREE.Vector3(u, v, -HALF + inset);
    default:
      return new THREE.Vector3(u, v, HALF - inset);
  }
};

function randomCoreOnFace(faceOverride?: number): { face: number; pos: THREE.Vector3 } {
  const face = faceOverride ?? Math.floor(Math.random() * 6);
  const u = THREE.MathUtils.randFloat(-HALF + 3, HALF - 3);
  const v = THREE.MathUtils.randFloat(-HALF + 3, HALF - 3);
  return { face, pos: coreOnFace(face, u, v) };
}

function spawnHazardAwayFrom(ball: THREE.Vector3): THREE.Vector3 {
  for (let i = 0; i < 22; i++) {
    const p = new THREE.Vector3(
      THREE.MathUtils.randFloat(-HALF + 3, HALF - 3),
      THREE.MathUtils.randFloat(-HALF + 3, HALF - 3),
      THREE.MathUtils.randFloat(-HALF + 3, HALF - 3)
    );
    if (p.distanceTo(ball) < 6) continue;
    return p;
  }
  return new THREE.Vector3(0, 0, 0);
}

const makeCoreBatch = (): Core[] => {
  const cluster = Math.random() < 0.2;
  if (!cluster) {
    const { face, pos } = randomCoreOnFace();
    return [
      {
        id: `core-${Math.random().toString(36).slice(2, 7)}`,
        pos,
        size: 1.05,
        points: 60,
        face,
      },
    ];
  }

  const face = Math.floor(Math.random() * 6);
  const u = THREE.MathUtils.randFloat(-HALF + 4, HALF - 4);
  const v = THREE.MathUtils.randFloat(-HALF + 4, HALF - 4);
  const offsets: [number, number][] = [
    [0, 0],
    [1.5, 0.9],
    [-1.4, -0.8],
  ];

  return offsets.map(([ou, ov]) => {
    const nu = clamp(u + ou, -HALF + 3.6, HALF - 3.6);
    const nv = clamp(v + ov, -HALF + 3.6, HALF - 3.6);
    return {
      id: `core-${Math.random().toString(36).slice(2, 7)}`,
      pos: coreOnFace(face, nu, nv, 1.25),
      size: 0.7,
      points: 35,
      face,
    };
  });
};

const FlipBoxHUD: React.FC<{ aim: FlipBoxAim; hazards: number }> = ({ aim, hazards }) => {
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
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">Score</div>
          <div className="text-2xl font-semibold text-white">{s.score.toLocaleString()}</div>
          <div className="text-[11px] text-white/50">Best {s.bestScore.toLocaleString()}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ArcadeHudPill label={`Chain x${s.chain}`} />
            {s.faceStreak > 0 && <ArcadeHudPill label={`Face x${s.faceStreak}`} tone="accent" />}
            <ArcadeHudPill label={`Aim ${aim}`} />
            <ArcadeHudPill label={`Hazards ${hazards}`} />
            {s.event && <ArcadeHudPill label={`${s.event} ${Math.ceil(s.eventTime)}s`} tone="accent" />}
          </div>

          <div className="mt-3 space-y-2 text-[11px] text-white/70">
            <div className="flex items-center justify-between">
              <span>Health</span>
              <span>{Math.round(s.health)}%</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-400/80" style={{ width: `${clamp(s.health, 0, 100)}%` }} />
            </div>

            <div className="flex items-center justify-between">
              <span>Snap window</span>
              <span>{s.snapWindow.toFixed(1)}s</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{ width: `${clamp((s.snapWindow / SNAP_WINDOW_MAX) * 100, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Focus</span>
              <span>
                {s.focusTime > 0 ? s.focusTime.toFixed(1) : s.focusCooldown > 0 ? s.focusCooldown.toFixed(1) : 'ready'}
              </span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-sky-300/70"
                style={{
                  width: `${clamp(
                    s.focusTime > 0 ? (s.focusTime / 1.3) * 100 : (1 - s.focusCooldown / s.focusCooldownMax) * 100,
                    0,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            WASD aim • Space snap • Shift brake • E focus
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {s.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="flipbox">
            <ArcadeHudCard className="text-center">
              <div className="text-3xl font-semibold text-white">Game Over</div>
              <div className="mt-2 text-lg text-white/80">Final Score: {s.score.toLocaleString()}</div>
              <div className="mt-4 text-[11px] uppercase tracking-[0.3em] text-white/50">Press R to restart</div>
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}

      {s.toastTime > 0 && s.toastText && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 pointer-events-none" style={{ opacity: toastOpacity }}>
          <ArcadeHudShell gameId="flipbox">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">{s.toastText}</ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </Html>
  );
};

const LaserHazardMesh: React.FC<{ hazard: Hazard }> = ({ hazard }) => {
  const ref = useRef<THREE.Mesh | null>(null);
  const nRef = useRef(new THREE.Vector3());
  const qRef = useRef(new THREE.Quaternion());
  const baseAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);

  useEffect(() => {
    // Normalize direction once; default to Z if degenerate
    const n = hazard.dir.clone();
    if (n.lengthSq() < 0.0001) n.set(0, 0, 1);
    n.normalize();
    nRef.current.copy(n);
    qRef.current.setFromUnitVectors(baseAxis, nRef.current);
  }, [baseAxis, hazard.dir]);

  useFrame(() => {
    if (!ref.current) return;
    const n = nRef.current;
    const phase = hazard.phase + flipBoxState.elapsed * 1.35;
    const offset = Math.sin(phase) * 6;

    ref.current.quaternion.copy(qRef.current);
    ref.current.position.set(n.x * offset, n.y * offset, n.z * offset);
  });

  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={[BOX * 1.15, BOX * 1.15, 0.25]} />
      <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.35} transparent opacity={0.35} />
    </mesh>
  );
};

const RiftHazardMesh: React.FC<{ hazard: Hazard }> = ({ hazard }) => {
  const q = useMemo(() => {
    const n = hazard.dir.clone();
    if (n.lengthSq() < 0.0001) n.set(0, 0, 1);
    n.normalize();
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    return quat;
  }, [hazard.dir]);

  const size = hazard.size ?? 4.5;

  return (
    <mesh position={[hazard.pos.x, hazard.pos.y, hazard.pos.z]} quaternion={q}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#a855f7" emissive="#c084fc" emissiveIntensity={0.35} transparent opacity={0.45} />
    </mesh>
  );
};

const FlipBox: React.FC = () => {
  const { camera } = useThree();
  const { paused } = useGameUIState();

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [' ', 'Space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'],
  });

  const ballMesh = useRef<THREE.Mesh | null>(null);
  const aimIndicatorRef = useRef<THREE.Group | null>(null);

  const posRef = useRef(new THREE.Vector3(0, 0, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const aimRef = useRef<FlipBoxAim>('forward');
  const gravityRef = useRef(new THREE.Vector3(0, -18, 0));

  const [cores, setCores] = useState<Core[]>(() => makeCoreBatch());
  const [hazards, setHazards] = useState<Hazard[]>([]);

  const axisLockRef = useRef<{ allowed: Set<FlipBoxAim> } | null>(null);

  useEffect(() => {
    // Small starting hazard roster so it isn’t empty
    setHazards([
      {
        id: 'hz-0',
        kind: 'block',
        pos: new THREE.Vector3(-4, 0, 3),
        phase: Math.random() * 10,
        dir: new THREE.Vector3(1, 0.2, -0.6).normalize(),
      },
    ]);
  }, []);

  const spawnHazard = (ball: THREE.Vector3) => {
    const roll = Math.random();
    const kind: HazardKind = roll < 0.45 ? 'block' : roll < 0.62 ? 'laser' : roll < 0.8 ? 'spike' : 'rift';

    let pos = spawnHazardAwayFrom(ball);
    let dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    let size: number | undefined;

    if (kind === 'rift') {
      let placed = false;
      for (let i = 0; i < 18; i++) {
        const face = Math.floor(Math.random() * 6);
        const u = THREE.MathUtils.randFloat(-HALF + 4, HALF - 4);
        const v = THREE.MathUtils.randFloat(-HALF + 4, HALF - 4);
        const candidate = coreOnFace(face, u, v, 1.15);
        if (candidate.distanceTo(ball) < 6) continue;
        pos = candidate;
        dir = faceNormal(face);
        size = 4.6;
        placed = true;
        break;
      }
      if (!placed) {
        pos = spawnHazardAwayFrom(ball);
        dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        size = 4.6;
      }
    }

    const h: Hazard = {
      id: `hz-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      pos,
      phase: Math.random() * 10,
      dir,
      size,
    };
    setHazards((prev) => {
      const next = [...prev];
      if (next.length >= MAX_HAZARDS) {
        const removeIdx = Math.floor(Math.random() * next.length);
        next.splice(removeIdx, 1);
      }
      next.push(h);
      return next;
    });
  };

  useFrame((_, dt) => {
    // Camera always
    camera.position.lerp(new THREE.Vector3(posRef.current.x + 22, posRef.current.y + 18, posRef.current.z + 22), 0.06);
    camera.lookAt(posRef.current);

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    if (flipBoxState.gameOver) {
      clearFrameInput(inputRef);
      return;
    }

    const timeScale = flipBoxState.slowMoTime > 0 ? 0.6 : 1;
    const step = dt * timeScale;

    flipBoxState.tick(step);
    const focusActive = flipBoxState.focusTime > 0;

    // Event: AxisLock picks 2 directions for 8s
    if (flipBoxState.event === 'AxisLock' && !axisLockRef.current) {
      const horizontal = Math.random() < 0.5;
      axisLockRef.current = {
        allowed: new Set<FlipBoxAim>(horizontal ? ['left', 'right'] : ['forward', 'back']),
      };
    }
    if (flipBoxState.event !== 'AxisLock') axisLockRef.current = null;

    const keys = inputRef.current.keysDown;
    const justPressed = inputRef.current.justPressed;

    // Aim selection
    const w = keys.has('w') || keys.has('arrowup');
    const s = keys.has('s') || keys.has('arrowdown');
    const a = keys.has('a') || keys.has('arrowleft');
    const d = keys.has('d') || keys.has('arrowright');

    if (w) aimRef.current = 'forward';
    if (s) aimRef.current = 'back';
    if (a) aimRef.current = 'left';
    if (d) aimRef.current = 'right';

    // Enforce axis lock if active
    if (axisLockRef.current && !axisLockRef.current.allowed.has(aimRef.current)) {
      aimRef.current = axisLockRef.current.allowed.has('left') ? 'left' : 'forward';
    }

    // Snap gravity (Space)
    if (justPressed.has(' ') || justPressed.has('space')) {
      const mag = flipBoxState.event === 'Heavy' ? 30 : 22;
      gravityRef.current.copy(aimToGravity(aimRef.current, mag));
      const impulse = focusActive ? 5.5 : 7.2;
      const dir = gravityRef.current.clone().normalize();
      velRef.current.addScaledVector(dir, impulse);
      flipBoxState.onSnap();
    }

    if (justPressed.has('e')) {
      flipBoxState.tryFocus();
    }

    // Brake (Shift): increases damping, especially during Sticky event
    const braking = keys.has('shift');
    const baseDamp = braking ? (flipBoxState.event === 'Sticky' ? 0.92 : 0.95) : 0.985;
    const damp = focusActive ? Math.min(baseDamp + 0.01, 0.99) : baseDamp;

    // Integrate “cube physics”
    velRef.current.addScaledVector(gravityRef.current, step * (focusActive ? 0.7 : 1));
    velRef.current.multiplyScalar(damp);
    posRef.current.addScaledVector(velRef.current, step);

    const min = -HALF + BALL_R;
    const max = HALF - BALL_R;

    // Wall collisions (damage scales with impact)
    const impactScale = focusActive ? 0.55 : 1;
    const impactDamage = (v: number) => clamp(Math.abs(v) * 0.035 * impactScale, 0.05, 1.2);

    if (posRef.current.x < min) {
      posRef.current.x = min;
      flipBoxState.damage(impactDamage(velRef.current.x));
      velRef.current.x *= -0.55;
    }
    if (posRef.current.x > max) {
      posRef.current.x = max;
      flipBoxState.damage(impactDamage(velRef.current.x));
      velRef.current.x *= -0.55;
    }
    if (posRef.current.y < min) {
      posRef.current.y = min;
      flipBoxState.damage(impactDamage(velRef.current.y));
      velRef.current.y *= -0.55;
    }
    if (posRef.current.y > max) {
      posRef.current.y = max;
      flipBoxState.damage(impactDamage(velRef.current.y));
      velRef.current.y *= -0.55;
    }
    if (posRef.current.z < min) {
      posRef.current.z = min;
      flipBoxState.damage(impactDamage(velRef.current.z));
      velRef.current.z *= -0.55;
    }
    if (posRef.current.z > max) {
      posRef.current.z = max;
      flipBoxState.damage(impactDamage(velRef.current.z));
      velRef.current.z *= -0.55;
    }

    // Subtle core magnet assist
    let pull = new THREE.Vector3(0, 0, 0);
    for (const c of cores) {
      const d = posRef.current.distanceTo(c.pos);
      if (d < CORE_MAGNET_RADIUS) {
        const dir = c.pos.clone().sub(posRef.current).normalize();
        const strength = (1 - d / CORE_MAGNET_RADIUS) * CORE_MAGNET_STRENGTH;
        pull.addScaledVector(dir, strength);
      }
    }
    if (pull.lengthSq() > 0.0001) {
      velRef.current.addScaledVector(pull, step);
    }

    // Core collect (single or cluster batch)
    for (let i = 0; i < cores.length; i++) {
      const c = cores[i];
      if (posRef.current.distanceTo(c.pos) < 1.7) {
        const snapCatch = flipBoxState.snapWindow > 0;
        flipBoxState.onCoreCollected(c.points, c.face, snapCatch);
        setCores((prev) => {
          const next = prev.filter((_, idx) => idx !== i);
          if (next.length === 0) {
            spawnHazard(posRef.current);
            return makeCoreBatch();
          }
          return next;
        });
        break;
      }
    }

    // Hazards (simple collision)
    for (const hz of hazards) {
      if (hz.kind === 'block') {
        const d = posRef.current.distanceTo(hz.pos);
        if (d < 2.05) flipBoxState.damage(12 * step * (focusActive ? 0.55 : 1));
      } else if (hz.kind === 'spike') {
        const d = posRef.current.distanceTo(hz.pos);
        if (d < 1.85) flipBoxState.damage(18 * step * (focusActive ? 0.55 : 1));
      } else if (hz.kind === 'rift') {
        const rx = posRef.current.x - hz.pos.x;
        const ry = posRef.current.y - hz.pos.y;
        const rz = posRef.current.z - hz.pos.z;
        const n = hz.dir;
        const dist = Math.abs(rx * n.x + ry * n.y + rz * n.z);
        const lateralSq = rx * rx + ry * ry + rz * rz - dist * dist;
        const halfSize = (hz.size ?? 4.5) * 0.5;
        if (dist < 0.45 && lateralSq < halfSize * halfSize) flipBoxState.damage(20 * step * (focusActive ? 0.55 : 1));
      } else if (hz.kind === 'laser') {
        // Laser plane swings across cube: distance to plane normal oscillates
        const n = hz.dir;
        const phase = hz.phase + flipBoxState.elapsed * 1.35;
        const offset = Math.sin(phase) * 6;
        const dist = Math.abs(n.dot(posRef.current) - offset);
        if (dist < 0.75) flipBoxState.damage(22 * step * (focusActive ? 0.55 : 1));
      }
    }

    if (ballMesh.current) ballMesh.current.position.copy(posRef.current);
    if (aimIndicatorRef.current) {
      const dir = aimToGravity(aimRef.current, 1);
      const angle = Math.atan2(dir.x, dir.z);
      aimIndicatorRef.current.rotation.set(0, angle, 0);
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <FlipBoxHUD aim={aimRef.current} hazards={hazards.length} />
      <Sky />
      <fog attach="fog" args={['#0b0f18', 20, 100]} />
      <Stars radius={240} depth={60} count={1200} factor={4} saturation={0} fade />
      <ambientLight intensity={0.38} />
      <directionalLight position={[30, 30, 30]} intensity={1.15} castShadow />

      {/* Cube boundary (wireframe) */}
      <mesh>
        <boxGeometry args={[BOX, BOX, BOX]} />
        <meshStandardMaterial color="#111827" transparent opacity={0.08} wireframe />
      </mesh>

      {/* Cores */}
      {cores.map((c) => (
        <mesh key={c.id} position={[c.pos.x, c.pos.y, c.pos.z]} castShadow>
          <boxGeometry args={[c.size, c.size, c.size]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.6} />
        </mesh>
      ))}

      {/* Hazards */}
      {hazards.map((h) => {
        if (h.kind === 'block') {
          return (
            <mesh key={h.id} position={[h.pos.x, h.pos.y, h.pos.z]} castShadow>
              <boxGeometry args={[2.4, 2.4, 2.4]} />
              <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.2} />
            </mesh>
          );
        }
        if (h.kind === 'spike') {
          return (
            <mesh key={h.id} position={[h.pos.x, h.pos.y, h.pos.z]} castShadow>
              <coneGeometry args={[1.0, 2.2, 8]} />
              <meshStandardMaterial color="#fb7185" emissive="#7f1d1d" emissiveIntensity={0.3} />
            </mesh>
          );
        }
        if (h.kind === 'rift') {
          return <RiftHazardMesh key={h.id} hazard={h} />;
        }
        return <LaserHazardMesh key={h.id} hazard={h} />;
      })}

      {/* Ball */}
      <mesh ref={ballMesh} castShadow>
        <sphereGeometry args={[BALL_R, 28, 28]} />
        <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.12} />
      </mesh>

      <group ref={aimIndicatorRef} position={[0, 0, 0]}>
        <mesh position={[0, 0, 2.0]}>
          <boxGeometry args={[0.25, 0.25, 1.4]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0, 3.0]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.4, 0.8, 12]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.7} />
        </mesh>
      </group>
    </>
  );
};

export default FlipBox;
export * from './state';
