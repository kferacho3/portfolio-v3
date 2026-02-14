'use client';

import { Html } from '@react-three/drei';
import { useSnapshot } from 'valtio';
import { PRISM_JUMP_TITLE } from '../constants';
import { prismJumpState } from '../state';

export function PrismJumpUI() {
  const snap = useSnapshot(prismJumpState);
  const toastVisible = snap.toastUntil > Date.now() && snap.toast.length > 0;
  const cubesTotal = snap.totalCubes + snap.runCubes;

  return (
    <Html fullscreen>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          color: '#ffffff',
        }}
      >
        {snap.phase === 'playing' && (
          <>
            <div
              style={{
                position: 'absolute',
                top: 18,
                left: 18,
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{ opacity: 0.75, fontSize: 12 }}>Best</span>
              <span style={{ fontWeight: 800 }}>{snap.best}</span>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(8px)',
                fontWeight: 800,
              }}
            >
              <span>{cubesTotal}</span>
              <span style={{ opacity: 0.8 }}>Cubes</span>
            </div>

            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 42,
                textAlign: 'center',
                fontWeight: 900,
                fontSize: 'clamp(36px, 8vw, 72px)',
                letterSpacing: 1,
                textShadow: '0 10px 24px rgba(0,0,0,0.45)',
              }}
            >
              {snap.score}
            </div>

            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: 20,
                width: 240,
                height: 8,
                borderRadius: 999,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.2)',
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(1, snap.edgeSafe)) * 100}%`,
                  height: '100%',
                  borderRadius: 999,
                  background:
                    snap.edgeSafe < 0.4
                      ? 'linear-gradient(90deg, #ff6a88 0%, #f94144 100%)'
                      : snap.edgeSafe < 0.7
                        ? 'linear-gradient(90deg, #ffd166 0%, #f8961e 100%)'
                        : 'linear-gradient(90deg, #80ff72 0%, #2ec4b6 100%)',
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                left: 18,
                bottom: 18,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: '9px 12px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(0,0,0,0.34)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{ opacity: 0.75, fontSize: 12 }}>Score</span>
              <span style={{ fontWeight: 900, fontSize: 16 }}>{snap.score}</span>
            </div>
          </>
        )}

        {snap.phase === 'menu' && (
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
                width: 'min(560px, 92vw)',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.5)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
                padding: '24px 22px',
                textAlign: 'center',
                pointerEvents: 'auto',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(28px, 6vw, 44px)',
                  letterSpacing: 0.5,
                }}
              >
                {PRISM_JUMP_TITLE}
              </h1>
              <p style={{ margin: '10px 0 0', opacity: 0.88 }}>
                Cube Jump remake with alternating kinematic lanes.
              </p>
              <p style={{ margin: '10px 0 0', opacity: 0.76, fontSize: 14 }}>
                Tap/Space to jump. A/D or Left/Right to strafe.
              </p>
              <button
                type="button"
                onClick={() => prismJumpState.startGame()}
                style={{
                  marginTop: 18,
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.26)',
                  background:
                    'linear-gradient(135deg, rgba(36,224,200,0.92), rgba(99,102,241,0.92))',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Start Run
              </button>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                Best: {snap.best} | Cubes: {snap.totalCubes}
              </div>
            </div>
          </div>
        )}

        {snap.phase === 'gameover' && (
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
                width: 'min(560px, 92vw)',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.56)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
                padding: '24px 22px',
                textAlign: 'center',
                pointerEvents: 'auto',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 'clamp(24px, 5vw, 38px)',
                  letterSpacing: 0.5,
                }}
              >
                Run Over
              </h2>
              <p style={{ margin: '12px 0 2px', fontSize: 14, opacity: 0.84 }}>
                Score: {snap.score} | Best: {snap.best}
              </p>
              <p style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.84 }}>
                Run Cubes: +{snap.lastRunCubes} | Total Cubes: {snap.totalCubes}
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => prismJumpState.startGame()}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.26)',
                    background:
                      'linear-gradient(135deg, rgba(36,224,200,0.92), rgba(99,102,241,0.92))',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => prismJumpState.backToMenu()}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.26)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {toastVisible && snap.phase === 'playing' && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 52,
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.45)',
              boxShadow: '0 10px 18px rgba(0,0,0,0.35)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {snap.toast}
          </div>
        )}
      </div>
    </Html>
  );
}
