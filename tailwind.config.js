// tailwind.config.js — cyberpunk theme: neon accents on a violet-tinted void.
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
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        orbitron: ['Orbitron', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Violet-tinted neutral scale (replaces Tailwind gray site-wide).
        gray: {
          50:  '#f5f3fb',
          100: '#eae6f6',
          200: '#d7cfe9',
          300: '#ada1cd',
          400: '#8478ab',
          500: '#615687',
          600: '#494067',
          700: '#342e4e',
          800: '#241f3a',
          900: '#151026',
          950: '#0a0616',
        },
        // Electric-cyan scale (replaces teal site-wide).
        teal: {
          50:  '#e9feff',
          100: '#ccfdfb',
          200: '#9afaf5',
          300: '#5df5ee',
          400: '#00f0ff',
          500: '#00c9d8',
          600: '#00a0b0',
          700: '#0b7c88',
          800: '#115e68',
          900: '#134c55',
          950: '#052e33',
        },
        kaspa: '#49EACB',
        // Add more Kaspa-themed colors
        'kaspa-teal': '#14b8a6',
        'kaspa-blue': '#06b6d4',
        'kaspa-purple': '#8b5cf6',
        neon: {
          cyan: '#00f0ff',
          pink: '#ff2ec4',
          purple: '#b45cff',
          yellow: '#f8ef4a',
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 12px rgba(0,240,255,0.55), 0 0 32px rgba(0,240,255,0.25)',
        'glow-pink': '0 0 12px rgba(255,46,196,0.5), 0 0 32px rgba(255,46,196,0.22)',
        'glow-purple': '0 0 12px rgba(180,92,255,0.5), 0 0 32px rgba(180,92,255,0.22)',
        'glow-teal': '0 0 20px rgba(0,240,255,0.3)',
        'glow-kaspa': '0 0 30px rgba(73, 234, 203, 0.35)',
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
        'kaspa-gradient': 'linear-gradient(135deg, #0a0616 0%, #151026 25%, #241f3a 50%, #151026 75%, #0a0616 100%)',
        'kaspa-card': 'linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(180, 92, 255, 0.05) 50%, rgba(255, 46, 196, 0.08) 100%)',
        'kaspa-button': 'linear-gradient(135deg, #49EACB, #00f0ff)',
      },
      borderColor: {
        'kaspa': 'rgba(73, 234, 203, 0.35)',
      },
    },
  },
  plugins: [],
}
