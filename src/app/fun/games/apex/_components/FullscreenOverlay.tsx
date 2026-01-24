import { Html } from '@react-three/drei';
import React, { useEffect, useRef, useState } from 'react';

const FullscreenOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const portalRef = useRef<HTMLElement>(null!);

  useEffect(() => {
    portalRef.current = document.body;
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Html
      fullscreen
      portal={portalRef}
      zIndexRange={[1000, 0]}
      calculatePosition={() => [0, 0]}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        transform: 'none',
      }}
      transform={false}
      center={false}
    >
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {children}
      </div>
    </Html>
  );
};

export default FullscreenOverlay;
