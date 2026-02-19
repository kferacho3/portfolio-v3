'use client';

import { Scroll, ScrollControls } from '@react-three/drei';
import Link from 'next/link';
import { Suspense } from 'react';
import Background3D from '@/components/Background3D';
import CanvasProvider from '@/components/CanvasProvider';
import SectionFour from '@/components/SectionFour';

export default function ContactPageClient() {
  return (
    <CanvasProvider>
      <ScrollControls pages={2.4} damping={0}>
        <Suspense fallback={null}>
          <Background3D onAnimationComplete={() => {}} />
        </Suspense>

        <Scroll html style={{ width: '100vw', overflowX: 'hidden' }}>
          <main className="min-h-screen overflow-x-hidden px-3 py-4 sm:p-6">
            <section className="relative mx-auto max-w-5xl px-2 pb-4 pt-24 sm:pt-28">
              <div className="relative overflow-hidden rounded-3xl border border-gray-200/50 bg-white/75 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 dark:shadow-[0_38px_100px_rgba(0,0,0,0.45)] sm:p-8">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--brand-gradient-main)]" />
                <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                  Contact
                </p>
                <h1 className="mt-3 text-4xl font-black text-foreground sm:text-5xl">
                  <span className="brand-gradient-text">
                    Let&apos;s Build Together
                  </span>
                </h1>
                <p className="mt-4 max-w-3xl text-muted-foreground">
                  Send your goals, constraints, and timeline. You&apos;ll get a
                  practical response with clear next steps.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/case-studies"
                    className="rounded-lg border border-gray-300/70 bg-white/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-[#9400D3]/60 hover:bg-[#9400D3]/5 dark:border-white/20 dark:bg-white/5 dark:hover:border-[#9400D3]/80 dark:hover:bg-[#9400D3]/10"
                  >
                    View Case Studies
                  </Link>
                  <Link
                    href="/resume"
                    className="rounded-lg border border-gray-300/70 bg-white/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-[#39FF14]/60 hover:bg-[#39FF14]/5 dark:border-white/20 dark:bg-white/5 dark:hover:border-[#39FF14]/80 dark:hover:bg-[#39FF14]/10"
                  >
                    View Resume
                  </Link>
                </div>
              </div>
            </section>

            <SectionFour />
          </main>
        </Scroll>
      </ScrollControls>
    </CanvasProvider>
  );
}
