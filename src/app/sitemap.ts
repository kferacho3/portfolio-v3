import type { MetadataRoute } from 'next';
import { caseStudyProjects } from '@/components/SectionThreeData';

const SITE_URL = 'https://www.rachocreates.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/resume`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/case-studies`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/fun`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/myRoom`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const caseStudyRoutes: MetadataRoute.Sitemap = caseStudyProjects
    .filter((project) => !!project.caseStudy)
    .map((project) => ({
      url: `${SITE_URL}/case-studies/${project.caseStudy?.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.75,
    }));

  return [...staticRoutes, ...caseStudyRoutes];
}
