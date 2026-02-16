import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { GAME } from '../constants';
import type { RingData } from '../level/types';
import type { OctaTileVariant } from '../types';
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
  if (variant === 'trailChevron') return 3;
  if (variant === 'gridForge') return 4;
  if (variant === 'diamondTess') return 5;
  if (variant === 'sunkenSteps') return 6;
  return 7;
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
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const lastBaseRef = useRef(Number.NaN);
  const lastVariantRef = useRef<OctaTileVariant>('classic');

  const geometry = useMemo(() => {
    const base = new THREE.BoxGeometry(0.72, 0.1, Math.max(0.42, spacing * 0.82));
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

  useEffect(() => {
    materialRef.current = material;
    return () => {
      material.dispose();
    };
  }, [material]);

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
          hazardAttr.array[ptr] =
            laneMeta && laneMeta.obstacle !== 'none' ? 1 : 0;
          platformAttr.array[ptr] =
            laneMeta && laneMeta.platform !== 'standard' ? 1 : 0;
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
    const mat = materialRef.current;
    if (!mat) return;

    const baseRing = baseRingRef.current;
    const variant = tileVariantRef.current;
    if (baseRing !== lastBaseRef.current || variant !== lastVariantRef.current) {
      applyRingWindow(baseRing);
      lastBaseRef.current = baseRing;
      lastVariantRef.current = variant;
    }

    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uRadius.value = GAME.radius;
    mat.uniforms.uSpacing.value = spacing;
    mat.uniforms.uScroll.value = scrollOffsetRef.current;
    mat.uniforms.uSpeed.value = speedRef.current;
    mat.uniforms.uAudioReactive.value = audioReactiveRef.current;
    mat.uniforms.uCombo.value = comboRef.current;
    mat.uniforms.uVariant.value = variantToFloat(variant);
    mat.uniforms.uStageFlash.value = stageFlashRef.current;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
