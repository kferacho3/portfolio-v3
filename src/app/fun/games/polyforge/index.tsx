'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, Stars } from '@react-three/drei';
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

import { useAudioState, useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';

import {
  POLYFORGE_HIT_RULES,
  polyForgeState,
  POLYFORGE_TONE_CHAINS,
} from './state';

export { polyForgeState } from './state';

const SHOOT_RADIUS = 0.082;
const SHOOT_COOLDOWN_S = POLYFORGE_HIT_RULES.shootCooldownMs / 1000;
const LASER_VISIBLE_S = 0.09;
const ORBIT_RADIUS = 4.65;
const SHAPE_RADIUS = 2.15;
const BASE_FOV = 46;

type QualityTier = 'low' | 'medium' | 'high';
type EndlessMusicScaleMode = 'zen' | 'chromatic' | 'polyrhythm';

type ThemeDef = {
  bg: string;
  fog: string;
  glow: string;
  bloom: string;
};

type PolyMeshData = {
  geometry: THREE.BufferGeometry;
  triangleToSegment: Int16Array;
  segmentTriangles: number[][];
  segmentBaseColors: THREE.Color[];
  segmentForgedColors: THREE.Color[];
  segmentCount: number;
};

type AudioRuntime = {
  ctx: AudioContext | null;
  master: GainNode | null;
  compressor: DynamicsCompressorNode | null;
};

const THEMES: ThemeDef[] = [
  { bg: '#050610', fog: '#1d2b66', glow: '#7dd3fc', bloom: '#93c5fd' },
  { bg: '#0b0614', fog: '#4c1d95', glow: '#c4b5fd', bloom: '#ddd6fe' },
  { bg: '#08140f', fog: '#14532d', glow: '#86efac', bloom: '#bbf7d0' },
  { bg: '#190807', fog: '#7f1d1d', glow: '#fda4af', bloom: '#fecdd3' },
  { bg: '#140f06', fog: '#7c2d12', glow: '#fdba74', bloom: '#fed7aa' },
];

const PENTATONIC = [0, 2, 4, 7, 9];

const tmpTriA = new THREE.Vector3();
const tmpTriB = new THREE.Vector3();
const tmpTriC = new THREE.Vector3();
const tmpV0 = new THREE.Vector3();
const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function getTheme(seed: number) {
  return THEMES[Math.abs(seed) % THEMES.length];
}

function buildPalette(seed: number, colorCount: number) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const baseHue = Math.floor(rand() * 360);
  const palette: THREE.Color[] = [];
  for (let i = 0; i < colorCount; i += 1) {
    const hue =
      (((baseHue + i * (360 / colorCount) + rand() * 18) % 360) + 360) % 360;
    const sat = 0.7 + rand() * 0.2;
    const light = 0.48 + rand() * 0.1;
    palette.push(new THREE.Color().setHSL(hue / 360, sat, light));
  }
  return palette;
}

function pushTriangle(
  positions: number[],
  normals: number[],
  colors: number[],
  triangleToSegment: number[],
  segmentTriangles: number[][],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  color: THREE.Color,
  segmentIndex: number
) {
  tmpV0.subVectors(b, a);
  tmpV1.subVectors(c, a);
  tmpV2.crossVectors(tmpV0, tmpV1).normalize();

  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < 3; i += 1) {
    normals.push(tmpV2.x, tmpV2.y, tmpV2.z);
    colors.push(color.r, color.g, color.b);
  }

  const triangleIndex = triangleToSegment.length;
  triangleToSegment.push(segmentIndex);
  if (segmentIndex >= 0) {
    segmentTriangles[segmentIndex].push(triangleIndex);
  }
}

