import { Html } from '@react-three/drei';
import React from 'react';

const GameOverOverlay: React.FC<{ score: number; bestScore: number; onRestart: () => void }> = ({
  score,
  bestScore,
  onRestart,
}) => {
  return (
    <Html fullscreen>
      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 text-white backdrop-blur-sm">
        <div
          className="w-[min(92vw,360px)] rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-6 text-center shadow-xl"
          style={{ boxShadow: '0 0 40px rgba(0, 255, 247, 0.3)' }}
        >
          <div className="text-sm uppercase tracking-[0.35em] text-cyan-400/80" style={{ fontFamily: '"Geist Mono", monospace' }}>
            FluxHop
          </div>
          <h2 className="mt-3 text-3xl font-semibold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">Game Over</h2>
          <div className="mt-4 text-lg">
            Score: <span className="text-cyan-400">{score}</span>
          </div>
          <div className="text-sm text-white/70">
            Best: <span className="text-pink-400">{bestScore}</span>
          </div>
          <button
            onClick={onRestart}
            className="mt-5 w-full rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-900/50 to-pink-900/50 px-4 py-3 text-sm uppercase tracking-[0.3em] hover:from-cyan-800/60 hover:to-pink-800/60 transition-all"
            style={{ boxShadow: '0 0 20px rgba(0, 255, 247, 0.2)' }}
          >
            Retry
          </button>
          <div className="mt-3 text-xs text-white/50">R to restart - Swipe or tap to move</div>
        </div>
      </div>
    </Html>
  );
};

export default GameOverOverlay;
