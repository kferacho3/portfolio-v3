import { useFrame, useLoader } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MAX_FRAME_DELTA, UFO_GROUND_TEXTURE_URLS } from '../constants';

const UfoGround: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const textureUrl = useMemo(
    () => UFO_GROUND_TEXTURE_URLS[Math.floor(Math.random() * UFO_GROUND_TEXTURE_URLS.length)],
    []
  );
  const texture = useLoader(
    THREE.TextureLoader,
    textureUrl
  );

  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#050610';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.35)');
    gradient.addColorStop(0.5, 'rgba(140, 90, 255, 0.28)');
    gradient.addColorStop(1, 'rgba(40, 220, 255, 0.3)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;

    for (let i = 0; i <= 64; i++) {
      const x = (i / 64) * canvas.width;
      ctx.globalAlpha = i % 4 === 0 ? 0.75 : 0.32;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= 64; i++) {
      const y = (i / 64) * canvas.height;
      ctx.globalAlpha = i % 4 === 0 ? 0.75 : 0.32;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    for (let i = 0; i < 140; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const length = 8 + Math.random() * 24;
      ctx.globalAlpha = 0.2 + Math.random() * 0.45;
      ctx.strokeStyle = i % 2 === 0 ? '#74f9ff' : '#a98fff';
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y + (Math.random() - 0.5) * 8);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(110, 110);
    tex.offset.set(0, 0);
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }, []);

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100);
  texture.offset.set(0, 0);
  texture.anisotropy = 8;

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, MAX_FRAME_DELTA);
    texture.offset.y -= dt * 0.35;
    texture.offset.x += dt * 0.08;
    if (glowTexture) {
      glowTexture.offset.y -= dt * 0.5;
      glowTexture.offset.x += dt * 0.12;
    }
    if (meshRef.current) {
      meshRef.current.position.x = camera.position.x;
      meshRef.current.position.z = camera.position.z - 50;
    }
    if (glowRef.current) {
      glowRef.current.position.x = camera.position.x;
      glowRef.current.position.z = camera.position.z - 50;
    }
  });

  return (
    <>
      <mesh
        ref={meshRef}
        position={[0, -1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          map={texture}
          color="#8ab4ff"
          emissive="#0f1e46"
          emissiveIntensity={0.22}
          roughness={0.35}
          metalness={0.08}
        />
      </mesh>
      {glowTexture && (
        <mesh
          ref={glowRef}
          position={[0, -0.995, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial
            map={glowTexture}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
};

export default UfoGround;
