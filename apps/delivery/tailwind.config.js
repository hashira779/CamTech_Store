/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border, 217 33% 17%))',
        background: 'hsl(var(--background, 222 47% 6%))',
        foreground: 'hsl(var(--foreground, 210 40% 98%))',
      },
    },
  },
  plugins: [],
};
