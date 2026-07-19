'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/white-label/theme-provider';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  );
}