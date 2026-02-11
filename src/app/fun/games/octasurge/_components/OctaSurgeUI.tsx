'use client';

import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import { useSnapshot } from 'valtio';

import { GAME, OCTA_SURGE_TITLE } from '../constants';
import { octaSurgeState } from '../state';
import type { OctaFxLevel, OctaSurgeMode } from '../types';

const font =
  "'Avenir Next', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

const modeLabel: Record<OctaSurgeMode, string> = {
  classic: 'Classic',
  endless: 'Endless',
  daily: 'Daily',
};

const fxLabel: Record<OctaFxLevel, string> = {
  full: 'FX Full',
  medium: 'FX Medium',
  low: 'FX Low',
};

const chipStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.22)',
  background: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontSize: 12,
  fontWeight: 700,
  padding: '6px 10px',
};

const buttonBase: CSSProperties = {
  borderRadius: 12,
  padding: '10px 14px',
  border: '1px solid rgba(255,255,255,0.24)',
  color: 'white',
  fontFamily: font,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0.25,
  cursor: 'pointer',
};

export function OctaSurgeUI({
  onStart,
  onSelectMode,
  onCycleFxLevel,
}: {
  onStart: () => void;
  onSelectMode: (mode: OctaSurgeMode) => void;
  onCycleFxLevel: () => void;
}) {
  const snap = useSnapshot(octaSurgeState);
  const runCompleted =
    snap.phase === 'gameover' &&
    snap.crashReason.toLowerCase().includes('run complete');

  const isTimed = snap.mode !== 'endless';
  const runSeconds =
    snap.mode === 'daily' ? GAME.dailyRunSeconds : GAME.classicRunSeconds;
  const secondsLeft = Math.max(0, runSeconds - snap.time);

  return (
    <Html fullscreen>
      {snap.phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            fontFamily: font,
            color: 'rgba(245, 248, 255, 0.98)',
            textShadow: '0 8px 22px rgba(2,6,23,0.65)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: 'rgba(255,255,255,0.15)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, snap.progress * 100))}%`,
                background:
                  'linear-gradient(90deg, #67e8f9 0%, #60a5fa 55%, #a78bfa 100%)',
                transition: 'width 0.18s ease',
              }}
            />
          </div>

          <div
            style={{
              position: 'absolute',
              top: 18,
              left: 18,
              display: 'grid',
              gap: 5,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 800 }}>
              {OCTA_SURGE_TITLE.toUpperCase()} · {modeLabel[snap.mode]}
            </div>
            <div style={{ fontSize: 46, fontWeight: 900, lineHeight: 1 }}>
              {Math.floor(snap.score)}
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 700 }}>
              Best {Math.floor(snap.bestScore)}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              display: 'grid',
              gap: 7,
              justifyItems: 'end',
            }}
          >
            <div style={chipStyle}>Combo x{Math.max(1, snap.combo)}</div>
            <div style={chipStyle}>Speed {snap.speed.toFixed(1)}</div>
            {isTimed ? (
              <div style={chipStyle}>Time {secondsLeft.toFixed(1)}s</div>
            ) : (
              <div style={chipStyle}>Distance Run</div>
            )}
          </div>

          {snap.time < 9 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 22,
                textAlign: 'center',
                fontSize: 13,
                color: 'rgba(255,255,255,0.82)',
                padding: '0 20px',
              }}
            >
              Hold A/D or Left/Right to steer around the ring. Touch: hold left
              or right side.
            </div>
          )}
        </div>
      )}

      {snap.phase !== 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'auto',
            fontFamily: font,
            background:
              'radial-gradient(circle at 15% 14%, rgba(96,165,250,0.16), transparent 44%), radial-gradient(circle at 84% 84%, rgba(167,139,250,0.2), transparent 46%)',
          }}
        >
          <div
            style={{
              width: 540,
              maxWidth: '94vw',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(3, 8, 24, 0.8)',
              boxShadow: '0 30px 72px rgba(2,6,23,0.64)',
              color: 'white',
              padding: '20px 20px 18px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 900 }}>{OCTA_SURGE_TITLE}</div>
              <div style={{ fontSize: 12, opacity: 0.76, fontWeight: 700 }}>
                Space Tunnel Runner
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                lineHeight: 1.48,
                opacity: 0.92,
              }}
            >
              Professional lane collision has been rebuilt around ring-plane
              sweeps. Steer the orb into open segments and maintain flow as the
              tunnel accelerates.
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              {(['classic', 'endless', 'daily'] as const).map((mode) => {
                const active = snap.mode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onSelectMode(mode)}
                    style={{
                      ...buttonBase,
                      background: active
                        ? 'linear-gradient(135deg, rgba(45,212,191,0.36), rgba(96,165,250,0.38))'
                        : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    {modeLabel[mode]}
                  </button>
                );
              })}
              <button
                onClick={onCycleFxLevel}
                style={{
                  ...buttonBase,
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                {fxLabel[snap.fxLevel]}
              </button>
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
                gap: 8,
                fontSize: 12,
                opacity: 0.92,
              }}
            >
              <div>Best Score: {Math.floor(snap.bestScore)}</div>
              <div>Best Combo: x{Math.max(1, snap.bestCombo)}</div>
              <div>Best Classic: {Math.floor(snap.bestClassic)}</div>
              <div>Best Daily: {Math.floor(snap.bestDaily)}</div>
            </div>

            {snap.phase === 'gameover' && (
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: runCompleted
                    ? '1px solid rgba(34,197,94,0.42)'
                    : '1px solid rgba(248,113,113,0.42)',
                  background: runCompleted
                    ? 'rgba(34,197,94,0.12)'
                    : 'rgba(248,113,113,0.12)',
                  fontSize: 13,
                  lineHeight: 1.52,
                }}
              >
                <strong>{runCompleted ? 'Run Complete' : 'Run Failed'}</strong>
                <div style={{ marginTop: 4, opacity: 0.94 }}>
                  {snap.crashReason || 'You hit a closed tunnel segment.'}
                </div>
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                  Score {Math.floor(snap.score)} · Combo x{Math.max(1, snap.combo)}
                  {' · '}Progress {Math.round(snap.progress * 100)}%
                </div>
              </div>
            )}

            <button
              onClick={onStart}
              style={{
                ...buttonBase,
                marginTop: 16,
                width: '100%',
                padding: '12px 16px',
                background:
                  'linear-gradient(135deg, rgba(45,212,191,0.42), rgba(167,139,250,0.4))',
                borderColor: 'rgba(255,255,255,0.32)',
                fontSize: 14,
              }}
            >
              {snap.phase === 'menu' ? 'Start Run' : 'Restart Run'}
            </button>

            <div style={{ marginTop: 10, fontSize: 11, opacity: 0.68 }}>
              Classic and Daily are {GAME.classicRunSeconds}s runs. Endless lasts
              until collision.
            </div>
          </div>
        </div>
      )}
    </Html>
  );
}
