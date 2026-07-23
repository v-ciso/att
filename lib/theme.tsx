import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemePreset = 'command-blue' | 'obsidian-gold' | 'emerald';

export interface WhiteLabelTheme {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  preset?: ThemePreset;
  logoUrl?: string;
  logoLocked?: boolean; // once locked by the admin, the logo can't be changed
  faviconUrl?: string;
  loginBackgroundUrl?: string;
  customDomain?: string;
  featureFlags: {
    hidePnL: boolean;
    hideCommissionEngine: boolean;
    hideTeamManagement: boolean;
    hideGoalsAttendance: boolean;
  };
}

// Obsidian & Gold is the product's own brand. A new tenant starts here and
// re-brands itself in Settings — company name, logo, and preset are stored per
// workspace (lib/workspace.ts), so two tenants on one browser never collide.
const DEFAULT_THEME: WhiteLabelTheme = {
  companyName: 'Sales Engine',
  primaryColor: '#E7C24A',
  secondaryColor: '#B8860B',
  preset: 'obsidian-gold',
  featureFlags: {
    hidePnL: false,
    hideCommissionEngine: false,
    hideTeamManagement: false,
    hideGoalsAttendance: false,
  },
};

export { DEFAULT_THEME };

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function generateCSSVariables(theme: WhiteLabelTheme): string {
  const primary = hexToRgb(theme.primaryColor);
  const secondary = hexToRgb(theme.secondaryColor);

  if (!primary || !secondary) return '';

  const primaryRgb = `${primary.r}, ${primary.g}, ${primary.b}`;
  const secondaryRgb = `${secondary.r}, ${secondary.g}, ${secondary.b}`;

  return `
    :root {
      --wl-primary: ${theme.primaryColor};
      --wl-primary-rgb: ${primaryRgb};
      --wl-secondary: ${theme.secondaryColor};
      --wl-secondary-rgb: ${secondaryRgb};
      --wl-primary-glow: rgba(${primaryRgb}, 0.4);
      --wl-secondary-glow: rgba(${secondaryRgb}, 0.4);
      --wl-grad-primary: linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor});
      --wl-grad-card: linear-gradient(135deg, rgba(17,24,39,0.9), rgba(0,0,0,0.95));
    }
  `;
}

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: WhiteLabelTheme;
}

export function ThemeProvider({ children, initialTheme = DEFAULT_THEME }: ThemeProviderProps) {
  const [theme, setTheme] = useState<WhiteLabelTheme>(initialTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const style = document.createElement('style');
    style.id = 'whitelabel-theme';
    style.textContent = generateCSSVariables(theme);
    document.head.appendChild(style);

    document.title = `${theme.companyName} — Retail Command Center`;

    if (theme.faviconUrl) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = theme.faviconUrl;
    }

    return () => {
      const existing = document.getElementById('whitelabel-theme');
      if (existing) existing.remove();
    };
  }, [theme]);

  useEffect(() => {
    if (mounted) {
      const style = document.getElementById('whitelabel-theme');
      if (style) style.textContent = generateCSSVariables(theme);
      document.title = `${theme.companyName} — Retail Command Center`;
    }
  }, [theme, mounted]);

  const updateTheme = (updates: Partial<WhiteLabelTheme>) => {
    setTheme(prev => ({ ...prev, ...updates }));
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

const ThemeContext = createContext<{
  theme: WhiteLabelTheme;
  updateTheme: (updates: Partial<WhiteLabelTheme>) => void;
  mounted: boolean;
} | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export function getTheme(): WhiteLabelTheme {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('se-theme-v1');
    if (stored) return JSON.parse(stored);
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: WhiteLabelTheme) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('se-theme-v1', JSON.stringify(theme));
    let style = document.getElementById('whitelabel-theme') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'whitelabel-theme';
      document.head.appendChild(style);
    }
    style.textContent = generateCSSVariables(theme);
    // Brand preset drives the gold/blue/emerald chrome via CSS in globals.css
    document.documentElement.dataset.theme = theme.preset ?? 'command-blue';
    // Company logo doubles as the browser favicon
    const favHref = theme.faviconUrl || theme.logoUrl;
    if (favHref) {
      let fav = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); }
      fav.href = favHref;
    }
    document.title =
      theme.companyName === 'Sales Engine'
        ? 'Sales Engine — Retail Command Center'
        : `${theme.companyName} — Powered by Sales Engine`;
  }
}