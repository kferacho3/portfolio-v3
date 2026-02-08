'use client';

import * as React from 'react';
import { useSnapshot } from 'valtio';
import { onePathState as oscillateState } from '../state';

function formatLevel(n: number) {
  return `${n}`;
}

export const Overlay: React.FC = () => {
  const snap = useSnapshot(oscillateState);

  const topText = (() => {
    if (snap.phase === 'playing') return formatLevel(snap.level);
    return '';
  })();

  return (
    <div className="absolute inset-0 select-none">
      {/* top level */}
      <div className="absolute top-6 left-0 right-0 flex items-start justify-center pointer-events-none">
        <div
          className="text-black text-7xl font-black tracking-tight"
          style={{ opacity: topText ? 1 : 0 }}
        >
          {topText}
        </div>
      </div>

      {/* bottom HUD */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-3 rounded-full bg-black/5 px-4 py-2 text-black/70">
          <div className="text-sm">
            <span className="font-semibold text-black/80">Gems</span>{' '}
            {snap.gems}
          </div>
          <div className="h-4 w-px bg-black/10" />
          <div className="text-sm">
            <span className="font-semibold text-black/80">Best</span>{' '}
            {snap.mode === 'levels' ? snap.bestLevel : snap.endlessBest}
          </div>
          <div className="h-4 w-px bg-black/10" />
          <div className="text-sm">
            <span className="font-semibold text-black/80">Skin</span>{' '}
            {snap.selectedSkin}
          </div>
        </div>
      </div>

      {/* MENU */}
      {snap.phase === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(600px,92vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl font-black text-black">One Path</div>
                <div className="mt-2 text-black/70">
                  Bounce between side walls. Tap{' '}
                  <span className="font-semibold text-black/80">
                    near the end
                  </span>{' '}
                  to turn onto the next bridge.
                </div>
              </div>
              <button
                className="rounded-2xl bg-black/5 px-4 py-2 text-sm font-semibold text-black/70 hover:bg-black/10"
                onClick={() => oscillateState.openShop()}
              >
                Shop
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/5 p-4">
                <div className="text-sm font-semibold text-black/80">
                  Timing window
                </div>
                <div className="mt-1 text-sm text-black/60">
                  The bridge has an offset. Tap when the ball lines up with the
                  glowing gate.
                </div>
              </div>
              <div className="rounded-2xl bg-black/5 p-4">
                <div className="text-sm font-semibold text-black/80">
                  Save tool
                </div>
                <div className="mt-1 text-sm text-black/60">
                  Once in a while, a "SYNC" save will rescue a near-miss
                  (cooldown).
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-black/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-black/80">
                    Select Level
                  </div>
                  <div className="text-sm text-black/60">
                    Levels are deterministic.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="h-10 w-10 rounded-xl bg-white/80 text-black font-black hover:bg-white"
                    onClick={() =>
                      oscillateState.selectLevel(
                        Math.max(1, snap.selectedLevel - 1)
                      )
                    }
                  >
                    –
                  </button>
                  <div className="min-w-[64px] text-center text-2xl font-black text-black">
                    {snap.selectedLevel}
                  </div>
                  <button
                    className="h-10 w-10 rounded-xl bg-white/80 text-black font-black hover:bg-white"
                    onClick={() =>
                      oscillateState.selectLevel(snap.selectedLevel + 1)
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-black/40 leading-relaxed">
                Inspired by{' '}
                <span className="font-semibold text-black/50">The Walls</span> —
                Ketchapp.
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                  onClick={() => oscillateState.startEndless()}
                >
                  Endless
                </button>
                <button
                  className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                  onClick={() => oscillateState.start()}
                >
                  Play
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOP */}
      {snap.phase === 'shop' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(720px,94vw)] rounded-3xl bg-white/95 p-6 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-black text-black">Ball Shop</div>
                <div className="mt-1 text-sm text-black/60">
                  Spend gems to unlock new balls.
                </div>
              </div>
              <button
                className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white"
                onClick={() => oscillateState.closeShop()}
              >
                Done
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-black/70">
                Gems:{' '}
                <span className="font-semibold text-black">{snap.gems}</span>
              </div>
              <button
                className="rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/10"
                onClick={() => oscillateState.awardGems(25)}
                title="Dev helper"
              >
                +25 gems
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {snap.skins.map((s) => {
                const unlocked = snap.unlockedSkins.includes(s.id);
                const selected = snap.selectedSkin === s.id;
                const affordable = unlocked || snap.gems >= s.cost;
                return (
                  <button
                    key={s.id}
                    className={`rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                      selected
                        ? 'border-black bg-black/5'
                        : 'border-black/10 bg-white'
                    } ${affordable ? 'hover:bg-black/5' : 'opacity-60'}`}
                    onClick={() => {
                      if (unlocked) oscillateState.selectSkin(s.id);
                      else oscillateState.unlockSkin(s.id);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full border border-black/10"
                        style={{ background: s.color }}
                      />
                      <div className="min-w-0">
                        <div className="font-black text-black truncate">
                          {s.name}
                        </div>
                        <div className="text-xs text-black/60">
                          {unlocked
                            ? selected
                              ? 'Selected'
                              : 'Unlocked'
                            : `${s.cost} gems`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 text-xs text-black/40">
              Tip: Clear levels to earn gems.
            </div>
          </div>
        </div>
      )}

      {/* CLEARED */}
      {snap.phase === 'cleared' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(560px,92vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <div className="text-4xl font-black text-black">
              LEVEL {snap.level} <span className="text-black/70">CLEARED!</span>
            </div>

            <div className="mt-3 flex items-center gap-3 text-black/70">
              <div className="rounded-xl bg-black/5 px-3 py-2">
                +{snap.lastRunGems} gems
              </div>
              <div className="text-sm">
                Total:{' '}
                <span className="font-semibold text-black/80">{snap.gems}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                onClick={() => oscillateState.goMenu()}
              >
                Menu
              </button>
              <button
                className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                onClick={() => oscillateState.retry()}
              >
                Replay
              </button>
              <button
                className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                onClick={() => oscillateState.next()}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAMEOVER */}
      {snap.phase === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto w-[min(560px,92vw)] rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur">
            <div className="text-4xl font-black text-black">Missed.</div>
            <div className="mt-2 text-black/70">
              Tap near the end when the ball lines up with the gate.
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-sm text-black/60">
                {snap.mode === 'levels' ? (
                  <>
                    Level{' '}
                    <span className="font-semibold text-black/80">
                      {snap.level}
                    </span>{' '}
                    • Best{' '}
                    <span className="font-semibold text-black/80">
                      {snap.bestLevel}
                    </span>
                  </>
                ) : (
                  <>
                    Endless{' '}
                    <span className="font-semibold text-black/80">
                      {snap.level}
                    </span>{' '}
                    • Best{' '}
                    <span className="font-semibold text-black/80">
                      {snap.endlessBest}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="rounded-2xl bg-black/5 px-5 py-3 text-black font-semibold hover:bg-black/10"
                  onClick={() => oscillateState.goMenu()}
                >
                  Menu
                </button>
                <button
                  className="rounded-2xl bg-black px-5 py-3 text-white font-semibold active:scale-[0.99]"
                  onClick={() => oscillateState.retry()}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
