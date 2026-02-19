import type { Metadata } from 'next';
import { resumeData } from '@/lib/resumeData';

const canonicalUrl = 'https://www.rachocreates.com/resume';

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
    telephone: resumeData.phone,
    email: `mailto:${resumeData.email}`,
    url: resumeData.website,
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

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-24 text-sm leading-6 text-slate-900 dark:text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <article className="rounded-lg border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-950 sm:p-8">
        <header className="border-b border-slate-300 pb-6 dark:border-slate-700">
          <h1 className="text-3xl font-bold">{resumeData.name}</h1>
          <p className="mt-2">{resumeData.location}</p>
          <p className="mt-1">
            <a href={`tel:${resumeData.phone.replace(/[^\d+]/g, '')}`} className="underline">
              {resumeData.phone}
            </a>{' '}
            |{' '}
            <a href={`mailto:${resumeData.email}`} className="underline">
              {resumeData.email}
            </a>{' '}
            |{' '}
            <a href={resumeData.website} className="underline">
              {resumeData.website}
            </a>{' '}
            |{' '}
            <a href={resumeData.github} className="underline">
              GitHub
            </a>{' '}
            |{' '}
            <a href={resumeData.linkedin} className="underline">
              LinkedIn
            </a>{' '}
            |{' '}
            <a href="/Resume.pdf" className="underline">
              PDF version
            </a>
          </p>
        </header>

        {resumeData.tracks.map((track) => (
          <section
            key={track.id}
            aria-labelledby={`track-${track.id}`}
            className="mt-8 border-b border-slate-300 pb-8 last:border-b-0 dark:border-slate-700"
          >
            <h2 id={`track-${track.id}`} className="text-2xl font-bold">
              {track.title}
            </h2>
            <p className="mt-1 font-semibold">{track.headline}</p>

            <section className="mt-5">
              <h3 className="text-lg font-semibold">Professional Summary</h3>
              <p className="mt-2">{track.summary}</p>
            </section>

            <section className="mt-5">
              <h3 className="text-lg font-semibold">Core Skills</h3>
              <ul className="mt-2 list-disc pl-5">
                {track.skills.map((group) => (
                  <li key={`${track.id}-${group.label}`}>
                    <span className="font-semibold">{group.label}:</span>{' '}
                    {group.items.join(', ')}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-5">
              <h3 className="text-lg font-semibold">Experience</h3>
              <div className="mt-3 space-y-5">
                {track.experience.map((item) => (
                  <article key={`${track.id}-${item.company}-${item.role}`}>
                    <p className="font-semibold">
                      {item.role} | {item.company} | {item.period}
                    </p>
                    {item.link ? (
                      <p>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {item.link}
                        </a>
                      </p>
                    ) : null}
                    <ul className="mt-2 list-disc pl-5">
                      {item.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-5">
              <h3 className="text-lg font-semibold">Education</h3>
              <ul className="mt-2 list-disc pl-5">
                {track.education.map((item) => (
                  <li key={`${track.id}-${item.school}-${item.period}`}>
                    {item.degree} | {item.school} | {item.location} |{' '}
                    {item.period}
                  </li>
                ))}
              </ul>
            </section>

            {track.language?.length ? (
              <section className="mt-5">
                <h3 className="text-lg font-semibold">Language</h3>
                <ul className="mt-2 list-disc pl-5">
                  {track.language.map((item) => (
                    <li key={`${track.id}-${item}`}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>
        ))}

        <section className="mt-8">
          <h2 className="text-2xl font-bold">Selected Projects and Case Studies</h2>
          <div className="mt-3 space-y-5">
            {visibleSelectedProjects.map((project) => (
              <article key={project.title}>
                <p className="font-semibold">
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {project.title}
                  </a>
                </p>
                <p>{project.focus}</p>
                <ul className="mt-2 list-disc pl-5">
                  {project.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                {project.caseStudySlug ? (
                  <p className="mt-2">
                    <a
                      href={`/case-studies/${project.caseStudySlug}`}
                      className="underline"
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
