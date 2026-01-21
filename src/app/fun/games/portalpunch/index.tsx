'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html, Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Physics, usePlane, useSphere, useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { ArcadeHudCard, ArcadeHudPill, ArcadeHudShell } from '../../components/shell/ArcadeHudPanel';
import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { portalPunchState } from './state';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ARENA = 54;
const HALF = ARENA / 2;
const BALL_R = 1.1;

const PORTAL_R = 1.55;
const TARGET_R = 1.35;

const DASH_CD = 1.0;
const DASH_IMPULSE = 7.2;
const CHAIN_WINDOW_MAX = 1.4;
const LASER_TELEGRAPH = 1.1;
const BEST_SCORE_KEY = 'portalpunch-best-score';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type PortalPair = { a: THREE.Vector3 | null; b: THREE.Vector3 | null };
type Target = { id: string; pos: THREE.Vector3; active: boolean };
type NullZone = { id: string; pos: THREE.Vector3; r: number };

const Ground: React.FC = () => {
  const [ref] = usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], position: [0, 0, 0] }));
  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[ARENA, ARENA]} />
      <meshStandardMaterial color="#070b12" />
    </mesh>
  );
};

const Wall: React.FC<{ position: [number, number, number]; size: [number, number, number] }> = ({ position, size }) => {
  const [ref] = useBox(() => ({ type: 'Static', position, args: size }));
  return (
    <mesh ref={ref} visible={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial />
    </mesh>
  );
};

const PortalMarker: React.FC<{ portalsRef: React.MutableRefObject<PortalPair>; slot: 'a' | 'b'; color: string }> = ({
  portalsRef,
  slot,
  color,
}) => {
  const ref = useRef<THREE.Group | null>(null);

  useFrame(() => {
    if (!ref.current) return;
    const p = portalsRef.current[slot];
    if (!p) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    ref.current.position.set(p.x, 0.02, p.z);
  });

  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.75, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <torusGeometry args={[0.9, 0.12, 12, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
};

const NullZoneMarker: React.FC<{ z: NullZone }> = ({ z }) => (
  <group position={[z.pos.x, 0.02, z.pos.z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[z.r - 0.2, z.r, 40]} />
      <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.35} />
    </mesh>
  </group>
);

const TargetOrb: React.FC<{ t: Target }> = ({ t }) => (
  <mesh position={[t.pos.x, 1.1, t.pos.z]} castShadow>
    <sphereGeometry args={[0.62, 18, 18]} />
    <meshStandardMaterial
      color={t.active ? '#facc15' : '#334155'}
      emissive={t.active ? '#f59e0b' : '#000000'}
      emissiveIntensity={t.active ? 0.55 : 0}
    />
  </mesh>
);

const PortalPunchHUD: React.FC = () => {
  const s = useSnapshot(portalPunchState);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) portalPunchState.bestScore = Number(stored) || 0;
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${s.bestScore}`);
  }, [s.bestScore]);
  const toastOpacity = clamp(s.toastTime / 1.1, 0, 1);
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <ArcadeHudShell gameId="portalpunch" className="absolute top-4 left-4 pointer-events-auto">
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">Score</div>
          <div className="text-2xl font-semibold text-white">{s.score.toLocaleString()}</div>
          <div className="text-[11px] text-white/50">Best {s.bestScore.toLocaleString()}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ArcadeHudPill label={`Chain x${s.chain}`} />
            <ArcadeHudPill label={`Window ${s.chainTime.toFixed(1)}s`} />
            <ArcadeHudPill label={`Integrity ${Math.round(s.integrity)}%`} />
            {s.chargedTime > 0 && <ArcadeHudPill label="Charged" tone="accent" />}
            {s.event && <ArcadeHudPill label={`${s.event} ${Math.ceil(s.eventTime)}s`} tone="accent" />}
          </div>

          <div className="mt-3 space-y-2 text-[11px] text-white/70">
            <div className="flex items-center justify-between">
              <span>Chain window</span>
              <span>{s.chainTime.toFixed(1)}s</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{ width: `${clamp((s.chainTime / CHAIN_WINDOW_MAX) * 100, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Integrity</span>
              <span>{Math.round(s.integrity)}%</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-300/70" style={{ width: `${clamp(s.integrity, 0, 100)}%` }} />
            </div>
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            LMB portal A • RMB portal B • E clear • WASD roll • Space dash • Teleport + hit to restore integrity
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {s.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="portalpunch">
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
          <ArcadeHudShell gameId="portalpunch">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">
              {s.toastText}
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </Html>
  );
};

const Player: React.FC<{
  portalsRef: React.MutableRefObject<PortalPair>;
  targetsRef: React.MutableRefObject<Target[]>;
  setTargets: React.Dispatch<React.SetStateAction<Target[]>>;
}> = ({ portalsRef, targetsRef, setTargets }) => {
  const { camera } = useThree();
  const { paused } = useGameUIState();

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [' ', 'Space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
  });

  const [ref, api] = useSphere(() => ({
    mass: 1.25,
    args: [BALL_R],
    position: [0, BALL_R + 0.2, 12],
    linearDamping: 0.28,
    angularDamping: 0.65,
    material: { restitution: 0.25, friction: 0.9 },
    userData: { type: 'player' },
  }));

  const velRef = useRef(new THREE.Vector3());
  const dashCdRef = useRef(0);
  const teleportCdRef = useRef(0);
  const lastTeleportAtRef = useRef(-Infinity);
  const punchFxRef = useRef<THREE.Mesh | null>(null);
  const punchFxTimeRef = useRef(0);

  useEffect(() => {
    const unsub = api.velocity.subscribe((v) => velRef.current.set(v[0], v[1], v[2]));
    return () => void unsub();
  }, [api]);

  useFrame((state, dt) => {
    if (!ref.current) return;

    // Camera follow always
    const p = ref.current.getWorldPosition(new THREE.Vector3());
    camera.position.lerp(new THREE.Vector3(p.x, p.y + 11, p.z + 16), 0.08);
    camera.lookAt(p);

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    const timeScale = portalPunchState.slowMoTime > 0 ? 0.6 : 1;
    const step = dt * timeScale;

    portalPunchState.tick(step);
    if (portalPunchState.gameOver) {
      clearFrameInput(inputRef);
      return;
    }
    dashCdRef.current = Math.max(0, dashCdRef.current - step);
    teleportCdRef.current = Math.max(0, teleportCdRef.current - step);

    const keys = inputRef.current.keysDown;
    const justPressed = inputRef.current.justPressed;

    const ix = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const iz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);

    const input = new THREE.Vector3(ix, 0, iz);
    if (input.lengthSq() > 0.0001) input.normalize();

    // Steering: keys + subtle pointer influence
    const steer = new THREE.Vector3(input.x + state.pointer.x * 0.35, 0, input.z + -state.pointer.y * 0.35);
    if (steer.lengthSq() > 0.0001) steer.normalize();

    api.applyForce([steer.x * 80 * timeScale, 0, steer.z * 80 * timeScale], [0, 0, 0]);

    // Soft target assist to keep runs flowing
    let nearest: Target | null = null;
    let bestD2 = Infinity;
    for (const t of targetsRef.current) {
      if (!t.active) continue;
      const dx = t.pos.x - p.x;
      const dz = t.pos.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        nearest = t;
      }
    }
    if (nearest && bestD2 < 140) {
      const dist = Math.sqrt(bestD2);
      const falloff = clamp(1 - dist / 12, 0, 1);
      if (falloff > 0.01) {
        const dir = new THREE.Vector3(nearest.pos.x - p.x, 0, nearest.pos.z - p.z).normalize();
        api.applyForce([dir.x * 35 * falloff * timeScale, 0, dir.z * 35 * falloff * timeScale], [0, 0, 0]);
      }
    }

    // Dash (small “save” tool)
    if ((justPressed.has(' ') || justPressed.has('space')) && dashCdRef.current <= 0) {
      dashCdRef.current = DASH_CD;
      portalPunchState.onDash();
      const v = velRef.current.clone();
      const dir = v.lengthSq() > 0.4 ? v.normalize() : new THREE.Vector3(0, 0, -1);
      api.applyImpulse([dir.x * DASH_IMPULSE, 0.55, dir.z * DASH_IMPULSE], [0, 0, 0]);
    }

    // Laser hazard: event-driven and telegraphed
    const laserEvent = portalPunchState.event === 'LaserSweep' && portalPunchState.eventDuration > 0;
    if (laserEvent) {
      const eventElapsed = portalPunchState.eventDuration - portalPunchState.eventTime;
      const laserLive = eventElapsed >= LASER_TELEGRAPH;
      if (laserLive) {
        const laserA = portalPunchState.elapsed * 0.9;
        const distToLine = Math.abs(Math.sin(laserA) * p.x - Math.cos(laserA) * p.z);
        if (distToLine < 0.5) {
          portalPunchState.breakChain();
          portalPunchState.damageIntegrity(18 * step);
        }
      }
    }

    // Teleport through portals (integrity-gated)
    const portals = portalsRef.current;
    if (portals.a && portals.b && teleportCdRef.current <= 0) {
      const da = Math.hypot(p.x - portals.a.x, p.z - portals.a.z);
      const db = Math.hypot(p.x - portals.b.x, p.z - portals.b.z);

      const doTeleport = (from: THREE.Vector3, to: THREE.Vector3) => {
        const teleport = portalPunchState.onTeleport();
        if (!teleport.ok) return;
        teleportCdRef.current = 0.35;
        lastTeleportAtRef.current = portalPunchState.elapsed;

        const v = velRef.current.clone();
        const spd = v.length();
        const dir = spd > 0.35 ? v.clone().divideScalar(spd) : new THREE.Vector3(0, 0, -1);

        // Small exit offset prevents infinite instant loops
        const out = to.clone().addScaledVector(dir, 2.0);
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        out.addScaledVector(side, (Math.random() * 2 - 1) * 0.6);
        out.x = clamp(out.x, -HALF + 2.4, HALF - 2.4);
        out.z = clamp(out.z, -HALF + 2.4, HALF - 2.4);

        api.position.set(out.x, p.y, out.z);

        const boosted = clamp(spd * (teleport.punch ? 1.4 : 1.15) + (teleport.punch ? 6.2 : 1.5), 0, 38);
        api.velocity.set(dir.x * boosted, velRef.current.y, dir.z * boosted);

        if (teleport.punch && punchFxRef.current) {
          punchFxTimeRef.current = 0.4;
          punchFxRef.current.position.set(out.x, 0.15, out.z);
          punchFxRef.current.visible = true;
        }
      };

      if (da < PORTAL_R) doTeleport(portals.a, portals.b);
      else if (db < PORTAL_R) doTeleport(portals.b, portals.a);
    }

    // Target hits (manual distance checks)
    const doubleTargets = portalPunchState.event === 'DoubleTargets';
    for (let i = 0; i < targetsRef.current.length; i++) {
      const t = targetsRef.current[i];
      if (!t.active) continue;
      const d = Math.hypot(p.x - t.pos.x, p.z - t.pos.z);
      if (d < TARGET_R) {
        if (portalPunchState.chargedTime <= 0) {
          const away = new THREE.Vector3(p.x - t.pos.x, 0, p.z - t.pos.z);
          if (away.lengthSq() > 0.01) away.normalize();
          api.applyImpulse([away.x * 4.2, 0.25, away.z * 4.2], [0, 0, 0]);
          portalPunchState.breakChain();
          portalPunchState.setToast('SHIELDED', 0.6, false);
          break;
        }

        const punch = portalPunchState.punchTime > 0;
        portalPunchState.onTargetHit(velRef.current.length(), punch);
        const sinceTeleport = portalPunchState.elapsed - lastTeleportAtRef.current;
        if (sinceTeleport < 1.1) {
          const bonus = 35 + clamp(velRef.current.length() * 3.2, 0, 55);
          portalPunchState.addScore(bonus);
          if (punch) portalPunchState.restoreIntegrity(6);
        }
        // Respawn this target somewhere else and keep only one active
        setTargets((prev) => {
          const next = prev.map((it, idx) => {
            const pos =
              idx === i
                ? new THREE.Vector3(
                    THREE.MathUtils.randFloat(-HALF + 4, HALF - 4),
                    0,
                    THREE.MathUtils.randFloat(-HALF + 4, HALF - 4)
                  )
                : it.pos;

            const active = doubleTargets ? it.active || idx === i : idx === i;
            return { ...it, pos, active };
          });

          if (doubleTargets) {
            let activeCount = 0;
            for (const it of next) if (it.active) activeCount += 1;
            if (activeCount < 2 && next.length > 1) {
              for (let idx = 0; idx < next.length && activeCount < 2; idx++) {
                if (!next[idx].active) {
                  next[idx] = { ...next[idx], active: true };
                  activeCount += 1;
                }
              }
            }
          }
          return next;
        });
        break;
      }
    }

    // Arena clamp: if you slam the wall, chain breaks (recoverable)
    const cx = clamp(p.x, -HALF + 2.4, HALF - 2.4);
    const cz = clamp(p.z, -HALF + 2.4, HALF - 2.4);
    if (cx !== p.x || cz !== p.z) {
      api.position.set(cx, p.y, cz);
      api.velocity.set(velRef.current.x * 0.35, velRef.current.y, velRef.current.z * 0.35);
      portalPunchState.breakChain();
      const impact = clamp(velRef.current.length() * 0.65, 6, 14);
      portalPunchState.damageIntegrity(impact);
    }

    if (punchFxRef.current) {
      if (punchFxTimeRef.current > 0) {
        punchFxTimeRef.current = Math.max(0, punchFxTimeRef.current - step);
        const t = 1 - punchFxTimeRef.current / 0.4;
        const scale = 1 + t * 4.2;
        punchFxRef.current.scale.set(scale, scale, scale);
        const mat = punchFxRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = 0.65 * (1 - t);
        punchFxRef.current.visible = true;
      } else {
        punchFxRef.current.visible = false;
      }
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <mesh ref={ref} castShadow>
        <sphereGeometry args={[BALL_R, 28, 28]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.12} />
      </mesh>
      <mesh ref={punchFxRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1.45, 32]} />
        <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.6} transparent opacity={0} />
      </mesh>
    </>
  );
};

const LaserVisual: React.FC = () => {
  const ref = useRef<THREE.Mesh | null>(null);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);
  useFrame(() => {
    if (!ref.current) return;
    const laserEvent = portalPunchState.event === 'LaserSweep' && portalPunchState.eventDuration > 0;
    if (!laserEvent) {
      ref.current.visible = false;
      return;
    }

    ref.current.visible = true;
    ref.current.rotation.set(0, portalPunchState.elapsed * 0.9, 0);

    const eventElapsed = portalPunchState.eventDuration - portalPunchState.eventTime;
    const telegraph = clamp(eventElapsed / LASER_TELEGRAPH, 0, 1);
    if (matRef.current) {
      matRef.current.emissiveIntensity = eventElapsed < LASER_TELEGRAPH ? 0.15 + 0.2 * telegraph : 0.45;
      matRef.current.opacity = eventElapsed < LASER_TELEGRAPH ? 0.25 + 0.25 * telegraph : 0.55;
    }
  });
  return (
    <mesh ref={ref} position={[0, 1.0, 0]} visible={false}>
      <boxGeometry args={[ARENA * 0.95, 0.18, 0.55]} />
      <meshStandardMaterial
        ref={matRef}
        color="#ef4444"
        emissive="#7f1d1d"
        emissiveIntensity={0.25}
        transparent
        opacity={0.25}
      />
    </mesh>
  );
};

