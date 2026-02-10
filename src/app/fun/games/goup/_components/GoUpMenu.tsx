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

  const trackModes: Array<{ key: typeof snap.trackMode; label: string }> = [
    { key: 'auto', label: 'Auto' },
    { key: 'classic', label: 'Classic' },
    { key: 'curved', label: 'Curved' },
    { key: 'spiral', label: 'Spiral' },
    { key: 'mix', label: 'Mix' },
  ];
  const pathSkins: Array<{ key: typeof snap.pathSkin; label: string }> = [
    { key: 'sleek', label: 'Sleek' },
    { key: 'neon', label: 'Neon' },
    { key: 'velvet', label: 'Velvet' },
  ];
  const qualityModes: Array<{ key: typeof snap.quality; label: string }> = [
    { key: 'auto', label: 'Auto' },
    { key: 'high', label: 'High' },
    { key: 'low', label: 'Low' },
  ];

  const getCrashMessage = () => {
    switch (snap.crashType) {
      case 'riser':
        return 'Riser hit!';
      case 'spike':
        return 'Spiked!';
      case 'hit':
        return 'Hit obstacle!';
      case 'fell':
        return 'Missed step!';
      default:
        return 'Game Over';
    }
  };

  const pillStyle = (selected: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: 999,
    border: selected ? '1px solid rgba(255,255,255,0.88)' : '1px solid rgba(255,255,255,0.2)',
    background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(6,10,14,0.46)',
    color: selected ? '#f8fbff' : 'rgba(236,243,252,0.84)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    cursor: 'pointer',
  });

  const headerColor = 'rgba(236,243,252,0.94)';
  const subtleColor = 'rgba(206,218,232,0.72)';
  const sectionColor = 'rgba(160,180,202,0.7)';

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            background: 'rgba(9,14,20,0.78)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 18,
            padding: '16px 18px',
            width: 420,
            textAlign: 'center',
            boxShadow: '0 20px 44px rgba(0,0,0,0.34)',
            backdropFilter: 'blur(6px)',
            pointerEvents: 'auto',
            fontFamily: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif',
            color: headerColor,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div style={{ fontSize: 52, fontWeight: 600, letterSpacing: -0.8 }}>
            Go Up
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: -0.8,
              lineHeight: 1,
              opacity: snap.phase === 'gameover' ? 1 : 0.9,
              display: snap.phase === 'gameover' ? 'block' : 'none',
              color: '#ffffff',
            }}
          >
            {snap.phase === 'gameover' ? snap.score : ''}
          </div>
          <div
            style={{
              marginTop: snap.phase === 'gameover' ? 10 : 18,
              fontSize: 14,
              opacity: 0.92,
              letterSpacing: 0.4,
              color: snap.phase === 'gameover' ? '#ff8f8f' : subtleColor,
            }}
          >
            {snap.phase === 'gameover' ? getCrashMessage() : 'TAP TO PLAY'}
          </div>

          <div style={{ marginTop: 18, fontSize: 11, letterSpacing: 1.9, color: sectionColor }}>
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
            <button type="button" onClick={() => onArenaPick('auto')} style={pillStyle(snap.arenaMode === 'auto')}>
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
                    ...pillStyle(isSelected),
                    background: `linear-gradient(135deg, ${option.skyTop}, ${option.skyBottom})`,
                    color: darkText ? '#fff' : '#111',
                    textShadow: darkText
                      ? '0 1px 2px rgba(0,0,0,0.4)'
                      : '0 1px 0 rgba(255,255,255,0.5)',
                  }}
                >
                  {option.name}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, letterSpacing: 1.9, color: sectionColor }}>
            TRACK STYLE
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
            }}
          >
            <button type="button" style={pillStyle(true)}>
              Apex Tiles
            </button>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, letterSpacing: 1.9, color: sectionColor }}>
            TRACK SHAPE
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
            {trackModes.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => goUpState.setTrackMode(mode.key)}
                style={pillStyle(snap.trackMode === mode.key)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, letterSpacing: 1.9, color: sectionColor }}>
            SKIN
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
            {pathSkins.map((skin) => (
              <button
                key={skin.key}
                type="button"
                onClick={() => goUpState.setPathSkin(skin.key)}
                style={pillStyle(snap.pathSkin === skin.key)}
              >
                {skin.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, letterSpacing: 1.9, color: sectionColor }}>
            QUALITY
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
            {qualityModes.map((quality) => (
              <button
                key={quality.key}
                type="button"
                onClick={() => goUpState.setQuality(quality.key)}
                style={pillStyle(snap.quality === quality.key)}
              >
                {quality.label}
              </button>
            ))}
          </div>

          {snap.phase === 'gameover' && (
            <div
              style={{
                marginTop: 16,
                padding: '14px 18px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 14,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ff8f8f' }}>
                Retry
              </div>
              <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: '#ffffff' }}>
                Score: {snap.score}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: subtleColor }}>
                Gems: {snap.gems} • Gaps: {snap.gapsJumped} • Steps: {snap.wallsClimbed} • Spikes: {snap.spikesAvoided}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: subtleColor }}>
                Combo x{snap.multiplier} • Near Misses {snap.nearMisses}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: subtleColor,
              lineHeight: 1.5,
            }}
          >
            Auto-run is on. Tap to clear walls, spikes, and gaps.
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: sectionColor }}>
            Tap anywhere to play
          </div>
        </div>
      </div>
    </Html>
  );
};
