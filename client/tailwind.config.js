export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'display': ['Playfair Display', 'serif'],
      },
      colors: {
        primary: {
          50: '#fdf2f5',
          100: '#fce7ef',
          200: '#fad0df',
          300: '#f5a8c4',
          400: '#ee77a0',
          500: '#e54e7d',
          600: '#d0305f',
          700: '#b2244f',
          800: '#8a1c3d',
          900: '#6b1b36',
        },
        gold: {
          100: '#fdf6e3',
          400: '#e6c066',
          500: '#d4a83b',
          600: '#b8891f',
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