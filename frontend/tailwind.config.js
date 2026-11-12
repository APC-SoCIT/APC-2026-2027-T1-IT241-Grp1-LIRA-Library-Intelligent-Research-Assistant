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
          50: '#FFF9E6', 100: '#FFF0BF', 200: '#FFE599', 300: '#FFD966', 400: '#F8C944',
          500: '#F2B51A', 600: '#D99A00', 700: '#AD7800', 800: '#805B00', 900: '#604400',
        },
        navy: {
          50: '#EAF2FA', 100: '#D3E2F0', 200: '#AFC8DE', 300: '#83A7C8', 400: '#4F7EAA',
          500: '#003A70', 600: '#003463', 700: '#002C55', 800: '#002344', 900: '#001A33',
        },
        cream: '#F4F7FB',
        mustard: '#F2B51A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
