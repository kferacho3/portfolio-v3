import { Html } from '@react-three/drei';
import { useSnapshot } from 'valtio';
import { growthState, growthSkins } from '../state';

export default function CharacterSelection() {
  const snap = useSnapshot(growthState);

  if (snap.phase !== 'menu' && snap.phase !== 'gameover') return null;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '16px 20px',
          background: 'rgba(0,0,0,0.7)',
          borderRadius: 16,
          backdropFilter: 'blur(10px)',
          pointerEvents: 'auto',
          maxWidth: '95vw',
          maxHeight: '60vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            opacity: 0.9,
            marginBottom: 4,
            textAlign: 'center',
          }}
        >
          Choose Character ({snap.bankGems} 💎)
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
            gap: 10,
            maxWidth: 600,
          }}
        >
          {growthSkins.map((skin) => {
            const isUnlocked = snap.unlocked.includes(skin.id);
            const canAfford = snap.bankGems >= skin.cost;
            const isSelected = snap.skin === skin.id;

            return (
              <button
                key={skin.id}
                onClick={() => {
                  if (isUnlocked) {
                    growthState.trySelectSkin(skin.id);
                  } else if (canAfford) {
                    growthState.tryUnlockSkin(skin.id);
                  }
                }}
                disabled={!isUnlocked && !canAfford}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 12,
                  border: isSelected
                    ? '3px solid #fff'
                    : isUnlocked
                      ? '2px solid rgba(255,255,255,0.4)'
                      : '2px solid rgba(255,255,255,0.2)',
                  background: isUnlocked ? skin.primary : 'rgba(0,0,0,0.5)',
                  cursor: isUnlocked || canAfford ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  boxShadow: isSelected
                    ? '0 0 16px rgba(255,255,255,0.6)'
                    : 'none',
                  opacity: isUnlocked ? 1 : 0.5,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={
                  isUnlocked
                    ? skin.name
                    : canAfford
                      ? `${skin.name} - ${skin.cost} gems`
                      : `${skin.name} - ${skin.cost} gems (locked)`
                }
              >
                {!isUnlocked && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      fontSize: 10,
                      fontWeight: 700,
                      color: canAfford ? '#facc15' : '#999',
                    }}
                  >
                    {skin.cost}
                  </div>
                )}
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      fontSize: 16,
                    }}
                  >
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Html>
  );
}
