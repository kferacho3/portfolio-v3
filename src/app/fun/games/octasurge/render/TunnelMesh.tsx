import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { GAME } from '../constants';
import type { RingData } from '../level/types';
import type {
  OctaObstacleType,
  OctaPlatformType,
  OctaTileVariant,
} from '../types';
import { createTunnelMaterial } from '../shaders/tunnelMaterial';

type Props = {
  ringCount: number;
  spacing: number;
  maxSides?: number;
  getRing: (index: number) => RingData;
  baseRingRef: React.MutableRefObject<number>;
  scrollOffsetRef: React.MutableRefObject<number>;
  speedRef: React.MutableRefObject<number>;
  audioReactiveRef: React.MutableRefObject<number>;
  comboRef: React.MutableRefObject<number>;
  stageFlashRef: React.MutableRefObject<number>;
  tileVariantRef: React.MutableRefObject<OctaTileVariant>;
};

const variantToFloat = (variant: OctaTileVariant) => {
  if (variant === 'classic') return 0;
  if (variant === 'alloy') return 1;
  if (variant === 'prismatic') return 2;
  if (variant === 'gridForge') return 3;
  if (variant === 'diamondTess') return 4;
  if (variant === 'sunkenSteps') return 5;
  return 6;
};

const obstacleToFloat = (obstacle: OctaObstacleType) => {
  if (obstacle === 'none') return 0;
  if (obstacle === 'arc_blade') return 1 / 16;
  if (obstacle === 'shutter_gate') return 2 / 16;
  if (obstacle === 'pulse_laser') return 3 / 16;
  if (obstacle === 'gravity_orb') return 4 / 16;
  if (obstacle === 'prism_mine') return 5 / 16;
  if (obstacle === 'flame_jet') return 6 / 16;
  if (obstacle === 'phase_portal') return 7 / 16;
  if (obstacle === 'trap_split') return 8 / 16;
  if (obstacle === 'magnetron') return 9 / 16;
  if (obstacle === 'spike_fan') return 10 / 16;
  if (obstacle === 'thunder_column') return 11 / 16;
  if (obstacle === 'vortex_saw') return 12 / 16;
  if (obstacle === 'ion_barrier') return 13 / 16;
  if (obstacle === 'void_serpent') return 14 / 16;
  if (obstacle === 'ember_wave') return 15 / 16;
  return 1;
};

const platformToFloat = (platform: OctaPlatformType) => {
  if (platform === 'smooth_lane') return 0;
  if (platform === 'drift_boost') return 1 / 12;
  if (platform === 'reverse_drift') return 2 / 12;
  if (platform === 'pulse_pad') return 3 / 12;
  if (platform === 'spring_pad') return 4 / 12;
  if (platform === 'warp_gate') return 5 / 12;
  if (platform === 'phase_lane') return 6 / 12;
  if (platform === 'resin_lane') return 7 / 12;
  if (platform === 'crusher_lane') return 8 / 12;
  if (platform === 'overdrive_strip') return 9 / 12;
  if (platform === 'split_rail') return 10 / 12;
  return 11 / 12;
};

