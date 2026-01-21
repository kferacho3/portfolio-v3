'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html, Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { ArcadeHudCard, ArcadeHudPill, ArcadeHudShell } from '../../components/shell/ArcadeHudPanel';
import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { conveyorChaosState } from './state';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const GRID = 10;
const TILE = 3.2;
const ARENA = GRID * TILE;
const HALF = ARENA / 2;
const REVERSE_DURATION = 1.35;
const REVERSE_COOLDOWN = 3.5;
const MIN_GOAL_DIST = 5;
const START_TILE = { ix: Math.floor(HALF / TILE), iz: Math.floor(HALF / TILE) };
const BEST_SCORE_KEY = 'conveyorchaos-best-score';

type Dir = 0 | 1 | 2 | 3; // N/E/S/W
type TileKind = 'belt' | 'booster' | 'bumper' | 'hole' | 'crusher' | 'switch';
type Tile = { kind: TileKind; dir: Dir; phase: number; override: number };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const dirVec = (d: Dir) => {
  switch (d) {
    case 0:
      return new THREE.Vector3(0, 0, -1);
    case 1:
      return new THREE.Vector3(1, 0, 0);
    case 2:
      return new THREE.Vector3(0, 0, 1);
    default:
      return new THREE.Vector3(-1, 0, 0);
  }
};

const tileCenter = (ix: number, iz: number) => {
  const x = -HALF + TILE / 2 + ix * TILE;
  const z = -HALF + TILE / 2 + iz * TILE;
  return new THREE.Vector3(x, 0, z);
};

const posToTile = (p: THREE.Vector3) => {
  const ix = Math.floor((p.x + HALF) / TILE);
  const iz = Math.floor((p.z + HALF) / TILE);
  return { ix, iz };
};

const inBounds = (ix: number, iz: number) => ix >= 0 && ix < GRID && iz >= 0 && iz < GRID;

function randomDir(): Dir {
  return Math.floor(Math.random() * 4) as Dir;
}

function randomTileKind(): TileKind {
  const r = Math.random();
  if (r < 0.66) return 'belt';
  if (r < 0.76) return 'booster';
  if (r < 0.86) return 'bumper';
  if (r < 0.92) return 'hole';
  if (r < 0.97) return 'switch';
  return 'crusher';
}

function makeInitialBoard(): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < GRID * GRID; i++) {
    const kind = Math.random() < 0.85 ? 'belt' : randomTileKind();
    tiles.push({ kind, dir: randomDir(), phase: Math.random() * 10, override: 0 });
  }
  return tiles;
}

function pickGoalTile(tiles: Tile[]): { ix: number; iz: number } {
  for (let i = 0; i < 80; i++) {
    const ix = Math.floor(Math.random() * GRID);
    const iz = Math.floor(Math.random() * GRID);
    const t = tiles[iz * GRID + ix];
    if (t.kind === 'hole') continue;
    if (Math.hypot(ix - START_TILE.ix, iz - START_TILE.iz) < MIN_GOAL_DIST) continue;
    return { ix, iz };
  }
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const t = tiles[iz * GRID + ix];
      if (t.kind === 'hole') continue;
      if (Math.hypot(ix - START_TILE.ix, iz - START_TILE.iz) < MIN_GOAL_DIST) continue;
      return { ix, iz };
    }
  }
  return { ix: START_TILE.ix, iz: START_TILE.iz };
}

