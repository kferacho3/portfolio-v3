'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, Line, PerspectiveCamera, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { create } from 'zustand';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { consumeFixedStep, createFixedStepState, shakeNoiseSigned } from '../_shared/hyperUpgradeKit';
import { tetherDriftState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';

type Anchor = {
  z: number;
  baseX: number;
  baseY: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  broken: boolean;
};

type Gate = {
  z: number;
  x: number;
  y: number;
  radius: number;
  thickness: number;
  resolved: boolean;
  shock: number;
};

type Debris = {
  z: number;
  x: number;
  y: number;
  size: number;
  spin: number;
  active: boolean;
};

type Tether = {
  anchorIndex: number;
  len: number;
  holdTime: number;
  broken: boolean;
};

type Runtime = {
  elapsed: number;
  distance: number;
  score: number;
  playerX: number;
  playerY: number;
  prevX: number;
  prevY: number;
  forwardSpeed: number;
  perfectStreak: number;
  perfectCount: number;
  gatesPassed: number;
  missedConsecutive: number;
  gateSerial: number;
  targetAnchorIndex: number;
  anchorCursorZ: number;
  gateCursorZ: number;
  debrisCursorZ: number;
  hudCommit: number;
  shake: number;
  tether: Tether | null;
  anchors: Anchor[];
  gates: Gate[];
  debris: Debris[];
};

type TetherStore = {
  status: GameStatus;
  score: number;
  best: number;
  gatesPassed: number;
  perfectStreak: number;
  missedConsecutive: number;
  tethered: boolean;
  startRun: () => void;
  endRun: (score: number) => void;
  resetToStart: () => void;
  setTethered: (tethered: boolean) => void;
  updateHud: (hud: {
    score: number;
    gatesPassed: number;
    perfectStreak: number;
    missedConsecutive: number;
  }) => void;
};

const BEST_KEY = 'tether_drift_hyper_best_v1';

const ANCHOR_POOL = 88;
const GATE_POOL = 58;
const DEBRIS_POOL = 52;
const TETHER_POINT_COUNT = 20;
const TRAIL_POINT_COUNT = 36;

const PLAYER_RADIUS = 0.2;
const PLAY_X = 3.55;
const PLAY_Y = 2.45;

const ANCHOR_FORWARD_MIN = -12.5;
const ANCHOR_FORWARD_MAX = -0.15;
const ATTACH_MAX_DIST = 3.8;
const ATTACH_CONE_COS = Math.cos((52 * Math.PI) / 180);

const CYAN = new THREE.Color('#6bf0ff');
const MINT = new THREE.Color('#3be3ba');
const MAGENTA = new THREE.Color('#ff5be7');
const HOT = new THREE.Color('#ff7d6f');
const WARN = new THREE.Color('#ffc46b');
const SKY = new THREE.Color('#b9ecff');
const WATER = new THREE.Color('#67d3ff');
const CORAL = new THREE.Color('#ff8d95');
const WHITE = new THREE.Color('#f8fcff');
const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

let audioContextRef: AudioContext | null = null;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const readBest = () => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(BEST_KEY);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const writeBest = (score: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_KEY, String(Math.max(0, Math.floor(score))));
};

const maybeVibrate = (ms: number) => {
  if (typeof navigator === 'undefined') return;
  if ('vibrate' in navigator) navigator.vibrate(ms);
};

const playTone = (frequency: number, duration = 0.05, volume = 0.035) => {
  if (typeof window === 'undefined') return;
  const Context =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;

  if (!audioContextRef) {
    audioContextRef = new Context();
  }
  const ctx = audioContextRef;
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t0 = ctx.currentTime;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration);
};

const useTetherStore = create<TetherStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  gatesPassed: 0,
  perfectStreak: 0,
  missedConsecutive: 0,
  tethered: false,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      gatesPassed: 0,
      perfectStreak: 0,
      missedConsecutive: 0,
      tethered: false,
    }),
  endRun: (score) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        tethered: false,
        best: nextBest,
      };
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      gatesPassed: 0,
      perfectStreak: 0,
      missedConsecutive: 0,
      tethered: false,
    }),
  setTethered: (tethered) => set({ tethered }),
  updateHud: (hud) =>
    set({
      score: Math.floor(hud.score),
      gatesPassed: hud.gatesPassed,
      perfectStreak: hud.perfectStreak,
      missedConsecutive: hud.missedConsecutive,
    }),
}));

const createAnchor = (): Anchor => ({
  z: -10,
  baseX: 0,
  baseY: 0,
  swayAmp: 0.2,
  swayFreq: 1,
  swayPhase: 0,
  broken: false,
});

