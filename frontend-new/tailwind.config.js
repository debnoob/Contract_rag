/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8f9fa',
        panel: '#ffffff',
        border: '#e5e7eb',
        primary: '#18181b', // almost black
        secondary: '#f4f4f5',
        muted: '#71717a',
        accent: '#3b82f6',
        accentHover: '#2563eb'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
