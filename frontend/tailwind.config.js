/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: false,
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#f59e0b',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}