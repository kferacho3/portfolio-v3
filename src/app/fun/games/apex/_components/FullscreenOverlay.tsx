import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FullscreenOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const portalRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Create container outside Canvas context synchronously
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '1000';
    document.body.appendChild(container);
    portalRef.current = container;
    setMounted(true);

    return () => {
      if (portalRef.current?.parentNode) {
        portalRef.current.parentNode.removeChild(portalRef.current);
      }
      portalRef.current = null;
    };
  }, []);

  // Return null during SSR and until portal is ready to prevent R3F from seeing children
  if (typeof window === 'undefined' || !mounted || !portalRef.current) {
    return null;
  }

  // Use React portal to render outside Canvas context
  return createPortal(
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {children}
    </div>,
    portalRef.current
  );
};

export default FullscreenOverlay;
