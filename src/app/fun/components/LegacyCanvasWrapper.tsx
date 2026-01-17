'use client';

import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';

// Dynamically import legacy games with no SSR to avoid hydration issues
// These games have their own Canvas and physics providers
const legacyGames: Record<string, React.ComponentType> = {
  rollette: dynamic(() => import('../../Fun(JavaScript)/Games/Rollette'), { ssr: false }),
  skyblitz: dynamic(() => import('../../Fun(JavaScript)/Games/SkyBlitz'), { ssr: false }),
  reactpong: dynamic(() => import('../../Fun(JavaScript)/Games/ReactPong'), { ssr: false }),
  spinblock: dynamic(() => import('../../Fun(JavaScript)/Games/SpinBlock'), { ssr: false }),
  shapeshifter: dynamic(() => import('../../Fun(JavaScript)/Games/ShapeShift'), { ssr: false }),
  dropper: dynamic(() => import('../../Fun(JavaScript)/Games/Dropper'), { ssr: false }),
  stackz: dynamic(() => import('../../Fun(JavaScript)/Games/Stackz'), { ssr: false }),
  geochrome: dynamic(() => import('../../Fun(JavaScript)/Games/GeoChrome'), { ssr: false }),
  pinball: dynamic(() => import('../../Fun(JavaScript)/Games/Pinball3D').then(mod => ({ default: mod.Pinball })), { ssr: false }),
  flappybird: dynamic(() => import('../../Fun(JavaScript)/Games/FlappyBird'), { ssr: false }),
  runningman: dynamic(() => import('../../Fun(JavaScript)/Games/RunningMan'), { ssr: false }),
};

interface LegacyCanvasWrapperProps {
  game: string;
  onClose?: () => void;
}

/**
 * LegacyCanvasWrapper
 * 
 * Mounts legacy JavaScript games in a full-screen overlay.
 * Used for A/B comparison between legacy and TSX implementations.
 * 
 * Usage: Add ?legacy=1&game=rollette to the URL
 */
export function LegacyCanvasWrapper({ game, onClose }: LegacyCanvasWrapperProps) {
  const normalizedGame = game.toLowerCase();
  const GameComponent = legacyGames[normalizedGame];

  if (!GameComponent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <h2 className="text-2xl mb-4">Legacy Game Not Found</h2>
          <p className="text-gray-400 mb-4">Game &quot;{game}&quot; is not available in legacy mode.</p>
          <p className="text-sm text-gray-500">
            Available games: {Object.keys(legacyGames).join(', ')}
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-6 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              Return to Arcade
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Close button overlay */}
      <div className="absolute top-4 right-4 z-[60]">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-black/70 hover:bg-black/90 text-white rounded-lg border border-white/20 transition flex items-center gap-2"
        >
          <span className="text-sm">Exit Legacy Mode</span>
          <kbd className="px-1.5 py-0.5 text-xs bg-white/10 rounded">ESC</kbd>
        </button>
      </div>

      {/* Legacy indicator badge */}
      <div className="absolute top-4 left-4 z-[60]">
        <div className="px-3 py-1.5 bg-amber-500/90 text-black text-xs font-bold rounded-full uppercase tracking-wider">
          Legacy Mode
        </div>
      </div>

      {/* Legacy game container */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <div className="text-white text-center">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
              <p>Loading legacy {game}...</p>
            </div>
          </div>
        }
      >
        <GameComponent />
      </Suspense>
    </div>
  );
}

/**
 * Hook to parse legacy mode query parameters
 */
export function useLegacyMode(): { isLegacy: boolean; game: string | null } {
  if (typeof window === 'undefined') {
    return { isLegacy: false, game: null };
  }

  const params = new URLSearchParams(window.location.search);
  const isLegacy = params.get('legacy') === '1';
  const game = params.get('game');

  return { isLegacy, game };
}

export default LegacyCanvasWrapper;
