'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DEFAULT_THEME, WhiteLabelTheme, applyTheme } from '@/lib/theme';

interface ThemeContextType {
  theme: WhiteLabelTheme;
  setTheme: (theme: Partial<WhiteLabelTheme>) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<WhiteLabelTheme>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('whitelabel-theme');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setThemeState({ ...DEFAULT_THEME, ...parsed });
      } catch {
        // ignore parse errors
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && mounted) {
      applyTheme(theme);
      localStorage.setItem('whitelabel-theme', JSON.stringify(theme));
    }
  }, [theme, isLoading, mounted]);

  const setTheme = (partial: Partial<WhiteLabelTheme>) => {
    setThemeState(prev => ({ ...prev, ...partial }));
  };

  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: DEFAULT_THEME, setTheme: () => {}, isLoading: true }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}