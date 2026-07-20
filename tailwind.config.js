// tailwind.config.js — monochrome theme: white accents on true black.
// gray + teal are REMAPPED here so every existing bg-gray-*/text-teal-* across
// the site picks up the cyberpunk palette without per-page edits.
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}' // Add this if you're using app directory
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui'],
        orbitron: ['Geist', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Violet-tinted neutral scale (replaces Tailwind gray site-wide).
        gray: {
          50:  '#fafafa',
          100: '#f2f2f2',
          200: '#e0e0e0',
          300: '#bdbdbd',
          400: '#8b8b89',
          500: '#6b6b69',
          600: '#4a4a48',
          700: '#2e2e2c',
          800: '#1a1a1a',
          900: '#0f0f0f',
          950: '#0a0a0a',
        },
        // Electric-cyan scale (replaces teal site-wide).
        teal: {
          50:  '#ffffff',
          100: '#f2f2f2',
          200: '#e0e0e0',
          300: '#f0f0f0',
          400: '#ffffff',
          500: '#d4d4d4',
          600: '#a8a8a8',
          700: '#6b6b69',
          800: '#4a4a48',
          900: '#3a3a38',
          950: '#1f1f1d',
        },
        kaspa: '#ffffff',
        // Add more Kaspa-themed colors
        'kaspa-teal': '#a8a8a8',
        'kaspa-blue': '#a8a8a8',
        'kaspa-purple': '#a8a8a8',
        neon: {
          cyan: '#ffffff',
          pink: '#cfcfcf',
          purple: '#a8a8a8',
          yellow: '#e0e0e0',
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 12px rgba(255,255,255,0.55), 0 0 32px rgba(255,255,255,0.25)',
        'glow-pink': '0 0 12px rgba(255,255,255,0.5), 0 0 32px rgba(255,255,255,0.22)',
        'glow-purple': '0 0 12px rgba(255,255,255,0.5), 0 0 32px rgba(255,255,255,0.22)',
        'glow-teal': '0 0 20px rgba(255,255,255,0.3)',
        'glow-kaspa': '0 0 30px rgba(255,255,255, 0.35)',
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'flicker': 'neon-flicker 5s linear infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'neon-flicker': {
          '0%, 91%, 94%, 97%, 100%': { opacity: '1' },
          '92%': { opacity: '0.55' },
          '95%, 98%': { opacity: '0.75' },
        },
      },
      backdropBlur: {
        'xs': '2px',
        'xl': '12px',
        '2xl': '16px',
      },
      backgroundImage: {
        'kaspa-gradient': 'linear-gradient(135deg, #0a0a0a 0%, #0f0f0f 25%, #1a1a1a 50%, #0f0f0f 75%, #0a0a0a 100%)',
        'kaspa-card': 'linear-gradient(135deg, rgba(255,255,255, 0.08) 0%, rgba(255,255,255, 0.05) 50%, rgba(255,255,255, 0.08) 100%)',
        'kaspa-button': 'linear-gradient(135deg, #ffffff, #ffffff)',
      },
      borderColor: {
        'kaspa': 'rgba(255,255,255, 0.35)',
      },
    },
  },
  plugins: [],
}
