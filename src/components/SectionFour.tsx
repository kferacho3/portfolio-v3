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
import emailjs from 'emailjs-com';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

// Environment variables
const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'RachoDevs';
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'RachoDevs';
const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'asi1IXWXVQKV4AGlS';

function SectionFour() {
  const form = useRef<HTMLFormElement>(null);

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

  /* ────────────────────────────────── helpers ───────────────────────────────── */
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

  /* ───────────────────────────────── send mail ─────────────────────────────── */
  const sendEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSending(true);

    try {
      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          from_name: formData.name,
          to_name: 'RachoDevs',
          email: formData.email,
          service: formData.service,
          website: formData.website,
          message: formData.message,
        },
        PUBLIC_KEY
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
    } catch (err) {
      console.error(err);
      setModalType('error');
      setModalMessage(
        'Oops! Something went wrong. Please try again or email me directly.'
      );
      setModalOpen(true);
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

  /* ────────────────────────────── render ───────────────────────────────────── */
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="relative min-h-screen py-12 px-4 sm:py-16 sm:px-6 lg:px-8"
    >
      <div className="relative max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Contact
          </p>
          <h2
            id="contact-title"
            className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-bold"
          >
            <span className="brand-gradient-text">
              Let&apos;s Build Together
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Tell me about your product goals, timelines, and where you need
            engineering support. I&apos;ll respond with next steps and a clear
            scope.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            <div className="hover-gradient-border rounded-2xl border border-gray-200/40 dark:border-white/10 bg-white/50 dark:bg-card/50 p-6 sm:p-8 lg:p-10 shadow-[0_16px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Project Intake
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-foreground">
                  Get in Touch
                </h3>
              </div>

              <form
                ref={form}
                className="space-y-6"
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
                />

                {/* Name */}
                <div className="group">
                  <Label
                    htmlFor="name"
                    className="text-sm font-medium text-muted-foreground mb-2"
                  >
                    Your Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className={`
                      w-full px-4 py-3 rounded-lg border
                      bg-gray-100/60 dark:bg-slate-950/50
                      text-foreground
                      placeholder:text-muted-foreground/60
                      focus:ring-4 focus:ring-primary/20
                      focus:border-primary
                      transition-all duration-200
                      ${
                        isValid('name')
                          ? 'border-[#39FF14]/60'
                          : errors.name && touched.name
                            ? 'border-rose-500/70'
                            : 'border-gray-200/50 dark:border-white/10'
                      }
                    `}
                    required
                  />
                  {errors.name && touched.name && (
                    <p className="text-rose-400 text-sm mt-2">{errors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div className="group">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-muted-foreground mb-2"
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="john@example.com"
                    className={`
                      w-full px-4 py-3 rounded-lg border
                      bg-gray-100/60 dark:bg-slate-950/50
                      text-foreground
                      placeholder:text-muted-foreground/60
                      focus:ring-4 focus:ring-primary/20
                      focus:border-primary
                      transition-all duration-200
                      ${
                        isValid('email')
                          ? 'border-[#39FF14]/60'
                          : errors.email && touched.email
                            ? 'border-rose-500/70'
                            : 'border-gray-200/50 dark:border-white/10'
                      }
                    `}
                    required
                  />
                  {errors.email && touched.email && (
                    <p className="text-rose-400 text-sm mt-2">{errors.email}</p>
                  )}
                </div>

                {/* Service */}
                <div className="group">
                  <Label
                    htmlFor="service"
                    className="text-sm font-medium text-muted-foreground mb-2"
                  >
                    Service Needed
                  </Label>
                  <Select
                    onValueChange={(v) => handleSelectChange('service', v)}
                    value={formData.service}
                  >
                    <SelectTrigger
                      className={`
                        w-full px-4 py-3 rounded-lg border
                        bg-gray-100/60 dark:bg-slate-950/50
                        text-foreground
                        focus:ring-4 focus:ring-primary/20
                        focus:border-primary
                        transition-all duration-200
                        ${
                          isValid('service')
                            ? 'border-[#39FF14]/60'
                            : errors.service && touched.service
                              ? 'border-rose-500/70'
                              : 'border-gray-200/50 dark:border-white/10'
                        }
                      `}
                    >
                      <SelectValue placeholder="Choose a service" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-white/10 text-foreground">
                      {[
                        'Website Development',
                        'Website/Application Design',
                        'E-commerce Website',
                        '3D Model',
                        'SVG Graphics',
                        'Audio Engineering',
                        'AV Synchronization',
                      ].map((opt) => (
                        <SelectItem
                          key={opt}
                          value={opt}
                          className="py-3 px-4 text-foreground hover:bg-white/5 focus:bg-white/5"
                        >
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.service && touched.service && (
                    <p className="text-rose-400 text-sm mt-2">
                      {errors.service}
                    </p>
                  )}
                </div>

                {/* Website type */}
                <div className="group">
                  <Label
                    htmlFor="website"
                    className="text-sm font-medium text-muted-foreground mb-2"
                  >
                    Website Type
                  </Label>
                  <Select
                    onValueChange={(v) => handleSelectChange('website', v)}
                    value={formData.website}
                  >
                    <SelectTrigger
                      className={`
                        w-full px-4 py-3 rounded-lg border
                        bg-gray-100/60 dark:bg-slate-950/50
                        text-foreground
                        focus:ring-4 focus:ring-primary/20
                        focus:border-primary
                        transition-all duration-200
                        ${
                          isValid('website')
                            ? 'border-[#39FF14]/60'
                            : errors.website && touched.website
                              ? 'border-rose-500/70'
                              : 'border-gray-200/50 dark:border-white/10'
                        }
                      `}
                    >
                      <SelectValue placeholder="Select website type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-white/10 text-foreground">
                      {[
                        'Personal',
                        'NFT',
                        'Landing Page',
                        'E-commerce',
                        'Other (Specify)',
                        'None',
                      ].map((opt) => (
                        <SelectItem
                          key={opt}
                          value={opt}
                          className="py-3 px-4 text-foreground hover:bg-white/5 focus:bg-white/5"
                        >
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.website && touched.website && (
                    <p className="text-rose-400 text-sm mt-2">
                      {errors.website}
                    </p>
                  )}
                </div>

                {/* Message */}
                <div className="group">
                  <Label
                    htmlFor="message"
                    className="text-sm font-medium text-muted-foreground mb-2"
                  >
                    Your Message
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    rows={5}
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Tell me about your project..."
                    className={`
                      w-full px-4 py-3 rounded-lg border resize-none
                      bg-gray-100/60 dark:bg-slate-950/50
                      text-foreground
                      placeholder:text-muted-foreground/60
                      focus:ring-4 focus:ring-primary/20
                      focus:border-primary
                      transition-all duration-200
                      ${
                        isValid('message')
                          ? 'border-[#39FF14]/60'
                          : errors.message && touched.message
                            ? 'border-rose-500/70'
                            : 'border-gray-200/50 dark:border-white/10'
                      }
                    `}
                    required
                  />
                  {errors.message && touched.message && (
                    <p className="text-rose-400 text-sm mt-2">
                      {errors.message}
                    </p>
                  )}
                </div>

                {errors.form && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4">
                    <p className="text-rose-300 text-sm">{errors.form}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className={`
                    brand-gradient-button w-full px-6 py-3 rounded-lg font-medium
                    focus:ring-4 focus:ring-primary/30
                    transform transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${!sending && 'hover:scale-[1.02] active:scale-[0.98]'}
                    flex items-center justify-center gap-2
                  `}
                >
                  {sending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                      Sending
                    </>
                  ) : (
                    <>Send Message</>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Right Column - Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:pl-8"
          >
            <div className="hover-gradient-border rounded-2xl border border-gray-200/40 dark:border-white/10 bg-white/50 dark:bg-card/50 p-8 backdrop-blur-xl">
              <h3 className="text-2xl font-bold text-foreground mb-6">
                Let&apos;s Build Something Distinct
              </h3>

              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">
                    What I Deliver
                  </h4>
                  <ul className="space-y-2 text-muted-foreground">
                    {[
                      'Product-ready UI systems tailored to the brief.',
                      'Responsive experiences that stay sharp across devices.',
                      'Clear build phases with fast iteration and QA polish.',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="brand-gradient-dot mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">
                    Response Time
                  </h4>
                  <p className="text-muted-foreground">
                    I typically respond within 24 hours. Share deadlines and
                    priority context to help me triage quickly.
                  </p>
                </div>

                <div className="pt-6 border-t border-gray-200/40 dark:border-white/10">
                  <p className="text-sm text-muted-foreground mb-4">
                    Prefer to connect elsewhere?
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      {
                        label: 'GitHub',
                        href: 'https://github.com/kferacho3',
                      },
                      {
                        label: 'LinkedIn',
                        href: 'https://www.linkedin.com/in/kamal-feracho-075a5a1aa/',
                      },
                      {
                        label: 'Email',
                        href: 'mailto:kferacho64@gmail.com',
                      },
                    ].map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        target={
                          item.href.startsWith('http') ? '_blank' : undefined
                        }
                        rel={
                          item.href.startsWith('http')
                            ? 'noopener noreferrer'
                            : undefined
                        }
                        className="rounded-full border border-gray-200/50 dark:border-white/10 bg-gray-100/50 dark:bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:border-gray-300/60 dark:hover:border-white/30 hover:text-foreground"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="rounded-2xl border border-gray-200/40 dark:border-white/10 bg-white/50 dark:bg-card/40 p-4 text-center backdrop-blur-xl"
              >
                <div className="text-3xl font-bold text-foreground">20+</div>
                <div className="text-sm text-muted-foreground">
                  Projects Completed
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="rounded-2xl border border-gray-200/40 dark:border-white/10 bg-white/50 dark:bg-card/40 p-4 text-center backdrop-blur-xl"
              >
                <div className="text-3xl font-bold text-foreground">100%</div>
                <div className="text-sm text-muted-foreground">
                  Client Satisfaction
                </div>
              </motion.div>
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative max-w-md w-full rounded-2xl border border-white/10 bg-card/95 p-8 shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className={`mx-auto mb-4 inline-flex items-center rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                    modalType === 'success'
                      ? 'border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]'
                      : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {modalType === 'success' ? 'Success' : 'Error'}
                </motion.div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  {modalType === 'success'
                    ? 'Message Sent'
                    : 'Something went wrong'}
                </h3>
                <p className="text-muted-foreground mb-6">{modalMessage}</p>
                <button
                  onClick={() => setModalOpen(false)}
                  className="brand-gradient-button px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95"
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
