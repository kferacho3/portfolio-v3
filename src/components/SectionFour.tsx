/* src/components/SectionFour.tsx */
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  EMAILJS_PUBLIC_KEY,
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
} from '@/lib/emailjsConfig';
import {
  clearFunnelAttribution,
  getFunnelAttribution,
  rememberFunnelAttribution,
  trackEvent,
  type FunnelAttribution,
} from '@/lib/analytics';
import emailjs from 'emailjs-com';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type MotionProps,
} from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { getProjectByCaseStudySlug } from './SectionThreeData';

/* ─────────────────────────────── static content ─────────────────────────── */
const CAPABILITIES = [
  {
    title: 'Immersive 3D / WebGL',
    desc: 'React Three Fiber, GLSL shaders, real-time scenes.',
  },
  {
    title: 'Product UI Systems',
    desc: 'Design systems, component libraries, tokens.',
  },
  {
    title: 'Full-Stack Platforms',
    desc: 'Next.js apps, APIs, auth, and dashboards.',
  },
  {
    title: 'Headless E-commerce',
    desc: 'Storefronts, checkout, and CMS integration.',
  },
  {
    title: 'Creative Technology',
    desc: 'Generative, audio-reactive, experimental builds.',
  },
  {
    title: 'Brand & Client Sites',
    desc: 'Launch-ready marketing and portfolio sites.',
  },
] as const;

const SERVICE_OPTIONS = [
  'Immersive 3D / WebGL',
  'Product UI Systems',
  'Full-Stack Platforms',
  'Headless E-commerce',
  'Creative Technology',
  'Brand & Client Sites',
] as const;

const WEBSITE_OPTIONS = [
  'Personal',
  'NFT',
  'Landing Page',
  'E-commerce',
  'Other (Specify)',
  'None',
] as const;

const TRUST_STATS = [
  { value: '20+', label: 'Projects shipped' },
  { value: '24h', label: 'Response time' },
  { value: '100%', label: 'Client satisfaction' },
] as const;

type AltChannel = {
  label: string;
  href: string;
  channel: 'email' | 'github' | 'linkedin';
  external: boolean;
};

const ALT_CHANNELS: AltChannel[] = [
  {
    label: 'Email',
    href: 'mailto:kferacho64@gmail.com',
    channel: 'email',
    external: false,
  },
  {
    label: 'GitHub',
    href: 'https://github.com/kferacho3',
    channel: 'github',
    external: true,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/kamal-feracho-075a5a1aa/',
    channel: 'linkedin',
    external: true,
  },
];

