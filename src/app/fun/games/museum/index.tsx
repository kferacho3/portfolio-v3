'use client';

import { Float, Html, Stars } from '@react-three/drei';
import React from 'react';
import { featuredWebsites } from '@/components/SectionThreeData';

const ProjectMuseum: React.FC = () => {
  const projects = featuredWebsites.slice(0, 6);

  return (
    <>
      <Stars radius={120} depth={60} count={1200} factor={4} saturation={0} fade />
      <Float speed={1} rotationIntensity={0.2} floatIntensity={0.4}>
        <mesh position={[0, 1.5, -6]}>
          <torusKnotGeometry args={[1.2, 0.35, 120, 18]} />
          <meshStandardMaterial color="#7dd3fc" metalness={0.6} roughness={0.2} />
        </mesh>
      </Float>
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center">
          <div className="w-[min(960px,92vw)] rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-white shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Project Museum
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Featured Builds & Systems
                </h2>
                <p className="mt-2 text-sm text-white/70">
                  A quick tour of recent work, focused on frontend systems, UI engineering, and complex integrations.
                </p>
              </div>
              <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                Curated
              </span>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/30"
                >
                  <div className="text-sm font-semibold text-white">{project.title}</div>
                  <p className="mt-2 text-xs leading-relaxed text-white/70">
                    {project.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.techStack.slice(0, 4).map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/60"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Html>
    </>
  );
};

export default ProjectMuseum;
