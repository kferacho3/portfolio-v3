import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';
import {
  CORRIDOR_BOX_SIZE,
  CORRIDOR_BOX_Y_OFFSET,
  PALETTES,
} from '../constants';

const _bg = new THREE.Color();
const _white = new THREE.Color('#ffffff');

export default function Environment() {
  const snap = useSnapshot(jellyJumpState);
  const { scene } = useThree();
  const corridorRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const palette = PALETTES[snap.paletteIndex % PALETTES.length];

  // Update scene background + fog when palette changes
  useEffect(() => {
    scene.background = new THREE.Color(palette.bg);
    // Keep depth cues without washing out gameplay readability.
    scene.fog = new THREE.Fog(palette.fog, 120, 340);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.bg, palette.fog]);

  // Recenter corridor box around the player so it feels endless
  useFrame(() => {
    if (!corridorRef.current) return;
    const py = mutation.playerPos[1];
    corridorRef.current.position.y = py + CORRIDOR_BOX_Y_OFFSET;

    if (glowRef.current) {
      glowRef.current.position.y = py + 55;
    }
  });

  const geometry = useMemo(
    () => new THREE.BoxGeometry(...CORRIDOR_BOX_SIZE),
    []
  );
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#d6dbe4',
      metalness: 0.0,
      roughness: 0.88,
      side: THREE.BackSide,
    });
    return mat;
  }, []);

  // Keep corridor readable but avoid over-bright haze.
  useEffect(() => {
    _bg.set(palette.bg);
    material.color.copy(_bg.lerp(_white, 0.45));
  }, [material, palette.bg]);

  return (
    <group>
      <ambientLight intensity={0.95} />
      <directionalLight position={[6, 12, 8]} intensity={1.35} />
      <directionalLight position={[-6, 8, -6]} intensity={0.8} />
      <pointLight position={[0, 25, 0]} intensity={0.45} distance={70} />
      <pointLight position={[0, 10, 0]} intensity={0.28} distance={36} />

      <mesh
        ref={corridorRef}
        geometry={geometry}
        material={material}
        position={[0, CORRIDOR_BOX_Y_OFFSET, 0]}
      />

      {/* Soft glow plane at the top for depth */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 55, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial
          color={palette.accent}
          transparent
          opacity={0.035}
        />
      </mesh>
    </group>
  );
}
