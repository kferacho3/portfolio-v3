import { Trail } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Z,
  CURVE_LANE_DAMPING,
  CURVE_LANE_OFFSET,
  LEVEL_DISTANCE,
  MODE_SETTINGS,
  SPIRAL_FORWARD_DRIFT,
  SPIRAL_INWARD_DRIFT,
  SPIRAL_MAX_RADIUS,
  SPIRAL_MIN_RADIUS,
  SPIRAL_OUTWARD_DRIFT,
  SPIRAL_OUTER_PULL,
  SPIRAL_TURN_RATE,
  GRAVITY,
  REMOVAL_Y,
  SPEED_INCREMENT,
  SPEED_LIMIT,
  SPHERE_RADIUS,
  ARENA_PRESETS,
  THEMES,
  PLAYER_SKIN_INFO,
  getArenaTheme,
} from '../constants';
import { apexState, mutation } from '../state';
import { advanceCurvedState } from '../utils/pathGeneration';

const Sphere: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const snap = useSnapshot(apexState);
  const preset = ARENA_PRESETS[snap.arena];
  const theme = useMemo(() => getArenaTheme(preset, THEMES[snap.currentTheme]), [preset, snap.currentTheme]);
  const rotationRef = useRef(new THREE.Euler());
  const spiralScratch = useRef({
    radial: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
  });

  const geometries = useMemo(
    () => ({
      classic: new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32),
      prism: new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.05, 0),
      prismflare: new THREE.OctahedronGeometry(SPHERE_RADIUS * 1.1, 0),
      prismshift: new THREE.TetrahedronGeometry(SPHERE_RADIUS * 1.15, 0),
      prismhalo: new THREE.TorusGeometry(SPHERE_RADIUS * 0.7, SPHERE_RADIUS * 0.18, 18, 36),
      prismglint: new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.1, 1),
      prismedge: new THREE.OctahedronGeometry(SPHERE_RADIUS * 1.2, 1),
      prismvibe: new THREE.TetrahedronGeometry(SPHERE_RADIUS * 1.25, 1),
      prismflux: new THREE.BoxGeometry(SPHERE_RADIUS * 1.5, SPHERE_RADIUS * 1.5, SPHERE_RADIUS * 1.5),
      fractal: new THREE.TorusKnotGeometry(SPHERE_RADIUS * 0.6, SPHERE_RADIUS * 0.2, 80, 12),
      fractalcrown: new THREE.TorusKnotGeometry(SPHERE_RADIUS * 0.62, SPHERE_RADIUS * 0.22, 120, 16),
      fractalsurge: new THREE.TorusKnotGeometry(SPHERE_RADIUS * 0.55, SPHERE_RADIUS * 0.18, 100, 12),
      fractalrune: new THREE.TorusGeometry(SPHERE_RADIUS * 0.75, SPHERE_RADIUS * 0.2, 14, 26),
      fractalspire: new THREE.ConeGeometry(SPHERE_RADIUS * 0.8, SPHERE_RADIUS * 1.8, 6),
      fractalshard: new THREE.TetrahedronGeometry(SPHERE_RADIUS * 1.3, 0),
      fractalwarp: new THREE.IcosahedronGeometry(SPHERE_RADIUS * 0.95, 2),
      fractalshade: new THREE.DodecahedronGeometry(SPHERE_RADIUS * 1.0, 0),
      nova: new THREE.DodecahedronGeometry(SPHERE_RADIUS * 1.05, 0),
      novapulse: new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.08, 1),
      novabloom: new THREE.OctahedronGeometry(SPHERE_RADIUS * 1.12, 1),
      novacore: new THREE.SphereGeometry(SPHERE_RADIUS * 1.15, 20, 20),
      novaflare: new THREE.ConeGeometry(SPHERE_RADIUS * 0.9, SPHERE_RADIUS * 2.1, 8),
      novastorm: new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.2, 2),
      novaspike: new THREE.CylinderGeometry(SPHERE_RADIUS * 0.5, SPHERE_RADIUS * 0.9, SPHERE_RADIUS * 1.9, 8),
      novaring: new THREE.TorusGeometry(SPHERE_RADIUS * 0.8, SPHERE_RADIUS * 0.22, 12, 28),
    }),
    []
  );

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
    };
  }, [geometries]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    if (!mutation.initialized || snap.phase !== 'playing') {
      mesh.position.copy(mutation.spherePos);
      mesh.rotation.copy(rotationRef.current);
      return;
    }

    const modeSettings = MODE_SETTINGS[snap.mode];

    if (snap.mode === 'curved') {
      if (!mutation.gameOver && mutation.isOnPlatform) {
        const distanceStep = mutation.speed * delta;
        const result = advanceCurvedState(
          mutation.curveCenterPos,
          mutation.curveTheta,
          mutation.curveCurvature,
          mutation.curveCurvatureVel,
          mutation.curveDirection,
          distanceStep
        );

        mutation.curveTheta = result.theta;
        mutation.curveCurvature = result.curvature;
        mutation.curveCurvatureVel = result.curvatureVel;
        mutation.targetDirection.copy(result.tangent);
        mutation.currentDirection.copy(result.tangent);

        mutation.curveLaneOffset = THREE.MathUtils.damp(
          mutation.curveLaneOffset,
          mutation.curveLane * CURVE_LANE_OFFSET,
          CURVE_LANE_DAMPING,
          delta
        );

        mutation.spherePos
          .copy(mutation.curveCenterPos)
          .addScaledVector(result.normal, mutation.curveLaneOffset);

        const moveDelta = result.tangent.clone().multiplyScalar(mutation.speed * delta);
        mutation.velocity.copy(moveDelta.divideScalar(delta));

        mutation.speed = Math.min(
          mutation.speed + SPEED_INCREMENT * modeSettings.speedIncrementMultiplier * delta,
          SPEED_LIMIT * modeSettings.speedLimitMultiplier
        );

        apexState.distance += mutation.speed * delta;
        if (Math.floor(apexState.distance / LEVEL_DISTANCE) >= apexState.level) {
          apexState.levelUp();
        }
      }
    } else if (snap.mode === 'spiral') {
      const { radial, tangent } = spiralScratch.current;
      radial.copy(mutation.spherePos).setY(0);
      const radius = Math.max(radial.length(), 0.001);
      if (radius < 0.01) {
        radial.set(1, 0, 0);
      } else {
        radial.divideScalar(radius);
      }
      tangent.set(-radial.z, 0, radial.x);
      tangent.multiplyScalar(mutation.spiralDirection * SPIRAL_TURN_RATE);

      let radialBias = -SPIRAL_INWARD_DRIFT;
      if (radius < SPIRAL_MIN_RADIUS) {
        radialBias = SPIRAL_OUTWARD_DRIFT;
      } else if (radius > SPIRAL_MAX_RADIUS) {
        radialBias = -SPIRAL_INWARD_DRIFT * SPIRAL_OUTER_PULL;
      }

      const direction = tangent.add(radial.multiplyScalar(radialBias));
      direction.z -= SPIRAL_FORWARD_DRIFT;
      direction.normalize();
      mutation.targetDirection.copy(direction);
    }

    if (snap.mode !== 'curved') {
      mutation.currentDirection.copy(mutation.targetDirection);

      if (!mutation.gameOver && mutation.isOnPlatform) {
        const moveDelta = mutation.currentDirection
          .clone()
          .multiplyScalar(mutation.speed * delta);
        mutation.spherePos.add(moveDelta);
        mutation.velocity.copy(moveDelta.divideScalar(delta));

        mutation.speed = Math.min(
          mutation.speed + SPEED_INCREMENT * modeSettings.speedIncrementMultiplier * delta,
          SPEED_LIMIT * modeSettings.speedLimitMultiplier
        );

        apexState.distance += mutation.speed * delta;
        if (Math.floor(apexState.distance / LEVEL_DISTANCE) >= apexState.level) {
          apexState.levelUp();
        }
      }
    }

    if (!mutation.isOnPlatform && !mutation.gameOver) {
      if (snap.mode === 'zen') {
        const activeTile = mutation.tiles.find((t) => t.status === 'active');
        if (activeTile) {
          mutation.spherePos.set(activeTile.x, activeTile.y + SPHERE_RADIUS, activeTile.z);
          mutation.velocity.set(0, 0, 0);
          mutation.isOnPlatform = true;
        }
      } else {
        apexState.endGame();
      }
    }

    if (mutation.gameOver && mutation.spherePos.y > REMOVAL_Y) {
      mutation.velocity.y -= GRAVITY * delta;
      mutation.spherePos.add(mutation.velocity.clone().multiplyScalar(delta));
    }

    if (mutation.isOnPlatform && mutation.activeTileY !== null) {
      mutation.spherePos.y = mutation.activeTileY + SPHERE_RADIUS;
    }

    mesh.position.copy(mutation.spherePos);

    const rotSpeed = (mutation.speed * delta) / SPHERE_RADIUS;
    rotationRef.current.x += mutation.currentDirection.z * rotSpeed;
    rotationRef.current.z -= mutation.currentDirection.x * rotSpeed;
    mesh.rotation.copy(rotationRef.current);

    if (mutation.spherePos.y > REMOVAL_Y) {
      if (snap.mode === 'curved' || snap.mode === 'spiral') {
        camera.position.x = mutation.spherePos.x - CAMERA_OFFSET_X;
        camera.position.z = mutation.spherePos.z + CAMERA_OFFSET_Z;
      } else {
        const movementAverage = (mutation.spherePos.x - mutation.spherePos.z) / 2;
        camera.position.x = -CAMERA_OFFSET_X + movementAverage;
        camera.position.z = CAMERA_OFFSET_Z - movementAverage;
      }
      camera.lookAt(mutation.spherePos.x, mutation.spherePos.y, mutation.spherePos.z);
    }
  });

  const skin = PLAYER_SKIN_INFO[snap.playerSkin] ?? PLAYER_SKIN_INFO.classic;
  const geometry = geometries[snap.playerSkin] ?? geometries.classic;
  const isPrism = snap.playerSkin.startsWith('prism');
  const isFractal = snap.playerSkin.startsWith('fractal');
  const isNova = snap.playerSkin.startsWith('nova');
  const skinAccent = snap.playerSkin === 'classic' ? theme.accent : skin.accent;

  return (
    <group>
      <Trail width={1} length={8} color={skinAccent} attenuation={(t) => t * t}>
        <mesh ref={meshRef} position={[0, SPHERE_RADIUS, 0]} geometry={geometry}>
          {isPrism ? (
            <meshPhysicalMaterial
              color={skin.color}
              emissive={skin.accent}
              emissiveIntensity={0.22}
              metalness={0.2}
              roughness={0.15}
              transmission={0.6}
              thickness={0.7}
              clearcoat={0.8}
              clearcoatRoughness={0.2}
              transparent
              opacity={0.9}
            />
          ) : (
            <meshStandardMaterial
              color={skin.color}
              emissive={skinAccent}
              emissiveIntensity={
                isNova ? 0.65 : isFractal ? 0.35 : 0.1
              }
              metalness={snap.playerSkin === 'classic' ? 0.9 : 0.4}
              roughness={snap.playerSkin === 'classic' ? 0.1 : 0.3}
              flatShading={isFractal}
            />
          )}
          <pointLight color={skinAccent} intensity={2} distance={3} />
        </mesh>
      </Trail>

      {snap.powerUp === 'shield' && (
        <mesh position={mutation.spherePos}>
          <icosahedronGeometry args={[SPHERE_RADIUS * 2, 1]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.3} wireframe />
        </mesh>
      )}
    </group>
  );
};

export default Sphere;
