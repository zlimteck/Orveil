/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface:     'rgb(var(--nh-surface) / <alpha-value>)',
        card:        'rgb(var(--nh-card) / <alpha-value>)',
        border:      'rgb(var(--nh-border) / <alpha-value>)',
        muted:       'rgb(var(--nh-muted) / <alpha-value>)',
        thistle:     'rgb(var(--nh-thistle) / <alpha-value>)',
        periwinkle:  'rgb(var(--nh-periwinkle) / <alpha-value>)',
        frosted:     'rgb(var(--nh-frosted) / <alpha-value>)',
        celadon:     'rgb(var(--nh-celadon) / <alpha-value>)',
        granite:     'rgb(var(--nh-granite) / <alpha-value>)',
        'granite-2': 'rgb(var(--nh-granite-2) / <alpha-value>)',
        'granite-3': 'rgb(var(--nh-granite-3) / <alpha-value>)',
        'ink':       'rgb(var(--nh-ink) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
