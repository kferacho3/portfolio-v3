// ==========================  app/layout.tsx  ==========================
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Navbar from '../components/Navbar';
import { caseStudyProjects } from '../components/SectionThreeData';
import { GameProvider } from '../contexts/GameContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import './globals.css';

const SITE_URL = 'https://rachodevs.com';
const SYMBOL_ICON_PATH = '/symbol.png';
const FAVICON_PATH = '/favicon.ico';
const FAVICON_PNG_PATH = '/favicon-48x48.png';
const APPLE_ICON_PATH = '/apple-touch-icon.png';
const ICON_192_PATH = '/icon-192.png';
const ICON_512_PATH = '/icon-512.png';
const gaId = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  authors: [{ name: 'Kamal Feracho', url: SITE_URL }],
  creator: 'Kamal Feracho',
  publisher: 'Kamal Feracho',
  category: 'Technology',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Kamal Feracho | Full-Stack Engineer & UI Architect',
    description:
      'Building product-ready UI systems, design systems, and immersive 3D web experiences. Expert in React, Next.js, and Three.js.',
    url: SITE_URL,
    siteName: 'Kamal Feracho Portfolio',
    images: [
      {
        url: '/opengraph-image',
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
    images: ['/twitter-image'],
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
    icon: [
      { url: FAVICON_PNG_PATH, type: 'image/png', sizes: '48x48' },
      { url: ICON_192_PATH, type: 'image/png', sizes: '192x192' },
      { url: ICON_512_PATH, type: 'image/png', sizes: '512x512' },
      { url: FAVICON_PATH, sizes: 'any' },
    ],
    apple: [{ url: APPLE_ICON_PATH, type: 'image/png', sizes: '180x180' }],
    shortcut: FAVICON_PATH,
  },
  alternates: {
    canonical: SITE_URL,
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
      {gaId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaId}', { page_path: window.location.pathname });`}
          </Script>
        </>
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                '@id': `${SITE_URL}/#website`,
                url: SITE_URL,
                name: 'Kamal Feracho Portfolio',
                inLanguage: 'en-US',
                image: `${SITE_URL}${SYMBOL_ICON_PATH}`,
              },
              {
                '@type': 'Person',
                '@id': `${SITE_URL}/#person`,
                name: 'Kamal Feracho',
                alternateName: 'kferacho3',
                jobTitle: 'Full-Stack Engineer',
                url: SITE_URL,
                image: `${SITE_URL}${SYMBOL_ICON_PATH}`,
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
              {
                '@type': 'CollectionPage',
                '@id': `${SITE_URL}/case-studies/#collection`,
                url: `${SITE_URL}/case-studies`,
                name: 'Portfolio Case Studies',
                mainEntity: {
                  '@type': 'ItemList',
                  itemListElement: caseStudyProjects
                    .filter((project) => !!project.caseStudy)
                    .map((project, index) => ({
                      '@type': 'ListItem',
                      position: index + 1,
                      url: `${SITE_URL}/case-studies/${project.caseStudy?.slug}`,
                      name: project.title,
                    })),
                },
              },
            ],
          }),
        }}
      />
      <ThemeProvider>
        <Navbar />
        <GameProvider>{children}</GameProvider>
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
