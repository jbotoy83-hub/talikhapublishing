import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
const tailwindConfig = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  safelist: ['bg-clay-500/80', 'bg-forest-700/80'],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: '#1c2821',
        'muted-foreground': '#66756d',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)'
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)'
        },
        destructive: {
          DEFAULT: 'var(--destructive)'
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)'
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)'
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)'
        },
        forest: { 50: '#f2f6f3', 100: '#dfe9e2', 500: '#2d6045', 600: '#214d37', 700: '#183d2c', 800: '#123125', 900: '#0e271e' },
        clay: { 50: '#fdf7f2', 100: '#f8e9dd', 500: '#b65f3a', 600: '#9f4b2c', 700: '#813b25' },
        parchment: '#f7f3ea',
        ink: '#1c2821'
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-literata)', 'Literata', 'Georgia', 'serif']
      },
      boxShadow: {
        paper: '0 18px 50px rgba(28, 40, 33, 0.10)',
        lift: '0 10px 30px rgba(28, 40, 33, 0.12)'
      },
      spacing: { '87.5': '21.875rem', '140': '35rem', '320': '80rem' }
    }
  },
  plugins: [animate]
};

export default tailwindConfig;
