import React from 'react';

const PowerUpDisplay: React.FC<{
  shieldTime: number;
  magnetTime: number;
  doubleTime: number;
  slowTime: number;
}> = ({ shieldTime, magnetTime, doubleTime, slowTime }) => {
  const powerUps = [
    {
      active: shieldTime > 0,
      label: '🛡️ Shield',
      time: shieldTime,
      color: 'text-blue-400',
    },
    {
      active: magnetTime > 0,
      label: '🧲 Magnet',
      time: magnetTime,
      color: 'text-orange-400',
    },
    {
      active: doubleTime > 0,
      label: '2️⃣ Double',
      time: doubleTime,
      color: 'text-green-400',
    },
    {
      active: slowTime > 0,
      label: '⏱️ Slow',
      time: slowTime,
      color: 'text-cyan-400',
    },
  ].filter((p) => p.active);

  if (powerUps.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mt-2">
      {powerUps.map((p, i) => (
        <div key={i} className={`text-xs ${p.color} flex items-center gap-2`}>
          <span>{p.label}</span>
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-current transition-all duration-100"
              style={{ width: `${(p.time / 8) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default PowerUpDisplay;
