// tailwind.config.js — the k402 identity (docs/uiux/2026-11-18-identity-design.md): graphite neutrals, one acid accent,
// Fraunces display, Source Serif 4 body, JetBrains Mono data. The `gray`, `teal`, `neon` and `kaspa` names are REMAPPED to
// the identity's tokens so every existing class across the site re-skins at once; later passes retire the old names.
const ground = '#16181D';
const panel = '#1F2229';
const rule = '#2B2F37';
const text = '#F2F3F5';
const muted = '#8B9099';
const accent = '#D1FF4A';

module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Serif 4"', 'Georgia', 'serif'],
        orbitron: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // the neutral scale, graphite: 950 ground, 900 panel, 800 rule, 500 muted, 100–50 text
        gray: {
          50: text,
          100: text,
          200: '#D6DAE0',
          300: '#C9CDD4',
          400: '#B9BDC6',
          500: muted,
          600: '#5B616B',
          700: '#3A3F48',
          800: rule,
          900: panel,
          950: ground,
        },
        // every "teal" in the site is the one accent (lighter/darker only for hover and disabled states)
        teal: {
          50: '#F6FFD6', 100: '#EEFFB8', 200: '#E4FF8F', 300: '#DBFF6B', 400: accent, 500: '#B8E63A',
          600: '#93B82E', 700: '#6E8A22', 800: '#4A5C17', 900: '#2E3A0E', 950: '#1A2108',
        },
        kaspa: accent,
        'kaspa-teal': accent,
        'kaspa-blue': accent,
        'kaspa-purple': accent,
        neon: { cyan: accent, pink: accent, purple: accent, yellow: accent },
        ground, panel, rule, muted, accent,
      },
      borderRadius: { none: '0px', sm: '0px', DEFAULT: '0px', md: '0px', lg: '0px', xl: '0px', '2xl': '0px', '3xl': '0px', full: '9999px' },
      boxShadow: { none: 'none' },
      animation: {},
      keyframes: {},
    },
  },
  plugins: [],
};
