import React from 'react';
import * as THREE from 'three';
import { Alien } from '../../models/Alien';

const AlienObstacle = React.forwardRef<THREE.Group, { color: string }>(
  (props, ref) => {
    return (
      <group ref={ref}>
        <Alien color={props.color} />
      </group>
    );
  }
);

AlienObstacle.displayName = 'AlienObstacle';

export default AlienObstacle;
