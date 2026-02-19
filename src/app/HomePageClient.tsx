/* ==========================  app/page.tsx  ==========================
   HomePage 
   --------------------------------------------------------------------
   ------------------------------------------------------------------ */

'use client';

import { Scroll, ScrollControls } from '@react-three/drei';
import { Suspense, useEffect, useState } from 'react';

import Background3D from '../components/Background3D';
import CanvasProvider from '../components/CanvasProvider';
import SectionFour from '../components/SectionFour';
import SectionOne from '../components/SectionOne';
import SectionThree from '../components/SectionThree';
import SectionTwo from '../components/SectionTwo';

function HomePage() {
  /* ─────────────────────── 1. Animation flags ──────────────────────── */
  const [bgAnimationDone, setBgAnimationDone] = useState(false);
  const [sectionOneDone, setSectionOneDone] = useState(false);

  /* ─────────────────────── 2. Scroll page count ─────────────────────── */
  // Use a stable value for both SSR and the very first client paint
  const [pages, setPages] = useState<number>(7.5);
  useEffect(() => {
    const updatePages = () => {
      const next = window.innerWidth <= 768 ? 9 : 7.5;
      setPages(next);
    };

    updatePages(); // first client pass
    window.addEventListener('resize', updatePages);

    return () => window.removeEventListener('resize', updatePages);
  }, []);

  // Failsafe: never block the DOM content permanently if animation callbacks miss.
  useEffect(() => {
    const fallback = window.setTimeout(() => setBgAnimationDone(true), 1400);
    return () => window.clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (!bgAnimationDone || sectionOneDone) return;
    const fallback = window.setTimeout(() => setSectionOneDone(true), 1400);
    return () => window.clearTimeout(fallback);
  }, [bgAnimationDone, sectionOneDone]);

  /* ─────────────────────── 3. Event handlers ────────────────────────── */
  const handleBackgroundComplete = () => setBgAnimationDone(true);
  const handleSectionOneComplete = () => setSectionOneDone(true);

  /* ─────────────────────── 4. Render ────────────────────────────────── */
  return (
    <CanvasProvider>
      <ScrollControls pages={pages} damping={0}>
        {/* 3D layer  ----------------------------------------------------- */}
        <Suspense fallback={null}>
          <Background3D onAnimationComplete={handleBackgroundComplete} />
        </Suspense>

        {/* DOM layer ----------------------------------------------------- */}
        <Scroll html style={{ width: '100vw', overflowX: 'hidden' }}>
          <main className="min-h-screen overflow-x-hidden px-3 py-4 sm:p-6">
            {bgAnimationDone && (
              <>
                <SectionOne onAnimationComplete={handleSectionOneComplete} />

                {sectionOneDone && (
                  <>
                    <SectionTwo />
                    <SectionThree />
                    <SectionFour />
                  </>
                )}
              </>
            )}
          </main>
        </Scroll>
      </ScrollControls>
    </CanvasProvider>
  );
}

export default HomePage;