const createGate = (): Gate => ({
  z: -10,
  x: 0,
  y: 0,
  radius: 1.2,
  thickness: 0.12,
  resolved: false,
  shock: 0,
});

const createDebris = (): Debris => ({
  z: -10,
  x: 0,
  y: 0,
  size: 0.2,
  spin: 0,
  active: true,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  distance: 0,
  score: 0,
  playerX: 0,
  playerY: 0,
  prevX: 0,
  prevY: 0,
  forwardSpeed: 8.6,
  perfectStreak: 0,
  perfectCount: 0,
  gatesPassed: 0,
  missedConsecutive: 0,
  gateSerial: 0,
  targetAnchorIndex: -1,
  anchorCursorZ: -15,
  gateCursorZ: -18,
  debrisCursorZ: -14,
  hudCommit: 0,
  shake: 0,
  tether: null,
  anchors: Array.from({ length: ANCHOR_POOL }, createAnchor),
  gates: Array.from({ length: GATE_POOL }, createGate),
  debris: Array.from({ length: DEBRIS_POOL }, createDebris),
});

const difficultyAt = (runtime: Runtime) =>
  clamp(runtime.elapsed / 78 + runtime.gatesPassed / 130, 0, 1);

const anchorPosition = (anchor: Anchor, time: number) => ({
  x: anchor.baseX + Math.sin(time * anchor.swayFreq + anchor.swayPhase) * anchor.swayAmp,
  y:
    anchor.baseY +
    Math.cos(time * (anchor.swayFreq * 0.82) + anchor.swayPhase * 1.3) * (anchor.swayAmp * 0.78),
});

const seedAnchor = (anchor: Anchor, runtime: Runtime, z: number) => {
  const d = difficultyAt(runtime);
  anchor.z = z;
  anchor.baseX = (Math.random() * 2 - 1) * lerp(1.4, 2.85, d);
  anchor.baseY = (Math.random() * 2 - 1) * lerp(1.0, 1.95, d);
  anchor.swayAmp = lerp(0.12, 0.5, d);
  anchor.swayFreq = lerp(0.72, 1.7, d) + Math.random() * 0.3;
  anchor.swayPhase = Math.random() * Math.PI * 2;
  const brokenChance = d < 0.45 ? 0 : lerp(0, 0.27, (d - 0.45) / 0.55);
  anchor.broken = Math.random() < brokenChance;
};

const seedGate = (gate: Gate, runtime: Runtime, z: number) => {
  const d = difficultyAt(runtime);
  runtime.gateSerial += 1;
  const phase = runtime.gateSerial * 0.64;
  gate.z = z;
  gate.x = Math.sin(phase * 0.9 + Math.random() * 0.6) * lerp(0.85, 2.25, d);
  gate.y = Math.cos(phase * 0.72 + 0.35) * lerp(0.65, 1.8, d);
  gate.radius = clamp(lerp(1.26, 0.72, d) + (Math.random() * 2 - 1) * 0.12, 0.62, 1.4);
  gate.thickness = clamp(lerp(0.14, 0.085, d), 0.08, 0.16);
  gate.resolved = false;
  gate.shock = 0;
};

const seedDebris = (debris: Debris, runtime: Runtime, z: number) => {
  const d = difficultyAt(runtime);
  debris.z = z;
  debris.active = Math.random() < lerp(0.24, 0.68, d);
  debris.x = (Math.random() * 2 - 1) * lerp(1.8, 3.2, d);
  debris.y = (Math.random() * 2 - 1) * lerp(1.4, 2.25, d);
  debris.size = clamp(lerp(0.14, 0.34, d) + Math.random() * 0.08, 0.12, 0.42);
  debris.spin = (Math.random() * 2 - 1) * lerp(0.6, 2.2, d);
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.distance = 0;
  runtime.score = 0;
  runtime.playerX = 0;
  runtime.playerY = 0;
  runtime.prevX = 0;
  runtime.prevY = 0;
  runtime.forwardSpeed = 8.6;
  runtime.perfectStreak = 0;
  runtime.perfectCount = 0;
  runtime.gatesPassed = 0;
  runtime.missedConsecutive = 0;
  runtime.gateSerial = 0;
  runtime.targetAnchorIndex = -1;
  runtime.anchorCursorZ = -13;
  runtime.gateCursorZ = -16;
  runtime.debrisCursorZ = -12;
  runtime.hudCommit = 0;
  runtime.shake = 0;
  runtime.tether = null;

  for (const anchor of runtime.anchors) {
    seedAnchor(anchor, runtime, runtime.anchorCursorZ);
    runtime.anchorCursorZ -= 1.45 + Math.random() * 1.05;
  }
  for (const gate of runtime.gates) {
    seedGate(gate, runtime, runtime.gateCursorZ);
    runtime.gateCursorZ -= 2.7 + Math.random() * 1.6;
  }
  for (const debris of runtime.debris) {
    seedDebris(debris, runtime, runtime.debrisCursorZ);
    runtime.debrisCursorZ -= 1.95 + Math.random() * 1.6;
  }
};

