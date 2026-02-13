'use client';

import React, { forwardRef } from 'react';
import * as THREE from 'three';

type GlassShardProps = {
  maxShards: number;
};

const GlassShard = forwardRef<THREE.InstancedMesh, GlassShardProps>(
  function GlassShard({ maxShards }, ref) {
    return (
      <instancedMesh ref={ref} args={[undefined, undefined, maxShards]} frustumCulled={false}>
        <boxGeometry args={[0.1, 0.08, 0.045]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.76}
          roughness={0.24}
          metalness={0.08}
          toneMapped={false}
        />
      </instancedMesh>
    );
  }
);

export default GlassShard;
