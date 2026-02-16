'use client';

import type { CSSProperties } from 'react';
import { useSnapshot } from 'valtio';

import {
  CAMERA_MODE_LABEL,
  GAME,
  OCTA_OBSTACLE_LABEL,
  OCTA_PATH_STYLE_LABEL,
  OCTA_PLATFORM_LABEL,
  OCTA_SURGE_TITLE,
  OCTA_TILE_UNLOCK_THRESHOLDS,
  OCTA_TILE_VARIANT_LABEL,
  OCTA_TILE_VARIANTS,
} from '../constants';
import { octaSurgeState } from '../state';
import type {
  OctaCameraMode,
  OctaFxLevel,
  OctaSurgeMode,
  OctaTileVariant,
} from '../types';

const uiFont =
  "'Avenir Next Condensed', 'Futura', 'Trebuchet MS', 'Segoe UI', sans-serif";
const monoFont =
  "'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace";

const modeLabel: Record<OctaSurgeMode, string> = {
  classic: 'Classic',
  endless: 'Endless',
  daily: 'Daily',
};

const fxLabel: Record<OctaFxLevel, string> = {
  full: 'FX Full',
  medium: 'FX Medium',
  low: 'FX Low',
};

const buttonBase: CSSProperties = {
  pointerEvents: 'auto',
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: 12,
  color: 'rgba(248,251,255,0.98)',
  background:
    'linear-gradient(140deg, rgba(18,27,42,0.9), rgba(5,8,14,0.84))',
  fontFamily: uiFont,
  fontWeight: 700,
  letterSpacing: 0.5,
  fontSize: 12,
  textTransform: 'uppercase',
  padding: '10px 14px',
  cursor: 'pointer',
};

