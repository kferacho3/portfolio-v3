// src/components/LoadingAnimation.tsx
'use client';

import { Variants, motion } from 'framer-motion';
import React from 'react';

// Variants for Pacman's chomping animation
const pacmanChompVariants: Variants = {
  chomping: {
    d: [
      'M10 10 L20 10 L25 15 L20 20 L10 20 Z', // Open mouth
      'M10 10 L20 10 L22 15 L20 20 L10 20 Z', // Slightly closed mouth
    ],
    transition: {
      duration: 0.3,
      yoyo: Infinity,
      repeatDelay: 0.1,
    },
  },
};

// Pacman Component
const Pacman: React.FC = () => {
  return (
    <svg width="100" height="100" viewBox="0 0 30 30" className="mx-auto">
      <motion.path
        fill="yellow"
        stroke="black"
        strokeWidth="1"
        variants={pacmanChompVariants}
        animate="chomping"
        d="M10 10 L20 10 L25 15 L20 20 L10 20 Z"
      />
    </svg>
  );
};

interface PacmanLoadingProps {
  progress: number;
}

// PacmanLoading Component - NO Html wrapper, expects to be wrapped by parent
const PacmanLoading: React.FC<PacmanLoadingProps> = ({ progress }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <div className="relative w-24 h-24">
        <Pacman />
        {/* Position the ghosts relative to Pacman */}
        <svg width="100" height="100" viewBox="0 0 30 30" className="absolute top-2 left-4">
          <circle cx="15" cy="15" r="5" fill="#ff0040" />
        </svg>
        <svg width="100" height="100" viewBox="0 0 30 30" className="absolute top-2 right-4">
          <circle cx="15" cy="15" r="5" fill="#00bfff" />
        </svg>
      </div>
      <div className="mt-4 text-white text-lg">
        Loading... {Math.floor(progress)}%
      </div>
    </div>
  );
};

export default PacmanLoading;
