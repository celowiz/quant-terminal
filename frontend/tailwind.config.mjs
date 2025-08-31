/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bb: {
          bg: '#0b0c10',
          panel: '#0f1115',
          border: '#334155',
          accent: '#FFA028',
          blue: '#00A8FF',
          yellow: '#FFD700',
          green: '#00FF00',
          red: '#FF2D55',
          mustard: '#C88A00',
          maroon: '#8E0D0D',
          maroonDark: '#4D0A0A',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}


