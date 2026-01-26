import { useFrame } from '@react-three/fiber';
import React, { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { FallingItem } from '../types';

const FallingItemVisual: React.FC<{
  item: FallingItem;
  magnetX?: number;
  hasMagnet: boolean;
}> = ({ item, magnetX = 0, hasMagnet }) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const timeRef = useRef(Math.random() * 100);
  const currentX = useRef(item.x);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    groupRef.current.rotation.y += delta * 2.5;
    groupRef.current.rotation.x += delta * 1.2;

    if (
      hasMagnet &&
      !item.config.isDangerous &&
      !item.collected &&
      item.y < 8
    ) {
      const pullStrength = 0.15;
      const targetX = magnetX;
      currentX.current = THREE.MathUtils.lerp(
        currentX.current,
        targetX,
        pullStrength
      );
      groupRef.current.position.x = currentX.current;
    } else {
      currentX.current = item.x;
      groupRef.current.position.x = item.x;
    }

    if (materialRef.current && item.type === 'rareRainbow') {
      const hue = (timeRef.current * 120) % 360;
      materialRef.current.color.setHSL(hue / 360, 0.9, 0.55);
      materialRef.current.emissive.setHSL(hue / 360, 0.9, 0.35);
    }

    if (
      materialRef.current &&
      (item.config.isRare || item.config.isDangerous || item.config.isPowerUp)
    ) {
      materialRef.current.emissiveIntensity =
        0.4 + 0.35 * Math.sin(timeRef.current * 5);
    }
  });

  const renderShape = useCallback(() => {
    const s = item.config.scale;
    switch (item.config.shape) {
      case 'sphere':
        return <sphereGeometry args={[s, 16, 16]} />;
      case 'box':
        return <boxGeometry args={[s, s, s]} />;
      case 'octahedron':
        return <octahedronGeometry args={[s]} />;
      case 'dodecahedron':
        return <dodecahedronGeometry args={[s * 0.85]} />;
      case 'icosahedron':
        return <icosahedronGeometry args={[s * 0.85]} />;
      case 'torus':
        return <torusGeometry args={[s * 0.5, s * 0.2, 8, 16]} />;
      case 'cone':
        return <coneGeometry args={[s * 0.5, s * 1.1, 6]} />;
      case 'heart':
        return <sphereGeometry args={[s, 16, 16]} />;
      default:
        return <sphereGeometry args={[s, 16, 16]} />;
    }
  }, [item.config.scale, item.config.shape]);

  const glowColor = useMemo(() => {
    if (!item.config.isPowerUp) return item.config.emissive;
    if (item.type === 'heart') return '#FF69B4';
    if (item.type === 'shield') return '#4169E1';
    if (item.type === 'magnet') return '#FF4500';
    if (item.type === 'doublePoints') return '#00FF00';
    return '#00FFFF';
  }, [item.config.emissive, item.config.isPowerUp, item.type]);

  return (
    <group
      ref={groupRef}
      position={[item.x, item.y, 0]}
      scale={item.visualScale}
    >
      <mesh castShadow>
        {renderShape()}
        <meshPhysicalMaterial
          ref={materialRef}
          color={item.config.color}
          metalness={
            item.config.isRare ? 0.9 : item.config.isPowerUp ? 0.5 : 0.4
          }
          roughness={item.config.isRare ? 0.1 : 0.3}
          emissive={item.config.emissive}
          emissiveIntensity={
            item.config.isRare || item.config.isPowerUp ? 0.5 : 0.25
          }
          clearcoat={item.config.isRare ? 1.0 : 0.6}
        />
      </mesh>

      {(item.config.isRare ||
        item.config.isDangerous ||
        item.config.isPowerUp) && (
        <mesh scale={1.6}>
          {renderShape()}
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.25}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {item.config.isRare && (
        <mesh position={[0, 1, 0]}>
          <coneGeometry args={[0.18, 1.5, 8]} />
          <meshBasicMaterial
            color={item.config.emissive}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}

      {item.type === 'heart' && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial color="#FF1493" transparent opacity={0.8} />
        </mesh>
      )}

      {item.config.isPowerUp && (
        <>
          <pointLight color={glowColor} intensity={2} distance={4} />
          <mesh scale={[0.1, 0.1, 0.1]} position={[0.3, 0.3, 0]}>
            <octahedronGeometry />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh scale={[0.08, 0.08, 0.08]} position={[-0.25, 0.2, 0.1]}>
            <octahedronGeometry />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </>
      )}

      <pointLight
        color={item.config.emissive}
        intensity={item.config.isRare ? 2.5 : item.config.isPowerUp ? 1.5 : 0.6}
        distance={item.config.isRare ? 5 : 3}
      />
    </group>
  );
};

export default FallingItemVisual;
