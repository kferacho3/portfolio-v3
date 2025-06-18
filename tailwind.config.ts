/* ============================  tailwind.config.ts  ============================ */
import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'], // use class="dark" on <html>
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* ---------- design-token colours (your originals) ---------- */
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        'card-foreground': 'hsl(var(--card-foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        primary: 'hsl(var(--primary) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
        secondary: 'hsl(var(--secondary) / <alpha-value>)',
        'secondary-foreground':
          'hsl(var(--secondary-foreground) / <alpha-value>)',
        destructive: 'hsl(var(--destructive) / <alpha-value>)',
        'destructive-foreground':
          'hsl(var(--destructive-foreground) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },

      /* ---------- border radii (unchanged) ---------- */
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      /* ---------- NEW background gradients ---------- */
      backgroundImage: {
        /* Light-mode: cloudy-white ➜ aqua-blue */
        'cloud-aqua':
          'linear-gradient(140deg, #f1f5f9 0%, #e2f8ff 35%, #c9f2ff 70%, #b2ecff 100%)',

        /* Dark-mode fallback */
        'dark-cloud': 'linear-gradient(140deg, #0a0a0a 0%, #1b1d24 100%)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
