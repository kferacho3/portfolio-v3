'use client';

import React from 'react';
import { useSnapshot } from 'valtio';
import { polarityState } from '../state';
import { ScenePostFX } from './ScenePostFX';

export const PolarityPost: React.FC = () => {
  const s = useSnapshot(polarityState);
  const boost =
    (s.burstReady ? 0.9 : 0) +
    Math.min(0.9, (s.combo / 24) * 0.6) +
    (s.zoneActive ? 0.35 : 0) +
    (s.slowMoTime > 0 ? 0.25 : 0);
  return <ScenePostFX boost={boost} />;
};
