// src/components/LoadingAnimation.tsx
'use client';

import { Html } from '@react-three/drei'; // <-- Import Html from drei
import { SVGMotionProps, Variants, motion } from 'framer-motion';
import React from 'react';
//import 'tailwindcss/tailwind.css'; // Ensure Tailwind CSS is imported

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

// Variants for Ghosts' floating animation
const ghostFloatVariants: Variants = {
  float: {
    y: [0, -5, 0],
    transition: {
      duration: 2,
      yoyo: Infinity,
      ease: 'easeInOut',
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

// Ghost Props Interface - extend with SVGMotionProps to include className and other SVG props
interface GhostProps extends SVGMotionProps<SVGCircleElement> {
  color: string;
}

// Ghost Component
const Ghost: React.FC<GhostProps> = ({ color, ...props }) => {
  return (
    <motion.circle
      cx="15"
      cy="15"
      r="5"
      fill={color}
      variants={ghostFloatVariants}
      animate="float"
      {...props} // Allow passing className and other SVG props
    />
  );
};

interface PacmanLoadingProps {
  progress: number;
}

// PacmanLoading Component wrapped in <Html fullscreen> from drei
const PacmanLoading: React.FC<PacmanLoadingProps> = ({ progress }) => {
  return (
    <Html fullscreen>
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <div className="relative w-24 h-24">
          <Pacman />
          {/* Position the ghosts relative to Pacman */}
          <Ghost color="#ff0040" className="absolute top-2 left-4" />
          <Ghost color="#00bfff" className="absolute top-2 right-4" />
        </div>
        <div className="mt-4 text-white text-lg">
          Loading... {Math.floor(progress)}%
        </div>
      </div>
    </Html>
  );
};

export default PacmanLoading;
