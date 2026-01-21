import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import React, { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { WALL_MODE_HEIGHT, WALL_MODE_WALL_Z, WALL_MODE_WIDTH } from '../../constants';
import { reactPongState } from '../../state';
import type { WallZone } from '../../types';

interface OpposingWallProps {
  ballRef: React.MutableRefObject<RapierRigidBody | null>;
}

const OpposingWall: React.FC<OpposingWallProps> = ({ ballRef }) => {
  const { wallMode } = useSnapshot(reactPongState);
  const config = wallMode.currentLevelConfig;
  const zones = wallMode.wallZones;

  const wallWidth = WALL_MODE_WIDTH;
  const wallHeight = WALL_MODE_HEIGHT;
  const wallZ = WALL_MODE_WALL_Z;
  const wallThickness = 0.6;

  const movingPanelRefs = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    if (config.hasMovingPanels) {
      movingPanelRefs.current.forEach((panel, i) => {
        if (panel) {
          const speed = 0.5 + i * 0.2;
          const amplitude = 2 + i;
          panel.position.x = Math.sin(clock.getElapsedTime() * speed) * amplitude;
        }
      });
    }
  });

  const handleWallHit = useCallback(() => {
    const ballPos = ballRef.current?.translation();
    const ballVel = ballRef.current?.linvel();
    if (!ballPos || !ballVel) return;

    let hitZone: WallZone | undefined;
    for (const zone of zones) {
      const dx = Math.abs(ballPos.x - zone.position[0]);
      const dy = Math.abs(ballPos.y - zone.position[1]);
      if (dx < zone.size[0] / 2 && dy < zone.size[1] / 2) {
        hitZone = zone;
        break;
      }
    }

    let newVelX = ballVel.x;
    let newVelY = ballVel.y;
    let newVelZ = Math.abs(ballVel.z);
    let speedScale = 1;

    if (hitZone) {
      switch (hitZone.type) {
        case 'speed':
          speedScale = hitZone.effect;
          break;
        case 'spin':
          ballRef.current?.setAngvel({ x: hitZone.effect * 4, y: 0, z: hitZone.effect * 6 }, true);
          newVelX += (Math.random() - 0.5) * hitZone.effect * 2;
          newVelY += (Math.random() - 0.5) * hitZone.effect * 2;
          break;
        case 'bounce':
          newVelX *= hitZone.effect;
          newVelY *= hitZone.effect;
          break;
        case 'hazard': {
          const angle = (Math.random() - 0.5) * Math.PI * 0.7;
          const speed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y + ballVel.z * ballVel.z);
          newVelX = Math.sin(angle) * speed * 0.6;
          newVelY = Math.cos(angle) * speed * 0.6;
          break;
        }
        case 'target':
          break;
      }
    }

    const result = reactPongState.wallModeHitWall(hitZone?.type, reactPongState.wallMode.lastCatchWasPerfect);
    const targetSpeed = Math.min(
      reactPongState.wallMode.maxSpeed,
      reactPongState.wallMode.currentSpeed * speedScale
    );
    const direction = new THREE.Vector3(newVelX, newVelY, newVelZ).normalize();
    ballRef.current?.setLinvel(
      {
        x: direction.x * targetSpeed,
        y: direction.y * targetSpeed,
        z: direction.z * targetSpeed,
      },
      true
    );

    reactPongState.addScorePopup(
      result.score,
      [ballPos.x, ballPos.y, ballPos.z],
      hitZone?.type === 'target' ? '#ffff00' : hitZone?.type === 'hazard' ? '#ff0000' : '#00d4ff',
      result.combo.name || undefined
    );
    reactPongState.addHitEffect(
      [ballPos.x, ballPos.y, ballPos.z],
      hitZone?.type === 'target' ? '#ffff00' : '#4080ff',
      1
    );

    const sound = reactPongState.audio.wallHitSound;
    if (sound) {
      try {
        sound.currentTime = 0;
        sound.volume = 0.6;
        void sound.play().catch(() => {});
      } catch {}
    }
  }, [zones, ballRef]);

  const getZoneColor = (type: string) => {
    switch (type) {
      case 'speed':
        return '#ff8800';
      case 'spin':
        return '#00ff88';
      case 'bounce':
        return '#8800ff';
      case 'target':
        return '#ffff00';
      case 'hazard':
        return '#ff0044';
      default:
        return '#4080ff';
    }
  };

  return (
    <>
      <RigidBody type="fixed" position={[0, 0, wallZ]} onCollisionEnter={handleWallHit}>
        <CuboidCollider args={[wallWidth / 2, wallHeight / 2, wallThickness / 2]} restitution={1} friction={0} />
        <mesh>
          <boxGeometry args={[wallWidth, wallHeight, wallThickness]} />
          <meshStandardMaterial
            color="#4080ff"
            emissive="#4080ff"
            emissiveIntensity={0.4}
            transparent
            opacity={0.7}
          />
        </mesh>
      </RigidBody>

      {zones.map((zone) => (
        <mesh
          key={zone.id}
          position={[zone.position[0], zone.position[1], wallZ + wallThickness / 2 + 0.05]}
        >
          <boxGeometry args={[zone.size[0], zone.size[1], 0.2]} />
          <meshStandardMaterial
            color={getZoneColor(zone.type)}
            emissive={getZoneColor(zone.type)}
            emissiveIntensity={zone.type === 'target' ? 0.8 : 0.5}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}

      {zones
        .filter((zone) => zone.type !== 'hazard')
        .map((zone) => (
          <Text
            key={`label-${zone.id}`}
            position={[zone.position[0], zone.position[1], wallZ + wallThickness / 2 + 0.2]}
            fontSize={0.3}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {zone.type.toUpperCase()}
          </Text>
        ))}

      {config.hasMovingPanels && (
        <>
          <mesh
            ref={(el) => {
              if (el) movingPanelRefs.current[0] = el;
            }}
            position={[0, -wallHeight / 4, wallZ + wallThickness / 2 + 0.2]}
          >
            <boxGeometry args={[3, 0.5, 0.3]} />
            <meshStandardMaterial color="#ff4080" emissive="#ff4080" emissiveIntensity={0.5} />
          </mesh>
          <mesh
            ref={(el) => {
              if (el) movingPanelRefs.current[1] = el;
            }}
            position={[0, -wallHeight / 2 + 1.2, wallZ + wallThickness / 2 + 0.2]}
          >
            <boxGeometry args={[2.5, 0.5, 0.3]} />
            <meshStandardMaterial color="#40ff80" emissive="#40ff80" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}

      <pointLight position={[0, 0, wallZ + 2]} color="#4080ff" intensity={0.6} distance={15} />
    </>
  );
};

export default OpposingWall;
