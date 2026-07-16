/** @type {import('tailwindcss').Config} */
// Microsoft To Do palette (Fluent) — see docs/TECHNICAL_DESIGN.md §2.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#2564CF',
          hover: '#1B4DAD',
          pressed: '#16408F',
          soft: '#EAF1FC',
          softborder: '#C7DAF5',
        },
        app: '#FAF9F8',
        surface: '#FFFFFF',
        subtle: '#F3F2F1',
        border: {
          DEFAULT: '#EDEBE9',
          strong: '#D2D0CE',
        },
        ink: {
          DEFAULT: '#201F1E',
          secondary: '#605E5C',
          tertiary: '#A19F9D',
        },
        status: {
          success: '#107C10',
          successsoft: '#DFF6DD',
          warning: '#C19C00',
          warningsoft: '#FFF4CE',
          danger: '#D13438',
          dangersoft: '#FDE7E9',
          submitted: '#5B4BE6',
          submittedsoft: '#F0EBFA',
        },
        priority: {
          urgent: '#D13438',
          high: '#E8710A',
          medium: '#C19C00',
          low: '#605E5C',
        },
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          '"Segoe UI Web (West European)"',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '8px',
        control: '6px',
        chip: '4px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04)',
        pop: '0 8px 24px rgba(0,0,0,.12)',
      },
      backgroundImage: {
        'accent-grad': 'linear-gradient(135deg,#2564CF 0%,#3B7AD9 100%)',
      },
    },
  },
  plugins: [],
}
