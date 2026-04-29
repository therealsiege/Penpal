/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        'card-enter': {
          '0%':   { borderLeftColor: 'rgb(59 130 246)', backgroundColor: 'rgb(59 130 246 / 0.15)' },
          '100%': { borderLeftColor: 'rgb(59 130 246)', backgroundColor: 'transparent' },
        },
        'new-file-flash': {
          '0%':   { boxShadow: 'inset 0 0 0 1px rgb(34 197 94)' },
          '60%':  { boxShadow: 'inset 0 0 0 1px rgb(34 197 94)' },
          '100%': { boxShadow: 'inset 0 0 0 1px transparent' },
        },
        // Modal / backdrop
        'backdrop-fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'modal-scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        // Feed items staggered entrance
        'fade-slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Section headers
        'fade-slide-down': {
          '0%':   { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // New-item green left border flash
        'new-item-flash': {
          '0%':   { borderLeftColor: 'rgb(34 197 94)', paddingLeft: '10px' },
          '70%':  { borderLeftColor: 'rgb(34 197 94)', paddingLeft: '10px' },
          '100%': { borderLeftColor: 'transparent',    paddingLeft: '12px' },
        },
        // Shimmer loading skeleton
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'card-enter':       'card-enter 600ms ease-out forwards',
        'new-file-flash':   'new-file-flash 1000ms ease-out forwards',
        'backdrop-fade-in': 'backdrop-fade-in 180ms ease-out forwards',
        'modal-scale-in':   'modal-scale-in 220ms cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-slide-up':    'fade-slide-up 240ms ease-out forwards',
        'fade-slide-down':  'fade-slide-down 200ms ease-out forwards',
        'new-item-flash':   'new-item-flash 1400ms ease-out forwards',
        shimmer:            'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
