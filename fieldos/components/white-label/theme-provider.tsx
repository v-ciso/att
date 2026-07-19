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

  useEffect(() => {
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
    if (!isLoading) {
      applyTheme(theme);
      localStorage.setItem('whitelabel-theme', JSON.stringify(theme));
    }
  }, [theme, isLoading]);

  const setTheme = (partial: Partial<WhiteLabelTheme>) => {
    setThemeState(prev => ({ ...prev, ...partial }));
  };

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