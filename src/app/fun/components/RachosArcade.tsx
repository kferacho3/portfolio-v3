'use client';

import { a, useSpring } from '@react-spring/three';
import { Html, Image, useAnimations, useGLTF } from '@react-three/drei';
import { createPortal } from '@react-three/fiber';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { GLTF } from 'three-stdlib';

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

type ModelProps = JSX.IntrinsicElements['group'] & {
  arcadeRef?: React.Ref<THREE.Group>;
  screenTextureUrl: string;
  screenTitle: string;
  screenHint: string;
  startGame: () => void;
  onFocusReady?: (focus: [number, number, number], radius: number) => void;
};

const SCREEN_NODE = 'MONITOR ARCADE';
const TARGET_SIZE = 6;
const GROUND_Y = -1;

const jiggle = (api: { start: (props: { scale: [number, number, number] }) => void }) => {
  api.start({ scale: [1.1, 1.1, 1.1] });
  setTimeout(() => {
    api.start({ scale: [1, 1, 1] });
  }, 200);
};

export function RachosArcade(props: ModelProps) {
  const {
    arcadeRef,
    screenTextureUrl,
    screenTitle,
    screenHint,
    startGame,
    onFocusReady,
    ...rest
  } = props;
  const group = useRef<THREE.Group>(null);
  const hasAnimatedScreen = useRef(false);
  const focusRef = useRef<{ focus: [number, number, number]; radius: number } | null>(
    null
  );

  const { scene, nodes, animations } = useGLTF(
    '/fun/models/rachoArcade.glb',
    true
  ) as GLTFResult;

  const { actions } = useAnimations(animations, group);

  const screenMesh = useMemo(() => {
    const node = nodes?.[SCREEN_NODE];
    if (!node || !(node as THREE.Mesh).isMesh) return null;
    return node as THREE.Mesh;
  }, [nodes]);

  const [screenSize, setScreenSize] = useState<[number, number, number] | null>(null);
  const [modelScale, setModelScale] = useState(1);
  const [modelOffset, setModelOffset] = useState<[number, number, number]>([
    0,
    0,
    0,
  ]);

  useLayoutEffect(() => {
    if (!screenMesh) return;
    const geometry = screenMesh.geometry as THREE.BufferGeometry;
    geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    geometry.boundingBox?.getSize(size);
    setScreenSize([size.x || 1, size.y || 1, size.z || 0.01]);
  }, [screenMesh]);

  useLayoutEffect(() => {
    if (!scene) return;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return;

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? TARGET_SIZE / maxDim : 1;
    const offset = new THREE.Vector3(
      -center.x * scale,
      GROUND_Y - box.min.y * scale,
      -center.z * scale
    );

    setModelScale(scale);
    setModelOffset([offset.x, offset.y, offset.z]);

    const focusY = GROUND_Y + (size.y * scale) / 2;
    const focus: [number, number, number] = [0, focusY, 0];
    const radius = Math.max(size.x, size.y, size.z) * scale * 0.5;
    const prev = focusRef.current;
    if (
      onFocusReady &&
      (!prev ||
        prev.radius !== radius ||
        prev.focus[0] !== focus[0] ||
        prev.focus[1] !== focus[1] ||
        prev.focus[2] !== focus[2])
    ) {
      onFocusReady(focus, radius);
      focusRef.current = { focus, radius };
    }
  }, [scene, onFocusReady]);

  const [screenSpring, screenApi] = useSpring(() => ({
    scale: [1, 1, 1] as [number, number, number],
    config: { tension: 200, friction: 15 },
  }));

  useEffect(() => {
    if (!hasAnimatedScreen.current) {
      hasAnimatedScreen.current = true;
      return;
    }
    jiggle(screenApi);
  }, [screenTextureUrl, screenApi]);

  const setRefs = useCallback(
    (node: THREE.Group | null) => {
      group.current = node;
      if (!arcadeRef) return;
      if (typeof arcadeRef === 'function') {
        arcadeRef(node);
      } else {
        arcadeRef.current = node;
      }
    },
    [arcadeRef]
  );

  useEffect(() => {
    if (actions?.PortalAction) {
      actions.PortalAction.reset().play();
    }
    return () => {
      if (actions?.PortalAction) {
        actions.PortalAction.stop();
      }
    };
  }, [actions]);

  const screenPortal =
    screenMesh && screenSize
      ? createPortal(
          <a.group
            name="ArcadeScreenOverlay"
            position={[0, 0, screenSize[2] / 2 + 0.01]}
            scale={screenSpring.scale}
            onPointerOver={() => screenApi.start({ scale: [1.01, 1.01, 1.01] })}
            onPointerOut={() => screenApi.start({ scale: [1, 1, 1] })}
            onClick={() => {
              startGame();
              jiggle(screenApi);
            }}
          >
            <Image
              url={screenTextureUrl}
              toneMapped={false}
              scale={[screenSize[0], screenSize[1], 1]}
            />
            <Html transform scale={0.9}>
              <div
                style={{
                  color: 'white',
                  background: 'rgba(5, 10, 20, 0.7)',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  textAlign: 'center',
                  minWidth: '120px',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    opacity: 0.7,
                  }}
                >
                  {screenTitle}
                </div>
                <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.85 }}>
                  Click to launch
                </div>
                <div style={{ marginTop: '2px', fontSize: '9px', opacity: 0.6 }}>
                  {screenHint}
                </div>
              </div>
            </Html>
          </a.group>,
          screenMesh
        )
      : null;

  return (
    <group ref={setRefs} {...rest} dispose={null}>
      <group position={modelOffset} scale={modelScale}>
        <primitive object={scene} />
        {screenPortal}
      </group>
    </group>
  );
}

useGLTF.preload('/fun/models/rachoArcade.glb', true);
