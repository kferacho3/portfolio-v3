'use client';

import * as React from 'react';
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise } from '@react-three/postprocessing';
import { useSnapshot } from 'valtio';
import * as THREE from 'three';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { COLOR_PALETTES, COLORS, CONST } from './constants';
import { clamp, damp } from './helpers';
import { onePathState, type OnePathLevel, type OnePathSegment } from './state';
import type { RunStatus } from './types';
import { segmentWorldPos, useOnMount } from './utils';

export { onePathState as oscillateState } from './state';
export { onePathState } from './state';

function formatLevel(n: number) {
  return `${n}`;
}

function smoothstep01(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function segmentDirection(seg: OnePathSegment) {
  if (seg.axis === 'x') return { x: seg.dir, z: 0 };
  return { x: 0, z: seg.dir };
}

function worldVelocityToLocal(seg: OnePathSegment, vx: number, vz: number) {
  if (seg.axis === 'x') {
    return { sVel: vx * seg.dir, lVel: vz };
  }
  return { sVel: vz * seg.dir, lVel: vx };
}

function Overlay() {
  const snap = useSnapshot(onePathState);

  const levelLabel =
    snap.phase === 'playing'
      ? snap.mode === 'levels'
        ? `LEVEL ${formatLevel(snap.level)}`
        : `ENDLESS ${formatLevel(snap.level)}`
      : '';

  return (
    <div className="absolute inset-0 select-none">
      <div className="absolute top-5 left-0 right-0 flex justify-center pointer-events-none">
        <div
          className="rounded-full bg-white/85 px-5 py-2 text-sm font-black tracking-wide"
          style={{ color: COLORS.hudInk, opacity: levelLabel ? 1 : 0 }}
        >
          {levelLabel}
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
        <div className="flex items-center gap-3 rounded-full bg-white/85 px-4 py-2 text-xs sm:text-sm font-semibold text-black/70">
          <span>
            Gems <span className="text-black">{snap.gems}</span>
          </span>
          <span className="h-4 w-px bg-black/10" />
          <span>
            Best{' '}
            <span className="text-black">
              {snap.mode === 'levels' ? snap.bestLevel : snap.endlessBest}
            </span>
          </span>
          <span className="h-4 w-px bg-black/10" />
          <span>
            Skin <span className="text-black">{snap.selectedSkin}</span>
          </span>
        </div>
      </div>

      {snap.phase === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(680px,94vw)] rounded-3xl bg-white/93 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl font-black" style={{ color: COLORS.hudInk }}>
                  One Path
                </h1>
                <p className="mt-2 text-black/70 leading-relaxed">
                  The Walls style rhythm-runner: oscillate between the two
                  end-cap walls of each corridor, tap at the interior junction,
                  transfer to the perpendicular path, and reach the portal.
                </p>
              </div>
              <button
                className="rounded-2xl bg-black/5 px-4 py-2 text-sm font-semibold text-black/70 hover:bg-black/10"
                onClick={() => onePathState.openShop()}
              >
                Shop
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/5 p-4">
                <div className="text-sm font-semibold text-black/80">
                  Deterministic motion
                </div>
                <div className="mt-1 text-sm text-black/65">
                  Deterministic wall-to-wall oscillation with exact reflections.
                  No physics randomness.
                </div>
              </div>
              <div className="rounded-2xl bg-black/5 p-4">
                <div className="text-sm font-semibold text-black/80">
                  Pressure mechanics
                </div>
                <div className="mt-1 text-sm text-black/65">
                  Later corridors require bounce counts to unlock gates, and
                  breakable walls punish indecision.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-black/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-black/80">
                    Select Level
                  </div>
                  <div className="text-sm text-black/60">
                    Levels are deterministic by seed.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="h-10 w-10 rounded-xl bg-white/80 text-black font-black hover:bg-white"
                    onClick={() =>
                      onePathState.selectLevel(Math.max(1, snap.selectedLevel - 1))
                    }
                  >
                    -
                  </button>
                  <div className="min-w-[68px] text-center text-2xl font-black text-black">
                    {snap.selectedLevel}
                  </div>
                  <button
                    className="h-10 w-10 rounded-xl bg-white/80 text-black font-black hover:bg-white"
                    onClick={() => onePathState.selectLevel(snap.selectedLevel + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-black/45">
                Inspired by The Walls gameplay loop. Tap/Space/Enter to turn.
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                  onClick={() => onePathState.startEndless()}
                >
                  Endless
                </button>
                <button
                  className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                  onClick={() => onePathState.start()}
                >
                  Play
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {snap.phase === 'shop' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(760px,95vw)] rounded-3xl bg-white/95 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-black text-black">Ball Shop</div>
                <div className="mt-1 text-sm text-black/60">
                  Unlock skins with gems.
                </div>
              </div>
              <button
                className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white"
                onClick={() => onePathState.closeShop()}
              >
                Done
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-black/70">
                Gems: <span className="font-semibold text-black">{snap.gems}</span>
              </div>
              <button
                className="rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/10"
                onClick={() => onePathState.awardGems(25)}
                title="Dev helper"
              >
                +25 gems
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {snap.skins.map((skin) => {
                const unlocked = snap.unlockedSkins.includes(skin.id);
                const selected = snap.selectedSkin === skin.id;
                const affordable = unlocked || snap.gems >= skin.cost;

                return (
                  <button
                    key={skin.id}
                    className={`rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                      selected
                        ? 'border-black bg-black/5'
                        : 'border-black/10 bg-white'
                    } ${affordable ? 'hover:bg-black/5' : 'opacity-60'}`}
                    onClick={() => {
                      if (unlocked) onePathState.selectSkin(skin.id);
                      else onePathState.unlockSkin(skin.id);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full border border-black/10"
                        style={{ background: skin.color }}
                      />
                      <div className="min-w-0">
                        <div className="font-black text-black truncate">{skin.name}</div>
                        <div className="text-xs text-black/60">
                          {unlocked
                            ? selected
                              ? 'Selected'
                              : 'Unlocked'
                            : `${skin.cost} gems`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {snap.phase === 'cleared' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(560px,92vw)] rounded-3xl bg-white/92 p-6 shadow-xl backdrop-blur-md">
            <div className="text-4xl font-black text-black">
              LEVEL {snap.level}{' '}
              <span className="text-black/70">CLEARED</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-black/70">
              <div className="rounded-xl bg-black/5 px-3 py-2">
                +{snap.lastRunGems} gems
              </div>
              <div className="text-sm">
                Total <span className="font-semibold text-black">{snap.gems}</span>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                onClick={() => onePathState.goMenu()}
              >
                Menu
              </button>
              <button
                className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                onClick={() => onePathState.retry()}
              >
                Replay
              </button>
              <button
                className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                onClick={() => onePathState.next()}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {snap.phase === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(560px,92vw)] rounded-3xl bg-white/92 p-6 shadow-xl backdrop-blur-md">
            <div className="text-4xl font-black text-black">Missed.</div>
            <div className="mt-2 text-black/70">
              Tap only when the ball is aligned to the interior junction marker.
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-sm text-black/60">
                {snap.mode === 'levels' ? (
                  <>
                    Level <span className="font-semibold text-black">{snap.level}</span>
                    {' '}• Best{' '}
                    <span className="font-semibold text-black">{snap.bestLevel}</span>
                  </>
                ) : (
                  <>
                    Endless{' '}
                    <span className="font-semibold text-black">{snap.level}</span>
                    {' '}• Best{' '}
                    <span className="font-semibold text-black">{snap.endlessBest}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                  onClick={() => onePathState.goMenu()}
                >
                  Menu
                </button>
                <button
                  className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                  onClick={() => onePathState.retry()}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type CameraRigProps = {
  levelRef: React.MutableRefObject<OnePathLevel>;
  runRef: React.MutableRefObject<RunStatus>;
};

function CameraRig({ levelRef, runRef }: CameraRigProps) {
  const { camera } = useThree();
  const lookRef = React.useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const lvl = levelRef.current;
    const r = runRef.current;
    const seg = lvl.segments[clamp(r.seg, 0, lvl.segments.length - 1)];
    const p = segmentWorldPos(seg, r.s, r.l);

    const targetX = p.x + 6.0;
    const targetY = 8.0;
    const targetZ = p.z + 6.4;

    camera.position.x = damp(camera.position.x, targetX, 7.5, dt);
    camera.position.y = damp(camera.position.y, targetY, 7.5, dt);
    camera.position.z = damp(camera.position.z, targetZ, 7.5, dt);

    lookRef.current.x = damp(lookRef.current.x, p.x, 9.0, dt);
    lookRef.current.y = damp(lookRef.current.y, r.y, 9.0, dt);
    lookRef.current.z = damp(lookRef.current.z, p.z, 9.0, dt);

    if (r.shake > 0.001) {
      const s = r.shake;
      camera.position.x += Math.sin(r.t * 44.0) * 0.03 * s;
      camera.position.y += Math.cos(r.t * 37.0) * 0.02 * s;
    }

    camera.lookAt(lookRef.current);
  });

  return null;
}

function Scene() {
  const snap = useSnapshot(onePathState);
  const inputRef = useInputRef();
  const { scene } = useThree();

  const levelRef = React.useRef<OnePathLevel>(
    onePathState.buildLevel(onePathState.level, onePathState.mode)
  );

  const runRef = React.useRef<RunStatus>({
    t: 0,
    seg: 0,
    s: 0.24,
    l: 0,
    lDir: 1,
    visibleSegments: 1,
    y: CONST.BASE_H + CONST.DECK_H + CONST.BALL_R,
    vy: 0,
    alive: true,
    cleared: false,
    gateOpen: true,
    bouncesOnSeg: 0,
    totalBounces: 0,
    score: 0,
    comboCount: 0,
    comboTime: 0,
    pulseCd: 0,
    pulseCdMax: 4.5,
    perfectFlash: 0,
    missFlash: 0,
    gateFlash: 0,
    shake: 0,
    squash: 0,
    stretch: 0,
    lastTapAt: -999,
    gemsThisRun: 0,
    deathSVel: 0,
    deathLVel: 0,
  });

  const simAccumulatorRef = React.useRef(0);
  const staticNeedsBuildRef = React.useRef(true);
  const runKeyRef = React.useRef('');

  const ballRef = React.useRef<THREE.Mesh>(null);
  const portalRef = React.useRef<THREE.Group>(null);
  const gateGlowRef = React.useRef<THREE.Mesh>(null);
  const targetMarkerRef = React.useRef<THREE.Group>(null);
  const targetRingRef = React.useRef<THREE.Mesh>(null);
  const targetHaloRef = React.useRef<THREE.Mesh>(null);
  const targetBeamRef = React.useRef<THREE.Mesh>(null);
  const ambientLightRef = React.useRef<THREE.AmbientLight>(null);
  const keyLightRef = React.useRef<THREE.DirectionalLight>(null);
  const fillLightRef = React.useRef<THREE.DirectionalLight>(null);

  const baseEvenRef = React.useRef<THREE.InstancedMesh>(null);
  const baseOddRef = React.useRef<THREE.InstancedMesh>(null);
  const deckRef = React.useRef<THREE.InstancedMesh>(null);
  const wallsRef = React.useRef<THREE.InstancedMesh>(null);
  const gateBlocksRef = React.useRef<THREE.InstancedMesh>(null);
  const gemsRef = React.useRef<THREE.InstancedMesh>(null);
  const trailRef = React.useRef<THREE.InstancedMesh>(null);

  const tmpObj = React.useMemo(() => new THREE.Object3D(), []);
  const tmpVec = React.useMemo(() => new THREE.Vector3(), []);
  const colorTmpA = React.useMemo(() => new THREE.Color(), []);
  const colorTmpB = React.useMemo(() => new THREE.Color(), []);

  const palettePool = React.useMemo(
    () =>
      COLOR_PALETTES.map((p) => ({
        bgTop: new THREE.Color(p.bgTop),
        bgBottom: new THREE.Color(p.bgBottom),
        floorA: new THREE.Color(p.floorA),
        floorB: new THREE.Color(p.floorB),
        deck: new THREE.Color(p.deck),
        deckGlow: new THREE.Color(p.deckGlow),
        wall: new THREE.Color(p.wall),
        wallDanger: new THREE.Color(p.wallDanger),
        gem: new THREE.Color(p.gem),
        portal: new THREE.Color(p.portal),
        ballTrail: new THREE.Color(p.ballTrail),
        markerCore: new THREE.Color(p.markerCore),
        markerRing: new THREE.Color(p.markerRing),
        markerHalo: new THREE.Color(p.markerHalo),
      })),
    []
  );

  const paletteRef = React.useRef({
    index: 0,
    nextIndex: Math.min(1, palettePool.length - 1),
    blend: 0,
    speed: 0.06,
    pulseOffset: Math.PI * 0.5,
  });

  const pickNextPaletteIndex = React.useCallback((exclude: number) => {
    if (palettePool.length <= 1) return exclude;
    const offset = 1 + Math.floor(Math.random() * (palettePool.length - 1));
    return (exclude + offset) % palettePool.length;
  }, [palettePool.length]);

  const assignRunPalette = React.useCallback(() => {
    if (palettePool.length === 0) return;
    const state = paletteRef.current;
    let idx = Math.floor(Math.random() * palettePool.length);
    if (palettePool.length > 1 && idx === state.index) {
      idx = (idx + 1) % palettePool.length;
    }
    state.index = idx;
    state.nextIndex = pickNextPaletteIndex(idx);
    state.blend = 0;
    state.speed = 0.048 + Math.random() * 0.042;
    state.pulseOffset = Math.random() * Math.PI * 2;
  }, [palettePool.length, pickNextPaletteIndex]);

  const trailState = React.useRef<{ head: number; points: THREE.Vector3[] }>({
    head: 0,
    points: Array.from({ length: CONST.TRAIL_POINTS }, () => new THREE.Vector3()),
  });

  const geoms = React.useMemo(() => {
    return {
      unitBox: new THREE.BoxGeometry(1, 1, 1),
      ball: new THREE.SphereGeometry(CONST.BALL_R, 28, 28),
      gem: new THREE.OctahedronGeometry(0.13, 0),
      gateGlow: new THREE.PlaneGeometry(1, 1),
      ring: new THREE.TorusGeometry(0.58, 0.1, 10, 44),
      targetCore: new THREE.CircleGeometry(0.12, 36),
      targetRing: new THREE.RingGeometry(0.2, 0.29, 44),
      targetHalo: new THREE.RingGeometry(0.32, 0.54, 52),
      targetBeam: new THREE.CylinderGeometry(0.045, 0.09, 0.52, 16, 1, true),
      trailDot: new THREE.SphereGeometry(1, 8, 8),
    };
  }, []);

  const materials = React.useMemo(() => {
    const baseEven = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.floorA),
      roughness: 0.75,
      metalness: 0.06,
    });
    const baseOdd = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.floorB),
      roughness: 0.75,
      metalness: 0.06,
    });
    const deck = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.deck),
      roughness: 0.55,
      metalness: 0.08,
      emissive: new THREE.Color(COLORS.deckGlow),
      emissiveIntensity: 0.1,
    });
    const walls = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.wall),
      roughness: 0.36,
      metalness: 0.12,
      emissive: new THREE.Color(COLORS.deckGlow),
      emissiveIntensity: 0.15,
    });
    const gates = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f2fbff'),
      roughness: 0.2,
      metalness: 0.18,
      emissive: new THREE.Color(COLORS.deckGlow),
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.92,
    });
    const gateGlow = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.portal),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const gem = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.gem),
      roughness: 0.22,
      metalness: 0.2,
      emissive: new THREE.Color(COLORS.gem),
      emissiveIntensity: 0.22,
    });
    const portal = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.2,
      metalness: 0.18,
      emissive: new THREE.Color(COLORS.portal),
      emissiveIntensity: 0.35,
    });
    const trail = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.ballTrail),
      roughness: 0.28,
      metalness: 0.12,
      emissive: new THREE.Color(COLORS.ballTrail),
      emissiveIntensity: 0.16,
      transparent: true,
      opacity: 0.22,
    });
    const targetCore = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.markerCore),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const targetRing = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.markerRing),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const targetHalo = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.markerHalo),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const targetBeam = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.markerHalo),
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    return {
      baseEven,
      baseOdd,
      deck,
      walls,
      gates,
      gateGlow,
      gem,
      portal,
      trail,
      targetCore,
      targetRing,
      targetHalo,
      targetBeam,
    };
  }, []);

  const ballMaterial = React.useMemo(() => {
    const skin =
      snap.skins.find((s) => s.id === snap.selectedSkin) ?? snap.skins[0];
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skin.color),
      roughness: skin.roughness,
      metalness: skin.metalness,
    });
    if (skin.emissive) {
      mat.emissive = new THREE.Color(skin.emissive);
      mat.emissiveIntensity = skin.emissiveIntensity ?? 0.12;
    }
    return mat;
  }, [snap.selectedSkin, snap.skins]);

  const resetRun = React.useCallback((lvl: OnePathLevel) => {
    lvl.segments.forEach((seg) => {
      seg.walls.neg.hp = seg.walls.neg.maxHp;
      seg.walls.neg.broken = false;
      seg.walls.pos.hp = seg.walls.pos.maxHp;
      seg.walls.pos.broken = false;
      if (seg.gate) {
        seg.gate.isOpen = seg.gate.requiredBounces <= 0;
      }
      seg.gems.forEach((gem) => {
        gem.collected = false;
      });
    });

    const r = runRef.current;
    const first = lvl.segments[0];
    r.t = 0;
    r.seg = 0;
    r.s = first ? Math.min(first.centerMax - 0.001, first.centerMin + 0.02) : 0.24;
    r.l = 0;
    r.lDir = 1;
    r.visibleSegments = 1;
    r.y = CONST.BASE_H + CONST.DECK_H + CONST.BALL_R;
    r.vy = 0;
    r.alive = true;
    r.cleared = false;
    r.gateOpen = lvl.segments[0]?.gate ? lvl.segments[0].gate!.isOpen : true;
    r.bouncesOnSeg = 0;
    r.totalBounces = 0;
    r.score = 0;
    r.comboCount = 0;
    r.comboTime = 0;
    r.pulseCd = 0;
    r.pulseCdMax = 4.5;
    r.perfectFlash = 0;
    r.missFlash = 0;
    r.gateFlash = 0;
    r.shake = 0;
    r.squash = 0;
    r.stretch = 0;
    r.lastTapAt = -999;
    r.gemsThisRun = 0;
    r.deathSVel = 0;
    r.deathLVel = 0;
    assignRunPalette();

    simAccumulatorRef.current = 0;
    staticNeedsBuildRef.current = true;

    const p = segmentWorldPos(lvl.segments[0], r.s, r.l);
    for (let i = 0; i < trailState.current.points.length; i += 1) {
      trailState.current.points[i].set(p.x, r.y, p.z);
    }
    trailState.current.head = 0;
  }, [assignRunPalette]);

  React.useEffect(() => {
    const runKey = `${snap.phase}:${snap.mode}:${snap.level}:${snap.resetTick}`;
    if (runKey === runKeyRef.current) return;

    if (snap.phase === 'playing' || snap.phase === 'menu') {
      const lvl = onePathState.buildLevel(onePathState.level, onePathState.mode);
      levelRef.current = lvl;
      resetRun(lvl);
    }

    runKeyRef.current = runKey;
  }, [snap.phase, snap.mode, snap.level, snap.resetTick, resetRun]);

  const triggerFail = React.useCallback((opts?: {
    forcedDir?: -1 | 1;
    worldImpulse?: { x: number; z: number };
  }) => {
    const lvl = levelRef.current;
    const r = runRef.current;
    if (!r.alive || r.cleared) return;
    const seg = lvl.segments[clamp(r.seg, 0, lvl.segments.length - 1)];
    const failDir = opts?.forcedDir ?? r.lDir;

    r.alive = false;
    r.vy = -2.3;
    r.deathSVel = lvl.lateralSpeed * failDir * 1.2;
    if (seg && opts?.worldImpulse) {
      const projected = worldVelocityToLocal(
        seg,
        opts.worldImpulse.x,
        opts.worldImpulse.z
      );
      r.deathSVel = projected.sVel;
      r.deathLVel = projected.lVel;
    } else if (seg) {
      const mid = (seg.centerMin + seg.centerMax) * 0.5;
      const sidePush = r.s >= mid ? 1 : -1;
      r.deathLVel = sidePush * Math.max(0.42, seg.halfWidth * 0.28);
    } else {
      r.deathLVel = 0;
    }
    r.missFlash = 1;
    r.shake = Math.max(r.shake, 0.8);
    onePathState.fail();
  }, []);

  const onBounce = React.useCallback(
    (seg: OnePathSegment, side: 'neg' | 'pos') => {
      const r = runRef.current;
      r.bouncesOnSeg += 1;
      r.totalBounces += 1;
      r.squash = Math.max(r.squash, 1);
      r.shake = Math.max(r.shake, 0.15);

      const wall = side === 'neg' ? seg.walls.neg : seg.walls.pos;
      if (!wall.broken) {
        wall.hp = Math.max(0, wall.hp - 1);
        if (wall.hp <= 0) {
          wall.broken = true;
          r.gateFlash = 1;
          // Timeout pressure mechanic: waiting too long breaks a wall and ends the run.
          triggerFail({ forcedDir: side === 'neg' ? -1 : 1 });
          return;
        }
      }

      if (seg.gate && !seg.gate.isOpen && r.bouncesOnSeg >= seg.gate.requiredBounces) {
        seg.gate.isOpen = true;
        r.gateOpen = true;
        r.gateFlash = 1;
        r.shake = Math.max(r.shake, 0.26);
        r.score += 10;
      }
    },
    [triggerFail]
  );

  const handleLevelClear = React.useCallback(() => {
    const r = runRef.current;
    if (onePathState.mode === 'endless') {
      onePathState.advanceEndless(r.gemsThisRun);
    } else {
      onePathState.clear(r.gemsThisRun);
    }
  }, []);

  const attemptTurn = React.useCallback(() => {
    const lvl = levelRef.current;
    const r = runRef.current;

    if (!r.alive || r.cleared) return;

    const seg = lvl.segments[r.seg];
    if (!seg || !seg.gate) return;

    const failTowardPath = () => {
      const nextSeg = lvl.segments[r.seg + 1];
      const desired = nextSeg ? segmentDirection(nextSeg) : segmentDirection(seg);
      const n = Math.max(1e-6, Math.hypot(desired.x, desired.z));
      const laneError = clamp(seg.gate.offset - r.s, -1, 1);
      const towardCenter = laneError * 0.9;

      const worldImpulse = {
        x:
          (desired.x / n) * lvl.lateralSpeed * 1.7 +
          (seg.axis === 'z' ? towardCenter : 0),
        z:
          (desired.z / n) * lvl.lateralSpeed * 1.7 +
          (seg.axis === 'x' ? towardCenter : 0),
      };
      triggerFail({ worldImpulse });
    };

    if (r.s < seg.gate.triggerStart || r.s > seg.gate.triggerEnd) {
      failTowardPath();
      return;
    }

    if (!seg.gate.isOpen) {
      failTowardPath();
      return;
    }

    const turnError = Math.abs(r.s - seg.gate.offset);
    if (turnError > lvl.tolerance) {
      failTowardPath();
      return;
    }

    const perfect = turnError <= lvl.perfectTol;
    r.perfectFlash = Math.max(r.perfectFlash, perfect ? 1 : 0.45);
    r.comboCount = perfect ? r.comboCount + 1 : 0;
    r.comboTime = perfect ? 1.9 : 1.1;
    r.score += Math.round((perfect ? 24 : 14) * (1 + r.comboCount * 0.09));
    r.lastTapAt = r.t;
    r.shake = Math.max(r.shake, perfect ? 0.34 : 0.22);

    const nextIndex = r.seg + 1;
    if (nextIndex >= lvl.segments.length) {
      r.cleared = true;
      handleLevelClear();
      return;
    }

    const nextSeg = lvl.segments[nextIndex];
    r.seg = nextIndex;
    r.s = nextSeg ? Math.min(nextSeg.centerMax - 0.001, nextSeg.centerMin + 0.01) : 0.001;
    r.l = 0;
    r.lDir = 1;
    r.visibleSegments = Math.min(lvl.segments.length, nextIndex + 1);
    r.bouncesOnSeg = 0;
    staticNeedsBuildRef.current = true;

    r.gateOpen = nextSeg?.gate ? nextSeg.gate.isOpen : true;
  }, [handleLevelClear, triggerFail]);

  const stepSimulation = React.useCallback(
    (dt: number) => {
      const lvl = levelRef.current;
      const r = runRef.current;

      r.t += dt;
      r.perfectFlash = Math.max(0, r.perfectFlash - dt * 2.6);
      r.missFlash = Math.max(0, r.missFlash - dt * 2.8);
      r.gateFlash = Math.max(0, r.gateFlash - dt * 2.3);
      r.comboTime = Math.max(0, r.comboTime - dt);
      if (r.comboTime <= 0) r.comboCount = 0;
      r.squash = Math.max(0, r.squash - dt * 5.2);
      r.shake = Math.max(0, r.shake - dt * 2.8);

      if (!r.alive) {
        r.vy -= 8.3 * dt;
        r.y += r.vy * dt;
        r.s += r.deathSVel * dt;
        r.l += r.deathLVel * dt;
        r.deathSVel *= 1 + dt * 0.26;
        r.deathLVel = damp(r.deathLVel, 0, 1.5, dt);
        return;
      }

      const seg = lvl.segments[clamp(r.seg, 0, lvl.segments.length - 1)];
      if (!seg) return;

      r.y = CONST.BASE_H + CONST.DECK_H + CONST.BALL_R + Math.sin(r.t * 9.2) * 0.008;

      // Long-axis oscillation between the two end-cap walls.
      r.s += lvl.lateralSpeed * r.lDir * dt;
      r.l = 0;

      const minS = seg.centerMin;
      const maxS = seg.centerMax;

      if (r.s <= minS) {
        r.s = minS;
        r.lDir = 1;
        onBounce(seg, 'neg');
        if (!r.alive) return;
      } else if (r.s >= maxS) {
        r.s = maxS;
        r.lDir = -1;
        onBounce(seg, 'pos');
        if (!r.alive) return;
      }

      for (let i = 0; i < seg.gems.length; i += 1) {
        const gem = seg.gems[i];
        if (gem.collected) continue;
        const dist = Math.hypot(r.s - gem.s, r.l - gem.l);
        if (dist < 0.24) {
          gem.collected = true;
          r.gemsThisRun += 1;
          r.score += 22;
          r.perfectFlash = Math.max(r.perfectFlash, 0.35);
        }
      }
    },
    [onBounce]
  );

  const rebuildStaticInstances = React.useCallback(() => {
    const lvl = levelRef.current;

    const even = baseEvenRef.current;
    const odd = baseOddRef.current;
    const deck = deckRef.current;

    if (!even || !odd || !deck) return;

    let evenCount = 0;
    let oddCount = 0;
    let deckCount = 0;

    const visibleCount = clamp(runRef.current.visibleSegments, 1, lvl.segments.length);
    for (let i = 0; i < visibleCount; i += 1) {
      const seg = lvl.segments[i];
      const center = segmentWorldPos(seg, seg.length * 0.5, 0);
      const rotY = seg.axis === 'z' ? Math.PI / 2 : 0;

      tmpObj.position.set(center.x, CONST.BASE_H * 0.5, center.z);
      tmpObj.rotation.set(0, rotY, 0);
      tmpObj.scale.set(seg.length, CONST.BASE_H, seg.halfWidth * 2 + CONST.WALL_T * 2);
      tmpObj.updateMatrix();

      if (i % 2 === 0) {
        even.setMatrixAt(evenCount, tmpObj.matrix);
        evenCount += 1;
      } else {
        odd.setMatrixAt(oddCount, tmpObj.matrix);
        oddCount += 1;
      }

      tmpObj.position.set(center.x, CONST.BASE_H + CONST.DECK_H * 0.5, center.z);
      tmpObj.rotation.set(0, rotY, 0);
      tmpObj.scale.set(seg.length, CONST.DECK_H, seg.halfWidth * 2);
      tmpObj.updateMatrix();
      deck.setMatrixAt(deckCount, tmpObj.matrix);
      deckCount += 1;
    }

    even.count = evenCount;
    odd.count = oddCount;
    deck.count = deckCount;
    even.instanceMatrix.needsUpdate = true;
    odd.instanceMatrix.needsUpdate = true;
    deck.instanceMatrix.needsUpdate = true;
  }, [tmpObj]);

  const updateDynamicInstances = React.useCallback(() => {
    const lvl = levelRef.current;
    const r = runRef.current;

    const walls = wallsRef.current;
    const gateBlocks = gateBlocksRef.current;
    const gems = gemsRef.current;

    if (!walls || !gateBlocks || !gems) return;

    let wallIdx = 0;
    let gateIdx = 0;
    let gemIdx = 0;
    const activeSegIndex = clamp(r.seg, 0, lvl.segments.length - 1);

    const wallYBase = CONST.BASE_H + CONST.DECK_H + CONST.WALL_H * 0.5;
    const gateY = CONST.BASE_H + CONST.DECK_H * 0.5;

    for (let i = 0; i < lvl.segments.length; i += 1) {
      const seg = lvl.segments[i];
      if (i !== activeSegIndex) continue;

      for (let side = 0; side < 2; side += 1) {
        const wall = side === 0 ? seg.walls.neg : seg.walls.pos;
        const wallS = side === 0 ? 0 : seg.length;
        const wallPos = segmentWorldPos(seg, wallS, 0);

        const hp01 = wall.unbreakable
          ? 1
          : clamp(wall.hp / Math.max(1, wall.maxHp), 0, 1);
        const liveScaleY = wall.broken ? 0.0001 : CONST.WALL_H * (0.72 + hp01 * 0.28);

        tmpObj.position.set(wallPos.x, wallYBase, wallPos.z);
        tmpObj.rotation.set(0, 0, 0);
        if (seg.axis === 'x') {
          tmpObj.scale.set(CONST.WALL_T, liveScaleY, seg.corridorWidth);
        } else {
          tmpObj.scale.set(seg.corridorWidth, liveScaleY, CONST.WALL_T);
        }

        tmpObj.updateMatrix();
        walls.setMatrixAt(wallIdx, tmpObj.matrix);
        wallIdx += 1;
      }

      if (seg.gate) {
        const open = seg.gate.isOpen;
        const gatePoint = segmentWorldPos(seg, seg.gate.offset, 0);
        const collapse = open ? 0.0001 : 1;

        tmpObj.position.set(gatePoint.x, gateY, gatePoint.z);
        tmpObj.rotation.set(0, 0, 0);
        if (seg.axis === 'x') {
          tmpObj.scale.set(0.14, CONST.DECK_H * 1.08 * collapse, seg.corridorWidth * 0.88);
        } else {
          tmpObj.scale.set(seg.corridorWidth * 0.88, CONST.DECK_H * 1.08 * collapse, 0.14);
        }
        tmpObj.updateMatrix();
        gateBlocks.setMatrixAt(gateIdx, tmpObj.matrix);
        gateIdx += 1;
      }

      for (let g = 0; g < seg.gems.length; g += 1) {
        const gem = seg.gems[g];
        if (gem.collected) continue;
        const p = segmentWorldPos(seg, gem.s, gem.l);
        tmpObj.position.set(p.x, CONST.BASE_H + CONST.DECK_H + 0.34, p.z);
        tmpObj.rotation.set(0.45, r.t * 1.8 + (gemIdx % 5) * 0.45, 0);
        tmpObj.scale.setScalar(0.19);
        tmpObj.updateMatrix();
        gems.setMatrixAt(gemIdx, tmpObj.matrix);
        gemIdx += 1;
      }
    }

    walls.count = wallIdx;
    gateBlocks.count = gateIdx;
    gems.count = gemIdx;

    walls.instanceMatrix.needsUpdate = true;
    gateBlocks.instanceMatrix.needsUpdate = true;
    gems.instanceMatrix.needsUpdate = true;

    const gateGlow = gateGlowRef.current;
    const currentSeg = lvl.segments[clamp(r.seg, 0, lvl.segments.length - 1)];
    if (gateGlow && currentSeg?.gate && r.alive && !r.cleared) {
      const gatePoint = segmentWorldPos(currentSeg, currentSeg.gate.offset, 0);
      const readWindow = Math.max(
        lvl.tolerance * 2.8,
        currentSeg.corridorWidth * 0.42
      );
      const proximity = 1 - clamp(Math.abs(r.s - currentSeg.gate.offset) / readWindow, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(r.t * 8.2 + 0.7);
      gateGlow.visible = true;
      gateGlow.position.set(gatePoint.x, CONST.BASE_H + CONST.DECK_H + 0.015, gatePoint.z);
      gateGlow.rotation.set(
        -Math.PI / 2,
        currentSeg.axis === 'z' ? Math.PI / 2 : 0,
        0
      );
      gateGlow.scale.set(
        0.34 + proximity * 0.2 + pulse * 0.05,
        currentSeg.corridorWidth * (1.02 + proximity * 0.1),
        1
      );
      const gateMat = gateGlow.material as THREE.MeshBasicMaterial;
      const openBoost = currentSeg.gate.isOpen ? 0.75 : 0.38;
      gateMat.opacity = clamp(
        openBoost + pulse * 0.2 + proximity * 0.28 + r.gateFlash * 0.2,
        0.24,
        0.98
      );
    } else if (gateGlow) {
      gateGlow.visible = false;
    }
  }, [tmpObj]);

  const updateTrail = React.useCallback(() => {
    const lvl = levelRef.current;
    const r = runRef.current;
    const trail = trailRef.current;
    if (!trail) return;

    const seg = lvl.segments[clamp(r.seg, 0, lvl.segments.length - 1)];
    if (!seg) return;

    const p = segmentWorldPos(seg, r.s, r.l);
    trailState.current.head = (trailState.current.head + 1) % trailState.current.points.length;
    trailState.current.points[trailState.current.head].set(p.x, r.y, p.z);

    const n = trailState.current.points.length;
    trail.count = n;

    for (let i = 0; i < n; i += 1) {
      const idx = (trailState.current.head - i + n) % n;
      const pt = trailState.current.points[idx];
      const t = 1 - i / n;

      tmpObj.position.copy(pt);
      tmpObj.scale.setScalar(0.14 + t * 0.22);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.updateMatrix();
      trail.setMatrixAt(i, tmpObj.matrix);
    }

    trail.instanceMatrix.needsUpdate = true;
  }, [tmpObj]);

  useFrame((_, delta) => {
    const d = Math.min(CONST.MAX_DELTA, delta);
    const input = inputRef.current;

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('enter');

    const restart = input.justPressed.has('r');
    if (restart && snap.phase === 'playing') {
      onePathState.retry();
    }

    const r = runRef.current;

    if (snap.phase === 'playing' && tap) {
      attemptTurn();
    }

    if (snap.phase === 'playing') {
      simAccumulatorRef.current += d;
      let steps = 0;
      while (
        simAccumulatorRef.current >= CONST.FIXED_DT &&
        steps < CONST.MAX_STEPS &&
        snap.phase === 'playing'
      ) {
        stepSimulation(CONST.FIXED_DT);
        simAccumulatorRef.current -= CONST.FIXED_DT;
        steps += 1;
      }
    } else {
      r.t += d;
      r.perfectFlash = Math.max(0, r.perfectFlash - d * 2.2);
      r.missFlash = Math.max(0, r.missFlash - d * 2.4);
      r.gateFlash = Math.max(0, r.gateFlash - d * 2.0);
      r.shake = Math.max(0, r.shake - d * 2.5);

      if (!r.alive) {
        r.vy -= 8.2 * d;
        r.y += r.vy * d;
        r.s += r.deathSVel * d;
        r.l += r.deathLVel * d;
        r.deathSVel *= 1 + d * 0.24;
        r.deathLVel = damp(r.deathLVel, 0, 1.5, d);
      } else {
        const seg0 = levelRef.current.segments[0];
        if (seg0) {
          r.seg = 0;
          const mid = (seg0.centerMin + seg0.centerMax) * 0.5;
          const amp = Math.max(0.01, (seg0.centerMax - seg0.centerMin) * 0.44);
          r.s = mid + Math.sin(r.t * 1.8) * amp;
          r.l = 0;
        }
        r.y = CONST.BASE_H + CONST.DECK_H + CONST.BALL_R + Math.sin(r.t * 8) * 0.012;
      }
    }

    const lvl = levelRef.current;
    const seg = lvl.segments[clamp(r.seg, 0, lvl.segments.length - 1)];
    const p = seg ? segmentWorldPos(seg, r.s, r.l) : tmpVec.set(0, 0, 0);
    const paletteState = paletteRef.current;
    if (palettePool.length > 0) {
      paletteState.blend += d * paletteState.speed;
      if (paletteState.blend >= 1) {
        paletteState.index = paletteState.nextIndex;
        paletteState.nextIndex = pickNextPaletteIndex(paletteState.index);
        paletteState.blend = 0;
      }

      const blend = smoothstep01(paletteState.blend);
      const a = palettePool[paletteState.index];
      const b = palettePool[paletteState.nextIndex];
      const auraPulse = 0.5 + 0.5 * Math.sin(r.t * 1.65 + paletteState.pulseOffset);

      colorTmpA.lerpColors(a.bgTop, b.bgTop, blend);
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(colorTmpA);
      } else {
        scene.background = colorTmpA.clone();
      }
      colorTmpB.lerpColors(a.bgBottom, b.bgBottom, blend);
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(colorTmpB);
      }

      materials.baseEven.color.lerpColors(a.floorA, b.floorA, blend);
      materials.baseOdd.color.lerpColors(a.floorB, b.floorB, blend);
      materials.deck.color.lerpColors(a.deck, b.deck, blend);
      materials.deck.emissive.lerpColors(a.deckGlow, b.deckGlow, blend);
      materials.walls.color.lerpColors(a.wall, b.wall, blend);
      materials.walls.emissive.lerpColors(a.deckGlow, b.deckGlow, blend);
      materials.gates.color.lerpColors(a.markerCore, b.markerCore, blend);
      materials.gates.emissive.lerpColors(a.deckGlow, b.deckGlow, blend);
      materials.gateGlow.color.lerpColors(a.portal, b.portal, blend);
      materials.gem.color.lerpColors(a.gem, b.gem, blend);
      materials.gem.emissive.lerpColors(a.gem, b.gem, blend);
      materials.portal.emissive.lerpColors(a.portal, b.portal, blend);
      materials.trail.color.lerpColors(a.ballTrail, b.ballTrail, blend);
      materials.trail.emissive.lerpColors(a.ballTrail, b.ballTrail, blend);
      materials.targetCore.color.lerpColors(a.markerCore, b.markerCore, blend);
      materials.targetRing.color.lerpColors(a.markerRing, b.markerRing, blend);
      materials.targetHalo.color.lerpColors(a.markerHalo, b.markerHalo, blend);
      materials.targetBeam.color.lerpColors(a.markerHalo, b.markerHalo, blend);

      materials.deck.emissiveIntensity = 0.1 + auraPulse * 0.1;
      materials.walls.emissiveIntensity = 0.14 + auraPulse * 0.16 + r.missFlash * 0.22;
      materials.gates.emissiveIntensity = 0.42 + auraPulse * 0.2 + r.gateFlash * 0.3;
      materials.gem.emissiveIntensity = 0.2 + auraPulse * 0.22;
      materials.portal.emissiveIntensity = 0.32 + auraPulse * 0.16;
      materials.trail.opacity = 0.16 + auraPulse * 0.18;

      if (ambientLightRef.current) {
        ambientLightRef.current.color.copy(colorTmpA).lerp(colorTmpB, 0.45);
        ambientLightRef.current.intensity = 0.78 + auraPulse * 0.14 + r.perfectFlash * 0.1;
      }
      if (keyLightRef.current) {
        keyLightRef.current.color.copy(colorTmpB).lerp(colorTmpA, 0.2);
        keyLightRef.current.intensity = 1.02 + auraPulse * 0.24 + r.perfectFlash * 0.18;
      }
      if (fillLightRef.current) {
        fillLightRef.current.color.copy(colorTmpA).lerp(colorTmpB, 0.7);
        fillLightRef.current.intensity = 0.32 + (1 - auraPulse) * 0.18 + r.missFlash * 0.12;
      }
    }

    if (ballRef.current) {
      ballRef.current.position.set(p.x, r.y, p.z);
      if (r.alive) {
        ballRef.current.rotation.y += d * 2.3;
        ballRef.current.rotation.x += d * 1.2;
      } else {
        const spin =
          Math.min(8, Math.abs(r.deathSVel) * 0.95 + Math.abs(r.deathLVel) * 1.4) + 0.9;
        const signedRoll = r.deathSVel >= 0 ? 1 : -1;
        ballRef.current.rotation.x += d * spin;
        ballRef.current.rotation.z += d * spin * 0.42 * signedRoll;
      }

      const sq = r.squash;
      const sx = 1 + sq * 0.18;
      const sy = Math.max(0.72, 1 - sq * 0.24);
      ballRef.current.scale.set(sx, sy, sx);
    }

    if (portalRef.current) {
      const portalVisible = r.visibleSegments >= lvl.segments.length;
      portalRef.current.visible = portalVisible;
      if (portalVisible) {
        portalRef.current.position.set(lvl.exit.x, CONST.BASE_H + CONST.DECK_H + 0.24, lvl.exit.z);
        portalRef.current.rotation.y += d * 0.75;
        portalRef.current.rotation.x = Math.sin(r.t * 0.8) * 0.12;

        const portalMat = (portalRef.current.children[0] as THREE.Mesh | undefined)
          ?.material as THREE.MeshStandardMaterial | undefined;
        if (portalMat) {
          portalMat.emissiveIntensity = 0.35 + Math.sin(r.t * 4.4) * 0.07;
        }
      }
    }

    const targetMarker = targetMarkerRef.current;
    const activeSeg = lvl.segments[clamp(r.seg, 0, lvl.segments.length - 1)];
    if (targetMarker && activeSeg?.gate && r.alive && !r.cleared) {
      const gatePoint = segmentWorldPos(activeSeg, activeSeg.gate.offset, 0);
      const pulse = 0.5 + 0.5 * Math.sin(r.t * 10.8 + paletteState.pulseOffset * 0.7);
      const readWindow = Math.max(
        lvl.tolerance * 2.8,
        activeSeg.corridorWidth * 0.42
      );
      const proximity = 1 - clamp(Math.abs(r.s - activeSeg.gate.offset) / readWindow, 0, 1);
      const openFactor = activeSeg.gate.isOpen ? 1 : 0.46;

      targetMarker.visible = true;
      targetMarker.position.set(
        gatePoint.x,
        CONST.BASE_H + CONST.DECK_H + 0.01,
        gatePoint.z
      );
      targetMarker.rotation.set(0, activeSeg.axis === 'z' ? Math.PI / 2 : 0, 0);
      const markerScale = 1 + pulse * 0.08 + proximity * 0.14;
      targetMarker.scale.set(markerScale, markerScale, markerScale);

      if (targetRingRef.current) {
        targetRingRef.current.scale.setScalar(0.94 + pulse * 0.36 + proximity * 0.22);
      }
      if (targetHaloRef.current) {
        targetHaloRef.current.scale.setScalar(0.82 + pulse * 0.52 + proximity * 0.3);
      }
      if (targetBeamRef.current) {
        targetBeamRef.current.scale.set(
          1 + pulse * 0.18,
          0.9 + proximity * 0.28,
          1 + pulse * 0.18
        );
      }

      materials.targetCore.opacity = clamp(
        0.34 + openFactor * 0.28 + pulse * 0.2 + proximity * 0.22,
        0.2,
        0.96
      );
      materials.targetRing.opacity = clamp(
        0.3 + openFactor * 0.26 + pulse * 0.28 + proximity * 0.26,
        0.22,
        0.98
      );
      materials.targetHalo.opacity = clamp(
        0.18 + openFactor * 0.2 + pulse * 0.34 + proximity * 0.22,
        0.1,
        0.92
      );
      materials.targetBeam.opacity = clamp(
        0.16 + openFactor * 0.2 + pulse * 0.28 + proximity * 0.2,
        0.1,
        0.9
      );
    } else if (targetMarker) {
      targetMarker.visible = false;
    }

    if (staticNeedsBuildRef.current) {
      rebuildStaticInstances();
      staticNeedsBuildRef.current = false;
    }

    updateDynamicInstances();
    updateTrail();

    clearFrameInput(inputRef);
  });

  return (
    <>
      <color attach="background" args={[COLORS.bgTop]} />
      <fog attach="fog" args={[COLORS.bgBottom, 16, 82]} />

      <ambientLight ref={ambientLightRef} intensity={0.85} />
      <directionalLight
        ref={keyLightRef}
        position={[8, 12, 8]}
        intensity={1.12}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight ref={fillLightRef} position={[-7, 6, -2]} intensity={0.42} />

      <CameraRig levelRef={levelRef} runRef={runRef} />

      <instancedMesh ref={baseEvenRef} args={[geoms.unitBox, materials.baseEven, 128]} receiveShadow />
      <instancedMesh ref={baseOddRef} args={[geoms.unitBox, materials.baseOdd, 128]} receiveShadow />
      <instancedMesh ref={deckRef} args={[geoms.unitBox, materials.deck, 128]} receiveShadow />
      <instancedMesh ref={wallsRef} args={[geoms.unitBox, materials.walls, 256]} castShadow receiveShadow />
      <instancedMesh ref={gateBlocksRef} args={[geoms.unitBox, materials.gates, 256]} castShadow receiveShadow />
      <instancedMesh ref={gemsRef} args={[geoms.gem, materials.gem, 256]} castShadow />

      <mesh
        ref={gateGlowRef}
        geometry={geoms.gateGlow}
        material={materials.gateGlow}
        visible={false}
      />
      <group ref={targetMarkerRef} visible={false}>
        <mesh
          ref={targetHaloRef}
          geometry={geoms.targetHalo}
          material={materials.targetHalo}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <mesh
          ref={targetRingRef}
          geometry={geoms.targetRing}
          material={materials.targetRing}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <mesh
          geometry={geoms.targetCore}
          material={materials.targetCore}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <mesh
          ref={targetBeamRef}
          geometry={geoms.targetBeam}
          material={materials.targetBeam}
          position={[0, 0.28, 0]}
        />
      </group>

      <group ref={portalRef}>
        <mesh geometry={geoms.ring} material={materials.portal} castShadow />
      </group>

      <instancedMesh ref={trailRef} args={[geoms.trailDot, materials.trail, CONST.TRAIL_POINTS]} />

      <mesh ref={ballRef} geometry={geoms.ball} material={ballMaterial} castShadow />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.62}
          luminanceThreshold={0.42}
          luminanceSmoothing={0.28}
          mipmapBlur
        />
        <Noise opacity={0.05} />
      </EffectComposer>
    </>
  );
}

export default function OnePath() {
  useOnMount(() => onePathState.load());

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 45, position: [6, 8, 6] }}
      className="absolute inset-0 h-full w-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Scene />
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="fixed inset-0 pointer-events-auto">
          <Overlay />
        </div>
      </Html>
    </Canvas>
  );
}
