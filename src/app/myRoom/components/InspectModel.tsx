// src/components/myRoom/InspectModel.tsx

import { Html } from '@react-three/drei';
import React, { Component, useState } from 'react';
import modelMap from './RoomItems/AllItems';

interface InspectModelProps {
  modelName: string;
  onClose: () => void;
}

// ErrorBoundary to catch rendering errors
class ErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Animated close button using CSS instead of framer-motion
const CloseButton: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [mounted, setMounted] = useState(false);
  
  React.useEffect(() => {
    // Trigger mount animation
    const timer = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <button
      onClick={onClose}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-all duration-300 ease-in-out"
      style={{
        transform: mounted ? 'scale(1)' : 'scale(0.8)',
        opacity: mounted ? 1 : 0,
      }}
    >
      Close Inspect
    </button>
  );
};

const InspectModel: React.FC<InspectModelProps> = ({ modelName, onClose }) => {
  // Retrieve the model component from the map
  const ModelComponent = modelMap[modelName];

  return (
    <ErrorBoundary
      fallback={
        <>
          {/* Fallback Shape: Dodecahedron */}
          <mesh>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={0x808080} />
          </mesh>
          {/* Close Button */}
          <Html fullscreen>
            <div className="absolute top-4 left-4 z-20">
              <CloseButton onClose={onClose} />
            </div>
          </Html>
        </>
      }
    >
      {ModelComponent ? (
        <>
          <ModelComponent />
          {/* Close Button */}
          <Html fullscreen>
            <div className="absolute top-4 left-4 z-20">
              <CloseButton onClose={onClose} />
            </div>
          </Html>
        </>
      ) : (
        <>
          {/* Fallback Shape: Dodecahedron */}
          <mesh>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={0x808080} />
          </mesh>
          {/* Close Button */}
          <Html fullscreen>
            <div className="absolute top-4 left-4 z-20">
              <CloseButton onClose={onClose} />
            </div>
          </Html>
        </>
      )}
    </ErrorBoundary>
  );
};

export default InspectModel;
