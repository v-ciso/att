'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/white-label/theme-provider';
import { AnnouncerProvider } from '@/components/a11y/announcer';
import { ReactNode } from 'react';
import { TenantSync } from '@/components/dashboard/tenant-sync';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <TenantSync>
        <ThemeProvider>
          <AnnouncerProvider>{children}</AnnouncerProvider>
        </ThemeProvider>
      </TenantSync>
    </SessionProvider>
  );
}
