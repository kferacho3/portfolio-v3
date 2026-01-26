import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { COLLECTION_RADIUS } from '../constants';
import type { ClusterData, ShapeType } from '../types';
import GameShape from './GameShape';

interface ShapeClusterProps {
  cluster: ClusterData;
  playerPosition: THREE.Vector3;
  onCollect: (clusterId: string, shapeId: string, shapeType: ShapeType) => void;
}

const ShapeCluster: React.FC<ShapeClusterProps> = ({
  cluster,
  playerPosition,
  onCollect,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const shapeRefs = useRef<Map<string, THREE.Group>>(new Map());

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
    }

    cluster.shapes.forEach((shape) => {
      if (shape.collected) return;

      const shapeRef = shapeRefs.current.get(shape.id);
      if (!shapeRef) return;

      const worldPos = new THREE.Vector3();
      shapeRef.getWorldPosition(worldPos);

      if (playerPosition.distanceTo(worldPos) < COLLECTION_RADIUS) {
        onCollect(cluster.id, shape.id, shape.type);
      }
    });
  });

  return (
    <group
      ref={groupRef}
      position={cluster.worldPosition}
      rotation={[0, cluster.rotation, 0]}
    >
      {cluster.shapes.map((shape) =>
        !shape.collected ? (
          <group
            key={shape.id}
            position={shape.localPosition}
            ref={(el) => {
              if (el) shapeRefs.current.set(shape.id, el);
            }}
          >
            <GameShape
              type={shape.type}
              color={shape.color}
              scale={shape.scale}
              materialType={shape.materialType}
              glowColor={shape.color}
            />
          </group>
        ) : null
      )}
    </group>
  );
};

export default ShapeCluster;
