import { Html } from '@react-three/drei';
import React from 'react';
import FixedViewportOverlay from '../../_shared/FixedViewportOverlay';
import { ARM_COLOR, BONUS_ORB_COLOR, ORB_COLOR } from '../constants';

type WeaveHUDProps = {
  score: number;
  orbsCollected: number;
  level: number;
  laserCount: number;
  levelOrbCount: number;
  levelUpOrbs: number;
  levelProgress: number;
  currentColor: string;
  highScore: number;
  bestCombo: number;
  lives: number;
  maxLives: number;
  gameStarted: boolean;
  gameOver: boolean;
  combo: number;
  laserBurstLabel: string | null;
};

const WeaveHUD: React.FC<WeaveHUDProps> = ({
  score,
  orbsCollected,
  level,
  laserCount,
  levelOrbCount,
  levelUpOrbs,
  levelProgress,
  currentColor,
  highScore,
  bestCombo,
  lives,
  maxLives,
  gameStarted,
  gameOver,
  combo,
  laserBurstLabel,
}) => (
  <>
    {combo >= 3 && (
      <Html center position={[0, -2.5, 0]}>
        <div
          className="text-2xl font-bold animate-pulse"
          style={{
            color: combo >= 10 ? '#feca57' : combo >= 5 ? '#00ff88' : '#00ffff',
            textShadow: '0 0 20px currentColor',
          }}
        >
          {combo}x
        </div>
      </Html>
    )}

    {laserBurstLabel && (
      <Html center position={[0, 2.4, 0]}>
        <div
          className="text-sm font-bold tracking-[0.25em] animate-pulse"
          style={{ color: '#ff3366', textShadow: '0 0 18px #ff3366' }}
        >
          {laserBurstLabel}
        </div>
      </Html>
    )}

    <FixedViewportOverlay>
      <div className="absolute top-4 left-4 z-50">
        <div className="bg-black/50 backdrop-blur-sm rounded-xl px-4 py-3 text-white border border-white/10">
          <div
            className="text-3xl font-light tracking-wider"
            style={{ color: currentColor }}
          >
            {score}
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-widest">
            Score
          </div>

          <div className="mt-3 flex items-center gap-4">
            <div>
              <div className="text-lg font-light">{orbsCollected}</div>
              <div className="text-[10px] text-white/40 uppercase">Orbs</div>
            </div>
            <div>
              <div className="text-lg font-light">Lv.{level}</div>
              <div className="text-[10px] text-white/40 uppercase">Level</div>
            </div>
            <div>
              <div className="text-lg font-light">{laserCount}×</div>
              <div className="text-[10px] text-white/40 uppercase">Lasers</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
              Next Level ({levelOrbCount}/{levelUpOrbs})
            </div>
            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-200 rounded-full"
                style={{
                  width: `${levelProgress}%`,
                  backgroundColor: currentColor,
                  boxShadow: `0 0 8px ${currentColor}`,
                }}
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
              Control Mode
            </div>
            <div className="inline-flex items-center rounded-md border border-cyan-400/50 bg-cyan-400/10 px-3 py-1 text-[10px] text-cyan-100">
              Arcade Default (Locked)
            </div>
            <div className="mt-2 text-[10px] text-white/35">
              Full Weave control/mode variants are available on prism3d.studio.
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs border border-white/10">
          <div className="text-white/60">Best: {highScore}</div>
          <div className="text-white/40">Best Combo: {bestCombo}x</div>
        </div>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
        {Array.from({ length: maxLives }).map((_, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full border-2 transition-all duration-200"
            style={{
              borderColor: '#ff3366',
              backgroundColor: i < lives ? '#ff3366' : 'transparent',
              boxShadow: i < lives ? '0 0 10px #ff3366' : 'none',
            }}
          />
        ))}
      </div>

      <div className="absolute bottom-4 left-4 text-white/40 text-xs">
        <div className="flex items-center gap-3">
          <span>Mouse or ←/→ / A/D to orbit</span>
          <span className="text-white/20">|</span>
          <span>Space flips direction</span>
          <span className="text-white/20">|</span>
          <span>Collect orbs, dodge lasers</span>
        </div>
      </div>

      {!gameStarted && !gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
          <div className="text-center max-w-md px-8">
            <h1
              className="text-6xl font-thin tracking-[0.3em] mb-6"
              style={{
                color: currentColor,
                textShadow: `0 0 40px ${currentColor}`,
              }}
            >
              WEAVE
            </h1>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              Orbit the center and collect glowing orbs.
              <br />
              Dodge the sweeping laser arms.
              <br />
              Build combos. Survive. Level up.
            </p>
            <div className="flex justify-center gap-6 text-xs text-white/40 mb-8">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: ORB_COLOR }}
                />
                <span>Orb (+10)</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: BONUS_ORB_COLOR }}
                />
                <span>Bonus (+50)</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: ARM_COLOR }}
                />
                <span>Danger!</span>
              </div>
            </div>
            <p className="text-white/40 text-xs animate-pulse">
              Click or press Space / ← / → / A / D to begin
            </p>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="text-center">
            <h1
              className="text-5xl font-thin tracking-widest mb-6"
              style={{ color: '#ff3366' }}
            >
              GAME OVER
            </h1>
            <p className="text-4xl text-white/80 mb-2 font-light">{score}</p>
            <div className="text-white/50 text-sm space-y-1 mb-6">
              <p>Orbs Collected: {orbsCollected}</p>
              <p>Level Reached: {level}</p>
              <p>Best Combo: {bestCombo}x</p>
              {score >= highScore && score > 0 && (
                <p className="text-yellow-400 mt-2">New High Score!</p>
              )}
            </div>
            <p className="text-white/40 text-xs animate-pulse">
              Click or Press R to play again
            </p>
          </div>
        </div>
      )}
    </FixedViewportOverlay>
  </>
);

export default WeaveHUD;
