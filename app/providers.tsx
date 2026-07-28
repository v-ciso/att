'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/white-label/theme-provider';
import { AnnouncerProvider } from '@/components/a11y/announcer';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <AnnouncerProvider>{children}</AnnouncerProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
