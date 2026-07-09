/* =====================================================================
 *  Background3D/morph/useHeroMorphController.ts
 *  The Solid⇄Liquid morph state machine. Ref-driven (no per-frame React
 *  state). Owns: sampling+matching on begin(), persistent GPU buffers,
 *  the phase timeline (ignition→flow→resolve→settle), palette crossfade,
 *  and the solid⇄points crossfade. Commits the logical shape only near
 *  the end so the new solid mesh fades in as the points condense.
 * ===================================================================== */
'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ShapeName } from '@/components/Background3DHelpers/shapeFunctions';
import type { HeroShapeMeta } from './types';
import { createMorphUniforms, type MorphUniforms } from './morphShader';
import { clearSampleCache, getSampledShape } from './sampleGeometry';
import { matchSurfaces } from './matchVertices';
import { createHeroShapeSequencer, getHeroShapeMeta } from './morphTargets';

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** matches the solid artifact's normalized radius so points sit on its surface */
export const LIQUID_FIELD_SCALE = 1.2;

interface UseHeroMorphControllerArgs {
  shape: ShapeName;
  isMobile: boolean;
  reducedMotion: boolean;
  morphVertexCount: number;
  /** commit the logical shape swap (+ material) once the morph resolves */
  onCommitShape: (next: ShapeName) => void;
}

export interface HeroMorphController {
  liquidRef: React.MutableRefObject<THREE.Points | null>;
  uniforms: MorphUniforms;
  /** kick off a morph to the next curated shape; returns the target (or null if busy) */
  begin: () => ShapeName | null;
  /** advance the timeline + write uniforms (call from the main useFrame) */
  frame: (dt: number, elapsed: number) => void;
  /** 0..1 solid-mesh visibility (Background3D applies to the solid group) */
  solidVisibilityRef: React.MutableRefObject<number>;
  /** whether a morph transition is currently active */
  isMorphingRef: React.MutableRefObject<boolean>;
  /** 0..1 morph progress, for scene-mood reactions */
  morphMixRef: React.MutableRefObject<number>;
  /** meta of the artifact currently "in focus" (for the chamber at rest) */
  currentMetaRef: React.MutableRefObject<HeroShapeMeta>;
  /** idle-warm the likely next target */
  prewarm: () => void;
}

