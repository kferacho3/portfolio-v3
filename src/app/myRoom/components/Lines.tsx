// src/components/myRoom/Lines.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import Fatline from './Fatline';

interface LinesProps {
  url: string;
  dash: number;
  count: number;
  colors: (string | number[])[];
  radius?: number;
}

// src/components/myRoom/Lines.tsx

const Lines = ({ url, dash, count, colors, radius = 100 }: LinesProps) => {
  const lines = useMemo(() => {
    const rand = THREE.MathUtils.randFloatSpread;
    return Array.from({ length: count }, () => {
      const pos = new THREE.Vector3(rand(radius), rand(radius), rand(radius));
      const points = Array.from({ length: 10 }, () =>
        pos
          .clone()
          .add(new THREE.Vector3(rand(radius), rand(radius), rand(radius)))
      );
      const curve = new THREE.CatmullRomCurve3(points)
        .getPoints(300)
        .flatMap((p) => p.toArray());
      return {
        color: colors[Math.floor(Math.random() * colors.length)],
        width: radius / 12500 + (Math.random() * radius) / 5000,
        speed: Math.random(),
        curve,
      };
    });
  }, [count, radius, colors]);

  return (
    <>
      {lines.map((line, index) => (
        <Fatline key={index} url={url} {...line} dash={dash} />
      ))}
    </>
  );
};

export default Lines;
