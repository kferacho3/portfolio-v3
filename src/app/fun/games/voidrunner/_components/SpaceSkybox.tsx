import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COLORS } from '../constants';
import { mutation } from '../state';

const SpaceSkybox: React.FC = () => {
  const sunRef = useRef<THREE.Mesh>(null);
  const voidRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);
  const nebulaRef = useRef<THREE.Mesh>(null);
  const { scene } = useThree();

  useEffect(() => {
    const prevBackground = scene.background;
    scene.background = new THREE.Color('#000008');
    return () => {
      scene.background = prevBackground;
    };
  }, [scene]);

  useFrame((state) => {
    const playerZ = mutation.playerZ;
    const playerX = mutation.playerX;

    if (sunRef.current) {
      sunRef.current.position.z = playerZ - 2000;
      sunRef.current.position.x = 0;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
      sunRef.current.scale.setScalar(scale);
      (sunRef.current.material as THREE.MeshStandardMaterial).emissive.copy(
        mutation.globalColor
      );
    }

    if (voidRef.current) {
      voidRef.current.position.z = playerZ - 3000;
      voidRef.current.rotation.z += 0.002;
      (voidRef.current.material as THREE.MeshBasicMaterial).color.copy(
        mutation.globalColor
      );
    }

    if (starsRef.current) {
      starsRef.current.position.z = playerZ;
      starsRef.current.position.x = playerX * 0.1;
      starsRef.current.rotation.z += 0.0001 * mutation.gameSpeed;
    }

    if (nebulaRef.current) {
      nebulaRef.current.position.z = playerZ - 1500;
      nebulaRef.current.rotation.z += 0.0005;
    }
  });

  const nebulaGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < 500; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 1000 + 200;
      const z = (Math.random() - 0.5) * 500;
      positions.push(x, y, z);

      colors.push(
        0.5 + Math.random() * 0.5,
        0.1 + Math.random() * 0.2,
        0.5 + Math.random() * 0.5
      );
    }

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }, []);

  return (
    <>
      <mesh ref={sunRef} position={[0, 100, -2000]}>
        <sphereGeometry args={[200, 32, 32]} />
        <meshStandardMaterial
          color={COLORS[1].three}
          emissive={COLORS[0].three}
          emissiveIntensity={1.5}
        />
      </mesh>

      <mesh ref={voidRef} position={[0, 50, -3000]}>
        <torusGeometry args={[400, 20, 16, 100]} />
        <meshBasicMaterial color={COLORS[0].three} transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 50, -3000]}>
        <torusGeometry args={[350, 15, 16, 100]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      <points ref={nebulaRef} geometry={nebulaGeometry}>
        <pointsMaterial
          size={15}
          vertexColors
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <Stars
        ref={starsRef}
        radius={800}
        depth={200}
        count={10000}
        factor={50}
        saturation={0.2}
        fade
        speed={0.3}
      />

      <Stars
        radius={1500}
        depth={400}
        count={5000}
        factor={80}
        saturation={0}
        fade
        speed={0.1}
      />

      <fog attach="fog" args={['#000010', 100, 1000]} />
    </>
  );
};

export default SpaceSkybox;
