// src/components/myRoom/Fatline.tsx
import { ReactThreeFiber, extend, useFrame } from '@react-three/fiber';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { useEffect, useRef } from 'react';
import { suspend } from 'suspend-react';
import * as THREE from 'three';

extend({ MeshLineGeometry, MeshLineMaterial });

// Adjusted ESLint rule to allow namespace in declarations
/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace JSX {
    interface IntrinsicElements {
      meshLineGeometry: ReactThreeFiber.BufferGeometryNode<
        MeshLineGeometry,
        typeof MeshLineGeometry
      > & {
        points?: number[] | THREE.Vector3[];
      };
      meshLineMaterial: ReactThreeFiber.MaterialNode<
        MeshLineMaterial,
        typeof MeshLineMaterial
      > & {
        transparent?: boolean;
        lineWidth?: number;
        color?: THREE.Color | string | number;
        depthWrite?: boolean;
        dashArray?: number;
        dashRatio?: number;
        // Include any other properties you need
      };
    }
  }
}

/* eslint-enable @typescript-eslint/no-namespace */

interface FatlineProps {
  url: string;
  curve: number[];
  width: number;
  color: string | number[];
  speed: number;
  dash: number;
}

const Fatline = ({ url, curve, width, color, speed, dash }: FatlineProps) => {
  const ref = useRef<THREE.Mesh>(null!);

  // Use suspend to load audio data
  const { gain, context, update, getAvg } = suspend(
    () => createAudio(url),
    [url]
  );

  useEffect(() => {
    gain.connect(context.destination);
    return () => gain.disconnect();
  }, [gain, context]);

  useFrame(() => {
    update();
    const avgAmplitude = getAvg();

    const dynamicWidth = Math.max(0.01, width + avgAmplitude / 8192);

    if (ref.current && ref.current.material) {
      const material = ref.current.material as MeshLineMaterial;
      material.lineWidth = dynamicWidth;
      material.dashOffset -= (speed * avgAmplitude) / 20480;
      material.color.setHSL(avgAmplitude / 256, 1, 0.5);
    }
  });

  return (
    <mesh ref={ref}>
      <meshLineGeometry points={curve} />
      <meshLineMaterial
        transparent
        lineWidth={width}
        color={new THREE.Color(color as string)}
        depthWrite={false}
        dashArray={0.25}
        dashRatio={dash}
      />
    </mesh>
  );
};

async function createAudio(url: string) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const context = new window.AudioContext();
  const source = context.createBufferSource();
  source.buffer = await new Promise((resolve) =>
    context.decodeAudioData(buffer, resolve)
  );
  source.loop = true;
  source.start(0);
  const gain = context.createGain();
  const analyser = context.createAnalyser();
  analyser.fftSize = 64;
  source.connect(analyser);
  analyser.connect(gain);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  let avg = 0;

  return {
    context,
    source,
    gain,
    update: () => {
      analyser.getByteFrequencyData(dataArray);
      avg = dataArray.reduce((prev, cur) => prev + cur, 0) / dataArray.length;
    },
    getAvg: () => avg,
  };
}

export default Fatline;
