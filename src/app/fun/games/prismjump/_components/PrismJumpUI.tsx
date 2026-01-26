'use client';

import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useSnapshot } from 'valtio';

import { CHARACTERS, PRISM_JUMP_TITLE } from '../constants';
import { prismJumpState } from '../state';

function cubeIconStyle(size = 12): CSSProperties {
  return {
    width: size,
    height: size,
    display: 'inline-block',
    transform: 'rotate(45deg)',
    borderRadius: 2,
    background:
      'linear-gradient(135deg, #67E8F9 0%, #22D3EE 55%, #0EA5E9 100%)',
    boxShadow: '0 0 10px rgba(34,211,238,0.35)',
    marginLeft: 6,
  };
}

function buttonStyle(primary = false): CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.18)',
    background: primary
      ? 'linear-gradient(180deg, rgba(99,102,241,0.92) 0%, rgba(14,165,233,0.82) 100%)'
      : 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 700,
    letterSpacing: 0.2,
    cursor: 'pointer',
    userSelect: 'none',
  };
}

function pillStyle(): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: 'rgba(255,255,255,0.92)',
    fontWeight: 700,
  };
}

export function PrismJumpUI() {
  const snap = useSnapshot(prismJumpState);

  const selectedDef = useMemo(
    () => CHARACTERS.find((c) => c.id === snap.selected) ?? CHARACTERS[0],
    [snap.selected]
  );

  const unlocked = snap.unlocked;
  const selectedIdx = Math.max(0, unlocked.indexOf(snap.selected));
  const prevId =
    unlocked[(selectedIdx - 1 + unlocked.length) % unlocked.length] ??
    unlocked[0];
  const nextId = unlocked[(selectedIdx + 1) % unlocked.length] ?? unlocked[0];

  const cubesDisplay = snap.totalCubes + snap.runCubes;

  const canUnlock =
    snap.totalCubes >= 100 && unlocked.length < CHARACTERS.length;

  const toastVisible = snap.toastUntil > Date.now() && snap.toast.length > 0;

  return (
    <Html fullscreen>
      <style>{`
        @keyframes prismjump-popup {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
          100% { transform: translate3d(0, -32px, 0) scale(1.06); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
      {/* HUD */}
      {snap.phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
          }}
        >
          {/* Danger vignette when close to edge */}
          {snap.edgeSafe < 0.6 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at center, transparent 20%, rgba(251,113,133,${(0.6 - snap.edgeSafe) * 0.7}) 100%)`,
                pointerEvents: 'none',
              }}
            />
          )}
          {/* top-left edge timer bar */}
          <div
            style={{
              position: 'absolute',
              top: 22,
              left: 18,
              width: 180,
              height: 10,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.22)',
              overflow: 'hidden',
              border:
                snap.edgeSafe < 0.4
                  ? '2px solid rgba(251,113,133,0.8)'
                  : '1px solid rgba(255,255,255,0.12)',
              boxShadow:
                snap.edgeSafe < 0.4 ? '0 0 20px rgba(251,113,133,0.6)' : 'none',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(1, snap.edgeSafe)) * 100}%`,
                background:
                  snap.edgeSafe < 0.4
                    ? 'linear-gradient(90deg, #FB7185 0%, #F43F5E 100%)'
                    : snap.edgeSafe < 0.7
                      ? 'linear-gradient(90deg, #FBBF24 0%, #F59E0B 100%)'
                      : 'linear-gradient(90deg, #34D399 0%, #10B981 100%)',
                borderRadius: 999,
                transition: 'background 0.2s ease',
              }}
            />
          </div>

          {/* Edge warning text */}
          {snap.edgeSafe < 0.5 && (
            <div
              style={{
                position: 'absolute',
                top: 40,
                left: 18,
                fontSize: 12,
                fontWeight: 700,
                color: '#FB7185',
                textShadow: '0 2px 8px rgba(251,113,133,0.6)',
                animation: 'pulse 0.5s ease-in-out infinite',
              }}
            >
              ⚠ JUMP NOW!
            </div>
          )}

          {/* score */}
          <div
            style={{
              position: 'absolute',
              top: 64,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: 1,
              color: 'rgba(255,255,255,0.92)',
              textShadow: '0 6px 18px rgba(0,0,0,0.5)',
            }}
          >
            {snap.score}
          </div>

          {/* cubes */}
          <div style={{ position: 'absolute', top: 22, right: 18 }}>
            <div style={pillStyle()}>
              <span style={{ fontSize: 14 }}>{cubesDisplay}</span>
              <span style={cubeIconStyle(14)} />
            </div>
          </div>

          {toastVisible && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 60,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  ...pillStyle(),
                  fontSize: 14,
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.55)',
                }}
              >
                {snap.toast}
              </div>
            </div>
          )}

          {/* hint */}
          {snap.score < 5 && (
            <div
              style={{
                position: 'absolute',
                bottom: 22,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                padding: '0 20px',
              }}
            >
              TAP to jump forward • Rows alternate ← → • Stay ahead of camera •
              Jump to switch directions • Avoid red spikes
            </div>
          )}
        </div>
      )}

      {/* MENU / GAME OVER */}
      {snap.phase !== 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
            color: 'white',
          }}
        >
          <div
            style={{
              width: 'min(520px, calc(100% - 28px))',
              borderRadius: 18,
              padding: 18,
              background: 'rgba(0,0,0,0.62)',
              border: '1px solid rgba(255,255,255,0.16)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{ fontSize: 34, fontWeight: 900, letterSpacing: 0.6 }}
                >
                  {PRISM_JUMP_TITLE}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.75)',
                    marginTop: 4,
                  }}
                >
                  One-tap jump across constantly moving platforms in an
                  interstellar world. Each row alternates direction. Collect
                  cubes to unlock one of {CHARACTERS.length} unique characters
                  (100 cubes lottery).
                </div>
              </div>

              <div style={pillStyle()}>
                <span style={{ fontSize: 14 }}>{snap.totalCubes}</span>
                <span style={cubeIconStyle(14)} />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ ...pillStyle(), gap: 10 }}>
                <span style={{ opacity: 0.8 }}>Best</span>
                <span style={{ fontSize: 16 }}>{snap.best}</span>
              </div>

              {snap.phase === 'gameover' && (
                <div style={{ ...pillStyle(), gap: 10 }}>
                  <span style={{ opacity: 0.8 }}>Score</span>
                  <span style={{ fontSize: 16 }}>{snap.score}</span>
                </div>
              )}

              <div style={{ ...pillStyle(), gap: 10 }}>
                <span style={{ opacity: 0.8 }}>Unlocked</span>
                <span style={{ fontSize: 16 }}>
                  {unlocked.length}/{CHARACTERS.length}
                </span>
              </div>
            </div>

            {/* character */}
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    Character
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>
                    {selectedDef.name}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    style={buttonStyle(false)}
                    onClick={() => prismJumpState.setSelected(prevId)}
                    aria-label="Previous character"
                  >
                    ◀
                  </button>
                  <button
                    style={buttonStyle(false)}
                    onClick={() => prismJumpState.setSelected(nextId)}
                    aria-label="Next character"
                  >
                    ▶
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginTop: 12,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  style={{
                    ...buttonStyle(false),
                    opacity: canUnlock ? 1 : 0.55,
                  }}
                  onClick={() => prismJumpState.unlockRandom()}
                  disabled={!canUnlock}
                >
                  Unlock random • 100 cubes
                </button>

                <button
                  style={buttonStyle(true)}
                  onClick={() => prismJumpState.startGame()}
                >
                  {snap.phase === 'gameover' ? 'Play again' : 'Play'}
                </button>
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.68)',
                }}
              >
                <strong>How to play:</strong> Tap/Space to hop forward.
                Platforms constantly move left or right, alternating each row.
                Jump to the next row to change your drift direction. Stay ahead
                of the camera - if you fall behind, game over! Avoid red spike
                platforms.
              </div>
            </div>

            {toastVisible && (
              <div
                style={{
                  marginTop: 12,
                  ...pillStyle(),
                  justifyContent: 'center',
                }}
              >
                {snap.toast}
              </div>
            )}
          </div>
        </div>
      )}
    </Html>
  );
}
