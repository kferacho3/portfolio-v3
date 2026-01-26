'use client';

import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export const PlayerTrail: React.FC<{
  target: React.RefObject<THREE.Object3D>;
  color: string;
}> = ({ target, color }) => {
  const geomRef = useRef<THREE.BufferGeometry | null>(null);
  const attrRef = useRef<THREE.BufferAttribute | null>(null);
  const ring = useMemo(() => new Float32Array(60 * 3), []);
  const ordered = useMemo(() => new Float32Array(60 * 3), []);
  const countRef = useRef(0);
  const headRef = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!geomRef.current) return;
    const attr = new THREE.BufferAttribute(ordered, 3);
    attrRef.current = attr;
    geomRef.current.setAttribute('position', attr);
    geomRef.current.setDrawRange(0, 0);
  }, [ordered]);

  useFrame(() => {
    const obj = target.current;
    const geom = geomRef.current;
    const attr = attrRef.current;
    if (!obj || !geom || !attr) return;
    obj.getWorldPosition(tmp);

    const head = headRef.current;
    ring[head * 3 + 0] = tmp.x;
    ring[head * 3 + 1] = tmp.y + 0.15;
    ring[head * 3 + 2] = tmp.z;

    headRef.current = (head + 1) % 60;
    countRef.current = Math.min(60, countRef.current + 1);

    // Reorder into a continuous strip (oldest -> newest)
    const n = countRef.current;
    const start = headRef.current;
    if (n <= 0) {
      geom.setDrawRange(0, 0);
      return;
    }
    for (let i = 0; i < n; i++) {
      const src = ((start + i) % 60) * 3;
      const dst = i * 3;
      ordered[dst] = ring[src];
      ordered[dst + 1] = ring[src + 1];
      ordered[dst + 2] = ring[src + 2];
    }

    // Fill remaining points (prevents stale segments when drawRange grows/shrinks)
    const last = (n - 1) * 3;
    for (let i = n; i < 60; i++) {
      const dst = i * 3;
      ordered[dst] = ordered[last];
      ordered[dst + 1] = ordered[last + 1];
      ordered[dst + 2] = ordered[last + 2];
    }

    geom.setDrawRange(0, n);
    attr.needsUpdate = true;
  });

  return (
    <line frustumCulled={false}>
      <bufferGeometry ref={geomRef} />
      <lineBasicMaterial color={color} transparent opacity={0.45} />
    </line>
  );
};
