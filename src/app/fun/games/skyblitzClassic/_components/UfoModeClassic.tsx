import { Physics } from '@react-three/cannon';
import { Html, Sky, Stars } from '@react-three/drei';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  PHYSICS_GRAVITY,
  UFO_FIRE_COOLDOWN,
  UFO_NUM_OBSTACLES,
  UFO_OBSTACLE_SPREAD_Z,
  UFO_PROJECTILE_SPEED,
  UFO_PROJECTILE_SPAWN_OFFSET,
  UFO_PROJECTILE_TTL,
} from '../constants';
import Projectile from './Projectile';
import UfoGround from './UfoGround';
import UfoObstacle from './UfoObstacle';
import UfoPlayer from './UfoPlayer';

const UfoModeClassic: React.FC<{
  score: number;
  setScore: (fn: (prev: number) => number) => void;
  graphicsMode: 'clean' | 'classic';
}> = ({ score, setScore, graphicsMode }) => {
  const playerRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const [projectiles, setProjectiles] = useState<
    Array<{
      position: [number, number, number];
      velocity: [number, number, number];
      spawnedAt: number;
    }>
  >([]);
  const lastShotTime = useRef(0);

  const shootProjectile = useCallback(() => {
    if (!playerRef.current) return;

    const now = performance.now();
    if (now - lastShotTime.current < UFO_FIRE_COOLDOWN) return;
    lastShotTime.current = now;

    const dir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(playerRef.current.quaternion)
      .normalize();
    const velocity = dir.multiplyScalar(UFO_PROJECTILE_SPEED);
    const spawn = new THREE.Vector3()
      .copy(playerRef.current.position)
      .addScaledVector(dir, UFO_PROJECTILE_SPAWN_OFFSET);
    spawn.y += 0.25;

    const projectilePosition: [number, number, number] = [
      spawn.x,
      spawn.y,
      spawn.z,
    ];

    setProjectiles((old) => [
      ...old.slice(-20),
      {
        position: projectilePosition,
        velocity: [velocity.x, velocity.y, velocity.z],
        spawnedAt: now,
      },
    ]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        shootProjectile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shootProjectile]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const now = performance.now();
      setProjectiles((old) =>
        old.filter((p) => now - p.spawnedAt < UFO_PROJECTILE_TTL)
      );
    }, 250);
    return () => window.clearInterval(t);
  }, []);

  void graphicsMode;

  return (
    <>
      <Sky
        distance={450000}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        inclination={0.49}
        azimuth={0.25}
      />
      <Stars
        radius={300}
        depth={500}
        count={5000}
        factor={2}
        saturation={0}
        fade
      />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />

      <Physics gravity={PHYSICS_GRAVITY}>
        <UfoGround />
        <UfoPlayer playerRef={playerRef} setScore={setScore} />
        {Array.from({ length: UFO_NUM_OBSTACLES }, (_, idx) => (
          <UfoObstacle
            key={`ufo-ob-${idx}`}
            index={idx}
            playerRef={playerRef}
          />
        ))}
        {projectiles.map((projectile, index) => (
          <Projectile
            key={`proj-${index}`}
            position={projectile.position}
            velocity={projectile.velocity}
          />
        ))}
      </Physics>

      <Html>
        <div className="absolute bottom-2.5 right-2.5 text-3xl text-white font-bold">
          Score: {Math.floor(score)}
        </div>
      </Html>
    </>
  );
};

export default UfoModeClassic;