function TetherDriftOverlay() {
  const status = useTetherStore((state) => state.status);
  const score = useTetherStore((state) => state.score);
  const best = useTetherStore((state) => state.best);
  const gatesPassed = useTetherStore((state) => state.gatesPassed);
  const perfectStreak = useTetherStore((state) => state.perfectStreak);
  const missedConsecutive = useTetherStore((state) => state.missedConsecutive);
  const tethered = useTetherStore((state) => state.tethered);

  return (
    <div className="absolute inset-0 pointer-events-none select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-emerald-100/55 bg-gradient-to-br from-emerald-500/22 via-cyan-500/14 to-violet-500/20 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/80">Tether Drift</div>
        <div className="text-[11px] text-cyan-50/80">Hold to latch nearest blue anchor. Release to drift.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-violet-100/55 bg-gradient-to-br from-violet-500/24 via-fuchsia-500/16 to-cyan-500/18 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-emerald-100/35 bg-gradient-to-br from-slate-950/72 via-cyan-900/30 to-violet-900/26 px-3 py-2 text-xs text-white/90">
          <div>
            Gates <span className="font-semibold text-cyan-200">{gatesPassed}</span>
          </div>
          <div>
            Perfect Streak <span className="font-semibold text-fuchsia-200">{perfectStreak}</span>
          </div>
          <div>
            Misses <span className="font-semibold text-orange-200">{missedConsecutive}/2</span>
          </div>
          <div>
            Tether <span className="font-semibold">{tethered ? 'LOCKED' : 'DRIFT'}</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-emerald-100/42 bg-gradient-to-br from-slate-950/82 via-cyan-950/46 to-violet-950/36 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">TETHER DRIFT</div>
            <div className="mt-2 text-sm text-white/85">Tap to begin. Hold to tether, release to slingshot.</div>
            <div className="mt-1 text-sm text-white/85">Fly through ring centers. Avoid ring rims and debris.</div>
            <div className="mt-3 text-sm text-cyan-200/90">Miss 2 gates in a row and you crash.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/44 to-violet-950/32 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-fuchsia-200">Drift Lost</div>
            <div className="mt-2 text-sm text-white/80">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TetherDriftScene() {
  const resetVersion = useSnapshot(tetherDriftState).resetVersion;
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });

  const runtimeRef = useRef<Runtime>(createRuntime());

  const bgMatRef = useRef<THREE.ShaderMaterial>(null);
  const anchorMeshRef = useRef<THREE.InstancedMesh>(null);
  const gateMeshRef = useRef<THREE.InstancedMesh>(null);
  const gateCoreRef = useRef<THREE.InstancedMesh>(null);
  const debrisMeshRef = useRef<THREE.InstancedMesh>(null);
  const shockMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);
  const targetAnchorRef = useRef<THREE.Mesh>(null);
  const fixedStepRef = useRef(createFixedStepState());
  const tetherLineRef = useRef<any>(null);
  const guideLineRef = useRef<any>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const tetherPoints = useMemo(
    () => Array.from({ length: TETHER_POINT_COUNT }, () => new THREE.Vector3(0, 0.25, 0)),
    []
  );
  const tetherFlat = useMemo(() => new Float32Array(TETHER_POINT_COUNT * 3), []);
  const guidePoints = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)],
    []
  );
  const guideFlat = useMemo(() => new Float32Array(6), []);

  const trailAttr = useMemo(
    () => new THREE.BufferAttribute(new Float32Array(TRAIL_POINT_COUNT * 3), 3),
    []
  );
  const trailGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', trailAttr);
    return geom;
  }, [trailAttr]);

  const { camera } = useThree();

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useTetherStore.getState().resetToStart();
  }, []);

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useTetherStore.getState().resetToStart();
  }, [resetVersion]);

  useEffect(() => {
    const snap = useTetherStore.getState();
    tetherDriftState.score = snap.score;
    tetherDriftState.bestScore = snap.best;
    tetherDriftState.gameOver = snap.status === 'GAMEOVER';

    const unsubscribe = useTetherStore.subscribe((storeState) => {
      tetherDriftState.score = storeState.score;
      tetherDriftState.bestScore = storeState.best;
      tetherDriftState.gameOver = storeState.status === 'GAMEOVER';
      tetherDriftState.chain = storeState.perfectStreak;
      tetherDriftState.health = clamp(100 - storeState.missedConsecutive * 50, 0, 100);
    });
    return () => unsubscribe();
  }, []);

  useEffect(
    () => () => {
      trailGeometry.dispose();
      trailAttr.array.fill(0);
    },
    [trailAttr, trailGeometry]
  );

  useFrame((state, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      clearFrameInput(inputRef);
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const game = useTetherStore.getState();
    const input = inputRef.current;

    const holdDown = input.pointerDown || input.keysDown.has(' ');
    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');
    const released = runtime.tether && !holdDown;

    if (tap && game.status !== 'PLAYING') {
      resetRuntime(runtime);
      useTetherStore.getState().startRun();
      for (let i = 0; i < TRAIL_POINT_COUNT; i += 1) {
        const ptr = i * 3;
        trailAttr.array[ptr] = runtime.playerX;
        trailAttr.array[ptr + 1] = runtime.playerY + 0.2;
        trailAttr.array[ptr + 2] = 0;
      }
      trailAttr.needsUpdate = true;
    }

    if (game.status === 'PLAYING') {
      runtime.elapsed += dt;
      const d = difficultyAt(runtime);
      runtime.forwardSpeed = lerp(8.6, 14.2, d);
      runtime.hudCommit += dt;

      for (const anchor of runtime.anchors) {
        anchor.z += runtime.forwardSpeed * dt;
        if (anchor.z > 8.6) {
          seedAnchor(anchor, runtime, runtime.anchorCursorZ);
          runtime.anchorCursorZ -= lerp(1.95, 1.2, d) + Math.random() * 0.85;
        }
      }
      for (const gate of runtime.gates) {
        gate.z += runtime.forwardSpeed * dt;
        gate.shock = Math.max(0, gate.shock - dt * 2.9);
        if (gate.z > 8.8) {
          seedGate(gate, runtime, runtime.gateCursorZ);
          runtime.gateCursorZ -= lerp(3.8, 2.2, d) + Math.random() * 1.4;
        }
      }
      for (const debris of runtime.debris) {
        debris.z += runtime.forwardSpeed * dt;
        if (debris.z > 8.2) {
          seedDebris(debris, runtime, runtime.debrisCursorZ);
          runtime.debrisCursorZ -= lerp(2.8, 1.4, d) + Math.random() * 1.2;
        }
      }

      let bestIndex = -1;
      let bestDist3 = 999;
      for (let i = 0; i < runtime.anchors.length; i += 1) {
        const anchor = runtime.anchors[i];
        if (anchor.z < ANCHOR_FORWARD_MIN || anchor.z > ANCHOR_FORWARD_MAX) continue;

        const world = anchorPosition(anchor, runtime.elapsed);
        const dx = world.x - runtime.playerX;
        const dy = world.y - runtime.playerY;
        const planar = Math.hypot(dx, dy);
        if (planar > ATTACH_MAX_DIST) continue;

        const len3 = Math.hypot(dx, dy, anchor.z);
        if (len3 <= 0.0001) continue;
        const forwardCos = -anchor.z / len3;
        if (forwardCos < ATTACH_CONE_COS) continue;
        if (len3 < bestDist3) {
          bestDist3 = len3;
          bestIndex = i;
        }
      }
      runtime.targetAnchorIndex = bestIndex;

      if (holdDown && !runtime.tether && bestIndex >= 0) {
        const anchor = runtime.anchors[bestIndex];
        const world = anchorPosition(anchor, runtime.elapsed);
        const length = Math.hypot(world.x - runtime.playerX, world.y - runtime.playerY);
        runtime.tether = {
          anchorIndex: bestIndex,
          len: clamp(length, 0.65, 3.95),
          holdTime: 0,
          broken: anchor.broken,
        };
        useTetherStore.getState().setTethered(true);
        maybeVibrate(10);
        playTone(840, 0.04, 0.03);
        runtime.shake = Math.min(1.2, runtime.shake + 0.42);
      }

      const oldX = runtime.playerX;
      const oldY = runtime.playerY;
      const drag = Math.exp(-lerp(0.9, 1.45, d) * dt);
      const vx = (runtime.playerX - runtime.prevX) * drag;
      const vy = (runtime.playerY - runtime.prevY) * drag;
      const accelX = -runtime.playerX * 0.16 + Math.sin(runtime.elapsed * 0.82) * 0.04;
      const accelY = -runtime.playerY * 0.14 + Math.cos(runtime.elapsed * 0.63) * 0.03;

      runtime.playerX += vx + accelX * dt * dt * 46;
      runtime.playerY += vy + accelY * dt * dt * 46;
      runtime.prevX = oldX;
      runtime.prevY = oldY;

      if (runtime.tether) {
        const anchor = runtime.anchors[runtime.tether.anchorIndex];
        const world = anchorPosition(anchor, runtime.elapsed);
        runtime.tether.holdTime += dt;
        runtime.tether.len = Math.max(0.44, runtime.tether.len - lerp(1.9, 3.9, d) * dt);

        const dx = runtime.playerX - world.x;
        const dy = runtime.playerY - world.y;
        const dist = Math.hypot(dx, dy);
        if (dist > runtime.tether.len && dist > 0.0001) {
          const inv = runtime.tether.len / dist;
          runtime.playerX = world.x + dx * inv;
          runtime.playerY = world.y + dy * inv;
        }

        if (runtime.tether.broken && runtime.tether.holdTime > 0.5) {
          runtime.tether = null;
          useTetherStore.getState().setTethered(false);
          maybeVibrate(8);
          playTone(260, 0.05, 0.035);
          runtime.shake = Math.min(1.2, runtime.shake + 0.32);
        }
      }

      if (released) {
        runtime.tether = null;
        useTetherStore.getState().setTethered(false);
      }

      const velX = runtime.playerX - runtime.prevX;
      const velY = runtime.playerY - runtime.prevY;
      const velMag = Math.hypot(velX, velY);
      const maxVel = lerp(0.24, 0.45, d);
      if (velMag > maxVel && velMag > 0.0001) {
        const scale = maxVel / velMag;
        runtime.prevX = runtime.playerX - velX * scale;
        runtime.prevY = runtime.playerY - velY * scale;
      }

      let gameOver = false;
      if (Math.abs(runtime.playerX) > PLAY_X + PLAYER_RADIUS || Math.abs(runtime.playerY) > PLAY_Y + PLAYER_RADIUS) {
        gameOver = true;
      }

      for (const gate of runtime.gates) {
        if (gameOver) break;
        if (Math.abs(gate.z) < gate.thickness + 0.26) {
          const dx = runtime.playerX - gate.x;
          const dy = runtime.playerY - gate.y;
          const radialDist = Math.hypot(dx, dy);
          if (Math.abs(radialDist - gate.radius) < (gate.thickness + PLAYER_RADIUS * 0.36) * 0.9) {
            gameOver = true;
            break;
          }
        }

        if (!gate.resolved && gate.z > 0.2) {
          gate.resolved = true;
          const dx = runtime.playerX - gate.x;
          const dy = runtime.playerY - gate.y;
          const radialDist = Math.hypot(dx, dy);
          const passThreshold = gate.radius - gate.thickness * 1.15;
          if (radialDist < passThreshold) {
            const perfect = radialDist < Math.min(0.22, gate.radius * 0.2);
            runtime.gatesPassed += 1;
            runtime.missedConsecutive = 0;
            if (perfect) {
              runtime.perfectStreak += 1;
              runtime.perfectCount += 1;
              runtime.score += 40 + runtime.perfectStreak * 10;
              gate.shock = 1;
              runtime.shake = Math.min(1.2, runtime.shake + 0.28);
              playTone(980, 0.06, 0.035);
            } else {
              runtime.perfectStreak = 0;
              runtime.score += 18;
            }
            runtime.score += 8 + Math.floor(runtime.forwardSpeed * 1.3);
          } else {
            runtime.missedConsecutive += 1;
            runtime.perfectStreak = 0;
            if (runtime.missedConsecutive >= 2) {
              gameOver = true;
              break;
            }
          }
        }
      }

      for (const debris of runtime.debris) {
        if (gameOver) break;
        if (!debris.active) continue;
        if (Math.abs(debris.z) > 0.58) continue;
        const dx = runtime.playerX - debris.x;
        const dy = runtime.playerY - debris.y;
        if (Math.hypot(dx, dy) < debris.size + PLAYER_RADIUS * 0.8) {
          gameOver = true;
          break;
        }
      }

      if (gameOver) {
        runtime.score += Math.floor(runtime.distance);
        useTetherStore.getState().endRun(runtime.score);
        useTetherStore.getState().setTethered(false);
      } else {
        runtime.distance += runtime.forwardSpeed * dt * 0.24;
        runtime.score = Math.max(runtime.score, Math.floor(runtime.distance) + runtime.gatesPassed * 6);
        if (runtime.hudCommit >= 0.08) {
          runtime.hudCommit = 0;
          useTetherStore.getState().updateHud({
            score: runtime.score,
            gatesPassed: runtime.gatesPassed,
            perfectStreak: runtime.perfectStreak,
            missedConsecutive: runtime.missedConsecutive,
          });
        }
      }
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.8);
    const shakeAmp = runtime.shake * 0.06;
    const shakeTime = runtime.elapsed * 21;
    const jitterX = shakeNoiseSigned(shakeTime, 2.2) * shakeAmp;
    const jitterY = shakeNoiseSigned(shakeTime, 7.7) * shakeAmp * 0.4;
    const jitterZ = shakeNoiseSigned(shakeTime, 13.9) * shakeAmp * 0.42;
    camTarget.set(runtime.playerX * 0.44 + jitterX, 4.45 + runtime.playerY * 0.22 + jitterY, 7.45 + jitterZ);
    lookTarget.set(runtime.playerX * 0.33, runtime.playerY * 0.45, -3.35);
    camera.position.lerp(camTarget, 1 - Math.exp(-6.5 * step.renderDt));
    camera.lookAt(lookTarget);

    if (playerRef.current) {
      playerRef.current.position.set(runtime.playerX, runtime.playerY + 0.22, 0);
    }
    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
    }

    if (targetAnchorRef.current) {
      if (game.status === 'PLAYING' && !runtime.tether && runtime.targetAnchorIndex >= 0) {
        const anchor = runtime.anchors[runtime.targetAnchorIndex];
        const world = anchorPosition(anchor, runtime.elapsed);
        const pulse = 1 + Math.sin(runtime.elapsed * 8.6) * 0.12;
        targetAnchorRef.current.visible = true;
        targetAnchorRef.current.position.set(world.x, world.y + 0.24, anchor.z + 0.02);
        targetAnchorRef.current.scale.setScalar(pulse);
      } else {
        targetAnchorRef.current.visible = false;
      }
    }

    if (anchorMeshRef.current) {
      for (let i = 0; i < runtime.anchors.length; i += 1) {
        const anchor = runtime.anchors[i];
        const world = anchorPosition(anchor, runtime.elapsed);
        dummy.position.set(world.x, world.y + 0.24, anchor.z);
        dummy.rotation.set(0, runtime.elapsed * 0.35, 0);
        dummy.scale.set(anchor.broken ? 0.16 : 0.18, anchor.broken ? 0.16 : 0.18, 0.16);
        dummy.updateMatrix();
        anchorMeshRef.current.setMatrixAt(i, dummy.matrix);
        const anchorPulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 3.8 + i * 0.42);
        const anchorColor = colorScratch
          .copy(anchor.broken ? CORAL : CYAN)
          .lerp(anchor.broken ? WARN : SKY, 0.28 + anchorPulse * 0.2);
        anchorMeshRef.current.setColorAt(i, anchorColor);
      }
      anchorMeshRef.current.instanceMatrix.needsUpdate = true;
      if (anchorMeshRef.current.instanceColor) anchorMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (gateMeshRef.current && shockMeshRef.current && gateCoreRef.current) {
      for (let i = 0; i < runtime.gates.length; i += 1) {
        const gate = runtime.gates[i];
        const radius = gate.radius;
        const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 4.1 + i * 0.4);
        dummy.position.set(gate.x, gate.y + 0.23, gate.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(radius, radius, 1);
        dummy.updateMatrix();
        gateMeshRef.current.setMatrixAt(i, dummy.matrix);
        const gateColor = colorScratch
          .copy(MINT)
          .lerp(CYAN, 0.3 + pulse * 0.22)
          .lerp(WHITE, gate.shock * 0.42);
        gateMeshRef.current.setColorAt(i, gateColor);

        dummy.position.set(gate.x, gate.y + 0.23, gate.z + 0.03);
        dummy.rotation.set(0, 0, 0);
        const coreScale = 0.085 + pulse * 0.02;
        dummy.scale.setScalar(coreScale);
        dummy.updateMatrix();
        gateCoreRef.current.setMatrixAt(i, dummy.matrix);
        gateCoreRef.current.setColorAt(i, WHITE);

        if (gate.shock > 0) {
          const s = 1 + (1 - gate.shock) * 1.9;
          dummy.position.set(gate.x, gate.y + 0.23, gate.z + 0.02);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(radius * s, radius * s, 1);
          dummy.updateMatrix();
          shockMeshRef.current.setMatrixAt(i, dummy.matrix);
          shockMeshRef.current.setColorAt(i, MAGENTA);
        } else {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          shockMeshRef.current.setMatrixAt(i, dummy.matrix);
          shockMeshRef.current.setColorAt(i, MAGENTA);
        }
      }
      gateMeshRef.current.instanceMatrix.needsUpdate = true;
      shockMeshRef.current.instanceMatrix.needsUpdate = true;
      gateCoreRef.current.instanceMatrix.needsUpdate = true;
      if (gateMeshRef.current.instanceColor) gateMeshRef.current.instanceColor.needsUpdate = true;
      if (shockMeshRef.current.instanceColor) shockMeshRef.current.instanceColor.needsUpdate = true;
      if (gateCoreRef.current.instanceColor) gateCoreRef.current.instanceColor.needsUpdate = true;
    }

    if (debrisMeshRef.current) {
      for (let i = 0; i < runtime.debris.length; i += 1) {
        const debris = runtime.debris[i];
        if (debris.active) {
          dummy.position.set(debris.x, debris.y + 0.24, debris.z);
          dummy.rotation.set(runtime.elapsed * debris.spin * 0.6, runtime.elapsed * debris.spin, 0);
          dummy.scale.set(debris.size, debris.size, debris.size);
          dummy.updateMatrix();
          debrisMeshRef.current.setMatrixAt(i, dummy.matrix);
          const debrisColor = colorScratch
            .copy(HOT)
            .lerp(MAGENTA, clamp(0.2 + debris.size * 0.9, 0, 0.55))
            .lerp(WARN, clamp(Math.abs(Math.sin(runtime.elapsed * 1.7 + i * 0.2)) * 0.24, 0, 0.24));
          debrisMeshRef.current.setColorAt(i, debrisColor);
        } else {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          debrisMeshRef.current.setMatrixAt(i, dummy.matrix);
          debrisMeshRef.current.setColorAt(i, HOT);
        }
      }
      debrisMeshRef.current.instanceMatrix.needsUpdate = true;
      if (debrisMeshRef.current.instanceColor) debrisMeshRef.current.instanceColor.needsUpdate = true;
    }

    for (let i = TRAIL_POINT_COUNT - 1; i > 0; i -= 1) {
      const ptr = i * 3;
      const prev = (i - 1) * 3;
      trailAttr.array[ptr] = trailAttr.array[prev];
      trailAttr.array[ptr + 1] = trailAttr.array[prev + 1];
      trailAttr.array[ptr + 2] = trailAttr.array[prev + 2];
    }
    trailAttr.array[0] = runtime.playerX;
    trailAttr.array[1] = runtime.playerY + 0.22;
    trailAttr.array[2] = 0;
    trailAttr.needsUpdate = true;

    if (runtime.tether) {
      const anchor = runtime.anchors[runtime.tether.anchorIndex];
      const world = anchorPosition(anchor, runtime.elapsed);
      const ax = world.x;
      const ay = world.y + 0.24;
      const az = anchor.z;
      const px = runtime.playerX;
      const py = runtime.playerY + 0.22;
      const pz = 0;
      const dx = ax - px;
      const dy = ay - py;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (let i = 0; i < TETHER_POINT_COUNT; i += 1) {
        const t = i / (TETHER_POINT_COUNT - 1);
        const centerBias = 1 - Math.abs(t * 2 - 1);
        const hum = Math.sin(runtime.elapsed * 15 + i * 0.75) * (0.11 * centerBias);
        const sx = lerp(px, ax, t) + nx * hum;
        const sy = lerp(py, ay, t) + ny * hum;
        const sz = lerp(pz, az, t);
        tetherPoints[i].set(sx, sy, sz);

        const ptr = i * 3;
        tetherFlat[ptr] = sx;
        tetherFlat[ptr + 1] = sy;
        tetherFlat[ptr + 2] = sz;
      }
      const geom: any = tetherLineRef.current?.geometry;
      if (geom?.setFromPoints) geom.setFromPoints(tetherPoints);
      else if (geom?.setPositions) geom.setPositions(tetherFlat);
    } else {
      const px = runtime.playerX;
      const py = runtime.playerY + 0.22;
      for (let i = 0; i < TETHER_POINT_COUNT; i += 1) {
        tetherPoints[i].set(px, py, 0);
        const ptr = i * 3;
        tetherFlat[ptr] = px;
        tetherFlat[ptr + 1] = py;
        tetherFlat[ptr + 2] = 0;
      }
      const geom: any = tetherLineRef.current?.geometry;
      if (geom?.setFromPoints) geom.setFromPoints(tetherPoints);
      else if (geom?.setPositions) geom.setPositions(tetherFlat);
    }

    if (guideLineRef.current) {
      const px = runtime.playerX;
      const py = runtime.playerY + 0.22;
      if (game.status === 'PLAYING' && !runtime.tether && runtime.targetAnchorIndex >= 0) {
        const anchor = runtime.anchors[runtime.targetAnchorIndex];
        const world = anchorPosition(anchor, runtime.elapsed);
        guidePoints[0].set(px, py, 0);
        guidePoints[1].set(world.x, world.y + 0.24, anchor.z);
      } else {
        guidePoints[0].set(px, py, 0);
        guidePoints[1].set(px, py, 0);
      }
      guideFlat[0] = guidePoints[0].x;
      guideFlat[1] = guidePoints[0].y;
      guideFlat[2] = guidePoints[0].z;
      guideFlat[3] = guidePoints[1].x;
      guideFlat[4] = guidePoints[1].y;
      guideFlat[5] = guidePoints[1].z;
      const guideGeom: any = guideLineRef.current.geometry;
      if (guideGeom?.setFromPoints) guideGeom.setFromPoints(guidePoints);
      else if (guideGeom?.setPositions) guideGeom.setPositions(guideFlat);
    }

    clearFrameInput(inputRef);
  });

  const status = useTetherStore((state) => state.status);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 4.2, 7.35]} fov={43} />
      <color attach="background" args={['#1f4f82']} />
      <fog attach="fog" args={['#1f4f82', 10, 42]} />

      <Stars radius={95} depth={56} count={1200} factor={2.5} saturation={0.55} fade speed={0.4} />

      <ambientLight intensity={0.62} />
      <hemisphereLight args={['#b8f3ff', '#2f3b73', 0.28]} />
      <pointLight position={[0, 3.1, 2.2]} intensity={0.68} color="#9deeff" />
      <pointLight position={[-2.2, -0.5, -8]} intensity={0.38} color="#c39dff" />
      <pointLight position={[2.2, -0.3, -7]} intensity={0.3} color="#ffb6a0" />

      <mesh position={[0, 0.2, -10]}>
        <planeGeometry args={[18, 14]} />
        <shaderMaterial
          ref={bgMatRef}
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            varying vec2 vUv;
            void main() {
              vec3 sky = vec3(0.18, 0.52, 0.85);
              vec3 mint = vec3(0.38, 0.95, 0.88);
              vec3 violet = vec3(0.56, 0.42, 0.95);
              float grad = smoothstep(0.0, 1.0, vUv.y);
              float wave = 0.5 + 0.5 * sin((vUv.x * 2.4 + uTime * 0.14) * 6.2831853);
              vec3 col = mix(sky, mint, grad * 0.65);
              col = mix(col, violet, (1.0 - grad) * 0.22 + wave * 0.1);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={anchorMeshRef} args={[undefined, undefined, ANCHOR_POOL]}>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={gateMeshRef} args={[undefined, undefined, GATE_POOL]}>
        <torusGeometry args={[1, 0.07, 10, 48]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={gateCoreRef} args={[undefined, undefined, GATE_POOL]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={shockMeshRef} args={[undefined, undefined, GATE_POOL]}>
        <torusGeometry args={[1, 0.035, 8, 36]} />
        <meshBasicMaterial vertexColors transparent opacity={0.6} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={debrisMeshRef} args={[undefined, undefined, DEBRIS_POOL]}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial vertexColors emissive="#4f1f2b" emissiveIntensity={0.35} roughness={0.4} />
      </instancedMesh>

      <mesh ref={playerRef} position={[0, 0.22, 0]}>
        <capsuleGeometry args={[0.14, 0.34, 6, 12]} />
        <meshStandardMaterial color="#f2fdff" emissive="#7ff8ff" emissiveIntensity={0.44} roughness={0.22} />
      </mesh>

      <mesh ref={targetAnchorRef} visible={false}>
        <torusGeometry args={[0.24, 0.035, 10, 42]} />
        <meshBasicMaterial
          color="#8ff8ff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <Line
        ref={tetherLineRef}
        points={tetherPoints}
        color="#8cf7ff"
        lineWidth={2.1}
        transparent
        opacity={status === 'PLAYING' ? 0.95 : 0}
      />

      <Line
        ref={guideLineRef}
        points={guidePoints}
        color="#d8ffff"
        lineWidth={1.2}
        transparent
        opacity={status === 'PLAYING' ? 0.45 : 0}
      />

      <points geometry={trailGeometry}>
        <pointsMaterial color="#d8feff" size={0.055} sizeAttenuation transparent opacity={0.55} />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.62} luminanceThreshold={0.5} luminanceSmoothing={0.24} mipmapBlur />
        <Vignette eskil={false} offset={0.1} darkness={0.34} />
        <Noise premultiply opacity={0.012} />
      </EffectComposer>

      <Html fullscreen>
        <TetherDriftOverlay />
      </Html>
    </>
  );
}

const TetherDrift: React.FC<{ soundsOn?: boolean }> = () => {
  return <TetherDriftScene />;
};

export default TetherDrift;
export * from './state';
