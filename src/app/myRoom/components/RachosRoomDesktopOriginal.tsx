'use client';

import { Html, useAnimations, useCursor, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Variants, motion } from 'framer-motion';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTF } from 'three-stdlib';
import {
  closetGroups,
  goldGroups,
  meBitsGroups,
  redGroups,
  whiteGroups,
} from './groupConstants';
import { GroupData } from './groupData';

// S3 URL for the new RachosRoom model
const MODEL_URL =
  'https://racho-devs.s3.us-east-2.amazonaws.com/roomV2/desktop/RachosRoomMain.glb';

// Define GroupProps based on JSX Intrinsic Elements
type GroupProps = JSX.IntrinsicElements['group'];

type AudioBands = {
  low: number;
  mid: number;
  high: number;
  energy: number;
  peak: number;
};

type AudioState = {
  data: Uint8Array;
  smooth: Float32Array;
  bands: AudioBands;
  time: number;
  beat: number;
  prevEnergy: number;
};

// GLTF Result type
type GLTFResult = GLTF & {
  nodes: Record<
    string,
    THREE.Object3D & THREE.Mesh & THREE.SkinnedMesh & THREE.Bone
  >;
  materials: Record<string, THREE.Material>;
};

const AudioStateContext =
  React.createContext<React.MutableRefObject<AudioState> | null>(null);

const hashString = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const normalizeAxisWeights = (values: [number, number, number]) => {
  const sum = values[0] + values[1] + values[2];
  if (!sum) return [1 / 3, 1 / 3, 1 / 3] as [number, number, number];
  return [values[0] / sum, values[1] / sum, values[2] / sum] as [
    number,
    number,
    number,
  ];
};

const normalizeVec3 = (values: [number, number, number]) => {
  const length = Math.hypot(values[0], values[1], values[2]);
  if (!length) return [1, 0, 0] as [number, number, number];
  return [values[0] / length, values[1] / length, values[2] / length] as [
    number,
    number,
    number,
  ];
};

const averageRange = (data: Float32Array, start: number, end: number) => {
  const safeEnd = Math.max(start + 1, end);
  let sum = 0;
  for (let i = start; i < safeEnd; i++) sum += data[i] ?? 0;
  return sum / (safeEnd - start);
};

// Indicator Component
const Indicator: React.FC<{
  isSelected: boolean;
  hovered: boolean;
  onSelect: () => void;
  gradient: string;
}> = ({ isSelected, hovered, onSelect, gradient }) => {
  const pulseVariants = (gradient: string): Variants => ({
    initial: { scale: 1, opacity: 0.5 },
    pulse: {
      scale: [1, 1.1, 1],
      opacity: [0.5, 1, 0.5],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut' as const,
      },
    },
    hover: {
      scale: 1.05,
      opacity: 1,
      background: gradient,
      transition: {
        duration: 0.5,
        ease: 'easeInOut' as const,
      },
    },
    selected: {
      scale: 1.05,
      opacity: 1,
      background: gradient,
      transition: {
        duration: 0.5,
        ease: 'easeInOut' as const,
      },
    },
  });

  const variants = pulseVariants(gradient);

  return (
    <motion.div
      className="absolute flex items-center justify-center w-6 h-6 border-2 border-blue-300 rounded-full cursor-pointer"
      variants={variants}
      initial="initial"
      animate={isSelected ? 'selected' : hovered ? 'hover' : 'pulse'}
      onClick={onSelect}
    >
      {/* Curved Diamond Shape */}
      <div className="w-4 h-4 border-2 border-blue-300 rounded-md transform rotate-45"></div>
    </motion.div>
  );
};

// Define AnimatedGroupProps by extending GroupProps
interface AnimatedGroupProps
  extends Omit<GroupProps, 'scale' | 'rotation' | 'id'> {
  children: React.ReactNode;
  onClick?: () => void;
  name?: string;
  groups?: GroupData[];
  setGroups?: React.Dispatch<React.SetStateAction<GroupData[]>>;
  onInspect?: (modelName: string | null) => void;
  onMeBitFound?: (name: string) => void;
  analyser?: THREE.AudioAnalyser;
  frequencyIndices?: number[];
  isPlaying?: boolean;
  indicatorPosition?: [number, number, number];
}

