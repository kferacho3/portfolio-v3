import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type ShatteredJellyProps = {
  position: readonly [number, number, number];
  color: string;
};

type ShardData = {
  id: string;
  offset: [number, number, number];
  jitter: [number, number, number];
  scale: number;
};

function makeShardData() {
  const shards: ShardData[] = [];
  const step = 0.28;
  let idx = 0;
  for (let yi = 0; yi < 3; yi += 1) {
    for (let xi = 0; xi < 3; xi += 1) {
      for (let zi = 0; zi < 3; zi += 1) {
        const ox = (xi - 1) * step;
        const oy = (yi - 1) * step;
        const oz = (zi - 1) * step;
        shards.push({
          id: `shard-${idx}`,
          offset: [ox, oy, oz],
          jitter: [
            (Math.random() - 0.5) * 0.14,
            (Math.random() - 0.5) * 0.14,
            (Math.random() - 0.5) * 0.14,
          ],
          scale: 0.23 + Math.random() * 0.04,
        });
        idx += 1;
      }
    }
  }
  return shards;
}

function Shard({ data, color }: { data: ShardData; color: string }) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const lifeRef = useRef(0);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const [ox, oy, oz] = data.offset;
    const [jx, jy, jz] = data.jitter;
    const dir = new THREE.Vector3(ox + jx, oy + jy + 0.35, oz + jz);
    if (dir.lengthSq() < 0.0001) dir.set(0.1, 1, 0.1);
    dir.normalize();
    const kick = 4.2 + Math.random() * 5.8;
    body.applyImpulse(
      {
        x: dir.x * kick,
        y: 6.0 + dir.y * kick * 0.7,
        z: dir.z * kick,
      },
      true
    );
    body.applyTorqueImpulse(
      {
        x: (Math.random() - 0.5) * 3.5,
        y: (Math.random() - 0.5) * 3.5,
        z: (Math.random() - 0.5) * 3.5,
      },
      true
    );
  }, [data.jitter, data.offset]);

  useFrame((_, dt) => {
    lifeRef.current += dt;
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    if (lifeRef.current > 1.3) {
      const fadeT = Math.min(1, (lifeRef.current - 1.3) / 1.25);
      mesh.scale.setScalar(1 - fadeT * 0.92);
      mat.opacity = 1 - fadeT;
      mat.emissiveIntensity = 0.55 * (1 - fadeT);
    }
  });

  const [x, y, z] = data.offset;

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      ccd
      linearDamping={0.24}
      angularDamping={0.25}
      position={[x, y, z]}
    >
      <CuboidCollider args={[data.scale * 0.5, data.scale * 0.5, data.scale * 0.5]} />
      <mesh ref={meshRef} castShadow scale={data.scale}>
        <boxGeometry />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          transparent
          opacity={1}
          roughness={0.18}
          metalness={0.16}
        />
      </mesh>
    </RigidBody>
  );
}

export default function ShatteredJelly({ position, color }: ShatteredJellyProps) {
  const shards = useMemo(() => makeShardData(), []);

  return (
    <group position={position}>
      {shards.map((data) => (
        <Shard key={data.id} data={data} color={color} />
      ))}
    </group>
  );
}
