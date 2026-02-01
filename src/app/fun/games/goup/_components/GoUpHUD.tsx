'use client';

import { Html } from '@react-three/drei';
import React from 'react';
import { useSnapshot } from 'valtio';
import { goUpState } from '../state';
import type { Arena } from '../types';

export const GoUpHUD: React.FC<{ arena: Arena }> = ({ arena }) => {
  const snap = useSnapshot(goUpState);
  const isDark = arena.id === 'ember' || arena.id === 'violet';
  const textColor = isDark ? '#f3efe6' : '#111';
  const textShadow = isDark
    ? '0 1px 3px rgba(0,0,0,0.6)'
    : '0 1px 0 rgba(255,255,255,0.8)';

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          color: textColor,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          textShadow,
        }}
      >
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            letterSpacing: 1.5,
            fontWeight: 600,
          }}
        >
          GO UP
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: 0.5,
            marginTop: 2,
          }}
        >
          {snap.score}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          <span style={{ marginRight: 12 }}>Gems {snap.gems}</span>
          {snap.phase === 'playing' && snap.spikesAvoided > 0 && (
            <span style={{ marginRight: 12, color: '#e65100' }}>
              Spikes +{snap.spikesAvoided}
            </span>
          )}
          <span>Best {snap.best}</span>
        </div>
      </div>
    </Html>
  );
};
