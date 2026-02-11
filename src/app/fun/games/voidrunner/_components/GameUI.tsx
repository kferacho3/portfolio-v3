import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { OBSTACLE_STYLE_PRESETS, SHIP_PALETTES } from '../constants';
import { voidRunnerState } from '../state';
import type { Character } from '../types';
import FullscreenOverlay from './FullscreenOverlay';

const CHARACTER_OPTIONS: Array<{ id: Character; label: string; subtitle: string }> = [
  { id: 'shipNova', label: 'Nova', subtitle: 'Balanced control' },
  { id: 'shipDart', label: 'Dart', subtitle: 'Slim precision hull' },
  { id: 'shipWasp', label: 'Wasp', subtitle: 'Aggressive wing profile' },
  { id: 'ufoMini', label: 'UFO Mini', subtitle: 'Classic saucer' },
];

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
              'radial-gradient(ellipse at center, #11132f 0%, #070711 65%, #020206 100%)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(3rem, 12vw, 6rem)',
              fontWeight: 700,
              marginBottom: '0.7rem',
              letterSpacing: '0.05em',
              background: 'linear-gradient(135deg, #7af8ff, #ff64de, #fff59d)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textShadow: '0 0 70px rgba(122, 248, 255, 0.35)',
            }}
          >
            VOID RUNNER
          </h1>

          <p
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            Inspired by classic Cube Runner style speed-maze games
          </p>

          {snap.highScore > 0 && (
            <p
              style={{
                color: '#7dd3fc',
                fontSize: '1.05rem',
                marginBottom: '1rem',
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
              gap: '0.65rem',
              marginBottom: '0.9rem',
            }}
          >
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => voidRunnerState.setDifficulty(d)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  border:
                    snap.difficulty === d
                      ? '1px solid #7dd3fc'
                      : '1px solid rgba(255,255,255,0.2)',
                  background:
                    snap.difficulty === d
                      ? 'rgba(125,211,252,0.18)'
                      : 'transparent',
                  color:
                    snap.difficulty === d
                      ? '#7dd3fc'
                      : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
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
              gap: '0.65rem',
              marginBottom: '1.2rem',
            }}
          >
            {(['classic', 'zen'] as const).map((m) => (
              <button
                key={m}
                onClick={() => voidRunnerState.setMode(m)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  border:
                    snap.mode === m
                      ? '1px solid #c084fc'
                      : '1px solid rgba(255,255,255,0.2)',
                  background:
                    snap.mode === m ? 'rgba(192,132,252,0.18)' : 'transparent',
                  color:
                    snap.mode === m ? '#c084fc' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                }}
              >
                {m === 'classic' ? 'CLASSIC' : 'ZEN (No Death)'}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              width: 'min(680px, 100%)',
              gap: '0.6rem',
              marginBottom: '0.85rem',
            }}
          >
            {CHARACTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => voidRunnerState.setCharacter(option.id)}
                style={{
                  padding: '0.55rem 0.7rem',
                  borderRadius: '10px',
                  border:
                    snap.character === option.id
                      ? '1px solid #5eead4'
                      : '1px solid rgba(255,255,255,0.17)',
                  background:
                    snap.character === option.id
                      ? 'rgba(45,212,191,0.2)'
                      : 'rgba(255,255,255,0.03)',
                  color:
                    snap.character === option.id
                      ? '#5eead4'
                      : 'rgba(255,255,255,0.72)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{option.label}</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.75 }}>{option.subtitle}</div>
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.55rem',
              marginBottom: '1.55rem',
            }}
          >
            {(Object.entries(SHIP_PALETTES) as Array<
              [keyof typeof SHIP_PALETTES, (typeof SHIP_PALETTES)[keyof typeof SHIP_PALETTES]]
            >).map(([key, palette]) => (
              <button
                key={key}
                onClick={() => voidRunnerState.setShipPalette(key)}
                title={palette.label}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '9999px',
                  border:
                    snap.shipPalette === key
                      ? '2px solid rgba(255,255,255,0.9)'
                      : '1px solid rgba(255,255,255,0.22)',
                  boxShadow:
                    snap.shipPalette === key
                      ? `0 0 18px ${palette.glow}`
                      : 'none',
                  background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          <button
            onClick={() => {
              voidRunnerState.reset();
              voidRunnerState.startGame();
            }}
            style={{
              padding: '0.95rem 2.8rem',
              fontSize: '1.35rem',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #67e8f9, #a855f7)',
              color: '#03111a',
              boxShadow: '0 0 40px rgba(103,232,249,0.25)',
              cursor: 'pointer',
            }}
          >
            START RUN
          </button>

          <div
            style={{
              marginTop: '1.25rem',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.82rem',
              textAlign: 'center',
            }}
          >
            <p>A/D or Arrow Keys to strafe</p>
            <p>Space / W / ↑ to jump spikes</p>
            <p>Difficulty and speed rise every 1000 score</p>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '1.3rem',
              left: 0,
              right: 0,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.28)',
              fontSize: '0.74rem',
            }}
          >
            Mobile: hold left/right side to steer, tap center to jump
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
            background: 'rgba(0, 0, 10, 0.95)',
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
              color: '#f472b6',
              textShadow: '0 0 42px rgba(244,114,182,0.45)',
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
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.125rem' }}>
              Score
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: '#fff' }}>
              {snap.score.toLocaleString()}
            </div>

            {snap.score >= snap.highScore && snap.score > 0 && (
              <div style={{ color: '#7dd3fc', fontSize: '0.9rem' }}>
                NEW HIGH SCORE!
              </div>
            )}

            <div style={{ color: 'rgba(255,255,255,0.45)', marginTop: '0.4rem' }}>
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
              background: 'linear-gradient(135deg, #67e8f9, #c084fc)',
              color: '#0b1020',
              boxShadow: '0 0 30px rgba(103,232,249,0.3)',
              cursor: 'pointer',
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

  const styleName =
    OBSTACLE_STYLE_PRESETS[(Math.max(1, snap.level) - 1) % OBSTACLE_STYLE_PRESETS.length]
      .name;

  return (
    <FullscreenOverlay>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ fontFamily: '"Geist Mono", monospace' }}
      >
        <div className="absolute top-6 left-6">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Score</div>
          <div className="text-3xl font-bold text-white">{snap.score.toLocaleString()}</div>
          <div className="text-cyan-300 text-sm mt-1">Level {snap.level}</div>
          <div className="text-white/45 text-xs mt-1">Theme: {styleName}</div>
          {snap.comboMultiplier > 1 && (
            <div className="text-purple-300 text-sm mt-1">x{snap.comboMultiplier.toFixed(1)}</div>
          )}
        </div>

        <div className="absolute top-6 right-6 text-right">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Speed</div>
          <div className="text-2xl font-bold text-white">
            {snap.speed} <span className="text-sm text-white/40">km/h</span>
          </div>
          <div className="text-[11px] text-white/45 mt-1">+difficulty every 1000 score</div>
        </div>

        {snap.mode === 'zen' && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2">
            <div className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40">
              <span className="text-green-300 text-xs uppercase tracking-wider">Zen Mode</span>
            </div>
          </div>
        )}

        <div
          className="absolute bottom-0 left-0 w-1/3 h-[38%] pointer-events-auto md:hidden"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.06), transparent)' }}
          onTouchStart={() => (voidRunnerState.controls.left = true)}
          onTouchEnd={() => (voidRunnerState.controls.left = false)}
          onTouchCancel={() => (voidRunnerState.controls.left = false)}
        />
        <div
          className="absolute bottom-0 right-0 w-1/3 h-[38%] pointer-events-auto md:hidden"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.06), transparent)' }}
          onTouchStart={() => (voidRunnerState.controls.right = true)}
          onTouchEnd={() => (voidRunnerState.controls.right = false)}
          onTouchCancel={() => (voidRunnerState.controls.right = false)}
        />
        <div
          className="absolute bottom-0 left-1/3 w-1/3 h-[38%] pointer-events-auto md:hidden"
          style={{ background: 'linear-gradient(to top, rgba(34,211,238,0.07), transparent)' }}
          onTouchStart={() => voidRunnerState.queueJump()}
          onTouchEnd={() => (voidRunnerState.controls.jump = false)}
          onTouchCancel={() => (voidRunnerState.controls.jump = false)}
        />

        <div className="absolute bottom-8 left-8 text-white/25 text-2xl pointer-events-none select-none md:hidden">
          ◀
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-cyan-200/40 text-lg pointer-events-none select-none md:hidden">
          JUMP
        </div>
        <div className="absolute bottom-8 right-8 text-white/25 text-2xl pointer-events-none select-none md:hidden">
          ▶
        </div>
      </div>
    </FullscreenOverlay>
  );
};

export default GameUI;