const ConveyorHUD: React.FC = () => {
  const s = useSnapshot(conveyorChaosState);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(BEST_SCORE_KEY);
    if (stored) conveyorChaosState.bestScore = Number(stored) || 0;
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_KEY, `${s.bestScore}`);
  }, [s.bestScore]);
  const goalMax = clamp(12 - s.level * 0.35, 6, 12);
  const reverseLabel =
    s.reverseTime > 0 ? `${s.reverseTime.toFixed(1)}s` : s.reverseCooldown > 0 ? `${s.reverseCooldown.toFixed(1)}s` : 'ready';
  const overrideLabel = s.overrideCooldown > 0 ? `${s.overrideCooldown.toFixed(1)}s` : 'ready';
  const toastOpacity = clamp(s.toastTime / 1.1, 0, 1);
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <ArcadeHudShell gameId="conveyorchaos" className="absolute top-4 left-4 pointer-events-auto">
        <ArcadeHudCard className="min-w-[260px]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">Score</div>
          <div className="text-2xl font-semibold text-white">{s.score.toLocaleString()}</div>
          <div className="text-[11px] text-white/50">Best {s.bestScore.toLocaleString()}</div>

          <div className="mt-2 flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-[0.28em] text-white/50">Stress</div>
            <div className="flex items-center gap-1">
              {Array.from({ length: s.maxStrikes }).map((_, i) => (
                <div
                  key={`strike-${i}`}
                  className={`h-2.5 w-2.5 rounded-sm ${i < s.strikes ? 'bg-rose-400' : 'bg-white/15'}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ArcadeHudPill label={`Level ${s.level}`} />
            <ArcadeHudPill label={`Chain x${s.chain}`} />
            {s.deliveryStreak > 0 && <ArcadeHudPill label={`Streak x${s.deliveryStreak}`} tone="accent" />}
            <ArcadeHudPill label={`Goal ${s.goalTime.toFixed(1)}s`} />
            <ArcadeHudPill label={`Reverse ${reverseLabel}`} tone={s.reverseTime > 0 ? 'accent' : 'default'} />
            <ArcadeHudPill label={`Override ${overrideLabel}`} tone={s.overrideCooldown > 0 ? 'default' : 'accent'} />
            {s.event && <ArcadeHudPill label={`${s.event} ${Math.ceil(s.eventTime)}s`} tone="accent" />}
          </div>

          <div className="mt-3 space-y-2 text-[11px] text-white/70">
            <div className="flex items-center justify-between">
              <span>Goal timer</span>
              <span>{s.goalTime.toFixed(1)}s</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{ width: `${clamp((s.goalTime / goalMax) * 100, 0, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Reverse</span>
              <span>{reverseLabel}</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full ${s.reverseTime > 0 ? 'bg-amber-300/80' : 'bg-slate-400/70'}`}
                style={{
                  width: `${clamp(
                    s.reverseTime > 0
                      ? (s.reverseTime / REVERSE_DURATION) * 100
                      : (1 - s.reverseCooldown / REVERSE_COOLDOWN) * 100,
                    0,
                    100
                  )}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span>Override</span>
              <span>{overrideLabel}</span>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-cyan-400/70"
                style={{ width: `${clamp((1 - s.overrideCooldown / s.overrideCooldownMax) * 100, 0, 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/50">
            Click rotate • Right click back • Shift 180 • WASD nudge • Space reverse • E override
          </div>
        </ArcadeHudCard>
      </ArcadeHudShell>

      {s.gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
          <ArcadeHudShell gameId="conveyorchaos">
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
          <ArcadeHudShell gameId="conveyorchaos">
            <ArcadeHudCard className="px-4 py-2 text-xs font-semibold tracking-[0.25em]">
              {s.toastText}
            </ArcadeHudCard>
          </ArcadeHudShell>
        </div>
      )}
    </Html>
  );
};

const ConveyorChaos: React.FC = () => {
  const { camera } = useThree();
  const { paused } = useGameUIState();

  const inputRef = useInputRef({
    enabled: !paused,
    preventDefault: [' ', 'Space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'],
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const playerMesh = useRef<THREE.Mesh | null>(null);
  const posRef = useRef(new THREE.Vector3(0, 1.1, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const boosterScoreRef = useRef(0);

  const [tiles, setTiles] = useState<Tile[]>(() => makeInitialBoard());
  const tilesRef = useRef<Tile[]>(tiles);
  useEffect(() => void (tilesRef.current = tiles), [tiles]);

  const [goal, setGoal] = useState<{ ix: number; iz: number }>(() => pickGoalTile(tilesRef.current));
  const goalRef = useRef(goal);
  useEffect(() => void (goalRef.current = goal), [goal]);

  // Click to rotate tile
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onPointerDown = (e: PointerEvent) => {
      if (paused) return;
      if (e.button !== 0 && e.button !== 2) return;
      if (e.button === 2) e.preventDefault();

      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera({ x, y } as any, camera);
      if (!raycaster.ray.intersectPlane(plane, tmp)) return;

      const ix = Math.floor((tmp.x + HALF) / TILE);
      const iz = Math.floor((tmp.z + HALF) / TILE);
      if (!inBounds(ix, iz)) return;

      const idx = iz * GRID + ix;
      setTiles((prev) => {
        const next = [...prev];
        const t = next[idx];
        const rotateSteps = e.shiftKey ? 2 : e.button === 2 ? -1 : 1;
        next[idx] = { ...t, dir: (((t.dir + rotateSteps + 4) % 4) as Dir) };
        return next;
      });
    };

    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [camera, paused, plane, raycaster, tmp]);

  const respawnPlayer = () => {
    posRef.current.set(0, 1.1, 0);
    velRef.current.set(0, 0, 0);
  };

  const mutateBoardOnLevelUp = () => {
    // Add meaner tiles as level grows (1-2 per delivery)
    setTiles((prev) => {
      const next = [...prev];
      const flips = clamp(2 + Math.floor(conveyorChaosState.level / 3), 2, 8);
      for (let i = 0; i < flips; i++) {
        const k = Math.floor(Math.random() * next.length);
        const t = next[k];
        // Bias towards adding hazards as you go up
        const kindRoll = Math.random();
        const kind: TileKind =
          conveyorChaosState.level < 4
            ? kindRoll < 0.8
              ? 'belt'
              : 'hole'
            : kindRoll < 0.45
              ? 'belt'
              : kindRoll < 0.62
                ? 'booster'
                : kindRoll < 0.78
                  ? 'bumper'
                  : kindRoll < 0.9
                    ? 'hole'
                    : kindRoll < 0.96
                      ? 'switch'
                      : 'crusher';
        next[k] = { ...t, kind, dir: randomDir(), override: 0 };
      }
      return next;
    });
  };

  useFrame((_, dt) => {
    // Camera
    camera.position.lerp(new THREE.Vector3(posRef.current.x, 22, posRef.current.z + 18), 0.08);
    camera.lookAt(posRef.current.x, 0, posRef.current.z);

    if (paused) {
      clearFrameInput(inputRef);
      return;
    }

    const timeScale = conveyorChaosState.slowMoTime > 0 ? 0.6 : 1;
    const step = dt * timeScale;

    conveyorChaosState.tick(step);
    if (conveyorChaosState.gameOver) {
      clearFrameInput(inputRef);
      return;
    }

    const keys = inputRef.current.keysDown;
    const justPressed = inputRef.current.justPressed;

    // Reverse belts (panic tool)
    if (justPressed.has(' ') || justPressed.has('space')) {
      conveyorChaosState.tryReverse();
    }

    // Auto-rotating switch tiles + override timers
    const tilesNow = tilesRef.current;
    for (let i = 0; i < tilesNow.length; i++) {
      const t = tilesNow[i];
      if (t.override > 0) t.override = Math.max(0, t.override - step);
      if (t.kind === 'switch') {
        t.phase += step;
        if (t.phase >= 2.2) {
          t.phase = 0;
          t.dir = (((t.dir + 1) % 4) as Dir);
        }
        continue;
      }
      if (t.kind === 'belt' || t.kind === 'booster') {
        t.phase += step * 1.7;
        if (t.phase >= Math.PI * 2) t.phase -= Math.PI * 2;
      }
    }

    // Goal timer fail
    if (conveyorChaosState.goalTime <= 0) {
      conveyorChaosState.onFail('timeout');
      if (conveyorChaosState.gameOver) {
        clearFrameInput(inputRef);
        return;
      }
      respawnPlayer();
      setGoal(pickGoalTile(tilesRef.current));
      clearFrameInput(inputRef);
      return;
    }

    // Determine tile under player
    const tilePos = posToTile(posRef.current);
    let tile: Tile | null = null;
    if (inBounds(tilePos.ix, tilePos.iz)) tile = tilesRef.current[tilePos.iz * GRID + tilePos.ix];

    if (justPressed.has('e') && tile && conveyorChaosState.tryOverride()) {
      const idx = tilePos.iz * GRID + tilePos.ix;
      setTiles((prev) => {
        const next = [...prev];
        const t = next[idx];
        next[idx] = { ...t, override: 3.8 };
        return next;
      });
    }

    const effectiveKind: TileKind | null = tile && tile.override > 0 ? 'belt' : tile?.kind ?? null;

    // Belt force by tile kind
    let beltStrength = 11;
    if (effectiveKind === 'booster') beltStrength = 18;
    if (effectiveKind === 'bumper') beltStrength = 0;
    if (effectiveKind === 'crusher') beltStrength = 9;
    if (effectiveKind === 'hole') beltStrength = 0;

    const overdrive = conveyorChaosState.event === 'Overdrive' ? 1.2 : 1;
    beltStrength *= overdrive;

    let beltForce = new THREE.Vector3(0, 0, 0);
    if (tile) {
      beltForce = dirVec(tile.dir).multiplyScalar(beltStrength);
      if (conveyorChaosState.reverseTime > 0) beltForce.multiplyScalar(-1);
    }

    // Nudge
    const nx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const nz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    const nudge = new THREE.Vector3(nx, 0, nz);
    if (nudge.lengthSq() > 0.0001) nudge.normalize().multiplyScalar(8);

    if (effectiveKind === 'booster' && nudge.lengthSq() < 0.0001 && conveyorChaosState.reverseTime <= 0) {
      boosterScoreRef.current += step * 6;
      if (boosterScoreRef.current >= 1) {
        const pts = Math.floor(boosterScoreRef.current);
        boosterScoreRef.current -= pts;
        conveyorChaosState.addScore(pts);
      }
    } else {
      boosterScoreRef.current = 0;
    }

    // Integrate (kinematic)
    velRef.current.addScaledVector(beltForce, step);
    velRef.current.addScaledVector(nudge, step);
    velRef.current.multiplyScalar(0.985);
    posRef.current.addScaledVector(velRef.current, step);

    // Clamp arena
    posRef.current.x = clamp(posRef.current.x, -HALF + 1.2, HALF - 1.2);
    posRef.current.z = clamp(posRef.current.z, -HALF + 1.2, HALF - 1.2);

    // Hole: chain breaks + respawn
    if (effectiveKind === 'hole') {
      conveyorChaosState.onFail('hole');
      if (conveyorChaosState.gameOver) {
        clearFrameInput(inputRef);
        return;
      }
      respawnPlayer();
      setGoal(pickGoalTile(tilesRef.current));
      clearFrameInput(inputRef);
      return;
    }

    // Bumper: push sideways once per frame (simple)
    if (effectiveKind === 'bumper') {
      const push = dirVec(((tile.dir + 1) % 4) as Dir).multiplyScalar(10);
      velRef.current.addScaledVector(push, step);
      conveyorChaosState.addScore(0);
    }

    // Crusher: slams periodically; if active and you’re on it, fail
    if (effectiveKind === 'crusher') {
      tile.phase += step;
      const slam = (Math.sin(tile.phase * 2.4) + 1) * 0.5; // 0..1
      if (slam > 0.92) {
        conveyorChaosState.onFail('crusher');
        if (conveyorChaosState.gameOver) {
          clearFrameInput(inputRef);
          return;
        }
        respawnPlayer();
        setGoal(pickGoalTile(tilesRef.current));
        clearFrameInput(inputRef);
        return;
      }
    }

    // Delivery
    const g = goalRef.current;
    const gCenter = tileCenter(g.ix, g.iz);
    const dGoal = Math.hypot(posRef.current.x - gCenter.x, posRef.current.z - gCenter.z);
    if (dGoal < 1.25) {
      conveyorChaosState.onDelivery();
      mutateBoardOnLevelUp();
      respawnPlayer();
      setGoal(pickGoalTile(tilesRef.current));
    }

    // Apply to mesh
    if (playerMesh.current) playerMesh.current.position.copy(posRef.current);

    clearFrameInput(inputRef);
  });

  const showArrows = conveyorChaosState.event !== 'Blackout';
  const arrowEmissive = showArrows ? 0.12 : 0.02;
  const goalEmissive = showArrows ? 0.18 : 0.08;

  return (
    <>
      <ConveyorHUD />
      <Sky />
      <fog attach="fog" args={['#0a1220', 45, 120]} />
      <Stars radius={240} depth={60} count={1300} factor={4} saturation={0} fade />
      <ambientLight intensity={0.36} />
      <directionalLight position={[18, 30, 14]} intensity={1.1} castShadow />

      {/* Board tiles */}
      <group position={[0, 0, 0]}>
        {tiles.map((t, idx) => {
          const ix = idx % GRID;
          const iz = Math.floor(idx / GRID);
          const c = tileCenter(ix, iz);
          const arrowDir = dirVec(t.dir);
          const rotY = Math.atan2(arrowDir.x, arrowDir.z);

          const isGoal = ix === goal.ix && iz === goal.iz;
          const isOverride = t.override > 0;
          const iconKind = isOverride ? 'belt' : t.kind;

          const color =
            isOverride
              ? '#0b2a2a'
              : t.kind === 'hole'
                ? '#0b1220'
                : t.kind === 'crusher'
                  ? '#111827'
                  : t.kind === 'booster'
                    ? '#0b2a2a'
                    : t.kind === 'switch'
                      ? '#1b1030'
                      : '#111827';

          return (
            <group key={idx} position={[c.x, 0, c.z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[TILE * 0.98, TILE * 0.98]} />
                <meshStandardMaterial
                  color={isGoal ? '#22d3ee' : color}
                  emissive={isGoal ? '#22d3ee' : isOverride ? '#22d3ee' : '#000000'}
                  emissiveIntensity={isGoal ? goalEmissive : isOverride ? 0.18 : 0}
                />
              </mesh>

              {/* Tile symbol */}
              {iconKind === 'hole' && (
                <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[1.05, 24]} />
                  <meshStandardMaterial color="#020617" emissive="#020617" emissiveIntensity={0.05} />
                </mesh>
              )}
              {iconKind === 'crusher' && (
                <mesh position={[0, 0.25, 0]}>
                  <boxGeometry args={[1.2, 0.45, 1.2]} />
                  <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.18} />
                </mesh>
              )}
              {iconKind === 'belt' && (
                <group rotation={[0, rotY, 0]}>
                  {[-0.6, 0, 0.6].map((offset, i) => {
                    const wobble = Math.sin(t.phase + i * 1.4) * 0.18;
                    return (
                      <mesh key={`roller-${idx}-${i}`} position={[0, 0.08, offset + wobble]}>
                        <boxGeometry args={[0.6, 0.08, 0.3]} />
                        <meshStandardMaterial color="#334155" emissive="#0f172a" emissiveIntensity={0.18} />
                      </mesh>
                    );
                  })}
                </group>
              )}
              {iconKind === 'booster' && (
                <group rotation={[0, rotY, 0]}>
                  {[-0.35, 0.35].map((offset, i) => (
                    <mesh key={`boost-${idx}-${i}`} position={[0, 0.1, offset]} rotation={[Math.PI / 2, 0, 0]}>
                      <coneGeometry args={[0.32, 0.65, 4]} />
                      <meshStandardMaterial color="#22d3ee" emissive="#0ea5e9" emissiveIntensity={0.25} />
                    </mesh>
                  ))}
                </group>
              )}
              {iconKind === 'bumper' && (
                <mesh position={[0, 0.12, 0]} rotation={[0, rotY + Math.PI / 2, 0]}>
                  <coneGeometry args={[0.55, 0.45, 3]} />
                  <meshStandardMaterial color="#fb923c" emissive="#ea580c" emissiveIntensity={0.2} />
                </mesh>
              )}
              {iconKind === 'switch' && (
                <group>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.55, 0.08, 8, 20]} />
                    <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={0.25} />
                  </mesh>
                  <mesh position={[0, 0.15, 0]} rotation={[0, t.phase, Math.PI / 4]}>
                    <octahedronGeometry args={[0.22, 0]} />
                    <meshStandardMaterial color="#c084fc" emissive="#7c3aed" emissiveIntensity={0.3} />
                  </mesh>
                </group>
              )}

              {/* Arrow indicator */}
              <mesh position={[0, 0.05, 0]} rotation={[0, rotY, 0]}>
                <boxGeometry args={[0.35, 0.1, 1.2]} />
                <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={arrowEmissive} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Player */}
      <mesh ref={playerMesh} castShadow>
        <sphereGeometry args={[1.1, 28, 28]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={0.14} />
      </mesh>
    </>
  );
};

export default ConveyorChaos;
export * from './state';