function SectionFour() {
  const form = useRef<HTMLFormElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    service: '',
    website: '',
    message: '',
    _honeypot: '',
  });

  const [sending, setSending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [funnelAttribution, setFunnelAttribution] =
    useState<FunnelAttribution | null>(null);

  /* ────────────────────────────── motion helper ─────────────────────────── */
  const reveal = (delay = 0): MotionProps =>
    prefersReducedMotion
      ? {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true },
          transition: { duration: 0.3 },
        }
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true },
          transition: { duration: 0.6, delay, ease: 'easeOut' },
        };

  /* ────────────────────────────────── helpers ───────────────────────────── */
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setTouched((p) => ({ ...p, [name]: true }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((p) => ({ ...p, [name]: value }));
    setTouched((p) => ({ ...p, [name]: true }));
  };

  const validateForm = () => {
    const errs: { [k: string]: string } = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      errs.email = 'Please enter a valid email';
    if (!formData.service) errs.service = 'Please select a service';
    if (!formData.website) errs.website = 'Please select a website type';
    if (!formData.message.trim()) errs.message = 'Message is required';
    if (formData._honeypot.trim()) errs.form = 'Bot submission blocked';
    if (lastSentAt && Date.now() - lastSentAt < 30_000)
      errs.form = 'Please wait before sending another message';
    return errs;
  };

  const isValid = (f: keyof typeof formData) =>
    touched[f] &&
    !errors[f] &&
    ((f === 'name' && formData.name.trim().length > 0) ||
      (f === 'email' && /\S+@\S+\.\S+/.test(formData.email)) ||
      (f === 'service' && formData.service) ||
      (f === 'website' && formData.website) ||
      (f === 'message' && formData.message.trim().length > 0));

  /* ───────────────────────────────── send mail ──────────────────────────── */
  const sendEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const attribution = getFunnelAttribution();
    trackEvent('contact_form_submit_attempt', {
      service: formData.service || 'unspecified',
      website: formData.website || 'unspecified',
      source_project: attribution?.projectTitle ?? 'none',
      source_action: attribution?.action ?? 'none',
      source_category: attribution?.category ?? 'none',
    });

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      trackEvent('contact_form_submit_blocked', {
        error_keys: Object.keys(validationErrors).join(','),
      });
      return;
    }
    setErrors({});
    setSending(true);

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name: formData.name,
          to_name: 'RachoDevs',
          email: formData.email,
          service: formData.service,
          website: formData.website,
          message: formData.message,
          source_project: attribution?.projectTitle ?? '',
          source_action: attribution?.action ?? '',
          source_category: attribution?.category ?? '',
          source_project_slug: attribution?.projectSlug ?? '',
        },
        EMAILJS_PUBLIC_KEY
      );

      setModalType('success');
      setModalMessage(
        "Thank you! Your message has been sent successfully. I'll get back to you within 24 hours."
      );
      setModalOpen(true);
      setLastSentAt(Date.now());
      setFormData({
        name: '',
        email: '',
        service: '',
        website: '',
        message: '',
        _honeypot: '',
      });
      setTouched({});
      trackEvent('contact_form_submit_success', {
        service: formData.service,
        website: formData.website,
        source_project: attribution?.projectTitle ?? 'none',
        source_action: attribution?.action ?? 'none',
        source_category: attribution?.category ?? 'none',
      });
      clearFunnelAttribution();
      setFunnelAttribution(null);
    } catch (err) {
      console.error(err);
      setModalType('error');
      setModalMessage(
        'Oops! Something went wrong. Please try again or email me directly.'
      );
      setModalOpen(true);
      trackEvent('contact_form_submit_error', {
        service: formData.service || 'unspecified',
        website: formData.website || 'unspecified',
        source_project: attribution?.projectTitle ?? 'none',
      });
    } finally {
      setSending(false);
    }
  };

  /* ESC closes modal */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && setModalOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get('source');
    if (!source) return;

    const project = getProjectByCaseStudySlug(source);
    if (!project) return;

    rememberFunnelAttribution({
      action: 'arrive_from_case_study',
      category: 'case-studies',
      projectSlug: source,
      projectTitle: project.title,
      projectUrl: project.link,
    });
  }, []);

  /* Project-aware copy — SSR-guarded, reads stored funnel attribution */
  useEffect(() => {
    setFunnelAttribution(getFunnelAttribution());
  }, []);

  /* ───────────────────────── shared field className builder ──────────────── */
  const fieldBorder = (f: keyof typeof formData) =>
    isValid(f)
      ? 'border-[#39FF14]/60'
      : errors[f] && touched[f]
        ? 'border-rose-500/70'
        : 'border-white/10';

  const fieldBase = `
    w-full min-h-[44px] rounded-xl border px-4 py-3
    bg-[#07060d]/60 text-foreground
    placeholder:text-muted-foreground/50
    transition-all duration-200
    focus:ring-4 focus:ring-[var(--brand-neon-purple)]/25 focus:border-[var(--brand-neon-purple)]/60
    focus-visible:outline-none
  `;

  /* ────────────────────────────────── render ────────────────────────────── */
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="relative min-h-screen overflow-hidden py-16 px-4 sm:py-20 sm:px-6 lg:px-8"
    >
      {/* Ambient conversion-chamber glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-24 left-[12%] h-72 w-72 rounded-full opacity-[0.18] blur-[130px]"
          style={{ background: 'var(--brand-neon-purple)' }}
        />
        <div
          className="absolute top-1/3 right-[8%] h-80 w-80 rounded-full opacity-[0.14] blur-[140px]"
          style={{ background: 'var(--brand-neon-green)' }}
        />
        <div
          className="absolute bottom-[6%] left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-[0.12] blur-[130px]"
          style={{ background: 'var(--brand-neon-orange)' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Heading */}
        <motion.div {...reveal()} className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            <span className="brand-gradient-dot h-1.5 w-1.5 rounded-full" />
            Start a project
          </p>
          <h2
            id="contact-title"
            className="mt-4 text-3xl font-bold leading-[1.08] sm:text-4xl lg:text-5xl"
          >
            Have a product, brand, or immersive idea that needs to{' '}
            <span className="brand-gradient-text">feel real?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Tell me what you&apos;re building, where you need engineering
            firepower, and the timeline. I reply with clear next steps and a
            scope you can act on.
          </p>
        </motion.div>

        {/* Cinematic two-column conversion chamber */}
        <div className="mt-14 grid grid-cols-1 gap-8 lg:mt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          {/* LEFT — pitch + capabilities + trust */}
          <motion.div {...reveal(0.05)} className="flex flex-col gap-6">
            {/* Project-aware banner */}
            {funnelAttribution && (
              <motion.div
                {...reveal()}
                className="flex items-start gap-3 rounded-2xl border border-[var(--brand-neon-green)]/25 bg-[var(--brand-neon-green)]/[0.06] p-4 backdrop-blur-xl"
              >
                <span className="brand-gradient-dot mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
                <p className="text-sm text-foreground/90">
                  Picking up from{' '}
                  <span className="font-semibold text-foreground">
                    {funnelAttribution.projectTitle}
                  </span>{' '}
                  — tell me what you&apos;re building.
                </p>
              </motion.div>
            )}

            {/* What I can help with */}
            <div className="hover-gradient-border rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-7">
              <div className="mb-5 flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">
                  What I can help with
                </h3>
                <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Capabilities
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CAPABILITIES.map((cap) => (
                  <li
                    key={cap.title}
                    className="group rounded-xl border border-white/10 bg-[#0a0912]/60 p-4 transition-colors duration-200 hover:border-white/20"
                  >
                    <div className="flex items-center gap-2">
                      <span className="brand-gradient-dot h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                      <span className="text-sm font-semibold text-foreground">
                        {cap.title}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {cap.desc}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trust signals */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-7">
              <div className="grid grid-cols-3 gap-3">
                {TRUST_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/10 bg-[#0a0912]/60 p-3 text-center"
                  >
                    <div className="text-xl font-bold text-foreground sm:text-2xl">
                      {stat.value}
                    </div>
                    <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-sm text-muted-foreground">
                Prefer to reach out directly? Email me at{' '}
                <a
                  href="mailto:kferacho64@gmail.com"
                  onClick={() =>
                    trackEvent('contact_alt_channel_click', {
                      channel: 'email',
                    })
                  }
                  className="font-semibold text-foreground underline decoration-[var(--brand-neon-green)]/50 underline-offset-4 transition hover:decoration-[var(--brand-neon-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-neon-green)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07060d]"
                >
                  kferacho64@gmail.com
                </a>
                .
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {ALT_CHANNELS.map((item) => (
                  <a
                    key={item.channel}
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    onClick={() =>
                      trackEvent('contact_alt_channel_click', {
                        channel: item.channel,
                      })
                    }
                    className="inline-flex min-h-[44px] items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:border-white/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-neon-green)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07060d]"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </motion.div>

          {/* RIGHT — the form console */}
          <motion.div {...reveal(0.1)} className="relative">
            <div className="hover-gradient-border rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Project Brief
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-foreground">
                  Tell me what you&apos;re building
                </h3>
              </div>

              <form
                ref={form}
                className="space-y-5"
                onSubmit={sendEmail}
                noValidate
              >
                {/* honeypot */}
                <input
                  type="text"
                  name="_honeypot"
                  value={formData._honeypot}
                  onChange={handleInputChange}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                {/* Name */}
                <div className="group">
                  <Label
                    htmlFor="name"
                    className="mb-2 block text-sm font-medium text-muted-foreground"
                  >
                    Your name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Jane Doe"
                    aria-invalid={
                      errors.name && touched.name ? true : undefined
                    }
                    aria-describedby={
                      errors.name && touched.name ? 'name-error' : undefined
                    }
                    className={`${fieldBase} ${fieldBorder('name')}`}
                    required
                  />
                  {errors.name && touched.name && (
                    <p id="name-error" className="mt-2 text-sm text-rose-400">
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="group">
                  <Label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-muted-foreground"
                  >
                    Email address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="jane@studio.com"
                    aria-invalid={
                      errors.email && touched.email ? true : undefined
                    }
                    aria-describedby={
                      errors.email && touched.email ? 'email-error' : undefined
                    }
                    className={`${fieldBase} ${fieldBorder('email')}`}
                    required
                  />
                  {errors.email && touched.email && (
                    <p id="email-error" className="mt-2 text-sm text-rose-400">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Service */}
                <div className="group">
                  <Label
                    htmlFor="service"
                    className="mb-2 block text-sm font-medium text-muted-foreground"
                  >
                    What do you need?
                  </Label>
                  <Select
                    onValueChange={(v) => handleSelectChange('service', v)}
                    value={formData.service}
                  >
                    <SelectTrigger
                      id="service"
                      aria-invalid={
                        errors.service && touched.service ? true : undefined
                      }
                      aria-describedby={
                        errors.service && touched.service
                          ? 'service-error'
                          : undefined
                      }
                      className={`${fieldBase} ${fieldBorder('service')}`}
                    >
                      <SelectValue placeholder="Choose a focus area" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0a0912] text-foreground">
                      {SERVICE_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt}
                          value={opt}
                          className="px-4 py-3 text-foreground hover:bg-white/5 focus:bg-white/5"
                        >
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.service && touched.service && (
                    <p id="service-error" className="mt-2 text-sm text-rose-400">
                      {errors.service}
                    </p>
                  )}
                </div>

                {/* Website type */}
                <div className="group">
                  <Label
                    htmlFor="website"
                    className="mb-2 block text-sm font-medium text-muted-foreground"
                  >
                    Website type
                  </Label>
                  <Select
                    onValueChange={(v) => handleSelectChange('website', v)}
                    value={formData.website}
                  >
                    <SelectTrigger
                      id="website"
                      aria-invalid={
                        errors.website && touched.website ? true : undefined
                      }
                      aria-describedby={
                        errors.website && touched.website
                          ? 'website-error'
                          : undefined
                      }
                      className={`${fieldBase} ${fieldBorder('website')}`}
                    >
                      <SelectValue placeholder="Select website type" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0a0912] text-foreground">
                      {WEBSITE_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt}
                          value={opt}
                          className="px-4 py-3 text-foreground hover:bg-white/5 focus:bg-white/5"
                        >
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.website && touched.website && (
                    <p id="website-error" className="mt-2 text-sm text-rose-400">
                      {errors.website}
                    </p>
                  )}
                </div>

                {/* Message */}
                <div className="group">
                  <Label
                    htmlFor="message"
                    className="mb-2 block text-sm font-medium text-muted-foreground"
                  >
                    Project details
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    rows={5}
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Goals, scope, timeline, links to references..."
                    aria-invalid={
                      errors.message && touched.message ? true : undefined
                    }
                    aria-describedby={
                      errors.message && touched.message
                        ? 'message-error'
                        : undefined
                    }
                    className={`${fieldBase} resize-none ${fieldBorder('message')}`}
                    required
                  />
                  {errors.message && touched.message && (
                    <p id="message-error" className="mt-2 text-sm text-rose-400">
                      {errors.message}
                    </p>
                  )}
                </div>

                {errors.form && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4"
                  >
                    <p className="text-sm text-rose-300">{errors.form}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className={`
                    brand-gradient-button flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold
                    transition-all duration-200
                    focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-neon-green)]/40
                    disabled:cursor-not-allowed disabled:opacity-50
                    ${!sending && !prefersReducedMotion ? 'hover:scale-[1.02] active:scale-[0.98]' : ''}
                  `}
                >
                  {sending ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                      Sending
                    </>
                  ) : (
                    <>Send Project Brief</>
                  )}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  Goes straight to my inbox. No spam — expect a reply within 24
                  hours.
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Success/Error Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="contact-modal-title"
              aria-describedby="contact-modal-desc"
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { scale: 0.9, opacity: 0, y: 20 }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { scale: 1, opacity: 1, y: 0 }
              }
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { scale: 0.9, opacity: 0, y: 20 }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0.2 }
                  : { type: 'spring', stiffness: 300, damping: 25 }
              }
              className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0912]/95 p-8 shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div
                  className={`mx-auto mb-4 inline-flex items-center rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                    modalType === 'success'
                      ? 'border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]'
                      : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {modalType === 'success' ? 'Success' : 'Error'}
                </div>
                <h3
                  id="contact-modal-title"
                  className="mb-2 text-2xl font-bold text-foreground"
                >
                  {modalType === 'success'
                    ? 'Message Sent'
                    : 'Something went wrong'}
                </h3>
                <p
                  id="contact-modal-desc"
                  className="mb-6 text-muted-foreground"
                >
                  {modalMessage}
                </p>
                <button
                  autoFocus
                  onClick={() => setModalOpen(false)}
                  className="brand-gradient-button min-h-[44px] rounded-xl px-6 py-3 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-neon-green)]/40"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default SectionFour;