export function TunnelMesh({
  ringCount,
  spacing,
  maxSides = GAME.maxSides,
  getRing,
  baseRingRef,
  scrollOffsetRef,
  speedRef,
  audioReactiveRef,
  comboRef,
  stageFlashRef,
  tileVariantRef,
}: Props) {
  const lastBaseRef = useRef(Number.NaN);

  const geometry = useMemo(() => {
    const base = new THREE.BoxGeometry(0.74, 0.09, Math.max(0.42, spacing * 0.82));
    const instanced = new THREE.InstancedBufferGeometry();
    instanced.index = base.index;
    instanced.attributes = base.attributes;

    const count = ringCount * maxSides;

    const aLane = new Float32Array(count);
    const aRing = new Float32Array(count);
    const aSides = new Float32Array(count);
    const aActive = new Float32Array(count);
    const aStage = new Float32Array(count);
    const aHazard = new Float32Array(count);
    const aPlatform = new Float32Array(count);

    let ptr = 0;
    for (let r = 0; r < ringCount; r += 1) {
      for (let lane = 0; lane < maxSides; lane += 1) {
        aLane[ptr] = lane;
        aRing[ptr] = r;
        aSides[ptr] = maxSides;
        aActive[ptr] = 0;
        aStage[ptr] = 0;
        aHazard[ptr] = 0;
        aPlatform[ptr] = 0;
        ptr += 1;
      }
    }

    instanced.setAttribute('aLane', new THREE.InstancedBufferAttribute(aLane, 1));
    instanced.setAttribute('aRing', new THREE.InstancedBufferAttribute(aRing, 1));
    instanced.setAttribute('aSides', new THREE.InstancedBufferAttribute(aSides, 1));
    instanced.setAttribute('aActive', new THREE.InstancedBufferAttribute(aActive, 1));
    instanced.setAttribute('aStage', new THREE.InstancedBufferAttribute(aStage, 1));
    instanced.setAttribute('aHazard', new THREE.InstancedBufferAttribute(aHazard, 1));
    instanced.setAttribute('aPlatform', new THREE.InstancedBufferAttribute(aPlatform, 1));
    instanced.instanceCount = count;

    return instanced;
  }, [maxSides, ringCount, spacing]);

  const material = useMemo(() => createTunnelMaterial(), []);

  useEffect(() => () => material.dispose(), [material]);

  const applyRingWindow = (baseRing: number) => {
    const activeAttr = geometry.getAttribute('aActive') as THREE.InstancedBufferAttribute;
    const sidesAttr = geometry.getAttribute('aSides') as THREE.InstancedBufferAttribute;
    const stageAttr = geometry.getAttribute('aStage') as THREE.InstancedBufferAttribute;
    const hazardAttr = geometry.getAttribute('aHazard') as THREE.InstancedBufferAttribute;
    const platformAttr = geometry.getAttribute('aPlatform') as THREE.InstancedBufferAttribute;

    let ptr = 0;
    for (let r = 0; r < ringCount; r += 1) {
      const ring = getRing(baseRing + r);
      for (let lane = 0; lane < maxSides; lane += 1) {
        if (lane < ring.sides) {
          const bit = 1 << lane;
          const solid = (ring.solidMask & bit) !== 0;
          const laneMeta = ring.laneMeta[lane];

          activeAttr.array[ptr] = solid ? 1 : 0;
          sidesAttr.array[ptr] = ring.sides;
          stageAttr.array[ptr] = ring.stageId;
          hazardAttr.array[ptr] = laneMeta ? obstacleToFloat(laneMeta.obstacle) : 0;
          platformAttr.array[ptr] = laneMeta
            ? platformToFloat(laneMeta.platform)
            : 0;
        } else {
          activeAttr.array[ptr] = 0;
          sidesAttr.array[ptr] = ring.sides;
          stageAttr.array[ptr] = ring.stageId;
          hazardAttr.array[ptr] = 0;
          platformAttr.array[ptr] = 0;
        }
        ptr += 1;
      }
    }

    activeAttr.needsUpdate = true;
    sidesAttr.needsUpdate = true;
    stageAttr.needsUpdate = true;
    hazardAttr.needsUpdate = true;
    platformAttr.needsUpdate = true;
  };

  useFrame((state) => {
    const baseRing = baseRingRef.current;
    if (baseRing !== lastBaseRef.current) {
      applyRingWindow(baseRing);
      lastBaseRef.current = baseRing;
    }

    const variant = tileVariantRef.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uRadius.value = GAME.radius;
    material.uniforms.uSpacing.value = spacing;
    material.uniforms.uScroll.value = scrollOffsetRef.current;
    material.uniforms.uSpeed.value = speedRef.current;
    material.uniforms.uAudioReactive.value = audioReactiveRef.current;
    material.uniforms.uCombo.value = comboRef.current;
    material.uniforms.uVariant.value = variantToFloat(variant);
    material.uniforms.uStageFlash.value = stageFlashRef.current;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
