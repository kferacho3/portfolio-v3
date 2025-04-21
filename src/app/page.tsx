'use client';

import { Scroll, ScrollControls } from '@react-three/drei';
import { Suspense, useState } from 'react';
import Background3D from '../components/Background3D';
import SectionOne from '../components/SectionOne';
import SectionThree from '../components/SectionThree';
import SectionTwo from '../components/SectionTwo';

function HomePage() {
  const [background3DAnimationComplete, setBackground3DAnimationComplete] =
    useState(false);
  const [sectionOneAnimationComplete, setSectionOneAnimationComplete] =
    useState(false);

  const handleBackground3DAnimationComplete = () => {
    setBackground3DAnimationComplete(true);
  };

  const handleSectionOneAnimationComplete = () => {
    setSectionOneAnimationComplete(true);
  };

  return (
    <Suspense fallback={null}>
      <ScrollControls pages={6} damping={0}>
        {/* 3D Content */}
        <Background3D
          onAnimationComplete={handleBackground3DAnimationComplete}
        />

        {/* Always mount Scroll html, but conditionally render its content */}
        <Scroll html style={{ width: '100vw' }}>
          <main className="p-6 min-h-screen">
            {background3DAnimationComplete ? (
              <>
                <SectionOne
                  onAnimationComplete={handleSectionOneAnimationComplete}
                />
                {sectionOneAnimationComplete && (
                  <>
                    <SectionTwo />
                    <SectionThree />
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
