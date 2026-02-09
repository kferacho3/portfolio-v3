'use client';

import { Html } from '@react-three/drei';
import React from 'react';
import { useSnapshot } from 'valtio';
import { goUpState } from '../state';
import { ARENAS } from '../arenas';

export const GoUpMenu: React.FC<{
  onArenaPick: (index: number | 'auto') => void;
}> = ({ onArenaPick }) => {
  const snap = useSnapshot(goUpState);

  if (snap.phase !== 'menu' && snap.phase !== 'gameover') return null;

  const getCrashMessage = () => {
    switch (snap.crashType) {
      case 'riser':
        return 'Riser hit!';
      case 'fell':
        return 'Missed step!';
      default:
        return 'Game Over';
    }
  };

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 20,
            padding: '22px 26px',
            width: 360,
            textAlign: 'center',
            boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
            pointerEvents: 'auto',
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 3 }}>
            Go Up
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              opacity: 0.65,
              lineHeight: 1.5,
            }}
          >
            Tap to jump • Time the risers • Clear gaps
          </div>

          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              letterSpacing: 1.5,
              opacity: 0.55,
            }}
          >
            ARENAS
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => onArenaPick('auto')}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border:
                  snap.arenaMode === 'auto'
                    ? '2px solid #111'
                    : '1px solid rgba(0,0,0,0.15)',
                background: 'linear-gradient(135deg, #fff, #f5f5f5)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.5,
                cursor: 'pointer',
              }}
            >
              Auto
            </button>
            {ARENAS.map((option, idx) => {
              const isSelected =
                snap.arenaMode === 'fixed' && snap.arenaIndex === idx;
              const darkText = option.id === 'ember' || option.id === 'violet';
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onArenaPick(idx)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: isSelected
                      ? '2px solid #111'
                      : '1px solid rgba(0,0,0,0.15)',
                    background: `linear-gradient(135deg, ${option.skyTop}, ${option.skyBottom})`,
                    color: darkText ? '#fff' : '#111',
                    textShadow: darkText
                      ? '0 1px 2px rgba(0,0,0,0.4)'
                      : '0 1px 0 rgba(255,255,255,0.5)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    cursor: 'pointer',
                  }}
                >
                  {option.name}
                </button>
              );
            })}
          </div>

          {snap.phase === 'gameover' && (
            <div
              style={{
                marginTop: 16,
                padding: '14px 18px',
                background: 'rgba(0,0,0,0.04)',
                borderRadius: 14,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: '#c62828' }}>
                {getCrashMessage()}
              </div>
              <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>
                Score: {snap.score}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.65 }}>
                Gems: {snap.gems} • Gaps: {snap.gapsJumped} • Steps:{' '}
                {snap.wallsClimbed}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              opacity: 0.6,
              lineHeight: 1.5,
            }}
          >
            One-tap stair climber. Auto-forward up a procedural tower, jump the
            step-ups, and land clean or you crash into the riser.
          </div>

          <div style={{ marginTop: 12, fontSize: 11, opacity: 0.4 }}>
            Tap anywhere to play
          </div>
        </div>
      </div>
    </Html>
  );
};
