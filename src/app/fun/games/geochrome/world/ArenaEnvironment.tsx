import { Sky } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA_TUNING, RENDER_TUNING, WORLD_TUNING } from '../engine/constants';

interface ArenaEnvironmentProps {
  lowPerf: boolean;
}

function makeTerrainGeometry(lowPerf: boolean) {
  const size = WORLD_TUNING.halfExtent * 2;
  const segments = lowPerf
    ? Math.floor(RENDER_TUNING.terrainSegments * 0.45)
    : RENDER_TUNING.terrainSegments;

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const colorArray = new Float32Array(positions.count * 3);

  const lowColor = new THREE.Color('#091127');
  const midColor = new THREE.Color('#10304d');
  const highColor = new THREE.Color('#22627c');
  const mixed = new THREE.Color();

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const radius = Math.sqrt(x * x + z * z);

    const falloff = 1 - Math.min(1, radius / (WORLD_TUNING.halfExtent * 0.96));
    const ripple =
      Math.sin(x * ARENA_TUNING.terrainFrequency) *
      Math.cos(z * (ARENA_TUNING.terrainFrequency * 1.12));
    const rings = Math.sin(radius * 0.115);

    const y =
      (ripple * 0.62 + rings * 0.38) *
      ARENA_TUNING.terrainAmplitude *
      falloff;
    positions.setY(i, y);

    const heat = Math.min(1, radius / WORLD_TUNING.halfExtent);
    mixed.copy(lowColor).lerp(midColor, heat);
    mixed.lerp(highColor, Math.max(0, y * 2.6 + 0.15));
    colorArray[i * 3 + 0] = mixed.r;
    colorArray[i * 3 + 1] = mixed.g;
    colorArray[i * 3 + 2] = mixed.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function LandmarkSetPieces({ lowPerf }: { lowPerf: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  const transforms = useMemo(() => {
    const count = lowPerf ? 24 : WORLD_TUNING.decorativeCount;
    const matrices = new Array<THREE.Matrix4>(count);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const axis = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const ring = i % 3;
      const radius = 45 + ring * 54 + ((i * 13) % 7) * 1.9;
      position.set(
        Math.cos(angle) * radius,
        0.4 + ring * 0.3,
        Math.sin(angle) * radius
      );
      quaternion.setFromAxisAngle(axis, angle * 0.8 + ring * 0.35);
      const s = 1.7 + ring * 0.55;
      scale.set(s, s * (1.6 + (i % 5) * 0.12), s);
      matrix.compose(position, quaternion, scale);
      matrices[i] = matrix.clone();
    }

    return matrices;
  }, [lowPerf]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < transforms.length; i += 1) {
      mesh.setMatrixAt(i, transforms[i]);
    }
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, transforms.length]}
      castShadow={!lowPerf}
      receiveShadow={false}
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#38bdf8"
        emissive="#164e63"
        emissiveIntensity={0.38}
        metalness={0.24}
        roughness={0.58}
      />
    </instancedMesh>
  );
}

export default function ArenaEnvironment({ lowPerf }: ArenaEnvironmentProps) {
  const terrainGeometry = useMemo(() => makeTerrainGeometry(lowPerf), [lowPerf]);

  useEffect(() => {
    return () => {
      terrainGeometry.dispose();
    };
  }, [terrainGeometry]);

  return (
    <group>
      <Sky
        distance={420000}
        sunPosition={[100, 26, 100]}
        turbidity={8}
        rayleigh={1.15}
        mieCoefficient={0.013}
        mieDirectionalG={0.86}
      />

      <mesh receiveShadow geometry={terrainGeometry} position={[0, -0.04, 0]}>
        <meshStandardMaterial
          vertexColors
          metalness={0.28}
          roughness={0.8}
          emissive="#081526"
          emissiveIntensity={0.2}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <ringGeometry
          args={[WORLD_TUNING.ringStartRadius, WORLD_TUNING.ringStartRadius + 1.4, 128]}
        />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#1d4ed8"
          emissiveIntensity={0.28}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <ringGeometry args={[56, 57.4, 128]} />
        <meshStandardMaterial
          color="#67e8f9"
          emissive="#0891b2"
          emissiveIntensity={0.2}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <ringGeometry args={[110, 111.8, 128]} />
        <meshStandardMaterial
          color="#93c5fd"
          emissive="#0c4a6e"
          emissiveIntensity={0.18}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <ringGeometry args={[168, 170, 128]} />
        <meshStandardMaterial
          color="#bfdbfe"
          emissive="#0369a1"
          emissiveIntensity={0.15}
        />
      </mesh>

      <mesh position={[0, 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.8, 1.4, 4.2, 10]} />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#22d3ee"
          emissiveIntensity={0.44}
        />
      </mesh>

      <mesh position={[0, ARENA_TUNING.boundaryHeight * 0.5, 0]}>
        <cylinderGeometry
          args={[
            ARENA_TUNING.boundaryRadius + ARENA_TUNING.boundaryThickness,
            ARENA_TUNING.boundaryRadius + ARENA_TUNING.boundaryThickness,
            ARENA_TUNING.boundaryHeight,
            84,
            1,
            true,
          ]}
        />
        <meshStandardMaterial
          color="#102640"
          emissive="#0a1d33"
          emissiveIntensity={0.25}
          side={THREE.DoubleSide}
          transparent
          opacity={0.86}
        />
      </mesh>

      <LandmarkSetPieces lowPerf={lowPerf} />
    </group>
  );
}
