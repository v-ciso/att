'use client';

import { ReactNode, Suspense, useState } from 'react';
import { Sidebar } from './sidebar';
import { MobileHeader, MobileMenu } from './mobile-header';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Live ambient background. The dominant orb is BRAND-coloured and sized in
          vw, which is what actually makes the page read gold (or blue/emerald).
          The two supporting orbs stay fixed and faint so the wash never turns
          muddy — a full-viewport gold wash read brown, hence the low opacities. */}
      <div className="aurora" aria-hidden="true" />
      <div
        className="orb"
        aria-hidden="true"
        style={{
          width: '52vw', height: '52vw', top: '-20vw', right: '-12vw',
          background: 'radial-gradient(circle, var(--brand), transparent 62%)',
          opacity: 0.16, filter: 'blur(120px)',
        }}
      />
      <div
        className="orb"
        aria-hidden="true"
        style={{
          width: '40vw', height: '40vw', bottom: '-16vw', left: '-10vw',
          background: 'radial-gradient(circle, #3B82F6, transparent 60%)',
          opacity: 0.09, filter: 'blur(120px)',
        }}
      />
      <div
        className="orb"
        aria-hidden="true"
        style={{
          width: '30vw', height: '30vw', top: '36%', right: '6%',
          background: 'radial-gradient(circle, #06B6D4, transparent 60%)',
          opacity: 0.06, filter: 'blur(120px)',
        }}
      />

      <MobileHeader onMenuClick={toggleMobileMenu} />
      <Suspense fallback={null}>
        <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      </Suspense>

      <div className="flex min-h-screen pt-14 lg:pt-0">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>

        <main id="reportContent" className="flex-1 lg:ml-64 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}