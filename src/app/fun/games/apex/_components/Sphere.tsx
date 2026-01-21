import { Trail } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
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
import { buildSupershapeGeometry } from '../utils/superformula';

const mergeGeometries = (geometries: THREE.BufferGeometry[]) => {
  const merged = mergeBufferGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  if (!merged) return new THREE.BufferGeometry();
  merged.computeVertexNormals();
  return merged;
};

const displaceIcosphere = (geo: THREE.BufferGeometry, amp: number, freq: number, seed: number) => {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  const noise = (x: number, y: number, z: number) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
    return n - Math.floor(n);
  };

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    nrm.copy(v).normalize();
    const n =
      0.55 * noise(nrm.x * freq, nrm.y * freq, nrm.z * freq) +
      0.3 * noise(nrm.x * freq * 2, nrm.y * freq * 2, nrm.z * freq * 2) +
      0.15 * noise(nrm.x * freq * 4, nrm.y * freq * 4, nrm.z * freq * 4);
    const h = (n - 0.5) * 2 * amp;
    v.addScaledVector(nrm, h);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
};

const buildOrbitGeometry = (radius: number, tube: number) => {
  const ringA = new THREE.TorusGeometry(radius, tube, 18, 64);
  const ringB = ringA.clone();
  ringB.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  return mergeGeometries([ringA, ringB]);
};

const buildEclipseGeometry = (radius: number) => {
  const core = new THREE.SphereGeometry(radius * 0.85, 28, 28);
  const ring = new THREE.TorusGeometry(radius * 1.15, radius * 0.12, 16, 40);
  ring.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  return mergeGeometries([core, ring]);
};

const buildCometGeometry = (radius: number) => {
  const profile = [
    new THREE.Vector2(0, -radius * 0.9),
    new THREE.Vector2(radius * 0.45, -radius * 0.5),
    new THREE.Vector2(radius * 0.55, 0),
    new THREE.Vector2(radius * 0.2, radius * 0.6),
    new THREE.Vector2(0, radius * 0.9),
  ];
  const head = new THREE.LatheGeometry(profile, 28);
  const tail = new THREE.ConeGeometry(radius * 0.25, radius * 1.6, 16);
  tail.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  tail.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -radius * 1.15));
  return mergeGeometries([head, tail]);
};

const buildHelixTubeGeometry = (radius: number) => {
  const points: THREE.Vector3[] = [];
  const segments = 160;
  const turns = 3;
  const ringRadius = radius * 0.85;
  const height = radius * 0.6;

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const angle = t * turns;
    const y = Math.sin(t * 2.0) * height;
    points.push(new THREE.Vector3(Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 220, radius * 0.16, 12, true);
};

const buildLissajousTubeGeometry = (radius: number) => {
  const points: THREE.Vector3[] = [];
  const segments = 200;
  const scale = radius * 1.05;
  const a = 3;
  const b = 4;
  const c = 5;
  const delta = Math.PI / 2;

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = Math.sin(a * t + delta);
    const y = Math.sin(b * t);
    const z = Math.sin(c * t);
    points.push(new THREE.Vector3(x, y, z).multiplyScalar(scale));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  return new THREE.TubeGeometry(curve, 240, radius * 0.12, 12, true);
};

const buildSierpinskiGeometry = (radius: number, depth = 2) => {
  const geometries: THREE.BufferGeometry[] = [];
  const offsets = [
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(-1, -1, 1),
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(1, -1, -1),
  ].map((v) => v.normalize());

  const build = (center: THREE.Vector3, size: number, level: number) => {
    if (level === 0) {
      const geo = new THREE.TetrahedronGeometry(size);
      geo.translate(center.x, center.y, center.z);
      geometries.push(geo);
      return;
    }
    const nextSize = size / 2;
    for (const offset of offsets) {
      const childCenter = center.clone().add(offset.clone().multiplyScalar(nextSize * 0.75));
      build(childCenter, nextSize, level - 1);
    }
  };

  build(new THREE.Vector3(), radius, depth);
  return mergeGeometries(geometries);
};

const buildMengerGeometry = (size: number, depth = 2) => {
  const geometries: THREE.BufferGeometry[] = [];
  const build = (center: THREE.Vector3, size: number, level: number) => {
    if (level === 0) {
      const geo = new THREE.BoxGeometry(size, size, size);
      geo.translate(center.x, center.y, center.z);
      geometries.push(geo);
      return;
    }
    const step = size / 3;
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          const holes = (x === 1 && y === 1) || (x === 1 && z === 1) || (y === 1 && z === 1);
          if (holes) continue;
          const offset = new THREE.Vector3((x - 1) * step, (y - 1) * step, (z - 1) * step);
          build(center.clone().add(offset), step, level - 1);
        }
      }
    }
  };

  build(new THREE.Vector3(), size, depth);
  return mergeGeometries(geometries);
};

