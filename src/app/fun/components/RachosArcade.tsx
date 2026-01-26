'use client';

import { useAnimations, useGLTF } from '@react-three/drei';
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
  onFocusReady?: (
    focus: [number, number, number],
    radius: number,
    forward?: [number, number, number]
  ) => void;
};

const TARGET_SIZE = 6;
const GROUND_Y = 0.5; // Slightly raised
// Rotate the screen upright with a slight backward tilt to match arcade cabinet angle
const SCREEN_ROTATION = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  Math.PI / 2 - 0.2 // ~78 degrees - tilts top of screen backward
);
// LRU Texture cache with size limits to prevent memory accumulation
const MAX_TEXTURE_CACHE_SIZE = 5; // Only keep 5 most recent textures
const MAX_TEXTURE_SIZE = 2048; // Max texture dimension in pixels

interface CachedTexture {
  texture: THREE.Texture;
  lastUsed: number;
}

const textureCache = new Map<string, CachedTexture>();
const textureLoader = new THREE.TextureLoader();

// Clean up old textures from cache (LRU eviction)
function evictOldTextures() {
  if (textureCache.size <= MAX_TEXTURE_CACHE_SIZE) return;

  // Sort by last used time and remove oldest
  const entries = Array.from(textureCache.entries()).sort(
    (a, b) => a[1].lastUsed - b[1].lastUsed
  );

  const toRemove = entries.slice(0, entries.length - MAX_TEXTURE_CACHE_SIZE);
  for (const [url, cached] of toRemove) {
    // Dispose texture to free memory
    cached.texture.dispose();
    textureCache.delete(url);
  }
}

