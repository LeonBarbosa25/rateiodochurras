import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ember: {
          50: '#fff7ed',
          100: '#ffedd5',
          300: '#fdba74',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        coal: {
          50: '#f4f4f5',
          100: '#e4e4e7',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#0a0a0b',
        },
      },
      fontFamily: { sans: ['system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
