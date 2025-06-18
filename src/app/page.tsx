'use client';

import SectionFour from '@/components/SectionFour';
import { Scroll, ScrollControls } from '@react-three/drei';
import { Suspense, useEffect, useState } from 'react';
import Background3D from '../components/Background3D';
import SectionOne from '../components/SectionOne';
import SectionThree from '../components/SectionThree';
import SectionTwo from '../components/SectionTwo';

function HomePage() {
  const [background3DAnimationComplete, setBackground3DAnimationComplete] =
    useState(false);
  const [sectionOneAnimationComplete, setSectionOneAnimationComplete] =
    useState(false);

  // Determine how many scroll pages to use based on viewport width
  const [pages, setPages] = useState(6);

  useEffect(() => {
    const updatePages = () => {
      setPages(window.innerWidth <= 768 ? 8 : 6.5);
    };

    // initialize
    updatePages();

    window.addEventListener('resize', updatePages);
    return () => window.removeEventListener('resize', updatePages);
  }, []);

  const handleBackground3DAnimationComplete = () => {
    setBackground3DAnimationComplete(true);
  };

  const handleSectionOneAnimationComplete = () => {
    setSectionOneAnimationComplete(true);
  };

  return (
    <Suspense fallback={null}>
      <ScrollControls pages={pages} damping={0}>
        {/* 3D Content */}
        <Background3D
          onAnimationComplete={handleBackground3DAnimationComplete}
        />

        {/* Always mount Scroll html, but conditionally render its content */}
        <Scroll html style={{ width: '100vw' }}>
          <main className="min-h-screen p-6">
            {background3DAnimationComplete ? (
              <>
                <SectionOne
                  onAnimationComplete={handleSectionOneAnimationComplete}
                />
                {sectionOneAnimationComplete && (
                  <>
                    <SectionTwo />
                    <SectionThree />
                    <SectionFour />
                  </>
                )}
              </>
            ) : null}
          </main>
        </Scroll>
      </ScrollControls>
    </Suspense>
  );
}

export default HomePage;
