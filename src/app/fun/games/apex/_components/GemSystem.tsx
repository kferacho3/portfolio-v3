import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  ARENA_PRESETS,
  GEM_RADIUS,
  GEM_SCORE_COLORS,
  GEM_SCORE_STEP,
  SPHERE_RADIUS,
  THEMES,
  getArenaTheme,
} from '../constants';
import { apexState, mutation } from '../state';
import type { GemType } from '../types';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const hexToRgb = (hex: string) => {
  const cleaned = hex.replace('#', '');
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixHex = (a: string, b: string, t: number) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return rgbToHex(lerp(ca.r, cb.r), lerp(ca.g, cb.g), lerp(ca.b, cb.b));
};

const segmentPointDistanceSq = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  px: number,
  py: number,
  pz: number
) => {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;

  // If the segment is degenerate, fall back to point distance.
  if (abLenSq <= 1e-8) {
    const dx = px - ax;
    const dy = py - ay;
    const dz = pz - az;
    return dx * dx + dy * dy + dz * dz;
  }

  const t = clamp01((apx * abx + apy * aby + apz * abz) / abLenSq);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  return dx * dx + dy * dy + dz * dz;
};

const segmentPointDistanceSq2D = (
  ax: number,
  az: number,
  bx: number,
  bz: number,
  px: number,
  pz: number
) => {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const abLenSq = abx * abx + abz * abz;

  if (abLenSq <= 1e-8) {
    const dx = px - ax;
    const dz = pz - az;
    return dx * dx + dz * dz;
  }

  const t = clamp01((apx * abx + apz * abz) / abLenSq);
  const cx = ax + abx * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
};

type PickupFx = {
  id: number;
  x: number;
  y: number;
  z: number;
  label: string;
  color: string;
};

const GemPickupFX: React.FC<PickupFx & { onDone: (id: number) => void }> = ({
  id,
  x,
  y,
  z,
  label,
  color,
  onDone,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sparkMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const startedAtRef = useRef(performance.now());
  const doneRef = useRef(false);

  useFrame(() => {
    const t = (performance.now() - startedAtRef.current) / 1000;
    const duration = 0.55;
    if (t >= duration) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone(id);
      }
      return;
    }

    const p = clamp01(t / duration);
    const easeOut = 1 - Math.pow(1 - p, 3);
    const rise = easeOut * 0.9;
    const scale = 0.35 + easeOut * 1.25;

    if (groupRef.current) {
      groupRef.current.position.set(x, y + rise, z);
      groupRef.current.scale.setScalar(scale);
    }
    if (ringMatRef.current) {
      ringMatRef.current.opacity = (1 - p) * 0.8;
    }
    if (sparkMatRef.current) {
      sparkMatRef.current.opacity = (1 - p) * 0.9;
    }
  });

  return (
    <group ref={groupRef} position={[x, y, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.22, 24]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={color}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.08, 0]} />
        <meshBasicMaterial
          ref={sparkMatRef}
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
      <Html transform distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            fontFamily:
              '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontWeight: 800,
            letterSpacing: '0.08em',
            fontSize: 16,
            color,
            textShadow: `0 0 18px ${color}`,
            transform: 'translate(-50%, -60%)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
};

