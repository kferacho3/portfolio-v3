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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const updatePages = () => {
      const next = window.innerWidth <= 768 ? 9 : 7.5;
      setPages(next);
    };

    updatePages(); // first client pass
    window.addEventListener('resize', updatePages);
    setMounted(true); // we’re on the client

    return () => window.removeEventListener('resize', updatePages);
  }, []);

  /* ─────────────────────── 3. Event handlers ────────────────────────── */
  const handleBackgroundComplete = () => setBgAnimationDone(true);
  const handleSectionOneComplete = () => setSectionOneDone(true);

  /* ─────────────────────── 4. Hydration guard ───────────────────────── */
  if (!mounted) return null; // prevents SSR/CSR markup mismatch flashes

  /* ─────────────────────── 5. Render ────────────────────────────────── */
  return (
    <CanvasProvider>
      <Suspense fallback={null}>
        <ScrollControls pages={pages} damping={0}>
          {/* 3D layer  ----------------------------------------------------- */}
          <Background3D onAnimationComplete={handleBackgroundComplete} />

          {/* DOM layer ----------------------------------------------------- */}
          <Scroll html style={{ width: '100vw' }}>
            <main className="min-h-screen p-6">
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
      </Suspense>
    </CanvasProvider>
  );
}

export default HomePage;
