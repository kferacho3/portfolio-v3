import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { voidRunnerState } from '../state';
import FullscreenOverlay from './FullscreenOverlay';

const GameUI: React.FC = () => {
  const snap = useSnapshot(voidRunnerState);

  useEffect(() => {
    voidRunnerState.loadHighScore();
  }, []);

  if (snap.phase === 'menu') {
    return (
      <FullscreenOverlay>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding:
              'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
            background:
              'radial-gradient(ellipse at center, #0a0a20 0%, #000008 70%, #000000 100%)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(3rem, 12vw, 6rem)',
              fontWeight: 700,
              marginBottom: '1rem',
              letterSpacing: '0.05em',
              background: 'linear-gradient(135deg, #ff2190, #00ffff, #6942b8)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textShadow: '0 0 60px rgba(255, 33, 144, 0.5)',
            }}
          >
            VOID RUNNER
          </h1>

          <p
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '0.875rem',
              marginBottom: '2rem',
            }}
          >
            Inspired by "Cuberun" by Adam Karlsten
          </p>

          {snap.highScore > 0 && (
            <p
              style={{
                color: '#22d3ee',
                fontSize: '1.125rem',
                marginBottom: '1.5rem',
              }}
            >
              High Score: {snap.highScore.toLocaleString()}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}
          >
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => voidRunnerState.setDifficulty(d)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border:
                    snap.difficulty === d
                      ? '1px solid #22d3ee'
                      : '1px solid rgba(255,255,255,0.2)',
                  background:
                    snap.difficulty === d
                      ? 'rgba(34,211,238,0.2)'
                      : 'transparent',
                  color:
                    snap.difficulty === d ? '#22d3ee' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: '2rem',
            }}
          >
            {(['classic', 'zen'] as const).map((m) => (
              <button
                key={m}
                onClick={() => voidRunnerState.setMode(m)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border:
                    snap.mode === m
                      ? '1px solid #a855f7'
                      : '1px solid rgba(255,255,255,0.2)',
                  background:
                    snap.mode === m ? 'rgba(168,85,247,0.2)' : 'transparent',
                  color: snap.mode === m ? '#a855f7' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {m === 'classic' ? 'CLASSIC' : 'ZEN (No Death)'}
              </button>
            ))}
          </div>

          {/* Character Selection */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: '2rem',
            }}
          >
            {(['ship', 'ufoMini'] as const).map((c) => (
              <button
                key={c}
                onClick={() => voidRunnerState.setCharacter(c)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border:
                    snap.character === c
                      ? '1px solid #00ffff'
                      : '1px solid rgba(255,255,255,0.2)',
                  background:
                    snap.character === c
                      ? 'rgba(0,255,255,0.2)'
                      : 'transparent',
                  color:
                    snap.character === c ? '#00ffff' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {c === 'ship' ? 'SHIP' : 'UFO MINI'}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              voidRunnerState.reset();
              voidRunnerState.startGame();
            }}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.5rem',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #ff2190, #6942b8)',
              color: 'white',
              boxShadow: '0 0 40px rgba(255, 33, 144, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
          >
            START
          </button>

          <div
            style={{
              marginTop: '2rem',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            <p>A/D or Arrow Keys to move</p>
            <p>Space/Enter to start • R to restart</p>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '1.5rem',
              left: 0,
              right: 0,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '0.75rem',
            }}
          >
            Touch left/right sides of screen on mobile
          </div>
        </div>
      </FullscreenOverlay>
    );
  }

  if (snap.phase === 'gameover') {
    return (
      <FullscreenOverlay>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding:
              'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
            background: 'rgba(0, 0, 8, 0.95)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(3rem, 10vw, 5rem)',
              fontWeight: 700,
              marginBottom: '1rem',
              color: '#ff2190',
              textShadow: '0 0 40px rgba(255, 33, 144, 0.6)',
            }}
          >
            GAME OVER
          </h1>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.125rem' }}
            >
              Score
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: '#fff' }}>
              {snap.score.toLocaleString()}
            </div>

            {snap.score >= snap.highScore && snap.score > 0 && (
              <div style={{ color: '#22d3ee', fontSize: '0.875rem' }}>
                NEW HIGH SCORE!
              </div>
            )}

            <div
              style={{ color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}
            >
              Level {snap.level} • x{snap.comboMultiplier.toFixed(1)} multiplier
            </div>
          </div>

          <button
            onClick={() => {
              voidRunnerState.reset();
              voidRunnerState.startGame();
            }}
            style={{
              padding: '0.75rem 2.5rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #ff2190, #6942b8)',
              color: 'white',
              boxShadow: '0 0 30px rgba(255, 33, 144, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
          >
            PLAY AGAIN
          </button>

          <button
            onClick={() => voidRunnerState.reset()}
            style={{
              marginTop: '1rem',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}
          >
            Back to Menu
          </button>
        </div>
      </FullscreenOverlay>
    );
  }

  return (
    <FullscreenOverlay>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ fontFamily: '"Geist Mono", monospace' }}
      >
        <div className="absolute top-6 left-6">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-1">
            Score
          </div>
          <div className="text-3xl font-bold text-white">
            {snap.score.toLocaleString()}
          </div>
          <div className="text-cyan-400 text-sm mt-2">Level {snap.level}</div>
          {snap.comboMultiplier > 1 && (
            <div className="text-purple-400 text-sm">
              x{snap.comboMultiplier.toFixed(1)}
            </div>
          )}
        </div>

        <div className="absolute top-6 right-6 text-right">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-1">
            Speed
          </div>
          <div className="text-2xl font-bold text-white">
            {snap.speed} <span className="text-sm text-white/40">km/h</span>
          </div>
        </div>

        {snap.mode === 'zen' && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2">
            <div className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40">
              <span className="text-green-400 text-xs uppercase tracking-wider">
                Zen Mode
              </span>
            </div>
          </div>
        )}

        <div
          className="absolute bottom-0 left-0 w-1/2 h-1/3 pointer-events-auto opacity-0"
          onTouchStart={() => (voidRunnerState.controls.left = true)}
          onTouchEnd={() => (voidRunnerState.controls.left = false)}
        />
        <div
          className="absolute bottom-0 right-0 w-1/2 h-1/3 pointer-events-auto opacity-0"
          onTouchStart={() => (voidRunnerState.controls.right = true)}
          onTouchEnd={() => (voidRunnerState.controls.right = false)}
        />

        <div className="absolute bottom-8 left-8 text-white/20 text-2xl pointer-events-none select-none md:hidden">
          ◀
        </div>
        <div className="absolute bottom-8 right-8 text-white/20 text-2xl pointer-events-none select-none md:hidden">
          ▶
        </div>
      </div>
    </FullscreenOverlay>
  );
};

export default GameUI;
