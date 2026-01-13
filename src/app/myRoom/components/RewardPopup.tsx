// src/components/RewardPopup.tsx
import React from 'react';

const RewardPopup: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="reward-popup">
      <div className="popup-content">
        <h2>Congratulations!</h2>
        <p>You have unlocked a new reward.</p>
        <button onClick={onClose}>Close</button>
      </div>
      <style jsx>{`
        .reward-popup {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .popup-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default RewardPopup;
