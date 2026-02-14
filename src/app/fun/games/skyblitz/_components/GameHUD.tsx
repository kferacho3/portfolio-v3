import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import { useSnapshot } from 'valtio';
import { skyBlitzState } from '../state';

const GameHUD: React.FC = () => {
  const snap = useSnapshot(skyBlitzState);
  const crosshairRef = useRef<HTMLDivElement | null>(null);

  useFrame(({ pointer, gl }) => {
    if (!crosshairRef.current) return;
    if (snap.mode !== 'UfoMode' || snap.phase !== 'playing') return;

    const rect = gl.domElement.getBoundingClientRect();
    const x = rect.left + (pointer.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-pointer.y * 0.5 + 0.5) * rect.height;
    crosshairRef.current.style.left = `${x}px`;
    crosshairRef.current.style.top = `${y}px`;
  });

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Crosshair (UFO mode) */}
        <div
          ref={crosshairRef}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '28px',
            height: '28px',
            transform: 'translate(-50%, -50%)',
            borderRadius: '9999px',
            border: '2px solid rgba(34, 211, 238, 0.9)',
            boxShadow: '0 0 26px rgba(34, 211, 238, 0.35)',
            display:
              snap.mode === 'UfoMode' && snap.phase === 'playing'
                ? 'block'
                : 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '2px',
              height: '12px',
              background: 'rgba(255, 255, 255, 0.85)',
              transform: 'translate(-50%, -50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '12px',
              height: '2px',
              background: 'rgba(255, 255, 255, 0.85)',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            fontSize: '2.25rem',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          Score: {snap.score}
        </div>

        {snap.mode === 'UfoMode' && (
          <div
            style={{
              position: 'absolute',
              bottom: '4rem',
              right: '1rem',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: '#22d3ee',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            Wave: {snap.wave}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: '12rem',
          }}
        >
          <div
            style={{
              color: 'white',
              fontSize: '0.875rem',
              marginBottom: '0.25rem',
            }}
          >
            Health
          </div>
          <div
            style={{
              width: '100%',
              background: 'rgba(55, 65, 81, 0.5)',
              height: '0.75rem',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background:
                  snap.health > 30
                    ? 'linear-gradient(to right, #22c55e, #4ade80)'
                    : '#dc2626',
                transition: 'width 0.2s',
                width: `${snap.health}%`,
              }}
            />
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
          }}
        >
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              color: 'white',
              fontSize: '0.875rem',
            }}
          >
            {snap.mode === 'UfoMode' ? 'UFO Mode' : 'Runner Mode'}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '0.75rem',
          }}
        >
          {snap.mode === 'UfoMode'
            ? 'Mouse to move | Space/Click to shoot'
            : 'Mouse to move | Space to jump'}
        </div>

        {snap.phase === 'gameover' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.7)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <h1
                style={{
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  color: '#ef4444',
                  marginBottom: '1rem',
                }}
              >
                GAME OVER
              </h1>
              <p
                style={{
                  fontSize: '1.875rem',
                  color: 'white',
                  marginBottom: '0.5rem',
                }}
              >
                Score: {snap.score}
              </p>
              <p
                style={{
                  fontSize: '1.25rem',
                  color: '#22d3ee',
                  marginBottom: '1.5rem',
                }}
              >
                Wave Reached: {snap.wave}
              </p>
              <p
                style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.875rem',
                }}
              >
                Press R to restart
              </p>
            </div>
          </div>
        )}
      </div>
    </Html>
  );
};

export default GameHUD;
