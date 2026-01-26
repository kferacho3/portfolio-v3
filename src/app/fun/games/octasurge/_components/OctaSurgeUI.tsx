'use client';

import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import { useSnapshot } from 'valtio';

import { GAME, OCTA_SURGE_TITLE } from '../constants';
import { octaSurgeState } from '../state';

const font = `'system-ui', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;

const panel: CSSProperties = {
  width: 420,
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
  border: '1px solid rgba(255,255,255,0.20)',
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

  return (
    <Html fullscreen>
      {/* HUD */}
      {snap.phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            fontFamily: font,
            color: 'rgba(255,255,255,0.95)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 22,
              left: 22,
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: 0.3,
              textShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            {percent}%
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
            }}
          >
            <span title="Collectibles this run">
              <span style={{ color: '#FBBF24' }}>◆</span> {snap.runCollectibles}
            </span>
            <span title="Special this run">
              <span style={{ color: '#A78BFA' }}>◆</span> {snap.runSpecial}
            </span>
          </div>
        </div>
      )}

      {snap.phase !== 'playing' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 0.6 }}>{OCTA_SURGE_TITLE}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{GAME.runSeconds}s run</div>
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 14, opacity: 0.9, flexWrap: 'wrap' }}>
              <span>Best: <span style={{ fontWeight: 900 }}>{bestPercent}%</span></span>
              <span><span style={{ color: '#FBBF24' }}>◆</span> <span style={{ fontWeight: 900 }}>{snap.totalCollectibles}</span></span>
              <span><span style={{ color: '#A78BFA' }}>◆</span> <span style={{ fontWeight: 900 }}>{snap.totalSpecial}</span></span>
            </div>

            {snap.phase === 'gameover' && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 14, opacity: 0.9 }}>Progress</div>
                <div style={{ fontSize: 34, fontWeight: 900, marginTop: 4 }}>{percent}%</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 13, opacity: 0.85 }}>
                  <span><span style={{ color: '#FBBF24' }}>◆</span> +{snap.runCollectibles}</span>
                  <span><span style={{ color: '#A78BFA' }}>◆</span> +{snap.runSpecial}</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <button
                style={{
                  ...btn,
                  background: 'linear-gradient(135deg, rgba(34,211,238,0.35), rgba(250,204,21,0.20))',
                }}
                onClick={() => octaSurgeState.start()}
              >
                {snap.phase === 'gameover' ? 'Try Again' : 'Play'}
              </button>

              <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.82 }}>
                Rotate the tunnel to dodge bumps and holes. Grab <span style={{ color: '#FBBF24' }}>◆</span> collectibles and <span style={{ color: '#A78BFA' }}>◆</span> specials (hard but achievable). Speed increases over time.
                <br />
                <b>Drag</b> left/right or <b>A/D</b> / <b>←/→</b>. Survive {GAME.runSeconds}s.
              </div>
            </div>
          </div>
        </div>
      )}
    </Html>
  );
}
