'use client';

import { Html } from '@react-three/drei';
import React from 'react';

import type { ReactPongMode } from '../types';

type ModeSelectMenuProps = {
  onSelectMode: (mode: ReactPongMode) => void;
};

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.18)',
  background:
    'linear-gradient(155deg, rgba(10,14,32,0.9), rgba(17,24,39,0.86) 48%, rgba(6,9,20,0.95))',
  boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
  padding: 14,
  color: '#E5F0FF',
  cursor: 'pointer',
  transition:
    'transform 160ms ease, border-color 180ms ease, box-shadow 180ms ease',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.78,
  lineHeight: 1.5,
};

function ModeCard({
  title,
  subtitle,
  shortcut,
  onClick,
  children,
}: {
  title: string;
  subtitle: string;
  shortcut: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={cardStyle}
      className="group text-left"
      aria-label={title}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: 0.2 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.24)',
            padding: '3px 9px',
            opacity: 0.82,
          }}
        >
          {shortcut}
        </div>
      </div>
      <div style={subtitleStyle}>{subtitle}</div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </button>
  );
}

export default function ModeSelectMenu({ onSelectMode }: ModeSelectMenuProps) {
  return (
    <Html fullscreen>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'auto',
          padding: 18,
          background:
            'radial-gradient(130% 85% at 50% -20%, rgba(43,125,255,0.25), rgba(7,10,20,0.9) 45%, rgba(3,6,14,0.95) 100%)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          color: '#E5F0FF',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ width: 'min(920px, 100%)' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: 0.2 }}>
              React Pong
            </div>
            <div style={{ fontSize: 13, opacity: 0.84, marginTop: 4 }}>
              Choose your arena. Press <b>M</b> anytime to reopen this menu.
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            <ModeCard
              title="Wall Pong"
              subtitle="Infinite endurance. One paddle, one opposing wall, no catches. Speed and spin escalate until you miss."
              shortcut="1"
              onClick={() => onSelectMode('WallMode')}
            >
              <svg viewBox="0 0 320 140" width="100%" height="132">
                <defs>
                  <linearGradient id="wall-bg" x1="0" x2="1">
                    <stop offset="0%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#111827" />
                  </linearGradient>
                  <linearGradient id="wall-glow" x1="0" x2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>
                <rect
                  x="1"
                  y="1"
                  width="318"
                  height="138"
                  rx="12"
                  fill="url(#wall-bg)"
                />
                <rect
                  x="34"
                  y="28"
                  width="14"
                  height="84"
                  rx="6"
                  fill="#3b82f6"
                  opacity="0.95"
                />
                <rect
                  x="270"
                  y="22"
                  width="10"
                  height="96"
                  rx="5"
                  fill="#f43f5e"
                  opacity="0.82"
                />
                <circle cx="166" cy="74" r="10" fill="#e0f2fe" />
                <circle
                  cx="166"
                  cy="74"
                  r="21"
                  fill="none"
                  stroke="url(#wall-glow)"
                  strokeWidth="2.5"
                  opacity="0.75"
                />
                <path
                  d="M52 96 C108 42, 210 116, 268 62"
                  fill="none"
                  stroke="#93c5fd"
                  strokeWidth="2"
                  strokeDasharray="6 5"
                  opacity="0.78"
                />
                <path
                  d="M52 56 C116 120, 208 20, 268 88"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.8"
                  strokeDasharray="4 5"
                  opacity="0.56"
                />
              </svg>
            </ModeCard>

            <ModeCard
              title="Solo Paddle"
              subtitle="Classic single-player rally. Keep control, build streaks, and survive with clean positioning."
              shortcut="2"
              onClick={() => onSelectMode('SoloPaddle')}
            >
              <svg viewBox="0 0 320 140" width="100%" height="132">
                <defs>
                  <linearGradient id="solo-bg" x1="0" x2="1">
                    <stop offset="0%" stopColor="#0c1227" />
                    <stop offset="100%" stopColor="#0b1020" />
                  </linearGradient>
                  <linearGradient id="solo-glow" x1="0" x2="1">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <rect
                  x="1"
                  y="1"
                  width="318"
                  height="138"
                  rx="12"
                  fill="url(#solo-bg)"
                />
                <rect
                  x="32"
                  y="24"
                  width="10"
                  height="92"
                  rx="5"
                  fill="#22d3ee"
                  opacity="0.92"
                />
                <rect
                  x="278"
                  y="24"
                  width="10"
                  height="92"
                  rx="5"
                  fill="#7dd3fc"
                  opacity="0.42"
                />
                <circle cx="160" cy="70" r="10" fill="#e9d5ff" />
                <circle
                  cx="160"
                  cy="70"
                  r="18"
                  fill="none"
                  stroke="url(#solo-glow)"
                  strokeWidth="2.3"
                  opacity="0.72"
                />
                <path
                  d="M44 70 H276"
                  stroke="#334155"
                  strokeDasharray="4 6"
                  opacity="0.65"
                />
                <path
                  d="M46 84 C110 20, 210 120, 276 52"
                  fill="none"
                  stroke="#c4b5fd"
                  strokeWidth="2"
                  opacity="0.72"
                />
              </svg>
            </ModeCard>
          </div>
        </div>
      </div>
    </Html>
  );
}
