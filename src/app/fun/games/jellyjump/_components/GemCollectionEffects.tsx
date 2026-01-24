import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';

type Particle = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
};

export default function GemCollectionEffects() {
  const snap = useSnapshot(jellyJumpState);
  const particlesRef = useRef<Particle[]>([]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ringDummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const lastGemsCollected = useRef(0);

  const gemMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#facc15',
        emissive: '#fde047',
        emissiveIntensity: 2.0,
        transparent: true,
        roughness: 0.1,
        metalness: 0.8,
      }),
    []
  );

  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  const ringsRef = useRef<{ pos: THREE.Vector3; life: number; maxLife: number }[]>([]);

  // Spawn particles when gems are collected
  useEffect(() => {
    if (snap.phase !== 'playing') return;
    
    const gemsDiff = snap.gemsCollected - lastGemsCollected.current;
    if (gemsDiff > 0) {
      const [px, py, pz] = mutation.playerPos;
      for (let i = 0; i < gemsDiff * 10; i++) {
        particlesRef.current.push({
          pos: new THREE.Vector3(px, py, pz),
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 6 + 2,
            (Math.random() - 0.5) * 8
          ),
          life: 0,
          maxLife: 0.9,
        });
      }
      for (let i = 0; i < gemsDiff; i++) {
        ringsRef.current.push({
          pos: new THREE.Vector3(px, py, pz),
          life: 0,
          maxLife: 0.6,
        });
      }
      lastGemsCollected.current = snap.gemsCollected;
    }
  }, [snap.gemsCollected, snap.phase]);

  useFrame((_, dt) => {
    if (!meshRef.current || !ringRef.current) return;
    if (snap.phase !== 'playing') {
      particlesRef.current = [];
      ringsRef.current = [];
      meshRef.current.count = 0;
      ringRef.current.count = 0;
      return;
    }

    // Update particles
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life += dt;
      p.vel.y -= 20 * dt; // gravity
      p.pos.addScaledVector(p.vel, dt);
      return p.life < p.maxLife;
    });

    ringsRef.current = ringsRef.current.filter((r) => {
      r.life += dt;
      return r.life < r.maxLife;
    });

    // Render particles
    let count = 0;
    for (const p of particlesRef.current) {
      const t = p.life / p.maxLife;
      const scale = 0.15 * (1 - t);
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(count, dummy.matrix);
      count += 1;
      if (count >= 140) break;
    }

    meshRef.current.count = count;
    meshRef.current.instanceMatrix.needsUpdate = true;

    let ringCount = 0;
    for (const r of ringsRef.current) {
      const t = r.life / r.maxLife;
      const scale = 0.2 + t * 2.2;
      ringDummy.position.copy(r.pos);
      ringDummy.rotation.set(-Math.PI / 2, 0, 0);
      ringDummy.scale.set(scale, scale, scale);
      ringDummy.updateMatrix();
      ringRef.current.setMatrixAt(ringCount, ringDummy.matrix);
      ringRef.current.setColorAt(ringCount, tempColor.set('#fde047').multiplyScalar(1 - t));
      ringCount += 1;
      if (ringCount >= 40) break;
    }
    ringRef.current.count = ringCount;
    ringRef.current.instanceMatrix.needsUpdate = true;
    if (ringRef.current.instanceColor) ringRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, gemMat, 140]} frustumCulled={false}>
        <octahedronGeometry args={[0.1, 0]} />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[undefined, ringMat, 40]} frustumCulled={false}>
        <ringGeometry args={[0.2, 0.35, 32]} />
      </instancedMesh>
    </group>
  );
}
