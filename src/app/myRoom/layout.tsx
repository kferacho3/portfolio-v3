// src/app/myRoom/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Racho's Room | Interactive 3D Experience",
  description:
    'Explore an immersive 3D room experience with audio-reactive animations, hidden collectibles, and interactive objects. Built with React Three Fiber and WebGL.',
  keywords: [
    'Interactive 3D',
    'WebGL Experience',
    'React Three Fiber',
    'Audio Reactive',
    '3D Portfolio',
    'Interactive Room',
  ],
  openGraph: {
    title: "Racho's Room | Interactive 3D Experience",
    description:
      'Explore an immersive 3D room with audio-reactive animations and hidden collectibles.',
    type: 'website',
  },
};

export default function MyRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
