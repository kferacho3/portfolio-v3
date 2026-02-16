'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  SMAA,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useSnapshot } from 'valtio';
import { useGameUIState } from '../../store/selectors';
import {
  GAME_CONFIG,
  MODE_SETTINGS,
  OBSTACLE_PATTERNS,
  PATTERN_LABELS,
  getRunnerCharacter,
} from './constants';
import {
  buildReplay,
  computeScore,
  createFixedStepper,
  createWorld,
  enqueueTurn,
  getPatternName,
  getPlayerAngle,
  stepWorld,
  type OctaWorld,
} from './engine';
import { useOctaRuntimeStore } from './runtime';
import { octaSurgeState } from './state';
import type {
  OctaFxLevel,
  OctaRunnerGeometry,
  OctaRunnerShape,
  OctaTileVariant,
} from './types';

export { octaSurgeState } from './state';

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const damp = (from: number, to: number, lambda: number, dt: number) =>
  THREE.MathUtils.damp(from, to, lambda, dt);

const tileVariantToFloat = (variant: OctaTileVariant) => {
  if (variant === 'wire') return 1;
  if (variant === 'glass') return 2;
  return 0;
};

type InstanceBuffers = {
  laneArray: Float32Array;
  ringArray: Float32Array;
  sidesArray: Float32Array;
  blockedArray: Float32Array;
  collectibleArray: Float32Array;
  patternArray: Float32Array;
  laneAttr: THREE.InstancedBufferAttribute;
  ringAttr: THREE.InstancedBufferAttribute;
  sidesAttr: THREE.InstancedBufferAttribute;
  blockedAttr: THREE.InstancedBufferAttribute;
  collectibleAttr: THREE.InstancedBufferAttribute;
  patternAttr: THREE.InstancedBufferAttribute;
};

const createInstanceBuffers = (ringCount: number, maxSides: number): InstanceBuffers => {
  const count = ringCount * maxSides;
  const laneArray = new Float32Array(count);
  const ringArray = new Float32Array(count);
  const sidesArray = new Float32Array(count);
  const blockedArray = new Float32Array(count);
  const collectibleArray = new Float32Array(count);
  const patternArray = new Float32Array(count);

  let ptr = 0;
  for (let slot = 0; slot < ringCount; slot += 1) {
    for (let lane = 0; lane < maxSides; lane += 1) {
      laneArray[ptr] = lane;
      ringArray[ptr] = slot;
      sidesArray[ptr] = 0;
      blockedArray[ptr] = 0;
      collectibleArray[ptr] = 0;
      patternArray[ptr] = 0;
      ptr += 1;
    }
  }

  const laneAttr = new THREE.InstancedBufferAttribute(laneArray, 1);
  const ringAttr = new THREE.InstancedBufferAttribute(ringArray, 1);
  const sidesAttr = new THREE.InstancedBufferAttribute(sidesArray, 1);
  const blockedAttr = new THREE.InstancedBufferAttribute(blockedArray, 1);
  const collectibleAttr = new THREE.InstancedBufferAttribute(collectibleArray, 1);
  const patternAttr = new THREE.InstancedBufferAttribute(patternArray, 1);

  ringAttr.setUsage(THREE.DynamicDrawUsage);
  sidesAttr.setUsage(THREE.DynamicDrawUsage);
  blockedAttr.setUsage(THREE.DynamicDrawUsage);
  collectibleAttr.setUsage(THREE.DynamicDrawUsage);
  patternAttr.setUsage(THREE.DynamicDrawUsage);

  return {
    laneArray,
    ringArray,
    sidesArray,
    blockedArray,
    collectibleArray,
    patternArray,
    laneAttr,
    ringAttr,
    sidesAttr,
    blockedAttr,
    collectibleAttr,
    patternAttr,
  };
};

const syncInstanceBuffers = (world: OctaWorld, buffers: InstanceBuffers) => {
  const ringCount = world.ringCount;
  const maxSides = world.maxSides;

  for (let slot = 0; slot < ringCount; slot += 1) {
    const ringId = world.ringIds[slot] ?? slot;
    const sides = world.ringSides[slot] ?? 8;
    const mask = world.ringMasks[slot] ?? 0;
    const collectibleMask = world.ringCollectibles[slot] ?? 0;
    const pattern = world.ringPattern[slot] ?? 0;

    const base = slot * maxSides;
    for (let lane = 0; lane < maxSides; lane += 1) {
      const idx = base + lane;
      buffers.ringArray[idx] = ringId;
      buffers.sidesArray[idx] = sides;
      const blocked = lane < sides && (mask & (1 << lane)) !== 0 ? 1 : 0;
      const collectible = lane < sides && (collectibleMask & (1 << lane)) !== 0 ? 1 : 0;
      buffers.blockedArray[idx] = blocked;
      buffers.collectibleArray[idx] = collectible;
      buffers.patternArray[idx] = pattern;
    }
  }

  buffers.ringAttr.needsUpdate = true;
  buffers.sidesAttr.needsUpdate = true;
  buffers.blockedAttr.needsUpdate = true;
  buffers.collectibleAttr.needsUpdate = true;
  buffers.patternAttr.needsUpdate = true;
};

const makePanelMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: false,
    depthTest: true,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uSpacing: { value: GAME_CONFIG.ringSpacing },
      uRadius: { value: GAME_CONFIG.tunnelRadius },
      uLaneWidthScale: { value: GAME_CONFIG.laneWidthScale },
      uPanelWidthScale: { value: GAME_CONFIG.platformWidthScale },
      uSpeed: { value: 0 },
      uPulse: { value: 0 },
      uCombo: { value: 0 },
      uVariant: { value: 0 },
    },
    vertexShader: `
      precision highp float;
      attribute float aLane;
      attribute float aRing;
      attribute float aSides;

      uniform float uScroll;
      uniform float uSpacing;
      uniform float uRadius;
      uniform float uLaneWidthScale;
      uniform float uPanelWidthScale;

      varying vec2 vUv;
      varying float vDepth;
      varying float vSides;
      varying float vLane;

      const float PI = 3.141592653589793;
      const float TAU = 6.283185307179586;

      void main() {
        float sides = max(aSides, 3.0);
        float lane = mod(aLane, sides);
        float visible = step(aLane, sides - 0.5);

        float angle = (lane / sides) * TAU;

        vec3 outN = vec3(cos(angle), sin(angle), 0.0);
        vec3 inN = -outN;
        vec3 tangent = vec3(-sin(angle), cos(angle), 0.0);

        float z = -(aRing * uSpacing - uScroll);
        vec3 base = outN * uRadius + vec3(0.0, 0.0, z);
        float laneWidth = 2.0 * uRadius * tan(PI / sides) * uLaneWidthScale;

        vec3 local = position * mix(0.001, 1.0, visible);
        vec3 worldPos = base + tangent * (local.x * laneWidth * uPanelWidthScale) + inN * local.y + vec3(0.0, 0.0, 1.0) * local.z;

        vUv = uv;
        vDepth = z;
        vSides = sides;
        vLane = lane;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      varying float vDepth;
      varying float vSides;
      varying float vLane;

      uniform float uTime;
      uniform float uSpeed;
      uniform float uPulse;
      uniform float uCombo;
      uniform float uVariant;

      vec3 palettePrism(float t) {
        return vec3(0.07, 0.22, 0.45) + vec3(0.23, 0.55, 0.92) * (0.5 + 0.5 * sin(vec3(1.0, 1.3, 1.7) * t));
      }

      vec3 paletteWire(float t) {
        return vec3(0.08, 0.25, 0.33) + vec3(0.18, 0.78, 0.66) * (0.5 + 0.5 * cos(vec3(1.0, 1.4, 1.9) * t));
      }

      vec3 paletteGlass(float t) {
        return vec3(0.09, 0.12, 0.22) + vec3(0.52, 0.58, 0.95) * (0.5 + 0.5 * sin(vec3(1.2, 1.0, 1.5) * t));
      }

      vec3 edgePalette(float lane) {
        float idx = mod(floor(lane), 6.0);
        if (idx < 0.5) return vec3(0.24, 0.95, 1.0);
        if (idx < 1.5) return vec3(1.0, 0.69, 0.28);
        if (idx < 2.5) return vec3(1.0, 0.45, 0.63);
        if (idx < 3.5) return vec3(0.72, 0.52, 1.0);
        if (idx < 4.5) return vec3(0.38, 1.0, 0.74);
        return vec3(1.0, 0.88, 0.42);
      }

      void main() {
        vec2 gridUV = vUv * vec2(8.0, 2.0);
        vec2 line = abs(fract(gridUV - 0.5) - 0.5) / fwidth(gridUV);
        float grid = 1.0 - min(min(line.x, line.y), 1.0);

        float pulse = 0.5 + 0.5 * sin(vDepth * 0.12 + uTime * (1.6 + uSpeed * 0.025));
        pulse += uPulse * 0.55;
        pulse += clamp(uCombo * 0.012, 0.0, 0.45);

        float t = uTime * 0.55 + vSides * 0.42 + vDepth * 0.015;
        vec3 col = palettePrism(t);
        if (uVariant > 0.5) {
          col = paletteWire(t * 1.05);
        }
        if (uVariant > 1.5) {
          col = paletteGlass(t * 0.95);
        }

        vec3 base = vec3(0.018, 0.022, 0.032);
        float glow = pow(grid, 2.0) * (0.45 + pulse * 0.95);
        vec3 finalColor = base + col * glow;

        float edgeDist = min(vUv.x, 1.0 - vUv.x);
        float seam = 1.0 - smoothstep(0.0, 0.085, edgeDist);
        float seamCore = 1.0 - smoothstep(0.0, 0.03, edgeDist);
        vec3 seamColor = edgePalette(vLane + floor(vSides * 0.5));

        finalColor = mix(finalColor, seamColor * (0.48 + pulse * 0.72), seam * 0.82);
        finalColor += seamColor * seamCore * (0.3 + pulse * 0.25);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });

const makeObstacleMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: false,
    depthTest: true,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uSpacing: { value: GAME_CONFIG.ringSpacing },
      uRadius: { value: GAME_CONFIG.tunnelRadius },
      uLaneWidthScale: { value: GAME_CONFIG.laneWidthScale },
      uObstacleWidthScale: { value: GAME_CONFIG.obstacleWidthScale },
      uPulse: { value: 0 },
      uDanger: { value: 0 },
    },
    vertexShader: `
      precision highp float;
      attribute float aLane;
      attribute float aRing;
      attribute float aSides;
      attribute float aBlocked;
      attribute float aPattern;

      uniform float uScroll;
      uniform float uSpacing;
      uniform float uRadius;
      uniform float uLaneWidthScale;
      uniform float uObstacleWidthScale;
      uniform float uPulse;

      varying vec2 vUv;
      varying float vPattern;
      varying float vDepth;

      const float PI = 3.141592653589793;
      const float TAU = 6.283185307179586;

      void main() {
        float sides = max(aSides, 3.0);
        float lane = mod(aLane, sides);
        float laneVisible = step(aLane, sides - 0.5);
        float visible = laneVisible * step(0.5, aBlocked);

        float angle = (lane / sides) * TAU;

        vec3 outN = vec3(cos(angle), sin(angle), 0.0);
        vec3 inN = -outN;
        vec3 tangent = vec3(-sin(angle), cos(angle), 0.0);

        float z = -(aRing * uSpacing - uScroll);
        vec3 base = outN * uRadius + vec3(0.0, 0.0, z);
        float laneWidth = 2.0 * uRadius * tan(PI / sides) * uLaneWidthScale;

        vec3 local = position;
        local.y += 0.06 + uPulse * 0.02;
        float style = aPattern;
        if (style > 5.5 && style < 7.5) {
          // Laser-like bars
          local.y *= 0.26;
          local.x *= 0.92;
          local.z *= 0.9;
        } else if (style > 6.5 && style < 8.5) {
          // Cluster shards
          local.x *= 0.54;
          local.y *= 1.12;
        } else if (style > 7.5 && style < 9.5) {
          // Split pillars
          local.x *= 0.38;
          local.y *= 1.34;
        } else if (style > 8.5) {
          // Helix snare ribs
          local.y *= 0.34;
          local.x *= 0.96;
        }
        local *= mix(0.001, 1.0, visible);

        vec3 worldPos = base + tangent * (local.x * laneWidth * uObstacleWidthScale) + inN * (local.y + 0.18) + vec3(0.0, 0.0, 1.0) * local.z;

        vUv = uv;
        vPattern = aPattern;
        vDepth = z;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      varying float vPattern;
      varying float vDepth;

      uniform float uTime;
      uniform float uPulse;
      uniform float uDanger;

      vec3 patternColor(float pattern, float t) {
        if (pattern < 0.5) return vec3(0.95, 0.45, 0.38);
        if (pattern < 1.5) return vec3(0.97, 0.64, 0.28);
        if (pattern < 2.5) return vec3(0.95, 0.35, 0.58);
        if (pattern < 3.5) return vec3(0.84, 0.34, 0.97);
        if (pattern < 4.5) return vec3(0.42, 0.78, 1.0);
        return vec3(0.98, 0.26, 0.42);
      }

      void main() {
        vec2 centered = vUv - 0.5;
        float d = length(centered);
        float edge = smoothstep(0.48, 0.22, d);

        float rhythm = 0.5 + 0.5 * sin(uTime * 5.2 + vDepth * 0.22);
        float pulse = clamp(0.25 + rhythm * 0.65 + uPulse * 0.55 + uDanger * 0.4, 0.0, 2.2);
        float beam = 0.0;
        if (vPattern > 5.5) {
          float sweep = abs(fract(vUv.x * 8.0 + uTime * 3.8) - 0.5);
          beam = smoothstep(0.48, 0.08, sweep) * (0.5 + pulse);
        }

        vec3 base = patternColor(vPattern, uTime);
        vec3 color = base * (0.45 + edge * pulse * 1.25);
        color += vec3(0.9, 0.96, 1.0) * beam * 0.75;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

const makeCollectibleMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uSpacing: { value: GAME_CONFIG.ringSpacing },
      uRadius: { value: GAME_CONFIG.tunnelRadius },
      uLaneWidthScale: { value: GAME_CONFIG.laneWidthScale },
      uPulse: { value: 0 },
    },
    vertexShader: `
      precision highp float;
      attribute float aLane;
      attribute float aRing;
      attribute float aSides;
      attribute float aCollectible;

      uniform float uScroll;
      uniform float uSpacing;
      uniform float uRadius;
      uniform float uLaneWidthScale;
      uniform float uPulse;

      varying vec2 vUv;
      varying float vDepth;

      const float PI = 3.141592653589793;
      const float TAU = 6.283185307179586;

      void main() {
        float sides = max(aSides, 3.0);
        float lane = mod(aLane, sides);
        float visible = step(0.5, aCollectible) * step(aLane, sides - 0.5);

        float angle = (lane / sides) * TAU;
        vec3 outN = vec3(cos(angle), sin(angle), 0.0);
        vec3 inN = -outN;
        vec3 tangent = vec3(-sin(angle), cos(angle), 0.0);

        float z = -(aRing * uSpacing - uScroll);
        vec3 base = outN * uRadius + vec3(0.0, 0.0, z);
        float laneWidth = 2.0 * uRadius * tan(PI / sides) * uLaneWidthScale;

        vec3 local = position;
        local *= 0.26 + uPulse * 0.04;
        local *= mix(0.001, 1.0, visible);

        vec3 worldPos = base + tangent * (local.x * laneWidth) + inN * (local.y + 0.34) + vec3(0.0, 0.0, 1.0) * local.z;

        vUv = uv;
        vDepth = z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      varying float vDepth;
      uniform float uTime;

      void main() {
        float d = length(vUv - 0.5);
        float core = smoothstep(0.42, 0.08, d);
        float halo = smoothstep(0.58, 0.16, d) * 0.6;
        float pulse = 0.65 + 0.35 * sin(uTime * 6.8 + vDepth * 0.23);
        vec3 color = vec3(1.0, 0.95, 0.64) * core * pulse + vec3(0.72, 0.95, 1.0) * halo;
        gl_FragColor = vec4(color, core + halo * 0.6);
      }
    `,
  });