export function useHeroMorphController(
  args: UseHeroMorphControllerArgs
): HeroMorphController {
  const { isMobile, reducedMotion, morphVertexCount, onCommitShape } = args;

  const liquidRef = useRef<THREE.Points | null>(null);
  const uniforms = useMemo<MorphUniforms>(
    () =>
      createMorphUniforms(
        getHeroShapeMeta(args.shape).palette,
        1.5,
        isMobile ? 2.4 : 3.2
      ),
    // built once; palette + pixel ratio are updated at runtime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sequencer = useMemo(
    () => createHeroShapeSequencer(isMobile),
    [isMobile]
  );

  const solidVisibilityRef = useRef(1);
  const isMorphingRef = useRef(false);
  const morphMixRef = useRef(0);
  const currentMetaRef = useRef<HeroShapeMeta>(getHeroShapeMeta(args.shape));

  /* timeline state (refs only) */
  const activeRef = useRef(false);
  const tRef = useRef(0);
  const durationRef = useRef(1.7);
  const committedRef = useRef(false);
  const currentShapeRef = useRef<ShapeName>(args.shape);
  const targetShapeRef = useRef<ShapeName | null>(null);
  const clickPulseRef = useRef(0);
  const bufNRef = useRef(0);

  /* palette crossfade colors */
  const fromCols = useRef<THREE.Color[]>([
    new THREE.Color(),
    new THREE.Color(),
    new THREE.Color(),
    new THREE.Color(),
  ]);
  const toCols = useRef<THREE.Color[]>([
    new THREE.Color(),
    new THREE.Color(),
    new THREE.Color(),
    new THREE.Color(),
  ]);

  /* keep in sync if the parent changes shape outside a morph */
  useEffect(() => {
    if (!activeRef.current) {
      currentShapeRef.current = args.shape;
      currentMetaRef.current = getHeroShapeMeta(args.shape);
    }
  }, [args.shape]);

  const ensureAttributes = useCallback((n: number) => {
    const pts = liquidRef.current;
    if (!pts) return null;
    const geo = pts.geometry as THREE.BufferGeometry;
    if (bufNRef.current !== n || !geo.getAttribute('position')) {
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(
          THREE.DynamicDrawUsage
        )
      );
      geo.setAttribute(
        'aTarget',
        new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(
          THREE.DynamicDrawUsage
        )
      );
      geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n), 1));
      geo.setAttribute(
        'aColorMix',
        new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(
          THREE.DynamicDrawUsage
        )
      );
      bufNRef.current = n;
    }
    return geo;
  }, []);

  const begin = useCallback((): ShapeName | null => {
    if (activeRef.current) return null;
    if (!liquidRef.current) return null;

    const current = currentShapeRef.current;
    const next = sequencer.next(current);
    const n = morphVertexCount;

    const source = getSampledShape(current, n);
    const target = getSampledShape(next, n);
    const matched = matchSurfaces(source, target);

    const geo = ensureAttributes(n);
    if (!geo) return null;

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const tgtAttr = geo.getAttribute('aTarget') as THREE.BufferAttribute;
    const seedAttr = geo.getAttribute('aSeed') as THREE.BufferAttribute;
    const mixAttr = geo.getAttribute('aColorMix') as THREE.BufferAttribute;

    (posAttr.array as Float32Array).set(source.positions);
    (tgtAttr.array as Float32Array).set(matched.positions);
    const seedArr = seedAttr.array as Float32Array;
    const mixArr = mixAttr.array as Float32Array;
    for (let i = 0; i < n; i++) {
      seedArr[i] = (Math.imul(i, 2654435761) >>> 0) / 4294967296;
      mixArr[i] = source.radius[i];
    }
    posAttr.needsUpdate = true;
    tgtAttr.needsUpdate = true;
    seedAttr.needsUpdate = true;
    mixAttr.needsUpdate = true;
    geo.setDrawRange(0, n);
    geo.computeBoundingSphere();

    const fromMeta = getHeroShapeMeta(current);
    const toMeta = getHeroShapeMeta(next);
    for (let i = 0; i < 4; i++) {
      fromCols.current[i].set(fromMeta.palette[i]);
      toCols.current[i].set(toMeta.palette[i]);
    }

    targetShapeRef.current = next;
    currentMetaRef.current = fromMeta;
    committedRef.current = false;
    activeRef.current = true;
    isMorphingRef.current = true;
    tRef.current = 0;
    clickPulseRef.current = 1;
    durationRef.current = reducedMotion ? 0.9 : isMobile ? 1.25 : 1.7;

    return next;
  }, [sequencer, morphVertexCount, ensureAttributes, reducedMotion, isMobile]);

  const frame = useCallback(
    (dt: number, elapsed: number) => {
      const u = uniforms;
      u.uTime.value = elapsed;
      clickPulseRef.current *= Math.exp(-dt * 2.6);
      u.uClickPulse.value = clickPulseRef.current;

      if (!activeRef.current) {
        u.uMorph.value = 0;
        u.uParticalize.value = Math.max(0, u.uParticalize.value - dt * 3);
        u.uEnergy.value *= Math.exp(-dt * 3);
        u.uSettle.value = 0;
        solidVisibilityRef.current = Math.min(
          1,
          solidVisibilityRef.current + dt * 3
        );
        morphMixRef.current = 0;
        return;
      }

      const dur = durationRef.current;
      tRef.current = Math.min(1, tRef.current + dt / dur);
      const t = tRef.current;
      morphMixRef.current = t;

      const m = easeInOutCubic(t);
      u.uMorph.value = m;

      const energyBase = reducedMotion ? 0.06 : currentMetaRef.current.energy;
      u.uEnergy.value = energyBase * (0.35 + Math.sin(t * Math.PI) * 0.85);
      u.uSettle.value = smoothstep(
        THREE.MathUtils.clamp((t - 0.7) / 0.3, 0, 1)
      );

      const fadeOut = smoothstep(THREE.MathUtils.clamp(t / 0.14, 0, 1));
      const fadeIn = smoothstep(THREE.MathUtils.clamp((t - 0.86) / 0.14, 0, 1));
      solidVisibilityRef.current = THREE.MathUtils.clamp(
        1 - fadeOut + fadeIn,
        0,
        1
      );

      const partIn = smoothstep(THREE.MathUtils.clamp(t / 0.12, 0, 1));
      const partOut = smoothstep(THREE.MathUtils.clamp((t - 0.9) / 0.1, 0, 1));
      u.uParticalize.value = THREE.MathUtils.clamp(partIn - partOut, 0, 1);

      u.uColA.value.copy(fromCols.current[0]).lerp(toCols.current[0], m);
      u.uColB.value.copy(fromCols.current[1]).lerp(toCols.current[1], m);
      u.uColC.value.copy(fromCols.current[2]).lerp(toCols.current[2], m);
      u.uAccent.value.copy(fromCols.current[3]).lerp(toCols.current[3], m);

      if (!committedRef.current && t >= 0.88 && targetShapeRef.current) {
        committedRef.current = true;
        const next = targetShapeRef.current;
        currentShapeRef.current = next;
        currentMetaRef.current = getHeroShapeMeta(next);
        onCommitShape(next);
      }

      if (t >= 1) {
        activeRef.current = false;
        isMorphingRef.current = false;
        targetShapeRef.current = null;
      }
    },
    [uniforms, reducedMotion, onCommitShape]
  );

  const prewarm = useCallback(() => {
    const guess = sequencer.peek(currentShapeRef.current);
    const run = () => {
      try {
        getSampledShape(guess, morphVertexCount);
      } catch {
        /* ignore prewarm failures */
      }
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void, o?: object) => number })
        .requestIdleCallback(run, { timeout: 800 });
    } else {
      setTimeout(run, 0);
    }
  }, [sequencer, morphVertexCount]);

  /* warm the current shape's source samples on mount */
  useEffect(() => {
    const shape = currentShapeRef.current;
    const run = () => {
      try {
        getSampledShape(shape, morphVertexCount);
      } catch {
        /* ignore */
      }
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void, o?: object) => number })
        .requestIdleCallback(run, { timeout: 1200 });
    } else {
      setTimeout(run, 60);
    }
  }, [morphVertexCount]);

  useEffect(() => () => clearSampleCache(), []);

  return useMemo(
    () => ({
      liquidRef,
      uniforms,
      begin,
      frame,
      solidVisibilityRef,
      isMorphingRef,
      morphMixRef,
      currentMetaRef,
      prewarm,
    }),
    [uniforms, begin, frame, prewarm]
  );
}
