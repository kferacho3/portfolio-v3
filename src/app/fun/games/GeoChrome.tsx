'use client';

import {
  Box,
  Cone,
  Dodecahedron,
  Html,
  Icosahedron,
  Octahedron,
  Ring,
  Sphere,
  Torus,
  TorusKnot,
} from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { proxy, useSnapshot } from 'valtio';
import { colorPalettes } from './ColorPalettes';

// ═══════════════════════════════════════════════════════════════════════════
// GAME CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const WORLD_RADIUS = 150;
const PLAYER_SPEED = 0.8;
const COLLECTION_RADIUS = 3.5;
const DEPOSIT_RADIUS = 6;
const HAZARD_RADIUS = 2.5;
const SHAPES = ['sphere', 'cube', 'torus', 'cone', 'dodecahedron', 'octahedron', 'icosahedron', 'torusKnot'] as const;
const CLUSTER_COUNT = 8;
const SHAPES_PER_CLUSTER = 12;
const DEPOSIT_COUNT = 5;
const HAZARD_COUNT = 15;

type ShapeType = (typeof SHAPES)[number];

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE (Valtio)
// ═══════════════════════════════════════════════════════════════════════════

export const geoState = proxy({
  score: 0,
  bestScore: 0,
  health: 100,
  level: 1,
  cargo: {} as Record<ShapeType, number>,
  deposited: 0,
  targetDeposits: 15,
  gameOver: false,
  paused: false,
  currentShape: 'sphere' as ShapeType,

  reset() {
    this.score = 0;
    this.health = 100;
    this.level = 1;
    this.cargo = SHAPES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {} as Record<ShapeType, number>);
    this.deposited = 0;
    this.targetDeposits = 15;
    this.gameOver = false;
    this.currentShape = 'sphere';
  },

  addCargo(shape: ShapeType) {
    this.cargo[shape] = (this.cargo[shape] || 0) + 1;
  },

  depositCargo(shape: ShapeType): boolean {
    if (this.cargo[shape] > 0) {
      this.cargo[shape]--;
      this.deposited++;
      this.score += 100 + this.level * 25;
      if (this.score > this.bestScore) this.bestScore = this.score;
      return true;
    }
    return false;
  },

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.gameOver = true;
  },

  heal(amount: number) {
    this.health = Math.min(100, this.health + amount);
  },

  nextLevel() {
    this.level++;
    this.deposited = 0;
    this.targetDeposits = 15 + this.level * 5;
    this.heal(25);
  },

  cycleShape() {
    const idx = SHAPES.indexOf(this.currentShape);
    this.currentShape = SHAPES[(idx + 1) % SHAPES.length];
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const selectRandomPalette = () => {
  const keys = Object.keys(colorPalettes);
  return colorPalettes[keys[Math.floor(Math.random() * keys.length)]];
};

const randomColor = (palette: string[]) => palette[Math.floor(Math.random() * palette.length)];

const randomShape = (): ShapeType => SHAPES[Math.floor(Math.random() * SHAPES.length)];

const sphericalToCartesian = (theta: number, phi: number, r: number): [number, number, number] => {
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
};

const cartesianToSpherical = (x: number, y: number, z: number) => {
  const r = Math.sqrt(x * x + y * y + z * z);
  return {
    theta: Math.atan2(z, x),
    phi: Math.acos(y / r),
    r,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// SHADER MATERIALS (Using codebase patterns)
// ═══════════════════════════════════════════════════════════════════════════

const IridescentMaterial: React.FC<{ color: string }> = ({ color }) => {
  const ref = useRef<THREE.MeshPhysicalMaterial>(null);
  
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * 0.3;
    ref.current.iridescence = 0.9 + 0.1 * Math.sin(t * 2);
  });
  
  return (
    <meshPhysicalMaterial
      ref={ref}
      color={color}
      metalness={0.1}
      roughness={0.15}
      clearcoat={1.0}
      clearcoatRoughness={0.1}
      iridescence={1.0}
      iridescenceIOR={1.3}
      iridescenceThicknessRange={[100, 400]}
      side={THREE.DoubleSide}
    />
  );
};

const NeonGlowMaterial: React.FC<{ color: string; glowColor: string }> = ({ color, glowColor }) => {
  const ref = useRef<THREE.ShaderMaterial>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(color) },
    uGlowColor: { value: new THREE.Color(glowColor) },
    uGlowIntensity: { value: 2.5 },
    uGlowPower: { value: 2.5 },
  }), [color, glowColor]);
  
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });
  
  return (
    <shaderMaterial
      ref={ref}
      uniforms={uniforms}
      vertexShader={`
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `}
      fragmentShader={`
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uGlowColor;
        uniform float uGlowIntensity;
        uniform float uGlowPower;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = 1.0 - abs(dot(normal, viewDir));
          fresnel = pow(fresnel, uGlowPower);
          float pulse = 0.5 + 0.5 * sin(uTime * 2.0);
          vec3 animatedGlow = uGlowColor * (0.8 + 0.2 * pulse);
          vec3 color = uBaseColor + animatedGlow * fresnel * uGlowIntensity;
          gl_FragColor = vec4(color, 1.0);
        }
      `}
      side={THREE.DoubleSide}
    />
  );
};

