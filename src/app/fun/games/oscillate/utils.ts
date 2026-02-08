// @ts-nocheck
import * as React from 'react';
import * as THREE from 'three';
import type { OscillateSegment, OscillateLevel, RunStatus } from './types';
import { clamp } from './helpers';

export function useOnMount(fn: () => void) {
  React.useEffect(() => {
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function segmentBasis(seg: OscillateSegment) {
  const fwd =
    seg.axis === 'x'
      ? new THREE.Vector3(seg.dir, 0, 0)
      : new THREE.Vector3(0, 0, seg.dir);
  const lat =
    seg.axis === 'x'
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(1, 0, 0);
  return { fwd, lat };
}

export function segmentWorldPos(seg: OscillateSegment, s: number, l: number) {
  const { fwd, lat } = segmentBasis(seg);
  return new THREE.Vector3(seg.x, 0, seg.z)
    .addScaledVector(fwd, s)
    .addScaledVector(lat, l);
}

export function ballWorldPos(lvl: OscillateLevel, r: RunStatus) {
  const seg = lvl.segments[clamp(r.seg, 0, lvl.segments.length - 1)];
  return segmentWorldPos(seg, r.s, r.l);
}
