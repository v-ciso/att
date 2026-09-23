'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { DEFAULT_THEME, WhiteLabelTheme, applyTheme } from '@/lib/theme';

interface ThemeContextType {
  theme: WhiteLabelTheme;
  setTheme: (theme: Partial<WhiteLabelTheme>) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const fetchTheme = (url: string) => fetch(url).then(async response => {
  if (!response.ok) throw new Error('Could not load company branding.');
  return response.json() as Promise<{ theme?: Partial<WhiteLabelTheme> }>;
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const { data: persisted } = useSWR(status === 'authenticated' ? '/api/whitelabel' : null, fetchTheme);
  const [theme, setThemeState] = useState<WhiteLabelTheme>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('se-theme-v1');
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
    if (!persisted?.theme) return;
    setThemeState(current => ({
      ...DEFAULT_THEME,
      ...current,
      ...persisted.theme,
      featureFlags: {
        ...DEFAULT_THEME.featureFlags,
        ...current.featureFlags,
        ...persisted.theme?.featureFlags,
      },
    }));
  }, [persisted]);

  useEffect(() => {
    if (!isLoading && mounted) applyTheme(theme);
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
