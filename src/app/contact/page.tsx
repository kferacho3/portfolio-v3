import type { Metadata } from 'next';
import ContactPageClient from './ContactPageClient';

const SITE_URL = 'https://rachodevs.com';
const canonicalUrl = `${SITE_URL}/contact`;

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with Kamal Feracho for product-ready UI systems, design systems, and immersive 3D web experiences.',
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: 'Contact Kamal Feracho',
    description:
      'Share your project goals and get a clear technical response with scope and next steps.',
    url: canonicalUrl,
    type: 'website',
  },
};

export default function ContactPage() {
  return <ContactPageClient />;
}

