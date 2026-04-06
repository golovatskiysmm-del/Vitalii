/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        instagram: {
          purple: '#833AB4',
          pink: '#FD1D1D',
          orange: '#F77737',
          gradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
        },
      },
    },
  },
  plugins: [],
};
