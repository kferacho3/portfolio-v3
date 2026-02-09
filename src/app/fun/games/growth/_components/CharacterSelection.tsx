import { Html } from '@react-three/drei';
import { useSnapshot } from 'valtio';
import { growthState } from '../state';

export default function CharacterSelection() {
  const snap = useSnapshot(growthState);

  if (snap.phase === 'playing') return null;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          right: 18,
          bottom: 18,
          padding: '10px 12px',
          borderRadius: 12,
          background: 'rgba(12, 18, 36, 0.72)',
          color: '#e2e8f0',
          fontSize: 12,
          lineHeight: 1.35,
          border: '1px solid rgba(148, 163, 184, 0.35)',
          backdropFilter: 'blur(6px)',
          maxWidth: 260,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Controls</div>
        <div>Left Arrow / Swipe Left: rotate +90°</div>
        <div>Right Arrow / Swipe Right: rotate -90°</div>
        <div>Space / Click: repeat last direction</div>
      </div>
    </Html>
  );
}
