export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'display': ['Cormorant Garamond', 'Playfair Display', 'serif'],
      },
      colors: {
        primary: {
          50: '#fdf3f3',
          100: '#fbe5e5',
          200: '#f6d0d1',
          300: '#eeacae',
          400: '#e27e82',
          500: '#d2565b',
          600: '#a6171b',
          700: '#8a1215',
          800: '#741012',
          900: '#611110',
        },
        gold: {
          50: '#fbf7eb',
          100: '#f5eccf',
          200: '#ead79b',
          300: '#dfc165',
          400: '#d4ab3a',
          500: '#c9992b',
          600: '#a87a22',
          700: '#845e1e',
          800: '#664a1e',
          900: '#573e1d',
        },
      },
      boxShadow: {
        'soft': '0 2px 15px rgba(0,0,0,0.06)',
        'card': '0 4px 20px rgba(0,0,0,0.08)',
        'hover': '0 10px 30px rgba(0,0,0,0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}