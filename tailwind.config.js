/** @type {import('tailwindcss').Config} */
// Palette: Task Management redesign (Oct 2026) — vivid blue accent on cool neutrals.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#1A66E5',
          hover: '#1555C2',
          pressed: '#11469F',
          soft: '#EAF2FF',
          softborder: '#C6DBFB',
        },
        app: '#F5F7FB',
        surface: '#FFFFFF',
        subtle: '#F1F4F9',
        border: {
          DEFAULT: '#E5E9F0',
          strong: '#CDD4DF',
        },
        ink: {
          DEFAULT: '#1B2333',
          secondary: '#5B6474',
          tertiary: '#98A1B0',
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
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 6px rgba(16,24,40,.04)',
        pop: '0 8px 24px rgba(0,0,0,.12)',
      },
      backgroundImage: {
        'accent-grad': 'linear-gradient(135deg,#1A66E5 0%,#3B82F6 100%)',
      },
    },
  },
  plugins: [],
}
