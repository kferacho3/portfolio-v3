'use client';

import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import { useSnapshot } from 'valtio';

import { GAME, OCTA_SURGE_TITLE } from '../constants';
import { octaSurgeState } from '../state';
import type { OctaFxLevel, OctaSurgeMode } from '../types';

const font =
  "'Avenir Next', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

const buttonBase: CSSProperties = {
  borderRadius: 12,
  padding: '10px 14px',
  border: '1px solid rgba(255,255,255,0.22)',
  color: 'white',
  fontFamily: font,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0.3,
  cursor: 'pointer',
  transition: 'all 120ms ease-out',
};

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
            textShadow: '0 10px 26px rgba(2,6,23,0.6)',
          }}
        >
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
            <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1 }}>
              {Math.floor(snap.score)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.94 }}>
              Combo x{Math.max(1, snap.combo)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.86 }}>
              Speed {snap.speed.toFixed(1)}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              display: 'grid',
              gap: 6,
              textAlign: 'right',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <div>Gems +{snap.runGems}</div>
            <div>Boost +{snap.runBoost}</div>
            <div>Shield +{snap.runShield}</div>
            <div>Near Miss +{snap.runNearMisses}</div>
            <div style={{ marginTop: 4, opacity: 0.92 }}>
              {snap.boostActive ? 'BOOST LIVE' : 'BOOST OFF'}
            </div>
            <div style={{ opacity: 0.9 }}>
              {snap.prismActive ? 'PRISM x2' : snap.magnetActive ? 'MAGNET' : snap.phaseActive ? 'PHASE' : 'POWER READY'}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 18,
              right: 18,
              bottom: 18,
              maxWidth: 520,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                marginBottom: 6,
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Surge {Math.round(snap.surgeMeter)}%</span>
              <span>{Math.round(snap.progress * 100)}%</span>
            </div>
            <div
              style={{
                height: 11,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.24)',
                background: 'rgba(255,255,255,0.14)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, snap.surgeMeter))}%`,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #67e8f9 0%, #60a5fa 42%, #a78bfa 100%)',
                }}
              />
            </div>
          </div>
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
              'radial-gradient(circle at 12% 18%, rgba(45,212,191,0.16), transparent 45%), radial-gradient(circle at 82% 82%, rgba(192,132,252,0.2), transparent 50%)',
          }}
        >
          <div
            style={{
              width: 560,
              maxWidth: '94vw',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(2, 6, 23, 0.76)',
              boxShadow: '0 30px 72px rgba(2,6,23,0.62)',
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
              <div style={{ fontSize: 31, fontWeight: 900 }}>
                {OCTA_SURGE_TITLE}
              </div>
              <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700 }}>
                8-Lane Hyper Tunnel
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                lineHeight: 1.46,
                opacity: 0.92,
              }}
            >
              Snap lanes with <strong>Left / Right</strong>, flip with{' '}
              <strong>Up</strong>, hold <strong>Space</strong> for surge
              slow-time. Hit speed pads, chain near misses, and stack power-ups
              for huge score spikes.
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
                        ? 'linear-gradient(135deg, rgba(45,212,191,0.38), rgba(168,85,247,0.38))'
                        : 'rgba(255,255,255,0.06)',
                      boxShadow: active
                        ? '0 0 0 1px rgba(255,255,255,0.33) inset'
                        : 'none',
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
                  borderColor: 'rgba(255,255,255,0.28)',
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
              <div>Total Gems: {snap.totalGems}</div>
              <div>Total Boost: {snap.totalBoost}</div>
              <div>Total Magnet: {snap.totalMagnet}</div>
              <div>Total Prism: {snap.totalPrism}</div>
            </div>

            {snap.phase === 'gameover' && (
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  fontSize: 13,
                  lineHeight: 1.54,
                }}
              >
                Run Ended · Score <strong>{Math.floor(snap.score)}</strong> ·
                Near Miss +{snap.runNearMisses} · Powerups +{snap.runBoost + snap.runShield + snap.runMagnet + snap.runPrism + snap.runPhase} · Progress{' '}
                {Math.round(snap.progress * 100)}%
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
                  'linear-gradient(135deg, rgba(45,212,191,0.42), rgba(168,85,247,0.4))',
                borderColor: 'rgba(255,255,255,0.32)',
                fontSize: 14,
              }}
            >
              {snap.phase === 'menu' ? 'Launch Run' : 'Restart Run'}
            </button>

            <div style={{ marginTop: 10, fontSize: 11, opacity: 0.68 }}>
              Classic and Daily are {GAME.classicRunSeconds}s sprints. Endless
              runs until collision.
            </div>
          </div>
        </div>
      )}
    </Html>
  );
}