const HolographicMaterial: React.FC<{ baseColor: string }> = ({ baseColor }) => {
  const ref = useRef<THREE.ShaderMaterial>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(baseColor) },
    uColor2: { value: new THREE.Color('#00ffff') },
    uColor3: { value: new THREE.Color('#ff00ff') },
  }), [baseColor]);
  
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });
  
  return (
    <shaderMaterial
      ref={ref}
      uniforms={uniforms}
      transparent
      vertexShader={`
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `}
      fragmentShader={`
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
          float scanline = sin(vPosition.y * 30.0 + uTime * 5.0) * 0.5 + 0.5;
          float rainbow = sin(vPosition.x * 10.0 + uTime * 2.0) * 0.5 + 0.5;
          vec3 color = mix(uColor1, uColor2, rainbow);
          color = mix(color, uColor3, fresnel);
          color += vec3(0.3) * scanline * fresnel;
          gl_FragColor = vec4(color, 0.85 + fresnel * 0.15);
        }
      `}
      side={THREE.DoubleSide}
    />
  );
};

const CrystalMaterial: React.FC<{ color: string }> = ({ color }) => {
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={0.0}
      roughness={0.0}
      transmission={0.95}
      thickness={1.5}
      ior={2.4}
      clearcoat={1}
      clearcoatRoughness={0}
      side={THREE.DoubleSide}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE COMPONENT - Renders different geometries with materials
// ═══════════════════════════════════════════════════════════════════════════

interface GameShapeProps {
  type: ShapeType;
  color: string;
  scale?: number;
  materialType?: 'standard' | 'iridescent' | 'neon' | 'holographic' | 'crystal';
  glowColor?: string;
}

const GameShape: React.FC<GameShapeProps> = ({ 
  type, 
  color, 
  scale = 1, 
  materialType = 'standard',
  glowColor = '#00ffff' 
}) => {
  const renderMaterial = () => {
    switch (materialType) {
      case 'iridescent':
        return <IridescentMaterial color={color} />;
      case 'neon':
        return <NeonGlowMaterial color={color} glowColor={glowColor} />;
      case 'holographic':
        return <HolographicMaterial baseColor={color} />;
      case 'crystal':
        return <CrystalMaterial color={color} />;
      default:
        return (
          <meshStandardMaterial 
            color={color} 
            emissive={color} 
            emissiveIntensity={0.3}
            metalness={0.4}
            roughness={0.3}
          />
        );
    }
  };

  const shapes: Record<ShapeType, JSX.Element> = {
    sphere: <Sphere args={[0.8 * scale, 32, 32]}>{renderMaterial()}</Sphere>,
    cube: <Box args={[1.2 * scale, 1.2 * scale, 1.2 * scale]}>{renderMaterial()}</Box>,
    torus: <Torus args={[0.6 * scale, 0.25 * scale, 16, 32]}>{renderMaterial()}</Torus>,
    cone: <Cone args={[0.7 * scale, 1.4 * scale, 32]}>{renderMaterial()}</Cone>,
    dodecahedron: <Dodecahedron args={[0.8 * scale]}>{renderMaterial()}</Dodecahedron>,
    octahedron: <Octahedron args={[0.9 * scale]}>{renderMaterial()}</Octahedron>,
    icosahedron: <Icosahedron args={[0.8 * scale]}>{renderMaterial()}</Icosahedron>,
    torusKnot: <TorusKnot args={[0.5 * scale, 0.15 * scale, 64, 16]}>{renderMaterial()}</TorusKnot>,
  };

  return shapes[type];
};

// ═══════════════════════════════════════════════════════════════════════════
// CLUSTER PATTERNS - Symmetrical and therapeutic arrangements
// ═══════════════════════════════════════════════════════════════════════════

type ClusterPattern = 'spiral' | 'mandala' | 'ring' | 'fibonacci' | 'flower' | 'wave' | 'helix' | 'grid';

interface ClusterShapeData {
  id: string;
  type: ShapeType;
  localPosition: [number, number, number];
  color: string;
  scale: number;
  collected: boolean;
  materialType: 'standard' | 'iridescent' | 'neon' | 'holographic' | 'crystal';
}

interface ClusterData {
  id: string;
  pattern: ClusterPattern;
  worldPosition: [number, number, number];
  rotation: number;
  shapes: ClusterShapeData[];
  palette: string[];
}

const generateClusterShapes = (
  pattern: ClusterPattern, 
  count: number, 
  palette: string[]
): ClusterShapeData[] => {
  const shapes: ClusterShapeData[] = [];
  const materials: Array<'standard' | 'iridescent' | 'neon' | 'holographic' | 'crystal'> = 
    ['standard', 'iridescent', 'neon', 'holographic', 'crystal'];

  for (let i = 0; i < count; i++) {
    let pos: [number, number, number];
    const angle = (i / count) * Math.PI * 2;
    const radius = 3 + Math.random() * 2;
    
    switch (pattern) {
      case 'spiral': {
        const spiralAngle = angle * 3;
        const spiralRadius = (i / count) * 6 + 1;
        pos = [
          Math.cos(spiralAngle) * spiralRadius,
          Math.sin(i * 0.5) * 2,
          Math.sin(spiralAngle) * spiralRadius,
        ];
        break;
      }
      case 'mandala': {
        const layer = Math.floor(i / 6);
        const layerAngle = (i % 6) / 6 * Math.PI * 2 + layer * 0.5;
        const layerRadius = (layer + 1) * 2;
        pos = [
          Math.cos(layerAngle) * layerRadius,
          Math.sin(layer * Math.PI / 3) * 0.5,
          Math.sin(layerAngle) * layerRadius,
        ];
        break;
      }
      case 'ring': {
        pos = [
          Math.cos(angle) * radius,
          Math.sin(angle * 2) * 0.8,
          Math.sin(angle) * radius,
        ];
        break;
      }
      case 'fibonacci': {
        const golden = (1 + Math.sqrt(5)) / 2;
        const fibAngle = i * golden * Math.PI * 2;
        const fibRadius = Math.sqrt(i) * 1.2;
        pos = [
          Math.cos(fibAngle) * fibRadius,
          Math.sin(fibAngle * 0.5) * 1,
          Math.sin(fibAngle) * fibRadius,
        ];
        break;
      }
      case 'flower': {
        const petals = 6;
        const petalAngle = angle;
        const petalRadius = 3 + Math.cos(petalAngle * petals) * 2;
        pos = [
          Math.cos(petalAngle) * petalRadius,
          Math.sin(petalAngle * petals) * 0.5,
          Math.sin(petalAngle) * petalRadius,
        ];
        break;
      }
      case 'wave': {
        const waveX = (i / count) * 10 - 5;
        pos = [
          waveX,
          Math.sin(waveX * 1.5) * 2,
          Math.cos(waveX * 1.5) * 2,
        ];
        break;
      }
      case 'helix': {
        const helixAngle = (i / count) * Math.PI * 4;
        const helixY = (i / count) * 8 - 4;
        pos = [
          Math.cos(helixAngle) * 3,
          helixY,
          Math.sin(helixAngle) * 3,
        ];
        break;
      }
      case 'grid': {
        const gridSize = Math.ceil(Math.sqrt(count));
        const gx = (i % gridSize) - gridSize / 2;
        const gz = Math.floor(i / gridSize) - gridSize / 2;
        pos = [gx * 2, Math.sin(gx + gz) * 0.5, gz * 2];
        break;
      }
      default:
        pos = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
    }

    shapes.push({
      id: `shape-${i}-${Math.random().toString(36).slice(2, 8)}`,
      type: randomShape(),
      localPosition: pos,
      color: randomColor(palette),
      scale: 0.6 + Math.random() * 0.4,
      collected: false,
      materialType: materials[Math.floor(Math.random() * materials.length)],
    });
  }

  return shapes;
};

const generateClusters = (count: number): ClusterData[] => {
  const clusters: ClusterData[] = [];
  const patterns: ClusterPattern[] = ['spiral', 'mandala', 'ring', 'fibonacci', 'flower', 'wave', 'helix', 'grid'];

  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const phi = Math.PI / 4 + Math.random() * Math.PI / 2;
    const palette = selectRandomPalette();

    clusters.push({
      id: `cluster-${i}`,
      pattern: patterns[i % patterns.length],
      worldPosition: sphericalToCartesian(theta, phi, WORLD_RADIUS),
      rotation: Math.random() * Math.PI * 2,
      shapes: generateClusterShapes(patterns[i % patterns.length], SHAPES_PER_CLUSTER, palette),
      palette,
    });
  }

  return clusters;
};

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTIBLE SHAPE CLUSTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ShapeClusterProps {
  cluster: ClusterData;
  playerPosition: THREE.Vector3;
  onCollect: (clusterId: string, shapeId: string, shapeType: ShapeType) => void;
}

