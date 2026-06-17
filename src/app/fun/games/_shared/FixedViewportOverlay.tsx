'use client';

import { Html } from '@react-three/drei';
import React, { useEffect, useRef, useState } from 'react';

interface FixedViewportOverlayProps {
  children: React.ReactNode;
  className?: string;
  pointerEvents?: 'none' | 'auto';
  zIndexRange?: [number, number];
}

/**
 * Keeps HUD/UI locked to the browser viewport (not world space),
 * even while the camera or scene keeps moving.
 */
export default function FixedViewportOverlay({
  children,
  className,
  pointerEvents = 'none',
  zIndexRange = [1000, 0],
}: FixedViewportOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const portalRef = useRef<HTMLElement>(null!);

  useEffect(() => {
    portalRef.current = document.body;
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Html
      fullscreen
      portal={portalRef}
      zIndexRange={zIndexRange}
      calculatePosition={() => [0, 0]}
      transform={false}
      center={false}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100dvw',
        height: '100dvh',
        transform: 'none',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxSizing: 'border-box',
          padding:
            'var(--arcade-shell-top) var(--arcade-shell-inline) var(--arcade-shell-bottom)',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <div
          className={className}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            pointerEvents,
          }}
        >
          {children}
        </div>
      </div>
    </Html>
  );
}
