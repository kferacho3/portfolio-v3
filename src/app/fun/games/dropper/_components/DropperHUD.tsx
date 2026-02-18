import { Html } from '@react-three/drei';
import React from 'react';
import type { DropperDifficulty } from '../types';
import HeartsDisplay from './HeartsDisplay';
import PowerUpDisplay from './PowerUpDisplay';

type DropperHUDProps = {
  score: number;
  doublePointsTime: number;
  hearts: number;
  isHurt: boolean;
  isHealing: boolean;
  collected: number;
  combo: number;
  shieldTime: number;
  magnetTime: number;
  doubleTime: number;
  slowTime: number;
  difficulty: DropperDifficulty;
  onChangeDifficulty: (difficulty: DropperDifficulty) => void;
  gameOver: boolean;
  bestCombo: number;
};

const DropperHUD: React.FC<DropperHUDProps> = ({
  score,
  doublePointsTime,
  hearts,
  isHurt,
  isHealing,
  collected,
  combo,
  shieldTime,
  magnetTime,
  doubleTime,
  slowTime,
  difficulty,
  onChangeDifficulty,
  gameOver,
  bestCombo,
}) => (
  <Html fullscreen style={{ pointerEvents: 'none' }}>
    <div className="absolute top-4 left-4 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-sm px-5 py-4 text-white shadow-xl pointer-events-auto">
      <div className="text-3xl font-bold">
        {score}
        {doublePointsTime > 0 && (
          <span className="text-green-400 text-lg ml-2">2x</span>
        )}
      </div>
      <div className="text-xs text-white/50 uppercase tracking-wider">
        Score
      </div>

      <div className="mt-3">
        <HeartsDisplay
          currentHearts={hearts}
          isHurt={isHurt}
          isHealing={isHealing}
        />
      </div>

      <div className="mt-3 flex gap-4">
        <div>
          <div className="text-lg font-semibold">{collected}</div>
          <div className="text-xs text-white/50">Caught</div>
        </div>
        {combo > 1 && (
          <div>
            <div className="text-lg font-semibold text-yellow-400">
              {combo}x
            </div>
            <div className="text-xs text-white/50">Combo</div>
          </div>
        )}
      </div>

      <PowerUpDisplay
        shieldTime={shieldTime}
        magnetTime={magnetTime}
        doubleTime={doubleTime}
        slowTime={slowTime}
      />

      <div className="mt-4">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
          Difficulty
        </div>
        <div className="flex gap-2">
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              onClick={() => onChangeDifficulty(d)}
              className={`px-2 py-1 rounded text-[10px] uppercase transition-all ${
                difficulty === d
                  ? d === 'easy'
                    ? 'bg-green-600 text-white'
                    : d === 'medium'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-red-600 text-white'
                  : 'bg-slate-800/80 text-white/50 hover:bg-slate-700/80'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-white/40 mt-3">
        Drag, move, or tap to catch!
      </div>
    </div>

    {gameOver && (
      <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 pointer-events-auto">
        <div className="text-center bg-slate-950/90 rounded-3xl border border-white/10 p-8 backdrop-blur-xl">
          <h1 className="text-4xl font-bold text-red-400 mb-4">Game Over!</h1>
          <p className="text-2xl text-white mb-2">Score: {score}</p>
          <p className="text-lg text-white/60 mb-1">
            Items Caught: {collected}
          </p>
          <p className="text-lg text-white/60 mb-4">Best Combo: {bestCombo}x</p>
          <p className="text-white/50 animate-pulse">
            Tap/Click or press SPACE to restart
          </p>
        </div>
      </div>
    )}

    <div className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[9px] text-white/60 pointer-events-auto max-w-sm">
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        <span className="text-yellow-400">● Coin</span>
        <span className="text-pink-400">◆ Gem</span>
        <span className="text-white">○ Pearl</span>
        <span className="text-red-400">◆ Ruby</span>
        <span className="text-green-400">◆ Emerald</span>
        <span className="text-cyan-400">◆ Diamond</span>
        <span className="text-yellow-300">★ Star</span>
        <span className="text-purple-400">♛ Crown</span>
        <span className="text-orange-400">✦ Rare</span>
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 border-t border-white/10 pt-1">
        <span className="text-pink-400">❤️ +Life</span>
        <span className="text-blue-400">🛡️ Shield</span>
        <span className="text-orange-400">🧲 Magnet</span>
        <span className="text-green-400">2x Points</span>
        <span className="text-cyan-400">⏱️ Slow</span>
        <span className="text-red-500">☠️ Danger</span>
      </div>
    </div>
  </Html>
);

export default DropperHUD;
