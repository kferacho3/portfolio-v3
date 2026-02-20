'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type GrowthViewportOverlayProps = {
  children: React.ReactNode;
  className?: string;
  pointerEvents?: 'none' | 'auto';
  zIndex?: number;
};

/**
 * Growth-specific viewport overlay that renders directly into document.body.
 * This avoids Html fullscreen sizing glitches that can collapse the HUD width.
 */
export default function GrowthViewportOverlay({
  children,
  className,
  pointerEvents = 'none',
  zIndex = 1200,
}: GrowthViewportOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        pointerEvents: 'none',
        zIndex,
      }}
    >
      <div
        className={className}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents,
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
