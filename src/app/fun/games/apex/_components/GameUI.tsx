import React, { useEffect, useMemo } from 'react';
import { useSnapshot } from 'valtio';
import {
  ARENA_KEYS,
  ARENA_PRESETS,
  MODE_INFO,
  PLAYER_SKIN_INFO,
  PLAYER_SKIN_KEYS,
  POWERUP_DURATION,
  THEMES,
  getArenaTheme,
} from '../constants';
import { apexState } from '../state';
import type { ArenaPresetKey, PlayerSkin } from '../types';
import FullscreenOverlay from './FullscreenOverlay';

const FULL_MODES_URL = 'https://prism3d.studio';

const GameUI: React.FC = () => {
  const snap = useSnapshot(apexState);

  useEffect(() => {
    apexState.loadHighScores();
  }, []);

  const selectedMode = MODE_INFO[snap.mode];
  const selectedModeBest = snap.highScores[snap.mode];
  const selectedArena = ARENA_PRESETS[snap.arena];
  const selectedSkin =
    PLAYER_SKIN_INFO[snap.playerSkin] ?? PLAYER_SKIN_INFO.classic;
  const arenaTheme = useMemo(
    () => getArenaTheme(selectedArena, THEMES[snap.currentTheme]),
    [selectedArena, snap.currentTheme]
  );
  const skinGroups = [
    {
      label: 'Classic',
      keys: PLAYER_SKIN_KEYS.filter((key) => key === 'classic'),
    },
    {
      label: 'Prism',
      keys: PLAYER_SKIN_KEYS.filter((key) => key.startsWith('prism')),
    },
    {
      label: 'Fractal',
      keys: PLAYER_SKIN_KEYS.filter((key) => key.startsWith('fractal')),
    },
    {
      label: 'Nova',
      keys: PLAYER_SKIN_KEYS.filter((key) => key.startsWith('nova')),
    },
  ].filter((group) => group.keys.length > 0);

  if (snap.phase === 'menu') {
    return (
      <FullscreenOverlay>
        <div
          data-apex-ui
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding:
              'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
            background:
              'linear-gradient(180deg, rgba(10,10,21,0.45) 0%, rgba(26,26,46,0.55) 50%, rgba(15,15,26,0.45) 100%)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflowX: 'hidden',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(4rem, 12vw, 8rem)',
              fontWeight: 900,
              marginBottom: '0.5rem',
              letterSpacing: '-0.05em',
              background: 'linear-gradient(135deg, #00ffff, #ff00ff, #00ffff)',
              backgroundSize: '200% 200%',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textShadow: '0 0 80px rgba(0, 255, 255, 0.5)',
              animation: 'gradient 3s ease infinite',
            }}
          >
            APEX
          </h1>

          <p
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '1.1rem',
              marginBottom: '1.25rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Tap to Turn or Bend. Stay on the Path.
          </p>

          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              marginBottom: '1.25rem',
              width: 'min(92vw, 520px)',
            }}
          >
            {/* Mode picker (dropdown) */}
            <div
              style={{
                marginTop: '0.5rem',
                display: 'grid',
                gap: '0.5rem',
                justifyItems: 'center',
              }}
            >
              <div
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                Mode
              </div>

              <div
                style={{
                  width: 'min(92vw, 520px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: `1px solid ${selectedMode.color}60`,
                  background: `${selectedMode.color}12`,
                  boxShadow: `0 0 30px ${selectedMode.color}18`,
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: selectedMode.color,
                    boxShadow: `0 0 12px ${selectedMode.color}`,
                  }}
                />

                <div style={{ position: 'relative', flex: 1 }}>
                  <select
                    value={snap.mode}
                    disabled
                    style={{
                      width: '100%',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: 'not-allowed',
                      paddingRight: '2rem',
                    }}
                  >
                    <option value="curved">{MODE_INFO.curved.name}</option>
                  </select>

                  <span
                    style={{
                      position: 'absolute',
                      right: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'rgba(255,255,255,0.5)',
                      pointerEvents: 'none',
                    }}
                  >
                    🔒
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  width: 'min(92vw, 520px)',
                }}
              >
                <div
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                  }}
                >
                  {selectedMode.description}
                  <div style={{ marginTop: '0.35rem', fontSize: '0.75rem' }}>
                    Full Apex mode catalog: <a href={FULL_MODES_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc' }}>prism3d.studio</a>
                  </div>
                </div>
                {selectedModeBest > 0 && (
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: '0.85rem',
                    }}
                  >
                    Best: {selectedModeBest.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: '-0.25rem',
              marginBottom: '1.75rem',
              display: 'grid',
              gap: '0.5rem',
              justifyItems: 'center',
            }}
          >
            <div
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.75rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Arena
            </div>

            <div
              style={{
                width: 'min(92vw, 520px)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: `1px solid ${arenaTheme.accent}60`,
                background: `${arenaTheme.accent}12`,
                boxShadow: `0 0 30px ${arenaTheme.accent}18`,
              }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: arenaTheme.accent,
                  boxShadow: `0 0 12px ${arenaTheme.accent}`,
                }}
              />

              <div style={{ position: 'relative', flex: 1 }}>
                <select
                  value={snap.arena}
                  onChange={(event) =>
                    apexState.setArena(event.target.value as ArenaPresetKey)
                  }
                  style={{
                    width: '100%',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    paddingRight: '2rem',
                  }}
                >
                  {ARENA_KEYS.map((arenaKey) => (
                    <option key={arenaKey} value={arenaKey}>
                      {ARENA_PRESETS[arenaKey].name}
                    </option>
                  ))}
                </select>

                <span
                  style={{
                    position: 'absolute',
                    right: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255,255,255,0.5)',
                    pointerEvents: 'none',
                  }}
                >
                  ▾
                </span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                width: 'min(92vw, 520px)',
              }}
            >
              <div
                style={{
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                }}
              >
                {selectedArena.description}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '2rem',
            }}
          >
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => apexState.setDifficulty(d)}
                style={{
                  padding: '0.5rem 1.25rem',
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
                    snap.difficulty === d ? '#22d3ee' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>

          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
            }}
          >
            Character
          </div>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              marginBottom: '1.25rem',
              width: 'min(92vw, 420px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: `1px solid ${selectedSkin.accent}60`,
                background: `${selectedSkin.accent}15`,
                boxShadow: `0 0 30px ${selectedSkin.accent}20`,
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: selectedSkin.accent,
                  boxShadow: `0 0 12px ${selectedSkin.accent}`,
                }}
              />
              <div style={{ position: 'relative', flex: 1 }}>
                <select
                  value={snap.playerSkin}
                  onChange={(event) =>
                    apexState.setPlayerSkin(event.target.value as PlayerSkin)
                  }
                  style={{
                    width: '100%',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    paddingRight: '2rem',
                  }}
                >
                  {skinGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.keys.map((skinKey) => (
                        <option key={skinKey} value={skinKey}>
                          {PLAYER_SKIN_INFO[skinKey].name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span
                  style={{
                    position: 'absolute',
                    right: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(255,255,255,0.5)',
                    pointerEvents: 'none',
                  }}
                >
                  ▾
                </span>
              </div>
            </div>
            <div
              style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}
            >
              {selectedSkin.description}
            </div>
          </div>

          {/* Sticky footer so the menu never "cuts off" critical UI */}
          <div
            style={{
              position: 'sticky',
              bottom: 'max(12px, env(safe-area-inset-bottom))',
              marginTop: 'auto',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.85rem',
              paddingTop: '1rem',
              paddingBottom: '0.5rem',
              background:
                'linear-gradient(180deg, rgba(10,10,21,0) 0%, rgba(10,10,21,0.35) 30%, rgba(10,10,21,0.65) 100%)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <button
              onClick={() => {
                apexState.reset();
                apexState.startGame();
              }}
              style={{
                padding: '1.05rem 3.5rem',
                fontSize: '1.4rem',
                fontWeight: 700,
                borderRadius: '1rem',
                border: 'none',
                background: `linear-gradient(135deg, ${MODE_INFO[snap.mode].color}, #ff00ff)`,
                color: '#000',
                boxShadow: `0 0 60px ${MODE_INFO[snap.mode].color}40`,
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
            >
              START GAME
            </button>

            <div
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontSize: '0.875rem',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0 }}>
                Tap / Space / Click to flip curve • Right click or Q/E to swap
                lanes
              </p>
            </div>
          </div>

          <style>{`
            @keyframes gradient {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }

          `}</style>
        </div>
      </FullscreenOverlay>
    );
  }

  if (snap.phase === 'gameover') {
    const isNewHighScore =
      snap.score >= snap.highScores[snap.mode] && snap.score > 0;

    return (
      <FullscreenOverlay>
        <div
          data-apex-ui
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
            background: 'rgba(10, 10, 21, 0.75)',
            fontFamily: '"Geist", system-ui, sans-serif',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(3rem, 10vw, 5rem)',
              fontWeight: 900,
              marginBottom: '1.5rem',
              color: '#ff2190',
              textShadow: '0 0 40px rgba(255, 33, 144, 0.6)',
            }}
          >
            GAME OVER
          </h1>

          {isNewHighScore && (
            <div
              style={{
                color: '#22d3ee',
                fontSize: '1.25rem',
                marginBottom: '1rem',
                animation: 'pulse 2s infinite',
              }}
            >
              NEW HIGH SCORE!
            </div>
          )}

          <div
            style={{
              fontSize: '3.5rem',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '0.5rem',
            }}
          >
            {snap.score.toLocaleString()}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '2rem' }}>
            {MODE_INFO[snap.mode].name} Mode
          </div>

          <div
            style={{
              display: 'flex',
              gap: '3rem',
              marginBottom: '2rem',
              textAlign: 'center',
            }}
          >
            <div>
              <div
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}
              >
                Gems
              </div>
              <div style={{ fontSize: '1.5rem', color: '#fff' }}>
                {snap.gems}
              </div>
            </div>
            <div>
              <div
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}
              >
                Level
              </div>
              <div style={{ fontSize: '1.5rem', color: '#fff' }}>
                {snap.level}
              </div>
            </div>
            <div>
              <div
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}
              >
                Best Combo
              </div>
              <div style={{ fontSize: '1.5rem', color: '#fff' }}>
                x{snap.bestCombo}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              apexState.reset();
              apexState.startGame();
            }}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #00ffff, #ff00ff)',
              color: '#000',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            PLAY AGAIN
          </button>

          <button
            onClick={() => apexState.reset()}
            style={{
              marginTop: '1rem',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
          >
            Back to Menu
          </button>

          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </div>
      </FullscreenOverlay>
    );
  }

  const theme = arenaTheme;

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
        }}
      >
        <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem' }}>
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '4px',
            }}
          >
            Score
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#fff' }}>
            {snap.score.toLocaleString()}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginTop: '0.75rem',
            }}
          >
            Best
          </div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            {snap.highScores[snap.mode].toLocaleString()}
          </div>
        </div>

        {snap.combo > 1 && (
          <div
            style={{
              position: 'absolute',
              top: '1.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <div
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                fontSize: '1.25rem',
                fontWeight: 700,
                background:
                  snap.comboMultiplier >= 3
                    ? 'linear-gradient(135deg, #f39c12, #e74c3c)'
                    : snap.comboMultiplier >= 2
                      ? 'linear-gradient(135deg, #6c5ce7, #fd79a8)'
                      : 'linear-gradient(135deg, #00ffff, #0088ff)',
                color: '#000',
              }}
            >
              x{snap.comboMultiplier.toFixed(1)} COMBO
            </div>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            textAlign: 'right',
          }}
        >
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '4px',
            }}
          >
            Level
          </div>
          <div
            style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.accent }}
          >
            {snap.level}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '0.875rem',
              marginTop: '0.5rem',
            }}
          >
            {snap.gems} gems
          </div>
        </div>

        {snap.powerUp !== 'none' && (
          <div
            style={{
              position: 'absolute',
              bottom: '1.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <div
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background:
                  snap.powerUp === 'shield'
                    ? '#00ff8840'
                    : snap.powerUp === 'magnet'
                      ? '#ff00ff40'
                      : '#ffcc0040',
                border: `2px solid ${
                  snap.powerUp === 'shield'
                    ? '#00ff88'
                    : snap.powerUp === 'magnet'
                      ? '#ff00ff'
                      : '#ffcc00'
                }`,
              }}
            >
              <span
                style={{
                  color: '#fff',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {snap.powerUp}
              </span>
              <div
                style={{
                  width: '4rem',
                  height: '0.5rem',
                  borderRadius: '9999px',
                  background: 'rgba(255,255,255,0.2)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: '9999px',
                    transition: 'all 0.1s',
                    width: `${(snap.powerUpTimer / POWERUP_DURATION) * 100}%`,
                    background:
                      snap.powerUp === 'shield'
                        ? '#00ff88'
                        : snap.powerUp === 'magnet'
                          ? '#ff00ff'
                          : '#ffcc00',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem' }}>
          <div
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: `${MODE_INFO[snap.mode].color}20`,
              border: `1px solid ${MODE_INFO[snap.mode].color}40`,
              color: MODE_INFO[snap.mode].color,
            }}
          >
            {MODE_INFO[snap.mode].name}
          </div>
        </div>
      </div>
    </FullscreenOverlay>
  );
};

export default GameUI;
