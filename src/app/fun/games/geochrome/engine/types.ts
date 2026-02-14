import type {
  InstancedRigidBodyProps,
  RapierRigidBody,
} from '@react-three/rapier';
import type * as THREE from 'three';
import type { MutableRefObject } from 'react';
import type { WorldTierName } from './constants';

export interface InputState {
  forward: number;
  right: number;
  boost: boolean;
}

export interface PickupToast {
  id: number;
  label: string;
  color: string;
  size: number;
}

export interface WorldInstanceMeta {
  name: string;
  size: number;
  volume: number;
  tier: WorldTierName;
  color: string;
}

export interface WorldRuntimeData {
  seed: number;
  count: number;
  instances: InstancedRigidBodyProps[];
  shapeParams: Float32Array;
  colors: Float32Array;
  visualScales: Float32Array;
  metadata: WorldInstanceMeta[];
}

export interface StuckAttributeBuffers {
  shapeParams: Float32Array;
  colors: Float32Array;
  visualScales: Float32Array;
  shapeAttr: THREE.InstancedBufferAttribute;
  colorAttr: THREE.InstancedBufferAttribute;
  scaleAttr: THREE.InstancedBufferAttribute;
}

export interface CollectResult {
  index: number;
  stuckIndex: number;
  label: string;
  color: string;
  size: number;
  radius: number;
  position: [number, number, number];
}

export type WorldBodyRef = MutableRefObject<(RapierRigidBody | null)[] | null>;
