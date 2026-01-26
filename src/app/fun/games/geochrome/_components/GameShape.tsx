import {
  Box,
  Cone,
  Dodecahedron,
  Icosahedron,
  Octahedron,
  Sphere,
  Torus,
  TorusKnot,
} from '@react-three/drei';
import React from 'react';
import type { ShapeType } from '../types';
import {
  CrystalMaterial,
  HolographicMaterial,
  IridescentMaterial,
  NeonGlowMaterial,
} from './Materials';

interface GameShapeProps {
  type: ShapeType;
  color: string;
  scale?: number;
  materialType?: 'standard' | 'iridescent' | 'neon' | 'holographic' | 'crystal';
  glowColor?: string;
}

const GameShape: React.FC<GameShapeProps> = ({
  type,
  color,
  scale = 1,
  materialType = 'standard',
  glowColor = '#00ffff',
}) => {
  const renderMaterial = () => {
    switch (materialType) {
      case 'iridescent':
        return <IridescentMaterial color={color} />;
      case 'neon':
        return <NeonGlowMaterial color={color} glowColor={glowColor} />;
      case 'holographic':
        return <HolographicMaterial baseColor={color} />;
      case 'crystal':
        return <CrystalMaterial color={color} />;
      default:
        return (
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
            metalness={0.4}
            roughness={0.3}
          />
        );
    }
  };

  const shapes: Record<ShapeType, JSX.Element> = {
    sphere: <Sphere args={[0.8 * scale, 32, 32]}>{renderMaterial()}</Sphere>,
    cube: (
      <Box args={[1.2 * scale, 1.2 * scale, 1.2 * scale]}>
        {renderMaterial()}
      </Box>
    ),
    torus: (
      <Torus args={[0.6 * scale, 0.25 * scale, 16, 32]}>
        {renderMaterial()}
      </Torus>
    ),
    cone: <Cone args={[0.7 * scale, 1.4 * scale, 32]}>{renderMaterial()}</Cone>,
    dodecahedron: (
      <Dodecahedron args={[0.8 * scale]}>{renderMaterial()}</Dodecahedron>
    ),
    octahedron: (
      <Octahedron args={[0.9 * scale]}>{renderMaterial()}</Octahedron>
    ),
    icosahedron: (
      <Icosahedron args={[0.8 * scale]}>{renderMaterial()}</Icosahedron>
    ),
    torusKnot: (
      <TorusKnot args={[0.5 * scale, 0.15 * scale, 64, 16]}>
        {renderMaterial()}
      </TorusKnot>
    ),
  };

  return shapes[type];
};

export default GameShape;
