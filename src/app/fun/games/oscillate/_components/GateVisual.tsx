'use client';

import * as React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OscillateLevel } from '../types';

export const GateVisual: React.FC<{
  segIndex: number;
  lvlRef: React.MutableRefObject<OscillateLevel>;
  mats: Record<string, THREE.Material>;
  geoms: { unitBox: THREE.BoxGeometry; gate: THREE.BoxGeometry };
  CONST: { BASE_H: number; DECK_H: number };
  openW: number;
}> = ({ segIndex, lvlRef, mats, geoms, CONST, openW }) => {
  const glowRef = React.useRef<THREE.Mesh>(null);
  const leftRef = React.useRef<THREE.Mesh>(null);
  const rightRef = React.useRef<THREE.Mesh>(null);
  const t = React.useRef(0);

  useFrame((_, dt) => {
    const lvl = lvlRef.current;
    const seg = lvl.segments[segIndex];
    if (!seg) return;
    t.current += dt;

    const deckY = CONST.BASE_H + CONST.DECK_H * 0.5;
    const thickness = 0.18;
    const offsetAlong = seg.dir * (thickness * 0.55);

    // opening along lateral axis
    const openStart = seg.bridgeOffset - openW * 0.5;
    const openEnd = seg.bridgeOffset + openW * 0.5;
    const leftLen = Math.max(0, openStart - -seg.halfWidth);
    const rightLen = Math.max(0, seg.halfWidth - openEnd);

    if (seg.axis === 'x') {
      const endX = seg.x + seg.dir * seg.length;
      if (leftRef.current) {
        leftRef.current.visible = leftLen > 0.01;
        leftRef.current.position.set(
          endX + offsetAlong,
          deckY,
          seg.z + (-seg.halfWidth + openStart) * 0.5
        );
        leftRef.current.scale.set(thickness, CONST.DECK_H * 1.05, leftLen);
      }
      if (rightRef.current) {
        rightRef.current.visible = rightLen > 0.01;
        rightRef.current.position.set(
          endX + offsetAlong,
          deckY,
          seg.z + (openEnd + seg.halfWidth) * 0.5
        );
        rightRef.current.scale.set(thickness, CONST.DECK_H * 1.05, rightLen);
      }
      if (glowRef.current) {
        glowRef.current.position.set(
          endX + seg.dir * 0.22,
          deckY + 0.01,
          seg.z + seg.bridgeOffset
        );
        glowRef.current.scale.set(1, 1, openW);
        (glowRef.current.material as THREE.MeshStandardMaterial).opacity =
          0.55 + Math.sin(t.current * 5.2) * 0.15;
      }
    } else {
      const endZ = seg.z + seg.dir * seg.length;
      if (leftRef.current) {
        leftRef.current.visible = leftLen > 0.01;
        leftRef.current.position.set(
          seg.x + (-seg.halfWidth + openStart) * 0.5,
          deckY,
          endZ + offsetAlong
        );
        leftRef.current.scale.set(leftLen, CONST.DECK_H * 1.05, thickness);
      }
      if (rightRef.current) {
        rightRef.current.visible = rightLen > 0.01;
        rightRef.current.position.set(
          seg.x + (openEnd + seg.halfWidth) * 0.5,
          deckY,
          endZ + offsetAlong
        );
        rightRef.current.scale.set(rightLen, CONST.DECK_H * 1.05, thickness);
      }
      if (glowRef.current) {
        glowRef.current.position.set(
          seg.x + seg.bridgeOffset,
          deckY + 0.01,
          endZ + seg.dir * 0.22
        );
        glowRef.current.scale.set(openW, 1, 1);
        (glowRef.current.material as THREE.MeshStandardMaterial).opacity =
          0.55 + Math.sin(t.current * 5.2) * 0.15;
      }
    }
  });

  return (
    <group>
      <mesh
        ref={leftRef}
        geometry={geoms.unitBox}
        material={mats.wall as any}
      />
      <mesh
        ref={rightRef}
        geometry={geoms.unitBox}
        material={mats.wall as any}
      />
      <mesh ref={glowRef} geometry={geoms.gate} material={mats.gate as any} />
    </group>
  );
};
