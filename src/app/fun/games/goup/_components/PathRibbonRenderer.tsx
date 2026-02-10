'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CFG } from '../config';
import type { Arena } from '../types';
import type { PathSkin, PathStyle, QualityMode } from '../state';

type PathRibbonRendererProps = {
  segments: THREE.Vector3[][];
  arena: Arena;
  pathStyle: PathStyle;
  pathSkin: PathSkin;
  quality: QualityMode;
  isMobile: boolean;
};

const makeRoundedRectShape = (width: number, height: number, radius: number) => {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const r = Math.min(radius, hw, hh);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
};

const resolveSkin = (arena: Arena, skin: PathSkin) => {
  const base = new THREE.Color().setHSL(arena.pathHue, arena.pathSat, arena.pathLight);
  if (skin === 'neon') {
    return {
      color: base.multiplyScalar(1.08),
      roughness: 0.16,
      metalness: 0.32,
      emissive: new THREE.Color().setHSL(arena.pathHue, 0.82, 0.5),
      emissiveIntensity: 0.62,
    };
  }
  if (skin === 'velvet') {
    return {
      color: base.multiplyScalar(0.94),
      roughness: 0.76,
      metalness: 0.05,
      emissive: new THREE.Color().setHSL(arena.pathHue, 0.5, 0.24),
      emissiveIntensity: 0.12,
    };
  }
  return {
    color: base,
    roughness: 0.26,
    metalness: 0.24,
    emissive: new THREE.Color().setHSL(arena.pathHue, 0.62, 0.3),
    emissiveIntensity: 0.22,
  };
};

const SegmentMesh: React.FC<{
  points: THREE.Vector3[];
  arena: Arena;
  pathStyle: PathStyle;
  pathSkin: PathSkin;
  quality: QualityMode;
  isMobile: boolean;
}> = ({ points, arena, pathStyle, pathSkin, quality, isMobile }) => {
  const q = quality === 'auto' ? (isMobile ? 'low' : 'high') : quality;
  const skin = useMemo(() => resolveSkin(arena, pathSkin), [arena, pathSkin]);

  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const stepsPerPoint =
      q === 'low' ? CFG.RENDER.tube.stepsPerPointLow : CFG.RENDER.tube.stepsPerPointHigh;
    const tubularSegments = Math.max(16, points.length * stepsPerPoint);

    if (pathStyle === 'ribbon') {
      const shape = makeRoundedRectShape(
        CFG.STEP.width,
        CFG.STEP.thickness * 0.72,
        CFG.RENDER.ribbon.cornerRadius
      );
      return new THREE.ExtrudeGeometry(shape, {
        steps:
          q === 'low'
            ? points.length * CFG.RENDER.ribbon.stepsPerPointLow
            : points.length * CFG.RENDER.ribbon.stepsPerPointHigh,
        bevelEnabled: false,
        extrudePath: curve,
      });
    }

    const radiusScale =
      pathStyle === 'hybrid'
        ? CFG.RENDER.tube.radiusScaleHybrid
        : CFG.RENDER.tube.radiusScale;
    const radius = CFG.STEP.width * radiusScale;
    const radialSegments =
      q === 'low' ? CFG.RENDER.tube.radialSegmentsLow : CFG.RENDER.tube.radialSegmentsHigh;

    return new THREE.TubeGeometry(
      curve,
      tubularSegments,
      radius,
      radialSegments,
      false
    );
  }, [pathStyle, points, q]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={skin.color}
        roughness={skin.roughness}
        metalness={skin.metalness}
        emissive={skin.emissive}
        emissiveIntensity={skin.emissiveIntensity}
        transparent={pathStyle === 'hybrid'}
        opacity={pathStyle === 'hybrid' ? 0.68 : 1}
      />
    </mesh>
  );
};

export const PathRibbonRenderer: React.FC<PathRibbonRendererProps> = ({
  segments,
  arena,
  pathStyle,
  pathSkin,
  quality,
  isMobile,
}) => {
  if (pathStyle === 'tiles' || segments.length === 0) return null;

  const resolvedStyle: PathStyle = pathStyle === 'hybrid' ? 'hybrid' : pathStyle;

  return (
    <group>
      {segments.map((segment, idx) => (
        <SegmentMesh
          key={`segment-${idx}-${segment.length}`}
          points={segment}
          arena={arena}
          pathStyle={resolvedStyle}
          pathSkin={pathSkin}
          quality={quality}
          isMobile={isMobile}
        />
      ))}
    </group>
  );
};
