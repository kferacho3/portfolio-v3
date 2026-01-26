// ==========================  app/layout.tsx  ==========================
import type { Metadata, Viewport } from 'next';
import Navbar from '../components/Navbar';
import { GameProvider } from '../contexts/GameContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.rachocreates.com'),
  title: {
    default: 'Kamal Feracho | Full-Stack Engineer & UI Architect',
    template: '%s | Kamal Feracho',
  },
  description:
    'Full-stack engineer specializing in product-ready UI systems, design systems, and immersive 3D web experiences. Expert in React, Next.js, TypeScript, and Three.js.',
  keywords: [
    'Kamal Feracho',
    'Full-Stack Engineer',
    'Frontend Engineer',
    'UI Engineering',
    'UI Architect',
    'Design Systems',
    'Next.js Developer',
    'React Developer',
    'TypeScript',
    'Three.js',
    'WebGL',
    'React Three Fiber',
    'Product Design',
    'Web Development Portfolio',
    'Interactive 3D',
    'Atlanta Developer',
  ],
  authors: [{ name: 'Kamal Feracho', url: 'https://www.rachocreates.com' }],
  creator: 'Kamal Feracho',
  publisher: 'Kamal Feracho',
  category: 'Technology',
  openGraph: {
    title: 'Kamal Feracho | Full-Stack Engineer & UI Architect',
    description:
      'Building product-ready UI systems, design systems, and immersive 3D web experiences. Expert in React, Next.js, and Three.js.',
    url: 'https://www.rachocreates.com',
    siteName: 'Kamal Feracho Portfolio',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Kamal Feracho - Full-Stack Engineer Portfolio',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kamal Feracho | Full-Stack Engineer & UI Architect',
    description:
      'Building product-ready UI systems and immersive 3D web experiences.',
    images: ['/logo.png'],
    creator: '@kferacho3',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
  alternates: {
    canonical: 'https://www.rachocreates.com',
  },
  // JSON-LD structured data via metadata other property
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
        name: 'Kamal Feracho',
        alternateName: 'kferacho3',
        jobTitle: 'Full-Stack Engineer',
        description:
          'Full-stack engineer specializing in product-ready UI systems, design systems, and immersive 3D web experiences.',
        url: 'https://www.rachocreates.com',
        sameAs: [
          'https://github.com/kferacho3',
          'https://www.linkedin.com/in/kamal-feracho-075a5a1aa/',
        ],
        knowsAbout: [
          'React',
          'Next.js',
          'TypeScript',
          'Three.js',
          'WebGL',
          'UI Engineering',
          'Design Systems',
          'Full-Stack Development',
        ],
      },
    }),
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
};

const RootLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <html lang="en" className="dark" suppressHydrationWarning>
    <body className="min-h-screen bg-cloud-aqua dark:bg-dark-cloud antialiased transition-colors duration-300">
      <ThemeProvider>
        <Navbar />
        <GameProvider>{children}</GameProvider>
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
