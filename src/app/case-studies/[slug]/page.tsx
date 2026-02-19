import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import TrackedAnchor from '@/components/TrackedAnchor';
import {
  caseStudyProjects,
  getProjectByCaseStudySlug,
} from '@/components/SectionThreeData';

const SITE_URL = 'https://rachodevs.com';

type Params = {
  slug: string;
};

type CaseStudyPageProps = {
  params: Promise<Params>;
};

export function generateStaticParams(): Params[] {
  return caseStudyProjects
    .map((project) => project.caseStudy?.slug)
    .filter(Boolean)
    .map((slug) => ({ slug: slug as string }));
}

export async function generateMetadata({
  params,
}: CaseStudyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectByCaseStudySlug(slug);

  if (!project || !project.caseStudy) {
    return {
      title: 'Case Study Not Found',
    };
  }

  const title = `${project.title} Case Study`;
  const description = project.caseStudy.oneLiner;
  const url = `${SITE_URL}/case-studies/${project.caseStudy.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      images: [
        {
          url: project.imageDesktop || project.imageMobile,
          width: 1200,
          height: 630,
          alt: `${project.title} case study`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [project.imageDesktop || project.imageMobile],
    },
  };
}

export default async function CaseStudyDetailPage({
  params,
}: CaseStudyPageProps) {
  const { slug } = await params;
  const project = getProjectByCaseStudySlug(slug);

  if (!project || !project.caseStudy) {
    notFound();
  }

  const caseStudy = project.caseStudy;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `${project.title} case study`,
    description: caseStudy.oneLiner,
    url: `${SITE_URL}/case-studies/${caseStudy.slug}`,
    author: {
      '@type': 'Person',
      name: 'Kamal Feracho',
      url: SITE_URL,
    },
    about: project.techStack,
    isPartOf: {
      '@type': 'CreativeWorkSeries',
      name: 'Portfolio Case Studies',
      url: `${SITE_URL}/case-studies`,
    },
  };

  return (
    <main className="relative isolate mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-28 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_20%,rgba(57,255,20,0.14),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(148,0,211,0.22),transparent_36%),radial-gradient(circle_at_55%_112%,rgba(255,165,0,0.18),transparent_42%)]"
      />

      <Link
        href="/case-studies"
        className="inline-flex rounded-full border border-gray-300/70 bg-white/70 px-4 py-1.5 text-sm font-semibold text-muted-foreground transition hover:border-[#39FF14]/70 hover:text-foreground dark:border-white/20 dark:bg-black/30"
      >
        ← All case studies
      </Link>

      <header className="relative mt-6 overflow-hidden rounded-3xl border border-gray-200/50 bg-white/75 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 dark:shadow-[0_38px_100px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--brand-gradient-main)]" />
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Case Study
        </p>
        <h1 className="mt-2 text-4xl font-black text-foreground sm:text-5xl md:text-6xl">
          {project.title}
        </h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          {caseStudy.oneLiner}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Role:</span>{' '}
          {caseStudy.role}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {project.techStack.map((item) => (
            <span
              key={item}
              className="rounded-full border border-gray-300/70 bg-white/70 px-3 py-1 text-xs text-muted-foreground dark:border-white/20 dark:bg-white/5"
            >
              {item}
            </span>
          ))}
        </div>
      </header>

      <section className="mt-8 space-y-6">
        <article className="rounded-2xl border border-gray-200/60 bg-white/75 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-black/25">
          <h2 className="text-2xl font-bold text-foreground">Challenge</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            {caseStudy.challenge}
          </p>
        </article>

        <article className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200/60 bg-white/75 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-black/25">
            <h3 className="text-xl font-semibold text-foreground">Constraints</h3>
            <ul className="mt-4 space-y-3 text-muted-foreground">
              {caseStudy.constraints.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="brand-gradient-dot mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200/60 bg-white/75 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-black/25">
            <h3 className="text-xl font-semibold text-foreground">Architecture</h3>
            <ul className="mt-4 space-y-3 text-muted-foreground">
              {caseStudy.architecture.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="brand-gradient-dot mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200/60 bg-white/75 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-black/25">
            <h3 className="text-xl font-semibold text-foreground">Execution</h3>
            <ul className="mt-4 space-y-3 text-muted-foreground">
              {caseStudy.execution.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="brand-gradient-dot mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="rounded-2xl border border-gray-200/60 bg-white/75 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-black/25">
          <h2 className="text-2xl font-bold text-foreground">Outcomes</h2>
          <ul className="mt-4 space-y-3 text-muted-foreground">
            {caseStudy.outcomes.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="brand-gradient-dot mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <footer className="mt-10 flex flex-wrap gap-3 border-t border-gray-200/60 pt-6 dark:border-white/10">
        <TrackedAnchor
          action="visit_live_project_case_study"
          category="case-studies"
          href={project.link}
          projectSlug={caseStudy.slug}
          projectTitle={project.title}
          projectUrl={project.link}
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit Live Project
        </TrackedAnchor>
        <TrackedAnchor
          action="navigate_to_contact_from_case_study"
          category="case-studies"
          href={`/contact?source=${caseStudy.slug}`}
          projectSlug={caseStudy.slug}
          projectTitle={project.title}
          projectUrl={project.link}
          className="rounded-lg border border-gray-300/70 bg-white/60 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-[#9400D3]/70 hover:bg-[#9400D3]/5 dark:border-white/20 dark:bg-white/5 dark:hover:border-[#9400D3]/80 dark:hover:bg-[#9400D3]/10"
        >
          Discuss a Similar Build
        </TrackedAnchor>
      </footer>
    </main>
  );
}
