/**
 * Fun Layout
 *
 * Shared layout for all /fun routes.
 * Provides the arcade context and canvas wrapper.
 */
import React from 'react';

export default function FunLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fun-vibrant relative h-screen w-screen overflow-hidden bg-black">
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.2),rgba(255,255,255,0.04)_42%,rgba(255,255,255,0)_72%)] mix-blend-screen"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_bottom,rgba(182,232,255,0.08),rgba(22,26,56,0)_45%,rgba(255,220,180,0.05)_100%)]"
      />
    </div>
  );
}
