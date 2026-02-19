import React from 'react';
import FixedViewportOverlay from '../../_shared/FixedViewportOverlay';

const FullscreenOverlay: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <FixedViewportOverlay>{children}</FixedViewportOverlay>;

export default FullscreenOverlay;