const ShapeCluster: React.FC<ShapeClusterProps> = ({ cluster, playerPosition, onCollect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const shapeRefs = useRef<Map<string, THREE.Group>>(new Map());
  
  // Rotate cluster slowly
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
    }
    
    // Check collisions for each uncollected shape
    cluster.shapes.forEach((shape) => {
      if (shape.collected) return;
      
      const shapeRef = shapeRefs.current.get(shape.id);
      if (!shapeRef) return;
      
      const worldPos = new THREE.Vector3();
      shapeRef.getWorldPosition(worldPos);
      
      if (playerPosition.distanceTo(worldPos) < COLLECTION_RADIUS) {
        onCollect(cluster.id, shape.id, shape.type);
      }
    });
  });

  // Orient cluster to face outward from sphere center
  const lookAtCenter = useMemo(() => {
    const pos = new THREE.Vector3(...cluster.worldPosition);
    return pos.normalize().multiplyScalar(-1);
  }, [cluster.worldPosition]);

  return (
    <group 
      ref={groupRef}
      position={cluster.worldPosition}
      rotation={[0, cluster.rotation, 0]}
    >
      {cluster.shapes.map((shape) => (
        !shape.collected && (
          <group 
            key={shape.id} 
            position={shape.localPosition}
            ref={(el) => {
              if (el) shapeRefs.current.set(shape.id, el);
            }}
          >
            <GameShape 
              type={shape.type} 
              color={shape.color} 
              scale={shape.scale}
              materialType={shape.materialType}
              glowColor={shape.color}
            />
          </group>
        )
      ))}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DEPOSIT GATE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface DepositGate {
  id: string;
  shape: ShapeType;
  position: [number, number, number];
  color: string;
}

const generateDeposits = (count: number): DepositGate[] => {
  const deposits: DepositGate[] = [];
  const usedShapes = new Set<ShapeType>();
  
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const phi = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    
    let shape = randomShape();
    while (usedShapes.has(shape) && usedShapes.size < SHAPES.length) {
      shape = randomShape();
    }
    usedShapes.add(shape);
    
    const palette = selectRandomPalette();
    
    deposits.push({
      id: `deposit-${i}`,
      shape,
      position: sphericalToCartesian(theta, phi, WORLD_RADIUS),
      color: randomColor(palette),
    });
  }
  
  return deposits;
};

