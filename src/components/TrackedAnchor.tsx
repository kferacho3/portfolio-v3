'use client';

import { ReactNode } from 'react';
import { trackProjectInteraction } from '@/lib/analytics';

type TrackedAnchorProps = {
  action: string;
  category?: string;
  className?: string;
  href: string;
  projectSlug?: string;
  projectTitle: string;
  projectUrl?: string;
  children: ReactNode;
  target?: '_blank' | '_self';
  rel?: string;
};

export default function TrackedAnchor({
  action,
  category,
  className,
  href,
  projectSlug,
  projectTitle,
  projectUrl,
  children,
  target,
  rel,
}: TrackedAnchorProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={className}
      onClick={() =>
        trackProjectInteraction({
          action,
          category,
          projectSlug,
          projectTitle,
          projectUrl,
        })
      }
    >
      {children}
    </a>
  );
}
