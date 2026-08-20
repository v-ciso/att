'use client';

import { ReactNode, Suspense, useState } from 'react';
import { Sidebar } from './sidebar';
import { MobileHeader, MobileMenu } from './mobile-header';
import { TenantSync } from './tenant-sync';
import { PointerGlow } from '@/components/fx/pointer-glow';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Skip link: without it a keyboard or screen-reader user has to walk the
          entire 12-item sidebar again on every page before reaching content.
          Visually hidden until focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-bg-tertiary focus:text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
      >
        Skip to main content
      </a>
      <TenantSync />
      {/* Live ambient background. The dominant orb is BRAND-coloured and sized in
          vw, which is what actually makes the page read gold (or blue/emerald).
          The two supporting orbs stay fixed and faint so the wash never turns
          muddy — a full-viewport gold wash read brown, hence the low opacities. */}
      <div className="aurora" aria-hidden="true" />
      {/* min sizes: vw units shrank these to ~200px on phones, where a 120px
          blur dissolved them completely — mobile got a dead flat background. */}
      <div
        className="orb"
        aria-hidden="true"
        style={{
          width: '52vw', height: '52vw', minWidth: '380px', minHeight: '380px',
          top: '-20vw', right: '-12vw',
          background: 'radial-gradient(circle, var(--brand), transparent 62%)',
          opacity: 0.16, filter: 'blur(120px)',
        }}
      />
      <div
        className="orb"
        aria-hidden="true"
        style={{
          width: '40vw', height: '40vw', minWidth: '300px', minHeight: '300px',
          bottom: '-16vw', left: '-10vw',
          background: 'radial-gradient(circle, var(--brand-3), transparent 60%)',
          opacity: 0.09, filter: 'blur(120px)',
        }}
      />
      <div
        className="orb"
        aria-hidden="true"
        style={{
          width: '30vw', height: '30vw', minWidth: '240px', minHeight: '240px',
          top: '36%', right: '6%',
          background: 'radial-gradient(circle, #06B6D4, transparent 60%)',
          opacity: 0.06, filter: 'blur(120px)',
        }}
      />

      {/* Cursor-follow spotlight — desktop only, see components/fx/pointer-glow.tsx */}
      <PointerGlow />

      <MobileHeader onMenuClick={toggleMobileMenu} />
      <Suspense fallback={null}>
        <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      </Suspense>

      {/* content-below-header replaces pt-14: the fixed header now grows by
          env(safe-area-inset-top) on notched phones, and the old hardcoded
          offset left the page title underneath it. */}
      <div className="flex min-h-screen content-below-header">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>

        {/* id="reportContent" is the PDF/print capture target and is relied on
            elsewhere — keep it. The skip link needs its own stable anchor, and
            tabIndex={-1} lets focus actually land here when the link is used. */}
        <main
          id="reportContent"
          className="flex-1 lg:ml-64 p-4 lg:p-8 min-w-0"
          tabIndex={-1}
        >
          <span id="main-content" className="sr-only" tabIndex={-1} />
          {children}
        </main>
      </div>
    </div>
  );
}
