// src/components/myRoom/ModelViewer.tsx

import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import React from 'react';
import { GLTF } from 'three-stdlib';

interface ModelViewerProps {
  url: string;
  onClose: () => void;
}

const ModelViewer: React.FC<ModelViewerProps> = ({ url, onClose }) => {
  const gltf = useGLTF(url) as GLTF;

  return (
    <>
      {/* GLTF Model */}
      <primitive object={gltf.scene} />

      {/* OrbitControls for Inspection */}
      <OrbitControls />

      {/* Close Button */}
      <Html>
        <div
          className="inspect-popup"
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            zIndex: 1,
            background: 'rgba(255, 255, 255, 0.8)',
            padding: '10px',
            borderRadius: '8px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Close Inspect
          </button>
        </div>
      </Html>
    </>
  );
};

export default ModelViewer;
