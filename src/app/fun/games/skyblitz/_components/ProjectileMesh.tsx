import React from 'react';
import * as THREE from 'three';
import { PROJECTILE_RADIUS } from '../constants';

const ProjectileMesh = React.forwardRef<THREE.Mesh>((_, ref) => {
  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[PROJECTILE_RADIUS, 12, 12]} />
      <meshStandardMaterial
        color="yellow"
        emissive="orange"
        emissiveIntensity={2}
        toneMapped={false}
      />
    </mesh>
  );
});

ProjectileMesh.displayName = 'ProjectileMesh';

export default ProjectileMesh;
