'use client';

import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { useSnapshot } from 'valtio';

import { OCTA_FLUX_TITLE, RIDER_SKINS } from '../constants';
import { octaFluxState } from '../state';

const font = `'system-ui', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;

const panel: CSSProperties = {
  width: 430,
  maxWidth: '92vw',
  padding: '18px 18px 16px',
  borderRadius: 16,
  background: 'rgba(10,10,16,0.72)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.65)',
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

export function OctaFluxUI() {
  const snap = useSnapshot(octaFluxState);

  const riderDef = useMemo(
    () => RIDER_SKINS.find((r) => r.id === snap.selectedRider) ?? RIDER_SKINS[0],
    [snap.selectedRider],
  );

  const unlockedRiders = snap.unlockedRiders;
  const riderIdx = Math.max(0, unlockedRiders.indexOf(snap.selectedRider));
  const prevRider = unlockedRiders[(riderIdx - 1 + unlockedRiders.length) % unlockedRiders.length];
  const nextRider = unlockedRiders[(riderIdx + 1) % unlockedRiders.length];

  return (
    <Html fullscreen>
      {/* HUD */}
      {snap.phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            fontFamily: font,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: 22,
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: 0.5,
              color: 'rgba(255,255,255,0.95)',
              textShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            {snap.score}
          </div>

          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 900,
              fontSize: 14,
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            <span>{snap.runGems}</span>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                transform: 'rotate(45deg)',
                background: 'linear-gradient(135deg, #22D3EE 0%, #F472B6 100%)',
                boxShadow: '0 0 10px rgba(34,211,238,0.6)',
              }}
            />
          </div>
        </div>
      )}

      {snap.phase !== 'playing' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 0.6 }}>{OCTA_FLUX_TITLE}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Infinite run</div>
            </div>

            <div style={{ marginTop: 10, fontSize: 14, opacity: 0.9, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div>
                Best: <span style={{ fontWeight: 900 }}>{snap.best}</span>
              </div>
              <div>
                Total Gems: <span style={{ fontWeight: 900 }}>{snap.totalGems}</span>
              </div>
              <div>
                Riders: <span style={{ fontWeight: 900 }}>{unlockedRiders.length}</span>/{RIDER_SKINS.length}
              </div>
            </div>

            {snap.phase === 'gameover' && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 13, opacity: 0.9 }}>Run score</div>
                <div style={{ fontSize: 34, fontWeight: 900, marginTop: 4 }}>{snap.score}</div>
              </div>
            )}

            <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Rider</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        background: riderDef.color,
                        boxShadow: `0 0 10px ${riderDef.color}99`,
                      }}
                    />
                    <span style={{ fontSize: 18, fontWeight: 900 }}>{riderDef.name}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btn} onClick={() => octaFluxState.setRider(prevRider)}>
                    ◀
                  </button>
                  <button style={btn} onClick={() => octaFluxState.setRider(nextRider)}>
                    ▶
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  style={{
                    ...btn,
                    flex: 1,
                    minWidth: 140,
                    background: 'linear-gradient(135deg, rgba(34,211,238,0.35), rgba(244,63,94,0.25))',
                  }}
                  onClick={() => octaFluxState.start()}
                >
                  {snap.phase === 'gameover' ? 'Try Again' : 'Play'}
                </button>

                <button
                  style={{
                    ...btn,
                    flex: 1,
                    minWidth: 140,
                    opacity: snap.totalGems >= 120 ? 1 : 0.5,
                  }}
                  onClick={() => octaFluxState.unlockRandomRider()}
                >
                  Unlock Rider (120)
                </button>
              </div>

              <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.8 }}>
                Rotate the tunnel to dodge bumps and holes.
                <br />
                <b>Drag</b> left/right or use <b>A/D</b> / <b>←/→</b>. Collect gems to unlock new riders.
              </div>
            </div>
          </div>
        </div>
      )}
    </Html>
  );
}
