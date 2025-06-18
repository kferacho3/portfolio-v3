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
import {
  AlertCircle,
  Briefcase,
  CheckCircle,
  Globe,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
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
    <section className="min-h-screen py-12 px-4 sm:py-16 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Let&apos;s Create Together
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Have a project in mind? I&apos;d love to hear about it. Let&apos;s
            discuss how we can bring your ideas to life.
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
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-purple-900/20 p-6 sm:p-8 lg:p-10 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
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
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <User className="w-4 h-4" />
                    Your Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className={`
                      w-full px-4 py-3 rounded-lg border-2 
                      bg-gray-50 dark:bg-gray-800/50
                      text-gray-900 dark:text-white
                      placeholder:text-gray-400 dark:placeholder:text-gray-500
                      focus:ring-4 focus:ring-purple-600/10 dark:focus:ring-purple-400/10
                      focus:border-purple-600 dark:focus:border-purple-400
                      transition-all duration-200
                      ${
                        isValid('name')
                          ? 'border-green-500 dark:border-green-400'
                          : errors.name && touched.name
                            ? 'border-red-500 dark:border-red-400'
                            : 'border-gray-300 dark:border-gray-700'
                      }
                    `}
                    required
                  />
                  {errors.name && touched.name && (
                    <p className="text-red-500 dark:text-red-400 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="group">
                  <Label
                    htmlFor="email"
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <Mail className="w-4 h-4" />
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
                      w-full px-4 py-3 rounded-lg border-2 
                      bg-gray-50 dark:bg-gray-800/50
                      text-gray-900 dark:text-white
                      placeholder:text-gray-400 dark:placeholder:text-gray-500
                      focus:ring-4 focus:ring-purple-600/10 dark:focus:ring-purple-400/10
                      focus:border-purple-600 dark:focus:border-purple-400
                      transition-all duration-200
                      ${
                        isValid('email')
                          ? 'border-green-500 dark:border-green-400'
                          : errors.email && touched.email
                            ? 'border-red-500 dark:border-red-400'
                            : 'border-gray-300 dark:border-gray-700'
                      }
                    `}
                    required
                  />
                  {errors.email && touched.email && (
                    <p className="text-red-500 dark:text-red-400 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Service */}
                <div className="group">
                  <Label
                    htmlFor="service"
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <Briefcase className="w-4 h-4" />
                    Service Needed
                  </Label>
                  <Select
                    onValueChange={(v) => handleSelectChange('service', v)}
                    value={formData.service}
                  >
                    <SelectTrigger
                      className={`
                        w-full px-4 py-3 rounded-lg border-2
                        bg-gray-50 dark:bg-gray-800/50
                        text-gray-900 dark:text-white
                        focus:ring-4 focus:ring-purple-600/10 dark:focus:ring-purple-400/10
                        focus:border-purple-600 dark:focus:border-purple-400
                        transition-all duration-200
                        ${
                          isValid('service')
                            ? 'border-green-500 dark:border-green-400'
                            : errors.service && touched.service
                              ? 'border-red-500 dark:border-red-400'
                              : 'border-gray-300 dark:border-gray-700'
                        }
                      `}
                    >
                      <SelectValue placeholder="Choose a service" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
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
                          className="py-3 px-4 text-gray-900 dark:text-white hover:bg-purple-50 dark:hover:bg-purple-900/20 focus:bg-purple-50 dark:focus:bg-purple-900/20"
                        >
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.service && touched.service && (
                    <p className="text-red-500 dark:text-red-400 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.service}
                    </p>
                  )}
                </div>

                {/* Website type */}
                <div className="group">
                  <Label
                    htmlFor="website"
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <Globe className="w-4 h-4" />
                    Website Type
                  </Label>
                  <Select
                    onValueChange={(v) => handleSelectChange('website', v)}
                    value={formData.website}
                  >
                    <SelectTrigger
                      className={`
                        w-full px-4 py-3 rounded-lg border-2
                        bg-gray-50 dark:bg-gray-800/50
                        text-gray-900 dark:text-white
                        focus:ring-4 focus:ring-purple-600/10 dark:focus:ring-purple-400/10
                        focus:border-purple-600 dark:focus:border-purple-400
                        transition-all duration-200
                        ${
                          isValid('website')
                            ? 'border-green-500 dark:border-green-400'
                            : errors.website && touched.website
                              ? 'border-red-500 dark:border-red-400'
                              : 'border-gray-300 dark:border-gray-700'
                        }
                      `}
                    >
                      <SelectValue placeholder="Select website type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
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
                          className="py-3 px-4 text-gray-900 dark:text-white hover:bg-purple-50 dark:hover:bg-purple-900/20 focus:bg-purple-50 dark:focus:bg-purple-900/20"
                        >
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.website && touched.website && (
                    <p className="text-red-500 dark:text-red-400 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.website}
                    </p>
                  )}
                </div>

                {/* Message */}
                <div className="group">
                  <Label
                    htmlFor="message"
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <MessageSquare className="w-4 h-4" />
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
                      w-full px-4 py-3 rounded-lg border-2 resize-none
                      bg-gray-50 dark:bg-gray-800/50
                      text-gray-900 dark:text-white
                      placeholder:text-gray-400 dark:placeholder:text-gray-500
                      focus:ring-4 focus:ring-purple-600/10 dark:focus:ring-purple-400/10
                      focus:border-purple-600 dark:focus:border-purple-400
                      transition-all duration-200
                      ${
                        isValid('message')
                          ? 'border-green-500 dark:border-green-400'
                          : errors.message && touched.message
                            ? 'border-red-500 dark:border-red-400'
                            : 'border-gray-300 dark:border-gray-700'
                      }
                    `}
                    required
                  />
                  {errors.message && touched.message && (
                    <p className="text-red-500 dark:text-red-400 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.message}
                    </p>
                  )}
                </div>

                {errors.form && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.form}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className={`
                    w-full px-6 py-3 rounded-lg font-medium text-white
                    bg-gradient-to-r from-purple-600 to-pink-600
                    hover:from-purple-700 hover:to-pink-700
                    focus:ring-4 focus:ring-purple-600/20 dark:focus:ring-purple-400/20
                    transform transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${!sending && 'hover:scale-[1.02] active:scale-[0.98]'}
                    flex items-center justify-center gap-2
                  `}
                >
                  {sending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message
                      <Send className="w-5 h-5" />
                    </>
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
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-[2px]">
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 h-full">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Let&apos;s Build Something Amazing
                </h3>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      What I Offer
                    </h4>
                    <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <span>Custom web solutions tailored to your needs</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <span>
                          Modern, responsive design that works everywhere
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <span>Fast turnaround and ongoing support</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Response Time
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">
                      I typically respond within 24 hours. For urgent inquiries,
                      please mention it in your message.
                    </p>
                  </div>

                  <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                      Prefer to connect on social media?
                    </p>
                    <div className="flex gap-4">
                      <a
                        href="https://github.com/kferacho3"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      </a>
                      <a
                        href="https://www.linkedin.com/in/kamal-feracho-075a5a1aa/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                      </a>
                      <a
                        href="mailto:kferacho@rachodevs.com"
                        className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      >
                        <Mail className="w-5 h-5" />
                      </a>
                    </div>
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
                className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center"
              >
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  20+
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Projects Completed
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4 text-center"
              >
                <div className="text-3xl font-bold text-pink-600 dark:text-pink-400">
                  100%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
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
              className="relative bg-white dark:bg-gray-900 max-w-md w-full p-8 rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                {modalType === 'success' ? (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        delay: 0.2,
                        type: 'spring',
                        stiffness: 200,
                      }}
                      className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4"
                    >
                      <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Message Sent!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {modalMessage}
                    </p>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        delay: 0.2,
                        type: 'spring',
                        stiffness: 200,
                      }}
                      className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4"
                    >
                      <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Oops!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {modalMessage}
                    </p>
                  </>
                )}
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 active:scale-95"
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