// AnimatedGroup Component
const AnimatedGroup: React.FC<AnimatedGroupProps> = ({
  children,
  name,
  groups,
  setGroups,
  onInspect,
  onMeBitFound,
  frequencyIndices,
  isPlaying,
  indicatorPosition,
  ...props
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const audioStateRef = useContext(AudioStateContext);
  const baseTransform = useRef<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
    ready: boolean;
  }>({
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    scale: new THREE.Vector3(1, 1, 1),
    ready: false,
  });
  const glowMaterials = useRef<
    {
      material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      base: number;
    }[]
  >([]);

  // Dynamically calculate indicator position from the bounding box of all meshes
  const [computedIndicatorPosition, setComputedIndicatorPosition] = useState<
    [number, number, number] | null
  >(null);

  useEffect(() => {
    if (!groupRef.current || !indicatorPosition) return;

    // Use a small delay to ensure all matrices are updated
    const timeoutId = setTimeout(() => {
      if (!groupRef.current) return;

      // Force update all matrices in the scene hierarchy
      groupRef.current.updateMatrixWorld(true);

      // Calculate bounding box in world space for all meshes
      const box = new THREE.Box3();
      let meshCount = 0;

      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          const childBox = new THREE.Box3().setFromObject(child);
          if (!childBox.isEmpty()) {
            box.union(childBox);
            meshCount++;
          }
        }
      });

      if (meshCount > 0 && !box.isEmpty()) {
        const worldCenter = new THREE.Vector3();
        box.getCenter(worldCenter);

        // Convert world center to the AnimatedGroup's local space
        const localCenter = groupRef.current.worldToLocal(worldCenter.clone());

        // Add a small Y offset to place indicator above the center
        setComputedIndicatorPosition([
          localCenter.x,
          localCenter.y + 0.5,
          localCenter.z,
        ]);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [indicatorPosition]);

  const effect = useMemo(() => {
    const id = name ?? 'group';
    const rand = mulberry32(hashString(id));
    const isMeBit = meBitsGroups.includes(id);
    const isGold = goldGroups.includes(id);
    const isRed = redGroups.includes(id);
    const isWhite = whiteGroups.includes(id);
    const isCloset = closetGroups.includes(id);
    const intensity = isMeBit
      ? 1.15
      : isGold
        ? 0.9
        : isRed
          ? 0.8
          : isCloset
            ? 0.8
            : isWhite
              ? 0.65
              : 0.45;

    const band: 'low' | 'mid' | 'high' = isMeBit
      ? 'mid'
      : isGold
        ? 'low'
        : isRed
          ? 'high'
          : isWhite
            ? 'mid'
            : rand() < 0.34
              ? 'low'
              : rand() < 0.67
                ? 'mid'
                : 'high';

    const scaleAxis = normalizeAxisWeights([
      0.3 + rand() * 0.7,
      0.3 + rand() * 0.7,
      0.3 + rand() * 0.7,
    ]);
    const positionAxis = normalizeVec3([
      (rand() - 0.5) * (isCloset ? 1.4 : 0.5),
      1,
      (rand() - 0.5) * (isCloset ? 1.1 : 0.5),
    ]);

    const scale = (0.028 + rand() * 0.06) * intensity;
    const rotation = [
      (0.08 + rand() * 0.18) * intensity,
      (0.08 + rand() * 0.18) * intensity,
      (0.05 + rand() * 0.12) * intensity,
    ] as [number, number, number];
    const bob = (0.02 + rand() * 0.05) * intensity;
    const micro = (0.006 + rand() * 0.02) * intensity;
    const sway = (0.015 + rand() * 0.04) * intensity;
    const twist = (0.015 + rand() * 0.04) * intensity;
    const drift =
      (isCloset ? 0.015 + rand() * 0.04 : 0.008 + rand() * 0.02) * intensity;
    const speed = (isCloset ? 0.9 : 0.6) + rand() * 1.6;
    const flutter = 1.6 + rand() * 2.8;
    const pulse = 0.6 + rand() * 0.6;
    const phase = rand() * Math.PI * 2;
    const energyBoost = isMeBit
      ? 0.45
      : isGold
        ? 0.32
        : isRed
          ? 0.28
          : isCloset
            ? 0.26
            : isWhite
              ? 0.22
              : 0.18;
    const beatBoost = isMeBit ? 0.9 : isCloset ? 0.75 : isGold ? 0.65 : 0.55;
    const beatScale = (0.12 + rand() * 0.18) * intensity;
    const beatRotate = (0.06 + rand() * 0.1) * intensity;
    const glow = isMeBit || isGold || isRed;
    const glowIntensity =
      (isMeBit ? 1.4 : isGold ? 1.1 : 0.9) * (0.7 + rand() * 0.6);
    const glowColor = isGold
      ? new THREE.Color('#ffd166')
      : isRed
        ? new THREE.Color('#ff5a5f')
        : isMeBit
          ? new THREE.Color('#67f5ff')
          : new THREE.Color('#ffffff');

    return {
      band,
      scaleAxis,
      positionAxis,
      scale,
      rotation,
      bob,
      micro,
      sway,
      twist,
      drift,
      speed,
      flutter,
      pulse,
      phase,
      energyBoost,
      beatBoost,
      beatScale,
      beatRotate,
      glow,
      glowIntensity,
      glowColor,
      intensity,
    };
  }, [name]);

  useEffect(() => {
    if (!groupRef.current || !effect.glow) return;

    const collected: {
      material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      base: number;
    }[] = [];

    groupRef.current.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      const cloned = materials.map((material) => {
        if (
          material instanceof THREE.MeshStandardMaterial ||
          material instanceof THREE.MeshPhysicalMaterial
        ) {
          const next = material.clone();
          next.emissive = effect.glowColor.clone();
          const base = next.emissiveIntensity ?? 0;
          next.emissiveIntensity = 0;
          collected.push({ material: next, base });
          return next;
        }
        return material;
      });

      child.material = Array.isArray(child.material) ? cloned : cloned[0];
    });

    glowMaterials.current = collected;
  }, [effect.glow, effect.glowColor]);

  useFrame((state, delta) => {
    if (!groupRef.current || !audioStateRef?.current) return;

    if (!baseTransform.current.ready) {
      baseTransform.current.position.copy(groupRef.current.position);
      baseTransform.current.rotation.copy(groupRef.current.rotation);
      baseTransform.current.scale.copy(groupRef.current.scale);
      baseTransform.current.ready = true;
    }

    const audio = audioStateRef.current;
    const indices = frequencyIndices?.length ? frequencyIndices : [];
    let binAmp = 0;
    if (indices.length) {
      for (let i = 0; i < indices.length; i++) {
        binAmp += audio.smooth[indices[i]] ?? 0;
      }
      binAmp /= indices.length;
    } else {
      binAmp = audio.bands.energy;
    }

    // ONLY animate when FFT/music is active
    if (!isPlaying) {
      // Reset to base transform when not playing
      const base = baseTransform.current;
      groupRef.current.scale.x = THREE.MathUtils.damp(
        groupRef.current.scale.x,
        base.scale.x,
        8,
        delta
      );
      groupRef.current.scale.y = THREE.MathUtils.damp(
        groupRef.current.scale.y,
        base.scale.y,
        8,
        delta
      );
      groupRef.current.scale.z = THREE.MathUtils.damp(
        groupRef.current.scale.z,
        base.scale.z,
        8,
        delta
      );
      groupRef.current.rotation.x = THREE.MathUtils.damp(
        groupRef.current.rotation.x,
        base.rotation.x,
        8,
        delta
      );
      groupRef.current.rotation.y = THREE.MathUtils.damp(
        groupRef.current.rotation.y,
        base.rotation.y,
        8,
        delta
      );
      groupRef.current.rotation.z = THREE.MathUtils.damp(
        groupRef.current.rotation.z,
        base.rotation.z,
        8,
        delta
      );
      groupRef.current.position.x = THREE.MathUtils.damp(
        groupRef.current.position.x,
        base.position.x,
        8,
        delta
      );
      groupRef.current.position.y = THREE.MathUtils.damp(
        groupRef.current.position.y,
        base.position.y,
        8,
        delta
      );
      groupRef.current.position.z = THREE.MathUtils.damp(
        groupRef.current.position.z,
        base.position.z,
        8,
        delta
      );

      // Reset glow when not playing
      if (effect.glow && glowMaterials.current.length) {
        glowMaterials.current.forEach(({ material, base }) => {
          material.emissiveIntensity = THREE.MathUtils.damp(
            material.emissiveIntensity,
            base,
            5,
            delta
          );
        });
      }
      return;
    }

    const bandAmp = audio.bands[effect.band];
    const t = audio.time;
    const wave = Math.sin(t * effect.speed + effect.phase);
    const swing = Math.cos(t * (effect.speed * 0.9) + effect.phase);
    const flutter = Math.sin(t * effect.flutter + effect.phase * 1.7);
    const pulse = effect.pulse + 0.4 * wave;

    const drive = clamp01((binAmp * 0.6 + bandAmp * 0.4) * pulse);
    const energy = audio.bands.energy;
    const beat = audio.beat;
    const motion = clamp01(
      drive + energy * effect.energyBoost + beat * effect.beatBoost
    );

    const drift =
      (wave * effect.bob + flutter * effect.micro + swing * effect.drift) *
      motion;
    const scaleDrive = motion * effect.scale + beat * effect.beatScale;
    const rotDrive = motion + beat * effect.beatRotate;

    const base = baseTransform.current;
    const targetScaleX = base.scale.x * (1 + scaleDrive * effect.scaleAxis[0]);
    const targetScaleY = base.scale.y * (1 + scaleDrive * effect.scaleAxis[1]);
    const targetScaleZ = base.scale.z * (1 + scaleDrive * effect.scaleAxis[2]);

    groupRef.current.scale.x = THREE.MathUtils.damp(
      groupRef.current.scale.x,
      targetScaleX,
      6,
      delta
    );
    groupRef.current.scale.y = THREE.MathUtils.damp(
      groupRef.current.scale.y,
      targetScaleY,
      6,
      delta
    );
    groupRef.current.scale.z = THREE.MathUtils.damp(
      groupRef.current.scale.z,
      targetScaleZ,
      6,
      delta
    );

    const targetRotX =
      base.rotation.x +
      wave * effect.rotation[0] * rotDrive +
      swing * effect.sway;
    const targetRotY =
      base.rotation.y +
      swing * effect.rotation[1] * rotDrive +
      flutter * effect.twist;
    const targetRotZ = base.rotation.z + wave * effect.rotation[2] * rotDrive;

    groupRef.current.rotation.x = THREE.MathUtils.damp(
      groupRef.current.rotation.x,
      targetRotX,
      6,
      delta
    );
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      targetRotY,
      6,
      delta
    );
    groupRef.current.rotation.z = THREE.MathUtils.damp(
      groupRef.current.rotation.z,
      targetRotZ,
      6,
      delta
    );

    const targetPosX = base.position.x + drift * effect.positionAxis[0];
    const targetPosY = base.position.y + drift * effect.positionAxis[1];
    const targetPosZ = base.position.z + drift * effect.positionAxis[2];

    groupRef.current.position.x = THREE.MathUtils.damp(
      groupRef.current.position.x,
      targetPosX,
      6,
      delta
    );
    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y,
      targetPosY,
      6,
      delta
    );
    groupRef.current.position.z = THREE.MathUtils.damp(
      groupRef.current.position.z,
      targetPosZ,
      6,
      delta
    );

    if (effect.glow && glowMaterials.current.length) {
      const glowTarget =
        effect.glowIntensity * (0.35 + 0.65 * motion + beat * 0.4);
      glowMaterials.current.forEach(({ material, base }) => {
        material.emissiveIntensity = THREE.MathUtils.damp(
          material.emissiveIntensity,
          base + glowTarget,
          5,
          delta
        );
      });
    }
  });

  const [hovered, setHovered] = useState<boolean>(false);
  useCursor(hovered, 'pointer');

  // Get group data for this group if groups are provided
  const groupDataIndex =
    groups?.findIndex((group) => group.name === name) ?? -1;

  const groupData =
    groups && groupDataIndex >= 0 ? groups[groupDataIndex] : null;

  useEffect(() => {
    if (groupRef.current && groupData && setGroups && groupDataIndex >= 0) {
      // Update the object reference in groupData
      setGroups((prevGroups) => {
        const newGroups = [...prevGroups];
        newGroups[groupDataIndex] = {
          ...newGroups[groupDataIndex],
          object: groupRef.current,
        };
        return newGroups;
      });
    }
  }, [groupData, setGroups, groupDataIndex]);

  // Handle click events
  const handleClick = () => {
    if (!groups || !setGroups || !groupData || !name) return;

    const isMeBit = meBitsGroups.includes(name);
    const nextSelected = isMeBit
      ? groupData.isFound
        ? !groupData.isSelected
        : false
      : !groupData.isSelected;

    setGroups((prevGroups) =>
      prevGroups.map((group) => {
        if (group.name !== name) {
          return { ...group, isSelected: false };
        }
        if (isMeBit) {
          if (group.isFound) {
            return { ...group, isSelected: !group.isSelected };
          }
          return { ...group, isFound: true };
        }
        return { ...group, isSelected: !group.isSelected };
      })
    );

    if (isMeBit) {
      if (!groupData.isFound) {
        onMeBitFound && onMeBitFound(name);
        return;
      }
      onInspect && onInspect(nextSelected ? name : null);
      return;
    }

    onInspect && onInspect(nextSelected ? name : null);
  };

  // Determine if this group should have hover effects and Indicator
  const enableHover = useMemo(() => {
    if (
      goldGroups.includes(name || '') ||
      redGroups.includes(name || '') ||
      whiteGroups.includes(name || '') ||
      closetGroups.includes(name || '')
    ) {
      return true;
    }
    if (meBitsGroups.includes(name || '') && groupData?.isFound) {
      return true;
    }
    return false;
  }, [name, groupData]);

  // Determine gradient based on group name
  const gradient = useMemo(() => {
    if (!name) return '';
    if (goldGroups.includes(name)) {
      return 'linear-gradient(to right, gold, yellow)';
    }
    if (redGroups.includes(name)) {
      return 'linear-gradient(to right, red, orange, yellow)';
    }
    if (whiteGroups.includes(name)) {
      return 'linear-gradient(to right, white, silver, blue)';
    }
    if (closetGroups.includes(name)) {
      return 'linear-gradient(to right, #4de1ff, #7df9ff, #a0ffe6)';
    }
    return 'linear-gradient(to right, gold, yellow)'; // Default gradient
  }, [name]);

  return (
    <group
      ref={groupRef}
      {...props}
      onClick={handleClick}
      onPointerOver={(event) => {
        if (enableHover) setHovered(true);
        if (groupData && setGroups) {
          setGroups((prevGroups) =>
            prevGroups.map((group) =>
              group.name === name ? { ...group, isHovered: true } : group
            )
          );
        }
        if (props.onPointerOver) props.onPointerOver(event);
      }}
      onPointerOut={(event) => {
        if (enableHover) setHovered(false);
        if (groupData && setGroups) {
          setGroups((prevGroups) =>
            prevGroups.map((group) =>
              group.name === name ? { ...group, isHovered: false } : group
            )
          );
        }
        if (props.onPointerOut) props.onPointerOut(event);
      }}
      name={name}
    >
      {!isPlaying && enableHover && computedIndicatorPosition && (
        <group position={computedIndicatorPosition}>
          <Html center>
            <Indicator
              isSelected={groupData?.isSelected || false}
              hovered={groupData?.isHovered || false}
              onSelect={handleClick}
              gradient={gradient}
            />
          </Html>
        </group>
      )}
      <group>{children}</group>
    </group>
  );
};

