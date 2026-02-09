import React from 'react';
import {
  getKetchappGameSpec,
  type KetchappGameId,
} from '../../config/ketchapp';

type ShellStatus = 'ready' | 'playing' | 'gameover';
type ShellTone = 'dark' | 'light';

interface KetchappGameShellProps {
  gameId: KetchappGameId;
  score: number | string;
  best: number | string;
  status: ShellStatus;
  tone?: ShellTone;
  containerClassName?: string;
  deathTitle?: string;
  startCtaText?: string;
  retryCtaText?: string;
  statusNote?: React.ReactNode;
}

const toneClasses: Record<
  ShellTone,
  {
    text: string;
    card: string;
    centerCard: string;
  }
> = {
  dark: {
    text: 'text-white/90',
    card: 'border-white/20 bg-black/35',
    centerCard: 'border-white/20 bg-black/60',
  },
  light: {
    text: 'text-black/85',
    card: 'border-black/15 bg-white/65',
    centerCard: 'border-black/15 bg-white/85',
  },
};

export function KetchappGameShell({
  gameId,
  score,
  best,
  status,
  tone = 'dark',
  containerClassName = 'absolute inset-0',
  deathTitle = 'Run Over',
  startCtaText = 'Tap to Play',
  retryCtaText = 'Tap anywhere to retry instantly.',
  statusNote,
}: KetchappGameShellProps) {
  const spec = getKetchappGameSpec(gameId);
  const title = spec?.title ?? gameId;
  const tutorial = spec?.tutorial ?? 'One input. Endless run.';
  const toneClass = toneClasses[tone];

  return (
    <div
      className={`pointer-events-none ${containerClassName} p-4 ${toneClass.text}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-md border px-3 py-2 ${toneClass.card}`}>
          <div className="text-xs uppercase tracking-[0.25em] opacity-70">
            {title}
          </div>
          <div className="text-[11px] opacity-80">{tutorial}</div>
        </div>
        <div
          className={`rounded-md border px-3 py-2 text-right ${toneClass.card}`}
        >
          <div className="text-xl font-bold tabular-nums">{score}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
            Best {best}
          </div>
        </div>
      </div>

      {statusNote && status === 'playing' && (
        <div className="mt-3">
          <div
            className={`w-fit rounded-md border px-3 py-2 text-xs ${toneClass.card}`}
          >
            {statusNote}
          </div>
        </div>
      )}

      {status === 'ready' && (
        <div className="grid h-full place-items-center">
          <div
            className={`rounded-xl border px-6 py-5 text-center backdrop-blur-md ${toneClass.centerCard}`}
          >
            <div className="text-lg font-semibold">{title}</div>
            <div className="mt-2 text-sm opacity-80">{tutorial}</div>
            <div className="mt-3 text-sm font-medium opacity-85">
              {startCtaText}
            </div>
          </div>
        </div>
      )}

      {status === 'gameover' && (
        <div className="grid h-full place-items-center">
          <div
            className={`rounded-xl border px-6 py-5 text-center backdrop-blur-md ${toneClass.centerCard}`}
          >
            <div className="text-lg font-semibold">{deathTitle}</div>
            <div className="mt-2 text-sm opacity-80">{retryCtaText}</div>
          </div>
        </div>
      )}
    </div>
  );
}
