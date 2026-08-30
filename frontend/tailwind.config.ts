import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e6eef7',
          100: '#ccddf0',
          500: '#1a56a0',
          600: '#003366',
          700: '#002855',
        },
        // Secundaire tekstrollen, getint naar brand-600. Beide halen WCAG AA
        // (4.5:1) op wit, bg-gray-50 (de body) en bg-gray-100; gray-400/300
        // haalden dat op geen van drieën.
        ink: {
          muted:  '#5b667a', // 5.8:1 op wit — secundaire tekst, labels, tabelkoppen
          subtle: '#636e7d', // 5.2:1 op wit — metadata, placeholders, lege staten
        },
      },
    },
  },
  plugins: [],
} satisfies Config
