import * as THREE from 'three';
import type { PolarityCharge } from './state';

export type IonKind = PolarityCharge;

export interface Magnet {
  id: string;
  pos: THREE.Vector3;
  charge: PolarityCharge;
}

export interface Ion {
  id: string;
  pos: THREE.Vector3;
  kind: IonKind;
}

export interface Spike {
  id: string;
  pos: THREE.Vector3;
}
