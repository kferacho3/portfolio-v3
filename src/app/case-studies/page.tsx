import type { Metadata } from 'next';
import TrackedAnchor from '@/components/TrackedAnchor';
import { caseStudyProjects } from '@/components/SectionThreeData';

export const metadata: Metadata = {
  title: 'Case Studies',
  description:
    'Technical case studies from Kamal Feracho covering architecture, constraints, implementation decisions, and outcomes.',
  alternates: {
    canonical: 'https://www.rachocreates.com/case-studies',
  },
};

export default function CaseStudiesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-20 pt-28 sm:px-6">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Portfolio
        </p>
        <h1 className="mt-3 text-4xl font-black text-foreground sm:text-5xl">
          Technical Case Studies
        </h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          Architecture-first breakdowns of selected projects with constraints,
          implementation details, and outcomes.
        </p>
      </header>

      <section className="grid gap-5 sm:grid-cols-2">
        {caseStudyProjects.map((project) => {
          const caseStudy = project.caseStudy;
          if (!caseStudy) return null;

          return (
            <article
              key={caseStudy.slug}
              className="rounded-2xl border border-gray-200/60 bg-white/70 p-6 shadow-sm dark:border-white/10 dark:bg-card/50"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Case Study
              </p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">
                {project.title}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {caseStudy.oneLiner}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {project.techStack.slice(0, 4).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-gray-200/70 px-3 py-1 text-xs text-muted-foreground dark:border-white/10"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <TrackedAnchor
                  action="open_case_study_listing_card"
                  category="case-studies"
                  href={`/case-studies/${caseStudy.slug}`}
                  projectSlug={caseStudy.slug}
                  projectTitle={project.title}
                  projectUrl={project.link}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
                >
                  Read Case Study
                </TrackedAnchor>
                <TrackedAnchor
                  action="visit_live_project_listing"
                  category="case-studies"
                  href={project.link}
                  projectSlug={caseStudy.slug}
                  projectTitle={project.title}
                  projectUrl={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-gray-300/70 px-4 py-2 text-sm font-semibold text-foreground dark:border-white/20"
                >
                  Live Project
                </TrackedAnchor>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
