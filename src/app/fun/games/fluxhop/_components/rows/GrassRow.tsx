import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  BOOST_COLOR,
  GRASS_ACCENT,
  GRASS_COLORS,
  GROUND_Y,
  NEON_CYAN,
  NEON_GREEN,
  ROW_WIDTH,
  TILE_SIZE,
} from '../../constants';
import type { GrassRowData, TreeData } from '../../types';

const Trees: React.FC<{ trees: TreeData[] }> = ({ trees }) => {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!trunkRef.current || !crownRef.current) return;
    trunkRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    crownRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    trees.forEach((tree, index) => {
      dummy.position.set(tree.tileIndex * TILE_SIZE, 0.25, 0);
      dummy.scale.set(0.5, 1, 0.5);
      dummy.updateMatrix();
      trunkRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(tree.tileIndex * TILE_SIZE, 0.9, 0);
      const scaleMultiplier =
        tree.type === 'crystal' ? 0.6 : tree.type === 'pine' ? 0.7 : 1;
      dummy.scale.set(scaleMultiplier, tree.height, scaleMultiplier);
      dummy.updateMatrix();
      crownRef.current?.setMatrixAt(index, dummy.matrix);
    });

    trunkRef.current.instanceMatrix.needsUpdate = true;
    crownRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy, trees]);

  if (!trees.length) return null;

  const crownColor = trees[0]?.type === 'crystal' ? NEON_CYAN : NEON_GREEN;

  return (
    <>
      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, trees.length]}
        castShadow
      >
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshStandardMaterial color="#2a1a0a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={crownRef}
        args={[undefined, undefined, trees.length]}
        castShadow
      >
        <boxGeometry args={[0.7, 0.6, 0.7]} />
        <meshStandardMaterial
          color={crownColor}
          emissive={crownColor}
          emissiveIntensity={0.3}
          roughness={0.5}
        />
      </instancedMesh>
    </>
  );
};

const BoostPad: React.FC<{ tileIndex: number }> = ({ tileIndex }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const pulse = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 4);
      (
        meshRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = pulse;
    }
  });

  return (
    <mesh ref={meshRef} position={[tileIndex * TILE_SIZE, 0.08, 0]} castShadow>
      <boxGeometry args={[TILE_SIZE * 0.6, 0.1, TILE_SIZE * 0.6]} />
      <meshStandardMaterial
        color={BOOST_COLOR}
        emissive={BOOST_COLOR}
        emissiveIntensity={0.8}
        roughness={0.3}
        metalness={0.5}
      />
    </mesh>
  );
};

const GrassRow: React.FC<{ rowIndex: number; data: GrassRowData }> = ({
  rowIndex,
  data,
}) => {
  const colorIndex = Math.abs(rowIndex) % GRASS_COLORS.length;
  const color = GRASS_COLORS[colorIndex];

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.01, TILE_SIZE * 0.45]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.02, 0.02]} />
        <meshStandardMaterial
          color={GRASS_ACCENT}
          emissive={GRASS_ACCENT}
          emissiveIntensity={0.2}
          transparent
          opacity={0.4}
        />
      </mesh>
      <Trees trees={data.trees} />
      {typeof data.boostTile === 'number' && (
        <BoostPad tileIndex={data.boostTile} />
      )}
    </group>
  );
};

export default GrassRow;