type TunnelProps = {
  worldRef: React.MutableRefObject<OctaWorld | null>;
  tileVariant: OctaTileVariant;
};

function TunnelRenderer({ worldRef, tileVariant }: TunnelProps) {
  const lastVersionRef = useRef(-1);

  const buffers = useMemo(
    () => createInstanceBuffers(GAME_CONFIG.ringCount, GAME_CONFIG.maxSides),
    []
  );

  const panelGeometry = useMemo(() => {
    const base = new RoundedBoxGeometry(
      1,
      0.06,
      GAME_CONFIG.platformDepth,
      3,
      GAME_CONFIG.platformCornerRadius
    );
    const geom = new THREE.InstancedBufferGeometry();
    geom.index = base.index;
    geom.attributes = base.attributes;

    geom.setAttribute('aLane', buffers.laneAttr);
    geom.setAttribute('aRing', buffers.ringAttr);
    geom.setAttribute('aSides', buffers.sidesAttr);

    geom.instanceCount = GAME_CONFIG.ringCount * GAME_CONFIG.maxSides;
    return geom;
  }, [buffers]);

  const obstacleGeometry = useMemo(() => {
    const base = new RoundedBoxGeometry(
      1,
      0.32,
      0.62,
      3,
      GAME_CONFIG.platformCornerRadius * 0.9
    );
    const geom = new THREE.InstancedBufferGeometry();
    geom.index = base.index;
    geom.attributes = base.attributes;

    geom.setAttribute('aLane', buffers.laneAttr);
    geom.setAttribute('aRing', buffers.ringAttr);
    geom.setAttribute('aSides', buffers.sidesAttr);
    geom.setAttribute('aBlocked', buffers.blockedAttr);
    geom.setAttribute('aPattern', buffers.patternAttr);

    geom.instanceCount = GAME_CONFIG.ringCount * GAME_CONFIG.maxSides;
    return geom;
  }, [buffers]);

  const collectibleGeometry = useMemo(() => {
    const base = new THREE.IcosahedronGeometry(1, 0);
    const geom = new THREE.InstancedBufferGeometry();
    geom.index = base.index;
    geom.attributes = base.attributes;

    geom.setAttribute('aLane', buffers.laneAttr);
    geom.setAttribute('aRing', buffers.ringAttr);
    geom.setAttribute('aSides', buffers.sidesAttr);
    geom.setAttribute('aCollectible', buffers.collectibleAttr);

    geom.instanceCount = GAME_CONFIG.ringCount * GAME_CONFIG.maxSides;
    return geom;
  }, [buffers]);

  const panelMaterial = useMemo(() => makePanelMaterial(), []);
  const obstacleMaterial = useMemo(() => makeObstacleMaterial(), []);
  const collectibleMaterial = useMemo(() => makeCollectibleMaterial(), []);

  useEffect(
    () => () => {
      panelGeometry.dispose();
      obstacleGeometry.dispose();
      collectibleGeometry.dispose();
      panelMaterial.dispose();
      obstacleMaterial.dispose();
      collectibleMaterial.dispose();
    },
    [
      collectibleGeometry,
      collectibleMaterial,
      obstacleGeometry,
      obstacleMaterial,
      panelGeometry,
      panelMaterial,
    ]
  );

  useFrame((state) => {
    const world = worldRef.current;
    if (!world) return;

    if (world.bufferVersion !== lastVersionRef.current) {
      syncInstanceBuffers(world, buffers);
      lastVersionRef.current = world.bufferVersion;
    }

    panelMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    panelMaterial.uniforms.uScroll.value = world.scroll;
    panelMaterial.uniforms.uSpeed.value = world.speed;
    panelMaterial.uniforms.uPulse.value = world.fxPulse;
    panelMaterial.uniforms.uCombo.value = world.combo;
    panelMaterial.uniforms.uVariant.value = tileVariantToFloat(tileVariant);

    obstacleMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    obstacleMaterial.uniforms.uScroll.value = world.scroll;
    obstacleMaterial.uniforms.uPulse.value = world.fxPulse;
    obstacleMaterial.uniforms.uDanger.value = world.hitFlash;

    collectibleMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    collectibleMaterial.uniforms.uScroll.value = world.scroll;
    collectibleMaterial.uniforms.uPulse.value = world.fxPulse;
  });

  return (
    <>
      <mesh geometry={panelGeometry} material={panelMaterial} frustumCulled={false} />
      <mesh
        geometry={obstacleGeometry}
        material={obstacleMaterial}
        frustumCulled={false}
      />
      <mesh
        geometry={collectibleGeometry}
        material={collectibleMaterial}
        frustumCulled={false}
      />
    </>
  );
}

