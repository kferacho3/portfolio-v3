// global.d.ts
declare module 'meshline' {
  import * as THREE from 'three';

  export interface MeshLineMaterialParameters extends THREE.MaterialParameters {
    lineWidth?: number;
    color?: THREE.Color | string | number;
    dashArray?: number;
    dashOffset?: number;
    dashRatio?: number;
    transparent?: boolean;
    depthWrite?: boolean;
    resolution?: THREE.Vector2;
    side?: THREE.Side;
    // Include any other parameters your application uses
  }

  export class MeshLineGeometry extends THREE.BufferGeometry {
    constructor();
    setPoints(points: number[] | Float32Array | THREE.Vector3[]): void;
  }

  export class MeshLineMaterial extends THREE.Material {
    constructor(parameters: MeshLineMaterialParameters);
    lineWidth: number;
    color: THREE.Color;
    dashArray: number;
    dashOffset: number;
    dashRatio: number;
    transparent: boolean;
    depthWrite: boolean;
    resolution: THREE.Vector2;
    side: THREE.Side;
  }
}

declare module 'three/examples/jsm/utils/BufferGeometryUtils.js' {
  export * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
}