function createPolyMeshData(
  seed: number,
  segments: number,
  height: number,
  colorCount: number,
  twistAmount: number,
  isAntiprism: boolean
): PolyMeshData {
  const palette = buildPalette(seed, Math.max(1, colorCount));
  const baseColor = new THREE.Color('#101528');
  const capColor = new THREE.Color('#0b0f1c');

  const segmentBaseColors: THREE.Color[] = [];
  const segmentForgedColors: THREE.Color[] = [];
  for (let i = 0; i < segments; i += 1) {
    const c = palette[i % palette.length];
    segmentBaseColors.push(c.clone().lerp(baseColor, 0.78));
    segmentForgedColors.push(c.clone().multiplyScalar(1.15));
  }

  const top: THREE.Vector3[] = [];
  const bottom: THREE.Vector3[] = [];
  const twist = isAntiprism ? (Math.PI / segments) * twistAmount : 0;

  for (let i = 0; i < segments; i += 1) {
    const baseAngle = (i / segments) * Math.PI * 2;
    const topAngle = baseAngle + twist;

    top.push(
      new THREE.Vector3(
        Math.cos(topAngle) * SHAPE_RADIUS,
        height * 0.5,
        Math.sin(topAngle) * SHAPE_RADIUS
      )
    );

    bottom.push(
      new THREE.Vector3(
        Math.cos(baseAngle) * SHAPE_RADIUS,
        -height * 0.5,
        Math.sin(baseAngle) * SHAPE_RADIUS
      )
    );
  }

  const centerTop = new THREE.Vector3(0, height * 0.5, 0);
  const centerBottom = new THREE.Vector3(0, -height * 0.5, 0);

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const triangleToSegment: number[] = [];
  const segmentTriangles: number[][] = Array.from(
    { length: segments },
    () => []
  );

  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const b0 = bottom[i];
    const b1 = bottom[next];
    const t0 = top[i];
    const t1 = top[next];

    const segColor = segmentBaseColors[i];
    pushTriangle(
      positions,
      normals,
      colors,
      triangleToSegment,
      segmentTriangles,
      b0,
      t0,
      t1,
      segColor,
      i
    );
    pushTriangle(
      positions,
      normals,
      colors,
      triangleToSegment,
      segmentTriangles,
      b0,
      t1,
      b1,
      segColor,
      i
    );
  }

  // top cap
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    pushTriangle(
      positions,
      normals,
      colors,
      triangleToSegment,
      segmentTriangles,
      centerTop,
      top[i],
      top[next],
      capColor,
      -1
    );
  }

  // bottom cap
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    pushTriangle(
      positions,
      normals,
      colors,
      triangleToSegment,
      segmentTriangles,
      centerBottom,
      bottom[next],
      bottom[i],
      capColor,
      -1
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(new Float32Array(normals), 3)
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(new Float32Array(colors), 3)
  );
  geometry.computeBoundingSphere();

  return {
    geometry,
    triangleToSegment: Int16Array.from(triangleToSegment),
    segmentTriangles,
    segmentBaseColors,
    segmentForgedColors,
    segmentCount: segments,
  };
}

function getQualityTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium';

  const dpr = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  if (cores <= 4 || dpr > 2.3) return 'low';
  if (cores >= 8 && dpr <= 2) return 'high';
  return 'medium';
}

function minBarycentricFromPoint(
  p: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3
) {
  tmpV0.subVectors(b, a);
  tmpV1.subVectors(c, a);
  tmpV2.subVectors(p, a);

  const d00 = tmpV0.dot(tmpV0);
  const d01 = tmpV0.dot(tmpV1);
  const d11 = tmpV1.dot(tmpV1);
  const d20 = tmpV2.dot(tmpV0);
  const d21 = tmpV2.dot(tmpV1);
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-8) return 0;

  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1 - v - w;
  return Math.min(u, v, w);
}

function ensureAudio(audio: AudioRuntime) {
  if (audio.ctx) return;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 2.7;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.12;
  master.gain.value = 0.2;
  master.connect(compressor);
  compressor.connect(ctx.destination);
  audio.ctx = ctx;
  audio.master = master;
  audio.compressor = compressor;
}

function playHitVoice(
  audio: AudioRuntime,
  frequency: number,
  intensity: number,
  accent = false
) {
  if (!audio.ctx || !audio.master) return;

  const now = audio.ctx.currentTime;
  const oscA = audio.ctx.createOscillator();
  const oscB = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  const filter = audio.ctx.createBiquadFilter();

  oscA.type = accent ? 'triangle' : 'sine';
  oscB.type = accent ? 'sine' : 'triangle';
  oscA.frequency.setValueAtTime(frequency, now);
  oscB.frequency.setValueAtTime(frequency * 1.5, now);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1500 + intensity * 1700, now);
  filter.Q.setValueAtTime(0.7 + intensity * 0.8, now);

  const attack = accent ? 0.005 : POLYFORGE_TONE_CHAINS.hitMain.envelope.attack;
  const decay = accent ? 0.11 : POLYFORGE_TONE_CHAINS.hitMain.envelope.decay;
  const sustain = accent ? 0.0 : POLYFORGE_TONE_CHAINS.hitMain.envelope.sustain;
  const release = accent
    ? 0.09
    : POLYFORGE_TONE_CHAINS.hitMain.envelope.release;
  const peak = 0.13 + intensity * 0.14;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, peak * sustain),
    now + attack + decay
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + attack + decay + release
  );

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);

  oscA.start(now);
  oscB.start(now);
  const stopAt = now + attack + decay + release + 0.05;
  oscA.stop(stopAt);
  oscB.stop(stopAt);
}

