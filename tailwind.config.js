/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0A',
        ink2: '#141414',
        ink3: '#1C1C1C',
        line: '#262626',
        bone: '#F5F0E8',
        bone2: '#A9A39A',
        orange: { DEFAULT: '#FF6B2B', soft: '#FF8B5A', dim: '#7A2D0F' },
        accent: { push: '#FF6B2B', pull: '#3B82F6', full: '#A855F7', swim: '#06B6D4', bike: '#22C55E', run: '#EF4444', rest: '#525252' },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
