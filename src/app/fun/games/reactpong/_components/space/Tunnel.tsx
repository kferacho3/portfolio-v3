import React, { Fragment, useRef } from 'react';
import * as THREE from 'three';
import { TUNNEL_DEPTH, TUNNEL_HEIGHT, TUNNEL_WIDTH } from '../../constants';

const Tunnel: React.FC = () => {
  const tunnelRef = useRef<THREE.Group>(null);

  const wallColor = '#1a1a2e';
  const lineColor = '#3a3a5e';

  return (
    <group ref={tunnelRef}>
      <mesh position={[0, -TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TUNNEL_WIDTH, TUNNEL_DEPTH]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TUNNEL_WIDTH, TUNNEL_DEPTH]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[-TUNNEL_WIDTH / 2, 0, -TUNNEL_DEPTH / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[TUNNEL_DEPTH, TUNNEL_HEIGHT]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[TUNNEL_WIDTH / 2, 0, -TUNNEL_DEPTH / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[TUNNEL_DEPTH, TUNNEL_HEIGHT]} />
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>

      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={`floor-line-${i}`} position={[0, -TUNNEL_HEIGHT / 2 + 0.01, -i * (TUNNEL_DEPTH / 10)]}>
          <boxGeometry args={[TUNNEL_WIDTH, 0.02, 0.05]} />
          <meshBasicMaterial color={lineColor} />
        </mesh>
      ))}

      {Array.from({ length: 10 }).map((_, i) => (
        <Fragment key={`wall-lines-${i}`}>
          <mesh position={[-TUNNEL_WIDTH / 2 + 0.01, 0, -i * (TUNNEL_DEPTH / 10)]}>
            <boxGeometry args={[0.02, TUNNEL_HEIGHT, 0.05]} />
            <meshBasicMaterial color={lineColor} />
          </mesh>
          <mesh position={[TUNNEL_WIDTH / 2 - 0.01, 0, -i * (TUNNEL_DEPTH / 10)]}>
            <boxGeometry args={[0.02, TUNNEL_HEIGHT, 0.05]} />
            <meshBasicMaterial color={lineColor} />
          </mesh>
        </Fragment>
      ))}

      <mesh position={[0, 0, -TUNNEL_DEPTH - 0.1]}>
        <planeGeometry args={[TUNNEL_WIDTH, TUNNEL_HEIGHT]} />
        <meshStandardMaterial color="#2a1a3e" emissive="#1a0a2e" emissiveIntensity={0.2} />
      </mesh>

      <mesh position={[0, 0, 0.1]}>
        <ringGeometry args={[Math.max(TUNNEL_WIDTH, TUNNEL_HEIGHT) * 0.5, Math.max(TUNNEL_WIDTH, TUNNEL_HEIGHT) * 0.55, 4]} />
        <meshBasicMaterial color="#00aaff" transparent opacity={0.3} />
      </mesh>
    </group>
  );
};

export default Tunnel;
