'use client';

import { Html, useAnimations, useCursor, useGLTF } from '@react-three/drei';
import { GroupProps, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ActionName, GLTFActions, GLTFResult } from './RachosRoomTypes';
import {
  closetGroups,
  goldGroups,
  meBitsGroups,
  redGroups,
  whiteGroups,
} from './groupConstants';
import { GroupData } from './groupData';

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
    number
  ];
};

const normalizeVec3 = (values: [number, number, number]) => {
  const length = Math.hypot(values[0], values[1], values[2]);
  if (!length) return [1, 0, 0] as [number, number, number];
  return [values[0] / length, values[1] / length, values[2] / length] as [
    number,
    number,
    number
  ];
};

const averageRange = (data: Float32Array, start: number, end: number) => {
  const safeEnd = Math.max(start + 1, end);
  let sum = 0;
  for (let i = start; i < safeEnd; i++) sum += data[i] ?? 0;
  return sum / (safeEnd - start);
};

// Easing functions for smoother animations
const easeOutElastic = (x: number): number => {
  const c4 = (2 * Math.PI) / 3;
  return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
};

const easeInOutCubic = (x: number): number => {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

// Indicator Component - Enhanced with better hover effects
const Indicator: React.FC<{
  isSelected: boolean;
  hovered: boolean;
  onSelect: () => void;
  gradient: string;
}> = ({ isSelected, hovered, onSelect, gradient }) => {
  // Extract primary color from gradient
  const primaryColor = gradient.includes('#4de1ff') ? '#4de1ff' 
    : gradient.includes('gold') ? '#ffd700'
    : gradient.includes('red') ? '#ff6b6b'
    : gradient.includes('white') ? '#ffffff'
    : '#4de1ff';

  return (
    <motion.div
      className="absolute flex items-center justify-center cursor-pointer"
      onClick={onSelect}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute w-10 h-10 rounded-full"
        animate={{
          scale: isSelected ? [1, 1.3, 1] : hovered ? [1, 1.2, 1] : [1, 1.15, 1],
          opacity: isSelected ? [0.6, 0.2, 0.6] : hovered ? [0.5, 0.15, 0.5] : [0.3, 0.1, 0.3],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ 
          background: `radial-gradient(circle, ${primaryColor}60, transparent 70%)`,
          filter: 'blur(4px)',
        }}
      />
      
      {/* Middle ring */}
      <motion.div
        className="absolute w-8 h-8 rounded-full border-2"
        animate={{
          scale: [1, 1.08, 1],
          opacity: isSelected ? 1 : hovered ? 0.9 : 0.6,
          borderColor: primaryColor,
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          boxShadow: `0 0 12px ${primaryColor}50`,
        }}
      />
      
      {/* Inner diamond */}
      <motion.div
        className="relative w-5 h-5 rounded-md rotate-45"
        animate={{
          scale: isSelected ? [1, 1.1, 1] : hovered ? [1, 1.05, 1] : 1,
          rotate: isSelected ? [45, 50, 45] : 45,
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ 
          background: isSelected 
            ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa)`
            : hovered 
            ? `linear-gradient(135deg, ${primaryColor}dd, ${primaryColor}88)`
            : `linear-gradient(135deg, ${primaryColor}aa, ${primaryColor}66)`,
          border: `2px solid ${primaryColor}`,
          boxShadow: `0 0 16px ${primaryColor}60, inset 0 0 8px ${primaryColor}30`,
        }}
      />
      
      {/* Center dot */}
      <motion.div
        className="absolute w-2 h-2 rounded-full"
        animate={{
          scale: [1, 1.3, 1],
          opacity: isSelected ? [1, 0.7, 1] : hovered ? [0.9, 0.6, 0.9] : [0.7, 0.4, 0.7],
        }}
        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        style={{ 
          background: primaryColor,
          boxShadow: `0 0 8px ${primaryColor}`,
        }}
      />
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
    { material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial; base: number }[]
  >([]);

  const effect = useMemo(() => {
    const id = name ?? 'group';
    const rand = mulberry32(hashString(id));
    const isMeBit = meBitsGroups.includes(id);
    const isGold = goldGroups.includes(id);
    const isRed = redGroups.includes(id);
    const isWhite = whiteGroups.includes(id);
    const isCloset = closetGroups.includes(id);
    
    // Closet item index for unique per-item effects
    const closetIndex = closetGroups.indexOf(id);
    const closetCount = closetGroups.length;
    
    // Enhanced intensity values - closet items get unique intensities
    const closetIntensityMap: Record<string, number> = {
      'ShelfKeyboard': 1.6,
      'KeyboardMouse': 1.5,
      'HeadsetStand': 1.7,
      'GameZone': 1.3,
      'XBOX': 1.8,
      'PS5': 1.9,
      'DVDPlayer': 1.5,
      'CableBox': 1.4,
    };
    
    const intensity = isMeBit
      ? 1.35
      : isGold
      ? 1.1
      : isRed
      ? 1.0
      : isCloset
      ? (closetIntensityMap[id] || 1.5)
      : isWhite
      ? 0.85
      : 0.4; // Reduced for non-interactive items

    // Closet items get distributed across frequency bands for visual wave effect
    const closetBandMap: Record<string, 'low' | 'mid' | 'high'> = {
      'ShelfKeyboard': 'mid',
      'KeyboardMouse': 'high',
      'HeadsetStand': 'low',
      'GameZone': 'mid',
      'XBOX': 'high',
      'PS5': 'low',
      'DVDPlayer': 'mid',
      'CableBox': 'high',
    };

    const band: 'low' | 'mid' | 'high' = isMeBit
      ? 'mid'
      : isGold
      ? 'low'
      : isRed
      ? 'high'
      : isCloset
      ? (closetBandMap[id] || 'mid')
      : isWhite
      ? 'mid'
      : rand() < 0.34
      ? 'low'
      : rand() < 0.67
      ? 'mid'
      : 'high';

    // Unique phase offsets for closet items create wave-like dancing
    const closetPhaseOffset = isCloset ? (closetIndex / closetCount) * Math.PI * 2 : 0;
    
    // Enhanced scale axis - closet items bounce more on Y
    const scaleAxis = normalizeAxisWeights([
      isCloset ? 0.2 + rand() * 0.3 : 0.4 + rand() * 0.6,
      isCloset ? 0.8 + rand() * 0.2 : 0.5 + rand() * 0.5,  // Strong Y bounce for closet
      isCloset ? 0.2 + rand() * 0.3 : 0.3 + rand() * 0.7,
    ]);
    
    // Position axis - closet items move up/down rhythmically
    const positionAxis = normalizeVec3([
      isCloset ? (rand() - 0.5) * 0.3 : (rand() - 0.5) * 0.6,
      isCloset ? 1.5 : 1,  // Strong vertical movement for closet
      isCloset ? (rand() - 0.5) * 0.3 : (rand() - 0.5) * 0.6,
    ]);

    // Enhanced animation parameters for closet
    const scale = isCloset 
      ? (0.08 + rand() * 0.12) * intensity 
      : (0.04 + rand() * 0.08) * intensity;
    
    const rotation = isCloset
      ? [
          (0.06 + rand() * 0.1) * intensity,
          (0.15 + rand() * 0.2) * intensity,  // More Y rotation
          (0.04 + rand() * 0.08) * intensity,
        ] as [number, number, number]
      : [
          (0.1 + rand() * 0.25) * intensity,
          (0.12 + rand() * 0.22) * intensity,
          (0.08 + rand() * 0.16) * intensity,
        ] as [number, number, number];
    
    const bob = isCloset ? (0.06 + rand() * 0.1) * intensity : (0.03 + rand() * 0.07) * intensity;
    const micro = (0.01 + rand() * 0.03) * intensity;
    const sway = isCloset ? (0.04 + rand() * 0.08) * intensity : (0.025 + rand() * 0.06) * intensity;
    const twist = isCloset ? (0.03 + rand() * 0.06) * intensity : (0.02 + rand() * 0.05) * intensity;
    const drift = isCloset ? (0.04 + rand() * 0.08) * intensity : (0.012 + rand() * 0.03) * intensity;
    const speed = isCloset ? (1.5 + rand() * 1.5) : ((isGold || isMeBit) ? 0.7 : 0.5) + rand() * 2.0;
    const flutter = isCloset ? (3.0 + rand() * 3.0) : 2.0 + rand() * 3.5;
    const pulse = 0.7 + rand() * 0.5;
    const phase = rand() * Math.PI * 2 + closetPhaseOffset;
    
    // Enhanced energy and beat response for closet
    const energyBoost = isMeBit
      ? 0.55
      : isGold
      ? 0.45
      : isRed
      ? 0.4
      : isCloset
      ? 0.7  // High energy response for closet
      : isWhite
      ? 0.35
      : 0.2;
    
    const beatBoost = isCloset ? 1.4 : isMeBit ? 1.1 : isGold ? 0.85 : 0.7;
    const beatScale = isCloset 
      ? (0.25 + rand() * 0.35) * intensity 
      : (0.15 + rand() * 0.25) * intensity;
    const beatRotate = isCloset 
      ? (0.15 + rand() * 0.2) * intensity 
      : (0.1 + rand() * 0.15) * intensity;
    
    // Glow for interactive groups
    const glow = isMeBit || isGold || isRed || isCloset || isWhite;
    const glowIntensity = isCloset 
      ? (1.4 + rand() * 0.6) 
      : (isMeBit ? 1.6 : isGold ? 1.3 : isRed ? 1.0 : 0.7) * (0.8 + rand() * 0.5);
    
    // Unique glow colors for closet items
    const closetGlowColors: Record<string, string> = {
      'ShelfKeyboard': '#67f5ff',
      'KeyboardMouse': '#00ffc8',
      'HeadsetStand': '#7df9ff',
      'GameZone': '#4de1ff',
      'XBOX': '#00ff88',
      'PS5': '#00aaff',
      'DVDPlayer': '#66ffcc',
      'CableBox': '#88ffee',
    };
    
    // Gold items use WHITE glimmer instead of gold tint to preserve mesh aesthetics
    const glowColor = isGold
      ? new THREE.Color('#ffffff')  // Pure white glimmer - preserves original mesh colors
      : isRed
      ? new THREE.Color('#ff5a5f')
      : isMeBit
      ? new THREE.Color('#67f5ff')
      : isCloset
      ? new THREE.Color(closetGlowColors[id] || '#4de1ff')
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
      isCloset,
      closetIndex,
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

    const base = baseTransform.current;
    
    // When not playing, smoothly return to base position with no animation
    if (!isPlaying) {
      const dampSpeed = 4;
      
      // Return to base scale
      groupRef.current.scale.x = THREE.MathUtils.damp(groupRef.current.scale.x, base.scale.x, dampSpeed, delta);
      groupRef.current.scale.y = THREE.MathUtils.damp(groupRef.current.scale.y, base.scale.y, dampSpeed, delta);
      groupRef.current.scale.z = THREE.MathUtils.damp(groupRef.current.scale.z, base.scale.z, dampSpeed, delta);
      
      // Return to base rotation
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, base.rotation.x, dampSpeed, delta);
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, base.rotation.y, dampSpeed, delta);
      groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, base.rotation.z, dampSpeed, delta);
      
      // Return to base position
      groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, base.position.x, dampSpeed, delta);
      groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, base.position.y, dampSpeed, delta);
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, base.position.z, dampSpeed, delta);
      
      // Fade out glow when not playing
      if (effect.glow && glowMaterials.current.length) {
        glowMaterials.current.forEach(({ material, base: baseGlow }) => {
          material.emissiveIntensity = THREE.MathUtils.damp(
            material.emissiveIntensity,
            baseGlow * 0.2,
            dampSpeed,
            delta
          );
        });
      }
      return;
    }

    // PHYSICS-SAFE FFT Animation - No clipping through walls/floor
    // Primary effect is GLOW, with very subtle geometry changes
    const audio = audioStateRef.current;
    const indices = frequencyIndices?.length ? frequencyIndices : [];
    
    // Get FFT bin amplitude
    let binAmp = 0;
    if (indices.length) {
      for (let i = 0; i < indices.length; i++) {
        binAmp += audio.smooth[indices[i]] ?? 0;
      }
      binAmp /= indices.length;
    } else {
      binAmp = audio.bands.energy;
    }

    // Get band amplitudes
    const bandAmp = audio.bands[effect.band];
    const energy = audio.bands.energy;
    const beat = audio.beat;
    const low = audio.bands.low;
    const mid = audio.bands.mid;
    const high = audio.bands.high;
    
    // FFT drive calculation
    const sensitivityBoost = 2.5;
    const rawDrive = clamp01((binAmp * 0.7 + bandAmp * 0.5 + energy * 0.3) * effect.intensity * sensitivityBoost);
    const phaseMultiplier = 0.85 + 0.3 * Math.sin(effect.phase);
    const drive = rawDrive * phaseMultiplier;
    const beatImpulse = beat * effect.beatBoost * 1.8;
    const motion = clamp01(drive * 2.0 + beatImpulse);
    
    // Fast damping for responsive tracking
    const dampSpeed = 15;
    
    // ============================================
    // NO SCALE CHANGES - Prevents wall/floor clipping
    // Objects maintain their original size
    // ============================================
    groupRef.current.scale.x = THREE.MathUtils.damp(groupRef.current.scale.x, base.scale.x, dampSpeed, delta);
    groupRef.current.scale.y = THREE.MathUtils.damp(groupRef.current.scale.y, base.scale.y, dampSpeed, delta);
    groupRef.current.scale.z = THREE.MathUtils.damp(groupRef.current.scale.z, base.scale.z, dampSpeed, delta);

    // ============================================
    // VERY MINIMAL ROTATION - Tiny wobble only
    // Max 2 degrees (0.035 rad) to prevent any clipping
    // ============================================
    const maxRotation = 0.035; // ~2 degrees max
    const rotResponse = clamp01(motion) * maxRotation;
    
    // Only Y-axis rotation (spin) - safest, won't clip floor/walls
    const targetRotY = base.rotation.y + rotResponse * effect.rotation[1];
    
    // Keep X and Z at base (no tilt that could clip floor/ceiling)
    groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, base.rotation.x, dampSpeed, delta);
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotY, dampSpeed, delta);
    groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, base.rotation.z, dampSpeed, delta);

    // ============================================
    // NO POSITION MOVEMENT - Stay exactly in place
    // ============================================
    groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, base.position.x, dampSpeed, delta);
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, base.position.y, dampSpeed, delta);
    groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, base.position.z, dampSpeed, delta);

    // ============================================
    // PRIMARY FFT EFFECT: GLOW/SHIMMER
    // This is the main visual feedback - safe, no geometry changes
    // ============================================
    if (effect.glow && glowMaterials.current.length) {
      // Dramatic glow pulsing with the music
      const glowPulse = motion * 2.5 + beatImpulse * 1.5; // Boosted glow
      const targetGlow = glowPulse * effect.glowIntensity;
      glowMaterials.current.forEach(({ material, base: baseGlow }) => {
        material.emissiveIntensity = THREE.MathUtils.damp(
          material.emissiveIntensity,
          baseGlow + targetGlow,
          20, // Very fast glow response
          delta
        );
      });
    }
  });

  const [hovered, setHovered] = useState<boolean>(false);
  useCursor(hovered, 'pointer');

  // Get group data for this group if groups are provided
  const groupDataIndex = groups?.findIndex((group) => group.name === name) ?? -1;

  const groupData = groups && groupDataIndex >= 0 ? groups[groupDataIndex] : null;

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
  }, [groupRef.current, groupData, setGroups, groupDataIndex]);

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
      {!isPlaying && enableHover && (
        <group position={indicatorPosition || [0, 0, 0]}>
          <Html>
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
  analyser?: THREE.AudioAnalyser | null;
  onInspect: (modelName: string | null) => void;
  groups: GroupData[];
  setGroups: React.Dispatch<React.SetStateAction<GroupData[]>>;
  onMeBitFound: (name: string) => void;
  isPlaying: boolean;
} & GroupProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Load GLTF model
  const gltf = useGLTF(
    'https://racho-devs.s3.us-east-2.amazonaws.com/roomV2/desktop/RachosRoomDesktop.glb'
  ) as unknown as GLTFResult;
  const { nodes, materials, animations } = gltf;

  // Setup animations - but DO NOT play them!
  // All movement is controlled EXCLUSIVELY by FFT
  const { actions } = useAnimations(animations, groupRef);
  const typedActions = actions as GLTFActions;

  useEffect(() => {
    // STOP ALL EMBEDDED ANIMATIONS - FFT is the ONLY source of movement
    Object.values(typedActions).forEach((action) => {
      if (action) {
        action.stop();
        action.reset();
      }
    });

    // Clean up on unmount
    return () => {
      Object.values(typedActions).forEach((action) => {
        if (action) action.stop();
      });
    };
  }, [typedActions]);

  // Animated group names
  const animatedGroupNames = [
    'RoomLights',
    'WallSpeakers',
    'MeBitSanta',
    'SpeakersLights',
    'CouchA',
    'LightUpSpeakers',
    'MeBitRobot',
    'MeBitEnderman',
    'MeBitFatty',
    'CouchB',
    'MeBitCar',
    'MeBitUFO',
    'MeBitPlant',
    'MeBitBoat',
    'MeBitCthulu',
    'Armature009',
    'BunnyEarsCactus',
    'PuzzleShelf',
    'Arcade',
    'RoomFloor',
    'TVMonitor',
    'MonitorScreen',
    'KitchenSet',
    'TopShelf',
    'MeBitBalloon',
    'MeSubBit',
    'GraphicRight',
    'GraphicMiddle',
    'GraphicLeft',
    'HangingLightRight',
    'RoomWall',
    'HangingLightLeft',
    'TableCup',
    'TableRemote',
    'ComputerDesk',
    'TvMonitorFrame',
    'MonitorStand',
    'TV_Stand',
    'GraphicLeftFrame',
    'GraphicMiddleFrame',
    'HeadsetStand',
    'GraphicRightFrame',
    'MiddleTable',
    'Computer',
    'WallLights',
    'KeyboardMouse',
    'MeBitChandelier',
    'HangingLightMiddle',
    'MeBitHelmet',
    'GameZone',
    'XBOX',
    'PS5',
    'DVDPlayer',
    'CableBox',
    'ShelfKeyboard',
    'RoomDisplayOne',
    'RoomDisplayTwo',
    'MeBitTerranium',
    // NOTE: TopShelf removed - no FFT animation for Display Shelf
  ];

  const fftBins = analyser?.analyser?.frequencyBinCount ?? 128;

  const groupNameToFrequencyIndices = useMemo(() => {
    const lowEnd = Math.max(2, Math.floor(fftBins * 0.18));
    const midEnd = Math.max(lowEnd + 2, Math.floor(fftBins * 0.58));

    const pickBand = (groupName: string, roll: number): 'low' | 'mid' | 'high' => {
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

    return animatedGroupNames.reduce((acc, groupName) => {
      const seed = hashString(groupName);
      const rand = mulberry32(seed);
      const band = pickBand(groupName, rand());
      const [start, end] = bandRanges[band];
      const range = Math.max(1, end - start);
      const binCount = meBitsGroups.includes(groupName)
        ? 3
        : goldGroups.includes(groupName) || redGroups.includes(groupName) || closetGroups.includes(groupName)
        ? 2
        : 1 + Math.floor(rand() * 2);

      const bins = new Set<number>();
      while (bins.size < binCount) {
        bins.add(start + Math.floor(rand() * range));
      }

      acc[groupName] = Array.from(bins);
      return acc;
    }, {} as Record<string, number[]>);
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
        <group ref={groupRef} name="FinalMainScene">
        <group
          name="Mesh_39003"
          position={[-5.999, -1, -3.995]}
          scale={0.001}
        />

        <AnimatedGroup
          name="LightUpSpeakers"
          groups={groups}
          setGroups={setGroups}
          onInspect={onInspect}
          analyser={analyser}
          isPlaying={isPlaying}
          indicatorPosition={[-5, 2, 5.5]} 
          frequencyIndices={groupNameToFrequencyIndices['LightUpSpeakers']}
        >

          <group name="Speakers007" position={[-4.571, -1.1, 6.787]} rotation={[Math.PI, -0.775, Math.PI]} scale={0.231} > <group name="Circle003_13010" position={[0.991, 0.599, 0]} rotation={[0, 0, Math.PI / 2]} /> <group name="Circle005_16010" position={[0.992, 2, -4.398]} rotation={[0, 0, Math.PI / 2]} /> <group name="Circle007_18010" position={[0.992, 0.598, -4.398]} rotation={[0, 0, Math.PI / 2]} /> <group name="Circle009_4010" position={[0.891, 0.305, -2.9]} rotation={[0, 0, Math.PI / 2]} scale={0.822} /> <group name="Circle011_1010" position={[0.892, 0.304, -1.5]} rotation={[0, 0, Math.PI / 2]} scale={0.822} /> <group name="Circle013_7010" position={[0.891, 1.359, -2.199]} rotation={[0, 0, Math.PI / 2]} scale={0.822} /> <group name="Speakers008" position={[0.991, 1.999, 0]} rotation={[0, 0, Math.PI / 2]} > <group name="Speakers009" position={[1.639, 1.633, -2.21]} scale={3.628} > <group name="Mesh_0003" position={[-5.999, -1, -3.995]} scale={0.001} > <mesh name="Mesh_0002" geometry={nodes.Mesh_0002.geometry} material={materials['PaletteMaterial001.100']} /> <mesh name="Mesh_0002_1" geometry={nodes.Mesh_0002_1.geometry} material={materials['blackInternal.011']} /> <mesh name="Mesh_0002_2" geometry={nodes.Mesh_0002_2.geometry} material={materials['frontColor.010']} /> <mesh name="Mesh_0002_3" geometry={nodes.Mesh_0002_3.geometry} material={materials['PaletteMaterial003.037']} /> <mesh name="Mesh_0002_4" geometry={nodes.Mesh_0002_4.geometry} material={materials['blackFabric.011']} /> <mesh name="Mesh_0002_5" geometry={nodes.Mesh_0002_5.geometry} material={materials['PaletteMaterial004.030']} /> </group> </group> </group> </group>
    
           </AnimatedGroup> 
           <AnimatedGroup
            name="SpeakersLights"
            groups={groups}
            setGroups={setGroups}
            onInspect={onInspect}
            analyser={analyser}
            frequencyIndices={groupNameToFrequencyIndices['SpeakersLights']}
            
          >
   <group name="equalizer_35010"> <group name="baseCover001_0010" position={[0, 1.797, 0]} rotation={[-Math.PI, -0.122, 0]} scale={[1.023, 1.804, 1.023]} > <group name="Object_5008" position={[0, -0.144, 0]} scale={1.144}> <mesh name="Mesh_1003" geometry={nodes.Mesh_1003.geometry} material={materials['PaletteMaterial003.037']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator10_3010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.321, 1]} > <group name="Object_11015" position={[0.869, -0.999, 0.464]}> <mesh name="Mesh_2003" geometry={nodes.Mesh_2003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator11_4010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.542, 1]} > <group name="Object_13010" position={[0.761, -0.999, 0.625]}> <mesh name="Mesh_3003" geometry={nodes.Mesh_3003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator12_5010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.125, 1]} > <group name="Object_15013" position={[0.625, -0.999, 0.762]}> <mesh name="Mesh_4003" geometry={nodes.Mesh_4003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator13_6010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.791, 1]} > <group name="Object_17012" position={[0.464, -0.999, 0.869]}> <mesh name="Mesh_5003" geometry={nodes.Mesh_5003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator14_7010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.436, 1]} > <group name="Object_19008" position={[0.286, -0.999, 0.943]}> <mesh name="Mesh_6003" geometry={nodes.Mesh_6003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator15_8010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.197, 1]} > <group name="Object_21008" position={[0.096, -0.999, 0.98]}> <mesh name="Mesh_7003" geometry={nodes.Mesh_7003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator16_9010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.412, 1]} > <group name="Object_23008" position={[-0.097, -0.999, 0.98]}> <mesh name="Mesh_8003" geometry={nodes.Mesh_8003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator17_10010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.351, 1]} > <group name="Object_25008" position={[-0.286, -0.999, 0.943]}> <mesh name="Mesh_9003" geometry={nodes.Mesh_9003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator18_11010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.619, 1]} > <group name="Object_27008" position={[-0.625, -0.999, 0.762]}> <mesh name="Mesh_10003" geometry={nodes.Mesh_10003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator19_12010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.953, 1]} > <group name="Object_29008" position={[-0.762, -0.999, 0.625]}> <mesh name="Mesh_11003" geometry={nodes.Mesh_11003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator1_2010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.291, 1]} > <group name="Object_9006" position={[0.286, -0.999, -0.943]}> <mesh name="Mesh_12003" geometry={nodes.Mesh_12003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator20_14010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.551, 1]} > <group name="Object_33008" position={[-0.869, -0.999, 0.464]}> <mesh name="Mesh_13003" geometry={nodes.Mesh_13003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator21_15010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.544, 1]} > <group name="Object_35005" position={[-0.943, -0.999, 0.286]}> <mesh name="Mesh_14003" geometry={nodes.Mesh_14003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator22_16010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.713, 1]} > <group name="Object_37006" position={[-0.981, -0.999, 0.096]}> <mesh name="Mesh_15003" geometry={nodes.Mesh_15003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator23_17010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.856, 1]} > <group name="Object_39008" position={[-0.981, -0.999, -0.097]}> <mesh name="Mesh_16003" geometry={nodes.Mesh_16003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator24_18010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.202, 1]} > <group name="Object_41005" position={[-0.943, -0.999, -0.286]}> <mesh name="Mesh_17004" geometry={nodes.Mesh_17004.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator25_19010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.129, 1]} > <group name="Object_43005" position={[-0.869, -0.999, -0.464]}> <mesh name="Mesh_18003" geometry={nodes.Mesh_18003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator26_20010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.826, 1]} > <group name="Object_45005" position={[-0.762, -0.999, -0.625]}> <mesh name="Mesh_19003" geometry={nodes.Mesh_19003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator27_21010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.374, 1]} > <group name="Object_47005" position={[-0.625, -0.999, -0.762]}> <mesh name="Mesh_20003" geometry={nodes.Mesh_20003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator28_22010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.847, 1]} > <group name="Object_49005" position={[-0.465, -0.999, -0.869]}> <mesh name="Mesh_21003" geometry={nodes.Mesh_21003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator29_23010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.037, 1]} > <group name="Object_51005" position={[-0.286, -0.999, -0.943]}> <mesh name="Mesh_22003" geometry={nodes.Mesh_22003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator2_13010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.453, 1]} > <group name="Object_31008" position={[0.464, -0.999, -0.869]}> <mesh name="Mesh_23003" geometry={nodes.Mesh_23003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator30_25010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.362, 1]} > <group name="Object_55005" position={[-0.097, -0.999, -0.98]}> <mesh name="Mesh_24003" geometry={nodes.Mesh_24003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator31_26010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.041, 1]} > <group name="Object_57005" position={[0.096, -0.999, -0.98]}> <mesh name="Mesh_25003" geometry={nodes.Mesh_25003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator32_27010" position={[0, 0.01, 0]} rotation={[-Math.PI, 0, 0]} scale={[1, 0.925, 1]} > <group name="Object_59005" position={[-0.465, -0.999, 0.869]}> <mesh name="Mesh_26003" geometry={nodes.Mesh_26003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator3_24010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.797, 1]} > <group name="Object_53005" position={[0.625, -0.999, -0.762]}> <mesh name="Mesh_27003" geometry={nodes.Mesh_27003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator4_28010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.715, 1]} > <group name="Object_61005" position={[0.761, -0.999, -0.625]}> <mesh name="Mesh_28003" geometry={nodes.Mesh_28003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator5_29010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.567, 1]} > <group name="Object_63005" position={[0.869, -0.999, -0.464]}> <mesh name="Mesh_29003" geometry={nodes.Mesh_29003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator6_30010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.031, 1]} > <group name="Object_65005" position={[0.943, -0.999, -0.286]}> <mesh name="Mesh_30003" geometry={nodes.Mesh_30003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator7_31010" rotation={[-Math.PI, 0, 0]} scale={[1, 1.771, 1]} > <group name="Object_67005" position={[0.98, -0.999, -0.097]}> <mesh name="Mesh_31003" geometry={nodes.Mesh_31003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator8_32010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.591, 1]} > <group name="Object_69005" position={[0.98, -0.999, 0.096]}> <mesh name="Mesh_32003" geometry={nodes.Mesh_32003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="indicator9_33010" rotation={[-Math.PI, 0, 0]} scale={[1, 0.524, 1]} > <group name="Object_71005" position={[0.943, -0.999, 0.286]}> <mesh name="Mesh_33003" geometry={nodes.Mesh_33003.geometry} material={materials['equalizer.010']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="linees_34010" rotation={[-Math.PI, 0, 0]} scale={[0.99, 1.8, 0.99]} > <group name="Object_73005" position={[0, -1, 0]}> <mesh name="Mesh_34003" geometry={nodes.Mesh_34003.geometry} material={materials['PaletteMaterial001.100']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> <group name="Object_74004" position={[0, -1, 0]} scale={0.991}> <mesh name="Mesh_35002" geometry={nodes.Mesh_35002.geometry} material={materials['Material.067']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> </group>
        </AnimatedGroup>
      </group>

      <group name="GLTF_created_0001" position={[5.089, 0.204, -2.233]} scale={[0.065, 0.044, 0.065]} > <group name="GLTF_created_0001" position={[5.089, 0.204, -2.233]} scale={[0.065, 0.044, 0.065]} > <group name="GLTF_created_0_rootJoint001"> <group name="Bone_36002"> <group name="Bone001_1002" position={[0.096, -0.001, 0.032]} rotation={[0, -0.013, -1.587]} > <group name="Bone002_0002" position={[-0.105, 0.588, 0.304]} rotation={[0.452, 0.03, 0.189]} /> </group> <group name="Bone003_3002" position={[-0.118, -0.013, 0.015]} rotation={[-3.129, 0.001, 1.638]} > <group name="Bone004_2002" position={[0.061, 0.634, -0.318]} rotation={[-0.512, -0.099, -0.199]} /> </group> <group name="Bone005_5002" position={[0.096, -0.001, 0.85]} rotation={[0, -0.013, -1.587]} > <group name="Bone006_4002" position={[-0.06, 0.571, 0.34]} rotation={[0.509, 0.056, 0.203]} /> </group> <group name="Bone007_7002" position={[-0.118, -0.013, 0.833]} rotation={[-3.129, 0.001, 1.638]} > <group name="Bone008_6002" position={[0.11, 0.58, -0.397]} rotation={[-0.644, -0.038, -0.264]} /> </group> <group name="Bone009_9002" position={[0.366, -0.019, 1.434]} rotation={[0.006, -0.39, -1.526]} > <group name="Bone010_8002" position={[0.077, 0.842, -0.005]} rotation={[0.469, -0.016, -0.066]} /> </group> <group name="Bone011_11002" position={[-0.186, 0.06, 1.451]} rotation={[-3.134, -0.391, 1.443]} > <group name="Bone012_10002" position={[0.072, 0.753, -0.001]} rotation={[-0.114, -0.12, 0.174]} /> </group> <group name="Bone013_21002" position={[0.096, -0.001, -0.808]} rotation={[0, -0.013, -1.587]} > <group name="Bone014_16002" position={[-0.107, 0.622, 0.225]} rotation={[0.32, 0.031, 0.192]} > <group name="Bone021_15002" position={[0.451, 0.342, -0.818]} rotation={[-2.173, 0.314, 0.199]} > <group name="Bone022_14002" position={[-0.987, -0.691, -0.156]} rotation={[1.046, -0.448, 0.292]} > <group name="Bone023_13002" position={[0.413, 0.005, -2.588]} rotation={[-1.826, 0.699, 2.049]} > <group name="Bone024_12002" position={[-1.698, 1.674, -1.72]} rotation={[2.273, -0.395, -1.644]} /> </group> </group> </group> </group>
                <group name="Bone025_20002" position={[0, 0.67, 0]} rotation={[-1.555, -0.169, 0.172]} > <group name="Bone026_19002" position={[0.074, 0.542, -0.267]} rotation={[-0.501, 0.04, -0.358]} > <group name="Bone027_18002" position={[-0.035, 0.174, 0.891]} rotation={[0.858, 0.254, 1.586]} > <group name="Bone028_17002" position={[-0.929, -0.424, -1.265]} rotation={[0.109, 1.131, 0.17]} /> </group> </group> </group> </group> <group name="Bone015_31002" position={[-0.118, -0.013, -0.825]} rotation={[-3.129, 0.001, 1.638]} > <group name="Bone016_26002" position={[0.181, 0.63, -0.277]} rotation={[-0.466, -0.047, -0.368]} > <group name="Bone017_25002" position={[-0.641, -0.11, 1.059]} rotation={[2.718, 0.538, -0.444]} > <group name="Bone018_24002" position={[1.206, -0.854, 1.483]} rotation={[-2.444, -0.517, -1.303]} > <group name="Bone019_23002" position={[1.551, -1.121, 1.662]} rotation={[-2.616, -0.371, 0.669]} > <group name="Bone020_22002" position={[0.606, 0.131, 1.236]} rotation={[0.177, -1.086, 1.975]} /> </group> </group> </group> </group> <group name="Bone029_30002" position={[0, 0.712, 0]} rotation={[1.651, 0.042, 0.039]} > <group name="Bone030_29002" position={[-0.049, 0.657, 0.036]} rotation={[-0.117, -0.007, -0.024]} > <group name="Bone031_28002" position={[0.034, 0.457, 0.111]} rotation={[0.534, -0.209, 1.177]} > <group name="Bone032_27002" position={[-0.085, 0.098, -0.289]} rotation={[0.081, 0.057, -0.241]} /> </group> </group> </group> </group> <group name="Bone034_35002" position={[-0.043, 0.036, -0.789]} rotation={[1.391, 1.169, -2.906]} > <group name="Bone035_34002" position={[0.134, 0.691, -0.196]} rotation={[-0.429, 0.062, -0.277]} > <group name="Bone036_33002" position={[-0.475, 0.016, 0.523]} rotation={[0.335, -0.161, 1.645]} > <group name="Bone037_32002" position={[-0.041, -0.568, -1.154]} rotation={[-0.459, 1.176, 1.401]} /> </group> </group> </group> </group> </group> </group>
      </group>

      <AnimatedGroup
          name="MeBitEnderman"
          groups={groups}
          setGroups={setGroups}
          onInspect={onInspect}
          analyser={analyser}
          frequencyIndices={groupNameToFrequencyIndices['MeBitEnderman']}
        >
        <group name="meBitEnderman" position={[1, 5, 1]} scale={0.1}> <group name="MeBitEnderman002" position={[5.273, 2.313, -3.028]} rotation={[-0.425, -0.011, -0.088]} scale={[0.005, 0.01, 0.04]} > <group name="Armature008" position={[0, 0, -0.001]} rotation={[-Math.PI / 2, 0, 0]} scale={100} > <group name="Object_11016" position={[0, 0, -0.756]} rotation={[0.068, 0.001, 0.012]} scale={[1.935, 0.349, 0.932]} > <primitive object={nodes._rootJoint} /> <primitive object={nodes.neutral_bone} /> <group name="Object_14007" /> <group name="Object_15014" /> <group name="Mesh_37003"> <skinnedMesh name="Mesh_37002" geometry={nodes.Mesh_37002.geometry} material={materials['Skin.006']} skeleton={nodes.Mesh_37002.skeleton} /> <skinnedMesh name="Mesh_37002_1" geometry={nodes.Mesh_37002_1.geometry} material={materials['PaletteMaterial001.101']} skeleton={nodes.Mesh_37002_1.skeleton} /> </group> <skinnedMesh name="Mesh_38004" geometry={nodes.Mesh_38004.geometry} material={materials['Eyes.006']} skeleton={nodes.Mesh_38004.skeleton} /> </group> </group> </group> </group>
      </AnimatedGroup>

      <AnimatedGroup
  name="MeBitFatty"
  groups={groups}
  setGroups={setGroups}
  onInspect={onInspect}
  analyser={analyser}
  frequencyIndices={groupNameToFrequencyIndices['MeBitFatty']}
> <group>
        <group position={[4.833, 0.654, -2.28]} rotation={[1.861, -0.003, -0.009]} scale={[1.02, 0.075, 0.766]} > <group name="MeBitFatty007" position={[0.533, 79.597, 1.172]} scale={[0.043, 0.578, 0.057]} /> </group> <group name="MeBitFatty" position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_39005" geometry={nodes.Mesh_39005.geometry} material={materials['Tassels.006']} /> <mesh name="Mesh_39005_1" geometry={nodes.Mesh_39005_1.geometry} material={materials['PaletteMaterial001.111']} /> <mesh name="Mesh_39005_2" geometry={nodes.Mesh_39005_2.geometry} material={materials['PaletteMaterial001.112']} /> <mesh name="Mesh_39005_3" geometry={nodes.Mesh_39005_3.geometry} material={materials['PaletteMaterial001.103']} /> <mesh name="Mesh_39005_4" geometry={nodes.Mesh_39005_4.geometry} material={materials['Carpet.002']} /> </group>
        </group>
      </AnimatedGroup>

  <AnimatedGroup
  name="MeBitRobot"
  groups={groups}
  setGroups={setGroups}
  onInspect={onInspect}
  analyser={analyser}
  frequencyIndices={groupNameToFrequencyIndices['MeBitRobot']}
>
        <group name="MeBitRobot002" position={[6.284, 0.506, 2.36]} rotation={[-Math.PI, 1.566, -Math.PI]} scale={[0.006, 0.006, 0.007]} >
          <group name="Robot_OriginMeBitRobot003" position={[0, 0.615, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={100} > <group name="Ears007" position={[0, 0, 2.949]} /> <group name="Empty007" position={[0, -0.06, 2.786]}> <group name="Eyes007" position={[0, -0.431, 0.076]} scale={[1, 1, 0]} /> </group> <group name="Hand_origin013" position={[1.23, 0, 2.15]}> <group name="hANDS007" position={[-0.723, 0, -1.963]}> <group name="hANDS_White_Glossy_0003" position={[0.894, -0.002, 1.418]} scale={0.491} > <mesh name="Mesh_40005" geometry={nodes.Mesh_40005.geometry} material={materials['PaletteMaterial001.102']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> </group> <group name="Hand_origin014" position={[1, 0, 2.015]} rotation={[0, 0, -Math.PI]} > <group name="hANDS008" position={[-0.723, 0, -1.963]}> <group name="hANDS002_White_Glossy_0003" position={[0.894, -0.002, 1.418]} scale={0.491} > <mesh name="Mesh_40006" geometry={nodes.Mesh_40006.geometry} material={materials['PaletteMaterial001.102']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> </group> <group name="Mouth007" position={[0, -0.504, 2.573]} /> <group name="Wave025" position={[0, 0, 1]}> <group name="Wave_Blue_Light_0004" position={[0.001, -0.002, -0.002]} scale={0.506} > <mesh name="Mesh_43009" geometry={nodes.Mesh_43009.geometry} material={materials['PaletteMaterial002.054']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="Wave026" position={[0, 0, 0.427]} scale={[1, 1, 0.474]} > <group name="Wave002_Blue_Light_0004" position={[0.001, -0.002, -0.002]} scale={0.506} > <mesh name="Mesh_43010" geometry={nodes.Mesh_43010.geometry} material={materials['PaletteMaterial002.054']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="Wave027" position={[0, 0, 0.819]} scale={[1, 1, 0.834]} > <group name="Wave001_Blue_Light_0004" position={[0.001, -0.002, -0.002]} scale={0.506} > <mesh name="Mesh_43011" geometry={nodes.Mesh_43011.geometry} material={materials['PaletteMaterial002.054']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="Wave028" position={[0, 0, 0.05]} scale={[1, 1, 0.128]}> <group name="Wave003_Blue_Light_0004" position={[0.001, -0.002, -0.002]} scale={0.506} > <mesh name="Mesh_43012" geometry={nodes.Mesh_43012.geometry} material={materials['PaletteMaterial002.054']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> <group name="Robot004" position={[0, 0, 0.051]}> <group name="Robot_Blue_Light_0004" position={[-0.6, -0.49, 1.69]} scale={0.778} > <mesh name="Mesh_41006" geometry={nodes.Mesh_41006.geometry} material={materials['PaletteMaterial002.054']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> <group name="Robot_White_Glossy_0004" position={[-5.069, -1.004, 1.25]} scale={2.845} > <group name="Mesh_42003" position={[-5.999, -1, -3.995]} scale={0.001} > <mesh name="Mesh_42002" geometry={nodes.Mesh_42002.geometry} material={materials['PaletteMaterial001.103']} /> <mesh name="Mesh_42002_1" geometry={nodes.Mesh_42002_1.geometry} material={materials['Glass.012']} /> <mesh name="Mesh_42002_2" geometry={nodes.Mesh_42002_2.geometry} material={materials['PaletteMaterial001.102']} /> <mesh name="Mesh_42002_3" geometry={nodes.Mesh_42002_3.geometry} material={materials['PaletteMaterial003.038']} /> <mesh name="Mesh_42002_4" geometry={nodes.Mesh_42002_4.geometry} material={materials['PaletteMaterial004.031']} /> <mesh name="Mesh_42002_5" geometry={nodes.Mesh_42002_5.geometry} material={materials['PaletteMaterial005.039']} /> </group> </group> </group> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
  name="CouchA"
  analyser={analyser}
  frequencyIndices={groupNameToFrequencyIndices['CouchA']}
>
        <group name="CouchA">
          <group name="Couch1" position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="Armature009"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['Armature009']}
      >
        <group name="Armature009" position={[-49.33, -51.924, 49.897]} rotation={[-Math.PI / 2, 0, 0]} scale={20} > <group name="Object_5009"> <group name="_rootJoint007"> <group name="Bone001_02002" position={[-2.552, 7.511, 7.537]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone001_end_030002" position={[0, 1, 0]} /> </group> <group name="Bone002_03002" position={[7.457, 7.511, 7.537]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone002_end_029002" position={[0, 1, 0]} /> </group> <group name="Bone003_04002" position={[7.457, -2.534, 7.537]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone003_end_017002" position={[0, 1, 0]} /> </group> <group name="Bone004_05002" position={[-2.552, -2.534, 7.537]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone004_end_021002" position={[0, 1, 0]} /> </group> <group name="Bone005_06002" position={[-2.552, -2.534, -2.466]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone005_end_024002" position={[0, 1, 0]} /> </group> <group name="Bone006_07002" position={[7.457, -2.534, -2.466]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone006_end_026002" position={[0, 1, 0]} /> </group> <group name="Bone007_08002" position={[7.457, 7.511, -2.466]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone007_end_022002" position={[0, 1, 0]} /> </group> <group name="Bone008_09005" position={[-2.552, 7.511, -2.466]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone008_end_027002" position={[0, 1, 0]} /> </group> <group name="Bone009_010002" position={[0, 4.941, 0]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone009_end_019002" position={[0, 1, 0]} /> </group> <group name="Bone010_011002" position={[4.977, 4.941, 0]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone010_end_028002" position={[0, 1, 0]} /> </group> <group name="Bone011_012002" position={[4.977, 0, 0]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone011_end_031002" position={[0, 1, 0]} /> </group> <group name="Bone012_013002" position={[0, 0, 5.128]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone012_end_00002" position={[0, 1, 0]} /> </group> <group name="Bone013_014002" position={[4.977, 0, 5.128]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone013_end_025002" position={[0, 1, 0]} /> </group> <group name="Bone014_015005" position={[4.977, 4.941, 5.128]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone014_end_023002" position={[0, 1, 0]} /> </group> <group name="Bone015_016005" position={[0, 4.941, 5.128]} rotation={[Math.PI / 2, 0, 0]} > <group name="Bone015_end_018002" position={[0, 1, 0]} /> </group> <group name="Bone_01002" rotation={[Math.PI / 2, 0, 0]}> <group name="Bone_end_020002" position={[0, 1, 0]} /> </group> </group> </group> </group>
      </AnimatedGroup>
      <AnimatedGroup
        name="MeBitSanta"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitSanta']}
      >
        <group name="MeBitSanta">
          <group name="MeBitSanta021" position={[-5.1, 6.452, -3.343]} rotation={[-1.589, -0.004, -1.468]} scale={[0.004, 0.005, 0.008]} > <primitive object={nodes._rootJoint_1} /> <group name="Object_87004" position={[-17.364, 1.346, -4.95]} /> <group name="Object_88004" position={[-17.364, 1.346, -4.95]} /> <skinnedMesh name="MeBitSanta034" geometry={nodes.MeBitSanta034.geometry} material={materials['CH_NPC_Pig_MI_PJH.006']} skeleton={nodes.MeBitSanta034.skeleton} /> <skinnedMesh name="Mesh_47003" geometry={nodes.Mesh_47003.geometry} material={materials['CH_NPC_Pig_Eyelash_PJH.007']} skeleton={nodes.Mesh_47003.skeleton} /> </group> <group name="MeBitSanta022" position={[-5.117, 6.455, -3.195]} rotation={[-1.589, -0.004, -1.468]} scale={[0.004, 0.005, 0.008]} > <primitive object={nodes._rootJoint_2} /> <group name="Object_229004" position={[-17.364, 1.346, -4.95]} /> <group name="Object_230004" position={[-17.364, 1.346, -4.95]} /> <skinnedMesh name="MeBitSanta031" geometry={nodes.MeBitSanta031.geometry} material={materials['CH_NPC_Pig_MI_PJH.006']} skeleton={nodes.MeBitSanta031.skeleton} /> <skinnedMesh name="Mesh_49003" geometry={nodes.Mesh_49003.geometry} material={materials['CH_NPC_Pig_Eyelash_PJH.007']} skeleton={nodes.Mesh_49003.skeleton} /> </group> <group name="MeBitSanta023" position={[-4.85, 6.453, -3.34]} rotation={[-1.589, -0.004, -1.468]} scale={[0.004, 0.005, 0.008]} > <primitive object={nodes._rootJoint_3} /> <group name="Object_16007" position={[-17.364, 1.346, -4.949]} /> <group name="Object_17013" position={[-17.364, 1.346, -4.949]} /> <skinnedMesh name="MeBitSanta033" geometry={nodes.MeBitSanta033.geometry} material={materials['CH_NPC_Pig_MI_PJH.006']} skeleton={nodes.MeBitSanta033.skeleton} /> <skinnedMesh name="Mesh_51003" geometry={nodes.Mesh_51003.geometry} material={materials['CH_NPC_Pig_Eyelash_PJH.007']} skeleton={nodes.Mesh_51003.skeleton} /> </group> <group name="MeBitSanta024" position={[-4.85, 6.455, -3.193]} rotation={[-1.589, -0.004, -1.468]} scale={[0.004, 0.005, 0.008]} > <primitive object={nodes._rootJoint_4} /> <group name="Object_158004" position={[-17.364, 1.346, -4.949]} /> <group name="Object_159004" position={[-17.364, 1.346, -4.949]} /> <skinnedMesh name="MeBitSanta032" geometry={nodes.MeBitSanta032.geometry} material={materials['CH_NPC_Pig_MI_PJH.006']} skeleton={nodes.MeBitSanta032.skeleton} /> <skinnedMesh name="Mesh_53003" geometry={nodes.Mesh_53003.geometry} material={materials['CH_NPC_Pig_Eyelash_PJH.007']} skeleton={nodes.Mesh_53003.skeleton} /> </group> <group name="MeBitSanta025" position={[-4.65, 6.427, -3.461]} rotation={[0.021, -1.468, 0.039]} scale={[0.004, 0.008, 0.005]} > <group name="Polygon_Reduction_1006" position={[-41.898, 18.25, -1.214]} rotation={[-0.004, -0.106, -0.015]} > <group name="Polygon_Reduction_1_Material_0_0004" position={[1.115, 13.84, -1.726]} scale={37.887} > <group name="MeBitSanta" position={[-5.999, -1, -3.995]} scale={0.001} > <mesh name="Mesh_54002" geometry={nodes.Mesh_54002.geometry} material={materials['MeditationSanta_Model_9_u1_v1.006']} /> <mesh name="Mesh_54002_1" geometry={nodes.Mesh_54002_1.geometry} material={materials['PaletteMaterial001.103']} /> <mesh name="Mesh_54002_2" geometry={nodes.Mesh_54002_2.geometry} material={materials['material_0.014']} /> <mesh name="Mesh_54002_3" geometry={nodes.Mesh_54002_3.geometry} material={materials['Material_0.006']} /> <mesh name="Mesh_54002_4" geometry={nodes.Mesh_54002_4.geometry} material={materials['PaletteMaterial001.120']} /> </group> </group> </group> </group> <group name="MeBitSanta026" position={[-5.387, 4.885, -3.699]} rotation={[0, -0.011, 0]} scale={[0.01, 0.008, 0.008]} > <group name="Cylinder001_3006" position={[0, 4.829, -0.021]} scale={0.862} > <group name="Object_11017" position={[0, 0.318, 0]} scale={0.456}> <mesh name="Mesh_56003" geometry={nodes.Mesh_56003.geometry} material={materials['Material.066']} position={[-5.999, -1, -3.996]} scale={0.001} /> </group> </group> </group> <group name="MeBitSanta027" position={[-5.387, 4.885, -3.699]} rotation={[0, -0.011, 0]} scale={[0.01, 0.008, 0.008]} > <group name="MeBitSanta028"> <group name="Object_39009" position={[-0.001, 5.046, -0.01]} scale={0.301} > <mesh name="Mesh_68003" geometry={nodes.Mesh_68003.geometry} material={materials['M_Bake.006']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> </group> <group name="MeBitSanta029" position={[-5.052, 4.901, -3.687]} rotation={[-0.112, 0.024, -0.001]} scale={[0.013, 0.016, 0.028]} > <group name="gifts001_24006" position={[1.205, -0.566, 0]} rotation={[0, Math.PI / 4, 0]} > <group name="Object_52002" position={[0.286, 0.176, -0.006]} scale={0.238} > <mesh name="Mesh_70003" geometry={nodes.Mesh_70003.geometry} material={materials['christmas_tree.006']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group> </group> </group> <group name="MeBitSanta019" position={[-5.999, -1.039, -4.064]} scale={0.001} > <mesh name="MeBitSanta001" geometry={nodes.MeBitSanta001.geometry} material={materials['default.007']} /> <mesh name="MeBitSanta001_1" geometry={nodes.MeBitSanta001_1.geometry} material={materials['M_Bake.006']} /> <mesh name="MeBitSanta001_2" geometry={nodes.MeBitSanta001_2.geometry} material={materials['Material.066']} /> </group>
        </group>
      </AnimatedGroup>

      <mesh name="Mesh_69002" geometry={nodes.Mesh_69002.geometry} material={materials['christmas_tree.006']} position={[-5.999, -1.039, -4.064]} scale={0.001} />
      <mesh name="Mesh_89001" geometry={nodes.Mesh_89001.geometry} material={materials['PaletteMaterial001.104']} position={[-5.999, -1, -3.995]} scale={0.001} />
      <AnimatedGroup
  name="BunnyEarsCactus"
  groups={groups}
  setGroups={setGroups}
  onInspect={onInspect}
  onMeBitFound={onMeBitFound}
  analyser={analyser}
  isPlaying={isPlaying}
  frequencyIndices={groupNameToFrequencyIndices['BunnyEarsCactus']}
  indicatorPosition={[8.75, 2, 6]} 
      >
 

        <group name="BunnyEarsCactus">
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh name="Mesh_89002" geometry={nodes.Mesh_89002.geometry} material={materials['lambert1.003']} /> <mesh name="Mesh_89002_1" geometry={nodes.Mesh_89002_1.geometry} material={materials['cactus_04_mat.003']} /> <mesh name="Mesh_89002_2" geometry={nodes.Mesh_89002_2.geometry} material={materials['cactus_04_spike_mat.003']} /> <mesh name="Mesh_89002_3" geometry={nodes.Mesh_89002_3.geometry} material={materials['cactus_ground_mat.003']} /> <mesh name="Mesh_89002_4" geometry={nodes.Mesh_89002_4.geometry} material={materials['cactus_stone_mat.003']} />
          </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="PuzzleShelf"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['PuzzleShelf']}
        indicatorPosition={[-5, 2.5, -4]} 
      >

        <group name="PuzzleShelf">
  
          <group position={[-5.999, -1, -3.995]} scale={0.001}>

    
            <mesh name="Mesh_36002" geometry={nodes.Mesh_36002.geometry} material={materials['Mtl2.010']} /> <mesh name="Mesh_36002_1" geometry={nodes.Mesh_36002_1.geometry} material={materials['baked.010']} /> <mesh name="Mesh_36002_2" geometry={nodes.Mesh_36002_2.geometry} material={materials['RubixCube.010']} /> <mesh name="Mesh_36002_3" geometry={nodes.Mesh_36002_3.geometry} material={materials['PaletteMaterial001.105']} /> <mesh name="Mesh_36002_4" geometry={nodes.Mesh_36002_4.geometry} material={materials['material.030']} /> <mesh name="Mesh_36002_5" geometry={nodes.Mesh_36002_5.geometry} material={materials['PaletteMaterial002.055']} /> <mesh name="Mesh_36002_6" geometry={nodes.Mesh_36002_6.geometry} material={materials['Sticker_SPC-SG.010']} />
          </group>
        </group>
      </AnimatedGroup>


      <AnimatedGroup
        name="Arcade"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['Arcade']}
        indicatorPosition={[-4, 5.75, -3.6]} 
      >
  
        <group name="Arcade">
 
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
  
            <mesh name="Mesh_36003" geometry={nodes.Mesh_36003.geometry} material={materials['PaletteMaterial003.039']} /> <mesh name="Mesh_36003_1" geometry={nodes.Mesh_36003_1.geometry} material={materials['GameBoy.010']} /> <mesh name="Mesh_36003_2" geometry={nodes.Mesh_36003_2.geometry} material={materials['bButton.010']} /> <mesh name="Mesh_36003_3" geometry={nodes.Mesh_36003_3.geometry} material={materials['TT_checker_1024x1024_UV_GRID.020']} /> <mesh name="Mesh_36003_4" geometry={nodes.Mesh_36003_4.geometry} material={materials['ARCADE.011']} /> <mesh name="Mesh_36003_5" geometry={nodes.Mesh_36003_5.geometry} material={materials['PaletteMaterial002.057']} /> <mesh name="Mesh_36003_6" geometry={nodes.Mesh_36003_6.geometry} material={materials['PaletteMaterial003.040']} /> <mesh name="Mesh_36003_7" geometry={nodes.Mesh_36003_7.geometry} material={materials['PaletteMaterial001.106']} /> <mesh name="Mesh_36003_8" geometry={nodes.Mesh_36003_8.geometry} material={materials['PaletteMaterial002.058']} /> <mesh name="Mesh_36003_9" geometry={nodes.Mesh_36003_9.geometry} material={materials['PaletteMaterial004.032']} /> <mesh name="Mesh_36003_10" geometry={nodes.Mesh_36003_10.geometry} material={materials['Stick.010']} /> <mesh name="Mesh_36003_11" geometry={nodes.Mesh_36003_11.geometry} material={materials['lowpoly.010']} /> <mesh name="Mesh_36003_12" geometry={nodes.Mesh_36003_12.geometry} material={materials['GamepadStuff.011']} /> <mesh name="Mesh_36003_13" geometry={nodes.Mesh_36003_13.geometry} material={materials['gamepadMain.011']} /> <mesh name="Mesh_36003_14" geometry={nodes.Mesh_36003_14.geometry} material={materials['PaletteMaterial005.040']} /> <mesh name="Mesh_36003_15" geometry={nodes.Mesh_36003_15.geometry} material={materials['TT_checker_1024x1024_UV_GRID.021']} /> <mesh name="Mesh_36003_16" geometry={nodes.Mesh_36003_16.geometry} material={materials['PaletteMaterial006.022']} /> <mesh name="Mesh_36003_17" geometry={nodes.Mesh_36003_17.geometry} material={materials['controllerbody.010']} /> <mesh name="Mesh_36003_18" geometry={nodes.Mesh_36003_18.geometry} material={materials['material.031']} /> <mesh name="Mesh_36003_19" geometry={nodes.Mesh_36003_19.geometry} material={materials['ANALOG.010']} /> <mesh name="Mesh_36003_20" geometry={nodes.Mesh_36003_20.geometry} material={materials['dpad.010']} /> <mesh name="Mesh_36003_21" geometry={nodes.Mesh_36003_21.geometry} material={materials['cstick.010']} /> <mesh name="Mesh_36003_22" geometry={nodes.Mesh_36003_22.geometry} material={materials['abutton.010']} /> <mesh name="Mesh_36003_23" geometry={nodes.Mesh_36003_23.geometry} material={materials['zbutton.010']} /> <mesh name="Mesh_36003_24" geometry={nodes.Mesh_36003_24.geometry} material={materials['bumpers.010']} /> <mesh name="Mesh_36003_25" geometry={nodes.Mesh_36003_25.geometry} material={materials['PaletteMaterial001.107']} /> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="RoomFloor"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['RoomFloor']}
      >
        <group name="RoomFloor">
          <mesh geometry={nodes.RoomFloor.geometry} material={materials['Material.068']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="TVMonitor"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['TVMonitor']}
        indicatorPosition={[0.4, 4.75, -3.6]} 
      >
        <group name="TvMonitor">
          <mesh geometry={nodes.TvMonoitor.geometry} material={materials['Material.069']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MonitorScreen"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MonitorScreen']}
        indicatorPosition={[9.5, 4, 1.25]} 
      >
        <group name="MonitorScreen">
          <mesh geometry={nodes.MonitorScreen.geometry} material={materials['Material.070']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="KitchenSet"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['KitchenSet']}
        indicatorPosition={[6.35, 3.25, -2.5]} 
      >

        <group name="KitchenSet">

            
             <mesh geometry={nodes.KitchenSet001.geometry} material={materials['PaletteMaterial001.108']} position={[-5.999, -0.966, -3.995]} scale={0.001} /> </group>
      </AnimatedGroup>

      {/* TopShelf - NO FFT animation, static display */}
      <group name="TopShelf">
        <group position={[-5.999, -1, -3.995]} scale={0.001}>
          <mesh name="Mesh_36011" geometry={nodes.Mesh_36011.geometry} material={materials['PaletteMaterial001.100']} />
          <mesh name="Mesh_36011_1" geometry={nodes.Mesh_36011_1.geometry} material={materials['Material.071']} />
        </group>
      </group>

      <AnimatedGroup
        name="MeBitBalloon"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitBalloon']}
      >
        <group name="MeBitBalloon">
          <group position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_36012" geometry={nodes.Mesh_36012.geometry} material={materials['baloon.012']} /> <mesh name="Mesh_36012_1" geometry={nodes.Mesh_36012_1.geometry} material={materials['baloon.013']} /> <mesh name="Mesh_36012_2" geometry={nodes.Mesh_36012_2.geometry} material={materials['PaletteMaterial001.109']} /> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MeSubBit"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeSubBit']}
      >
        <group name="MeSubBit">
          <group position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_44001" geometry={nodes.Mesh_44001.geometry} material={materials['Glass.013']} /> <mesh name="Mesh_44001_1" geometry={nodes.Mesh_44001_1.geometry} material={materials['PaletteMaterial001.101']} /> <mesh name="Mesh_44001_2" geometry={nodes.Mesh_44001_2.geometry} material={materials['Material.072']} /> </group>
        </group>
      </AnimatedGroup>

      <mesh
        name="Mesh_39004"
        geometry={nodes.Mesh_39004.geometry}
        material={nodes.Mesh_39004.material}
        position={[-5.999, -1, -3.995]}
        scale={0.001}
      />

      <AnimatedGroup
        name="MeBitCar"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitCar']}
      >
        <group name="MeBitCar">
          <group position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_39004_1" geometry={nodes.Mesh_39004_1.geometry} material={materials['PaletteMaterial001.110']} /> <mesh name="Mesh_39004_2" geometry={nodes.Mesh_39004_2.geometry} material={materials['forMayaAOrear_lights.006']} /> <mesh name="Mesh_39004_3" geometry={nodes.Mesh_39004_3.geometry} material={materials['forMayaAOnumber.006']} /> <mesh name="Mesh_39004_4" geometry={nodes.Mesh_39004_4.geometry} material={materials['forMayaAOlambert15.005']} /> <mesh name="Mesh_39004_5" geometry={nodes.Mesh_39004_5.geometry} material={materials['forMayaAOlambert16.006']} /> <mesh name="Mesh_39004_6" geometry={nodes.Mesh_39004_6.geometry} material={materials['forMayaAOblinn6.005']} /> <mesh name="Mesh_39004_7" geometry={nodes.Mesh_39004_7.geometry} material={materials['PaletteMaterial002.059']} /> <mesh name="Mesh_39004_8" geometry={nodes.Mesh_39004_8.geometry} material={materials['forMayaAOGrill2.006']} /> <mesh name="Mesh_39004_9" geometry={nodes.Mesh_39004_9.geometry} material={materials['Chrome_2.006']} /> <mesh name="Mesh_39004_10" geometry={nodes.Mesh_39004_10.geometry} material={materials['PaletteMaterial003.041']} /> <mesh name="Mesh_39004_11" geometry={nodes.Mesh_39004_11.geometry} material={materials['material.032']} /> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MeBitUFO"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitUFO']}
      >
        <group name="MeBitUFO">
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh name="Mesh_39006" geometry={nodes.Mesh_39006.geometry} material={materials['PaletteMaterial001.113']} /> <mesh name="Mesh_39006_1" geometry={nodes.Mesh_39006_1.geometry} material={materials['PaletteMaterial007.020']} /> <mesh name="Mesh_39006_2" geometry={nodes.Mesh_39006_2.geometry} material={materials['PaletteMaterial005.042']} /> <mesh name="Mesh_39006_3" geometry={nodes.Mesh_39006_3.geometry} material={materials['PaletteMaterial004.033']} /> <mesh name="Mesh_39006_4" geometry={nodes.Mesh_39006_4.geometry} material={materials['PaletteMaterial012.006']} /> <mesh name="Mesh_39006_5" geometry={nodes.Mesh_39006_5.geometry} material={materials['PaletteMaterial002.060']} /> <mesh name="Mesh_39006_6" geometry={nodes.Mesh_39006_6.geometry} material={materials['PaletteMaterial006.023']} /> <mesh name="Mesh_39006_7" geometry={nodes.Mesh_39006_7.geometry} material={materials['PaletteMaterial008.019']} /> <mesh name="Mesh_39006_8" geometry={nodes.Mesh_39006_8.geometry} material={materials['PaletteMaterial009.013']} /> <mesh name="Mesh_39006_9" geometry={nodes.Mesh_39006_9.geometry} material={materials['PaletteMaterial010.013']} /> <mesh name="Mesh_39006_10" geometry={nodes.Mesh_39006_10.geometry} material={materials['PaletteMaterial011.006']} />
          </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MeBitPlant"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitPlant']}
      >
        <group name="MeBitPlant">
          <group position={[1.018, 2.187, -2.908]} rotation={[-1.477, Math.PI / 2, 0]} scale={[0.352, 0.352, 0.896]} > <mesh name="armHoles_LP_UV_checker_0001" geometry={nodes.armHoles_LP_UV_checker_0001.geometry} material={materials['UV_checker.005']} /> <mesh name="armHoles_LP_UV_checker_0001_1" geometry={nodes.armHoles_LP_UV_checker_0001_1.geometry} material={materials['UV_checker.006']} /> <mesh name="armHoles_LP_UV_checker_0001_2" geometry={nodes.armHoles_LP_UV_checker_0001_2.geometry} material={materials['UV_checker.007']} /> <mesh name="armHoles_LP_UV_checker_0001_3" geometry={nodes.armHoles_LP_UV_checker_0001_3.geometry} material={materials['PaletteMaterial001.114']} /> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MeBitBoat"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitBoat']}
      >
        <group name="MeBitBoat">
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh name="Mesh_89003" geometry={nodes.Mesh_89003.geometry} material={materials['Material.073']} /> <mesh name="Mesh_89003_1" geometry={nodes.Mesh_89003_1.geometry} material={materials['SVGMat.007']} /> <mesh name="Mesh_89003_2" geometry={nodes.Mesh_89003_2.geometry} material={materials['Material.074']} /> <mesh name="Mesh_89003_3" geometry={nodes.Mesh_89003_3.geometry} material={materials['Material.075']} /> <mesh name="Mesh_89003_4" geometry={nodes.Mesh_89003_4.geometry} material={materials['PaletteMaterial001.115']} />
          </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="GraphicRight"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['GraphicRight']}
        indicatorPosition={[8.35, 6, -3.6]} 
      >
        <group name="GraphicRight"> <mesh geometry={nodes.GraphicRight001.geometry} material={materials['Material.076']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="GraphicMiddle"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['GraphicMiddle']}
        indicatorPosition={[6.35, 6, -3.6]} 
      >
        <group name="GraphicMiddle"> <mesh geometry={nodes.GraphicMiddle.geometry} material={materials['Material.076']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="GraphicLeft"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['GraphicLeft']}
        indicatorPosition={[4.5, 6, -3.6]} 
      >
              <group name="GraphicLeft"> <mesh geometry={nodes.GraphicLeft001.geometry} material={materials['Material.076']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="HangingLightRight"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['HangingLightRight']}
      >
        <group name="HangingLightRight">
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh name="HangingLightRight_1" geometry={nodes.HangingLightRight_1.geometry} material={materials['PaletteMaterial001.100']} /> <mesh name="HangingLightRight_2" geometry={nodes.HangingLightRight_2.geometry} material={materials['PaletteMaterial002.061']} />
          </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="RoomWall"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['RoomWall']}
      >
        <group name="RoomWall">
          <mesh geometry={nodes.RoomWall.geometry} material={materials['Material.077']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="HangingLightLeft"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['HangingLightLeft']}
      >
        <group name="HangingLightLeft">
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh name="Mesh_36019" geometry={nodes.Mesh_36019.geometry} material={materials['PaletteMaterial001.100']} /> <mesh name="Mesh_36019_1" geometry={nodes.Mesh_36019_1.geometry} material={materials['PaletteMaterial002.061']} />
          </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="TableCup"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['TableCup']}
      >
        <group name="TableCup">
          <mesh geometry={nodes.TableCup.geometry} material={materials['PaletteMaterial001.100']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="TableRemote"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['TableRemote']}
      >
        <group name="TableRemote">
          <mesh geometry={nodes.TableRemote.geometry} material={materials['PaletteMaterial001.100']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="ComputerDesk"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['ComputerDesk']}
      >
        <group name="ComputerDesk">
          <mesh geometry={nodes.ComputerDesk001.geometry} material={materials['PaletteMaterial001.100']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="TvMonitorFrame"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['TvMonitorFrame']}
      >
        <group name="TvMonitorFrame">
          <mesh geometry={nodes.TvMonitorFrame.geometry} material={materials['PaletteMaterial001.100']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MonitorStand"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MonitorStand']}
      >
        <group name="MonitorStand">
          <mesh geometry={nodes.MonitorStand.geometry} material={materials['PaletteMaterial001.100']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="TV_Stand"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['TV_Stand']}
      >
        <group name="TV_Stand">
          <mesh geometry={nodes.TV_Stand.geometry} material={materials['PaletteMaterial001.100']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="GraphicLeftFrame"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['GraphicLeftFrame']}
      >
        <group name="GraphicLeftFrame">
          <group position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_36027" geometry={nodes.Mesh_36027.geometry} material={materials['PaletteMaterial001.100']} /> <mesh name="Mesh_36027_1" geometry={nodes.Mesh_36027_1.geometry} material={materials['Material.076']} /> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="GraphicMiddleFrame"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['GraphicMiddleFrame']}
      >
        <group name="GraphicMiddleFrame">
          <group position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_36028" geometry={nodes.Mesh_36028.geometry} material={materials['PaletteMaterial001.100']} /> <mesh name="Mesh_36028_1" geometry={nodes.Mesh_36028_1.geometry} material={materials['Material.076']} /> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="HeadsetStand"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['HeadsetStand']}
        indicatorPosition={[7.5, 4.5, -3]}
      >
        <group name="HeadsetStand">
          <mesh geometry={nodes.HeadsetStand001.geometry} material={materials['PaletteMaterial001.100']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="GraphicRightFrame"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['GraphicRightFrame']}
      >
        <group name="GraphicRightFrame">
          <group position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_36033" geometry={nodes.Mesh_36033.geometry} material={materials['PaletteMaterial001.100']} /> <mesh name="Mesh_36033_1" geometry={nodes.Mesh_36033_1.geometry} material={materials['Material.076']} /> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MiddleTable"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MiddleTable']}
      >
        <group name="MiddleTable"> <group position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_36035" geometry={nodes.Mesh_36035.geometry} material={materials['Material.071']} /> <mesh name="Mesh_36035_1" geometry={nodes.Mesh_36035_1.geometry} material={materials['PaletteMaterial001.100']} /> </group> </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="Computer"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['Computer']}
        indicatorPosition={[8.5, 2.5, 0]}
      >
        <group name="Computer"> <group position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_36041" geometry={nodes.Mesh_36041.geometry} material={materials['PaletteMaterial001.100']} /> <mesh name="Mesh_36041_1" geometry={nodes.Mesh_36041_1.geometry} material={materials['PaletteMaterial007.021']} /> <mesh name="Mesh_36041_2" geometry={nodes.Mesh_36041_2.geometry} material={materials['PaletteMaterial002.061']} /> </group> </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MeBitCthulu"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitCthulu']}
      >
        <group name="MeBitCthulu"> <mesh geometry={nodes.MeBitCthulu.geometry} material={materials['PaletteMaterial001.116']} position={[-5.999, -1, -3.995]} scale={0.001} /> </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="WallLights"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['WallLights']}
      >
        <group name="WallLights">
          <mesh geometry={nodes.WallLights.geometry} material={materials['PaletteMaterial006.024']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="KeyboardMouse"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['KeyboardMouse']}
        indicatorPosition={[8.5, 3, 1]}
      >
        <group name="KeyboardMouse">
          <group position={[-5.999, -1, -3.995]} scale={0.001}> <mesh name="Mesh_36044" geometry={nodes.Mesh_36044.geometry} material={materials['PaletteMaterial008.020']} /> <mesh name="Mesh_36044_1" geometry={nodes.Mesh_36044_1.geometry} material={materials['PaletteMaterial001.100']} /> <mesh name="Mesh_36044_2" geometry={nodes.Mesh_36044_2.geometry} material={materials['PaletteMaterial001.117']} /> <mesh name="Mesh_36044_3" geometry={nodes.Mesh_36044_3.geometry} material={materials['PaletteMaterial001.118']} /> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MeBitChandelier"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitChandelier']}
      >
        <group name="MeBitChandelier">
          <group name="meBitChandelier"> <mesh name="MeBitChandelierHead" geometry={nodes.MeBitChandelier001.geometry} material={materials['PaletteMaterial005.043']} position={[0.163, 6.558, 0.312]} rotation={[1.505, 0, -3.141]} scale={[2.208, 0.261, 2.212]} /> <group name="RootNode005" position={[-0.416, 7.023, 0.278]} scale={[0.555, 0.515, 0.55]} > <group name="circle009"> <mesh name="circle_constant1_0002" geometry={nodes.circle_constant1_0002.geometry} material={materials['constant1.001']} /> <mesh name="circle_HoloFillDark_0002" geometry={nodes.circle_HoloFillDark_0002.geometry} material={materials['HoloFillDark.001']} /> </group> <group name="circle1002"> <mesh name="circle1_constant2_0002" geometry={nodes.circle1_constant2_0002.geometry} material={materials['constant2.001']} /> </group> <group name="circle2009"> <mesh name="circle2_constant2_0002" geometry={nodes.circle2_constant2_0002.geometry} material={materials['constant2.001']} /> </group> <group name="geo1002"> <mesh name="geo1_constant1_0002" geometry={nodes.geo1_constant1_0002.geometry} material={materials['constant1.001']} /> </group> </group> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="HangingLightMiddle"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['HangingLightMiddle']}
      >
        <group name="HangingLightMiddle">
          <group position={[-5.999, -1, -3.995]} scale={0.001}>
            <mesh name="Mesh_36045" geometry={nodes.Mesh_36045.geometry} material={materials['PaletteMaterial001.100']} /> <mesh name="Mesh_36045_1" geometry={nodes.Mesh_36045_1.geometry} material={materials['PaletteMaterial002.061']} />
          </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="WallSpeakers"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['WallSpeakers']}
      >
        <group name="WallSpeakers">
          <mesh name="Speakers010" geometry={nodes.Speakers010.geometry} material={materials['PaletteMaterial001.119']} position={[8.276, 4.53, -1.35]} scale={[0.22, 0.499, 0.499]} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="MeBitHelmet"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitHelmet']}
      >
        <group name="MeBitHelmet">
          <group position={[-5.089, 5.28, -3.47]} scale={0.325}>
            <mesh name="MeBitHelmet_1" geometry={nodes.MeBitHelmet_1.geometry} material={materials['soft.002']} /> <mesh name="MeBitHelmet_2" geometry={nodes.MeBitHelmet_2.geometry} material={materials['PaletteMaterial005.044']} /> <mesh name="MeBitHelmet_3" geometry={nodes.MeBitHelmet_3.geometry} material={materials['base.002']} />
          </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="CouchB"
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['CouchB']}
      >
        <group name="CouchB">
          <mesh geometry={nodes.Couch2001.geometry} material={materials['Material.078']} position={[-5.999, -1, -3.995]} scale={0.001} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="GameZone"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['GameZone']}
        indicatorPosition={[5.5, 3.5, -3]}
      >
        <group name="GameZone">
          <mesh geometry={nodes.GameZone001.geometry} material={materials['PaletteMaterial002.061']} position={[1.96, 5.334, -2.859]} rotation={[Math.PI / 2, 0, 0]} scale={3.749} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="XBOX"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['XBOX']}
        indicatorPosition={[6.5, 3.25, -3]}
      >
        <group name="XBOX">
          <group position={[6.576, 3.03, -2.919]} scale={[0.22, 0.499, 0.499]}> <mesh name="Cube002" geometry={nodes.Cube002.geometry} material={materials['PaletteMaterial001.121']} /> <mesh name="Cube002_1" geometry={nodes.Cube002_1.geometry} material={materials['Material.079']} /> </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="PS5"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['PS5']}
        indicatorPosition={[5, 3.25, -3]}
      >
        <group name="PS5">
          <mesh geometry={nodes.PS5002.geometry} material={materials['PaletteMaterial001.121']} position={[5, 3, -2.919]} scale={[0.22, 0.499, 0.499]} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="DVDPlayer"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['DVDPlayer']}
        indicatorPosition={[5.4, 3, -2.5]}
      >
        <group name="DVDPlayer">
          <mesh geometry={nodes.DVDPlayer002.geometry} material={materials['PaletteMaterial001.121']} position={[5.376, 2.9, -2.519]} scale={[0.22, 0.499, 0.499]} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="CableBox"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['CableBox']}
        indicatorPosition={[5.9, 3, -2.5]}
      >
        <group name="CableBox">
          <mesh geometry={nodes.CableBox002.geometry} material={materials['PaletteMaterial001.121']} position={[5.86, 2.9, -2.519]} scale={[0.22, 0.499, 0.499]} />
        </group>
      </AnimatedGroup>

   
      <AnimatedGroup
        name="ShelfKeyboard"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['ShelfKeyboard']}
        indicatorPosition={[4.85, 4.5, -3]}
      >
        <group name="ShelfKeyboard">
          <mesh geometry={nodes.ShelfKeyboard.geometry} material={materials['PaletteMaterial001.122']} position={[4.842, 4.23, -2.919]} scale={[0.22, 0.499, 0.499]} />
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="RoomDisplayOne"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['RoomDisplayOne']}
        indicatorPosition={[-0.4, 2.5, -3]} 
      >
             
        <group name="RoomDisplayOne">
          <group position={[-5.599, -1, -3.995]} scale={0.001}>
            <mesh name="RoomDisplayOne001" geometry={nodes.RoomDisplayOne001.geometry} material={materials['PaletteMaterial001.123']} /> <mesh name="RoomDisplayOne001_1" geometry={nodes.RoomDisplayOne001_1.geometry} material={materials['blinn4SG.005']} /> <mesh name="RoomDisplayOne001_2" geometry={nodes.RoomDisplayOne001_2.geometry} material={materials['PaletteMaterial004.034']} /> <mesh name="RoomDisplayOne001_3" geometry={nodes.RoomDisplayOne001_3.geometry} material={materials['lambert7SG.006']} /> <mesh name="RoomDisplayOne001_4" geometry={nodes.RoomDisplayOne001_4.geometry} material={materials['PaletteMaterial008.021']} /> <mesh name="RoomDisplayOne001_5" geometry={nodes.RoomDisplayOne001_5.geometry} material={materials['PaletteMaterial009.014']} /> <mesh name="RoomDisplayOne001_6" geometry={nodes.RoomDisplayOne001_6.geometry} material={materials['equalizer.011']} /> <mesh name="RoomDisplayOne001_7" geometry={nodes.RoomDisplayOne001_7.geometry} material={materials['blackInternal.012']} /> <mesh name="RoomDisplayOne001_8" geometry={nodes.RoomDisplayOne001_8.geometry} material={materials['blackFabric.012']} /> <mesh name="RoomDisplayOne001_9" geometry={nodes.RoomDisplayOne001_9.geometry} material={materials['PaletteMaterial010.014']} /> <mesh name="RoomDisplayOne001_10" geometry={nodes.RoomDisplayOne001_10.geometry} material={materials['PaletteMaterial007.022']} /> <mesh name="RoomDisplayOne001_11" geometry={nodes.RoomDisplayOne001_11.geometry} material={materials['frontColor.011']} /> <mesh name="RoomDisplayOne001_12" geometry={nodes.RoomDisplayOne001_12.geometry} material={materials['PaletteMaterial005.045']} /> <mesh name="RoomDisplayOne001_13" geometry={nodes.RoomDisplayOne001_13.geometry} material={materials['TT_checker_1024x1024_UV_GRID.022']} /> <mesh name="RoomDisplayOne001_14" geometry={nodes.RoomDisplayOne001_14.geometry} material={materials['ARCADE.012']} /> <mesh name="RoomDisplayOne001_15" geometry={nodes.RoomDisplayOne001_15.geometry} material={materials['PaletteMaterial002.062']} /> <mesh name="RoomDisplayOne001_16" geometry={nodes.RoomDisplayOne001_16.geometry} material={materials['PaletteMaterial003.042']} /> <mesh name="RoomDisplayOne001_17" geometry={nodes.RoomDisplayOne001_17.geometry} material={materials['PaletteMaterial001.124']} /> <mesh name="RoomDisplayOne001_18" geometry={nodes.RoomDisplayOne001_18.geometry} material={materials['PaletteMaterial002.063']} /> <mesh name="RoomDisplayOne001_19" geometry={nodes.RoomDisplayOne001_19.geometry} material={materials['PaletteMaterial003.043']} /> <mesh name="RoomDisplayOne001_20" geometry={nodes.RoomDisplayOne001_20.geometry} material={materials['Stick.011']} /> <mesh name="RoomDisplayOne001_21" geometry={nodes.RoomDisplayOne001_21.geometry} material={materials['GameBoy.011']} /> <mesh name="RoomDisplayOne001_22" geometry={nodes.RoomDisplayOne001_22.geometry} material={materials['lowpoly.011']} /> <mesh name="RoomDisplayOne001_23" geometry={nodes.RoomDisplayOne001_23.geometry} material={materials['GamepadStuff.012']} /> <mesh name="RoomDisplayOne001_24" geometry={nodes.RoomDisplayOne001_24.geometry} material={materials['gamepadMain.012']} /> <mesh name="RoomDisplayOne001_25" geometry={nodes.RoomDisplayOne001_25.geometry} material={materials['Sticker_SPC-SG.011']} /> <mesh name="RoomDisplayOne001_26" geometry={nodes.RoomDisplayOne001_26.geometry} material={materials['baked.011']} /> <mesh name="RoomDisplayOne001_27" geometry={nodes.RoomDisplayOne001_27.geometry} material={materials['RubixCube.011']} /> <mesh name="RoomDisplayOne001_28" geometry={nodes.RoomDisplayOne001_28.geometry} material={materials['PaletteMaterial005.046']} /> <mesh name="RoomDisplayOne001_29" geometry={nodes.RoomDisplayOne001_29.geometry} material={materials['TT_checker_1024x1024_UV_GRID.023']} /> <mesh name="RoomDisplayOne001_30" geometry={nodes.RoomDisplayOne001_30.geometry} material={materials['PaletteMaterial006.025']} /> <mesh name="RoomDisplayOne001_31" geometry={nodes.RoomDisplayOne001_31.geometry} material={materials['controllerbody.011']} /> <mesh name="RoomDisplayOne001_32" geometry={nodes.RoomDisplayOne001_32.geometry} material={materials['material.033']} /> <mesh name="RoomDisplayOne001_33" geometry={nodes.RoomDisplayOne001_33.geometry} material={materials['ANALOG.011']} /> <mesh name="RoomDisplayOne001_34" geometry={nodes.RoomDisplayOne001_34.geometry} material={materials['dpad.011']} /> <mesh name="RoomDisplayOne001_35" geometry={nodes.RoomDisplayOne001_35.geometry} material={materials['cstick.011']} /> <mesh name="RoomDisplayOne001_36" geometry={nodes.RoomDisplayOne001_36.geometry} material={materials['bumpers.011']} /> <mesh name="RoomDisplayOne001_37" geometry={nodes.RoomDisplayOne001_37.geometry} material={materials['PaletteMaterial002.064']} /> <mesh name="RoomDisplayOne001_38" geometry={nodes.RoomDisplayOne001_38.geometry} material={materials['Mtl2.011']} /> <mesh name="RoomDisplayOne001_39" geometry={nodes.RoomDisplayOne001_39.geometry} material={materials['material.034']} /> <mesh name="RoomDisplayOne001_40" geometry={nodes.RoomDisplayOne001_40.geometry} material={materials['PaletteMaterial004.035']} />
          </group>
        </group>
      </AnimatedGroup>

      <AnimatedGroup
        name="RoomDisplayTwo"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        isPlaying={isPlaying}
        frequencyIndices={groupNameToFrequencyIndices['RoomDisplayTwo']}
        indicatorPosition={[2, 2.5, -3]} 
      >
   
        <group name="RoomDisplayTwo"> <group position={[-5.998, -1.52, -3.938]} rotation={[0, 0, 0.061]} scale={0.001}> <mesh name="RoomDisplayTwo001" geometry={nodes.RoomDisplayTwo001.geometry} material={materials['blinn4SG.006']} /> <mesh name="RoomDisplayTwo001_1" geometry={nodes.RoomDisplayTwo001_1.geometry} material={materials['OfficeChair.004']} /> <mesh name="RoomDisplayTwo001_2" geometry={nodes.RoomDisplayTwo001_2.geometry} material={materials['Tables.004']} /> <mesh name="RoomDisplayTwo001_3" geometry={nodes.RoomDisplayTwo001_3.geometry} material={materials['PaletteMaterial007.023']} /> <mesh name="RoomDisplayTwo001_4" geometry={nodes.RoomDisplayTwo001_4.geometry} material={materials['Papers.004']} /> <mesh name="RoomDisplayTwo001_5" geometry={nodes.RoomDisplayTwo001_5.geometry} material={materials['Pipe.004']} /> <mesh name="RoomDisplayTwo001_6" geometry={nodes.RoomDisplayTwo001_6.geometry} material={materials['Plant.004']} /> <mesh name="RoomDisplayTwo001_7" geometry={nodes.RoomDisplayTwo001_7.geometry} material={materials['Material_0.007']} /> <mesh name="RoomDisplayTwo001_8" geometry={nodes.RoomDisplayTwo001_8.geometry} material={materials['MeditationSanta_Model_9_u1_v1.007']} /> <mesh name="RoomDisplayTwo001_9" geometry={nodes.RoomDisplayTwo001_9.geometry} material={materials['material_0.015']} /> <mesh name="RoomDisplayTwo001_10" geometry={nodes.RoomDisplayTwo001_10.geometry} material={materials['material.035']} /> <mesh name="RoomDisplayTwo001_11" geometry={nodes.RoomDisplayTwo001_11.geometry} material={materials['Sticker_SPC-SG.012']} /> <mesh name="RoomDisplayTwo001_12" geometry={nodes.RoomDisplayTwo001_12.geometry} material={materials['baked.012']} /> <mesh name="RoomDisplayTwo001_13" geometry={nodes.RoomDisplayTwo001_13.geometry} material={materials['RubixCube.012']} /> <mesh name="RoomDisplayTwo001_14" geometry={nodes.RoomDisplayTwo001_14.geometry} material={materials['PaletteMaterial005.047']} /> <mesh name="RoomDisplayTwo001_15" geometry={nodes.RoomDisplayTwo001_15.geometry} material={materials['Mtl2.012']} /> <mesh name="RoomDisplayTwo001_16" geometry={nodes.RoomDisplayTwo001_16.geometry} material={materials['material.036']} /> <mesh name="RoomDisplayTwo001_17" geometry={nodes.RoomDisplayTwo001_17.geometry} material={materials['Glass.014']} /> <mesh name="RoomDisplayTwo001_18" geometry={nodes.RoomDisplayTwo001_18.geometry} material={materials['PaletteMaterial003.044']} /> <mesh name="RoomDisplayTwo001_19" geometry={nodes.RoomDisplayTwo001_19.geometry} material={materials['Sofa.004']} /> <mesh name="RoomDisplayTwo001_20" geometry={nodes.RoomDisplayTwo001_20.geometry} material={materials['Camera.004']} /> <mesh name="RoomDisplayTwo001_21" geometry={nodes.RoomDisplayTwo001_21.geometry} material={materials['Walls.004']} /> <mesh name="RoomDisplayTwo001_22" geometry={nodes.RoomDisplayTwo001_22.geometry} material={materials['PaletteMaterial001.125']} /> <mesh name="RoomDisplayTwo001_23" geometry={nodes.RoomDisplayTwo001_23.geometry} material={materials['lambert7SG.007']} /> <mesh name="RoomDisplayTwo001_24" geometry={nodes.RoomDisplayTwo001_24.geometry} material={materials['Airlock.004']} /> <mesh name="RoomDisplayTwo001_25" geometry={nodes.RoomDisplayTwo001_25.geometry} material={materials['AirPipe.004']} /> <mesh name="RoomDisplayTwo001_26" geometry={nodes.RoomDisplayTwo001_26.geometry} material={materials['AmmoBox.004']} /> <mesh name="RoomDisplayTwo001_27" geometry={nodes.RoomDisplayTwo001_27.geometry} material={materials['GameBoy.012']} /> <mesh name="RoomDisplayTwo001_28" geometry={nodes.RoomDisplayTwo001_28.geometry} material={materials['TT_checker_1024x1024_UV_GRID.024']} /> <mesh name="RoomDisplayTwo001_29" geometry={nodes.RoomDisplayTwo001_29.geometry} material={materials['ARCADE.013']} /> <mesh name="RoomDisplayTwo001_30" geometry={nodes.RoomDisplayTwo001_30.geometry} material={materials['PaletteMaterial002.065']} /> <mesh name="RoomDisplayTwo001_31" geometry={nodes.RoomDisplayTwo001_31.geometry} material={materials['PaletteMaterial003.045']} /> <mesh name="RoomDisplayTwo001_32" geometry={nodes.RoomDisplayTwo001_32.geometry} material={materials['PaletteMaterial001.126']} /> <mesh name="RoomDisplayTwo001_33" geometry={nodes.RoomDisplayTwo001_33.geometry} material={materials['PaletteMaterial002.066']} /> <mesh name="RoomDisplayTwo001_34" geometry={nodes.RoomDisplayTwo001_34.geometry} material={materials['PaletteMaterial002.067']} /> <mesh name="RoomDisplayTwo001_35" geometry={nodes.RoomDisplayTwo001_35.geometry} material={materials['Stick.012']} /> <mesh name="RoomDisplayTwo001_36" geometry={nodes.RoomDisplayTwo001_36.geometry} material={materials['lowpoly.012']} /> <mesh name="RoomDisplayTwo001_37" geometry={nodes.RoomDisplayTwo001_37.geometry} material={materials['GamepadStuff.013']} /> <mesh name="RoomDisplayTwo001_38" geometry={nodes.RoomDisplayTwo001_38.geometry} material={materials['gamepadMain.013']} /> <mesh name="RoomDisplayTwo001_39" geometry={nodes.RoomDisplayTwo001_39.geometry} material={materials['TT_checker_1024x1024_UV_GRID.025']} /> <mesh name="RoomDisplayTwo001_40" geometry={nodes.RoomDisplayTwo001_40.geometry} material={materials['PaletteMaterial004.036']} /> <mesh name="RoomDisplayTwo001_41" geometry={nodes.RoomDisplayTwo001_41.geometry} material={materials['controllerbody.012']} /> <mesh name="RoomDisplayTwo001_42" geometry={nodes.RoomDisplayTwo001_42.geometry} material={materials['material.037']} /> <mesh name="RoomDisplayTwo001_43" geometry={nodes.RoomDisplayTwo001_43.geometry} material={materials['ANALOG.012']} /> <mesh name="RoomDisplayTwo001_44" geometry={nodes.RoomDisplayTwo001_44.geometry} material={materials['cstick.012']} /> <mesh name="RoomDisplayTwo001_45" geometry={nodes.RoomDisplayTwo001_45.geometry} material={materials['bumpers.012']} /> <mesh name="RoomDisplayTwo001_46" geometry={nodes.RoomDisplayTwo001_46.geometry} material={materials['PaletteMaterial001.127']} /> <mesh name="RoomDisplayTwo001_47" geometry={nodes.RoomDisplayTwo001_47.geometry} material={materials['baloon.014']} /> <mesh name="RoomDisplayTwo001_48" geometry={nodes.RoomDisplayTwo001_48.geometry} material={materials['baloon.015']} /> <mesh name="RoomDisplayTwo001_49" geometry={nodes.RoomDisplayTwo001_49.geometry} material={materials['BedFrame.004']} /> <mesh name="RoomDisplayTwo001_50" geometry={nodes.RoomDisplayTwo001_50.geometry} material={materials['BedFabrics.004']} /> <mesh name="RoomDisplayTwo001_51" geometry={nodes.RoomDisplayTwo001_51.geometry} material={materials['CeillingLamp.004']} /> <mesh name="RoomDisplayTwo001_52" geometry={nodes.RoomDisplayTwo001_52.geometry} material={materials['Chair.004']} /> <mesh name="RoomDisplayTwo001_53" geometry={nodes.RoomDisplayTwo001_53.geometry} material={materials['ChairMetal.004']} /> <mesh name="RoomDisplayTwo001_54" geometry={nodes.RoomDisplayTwo001_54.geometry} material={materials['ChineseSoldier.004']} /> <mesh name="RoomDisplayTwo001_55" geometry={nodes.RoomDisplayTwo001_55.geometry} material={materials['PaletteMaterial001.128']} /> <mesh name="RoomDisplayTwo001_56" geometry={nodes.RoomDisplayTwo001_56.geometry} material={materials['02_-_Default.005']} /> <mesh name="RoomDisplayTwo001_57" geometry={nodes.RoomDisplayTwo001_57.geometry} material={materials['04_-_Default.005']} /> <mesh name="RoomDisplayTwo001_58" geometry={nodes.RoomDisplayTwo001_58.geometry} material={materials['DecorativePanels.004']} /> <mesh name="RoomDisplayTwo001_59" geometry={nodes.RoomDisplayTwo001_59.geometry} material={materials['Door.004']} /> <mesh name="RoomDisplayTwo001_60" geometry={nodes.RoomDisplayTwo001_60.geometry} material={materials['Ventilation.004']} /> <mesh name="RoomDisplayTwo001_61" geometry={nodes.RoomDisplayTwo001_61.geometry} material={materials['Material.080']} /> <mesh name="RoomDisplayTwo001_62" geometry={nodes.RoomDisplayTwo001_62.geometry} material={materials['PaletteMaterial005.048']} /> <mesh name="RoomDisplayTwo001_63" geometry={nodes.RoomDisplayTwo001_63.geometry} material={materials['PaletteMaterial006.026']} /> <mesh name="RoomDisplayTwo001_64" geometry={nodes.RoomDisplayTwo001_64.geometry} material={materials['Keyboard.004']} /> <mesh name="RoomDisplayTwo001_65" geometry={nodes.RoomDisplayTwo001_65.geometry} material={materials['VentLeder.004']} /> <mesh name="RoomDisplayTwo001_66" geometry={nodes.RoomDisplayTwo001_66.geometry} material={materials['MonitorMouse.004']} /> <mesh name="RoomDisplayTwo001_67" geometry={nodes.RoomDisplayTwo001_67.geometry} material={materials['forMayaAOlambert16.007']} /> <mesh name="RoomDisplayTwo001_68" geometry={nodes.RoomDisplayTwo001_68.geometry} material={materials['PaletteMaterial010.015']} /> <mesh name="RoomDisplayTwo001_69" geometry={nodes.RoomDisplayTwo001_69.geometry} material={materials['Chrome_2.007']} /> <mesh name="RoomDisplayTwo001_70" geometry={nodes.RoomDisplayTwo001_70.geometry} material={materials['forMayaAOrear_lights.007']} /> <mesh name="RoomDisplayTwo001_71" geometry={nodes.RoomDisplayTwo001_71.geometry} material={materials['PaletteMaterial011.007']} /> <mesh name="RoomDisplayTwo001_72" geometry={nodes.RoomDisplayTwo001_72.geometry} material={materials['material.038']} /> <mesh name="RoomDisplayTwo001_73" geometry={nodes.RoomDisplayTwo001_73.geometry} material={materials['PaletteMaterial001.129']} /> <mesh name="RoomDisplayTwo001_74" geometry={nodes.RoomDisplayTwo001_74.geometry} material={materials['Tassels.007']} /> <mesh name="RoomDisplayTwo001_75" geometry={nodes.RoomDisplayTwo001_75.geometry} material={materials['PaletteMaterial001.130']} /> <mesh name="RoomDisplayTwo001_76" geometry={nodes.RoomDisplayTwo001_76.geometry} material={materials['Material.081']} /> <mesh name="RoomDisplayTwo001_77" geometry={nodes.RoomDisplayTwo001_77.geometry} material={materials['Glass.015']} /> <mesh name="RoomDisplayTwo001_78" geometry={nodes.RoomDisplayTwo001_78.geometry} material={materials['PaletteMaterial001.131']} /> <mesh name="RoomDisplayTwo001_79" geometry={nodes.RoomDisplayTwo001_79.geometry} material={materials['PaletteMaterial002.068']} /> <mesh name="RoomDisplayTwo001_80" geometry={nodes.RoomDisplayTwo001_80.geometry} material={materials['SVGMat.008']} /> <mesh name="RoomDisplayTwo001_81" geometry={nodes.RoomDisplayTwo001_81.geometry} material={materials['Material.082']} /> <mesh name="RoomDisplayTwo001_82" geometry={nodes.RoomDisplayTwo001_82.geometry} material={materials['default.008']} /> <mesh name="RoomDisplayTwo001_83" geometry={nodes.RoomDisplayTwo001_83.geometry} material={materials['PaletteMaterial012.007']} /> <mesh name="RoomDisplayTwo001_84" geometry={nodes.RoomDisplayTwo001_84.geometry} material={materials['equalizer.012']} /> <mesh name="RoomDisplayTwo001_85" geometry={nodes.RoomDisplayTwo001_85.geometry} material={materials['material_0.016']} /> <mesh name="RoomDisplayTwo001_86" geometry={nodes.RoomDisplayTwo001_86.geometry} material={materials['PaletteMaterial008.022']} /> <mesh name="RoomDisplayTwo001_87" geometry={nodes.RoomDisplayTwo001_87.geometry} material={materials['PaletteMaterial009.015']} /> <mesh name="RoomDisplayTwo001_88" geometry={nodes.RoomDisplayTwo001_88.geometry} material={materials['blackFabric.013']} /> <mesh name="RoomDisplayTwo001_89" geometry={nodes.RoomDisplayTwo001_89.geometry} material={materials['frontColor.012']} /> <mesh name="RoomDisplayTwo001_90" geometry={nodes.RoomDisplayTwo001_90.geometry} material={materials['blackInternal.013']} /> <mesh name="RoomDisplayTwo001_91" geometry={nodes.RoomDisplayTwo001_91.geometry} material={materials['Skin.007']} /> <mesh name="RoomDisplayTwo001_92" geometry={nodes.RoomDisplayTwo001_92.geometry} material={materials['PaletteMaterial001.132']} /> <mesh name="RoomDisplayTwo001_93" geometry={nodes.RoomDisplayTwo001_93.geometry} material={materials['Eyes.007']} /> <mesh name="RoomDisplayTwo001_94" geometry={nodes.RoomDisplayTwo001_94.geometry} material={materials['CH_NPC_Pig_MI_PJH.008']} /> <mesh name="RoomDisplayTwo001_95" geometry={nodes.RoomDisplayTwo001_95.geometry} material={materials['PaletteMaterial001.133']} /> <mesh name="RoomDisplayTwo001_96" geometry={nodes.RoomDisplayTwo001_96.geometry} material={materials['PaletteMaterial004.037']} /> </group> </group>
      </AnimatedGroup>



      <AnimatedGroup
        name="MeBitTerranium"
        groups={groups}
        setGroups={setGroups}
        onInspect={onInspect}
        analyser={analyser}
        frequencyIndices={groupNameToFrequencyIndices['MeBitTerranium']}
      >
        <group name="MeBitTerranium">
          <group position={[1, 1.95, 0.2]}> <group name="Root003" position={[-3.368, 4.653, -3.475]} rotation={[-Math.PI / 2, 0, 0]} scale={0.076} > <group name="Camera004" position={[-2.878, -0.018, 1.792]} rotation={[-0.773, 0.738, 1.971]} /> <group name="PlantAimationBalls003" position={[-0.202, -0.11, 0.085]} > <group name="SickPlantSteam002" /> <primitive object={nodes.Armature_rootJoint} /> <skinnedMesh name="SickPlantSteam_0003" geometry={nodes.SickPlantSteam_0003.geometry} material={materials['SickPlantSteam_Mat.005']} skeleton={nodes.SickPlantSteam_0003.skeleton} /> </group> </group> <group name="Carnegiea_gigantea_HD_Cactus_spines_01_0002" position={[-3.383, 4.814, -3.581]} rotation={[-Math.PI / 2, 0, -1.85]} scale={[0.163, 0.207, 0.159]} > <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001.geometry } material={materials['Cactus_spines_01.004']} /> <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_1" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_1.geometry } material={materials['Carnegiea_bark_01.005']} /> <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_2" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_2.geometry } material={materials['Carnegiea_bark_03.005']} /> <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_3" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_3.geometry } material={materials['Carnegiea_petal_01.004']} /> <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_4" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_4.geometry } material={materials['Carnegiea_petal_02.004']} /> <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_5" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_5.geometry } material={materials['Carnegiea_petal_03.004']} /> <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_6" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_6.geometry } material={materials['Carnegiea_sepal_01.004']} /> <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_7" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_7.geometry } material={materials['Carnegiea_stigma.004']} /> <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_8" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_8.geometry } material={materials['Carnegiea_flower_stalk.005']} /> <mesh name="Carnegiea_gigantea_HD_Cactus_spines_01_0001_9" geometry={ nodes.Carnegiea_gigantea_HD_Cactus_spines_01_0001_9.geometry } material={materials['Carnegiea_stamens.004']} /> </group> <mesh name="gravel_inside_0004" geometry={nodes.gravel_inside_0004.geometry} material={materials['inside.005']} position={[-3.375, 4.728, -3.534]} rotation={[-1.064, 0.476, -2.15]} scale={0.153} /> <group name="ring_low_robot_2_0002" position={[-3.365, 4.511, -3.521]} rotation={[-Math.PI / 2, 0, 0]} scale={0.27} > <mesh name="ring_low_robot_2_0001" geometry={nodes.ring_low_robot_2_0001.geometry} material={materials['robot_2.005']} /> <mesh name="ring_low_robot_2_0001_1" geometry={nodes.ring_low_robot_2_0001_1.geometry} material={materials['robot_1.005']} /> </group> <mesh name="GlassBubble002" geometry={nodes.GlassBubble002.geometry} material={materials['glass.005']} position={[-3.385, 4.815, -3.536]} rotation={[-Math.PI / 2, 0, 0]} scale={0.172} /> </group>
        </group>
      </AnimatedGroup>
      </group>
    </AudioStateContext.Provider>
  );
}

