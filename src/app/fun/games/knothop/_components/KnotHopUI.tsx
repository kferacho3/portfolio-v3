'use client';

import { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import FixedViewportOverlay from '../../_shared/FixedViewportOverlay';

import { CHARACTER_MODELS } from '../constants';
import { knotHopState } from '../state';

export function KnotHopUI() {
  const snap = useSnapshot(knotHopState);

  const selectedCharacter = useMemo(
    () =>
      CHARACTER_MODELS.find((character) => character.id === snap.selectedCharacter) ??
      CHARACTER_MODELS[0],
    [snap.selectedCharacter]
  );

  const selectedUnlocked = snap.unlockedCharacters.includes(selectedCharacter.id);
  const lockCost = `${selectedCharacter.cost.gold}G ${selectedCharacter.cost.green}E ${selectedCharacter.cost.purple}V`;

  return (
    <FixedViewportOverlay>
      <div className="absolute inset-0 pointer-events-none select-none text-white">
        <div className="absolute left-4 top-4 rounded-md border border-cyan-100/35 bg-gradient-to-br from-cyan-900/40 via-slate-900/55 to-rose-900/24 px-3 py-2 backdrop-blur-[2px]">
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-50/90">
            Knot Hop
          </div>
          <div className="text-[11px] text-cyan-50/80">
            Tap to reverse spiral direction, dodge hazards, and collect rare
            flux shards.
          </div>
        </div>

        <div className="absolute right-4 top-4 rounded-md border border-cyan-100/35 bg-black/45 px-3 py-2 text-right backdrop-blur-[2px]">
          <div className="text-3xl font-black tabular-nums">{snap.score}</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">
            Best {snap.best}
          </div>
          <div className="mt-1 text-[11px] text-yellow-300">
            Gold <span className="font-semibold">{snap.gold}</span>
          </div>
          <div className="text-[11px] text-green-300">
            Emerald <span className="font-semibold">{snap.green}</span>
          </div>
          <div className="text-[11px] text-purple-300">
            Void <span className="font-semibold">{snap.purple}</span>
          </div>
        </div>

        {snap.phase === 'playing' && (
          <div className="absolute left-4 top-[98px] rounded-md border border-white/20 bg-black/38 px-3 py-2 text-xs text-white/90">
            <div>
              Dodged <span className="font-semibold text-cyan-100">{snap.dodged}</span>
            </div>
            <div>
              Collected{' '}
              <span className="font-semibold text-amber-100">{snap.collected}</span>
            </div>
            <div>
              Streak{' '}
              <span className="font-semibold text-emerald-100">
                x{Math.max(1, snap.streak)}
              </span>
            </div>
            <div>
              Speed{' '}
              <span className="font-semibold text-sky-100">
                {snap.speed.toFixed(1)}
              </span>
            </div>
            <div>
              Direction{' '}
              <span className="font-semibold text-violet-100">{snap.direction}</span>
            </div>
            <div>
              Run Gold <span className="font-semibold text-yellow-300">{snap.runGold}</span>
            </div>
            <div>
              Run Emerald <span className="font-semibold text-green-300">{snap.runGreen}</span>
            </div>
            <div>
              Run Void <span className="font-semibold text-purple-300">{snap.runPurple}</span>
            </div>
            <div>
              Character{' '}
              <span className="font-semibold text-rose-100">{selectedCharacter.name}</span>
            </div>
          </div>
        )}

        {snap.phase === 'menu' && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-xl border border-cyan-100/40 bg-gradient-to-br from-slate-950/84 via-cyan-950/38 to-teal-950/30 px-6 py-5 text-center backdrop-blur-md">
              <div className="text-2xl font-black tracking-wide">KNOT HOP</div>
              <div className="mt-2 text-sm text-white/85">
                A spiral runner through black/red/rust hazard lanes.
              </div>
              <div className="mt-1 text-sm text-white/85">
                Collect Gold, Emerald, and Void shards to unlock new character
                forms.
              </div>
              <div className="mt-3 rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-left">
                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/90">
                  Selected Character
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {selectedCharacter.name}
                </div>
                <div className="text-[11px] text-white/75">
                  {selectedCharacter.description}
                </div>
                <div className="mt-1 text-[11px]">
                  {selectedUnlocked ? (
                    <span className="text-emerald-200">Unlocked</span>
                  ) : (
                    <span className="text-amber-200">Locked • Cost {lockCost}</span>
                  )}
                </div>
              </div>
              <div className="mt-3 text-sm text-cyan-100/95">
                Q / E cycle characters • U unlock selected
              </div>
              <div className="mt-1 text-sm text-cyan-100/95">
                Tap, click, or press Space to start.
              </div>
            </div>
          </div>
        )}

        {snap.phase === 'gameover' && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-xl border border-rose-100/40 bg-gradient-to-br from-black/84 via-rose-950/34 to-cyan-950/26 px-6 py-5 text-center backdrop-blur-md">
              <div className="text-2xl font-black text-cyan-100">Signal Lost</div>
              <div className="mt-2 text-sm text-white/80">Score {snap.score}</div>
              <div className="mt-1 text-sm text-white/75">Best {snap.best}</div>
              <div className="mt-1 text-sm text-yellow-300">
                Run Gold +{snap.runGold}
              </div>
              <div className="text-sm text-green-300">
                Run Emerald +{snap.runGreen}
              </div>
              <div className="text-sm text-purple-300">
                Run Void +{snap.runPurple}
              </div>
              {snap.crashReason ? (
                <div className="mt-2 text-sm text-rose-100/90">{snap.crashReason}</div>
              ) : null}
              <div className="mt-3 text-sm text-cyan-100/90">Tap to run again.</div>
            </div>
          </div>
        )}

        {snap.toastTime > 0 && snap.toastText && (
          <div className="absolute inset-x-0 top-20 flex justify-center">
            <div className="rounded-md border border-cyan-100/45 bg-black/45 px-4 py-1 text-sm font-semibold tracking-[0.11em] text-cyan-100">
              {snap.toastText}
            </div>
          </div>
        )}
      </div>
    </FixedViewportOverlay>
  );
}
