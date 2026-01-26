'use client';

import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { useSnapshot } from 'valtio';

import { BALL_SKINS, KNOT_HOP_TITLE, PLATFORM_THEMES } from '../constants';
import { knotHopState } from '../state';

const font = `'system-ui', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;

function diamondStyle(size = 12): CSSProperties {
  return {
    width: size,
    height: size,
    transform: 'rotate(45deg)',
    display: 'inline-block',
    borderRadius: 2,
    background:
      'linear-gradient(135deg, #FB7185 0%, #A78BFA 50%, #38BDF8 100%)',
    boxShadow:
      '0 0 14px rgba(167,139,250,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
  };
}

function buttonStyle(primary = false): CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 12,
    border: primary ? 'none' : '1px solid rgba(147,197,253,0.3)',
    background: primary
      ? 'linear-gradient(165deg, #3B82F6 0%, #2563EB 100%)'
      : 'rgba(255,255,255,0.85)',
    color: primary ? 'white' : 'rgba(30,58,138,0.9)',
    fontFamily: font,
    fontWeight: 900,
    letterSpacing: 0.3,
    cursor: 'pointer',
    boxShadow: primary
      ? '0 4px 14px rgba(59,130,246,0.35)'
      : '0 1px 3px rgba(0,0,0,0.04)',
  };
}

export function KnotHopUI() {
  const snap = useSnapshot(knotHopState);

  const ballDef = useMemo(
    () => BALL_SKINS.find((b) => b.id === snap.selectedBall) ?? BALL_SKINS[0],
    [snap.selectedBall]
  );

  const themeDef = useMemo(
    () =>
      PLATFORM_THEMES.find((t) => t.id === snap.selectedTheme) ??
      PLATFORM_THEMES[0],
    [snap.selectedTheme]
  );

  const unlockedBalls = snap.unlockedBalls;
  const unlockedThemes = snap.unlockedThemes;

  const ballIdx = Math.max(0, unlockedBalls.indexOf(snap.selectedBall));
  const prevBall =
    unlockedBalls[(ballIdx - 1 + unlockedBalls.length) % unlockedBalls.length];
  const nextBall = unlockedBalls[(ballIdx + 1) % unlockedBalls.length];

  const themeIdx = Math.max(0, unlockedThemes.indexOf(snap.selectedTheme));
  const prevTheme =
    unlockedThemes[
      (themeIdx - 1 + unlockedThemes.length) % unlockedThemes.length
    ];
  const nextTheme = unlockedThemes[(themeIdx + 1) % unlockedThemes.length];

  const displayGems = snap.totalGems + snap.runGems;
  const toastVisible = snap.toast && Date.now() < snap.toastUntil;

  return (
    <Html fullscreen>
      <style>{`
        @keyframes knothop-pop {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
          100% { transform: translate3d(0, -28px, 0) scale(1.05); opacity: 0; }
        }
      `}</style>

      {/* HUD */}
      {snap.phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            fontFamily: font,
            color: 'white',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 26,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: 0.8,
              color: 'rgba(30,58,138,0.92)',
              textShadow:
                '0 2px 0 rgba(255,255,255,0.9), 0 12px 32px rgba(59,130,246,0.2), 0 0 40px rgba(147,197,253,0.15)',
            }}
          >
            {snap.score}
          </div>

          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 16,
              fontWeight: 900,
              color: 'rgba(0,0,0,0.8)',
            }}
          >
            <span>{displayGems}</span>
            <span style={diamondStyle(12)} />
          </div>

          {toastVisible && (
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                left: 0,
                right: 0,
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.75)',
                  border: '1px solid rgba(0,0,0,0.12)',
                  color: 'rgba(0,0,0,0.85)',
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {snap.toast}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Menu / Game Over */}
      {snap.phase !== 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontFamily: font,
            color: 'rgba(0,0,0,0.85)',
          }}
        >
          <div
            style={{
              width: 420,
              maxWidth: '92vw',
              padding: '20px 20px 18px',
              borderRadius: 20,
              background:
                'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.9) 100%)',
              border: '1px solid rgba(147,197,253,0.35)',
              boxShadow:
                '0 25px 60px rgba(59,130,246,0.08), 0 8px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
              }}
            >
              <div
                style={{ fontSize: 26, fontWeight: 1000, letterSpacing: 0.6 }}
              >
                {KNOT_HOP_TITLE}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Space to hop · click platform to change direction
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 14 }}>
                Best: <span style={{ fontWeight: 1000 }}>{snap.best}</span>
              </div>
              <div
                style={{
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Gems: <span style={{ fontWeight: 1000 }}>{displayGems}</span>
                <span style={diamondStyle(11)} />
              </div>
              <div style={{ fontSize: 14 }}>
                Unlocked:{' '}
                <span style={{ fontWeight: 1000 }}>{unlockedBalls.length}</span>
                /{BALL_SKINS.length}
              </div>
            </div>

            {snap.phase === 'gameover' && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>Run score</div>
                <div style={{ fontSize: 34, fontWeight: 1000 }}>
                  {snap.score}
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Ball</div>
                    <div style={{ fontSize: 18, fontWeight: 1000 }}>
                      {ballDef.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={buttonStyle(false)}
                      onClick={() => knotHopState.setBall(prevBall)}
                    >
                      ◀
                    </button>
                    <button
                      style={buttonStyle(false)}
                      onClick={() => knotHopState.setBall(nextBall)}
                    >
                      ▶
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Platform</div>
                    <div style={{ fontSize: 18, fontWeight: 1000 }}>
                      {themeDef.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={buttonStyle(false)}
                      onClick={() => knotHopState.setTheme(prevTheme)}
                    >
                      ◀
                    </button>
                    <button
                      style={buttonStyle(false)}
                      onClick={() => knotHopState.setTheme(nextTheme)}
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  style={{ ...buttonStyle(true), flex: 1, minWidth: 140 }}
                  onClick={() => knotHopState.start()}
                >
                  {snap.phase === 'gameover' ? 'Try Again' : 'Play'}
                </button>

                <button
                  style={{
                    ...buttonStyle(false),
                    flex: 1,
                    minWidth: 140,
                    opacity: snap.totalGems >= 60 ? 1 : 0.5,
                  }}
                  onClick={() => knotHopState.unlockRandomBall()}
                >
                  Unlock Ball (60)
                </button>

                <button
                  style={{
                    ...buttonStyle(false),
                    flex: 1,
                    minWidth: 140,
                    opacity: snap.totalGems >= 80 ? 1 : 0.5,
                  }}
                  onClick={() => knotHopState.unlockRandomTheme()}
                >
                  Unlock Platform (80)
                </button>
              </div>

              <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.72 }}>
                Space to hop. Platforms twist—click the one you&apos;re on to
                flip its spin. Land on the next platform, collect gems,
                don&apos;t fall.
              </div>

              {toastVisible && (
                <div style={{ fontSize: 12, opacity: 0.95 }}>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: 'rgba(0,0,0,0.06)',
                    }}
                  >
                    {snap.toast}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Html>
  );
}
