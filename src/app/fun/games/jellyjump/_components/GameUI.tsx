import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import { useSnapshot } from 'valtio';
import { jellyJumpState } from '../state';

const containerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  fontFamily:
    'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  color: 'white',
  userSelect: 'none',
};

const hudStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  right: 16,
  display: 'flex',
  justifyContent: 'space-between',
  fontFamily:
    'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  color: 'white',
  userSelect: 'none',
  pointerEvents: 'none',
};

export default function GameUI() {
  const snap = useSnapshot(jellyJumpState);

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      {/* HUD */}
      <div style={hudStyle}>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8 }}>LEVEL</div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
            {snap.level}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8 }}>💎 GEMS</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
              {snap.gemsCollected}
            </div>
          </div>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8 }}>SCORE</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
              {snap.score}
            </div>
          </div>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8 }}>BEST LVL</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
              {snap.best}
            </div>
          </div>
        </div>
      </div>

      {/* Freeze indicator */}
      {snap.phase === 'playing' && Date.now() < snap.frozenUntil && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 48,
            fontWeight: 900,
            color: '#60a5fa',
            textShadow: '0 0 20px rgba(96,165,250,0.8)',
            pointerEvents: 'none',
          }}
        >
          FROZEN!
        </div>
      )}

      {/* Menu / Gameover */}
      {(snap.phase === 'menu' || snap.phase === 'gameover') && (
        <div style={containerStyle}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: -1,
              color: '#ffb100',
              textShadow: '0 14px 40px rgba(0,0,0,0.45)',
              marginBottom: 8,
              pointerEvents: 'none',
            }}
          >
            Jelly Jump
          </div>

          <div
            style={{
              maxWidth: 560,
              textAlign: 'center',
              lineHeight: 1.5,
              fontSize: 16,
              opacity: 0.92,
              padding: '0 24px',
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <strong>Space</strong> / <strong>Click</strong> to jump •{' '}
              <strong>A/D</strong> to move
              <br />
              Stay above the rising lava.
            </div>
            <div style={{ opacity: 0.85, fontSize: 14 }}>
              💎 Collect gems • 🟡 Activate levers to unlock ghost platforms •
              💚 Green = level skip • 🔵 Blue = freeze
              <br />
              ⚠️ Red bombs knock you down • avoid slide crushes • read Iris/Gear/Membrane rows.
            </div>
          </div>

          <div
            style={{
              marginTop: 26,
              padding: '14px 18px',
              borderRadius: 16,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 4 }}>
              {snap.phase === 'menu'
                ? 'Press Space / Click to play'
                : 'Press Space / Click to retry'}
            </div>
            {snap.phase === 'gameover' && snap.deathCause && (
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.9,
                  color: snap.deathCause === 'crush' ? '#fb7185' : '#f97316',
                  marginBottom: 8,
                }}
              >
                {snap.deathCause === 'crush'
                  ? 'CRUSHED by closing walls'
                  : 'MELTED by the rising lava'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                LEVEL {snap.level}
              </div>
              <div style={{ opacity: 0.7 }}>•</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                SCORE {snap.score}
              </div>
              <div style={{ opacity: 0.7 }}>•</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                BEST LVL {snap.best}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.6 }}>
            (R) to reset to menu
          </div>
        </div>
      )}
    </Html>
  );
}
