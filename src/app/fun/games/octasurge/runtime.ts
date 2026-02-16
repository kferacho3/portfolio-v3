import { create } from 'zustand';

import type { OctaCameraMode, OctaSurgeMode } from './types';

export type OctaRuntimeState = {
  mode: OctaSurgeMode;
  cameraMode: OctaCameraMode;
  setMode: (mode: OctaSurgeMode) => void;
  setCameraMode: (cameraMode: OctaCameraMode) => void;
};

export const useOctaRuntimeStore = create<OctaRuntimeState>((set) => ({
  mode: 'classic',
  cameraMode: 'chase',
  setMode: (mode) => set({ mode }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
}));