function playFailVoice(audio: AudioRuntime) {
  if (!audio.ctx || !audio.master) return;
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  const filter = audio.ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(164, now);
  osc.frequency.exponentialRampToValueAtTime(84, now + 0.26);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(460, now);
  filter.frequency.exponentialRampToValueAtTime(220, now + 0.28);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);

  osc.start(now);
  osc.stop(now + 0.36);
}

function getHitFrequency(totalHits: number, mode: EndlessMusicScaleMode) {
  const base = 220;

  if (mode === 'zen') {
    const step = totalHits;
    const octave = Math.floor(step / PENTATONIC.length);
    const note = PENTATONIC[step % PENTATONIC.length] + octave * 12;
    return base * 2 ** (note / 12);
  }

  if (mode === 'polyrhythm') {
    const note = totalHits % 16;
    return base * 2 ** (note / 12);
  }

  // chromatic
  return base * 2 ** ((totalHits % 24) / 12);
}

export default function PolyForge() {
  const snap = useSnapshot(polyForgeState);
  const { paused } = useGameUIState();
  const { soundsOn } = useAudioState();
  const input = useInputRef();

  const { camera, scene } = useThree();

  const meshRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const shooterRef = useRef<THREE.Mesh>(null);
  const laserRef = useRef<THREE.Mesh>(null);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const quality = useMemo(() => getQualityTier(), []);

  const audioRef = useRef<AudioRuntime>({
    ctx: null,
    master: null,
    compressor: null,
  });

  const meshData = useMemo(
    () =>
      createPolyMeshData(
        snap.levelSeed,
        snap.segments,
        snap.height,
        snap.colorCount,
        snap.twistAmount,
        snap.isAntiprism
      ),
    [
      snap.levelSeed,
      snap.segments,
      snap.height,
      snap.colorCount,
      snap.twistAmount,
      snap.isAntiprism,
    ]
  );

  const theme = useMemo(() => getTheme(snap.levelSeed), [snap.levelSeed]);

  const world = useRef({
    faceForged: [] as boolean[],
    forgedCount: 0,

    shootCooldown: 0,
    lastShotAtMs: 0,
    laserTimer: 0,

    spaceWasDown: false,
    camShake: 0,
    failFlash: 0,

    bgColor: new THREE.Color(theme.bg),
    fogColor: new THREE.Color(theme.fog),
    targetBg: new THREE.Color(theme.bg),
    targetFog: new THREE.Color(theme.fog),

    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    laserMid: new THREE.Vector3(),
    laserDir: new THREE.Vector3(),
    cameraTarget: new THREE.Vector3(0, 0, 7.6),
    cameraLookAt: new THREE.Vector3(0, 0, 0),
    localHit: new THREE.Vector3(),
    faceNormal: new THREE.Vector3(),
    rayDir: new THREE.Vector3(),
    shapeWorld: new THREE.Vector3(),
    shooterWorld: new THREE.Vector3(),
    tmpNormalMatrix: new THREE.Matrix3(),
  });

  const paintSegment = (segmentIndex: number, forged: boolean) => {
    const colorAttr = meshData.geometry.getAttribute(
      'color'
    ) as THREE.BufferAttribute;
    const colorArray = colorAttr.array as Float32Array;
    const triIndices = meshData.segmentTriangles[segmentIndex];
    const color = forged
      ? meshData.segmentForgedColors[segmentIndex]
      : meshData.segmentBaseColors[segmentIndex];

    for (let i = 0; i < triIndices.length; i += 1) {
      const tri = triIndices[i];
      const offset = tri * 9;
      for (let v = 0; v < 3; v += 1) {
        const base = offset + v * 3;
        colorArray[base + 0] = color.r;
        colorArray[base + 1] = color.g;
        colorArray[base + 2] = color.b;
      }
    }
    colorAttr.needsUpdate = true;
  };

  const updateLaser = (start: THREE.Vector3, end: THREE.Vector3) => {
    const laser = laserRef.current;
    if (!laser) return;
    laser.visible = true;
    world.current.laserTimer = LASER_VISIBLE_S;

    world.current.laserMid.copy(start).add(end).multiplyScalar(0.5);
    world.current.laserDir.subVectors(end, start);
    const len = world.current.laserDir.length();
    if (len < 1e-5) return;
    world.current.laserDir.multiplyScalar(1 / len);

    laser.position.copy(world.current.laserMid);
    laser.scale.set(1, len, 1);
    laser.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      world.current.laserDir
    );
  };

  const handleSuccessAudio = () => {
    if (!soundsOn) return;
    ensureAudio(audioRef.current);
    if (!audioRef.current.ctx) return;
    if (audioRef.current.ctx.state === 'suspended') {
      void audioRef.current.ctx.resume();
    }

    const noteFreq = getHitFrequency(
      polyForgeState.totalHits,
      (snap.mode === 'endless'
        ? snap.endlessMusicMode
        : 'chromatic') as EndlessMusicScaleMode
    );
    const intensity = Math.min(1, polyForgeState.combo / 12);
    playHitVoice(audioRef.current, noteFreq, intensity, false);

    if (snap.mode === 'endless' && snap.endlessMusicMode === 'polyrhythm') {
      playHitVoice(audioRef.current, noteFreq * 1.618, intensity * 0.65, true);
    } else if (polyForgeState.combo > 0 && polyForgeState.combo % 6 === 0) {
      playHitVoice(audioRef.current, noteFreq * 2, intensity, true);
    }
  };

  const handleFailAudio = () => {
    if (!soundsOn) return;
    ensureAudio(audioRef.current);
    if (!audioRef.current.ctx) return;
    if (audioRef.current.ctx.state === 'suspended') {
      void audioRef.current.ctx.resume();
    }
    playFailVoice(audioRef.current);
  };

  const tryShoot = () => {
    if (snap.phase !== 'playing' || paused) return;
    if (!meshRef.current || !shooterRef.current) return;
    if (world.current.shootCooldown > 0) return;

    const nowMs = performance.now();
    if (
      nowMs - world.current.lastShotAtMs <
      POLYFORGE_HIT_RULES.shootCooldownMs
    ) {
      return;
    }
    world.current.lastShotAtMs = nowMs;
    world.current.shootCooldown = SHOOT_COOLDOWN_S;

    meshRef.current.getWorldPosition(world.current.shapeWorld);
    shooterRef.current.getWorldPosition(world.current.shooterWorld);
    world.current.rayDir
      .subVectors(world.current.shapeWorld, world.current.shooterWorld)
      .normalize();

    raycaster.set(world.current.shooterWorld, world.current.rayDir);
    const hit = raycaster.intersectObject(meshRef.current, false)[0];

    world.current.startPos.copy(world.current.shooterWorld);
    if (hit?.point) {
      world.current.endPos.copy(hit.point);
    } else {
      world.current.endPos
        .copy(world.current.startPos)
        .addScaledVector(world.current.rayDir, 12);
    }
    updateLaser(world.current.startPos, world.current.endPos);

    if (!hit || hit.faceIndex == null) return;
    if (!hit.face) return;

    const triIndex = Math.floor(hit.faceIndex);
    if (triIndex < 0 || triIndex >= meshData.triangleToSegment.length) return;
    const segmentIndex = meshData.triangleToSegment[triIndex];
    if (segmentIndex < 0) return;

    const posAttr = meshData.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    const triStart = triIndex * 3;
    tmpTriA.fromBufferAttribute(posAttr, triStart + 0);
    tmpTriB.fromBufferAttribute(posAttr, triStart + 1);
    tmpTriC.fromBufferAttribute(posAttr, triStart + 2);

    world.current.localHit.copy(hit.point);
    meshRef.current.worldToLocal(world.current.localHit);
    const minBary = minBarycentricFromPoint(
      world.current.localHit,
      tmpTriA,
      tmpTriB,
      tmpTriC
    );
    if (minBary < POLYFORGE_HIT_RULES.edgeDeadzoneBarycentric) return;

    world.current.tmpNormalMatrix.getNormalMatrix(meshRef.current.matrixWorld);
    world.current.faceNormal
      .copy(hit.face.normal)
      .applyMatrix3(world.current.tmpNormalMatrix)
      .normalize();
    const incidence = -world.current.rayDir.dot(world.current.faceNormal);
    if (incidence < POLYFORGE_HIT_RULES.minIncidenceDot) return;

    if (world.current.faceForged[segmentIndex]) {
      polyForgeState.registerStrike();
      world.current.camShake = Math.min(1, world.current.camShake + 0.4);
      world.current.failFlash = 1;
      handleFailAudio();
      return;
    }

    world.current.faceForged[segmentIndex] = true;
    world.current.forgedCount += 1;
    paintSegment(segmentIndex, true);

    polyForgeState.registerFaceSuccess();
    world.current.camShake = Math.min(1, world.current.camShake + 0.22);
    handleSuccessAudio();
  };

  useEffect(() => {
    polyForgeState.loadBest();
  }, []);

  useEffect(() => {
    world.current.faceForged = new Array(meshData.segmentCount).fill(false);
    world.current.forgedCount = 0;
    world.current.failFlash = 0;
    polyForgeState.total = meshData.segmentCount;
    polyForgeState.progress = 0;
    if (laserRef.current) laserRef.current.visible = false;
  }, [meshData]);

  useEffect(() => {
    world.current.targetBg.set(theme.bg);
    world.current.targetFog.set(theme.fog);
    if (!scene.fog) {
      scene.fog = new THREE.Fog(world.current.fogColor.clone(), 8, 28);
    }
  }, [scene, theme]);

  useEffect(() => {
    if ('fov' in camera) {
      const perspectiveCamera = camera as THREE.PerspectiveCamera;
      perspectiveCamera.fov = BASE_FOV;
      perspectiveCamera.near = 0.1;
      perspectiveCamera.far = 120;
      perspectiveCamera.updateProjectionMatrix();
    }
    camera.position.set(0, 0, 7.6);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame((_, dt) => {
    const inputState = input.current;
    const spaceDown = inputState.keysDown.has(' ');
    const spaceTap = spaceDown && !world.current.spaceWasDown;
    world.current.spaceWasDown = spaceDown;

    if (inputState.justPressed.has('1')) polyForgeState.setMode('classic');
    if (inputState.justPressed.has('2')) polyForgeState.setMode('endless');
    if (inputState.justPressed.has('3')) polyForgeState.setMode('daily');

    if (inputState.justPressed.has('m') && snap.mode === 'endless') {
      const cycle: EndlessMusicScaleMode[] = ['zen', 'chromatic', 'polyrhythm'];
      const idx = cycle.indexOf(snap.endlessMusicMode as EndlessMusicScaleMode);
      polyForgeState.setEndlessMusicMode(cycle[(idx + 1) % cycle.length]);
    }

    if (inputState.justPressed.has('r')) {
      polyForgeState.startGame();
      clearFrameInput(input);
      return;
    }

    const tapped = inputState.pointerJustDown || spaceTap;
    if (tapped) {
      if (snap.phase === 'menu' || snap.phase === 'gameover') {
        polyForgeState.startGame();
      } else {
        tryShoot();
      }
    }

    if (world.current.shootCooldown > 0) {
      world.current.shootCooldown = Math.max(
        0,
        world.current.shootCooldown - dt
      );
    }

    if (laserRef.current) {
      world.current.laserTimer -= dt;
      laserRef.current.visible = world.current.laserTimer > 0;
    }

    if (
      meshRef.current &&
      orbitRef.current &&
      snap.phase === 'playing' &&
      !paused
    ) {
      let orbitSpeed = snap.rotationSpeed;
      if (snap.mode === 'endless') {
        if (snap.endlessMusicMode === 'zen') orbitSpeed *= 0.82;
        if (snap.endlessMusicMode === 'polyrhythm') orbitSpeed *= 1.618;
      }
      orbitRef.current.rotation.y += orbitSpeed * dt;

      const shapeSpeed = snap.rotationSpeed * 0.62;
      meshRef.current.rotation.y += shapeSpeed * dt;
      meshRef.current.rotation.x += shapeSpeed * 0.45 * dt;
    }

    world.current.bgColor.lerp(world.current.targetBg, 1 - Math.exp(-dt * 2.8));
    world.current.fogColor.lerp(
      world.current.targetFog,
      1 - Math.exp(-dt * 3.0)
    );
    scene.background = world.current.bgColor;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(world.current.fogColor);
      const near = 7 + Math.min(6, snap.level * 0.16);
      const far = 24 + Math.min(14, snap.level * 0.45);
      scene.fog.near = near;
      scene.fog.far = far;
    }

    world.current.camShake = Math.max(0, world.current.camShake - dt * 4.5);
    world.current.failFlash = Math.max(0, world.current.failFlash - dt * 2.4);

    const shake = world.current.camShake;
    const t = performance.now() * 0.0036;
    const xShake = (Math.sin(t * 3.1) + Math.cos(t * 1.7)) * 0.09 * shake;
    const yShake = (Math.cos(t * 2.7) + Math.sin(t * 4.1)) * 0.06 * shake;

    world.current.cameraTarget.set(
      xShake,
      yShake,
      7.6 - Math.min(0.9, snap.level * 0.028)
    );
    camera.position.lerp(world.current.cameraTarget, 1 - Math.exp(-dt * 7.8));
    camera.lookAt(world.current.cameraLookAt);

    clearFrameInput(input);
  });

  const endlessModeText =
    snap.endlessMusicMode === 'zen'
      ? 'Pentatonic Zen'
      : snap.endlessMusicMode === 'polyrhythm'
        ? 'Polyrhythm Forge'
        : 'Chromatic Forge';

  return (
    <group>
      <ambientLight intensity={0.38} />
      <directionalLight position={[5.5, 7.5, 4.8]} intensity={1.25} />
      <pointLight
        position={[-4.8, -2.2, 3.6]}
        intensity={0.65}
        color={theme.glow}
      />
      <pointLight
        position={[0, 0, 0]}
        intensity={1.1}
        color={theme.bloom}
        distance={10}
      />

      <Stars
        radius={80}
        depth={36}
        count={quality === 'low' ? 600 : 1100}
        factor={quality === 'low' ? 2.5 : 3.2}
        saturation={0}
        fade
        speed={0.25}
      />

      <group ref={orbitRef}>
        <mesh ref={shooterRef} position={[ORBIT_RADIUS, 0, 0]}>
          <icosahedronGeometry args={[0.18, 1]} />
          <meshStandardMaterial
            color="#e2e8f0"
            emissive="#93c5fd"
            emissiveIntensity={0.55}
          />
        </mesh>
      </group>

      <mesh ref={meshRef} geometry={meshData.geometry}>
        <meshStandardMaterial
          vertexColors
          roughness={0.38}
          metalness={0.08}
          emissive={theme.glow}
          emissiveIntensity={0.22}
          flatShading
        />
      </mesh>

      <mesh ref={laserRef} visible={false}>
        <cylinderGeometry args={[SHOOT_RADIUS, SHOOT_RADIUS, 1, 12]} />
        <meshBasicMaterial color="#e2f2ff" transparent opacity={0.92} />
      </mesh>

      <mesh>
        <torusGeometry args={[ORBIT_RADIUS, 0.014, 8, 96]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.34} />
      </mesh>

      {(quality === 'medium' || quality === 'high') && (
        <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
          <Bloom
            mipmapBlur
            intensity={quality === 'high' ? 0.78 : 0.52}
            luminanceThreshold={0.42}
            luminanceSmoothing={0.22}
          />
          <ChromaticAberration
            offset={new THREE.Vector2(0.00045, 0.00045)}
            radialModulation={false}
            modulationOffset={0}
          />
          <Noise opacity={quality === 'high' ? 0.028 : 0} />
          <Vignette eskil={false} offset={0.21} darkness={0.78} />
        </EffectComposer>
      )}

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: 'white',
            textShadow: '0 4px 14px rgba(0,0,0,0.55)',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            userSelect: 'none',
          }}
        >
          <div style={{ fontWeight: 800, letterSpacing: 0.28 }}>
            Poly Forge+
          </div>
          <div style={{ marginTop: 4, opacity: 0.9 }}>
            {snap.mode.toUpperCase()}{' '}
            {snap.mode === 'daily' ? `• ${snap.dailyKey}` : ''}
          </div>
          {snap.mode === 'daily' && (
            <div style={{ marginTop: 3, opacity: 0.86 }}>
              Daily Best: {snap.dailyBest}
            </div>
          )}
          {snap.mode === 'endless' && (
            <div style={{ marginTop: 3, opacity: 0.86 }}>{endlessModeText}</div>
          )}
          <div style={{ marginTop: 8, opacity: 0.95 }}>
            Level {snap.level} • Faces {snap.progress}/{Math.max(1, snap.total)}
          </div>
          <div style={{ marginTop: 3, opacity: 0.95 }}>
            Strikes {snap.strikes}/{snap.strikeLimit}
          </div>
          <div style={{ marginTop: 3, opacity: 0.95 }}>
            Combo x{Math.max(1, snap.combo)} • Best Combo x
            {Math.max(1, snap.bestCombo)}
          </div>
          <div style={{ marginTop: 3, opacity: 0.95 }}>
            Score {snap.score}{' '}
            <span style={{ opacity: 0.74 }}>Best {snap.best}</span>
          </div>
          <div style={{ marginTop: 6, opacity: 0.72, fontSize: 12 }}>
            Quality: {quality}
          </div>
        </div>

        {snap.phase !== 'playing' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
              transition: 'background 120ms linear',
            }}
          >
            <div
              style={{
                width: 'min(560px, 92vw)',
                borderRadius: 16,
                padding: 20,
                background: 'rgba(6,8,16,0.78)',
                border: '1px solid rgba(255,255,255,0.12)',
                pointerEvents: 'auto',
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900, color: 'white' }}>
                {snap.phase === 'gameover' ? 'Forge Broken' : 'Poly Forge+'}
              </div>
              <div
                style={{
                  marginTop: 8,
                  color: 'rgba(255,255,255,0.86)',
                  lineHeight: 1.42,
                }}
              >
                Fire from the orbiting forge. Paint each unique face once.
                Hitting a forged face costs a strike.
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {(['classic', 'endless', 'daily'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => polyForgeState.setMode(mode)}
                    style={{
                      borderRadius: 999,
                      border:
                        snap.mode === mode
                          ? '1px solid rgba(147,197,253,0.9)'
                          : '1px solid rgba(255,255,255,0.2)',
                      background:
                        snap.mode === mode
                          ? 'rgba(59,130,246,0.18)'
                          : 'rgba(255,255,255,0.08)',
                      color: 'white',
                      padding: '6px 12px',
                      fontSize: 12,
                      letterSpacing: 0.22,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {snap.mode === 'endless' && (
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {(['zen', 'chromatic', 'polyrhythm'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => polyForgeState.setEndlessMusicMode(mode)}
                      style={{
                        borderRadius: 999,
                        border:
                          snap.endlessMusicMode === mode
                            ? '1px solid rgba(196,181,253,0.9)'
                            : '1px solid rgba(255,255,255,0.2)',
                        background:
                          snap.endlessMusicMode === mode
                            ? 'rgba(124,58,237,0.2)'
                            : 'rgba(255,255,255,0.08)',
                        color: 'white',
                        padding: '6px 12px',
                        fontSize: 11,
                        letterSpacing: 0.18,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}

              <div
                style={{
                  marginTop: 14,
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: 13,
                }}
              >
                Controls: Click/Tap/Space shoot • 1/2/3 switch modes • M cycles
                endless music • R restart
              </div>
              <div
                style={{
                  marginTop: 8,
                  color: 'rgba(255,255,255,0.74)',
                  fontSize: 12,
                }}
              >
                Anti-cheese rules: edge deadzone + incidence angle checks keep
                hits fair and readable.
              </div>

              <button
                type="button"
                onClick={() => polyForgeState.startGame()}
                style={{
                  marginTop: 16,
                  borderRadius: 10,
                  border: '1px solid rgba(147,197,253,0.7)',
                  background: 'rgba(59,130,246,0.22)',
                  color: 'white',
                  padding: '10px 14px',
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  cursor: 'pointer',
                }}
              >
                {snap.phase === 'gameover' ? 'Run It Again' : 'Start Forge'}
              </button>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}
