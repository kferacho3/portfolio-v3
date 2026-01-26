import { Html } from '@react-three/drei';
import React from 'react';
import { useSnapshot } from 'valtio';
import { SHAPES } from '../constants';
import { geoState } from '../state';

const HUD: React.FC = () => {
  const snap = useSnapshot(geoState);
  const totalCargo = Object.values(snap.cargo).reduce((a, b) => a + b, 0);

  return (
    <Html fullscreen>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pointerEvents: 'none',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(10px)',
            padding: '1rem 1.5rem',
            borderRadius: '1rem',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            color: 'white',
          }}
        >
          <div
            style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00d4ff' }}
          >
            Level {snap.level}
          </div>
          <div style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
            Score: <span style={{ color: '#00ffaa' }}>{snap.score}</span>
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
            Best: {snap.bestScore}
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              Health
            </div>
            <div
              style={{
                width: '150px',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${snap.health}%`,
                  height: '100%',
                  background:
                    snap.health > 50
                      ? '#00ff88'
                      : snap.health > 25
                        ? '#ffaa00'
                        : '#ff4444',
                  transition: 'width 0.3s, background 0.3s',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              Deposits: {snap.deposited}/{snap.targetDeposits}
            </div>
            <div
              style={{
                width: '150px',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(snap.deposited / snap.targetDeposits) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #00d4ff, #00ffaa)',
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(10px)',
            padding: '1rem 1.5rem',
            borderRadius: '1rem',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            color: 'white',
            textAlign: 'right',
          }}
        >
          <div
            style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem' }}
          >
            Current Shape
          </div>
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#00d4ff',
              textTransform: 'capitalize',
            }}
          >
            {snap.currentShape}
          </div>
          <div
            style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.25rem' }}
          >
            Press SPACE to cycle
          </div>

          <div
            style={{
              marginTop: '1rem',
              fontSize: '0.9rem',
              opacity: 0.9,
            }}
          >
            Cargo: <span style={{ color: '#ffaa00' }}>{totalCargo}</span> shapes
          </div>

          {totalCargo > 0 && (
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                opacity: 0.7,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '0.2rem',
              }}
            >
              {SHAPES.map((shape) =>
                snap.cargo[shape] > 0 ? (
                  <div key={shape} style={{ textTransform: 'capitalize' }}>
                    {shape}: {snap.cargo[shape]}
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(10px)',
          padding: '0.5rem 1.5rem',
          borderRadius: '2rem',
          color: 'white',
          fontSize: '0.8rem',
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      >
        WASD - Move | SPACE - Cycle Shape | R - Restart
      </div>

      {snap.gameOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          <div
            style={{ fontSize: '4rem', fontWeight: 'bold', color: '#ff4444' }}
          >
            GAME OVER
          </div>
          <div style={{ fontSize: '1.5rem', marginTop: '1rem' }}>
            Final Score: <span style={{ color: '#00d4ff' }}>{snap.score}</span>
          </div>
          <div style={{ fontSize: '1rem', marginTop: '0.5rem', opacity: 0.7 }}>
            Level Reached: {snap.level}
          </div>
          <button
            onClick={() => geoState.reset()}
            style={{
              marginTop: '2rem',
              padding: '1rem 2rem',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #00d4ff, #00ffaa)',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#000',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            Play Again
          </button>
        </div>
      )}
    </Html>
  );
};

export default HUD;
