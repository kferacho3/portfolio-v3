import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA_TUNING, RENDER_TUNING, WORLD_TUNING } from '../engine/constants';

interface ArenaEnvironmentProps {
  lowPerf: boolean;
}

function tileHash(x: number, z: number) {
  const hx = Math.imul(x, 73856093);
  const hz = Math.imul(z, 19349663);
  return (hx ^ hz) >>> 0;
}

function fract(value: number) {
  return value - Math.floor(value);
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

  const biomeA = new THREE.Color('#1d4ed8');
  const biomeB = new THREE.Color('#0891b2');
  const biomeC = new THREE.Color('#0f766e');
  const biomeD = new THREE.Color('#7c3aed');
  const ringGlowColor = new THREE.Color('#7dd3fc');
  const highlightColor = new THREE.Color('#e0f2fe');
  const biomes = [biomeA, biomeB, biomeC, biomeD];
  const mixed = new THREE.Color();

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const radius = Math.sqrt(x * x + z * z);
    const radiusNorm = Math.min(1, radius / (WORLD_TUNING.halfExtent * 0.95));

    const angle = (Math.atan2(z, x) + Math.PI) / (Math.PI * 2);
    const sector = Math.floor(angle * 12);
    const ringBand = Math.min(3, Math.floor(radiusNorm * 4));

    const tx = Math.floor((x + WORLD_TUNING.halfExtent) / ARENA_TUNING.tileSize);
    const tz = Math.floor((z + WORLD_TUNING.halfExtent) / ARENA_TUNING.tileSize);
    const hash = tileHash(tx, tz);
    const variation = (hash % 1000) / 1000;

    const biomeIndex = (ringBand + (sector % 3)) % biomes.length;

    const ripple =
      Math.sin(x * ARENA_TUNING.terrainFrequency) *
      Math.cos(z * (ARENA_TUNING.terrainFrequency * 1.08));
    const dunes = Math.sin((x + z) * 0.021 + biomeIndex) * 0.35;
    const falloff = 1 - Math.min(1, radius / (WORLD_TUNING.halfExtent * 0.98));
    const y = (ripple * 0.68 + dunes * 0.32) * ARENA_TUNING.terrainAmplitude * falloff;
    positions.setY(i, y);

    const tileFx = Math.abs(fract((x + WORLD_TUNING.halfExtent) / ARENA_TUNING.tileSize) - 0.5);
    const tileFz = Math.abs(fract((z + WORLD_TUNING.halfExtent) / ARENA_TUNING.tileSize) - 0.5);
    const tileEdge = Math.max(tileFx, tileFz);
    const tileEdgeShade = THREE.MathUtils.smoothstep(tileEdge, 0.45, 0.5);

    mixed.copy(biomes[biomeIndex]);
    mixed.offsetHSL((variation - 0.5) * 0.04, 0.02, (variation - 0.5) * 0.1);

    const ringGlow =
      Math.exp(-Math.abs(radius - 56) * 0.08) * 0.4 +
      Math.exp(-Math.abs(radius - 110) * 0.08) * 0.35 +
      Math.exp(-Math.abs(radius - 168) * 0.08) * 0.3;

    mixed.multiplyScalar(0.78 + tileEdgeShade * 0.2);
    mixed.lerp(ringGlowColor, ringGlow * 0.18);
    mixed.lerp(highlightColor, Math.max(0, y) * 2.6);

    colorArray[i * 3 + 0] = mixed.r;
    colorArray[i * 3 + 1] = mixed.g;
    colorArray[i * 3 + 2] = mixed.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function DynamicSkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vPos;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vPos = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vPos;
          uniform float uTime;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          void main() {
            vec3 dir = normalize(vPos);
            float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
            float t = uTime * 0.06;

            float cycle = 0.5 + 0.5 * sin(t);
            float phase = 0.5 + 0.5 * sin(t * 0.7 + 1.1);

            vec3 dawn = vec3(0.10, 0.22, 0.44);
            vec3 day = vec3(0.16, 0.58, 0.92);
            vec3 dusk = vec3(0.58, 0.32, 0.76);
            vec3 night = vec3(0.03, 0.05, 0.15);

            vec3 top = mix(mix(dawn, day, cycle), mix(dusk, night, cycle), phase * 0.65);
            vec3 horizonWarm = vec3(0.97, 0.67, 0.42);
            vec3 horizonCool = vec3(0.18, 0.34, 0.52);
            vec3 horizon = mix(horizonWarm, horizonCool, cycle);

            vec3 col = mix(horizon, top, pow(h, 0.72));

            float starMask = smoothstep(0.62, 0.18, cycle) * (1.0 - h);
            vec2 starUv = floor((dir.xz + 1.0) * 120.0);
            float stars = step(0.996, hash(starUv));
            col += vec3(stars * starMask * 0.45);

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );

  const sunRef = useRef<THREE.Mesh | null>(null);

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;

    if (sunRef.current) {
      const t = material.uniforms.uTime.value * 0.08;
      sunRef.current.position.set(Math.cos(t) * 180, 120 + Math.sin(t * 0.8) * 38, Math.sin(t) * 180);
    }
  });

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[640, 40, 32]} />
        <primitive object={material} attach="material" />
      </mesh>

      <mesh ref={sunRef}>
        <sphereGeometry args={[10, 18, 18]} />
        <meshBasicMaterial color="#fef3c7" transparent opacity={0.65} />
      </mesh>
    </group>
  );
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
      <DynamicSkyDome />

      <mesh receiveShadow geometry={terrainGeometry} position={[0, -0.04, 0]}>
        <meshStandardMaterial
          vertexColors
          metalness={0.22}
          roughness={0.84}
          emissive="#081526"
          emissiveIntensity={0.22}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        receiveShadow
      >
        <ringGeometry
          args={[
            WORLD_TUNING.ringStartRadius,
            WORLD_TUNING.ringStartRadius + 1.4,
            128,
          ]}
        />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#1d4ed8"
          emissiveIntensity={0.28}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        receiveShadow
      >
        <ringGeometry args={[56, 57.4, 128]} />
        <meshStandardMaterial
          color="#67e8f9"
          emissive="#0891b2"
          emissiveIntensity={0.2}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        receiveShadow
      >
        <ringGeometry args={[110, 111.8, 128]} />
        <meshStandardMaterial
          color="#93c5fd"
          emissive="#0c4a6e"
          emissiveIntensity={0.18}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        receiveShadow
      >
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
