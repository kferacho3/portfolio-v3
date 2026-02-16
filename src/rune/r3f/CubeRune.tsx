import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useRuneStore } from '../store';

const CUBE_SIZE = 1;
const HALF_PI = Math.PI / 2;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function idxToXZ(idx: number, width: number): [number, number] {
  return [idx % width, Math.floor(idx / width)];
}

export function CubeRune() {
  const pivotRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const animRef = useRef<{ token: number; startedAt: number; durationMs: number } | null>(null);

  useFrame(() => {
    const pivot = pivotRef.current;
    const mesh = meshRef.current;
    if (!pivot || !mesh) return;

    const state = useRuneStore.getState();
    const level = state.level;
    if (!level || !state.sim) {
      return;
    }

    const pending = state.pending;

    if (!pending) {
      animRef.current = null;
      const [x, z] = idxToXZ(state.sim.idx, level.width);
      pivot.position.set(x, 0, z);
      pivot.rotation.set(0, 0, 0);
      mesh.position.set(0, CUBE_SIZE * 0.5, 0);
      mesh.scale.set(1, 1, 1);
      return;
    }

    if (!animRef.current || animRef.current.token !== pending.token) {
      animRef.current = { token: pending.token, startedAt: performance.now(), durationMs: 300 };
    }

    const anim = animRef.current;
    const elapsed = performance.now() - anim.startedAt;
    const t = Math.min(1, Math.max(0, elapsed / anim.durationMs));
    const eased = easeInOutCubic(t);

    const [fromX, fromZ] = idxToXZ(pending.fromIdx, level.width);
    const [toX, toZ] = idxToXZ(pending.toIdx, level.width);
    const dx = toX - fromX;
    const dz = toZ - fromZ;

    pivot.position.set(fromX + dx * 0.5, 0, fromZ + dz * 0.5);
    pivot.rotation.set(0, 0, 0);
    mesh.position.set(-dx * 0.5, CUBE_SIZE * 0.5, -dz * 0.5);

    if (dx !== 0) {
      pivot.rotation.z = dx === 1 ? -eased * HALF_PI : eased * HALF_PI;
    }

    if (dz !== 0) {
      pivot.rotation.x = dz === 1 ? eased * HALF_PI : -eased * HALF_PI;
    }

    const stretch = 1 + Math.sin(Math.PI * t) * 0.08;
    const side = 1 / Math.sqrt(stretch);
    mesh.scale.set(side, stretch, side);

    if (t >= 1) {
      useRuneStore.getState().commitMove(pending.token);
    }
  });

  return (
    <group ref={pivotRef}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
        <meshStandardMaterial color="#111827" emissive="#1a2742" emissiveIntensity={0.3} roughness={0.35} metalness={0.12} />
      </mesh>
    </group>
  );
}
