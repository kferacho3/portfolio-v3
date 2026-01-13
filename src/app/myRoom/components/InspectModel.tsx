// src/components/myRoom/InspectModel.tsx

import { Html } from '@react-three/drei';
import { motion } from 'framer-motion';
import React, { Component } from 'react';
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
              <motion.button
                onClick={onClose}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                Close Inspect
              </motion.button>
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
              <motion.button
                onClick={onClose}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                Close Inspect
              </motion.button>
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
              <motion.button
                onClick={onClose}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                Close Inspect
              </motion.button>
            </div>
          </Html>
        </>
      )}
    </ErrorBoundary>
  );
};

export default InspectModel;
