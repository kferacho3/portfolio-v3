import { Html } from '@react-three/drei';
import React from 'react';
import type { SpinBlockBoardPreset, SpinBlockBoardSize } from '../types';

const HeartsDisplay: React.FC<{ hearts: number; maxHearts: number }> = ({ hearts, maxHearts }) => (
  <div className="flex gap-1.5 items-center">
    {Array.from({ length: maxHearts }).map((_, i) => (
      <svg
        key={i}
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill={i < hearts ? '#FF4444' : '#333'}
        className={i < hearts ? 'drop-shadow-[0_0_8px_rgba(255,68,68,0.7)]' : ''}
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ))}
  </div>
);

type SpinBlockHUDProps = {
  score: number;
  multiplier: number;
  hearts: number;
  maxHearts: number;
  boardOptions: SpinBlockBoardPreset[];
  boardSize: SpinBlockBoardSize;
  coinsCollected: number;
  gemsCollected: number;
  combo: number;
  shieldTime: number;
  multiplierTime: number;
  slowTime: number;
  gameOver: boolean;
  highScore: number;
  onSelectBoard: (size: SpinBlockBoardSize) => void;
  onRestart: () => void;
};

const SpinBlockHUD: React.FC<SpinBlockHUDProps> = ({
  score,
  multiplier,
  hearts,
  maxHearts,
  boardOptions,
  boardSize,
  coinsCollected,
  gemsCollected,
  combo,
  shieldTime,
  multiplierTime,
  slowTime,
  gameOver,
  highScore,
  onSelectBoard,
  onRestart,
}) => (
  <Html fullscreen style={{ pointerEvents: 'none' }}>
    <div className="absolute top-4 left-4 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-sm px-5 py-4 text-white shadow-xl pointer-events-auto">
      <div className="text-3xl font-bold">
        {score}
        {multiplier > 1 && <span className="text-green-400 text-lg ml-2">2x</span>}
      </div>
      <div className="text-xs text-white/50 uppercase tracking-wider">Score</div>

      <div className="mt-3">
        <HeartsDisplay hearts={hearts} maxHearts={maxHearts} />
      </div>

      <div className="mt-3">
        <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Board size</div>
        <div className="flex flex-wrap gap-2">
          {boardOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSelectBoard(opt.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs border transition ${
                boardSize === opt.id
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-400/10'
                  : 'border-white/15 text-white/70 hover:border-white/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-white/40">
          Bigger boards = more lives + more to collect.
        </div>
      </div>

      <div className="mt-3 flex gap-4">
        <div>
          <div className="text-lg font-semibold text-yellow-400">{coinsCollected}</div>
          <div className="text-xs text-white/50">Coins</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-cyan-400">{gemsCollected}</div>
          <div className="text-xs text-white/50">Gems</div>
        </div>
        {combo > 1 && (
          <div>
            <div className="text-lg font-semibold text-orange-400">{combo}x</div>
            <div className="text-xs text-white/50">Combo</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {shieldTime > 0 && <div className="text-xs text-blue-400">🛡️ Shield: {shieldTime.toFixed(1)}s</div>}
        {multiplierTime > 0 && <div className="text-xs text-green-400">2️⃣ 2x Points: {multiplierTime.toFixed(1)}s</div>}
        {slowTime > 0 && <div className="text-xs text-cyan-400">⏱️ Slow: {slowTime.toFixed(1)}s</div>}
      </div>

      <div className="text-[10px] text-white/40 mt-3">
        Move mouse or WASD to tilt
        <br />
        Press R to restart
      </div>
    </div>

    {gameOver && (
      <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 pointer-events-auto">
        <div className="text-center bg-slate-950/90 rounded-3xl border border-white/10 p-8 backdrop-blur-xl">
          <h1 className="text-4xl font-bold text-red-400 mb-4">Game Over!</h1>
          <p className="text-2xl text-white mb-2">Score: {score}</p>
          <p className="text-lg text-white/60 mb-1">High Score: {highScore}</p>
          <p className="text-lg text-white/60 mb-1">Coins: {coinsCollected} | Gems: {gemsCollected}</p>
          <button
            onClick={onRestart}
            className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    )}

    <div className="absolute bottom-4 left-4 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[9px] text-white/60 pointer-events-auto">
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        <span className="text-yellow-400">● Coin</span>
        <span className="text-cyan-400">◆ Gem</span>
        <span className="text-pink-400">○ Bumper</span>
        <span className="text-red-500">▲ Spike</span>
        <span className="text-green-400">⬡ 2x</span>
        <span className="text-blue-400">◯ Shield</span>
        <span className="text-pink-400">❤️ Life</span>
      </div>
    </div>
  </Html>
);

export default SpinBlockHUD;
