'use client';

import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';

import { CHARACTERS } from '../constants';

export function PrismCharacter({
  characterId,
  scale = 1,
}: {
  characterId: string;
  scale?: number;
}) {
  const def = useMemo(
    () => CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0],
    [characterId]
  );

  const matProps = {
    color: def.color,
    roughness: def.roughness ?? 0.35,
    metalness: def.metalness ?? 0.12,
    emissive: def.emissive ?? '#000000',
    emissiveIntensity: def.emissive ? 0.65 : 0,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1,
  };

  const s = (def.scale ?? 1) * scale;

  // A small, slightly rounded highlight edge looks great with the arcade post FX.
  switch (def.kind) {
    case 'box':
      return (
        <RoundedBox
          args={[0.74 * s, 0.74 * s, 0.74 * s]}
          radius={0.08 * s}
          smoothness={4}
        >
          <meshStandardMaterial {...matProps} />
        </RoundedBox>
      );

    case 'sphere':
      return (
        <mesh scale={s}>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'tetra':
      return (
        <mesh scale={s}>
          <tetrahedronGeometry args={[0.52, 0]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'octa':
      return (
        <mesh scale={s}>
          <octahedronGeometry args={[0.52, 0]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'icosa':
      return (
        <mesh scale={s}>
          <icosahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'dodeca':
      return (
        <mesh scale={s}>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'capsule':
      return (
        <mesh scale={s}>
          <capsuleGeometry args={[0.32, 0.5, 8, 16]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'cone':
      return (
        <mesh scale={s}>
          <coneGeometry args={[0.45, 0.86, 20]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'cylinder':
      return (
        <mesh scale={s}>
          <cylinderGeometry args={[0.42, 0.42, 0.72, 20]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'triPrism':
      return (
        <mesh scale={s}>
          <cylinderGeometry args={[0.48, 0.48, 0.72, 3]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'torus':
      return (
        <mesh scale={s}>
          <torusGeometry args={[0.38, 0.16, 14, 28]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'torusKnot':
      return (
        <mesh scale={s}>
          <torusKnotGeometry args={[0.28, 0.11, 80, 12]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );

    case 'robot':
      return (
        <group scale={s}>
          <RoundedBox args={[0.62, 0.62, 0.62]} radius={0.08} smoothness={4}>
            <meshStandardMaterial {...matProps} />
          </RoundedBox>
          <mesh position={[0, 0.58, 0]}>
            <boxGeometry args={[0.42, 0.32, 0.42]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0, 0.64, 0.23]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial
              emissive={'#FFFFFF'}
              emissiveIntensity={0.85}
              color={'#111111'}
            />
          </mesh>
        </group>
      );

    case 'ufo':
      return (
        <group scale={s}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.48, 0.78, 0.18, 28]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <sphereGeometry args={[0.26, 18, 18]} />
            <meshStandardMaterial {...matProps} transparent opacity={0.9} />
          </mesh>
        </group>
      );

    case 'rocket':
      return (
        <group scale={s}>
          <mesh position={[0, 0.0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.62, 18]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0, 0.46, 0]}>
            <coneGeometry args={[0.24, 0.36, 18]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <coneGeometry args={[0.18, 0.22, 12]} />
            <meshStandardMaterial
              emissive={'#22D3EE'}
              emissiveIntensity={0.8}
              color={'#0B1020'}
            />
          </mesh>
        </group>
      );

    default:
      return (
        <mesh scale={s}>
          <boxGeometry args={[0.74, 0.74, 0.74]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      );
  }
}