// Indicator positions for interactive groups (matched to the new model)
const INDICATOR_POSITIONS: Record<string, [number, number, number]> = {
  // Gold groups
  BunnyEarsCactus: [0, 1.5, 0],
  KitchenSet: [0, 1.5, 0],
  PuzzleShelf: [0, 1.5, 0],
  Arcade: [0, 2, 0],
  LightUpSpeakers: [0, 1.5, 0],
  // Red groups
  RoomDisplayOne: [0, 1.5, 0],
  RoomDisplayTwo: [0, 1.5, 0],
  // White groups
  TVMonitor: [0, 1.5, 0],
  MonitorScreen: [0, 1, 0],
  Computer: [0, 1, 0],
  GraphicLeft: [0, 0.5, 0],
  GraphicRight: [0, 0.5, 0],
  GraphicMiddle: [0, 0.5, 0],
  // Closet groups
  ShelfKeyboard: [0, 0.5, 0],
  KeyboardMouse: [0, 0.5, 0],
  HeadsetStand: [0, 0.5, 0],
  GameZone: [0, 1, 0],
  XBOX: [0, 0.5, 0],
  PS5: [0, 0.5, 0],
  DVDPlayer: [0, 0.5, 0],
  CableBox: [0, 0.5, 0],
};

// Main RachosRoom Component
export default function RachosRoom({
  analyser,
  onInspect,
  groups,
  setGroups,
  onMeBitFound,
  isPlaying,
  ...props
}: {
  analyser: THREE.AudioAnalyser;
  onInspect: (modelName: string | null) => void;
  groups: GroupData[];
  setGroups: React.Dispatch<React.SetStateAction<GroupData[]>>;
  onMeBitFound: (name: string) => void;
  isPlaying: boolean;
} & JSX.IntrinsicElements['group']) {
  const groupRef = useRef<THREE.Group>(null);

  // Load GLTF model
  const gltf = useGLTF(MODEL_URL) as unknown as GLTFResult;
  const { nodes, materials, animations } = gltf;

  // Setup animations
  const { actions } = useAnimations(animations, groupRef);

  useEffect(() => {
    // Play all animations
    Object.values(actions).forEach((action) => {
      if (action) action.play();
    });

    // Clean up on unmount
    return () => {
      Object.values(actions).forEach((action) => {
        if (action) action.stop();
      });
    };
  }, [actions, isPlaying]);

  // Animated group names for FFT mapping
  const animatedGroupNames = [
    'RoomFloor',
    'RoomWall',
    'TVMonitor',
    'MonitorScreen',
    'KitchenSet',
    'Couch',
    'PuzzleShelf',
    'Arcade',
    'BunnyEarsCactus',
    'LightUpSpeakers',
    'RoomDisplayOne',
    'RoomDisplayTwo',
    'GraphicLeft',
    'GraphicMiddle',
    'GraphicRight',
    'MeBitSanta',
    'MeBitRobot',
    'MeBitCar',
    'MeBitPlant',
    'MeBitBoat',
    'MeBitCthulu',
    'MeBitBalloon',
    'MeBitHelmet',
    'MeBitTerranium',
    'MeBitChandelier',
    'TV_Stand',
    'MonitorStand',
    'TvMonitorFrame',
    'HeadsetStand',
    'TableCup',
    'TableRemote',
    'ComputerDesk',
    'Computer',
    'PS5',
    'CableBox',
    'ShelfKeyboard',
    'KeyboardMouse',
    'WallLights',
    'HangingLightLeft',
    'HangingLightRight',
    'HangingLightMiddle',
    'XBOX',
    'DVDPlayer',
    'GameZone',
    'TopShelf',
    'MiddleTable',
  ];

  const fftBins = analyser?.analyser?.frequencyBinCount ?? 128;

  const groupNameToFrequencyIndices = useMemo(() => {
    const lowEnd = Math.max(2, Math.floor(fftBins * 0.18));
    const midEnd = Math.max(lowEnd + 2, Math.floor(fftBins * 0.58));

    const pickBand = (
      groupName: string,
      roll: number
    ): 'low' | 'mid' | 'high' => {
      if (meBitsGroups.includes(groupName)) return 'mid';
      if (goldGroups.includes(groupName)) return 'low';
      if (redGroups.includes(groupName)) return 'high';
      if (closetGroups.includes(groupName)) return roll < 0.5 ? 'mid' : 'high';
      if (whiteGroups.includes(groupName)) return 'mid';
      if (roll < 0.34) return 'low';
      if (roll < 0.68) return 'mid';
      return 'high';
    };

    const bandRanges = {
      low: [0, lowEnd],
      mid: [lowEnd, midEnd],
      high: [midEnd, fftBins],
    } as const;

    return animatedGroupNames.reduce(
      (acc, groupName) => {
        const seed = hashString(groupName);
        const rand = mulberry32(seed);
        const band = pickBand(groupName, rand());
        const [start, end] = bandRanges[band];
        const range = Math.max(1, end - start);
        const binCount = meBitsGroups.includes(groupName)
          ? 3
          : goldGroups.includes(groupName) ||
              redGroups.includes(groupName) ||
              closetGroups.includes(groupName)
            ? 2
            : 1 + Math.floor(rand() * 2);

        const bins = new Set<number>();
        while (bins.size < binCount) {
          bins.add(start + Math.floor(rand() * range));
        }

        acc[groupName] = Array.from(bins);
        return acc;
      },
      {} as Record<string, number[]>
    );
  }, [animatedGroupNames, fftBins]);

  const bandEdges = useMemo(() => {
    const low = Math.max(2, Math.floor(fftBins * 0.18));
    const mid = Math.max(low + 2, Math.floor(fftBins * 0.58));
    return { low, mid };
  }, [fftBins]);

  const audioStateRef = useRef<AudioState>({
    data: new Uint8Array(fftBins),
    smooth: new Float32Array(fftBins),
    bands: { low: 0, mid: 0, high: 0, energy: 0, peak: 0 },
    time: 0,
    beat: 0,
    prevEnergy: 0,
  });

  useFrame((state, delta) => {
    if (!analyser) return;

    const data = analyser.getFrequencyData();
    const smooth = audioStateRef.current.smooth;

    if (smooth.length !== data.length) {
      audioStateRef.current.smooth = new Float32Array(data.length);
    }

    for (let i = 0; i < data.length; i++) {
      const target = data[i] / 255;
      audioStateRef.current.smooth[i] = THREE.MathUtils.damp(
        audioStateRef.current.smooth[i],
        target,
        6,
        delta
      );
    }

    const low = averageRange(audioStateRef.current.smooth, 0, bandEdges.low);
    const mid = averageRange(
      audioStateRef.current.smooth,
      bandEdges.low,
      bandEdges.mid
    );
    const high = averageRange(
      audioStateRef.current.smooth,
      bandEdges.mid,
      audioStateRef.current.smooth.length
    );
    const energy = averageRange(
      audioStateRef.current.smooth,
      0,
      audioStateRef.current.smooth.length
    );

    const bands = audioStateRef.current.bands;
    bands.low = THREE.MathUtils.damp(bands.low, low, 4, delta);
    bands.mid = THREE.MathUtils.damp(bands.mid, mid, 4, delta);
    bands.high = THREE.MathUtils.damp(bands.high, high, 4, delta);
    bands.energy = THREE.MathUtils.damp(bands.energy, energy, 5, delta);
    bands.peak = Math.max(bands.peak * 0.96, bands.energy);

    const prevEnergy = audioStateRef.current.prevEnergy;
    const energyDelta = Math.max(0, energy - prevEnergy);
    audioStateRef.current.prevEnergy = energy;
    audioStateRef.current.beat = THREE.MathUtils.damp(
      audioStateRef.current.beat,
      clamp01(energyDelta * 4.5),
      10,
      delta
    );

    audioStateRef.current.time = state.clock.elapsedTime;
    audioStateRef.current.data = data;
  });

  return (
    <AudioStateContext.Provider value={audioStateRef}>
      <group {...props} dispose={null}>
        <group ref={groupRef} name="Scene">
          {/* MeBit Robot */}
          <AnimatedGroup
            name="MeBitRobot"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitRobot']}
          >
            <group
              position={[3.084, 0.506, 0.16]}
              rotation={[-Math.PI, 1.566, -Math.PI]}
              scale={[0.006, 0.006, 0.007]}
            >
              <group
                position={[0, 0.615, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={100}
              >
                <group
                  position={[-0.723, 0, 2.015]}
                  rotation={[0, 0, -Math.PI]}
                >
                  <group position={[-0.723, 0, -1.963]}>
                    <group position={[0.894, -0.002, 1.418]} scale={0.491}>
                      <mesh
                        geometry={nodes.Mesh_40001?.geometry}
                        material={materials['PaletteMaterial001.032']}
                        position={[-5.999, -1, -3.995]}
                        scale={0.001}
                      />
                    </group>
                  </group>
                </group>
                <group position={[0.723, 0, 2.015]}>
                  <group position={[-0.723, 0, -1.963]}>
                    <group position={[0.894, -0.002, 1.418]} scale={0.491}>
                      <mesh
                        geometry={nodes.Mesh_40002?.geometry}
                        material={materials['PaletteMaterial001.032']}
                        position={[-5.999, -1, -3.995]}
                        scale={0.001}
                      />
                    </group>
                  </group>
                </group>
                <group position={[0, 0, 0.051]}>
                  <group position={[0.001, -0.132, 1.329]} scale={0.778}>
                    <mesh
                      geometry={nodes.Mesh_41001?.geometry}
                      material={materials['PaletteMaterial002.015']}
                      position={[-5.999, -1, -3.995]}
                      scale={0.001}
                    />
                  </group>
                  <group position={[0.069, 0.004, 3.25]} scale={2.845}>
                    <group position={[-5.999, -1, -3.995]} scale={0.001}>
                      <mesh
                        geometry={nodes.Mesh_42001_1?.geometry}
                        material={materials['PaletteMaterial001.031']}
                      />
                      <mesh
                        geometry={nodes.Mesh_42001_2?.geometry}
                        material={materials['Glass.005']}
                      />
                      <mesh
                        geometry={nodes.Mesh_42001_3?.geometry}
                        material={materials['PaletteMaterial001.032']}
                      />
                      <mesh
                        geometry={nodes.Mesh_42001_4?.geometry}
                        material={materials['PaletteMaterial003.010']}
                      />
                      <mesh
                        geometry={nodes.Mesh_42001_5?.geometry}
                        material={materials['PaletteMaterial004.008']}
                      />
                      <mesh
                        geometry={nodes.Mesh_42001_6?.geometry}
                        material={materials['PaletteMaterial005.009']}
                      />
                    </group>
                  </group>
                </group>
                <group position={[0, 0, 0.05]} scale={[1, 1, 0.128]}>
                  <group position={[0.001, -0.002, -0.002]} scale={0.506}>
                    <mesh
                      geometry={nodes.Mesh_43001?.geometry}
                      material={materials['PaletteMaterial002.015']}
                      position={[-5.999, -1, -3.995]}
                      scale={0.001}
                    />
                  </group>
                </group>
                <group position={[0, 0, 0.819]} scale={[1, 1, 0.834]}>
                  <group position={[0.001, -0.002, -0.002]} scale={0.506}>
                    <mesh
                      geometry={nodes.Mesh_43002?.geometry}
                      material={materials['PaletteMaterial002.015']}
                      position={[-5.999, -1, -3.995]}
                      scale={0.001}
                    />
                  </group>
                </group>
                <group position={[0, 0, 0.427]} scale={[1, 1, 0.474]}>
                  <group position={[0.001, -0.002, -0.002]} scale={0.506}>
                    <mesh
                      geometry={nodes.Mesh_43003?.geometry}
                      material={materials['PaletteMaterial002.015']}
                      position={[-5.999, -1, -3.995]}
                      scale={0.001}
                    />
                  </group>
                </group>
                <group position={[0, 0, 1]}>
                  <group position={[0.001, -0.002, -0.002]} scale={0.506}>
                    <mesh
                      geometry={nodes.Mesh_43004?.geometry}
                      material={materials['PaletteMaterial002.015']}
                      position={[-5.999, -1, -3.995]}
                      scale={0.001}
                    />
                  </group>
                </group>
              </group>
            </group>
          </AnimatedGroup>

          {/* MeBit Santa */}
          <AnimatedGroup
            name="MeBitSanta"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitSanta']}
          >
            <group position={[-5.999, -1.039, -4.064]} scale={0.001}>
              <mesh
                geometry={nodes.MeBitSanta002_1?.geometry}
                material={materials['default.001']}
              />
              <mesh
                geometry={nodes.MeBitSanta002_2?.geometry}
                material={materials['M_Bake.001']}
              />
              <mesh
                geometry={nodes.MeBitSanta002_3?.geometry}
                material={materials['Material.001']}
              />
            </group>
            <mesh
              geometry={nodes.MeBitSanta002?.geometry}
              material={materials['CH_NPC_Pig_MI_PJH.001']}
              position={[-5.196, 4.443, -3.22]}
              rotation={[0, 0, 1.63]}
              scale={0.005}
            />
            <mesh
              geometry={nodes.MeBitSanta003?.geometry}
              material={materials['CH_NPC_Pig_MI_PJH.001']}
              position={[-5.285, 4.443, -3.305]}
              rotation={[0, 0, 1.635]}
              scale={0.005}
            />
            <mesh
              geometry={nodes.MeBitSanta004?.geometry}
              material={materials['CH_NPC_Pig_MI_PJH.001']}
              position={[-5.285, 4.443, -3.22]}
              rotation={[0, 0, 1.635]}
              scale={0.005}
            />
            <mesh
              geometry={nodes.MeBitSanta005?.geometry}
              material={materials['CH_NPC_Pig_MI_PJH.001']}
              position={[-5.196, 4.443, -3.305]}
              rotation={[0, 0, 1.63]}
              scale={0.005}
            />
            <group
              position={[-4.44, 4.369, -4.53]}
              rotation={[-2.041, -1.559, -2.039]}
              scale={0}
            >
              <mesh
                geometry={nodes.Mesh_54001?.geometry}
                material={materials['MeditationSanta_Model_9_u1_v1.001']}
              />
              <mesh
                geometry={nodes.Mesh_54001_1?.geometry}
                material={materials['PaletteMaterial001.005']}
              />
              <mesh
                geometry={nodes.Mesh_54001_2?.geometry}
                material={materials['material_0.001']}
              />
              <mesh
                geometry={nodes.Mesh_54001_3?.geometry}
                material={materials['Material_0.001']}
              />
              <mesh
                geometry={nodes.Mesh_54001_4?.geometry}
                material={materials['PaletteMaterial001.017']}
              />
            </group>
          </AnimatedGroup>

          {/* LightUp Speakers */}
          <AnimatedGroup
            name="LightUpSpeakers"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['LightUpSpeakers']}
            indicatorPosition={INDICATOR_POSITIONS['LightUpSpeakers']}
          >
            <group
              position={[-3.372, -4.12, 6.032]}
              rotation={[Math.PI, -0.775, -Math.PI / 2]}
              scale={0.001}
            >
              <mesh
                geometry={nodes.Mesh_0001?.geometry}
                material={materials['PaletteMaterial001.002']}
              />
              <mesh
                geometry={nodes.Mesh_0001_1?.geometry}
                material={materials['blackInternal.001']}
              />
              <mesh
                geometry={nodes.Mesh_0001_2?.geometry}
                material={materials['frontColor.001']}
              />
              <mesh
                geometry={nodes.Mesh_0001_3?.geometry}
                material={materials['PaletteMaterial003.001']}
              />
              <mesh
                geometry={nodes.Mesh_0001_4?.geometry}
                material={materials['blackFabric.001']}
              />
              <mesh
                geometry={nodes.Mesh_0001_5?.geometry}
                material={materials['PaletteMaterial004.001']}
              />
              <mesh
                geometry={nodes.Mesh_0001_6?.geometry}
                material={materials['equalizer.001']}
              />
              <mesh
                geometry={nodes.Mesh_0001_7?.geometry}
                material={materials['Material.002']}
              />
            </group>
          </AnimatedGroup>

          {/* Bunny Ears Cactus */}
          <AnimatedGroup
            name="BunnyEarsCactus"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['BunnyEarsCactus']}
            indicatorPosition={INDICATOR_POSITIONS['BunnyEarsCactus']}
          >
            <group position={[-5.999, -1, -3.995]} scale={0.001}>
              <mesh
                geometry={nodes.Mesh_89005?.geometry}
                material={materials['lambert1.001']}
              />
              <mesh
                geometry={nodes.Mesh_89005_1?.geometry}
                material={materials['cactus_04_mat.001']}
              />
              <mesh
                geometry={nodes.Mesh_89005_2?.geometry}
                material={materials['cactus_04_spike_mat.001']}
              />
              <mesh
                geometry={nodes.Mesh_89005_3?.geometry}
                material={materials['cactus_ground_mat.001']}
              />
              <mesh
                geometry={nodes.Mesh_89005_4?.geometry}
                material={materials['cactus_stone_mat.001']}
              />
            </group>
          </AnimatedGroup>

          {/* Arcade */}
          <AnimatedGroup
            name="Arcade"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['Arcade']}
            indicatorPosition={INDICATOR_POSITIONS['Arcade']}
          >
            <group position={[-5.999, -1, -3.995]} scale={0.001}>
              <mesh
                geometry={nodes.Mesh_36001?.geometry}
                material={materials['PaletteMaterial003.003']}
              />
              <mesh
                geometry={nodes.Mesh_36001_1?.geometry}
                material={materials['GameBoy.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_2?.geometry}
                material={materials['bButton.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_3?.geometry}
                material={materials['TT_checker_1024x1024_UV_GRID.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_4?.geometry}
                material={materials['ARCADE.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_5?.geometry}
                material={materials['PaletteMaterial002.002']}
              />
              <mesh
                geometry={nodes.Mesh_36001_6?.geometry}
                material={materials['PaletteMaterial003.004']}
              />
              <mesh
                geometry={nodes.Mesh_36001_7?.geometry}
                material={materials['PaletteMaterial001.007']}
              />
              <mesh
                geometry={nodes.Mesh_36001_8?.geometry}
                material={materials['PaletteMaterial002.003']}
              />
              <mesh
                geometry={nodes.Mesh_36001_9?.geometry}
                material={materials['PaletteMaterial004.003']}
              />
              <mesh
                geometry={nodes.Mesh_36001_10?.geometry}
                material={materials['Stick.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_11?.geometry}
                material={materials['lowpoly.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_12?.geometry}
                material={materials['GamepadStuff.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_13?.geometry}
                material={materials['gamepadMain.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_14?.geometry}
                material={materials['PaletteMaterial005.002']}
              />
              <mesh
                geometry={nodes.Mesh_36001_15?.geometry}
                material={materials['TT_checker_1024x1024_UV_GRID.002']}
              />
              <mesh
                geometry={nodes.Mesh_36001_16?.geometry}
                material={materials['PaletteMaterial006.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_17?.geometry}
                material={materials['controllerbody.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_18?.geometry}
                material={materials['material.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_19?.geometry}
                material={materials['ANALOG.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_20?.geometry}
                material={materials['dpad.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_21?.geometry}
                material={materials['cstick.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_22?.geometry}
                material={materials['abutton.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_23?.geometry}
                material={materials['zbutton.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_24?.geometry}
                material={materials['bumpers.001']}
              />
              <mesh
                geometry={nodes.Mesh_36001_25?.geometry}
                material={materials['PaletteMaterial001.008']}
              />
            </group>
          </AnimatedGroup>

          {/* Room Floor */}
          <AnimatedGroup
            name="RoomFloor"
            analyser={analyser}
            frequencyIndices={groupNameToFrequencyIndices['RoomFloor']}
          >
            <mesh
              geometry={nodes.RoomFloor?.geometry}
              material={materials['Material.003']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* TV Monitor */}
          <AnimatedGroup
            name="TVMonitor"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['TVMonitor']}
            indicatorPosition={INDICATOR_POSITIONS['TVMonitor']}
          >
            <mesh
              geometry={nodes.TVMonitor?.geometry}
              material={materials['Material.004']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* Monitor Screen (Computer Monitor) */}
          <AnimatedGroup
            name="MonitorScreen"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MonitorScreen']}
            indicatorPosition={INDICATOR_POSITIONS['MonitorScreen']}
          >
            <mesh
              geometry={nodes.Computer_Monitor?.geometry}
              material={materials['Material.005']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* Kitchen Set */}
          <AnimatedGroup
            name="KitchenSet"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['KitchenSet']}
            indicatorPosition={INDICATOR_POSITIONS['KitchenSet']}
          >
            <mesh
              geometry={nodes.KitchenSet?.geometry}
              material={materials['PaletteMaterial001.009']}
              position={[-5.999, -0.966, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* Room Wall */}
          <AnimatedGroup
            name="RoomWall"
            analyser={analyser}
            frequencyIndices={groupNameToFrequencyIndices['RoomWall']}
          >
            <mesh
              geometry={nodes.RoomWall?.geometry}
              material={materials['Material.012']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* MeBit Cthulu */}
          <AnimatedGroup
            name="MeBitCthulu"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitCthulu']}
          >
            <mesh
              geometry={nodes.MeBitCthulu?.geometry}
              material={materials['PaletteMaterial001.015']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* MeBit Chandelier */}
          <AnimatedGroup
            name="MeBitChandelier"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitChandelier']}
          >
            <group
              position={[0.163, 6.558, 0.312]}
              rotation={[1.505, 0, -3.141]}
              scale={[2.208, 0.261, 2.212]}
            >
              <mesh
                geometry={nodes.Curve001?.geometry}
                material={materials['PaletteMaterial005.004']}
              />
              <mesh
                geometry={nodes.Curve001_1?.geometry}
                material={materials['constant1.002']}
              />
              <mesh
                geometry={nodes.Curve001_2?.geometry}
                material={materials['constant2.002']}
              />
              <mesh
                geometry={nodes.Curve001_3?.geometry}
                material={materials['HoloFillDark.002']}
              />
            </group>
            <mesh
              geometry={nodes.Middle_Chandelier?.geometry}
              material={materials['PaletteMaterial001.002']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* MeBit Helmet */}
          <AnimatedGroup
            name="MeBitHelmet"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitHelmet']}
          >
            <group position={[-5.089, 3.661, -3.47]} scale={0.325}>
              <mesh
                geometry={nodes.MeBitHelmet001?.geometry}
                material={materials['soft.001']}
              />
              <mesh
                geometry={nodes.MeBitHelmet001_1?.geometry}
                material={materials['base.001']}
              />
              <mesh
                geometry={nodes.MeBitHelmet001_2?.geometry}
                material={materials['PaletteMaterial005.004']}
              />
            </group>
          </AnimatedGroup>

          {/* MeBit Terrarium */}
          <AnimatedGroup
            name="MeBitTerranium"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitTerranium']}
          >
            <group
              position={[-3.385, 4.815, -3.536]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={0.172}
            >
              <mesh
                geometry={nodes.glas_low_glass_0002?.geometry}
                material={materials['glass.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_1?.geometry}
                material={materials['robot_2.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_2?.geometry}
                material={materials['robot_1.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_3?.geometry}
                material={materials['Cactus_spines_01.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_4?.geometry}
                material={materials['Carnegiea_bark_01.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_5?.geometry}
                material={materials['Carnegiea_bark_03.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_6?.geometry}
                material={materials['Carnegiea_petal_01.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_7?.geometry}
                material={materials['Carnegiea_petal_02.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_8?.geometry}
                material={materials['Carnegiea_petal_03.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_9?.geometry}
                material={materials['Carnegiea_sepal_01.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_10?.geometry}
                material={materials['Carnegiea_stigma.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_11?.geometry}
                material={materials['Carnegiea_flower_stalk.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_12?.geometry}
                material={materials['Carnegiea_stamens.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_13?.geometry}
                material={materials['SickPlantSteam_Mat.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_14?.geometry}
                material={materials['PaletteMaterial001.029']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_15?.geometry}
                material={materials['SickPlantFlower_Mat.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_16?.geometry}
                material={materials['SickPlantFlowerIside_Mat.001']}
              />
              <mesh
                geometry={nodes.glas_low_glass_0002_17?.geometry}
                material={materials['inside.001']}
              />
            </group>
          </AnimatedGroup>

          {/* MeBit Enderman */}
          <AnimatedGroup
            name="MeBitEnderman"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitEnderman']}
          >
            <group
              position={[-4.101, 0.458, -3.473]}
              rotation={[1.641, 0, 0]}
              scale={[0.093, 0.067, 0.093]}
            >
              <mesh
                geometry={nodes.Mesh_37003?.geometry}
                material={materials['Skin.001']}
              />
              <mesh
                geometry={nodes.Mesh_37003_1?.geometry}
                material={materials['PaletteMaterial001.003']}
              />
              <mesh
                geometry={nodes.Mesh_37003_2?.geometry}
                material={materials['Eyes.001']}
              />
            </group>
          </AnimatedGroup>

          {/* XBOX */}
          <AnimatedGroup
            name="XBOX"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['XBOX']}
            indicatorPosition={INDICATOR_POSITIONS['XBOX']}
          >
            <group
              position={[4.076, 2.23, -2.919]}
              scale={[0.22, 0.499, 0.499]}
            >
              <mesh
                geometry={nodes.Cube005?.geometry}
                material={materials['Material.014']}
              />
              <mesh
                geometry={nodes.Cube005_1?.geometry}
                material={materials['PaletteMaterial001.016']}
              />
            </group>
          </AnimatedGroup>

          {/* Couch */}
          <AnimatedGroup
            name="Couch"
            analyser={analyser}
            frequencyIndices={groupNameToFrequencyIndices['Couch']}
          >
            <mesh
              geometry={nodes.Couch?.geometry}
              material={materials['Material.018']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* Puzzle Shelf */}
          <AnimatedGroup
            name="PuzzleShelf"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['PuzzleShelf']}
            indicatorPosition={INDICATOR_POSITIONS['PuzzleShelf']}
          >
            <group
              position={[-5.584, 0.309, -1.968]}
              rotation={[-Math.PI / 2, 0, -1.565]}
              scale={[2.617, 2.955, 3.725]}
            >
              <mesh
                geometry={nodes.PuzzleShelf012?.geometry}
                material={materials['Sticker_SPC-SG.006']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_1?.geometry}
                material={materials['baked.006']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_2?.geometry}
                material={materials['RubixCube.006']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_3?.geometry}
                material={materials['PaletteMaterial001.034']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_4?.geometry}
                material={materials['PaletteMaterial002.017']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_5?.geometry}
                material={materials['Mtl2.006']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_6?.geometry}
                material={materials['material.012']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_7?.geometry}
                material={materials['Sticker_B-P']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_8?.geometry}
                material={materials['Sticker_Y-P']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_9?.geometry}
                material={materials['Sticker_O-P']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_10?.geometry}
                material={materials['Sticker_W-P']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_11?.geometry}
                material={materials['Sticker_R-P']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_12?.geometry}
                material={materials['Sticker_G-P']}
              />
              <mesh
                geometry={nodes.PuzzleShelf012_13?.geometry}
                material={materials.Base}
              />
            </group>
          </AnimatedGroup>

          {/* RoomDisplayOne */}
          <AnimatedGroup
            name="RoomDisplayOne"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['RoomDisplayOne']}
            indicatorPosition={INDICATOR_POSITIONS['RoomDisplayOne']}
          >
            <group position={[-5.999, -1, -3.995]} scale={0.001}>
              <mesh
                geometry={nodes.RoomDisplayOne003?.geometry}
                material={materials['PaletteMaterial001.018']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_1?.geometry}
                material={materials['lambert7SG.001']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_2?.geometry}
                material={materials['PaletteMaterial008.003']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_3?.geometry}
                material={materials['PaletteMaterial009.002']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_4?.geometry}
                material={materials['equalizer.002']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_5?.geometry}
                material={materials['blackInternal.002']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_6?.geometry}
                material={materials['blackFabric.002']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_7?.geometry}
                material={materials['PaletteMaterial010.002']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_8?.geometry}
                material={materials['PaletteMaterial007.003']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_9?.geometry}
                material={materials['frontColor.002']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne003_10?.geometry}
                material={materials['PaletteMaterial005.005']}
              />
            </group>
          </AnimatedGroup>

          {/* RoomDisplayTwo */}
          <AnimatedGroup
            name="RoomDisplayTwo"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['RoomDisplayTwo']}
            indicatorPosition={INDICATOR_POSITIONS['RoomDisplayTwo']}
          >
            <group position={[-5.999, -1, -3.995]} scale={0.001}>
              <mesh
                geometry={nodes.RoomDisplayOne004?.geometry}
                material={materials['blinn4SG.001']}
              />
              <mesh
                geometry={nodes.RoomDisplayOne004_1?.geometry}
                material={materials['PaletteMaterial004.006']}
              />
            </group>
          </AnimatedGroup>

          {/* Graphics */}
          <AnimatedGroup
            name="GraphicLeft"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['GraphicLeft']}
            indicatorPosition={INDICATOR_POSITIONS['GraphicLeft']}
          >
            <mesh
              geometry={nodes.Graphic_Left_Plants?.geometry}
              material={materials['Material.011']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          <AnimatedGroup
            name="GraphicMiddle"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['GraphicMiddle']}
            indicatorPosition={INDICATOR_POSITIONS['GraphicMiddle']}
          >
            <mesh
              geometry={nodes.Graphic_Middle_Cats?.geometry}
              material={materials['Material.011']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          <AnimatedGroup
            name="GraphicRight"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['GraphicRight']}
            indicatorPosition={INDICATOR_POSITIONS['GraphicRight']}
          >
            <mesh
              geometry={nodes.Graphic_Right_Puzzles?.geometry}
              material={materials['Material.011']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* Furniture */}
          <mesh
            geometry={nodes.TrackPad?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.TV_Stand?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Computer_Stand?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.TV_Frame?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Computer_Desk_Drawer?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Computer_Table?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Remote?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Cup?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.94, -1, -4.074]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Left_Chandelier?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Right_Chandelier?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Middle_Console?.geometry}
            material={materials['Material.006']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Fancy_Lights?.geometry}
            material={materials['PaletteMaterial006.003']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Chandelier_Lights?.geometry}
            material={materials['PaletteMaterial002.006']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Right_Blank_Frame?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.HEADPHONES?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Middle_Blank_Frsme?.geometry}
            material={materials['PaletteMaterial001.002']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />

          {/* PS5 */}
          <AnimatedGroup
            name="PS5"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['PS5']}
            indicatorPosition={INDICATOR_POSITIONS['PS5']}
          >
            <mesh
              geometry={nodes.PS5?.geometry}
              material={materials['PaletteMaterial001.016']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* Cable Box */}
          <AnimatedGroup
            name="CableBox"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['CableBox']}
            indicatorPosition={INDICATOR_POSITIONS['CableBox']}
          >
            <mesh
              geometry={nodes.Cable_Box?.geometry}
              material={materials['PaletteMaterial001.016']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* Shelf Keyboard */}
          <AnimatedGroup
            name="ShelfKeyboard"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['ShelfKeyboard']}
            indicatorPosition={INDICATOR_POSITIONS['ShelfKeyboard']}
          >
            <mesh
              geometry={nodes.Shelf_Keyboard?.geometry}
              material={materials['PaletteMaterial001.016']}
              position={[-5.999, -1, -3.995]}
              scale={0.001}
            />
          </AnimatedGroup>

          {/* Speakers */}
          <mesh
            geometry={nodes.Right_Speaker?.geometry}
            material={materials['PaletteMaterial001.016']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />
          <mesh
            geometry={nodes.Left_Speaker?.geometry}
            material={materials['PaletteMaterial001.016']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />

          {/* Mouse */}
          <mesh
            geometry={nodes.Mouse?.geometry}
            material={materials['PaletteMaterial001.016']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />

          {/* Main Keyboard */}
          <mesh
            geometry={nodes.Main_Keyboard?.geometry}
            material={materials['PaletteMaterial001.016']}
            position={[-5.999, -1, -3.995]}
            scale={0.001}
          />

          {/* MeBit Car */}
          <AnimatedGroup
            name="MeBitCar"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitCar']}
          >
            <group position={[-5.999, -1, -3.995]} scale={0.001}>
              <mesh
                geometry={nodes.Mesh_39002?.geometry}
                material={materials['PaletteMaterial001.010']}
              />
              <mesh
                geometry={nodes.Mesh_39002_1?.geometry}
                material={materials['forMayaAOrear_lights.001']}
              />
              <mesh
                geometry={nodes.Mesh_39002_2?.geometry}
                material={materials['forMayaAOnumber.001']}
              />
              <mesh
                geometry={nodes.Mesh_39002_3?.geometry}
                material={materials['forMayaAOlambert15.001']}
              />
              <mesh
                geometry={nodes.Mesh_39002_4?.geometry}
                material={materials['forMayaAOlambert16.001']}
              />
              <mesh
                geometry={nodes.Mesh_39002_5?.geometry}
                material={materials['forMayaAOblinn6.001']}
              />
              <mesh
                geometry={nodes.Mesh_39002_6?.geometry}
                material={materials['PaletteMaterial002.004']}
              />
              <mesh
                geometry={nodes.Mesh_39002_7?.geometry}
                material={materials['forMayaAOGrill2.001']}
              />
              <mesh
                geometry={nodes.Mesh_39002_8?.geometry}
                material={materials['Chrome_2.001']}
              />
              <mesh
                geometry={nodes.Mesh_39002_9?.geometry}
                material={materials['PaletteMaterial003.005']}
              />
              <mesh
                geometry={nodes.Mesh_39002_10?.geometry}
                material={materials['material.002']}
              />
            </group>
          </AnimatedGroup>

          {/* MeBit Plant */}
          <AnimatedGroup
            name="MeBitPlant"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitPlant']}
          >
            <group
              position={[-1.018, 1.437, -2.908]}
              rotation={[-1.477, 1.571, 0]}
              scale={[0.352, 0.352, 0.896]}
            >
              <mesh
                geometry={nodes.armHoles_LP_UV_checker_0002?.geometry}
                material={materials['PaletteMaterial001.013']}
              />
              <mesh
                geometry={nodes.armHoles_LP_UV_checker_0002_1?.geometry}
                material={materials['UV_checker.001']}
              />
            </group>
          </AnimatedGroup>

          {/* MeBit Boat */}
          <AnimatedGroup
            name="MeBitBoat"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitBoat']}
          >
            <group position={[-5.999, -1, -3.995]} scale={0.001}>
              <mesh
                geometry={nodes.Mesh_89006?.geometry}
                material={materials['Material.008']}
              />
              <mesh
                geometry={nodes.Mesh_89006_1?.geometry}
                material={materials['SVGMat.001']}
              />
              <mesh
                geometry={nodes.Mesh_89006_2?.geometry}
                material={materials['Material.009']}
              />
              <mesh
                geometry={nodes.Mesh_89006_3?.geometry}
                material={materials['Material.010']}
              />
              <mesh
                geometry={nodes.Mesh_89006_4?.geometry}
                material={materials['PaletteMaterial001.014']}
              />
            </group>
          </AnimatedGroup>

          {/* MeBit Balloon */}
          <AnimatedGroup
            name="MeBitBalloon"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeBitBalloon']}
          >
            <group position={[-5.999, -1, -3.995]} scale={0.001}>
              <mesh
                geometry={nodes.Mesh_36017?.geometry}
                material={materials['baloon.001']}
              />
              <mesh
                geometry={nodes.Mesh_36017_1?.geometry}
                material={materials['baloon.002']}
              />
              <mesh
                geometry={nodes.Mesh_36017_2?.geometry}
                material={materials['PaletteMaterial001.003']}
              />
            </group>
          </AnimatedGroup>

          {/* MeSubBit (Submarine) */}
          <AnimatedGroup
            name="MeSubBit"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            onMeBitFound={onMeBitFound}
            analyser={analyser}
            isPlaying={isPlaying}
            frequencyIndices={groupNameToFrequencyIndices['MeSubBit']}
          >
            <group position={[-5.999, -1, -3.995]} scale={0.001}>
              <mesh
                geometry={nodes.Mesh_44002?.geometry}
                material={materials['Glass.002']}
              />
              <mesh
                geometry={nodes.Mesh_44002_1?.geometry}
                material={materials['Material.007']}
              />
              <mesh
                geometry={nodes.Mesh_44002_2?.geometry}
                material={materials['PaletteMaterial001.003']}
              />
            </group>
          </AnimatedGroup>

          {/* Additional mesh groups */}
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh
              geometry={nodes.Mesh_36058?.geometry}
              material={materials['PaletteMaterial001.002']}
            />
            <mesh
              geometry={nodes.Mesh_36058_1?.geometry}
              material={materials['PaletteMaterial008.002']}
            />
          </group>
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh
              geometry={nodes.Mesh_36351?.geometry}
              material={materials['PaletteMaterial001.002']}
            />
            <mesh
              geometry={nodes.Mesh_36351_1?.geometry}
              material={materials['PaletteMaterial002.006']}
            />
            <mesh
              geometry={nodes.Mesh_36351_2?.geometry}
              material={materials['PaletteMaterial006.003']}
            />
            <mesh
              geometry={nodes.Mesh_36351_3?.geometry}
              material={materials['PaletteMaterial007.002']}
            />
          </group>
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh
              geometry={nodes.Mesh_36389?.geometry}
              material={materials['PaletteMaterial001.002']}
            />
            <mesh
              geometry={nodes.Mesh_36389_1?.geometry}
              material={materials['Material.011']}
            />
          </group>
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh
              geometry={nodes.Mesh_36439?.geometry}
              material={materials['PaletteMaterial001.002']}
            />
            <mesh
              geometry={nodes.Mesh_36439_1?.geometry}
              material={materials['Material.011']}
            />
          </group>
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh
              geometry={nodes.Mesh_36456?.geometry}
              material={materials['PaletteMaterial001.002']}
            />
            <mesh
              geometry={nodes.Mesh_36456_1?.geometry}
              material={materials['Material.011']}
            />
          </group>
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh
              geometry={nodes.Mesh_36700?.geometry}
              material={materials['PaletteMaterial001.002']}
            />
            <mesh
              geometry={nodes.Mesh_36700_1?.geometry}
              material={materials['Material.006']}
            />
          </group>
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh
              geometry={nodes.Mesh_36668?.geometry}
              material={materials['PaletteMaterial001.016']}
            />
            <mesh
              geometry={nodes.Mesh_36668_1?.geometry}
              material={materials['PaletteMaterial001.018']}
            />
          </group>
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh
              geometry={nodes.Mesh_36021?.geometry}
              material={materials['PaletteMaterial001.003']}
            />
            <mesh
              geometry={nodes.Mesh_36021_1?.geometry}
              material={materials['Tassels.001']}
            />
            <mesh
              geometry={nodes.Mesh_36021_2?.geometry}
              material={materials['PaletteMaterial001.011']}
            />
            <mesh
              geometry={nodes.Mesh_36021_3?.geometry}
              material={materials['PaletteMaterial001.005']}
            />
            <mesh
              geometry={nodes.Mesh_36021_4?.geometry}
              material={materials['Carpet.001']}
            />
          </group>
        </group>
      </group>
    </AudioStateContext.Provider>
  );
}

// Preload the model - wrapped in effect-like check to avoid SSR issues
// Note: This is safe because 'use client' directive ensures this file runs on client
(() => {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    useGLTF.preload(MODEL_URL);
  }
})();
