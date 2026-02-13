import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  ARENA_TUNING,
  RENDER_TUNING,
  WORLD_TUNING,
  type GeoChromePalette,
} from '../engine/constants';

interface ArenaEnvironmentProps {
  lowPerf: boolean;
  palette: GeoChromePalette;
}

function tileHash(x: number, z: number) {
  const hx = Math.imul(x, 73856093);
  const hz = Math.imul(z, 19349663);
  return (hx ^ hz) >>> 0;
}

function fract(value: number) {
  return value - Math.floor(value);
}

function makeTerrainGeometry(lowPerf: boolean, palette: GeoChromePalette) {
  const size = WORLD_TUNING.halfExtent * 2;
  const segments = lowPerf
    ? Math.floor(RENDER_TUNING.terrainSegments * 0.45)
    : RENDER_TUNING.terrainSegments;

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const colorArray = new Float32Array(positions.count * 3);

  const biomes = palette.terrainBiomes.map((hex) => new THREE.Color(hex));
  const ringGlowColor = new THREE.Color(palette.terrainRingGlow);
  const highlightColor = new THREE.Color(palette.terrainHighlight);
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
    const y =
      (ripple * 0.68 + dunes * 0.32) * ARENA_TUNING.terrainAmplitude * falloff;
    positions.setY(i, y);

    const tileFx =
      Math.abs(fract((x + WORLD_TUNING.halfExtent) / ARENA_TUNING.tileSize) - 0.5);
    const tileFz =
      Math.abs(fract((z + WORLD_TUNING.halfExtent) / ARENA_TUNING.tileSize) - 0.5);
    const tileEdge = Math.max(tileFx, tileFz);
    const tileEdgeShade = THREE.MathUtils.smoothstep(tileEdge, 0.45, 0.5);

    mixed.copy(biomes[biomeIndex]);
    mixed.offsetHSL((variation - 0.5) * 0.05, 0.02, (variation - 0.5) * 0.09);

    const ringGlow =
      Math.exp(-Math.abs(radius - 56) * 0.08) * 0.4 +
      Math.exp(-Math.abs(radius - 110) * 0.08) * 0.35 +
      Math.exp(-Math.abs(radius - 168) * 0.08) * 0.3;

    mixed.multiplyScalar(0.78 + tileEdgeShade * 0.2);
    mixed.lerp(ringGlowColor, ringGlow * 0.2);
    mixed.lerp(highlightColor, Math.max(0, y) * 2.4);

    colorArray[i * 3 + 0] = mixed.r;
    colorArray[i * 3 + 1] = mixed.g;
    colorArray[i * 3 + 2] = mixed.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function DynamicSkyDome({
  lowPerf,
  palette,
}: {
  lowPerf: boolean;
  palette: GeoChromePalette;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uTopA: { value: new THREE.Color(palette.skyTopA) },
          uTopB: { value: new THREE.Color(palette.skyTopB) },
          uHorizonA: { value: new THREE.Color(palette.skyHorizonA) },
          uHorizonB: { value: new THREE.Color(palette.skyHorizonB) },
          uNebulaA: { value: new THREE.Color(palette.skyNebulaA) },
          uNebulaB: { value: new THREE.Color(palette.skyNebulaB) },
          uStar: { value: new THREE.Color(palette.skyStar) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vPos;
          varying vec3 vDir;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vPos = world.xyz;
            vDir = normalize(position);
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vPos;
          varying vec3 vDir;
          uniform float uTime;
          uniform vec3 uTopA;
          uniform vec3 uTopB;
          uniform vec3 uHorizonA;
          uniform vec3 uHorizonB;
          uniform vec3 uNebulaA;
          uniform vec3 uNebulaB;
          uniform vec3 uStar;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }

          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 5; i++) {
              v += a * noise(p);
              p = p * 2.03 + vec2(17.1, 29.4);
              a *= 0.52;
            }
            return v;
          }

          void main() {
            vec3 dir = normalize(vDir);
            float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
            float t = uTime * 0.06;

            vec3 top = mix(uTopA, uTopB, 0.5 + 0.5 * sin(t * 0.85 + dir.x * 2.2));
            vec3 horizon = mix(
              uHorizonA,
              uHorizonB,
              0.5 + 0.5 * cos(t * 0.7 + dir.z * 1.9)
            );
            vec3 col = mix(horizon, top, pow(h, 0.7));

            vec2 nebUv = dir.xz * 3.4 + vec2(t * 0.11, -t * 0.08);
            float nebNoise = fbm(nebUv + fbm(nebUv * 0.65 + 2.3));
            float nebula = smoothstep(0.35, 0.85, nebNoise) * (1.0 - h) * 0.75;
            vec3 nebulaColor = mix(uNebulaA, uNebulaB, noise(nebUv * 0.55 + t));
            col += nebulaColor * nebula;

            float starMask = smoothstep(0.9, 0.2, h);
            vec2 starUv = floor((dir.xz + 1.0) * 220.0);
            float star = step(0.9972, hash(starUv));
            float twinkle = 0.65 + 0.35 * sin(t * 3.4 + hash(starUv * 1.7) * 30.0);
            col += uStar * star * starMask * twinkle * 0.45;

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [
      palette.skyHorizonA,
      palette.skyHorizonB,
      palette.skyNebulaA,
      palette.skyNebulaB,
      palette.skyStar,
      palette.skyTopA,
      palette.skyTopB,
    ]
  );

  const sunRef = useRef<THREE.Mesh | null>(null);
  const moonRef = useRef<THREE.Mesh | null>(null);

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;

    const t = material.uniforms.uTime.value * 0.08;
    if (sunRef.current) {
      sunRef.current.position.set(
        Math.cos(t) * 180,
        128 + Math.sin(t * 0.8) * 34,
        Math.sin(t) * 180
      );
    }
    if (moonRef.current) {
      moonRef.current.position.set(
        Math.cos(t + Math.PI) * 195,
        102 + Math.sin(t * 0.7 + 1.2) * 28,
        Math.sin(t + Math.PI) * 195
      );
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
        <sphereGeometry args={[640, lowPerf ? 26 : 40, lowPerf ? 20 : 32]} />
        <primitive object={material} attach="material" />
      </mesh>

      <mesh ref={sunRef}>
        <sphereGeometry args={[10, 18, 18]} />
        <meshBasicMaterial color={palette.skySun} transparent opacity={0.62} />
      </mesh>

      <mesh ref={moonRef}>
        <sphereGeometry args={[7, 16, 16]} />
        <meshBasicMaterial color={palette.skyMoon} transparent opacity={0.32} />
      </mesh>
    </group>
  );
}

