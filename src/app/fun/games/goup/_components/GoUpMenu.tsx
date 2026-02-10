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
      case 'spike':
        return 'Spiked!';
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
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          style={{
            background:
              snap.phase === 'gameover' ? 'rgba(255,255,255,0.9)' : 'transparent',
            border:
              snap.phase === 'gameover'
                ? '1px solid rgba(0,0,0,0.08)'
                : '1px solid transparent',
            borderRadius: 20,
            padding: snap.phase === 'gameover' ? '20px 24px' : '12px 20px',
            width: snap.phase === 'gameover' ? 340 : 420,
            textAlign: 'center',
            boxShadow:
              snap.phase === 'gameover'
                ? '0 14px 34px rgba(0,0,0,0.14)'
                : 'none',
            pointerEvents: 'auto',
            fontFamily: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif',
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div style={{ fontSize: 74, fontWeight: 500, letterSpacing: -1 }}>
            Go Up
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: -0.8,
              lineHeight: 1,
              opacity: snap.phase === 'gameover' ? 1 : 0.92,
              display: snap.phase === 'gameover' ? 'block' : 'none',
            }}
          >
            {snap.phase === 'gameover' ? snap.score : ''}
          </div>
          <div
            style={{
              marginTop: snap.phase === 'gameover' ? 10 : 18,
              fontSize: 16,
              opacity: 0.7,
              letterSpacing: 0.4,
            }}
          >
            {snap.phase === 'gameover' ? getCrashMessage() : 'TAP TO PLAY'}
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: 11,
              letterSpacing: 1.9,
              opacity: 0.52,
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
                    ? '2px solid #111111'
                    : '1px solid rgba(0,0,0,0.16)',
                background: 'rgba(255,255,255,0.78)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.5,
                cursor: 'pointer',
              }}
            >
              Auto
            </button>
            {ARENAS.map((option, idx) => {
              const isSelected =
                snap.arenaMode === 'fixed' && snap.arenaIndex === idx;
              const darkText = option.id === 'violet';
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onArenaPick(idx)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: isSelected
                      ? '2px solid #111111'
                      : '1px solid rgba(0,0,0,0.16)',
                    background: `linear-gradient(135deg, ${option.skyTop}, ${option.skyBottom})`,
                    color: darkText ? '#fff' : '#111',
                    textShadow: darkText
                      ? '0 1px 2px rgba(0,0,0,0.4)'
                      : '0 1px 0 rgba(255,255,255,0.5)',
                    fontSize: 12,
                    fontWeight: 600,
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
                Retry
              </div>
              <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>
                Score: {snap.score}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.65 }}>
                Gems: {snap.gems} • Gaps: {snap.gapsJumped} • Steps:{' '}
                {snap.wallsClimbed} • Spikes: {snap.spikesAvoided}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              opacity: 0.52,
              lineHeight: 1.5,
            }}
          >
            Auto climb the tower. Tap to clear risers, gaps, and spike lines.
          </div>

          <div style={{ marginTop: 12, fontSize: 11, opacity: 0.4 }}>
            Tap anywhere to play
          </div>
        </div>
      </div>
    </Html>
  );
};
