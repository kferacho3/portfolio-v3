import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import type { Platform, Theme } from '../types';

const PlatformMesh: React.FC<{ platform: Platform; theme: Theme }> = ({ platform, theme }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.LineSegments>(null);

  useFrame((state) => {
    if (!meshRef.current) return;

    let x = platform.x;
    let z = -platform.z;
    let y = platform.y;

    if (platform.type === 'moving' && platform.moveAxis) {
      const moveRange = platform.moveRange || 2;
      const moveAmount = Math.sin(state.clock.elapsedTime * 1.5 + (platform.movePhase || 0)) * moveRange;
      if (platform.moveAxis === 'x') {
        x += moveAmount;
      } else {
        z -= moveAmount;
      }
    }

    if (platform.type === 'crumble' && platform.crumbleTimer !== undefined && platform.crumbleTimer < 0.6) {
      y = platform.y - (0.6 - platform.crumbleTimer) * 15;
      meshRef.current.rotation.x = (0.6 - platform.crumbleTimer) * 0.4;
      meshRef.current.rotation.z = (0.6 - platform.crumbleTimer) * 0.2;
    }

    meshRef.current.position.set(x, y, z);
    if (edgeRef.current) {
      edgeRef.current.position.set(x, y, z);
      edgeRef.current.rotation.copy(meshRef.current.rotation);
    }
  });

  let color = theme.platform;
  let emissive = theme.platform;
  let emissiveIntensity = 0.15;

  if (platform.type === 'start') {
    color = '#3B99FC';
    emissive = '#3B99FC';
    emissiveIntensity = 0.4;
  } else if (platform.type === 'crumble') {
    color = theme.crumble;
    emissive = theme.crumble;
    emissiveIntensity = platform.touched ? 0.6 : 0.25;
  } else if (platform.type === 'moving') {
    color = theme.accent;
    emissive = theme.accent;
    emissiveIntensity = 0.35;
  } else if (platform.type === 'boost') {
    color = theme.boost;
    emissive = theme.boost;
    emissiveIntensity = 0.5;
  }

  const platformHeight = 0.4;

  return (
    <group>
      <mesh ref={meshRef} position={[platform.x, platform.y, -platform.z]} receiveShadow castShadow>
        <boxGeometry args={[platform.width, platformHeight, platform.length]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
      <lineSegments ref={edgeRef} position={[platform.x, platform.y, -platform.z]}>
        <edgesGeometry args={[new THREE.BoxGeometry(platform.width, platformHeight, platform.length)]} />
        <lineBasicMaterial color={emissive} transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
};

export default PlatformMesh;
