'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html, Sky, Stars, Torus } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { ArcadeHudCard, ArcadeHudPill, ArcadeHudShell } from '../../components/shell/ArcadeHudPanel';
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

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

function spawnGateDonut(base: THREE.Vector3, forward: THREE.Vector3): THREE.Vector3 {
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

    if (p.x < -HALF + 7 || p.x > HALF - 7 || p.z < -HALF + 7 || p.z > HALF - 7) continue;
    return p;
  }

  return new THREE.Vector3(
    THREE.MathUtils.randFloat(-HALF + 7, HALF - 7),
    1.15,
    THREE.MathUtils.randFloat(-HALF + 7, HALF - 7)
  );
}

const GateMesh: React.FC<{ pos: THREE.Vector3; active: boolean }> = ({ pos, active }) => (
  <Torus position={[pos.x, pos.y, pos.z]} args={[1.45, 0.26, 14, 28]} rotation={[Math.PI / 2, 0, 0]}>
    <meshStandardMaterial
      color={active ? '#22d3ee' : '#facc15'}
      emissive={active ? '#22d3ee' : '#f59e0b'}
      emissiveIntensity={active ? 0.65 : 0.25}
      metalness={0.2}
      roughness={0.5}
    />
  </Torus>
);

const PylonMesh: React.FC<{ pylon: Pylon; shock?: boolean }> = ({ pylon, shock }) => (
  <group position={[pylon.pos.x, 0, pylon.pos.z]}>
    <mesh castShadow>
      <cylinderGeometry args={[0.6, 0.8, 3.2, 12]} />
      <meshStandardMaterial color="#0b1226" metalness={0.2} roughness={0.9} />
    </mesh>
    <mesh castShadow position={[0, 2.0, 0]}>
      <sphereGeometry args={[0.28, 16, 16]} />
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

const TetherDriftHUD: React.FC<{ event: EventType; eventTime: number }> = ({ event, eventTime }) => {
  const s = useSnapshot(tetherDriftState);
  const heat = Math.round(s.heat);
  const heatMult = 1 + (s.heat / 100) * 0.75;
  const flash = s.perfectFlash > 0 ? Math.min(1, s.perfectFlash / 0.2) : 0;
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
      <ArcadeHudShell gameId="tetherdrift" className="absolute top-4 left-4 pointer-events-auto">
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">Score</div>
          <div className="text-2xl font-semibold text-white">{s.score.toLocaleString()}</div>
          <div className="text-[11px] text-white/50">Best {s.bestScore.toLocaleString()}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ArcadeHudPill label={`Chain x${s.chain}`} />
            <ArcadeHudPill label={`Timer ${s.chainTime.toFixed(1)}s`} />
            <ArcadeHudPill label={`Heat ${heat}%`} tone={heat >= 80 ? 'warn' : 'default'} />
            {heat > 0 && <ArcadeHudPill label={`Heat x${heatMult.toFixed(2)}`} tone="accent" />}
            {event && <ArcadeHudPill label={`${event} ${Math.ceil(eventTime)}s`} tone="accent" />}
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
              <div className="h-full bg-rose-400/70" style={{ width: `${clamp(heat, 0, 100)}%` }} />
            </div>
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            Hold Click tether • Release fling • WASD adjust • Space boost • Shift brake
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {s.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="tetherdrift">
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
          <ArcadeHudShell gameId="tetherdrift">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">{s.toastText}</ArcadeHudCard>
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
    preventDefault: [' ', 'Space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
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
  const ropePoints = useMemo(() => [new THREE.Vector3(), new THREE.Vector3()], []);
  const arrowRef = useRef<THREE.Group | null>(null);

  const [gates, setGates] = useState<THREE.Vector3[]>([]);
  const [activeGateIdx, setActiveGateIdx] = useState(0);

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

  const rebuildConstellation = (seedPos: THREE.Vector3, seedVel: THREE.Vector3) => {
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

  const findNearestPylon = (p: THREE.Vector3): Pylon => {
    let best = pylons[0];
    let bestD = Infinity;
    for (const py of pylons) {
      const d = (py.pos.x - p.x) * (py.pos.x - p.x) + (py.pos.z - p.z) * (py.pos.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = py;
      }
    }
    return best;
  };

  useFrame((_, dt) => {
    // Camera follow always
    camera.position.lerp(new THREE.Vector3(posRef.current.x, 13.5, posRef.current.z + 19), 0.08);
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
      const type: EventType = roll < 0.34 ? 'TwinLasers' : roll < 0.67 ? 'ShockPylon' : 'LowGravity';
      eventRef.current.type = type;
      eventRef.current.duration = 9;
      eventRef.current.startsAt = tetherDriftState.elapsed;
      eventRef.current.endsAt = tetherDriftState.elapsed + eventRef.current.duration;
      eventRef.current.shockPylonId = type === 'ShockPylon' ? pylons[Math.floor(Math.random() * pylons.length)].id : null;
      nextEventAtRef.current = tetherDriftState.elapsed + 28;
    }
    if (eventRef.current.type && tetherDriftState.elapsed >= eventRef.current.endsAt) {
      eventRef.current.type = null;
      eventRef.current.shockPylonId = null;
      eventRef.current.duration = 0;
    }

    // Tether transitions
    if (pointerJustDown && !tetheredRef.current) {
      tetheredRef.current = true;
      anchorRef.current = findNearestPylon(posRef.current);
      ropeRRef.current = clamp(posRef.current.distanceTo(anchorRef.current.pos), 6, 18);
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
        const spd = clamp(Math.abs(angVelRef.current) * ropeRRef.current * 0.7, 6, 32);
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
            const tensionSweet = tension > PERFECT_TENSION_MIN && tension < PERFECT_TENSION_MAX;
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
      const dir = v.lengthSq() > 0.2 ? v.normalize() : new THREE.Vector3(0, 0, -1);
      velRef.current.addScaledVector(dir, BOOST_IMPULSE);
      tetherDriftState.addScore(6);
    }

    // Controls
    const ix = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const iz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);

    if (pointerDown && tetheredRef.current && anchorRef.current) {
      // Tethered orbit
      const a = anchorRef.current;

      // A/D changes orbit speed; W/S reels
      angVelRef.current = clamp(angVelRef.current + ix * 2.3 * step, 0.9, 6.2);
      ropeRRef.current = clamp(ropeRRef.current + iz * 7.2 * step, 5.5, 18.5);

      const off = posRef.current.clone().sub(a.pos);
      off.y = 0;
      if (off.lengthSq() < 0.0001) off.set(0, 0, 1);

      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), angVelRef.current * step).setLength(ropeRRef.current);
      posRef.current.copy(a.pos).add(off);
      clampArenaXZ(posRef.current);

      // Keep a tangential velocity “estimate” so release feels consistent
      const tDir = new THREE.Vector3(-off.z, 0, off.x).normalize();
      velRef.current.copy(tDir.multiplyScalar(clamp(Math.abs(angVelRef.current) * ropeRRef.current * 0.65, 6, 30)));

      // Cool heat while tethered (encourages alternation)
      tetherDriftState.setHeat(tetherDriftState.heat - 28 * step);

      // Shock pylon event: tethering the hot pylon pops you off
      if (eventRef.current.type === 'ShockPylon' && eventRef.current.shockPylonId && a.id === eventRef.current.shockPylonId) {
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
      const chaoticThr = thr.clone().add(new THREE.Vector3((Math.random() - 0.5) * chaos, 0, (Math.random() - 0.5) * chaos));
      if (chaoticThr.lengthSq() > 0.0001) chaoticThr.normalize();

      velRef.current.addScaledVector(chaoticThr, 18 * step);

      // Damping (low gravity event = more drift)
      const baseDamping = eventRef.current.type === 'LowGravity' ? 0.985 : 0.972;
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
      if (dx * dx + dz * dz < (GATE_R + PLAYER_R * 0.45) * (GATE_R + PLAYER_R * 0.45)) {
        const perfect = tetherDriftState.elapsed <= perfectArmedUntilRef.current;
        perfectArmedUntilRef.current = 0;

        const nextIdx = activeGateIdx + 1;
        const done = nextIdx >= gates.length;
        tetherDriftState.onGatePassed({ perfect, constellationDone: done });

        if (done) {
          rebuildConstellation(posRef.current, velRef.current);
        } else {
          setActiveGateIdx(nextIdx);
          tetherDriftState.chainTime = Math.max(2.4, tetherDriftState.chainTime);
        }
      }
    }

    // Laser sweep collision (event-driven)
    if (eventRef.current.type === 'TwinLasers' && eventRef.current.duration > 0) {
      laserAngleRef.current += step * 0.9;
      const eventElapsed = tetherDriftState.elapsed - eventRef.current.startsAt;
      laserStrengthRef.current = clamp(eventElapsed / LASER_TELEGRAPH, 0.2, 1);
      const live = eventElapsed >= LASER_TELEGRAPH;
      if (live) {
        const a = laserAngleRef.current;
        const distToLine = Math.abs(Math.sin(a) * posRef.current.x - Math.cos(a) * posRef.current.z);
        const touching = distToLine < 0.55;
        if (touching) tetherDriftState.damage(22 * step);

        const a2 = a + Math.PI / 2;
        const dist2 = Math.abs(Math.sin(a2) * posRef.current.x - Math.cos(a2) * posRef.current.z);
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
          arrowRef.current.position.set(posRef.current.x, 3.1, posRef.current.z);
          arrowRef.current.rotation.set(0, Math.atan2(dx, dz), 0);
        } else {
          arrowRef.current.visible = false;
        }
      } else {
        arrowRef.current.visible = false;
      }
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <TetherDriftHUD
        event={eventRef.current.type}
        eventTime={eventRef.current.type ? Math.max(0, eventRef.current.endsAt - tetherDriftState.elapsed) : 0}
      />
      <Sky />
      <fog attach="fog" args={['#061120', 40, 140]} />
      <Stars radius={220} depth={60} count={1400} factor={4} saturation={0} fade />
      <ambientLight intensity={0.38} />
      <directionalLight position={[22, 30, 14]} intensity={1.1} castShadow />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#070b12" />
      </mesh>

      {/* Pylons */}
      {pylons.map((p) => (
        <PylonMesh key={p.id} pylon={p} shock={eventRef.current.type === 'ShockPylon' && eventRef.current.shockPylonId === p.id} />
      ))}

      {/* Gates */}
      {gates.map((g, idx) => (
        <GateMesh key={`${g.x.toFixed(2)}-${g.z.toFixed(2)}-${idx}`} pos={g} active={idx === activeGateIdx} />
      ))}

      <line ref={ropeRef} geometry={ropeGeom}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.55} />
      </line>

      <group ref={arrowRef}>
        <mesh position={[0, 0.2, 0.6]}>
          <boxGeometry args={[0.18, 0.18, 1.1]} />
          <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 1.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.32, 0.6, 10]} />
          <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Lasers */}
      <LaserBar angleRef={laserAngleRef} strengthRef={laserStrengthRef} />
      <LaserBar angleRef={laserAngleRef} strengthRef={laserStrengthRef} offset={Math.PI / 2} />

      {/* Player */}
      <mesh ref={playerRef} castShadow>
        <sphereGeometry args={[PLAYER_R, 28, 28]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.18} />
      </mesh>
    </>
  );
};

export default TetherDrift;
export * from './state';