const createRunnerGeometry = (geometry: OctaRunnerGeometry): THREE.BufferGeometry => {
  switch (geometry) {
    case 'kite':
      return new THREE.ConeGeometry(0.18, 0.5, 4);
    case 'orb':
      return new THREE.SphereGeometry(0.22, 24, 16);
    case 'tetra':
      return new THREE.TetrahedronGeometry(0.25, 0);
    case 'icosa':
      return new THREE.IcosahedronGeometry(0.24, 0);
    case 'dodeca':
      return new THREE.DodecahedronGeometry(0.24, 0);
    case 'diamond':
      return new THREE.OctahedronGeometry(0.24, 1);
    case 'capsule':
      return new THREE.CapsuleGeometry(0.14, 0.34, 8, 12);
    case 'crystal':
      return new THREE.ConeGeometry(0.16, 0.46, 6);
    case 'octa':
    default:
      return new THREE.OctahedronGeometry(0.24, 0);
  }
};

function PlayerAvatar({
  worldRef,
  runnerShape,
}: {
  worldRef: React.MutableRefObject<OctaWorld | null>;
  runnerShape: OctaRunnerShape;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const blurRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  const character = useMemo(() => getRunnerCharacter(runnerShape), [runnerShape]);

  const geometry = useMemo<THREE.BufferGeometry>(() => {
    return createRunnerGeometry(character.geometry);
  }, [character.geometry]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const world = worldRef.current;
    const group = groupRef.current;
    const mesh = meshRef.current;
    const blurMesh = blurRef.current;
    const haloMesh = haloRef.current;
    if (!world || !group || !mesh || !blurMesh || !haloMesh) return;

    const angle = getPlayerAngle(world);
    const radius = world.tunnelRadius - 0.7;

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    group.position.x = damp(group.position.x, x, 22, delta);
    group.position.y = damp(group.position.y, y, 22, delta);
    group.position.z = damp(group.position.z, 0.62, 18, delta);

    group.lookAt(0, 0, -2);
    group.rotateZ(Math.PI * 0.5 + world.laneVelocity * 0.06);

    mesh.rotation.y += delta * (1.2 + world.speed * 0.02);
    mesh.rotation.x += delta * (0.8 + world.combo * 0.01);

    const material = mesh.material as THREE.MeshPhysicalMaterial;
    material.emissiveIntensity = 0.42 + world.fxPulse * 0.85 + world.combo * 0.015;
    material.color.set(character.color);
    material.emissive.set(character.emissive);

    const blurIntensity = clamp(world.switchBlur, 0, 1.2);
    const blurMaterial = blurMesh.material as THREE.MeshBasicMaterial;
    blurMaterial.opacity = blurIntensity * 0.44;
    blurMaterial.color.set(character.accent);
    blurMesh.scale.set(
      1 + blurIntensity * 2.4,
      1 + blurIntensity * 0.42,
      1 + blurIntensity * 0.15
    );
    blurMesh.rotation.copy(mesh.rotation);
    haloMesh.scale.setScalar(1 + world.fxPulse * 0.15 + blurIntensity * 0.2);
    haloMesh.rotation.z -= delta * (1.1 + world.speed * 0.015);
    const haloMaterial = haloMesh.material as THREE.MeshBasicMaterial;
    haloMaterial.color.set(character.accent);
    haloMaterial.opacity = 0.52 + world.fxPulse * 0.26;

    if (character.geometry === 'kite' || character.geometry === 'crystal') {
      mesh.rotation.z = state.clock.elapsedTime * 1.6;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={geometry} castShadow>
        <meshPhysicalMaterial
          color={character.color}
          emissive={character.emissive}
          roughness={0.18}
          metalness={0.6}
          clearcoat={1}
          clearcoatRoughness={0.08}
          reflectivity={1}
          transmission={0.08}
          thickness={0.6}
        />
      </mesh>
      <mesh ref={blurRef} geometry={geometry}>
        <meshBasicMaterial
          color="#8de7ff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.018, 10, 52]} />
        <meshBasicMaterial
          color={character.accent}
          transparent
          opacity={0.54}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
        <torusGeometry args={[0.34, 0.022, 12, 42]} />
        <meshBasicMaterial color={character.accent} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function CentralSpine({ worldRef }: { worldRef: React.MutableRefObject<OctaWorld | null> }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const world = worldRef.current;
    const group = groupRef.current;
    if (!world || !group) return;

    group.rotation.z += delta * (0.25 + world.speed * 0.006);
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -32]}>
        <cylinderGeometry args={[0.12, 0.12, 90, 8, 1, true]} />
        <meshBasicMaterial color="#1dc8ff" transparent opacity={0.22} wireframe />
      </mesh>
      <mesh position={[0, 0, -20]}>
        <torusGeometry args={[0.52, 0.02, 12, 64]} />
        <meshBasicMaterial color="#8de8ff" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, 0, -44]}>
        <torusGeometry args={[0.7, 0.018, 10, 64]} />
        <meshBasicMaterial color="#6ab1ff" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

function CameraRig({ worldRef }: { worldRef: React.MutableRefObject<OctaWorld | null> }) {
  const { camera } = useThree();
  const perspectiveCamera = camera as THREE.PerspectiveCamera;
  const targetPos = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    if (typeof perspectiveCamera.fov !== 'number') return;

    const world = worldRef.current;
    const runtime = useOctaRuntimeStore.getState();

    if (!world) {
      const t = state.clock.elapsedTime;
      targetPos.current.set(Math.cos(t * 0.35) * 6, Math.sin(t * 0.42) * 3, 10);
      lookAt.current.set(0, 0, -8);
      perspectiveCamera.position.lerp(targetPos.current, 1 - Math.exp(-2.8 * delta));
      perspectiveCamera.lookAt(lookAt.current);
      perspectiveCamera.fov = damp(perspectiveCamera.fov, 62, 3.2, delta);
      perspectiveCamera.updateProjectionMatrix();
      return;
    }

    const angle = getPlayerAngle(world);
    const playerRadius = world.tunnelRadius - 0.7;
    const px = Math.cos(angle) * playerRadius;
    const py = Math.sin(angle) * playerRadius;

    if (runtime.cameraMode === 'firstPerson') {
      targetPos.current.set(px * 0.99, py * 0.99, 1.25);
      lookAt.current.set(px * 0.98, py * 0.98, -14);
    } else if (runtime.cameraMode === 'topDown') {
      targetPos.current.set(px * 0.22, py * 0.22, 14);
      lookAt.current.set(0, 0, -9);
    } else {
      targetPos.current.set(px * 0.52, py * 0.52, 6.2);
      lookAt.current.set(px * 0.8, py * 0.8, -9.5);
    }

    perspectiveCamera.position.lerp(targetPos.current, 1 - Math.exp(-7.4 * delta));
    perspectiveCamera.lookAt(lookAt.current);

    const lean = clamp(world.laneVelocity * 0.026, -0.22, 0.22);
    perspectiveCamera.rotateZ(lean);

    const targetFov =
      runtime.cameraMode === 'topDown'
        ? 48
        : 62 + world.speed * 0.42 + world.fxPulse * 8;
    perspectiveCamera.fov = damp(perspectiveCamera.fov, targetFov, 5.4, delta);
    perspectiveCamera.updateProjectionMatrix();
  });

  return null;
}

