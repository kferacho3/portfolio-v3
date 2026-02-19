import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import TrackedAnchor from '@/components/TrackedAnchor';
import {
  caseStudyProjects,
  getProjectByCaseStudySlug,
} from '@/components/SectionThreeData';

type Params = {
  slug: string;
};

export function generateStaticParams(): Params[] {
  return caseStudyProjects
    .map((project) => project.caseStudy?.slug)
    .filter(Boolean)
    .map((slug) => ({ slug: slug as string }));
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const { slug } = params;
  const project = getProjectByCaseStudySlug(slug);

  if (!project || !project.caseStudy) {
    return {
      title: 'Case Study Not Found',
    };
  }

  const title = `${project.title} Case Study`;
  const description = project.caseStudy.oneLiner;
  const url = `https://www.rachocreates.com/case-studies/${project.caseStudy.slug}`;

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

export default function CaseStudyDetailPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = params;
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
    url: `https://www.rachocreates.com/case-studies/${caseStudy.slug}`,
    author: {
      '@type': 'Person',
      name: 'Kamal Feracho',
      url: 'https://www.rachocreates.com',
    },
    about: project.techStack,
    isPartOf: {
      '@type': 'CreativeWorkSeries',
      name: 'Portfolio Case Studies',
      url: 'https://www.rachocreates.com/case-studies',
    },
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-28 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <Link
        href="/case-studies"
        className="text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        ← All case studies
      </Link>

      <header className="mt-6 rounded-2xl border border-gray-200/60 bg-white/70 p-6 dark:border-white/10 dark:bg-card/50">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Case Study
        </p>
        <h1 className="mt-2 text-4xl font-black text-foreground sm:text-5xl">
          {project.title}
        </h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">
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
              className="rounded-full border border-gray-200/70 px-3 py-1 text-xs text-muted-foreground dark:border-white/10"
            >
              {item}
            </span>
          ))}
        </div>
      </header>

      <section className="mt-8 space-y-8">
        <article>
          <h2 className="text-2xl font-bold text-foreground">Challenge</h2>
          <p className="mt-3 text-muted-foreground">{caseStudy.challenge}</p>
        </article>

        <article className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-xl font-semibold text-foreground">Constraints</h3>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {caseStudy.constraints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-foreground">Architecture</h3>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {caseStudy.architecture.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-foreground">Execution</h3>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {caseStudy.execution.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </article>

        <article>
          <h2 className="text-2xl font-bold text-foreground">Outcomes</h2>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            {caseStudy.outcomes.map((item) => (
              <li key={item}>{item}</li>
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
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit Live Project
        </TrackedAnchor>
        <TrackedAnchor
          action="navigate_to_contact_from_case_study"
          category="case-studies"
          href={`/?source=${caseStudy.slug}#contact`}
          projectSlug={caseStudy.slug}
          projectTitle={project.title}
          projectUrl={project.link}
          className="rounded-lg border border-gray-300/70 px-5 py-2.5 text-sm font-semibold text-foreground dark:border-white/20"
        >
          Discuss a Similar Build
        </TrackedAnchor>
      </footer>
    </main>
  );
}
