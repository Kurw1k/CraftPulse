/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06090f',
          900: '#0a0e16',
          850: '#0d121c',
          800: '#111824',
          750: '#151d2b',
          700: '#1b2535',
          600: '#26334a',
          500: '#34445f'
        },
        accent: {
          DEFAULT: '#4ade80',
          soft: '#1b3a2a',
          bright: '#86efac'
        },
        violet: {
          DEFAULT: '#8b8cf7'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace']
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(74, 222, 128, 0.18), 0 10px 40px -18px rgba(74, 222, 128, 0.55)'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(14px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        pulseglow: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        pulseglow: 'pulseglow 1.8s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
