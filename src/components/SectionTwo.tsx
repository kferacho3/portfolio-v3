import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/solid';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  Project,
  featuredWebsites,
  incompleteProjects,
  uiUxDesigns,
} from './SectionTwoData';

function SectionTwo() {
  const [isMobile, setIsMobile] = useState(false);
  // Active index for each carousel
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [activeIncomplete, setActiveIncomplete] = useState(0);
  const [activeUiUx, setActiveUiUx] = useState(0);
  const [expandedProjects, setExpandedProjects] = useState<number[]>([]);

  // Set isMobile based on viewport width
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Refs for horizontal scrolling
  const featuredRef = useRef<HTMLDivElement>(null);
  const incompleteRef = useRef<HTMLDivElement>(null);
  const uiUxRef = useRef<HTMLDivElement>(null);

  // Helper: calculates card width and gap (using viewport values) for mobile
  const getMobileDimensions = () => {
    const cardWidth = window.innerWidth * 0.9; // 90% of viewport width
    const gap = window.innerWidth * 0.025; // 2.5% gap for preview
    return { cardWidth, gap };
  };

  // Generic mobile scroll function for a given carousel
  const mobileScroll = (
    ref: React.RefObject<HTMLDivElement>,
    currentIndex: number,
    setIndex: (val: number) => void,
    direction: 'left' | 'right',
    total: number
  ) => {
    if (ref.current) {
      const { cardWidth, gap } = getMobileDimensions();
      let newIndex = currentIndex;
      if (direction === 'left' && currentIndex > 0) {
        newIndex = currentIndex - 1;
      }
      if (direction === 'right' && currentIndex < total - 1) {
        newIndex = currentIndex + 1;
      }
      setIndex(newIndex);
      ref.current.scrollTo({
        left: newIndex * (cardWidth + gap),
        behavior: 'smooth',
      });
    }
  };

  // Desktop scroll remains similar (scroll by 300px)
  const desktopScroll = (
    ref: React.RefObject<HTMLDivElement>,
    direction: 'left' | 'right'
  ) => {
    if (ref.current) {
      ref.current.scrollBy({
        left: direction === 'left' ? -300 : 300,
        behavior: 'smooth',
      });
    }
  };

  // Toggle project details expansion
  const toggleExpand = (id: number) => {
    setExpandedProjects((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  // Render a project card – uses min-w-[85vw] in mobile so that each card takes up 90vw
  const renderProjects = (projects: Project[]) => {
    return projects.map((project) => {
      const isExpanded = expandedProjects.includes(project.id);
      return (
        <div
          key={project.id}
          className={`relative group overflow-hidden rounded-lg border-2 border-border p-4 bg-card hover-gradient-border transition-transform duration-300 cursor-pointer ${
            isMobile ? 'min-w-[80vw] snap-center' : 'snap-start'
          }`}
        >
          <Image
            src={isMobile ? project.imageMobile : project.imageDesktop}
            alt={project.title}
            width={320}
            height={200}
            className="object-cover w-full h-40 transform transition-transform duration-500 group-hover:scale-110 rounded-md"
          />
          <div className="mt-4 text-foreground">
            <h3 className="text-xl font-semibold">{project.title}</h3>
            <div className="mt-2">
              <p className="font-semibold">Tech Stack:</p>
              <ul className="list-disc list-inside text-sm">
                {project.techStack.map((tech) => (
                  <li key={tech}>{tech}</li>
                ))}
              </ul>
            </div>
            {isExpanded && (
              <>
                <p className="mt-2 text-sm">{project.description}</p>
                <div className="mt-2">
                  <p className="font-semibold">Frameworks:</p>
                  <ul className="list-disc list-inside text-sm">
                    {project.frameworks.map((framework) => (
                      <li key={framework}>{framework}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover-gradient-border transition-colors duration-200"
              >
                Visit Site <ArrowRightIcon className="w-5 h-5 ml-2" />
              </a>
              <button
                onClick={() => toggleExpand(project.id)}
                className="inline-flex items-center px-4 py-2 bg-muted text-muted-foreground rounded-md cursor-pointer hover-gradient-border transition-colors duration-200"
                aria-expanded={isExpanded}
                aria-controls={`project-details-${project.id}`}
              >
                {isExpanded ? 'Less Info' : 'More Info'}{' '}
                <InformationCircleIcon className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <section className="px-4 md:px-12 py-16">
      {/* Featured Websites */}
      <h2 className="text-3xl font-bold mb-8 text-center text-foreground">
        Featured Websites
      </h2>
      <div className="relative mb-16">
        {/* Desktop arrows */}
        {!isMobile && (
          <>
            <button
              onClick={() => desktopScroll(featuredRef, 'left')}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Left"
            >
              <ChevronLeftIcon className="w-6 h-6 text-foreground" />
            </button>
            <button
              onClick={() => desktopScroll(featuredRef, 'right')}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Right"
            >
              <ChevronRightIcon className="w-6 h-6 text-foreground" />
            </button>
          </>
        )}
        {/* Carousel container with flex-nowrap */}
        <div
          ref={featuredRef}
          className={`flex flex-nowrap space-x-[2.5vw] overflow-x-auto scrollbar-hide snap-x snap-mandatory ${
            isMobile ? 'pl-[5vw] pr-[5vw]' : 'justify-center'
          }`}
        >
          {renderProjects(featuredWebsites)}
        </div>
        {/* Mobile arrow controls */}
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
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200"
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
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200"
                aria-label="Scroll Right"
              >
                <ChevronRightIcon className="w-6 h-6 text-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Incomplete Projects */}
      <h2 className="text-3xl font-bold mb-8 text-center text-foreground">
        Incomplete Projects
      </h2>
      <div className="relative mb-16">
        {!isMobile && (
          <>
            <button
              onClick={() => desktopScroll(incompleteRef, 'left')}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Left"
            >
              <ChevronLeftIcon className="w-6 h-6 text-foreground" />
            </button>
            <button
              onClick={() => desktopScroll(incompleteRef, 'right')}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Right"
            >
              <ChevronRightIcon className="w-6 h-6 text-foreground" />
            </button>
          </>
        )}
        <div
          ref={incompleteRef}
          className={`flex flex-nowrap space-x-[2.5vw] overflow-x-auto scrollbar-hide snap-x snap-mandatory ${
            isMobile ? 'pl-[5vw] pr-[5vw]' : 'justify-center'
          }`}
        >
          {renderProjects(incompleteProjects)}
        </div>
        {isMobile && (
          <div className="flex justify-center items-center mt-4 space-x-4">
            {activeIncomplete > 0 && (
              <button
                onClick={() =>
                  mobileScroll(
                    incompleteRef,
                    activeIncomplete,
                    setActiveIncomplete,
                    'left',
                    incompleteProjects.length
                  )
                }
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200"
                aria-label="Scroll Left"
              >
                <ChevronLeftIcon className="w-6 h-6 text-foreground" />
              </button>
            )}
            {activeIncomplete < incompleteProjects.length - 1 && (
              <button
                onClick={() =>
                  mobileScroll(
                    incompleteRef,
                    activeIncomplete,
                    setActiveIncomplete,
                    'right',
                    incompleteProjects.length
                  )
                }
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200"
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
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Left"
            >
              <ChevronLeftIcon className="w-6 h-6 text-foreground" />
            </button>
            <button
              onClick={() => desktopScroll(uiUxRef, 'right')}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200 z-10"
              aria-label="Scroll Right"
            >
              <ChevronRightIcon className="w-6 h-6 text-foreground" />
            </button>
          </>
        )}
        <div
          ref={uiUxRef}
          className={`flex flex-nowrap space-x-[2.5vw] overflow-x-auto scrollbar-hide snap-x snap-mandatory ${
            isMobile ? 'pl-[5vw] pr-[5vw]' : 'justify-center'
          }`}
        >
          {renderProjects(uiUxDesigns)}
        </div>
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
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200"
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
                className="bg-muted bg-opacity-50 p-2 rounded-full focus:outline-none cursor-pointer hover:bg-muted-hover transition-colors duration-200"
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

export default SectionTwo;