function OctaPostFX({ fxLevel }: { fxLevel: OctaFxLevel }) {
  const bloomRef = useRef<any>(null);
  const chromaRef = useRef<any>(null);
  const chromaOffset = useMemo(() => new THREE.Vector2(0.0004, 0.00025), []);

  useFrame((_, delta) => {
    const runtime = useOctaRuntimeStore.getState();
    const fxScale = fxLevel === 0 ? 0.45 : fxLevel === 1 ? 0.78 : 1.08;

    if (bloomRef.current) {
      const target =
        (0.16 +
          runtime.combo * 0.013 +
          runtime.fxPulse * 0.88 +
          runtime.hitFlash * 0.42 +
          runtime.switchBlur * 0.5) *
        fxScale;
      bloomRef.current.intensity = damp(
        bloomRef.current.intensity ?? target,
        target,
        8,
        delta
      );
    }

    chromaOffset.x =
      (0.00012 + runtime.hitFlash * 0.002 + runtime.switchBlur * 0.0014) * fxScale;
    chromaOffset.y =
      (0.00008 + runtime.hitFlash * 0.0014 + runtime.switchBlur * 0.001) * fxScale;

    if (chromaRef.current?.offset) {
      chromaRef.current.offset.copy(chromaOffset);
    }
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <SMAA />
      <Bloom
        ref={bloomRef}
        intensity={fxLevel === 0 ? 0.35 : fxLevel === 1 ? 0.6 : 0.85}
        luminanceThreshold={0.24}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      <ChromaticAberration
        ref={chromaRef}
        offset={chromaOffset}
        radialModulation
        modulationOffset={0.3}
      />
      <Vignette eskil={false} offset={0.14} darkness={0.65} />
      <Noise premultiply opacity={fxLevel === 0 ? 0.012 : fxLevel === 1 ? 0.02 : 0.028} />
    </EffectComposer>
  );
}

export default function OctaSurge() {
  const snap = useSnapshot(octaSurgeState);
  const ui = useGameUIState();

  const worldRef = useRef<OctaWorld | null>(null);
  const stepperRef = useRef(createFixedStepper(GAME_CONFIG.fixedStep));
  const phaseRef = useRef(snap.phase);
  const pausedRef = useRef(ui.paused);
  const autoTurnClockRef = useRef(0);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    octaSurgeState.load();
  }, []);

  useEffect(() => {
    phaseRef.current = snap.phase;
  }, [snap.phase]);

  useEffect(() => {
    pausedRef.current = ui.paused;
  }, [ui.paused]);

  useEffect(() => {
    useOctaRuntimeStore.setState({ cameraMode: snap.cameraMode });
  }, [snap.cameraMode]);

  useEffect(() => {
    if (snap.phase === 'playing') {
      const queuedReplay = octaSurgeState.consumeReplayPlayback();
      const world = createWorld({
        seed: queuedReplay?.seed ?? snap.worldSeed,
        mode: queuedReplay?.mode ?? snap.mode,
        replayInputs: queuedReplay?.inputs ?? null,
        playback: !!queuedReplay,
      });
      worldRef.current = world;
      autoTurnClockRef.current = 0;
      return;
    }

    if (snap.phase === 'menu') {
      worldRef.current = createWorld({
        seed: snap.worldSeed,
        mode: snap.mode,
        preview: true,
      });
      autoTurnClockRef.current = 0;
    }
  }, [snap.mode, snap.phase, snap.worldSeed]);

  useEffect(() => {
    const queueTurn = (dir: -1 | 1, burst = 1) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      const world = worldRef.current;
      if (!world) return;
      if (world.playbackQueue) return;
      for (let i = 0; i < burst; i += 1) {
        enqueueTurn(world, dir, true);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (
        key === 'arrowleft' ||
        key === 'arrowright' ||
        key === 'a' ||
        key === 'd' ||
        key === 'w' ||
        key === 'arrowup' ||
        key === ' '
      ) {
        event.preventDefault();
      }

      if (key === 'arrowleft' || key === 'a') {
        queueTurn(-1);
      } else if (key === 'arrowright' || key === 'd') {
        queueTurn(1);
      } else if (key === 'w' || key === 'arrowup' || key === ' ') {
        queueTurn(1, 2);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (phaseRef.current !== 'playing' || pausedRef.current) return;
      const dir = event.clientX < window.innerWidth * 0.5 ? -1 : 1;
      queueTurn(dir);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  useFrame((_, delta) => {
    const world = worldRef.current;
    if (!world) return;

    const running = phaseRef.current === 'playing' && !pausedRef.current;

    if (running) {
      stepperRef.current(delta, (dt) => {
        const outcome = stepWorld(world, dt);
        if (outcome.died) {
          const score = computeScore(world);
          const replay = buildReplay(world, {
            score,
            mode: snap.mode,
            cameraMode: snap.cameraMode,
            tileVariant: snap.tileVariant,
            runnerShape: snap.runnerShape,
            fxLevel: snap.fxLevel,
          });
          octaSurgeState.finishRun({
            score,
            distance: world.distance,
            bestCombo: world.bestCombo,
            nearMisses: world.nearMisses,
            collectibles: world.collectibles,
            replay,
          });
        }
      });
    } else if (phaseRef.current === 'menu') {
      autoTurnClockRef.current += delta;
      if (autoTurnClockRef.current >= 0.45) {
        autoTurnClockRef.current = 0;
        const dir = world.rng() < 0.5 ? -1 : 1;
        enqueueTurn(world, dir, false);
      }
      stepperRef.current(delta * 0.82, (dt) => {
        stepWorld(world, dt);
      });
    } else {
      stepperRef.current(delta * 0.22, (dt) => {
        stepWorld(world, dt);
      });
    }

    const score = computeScore(world);
    world.hudCommit += delta;
    if (phaseRef.current === 'playing' && world.hudCommit >= 0.08) {
      world.hudCommit = 0;
      octaSurgeState.setRunMetrics(
        score,
        world.distance,
        world.combo,
        world.nearMisses,
        world.collectibles
      );
    }

    const pattern = getPatternName(world.lastPatternIndex);
    const patternLabel = PATTERN_LABELS[pattern] ?? OBSTACLE_PATTERNS[0];

    useOctaRuntimeStore.setState({
      laneFloat: world.laneFloat,
      laneIndex: world.lane,
      sides: world.visualSides,
      speed: world.speed,
      combo: world.combo,
      score,
      collectibles: world.collectibles,
      speedTier: world.speedTier,
      patternLabel,
      fxPulse: world.fxPulse,
      hitFlash: world.hitFlash,
      switchBlur: world.switchBlur,
    });
  });

  const modePreset = MODE_SETTINGS[snap.mode];
  const fogFar = 74 + modePreset.baseSpeed * 1.2;

  return (
    <>
      <color attach="background" args={['#01040c']} />
      <fog attach="fog" args={['#01040c', 12, fogFar]} />

      <ambientLight intensity={0.18} />
      <pointLight position={[0, 0, 7]} intensity={1.2} color="#8de7ff" />
      <pointLight position={[0, 0, -26]} intensity={0.95} color="#4ec0ff" />
      <directionalLight position={[3, -3, 9]} intensity={0.35} color="#ffd6c3" />

      <TunnelRenderer worldRef={worldRef} tileVariant={snap.tileVariant} />
      <PlayerAvatar worldRef={worldRef} runnerShape={snap.runnerShape} />
      <CentralSpine worldRef={worldRef} />
      <CameraRig worldRef={worldRef} />
      <OctaPostFX fxLevel={snap.fxLevel} />
    </>
  );
}
