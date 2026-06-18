'use client';

import React from 'react';
import { useSnapshot } from 'valtio';

import { PRISM3D_STUDIO_URL } from '../../../config/access';
import { growthState } from '../state';
import type { GrowthPathStyleId } from '../types';

type GrowthPathStyleSummary = {
  label: string;
  subtitle: string;
  menuAccent: string;
};

const PATH_STYLE_SUMMARIES: Record<GrowthPathStyleId, GrowthPathStyleSummary> = {
  voxelized: {
    label: 'Voxelized Cubed Path',
    subtitle: 'Chunked voxel beam with crisp stepped blocks.',
    menuAccent: '#fda4af',
  },
  classic: {
    label: 'Classic Branch Beam',
    subtitle: 'Single continuous beam with classic branch silhouettes.',
    menuAccent: '#fbbf24',
  },
  apex: {
    label: 'Apex Neon Run',
    subtitle: 'Apex-inspired polished lane with bright neon branches.',
    menuAccent: '#38bdf8',
  },
};

export default function GrowthOverlay() {
  const snap = useSnapshot(growthState);
  const activePathStyle =
    PATH_STYLE_SUMMARIES[snap.pathStyle] ?? PATH_STYLE_SUMMARIES.voxelized;
  const isMenuPhase = snap.phase === 'menu' || snap.phase === 'gameover';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1200] h-dvh w-dvw"
      data-growth-overlay
    >
      <div
        className="fixed text-white"
        data-growth-hud
        style={{
          top: 'var(--arcade-shell-top)',
          left: 'var(--arcade-shell-inline)',
          fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
          maxWidth: 'min(260px, calc(100vw - 28px))',
          textShadow: '0 2px 10px rgba(0,0,0,0.5)',
        }}
      >
        <div className="text-[13px] opacity-85">GROWTH</div>
        <div className="text-[30px] font-black leading-none">{snap.score}</div>
        <div className="mt-1 text-[13px] opacity-90">Gems: {snap.gems}</div>
        <div className="text-xs opacity-80">Best: {snap.bestScore}</div>
        <div className="text-xs opacity-80">Style: {activePathStyle.label}</div>
        <div className="text-xs opacity-80">
          Speed: {Number(snap.speed || 0).toFixed(1)}
        </div>
        {snap.shieldMs > 0 && (
          <div className="text-xs text-violet-200">
            Shield {Math.ceil(snap.shieldMs / 1000)}s
          </div>
        )}
        {snap.boostMs > 0 && (
          <div className="text-xs text-cyan-200">
            Boost {Math.ceil(snap.boostMs / 1000)}s
          </div>
        )}
      </div>

      {isMenuPhase && (
        <div
          className="arcade-safe-area arcade-safe-scroll pointer-events-auto fixed inset-0 flex items-center justify-center"
          data-growth-menu
          onClick={() => growthState.startGame()}
        >
          <div className="arcade-safe-card w-full max-w-[420px] rounded-2xl border border-white/10 bg-slate-950/85 px-5 py-5 text-center text-white shadow-2xl backdrop-blur-xl sm:px-6">
            <div className="text-3xl font-black leading-none">Growth</div>
            <div className="mt-3 text-[13px] leading-relaxed text-white/85">
              Jump low branches and rotate to safer faces when tall branches
              grow too high.
            </div>
            <div className="mt-3 space-y-0.5 text-xs text-white/75">
              <div>A / Q / Left Arrow / Swipe Left: rotate +90 deg</div>
              <div>D / E / Right Arrow / Swipe Right: rotate -90 deg</div>
              <div>Tap / Space: jump</div>
            </div>

            <div className="mt-4 text-xs text-white/90">Path style</div>
            <div className="mt-2 grid gap-2">
              <div
                className="rounded-xl bg-white/10 px-3 py-2 text-left leading-snug text-white"
                style={{ border: `1px solid ${activePathStyle.menuAccent}` }}
              >
                <div className="text-xs font-bold">
                  1. {activePathStyle.label}
                </div>
                <div className="text-[11px] text-white/75">
                  {activePathStyle.subtitle}
                </div>
              </div>
              <div className="text-[11px] text-white/75">
                Extra Growth path styles are available on{' '}
                <a
                  href={PRISM3D_STUDIO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-200 underline-offset-2 hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  prism3d.studio
                </a>
                .
              </div>
            </div>
            {snap.phase === 'gameover' && (
              <div className="mt-4 text-[13px] text-white/95">
                Run ended - Score {snap.score}
              </div>
            )}
            <div className="mt-4 text-xs text-white/65">
              Style locked to Voxelized - Tap / Space to{' '}
              {snap.phase === 'menu' ? 'start' : 'restart'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
