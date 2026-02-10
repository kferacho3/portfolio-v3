'use client';

import { Html } from '@react-three/drei';
import React from 'react';
import { useSnapshot } from 'valtio';
import { goUpState } from '../state';
import type { Arena } from '../types';

export const GoUpHUD: React.FC<{ arena: Arena }> = ({ arena }) => {
  const snap = useSnapshot(goUpState);
  const bg = arena.background.replace('#', '');
  const isDark = parseInt(bg.slice(0, 2), 16) < 120;
  const textColor = isDark ? '#faf9ff' : '#111';
  const subColor = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.6)';

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          color: textColor,
          fontFamily: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif',
          textAlign: 'center',
          minWidth: 220,
        }}
      >
        <div
          style={{
            fontSize: 12,
            opacity: 0.6,
            letterSpacing: 2.4,
            fontWeight: 700,
          }}
        >
          SCORE
        </div>
        <div
          style={{
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: -1,
            lineHeight: 0.96,
            marginTop: 3,
          }}
        >
          {snap.score}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          <span style={{ marginRight: 12, color: subColor }}>Gems {snap.gems}</span>
          {snap.spikesAvoided > 0 && (
            <span style={{ marginRight: 12, color: subColor }}>
              Spikes {snap.spikesAvoided}
            </span>
          )}
          {snap.multiplier > 1 && (
            <span style={{ marginRight: 12, color: subColor }}>
              x{snap.multiplier}
            </span>
          )}
          <span style={{ color: subColor }}>Best {snap.best}</span>
        </div>
      </div>
    </Html>
  );
};
