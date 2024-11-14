/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark mode colors
        dark: {
          background: '#0A0A0A',
          card: '#1A1A1A',
          border: '#2A2A2A',
          text: {
            primary: '#FFFFFF',
            secondary: '#A3A3A3'
          },
          accent: '#3B82F6'
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
} 