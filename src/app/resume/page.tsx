import type { Metadata } from 'next';
import { resumeData } from '@/lib/resumeData';

const SITE_URL = 'https://rachodevs.com';
const canonicalUrl = `${SITE_URL}/resume`;

export const metadata: Metadata = {
  title: 'Resume',
  description:
    'ATS-friendly resume for Kamal Feracho across Front-End/Full-Stack Engineering and Product/Brand Design.',
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: 'Kamal Feracho Resume',
    description:
      'ATS-friendly resume covering engineering and product design experience, skills, and selected case studies.',
    url: canonicalUrl,
    type: 'profile',
  },
};

export default function ResumePage() {
  const visibleSelectedProjects = resumeData.selectedProjects.filter(
    (project) => !project.hidden
  );

  const skillKeywords = Array.from(
    new Set(
      resumeData.tracks.flatMap((track) =>
        track.skills.flatMap((group) => group.items)
      )
    )
  );

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: resumeData.name,
    jobTitle: 'Front-End Engineer and Product Designer',
    email: `mailto:${resumeData.email}`,
    url: SITE_URL,
    sameAs: [resumeData.github, resumeData.linkedin],
    knowsAbout: skillKeywords,
    hasOccupation: resumeData.tracks.map((track) => ({
      '@type': 'Occupation',
      name: track.title,
    })),
    alumniOf: {
      '@type': 'CollegeOrUniversity',
      name: 'Georgia Institute of Technology',
      sameAs: 'https://www.gatech.edu/',
    },
  };

  const trackTheme: Record<
    (typeof resumeData.tracks)[number]['id'],
    {
      badge: string;
      accentText: string;
      accentBorder: string;
      accentGlow: string;
    }
  > = {
    engineering: {
      badge: 'Engineering Track',
      accentText: 'text-[#39FF14]',
      accentBorder: 'border-[#39FF14]/40',
      accentGlow: 'shadow-[0_0_30px_rgba(57,255,20,0.15)]',
    },
    design: {
      badge: 'Product and Brand Track',
      accentText: 'text-[#FFA500]',
      accentBorder: 'border-[#FFA500]/40',
      accentGlow: 'shadow-[0_0_30px_rgba(255,165,0,0.16)]',
    },
  };

  return (
    <main className="relative isolate mx-auto max-w-6xl px-4 pb-24 pt-28 text-sm leading-6 text-slate-900 dark:text-slate-100 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_14%,rgba(57,255,20,0.12),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(148,0,211,0.2),transparent_40%),radial-gradient(circle_at_50%_110%,rgba(255,165,0,0.16),transparent_38%)]"
      />

      <article className="relative overflow-hidden rounded-3xl border border-gray-200/50 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 dark:shadow-[0_40px_110px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--brand-gradient-main)]" />

        <header className="rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-black/20 sm:p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            ATS Resume
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{resumeData.name}</h1>
          <p className="mt-2 text-muted-foreground">{resumeData.location}</p>
          <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm">
            <a
              href={`mailto:${resumeData.email}`}
              className="rounded-full border border-gray-300/70 px-3 py-1 text-foreground transition hover:border-[#9400D3]/70 dark:border-white/20"
            >
              {resumeData.email}
            </a>
            <a
              href="/contact?source=resume"
              className="rounded-full border border-[#39FF14]/45 bg-[#39FF14]/10 px-3 py-1 font-semibold text-[#39FF14] transition hover:border-[#39FF14]/75 hover:bg-[#39FF14]/15"
            >
              Contact Me
            </a>
          </p>
        </header>

        {resumeData.tracks.map((track) => (
          <section
            key={track.id}
            aria-labelledby={`track-${track.id}`}
            className={`mt-8 rounded-2xl border border-gray-200/50 bg-white/70 p-5 dark:border-white/10 dark:bg-black/20 sm:p-6 ${trackTheme[track.id].accentGlow}`}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p
                  className={`text-xs uppercase tracking-[0.3em] ${trackTheme[track.id].accentText}`}
                >
                  {trackTheme[track.id].badge}
                </p>
                <h2 id={`track-${track.id}`} className="mt-1 text-2xl font-black">
                  {track.title}
                </h2>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] text-muted-foreground ${trackTheme[track.id].accentBorder}`}
              >
                Active
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              {track.headline}
            </p>

            <section className="mt-6 rounded-xl border border-gray-200/60 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <h3 className="text-lg font-semibold text-foreground">
                Professional Summary
              </h3>
              <p className="mt-2 text-muted-foreground">{track.summary}</p>
            </section>

            <section className="mt-5">
              <h3 className="text-lg font-semibold">Core Skills</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {track.skills.map((group) => (
                  <li
                    key={`${track.id}-${group.label}`}
                    className="rounded-xl border border-gray-200/60 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="font-semibold text-foreground">
                      {group.label}:
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {group.items.join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-5">
              <h3 className="text-lg font-semibold">Experience</h3>
              <div className="mt-3 space-y-5">
                {track.experience.map((item) => (
                  <article
                    key={`${track.id}-${item.company}-${item.role}`}
                    className="rounded-xl border border-gray-200/60 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <p className="font-semibold text-foreground">
                      {item.role}
                    </p>
                    <p className="text-muted-foreground">
                      {item.company} | {item.period}
                    </p>
                    {item.link ? (
                      <p className="mt-1">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm underline decoration-dotted underline-offset-4 hover:text-foreground"
                        >
                          {item.link}
                        </a>
                      </p>
                    ) : null}
                    <ul className="mt-3 space-y-2 text-muted-foreground">
                      {item.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2">
                          <span className="brand-gradient-dot mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-5">
              <h3 className="text-lg font-semibold">Education</h3>
              <ul className="mt-3 space-y-2">
                {track.education.map((item) => (
                  <li
                    key={`${track.id}-${item.school}-${item.period}`}
                    className="rounded-xl border border-gray-200/60 bg-white/80 p-4 text-muted-foreground dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="font-semibold text-foreground">{item.degree}</span>
                    <br />
                    {item.school} | {item.location} | {item.period}
                  </li>
                ))}
              </ul>
            </section>

            {track.language?.length ? (
              <section className="mt-5">
                <h3 className="text-lg font-semibold">Language</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {track.language.map((item) => (
                    <li
                      key={`${track.id}-${item}`}
                      className="rounded-full border border-gray-300/70 bg-white/80 px-3 py-1 text-muted-foreground dark:border-white/20 dark:bg-white/5"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>
        ))}

        <section className="mt-8 rounded-2xl border border-gray-200/60 bg-white/70 p-5 dark:border-white/10 dark:bg-black/20 sm:p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Portfolio Signals
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Selected Projects and Case Studies
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {visibleSelectedProjects.map((project) => (
              <article
                key={project.title}
                className="rounded-xl border border-gray-200/60 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <p className="font-semibold text-foreground">
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-dotted underline-offset-4"
                  >
                    {project.title}
                  </a>
                </p>
                <p className="mt-1 text-muted-foreground">{project.focus}</p>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  {project.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span className="brand-gradient-dot mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                {project.caseStudySlug ? (
                  <p className="mt-2">
                    <a
                      href={`/case-studies/${project.caseStudySlug}`}
                      className="text-sm underline decoration-dotted underline-offset-4"
                    >
                      Case study: /case-studies/{project.caseStudySlug}
                    </a>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
