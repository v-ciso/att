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
      {/* Background Orbs */}
      <div className="orb w-96 h-96 bg-accent-blue" style={{ top: '-100px', right: '-100px' }} />
      <div className="orb w-64 h-64 bg-accent-purple" style={{ bottom: '20%', left: '-50px' }} />
      <div className="orb w-80 h-80 bg-accent-cyan" style={{ top: '50%', right: '30%' }} />

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