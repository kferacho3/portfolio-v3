import { Html } from '@react-three/drei';
import React from 'react';
import type { MoveDirection } from '../types';

const ControlsOverlay: React.FC<{
  status: 'running' | 'over';
  combo: number;
  bestCombo: number;
  onMove: (direction: MoveDirection) => void;
  onReset: () => void;
}> = ({ status, combo, bestCombo, onMove }) => {
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="fixed left-6 top-6 flex flex-col gap-2 text-white pointer-events-none">
        <div
          className="rounded-xl border border-cyan-400/30 bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.3em]"
          style={{
            fontFamily: '"Geist Mono", monospace',
            boxShadow: '0 0 20px rgba(0, 255, 247, 0.2)',
          }}
        >
          combo{' '}
          <span className="ml-2 text-base font-semibold text-cyan-400">
            {combo}
          </span>
        </div>
        <div
          className="rounded-xl border border-pink-400/30 bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.3em]"
          style={{
            fontFamily: '"Geist Mono", monospace',
            boxShadow: '0 0 20px rgba(255, 0, 255, 0.2)',
          }}
        >
          best{' '}
          <span className="ml-2 text-base font-semibold text-pink-400">
            {bestCombo}
          </span>
        </div>
      </div>

      {status === 'running' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-white pointer-events-auto">
          <div
            className="mb-2 text-center text-xs uppercase tracking-[0.3em] text-white/60"
            style={{ fontFamily: '"Geist Mono", monospace' }}
          >
            swipe or tap
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-11 w-11" />
            <button
              className="h-11 w-11 rounded-lg border border-cyan-400/30 bg-slate-900/80 text-lg hover:bg-cyan-900/50 hover:border-cyan-400/60 transition-all"
              onClick={() => onMove('forward')}
              style={{ boxShadow: '0 0 10px rgba(0, 255, 247, 0.2)' }}
            >
              ^
            </button>
            <div className="h-11 w-11" />
            <button
              className="h-11 w-11 rounded-lg border border-cyan-400/30 bg-slate-900/80 text-lg hover:bg-cyan-900/50 hover:border-cyan-400/60 transition-all"
              onClick={() => onMove('left')}
              style={{ boxShadow: '0 0 10px rgba(0, 255, 247, 0.2)' }}
            >
              {'<'}
            </button>
            <div className="h-11 w-11" />
            <button
              className="h-11 w-11 rounded-lg border border-cyan-400/30 bg-slate-900/80 text-lg hover:bg-cyan-900/50 hover:border-cyan-400/60 transition-all"
              onClick={() => onMove('right')}
              style={{ boxShadow: '0 0 10px rgba(0, 255, 247, 0.2)' }}
            >
              {'>'}
            </button>
            <div className="h-11 w-11" />
            <button
              className="h-11 w-11 rounded-lg border border-cyan-400/30 bg-slate-900/80 text-lg hover:bg-cyan-900/50 hover:border-cyan-400/60 transition-all"
              onClick={() => onMove('backward')}
              style={{ boxShadow: '0 0 10px rgba(0, 255, 247, 0.2)' }}
            >
              v
            </button>
            <div className="h-11 w-11" />
          </div>
        </div>
      )}
    </Html>
  );
};

export default ControlsOverlay;
