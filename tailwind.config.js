/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './content/**/*.mdx',
  ],
  theme: {
    extend: {
      colors: {
        // VnExpress brand red (matches the logo wordmark)
        vne: {
          red: '#a4123f',       // primary red used in logo / accents
          'red-bright': '#c4163d', // brighter accent
          ink: '#222222',       // body text
          mute: '#4f4f4f',      // description gray
          line: '#e5e5e5',      // hairline borders
          bg: '#ffffff',
          chip: '#f4f4f4',
        },
      },
      fontFamily: {
        // VnExpress uses Arial for body & Merriweather for headlines
        body: ['Arial', 'Helvetica', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      },
      fontSize: {
        // Calibrated against measured vnexpress.net values
        'hero-title': ['20px', '32px'],
        'card-title': ['15px', '24px'],
        'desc': ['14px', '19.6px'],
        'nav': ['14px', '20px'],
      },
      maxWidth: {
        'vne': '1200px',
      },
    },
  },
  plugins: [],
}
