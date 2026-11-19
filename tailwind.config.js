// tailwind.config.js — the k402 identity (docs/uiux/2026-11-18-identity-design.md): graphite neutrals, one acid accent,
// Fraunces display, Source Serif 4 body, JetBrains Mono data. The `gray` scale is REMAPPED to
// the identity's tokens; the teal/neon/kaspa aliases were retired in Phase 4 PR 6 once no page named them.
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
          600: '#858A94',
          700: '#3A3F48',
          800: rule,
          900: panel,
          950: ground,
        },
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
