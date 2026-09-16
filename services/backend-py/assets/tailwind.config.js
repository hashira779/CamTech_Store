// =============================================================================
// Tailwind build for the server-rendered HTML that backend-py serves itself:
// the gateway dashboard (/) and the admin docs unlock page (/docs, /redoc).
//
// These two pages previously pulled the Tailwind Play CDN at runtime, which the
// Cross-Origin-Embedder-Policy: require-corp header blocks (the CDN sends no
// Cross-Origin-Resource-Policy header). The CSS is now compiled ahead of time
// and served from 'self' instead.
//
// Rebuild after editing classes in either page:
//   cd services/backend-py && npm run build:css
// =============================================================================

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  // Globs resolve relative to the CWD the CLI runs in (services/backend-py).
  // Tailwind's default extractor scans these .py files as plain text, which is
  // all it needs to find the class names inside the HTML string literals.
  content: [
    './app/microservices/gateway_dashboard.py',
    './app/core/docs_protection.py',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
      },
    },
  },
};
