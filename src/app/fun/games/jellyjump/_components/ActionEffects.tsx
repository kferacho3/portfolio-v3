import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { jellyJumpState, mutation } from '../state';

type Spark = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
};

type Ring = {
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
  maxRadius: number;
  color: THREE.Color;
};

const COLOR_MAP = {
  bomb: '#ef4444',
  lever: '#fde047',
  gem: '#facc15',
  boosterSkip: '#34d399',
  boosterFreeze: '#60a5fa',
};

export default function ActionEffects() {
  const snap = useSnapshot(jellyJumpState);
  const sparksRef = useRef<Spark[]>([]);
  const ringsRef = useRef<Ring[]>([]);
  const sparkMeshRef = useRef<THREE.InstancedMesh>(null);
  const ringMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummySpark = useMemo(() => new THREE.Object3D(), []);
  const dummyRing = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  const sparkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 1.2,
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

  useFrame((_, dt) => {
    if (!sparkMeshRef.current || !ringMeshRef.current) return;

    if (snap.phase !== 'playing') {
      sparksRef.current = [];
      ringsRef.current = [];
      mutation.effectQueue = [];
      sparkMeshRef.current.count = 0;
      ringMeshRef.current.count = 0;
      return;
    }

    const queue = mutation.effectQueue.splice(0, mutation.effectQueue.length);
    if (queue.length) {
      for (const evt of queue) {
        const base = new THREE.Color(COLOR_MAP.gem);
        if (evt.type === 'bomb') base.set(COLOR_MAP.bomb);
        if (evt.type === 'lever') base.set(COLOR_MAP.lever);
        if (evt.type === 'booster') {
          base.set(evt.variant === 'freeze' ? COLOR_MAP.boosterFreeze : COLOR_MAP.boosterSkip);
        }

        const count =
          evt.type === 'bomb' ? 24 :
          evt.type === 'booster' ? 18 :
          evt.type === 'lever' ? 12 : 10;
        const speed =
          evt.type === 'bomb' ? 8 :
          evt.type === 'booster' ? 6 :
          evt.type === 'lever' ? 4 : 5;
        const maxLife = evt.type === 'bomb' ? 0.9 : evt.type === 'booster' ? 0.7 : 0.6;

        for (let i = 0; i < count; i += 1) {
          const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 1.6,
            (Math.random() - 0.5) * 2
          ).normalize();
          sparksRef.current.push({
            pos: new THREE.Vector3(evt.x, evt.y, evt.z),
            vel: dir.multiplyScalar(speed * (0.6 + Math.random() * 0.7)),
            life: 0,
            maxLife,
            color: base.clone(),
          });
        }

        ringsRef.current.push({
          pos: new THREE.Vector3(evt.x, evt.y, evt.z),
          life: 0,
          maxLife: evt.type === 'bomb' ? 0.6 : 0.45,
          maxRadius: evt.type === 'bomb' ? 2.2 : 1.4,
          color: base.clone(),
        });
      }

      if (sparksRef.current.length > 220) {
        sparksRef.current.splice(0, sparksRef.current.length - 220);
      }
      if (ringsRef.current.length > 40) {
        ringsRef.current.splice(0, ringsRef.current.length - 40);
      }
    }

    sparksRef.current = sparksRef.current.filter((spark) => {
      spark.life += dt;
      spark.vel.y -= 10 * dt;
      spark.pos.addScaledVector(spark.vel, dt);
      return spark.life < spark.maxLife;
    });

    ringsRef.current = ringsRef.current.filter((ring) => {
      ring.life += dt;
      return ring.life < ring.maxLife;
    });

    let sparkCount = 0;
    for (const spark of sparksRef.current) {
      const t = spark.life / spark.maxLife;
      const scale = 0.18 * (1 - t);
      dummySpark.position.copy(spark.pos);
      dummySpark.scale.setScalar(scale);
      dummySpark.updateMatrix();
      sparkMeshRef.current.setMatrixAt(sparkCount, dummySpark.matrix);
      sparkMeshRef.current.setColorAt(sparkCount, tempColor.copy(spark.color).multiplyScalar(1 - t));
      sparkCount += 1;
      if (sparkCount >= 220) break;
    }

    sparkMeshRef.current.count = sparkCount;
    sparkMeshRef.current.instanceMatrix.needsUpdate = true;
    if (sparkMeshRef.current.instanceColor) sparkMeshRef.current.instanceColor.needsUpdate = true;

    let ringCount = 0;
    for (const ring of ringsRef.current) {
      const t = ring.life / ring.maxLife;
      const scale = ring.maxRadius * (0.2 + t);
      dummyRing.position.copy(ring.pos);
      dummyRing.rotation.set(-Math.PI / 2, 0, 0);
      dummyRing.scale.set(scale, scale, scale);
      dummyRing.updateMatrix();
      ringMeshRef.current.setMatrixAt(ringCount, dummyRing.matrix);
      ringMeshRef.current.setColorAt(ringCount, tempColor.copy(ring.color).multiplyScalar(1 - t));
      ringCount += 1;
      if (ringCount >= 40) break;
    }

    ringMeshRef.current.count = ringCount;
    ringMeshRef.current.instanceMatrix.needsUpdate = true;
    if (ringMeshRef.current.instanceColor) ringMeshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={sparkMeshRef} args={[undefined, sparkMat, 220]} frustumCulled={false}>
        <octahedronGeometry args={[0.12, 0]} />
      </instancedMesh>
      <instancedMesh ref={ringMeshRef} args={[undefined, ringMat, 40]} frustumCulled={false}>
        <ringGeometry args={[0.18, 0.32, 32]} />
      </instancedMesh>
    </group>
  );
}