const Sphere: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>(null);
  const shaderTimeRef = useRef(0);
  const { camera } = useThree();
  const snap = useSnapshot(apexState);
  const arenaKey = snap.arena ?? 'classic';
  const preset = ARENA_PRESETS[arenaKey] ?? ARENA_PRESETS.classic;
  const theme = useMemo(() => getArenaTheme(preset, THEMES[snap.currentTheme ?? 'neon']), [preset, snap.currentTheme]);
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
      prismstellate: (() => {
        const geo = new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.1, 2);
        displaceIcosphere(geo, SPHERE_RADIUS * 0.28, 4.8, 911);
        return geo;
      })(),
      prismcage: new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.1, 2),
      prismorbitx: buildOrbitGeometry(SPHERE_RADIUS * 0.85, SPHERE_RADIUS * 0.16),
      prismlens: buildSupershapeGeometry(
        SPHERE_RADIUS * 1.1,
        { m: 2, n1: 0.9, n2: 0.9, n3: 0.9 },
        { m: 2, n1: 0.9, n2: 0.9, n3: 0.9 }
      ),
      prismhelixtube: buildHelixTubeGeometry(SPHERE_RADIUS),
      fractal: new THREE.TorusKnotGeometry(SPHERE_RADIUS * 0.6, SPHERE_RADIUS * 0.2, 80, 12),
      fractalcrown: new THREE.TorusKnotGeometry(SPHERE_RADIUS * 0.62, SPHERE_RADIUS * 0.22, 120, 16),
      fractalsurge: new THREE.TorusKnotGeometry(SPHERE_RADIUS * 0.55, SPHERE_RADIUS * 0.18, 100, 12),
      fractalrune: new THREE.TorusGeometry(SPHERE_RADIUS * 0.75, SPHERE_RADIUS * 0.2, 14, 26),
      fractalspire: new THREE.ConeGeometry(SPHERE_RADIUS * 0.8, SPHERE_RADIUS * 1.8, 6),
      fractalshard: new THREE.TetrahedronGeometry(SPHERE_RADIUS * 1.3, 0),
      fractalwarp: new THREE.IcosahedronGeometry(SPHERE_RADIUS * 0.95, 2),
      fractalshade: new THREE.DodecahedronGeometry(SPHERE_RADIUS * 1.0, 0),
      fractalsupershape: buildSupershapeGeometry(
        SPHERE_RADIUS * 1.15,
        { m: 7, n1: 0.2, n2: 1.7, n3: 1.7 },
        { m: 3, n1: 0.2, n2: 1.7, n3: 1.7 }
      ),
      fractalasteroid: (() => {
        const geo = new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.08, 3);
        displaceIcosphere(geo, SPHERE_RADIUS * 0.18, 3.2, 1337);
        return geo;
      })(),
      fractalsierpinski: buildSierpinskiGeometry(SPHERE_RADIUS * 1.0, 2),
      fractalmenger: buildMengerGeometry(SPHERE_RADIUS * 1.6, 2),
      fractallissajous: buildLissajousTubeGeometry(SPHERE_RADIUS),
      nova: new THREE.DodecahedronGeometry(SPHERE_RADIUS * 1.05, 0),
      novapulse: new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.08, 1),
      novabloom: new THREE.OctahedronGeometry(SPHERE_RADIUS * 1.12, 1),
      novacore: new THREE.SphereGeometry(SPHERE_RADIUS * 1.15, 20, 20),
      novaflare: new THREE.ConeGeometry(SPHERE_RADIUS * 0.9, SPHERE_RADIUS * 2.1, 8),
      novastorm: new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.2, 2),
      novaspike: new THREE.CylinderGeometry(SPHERE_RADIUS * 0.5, SPHERE_RADIUS * 0.9, SPHERE_RADIUS * 1.9, 8),
      novaring: new THREE.TorusGeometry(SPHERE_RADIUS * 0.8, SPHERE_RADIUS * 0.22, 12, 28),
      novacorona: (() => {
        const geo = new THREE.IcosahedronGeometry(SPHERE_RADIUS * 1.05, 2);
        displaceIcosphere(geo, SPHERE_RADIUS * 0.2, 5.0, 721);
        return geo;
      })(),
      novapulsar: (() => {
        const geo = new THREE.DodecahedronGeometry(SPHERE_RADIUS * 1.0, 0);
        geo.scale(0.8, 1.35, 0.8);
        return geo;
      })(),
      novaeclipse: buildEclipseGeometry(SPHERE_RADIUS),
      novacomet: buildCometGeometry(SPHERE_RADIUS),
      novaflareburst: buildSupershapeGeometry(
        SPHERE_RADIUS * 1.2,
        { m: 9, n1: 0.18, n2: 1.2, n3: 1.2 },
        { m: 7, n1: 0.18, n2: 1.2, n3: 1.2 }
      ),
    }),
    []
  );

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
    };
  }, [geometries]);

  const skin = PLAYER_SKIN_INFO[snap.playerSkin] ?? PLAYER_SKIN_INFO.classic;
  const geometry = geometries[snap.playerSkin] ?? geometries.classic;
  const isPrism = snap.playerSkin.startsWith('prism');
  const isFractal = snap.playerSkin.startsWith('fractal');
  const isNova = snap.playerSkin.startsWith('nova');
  const isWireframe = snap.playerSkin === 'prismcage';
  const skinAccent = snap.playerSkin === 'classic' ? theme.accent : skin.accent;
  const skinColor = snap.playerSkin === 'classic' ? theme.tileHex : skin.color;
  const shouldInjectShader = snap.playerSkin !== 'classic';

  const handleBeforeCompile = useCallback(
    (shader: THREE.Shader) => {
      if (!shouldInjectShader) return;
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uAccent = { value: new THREE.Color(skinAccent) };

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
          float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
          float bands = 0.5 + 0.5 * sin(uTime * 2.0 + vUv.y * 20.0);
          vec3 glow = uAccent * (0.15 * bands + 0.65 * fres);
          emissiveColor += glow;
          #include <dithering_fragment>
        `
      );

      if (materialRef.current) {
        materialRef.current.userData.uniforms = shader.uniforms;
      }
    },
    [shouldInjectShader, skinAccent]
  );

  useEffect(() => {
    if (!shouldInjectShader && materialRef.current) {
      materialRef.current.userData.uniforms = undefined;
    }
    if (materialRef.current) {
      materialRef.current.needsUpdate = true;
    }
  }, [shouldInjectShader, skinAccent, snap.playerSkin]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    shaderTimeRef.current += delta;
    const shaderUniforms = materialRef.current?.userData.uniforms;
    if (shaderUniforms?.uTime) {
      shaderUniforms.uTime.value = shaderTimeRef.current;
    }
    if (shaderUniforms?.uAccent) {
      shaderUniforms.uAccent.value.set(skinAccent);
    }

    if (!mutation.initialized || snap.phase !== 'playing') {
      mesh.position.copy(mutation.spherePos);
      mesh.rotation.copy(rotationRef.current);
      return;
    }

    const modeSettings = MODE_SETTINGS[snap.mode ?? 'classic'] ?? MODE_SETTINGS.classic;

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
      } else if (snap.mode === 'gravity') {
        // For gravity mode, add a 2 second grace period before ending the game
        mutation.fallOffTimer += delta;
        if (mutation.fallOffTimer >= 2.0) {
          apexState.endGame();
        }
      } else {
        apexState.endGame();
      }
    } else if (mutation.isOnPlatform) {
      // Reset the fall-off timer when player gets back on platform
      mutation.fallOffTimer = 0;
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

  return (
    <group>
      <Trail width={1} length={8} color={skinAccent} attenuation={(t) => t * t}>
        <mesh ref={meshRef} position={[0, SPHERE_RADIUS, 0]} geometry={geometry}>
          {isPrism ? (
            <meshPhysicalMaterial
              ref={materialRef}
              onBeforeCompile={handleBeforeCompile}
              color={skinColor}
              emissive={skin.accent}
              emissiveIntensity={0.22}
              metalness={0.2}
              roughness={0.15}
              transmission={0.6}
              thickness={0.7}
              clearcoat={0.8}
              clearcoatRoughness={0.2}
              wireframe={isWireframe}
              transparent
              opacity={0.9}
            />
          ) : (
            <meshStandardMaterial
              ref={materialRef}
              onBeforeCompile={handleBeforeCompile}
              color={skinColor}
              emissive={skinAccent}
              emissiveIntensity={
                isNova ? 0.65 : isFractal ? 0.35 : 0.1
              }
              metalness={snap.playerSkin === 'classic' ? 0.9 : 0.4}
              roughness={snap.playerSkin === 'classic' ? 0.1 : 0.3}
              flatShading={isFractal}
              wireframe={isWireframe}
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
