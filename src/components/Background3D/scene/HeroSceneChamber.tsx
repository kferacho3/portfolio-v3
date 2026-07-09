/* =====================================================================
 *  Background3D/scene/HeroSceneChamber.tsx
 *  Composes the "Racho Artifact Chamber": dark dome backdrop, cinematic
 *  lighting, atmospheric haze, and an optional soft reflective floor.
 *  Everything reacts to the current artifact + morph via shared refs.
 *  (Postprocessing lives in CinematicPostFX — mounted at scene root.)
 * ===================================================================== */
'use client';

import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneQualityState } from '../quality';
import type { HeroShapeMeta } from '../morph/types';
import AtmosphericHaze from './AtmosphericHaze';
import CinematicLights from './CinematicLights';
import SceneBackdrop from './SceneBackdrop';

interface HeroSceneChamberProps {
  moodRef: React.MutableRefObject<HeroShapeMeta>;
  morphMixRef: React.MutableRefObject<number>;
  quality: SceneQualityState;
  reducedMotion: boolean;
  isMobile: boolean;
  castShadow?: boolean;
  shadowMapSize?: number;
}

export default function HeroSceneChamber({
  moodRef,
  morphMixRef,
  quality,
  reducedMotion,
  isMobile,
  castShadow = false,
  shadowMapSize = 1024,
}: HeroSceneChamberProps) {
  const { settings } = quality;

  return (
    <group>
      <SceneBackdrop moodRef={moodRef} morphMixRef={morphMixRef} />

      <CinematicLights
        moodRef={moodRef}
        morphMixRef={morphMixRef}
        reducedMotion={reducedMotion}
        castShadow={castShadow}
        shadowMapSize={shadowMapSize}
      />

      {settings.hazeEnabled && (
        <AtmosphericHaze
          moodRef={moodRef}
          morphMixRef={morphMixRef}
          isMobile={isMobile}
        />
      )}

      {settings.reflectionEnabled && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -1.9, 0]}
          raycast={() => null}
          receiveShadow={castShadow}
        >
          <planeGeometry args={[44, 44]} />
          <MeshReflectorMaterial
            blur={[300, 90]}
            resolution={1024}
            mixBlur={1}
            mixStrength={0.5}
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.25}
            color="#05040a"
            metalness={0.6}
            roughness={0.92}
            mirror={0.35}
          />
        </mesh>
      )}
    </group>
  );
}
