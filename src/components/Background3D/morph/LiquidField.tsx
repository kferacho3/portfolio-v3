/* =====================================================================
 *  Background3D/morph/LiquidField.tsx
 *  The GPU point cloud that carries the Solid⇄Liquid morph. Geometry
 *  attributes are populated imperatively by useHeroMorphController via
 *  the forwarded ref; at rest it is fully transparent (uParticalize = 0).
 * ===================================================================== */
'use client';

import { forwardRef } from 'react';
import * as THREE from 'three';
import { MORPH_FRAG, MORPH_VERT, type MorphUniforms } from './morphShader';

interface LiquidFieldProps {
  uniforms: MorphUniforms;
  /** matches the solid artifact's normalized radius (TARGET_R) */
  scale?: number;
}

const LiquidField = forwardRef<THREE.Points, LiquidFieldProps>(
  function LiquidField({ uniforms, scale = 1.2 }, ref) {
    return (
      <points
        ref={ref}
        scale={scale}
        raycast={() => null}
        frustumCulled={false}
        renderOrder={2}
      >
        <bufferGeometry />
        <shaderMaterial
          vertexShader={MORPH_VERT}
          fragmentShader={MORPH_FRAG}
          uniforms={uniforms as unknown as { [uniform: string]: THREE.IUniform }}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </points>
    );
  }
);

export default LiquidField;
