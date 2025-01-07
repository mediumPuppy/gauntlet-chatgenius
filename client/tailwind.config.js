/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f0fdfd',
          100: '#ccf9fa',
          200: '#adf5f7',
          300: '#8ff7e3',
          400: '#71cbc7',
          500: '#61a4ab',
          600: '#4d8389',
          700: '#3a6267',
          800: '#264145',
          900: '#132022',
        },
      },
    },
  },
  plugins: [],
}

