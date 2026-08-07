/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'dark-bg': '#1a1a2e',
        'dark-surface': '#16213e',
        'dark-border': '#0f3460',
        'accent': '#e94560',
        'accent-hover': '#ff6b6b',
      },
    },
  },
  plugins: [],
}