export function OctaSurgeUI({
  onStart,
  onReplayLast,
  onExportReplay,
  onImportReplay,
  onSelectMode,
  onCycleFxLevel,
  onCycleCamera,
  onSelectCamera,
  onSelectTileVariant,
  onCycleTileVariant,
}: {
  onStart: () => void;
  onReplayLast: () => void;
  onExportReplay: () => void;
  onImportReplay: () => void;
  onSelectMode: (mode: OctaSurgeMode) => void;
  onCycleFxLevel: () => void;
  onCycleCamera: () => void;
  onSelectCamera: (mode: OctaCameraMode) => void;
  onSelectTileVariant: (variant: OctaTileVariant) => void;
  onCycleTileVariant: (direction: -1 | 1) => void;
}) {
  const snap = useSnapshot(octaSurgeState);

  const runIsTimed = snap.mode !== 'endless';
  const runGoal =
    snap.mode === 'daily' ? GAME.dailyTargetScore : GAME.classicTargetScore;
  const nextUnlockTarget =
    OCTA_TILE_UNLOCK_THRESHOLDS[snap.variantUnlockTier] ?? null;
  const unlockProgress = nextUnlockTarget
    ? Math.max(0, Math.min(1, snap.styleShards / nextUnlockTarget))
    : 1;
  const hasReplay = !!snap.lastReplay;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        zIndex: 1400,
        pointerEvents: 'none',
        fontFamily: uiFont,
        color: 'rgba(246,250,255,0.98)',
      }}
    >
        {snap.phase !== 'playing' && (
          <div
            style={{
              position: 'fixed',
              top: 8,
              right: 8,
              minWidth: 156,
              padding: '7px 9px',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              backdropFilter: 'blur(8px)',
              background: 'rgba(8,13,20,0.42)',
              boxShadow: '0 6px 12px rgba(1,4,10,0.26)',
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: 1.4,
                opacity: 0.66,
              }}
            >
              SCORE
            </div>
            <div
              style={{
                marginTop: 2,
                fontFamily: monoFont,
                fontSize: 20,
                lineHeight: 1,
                fontWeight: 800,
              }}
            >
              {Math.floor(snap.score).toString().padStart(6, '0')}
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: monoFont,
                fontSize: 10,
                opacity: 0.82,
              }}
            >
              Best {Math.floor(snap.bestScore)}
            </div>
          </div>
        )}

        {snap.phase === 'playing' && (
          <>
            <div
              style={{
                position: 'fixed',
                top: 8,
                left: 8,
                minWidth: 164,
                padding: '7px 9px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                backdropFilter: 'blur(8px)',
                background: 'rgba(8,13,20,0.42)',
                boxShadow: '0 6px 12px rgba(1,4,10,0.26)',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 1.4,
                  opacity: 0.66,
                }}
              >
                SCORE
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: monoFont,
                  fontSize: 24,
                  lineHeight: 1,
                  fontWeight: 800,
                }}
              >
                {Math.floor(snap.score).toString().padStart(6, '0')}
              </div>
              <div
                style={{
                  marginTop: 5,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  fontFamily: monoFont,
                  fontSize: 10,
                  opacity: 0.82,
                }}
              >
                <span>{snap.multiplier.toFixed(1)}x</span>
                <span>Combo {Math.max(1, snap.combo)}</span>
                <span>{Math.floor(snap.distance)}m</span>
              </div>
            </div>

            <div
              style={{
                position: 'fixed',
                top: 8,
                right: 8,
                minWidth: 168,
                padding: '7px 9px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                backdropFilter: 'blur(8px)',
                background: 'rgba(8,13,20,0.42)',
                boxShadow: '0 6px 12px rgba(1,4,10,0.26)',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 1.4,
                  opacity: 0.66,
                }}
              >
                STAGE
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {snap.stageLabel}
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontFamily: monoFont,
                  fontSize: 10,
                  opacity: 0.84,
                }}
              >
                Sides {snap.sides} | Camera {CAMERA_MODE_LABEL[snap.cameraMode]}
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontFamily: monoFont,
                  fontSize: 10,
                  opacity: 0.8,
                }}
              >
                {runIsTimed
                  ? `Goal ${Math.floor(runGoal)} pts`
                  : `Time ${snap.time.toFixed(1)}s`} | {Math.floor(snap.speed * 2)} km/h
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontFamily: monoFont,
                  fontSize: 10,
                  opacity: 0.82,
                  lineHeight: 1.45,
                }}
              >
                Path {OCTA_PATH_STYLE_LABEL[snap.pathStyle]} | Style{' '}
                {OCTA_TILE_VARIANT_LABEL[snap.tileVariant]}
                <br />
                Platform {OCTA_PLATFORM_LABEL[snap.currentPlatform]} | Obstacle{' '}
                {OCTA_OBSTACLE_LABEL[snap.currentObstacle]}
              </div>
              {snap.replayMode === 'playback' && (
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: monoFont,
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(145,243,255,0.98)',
                    letterSpacing: 0.8,
                  }}
                >
                  Replay Playback Active
                </div>
              )}
            </div>

            {runIsTimed && (
              <div
                style={{
                  position: 'fixed',
                  left: '50%',
                  bottom: 8,
                  transform: 'translateX(-50%)',
                  width: 'min(220px, 46vw)',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(9,14,23,0.4)',
                  padding: 3,
                }}
              >
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    width: `${Math.max(0, Math.min(100, snap.progress * 100))}%`,
                    background:
                      'linear-gradient(90deg, rgba(101,239,255,0.96), rgba(255,168,96,0.96))',
                    transition: 'width 100ms linear',
                  }}
                />
              </div>
            )}

            {snap.time < 6 && (
              <div
                style={{
                  position: 'fixed',
                  left: 8,
                  bottom: 8,
                  maxWidth: 250,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(7,12,19,0.42)',
                  padding: '5px 7px',
                  fontSize: 9,
                  letterSpacing: 0.8,
                  opacity: 0.72,
                }}
              >
                A / D rotate lanes. Space / W flips. Shift slow-mo. Q / E cycles tile style. R replays last run.
              </div>
            )}
          </>
        )}

        {snap.stageFlash > 0.06 && snap.phase === 'playing' && (
          <div
            style={{
              position: 'fixed',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              opacity: Math.max(0, Math.min(1, snap.stageFlash)),
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(8,14,22,0.58)',
              fontSize: 11,
              letterSpacing: 2.4,
              textTransform: 'uppercase',
            }}
          >
            {snap.stageLabel}
          </div>
        )}

        {snap.phase !== 'playing' && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'auto',
              background:
                'radial-gradient(circle at 15% 14%, rgba(72,208,255,0.08), transparent 38%), radial-gradient(circle at 85% 84%, rgba(255,170,92,0.1), transparent 40%)',
            }}
          >
            <div
              style={{
                width: 'min(860px, 94vw)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 20,
                backdropFilter: 'blur(18px)',
                background:
                  'linear-gradient(120deg, rgba(12,20,31,0.88), rgba(6,10,16,0.82))',
                boxShadow: '0 38px 74px rgba(1,4,10,0.68)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '24px 26px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    letterSpacing: 3.8,
                    textTransform: 'uppercase',
                    opacity: 0.7,
                  }}
                >
                  Data Packet Simulation
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 'clamp(36px, 7vw, 64px)',
                    lineHeight: 0.88,
                    fontWeight: 900,
                    letterSpacing: -1.3,
                  }}
                >
                  {OCTA_SURGE_TITLE}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    gap: 14,
                    flexWrap: 'wrap',
                    fontFamily: monoFont,
                    fontSize: 12,
                    opacity: 0.84,
                  }}
                >
                  <span>Best {Math.floor(snap.bestScore)}</span>
                  <span>Classic {Math.floor(snap.bestClassic)}</span>
                  <span>Daily {Math.floor(snap.bestDaily)}</span>
                  <span>{CAMERA_MODE_LABEL[snap.cameraMode]}</span>
                  <span>{OCTA_PATH_STYLE_LABEL[snap.pathStyle]}</span>
                </div>
              </div>

              <div style={{ padding: '18px 26px 24px' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(['classic', 'endless', 'daily'] as const).map((mode) => {
                    const active = snap.mode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => onSelectMode(mode)}
                        style={{
                          ...buttonBase,
                          background: active
                            ? 'linear-gradient(135deg, rgba(101,239,255,0.35), rgba(255,168,96,0.32))'
                            : buttonBase.background,
                        }}
                      >
                        {modeLabel[mode]}
                      </button>
                    );
                  })}
                  <button onClick={onCycleFxLevel} style={buttonBase}>
                    {fxLabel[snap.fxLevel]}
                  </button>
                  <button onClick={onCycleCamera} style={buttonBase}>
                    {CAMERA_MODE_LABEL[snap.cameraMode]}
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {(['chase', 'firstPerson', 'topDown'] as const).map((cameraMode) => {
                    const active = snap.cameraMode === cameraMode;
                    return (
                      <button
                        key={cameraMode}
                        onClick={() => onSelectCamera(cameraMode)}
                        style={{
                          ...buttonBase,
                          fontSize: 11,
                          padding: '8px 12px',
                          background: active
                            ? 'linear-gradient(135deg, rgba(101,239,255,0.35), rgba(72,208,255,0.2))'
                            : 'rgba(255,255,255,0.04)',
                        }}
                      >
                        {CAMERA_MODE_LABEL[cameraMode]}
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginTop: 14,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: 1.5,
                      opacity: 0.72,
                      textTransform: 'uppercase',
                    }}
                  >
                    Smooth Classic Path // Apex Tile Styles
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      onClick={() => onCycleTileVariant(-1)}
                      style={{
                        ...buttonBase,
                        fontSize: 11,
                        padding: '8px 12px',
                      }}
                    >
                      Prev Style
                    </button>
                    <button
                      onClick={() => onCycleTileVariant(1)}
                      style={{
                        ...buttonBase,
                        fontSize: 11,
                        padding: '8px 12px',
                      }}
                    >
                      Next Style
                    </button>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    {OCTA_TILE_VARIANTS.map((variant) => {
                      const unlocked = snap.unlockedVariants.includes(variant);
                      const active = snap.tileVariant === variant;
                      return (
                        <button
                          key={variant}
                          disabled={!unlocked}
                          onClick={() => onSelectTileVariant(variant)}
                          style={{
                            ...buttonBase,
                            fontSize: 10,
                            padding: '7px 10px',
                            opacity: unlocked ? 1 : 0.42,
                            cursor: unlocked ? 'pointer' : 'not-allowed',
                            border: active
                              ? '1px solid rgba(255,255,255,0.82)'
                              : '1px solid rgba(255,255,255,0.2)',
                            background: active
                              ? 'linear-gradient(135deg, rgba(101,239,255,0.36), rgba(255,168,96,0.28))'
                              : 'rgba(255,255,255,0.05)',
                          }}
                        >
                          {OCTA_TILE_VARIANT_LABEL[variant]}
                          {!unlocked ? ' LOCK' : ''}
                        </button>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      marginTop: 9,
                      fontFamily: monoFont,
                      fontSize: 10,
                      opacity: 0.8,
                    }}
                  >
                    Style shards {snap.styleShards} | Unlocked {snap.unlockedVariants.length}/
                    {OCTA_TILE_VARIANTS.length}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      height: 4,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.floor(unlockProgress * 100)}%`,
                        background:
                          'linear-gradient(90deg, rgba(101,239,255,0.95), rgba(255,168,96,0.95))',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontFamily: monoFont,
                      fontSize: 10,
                      opacity: 0.75,
                    }}
                  >
                    {nextUnlockTarget
                      ? `Next style at ${nextUnlockTarget} shards`
                      : 'All styles unlocked'}
                  </div>
                  {snap.lastUnlockedVariant && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'rgba(145,243,255,0.95)',
                      }}
                    >
                      Unlocked: {OCTA_TILE_VARIANT_LABEL[snap.lastUnlockedVariant]}
                    </div>
                  )}
                </div>

                {snap.phase === 'gameover' && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: '12px 13px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,120,104,0.42)',
                      background: 'rgba(48,13,13,0.4)',
                      fontSize: 13,
                    }}
                  >
                    {snap.crashReason || 'Connection to the tunnel collapsed.'}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.5,
                      opacity: 0.86,
                      maxWidth: 500,
                    }}
                  >
                    Smooth Classic path generation stays intact while the obstacle
                    families are fully remapped (arc blades, shutter gates, pulse lasers,
                    gravity orbs, prism mines, ion barriers, ember waves, and vortex saws)
                    and new platform systems (drift boosts, warp gates, phase lanes,
                    split rails, gravity drift lanes, resin lanes, overdrive strips) stack
                    on top. Collect style shards to unlock every Apex-inspired tile variant.
                    {hasReplay && snap.lastReplay && (
                      <div style={{ marginTop: 8, fontFamily: monoFont, fontSize: 10, opacity: 0.84 }}>
                        Replay ready: {Math.floor(snap.lastReplay.finalScore)} pts in{' '}
                        {snap.lastReplay.finalTime.toFixed(1)}s ({snap.lastReplay.events.length} inputs)
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {hasReplay && (
                      <button
                        onClick={onReplayLast}
                        style={{
                          ...buttonBase,
                          borderRadius: 14,
                          padding: '12px 16px',
                          fontSize: 12,
                          background:
                            'linear-gradient(135deg, rgba(148,231,255,0.32), rgba(113,199,255,0.28))',
                        }}
                      >
                        Replay Last Run (R)
                      </button>
                    )}
                    {hasReplay && (
                      <button
                        onClick={onExportReplay}
                        style={{
                          ...buttonBase,
                          borderRadius: 14,
                          padding: '12px 16px',
                          fontSize: 12,
                          background:
                            'linear-gradient(135deg, rgba(121,219,255,0.24), rgba(108,174,255,0.22))',
                        }}
                      >
                        Copy Replay
                      </button>
                    )}
                    <button
                      onClick={onImportReplay}
                      style={{
                        ...buttonBase,
                        borderRadius: 14,
                        padding: '12px 16px',
                        fontSize: 12,
                        background:
                          'linear-gradient(135deg, rgba(95,188,255,0.22), rgba(88,146,255,0.2))',
                      }}
                    >
                      Import Replay
                    </button>
                    <button
                      onClick={onStart}
                      style={{
                        ...buttonBase,
                        borderRadius: 14,
                        padding: '12px 18px',
                        fontSize: 13,
                        background:
                          'linear-gradient(135deg, rgba(101,239,255,0.48), rgba(255,168,96,0.42))',
                        color: '#041018',
                        textShadow: 'none',
                      }}
                    >
                      {snap.phase === 'gameover'
                        ? 'Re-Initialize Link'
                        : 'Initialize Link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