const GemSystem: React.FC = () => {
  const snap = useSnapshot(apexState);
  // Ensure we re-render when phase/powerups/gems change (useFrame closures depend on this too).
  const phase = snap.phase;
  const powerUp = snap.powerUp;
  const gemsCollected = snap.gems;
  const preset = ARENA_PRESETS[snap.arena];
  const arenaTheme = useMemo(
    () => getArenaTheme(preset, THEMES[snap.currentTheme]),
    [preset, snap.currentTheme]
  );
  void phase;
  void powerUp;
  void gemsCollected;

  const lastSpherePosRef = useRef(new THREE.Vector3());
  const hasLastSpherePosRef = useRef(false);
  const countsRef = useRef({ gems: 0, powerUps: 0 });
  const scoreTierRef = useRef(0);
  const nextFxIdRef = useRef(1);
  const [pickupFx, setPickupFx] = useState<PickupFx[]>([]);
  const [, forceRender] = useReducer((v: number) => v + 1, 0);
  const removeFx = useCallback((id: number) => {
    setPickupFx((prev) => prev.filter((fx) => fx.id !== id));
  }, []);

  const gemGeometries = useMemo(
    () => ({
      normal: new THREE.OctahedronGeometry(GEM_RADIUS * 0.75, 0),
      prism: new THREE.IcosahedronGeometry(GEM_RADIUS * 0.82, 0),
      fractal: new THREE.TorusKnotGeometry(
        GEM_RADIUS * 0.35,
        GEM_RADIUS * 0.12,
        80,
        12
      ),
      nova: new THREE.DodecahedronGeometry(GEM_RADIUS * 0.85, 0),
    }),
    []
  );

  useEffect(() => {
    return () => {
      Object.values(gemGeometries).forEach((geometry) => geometry.dispose());
    };
  }, [gemGeometries]);

  useFrame((_, delta) => {
    // Read directly from the valtio proxy so this never "sticks" on the menu snapshot.
    if (apexState.phase !== 'playing' || !mutation.initialized) {
      hasLastSpherePosRef.current = false;
      return;
    }

    const spherePos = mutation.spherePos;
    if (!hasLastSpherePosRef.current) {
      lastSpherePosRef.current.copy(spherePos);
      hasLastSpherePosRef.current = true;
    }

    const prevSpherePos = lastSpherePosRef.current;

    const isMagnet = apexState.powerUp === 'magnet';
    const attractRadius = isMagnet ? 6 : 2.4;
    const absorbSpeed = isMagnet ? 5 : 3.2;
    const absorbLerp = isMagnet ? 0.25 : 0.14;
    // Swept collision prevents "tunneling" through pickups at high speed.
    // Make pickup a bit forgiving relative to visuals (gems hover above the tile).
    const collectRadius = SPHERE_RADIUS + GEM_RADIUS * 1.05;
    const collectRadiusSq = collectRadius * collectRadius;
    // More forgiving horizontal pickup (players tend to "clip" visually in X/Z).
    const collectRadiusSq2D = (SPHERE_RADIUS + GEM_RADIUS * 0.95) ** 2;

    const nextGemCount = mutation.gems.length;
    const nextPowerUpCount = mutation.powerUps.length;
    let needsRender = false;
    const nextTier = Math.floor(apexState.score / GEM_SCORE_STEP);
    if (nextTier !== scoreTierRef.current) {
      scoreTierRef.current = nextTier;
      needsRender = true;
    }
    const tierColor =
      GEM_SCORE_COLORS[scoreTierRef.current % GEM_SCORE_COLORS.length];
    const baseGemColor = mixHex(tierColor, arenaTheme.gemHex, 0.35);
    const fxColor = baseGemColor;

    if (
      nextGemCount !== countsRef.current.gems ||
      nextPowerUpCount !== countsRef.current.powerUps
    ) {
      countsRef.current.gems = nextGemCount;
      countsRef.current.powerUps = nextPowerUpCount;
      needsRender = true;
    }

    const spawnedFx: PickupFx[] = [];

    for (const gem of mutation.gems) {
      if (gem.collected) continue;

      if (gem.absorbing === undefined) gem.absorbing = false;
      if (gem.absorbProgress === undefined) gem.absorbProgress = 0;

      const rotationSpeed =
        gem.type === 'fractal' ? 1.6 : gem.type === 'nova' ? 2.1 : 1.2;
      gem.rotation += delta * rotationSpeed;

      const dx = gem.x - spherePos.x;
      const dy = gem.y - spherePos.y;
      const dz = gem.z - spherePos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const sweptDistSq2D = segmentPointDistanceSq2D(
        prevSpherePos.x,
        prevSpherePos.z,
        spherePos.x,
        spherePos.z,
        gem.x,
        gem.z
      );
      const sweptDistSq = segmentPointDistanceSq(
        prevSpherePos.x,
        prevSpherePos.y,
        prevSpherePos.z,
        spherePos.x,
        spherePos.y,
        spherePos.z,
        gem.x,
        gem.y,
        gem.z
      );

      if (
        sweptDistSq2D <= collectRadiusSq2D ||
        sweptDistSq <= collectRadiusSq
      ) {
        gem.collected = true;
        const awarded = apexState.collectGem(gem.type);
        spawnedFx.push({
          id: nextFxIdRef.current++,
          x: gem.x,
          y: gem.y,
          z: gem.z,
          label: `+${awarded || 0}`,
          color: fxColor,
        });
        needsRender = true;
        continue;
      }

      if (!gem.absorbing && dist < attractRadius) {
        gem.absorbing = true;
        gem.absorbProgress = 0;
      }

      if (gem.absorbing) {
        gem.absorbProgress = Math.min(
          1,
          gem.absorbProgress + delta * absorbSpeed
        );
        const pull = absorbLerp + gem.absorbProgress * 0.55;
        gem.x = THREE.MathUtils.lerp(gem.x, spherePos.x, pull);
        gem.y = THREE.MathUtils.lerp(gem.y, spherePos.y + 0.1, pull);
        gem.z = THREE.MathUtils.lerp(gem.z, spherePos.z, pull);

        const absorbDx = gem.x - spherePos.x;
        const absorbDy = gem.y - spherePos.y;
        const absorbDz = gem.z - spherePos.z;
        const absorbDist = Math.sqrt(
          absorbDx * absorbDx + absorbDy * absorbDy + absorbDz * absorbDz
        );

        if (gem.absorbProgress >= 1 || absorbDist <= SPHERE_RADIUS * 0.6) {
          gem.collected = true;
          const awarded = apexState.collectGem(gem.type);
          spawnedFx.push({
            id: nextFxIdRef.current++,
            x: gem.x,
            y: gem.y,
            z: gem.z,
            label: `+${awarded || 0}`,
            color: fxColor,
          });
          needsRender = true;
        }
      }
    }

    for (const powerUp of mutation.powerUps) {
      if (powerUp.collected) continue;

      const powerUpCollectRadius = SPHERE_RADIUS + 0.55;
      const powerUpCollectRadiusSq =
        powerUpCollectRadius * powerUpCollectRadius;
      const powerUpSweptDistSq = segmentPointDistanceSq(
        prevSpherePos.x,
        prevSpherePos.y,
        prevSpherePos.z,
        spherePos.x,
        spherePos.y,
        spherePos.z,
        powerUp.x,
        powerUp.y,
        powerUp.z
      );

      if (powerUpSweptDistSq <= powerUpCollectRadiusSq) {
        powerUp.collected = true;
        apexState.activatePowerUp(powerUp.type);
        needsRender = true;
      }
    }

    // Update sweep start for next frame.
    prevSpherePos.copy(spherePos);

    if (spawnedFx.length > 0) {
      setPickupFx((prev) => [...prev, ...spawnedFx]);
    }
    if (needsRender) {
      forceRender();
    }
  });

  const theme = arenaTheme;
  const visibleGems = mutation.gems.filter((g) => !g.collected);
  const visiblePowerUps = mutation.powerUps.filter((p) => !p.collected);
  const scoreTier = scoreTierRef.current;
  const tierColor = GEM_SCORE_COLORS[scoreTier % GEM_SCORE_COLORS.length];
  const baseGemColor = mixHex(tierColor, theme.gemHex, 0.35);
  const gemPalette: Record<
    GemType,
    { color: string; emissive: string; metalness: number; roughness: number }
  > = {
    normal: {
      color: baseGemColor,
      emissive: mixHex(baseGemColor, '#ffffff', 0.3),
      metalness: 0.3,
      roughness: 0.35,
    },
    prism: {
      color: mixHex(baseGemColor, '#7dd3fc', 0.45),
      emissive: mixHex(baseGemColor, '#67e8f9', 0.55),
      metalness: 0.1,
      roughness: 0.2,
    },
    fractal: {
      color: mixHex(baseGemColor, '#c084fc', 0.45),
      emissive: mixHex(baseGemColor, '#a855f7', 0.45),
      metalness: 0.25,
      roughness: 0.35,
    },
    nova: {
      color: mixHex(baseGemColor, '#fb7185', 0.5),
      emissive: mixHex(baseGemColor, '#fb7185', 0.65),
      metalness: 0.4,
      roughness: 0.3,
    },
  };

  return (
    <group>
      {pickupFx.map((fx) => (
        <GemPickupFX key={fx.id} {...fx} onDone={removeFx} />
      ))}
      {visibleGems.map((gem) => {
        const pulse = 1 + Math.sin(gem.rotation * 2) * 0.02;
        const absorbScale = gem.absorbing ? 1 - gem.absorbProgress * 0.6 : 1;
        const opacity = gem.absorbing
          ? Math.max(0, 0.85 - gem.absorbProgress * 0.9)
          : 0.9;
        const bob = Math.sin(gem.rotation * 1.2) * 0.05;
        const skinScale =
          gem.type === 'fractal' ? 0.92 : gem.type === 'nova' ? 1.05 : 1;
        const gemStyle = gemPalette[gem.type];

        return (
          <group
            key={gem.id}
            position={[gem.x, gem.y + bob, gem.z]}
            rotation={[0, gem.rotation * 0.6, Math.PI / 4]}
            scale={pulse * absorbScale * skinScale}
          >
            <mesh geometry={gemGeometries[gem.type]}>
              {gem.type === 'prism' ? (
                <meshPhysicalMaterial
                  color={gemStyle.color}
                  emissive={gemStyle.emissive}
                  emissiveIntensity={0.2}
                  metalness={gemStyle.metalness}
                  roughness={gemStyle.roughness}
                  transmission={0.65}
                  thickness={0.6}
                  clearcoat={0.8}
                  clearcoatRoughness={0.2}
                  transparent
                  opacity={opacity}
                />
              ) : (
                <meshStandardMaterial
                  color={gemStyle.color}
                  emissive={gemStyle.emissive}
                  emissiveIntensity={gem.type === 'nova' ? 0.5 : 0.25}
                  metalness={gemStyle.metalness}
                  roughness={gemStyle.roughness}
                  transparent
                  opacity={opacity}
                  flatShading={gem.type === 'fractal'}
                />
              )}
            </mesh>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              scale={gem.type === 'normal' ? 0.8 : 1}
            >
              <ringGeometry args={[0.18, 0.28, 28]} />
              <meshBasicMaterial
                color={gemStyle.emissive}
                transparent
                opacity={0.55}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}

      {visiblePowerUps.map((powerUp) => (
        <mesh
          key={powerUp.id}
          position={[
            powerUp.x,
            powerUp.y + Math.sin(Date.now() * 0.003) * 0.15,
            powerUp.z,
          ]}
          rotation={[0, Date.now() * 0.002, 0]}
        >
          <icosahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial
            color={
              powerUp.type === 'shield'
                ? '#00ff88'
                : powerUp.type === 'magnet'
                  ? '#ff00ff'
                  : '#ffcc00'
            }
            emissive={
              powerUp.type === 'shield'
                ? '#00ff88'
                : powerUp.type === 'magnet'
                  ? '#ff00ff'
                  : '#ffcc00'
            }
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
};

export default GemSystem;
