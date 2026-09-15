/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FFF9E6',
          100: '#FFF0BF',
          200: '#FFE599',
          300: '#FFD966',
          400: '#FFCC33',
          500: '#D4A017',
          600: '#C49215',
          700: '#A67C12',
          800: '#886610',
          900: '#6A500D',
        },
        navy: {
          50: '#E8EBF0',
          100: '#C5CCDA',
          200: '#9EABC2',
          300: '#778AAA',
          400: '#5A7198',
          500: '#1B2A4A',
          600: '#182543',
          700: '#141F38',
          800: '#10192D',
          900: '#0C1322',
        },
        cream: '#FAF6F0',
        mustard: '#E8A317',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
