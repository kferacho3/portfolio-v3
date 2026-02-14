import React from 'react';
import * as THREE from 'three';
import { Alien } from '../../models/Alien';

const AlienObstacle = React.forwardRef<THREE.Group, { color: string }>(
  (props, ref) => {
    return (
      <group ref={ref}>
        <mesh position={[0, -0.47, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.58, 24]} />
          <meshBasicMaterial
            color="#ff5070"
            transparent
            opacity={0.38}
            depthWrite={false}
          />
        </mesh>
        <Alien color={props.color} />
      </group>
    );
  }
);

AlienObstacle.displayName = 'AlienObstacle';

export default AlienObstacle;
