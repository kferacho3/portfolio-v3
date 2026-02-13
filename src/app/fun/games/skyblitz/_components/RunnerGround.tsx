import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MAX_FRAME_DELTA, RUNNER_BASE_FORWARD_SPEED } from '../constants';

const RunnerGround: React.FC<{
  forwardSpeedRef?: React.MutableRefObject<number>;
}> = ({ forwardSpeedRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const overlayRef = useRef<THREE.Mesh>(null);
  const runnerTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 96; i++) {
      const y = (i / 96) * canvas.height;
      ctx.strokeStyle = i % 8 === 0 ? 'rgba(20,255,255,0.6)' : 'rgba(20,120,255,0.25)';
      ctx.lineWidth = i % 8 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    for (let i = 0; i < 96; i++) {
      const x = (i / 96) * canvas.width;
      ctx.strokeStyle = i % 8 === 0 ? 'rgba(170,120,255,0.45)' : 'rgba(120,180,255,0.2)';
      ctx.lineWidth = i % 8 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(95, 95);
    tex.offset.set(0, 0);
    tex.anisotropy = 8;
    return tex;
  }, []);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, MAX_FRAME_DELTA);
    const speed = forwardSpeedRef?.current ?? RUNNER_BASE_FORWARD_SPEED;
    const normalized = THREE.MathUtils.clamp(speed / RUNNER_BASE_FORWARD_SPEED, 0.5, 3);
    if (runnerTexture) {
      runnerTexture.offset.y -= dt * 0.19 * normalized;
      runnerTexture.offset.x += dt * 0.012 * normalized;
    }
    if (meshRef.current) {
      meshRef.current.position.z = camera.position.z - 50;
    }
    if (overlayRef.current) {
      overlayRef.current.position.z = camera.position.z - 50;
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
          map={runnerTexture ?? undefined}
          color="#0a1a3f"
          emissive="#0a1844"
          emissiveIntensity={0.24}
          roughness={0.42}
          metalness={0.14}
        />
      </mesh>
      {runnerTexture && (
        <mesh
          ref={overlayRef}
          position={[0, -0.995, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial
            map={runnerTexture}
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
};

export default RunnerGround;