const PortalPlacementController: React.FC<{
  portalsRef: React.MutableRefObject<PortalPair>;
  setPortals: React.Dispatch<React.SetStateAction<PortalPair>>;
  nullZones: NullZone[];
}> = ({ portalsRef, setPortals, nullZones }) => {
  const { camera } = useThree();
  const { paused } = useGameUIState();
  const pausedRef = useRef(paused);
  useEffect(() => void (pausedRef.current = paused), [paused]);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const canPlace = (p: THREE.Vector3) => {
      for (const z of nullZones) {
        const d = Math.hypot(p.x - z.pos.x, p.z - z.pos.z);
        if (d < z.r) return false;
      }
      return true;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (pausedRef.current) return;

      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera({ x, y } as any, camera);
      if (!raycaster.ray.intersectPlane(plane, tmp)) return;

      const p = new THREE.Vector3(clamp(tmp.x, -HALF + 3, HALF - 3), 0, clamp(tmp.z, -HALF + 3, HALF - 3));
      if (!canPlace(p)) return;

      setPortals((prev) => {
        const next: PortalPair = { ...prev };
        if (e.button === 2) next.b = p;
        else next.a = p;
        portalsRef.current = next;
        return next;
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      if (e.key.toLowerCase() !== 'e') return;
      setPortals({ a: null, b: null });
      portalsRef.current = { a: null, b: null };
    };

    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [camera, nullZones, plane, portalsRef, raycaster, setPortals, tmp]);

  return null;
};

const PortalPunch: React.FC = () => {
  const { paused } = useGameUIState();
  const [portals, setPortals] = useState<PortalPair>({ a: null, b: null });
  const portalsRef = useRef<PortalPair>(portals);
  const lastEventRef = useRef(portalPunchState.event);
  const driftRef = useRef({ a: new THREE.Vector3(), b: new THREE.Vector3() });

  const nullZones = useMemo<NullZone[]>(
    () => [
      { id: 'nz1', pos: new THREE.Vector3(-10, 0, -6), r: 4.6 },
      { id: 'nz2', pos: new THREE.Vector3(12, 0, 10), r: 4.2 },
      { id: 'nz3', pos: new THREE.Vector3(0, 0, 0), r: 4.8 },
    ],
    []
  );

  const [targets, setTargets] = useState<Target[]>(
    Array.from({ length: 7 }, (_, i) => ({
      id: `t-${i}-${Math.random().toString(36).slice(2, 7)}`,
      pos: new THREE.Vector3(THREE.MathUtils.randFloat(-HALF + 5, HALF - 5), 0, THREE.MathUtils.randFloat(-HALF + 5, HALF - 5)),
      active: i === 0,
    }))
  );
  const targetsRef = useRef<Target[]>(targets);
  useEffect(() => void (targetsRef.current = targets), [targets]);

  const activateTargets = (count: number) => {
    setTargets((prev) => {
      const picks = new Set<number>();
      while (picks.size < Math.min(count, prev.length)) {
        picks.add(Math.floor(Math.random() * prev.length));
      }
      return prev.map((t, idx) => ({ ...t, active: picks.has(idx) }));
    });
  };

  const keepSingleTarget = () => {
    setTargets((prev) => {
      let activeIdx = prev.findIndex((t) => t.active);
      if (activeIdx < 0) activeIdx = Math.floor(Math.random() * prev.length);
      return prev.map((t, idx) => ({ ...t, active: idx === activeIdx }));
    });
  };

  useFrame((_, dt) => {
    if (paused) return;
    const timeScale = portalPunchState.slowMoTime > 0 ? 0.6 : 1;
    const step = dt * timeScale;
    const event = portalPunchState.event;
    if (event !== lastEventRef.current) {
      if (event === 'DoubleTargets') activateTargets(2);
      if (lastEventRef.current === 'DoubleTargets' && event !== 'DoubleTargets') keepSingleTarget();

      if (event === 'PortalDrift') {
        driftRef.current.a.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        driftRef.current.b.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      }
      if (lastEventRef.current === 'PortalDrift' && event !== 'PortalDrift') {
        driftRef.current.a.set(0, 0, 0);
        driftRef.current.b.set(0, 0, 0);
      }

      lastEventRef.current = event;
    }

    if (event !== 'PortalDrift') return;

    const driftSpeed = 1.35;
    const applyDrift = (key: 'a' | 'b') => {
      const pos = portalsRef.current[key];
      if (!pos) return;

      const dir = driftRef.current[key];
      if (dir.lengthSq() < 0.01) {
        dir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      }

      pos.addScaledVector(dir, step * driftSpeed);

      let inNullZone = false;
      for (const z of nullZones) {
        const d = Math.hypot(pos.x - z.pos.x, pos.z - z.pos.z);
        if (d < z.r) {
          inNullZone = true;
          break;
        }
      }

      if (pos.x < -HALF + 3 || pos.x > HALF - 3 || pos.z < -HALF + 3 || pos.z > HALF - 3 || inNullZone) {
        dir.multiplyScalar(-1);
        pos.addScaledVector(dir, step * driftSpeed * 2);
      }

      pos.x = clamp(pos.x, -HALF + 3, HALF - 3);
      pos.z = clamp(pos.z, -HALF + 3, HALF - 3);
    };

    applyDrift('a');
    applyDrift('b');
  });

  const walls = useMemo(
    () => [
      { position: [0, 10, -HALF - 1.4] as [number, number, number], size: [ARENA + 10, 22, 2] as [number, number, number] },
      { position: [0, 10, HALF + 1.4] as [number, number, number], size: [ARENA + 10, 22, 2] as [number, number, number] },
      { position: [-HALF - 1.4, 10, 0] as [number, number, number], size: [2, 22, ARENA + 10] as [number, number, number] },
      { position: [HALF + 1.4, 10, 0] as [number, number, number], size: [2, 22, ARENA + 10] as [number, number, number] },
    ],
    []
  );

  return (
    <>
      <PortalPunchHUD />
      <Sky />
      <fog attach="fog" args={['#050814', 35, 110]} />
      <Stars radius={240} depth={60} count={1200} factor={4} saturation={0} fade />
      <ambientLight intensity={0.38} />
      <directionalLight position={[22, 30, 14]} intensity={1.1} castShadow />

      <PortalPlacementController portalsRef={portalsRef} setPortals={setPortals} nullZones={nullZones} />

      <Physics gravity={[0, -22, 0]} iterations={6}>
        <Ground />
        {walls.map((w, idx) => (
          <Wall key={idx} position={w.position} size={w.size} />
        ))}

        {nullZones.map((z) => (
          <NullZoneMarker key={z.id} z={z} />
        ))}

        {portals.a && <PortalMarker portalsRef={portalsRef} slot="a" color="#22d3ee" />}
        {portals.b && <PortalMarker portalsRef={portalsRef} slot="b" color="#fb7185" />}

        {targets.map((t) => (
          <TargetOrb key={t.id} t={t} />
        ))}

        <Player portalsRef={portalsRef} targetsRef={targetsRef} setTargets={setTargets} />
      </Physics>

      <LaserVisual />
    </>
  );
};

export default PortalPunch;
export * from './state';
