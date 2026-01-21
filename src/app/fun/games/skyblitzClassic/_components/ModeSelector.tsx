import { Html } from '@react-three/drei';
import React from 'react';
import { useSnapshot } from 'valtio';
import { skyBlitzClassicState } from '../state';

const ModeSelector: React.FC = () => {
  const snap = useSnapshot(skyBlitzClassicState);

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute top-4 left-4 z-50 pointer-events-auto">
        <div className="bg-slate-950/80 backdrop-blur-sm rounded-xl border border-white/10 px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-white/60 mb-2">Mode</div>
          <div className="flex gap-2">
            <button
              onClick={() => skyBlitzClassicState.setMode('UfoMode')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                snap.mode === 'UfoMode'
                  ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10'
                  : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              UFO Mode
            </button>
            <button
              onClick={() => skyBlitzClassicState.setMode('RunnerManMode')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                snap.mode === 'RunnerManMode'
                  ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10'
                  : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              Runner Mode
            </button>
          </div>
          <div className="mt-3 text-xs uppercase tracking-wider text-white/60 mb-2">Graphics</div>
          <div className="flex gap-2">
            <button
              onClick={() => skyBlitzClassicState.setGraphicsMode('clean')}
              className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                snap.graphicsMode === 'clean'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10'
                  : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              Clean
            </button>
            <button
              onClick={() => skyBlitzClassicState.setGraphicsMode('classic')}
              className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                snap.graphicsMode === 'classic'
                  ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                  : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              Classic
            </button>
          </div>
        </div>
      </div>
    </Html>
  );
};

export default ModeSelector;
