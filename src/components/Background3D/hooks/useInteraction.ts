/* ═══════════════════════════════════════════════════════════════════════════
   Background3D/hooks/useInteraction.ts - Pointer and drag interaction handlers
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useRef, RefObject } from 'react';
import * as THREE from 'three';

export interface DragState {
  isDragging: RefObject<boolean>;
  dragIntensity: RefObject<number>;
  dragStartTime: RefObject<number>;
  lastPointer: RefObject<THREE.Vector2>;
  cursorVelocity: RefObject<THREE.Vector2>;
}

export interface InteractionCallbacks {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: () => void;
  setGrabbing: (grabbing: boolean) => void;
  setCanvasCursor: (cursor: string) => void;
}

/**
 * Hook for managing pointer interactions with the 3D mesh
 */
export function useInteraction(
  setGrabbing: (grabbing: boolean) => void,
  setCanvasCursor: (cursor: string) => void,
  isMobileView: boolean
): {
  dragState: DragState;
  handlers: InteractionCallbacks;
} {
  const isDragging = useRef(false);
  const dragIntensity = useRef(0);
  const dragStartTime = useRef(0);
  const lastPointer = useRef(new THREE.Vector2());
  const cursorVelocity = useRef(new THREE.Vector2());

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      isDragging.current = true;
      dragStartTime.current = performance.now();
      dragIntensity.current = 0;
      lastPointer.current.set(e.clientX, e.clientY);
      setGrabbing(true);
      setCanvasCursor('grabbing');
    },
    [setGrabbing, setCanvasCursor]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging.current) return;

      const current = new THREE.Vector2(e.clientX, e.clientY);
      const delta = current.sub(lastPointer.current);
      
      // Update cursor velocity
      cursorVelocity.current.copy(delta).multiplyScalar(0.1);
      
      // Accumulate drag intensity
      const elapsed = (performance.now() - dragStartTime.current) / 1000;
      const velocityMag = delta.length();
      dragIntensity.current = Math.min(
        1,
        dragIntensity.current + velocityMag * 0.002 + elapsed * 0.1
      );

      lastPointer.current.set(e.clientX, e.clientY);
    },
    []
  );

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    dragIntensity.current = 0;
    setGrabbing(false);
    setCanvasCursor('grab');
  }, [setGrabbing, setCanvasCursor]);

  return {
    dragState: {
      isDragging,
      dragIntensity,
      dragStartTime,
      lastPointer,
      cursorVelocity,
    },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      setGrabbing,
      setCanvasCursor,
    },
  };
}

/**
 * Calculate hover distance from cursor to mesh surface
 */
export function calculateHoverDistance(
  pointer: THREE.Vector2,
  meshPosition: THREE.Vector3,
  vertexPosition: THREE.Vector3,
  camera: THREE.Camera,
  isMobile: boolean
): number {
  if (isMobile) {
    // For mobile, use distance from center
    return vertexPosition.distanceTo(meshPosition);
  }

  // Project cursor to 3D space
  const cursorPos = new THREE.Vector3(pointer.x, pointer.y, 0.5);
  cursorPos.unproject(camera);

  // Calculate ray from camera through cursor
  const cameraPos = camera.position.clone();
  const rayDir = cursorPos.sub(cameraPos).normalize();

  // Find closest point on ray to vertex
  const toVertex = vertexPosition.clone().sub(cameraPos);
  const projLength = toVertex.dot(rayDir);
  const closestPoint = cameraPos.clone().add(rayDir.multiplyScalar(projLength));

  return vertexPosition.distanceTo(closestPoint);
}