interface DepositGateComponentProps {
  deposit: DepositGate;
  playerPosition: THREE.Vector3;
  playerShape: ShapeType;
  onDeposit: (depositId: string, shape: ShapeType) => boolean;
}

const DepositGateComponent: React.FC<DepositGateComponentProps> = ({
  deposit,
  playerPosition,
  playerShape,
  onDeposit,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [pulseScale, setPulseScale] = useState(1);
  const lastDepositTime = useRef(0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    // Pulse animation
    const t = clock.getElapsedTime();
    setPulseScale(1 + Math.sin(t * 3) * 0.1);
    
    // Rotate ring
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.02;
    }
    
    // Check deposit collision
    const gatePos = new THREE.Vector3(...deposit.position);
    const dist = playerPosition.distanceTo(gatePos);
    
    if (dist < DEPOSIT_RADIUS && playerShape === deposit.shape) {
      const now = clock.getElapsedTime();
      if (now - lastDepositTime.current > 0.5) {
        if (onDeposit(deposit.id, deposit.shape)) {
          lastDepositTime.current = now;
        }
      }
    }
  });

  const isMatching = playerShape === deposit.shape;

  return (
    <group ref={groupRef} position={deposit.position}>
      {/* Outer ring indicator */}
      <Ring
        ref={ringRef}
        args={[4, 5, 32]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial 
          color={isMatching ? '#00ff88' : deposit.color}
          emissive={isMatching ? '#00ff88' : deposit.color}
          emissiveIntensity={isMatching ? 1 : 0.3}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </Ring>
      
      {/* Inner shape indicator */}
      <group scale={[pulseScale * 1.5, pulseScale * 1.5, pulseScale * 1.5]}>
        <GameShape 
          type={deposit.shape} 
          color={deposit.color}
          materialType={isMatching ? 'neon' : 'holographic'}
          glowColor={isMatching ? '#00ff88' : deposit.color}
        />
      </group>
      
      {/* Beacon light */}
      <pointLight 
        color={isMatching ? '#00ff88' : deposit.color} 
        intensity={isMatching ? 3 : 1} 
        distance={20}
      />
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HAZARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface Hazard {
  id: string;
  position: [number, number, number];
  velocity: THREE.Vector3;
  type: 'spike' | 'orb' | 'ring' | 'pulse';
}

const generateHazards = (count: number): Hazard[] => {
  const types: Hazard['type'][] = ['spike', 'orb', 'ring', 'pulse'];
  
  return Array.from({ length: count }, (_, i) => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.PI / 4 + Math.random() * Math.PI / 2;
    
    return {
      id: `hazard-${i}`,
      position: sphericalToCartesian(theta, phi, WORLD_RADIUS),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
      type: types[Math.floor(Math.random() * types.length)],
    };
  });
};

interface HazardComponentProps {
  hazard: Hazard;
  playerPosition: THREE.Vector3;
  onHit: () => void;
}

const HazardComponent: React.FC<HazardComponentProps> = ({ hazard, playerPosition, onHit }) => {
  const meshRef = useRef<THREE.Group>(null);
  const lastHitTime = useRef(0);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    // Animate hazard
    const t = clock.getElapsedTime();
    meshRef.current.rotation.x += 0.03;
    meshRef.current.rotation.y += 0.02;
    
    // Pulse effect for 'pulse' type
    if (hazard.type === 'pulse') {
      const scale = 1 + Math.sin(t * 4) * 0.3;
      meshRef.current.scale.setScalar(scale);
    }
    
    // Move hazard slightly
    const pos = meshRef.current.position;
    pos.add(hazard.velocity);
    
    // Keep on sphere surface
    const r = pos.length();
    pos.normalize().multiplyScalar(WORLD_RADIUS);
    
    // Bounce velocity occasionally
    if (Math.random() < 0.01) {
      hazard.velocity.set(
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03
      );
    }
    
    // Check collision
    if (playerPosition.distanceTo(pos) < HAZARD_RADIUS) {
      const now = t;
      if (now - lastHitTime.current > 1) {
        onHit();
        lastHitTime.current = now;
      }
    }
  });

  const renderHazard = () => {
    switch (hazard.type) {
      case 'spike':
        return (
          <Octahedron args={[1.5]}>
            <meshStandardMaterial 
              color="#ff3366" 
              emissive="#ff0044" 
              emissiveIntensity={0.8}
              metalness={0.8}
              roughness={0.2}
            />
          </Octahedron>
        );
      case 'orb':
        return (
          <Sphere args={[1.2, 16, 16]}>
            <NeonGlowMaterial color="#330011" glowColor="#ff0044" />
          </Sphere>
        );
      case 'ring':
        return (
          <Torus args={[1.2, 0.4, 16, 32]}>
            <meshStandardMaterial 
              color="#ff2200" 
              emissive="#ff4400" 
              emissiveIntensity={0.6}
            />
          </Torus>
        );
      case 'pulse':
        return (
          <Icosahedron args={[1]}>
            <meshStandardMaterial 
              color="#ff0066" 
              emissive="#ff0088" 
              emissiveIntensity={1}
              transparent
              opacity={0.8}
            />
          </Icosahedron>
        );
      default:
        return null;
    }
  };

  return (
    <group ref={meshRef} position={hazard.position}>
      {renderHazard()}
      <pointLight color="#ff0044" intensity={1} distance={8} />
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PlayerProps {
  position: THREE.Vector3;
  onMove: (pos: THREE.Vector3) => void;
}

const Player: React.FC<PlayerProps> = ({ position, onMove }) => {
  const snap = useSnapshot(geoState);
  const meshRef = useRef<THREE.Group>(null);
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const velocityRef = useRef(new THREE.Vector3());
  
  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key as keyof typeof keysRef.current] = true;
      if (key === ' ' || key === 'e') geoState.cycleShape();
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key as keyof typeof keysRef.current] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame(({ camera }) => {
    if (!meshRef.current || snap.gameOver || snap.paused) return;
    
    // Get input direction
    const inputDir = new THREE.Vector3();
    if (keysRef.current.w) inputDir.z -= 1;
    if (keysRef.current.s) inputDir.z += 1;
    if (keysRef.current.a) inputDir.x -= 1;
    if (keysRef.current.d) inputDir.x += 1;
    
    if (inputDir.length() > 0) {
      inputDir.normalize();
      
      // Transform input relative to camera view
      const cameraDir = new THREE.Vector3();
      camera.getWorldDirection(cameraDir);
      cameraDir.y = 0;
      cameraDir.normalize();
      
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), cameraDir).normalize();
      
      const moveDir = new THREE.Vector3()
        .addScaledVector(cameraDir, -inputDir.z)
        .addScaledVector(right, inputDir.x)
        .normalize()
        .multiplyScalar(PLAYER_SPEED);
      
      // Apply velocity with damping
      velocityRef.current.lerp(moveDir, 0.15);
    } else {
      velocityRef.current.multiplyScalar(0.9);
    }
    
    // Update position on sphere surface
    const newPos = position.clone().add(velocityRef.current);
    newPos.normalize().multiplyScalar(WORLD_RADIUS);
    
    position.copy(newPos);
    meshRef.current.position.copy(position);
    
    // Orient player to stand on sphere
    const up = position.clone().normalize();
    meshRef.current.up.copy(up);
    const lookTarget = position.clone().add(velocityRef.current.length() > 0.01 ? velocityRef.current : cameraDir);
    lookTarget.normalize().multiplyScalar(WORLD_RADIUS);
    meshRef.current.lookAt(lookTarget);
    
    onMove(position);
  });

  return (
    <group ref={meshRef} position={position.toArray()}>
      {/* Player shape indicator */}
      <group scale={[1.5, 1.5, 1.5]}>
        <GameShape 
          type={snap.currentShape} 
          color="#00d4ff" 
          materialType="neon"
          glowColor="#00ffff"
        />
      </group>
      
      {/* Trail particles */}
      <pointLight color="#00d4ff" intensity={2} distance={15} />
      
      {/* Cargo indicator ring */}
      <Ring args={[2, 2.3, 32]} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <meshBasicMaterial color="#00ffaa" transparent opacity={0.5} side={THREE.DoubleSide} />
      </Ring>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED CAMERA SYSTEM - Bird's Eye View with smooth follow
// ═══════════════════════════════════════════════════════════════════════════

interface CameraControllerProps {
  playerPosition: THREE.Vector3;
}

const CameraController: React.FC<CameraControllerProps> = ({ playerPosition }) => {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3());
  const velocityRef = useRef(new THREE.Vector3());
  const offsetRef = useRef(new THREE.Vector3());
  
  useFrame((_, delta) => {
    // Calculate ideal camera position - bird's eye view looking down at player
    const playerUp = playerPosition.clone().normalize();
    const playerForward = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(playerUp, Math.atan2(playerPosition.x, playerPosition.z));
    
    // Camera offset: above and behind the player
    const cameraHeight = 40;
    const cameraDistance = 30;
    
    const idealPosition = playerPosition.clone()
      .add(playerUp.clone().multiplyScalar(cameraHeight))
      .sub(playerForward.clone().multiplyScalar(cameraDistance));
    
    // Smooth camera movement with spring physics
    const springStrength = 4;
    const damping = 0.8;
    
    targetRef.current.copy(idealPosition);
    
    const acceleration = targetRef.current.clone()
      .sub(camera.position)
      .multiplyScalar(springStrength);
    
    velocityRef.current.add(acceleration.multiplyScalar(delta));
    velocityRef.current.multiplyScalar(damping);
    
    camera.position.add(velocityRef.current.clone().multiplyScalar(delta * 60));
    
    // Look at player with slight lead based on velocity
    const lookTarget = playerPosition.clone();
    camera.lookAt(lookTarget);
    
    // Cinematic roll based on player movement
    const roll = Math.sin(Date.now() * 0.0005) * 0.02;
    camera.rotation.z += roll;
  });

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// WORLD SURFACE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const WorldSurface: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0002;
    }
  });

  return (
    <group>
      {/* Main sphere */}
      <Sphere ref={meshRef} args={[WORLD_RADIUS - 0.5, 128, 128]}>
        <meshStandardMaterial 
          color="#0a0a1a"
          metalness={0.2}
          roughness={0.8}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Wireframe grid overlay */}
      <Sphere args={[WORLD_RADIUS - 0.3, 48, 48]}>
        <meshBasicMaterial 
          color="#1a1a3a"
          wireframe
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Inner glow */}
      <Sphere args={[WORLD_RADIUS - 2, 32, 32]}>
        <meshBasicMaterial 
          color="#0f0f2f"
          transparent
          opacity={0.5}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HUD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const HUD: React.FC = () => {
  const snap = useSnapshot(geoState);
  const totalCargo = Object.values(snap.cargo).reduce((a, b) => a + b, 0);

  return (
    <Html fullscreen>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Left panel - Stats */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          padding: '1rem 1.5rem',
          borderRadius: '1rem',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          color: 'white',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00d4ff' }}>
            Level {snap.level}
          </div>
          <div style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
            Score: <span style={{ color: '#00ffaa' }}>{snap.score}</span>
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
            Best: {snap.bestScore}
          </div>
          
          {/* Health bar */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Health</div>
            <div style={{
              width: '150px',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${snap.health}%`,
                height: '100%',
                background: snap.health > 50 ? '#00ff88' : snap.health > 25 ? '#ffaa00' : '#ff4444',
                transition: 'width 0.3s, background 0.3s',
              }} />
            </div>
          </div>
          
          {/* Deposit progress */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              Deposits: {snap.deposited}/{snap.targetDeposits}
            </div>
            <div style={{
              width: '150px',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${(snap.deposited / snap.targetDeposits) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #00d4ff, #00ffaa)',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        </div>

        {/* Right panel - Current shape and cargo */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          padding: '1rem 1.5rem',
          borderRadius: '1rem',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          color: 'white',
          textAlign: 'right',
        }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem' }}>
            Current Shape
          </div>
          <div style={{ 
            fontSize: '1.2rem', 
            fontWeight: 'bold', 
            color: '#00d4ff',
            textTransform: 'capitalize',
          }}>
            {snap.currentShape}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.25rem' }}>
            Press SPACE to cycle
          </div>
          
          <div style={{ 
            marginTop: '1rem',
            fontSize: '0.9rem',
            opacity: 0.9,
          }}>
            Cargo: <span style={{ color: '#ffaa00' }}>{totalCargo}</span> shapes
          </div>
          
          {/* Cargo breakdown */}
          {totalCargo > 0 && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              opacity: 0.7,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.2rem',
            }}>
              {SHAPES.map((shape) => 
                snap.cargo[shape] > 0 && (
                  <div key={shape} style={{ textTransform: 'capitalize' }}>
                    {shape}: {snap.cargo[shape]}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls hint */}
      <div style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(10px)',
        padding: '0.5rem 1.5rem',
        borderRadius: '2rem',
        color: 'white',
        fontSize: '0.8rem',
        opacity: 0.7,
        pointerEvents: 'none',
      }}>
        WASD - Move | SPACE - Cycle Shape | R - Restart
      </div>

      {/* Game Over overlay */}
      {snap.gameOver && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}>
          <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#ff4444' }}>
            GAME OVER
          </div>
          <div style={{ fontSize: '1.5rem', marginTop: '1rem' }}>
            Final Score: <span style={{ color: '#00d4ff' }}>{snap.score}</span>
          </div>
          <div style={{ fontSize: '1rem', marginTop: '0.5rem', opacity: 0.7 }}>
            Level Reached: {snap.level}
          </div>
          <button
            onClick={() => geoState.reset()}
            style={{
              marginTop: '2rem',
              padding: '1rem 2rem',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #00d4ff, #00ffaa)',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#000',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            Play Again
          </button>
        </div>
      )}
    </Html>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GEOCHROME COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const GeoChrome: React.FC = () => {
  const snap = useSnapshot(geoState);
  const { scene } = useThree();
  
  const [clusters, setClusters] = useState<ClusterData[]>(() => generateClusters(CLUSTER_COUNT));
  const [deposits, setDeposits] = useState<DepositGate[]>(() => generateDeposits(DEPOSIT_COUNT));
  const [hazards, setHazards] = useState<Hazard[]>(() => generateHazards(HAZARD_COUNT));
  const [gameKey, setGameKey] = useState(0);
  
  const playerPosition = useRef(new THREE.Vector3(0, WORLD_RADIUS, 0));

  // Setup scene
  useEffect(() => {
    scene.background = new THREE.Color('#050510');
    scene.fog = new THREE.FogExp2('#050510', 0.003);
    
    // Initialize game state
    geoState.reset();
  }, [scene]);

  // Handle restart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        geoState.reset();
        setClusters(generateClusters(CLUSTER_COUNT));
        setDeposits(generateDeposits(DEPOSIT_COUNT));
        setHazards(generateHazards(HAZARD_COUNT));
        playerPosition.current.set(0, WORLD_RADIUS, 0);
        setGameKey(k => k + 1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check level completion
  useEffect(() => {
    if (snap.deposited >= snap.targetDeposits) {
      geoState.nextLevel();
      
      // Regenerate world for new level
      setClusters(generateClusters(CLUSTER_COUNT + snap.level));
      setDeposits(generateDeposits(DEPOSIT_COUNT));
      setHazards(generateHazards(HAZARD_COUNT + snap.level * 2));
    }
  }, [snap.deposited, snap.targetDeposits, snap.level]);

  // Handle shape collection
  const handleCollect = useCallback((clusterId: string, shapeId: string, shapeType: ShapeType) => {
    setClusters(prev => prev.map(cluster => {
      if (cluster.id !== clusterId) return cluster;
      return {
        ...cluster,
        shapes: cluster.shapes.map(shape => {
          if (shape.id !== shapeId) return shape;
          geoState.addCargo(shapeType);
          geoState.score += 10;
          if (geoState.score > geoState.bestScore) geoState.bestScore = geoState.score;
          return { ...shape, collected: true };
        }),
      };
    }));
  }, []);

  // Handle deposit
  const handleDeposit = useCallback((depositId: string, shape: ShapeType): boolean => {
    return geoState.depositCargo(shape);
  }, []);

  // Handle hazard hit
  const handleHazardHit = useCallback(() => {
    geoState.takeDamage(15);
  }, []);

  // Handle player movement
  const handlePlayerMove = useCallback((pos: THREE.Vector3) => {
    playerPosition.current.copy(pos);
  }, []);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[100, 100, 100]} intensity={1} color="#fff8e0" />
      <pointLight position={[-100, -50, 100]} intensity={0.5} color="#4080ff" />
      <pointLight position={[0, 0, 0]} intensity={0.3} color="#00ffaa" />
      
      {/* World surface */}
      <WorldSurface />
      
      {/* Camera controller */}
      <CameraController playerPosition={playerPosition.current} />
      
      {/* Player */}
      <Player 
        key={gameKey}
        position={playerPosition.current} 
        onMove={handlePlayerMove}
      />
      
      {/* Shape clusters */}
      {clusters.map(cluster => (
        <ShapeCluster
          key={cluster.id}
          cluster={cluster}
          playerPosition={playerPosition.current}
          onCollect={handleCollect}
        />
      ))}
      
      {/* Deposit gates */}
      {deposits.map(deposit => (
        <DepositGateComponent
          key={deposit.id}
          deposit={deposit}
          playerPosition={playerPosition.current}
          playerShape={snap.currentShape}
          onDeposit={handleDeposit}
        />
      ))}
      
      {/* Hazards */}
      {hazards.map(hazard => (
        <HazardComponent
          key={hazard.id}
          hazard={hazard}
          playerPosition={playerPosition.current}
          onHit={handleHazardHit}
        />
      ))}
      
      {/* HUD */}
      <HUD />
    </>
  );
};

export default GeoChrome;
