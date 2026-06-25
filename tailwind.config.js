/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#C9A227',
        ink: '#1A1A1A',
        paper: '#FAF8F4',
        hairline: '#E8E4DC',
        muted: '#76726A',
        'status-green': '#2E7D5B',
        'status-red': '#B5443A',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontVariantNumeric: ['tabular-nums'],
    },
  },
  plugins: [],
}
