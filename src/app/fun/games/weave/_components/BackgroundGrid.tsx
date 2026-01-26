import React, { useMemo } from 'react';
import * as THREE from 'three';

const BackgroundGrid: React.FC = () => {
  const lines = useMemo(() => {
    const result: THREE.Vector3[][] = [];
    const gridSize = 12;
    const divisions = 12;
    const step = gridSize / divisions;

    for (let i = -divisions / 2; i <= divisions / 2; i++) {
      const pos = i * step;
      result.push([
        new THREE.Vector3(pos, -gridSize / 2, -2),
        new THREE.Vector3(pos, gridSize / 2, -2),
      ]);
      result.push([
        new THREE.Vector3(-gridSize / 2, pos, -2),
        new THREE.Vector3(gridSize / 2, pos, -2),
      ]);
    }
    return result;
  }, []);

  return (
    <>
      {lines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array(pts.flatMap((p) => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#1a1a2e" transparent opacity={0.4} />
        </line>
      ))}
    </>
  );
};

export default BackgroundGrid;
