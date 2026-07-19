/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#000000',
          secondary: '#0A0A0F',
          tertiary: '#111318',
          card: 'rgba(255,255,255,0.03)',
        },
        border: {
          subtle: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.15)',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#9CA3AF',
          muted: '#6B7280',
          inverse: '#000000',
        },
        accent: {
          blue: '#3B82F6',
          'blue-glow': 'rgba(59,130,246,0.4)',
          purple: '#A855F7',
          'purple-glow': 'rgba(168,85,247,0.4)',
          cyan: '#06B6D4',
          'cyan-glow': 'rgba(6,182,212,0.4)',
          green: '#10B981',
          yellow: '#F59E0B',
          orange: '#F97316',
          red: '#EF4444',
        },
      },
      backgroundImage: {
        'grad-blue': 'linear-gradient(135deg, #60A5FA, #3B82F6, #2563EB)',
        'grad-purple': 'linear-gradient(135deg, #C084FC, #A855F7, #7C3AED)',
        'grad-cyan': 'linear-gradient(135deg, #67E8F9, #06B6D4, #0891B2)',
        'grad-green': 'linear-gradient(135deg, #6EE7B7, #10B981, #059669)',
        'grad-card': 'linear-gradient(135deg, rgba(17,24,39,0.9), rgba(0,0,0,0.95))',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'fluid-xs': 'clamp(0.625rem, 0.58rem + 0.2vw, 0.75rem)',
        'fluid-sm': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
        'fluid-base': 'clamp(0.875rem, 0.82rem + 0.25vw, 1rem)',
        'fluid-lg': 'clamp(1rem, 0.92rem + 0.4vw, 1.125rem)',
        'fluid-xl': 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
        'fluid-2xl': 'clamp(1.5rem, 1.25rem + 1.25vw, 2rem)',
        'fluid-3xl': 'clamp(2rem, 1.5rem + 2.5vw, 3rem)',
        'fluid-4xl': 'clamp(2.5rem, 1.75rem + 3.75vw, 4rem)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59,130,246,0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(59,130,246,0.3)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.1)',
        'neon-purple': '0 0 20px rgba(168,85,247,0.3), 0 0 40px rgba(168,85,247,0.1)',
        'neon-cyan': '0 0 20px rgba(6,182,212,0.3), 0 0 40px rgba(6,182,212,0.1)',
        'glass': '0 8px 32px rgba(0,0,0,0.3)',
      },
      backdropBlur: {
        'glass': '20px',
      },
    },
  },
  plugins: [],
};