// MusicControls.tsx - Performance-Optimized 2D Music Control Component
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useState, memo } from 'react';

interface MusicControlProps {
  isPlaying: boolean;
  togglePlay: () => void;
}

// Memoized bar component to prevent unnecessary re-renders
const VisualizerBar = memo(
  ({
    baseHeight,
    speed,
    index,
    isPlaying,
  }: {
    baseHeight: number;
    speed: number;
    index: number;
    isPlaying: boolean;
  }) => (
    <motion.div
      className={`w-[5px] rounded-full ${
        isPlaying
          ? 'bg-gradient-to-t from-[#39FF14] via-[#9400D3] to-[#FFA500]'
          : 'bg-gradient-to-t from-slate-600 to-slate-500'
      }`}
      animate={{
        height: isPlaying
          ? [
              baseHeight,
              baseHeight * 2.5,
              baseHeight * 1.5,
              baseHeight * 3,
              baseHeight,
            ]
          : [6, 8, 6],
        opacity: isPlaying ? 1 : 0.5,
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        delay: index * 0.05,
        ease: 'easeInOut',
      }}
      style={{
        boxShadow: isPlaying
          ? `0 0 6px ${index < 3 ? '#39FF14' : index < 6 ? '#9400D3' : '#FFA500'}50`
          : 'none',
      }}
    />
  )
);
VisualizerBar.displayName = 'VisualizerBar';

const MusicControl: React.FC<MusicControlProps> = ({
  isPlaying,
  togglePlay,
}) => {
  // Reduced number of bars (8 instead of 12) for better performance
  const bars = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        baseHeight: 6 + Math.random() * 5,
        speed: 0.4 + Math.random() * 0.25,
      })),
    []
  );

  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Main Control Button */}
      <motion.button
        onClick={togglePlay}
        className="relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 rounded-2xl"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label={isPlaying ? 'Pause music' : 'Play music'}
      >
        {/* Glow effect - simplified */}
        <div
          className={`absolute -inset-2 rounded-2xl blur-lg transition-opacity duration-500 ${
            isPlaying ? 'opacity-60' : 'opacity-20'
          }`}
          style={{
            background: isPlaying
              ? 'linear-gradient(135deg, #39FF14, #9400D3, #FFA500)'
              : 'linear-gradient(135deg, #374151, #1f2937)',
          }}
        />

        {/* Main container */}
        <div
          className={`relative flex flex-col items-center gap-2.5 px-5 py-3.5 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
            isPlaying
              ? 'bg-gradient-to-b from-slate-900/90 to-slate-950/95 border-[#39FF14]/30'
              : 'bg-gradient-to-b from-slate-800/80 to-slate-900/90 border-white/10 hover:border-white/20'
          }`}
        >
          {/* Audio Visualizer - Optimized with memoized bars */}
          <div className="flex items-end justify-center gap-[3px] h-9 w-28">
            {bars.map((bar, i) => (
              <VisualizerBar
                key={bar.id}
                baseHeight={bar.baseHeight}
                speed={bar.speed}
                index={i}
                isPlaying={isPlaying}
              />
            ))}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <motion.div
              className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#39FF14]' : 'bg-slate-500'}`}
              animate={{
                scale: isPlaying ? [1, 1.2, 1] : 1,
                opacity: isPlaying ? [1, 0.6, 1] : 0.5,
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ boxShadow: isPlaying ? '0 0 6px #39FF14' : 'none' }}
            />
            <span
              className={`text-[10px] font-bold tracking-[0.2em] uppercase transition-colors duration-300 ${
                isPlaying
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#39FF14] via-[#9400D3] to-[#FFA500]'
                  : 'text-slate-400'
              }`}
            >
              {isPlaying ? 'Vibing' : 'Turn Up'}
            </span>
          </div>
        </div>
      </motion.button>

      {/* Floating hint */}
      <AnimatePresence>
        {showHint && !isPlaying && (
          <motion.div
            className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.25 }}
          >
            <span className="text-[10px] text-white/40 flex items-center gap-1.5">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Click to make the room dance!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Now playing indicator */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            className="absolute -bottom-7 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <span className="text-[9px] text-[#39FF14]/60 tracking-wider uppercase">
              FFT Active
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MusicControl;
