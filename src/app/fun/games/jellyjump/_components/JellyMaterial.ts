import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

const JellyMaterialImpl = shaderMaterial(
  {
    uTime: 0,
    uJiggle: 0,
    uVelocity: 0,
    uGlow: 0.4,
    uColor: new THREE.Color('#22d3ee'),
  },
  `
  uniform float uTime;
  uniform float uJiggle;
  uniform float uVelocity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vPulse;

  void main() {
    // Use position-based displacement (not normal-based) so box edge vertices
    // shared by adjacent faces stay aligned and the cube does not crack.
    vec3 base = position;
    vec3 p = base;
    float heavy = smoothstep(-0.5, 0.8, base.y);
    float amp = (0.20 + heavy * 0.32) * uJiggle;
    float wobbleX = sin((base.y + uTime * 2.6) * 11.0 + base.z * 4.5);
    float wobbleZ = cos((base.y + uTime * 2.45) * 11.0 - base.x * 4.5);
    p.x += wobbleX * amp;
    p.z += wobbleZ * amp;
    p.y += sin((base.x + base.z) * 9.0 + uTime * 7.0) * uVelocity * 0.045;

    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vPulse = max(abs(wobbleX), abs(wobbleZ)) * uJiggle;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
  `,
  `
  uniform vec3 uColor;
  uniform float uGlow;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vPulse;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.2);

    vec3 col = uColor;
    col += vec3(0.10, 0.16, 0.22) * (0.4 + uGlow * 0.6);
    col += fresnel * vec3(0.35, 0.45, 0.55);
    col += abs(vPulse) * 0.25;
    gl_FragColor = vec4(col, 1.0);
  }
  `
);

export type JellyMaterialInstance = THREE.ShaderMaterial & {
  uniforms: {
    uTime: { value: number };
    uJiggle: { value: number };
    uVelocity: { value: number };
    uGlow: { value: number };
    uColor: { value: THREE.Color };
  };
};

export function createJellyMaterial(color: string, glow = 0.4) {
  const material = new JellyMaterialImpl() as unknown as JellyMaterialInstance;
  material.uniforms.uColor.value.set(color);
  material.uniforms.uGlow.value = glow;
  material.toneMapped = false;
  return material;
}