function LandmarkSetPieces({
  lowPerf,
  palette,
}: {
  lowPerf: boolean;
  palette: GeoChromePalette;
}) {
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
        color={palette.landmarkColor}
        emissive={palette.landmarkEmissive}
        emissiveIntensity={0.38}
        metalness={0.24}
        roughness={0.58}
      />
    </instancedMesh>
  );
}

export default function ArenaEnvironment({
  lowPerf,
  palette,
}: ArenaEnvironmentProps) {
  const terrainGeometry = useMemo(
    () => makeTerrainGeometry(lowPerf, palette),
    [lowPerf, palette]
  );

  useEffect(() => {
    return () => {
      terrainGeometry.dispose();
    };
  }, [terrainGeometry]);

  return (
    <group>
      <DynamicSkyDome lowPerf={lowPerf} palette={palette} />

      <mesh receiveShadow geometry={terrainGeometry} position={[0, -0.04, 0]}>
        <meshStandardMaterial
          vertexColors
          metalness={0.22}
          roughness={0.84}
          emissive={palette.terrainEmissive}
          emissiveIntensity={0.22}
        />
      </mesh>

      {palette.ringColors.map((ringColor, i) => {
        const radii: Array<[number, number]> = [
          [WORLD_TUNING.ringStartRadius, WORLD_TUNING.ringStartRadius + 1.4],
          [56, 57.4],
          [110, 111.8],
          [168, 170],
        ];
        const [inner, outer] = radii[i];
        return (
          <mesh
            key={`arena-ring-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.03, 0]}
            receiveShadow
          >
            <ringGeometry args={[inner, outer, 128]} />
            <meshStandardMaterial
              color={ringColor}
              emissive={palette.ringEmissive[i]}
              emissiveIntensity={0.22 - i * 0.02}
            />
          </mesh>
        );
      })}

      <mesh position={[0, 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.8, 1.4, 4.2, 10]} />
        <meshStandardMaterial
          color={palette.terrainRingGlow}
          emissive={palette.ringEmissive[1]}
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
          color={palette.boundaryColor}
          emissive={palette.boundaryEmissive}
          emissiveIntensity={0.26}
          side={THREE.DoubleSide}
          transparent
          opacity={0.86}
        />
      </mesh>

      <LandmarkSetPieces lowPerf={lowPerf} palette={palette} />
    </group>
  );
}
