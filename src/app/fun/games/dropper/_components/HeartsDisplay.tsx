import React from 'react';
import { MAX_HEARTS } from '../constants';

const HeartsDisplay: React.FC<{
  currentHearts: number;
  isHurt: boolean;
  isHealing: boolean;
}> = ({ currentHearts, isHurt, isHealing }) => (
  <div className="flex gap-1 items-center flex-wrap max-w-[200px]">
    {Array.from({ length: Math.min(currentHearts, MAX_HEARTS) }).map((_, i) => (
      <div
        key={i}
        className={`transition-all duration-200 ${
          isHurt
            ? 'animate-pulse scale-90'
            : isHealing && i === currentHearts - 1
              ? 'animate-bounce scale-125'
              : ''
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="#FF4444"
          className="drop-shadow-[0_0_8px_rgba(255,68,68,0.7)]"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>
    ))}
    {currentHearts > MAX_HEARTS && (
      <span className="text-red-400 text-sm font-bold ml-1">
        +{currentHearts - MAX_HEARTS}
      </span>
    )}
  </div>
);

export default HeartsDisplay;
