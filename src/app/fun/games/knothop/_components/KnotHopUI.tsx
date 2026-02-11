'use client';

import { Html } from '@react-three/drei';
import { useSnapshot } from 'valtio';

import { knotHopState } from '../state';

export function KnotHopUI() {
  const snap = useSnapshot(knotHopState);

  return (
    <Html fullscreen>
      <div className="absolute inset-0 pointer-events-none select-none text-white">
        <div className="absolute left-4 top-4 rounded-md border border-emerald-100/55 bg-gradient-to-br from-emerald-500/28 via-cyan-500/20 to-sky-500/24 px-3 py-2 backdrop-blur-[2px]">
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-50/90">Knot Hop</div>
          <div className="text-[11px] text-cyan-50/85">Tap to hop around the rope before each knot arrives.</div>
        </div>

        <div className="absolute right-4 top-4 rounded-md border border-sky-100/60 bg-gradient-to-br from-slate-900/62 via-cyan-800/40 to-emerald-700/30 px-3 py-2 text-right backdrop-blur-[2px]">
          <div className="text-2xl font-black tabular-nums">{snap.score}</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Best {snap.best}</div>
        </div>

        {snap.phase === 'playing' && (
          <div className="absolute left-4 top-[92px] rounded-md border border-white/30 bg-black/35 px-3 py-2 text-xs text-white/90">
            <div>
              Knots <span className="font-semibold text-cyan-100">{snap.knotsPassed}</span>
            </div>
            <div>
              Combo <span className="font-semibold text-emerald-100">x{Math.max(1, snap.combo)}</span>
            </div>
            <div>
              Perfect <span className="font-semibold text-sky-100">{snap.perfects}</span>
            </div>
            <div>
              Speed <span className="font-semibold text-amber-100">{snap.speed.toFixed(1)}</span>
            </div>
          </div>
        )}

        {snap.phase === 'menu' && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-xl border border-emerald-100/45 bg-gradient-to-br from-slate-900/80 via-cyan-900/44 to-emerald-800/30 px-6 py-5 text-center backdrop-blur-md">
              <div className="text-2xl font-black tracking-wide">KNOT HOP</div>
              <div className="mt-2 text-sm text-white/85">A bead rides an endless rope. Each knot leaves one safe side.</div>
              <div className="mt-1 text-sm text-white/85">Tap to hop clockwise around the rope and line up with the safe pocket.</div>
              <div className="mt-3 text-sm text-cyan-100/95">Tap or press Space to start.</div>
            </div>
          </div>
        )}

        {snap.phase === 'gameover' && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-900/40 to-cyan-900/30 px-6 py-5 text-center backdrop-blur-md">
              <div className="text-2xl font-black text-cyan-100">Knot Hit</div>
              <div className="mt-2 text-sm text-white/80">Score {snap.score}</div>
              <div className="mt-1 text-sm text-white/75">Best {snap.best}</div>
              <div className="mt-3 text-sm text-cyan-100/90">Tap to run again.</div>
            </div>
          </div>
        )}

        {snap.toastTime > 0 && snap.toastText && (
          <div className="absolute inset-x-0 top-20 flex justify-center">
            <div className="rounded-md border border-cyan-100/55 bg-black/42 px-4 py-1 text-sm font-semibold tracking-[0.11em] text-cyan-100">
              {snap.toastText}
            </div>
          </div>
        )}
      </div>
    </Html>
  );
}
