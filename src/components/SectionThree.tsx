/* src/components/SectionThree.tsx */
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
import emailjs from 'emailjs-com'; // v3.x API
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AnimatedButton from './AnimatedButton';

// ▸ keep keys out of the bundle — configure in your host’s env-vars panel
const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'RachoDevs';
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'RachoDevs';
const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'asi1IXWXVQKV4AGlS';

function SectionThree() {
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
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  /* ────────────────────────────────── helpers ───────────────────────────────── */
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };
  const handleSelectChange = (name: string, value: string) =>
    setFormData((p) => ({ ...p, [name]: value }));

  const validateForm = () => {
    const errs: { [k: string]: string } = {};
    if (!formData.name.trim()) errs.name = 'Name is required.';
    if (!formData.email.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      errs.email = 'Email is invalid.';
    if (!formData.service) errs.service = 'Select a service.';
    if (!formData.website) errs.website = 'Select a website type.';
    if (!formData.message.trim()) errs.message = 'Message is required.';
    if (formData._honeypot.trim()) errs.form = 'Bot submission blocked.';
    if (lastSentAt && Date.now() - lastSentAt < 30_000)
      errs.form = 'Please wait a bit before sending another message.';
    return errs;
  };

  const isValid = (f: keyof typeof formData) =>
    (f === 'name' && formData.name.trim().length > 0) ||
    (f === 'email' && /\S+@\S+\.\S+/.test(formData.email)) ||
    (f === 'service' && formData.service) ||
    (f === 'website' && formData.website) ||
    (f === 'message' && formData.message.trim().length > 0);

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

      setModalMessage('Message sent successfully! I will reply shortly.');
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
    } catch (err) {
      console.error(err);
      setModalMessage('Something went wrong. Please try again later.');
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
    <section className="flex flex-col md:flex-row items-start px-4 sm:px-8 md:px-12 py-16 gap-8">
      {/* Contact Form Column */}
      <div className="md:w-1/2 w-full px-4 relative">
        <h2 className="text-3xl font-bold mb-6 text-center md:text-left text-foreground">
          Contact Me
        </h2>

        <form ref={form} className="space-y-6" onSubmit={sendEmail} noValidate>
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
          <div>
            <Label htmlFor="name" className="block text-muted-foreground mb-1">
              Name
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full ${isValid('name') ? 'input-valid' : ''}`}
              required
            />
            {errors.name && (
              <p className="text-destructive text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="block text-muted-foreground mb-1">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full ${isValid('email') ? 'input-valid' : ''}`}
              required
            />
            {errors.email && (
              <p className="text-destructive text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Service */}
          <div>
            <Label
              htmlFor="service"
              className="block text-muted-foreground mb-1"
            >
              What kind of service do you need?
            </Label>
            <Select
              onValueChange={(v) => handleSelectChange('service', v)}
              required
            >
              <SelectTrigger
                className={`w-full ${isValid('service') ? 'input-valid' : ''}`}
              >
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>

              {/* Add divide-y to draw lines, and dark:bg for night mode */}
              <SelectContent
                className="
        backdrop-blur-sm
        bg-white/30 dark:bg-gray-800
        divide-y divide-white/20 dark:divide-gray-600
      "
              >
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
                    className="
            py-2 px-3
            hover:bg-white/20 dark:hover:bg-white/10
            transition-colors
          "
                  >
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.service && (
              <p className="text-destructive text-sm mt-1">{errors.service}</p>
            )}
          </div>

          {/* Website type */}
          <div>
            <Label
              htmlFor="website"
              className="block text-muted-foreground mb-1"
            >
              What kind of website do you need?
            </Label>
            <Select
              onValueChange={(v) => handleSelectChange('website', v)}
              required
            >
              <SelectTrigger
                className={`w-full ${isValid('website') ? 'input-valid' : ''}`}
              >
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>

              {/* Same styling here */}
              <SelectContent
                className="
        backdrop-blur-sm
        bg-white/30 dark:bg-gray-800
        divide-y divide-white/20 dark:divide-gray-600
      "
              >
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
                    className="
            py-2 px-3
            hover:bg-white/20 dark:hover:bg-white/10
            transition-colors
          "
                  >
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.website && (
              <p className="text-destructive text-sm mt-1">{errors.website}</p>
            )}
          </div>

          {/* Message */}
          <div>
            <Label
              htmlFor="message"
              className="block text-muted-foreground mb-1"
            >
              Message
            </Label>
            <Textarea
              id="message"
              name="message"
              rows={4}
              value={formData.message}
              onChange={handleInputChange}
              className={`w-full ${isValid('message') ? 'input-valid' : ''}`}
              required
            />
            {errors.message && (
              <p className="text-destructive text-sm mt-1">{errors.message}</p>
            )}
          </div>

          {errors.form && (
            <p className="text-destructive text-sm">{errors.form}</p>
          )}

          <AnimatedButton
            type="submit"
            className="mt-4 cursor-pointer text-foreground hover-gradient-border"
            disabled={sending}
          >
            {sending ? 'Sending…' : 'Submit'}
          </AnimatedButton>
        </form>

        {/* Success/Error Modal — constrained to this column */}
        <AnimatePresence>
          {modalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl"
              onClick={() => setModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="relative bg-background max-w-md w-[90%] p-6 rounded-lg shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  aria-label="Close"
                  className="absolute top-3 right-3 text-foreground/70 hover:text-foreground"
                  onClick={() => setModalOpen(false)}
                >
                  <X size={20} />
                </button>
                <p className="text-center text-foreground leading-relaxed">
                  {modalMessage}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative right column */}
      <div className="md:w-1/2 w-full flex flex-col items-center px-4">
        <h3 className="text-2xl font-semibold text-center mt-4 text-foreground">
          Let&apos;s Connect!
        </h3>
      </div>
    </section>
  );
}

export default SectionThree;
