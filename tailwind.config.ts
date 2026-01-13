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

        /* Dark-mode: deep space gradient */
        'dark-cloud': 'linear-gradient(145deg, #050508 0%, #0a0a12 25%, #0d0d18 50%, #0a0a0f 100%)',
      },

      /* ---------- Custom animations ---------- */
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' },
          '100%': { boxShadow: '0 0 40px rgba(168, 85, 247, 0.8)' },
        },
      },
    },

    /* ---------- Responsive container ---------- */
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
