import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  /* ── CSS Reset / Normalize ──────────────────────────── */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    -webkit-text-size-adjust: 100%;
    tab-size: 4;
    scroll-behavior: smooth;
  }

  body {
    font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont,
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 1rem;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;

    /* Dark theme tokens */
    background-color: #0b0f1a;
    color: #e2e8f0;

    min-height: 100vh;
    overflow-x: hidden;
  }

  #root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  img, picture, video, canvas, svg {
    display: block;
    max-width: 100%;
  }

  input, button, textarea, select {
    font: inherit;
    color: inherit;
  }

  button {
    cursor: pointer;
    border: none;
    background: none;
  }

  p, h1, h2, h3, h4, h5, h6 {
    overflow-wrap: break-word;
  }

  ul, ol {
    list-style: none;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: #0b0f1a;
  }
  ::-webkit-scrollbar-thumb {
    background: #2d3a52;
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #3d5080;
  }

  /* Selection */
  ::selection {
    background: #1e6fbf44;
    color: #90cdf4;
  }
`;

/* ── Design tokens ───────────────────────────────────── */
export const tokens = {
  bg: {
    base: '#0b0f1a',
    surface: '#111827',
    elevated: '#1a2235',
    overlay: '#1e2d45',
  },
  border: {
    subtle: '#1e2d45',
    default: '#2a3a55',
    accent: '#3b5998',
  },
  text: {
    primary: '#e2e8f0',
    secondary: '#94a3b8',
    muted: '#4a5568',
    accent: '#60a5fa',
  },
  accent: {
    blue: '#3b82f6',
    cyan: '#06b6d4',
    teal: '#14b8a6',
    indigo: '#6366f1',
    danger: '#ef4444',
  },
  chart: {
    depth: '#06b6d4',
    hr: '#f97316',
    grid: '#1a2748',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
  },
  shadow: {
    card: '0 4px 24px rgba(0,0,0,0.4)',
    glow: '0 0 20px rgba(6,182,212,0.15)',
  },
} as const;
