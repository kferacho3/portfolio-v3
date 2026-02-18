// components/SectionTwoData.tsx

export interface Project {
  id: number;
  title: string;
  imageDesktop: string;
  imageMobile: string;
  link: string;
  description: string;
  highlights?: string[];
  featureTabs?: Array<{
    key: string;
    label: string;
    description: string;
    ctaLabel: string;
    ctaHref?: string;
  }>;
  techStack: string[];
  frameworks: string[];
}

/* -------------------------------------------------------------------------- */
/*                               FEATURED SITES                               */
/* -------------------------------------------------------------------------- */

export const featuredWebsites: Project[] = [
  {
    id: 0,
    title: 'Zom AI',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/ZomAIPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/ZomAIPreview.webp',
    link: 'https://zomtech.com',
    description:
      'Lead frontend and UI engineering across the product. Built the app shell and component architecture, delivered responsive UX from mobile to desktop, and orchestrated complex API integrations with authenticated workflows and synchronized state.',
    featureTabs: [
      {
        key: 'planning',
        label: 'Proactive Planning',
        description:
          "Zom continuously monitors client situations and surfaces routine check-ins and tax-aware opportunities before they're missed.",
        ctaLabel: 'Solutions for Planning',
      },
      {
        key: 'meetings',
        label: 'Live Meetings',
        description:
          'Meeting agendas are built automatically from live client context, with CRM updates handled in the background as conversations happen.',
        ctaLabel: 'Solutions for Meetings',
      },
      {
        key: 'research',
        label: 'Instant Research',
        description:
          'Market information and firm ETF or holding-level insights are available in one place, without switching systems or losing focus.',
        ctaLabel: 'Solutions for Research',
      },
      {
        key: 'risk',
        label: 'Hedging & Risk Awareness',
        description:
          'Zom flags market movements that matter and maps risk directly to affected clients so outreach happens with intent, not reaction.',
        ctaLabel: 'Solutions for Risk',
      },
    ],
    highlights: [
      'Owned the design system and reusable component library for the core UI.',
      'Integrated secure authentication, role-based routing, and session handling.',
      'Connected multiple backend endpoints and built real-time UI synchronization.',
      'Shipped performance profiling, accessibility improvements, and QA release checks.',
      'Instrumented analytics and error tracking for production observability.',
    ],
    techStack: [
      'TypeScript',
      'React',
      'Next.js',
      'API Integrations',
      'Authentication',
      'State Management',
      'Design Systems',
    ],
    frameworks: [],
  },
  {
    id: 1,
    title: 'Sunny Island Pepper Sauce',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/SunnyIslandPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/SunnyIslandPreview.webp',
    link: 'https://www.sunnyislandpepper.com/',
    description:
      'A headless-Shopify 3D e-commerce experience for an emerging hot-sauce brand. The site fuses Next.js 15, React 19, and React Three Fiber to present interactive product scenes, uses the Shopify Storefront GraphQL API for real-time inventory, and relies on Prisma + PostgreSQL for content and order metadata. Advanced techniques include custom GLSL shaders for bottle animation, Framer Motion micro-interactions, Tailwind CSS utility design, secure Next-Auth flows, and automated e-mail receipts with Nodemailer.',
    techStack: [
      'TypeScript',
      'React 19',
      'Next.js 15',
      'Three.js 0.172',
      'GraphQL',
      'Prisma',
      'PostgreSQL',
      'Shopify Storefront API',
    ],
    frameworks: [
      'React Three Fiber',
      'Framer Motion',
      'React Three Postprocessing',
      'Tailwind CSS',
      'Next-Auth',
    ],
  },
  {
    id: 2,
    title: 'Wardrobe X',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/WardrobeXPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/WardrobeXPreview.webp',
    link: 'https://www.wardrobex.io/',
    description:
      'An immersive Web 3.0 wardrobe marketplace (formerly Web3Outfitters) for digital wearables and NFTs. Built with Next.js, React Three Fiber, Zustand state management, and AWS Amplify hosting. Features on-chain metadata rendering, drag-and-drop 3D closets, wallet-gated routes, and smooth physics-based interactions via @react-three/cannon. Styled-Components handle theming, while React-Spring drives page-level transitions.',
    techStack: [
      'TypeScript',
      'React 19',
      'Next.js 15',
      'Three.js',
      'AWS Amplify',
      'IPFS',
      'Smart Contracts',
    ],
    frameworks: [
      'React Three Fiber',
      'React Spring',
      'Zustand',
      'Styled-Components',
      'Framer Motion',
    ],
  },
  {
    id: 3,
    title: 'ANTI-HEROES v2',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/Anti-heroesPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/Anti-heroesPreview.webp',
    link: 'https://anti-heroes.co',
    description:
      'Version 2 of the Anti-Heroes experience, positioned as the primary release with refreshed creative direction and expanded interactive production features.',
    techStack: [
      'TypeScript',
      'React 19',
      'Next.js 15',
      'Three.js',
      'Web Audio API',
      'GLSL',
    ],
    frameworks: ['React Three Fiber', 'Lamina', 'Framer Motion'],
  },
  {
    id: 4,
    title: 'Bodega Danes',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/BodegaDanesPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/BodegaDanesPreview.webp',
    link: 'https://bodegadanes.com',
    description:
      'Booking-first catering platform offering live on-site cooking. Provides a secure admin dashboard for service analytics and Stripe payouts. Data persistence is powered by Prisma + PostgreSQL; Next-Auth guards admin routes; React-Hook-Form and DayPicker handle UX-friendly scheduling; Tailwind + Framer Motion deliver a polished dark/light UI.',
    techStack: [
      'TypeScript',
      'React 19',
      'Next.js 15',
      'Prisma',
      'PostgreSQL',
      'Stripe',
      'Tailwind CSS',
    ],
    frameworks: ['Next-Auth', 'Framer Motion', 'React-Hook-Form', 'Heroicons'],
  },
  {
    id: 5,
    title: 'Vape Aura',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/AuraHempandVaporPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/AuraHempandVaporPreview.webp',
    link: 'https://main.d1v4eeamvmnirt.amplifyapp.com',
    description:
      'A lean product-showcase for a start-up vape retailer, built with Next.js 15, React 19, and Tailwind CSS 3.4. The roadmap includes a Prisma-backed catalog, Stripe checkout, and an owner-only admin panel. Current features ship with animated category filtering (Framer Motion) and class-safe utility styling via Tailwind-Merge.',
    techStack: [
      'TypeScript',
      'React 19',
      'Next.js 15',
      'Tailwind CSS',
      'Framer Motion',
      'Prisma (planned)',
    ],
    frameworks: ['Tailwind', 'Framer Motion', 'React-Icons'],
  },
  {
    id: 6,
    title: 'BT GOD',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/btgodPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/btgodPreview.webp',
    link: 'https://btgod.co',
    description:
      'Main project slot for BT GOD. Designed as a focused digital destination for releases, brand identity, and audience engagement.',
    techStack: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS'],
    frameworks: ['Framer Motion', 'Design Systems'],
  },
  {
    id: 7,
    title: 'ANTI-HEROES v1',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/AntiheroesPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Featured+Projects/AntiheroesPreview.webp',
    link: 'https://main.d38w3p8vlw981a.amplifyapp.com',
    description:
      'Version 1 of the music-portfolio hub for an ATL producer that marries Spotify’s Web API with an advanced FFT audio visualizer. Five visualization modes—Noise, Fractal, Ray-marched ‘Phantom Star’, Orbital Geometry, and Supershape—react to live audio via the Web Audio API and custom GLSL.',
    techStack: [
      'TypeScript',
      'React 19',
      'Next.js 15',
      'Three.js',
      'Web Audio API',
      'Spotify API',
      'GLSL',
    ],
    frameworks: [
      'React Three Fiber',
      'Lamina',
      '@react-spring/three',
      'Valtio',
      'Framer Motion',
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*                             EARLY PROJECTS                            */
/* -------------------------------------------------------------------------- */

export const earlyProjects: Project[] = [
  {
    id: 4,
    title: 'MetaTunes',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Past+Designs+%26+Developments/MetaTunesPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Past+Designs+%26+Developments/MetaTunesPreview.webp',
    link: 'https://main.d2x3hcw4tp5zi4.amplifyapp.com/',
    description:
      'Early-stage NFT music marketplace prototype: React + Styled-Components front-end with P5.js visuals, wallet auth (planned), and lazy-minting workflow.',
    techStack: ['JavaScript', 'React'],
    frameworks: ['Styled-Components'],
  },
  {
    id: 5,
    title: 'K & M Renovation and Restoration',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Past+Designs+%26+Developments/KandMPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Past+Designs+%26+Developments/KandMPreview.webp',
    link: 'https://k-m-restoration.firebaseapp.com/',
    description:
      'Two-page brochure site for an independent roofing contractor. Deployed to Firebase Hosting with on-scroll animations and responsive gallery.',
    techStack: ['HTML', 'CSS', 'JavaScript'],
    frameworks: ['Firebase Hosting'],
  },
  {
    id: 6,
    title: 'Get Relocate',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Past+Designs+%26+Developments/GetRelocatePreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Past+Designs+%26+Developments/GetRelocatePreview.webp',
    link: 'https://main.d1kac4geol6jy1.amplifyapp.com',
    description:
      'Comprehensive moving-company site on AWS Amplify with quotation wizard, multi-step forms, and Styled-Components theming. Future phases add driver dashboards.',
    techStack: ['JavaScript', 'React', 'AWS Amplify'],
    frameworks: ['Styled-Components', 'Framer Motion'],
  },
  {
    id: 7,
    title: 'Portfolio v1 (First Iteration)',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Past+Designs+%26+Developments/OldPortfolioPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/Past+Designs+%26+Developments/OldPortfolioPreview.webp',
    link: 'https://main.d2gdmmdev3o5mw.amplifyapp.com/',
    description:
      'Personal portfolio revamp hosted on AWS Amplify featuring React Three Fiber hero scenes, MDX blog support, ESLint/Prettier tooling, and CI/CD on every push.',
    techStack: ['JavaScript', 'React 18', 'Three.js', 'Styled Components'],
    frameworks: [
      'React Three Fiber',
      'Framer Motion',
      'Post Processing',
      'Rapier Physics',
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*                               UI / UX DESIGNS                              */
/* (unchanged — kept here for completeness; update if needed in future)       */
/* -------------------------------------------------------------------------- */

export const uiUxDesigns: Project[] = [
  {
    id: 8,
    title: 'st Home Rental',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/UI-UX+Designs/stHomeRentalPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/UI-UX+Designs/stHomeRentalPreview.webp',
    link: 'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/FullDesigns/stHomeRentalFinal.webp',
    description:
      'Digital gateway for a hospitality service, providing a welcoming UX for guests seeking accommodation.',
    techStack: ['Figma', 'Adobe'],
    frameworks: [''],
  },
  {
    id: 9,
    title: 'Black C.A.T.',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/UI-UX+Designs/BlackHatPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/UI-UX+Designs/BlackHatPreview.webp',
    link: 'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/FullDesigns/BlackHatFinal.webp',
    description:
      'Conceptual networking platform tailored to under-represented communities, inspired by LinkedIn’s UX patterns.',
    techStack: ['Figma', 'Adobe'],
    frameworks: [''],
  },
  {
    id: 10,
    title: 'Show No Love Apparel',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/UI-UX+Designs/SNLPreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/UI-UX+Designs/SNLPreview.webp',
    link: 'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/FullDesigns/SNLFull.webp',
    description:
      'Upcoming e-commerce storefront for an Atlanta-based fashion brand. UI kit focuses on bold typography and dynamic look-books.',
    techStack: ['Figma', 'Adobe'],
    frameworks: [''],
  },
  {
    id: 11,
    title: 'Flow Collaborative',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/UI-UX+Designs/FlowCollaborativePreview.webp',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/UI-UX+Designs/FlowCollaborativePreview.webp',
    link: 'https://racho-devs.s3.us-east-2.amazonaws.com/portfolio/FullDesigns/Flow+Collaborative+Design.png',
    description:
      'Paused website design for client that will resume in near future',
    techStack: ['Figma', 'Adobe'],
    frameworks: [''],
  },
];
