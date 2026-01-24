import { Html } from '@react-three/drei';
import { useSnapshot } from 'valtio';
import { jellyJumpState } from '../state';
import { CHARACTERS } from '../constants';

export default function CharacterSelection() {
  const snap = useSnapshot(jellyJumpState);

  if (snap.phase !== 'menu') return null;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '12px 16px',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 14,
          backdropFilter: 'blur(8px)',
          pointerEvents: 'auto',
          maxWidth: '92vw',
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 0.5, textAlign: 'center' }}>
          Choose your Jelly
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {CHARACTERS.map((char, idx) => (
            <button
              key={char.id}
              onClick={() => {
                jellyJumpState.selectedCharacter = idx;
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                border: snap.selectedCharacter === idx ? '3px solid #fff' : '2px solid rgba(255,255,255,0.3)',
                background: char.color,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: snap.selectedCharacter === idx ? '0 0 12px rgba(255,255,255,0.5)' : 'none',
                flex: '0 0 auto',
              }}
              title={char.name}
            />
          ))}
        </div>
      </div>
    </Html>
  );
}
