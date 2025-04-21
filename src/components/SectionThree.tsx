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
import { useRef, useState } from 'react';
import AnimatedButton from './AnimatedButton';

function SectionThree() {
  const form = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    service: '',
    website: '',
    message: '',
  });

  const [sending, setSending] = useState(false);
  const [sentSuccessfully, setSentSuccessfully] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required.';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid.';
    }
    if (!formData.service) {
      newErrors.service = 'Please select a service.';
    }
    if (!formData.website) {
      newErrors.website = 'Please select a website type.';
    }
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required.';
    }
    return newErrors;
  };

  const sendEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSending(true);

    emailjs
      .sendForm('gmail', 'RachoDevs', form.current!, 'asi1IXWXVQKV4AGlS')
      .then(
        (result) => {
          console.log(result.text);
          setSending(false);
          setSentSuccessfully(true);
          setFormData({
            name: '',
            email: '',
            service: '',
            website: '',
            message: '',
          });
          setTimeout(() => {
            setSentSuccessfully(false);
          }, 5000);
        },
        (error) => {
          console.log(error.text);
          setSending(false);
        }
      );
  };

  const isValid = (field: string): boolean => {
    if (field === 'name') return formData.name.trim().length > 0;
    if (field === 'email') return /\S+@\S+\.\S+/.test(formData.email);
    if (field === 'service') return formData.service.length > 0;
    if (field === 'website') return formData.website.length > 0;
    if (field === 'message') return formData.message.trim().length > 0;
    return false;
  };

  return (
    <section className="flex flex-col md:flex-row items-start px-4 sm:px-8 md:px-12 py-16 gap-8">
      {/* Contact Form */}
      <div className="md:w-1/2 w-full px-4">
        <h2 className="text-3xl font-bold mb-6 text-center md:text-left text-foreground">
          Contact Me
        </h2>
        <form ref={form} className="space-y-6" onSubmit={sendEmail} noValidate>
          {/* Name Field */}
          <div>
            <Label htmlFor="name" className="block text-muted-foreground mb-1">
              Name
            </Label>
            <Input
              type="text"
              name="name"
              id="name"
              className={`w-full ${isValid('name') ? 'input-valid' : ''}`}
              value={formData.name}
              onChange={handleInputChange}
              required
            />
            {errors.name && (
              <p className="text-destructive text-sm mt-1">{errors.name}</p>
            )}
          </div>
          {/* Email Field */}
          <div>
            <Label htmlFor="email" className="block text-muted-foreground mb-1">
              Email
            </Label>
            <Input
              type="email"
              name="email"
              id="email"
              className={`w-full ${isValid('email') ? 'input-valid' : ''}`}
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            {errors.email && (
              <p className="text-destructive text-sm mt-1">{errors.email}</p>
            )}
          </div>
          {/* Service Selection */}
          <div>
            <Label
              htmlFor="service"
              className="block text-muted-foreground mb-1"
            >
              What kind of service do you need?
            </Label>
            <Select
              onValueChange={(value) => handleSelectChange('service', value)}
            >
              <SelectTrigger
                className={`w-full ${isValid('service') ? 'input-valid' : ''}`}
              >
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Website Development">
                  Website Development
                </SelectItem>
                <SelectItem value="Website/Application Design">
                  Website/Application Design
                </SelectItem>
                <SelectItem value="3D Model">3D Model</SelectItem>
                <SelectItem value="SVG Graphics">SVG Graphics</SelectItem>
                <SelectItem value="Audio Engineering">
                  Audio Engineering
                </SelectItem>
                <SelectItem value="AV Synchronization">
                  AV Synchronization
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.service && (
              <p className="text-destructive text-sm mt-1">{errors.service}</p>
            )}
          </div>
          {/* Website Type Selection */}
          <div>
            <Label
              htmlFor="website"
              className="block text-muted-foreground mb-1"
            >
              What kind of website do you need?
            </Label>
            <Select
              onValueChange={(value) => handleSelectChange('website', value)}
            >
              <SelectTrigger
                className={`w-full ${isValid('website') ? 'input-valid' : ''}`}
              >
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Personal">Personal</SelectItem>
                <SelectItem value="NFT">NFT</SelectItem>
                <SelectItem value="Landing Page">Landing Page</SelectItem>
                <SelectItem value="Other (Specify)">Other (Specify)</SelectItem>
                <SelectItem value="None">None</SelectItem>
              </SelectContent>
            </Select>
            {errors.website && (
              <p className="text-destructive text-sm mt-1">{errors.website}</p>
            )}
          </div>
          {/* Message Field */}
          <div>
            <Label
              htmlFor="message"
              className="block text-muted-foreground mb-1"
            >
              Message
            </Label>
            <Textarea
              name="message"
              id="message"
              className={`w-full ${isValid('message') ? 'input-valid' : ''}`}
              rows={4}
              value={formData.message}
              onChange={handleInputChange}
              required
            />
            {errors.message && (
              <p className="text-destructive text-sm mt-1">{errors.message}</p>
            )}
          </div>
          {/* Submit Button */}
          <AnimatedButton
            type="submit"
            className="mt-4 cursor-pointer text-foreground hover-gradient-border"
            disabled={sending}
          >
            {sending ? 'Sending...' : 'Submit'}
          </AnimatedButton>
        </form>
        {/* Success Message */}
        <AnimatePresence>
          {sentSuccessfully && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="fixed top-10 right-4 md:right-10 bg-green-500 text-white p-4 rounded-md shadow-lg z-50"
            >
              <p>Message sent successfully!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Column */}
      <div className="md:w-1/2 w-full flex flex-col items-center px-4">
        <h3 className="text-2xl font-semibold text-center mt-4 text-foreground">
          Let&apos;s Connect!
        </h3>
        {/* Optional extra content/animations can be added here */}
      </div>
    </section>
  );
}

export default SectionThree;
