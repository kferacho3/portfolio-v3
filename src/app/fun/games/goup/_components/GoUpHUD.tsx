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
  const textColor = isDark ? '#f5f8ff' : '#0f1318';
  const subColor = isDark ? 'rgba(236,243,255,0.78)' : 'rgba(13,18,24,0.74)';
  const scoreShadow = isDark
    ? '0 6px 20px rgba(0,0,0,0.5)'
    : '0 6px 18px rgba(0,0,0,0.2)';

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          color: textColor,
          fontFamily: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif',
          textAlign: 'center',
          minWidth: 220,
          textShadow: scoreShadow,
        }}
      >
        <div
          style={{
            fontSize: 12,
            opacity: 0.88,
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
            WebkitTextStroke: isDark ? '0px transparent' : '1px rgba(255,255,255,0.16)',
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
