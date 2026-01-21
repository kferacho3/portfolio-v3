import * as THREE from 'three';

export type SuperParams = {
  m: number;
  n1: number;
  n2: number;
  n3: number;
  a?: number;
  b?: number;
};

const superR = (theta: number, params: SuperParams) => {
  const a = params.a ?? 1;
  const b = params.b ?? 1;
  const t = (params.m * theta) / 4;
  const part1 = Math.pow(Math.abs(Math.cos(t) / a), params.n2);
  const part2 = Math.pow(Math.abs(Math.sin(t) / b), params.n3);
  return Math.pow(part1 + part2, -1 / params.n1);
};

export const buildSupershapeGeometry = (
  radius: number,
  lat: SuperParams,
  lon: SuperParams,
  segmentsU = 96,
  segmentsV = 48
) => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= segmentsV; j++) {
    const v = j / segmentsV;
    const phi = (v - 0.5) * Math.PI;
    const r2 = superR(phi, lat);

    for (let i = 0; i <= segmentsU; i++) {
      const u = i / segmentsU;
      const theta = u * Math.PI * 2;
      const r1 = superR(theta, lon);

      const x = radius * r1 * Math.cos(theta) * r2 * Math.cos(phi);
      const y = radius * r2 * Math.sin(phi);
      const z = radius * r1 * Math.sin(theta) * r2 * Math.cos(phi);

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const row = segmentsU + 1;
  for (let j = 0; j < segmentsV; j++) {
    for (let i = 0; i < segmentsU; i++) {
      const a = j * row + i;
      const b = a + row;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
};
