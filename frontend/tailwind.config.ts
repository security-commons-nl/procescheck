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
      },
    },
  },
  plugins: [],
} satisfies Config
