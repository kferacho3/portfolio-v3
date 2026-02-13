import { Html } from '@react-three/drei';
import { motion } from 'framer-motion';

interface StartOverlayProps {
  onStart: () => void;
  paletteName: string;
}

export default function StartOverlay({
  onStart,
  paletteName,
}: StartOverlayProps) {
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute inset-0 pointer-events-auto grid place-items-center bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_15%,rgba(168,85,247,0.14),transparent_42%),radial-gradient(circle_at_65%_78%,rgba(34,197,94,0.15),transparent_46%),linear-gradient(180deg,#04060f_0%,#0b1020_100%)] px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-xl rounded-3xl border border-cyan-300/40 bg-slate-950/70 p-6 text-white shadow-[0_0_80px_-26px_rgba(34,211,238,0.75)] backdrop-blur md:p-8"
        >
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-300/90">
            GeoChrome // Katamari Mode
          </div>
          <h1 className="mt-2 text-3xl font-black leading-tight md:text-4xl">
            Roll. Stick. Grow.
          </h1>
          <p className="mt-3 text-sm text-cyan-100/80 md:text-base">
            Sweep through dense geometric fields, absorb smaller shapes, and
            scale into a chrome titan. Start near the center on tiny shapes,
            then push outward toward bigger tiers.
          </p>
          <div className="mt-3 inline-flex rounded-full border border-cyan-200/45 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-cyan-100/90">
            Active Palette: {paletteName}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 text-xs text-cyan-100/80 md:grid-cols-5 md:text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="font-semibold text-cyan-200">Move</div>
              <div>WASD / Arrow Keys</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="font-semibold text-cyan-200">Boost</div>
              <div>Hold Shift</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="font-semibold text-cyan-200">Touch</div>
              <div>Drag to steer</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="font-semibold text-cyan-200">Reset</div>
              <div>Press R</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="font-semibold text-cyan-200">Palette</div>
              <div>Press P</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-cyan-200/70 bg-cyan-300/90 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 transition hover:bg-cyan-200"
          >
            Click To Start
          </button>
        </motion.div>
      </div>
    </Html>
  );
}
