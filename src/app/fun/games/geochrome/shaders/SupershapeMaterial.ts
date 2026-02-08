import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { supershapeFragment, supershapeVertex } from './supershape.glsl';

const SupershapeMaterialImpl = shaderMaterial(
  {
    uTime: 0,
    uQuality: 1,
  },
  supershapeVertex,
  supershapeFragment
);

export type SupershapeMaterialInstance = THREE.ShaderMaterial & {
  uniforms: {
    uTime: { value: number };
    uQuality: { value: number };
  };
};

export function createSupershapeMaterial(initialQuality = 1) {
  const material = new SupershapeMaterialImpl() as unknown as SupershapeMaterialInstance;
  material.uniforms.uQuality.value = initialQuality;
  material.transparent = false;
  material.depthWrite = true;
  material.depthTest = true;
  material.toneMapped = true;
  return material;
}
