export type ResumeSkillGroup = {
  label: string;
  items: string[];
};

export type ResumeExperience = {
  company: string;
  role: string;
  period: string;
  link?: string;
  bullets: string[];
};

export type ResumeEducation = {
  degree: string;
  school: string;
  location: string;
  period: string;
};

export type ResumeTrack = {
  id: 'engineering' | 'design';
  title: string;
  headline: string;
  summary: string;
  skills: ResumeSkillGroup[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  language?: string[];
};

export type ResumeProject = {
  title: string;
  link: string;
  caseStudySlug?: string;
  hidden?: boolean;
  focus: string;
  bullets: string[];
};

export const resumeData = {
  name: 'Kamal Feracho',
  phone: '+1 470-416-5838',
  email: 'kferacho64@gmail.com',
  location: 'Conyers, GA 30094',
  website: 'https://rachodevs.com',
  github: 'https://github.com/kferacho3',
  linkedin: 'https://www.linkedin.com/in/kamal-feracho-075a5a1aa/',
  tracks: [
    {
      id: 'engineering',
      title: 'Front-End and Full-Stack Engineering Resume',
      headline: 'Results-driven Front-End Engineer, B.S. Computer Science (Georgia Tech).',
      summary:
        'Builds product-ready systems from 2D storefronts to immersive 3D experiences. Expert in Next.js, React Three Fiber, TypeScript, GLSL, and AWS Amplify. Focused on secure auth flows, performance optimization, and shipping production e-commerce, booking, and media platforms from Figma through deployment.',
      skills: [
        {
          label: 'Languages and Frameworks',
          items: [
            'JavaScript (ES2022)',
            'TypeScript',
            'React',
            'Next.js',
            'Node.js',
          ],
        },
        {
          label: '3D and Graphics',
          items: [
            'React Three Fiber',
            'GLSL Shaders',
            'Blender',
            'Lamina',
            'WebGL',
          ],
        },
        {
          label: 'Data and APIs',
          items: [
            'REST',
            'GraphQL',
            'Prisma ORM',
            'Supabase',
            'PostgreSQL',
            'Firebase',
            'AWS SES',
            'AWS S3',
          ],
        },
        {
          label: 'Design and UX',
          items: [
            'Figma',
            'FigJam',
            'Design Systems',
            'WCAG 2.2 Audits',
            'UX Writing',
            'A/B Testing Planning',
          ],
        },
        {
          label: 'Styling and Motion',
          items: ['Tailwind CSS', 'Framer Motion', 'CSS Modules'],
        },
        {
          label: 'AI and LLM Workflows',
          items: ['OpenAI Assistants API', 'Bolt.ai', 'Cursor.ai'],
        },
        {
          label: 'Testing and DevOps',
          items: ['AWS Amplify CI/CD', 'Playwright smoke testing'],
        },
      ],
      experience: [
        {
          company: 'WardrobeX',
          role: 'Lead Front-End Engineer',
          period: '2023 - Current',
          link: 'https://www.wardrobex.io/',
          bullets: [
            'Re-architected the storefront to a 3D closet interaction with React Three Fiber and custom PBR shaders, then validated stronger engagement with Hotjar session and scroll-depth metrics.',
            'Migrated the codebase to Next.js App Router with dynamic imports and edge functions, reducing first-byte latency reported by Lighthouse.',
            'Implemented a virtualized product grid for 1k to 10k SKUs with React-Window while maintaining mobile CLS under 0.1.',
          ],
        },
        {
          company: 'Xaeneptune (AntiHeroes)',
          role: '3D Front-End Engineer',
          period: 'February 2025 - Current',
          link: 'https://antiheroes.co/',
          bullets: [
            'Created five FFT-based audio visualizers (raymarching, supershape, cellular) synchronized to the Web Audio API.',
            'Modularized shader systems into Lamina nodes and documented patterns in Storybook so design could iterate without engineering bottlenecks.',
            'Remodeled and simplified the Anti-Heroes runtime for faster load paths and stronger traffic conversion.',
          ],
        },
        {
          company: 'AURA Hemp and Vapor',
          role: 'Full-Stack Developer',
          period: 'March 2025 - June 2025',
          link: 'https://vapeaura.shop/',
          bullets: [
            'Delivered a minimalist e-commerce MVP with Next.js 14, Prisma, and Stripe.',
            'Implemented a Sharp to S3 image pipeline to keep Core Web Vitals in the green.',
            'Set up Amplify CI/CD preview environments on pull requests and added Playwright smoke tests to gate merges.',
          ],
        },
        {
          company: 'Bodega Danes',
          role: 'Full-Stack Developer',
          period: 'February 2025 - May 2025',
          link: 'https://bodegadanes.com/',
          bullets: [
            'Built a booking portal with React Hook Form, NextAuth, and PostgreSQL.',
            'Added calendar sync and transactional email flows with AWS SES.',
            'Ran accessibility audits with axe-core and remediated focus states, contrast, and ARIA labels site-wide.',
          ],
        },
        {
          company: 'Sunny Island Pepper Sauce',
          role: 'Front-End Engineer',
          period: '2024 - 2025',
          link: 'https://sunnyislandpepper.com/',
          bullets: [
            'Delivered a 25-page storefront with Next.js 15, TypeScript, and Tailwind, including a custom /api/shopify route for live product, variant, and inventory data from Storefront GraphQL.',
            'Built an immersive home experience with a full-screen video hero and Framer Motion parallax sections while keeping performance and CLS stable.',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science (B.S.), Computer Science',
          school: 'Georgia Institute of Technology',
          location: 'Atlanta, Georgia',
          period: 'May 2022',
        },
      ],
    },
    {
      id: 'design',
      title: 'Product and Brand Design Resume',
      headline: 'Multidisciplinary Product and Brand Designer with front-end execution depth.',
      summary:
        'Bridges research, visual storytelling, and production implementation across e-commerce, SaaS, Web3, and lifestyle brands. Delivers conversion-focused systems from user journeys and design systems in Figma/FigJam to high-fidelity 3D prototypes and production assets in Framer, Blender, Adobe CC, and generative AI tooling.',
      skills: [
        {
          label: 'Research and UX',
          items: [
            'User Research and Personas',
            'Interaction Design',
            'UX Writing',
            'A/B Testing',
            'Accessibility (WCAG)',
          ],
        },
        {
          label: 'Design Systems and Branding',
          items: [
            'Design Systems',
            'Branding',
            'Logo Design',
            'Visual Storytelling',
          ],
        },
        {
          label: 'Tooling',
          items: [
            'Figma',
            'FigJam',
            'Framer',
            'Framer Motion',
            'Adobe CC (Photoshop, Illustrator, After Effects)',
            'Blender',
            'DALL-E',
            'Midjourney',
          ],
        },
      ],
      experience: [
        {
          company: 'Sunny Island Pepper Sauce',
          role: 'Brand and Product Designer',
          period: 'January 2024 - Present',
          link: 'https://sunnyislandpepper.com/',
          bullets: [
            'Defined the full visual identity (palette, wordmark, packaging direction) and delivered FDA-compliant bottle labels ready for production.',
            'Built and evolved the responsive Shopify and Framer site system from UX flows to checkout and wholesale pathways.',
            'Delivered a 20+ page storefront spanning product pages, content surfaces, and conversion-focused journey design.',
          ],
        },
        {
          company: 'VapeAura',
          role: 'Brand Designer',
          period: 'April 2025 - Present',
          link: 'https://vapeaura.shop/',
          bullets: [
            'Defined a minimalist vapor-wave brand language with logo suite, packaging, and motion hero system.',
            'Implemented interactive product browsing patterns with Framer Motion and improved product click-through by 22%.',
          ],
        },
        {
          company: 'WardrobeX',
          role: 'Lead Designer',
          period: 'January 2023 - Present',
          link: 'https://www.wardrobex.io/',
          bullets: [
            'Designed immersive 3D closet and guided try-on flows across a multi-page Web3 fashion marketplace, reducing bounce rate by 35%.',
            'Authored a full design system with typography, tokens, and 3D interaction guidelines for engineering handoff.',
            'Optimized GLB assets in Blender and integrated with React Three Fiber for real-time viewing.',
          ],
        },
        {
          company: 'Bodega Danes',
          role: 'UX/UI Designer',
          period: 'March 2025 - April 2025',
          link: 'https://bodegadanes.com/',
          bullets: [
            'Conducted a heuristic audit and simplified the booking journey from 8 steps to 4.',
            'Designed responsive layouts, photography-driven hero assets, and tone-of-voice guidelines.',
            'Produced menus, logos, and labels for site and event collateral.',
          ],
        },
        {
          company: 'AntiHeroes',
          role: 'Visual and Interaction Designer',
          period: 'January 2025 - March 2025',
          link: 'https://antiheroes.co/',
          bullets: [
            'Led art direction for an audio-visualizer suite across fractal, supershape, and cellular modes.',
            'Designed beats, artist, bio, and media pages tied to campaign storytelling.',
            'Built and integrated a Blender-based 3D landing scene that improved average session time by 42% after launch.',
          ],
        },
        {
          company: 'Relocate (Discontinued)',
          role: 'Graphic Designer',
          period: 'September 2023 - November 2023',
          link: 'https://main.d1kac4geol6jy1.amplifyapp.com/',
          bullets: [
            'Owned end-to-end visual design for 30+ pages and sections in Figma.',
            'Produced a complete logo family and custom SVG icon library that accelerated implementation by two sprints.',
            'Mapped designs into 1:1 React-ready structures via Framer workflows.',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science (B.S.), Computer Science',
          school: 'Georgia Institute of Technology',
          location: 'Atlanta, Georgia',
          period: 'May 2022',
        },
      ],
      language: ['English (Native)'],
    },
  ] as ResumeTrack[],
  selectedProjects: [
    {
      title: 'Zom AI',
      link: 'https://www.zomtech.com/',
      focus:
        'Domain-specific AI platform for financial advisors focused on context-aware guidance and secure delivery.',
      bullets: [
        'The platform positions itself as purpose-built for financial advisors, with a context-leveraged model tuned for advisor workflows and client context.',
        'Support documentation highlights enterprise onboarding services including integrations, data migration, custom model tuning, and workflow automation setup.',
        'Security documentation cites AWS Fargate/ECS deployment in private subnets, JWT-based role access controls, and an active vulnerability disclosure program.',
      ],
    },
    {
      title: 'Prism Ultimate',
      link: 'https://prism3d.studio',
      caseStudySlug: 'prism-ultimate',
      focus: 'Scalable game-platform engineering for browser arcade systems',
      bullets: [
        'Built shared shell infrastructure, lifecycle hooks, and game registry contracts to scale title delivery.',
        'Standardized controls/HUD patterns and tuned runtime performance for high-FPS gameplay consistency.',
      ],
    },
    {
      title: 'ANTI-HEROES v2',
      link: 'https://antiheroes.co/',
      caseStudySlug: 'anti-heroes-revamp',
      focus: 'Performance and traffic-path revamp of a creative 3D music experience',
      bullets: [
        'Simplified runtime architecture and scene flow for faster perceived load and cleaner campaign entry paths.',
        'Preserved the visual identity while reducing complexity and improving maintainability.',
      ],
    },
    {
      title: 'WardrobeX',
      link: 'https://www.wardrobex.io/',
      caseStudySlug: 'wardrobex-3d-commerce',
      focus: '3D commerce architecture and performance optimization',
      bullets: [
        'Rebuilt product interaction around immersive 3D closet UX and virtualized large catalog browsing.',
        'Combined visual experimentation with production performance targets to keep mobile experience stable.',
      ],
    },
  ] as ResumeProject[],
} as const;