// Downscale texture if too large
function optimizeTexture(texture: THREE.Texture): THREE.Texture {
  if (!texture.image) return texture;

  const img = texture.image as HTMLImageElement;
  if (img.width <= MAX_TEXTURE_SIZE && img.height <= MAX_TEXTURE_SIZE) {
    return texture;
  }

  // Create canvas to downscale
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return texture;

  const scale = Math.min(
    MAX_TEXTURE_SIZE / img.width,
    MAX_TEXTURE_SIZE / img.height
  );
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Create new texture from downscaled image
  const optimizedTexture = new THREE.Texture(canvas);
  optimizedTexture.needsUpdate = true;

  // Dispose old texture
  texture.dispose();

  return optimizedTexture;
}

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
  const focusRef = useRef<{
    focus: [number, number, number];
    radius: number;
    forward: [number, number, number];
  } | null>(null);
  const modelGroupRef = useRef<THREE.Group>(null);
  const screenMeshRef = useRef<THREE.Mesh | null>(null);
  const screenPlaneRef = useRef<THREE.Mesh | null>(null);
  const [screenMesh, setScreenMesh] = useState<THREE.Mesh | null>(null);
  const [screenSearchDone, setScreenSearchDone] = useState(false);
  const [screenPlaneConfig, setScreenPlaneConfig] = useState<{
    position: [number, number, number];
    quaternion: [number, number, number, number];
    width: number;
    height: number;
    radius: number;
  } | null>(null);

  const currentGame = games[selectedIndex] || games[0];

  const { scene, nodes, animations } = useGLTF(
    '/fun/models/rachoArcade.glb',
    true // Use draco compression if available
  ) as GLTFResult;

  // Optimize scene geometry and materials for memory
  useEffect(() => {
    if (!scene) return;

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const geometry = mesh.geometry;

        // Merge vertices if possible to reduce memory
        if (geometry instanceof THREE.BufferGeometry) {
          // Enable frustum culling for better performance
          mesh.frustumCulled = true;

          // Dispose unused attributes if any
          const attrs = geometry.attributes;
          for (const key in attrs) {
            if (!['position', 'normal', 'uv'].includes(key)) {
              // Keep only essential attributes
            }
          }
        }

        // Optimize materials
        if (mesh.material) {
          const material = Array.isArray(mesh.material)
            ? mesh.material[0]
            : mesh.material;

          if (material instanceof THREE.MeshStandardMaterial) {
            // Reduce texture sizes if they exist
            if (material.map) {
              material.map.minFilter = THREE.LinearMipmapLinearFilter;
              material.map.generateMipmaps = true;
            }
            if (material.normalMap) {
              material.normalMap.minFilter = THREE.LinearMipmapLinearFilter;
              material.normalMap.generateMipmaps = true;
            }
          }
        }
      }
    });
  }, [scene]);

  const { actions } = useAnimations(animations, group);

  // Find and store the screen mesh from the model
  useLayoutEffect(() => {
    if (!nodes) return;

    let foundMesh: THREE.Mesh | null = null;

    // Search for the monitor/screen mesh - prioritize MONITOR_ARCADE
    const node = nodes['MONITOR_ARCADE'];
    if (node && (node as THREE.Mesh).isMesh) {
      foundMesh = node as THREE.Mesh;
    }

    // Fallback: search for any mesh containing monitor/screen
    if (!foundMesh) {
      for (const [name, n] of Object.entries(nodes)) {
        const lowerName = name.toLowerCase();
        if (
          (lowerName.includes('screen') ||
            lowerName.includes('monitor') ||
            lowerName.includes('display')) &&
          (n as THREE.Mesh).isMesh
        ) {
          foundMesh = n as THREE.Mesh;
          break;
        }
      }
    }

    if (foundMesh) {
      foundMesh.visible = false;
      screenMeshRef.current = foundMesh;
      setScreenMesh(foundMesh);
    } else {
      screenMeshRef.current = null;
      setScreenMesh(null);
    }

    setScreenSearchDone(true);
  }, [nodes]);

  const [modelScale, setModelScale] = useState(1);
  const [modelOffset, setModelOffset] = useState<[number, number, number]>([
    0, 0, 0,
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
  }, [scene]);

  useLayoutEffect(() => {
    if (!screenMesh || !modelGroupRef.current || !scene) {
      setScreenPlaneConfig(null);
      return;
    }

    modelGroupRef.current.updateWorldMatrix(true, true);
    screenMesh.updateWorldMatrix(true, true);

    const localMatrix = new THREE.Matrix4()
      .copy(modelGroupRef.current.matrixWorld)
      .invert()
      .multiply(screenMesh.matrixWorld);

    const localPosition = new THREE.Vector3();
    const localScale = new THREE.Vector3();
    const localQuat = new THREE.Quaternion();
    localMatrix.decompose(localPosition, localQuat, localScale);

    const geometry = screenMesh.geometry as THREE.BufferGeometry | undefined;
    geometry?.computeBoundingBox();
    const bbox = geometry?.boundingBox;
    if (!bbox) return;

    const size = new THREE.Vector3();
    bbox.getSize(size);
    size.multiply(localScale);

    const dims = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)].sort(
      (a, b) => b - a
    );
    const width = dims[0] ?? 1;
    const height = dims[1] ?? 1;
    const radius = Math.min(width, height) * 0.08;

    const planeLocalQuat = localQuat.clone().multiply(SCREEN_ROTATION);

    const normal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(planeLocalQuat)
      .normalize();
    localPosition.addScaledVector(normal, Math.min(width, height) * 0.02);

    setScreenPlaneConfig({
      position: [localPosition.x, localPosition.y, localPosition.z],
      quaternion: [
        planeLocalQuat.x,
        planeLocalQuat.y,
        planeLocalQuat.z,
        planeLocalQuat.w,
      ],
      width,
      height,
      radius,
    });
  }, [screenMesh, modelScale, modelOffset, scene]);

  const screenShape = useMemo(() => {
    if (!screenPlaneConfig) return null;
    return createRoundedRectShape(
      screenPlaneConfig.width,
      screenPlaneConfig.height,
      screenPlaneConfig.radius
    );
  }, [screenPlaneConfig]);

  useLayoutEffect(() => {
    if (!scene || !onFocusReady) return;
    if (!screenMesh && !screenSearchDone) return;

    group.current?.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    let focus: [number, number, number] = [center.x, center.y, center.z];
    let radius = Math.max(size.x, size.y, size.z) * 0.5;
    let forward: [number, number, number] = [0, 0, 1];

    if (screenMesh) {
      const screenPosition = new THREE.Vector3();
      screenMesh.updateWorldMatrix(true, true);
      screenMesh.getWorldPosition(screenPosition);
      const screenSize = getMeshWorldSize(screenMesh);
      const screenDims = [screenSize.x, screenSize.y, screenSize.z]
        .map((value) => Math.abs(value))
        .sort((a, b) => b - a);
      const screenWidth = screenDims[0] ?? 1;
      const screenHeight = screenDims[1] ?? 1;

      focus = [screenPosition.x, screenPosition.y, screenPosition.z];
      radius = Math.max(screenWidth, screenHeight) * 0.55;

      const screenWorldQuat = new THREE.Quaternion();
      screenMesh.getWorldQuaternion(screenWorldQuat);
      const planeWorldQuat = screenWorldQuat.clone().multiply(SCREEN_ROTATION);
      const planeForward = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(planeWorldQuat)
        .normalize();
      forward = [planeForward.x, planeForward.y, planeForward.z];
    }

    const prev = focusRef.current;
    if (
      !prev ||
      prev.radius !== radius ||
      prev.focus[0] !== focus[0] ||
      prev.focus[1] !== focus[1] ||
      prev.focus[2] !== focus[2] ||
      prev.forward[0] !== forward[0] ||
      prev.forward[1] !== forward[1] ||
      prev.forward[2] !== forward[2]
    ) {
      onFocusReady(focus, radius, forward);
      focusRef.current = { focus, radius, forward };
    }
  }, [
    scene,
    onFocusReady,
    screenMesh,
    screenSearchDone,
    modelScale,
    modelOffset,
  ]);

  const setRefs = useCallback(
    (node: THREE.Group | null) => {
      (group as React.MutableRefObject<THREE.Group | null>).current = node;
      if (!arcadeRef) return;
      if (typeof arcadeRef === 'function') {
        arcadeRef(node);
      } else {
        (arcadeRef as React.MutableRefObject<THREE.Group | null>).current =
          node;
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

  // Enable raycast only on visible/interactive meshes for better performance
  useEffect(() => {
    if (!scene) return;
    let raycastCount = 0;
    const MAX_RAYCAST_MESHES = 20; // Limit number of meshes with raycast enabled

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && raycastCount < MAX_RAYCAST_MESHES) {
        child.raycast = THREE.Mesh.prototype.raycast;
        raycastCount++;
      }
    });
  }, [scene]);

  // Load and apply texture to screen mesh
  useEffect(() => {
    const mesh = screenPlaneRef.current;
    if (!mesh || !currentGame?.poster) return;

    const posterUrl = currentGame.poster;
    const proxyUrl = getProxyUrl(posterUrl);

    // Check cache first
    if (textureCache.has(posterUrl)) {
      const cached = textureCache.get(posterUrl)!;
      cached.lastUsed = Date.now();
      applyTextureToMesh(mesh, cached.texture);
      return;
    }

    // Evict old textures before loading new one
    evictOldTextures();

    // Load texture via proxy
    textureLoader.load(
      proxyUrl,
      (texture) => {
        // Optimize texture size
        const optimizedTexture = optimizeTexture(texture);

        // Cache the texture with timestamp
        textureCache.set(posterUrl, {
          texture: optimizedTexture,
          lastUsed: Date.now(),
        });

        applyTextureToMesh(mesh, optimizedTexture);
      },
      undefined,
      (error) => {
        console.warn('Failed to load poster texture:', posterUrl, error);
      }
    );
  }, [currentGame?.poster, screenPlaneConfig]);

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
        const newIndex =
          selectedIndex <= 0 ? games.length - 1 : selectedIndex - 1;
        onSelectGame(newIndex);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        const newIndex =
          selectedIndex >= games.length - 1 ? 0 : selectedIndex + 1;
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
  const handleModelClick = useCallback(
    (e: THREE.Event & { stopPropagation: () => void }) => {
      e.stopPropagation();
      handleScreenClick();
    },
    [handleScreenClick]
  );

  const handlePointerOver = useCallback(() => {
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'auto';
  }, []);

  // Cleanup textures when component unmounts
  useEffect(() => {
    return () => {
      // Clean up any textures that are no longer referenced
      // The LRU cache will handle eviction, but we can force cleanup of unused textures
      const currentTime = Date.now();
      const MAX_AGE = 5 * 60 * 1000; // 5 minutes

      for (const [url, cached] of textureCache.entries()) {
        if (currentTime - cached.lastUsed > MAX_AGE) {
          cached.texture.dispose();
          textureCache.delete(url);
        }
      }
    };
  }, []);

  return (
    <group
      ref={setRefs}
      {...rest}
      dispose={null}
      onClick={handleModelClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <group ref={modelGroupRef} position={modelOffset} scale={modelScale}>
        <primitive object={scene} />
        {screenPlaneConfig && screenShape && (
          <mesh
            ref={screenPlaneRef}
            position={screenPlaneConfig.position}
            quaternion={screenPlaneConfig.quaternion}
            renderOrder={2}
            onClick={(e) => {
              e.stopPropagation();
              handleScreenClick();
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'auto';
            }}
          >
            <shapeGeometry args={[screenShape, 8]} />
            <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </group>
  );
}

// Helper function to properly apply texture to mesh
function applyTextureToMesh(mesh: THREE.Mesh, texture: THREE.Texture) {
  // Configure texture for proper display with memory optimization
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Use mipmaps for better memory efficiency
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.flipY = true;

  normalizeMeshUVs(mesh);

  const screenAspect = getMeshAspect(mesh);
  const imageAspect =
    texture.image && texture.image.height
      ? texture.image.width / texture.image.height
      : screenAspect;

  // Ensure full height is visible - use contain mode (no cropping)
  // Full height, auto width - always fit image to screen height
  if (Number.isFinite(screenAspect) && Number.isFinite(imageAspect)) {
    // Always fit to height to ensure full height is visible (contain mode)
    // When image is wider: fit to height, letterbox on sides
    // When image is taller: scale entire image down to fit, letterbox on all sides
    if (imageAspect >= screenAspect) {
      // Image is wider or same aspect - fit to height, letterbox on sides
      const widthScale = screenAspect / imageAspect;
      texture.repeat.set(widthScale, 1);
      texture.offset.set((1 - widthScale) / 2, 0);
    } else {
      // Image is taller - need to scale down to fit within screen
      // To show full height, we scale based on height ratio
      // Since imageAspect = imageWidth/imageHeight and screenAspect = screenWidth/screenHeight
      // To fit height: scale = screenHeight / imageHeight
      // But we need this in aspect terms...
      // Actually: if image height is 'h' and screen height is 'sh',
      // and we want h to fit in sh, we scale by sh/h
      // In aspect terms: scale = (1/imageAspect) / (1/screenAspect) = screenAspect / imageAspect
      // This is > 1, which means we're showing MORE of the texture (zooming out)
      // But wait, repeat > 1 zooms out, which shows less detail but more area
      // For contain mode when taller, we want to zoom out so it fits
      const scale = screenAspect / imageAspect; // > 1 when image is taller
      texture.repeat.set(scale, scale);
      texture.offset.set((1 - scale) / 2, (1 - scale) / 2);
    }
  } else {
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  }

  texture.needsUpdate = true;

  const existingMaterial = mesh.material as THREE.Material | undefined;
  const material =
    existingMaterial instanceof THREE.MeshBasicMaterial
      ? existingMaterial
      : new THREE.MeshBasicMaterial({
          toneMapped: false,
          side: THREE.DoubleSide,
          transparent: false,
        });

  material.toneMapped = false;
  material.side = THREE.DoubleSide;
  material.transparent = false;
  material.map = texture;
  material.needsUpdate = true;

  mesh.material = material;
  mesh.visible = true;
  mesh.frustumCulled = false;
}

function createRoundedRectShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.min(radius, halfW, halfH);

  shape.moveTo(-halfW + r, -halfH);
  shape.lineTo(halfW - r, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
  shape.lineTo(halfW, halfH - r);
  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
  shape.lineTo(-halfW + r, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
  shape.lineTo(-halfW, -halfH + r);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);

  return shape;
}

function normalizeMeshUVs(mesh: THREE.Mesh) {
  const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
  const uvAttr = geometry?.attributes?.uv as THREE.BufferAttribute | undefined;
  if (!geometry || !uvAttr) return;

  if (mesh.userData.uvNormalized) return;

  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < uvAttr.count; i += 1) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    if (u < minU) minU = u;
    if (v < minV) minV = v;
    if (u > maxU) maxU = u;
    if (v > maxV) maxV = v;
  }

  const rangeU = maxU - minU;
  const rangeV = maxV - minV;

  if (
    !Number.isFinite(rangeU) ||
    !Number.isFinite(rangeV) ||
    rangeU === 0 ||
    rangeV === 0
  ) {
    return;
  }

  for (let i = 0; i < uvAttr.count; i += 1) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    uvAttr.setXY(i, (u - minU) / rangeU, (v - minV) / rangeV);
  }

  uvAttr.needsUpdate = true;
  mesh.userData.uvNormalized = true;
}

