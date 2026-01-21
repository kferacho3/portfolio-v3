import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { THEMES } from '../constants';
import { gravityRushState } from '../state';
import FullscreenOverlay from './FullscreenOverlay';

const GameUI: React.FC = () => {
  const snap = useSnapshot(gravityRushState);
  const theme = THEMES[snap.currentTheme];

  useEffect(() => {
    gravityRushState.loadHighScore();
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
            background: `linear-gradient(180deg, ${theme.background} 0%, ${theme.fog} 100%)`,
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
              background: `linear-gradient(135deg, ${theme.platform}, ${theme.accent})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textShadow: `0 0 60px ${theme.accent}50`,
            }}
          >
            GRAVITY RUSH
          </h1>

          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '2rem' }}>
            Inspired by "r3f-gravity-ball"
          </p>

          {snap.highScore > 0 && (
            <p style={{ color: theme.accent, fontSize: '1.125rem', marginBottom: '1.5rem' }}>
              High Score: {snap.highScore.toLocaleString()}
            </p>
          )}

          <button
            onClick={() => {
              gravityRushState.reset();
              gravityRushState.startGame();
            }}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.5rem',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: `linear-gradient(135deg, ${theme.platform}, ${theme.accent})`,
              color: theme.background,
              boxShadow: `0 0 40px ${theme.accent}60`,
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
          >
            START
          </button>

          <div style={{ marginTop: '2rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', textAlign: 'center' }}>
            <p>WASD / Arrow Keys to move</p>
            <p>Space to jump • R to restart</p>
          </div>

          <div style={{ position: 'absolute', bottom: '1.5rem', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
            Touch controls on mobile
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
            background: 'rgba(0, 0, 0, 0.9)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 10vw, 5rem)',
              fontWeight: 700,
              marginBottom: '1rem',
              color: theme.crumble,
              textShadow: `0 0 40px ${theme.crumble}80`,
            }}
          >
            GAME OVER
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.125rem' }}>Score</div>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: '#fff' }}>{snap.score.toLocaleString()}</div>

            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>
              Distance: {snap.distance}m • Coins: {snap.coins}
            </div>

            {snap.score >= snap.highScore && snap.score > 0 && (
              <div style={{ color: theme.boost, fontSize: '0.875rem' }}>NEW HIGH SCORE!</div>
            )}
          </div>

          <button
            onClick={() => {
              gravityRushState.reset();
              gravityRushState.startGame();
            }}
            style={{
              padding: '0.75rem 2.5rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: `linear-gradient(135deg, ${theme.platform}, ${theme.accent})`,
              color: theme.background,
              boxShadow: `0 0 30px ${theme.accent}50`,
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
          >
            PLAY AGAIN
          </button>

          <button
            onClick={() => gravityRushState.reset()}
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
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          fontFamily: '"Geist Mono", monospace',
          padding:
            'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        }}
      >
        <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Score
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#fff' }}>{snap.score.toLocaleString()}</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Best: {Math.max(snap.highScore, snap.score).toLocaleString()}
          </div>
          <div style={{ color: theme.accent, fontSize: '0.875rem', marginTop: '0.5rem' }}>{snap.distance}m</div>
          {snap.comboMultiplier > 1 && (
            <div style={{ color: theme.boost, fontSize: '0.875rem' }}>x{snap.comboMultiplier.toFixed(1)} combo</div>
          )}
        </div>

        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', textAlign: 'right' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            World
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: theme.platform }}>{THEMES[snap.currentTheme].name}</div>
        </div>

        <div style={{ position: 'absolute', top: '5rem', right: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {snap.hasShield && (
            <div style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', background: '#00ff8840', color: '#00ff88' }}>
              Shield {Math.ceil(snap.shieldTimer)}s
            </div>
          )}
          {snap.hasSpeedBoost && (
            <div style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', background: '#ff880040', color: '#ff8800' }}>
              Speed {Math.ceil(snap.speedBoostTimer)}s
            </div>
          )}
          {snap.hasDoublePoints && (
            <div style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', background: '#ffff0040', color: '#ffff00' }}>
              2x Points {Math.ceil(snap.doublePointsTimer)}s
            </div>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '33.333%', display: 'flex', pointerEvents: 'auto' }}>
          <div
            style={{ flex: 1, display: 'flex' }}
            onTouchStart={() => (gravityRushState.controls.left = true)}
            onTouchEnd={() => (gravityRushState.controls.left = false)}
          >
            <div style={{ margin: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '2.25rem' }}>◀</div>
          </div>
          <div
            style={{ flex: 1, display: 'flex' }}
            onTouchStart={() => {
              gravityRushState.controls.forward = true;
              gravityRushState.controls.jump = true;
            }}
            onTouchEnd={() => {
              gravityRushState.controls.forward = false;
            }}
          >
            <div style={{ margin: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '2.25rem' }}>▲</div>
          </div>
          <div
            style={{ flex: 1, display: 'flex' }}
            onTouchStart={() => (gravityRushState.controls.right = true)}
            onTouchEnd={() => (gravityRushState.controls.right = false)}
          >
            <div style={{ margin: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '2.25rem' }}>▶</div>
          </div>
        </div>
      </div>
    </FullscreenOverlay>
  );
};

export default GameUI;
