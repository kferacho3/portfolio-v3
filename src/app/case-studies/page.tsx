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
  const totalStudies = caseStudyProjects.length;

  return (
    <main className="relative isolate mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-28 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(57,255,20,0.16),transparent_30%),radial-gradient(circle_at_88%_24%,rgba(148,0,211,0.22),transparent_36%),radial-gradient(circle_at_52%_110%,rgba(255,165,0,0.18),transparent_40%)]"
      />

      <header className="relative overflow-hidden rounded-3xl border border-gray-200/50 bg-white/75 p-7 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 dark:shadow-[0_38px_100px_rgba(0,0,0,0.45)] sm:p-10">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--brand-gradient-main)]" />
        <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
          Portfolio
        </p>
        <h1 className="mt-3 text-4xl font-black text-foreground sm:text-5xl md:text-6xl">
          <span className="brand-gradient-text">Technical Case Studies</span>
        </h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          Architecture-first breakdowns with real constraints, implementation
          choices, and measurable outcomes.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full border border-[#39FF14]/45 bg-[#39FF14]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#39FF14]">
            {totalStudies} Published
          </span>
          <span className="rounded-full border border-[#9400D3]/45 bg-[#9400D3]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#d6a4ff]">
            Systems Thinking
          </span>
          <span className="rounded-full border border-[#FFA500]/45 bg-[#FFA500]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#ffd499]">
            Build Narratives
          </span>
        </div>
      </header>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {caseStudyProjects.map((project) => {
          const caseStudy = project.caseStudy;
          if (!caseStudy) return null;

          return (
            <article
              key={caseStudy.slug}
              className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/75 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_65px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-slate-950/70 dark:shadow-[0_24px_60px_rgba(0,0,0,0.38)] dark:hover:shadow-[0_34px_90px_rgba(0,0,0,0.52)]"
            >
              <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--brand-gradient-main)] opacity-70" />
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
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
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
                  className="rounded-lg border border-gray-300/70 bg-white/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-[#9400D3]/60 hover:bg-[#9400D3]/5 dark:border-white/20 dark:bg-white/5 dark:hover:border-[#9400D3]/80 dark:hover:bg-[#9400D3]/10"
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
