'use client';

import * as React from 'react';
import { useSnapshot } from 'valtio';
import { oscillateState } from '../state';
import type { RunStatus } from '../types';

export const RunHUD: React.FC<{ run: React.MutableRefObject<RunStatus> }> = ({ run }) => {
  const snap = useSnapshot(oscillateState);
  const [ui, setUi] = React.useState({ score: 0, combo: 0, comboTime: 0, pulse: 0 });

  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      const r = run.current;
      // Throttle re-renders (UI doesn't need 60fps).
      setUi((prev) => {
        if (
          prev.score !== r.score ||
          prev.combo !== r.comboCount ||
          Math.abs(prev.comboTime - r.comboTime) > 0.05 ||
          Math.abs(prev.pulse - r.pulseCd) > 0.05
        ) {
          return { score: r.score, combo: r.comboCount, comboTime: r.comboTime, pulse: r.pulseCd };
        }
        return prev;
      });
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [run]);

  if (snap.phase !== 'playing') return null;

  const syncReady = ui.pulse <= 0.001;
  const comboOn = ui.combo > 0 && ui.comboTime > 0;

  return (
    <div className="absolute top-6 right-6 pointer-events-none">
      <div className="rounded-2xl bg-black/5 px-4 py-3 text-black/70 shadow-sm">
        <div className="text-sm">
          <span className="font-semibold text-black/80">Score</span> {ui.score}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className={`text-xs font-semibold ${comboOn ? 'text-black/80' : 'text-black/40'}`}>
            COMBO {comboOn ? `x${(1 + ui.combo * 0.12).toFixed(2)}` : '—'}
          </div>
          {comboOn && (
            <div className="h-2 w-24 overflow-hidden rounded-full bg-black/10">
              <div className="h-full bg-black/40" style={{ width: `${Math.min(100, (ui.comboTime / 2.6) * 100)}%` }} />
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <div className={`font-semibold ${syncReady ? 'text-emerald-600' : 'text-black/50'}`}>SYNC</div>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full bg-emerald-500/70"
              style={{ width: `${syncReady ? 100 : Math.max(0, 100 - (ui.pulse / run.current.pulseCdMax) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