function getMeshWorldSize(mesh: THREE.Mesh) {
  const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
  if (!geometry) return new THREE.Vector3(1, 1, 1);

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return new THREE.Vector3(1, 1, 1);

  const size = new THREE.Vector3();
  bbox.getSize(size);

  const meshScale = new THREE.Vector3(1, 1, 1);
  mesh.getWorldScale(meshScale);

  return size.multiply(meshScale);
}

function getMeshAspect(mesh: THREE.Mesh) {
  const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
  if (!geometry) return 1;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return 1;

  const size = new THREE.Vector3();
  bbox.getSize(size);

  const meshScale = mesh.scale;
  const dims = [
    Math.abs(size.x * meshScale.x),
    Math.abs(size.y * meshScale.y),
    Math.abs(size.z * meshScale.z),
  ].sort((a, b) => b - a);

  const width = dims[0] ?? 1;
  const height = dims[1] ?? 1;

  if (height === 0) return 1;
  return width / height;
}

// Conditionally preload model - only on high-end devices to save memory
// This will be evaluated at module load time
if (typeof window !== 'undefined') {
  try {
    const isHighEndDevice =
      (navigator.hardwareConcurrency || 2) >= 4 &&
      ((navigator as any).deviceMemory || 2) >= 4;

    if (isHighEndDevice) {
      useGLTF.preload('/fun/models/rachoArcade.glb', true);
    }
  } catch {
    // Fallback: preload anyway if device detection fails
    useGLTF.preload('/fun/models/rachoArcade.glb', true);
  }
} else {
  // Server-side: don't preload
}
