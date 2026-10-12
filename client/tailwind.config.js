/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f3f7',
          100: '#e5e7ee',
          200: '#cacedc',
          300: '#aeb5ca',
          400: '#7885a3',
          500: '#4d5d85',
          600: '#222d52',
          700: '#1b2442',
          800: '#151b32',
          900: '#101423',
          950: '#090b13',
        },
        palette: {
          canvas: '#eee5d9',
          sand: '#d2b68a',
          white: '#fdffff',
          black: '#000000',
        },
      }
    },
  },
  plugins: [],
}
