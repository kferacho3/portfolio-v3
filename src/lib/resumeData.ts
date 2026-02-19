export const resumeData = {
  name: 'Kamal Feracho',
  headline: 'Full-Stack Engineer | UI Systems | Interactive 3D',
  location: 'Atlanta, GA',
  email: 'kferacho64@gmail.com',
  website: 'https://www.rachocreates.com',
  github: 'https://github.com/kferacho3',
  linkedin: 'https://www.linkedin.com/in/kamal-feracho-075a5a1aa/',
  summary:
    'Full-stack engineer focused on product-grade frontend architecture, design systems, and immersive interactive web applications. Ships production UIs, API-integrated workflows, and performance-minded experiences across React/Next.js ecosystems.',
  skills: [
    {
      label: 'Frontend',
      items: [
        'TypeScript',
        'React',
        'Next.js',
        'Tailwind CSS',
        'Framer Motion',
        'Accessibility (WCAG)',
      ],
    },
    {
      label: '3D / Realtime',
      items: [
        'Three.js',
        'React Three Fiber',
        'WebGL',
        'Shader Workflows',
        'Interactive Rendering',
      ],
    },
    {
      label: 'Backend / Product',
      items: [
        'API Integration',
        'Authentication / Authorization',
        'State Management',
        'Prisma',
        'PostgreSQL',
        'Observability Instrumentation',
      ],
    },
  ],
  experience: [
    {
      company: 'Zom AI',
      role: 'Lead Frontend Engineer',
      period: 'Current',
      bullets: [
        'Led frontend architecture and design-system implementation for advisor product workflows.',
        'Built responsive planning, meetings, research, and risk interfaces across mobile and desktop.',
        'Integrated authenticated API flows with synchronized UI state and role-aware routing.',
        'Added release QA, error tracking, and analytics instrumentation for production reliability.',
      ],
    },
    {
      company: 'RachoDevs',
      role: 'Full-Stack Engineer',
      period: 'Current',
      bullets: [
        'Designed and shipped client-facing web products and interactive experiences end-to-end.',
        'Built reusable component systems and scalable app structures for faster feature delivery.',
        'Delivered e-commerce, booking, and creative web platforms using modern React/Next.js stacks.',
      ],
    },
  ],
  selectedProjects: [
    {
      title: 'Prism Ultimate',
      link: 'https://prism3d.studio',
      bullets: [
        'Built a modular arcade platform with shared shell, game registry, and runtime hooks.',
        'Standardized lifecycle, control, and HUD systems across a large game catalog.',
        'Improved maintainability and runtime consistency while scaling new game additions.',
      ],
    },
    {
      title: 'ANTI-HEROES v2',
      link: 'https://anti-heroes.co',
      bullets: [
        'Remodeled and simplified the experience for better runtime performance and traffic flow.',
        'Preserved core creative direction while reducing technical complexity.',
      ],
    },
    {
      title: 'Sunny Island Pepper Sauce',
      link: 'https://www.sunnyislandpepper.com/',
      bullets: [
        'Built headless Shopify experience with interactive 3D product presentation.',
        'Integrated storefront data, checkout-related flows, and responsive UX systems.',
      ],
    },
  ],
} as const;
