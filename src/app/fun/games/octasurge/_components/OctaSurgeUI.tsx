'use client';

import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import { useSnapshot } from 'valtio';

import { GAME, OCTA_SURGE_TITLE } from '../constants';
import { octaSurgeState } from '../state';

const font = `'system-ui', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;

const panel: CSSProperties = {
  width: 450,
  maxWidth: '92vw',
  padding: '18px 18px 16px',
  borderRadius: 16,
  background: 'rgba(0,0,0,0.55)',
  border: '1px solid rgba(255,255,255,0.15)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
  color: 'white',
};

const btn: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontFamily: font,
  fontWeight: 900,
  cursor: 'pointer',
};

export function OctaSurgeUI() {
  const snap = useSnapshot(octaSurgeState);

  const percent = (snap.progress * 100).toFixed(2);
  const bestPercent = (snap.best * 100).toFixed(2);
  const score = Math.floor(snap.score);
  const bestScore = Math.floor(snap.bestScore);
  const surgePct = Math.max(0, Math.min(100, snap.surgeMeter));

  return (
    <Html fullscreen>
      {snap.phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            fontFamily: font,
            color: 'rgba(255,255,255,0.96)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 22,
              left: 22,
              display: 'grid',
              gap: 5,
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: 0.2,
              textShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 900 }}>{score}</div>
            <div>Progress {percent}%</div>
            <div>Combo x{Math.max(1, snap.combo)}</div>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 22,
              right: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontWeight: 900,
              fontSize: 14,
              textShadow: '0 8px 24px rgba(0,0,0,0.35)',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <span title="Collectibles this run">
              <span style={{ color: '#FBBF24' }}>◆</span> {snap.runCollectibles}
            </span>
            <span title="Specials this run">
              <span style={{ color: '#A78BFA' }}>◆</span> {snap.runSpecial}
            </span>
            <span title="Speed boosters">
              <span style={{ color: '#F97316' }}>◆</span> {snap.runBoost}
            </span>
            <span title="Shield charges">
              <span style={{ color: '#2DD4BF' }}>◆</span> {snap.shieldCharges}
            </span>
            {snap.boostActive && (
              <span title="Speed boost active">
                <span style={{ color: '#FB7185' }}>BOOST</span>
              </span>
            )}
          </div>

          <div
            style={{
              position: 'absolute',
              left: 22,
              right: 22,
              bottom: 24,
              maxWidth: 420,
            }}
          >
            <div
              style={{
                fontSize: 11,
                marginBottom: 6,
                opacity: 0.86,
                fontWeight: 700,
              }}
            >
              Surge {Math.round(surgePct)}%
            </div>
            <div
              style={{
                height: 9,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.14)',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <div
                style={{
                  width: `${surgePct}%`,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #22d3ee 0%, #60a5fa 45%, #a78bfa 100%)',
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
          }}
        >
          <div style={panel}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
              }}
            >
              <div
                style={{ fontSize: 26, fontWeight: 900, letterSpacing: 0.6 }}
              >
                {OCTA_SURGE_TITLE}
              </div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                {GAME.runSeconds}s run
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 16,
                fontSize: 14,
                opacity: 0.9,
                flexWrap: 'wrap',
              }}
            >
              <span>
                Best Progress:{' '}
                <span style={{ fontWeight: 900 }}>{bestPercent}%</span>
              </span>
              <span>
                Best Score: <span style={{ fontWeight: 900 }}>{bestScore}</span>
              </span>
              <span>
                <span style={{ color: '#FBBF24' }}>◆</span>{' '}
                <span style={{ fontWeight: 900 }}>
                  {snap.totalCollectibles}
                </span>
              </span>
              <span>
                <span style={{ color: '#A78BFA' }}>◆</span>{' '}
                <span style={{ fontWeight: 900 }}>{snap.totalSpecial}</span>
              </span>
              <span>
                <span style={{ color: '#F97316' }}>◆</span>{' '}
                <span style={{ fontWeight: 900 }}>{snap.totalBoost}</span>
              </span>
              <span>
                <span style={{ color: '#2DD4BF' }}>◆</span>{' '}
                <span style={{ fontWeight: 900 }}>{snap.totalShield}</span>
              </span>
            </div>

            {snap.phase === 'gameover' && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ fontSize: 14, opacity: 0.9 }}>Run Summary</div>
                <div style={{ fontSize: 34, fontWeight: 900, marginTop: 4 }}>
                  {score}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    gap: 12,
                    fontSize: 13,
                    opacity: 0.85,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{percent}%</span>
                  <span>
                    <span style={{ color: '#FBBF24' }}>◆</span> +
                    {snap.runCollectibles}
                  </span>
                  <span>
                    <span style={{ color: '#A78BFA' }}>◆</span> +
                    {snap.runSpecial}
                  </span>
                  <span>
                    <span style={{ color: '#F97316' }}>◆</span> +{snap.runBoost}
                  </span>
                  <span>
                    <span style={{ color: '#2DD4BF' }}>◆</span> +
                    {snap.runShield}
                  </span>
                  <span>Near misses +{snap.runNearMisses}</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <button
                style={{
                  ...btn,
                  background:
                    'linear-gradient(135deg, rgba(34,211,238,0.35), rgba(250,204,21,0.20))',
                }}
                onClick={() => octaSurgeState.start()}
              >
                {snap.phase === 'gameover' ? 'Run It Back' : 'Play'}
              </button>

              <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.82 }}>
                Rotate the tunnel to dodge bumps, holes, and wide wedge blocks.
                Grab <span style={{ color: '#FBBF24' }}>◆</span> collectibles
                and <span style={{ color: '#A78BFA' }}>◆</span> specials for
                combo multipliers. Orange{' '}
                <span style={{ color: '#F97316' }}>◆</span> triggers speed
                boost. Teal <span style={{ color: '#2DD4BF' }}>◆</span> grants a
                shield.
                <br />
                <b>Drag</b> or <b>A/D</b> / <b>←/→</b> to rotate. Hold{' '}
                <b>Space</b> to spend surge energy and slow time for clutch
                dodges.
              </div>
            </div>
          </div>
        </div>
      )}
    </Html>
  );
}
