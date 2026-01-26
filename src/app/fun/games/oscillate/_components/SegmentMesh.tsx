// @ts-nocheck
'use client';

import * as React from 'react';
import * as THREE from 'three';
import type { OscillateLevel } from '../types';
import { WallBar } from './WallBar';
import { GateVisual } from './GateVisual';
import { GemMesh } from './GemMesh';

export const SegmentMesh: React.FC<{
  segIndex: number;
  lvlRef: React.MutableRefObject<OscillateLevel>;
  mats: Record<string, THREE.Material>;
  geoms: {
    unitBox: THREE.BoxGeometry;
    gem: THREE.OctahedronGeometry;
    gate: THREE.BoxGeometry;
  };
  CONST: { BASE_H: number; DECK_H: number; WALL_H: number; WALL_T: number };
}> = ({ segIndex, lvlRef, mats, geoms, CONST }) => {
  const lvl = lvlRef.current;
  const seg = lvl.segments[segIndex];
  const isLast = segIndex >= lvl.segments.length - 1;

  const baseMat = segIndex % 2 === 0 ? mats.baseA : mats.baseB;
  const width = seg.halfWidth * 2;
  const openW = lvl.bridgeWidth;
  const wallY = CONST.BASE_H + CONST.WALL_H * 0.5;
  const deckY = CONST.BASE_H + CONST.DECK_H * 0.5;
  const gemY = CONST.BASE_H + CONST.DECK_H + 0.38;

  // Static placement (axis-aligned, so no tricky rotations).
  const baseCenter = React.useMemo(() => {
    if (seg.axis === 'x') {
      return new THREE.Vector3(seg.x + seg.dir * seg.length * 0.5, 0, seg.z);
    }
    return new THREE.Vector3(seg.x, 0, seg.z + seg.dir * seg.length * 0.5);
  }, [seg.axis, seg.dir, seg.length, seg.x, seg.z]);

  const baseScale = React.useMemo(() => {
    if (seg.axis === 'x')
      return new THREE.Vector3(
        seg.length,
        CONST.BASE_H,
        width + CONST.WALL_T * 2
      );
    return new THREE.Vector3(
      width + CONST.WALL_T * 2,
      CONST.BASE_H,
      seg.length
    );
  }, [seg.axis, seg.length, width, CONST.BASE_H, CONST.WALL_T]);

  const deckScale = React.useMemo(() => {
    if (seg.axis === 'x')
      return new THREE.Vector3(seg.length, CONST.DECK_H, width);
    return new THREE.Vector3(width, CONST.DECK_H, seg.length);
  }, [seg.axis, seg.length, width, CONST.DECK_H]);

  // Walls are dynamic (can break), so we render them as components.
  return (
    <group>
      {/* base */}
      <mesh
        geometry={geoms.unitBox}
        material={baseMat as any}
        position={[baseCenter.x, CONST.BASE_H * 0.5, baseCenter.z]}
        scale={baseScale}
        receiveShadow
      />
      {/* deck */}
      <mesh
        geometry={geoms.unitBox}
        material={mats.deck as any}
        position={[baseCenter.x, deckY, baseCenter.z]}
        scale={deckScale}
        receiveShadow
      />

      {/* walls */}
      <WallBar
        side={-1}
        segIndex={segIndex}
        lvlRef={lvlRef}
        mats={mats}
        geoms={geoms}
        CONST={CONST}
      />
      <WallBar
        side={1}
        segIndex={segIndex}
        lvlRef={lvlRef}
        mats={mats}
        geoms={geoms}
        CONST={CONST}
      />

      {/* gate at end (visual + target glow) */}
      {!isLast && (
        <GateVisual
          segIndex={segIndex}
          lvlRef={lvlRef}
          mats={mats}
          geoms={geoms}
          CONST={CONST}
          openW={openW}
        />
      )}

      {/* gems */}
      {seg.gems.map((g, gi) => (
        <GemMesh
          key={g.id}
          segIndex={segIndex}
          gemIndex={gi}
          lvlRef={lvlRef}
          mats={mats}
          geoms={geoms}
          y={gemY}
        />
      ))}
    </group>
  );
};
