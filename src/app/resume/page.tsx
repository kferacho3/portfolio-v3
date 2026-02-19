import type { Metadata } from 'next';
import { resumeData } from '@/lib/resumeData';

const canonicalUrl = 'https://www.rachocreates.com/resume';

export const metadata: Metadata = {
  title: 'Resume',
  description:
    'ATS-friendly resume for Kamal Feracho, full-stack engineer specializing in product UI systems, API integrations, and interactive 3D experiences.',
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: 'Kamal Feracho Resume',
    description:
      'ATS-friendly resume covering engineering experience, skills, and selected projects.',
    url: canonicalUrl,
    type: 'profile',
  },
};

export default function ResumePage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: resumeData.name,
    jobTitle: 'Full-Stack Engineer',
    email: resumeData.email,
    url: resumeData.website,
    sameAs: [resumeData.github, resumeData.linkedin],
    knowsAbout: resumeData.skills.flatMap((group) => group.items),
  };

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-20 text-slate-900 dark:text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <article className="rounded-lg border border-slate-300 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-950">
        <header className="border-b border-slate-300 pb-5 dark:border-slate-700">
          <h1 className="text-3xl font-bold">{resumeData.name}</h1>
          <p className="mt-1 text-sm">{resumeData.headline}</p>
          <p className="mt-1 text-sm">{resumeData.location}</p>
          <p className="mt-3 text-sm">
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

        <section className="mt-6">
          <h2 className="text-xl font-semibold">Summary</h2>
          <p className="mt-2 text-sm leading-6">{resumeData.summary}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-semibold">Core Skills</h2>
          <div className="mt-3 space-y-2">
            {resumeData.skills.map((group) => (
              <p key={group.label} className="text-sm">
                <span className="font-semibold">{group.label}:</span>{' '}
                {group.items.join(', ')}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-semibold">Professional Experience</h2>
          <div className="mt-3 space-y-5">
            {resumeData.experience.map((item) => (
              <div key={`${item.company}-${item.role}`}>
                <p className="text-sm font-semibold">
                  {item.role} | {item.company} | {item.period}
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm leading-6">
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-semibold">Selected Projects</h2>
          <div className="mt-3 space-y-5">
            {resumeData.selectedProjects.map((project) => (
              <div key={project.title}>
                <p className="text-sm font-semibold">
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {project.title}
                  </a>
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm leading-6">
                  {project.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
