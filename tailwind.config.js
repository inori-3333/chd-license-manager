/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#061018',
          900: '#0b1f33',
          800: '#123047',
          700: '#1b3d56',
        },
        brand: {
          50: '#ecfdf8',
          100: '#d1fae8',
          500: '#0d9488',
          600: '#0f766e',
          700: '#115e59',
        },
        steel: {
          50: '#f4f7fa',
          100: '#e8eef4',
          200: '#d5e0ea',
          500: '#64748b',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04)',
      },
      fontFamily: {
        sans: [
          'Source Han Sans SC',
          'Noto Sans SC',
          'PingFang SC',
          'Microsoft YaHei',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
