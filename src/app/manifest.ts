import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kamal Feracho | Full-Stack Engineer & UI Architect',
    short_name: 'RachoDevs',
    description:
      'Full-stack engineer specializing in product-ready UI systems, design systems, and immersive 3D web experiences.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080a15',
    theme_color: '#080a15',
    icons: [
      {
        src: '/favicon-48x48.png',
        sizes: '48x48',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
