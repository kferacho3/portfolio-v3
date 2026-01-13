// MusicControls.tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';

interface MusicControlProps {
  isPlaying: boolean;
  togglePlay: () => void;
}

const MusicControl: React.FC<MusicControlProps> = ({ isPlaying, togglePlay }) => {
  const [bars] = useState(() => 
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      baseHeight: 8 + Math.random() * 8,
      speed: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    }))
  );

  const [hovered, setHovered] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // Hide hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Main Control Button */}
      <motion.button
        onClick={togglePlay}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative group cursor-pointer focus:outline-none"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Glow effect */}
        <motion.div
          className="absolute -inset-3 rounded-2xl blur-xl"
          animate={{
            opacity: isPlaying ? [0.4, 0.6, 0.4] : 0.2,
            scale: isPlaying ? [1, 1.05, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            background: isPlaying
              ? 'linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6)'
              : 'linear-gradient(135deg, #374151, #1f2937)',
          }}
        />

        {/* Main container */}
        <div
          className={`relative flex flex-col items-center gap-3 px-5 py-4 rounded-2xl border backdrop-blur-xl transition-all duration-500 ${
            isPlaying
              ? 'bg-gradient-to-b from-slate-900/90 to-slate-950/95 border-emerald-500/30'
              : 'bg-gradient-to-b from-slate-800/80 to-slate-900/90 border-white/10'
          }`}
        >
          {/* Audio Visualizer */}
          <div className="flex items-end justify-center gap-[3px] h-10 w-40">
            {bars.map((bar, i) => (
              <motion.div
                key={bar.id}
                className={`w-[6px] rounded-full ${
                  isPlaying
                    ? 'bg-gradient-to-t from-emerald-500 via-cyan-400 to-violet-400'
                    : 'bg-gradient-to-t from-slate-600 to-slate-500'
                }`}
                animate={{
                  height: isPlaying
                    ? [
                        bar.baseHeight,
                        bar.baseHeight * 3.5,
                        bar.baseHeight * 1.5,
                        bar.baseHeight * 4,
                        bar.baseHeight,
                      ]
                    : [8, 10, 8],
                  opacity: isPlaying ? 1 : 0.5,
                }}
                transition={{
                  duration: bar.speed,
                  repeat: Infinity,
                  delay: i * 0.05,
                  ease: 'easeInOut',
                }}
                style={{
                  boxShadow: isPlaying
                    ? `0 0 12px ${i < 5 ? '#10b981' : i < 11 ? '#06b6d4' : '#8b5cf6'}80`
                    : 'none',
                }}
              />
            ))}
          </div>

          {/* Status indicator and text */}
          <div className="flex items-center gap-2">
            {/* Pulsing dot */}
            <motion.div
              className={`w-2 h-2 rounded-full ${
                isPlaying ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
              animate={{
                scale: isPlaying ? [1, 1.3, 1] : 1,
                opacity: isPlaying ? [1, 0.7, 1] : 0.6,
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                boxShadow: isPlaying ? '0 0 8px #10b981' : 'none',
              }}
            />

            {/* Text */}
            <span
              className={`text-[11px] font-bold tracking-[0.2em] uppercase transition-colors duration-300 ${
                isPlaying
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400'
                  : 'text-slate-400'
              }`}
            >
              {isPlaying ? 'Vibing' : 'Turn Up'}
            </span>
          </div>

          {/* Subtle hover effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            animate={{
              boxShadow: hovered && !isPlaying
                ? 'inset 0 0 30px rgba(255,255,255,0.05)'
                : 'inset 0 0 0px rgba(255,255,255,0)',
            }}
          />
        </div>
      </motion.button>

      {/* Floating hint - appears briefly */}
      <AnimatePresence>
        {showHint && !isPlaying && (
          <motion.div
            className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-[10px] text-white/40 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
            className="absolute -bottom-8 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <span className="text-[9px] text-emerald-400/60 tracking-wider uppercase">
              FFT Active
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MusicControl;
