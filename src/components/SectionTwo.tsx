import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  Project,
  earlyProjects,
  featuredWebsites,
  uiUxDesigns,
} from './SectionTwoData';

export default function SectionTwo() {
  const [isMobile, setIsMobile] = useState(false);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [activeEarly, setActiveEarly] = useState(0);
  const [activeUiUx, setActiveUiUx] = useState(0);

  // Update isMobile on resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Refs for scrollable containers
  const featuredRef = useRef<HTMLDivElement>(null);
  const earlyRef = useRef<HTMLDivElement>(null);
  const uiUxRef = useRef<HTMLDivElement>(null);

  // Desktop scroll: by container width
  // Replace your existing desktopScroll with this:
  const desktopScroll = (
    ref: React.RefObject<HTMLDivElement>,
    direction: 'left' | 'right'
  ) => {
    if (!ref.current) return;
    const firstCard = ref.current.querySelector<HTMLElement>(
      '.relative.flex-none'
    );
    if (!firstCard) return;
    const style = getComputedStyle(firstCard);
    const gap = parseFloat(style.marginRight);
    const scrollAmount = firstCard.clientWidth + gap;
    ref.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Mobile scroll: by one full viewport
  const mobileScroll = (
    ref: React.RefObject<HTMLDivElement>,
    currentIndex: number,
    setIndex: (i: number) => void,
    direction: 'left' | 'right',
    total: number
  ) => {
    if (!ref.current) return;
    const width = ref.current.clientWidth;
    let nextIndex = currentIndex;
    if (direction === 'left' && currentIndex > 0) {
      nextIndex = currentIndex - 1;
    }
    if (direction === 'right' && currentIndex < total - 1) {
      nextIndex = currentIndex + 1;
    }
    setIndex(nextIndex);
    ref.current.scrollTo({ left: nextIndex * width, behavior: 'smooth' });
  };

  // Renders a carousel (horizontal on desktop, vertical list on mobile)
  const renderProjects = (
    projects: Project[],
    activeIndex: number,
    setActiveIndex: (i: number) => void,
    ref: React.RefObject<HTMLDivElement>
  ) => {
    const isUiUx = projects === uiUxDesigns;
    return (
      <div
        ref={ref}
        className={`${
          isMobile
            ? 'flex flex-col space-y-8'
            : 'flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden scrollbar-hide space-x-4'
        }`}
      >
        {projects.map((project) => (
          <div
            key={project.id}
            className={`relative flex-none ${
              isMobile ? 'w-full' : 'w-2/5'
            } rounded-lg  border-2 border-border p-4 bg-card transition-transform duration-300 hover:scale-105 cursor-pointer`}
            onClick={() => window.open(project.link, '_blank')}
          >
            <div className="w-full h-60 relative overflow-hidden">
              <Image
                src={isMobile ? project.imageMobile : project.imageDesktop}
                alt={project.title}
                fill
                className="absolute inset-0 w-full h-full object-cover rounded-md"
              />
            </div>

            <h3 className="text-xl font-semibold mt-4 text-foreground">
              {project.title}
            </h3>

            <div className="mt-2 text-sm text-foreground">
              {/* Tech Stack always shown */}
              <div
                className={`${isUiUx ? 'w-full' : 'w-1/2 pr-2'} inline-block align-top`}
              >
                <p className="font-semibold">Tech Stack:</p>
                <ul className="list-disc list-inside">
                  {project.techStack.map((tech) => (
                    <li key={tech}>{tech}</li>
                  ))}
                </ul>
              </div>

              {/* Frameworks only if not UI/UX section */}
              {!isUiUx && (
                <div className="w-1/2 pl-2 inline-block align-top">
                  <p className="font-semibold">Frameworks:</p>
                  <ul className="list-disc list-inside">
                    {project.frameworks.map((fw) => (
                      <li key={fw}>{fw}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(project.link, '_blank');
              }}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-hover transition-colors duration-200"
            >
              View More
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="px-4 md:px-12 py-16">
      {/* Featured Websites */}
      <h2 className="text-3xl font-bold mb-8 text-center text-foreground">
        Featured Websites
      </h2>
      <div className="relative mb-16">
        {!isMobile && (
          <>
            <button
              onClick={() => desktopScroll(featuredRef, 'left')}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Left"
            >
              <ChevronLeftIcon className="w-6 h-6 text-foreground" />
            </button>
            <button
              onClick={() => desktopScroll(featuredRef, 'right')}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Right"
            >
              <ChevronRightIcon className="w-6 h-6 text-foreground" />
            </button>
          </>
        )}
        {renderProjects(
          featuredWebsites,
          activeFeatured,
          setActiveFeatured,
          featuredRef
        )}
        {isMobile && (
          <div className="flex justify-center items-center mt-4 space-x-4">
            {activeFeatured > 0 && (
              <button
                onClick={() =>
                  mobileScroll(
                    featuredRef,
                    activeFeatured,
                    setActiveFeatured,
                    'left',
                    featuredWebsites.length
                  )
                }
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200"
                aria-label="Scroll Left"
              >
                <ChevronLeftIcon className="w-6 h-6 text-foreground" />
              </button>
            )}
            {activeFeatured < featuredWebsites.length - 1 && (
              <button
                onClick={() =>
                  mobileScroll(
                    featuredRef,
                    activeFeatured,
                    setActiveFeatured,
                    'right',
                    featuredWebsites.length
                  )
                }
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200"
                aria-label="Scroll Right"
              >
                <ChevronRightIcon className="w-6 h-6 text-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Early Projects */}
      <h2 className="text-3xl font-bold mb-8 text-center text-foreground">
        Early Projects
      </h2>
      <div className="relative mb-16">
        {!isMobile && (
          <>
            <button
              onClick={() => desktopScroll(earlyRef, 'left')}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Left"
            >
              <ChevronLeftIcon className="w-6 h-6 text-foreground" />
            </button>
            <button
              onClick={() => desktopScroll(earlyRef, 'right')}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Right"
            >
              <ChevronRightIcon className="w-6 h-6 text-foreground" />
            </button>
          </>
        )}
        {renderProjects(earlyProjects, activeEarly, setActiveEarly, earlyRef)}
        {isMobile && (
          <div className="flex justify-center items-center mt-4 space-x-4">
            {activeEarly > 0 && (
              <button
                onClick={() =>
                  mobileScroll(
                    earlyRef,
                    activeEarly,
                    setActiveEarly,
                    'left',
                    earlyProjects.length
                  )
                }
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200"
                aria-label="Scroll Left"
              >
                <ChevronLeftIcon className="w-6 h-6 text-foreground" />
              </button>
            )}
            {activeEarly < earlyProjects.length - 1 && (
              <button
                onClick={() =>
                  mobileScroll(
                    earlyRef,
                    activeEarly,
                    setActiveEarly,
                    'right',
                    earlyProjects.length
                  )
                }
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200"
                aria-label="Scroll Right"
              >
                <ChevronRightIcon className="w-6 h-6 text-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* UI/UX Designs */}
      <h2 className="text-3xl font-bold mb-8 text-center text-foreground">
        UI/UX Designs
      </h2>
      <div className="relative">
        {!isMobile && (
          <>
            <button
              onClick={() => desktopScroll(uiUxRef, 'left')}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Left"
            >
              <ChevronLeftIcon className="w-6 h-6 text-foreground" />
            </button>
            <button
              onClick={() => desktopScroll(uiUxRef, 'right')}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Right"
            >
              <ChevronRightIcon className="w-6 h-6 text-foreground" />
            </button>
          </>
        )}
        {renderProjects(uiUxDesigns, activeUiUx, setActiveUiUx, uiUxRef)}
        {isMobile && (
          <div className="flex justify-center items-center mt-4 space-x-4">
            {activeUiUx > 0 && (
              <button
                onClick={() =>
                  mobileScroll(
                    uiUxRef,
                    activeUiUx,
                    setActiveUiUx,
                    'left',
                    uiUxDesigns.length
                  )
                }
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200"
                aria-label="Scroll Left"
              >
                <ChevronLeftIcon className="w-6 h-6 text-foreground" />
              </button>
            )}
            {activeUiUx < uiUxDesigns.length - 1 && (
              <button
                onClick={() =>
                  mobileScroll(
                    uiUxRef,
                    activeUiUx,
                    setActiveUiUx,
                    'right',
                    uiUxDesigns.length
                  )
                }
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none hover:bg-muted-hover transition-colors duration-200"
                aria-label="Scroll Right"
              >
                <ChevronRightIcon className="w-6 h-6 text-foreground" />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
