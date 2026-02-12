'use client';

import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import { useSnapshot } from 'valtio';

import { CAMERA_MODE_LABEL, OCTA_SURGE_TITLE } from '../constants';
import { octaSurgeState } from '../state';
import type {
  OctaCameraMode,
  OctaFxLevel,
  OctaSurgeMode,
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
  background: 'linear-gradient(140deg, rgba(20,29,44,0.86), rgba(7,10,16,0.72))',
  fontFamily: uiFont,
  fontWeight: 700,
  letterSpacing: 0.5,
  fontSize: 12,
  textTransform: 'uppercase',
  padding: '10px 14px',
  cursor: 'pointer',
};

const metricCard: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 14,
  backdropFilter: 'blur(16px)',
  background: 'linear-gradient(130deg, rgba(26,38,57,0.6), rgba(7,10,15,0.45))',
  boxShadow: '0 18px 34px rgba(1,4,10,0.55)',
  padding: '12px 14px',
};

export function OctaSurgeUI({
  onStart,
  onSelectMode,
  onCycleFxLevel,
  onCycleCamera,
  onSelectCamera,
}: {
  onStart: () => void;
  onSelectMode: (mode: OctaSurgeMode) => void;
  onCycleFxLevel: () => void;
  onCycleCamera: () => void;
  onSelectCamera: (mode: OctaCameraMode) => void;
}) {
  const snap = useSnapshot(octaSurgeState);

  const runIsTimed = snap.mode !== 'endless';
  const runGoal = snap.mode === 'daily' ? 14000 : 18000;

  return (
    <Html fullscreen>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          fontFamily: uiFont,
          color: 'rgba(246,250,255,0.98)',
          background:
            'radial-gradient(circle at 12% 14%, rgba(72,208,255,0.09), transparent 32%), radial-gradient(circle at 84% 80%, rgba(255,170,92,0.11), transparent 34%)',
        }}
      >
        {snap.phase === 'playing' && (
          <>
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                display: 'grid',
                gap: 10,
                minWidth: 210,
              }}
            >
              <div style={metricCard}>
                <div style={{ fontSize: 10, opacity: 0.72, letterSpacing: 1.8 }}>
                  DATA PACKET VELOCITY
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 42,
                    lineHeight: 1,
                    fontWeight: 900,
                    letterSpacing: 0.6,
                  }}
                >
                  {(snap.speed * 2.4).toFixed(0)}
                  <span style={{ fontSize: 15, marginLeft: 4, opacity: 0.82 }}>
                    km/h
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontFamily: monoFont,
                    fontSize: 11,
                    opacity: 0.84,
                  }}
                >
                  <span>Combo x{Math.max(1, snap.combo)}</span>
                  <span>{snap.multiplier.toFixed(1)}x</span>
                </div>
              </div>

              <div style={metricCard}>
                <div style={{ fontSize: 10, opacity: 0.72, letterSpacing: 1.8 }}>
                  STAGE / TOPOLOGY
                </div>
                <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800 }}>
                  {snap.stageLabel}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontFamily: monoFont,
                    fontSize: 11,
                    opacity: 0.85,
                  }}
                >
                  Sides: {snap.sides} | Camera: {CAMERA_MODE_LABEL[snap.cameraMode]}
                </div>
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'grid',
                gap: 10,
                width: 220,
              }}
            >
              <div style={metricCard}>
                <div style={{ fontSize: 10, opacity: 0.72, letterSpacing: 1.8 }}>
                  RUN STATUS
                </div>
                <div
                  style={{
                    marginTop: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span>Score</span>
                  <span style={{ fontFamily: monoFont }}>{Math.floor(snap.score)}</span>
                </div>
                <div
                  style={{
                    marginTop: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span>Distance</span>
                  <span style={{ fontFamily: monoFont }}>{Math.floor(snap.distance)}m</span>
                </div>
                <div
                  style={{
                    marginTop: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span>{runIsTimed ? 'Goal' : 'Time'}</span>
                  <span style={{ fontFamily: monoFont }}>
                    {runIsTimed ? `${Math.floor(runGoal)} pts` : `${snap.time.toFixed(1)}s`}
                  </span>
                </div>
              </div>

              <div style={metricCard}>
                <div style={{ fontSize: 10, opacity: 0.72, letterSpacing: 1.8 }}>
                  SHARD CHARGE
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 8,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.14)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, snap.slowMoMeter))}%`,
                      height: '100%',
                      background:
                        'linear-gradient(90deg, rgba(101,239,255,0.96), rgba(255,168,96,0.96))',
                      transition: 'width 90ms linear',
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: monoFont,
                    fontSize: 11,
                    opacity: 0.84,
                  }}
                >
                  Shards {snap.shardCount} | Audio {Math.floor(snap.audioReactive * 100)}%
                </div>
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 34,
                transform: 'translateX(-50%)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 7,
                  opacity: 0.62,
                }}
              >
                CORRUPTED FIBER LINK
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: monoFont,
                  fontSize: 72,
                  lineHeight: 0.9,
                  fontWeight: 800,
                  letterSpacing: -1.8,
                  textShadow: '0 16px 34px rgba(5,10,20,0.65)',
                }}
              >
                {Math.floor(snap.score).toString().padStart(6, '0')}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  opacity: 0.75,
                  letterSpacing: 1.8,
                }}
              >
                A / D OR ARROWS TO STEP | SPACE / W TO FLIP | C TO VIEW
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 72,
                height: 72,
                borderRadius: '50%',
                border: `2px solid ${snap.hudPulse > 0.55 ? 'rgba(255,90,79,0.8)' : 'rgba(101,239,255,0.55)'}`,
                boxShadow:
                  snap.hudPulse > 0.55
                    ? '0 0 30px rgba(255,90,79,0.5)'
                    : '0 0 26px rgba(101,239,255,0.36)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) rotate(${snap.hudPulse > 0.2 ? 180 : 0}deg)`,
                  color: snap.hudPulse > 0.2 ? 'rgba(255,168,96,0.95)' : 'rgba(101,239,255,0.95)',
                  fontSize: 19,
                  fontWeight: 900,
                  transition: 'transform 220ms ease, color 220ms ease',
                }}
              >
                ↓
              </div>
            </div>
          </>
        )}

        {snap.stageFlash > 0.04 && snap.phase === 'playing' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              opacity: Math.max(0, Math.min(1, snap.stageFlash)),
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: 'min(18vw, 190px)',
                letterSpacing: 6,
                fontWeight: 900,
                color: 'rgba(255,255,255,0.08)',
                textTransform: 'uppercase',
              }}
            >
              {snap.stageLabel}
            </div>
          </div>
        )}

        {snap.phase !== 'playing' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'auto',
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
                      maxWidth: 460,
                    }}
                  >
                    Rotate the prism tunnel by lane steps. Flip gravity to the
                    opposite lane, collect cores mid-flip, and survive stage morphs
                    from 6 to 12 sides.
                  </div>

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
                    {snap.phase === 'gameover' ? 'Re-Initialize Link' : 'Initialize Link'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Html>
  );
}
