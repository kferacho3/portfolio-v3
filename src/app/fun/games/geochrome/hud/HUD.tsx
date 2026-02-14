import { Html } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { GOAL_DIAMETERS } from '../engine/constants';
import { useGeoChromeStore } from '../engine/store';

interface HUDProps {
  paletteName: string;
  onCyclePalette: () => void;
}

export default function HUD({ paletteName, onCyclePalette }: HUDProps) {
  const diameter = useGeoChromeStore((state) => state.diameter);
  const pickupLimit = useGeoChromeStore((state) => state.pickupLimit);
  const recentPickups = useGeoChromeStore((state) => state.recentPickups);
  const lowPerf = useGeoChromeStore((state) => state.lowPerf);
  const stuckCount = useGeoChromeStore((state) => state.stuckCount);
  const worldCount = useGeoChromeStore((state) => state.worldCount);
  const combo = useGeoChromeStore((state) => state.combo);
  const comboMultiplier = useGeoChromeStore((state) => state.comboMultiplier);
  const maxCombo = useGeoChromeStore((state) => state.maxCombo);

  const diameterKey = useMemo(() => Math.floor(diameter * 100), [diameter]);
  const nextGoal =
    GOAL_DIAMETERS.find((goal) => diameter < goal) ??
    GOAL_DIAMETERS[GOAL_DIAMETERS.length - 1];
  const progressToGoal = Math.min(1, diameter / nextGoal);

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        className="pointer-events-none absolute inset-0 select-none p-4 md:p-8 text-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 82px)' }}
      >
        <div className="flex justify-between">
          <motion.div
            key={diameterKey}
            initial={{ scale: 0.92, rotate: -2 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            className="rounded-2xl border border-cyan-200/50 bg-slate-950/70 px-4 py-3 shadow-[0_0_40px_-14px_rgba(56,189,248,0.7)] backdrop-blur"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/90">
              GeoChrome Size
            </div>
            <div className="flex items-end gap-2">
              <div className="text-3xl font-black leading-none text-cyan-50 md:text-5xl">
                {diameter.toFixed(2)}
              </div>
              <div className="mb-1 text-xs font-semibold text-cyan-200/80">
                m
              </div>
            </div>
            <div className="mt-1 text-[11px] text-cyan-100/80">
              {stuckCount.toLocaleString()} stuck /{' '}
              {worldCount.toLocaleString()} in world
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700/80">
              <div
                className="h-full rounded-full bg-cyan-300"
                style={{ width: `${progressToGoal * 100}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-cyan-200/85">
              Goal: {nextGoal.toFixed(1)}m
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden rounded-2xl border border-cyan-200/35 bg-slate-950/60 px-4 py-3 text-right backdrop-blur md:block"
          >
            <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-300/90">
              Pickup Limit
            </div>
            <div className="text-2xl font-black text-cyan-50">
              {pickupLimit.toFixed(2)}m
            </div>
            <div className="text-[11px] text-cyan-100/75">
              absorb anything smaller than this
            </div>
          </motion.div>

          <div className="flex h-fit items-center gap-2">
            <button
              type="button"
              onClick={onCyclePalette}
              className="pointer-events-auto rounded-full border border-cyan-200/55 bg-slate-900/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-100 transition hover:bg-slate-800/90"
            >
              Palette: {paletteName}
            </button>
            <div
              className={`h-fit rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                lowPerf
                  ? 'border-amber-300/50 bg-amber-400/20 text-amber-100'
                  : 'border-emerald-300/50 bg-emerald-400/20 text-emerald-100'
              }`}
            >
              {lowPerf ? 'Lite Mode' : 'Full Mode'}
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
        >
          <motion.div
            key={`${combo}-${Math.round(comboMultiplier * 100)}`}
            initial={{ opacity: 0, y: -8, scale: 0.92 }}
            animate={{ opacity: combo > 1 ? 1 : 0.82, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="rounded-2xl border border-fuchsia-200/45 bg-slate-950/62 px-4 py-2 text-center shadow-[0_0_38px_-14px_rgba(244,114,182,0.85)] backdrop-blur"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-200/85">
              Combo Chain
            </div>
            <div className="flex items-end justify-center gap-2">
              <span className="text-xl font-black leading-none text-fuchsia-50 md:text-3xl">
                x{comboMultiplier.toFixed(2)}
              </span>
              <span className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fuchsia-200/80">
                {combo > 1 ? `${combo} hits` : 'warmup'}
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-fuchsia-100/70">
              best chain: {maxCombo}
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-4 left-4 w-[280px] space-y-2 md:bottom-8 md:left-8 md:w-[340px]">
          <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">
            Recent pickups
          </div>

          <AnimatePresence>
            {recentPickups.map((pickup, index) => (
              <motion.div
                key={pickup.id}
                initial={{ x: -64, opacity: 0, scale: 0.92 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: 42, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-3 rounded-xl border border-white/20 bg-slate-900/65 px-3 py-2 backdrop-blur"
                style={{ width: `${100 - index * 7}%` }}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: pickup.color,
                    boxShadow: `0 0 14px ${pickup.color}`,
                  }}
                />
                <div className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-slate-100">
                  {pickup.label}
                </div>
                <div className="ml-auto text-[11px] text-cyan-200/80">
                  {pickup.size.toFixed(2)}m
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </Html>
  );
}
