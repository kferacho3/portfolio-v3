import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';

const BasketCollector: React.FC<{
  x: number;
  pulseIntensity: number;
  isHurt: boolean;
  hasShield: boolean;
  hasMagnet: boolean;
}> = ({ x, pulseIntensity, isHurt, hasShield, hasMagnet }) => {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    groupRef.current.position.y = Math.sin(timeRef.current * 2) * 0.05;
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      x,
      0.25
    );

    if (isHurt) {
      groupRef.current.position.x += Math.sin(timeRef.current * 40) * 0.15;
    }
  });

  const baseColor = isHurt
    ? '#FF4444'
    : hasShield
      ? '#4169E1'
      : hasMagnet
        ? '#FF4500'
        : '#3B82F6';
  const glowColor = isHurt
    ? '#FF0000'
    : hasShield
      ? '#1E90FF'
      : hasMagnet
        ? '#FF6B00'
        : '#60A5FA';

  return (
    <group ref={groupRef} position={[x, 0, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[1.2, 0.9, 1.1, 20, 1, true]} />
        <meshPhysicalMaterial
          color={baseColor}
          metalness={0.3}
          roughness={0.4}
          side={THREE.DoubleSide}
          emissive={glowColor}
          emissiveIntensity={0.15 + pulseIntensity * 0.3}
        />
      </mesh>

      <mesh position={[0, -0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 20]} />
        <meshPhysicalMaterial
          color={baseColor}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.2, 0.08, 8, 24]} />
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0.6}
          roughness={0.2}
          emissive={glowColor}
          emissiveIntensity={0.3 + pulseIntensity * 0.5}
        />
      </mesh>

      {hasShield && (
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[1.8, 16, 16]} />
          <meshBasicMaterial
            color="#4169E1"
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {hasMagnet && (
        <>
          <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2, 0.05, 8, 32]} />
            <meshBasicMaterial color="#FF4500" transparent opacity={0.4} />
          </mesh>
          <mesh position={[0, 1.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.5, 0.04, 8, 32]} />
            <meshBasicMaterial color="#FF4500" transparent opacity={0.25} />
          </mesh>
        </>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.29, 0]}>
        <ringGeometry args={[1.0, 1.5, 32]} />
        <meshBasicMaterial
          color={isHurt ? '#FF4444' : glowColor}
          transparent
          opacity={0.2 + pulseIntensity * 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight
        color={glowColor}
        intensity={0.8 + pulseIntensity * 1.5}
        distance={5}
        position={[0, 0.6, 0]}
      />
    </group>
  );
};

export default BasketCollector;
