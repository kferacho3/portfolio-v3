'use client';

import { useAnimations, useGLTF } from '@react-three/drei';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { GLTF } from 'three-stdlib';

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Object3D>;
  materials: Record<string, THREE.Material>;
};

export type GameCard = {
  id: string;
  title: string;
  description: string;
  accent: string;
  poster: string;
  hotkey: string;
};

type ModelProps = JSX.IntrinsicElements['group'] & {
  arcadeRef?: React.Ref<THREE.Group>;
  games: GameCard[];
  selectedIndex: number;
  onSelectGame: (index: number) => void;
  onLaunchGame: (gameId: string) => void;
  onFocusReady?: (focus: [number, number, number], radius: number) => void;
};

const TARGET_SIZE = 6;
const GROUND_Y = 0.5; // Slightly raised

// Texture cache to avoid reloading
const textureCache = new Map<string, THREE.Texture>();
const textureLoader = new THREE.TextureLoader();

// Proxy S3 images through our API to avoid CORS issues
const getProxyUrl = (url: string) => {
  if (url.startsWith('https://racho-devs.s3.us-east-2.amazonaws.com/')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
};

export function RachosArcade(props: ModelProps) {
  const {
    arcadeRef,
    games,
    selectedIndex,
    onSelectGame,
    onLaunchGame,
    onFocusReady,
    ...rest
  } = props;
  const group = useRef<THREE.Group>(null);
  const focusRef = useRef<{ focus: [number, number, number]; radius: number } | null>(
    null
  );
  const screenMeshRef = useRef<THREE.Mesh | null>(null);

  const currentGame = games[selectedIndex] || games[0];

  const { scene, nodes, animations } = useGLTF(
    '/fun/models/rachoArcade.glb',
    true
  ) as GLTFResult;

  const { actions } = useAnimations(animations, group);

  // Find and store the screen mesh from the model
  useLayoutEffect(() => {
    if (!nodes) return;
    
    // Log all available nodes to find the screen mesh
    console.log('Available nodes in arcade model:', Object.keys(nodes));
    
    // Search for the monitor/screen mesh - prioritize MONITOR_ARCADE
    const node = nodes['MONITOR_ARCADE'];
    if (node && (node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      screenMeshRef.current = mesh;
      
      // Log mesh info for debugging
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mesh.updateMatrixWorld(true);
      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);
      
      // Get bounding box size
      mesh.geometry.computeBoundingBox();
      const bbox = mesh.geometry.boundingBox;
      const size = new THREE.Vector3();
      bbox?.getSize(size);
      
      console.log('Found MONITOR_ARCADE mesh:', {
        name: mesh.name,
        visible: mesh.visible,
        worldPosition: `(${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)})`,
        size: `(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`,
        hasUVs: mesh.geometry?.attributes?.uv ? true : false,
        materialType: mat?.type,
      });
      
      // Ensure mesh is visible
      mesh.visible = true;
      return;
    }
    
    // Fallback: search for any mesh containing monitor/screen
    for (const [name, n] of Object.entries(nodes)) {
      const lowerName = name.toLowerCase();
      if (
        (lowerName.includes('screen') || 
         lowerName.includes('monitor') ||
         lowerName.includes('display')) &&
        (n as THREE.Mesh).isMesh
      ) {
        screenMeshRef.current = n as THREE.Mesh;
        console.log('Found screen mesh by partial match:', name);
        return;
      }
    }
    
    console.log('No screen mesh found in model');
  }, [nodes]);

  const [modelScale, setModelScale] = useState(1);
  const [modelOffset, setModelOffset] = useState<[number, number, number]>([
    0,
    0,
    0,
  ]);

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

  const setRefs = useCallback(
    (node: THREE.Group | null) => {
      (group as React.MutableRefObject<THREE.Group | null>).current = node;
      if (!arcadeRef) return;
      if (typeof arcadeRef === 'function') {
        arcadeRef(node);
      } else {
        (arcadeRef as React.MutableRefObject<THREE.Group | null>).current = node;
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

  // Load and apply texture to screen mesh
  useEffect(() => {
    if (!screenMeshRef.current || !currentGame?.poster) return;
    
    const mesh = screenMeshRef.current;
    const posterUrl = currentGame.poster;
    const proxyUrl = getProxyUrl(posterUrl);
    
    // Check cache first
    if (textureCache.has(posterUrl)) {
      const cachedTexture = textureCache.get(posterUrl)!;
      applyTextureToMesh(mesh, cachedTexture);
      return;
    }
    
    // Load texture via proxy
    textureLoader.load(
      proxyUrl,
      (texture) => {
        // Cache the texture
        textureCache.set(posterUrl, texture);
        applyTextureToMesh(mesh, texture);
        console.log('Applied texture to screen mesh:', posterUrl);
      },
      undefined,
      (error) => {
        console.warn('Failed to load poster texture:', posterUrl, error);
      }
    );
  }, [currentGame?.poster]);

  // Handle click on the screen mesh to launch game
  const handleScreenClick = useCallback(() => {
    if (currentGame) {
      onLaunchGame(currentGame.id);
    }
  }, [currentGame, onLaunchGame]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        const newIndex = selectedIndex <= 0 ? games.length - 1 : selectedIndex - 1;
        onSelectGame(newIndex);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        const newIndex = selectedIndex >= games.length - 1 ? 0 : selectedIndex + 1;
        onSelectGame(newIndex);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (currentGame) {
          onLaunchGame(currentGame.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, games.length, onSelectGame, currentGame, onLaunchGame]);

  // Handle pointer events on the model - launch game on click
  const handlePointerDown = useCallback((event: { object?: THREE.Object3D; stopPropagation?: () => void }) => {
    if (event.object && event.object === screenMeshRef.current) {
      event.stopPropagation?.();
      handleScreenClick();
    }
  }, [handleScreenClick]);

  return (
    <group ref={setRefs} {...rest} dispose={null} onClick={handlePointerDown}>
      <group position={modelOffset} scale={modelScale}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

// Helper function to properly apply texture to mesh
function applyTextureToMesh(mesh: THREE.Mesh, texture: THREE.Texture) {
  // Configure texture for proper display
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // Try both flipY values - GLTF models typically use flipY=false
  texture.flipY = false;
  texture.needsUpdate = true;
  
  // Debug: Check UV coordinates
  const uvAttr = mesh.geometry?.attributes?.uv;
  if (uvAttr) {
    const uvArray = uvAttr.array;
    const minU = Math.min(...Array.from(uvArray).filter((_, i) => i % 2 === 0));
    const maxU = Math.max(...Array.from(uvArray).filter((_, i) => i % 2 === 0));
    const minV = Math.min(...Array.from(uvArray).filter((_, i) => i % 2 === 1));
    const maxV = Math.max(...Array.from(uvArray).filter((_, i) => i % 2 === 1));
    console.log(`UV bounds: U[${minU.toFixed(2)}-${maxU.toFixed(2)}] V[${minV.toFixed(2)}-${maxV.toFixed(2)}]`);
  }
  
  // Create MeshBasicMaterial for consistent display regardless of lighting
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    side: THREE.DoubleSide,
    transparent: false,
  });
  
  // Apply material
  mesh.material = material;
  mesh.visible = true;
  mesh.frustumCulled = false;
  
  console.log('Applied texture to', mesh.name, 'texture size:', texture.image?.width, 'x', texture.image?.height);
}

useGLTF.preload('/fun/models/rachoArcade.glb', true);
